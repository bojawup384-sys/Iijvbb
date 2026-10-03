"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Download,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
  X,
  Crown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCredits } from "@/components/app/app-shell";
import { IMAGE_RATIOS, IMAGE_STYLES, type ImageRatio, type ImageStyleId } from "@/lib/image-styles";
import { cn } from "@/lib/utils";

type Result = {
  id: number;
  src: string; // data URL
  prompt: string;
  style: ImageStyleId;
  ratio: ImageRatio;
};

type Failure = "quota" | "pro" | "blocked" | "rate" | "nokey" | "failed";

const FAIL_TEXT: Record<Failure, string> = {
  quota: "خلصت نقاطك اليوم. رقّي إلى Pro أو ارجع غدًا.",
  pro: "توليد الصور متاح لحسابات Pro فقط.",
  blocked: "ما قدرتش نولّد هذا الوصف لأسباب تتعلق بالسلامة. غيّر الوصف وجرّب مرة أخرى.",
  rate: "طلبات كثيرة في وقت قصير. استنى نصف دقيقة وعاود.",
  nokey: "مفتاح Gemini غير مضبوط في الخادم.",
  failed: "فشل التوليد. جرّب وصفًا آخر أو عاود بعد لحظات.",
};

const IDEAS = [
  "قهوة جزائرية على شرفة تطل على البحر عند الغروب",
  "شعار لمتجر ملابس شبابي اسمه «برق» بألوان بنفسجي وذهبي",
  "سيارة رياضية في صحراء تمنراست تحت سماء مليئة بالنجوم",
  "صورة إعلان لعطر فاخر على رخام أسود مع انعكاس ذهبي",
];

const ASPECT_CLASS: Record<ImageRatio, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "4:3": "aspect-[4/3]",
  "3:4": "aspect-[3/4]",
};

