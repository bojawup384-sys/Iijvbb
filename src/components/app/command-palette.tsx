"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Crown,
  CornerDownLeft,
  Gamepad2,
  History,
  Image as ImageIcon,
  LayoutGrid,
  MessagesSquare,
  Search,
  Settings,
  SquarePen,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { TOOLS, PRO_TOOLS, loc } from "@/lib/tools";
import { PERSONAS, SLASH_COMMANDS } from "@/lib/personas";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Events the chat page listens to — keeps the palette decoupled from ChatPage. */
export const BARQ_EVENTS = {
  newChat: "barq:new-chat",
  prompt: "barq:prompt",
  persona: "barq:persona",
} as const;

export function fire<T>(name: string, detail?: T) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon | string;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setIdx(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        close();
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("barq:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("barq:palette", onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href);
    const list: Item[] = [
      { id: "new", group: "إجراءات", label: "محادثة جديدة", hint: "ابدأ من الصفر", icon: SquarePen, run: () => { router.push("/app"); setTimeout(() => fire(BARQ_EVENTS.newChat), 60); } },
      { id: "chat", group: "تنقّل", label: "المحادثة", icon: MessagesSquare, run: go("/app") },
      { id: "tools", group: "تنقّل", label: "الأدوات", icon: LayoutGrid, run: go("/app/tools") },
      { id: "studio", group: "تنقّل", label: "الاستوديو", icon: Wand2, run: go("/app/studio") },
      { id: "images", group: "تنقّل", label: "مولّد الصور", hint: "ولّد أو عدّل صورة", icon: ImageIcon, run: go("/app/images") },
      { id: "arcade", group: "تنقّل", label: "الأركيد", icon: Gamepad2, run: go("/app/arcade") },
      { id: "history", group: "تنقّل", label: "السجل", icon: History, run: go("/app/history") },
      { id: "upgrade", group: "تنقّل", label: "الترقية إلى Pro", icon: Crown, run: go("/app/upgrade") },
      { id: "settings", group: "تنقّل", label: "الإعدادات", icon: Settings, run: go("/app/settings") },
    ];
    for (const p of PERSONAS) {
      list.push({
        id: `persona-${p.id}`,
        group: "الأوضاع",
        label: `وضع ${p.label}`,
        hint: p.hint,
        icon: p.emoji,
        run: () => { router.push("/app"); setTimeout(() => fire(BARQ_EVENTS.persona, p.id), 60); },
      });
    }
    for (const c of SLASH_COMMANDS) {
      list.push({
        id: `cmd-${c.cmd}`,
        group: "قوالب",
        label: `/${c.cmd}`,
        hint: c.hint,
        icon: "/",
        run: () => { router.push("/app"); setTimeout(() => fire(BARQ_EVENTS.prompt, { text: c.template, send: false }), 60); },
      });
    }
    for (const t of [...TOOLS, ...PRO_TOOLS]) {
      list.push({
        id: `tool-${t.id}`,
        group: "الأدوات",
        label: loc(t.name, locale),
        hint: loc(t.desc, locale),
        icon: t.icon,
        run: go(`/app/tools/${t.id}`),
      });
    }
    return list;
  }, [router, locale]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.filter((i) => i.group === "إجراءات" || i.group === "تنقّل" || i.group === "الأوضاع");
    return items
      .filter((i) => `${i.label} ${i.hint ?? ""} ${i.group}`.toLowerCase().includes(s))
      .slice(0, 30);
  }, [items, q]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const choose = (it?: Item) => {
    if (!it) return;
    close();
    it.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[idx]);
    }
  };

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-3 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
          role="dialog"
          aria-modal="true"
          aria-label="لوحة الأوامر"
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="glass-deep w-full max-w-xl overflow-hidden rounded-3xl"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
              <Search className="h-5 w-5 shrink-0 text-brand-300" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن أداة، وضع، قالب، أو صفحة…"
                className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-slate-500"
                aria-label="بحث"
              />
              <kbd className="hidden rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[11px] font-bold text-slate-400 sm:block">
                Esc
              </kbd>
            </div>

            <div ref={listRef} className="scroll-y max-h-[52vh] p-2">
              {results.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  ما لقيت شي. جرّب كلمة أخرى.
                </p>
              )}
              {results.map((it, i) => {
                const showGroup = it.group !== lastGroup;
                lastGroup = it.group;
                const Icon = it.icon;
                return (
                  <div key={it.id}>
                    {showGroup && (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-bold text-slate-500">{it.group}</p>
                    )}
                    <button
                      type="button"
                      data-i={i}
                      onMouseMove={() => setIdx(i)}
                      onClick={() => choose(it)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition",
                        i === idx ? "bg-brand-500/20 ring-1 ring-brand-400/40" : "hover:bg-white/5"
                      )}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/6 text-base text-brand-300">
                        {typeof Icon === "string" ? Icon : <Icon className="h-4.5 w-4.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white">{it.label}</span>
                        {it.hint && (
                          <span className="block truncate text-xs text-slate-400">{it.hint}</span>
                        )}
                      </span>
                      {i === idx && <CornerDownLeft className="h-4 w-4 shrink-0 text-brand-300" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
