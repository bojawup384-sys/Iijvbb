import { json, safeDetail } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { verifyRequest } from "@/lib/server-auth";
import { takeCredit, refundCredit, FREE_DAILY } from "@/lib/usage";
import { getGeminiKey } from "@/lib/gemini";
import { isRatio, styleAdd } from "@/lib/image-styles";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Set to true to make image generation a Pro-only feature. */
const IMAGE_PRO_ONLY = false;
const MAX_PROMPT = 1200;
const MAX_REF_BYTES = 3_500_000; // base64 chars of the optional reference image

/** Override with GEMINI_IMAGE_MODEL in Vercel; the rest are fallbacks. */
function imageModels(): string[] {
  const env = (process.env.GEMINI_IMAGE_MODEL ?? "").trim();
  const list = [env, "gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"].filter(Boolean);
  return [...new Set(list)];
}

type Part = { text?: string; inlineData?: { mimeType?: string; data?: string } };

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return json(401, { code: "UNAUTHENTICATED" });

  let body: {
    prompt?: string;
    style?: string;
    ratio?: string;
    ref?: { mime?: string; data?: string } | null;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { code: "BAD_BODY" });
  }

  const prompt = (typeof body.prompt === "string" ? body.prompt : "").trim().slice(0, MAX_PROMPT);
  if (prompt.length < 3) return json(400, { code: "MISSING_FIELD", field: "prompt" });

  const key = getGeminiKey();
  if (!key) return json(503, { code: "NO_KEY" });

  // reference image (editing): only real image types, size-capped
  let ref: { mime: string; data: string } | null = null;
  if (body.ref && typeof body.ref.data === "string" && typeof body.ref.mime === "string") {
    if (!/^image\/(png|jpeg|webp)$/.test(body.ref.mime) || body.ref.data.length > MAX_REF_BYTES) {
      return json(400, { code: "BAD_IMAGE" });
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(body.ref.data)) return json(400, { code: "BAD_IMAGE" });
    ref = { mime: body.ref.mime, data: body.ref.data };
  }

  // images are expensive: a tighter limit than text
  if (!rateLimit(`img:${user.uid}`, 6, 60_000).ok) {
    return json(429, { code: "RATE" }, { "Retry-After": "30" });
  }

  const taken = await takeCredit(user);
  if (taken && !taken.ok) return json(429, { code: "QUOTA" });
  const credit = taken ?? { ok: true as const, remaining: FREE_DAILY, plan: "free" as const, tracked: false };
  const refund = async () => {
    if (credit.tracked) await refundCredit(user.uid);
  };

  if (IMAGE_PRO_ONLY && credit.plan !== "pro") {
    await refund();
    return json(403, { code: "PRO_ONLY" });
  }

  const ratio = isRatio(body.ratio) ? body.ratio : "1:1";
  const add = styleAdd(body.style);
  const finalPrompt = ref
    ? `${prompt}${add ? `. Style: ${add}` : ""}. Edit the provided image accordingly and keep its main subject.`
    : `${prompt}${add ? `. Style: ${add}` : ""}. Aspect ratio ${ratio}. Make it look professional and detailed.`;

  const parts: Part[] = [];
  if (ref) parts.push({ inlineData: { mimeType: ref.mime, data: ref.data } });
  parts.push({ text: finalPrompt });

  let lastNote = "";
  for (const model of imageModels()) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              ...(ref ? {} : { imageConfig: { aspectRatio: ratio } }),
            },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(100_000),
        }
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        lastNote = `${model}: ${res.status} ${safeDetail(t)}`;
        // 400 may just mean this model rejects imageConfig → retry once without it
        if (res.status === 400 && /imageConfig|aspect/i.test(t) && !ref) {
          const retry = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": key },
              body: JSON.stringify({
                contents: [{ role: "user", parts }],
                generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
              }),
              cache: "no-store",
              signal: AbortSignal.timeout(100_000),
            }
          );
          if (retry.ok) {
            const out = await extract(retry);
            if (out.image) return ok(out.image, model, credit.remaining);
            lastNote = out.note || lastNote;
          }
        }
        continue;
      }
      const out = await extract(res);
      if (out.image) return ok(out.image, model, credit.remaining);
      lastNote = out.note || `${model}: no image`;
    } catch (e) {
      lastNote = `${model}: ${safeDetail(e)}`;
    }
  }

  await refund();
  const blocked = /safety|blocked|prohibited|recitation/i.test(lastNote);
  return json(blocked ? 422 : 502, { code: blocked ? "BLOCKED" : "FAILED", detail: lastNote.slice(0, 240) });
}

async function extract(res: Response): Promise<{ image?: { mime: string; data: string }; note?: string }> {
  const j = (await res.json().catch(() => null)) as {
    candidates?: { finishReason?: string; content?: { parts?: Part[] } }[];
    promptFeedback?: { blockReason?: string };
  } | null;
  const cand = j?.candidates?.[0];
  for (const p of cand?.content?.parts ?? []) {
    if (p.inlineData?.data) {
      return { image: { mime: p.inlineData.mimeType || "image/png", data: p.inlineData.data } };
    }
  }
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join(" ").trim();
  return { note: j?.promptFeedback?.blockReason || cand?.finishReason || text.slice(0, 160) };
}

function ok(image: { mime: string; data: string }, model: string, remaining: number): Response {
  return json(
    200,
    { image: image.data, mime: image.mime, model },
    { "x-credits-remaining": String(remaining) }
  );
}