/** Shrink a reference photo before upload (keeps the request small and fast). */
async function shrink(file: File): Promise<{ mime: string; data: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("bad image"));
      i.src = url;
    });
    const max = 1024;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    const preview = c.toDataURL("image/jpeg", 0.85);
    return { mime: "image/jpeg", data: preview.split(",")[1] ?? "", preview };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ImagesPage() {
  const { authFetch } = useAuth();
  const { applyHeaders, profile } = useCredits();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<ImageStyleId>("auto");
  const [ratio, setRatio] = useState<ImageRatio>("1:1");
  const [ref, setRef] = useState<{ mime: string; data: string; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Failure | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [big, setBig] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);

  const onPick = async (f?: File | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    try {
      setRef(await shrink(f));
    } catch {
      setFail("failed");
    }
  };

  const generate = useCallback(
    async (p = prompt, s = style, r = ratio) => {
      const text = p.trim();
      if (text.length < 3 || busy) return;
      setBusy(true);
      setFail(null);
      try {
        const res = await authFetch("/api/ai/image", {
          method: "POST",
          body: JSON.stringify({
            prompt: text,
            style: s,
            ratio: r,
            ...(ref ? { ref: { mime: ref.mime, data: ref.data } } : {}),
          }),
        });
        if (!res.ok) {
          let code = "";
          try {
            code = ((await res.json()) as { code?: string }).code ?? "";
          } catch {}
          setFail(
            code === "QUOTA" ? "quota" : code === "PRO_ONLY" ? "pro" : code === "BLOCKED" ? "blocked"
              : code === "RATE" ? "rate" : code === "NO_KEY" ? "nokey" : "failed"
          );
          return;
        }
        applyHeaders(res);
        const j = (await res.json()) as { image: string; mime: string };
        setResults((l) => [
          { id: idRef.current++, src: `data:${j.mime};base64,${j.image}`, prompt: text, style: s, ratio: r },
          ...l,
        ].slice(0, 12));
      } catch {
        setFail("failed");
      } finally {
        setBusy(false);
      }
    },
    [prompt, style, ratio, ref, busy, authFetch, applyHeaders]
  );

  const download = (r: Result) => {
    const a = document.createElement("a");
    a.href = r.src;
    a.download = `barq-${r.id}.${r.src.startsWith("data:image/jpeg") ? "jpg" : "png"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const useAsRef = (r: Result) => {
    const [head, data] = r.src.split(",");
    const mime = head.slice(5, head.indexOf(";"));
    setRef({ mime, data, preview: r.src });
    setBig(null);
    window.scrollTo?.({ top: 0 });
  };

  const isPro = profile?.plan === "pro";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:py-10">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-black text-white sm:text-3xl">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 via-fuchsia-500 to-gold-400 text-white">
            <Wand2 className="h-5 w-5" />
          </span>
          مولّد الصور
        </h1>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          اكتب وصفًا بالعربية أو الدارجة أو الفرنسية، أو ارفع صورة وعدّلها. كل صورة تحسب بنقطة واحدة.
        </p>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* controls */}
        <section className="glass-deep h-fit rounded-3xl p-4 sm:p-5">
          <label htmlFor="img-prompt" className="mb-1.5 block text-sm font-bold text-slate-200">
            وصف الصورة
          </label>
          <textarea
            id="img-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void generate();
              }
            }}
            rows={4}
            maxLength={1200}
            placeholder="مثال: قطة بيضاء تلبس قشابية جزائرية فوق سطح بيت قديم في القصبة…"
            className="input-base resize-none leading-relaxed"
          />

          {prompt.trim().length === 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {IDEAS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(i)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-start text-[12px] font-semibold text-slate-300 transition hover:border-brand-400/50 hover:text-white active:scale-95"
                >
                  {i}
                </button>
              ))}
            </div>
          )}

          <p className="mb-1.5 mt-5 text-sm font-bold text-slate-200">الأسلوب</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="الأسلوب">
            {IMAGE_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                onClick={() => setStyle(s.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-bold transition active:scale-95",
                  style === s.id
                    ? "border-brand-300/70 bg-brand-500/30 text-white"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-brand-400/40"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="mb-1.5 mt-5 text-sm font-bold text-slate-200">الأبعاد</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="الأبعاد">
            {IMAGE_RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={ratio === r}
                disabled={!!ref}
                onClick={() => setRatio(r)}
                dir="ltr"
                className={cn(
                  "min-w-14 rounded-full border px-3 py-1.5 text-[12px] font-black transition active:scale-95 disabled:opacity-40",
                  ratio === r
                    ? "border-gold-300/70 bg-gold-400/20 text-gold-100"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-gold-300/40"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                void onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {ref ? (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ref.preview} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <p className="min-w-0 flex-1 text-[12px] font-semibold leading-relaxed text-slate-300">
                  وضع التعديل: صِف التغيير المطلوب على هذه الصورة.
                </p>
                <button
                  type="button"
                  onClick={() => setRef(null)}
                  aria-label="إزالة الصورة"
                  className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 py-3 text-sm font-bold text-slate-300 transition hover:border-brand-400/50 hover:text-white active:scale-[0.99]"
              >
                <ImagePlus className="h-4.5 w-4.5 text-brand-300" />
                ارفع صورة للتعديل (اختياري)
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || prompt.trim().length < 3}
            className="btn-primary mt-5 w-full py-3.5 text-base"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {busy ? "جاري الرسم…" : ref ? "عدّل الصورة" : "ولّد الصورة"}
          </button>
          {profile && !isPro && (
            <p className="mt-2 text-center text-[11px] font-semibold text-slate-500">
              باقي لك {profile.creditsLeft} نقطة اليوم
            </p>
          )}
        </section>

        {/* results */}
        <section aria-live="polite" className="min-w-0">
          {fail && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
              {fail === "quota" || fail === "pro" ? (
                <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-100">{FAIL_TEXT[fail]}</p>
                {(fail === "quota" || fail === "pro") && (
                  <Link href="/app/upgrade" className="btn-primary mt-3 px-5 py-2 text-xs">
                    الترقية إلى Pro
                  </Link>
                )}
              </div>
            </div>
          )}

          {busy && (
            <div className="mb-4 overflow-hidden rounded-3xl border border-white/10">
              <div className={cn("shimmer-line grid place-items-center", ASPECT_CLASS[ratio], "max-h-[60vh] w-full")}>
                <span className="flex items-center gap-2 text-sm font-bold text-brand-200">
                  <Loader2 className="h-4 w-4 animate-spin" /> برق يرسم صورتك…
                </span>
              </div>
            </div>
          )}

          {results.length === 0 && !busy ? (
            <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-white/12 bg-white/[0.02] p-8 text-center">
              <div>
                <Wand2 className="mx-auto h-9 w-9 text-brand-300" />
                <p className="mt-3 text-sm font-bold text-slate-300">صورك تظهر هنا</p>
                <p className="mt-1 text-xs text-slate-500">اكتب وصفًا واضغط «ولّد الصورة»، أو Ctrl + Enter.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {results.map((r, i) => (
                <motion.figure
                  key={r.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900",
                    i === 0 && "col-span-2"
                  )}
                >
                  <button type="button" onClick={() => setBig(r)} className="block w-full" aria-label="تكبير الصورة">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.src} alt={r.prompt} className="h-auto w-full object-cover" />
                  </button>
                  <figcaption className="flex items-center gap-1.5 p-2.5">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-300">{r.prompt}</span>
                    <button
                      type="button"
                      onClick={() => void generate(r.prompt, r.style, r.ratio)}
                      disabled={busy}
                      aria-label="أعد التوليد"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => download(r)}
                      aria-label="تحميل الصورة"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/20 text-brand-200 transition hover:bg-brand-500/35"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          )}
          {results.length > 0 && (
            <p className="mt-3 text-center text-[11px] text-slate-500">
              الصور تُحفظ في هذه الصفحة فقط. حمّل ما تريد قبل أن تغلقها.
            </p>
          )}
        </section>
      </div>

      <AnimatePresence>
        {big && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex flex-col bg-black/90 p-3 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setBig(null)}
          >
            <div className="flex items-center justify-end gap-2 pb-2" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => useAsRef(big)} className="btn-ghost px-4 py-2 text-xs">
                <Wand2 className="h-4 w-4" /> عدّل هذه الصورة
              </button>
              <button type="button" onClick={() => download(big)} className="btn-primary px-4 py-2 text-xs">
                <Download className="h-4 w-4" /> تحميل
              </button>
              <button
                type="button"
                onClick={() => setBig(null)}
                aria-label="إغلاق"
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={big.src} alt={big.prompt} className="max-h-full max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
