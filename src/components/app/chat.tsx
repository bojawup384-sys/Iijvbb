"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Brain,
  Copy,
  Crown,
  Download,
  FileText,
  Languages,
  Lightbulb,
  Lock,
  MessageSquarePlus,
  Mic,
  Paperclip,
  PanelRight,
  PenLine,
  RotateCcw,
  Square,
  SquarePen,
  Trash2,
  X,
  Info,
  Zap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useCredits, UserAvatar } from "@/components/app/app-shell";
import { Markdown } from "@/components/markdown";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { usePro } from "@/lib/pro-i18n";
import {
  MAX_FILES,
  MAX_PAYLOAD,
  payloadSize,
  prepareFile,
  type PendingFile,
} from "@/lib/attachments";

type Msg = {
  id: number;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  /** names of files attached to a user message (display only) */
  files?: string[];
};
type ConvSummary = { id: string; title: string; updatedAt: string };
type ErrKind = "quota" | "nokey" | "busy" | "generic" | "pro";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechCtor = new () => SpeechRec;
function getSpeech(): SpeechCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const W = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return W.SpeechRecognition ?? W.webkitSpeechRecognition;
}

let msgCounter = 0;
const nextId = () => ++msgCounter;

const SUGGESTION_ICONS: LucideIcon[] = [PenLine, BookOpen, Languages, Lightbulb];

function formatDay(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale, {
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* ------------------------------------------------------------------ */
/* One message — memoised so only the streaming bubble re-renders      */
/* ------------------------------------------------------------------ */

function ThinkingOrb({ label }: { label: string }) {
  const steps = ["يحلل سؤالك", "يجمع الأفكار", "يكتب الإجابة"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % steps.length), 1600);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <span className="flex items-center gap-3 py-1.5 text-sm text-slate-300">
      <span className="relative grid h-7 w-7 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-300 border-e-brand-300" style={{ animationDuration: "1.1s" }} />
        <Sparkles className="h-3.5 w-3.5 text-brand-300" />
      </span>
      <span className="font-semibold">{label} <span className="text-slate-500">· {steps[i]}…</span></span>
    </span>
  );
}

