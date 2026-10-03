"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Maximize2, RotateCcw } from "lucide-react";
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
        <span className="text-xs font-black text-brand-300">{p.gameTitle}</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btn} onClick={() => setRun((n) => n + 1)}>
            <RotateCcw className="h-3.5 w-3.5" />
            {p.gameReload}
          </button>
          <button type="button" className={btn} onClick={full}>
            <Maximize2 className="h-3.5 w-3.5" />
            {p.gameFull}
          </button>
          <button type="button" className={btn} onClick={download}>
            <Download className="h-3.5 w-3.5" />
            {p.gameDownload}
          </button>
        </div>
      </div>
      <iframe
        key={run}
        title={p.gameTitle}
        srcDoc={doc}
        sandbox="allow-scripts allow-pointer-lock"
        allow="fullscreen"
        className="block w-full flex-1 bg-black"
        style={{ height, minHeight: 280 }}
      />
    </div>
  );
}
