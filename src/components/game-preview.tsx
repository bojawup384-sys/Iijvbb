"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
} from "lucide-react";
import { usePro } from "@/lib/pro-i18n";
import { cn } from "@/lib/utils";

/**
 * Generated pages run in a sandbox: scripts allowed, but NO same-origin access
 * (cannot read the app's cookies / tokens) and a CSP that blocks all network.
 */
const CSP =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src \'none\'">';

function withCsp(html: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${CSP}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head>${CSP}</head>`);
  return `<!DOCTYPE html><html><head>${CSP}<meta charset="utf-8"></head><body>${html}</body></html>`;
}

export function GamePreview({
  html,
  className,
  height = 460,
}: {
  html: string;
  className?: string;
  height?: number;
}) {
  const p = usePro();
  const [run, setRun] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const doc = useMemo(() => withCsp(html), [html]);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"phone" | "tablet" | "desktop">("desktop");
  const [flash, setFlash] = useState("");
  const widths = { phone: 390, tablet: 768, desktop: 0 } as const;

  const say = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(""), 1800);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      say("تم النسخ");
    } catch {
      say("تعذّر النسخ");
    }
  };
  const openTab = () => {
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const save = () => {
    try {
      const raw = localStorage.getItem("barq_gallery");
      const list: { id: number; title: string; html: string; at: number }[] = raw ? JSON.parse(raw) : [];
      const title = (html.match(/<title>([^<]{1,60})<\/title>/i)?.[1] ?? "عمل بدون عنوان").trim();
      list.unshift({ id: Date.now(), title, html, at: Date.now() });
      localStorage.setItem("barq_gallery", JSON.stringify(list.slice(0, 12)));
      say("حُفظ في الاستوديو");
    } catch {
      say("المساحة ممتلئة");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "barq-game.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const full = () => {
    void boxRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition hover:border-brand-400/40 hover:text-white";

  return (
    <div
      ref={boxRef}
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-brand-500/30 bg-ink-950",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 bg-ink-900 px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-black/30 p-0.5">
          {(["preview", "code"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-black transition",
                view === v ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
              )}
            >
              {v === "code" && <Code2 className="h-3.5 w-3.5" />}
              {v === "preview" ? "معاينة" : "الكود"}
            </button>
          ))}
        </div>
        {view === "preview" && (
          <div className="flex items-center gap-0.5" role="group" aria-label="الجهاز">
            {([["phone", Smartphone], ["tablet", Tablet], ["desktop", Monitor]] as const).map(([d, Ic]) => (
              <button
                key={d}
                type="button"
                aria-label={d}
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-md transition",
                  device === d ? "bg-white/15 text-white" : "text-slate-500 hover:text-white"
                )}
              >
                <Ic className="h-4 w-4" />
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btn} onClick={() => setRun((n) => n + 1)}>
            <RotateCcw className="h-3.5 w-3.5" />
            {p.gameReload}
          </button>
          <button type="button" className={btn} onClick={full}>
            <Maximize2 className="h-3.5 w-3.5" />
            {p.gameFull}
          </button>
          <button type="button" className={btn} onClick={openTab}>
            <ExternalLink className="h-3.5 w-3.5" />
            تبويب
          </button>
          <button type="button" className={btn} onClick={copy}>
            <Copy className="h-3.5 w-3.5" />
            نسخ
          </button>
          <button type="button" className={btn} onClick={save}>
            <Bookmark className="h-3.5 w-3.5" />
            حفظ
          </button>
          <button type="button" className={btn} onClick={download}>
            <Download className="h-3.5 w-3.5" />
            {p.gameDownload}
          </button>
        </div>
      </div>
      {flash && (
        <p className="flex items-center justify-center gap-1.5 bg-brand-500/15 py-1 text-[11px] font-black text-brand-300">
          <Check className="h-3.5 w-3.5" />
          {flash}
        </p>
      )}
      {view === "code" ? (
        <pre dir="ltr" className="overflow-auto bg-black p-4 text-left text-[11.5px] leading-relaxed text-slate-300" style={{ height, minHeight: 280 }}>
          <code>{html}</code>
        </pre>
      ) : (
        <div className="flex flex-1 justify-center bg-[radial-gradient(circle_at_50%_0%,#16241d,#050806)] p-0 sm:p-3">
          <iframe
            key={run}
            title={p.gameTitle}
            srcDoc={doc}
            sandbox="allow-scripts allow-pointer-lock"
            allow="fullscreen"
            className={cn("block bg-black transition-all duration-300", device !== "desktop" && "rounded-[1.6rem] ring-4 ring-white/10")}
            style={{ height, minHeight: 280, width: widths[device] ? `min(100%, ${widths[device]}px)` : "100%" }}
          />
        </div>
      )}
    </div>
  );
}
