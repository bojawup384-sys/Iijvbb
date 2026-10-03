import { json, safeDetail } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { verifyRequest } from "@/lib/server-auth";
import { takeCredit, refundCredit, FREE_DAILY } from "@/lib/usage";
import {
  streamGemini,
  ensembleStream,
  isBuildRequest,
  streamToResponse,
  GeminiError,
  type Attachment,
  type ChatTurn,
} from "@/lib/gemini";
import { CHAT_SYSTEM, CHAT_SYSTEM_PRO, CHAT_SYSTEM_V6, BUILD_SYSTEM_PRO } from "@/lib/prompts";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_MSGS = 24;
const MAX_LEN = 6000;
/** Pro: room for pasted code / text files and a longer memory of the chat. */
const MAX_MSGS_PRO = 40;
const MAX_LEN_PRO = 30000;
const MAX_LEN_PRO_HISTORY = 12000;

/** Pro attachments: images + PDF, validated here (never trust the client). */
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const MAX_FILES = 4;
const MAX_B64_TOTAL = 4_000_000; // ≈3 MB of binary — fits Vercel's 4.5 MB body limit
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const MAX_TEXT_FILES = 4;
const MAX_TEXT_FILE = 60_000;
const MAX_TEXT_TOTAL = 120_000;
type TextFile = { name: string; text: string };

