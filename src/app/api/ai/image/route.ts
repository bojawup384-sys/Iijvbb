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
  const cfId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  const cfToken = (process.env.CLOUDFLARE_API_TOKEN ?? "").trim();
  const hasCf = !!(cfId && cfToken);
  if (!key && !hasCf) return json(503, { code: "NO_KEY" });

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

  // FREE path: Cloudflare Workers AI (FLUX.1 schnell, ~10k neurons/day at no cost).
  // The text model is only used to turn the user's Arabic/Darija/French idea into
  // an English prompt, which FLUX understands far better.
  if (hasCf && !ref) {
    try {
      const english = key ? await toEnglishPrompt(key, `${prompt}${add ? `. Style: ${add}` : ""}`) : null;
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfToken}` },
          body: JSON.stringify({
            prompt: (english ?? `${prompt}${add ? `. Style: ${add}` : ""}`).slice(0, 2000),
            steps: 6,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(90_000),
        }
      );
      const j = (await res.json().catch(() => null)) as {
        result?: { image?: string };
        errors?: { message?: string }[];
      } | null;
      if (res.ok && j?.result?.image) {
        return ok({ mime: "image/jpeg", data: j.result.image }, "flux-1-schnell", credit.remaining);
      }
      lastNote = `cloudflare: ${res.status} ${safeDetail(j?.errors?.[0]?.message ?? "no image")}`;
    } catch (e) {
      lastNote = `cloudflare: ${safeDetail(e)}`;
    }
  }

  if (!key) {
    await refund();
    return json(502, { code: "FAILED", detail: lastNote.slice(0, 240) });
  }

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

/** Cheap text call (works on the Gemini free tier) → English image prompt, or null. */
async function toEnglishPrompt(key: string, idea: string): Promise<string | null> {
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You write prompts for the FLUX image model. Convert the user's idea (Arabic, Algerian Darija, French or English) into ONE vivid English prompt of at most 60 words: subject, setting, lighting, camera/medium, mood. Output only the prompt, no quotes.",
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: idea }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.6 },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const t = (j.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? "").join("").trim();
    return t.length > 8 ? t : null;
  } catch {
    return null;
  }
}
