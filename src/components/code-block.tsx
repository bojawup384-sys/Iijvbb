"use client";

import { useState } from "react";
import { Check, Copy, Download, Play } from "lucide-react";
import { usePro } from "@/lib/pro-i18n";
import { GamePreview } from "@/components/game-preview";

const EXT: Record<string, string> = {
  javascript: "js", js: "js", typescript: "ts", ts: "ts", tsx: "tsx", jsx: "jsx",
  python: "py", py: "py", html: "html", css: "css", json: "json", bash: "sh",
  sh: "sh", sql: "sql", php: "php", java: "java", go: "go", rust: "rs", c: "c",
  cpp: "cpp", csharp: "cs", cs: "cs", kotlin: "kt", swift: "swift", ruby: "rb",
  yaml: "yml", yml: "yml", markdown: "md", md: "md",
};

export function CodeBlock({
  lang,
  code,
  pro,
}: {
  lang: string;
  code: string;
  pro: boolean;
}) {
  const p = usePro();
  const [copied, setCopied] = useState(false);
  const [play, setPlay] = useState(false);
  const isHtml = /^(html|htm)$/i.test(lang);
  const canPlay = pro && isHtml && /<(canvas|script|body|div)/i.test(code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const download = () => {
    const ext = EXT[lang.toLowerCase()] ?? "txt";
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `barq-code.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const btn =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-slate-400 transition hover:bg-white/8 hover:text-white";

  return (
    <div className="my-3">
      <div
        dir="ltr"
        className="flex items-center justify-between rounded-t-[0.9rem] border border-b-0 border-white/9 bg-ink-800 px-3 py-1.5"
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {lang || "code"}
        </span>
        <div className="flex items-center gap-1">
          {canPlay && (
            <button type="button" className={btn} onClick={() => setPlay((v) => !v)}>
              <Play className="h-3.5 w-3.5 text-brand-300" />
              {play ? p.gameCode : p.codePreview}
            </button>
          )}
          <button type="button" className={btn} onClick={download}>
            <Download className="h-3.5 w-3.5" />
            {p.codeDownload}
          </button>
          <button type="button" className={btn} onClick={() => void copy()}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-brand-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? p.codeCopied : p.codeCopy}
          </button>
        </div>
      </div>
      {play ? (
        <GamePreview html={code} className="rounded-t-none" />
      ) : (
        <pre className="!mt-0 !rounded-t-none">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