function parseTextFiles(raw: unknown): TextFile[] | "BAD" {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_TEXT_FILES) return "BAD";
  const out: TextFile[] = [];
  let total = 0;
  for (const f of raw as { name?: unknown; text?: unknown }[]) {
    if (!f || typeof f.text !== "string" || !f.text.trim()) return "BAD";
    const text = f.text.slice(0, MAX_TEXT_FILE);
    total += text.length;
    if (total > MAX_TEXT_TOTAL) return "BAD";
    out.push({
      name:
        typeof f.name === "string" ? f.name.replace(/[\r\n`]/g, " ").slice(0, 60) : "file",
      text,
    });
  }
  return out;
}

type RawAttachment = { name?: unknown; mime?: unknown; data?: unknown };

function parseAttachments(
  raw: unknown
): { files: Attachment[]; names: string[] } | "BAD" {
  if (raw === undefined || raw === null) return { files: [], names: [] };
  if (!Array.isArray(raw) || raw.length > MAX_FILES) return "BAD";
  const files: Attachment[] = [];
  const names: string[] = [];
  let total = 0;
  for (const a of raw as RawAttachment[]) {
    if (!a || typeof a.mime !== "string" || typeof a.data !== "string") return "BAD";
    if (!ALLOWED_MIME.has(a.mime)) return "BAD";
    total += a.data.length;
    if (total > MAX_B64_TOTAL || !a.data || !B64_RE.test(a.data)) return "BAD";
    files.push({ mime: a.mime, data: a.data });
    names.push(
      typeof a.name === "string" ? a.name.replace(/[\r\n`]/g, " ").slice(0, 60) : "file"
    );
  }
  return { files, names };
}

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return json(401, { code: "UNAUTHENTICATED" });

  let body: {
    conversationId?: string | null;
    messages?: { role?: string; content?: string }[];
    attachments?: unknown;
    textFiles?: unknown;
    deep?: boolean;
    v6?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { code: "BAD_BODY" });
  }

  // the plan is only known after the credit is taken, so cap lengths afterwards
  const raw = Array.isArray(body.messages)
    ? body.messages.slice(-MAX_MSGS_PRO)
    : [];
  const turns: ChatTurn[] = [];
  for (const m of raw) {
    if (!m || typeof m.content !== "string" || !m.content.trim()) continue;
    turns.push({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      text: m.content.slice(0, MAX_LEN_PRO),
    });
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return json(400, { code: "BAD_MESSAGES" });
  }

  const parsed = parseAttachments(body.attachments);
  if (parsed === "BAD") return json(400, { code: "BAD_ATTACHMENT" });
  const textFiles = parseTextFiles(body.textFiles);
  if (textFiles === "BAD") return json(400, { code: "BAD_ATTACHMENT" });

  const rl = rateLimit(`ai:${user.uid}`, 30, 60_000);
  if (!rl.ok) {
    return json(
      429,
      { code: "RATE" },
      { "Retry-After": String(rl.retryAfter) }
    );
  }

  const taken = await takeCredit(user);
  if (taken && !taken.ok) return json(429, { code: "QUOTA" });
  const credit = taken ?? {
    ok: true as const,
    remaining: FREE_DAILY,
    plan: "free" as const,
    tracked: false,
  };

  const isPro = credit.plan === "pro";

  // attachments and deep mode are Pro features — the server is the real gate
  if (
    !isPro &&
    (parsed.files.length > 0 || textFiles.length > 0 || body.deep === true)
  ) {
    if (credit.tracked) await refundCredit(user.uid);
    return json(403, { code: "PRO_ONLY" });
  }
  // free accounts keep the original 15 requests / minute
  if (!isPro && !rateLimit(`aif:${user.uid}`, 15, 60_000).ok) {
    if (credit.tracked) await refundCredit(user.uid);
    return json(429, { code: "RATE" }, { "Retry-After": "30" });
  }

  // apply the plan's limits (free: the original 24 messages × 6000 chars)
  const capped = isPro
    ? turns.map((t, i) => ({
        ...t,
        text: t.text.slice(0, i === turns.length - 1 ? MAX_LEN_PRO : MAX_LEN_PRO_HISTORY),
      }))
    : turns.slice(-MAX_MSGS).map((t) => ({ ...t, text: t.text.slice(0, MAX_LEN) }));
  if (capped.length === 0 || capped[capped.length - 1].role !== "user") {
    if (credit.tracked) await refundCredit(user.uid);
    return json(400, { code: "BAD_MESSAGES" });
  }

  const lastUser = capped[capped.length - 1].text;
  const fileNames = [...parsed.names, ...textFiles.map((f) => f.name)];
  const savedUser =
    fileNames.length > 0 ? `${lastUser}\n\n📎 ${fileNames.join(" · ")}` : lastUser;
  // text / code files travel inside the prompt (not in the saved history)
  if (textFiles.length > 0) {
    capped[capped.length - 1] = {
      ...capped[capped.length - 1],
      text:
        lastUser +
        textFiles
          .map((f) => `\n\n---\nAttached file: ${f.name}\n\`\`\`\`\n${f.text}\n\`\`\`\``)
          .join(""),
    };
  }

  // History is best-effort and runs in PARALLEL with opening the AI stream,
  // so the first words arrive a few database round-trips sooner.
  const persistP: Promise<string | null> = (async () => {
    try {
      let convId: string | null = body.conversationId ?? null;
      if (convId) {
        const owned = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, convId),
              eq(conversations.userId, user.uid)
            )
          )
          .limit(1);
        if (!owned[0]) convId = null;
      }
      if (!convId) {
        const title = lastUser.replace(/\s+/g, " ").trim().slice(0, 60);
        const created = await db
          .insert(conversations)
          .values({ userId: user.uid, title })
          .returning({ id: conversations.id });
        convId = created[0]?.id ?? null;
      }
      if (convId) {
        await db.insert(messages).values({
          conversationId: convId,
          role: "user",
          content: savedUser,
        });
      }
      return convId;
    } catch {
      return null; // the AI answer still streams
    }
  })();

  let usedModel = "";
  const saveAnswer = async (full: string) => {
    const text = full.trim();
    const id = await persistP;
    if (!text || !id) return;
    await db
      .insert(messages)
      .values({ conversationId: id, role: "assistant", content: text })
      .catch(() => undefined);
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .catch(() => undefined);
  };
  try {
    // Pro + "build me a game / site / app": the whole AI team works together
    const build = isPro && isBuildRequest(lastUser);
    const stream = build
      ? ensembleStream({
          system: BUILD_SYSTEM_PRO,
          epic: true,
          maxTokens: 64000,
          messages: capped,
          attachments: parsed.files,
          temperature: 0.7,
          onModel: (m) => {
            usedModel = m;
          },
          onDone: saveAnswer,
          onFail: async () => {
            if (credit.tracked) await refundCredit(user.uid);
          },
        })
      : await streamGemini({
          system: isPro ? (body.v6 === true ? CHAT_SYSTEM_V6 : CHAT_SYSTEM_PRO) : CHAT_SYSTEM,
          messages: capped,
          tier: isPro ? "pro" : "free",
          mode: isPro && body.deep === true ? "quality" : "speed",
          maxTokens: isPro ? (body.v6 === true ? 32000 : 16000) : undefined,
          attachments: parsed.files,
          onModel: (m) => {
            usedModel = m;
          },
          onDone: saveAnswer,
        });
    const fixedConvId = await persistP;

    return streamToResponse(stream, {
      "x-conversation-id": fixedConvId ?? "",
      "x-credits-remaining": String(credit.remaining),
      "x-plan": credit.plan,
      ...(isPro ? { "x-model": usedModel } : {}),
    });
  } catch (e) {
    if (credit.tracked) await refundCredit(user.uid);
    console.error("[chat] gemini failed:", e);
    if (e instanceof GeminiError) {
      return json(e.code === "NO_KEY" ? 503 : e.code === "BUSY" ? 503 : 500, {
        code: e.code,
        detail: safeDetail(e.detail),
      });
    }
    return json(500, { code: "ERROR", detail: safeDetail(e) });
  }
}
