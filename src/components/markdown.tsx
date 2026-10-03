"use client";

import { isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/code-block";

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/** `pro` unlocks the live preview button on ```html blocks. */
export function Markdown({
  children,
  pro = false,
  plainCode = false,
}: {
  children: string;
  pro?: boolean;
  /** true while streaming: skip the toolbar so half-written code doesn't flicker */
  plainCode?: boolean;
}) {
  const components: Components = {
    pre({ children: c }) {
      const el = Array.isArray(c) ? c[0] : c;
      if (!plainCode && isValidElement(el)) {
        const props = el.props as { className?: string; children?: ReactNode };
        const lang = /language-([\w+-]+)/.exec(props.className ?? "")?.[1] ?? "";
        const code = textOf(props.children).replace(/\n$/, "");
        return <CodeBlock lang={lang} code={code} pro={pro} />;
      }
      return <pre>{c}</pre>;
    },
  };
  return (
    <div dir="auto" className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