const MessageRow = memo(function MessageRow({
  m,
  name,
  photo,
  thinking,
  copyLabel,
  copiedLabel,
  pro,
}: {
  m: Msg;
  name: string | null;
  photo: string | null;
  thinking: string;
  copyLabel: string;
  copiedLabel: string;
  pro: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = m.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-base font-bold leading-none text-[#faf4e6] ring-1 ring-white/10">
          ب
        </span>
      )}

      <div
        className={cn(
          "min-w-0",
          isUser ? "max-w-[86%] sm:max-w-[78%]" : "max-w-[calc(100%-2.75rem)] flex-1"
        )}
      >
        <div
          className={cn(
            isUser
              ? "rounded-2xl rounded-se-md bg-brand-600 px-4 py-3 text-[16px] leading-relaxed text-white ring-1 ring-white/10"
              : "rounded-2xl rounded-ss-md border border-aqua-300/10 bg-ink-900/90 px-4 py-3.5 text-slate-100"
          )}
        >
          {isUser ? (
            <>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.files && m.files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.files.map((f, i) => (
                    <span
                      key={`${f}-${i}`}
                      className="inline-flex max-w-full items-center gap-1 rounded-lg bg-black/20 px-2 py-1 text-[11px] font-semibold text-white/90"
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span dir="ltr" className="truncate">{f}</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : m.pending && !m.content ? (
            <ThinkingOrb label={thinking} />
          ) : (
            <Markdown pro={pro} plainCode={!!m.pending}>
              {m.content}
            </Markdown>
          )}
        </div>

        {!isUser && !m.pending && m.content && (
          <button
            type="button"
            onClick={async () => {
              if (await copyText(m.content)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }
            }}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-brand-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? copiedLabel : copyLabel}
          </button>
        )}
      </div>

      {isUser && <UserAvatar name={name} photo={photo} size={32} />}
    </motion.div>
  );
});

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ChatPage() {
  const { t, locale, dir } = useI18n();
  const pro = usePro();
  const { user, authFetch } = useAuth();
  const { applyHeaders, profile } = useCredits();
  const isPro = profile?.plan === "pro";
  const searchParams = useSearchParams();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [convs, setConvs] = useState<ConvSummary[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState<ErrKind | null>(null);
  const [errDetail, setErrDetail] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [deep, setDeep] = useState(false);
  const router = useRouter();
  const [tier, setTier] = useState<"v4" | "v5" | "v6">("v6");
  useEffect(() => {
    try {
      const v = localStorage.getItem("barq_tier");
      if (v === "v4" || v === "v5" || v === "v6") setTier(v);
    } catch {}
  }, []);
  const pickTier = (v: "v4" | "v5" | "v6") => {
    if (v !== "v4" && !isPro) {
      router.push("/app/upgrade");
      return;
    }
    setTier(v);
    try { localStorage.setItem("barq_tier", v); } catch {}
  };
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [proHint, setProHint] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickRef = useRef(true);
  const openSeq = useRef(0);
  const lastTextRef = useRef("");
  const lastFilesRef = useRef<PendingFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    setVoiceOk(!!getSpeech());
  }, []);

  /* ---------- scrolling: follow the answer unless the reader scrolled up ---------- */

  const scrollToEnd = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = gap < 90;
    setShowJump(gap > 260);
  }, []);

  useEffect(() => {
    if (stickRef.current) scrollToEnd();
  }, [msgs, scrollToEnd]);

  /* ---------- conversations ---------- */

  const loadConvs = useCallback(async () => {
    try {
      const res = await authFetch("/api/history");
      if (res.ok) {
        const data = (await res.json()) as { conversations: ConvSummary[] };
        setConvs(data.conversations);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingConvs(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) void loadConvs();
  }, [user, loadConvs]);

  const resetChat = useCallback(() => {
    openSeq.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setMsgs([]);
    setConvId(null);
    setError(null);
    setStreaming(false);
    setDrawer(false);
    setFiles([]);
    setNotice(null);
    stickRef.current = true;
    taRef.current?.focus();
  }, []);

  // "New chat" in the shell must clear the screen even when we are already on /app
  useEffect(() => {
    const onNew = () => resetChat();
    window.addEventListener("barq:new-chat", onNew);
    return () => window.removeEventListener("barq:new-chat", onNew);
  }, [resetChat]);

  const openConv = useCallback(
    async (id: string) => {
      const seq = ++openSeq.current;
      abortRef.current?.abort();
      abortRef.current = null;
      setStreaming(false);
      setError(null);
      setDrawer(false);
      try {
        const res = await authFetch(`/api/conversations/${id}`);
        if (!res.ok || seq !== openSeq.current) return;
        const data = (await res.json()) as {
          messages: { role: string; content: string }[];
        };
        if (seq !== openSeq.current) return;
        stickRef.current = true;
        setConvId(id);
        setMsgs(
          data.messages.map((m) => ({
            id: nextId(),
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          }))
        );
      } catch {
        /* ignore */
      }
    },
    [authFetch]
  );

  // open a conversation via /app?c=<id> (from the history page)
  const wantedConv = searchParams.get("c");
  useEffect(() => {
    if (wantedConv && user) void openConv(wantedConv);
  }, [wantedConv, user, openConv]);

  const deleteConv = useCallback(
    async (id: string) => {
      setConvs((cs) => cs.filter((c) => c.id !== id));
      if (convId === id) resetChat();
      await authFetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(
        () => undefined
      );
    },
    [authFetch, convId, resetChat]
  );

  /* ---------- sending ---------- */

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string, retry = false) => {
      const sendFiles = retry ? lastFilesRef.current : files;
      const content = text.trim() || (sendFiles.length > 0 ? pro.defaultAsk : "");
      if (!content || streaming) return;
      lastTextRef.current = text.trim();
      lastFilesRef.current = sendFiles;
      setFiles([]);
      setNotice(null);
      setProHint(false);
      setError(null);
      setStreaming(true);
      setInput("");
      stickRef.current = true;
      if (taRef.current) taRef.current.style.height = "auto";

      // on retry the failed user message is already on screen: don't duplicate it
      const base =
        retry && msgs[msgs.length - 1]?.role === "user" ? msgs.slice(0, -1) : msgs;
      const history = base.map((m) => ({ role: m.role, content: m.content }));
      setMsgs([
        ...base,
        {
          id: nextId(),
          role: "user",
          content,
          files: sendFiles.length > 0 ? sendFiles.map((f) => f.name) : undefined,
        },
        { id: nextId(), role: "assistant", content: "", pending: true },
      ]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const mine = () => abortRef.current === controller;

      let acc = "";
      let timer: ReturnType<typeof setTimeout> | null = null;
      // paint the answer ~16×/s instead of once per network chunk: far less
      // markdown re-parsing, so long answers stay smooth even on weak phones
      const flush = () => {
        timer = null;
        const snapshot = acc;
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (!last || last.role !== "assistant") return m;
          return [...m.slice(0, -1), { ...last, content: snapshot }];
        });
      };
      const schedule = () => {
        if (!timer) timer = setTimeout(flush, 60);
      };

      try {
        const res = await authFetch("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({
            conversationId: convId,
            messages: [...history, { role: "user", content }],
            ...(isPro && sendFiles.length > 0
              ? {
                  attachments: sendFiles
                    .filter((f) => f.data)
                    .map((f) => ({ name: f.name, mime: f.mime, data: f.data })),
                  textFiles: sendFiles
                    .filter((f) => f.text !== undefined)
                    .map((f) => ({ name: f.name, text: f.text })),
                }
              : {}),
            ...(isPro && (deep || tier === "v6") ? { deep: true } : {}),
            ...(isPro && tier === "v6" ? { v6: true } : {}),
          }),
          signal: controller.signal,
        });

        if (!mine()) return;

        if (!res.ok) {
          let code = "";
          let detail = "";
          try {
            const j = (await res.json()) as { code?: string; detail?: string };
            code = j.code ?? "";
            detail = j.detail ?? "";
          } catch {
            /* ignore */
          }
          setErrDetail(detail);
          setMsgs((m) => m.filter((x) => !x.pending));
          setError(
            code === "QUOTA"
              ? "quota"
              : code === "PRO_ONLY"
                ? "pro"
                : code === "NO_KEY"
                ? "nokey"
                : code === "UNAUTHENTICATED" || code === "DB"
                  ? "generic"
                  : "busy"
          );
          return;
        }

        applyHeaders(res);
        const newConvId = res.headers.get("x-conversation-id");
        if (newConvId && !convId) setConvId(newConvId);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("no stream");
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          schedule();
        }
        acc += decoder.decode();
        if (timer) clearTimeout(timer);
        flush();
        setMsgs((m) => m.map((x) => (x.pending ? { ...x, pending: false } : x)));
        // refresh conversation list (title may be new)
        setTimeout(() => void loadConvs(), 400);
      } catch (e) {
        if (timer) clearTimeout(timer);
        if (!mine()) return; // superseded by "new chat" / another conversation
        if ((e as Error).name === "AbortError") {
          // user pressed stop: keep what was already written
          flush();
          setMsgs((m) =>
            m
              .filter((x) => !(x.pending && !x.content))
              .map((x) => (x.pending ? { ...x, pending: false } : x))
          );
        } else {
          setMsgs((m) => m.filter((x) => !x.pending));
          setError("generic");
        }
      } finally {
        if (mine()) {
          abortRef.current = null;
          setStreaming(false);
        }
      }
    },
    [msgs, streaming, convId, authFetch, applyHeaders, loadConvs, files, isPro, deep, tier, pro.defaultAsk]
  );

  /* ---------- Pro: attachments, voice, export ---------- */

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      if (!isPro) {
        setProHint(true);
        return;
      }
      setNotice(null);
      let cur = files;
      for (const f of Array.from(list)) {
        if (cur.length >= MAX_FILES) {
          setNotice(pro.attachedMax);
          break;
        }
        const r = await prepareFile(f);
        if (!r.ok) {
          setNotice(r.problem === "big" ? pro.fileTooBig : pro.fileBad);
          continue;
        }
        if (payloadSize([...cur, r.file]) > MAX_PAYLOAD) {
          setNotice(pro.totalTooBig);
          continue;
        }
        cur = [...cur, r.file];
        setFiles(cur);
      }
    },
    [isPro, files, pro]
  );

  const removeFile = (id: number) => {
    setFiles((fs) => {
      const gone = fs.find((f) => f.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return fs.filter((f) => f.id !== id);
    });
    setNotice(null);
  };

  const toggleVoice = () => {
    if (!isPro) {
      setProHint(true);
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getSpeech();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US";
    r.interimResults = true;
    r.continuous = false;
    const base = input.trim() ? `${input.trim()} ` : "";
    r.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput(base + txt);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };

  const exportChat = () => {
    const md = msgs
      .filter((m) => m.content)
      .map((m) => `### ${m.role === "user" ? "👤" : "⚡ Barq"}\n\n${m.content}`)
      .join("\n\n---\n\n");
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "barq-chat.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // stop the microphone when leaving the page
  useEffect(() => () => recRef.current?.stop(), []);

  // never leave a request running after leaving the page
  useEffect(() => () => abortRef.current?.abort(), []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const empty = msgs.length === 0;
  const canSend = (input.trim().length > 0 || files.length > 0) && !streaming;

  const errText: Record<ErrKind, string> = {
    quota: t.app.quotaTitle + " — " + t.app.quotaSub,
    nokey: t.app.aiOff,
    busy: t.app.serverBusy,
    generic: t.common.error,
    pro: pro.proOnly,
  };

  /* ---------- conversation list ---------- */

  const convPanel = (
    <div className="flex h-full w-full flex-col gap-1 overflow-hidden">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-500">{t.app.recentChats}</span>
        <button
          type="button"
          onClick={resetChat}
          aria-label={t.app.newChat}
          className="grid h-9 w-9 place-items-center rounded-xl text-brand-300 transition hover:bg-brand-500/15"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </button>
      </div>
      <div className="scroll-y flex-1 space-y-1 pe-1">
        {loadingConvs ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="shimmer-line h-11 rounded-xl" />
            ))}
          </div>
        ) : convs.length === 0 ? (
          <p className="px-2 pt-4 text-xs leading-relaxed text-slate-500">
            {t.app.noChats}
          </p>
        ) : (
          convs.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => void openConv(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void openConv(c.id);
                }
              }}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 transition",
                convId === c.id ? "bg-white/[0.08]" : "hover:bg-white/5"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-slate-200">
                  {c.title || t.app.newChat}
                </p>
                <p className="text-[10px] text-slate-500">
                  {formatDay(c.updatedAt, locale)}
                </p>
              </div>
              {/* always reachable on touch screens; hover-reveal only where hover exists */}
              <button
                type="button"
                aria-label={t.app.deleteChat}
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteConv(c.id);
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 opacity-70 transition hover:bg-rose-500/15 hover:text-rose-300 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* desktop conversations */}
      <aside className="hidden w-60 shrink-0 border-e border-white/6 bg-ink-950/60 p-3 xl:block">
        {convPanel}
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 xl:hidden"
              onClick={() => setDrawer(false)}
            />
            <motion.div
              initial={{ x: dir === "rtl" ? "-100%" : "100%" }}
              animate={{ x: 0 }}
              exit={{ x: dir === "rtl" ? "-100%" : "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed inset-y-0 end-0 z-50 w-72 border-s border-white/8 bg-ink-900 p-4 pt-[max(1rem,env(safe-area-inset-top))] xl:hidden"
            >
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label={t.common.close}
                className="mb-3 grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
              {convPanel}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* main column */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* messages */}
        <div ref={scrollRef} onScroll={onScroll} className="scroll-y flex-1">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-4 pt-4 sm:px-6">
            {/* mobile conv toggle */}
            <div className="mb-4 flex items-center justify-between xl:hidden">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-300"
              >
                <PanelRight className="h-4 w-4" />
                {t.app.recentChats}
              </button>
              <button
                type="button"
                onClick={resetChat}
                className="flex items-center gap-1.5 rounded-xl bg-brand-500/15 px-3.5 py-2 text-xs font-bold text-brand-300 ring-1 ring-brand-400/25"
              >
                <SquarePen className="h-3.5 w-3.5" />
                {t.app.newChat}
              </button>
            </div>

            {empty ? (
              <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45 }}
                  className="mb-6"
                >
                  <Logo size={64} withText={false} />
                </motion.div>
                <h1 className="text-2xl font-bold text-white sm:text-4xl">
                  {t.app.welcomeTitle}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
                  {t.app.welcomeSub}
                </p>
                <div className="mt-8 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
                  {t.app.suggestions.map((s, i) => {
                    const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="flex items-start gap-3 rounded-2xl border border-aqua-300/10 bg-ink-900/80 px-4 py-3.5 text-start text-sm font-medium leading-relaxed text-slate-300 transition hover:border-brand-500/50 hover:text-white active:scale-[0.99]"
                      >
                        <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-400" />
                        <span>{s}</span>
                      </button>
                    );
                  })}
                </div>
                {isPro && (
                  <div className="mt-3 flex w-full max-w-2xl flex-wrap justify-center gap-2">
                    {pro.proQuick.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setInput(q + "\n\n");
                          taRef.current?.focus();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-3.5 py-2 text-xs font-bold text-amber-100 transition hover:border-amber-300/50"
                      >
                        <Zap className="h-3.5 w-3.5 text-amber-300" />
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {msgs.map((m) => (
                  <MessageRow
                    key={m.id}
                    m={m}
                    name={user?.displayName ?? null}
                    photo={user?.photoURL ?? null}
                    thinking={t.app.thinking}
                    copyLabel={t.common.copy}
                    copiedLabel={t.common.copied}
                    pro={!!isPro}
                  />
                ))}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5 text-center"
                  >
                    {error === "quota" || error === "pro" ? (
                      <Crown className="mx-auto mb-2.5 h-6 w-6 text-amber-300" />
                    ) : (
                      <AlertTriangle className="mx-auto mb-2.5 h-6 w-6 text-amber-300" />
                    )}
                    <p className="text-sm font-bold text-amber-100">{errText[error]}</p>
                    {errDetail && error !== "quota" && error !== "pro" && (
                      <p
                        dir="ltr"
                        className="mx-auto mt-2 max-w-md break-words text-start text-[11px] leading-relaxed text-amber-200/60"
                      >
                        {errDetail}
                      </p>
                    )}
                    {error === "quota" || error === "pro" ? (
                      <Link href="/app/upgrade" className="btn-primary mt-4 px-6 py-2.5 text-sm">
                        {error === "pro" ? pro.upgrade : t.app.quotaBtn}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void send(lastTextRef.current, true)}
                        className="btn-ghost mt-4 px-5 py-2 text-sm"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t.common.retry}
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* jump to latest */}
        <AnimatePresence>
          {showJump && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => {
                stickRef.current = true;
                scrollToEnd(true);
              }}
              aria-label={t.app.jumpToEnd}
              className="absolute inset-x-0 bottom-[9.5rem] z-10 mx-auto grid h-10 w-10 place-items-center rounded-full border border-aqua-300/20 bg-ink-800 text-slate-200 shadow-lg shadow-black/40"
            >
              <ArrowDown className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* composer */}
        <div className="shrink-0 px-2.5 pb-0.5 pt-0 sm:px-6 sm:pb-2">
          <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl">
            {proHint && !isPro && (
              <div className="mb-2 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3.5">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-amber-100">{pro.proOnly}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-100/70">
                    {pro.proOnlyHint}
                  </p>
                  <Link href="/app/upgrade" className="btn-primary mt-2.5 px-4 py-2 text-xs">
                    {pro.upgrade}
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => setProHint(false)}
                  aria-label={t.common.close}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-amber-100/60 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {files.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {files.map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex max-w-[15rem] items-center gap-2 rounded-xl border border-white/10 bg-ink-800 py-1 pe-1 ps-1.5 text-xs font-semibold text-slate-200"
                  >
                    {f.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt="" className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-md bg-white/8">
                        <FileText className="h-4 w-4 text-brand-300" />
                      </span>
                    )}
                    <span dir="ltr" className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      aria-label={pro.remove}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {notice && (
              <p className="mb-2 px-2 text-xs font-bold text-rose-300">{notice}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept="image/*,application/pdf,text/*,.md,.json,.js,.jsx,.ts,.tsx,.mjs,.py,.php,.java,.kt,.swift,.c,.h,.cpp,.cs,.go,.rs,.rb,.sh,.sql,.html,.css,.scss,.vue,.svelte,.yml,.yaml,.xml,.csv,.log,.toml,.ini"
              onChange={(e) => {
                const list = e.target.files;
                if (list && list.length > 0) void addFiles(Array.from(list));
                e.target.value = "";
              }}
            />
            <div className="flex items-end gap-1.5 rounded-[1.75rem] border border-aqua-300/15 bg-ink-900/95 p-2 ps-2 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] transition focus-within:border-brand-400/60 focus-within:shadow-[0_0_0_4px_rgba(38,160,111,0.14),0_18px_50px_-24px_rgba(0,0,0,0.9)]">
              <button
                type="button"
                onClick={() => (isPro ? fileRef.current?.click() : setProHint(true))}
                aria-label={pro.attach}
                title={pro.attach}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/8 hover:text-brand-300 active:scale-90"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 170)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                  // on phones Enter is a new line; the send button sends
                  if (window.matchMedia("(pointer: coarse)").matches) return;
                  e.preventDefault();
                  void send(input);
                }}
                onPaste={(e) => {
                  const fl = e.clipboardData?.files;
                  if (fl && fl.length > 0) {
                    e.preventDefault();
                    void addFiles(Array.from(fl));
                  }
                }}
                rows={1}
                enterKeyHint="send"
                autoComplete="off"
                placeholder={t.app.inputPlaceholder}
                aria-label={t.app.inputPlaceholder}
                className="max-h-[170px] min-h-[44px] w-full flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-relaxed text-slate-100 outline-none placeholder:text-slate-500"
              />

              {voiceOk && !streaming && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-label={listening ? pro.voiceStop : pro.voice}
                  title={listening ? pro.voiceStop : pro.voice}
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90",
                    listening
                      ? "animate-pulse bg-rose-500/25 text-rose-200"
                      : "text-slate-400 hover:bg-white/8 hover:text-brand-300"
                  )}
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label={t.app.stop}
                  title={t.app.stop}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-aqua-300 text-ink-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition active:scale-90"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label={t.app.send}
                  title={t.app.send}
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full transition duration-150 active:scale-90",
                    canSend
                      ? "bg-gradient-to-b from-[#22a977] to-brand-600 text-[#faf4e6] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_20px_-8px_rgba(38,160,111,0.9)] hover:brightness-110"
                      : "bg-white/[0.07] text-slate-500"
                  )}
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
                </button>
              )}
            </div>
          </form>
          <div className="mx-auto mb-1.5 mt-1 flex max-w-3xl items-center gap-1 px-1.5" role="radiogroup" aria-label="النموذج">
            {([["v4", "برق 4", false], ["v5", "برق 5 Pro", true], ["v6", "برق 6 Pro", true]] as const).map(([id, label, pr]) => {
              const on = (isPro ? tier : "v4") === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickTier(id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-black transition",
                    on
                      ? id === "v6"
                        ? "border-amber-300/70 bg-gradient-to-l from-amber-300/25 to-brand-400/25 text-amber-100 shadow-[0_0_18px_-4px_rgba(227,176,75,.6)]"
                        : "border-brand-400/60 bg-brand-500/20 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25"
                  )}
                >
                  {id === "v6" ? <Sparkles className="h-3 w-3" /> : pr && !isPro ? <Lock className="h-3 w-3" /> : null}
                  {label}
                </button>
              );
            })}
          </div>
          {isPro && (
            <div className="mx-auto mt-1 flex max-w-3xl items-center gap-1.5 px-1.5">
              <button
                type="button"
                onClick={() => setDeep((v) => !v)}
                aria-pressed={deep}
                title={pro.deepHint}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-bold transition",
                  deep
                    ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25"
                )}
              >
                <Brain className="h-3.5 w-3.5" />
                {pro.deepOn}
              </button>
              {msgs.some((m) => m.content) && (
                <button
                  type="button"
                  onClick={exportChat}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-bold text-slate-400 transition hover:border-white/25"
                >
                  <Download className="h-3.5 w-3.5" />
                  {pro.exportChat}
                </button>
              )}
              <span className="ms-auto inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-200/80">
                <Zap className="h-3.5 w-3.5" />
                {pro.fast}
              </span>
            </div>
          )}
          {profile && profile.plan !== "pro" && (
            <div className="mx-auto mt-1 flex max-w-3xl items-center gap-2.5 px-2">
              {(

                <>
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={profile.dailyLimit}
                    aria-valuenow={profile.creditsLeft}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        profile.creditsLeft <= 3 ? "bg-amber-400" : "bg-brand-500"
                      )}
                      style={{
                        width: `${Math.max(0, Math.min(100, (profile.creditsLeft / profile.dailyLimit) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">
                    {profile.creditsLeft}/{profile.dailyLimit} {t.app.remainingToday}
                  </span>
                </>
              )}
            </div>
          )}
          <p className="mx-auto mt-1.5 hidden max-w-3xl px-2 text-center text-[11px] text-slate-600 sm:block">
            <Info className="me-1 inline h-3 w-3" />
            {t.app.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
