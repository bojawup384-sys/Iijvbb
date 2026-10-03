"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown, Gamepad2, LayoutTemplate, Palette, PenTool, Smartphone, Trash2, Wand2 } from "lucide-react";
import { useCredits } from "@/components/app/app-shell";
import { GamePreview } from "@/components/game-preview";

type Item = { id: number; title: string; html: string; at: number };

const CREATE = [
  { id: "landing-builder", label: "صفحة هبوط", Icon: LayoutTemplate },
  { id: "ui-designer", label: "واجهة تطبيق", Icon: Smartphone },
  { id: "wallpaper-designer", label: "خلفية متحركة", Icon: Palette },
  { id: "logo-designer", label: "شعار", Icon: PenTool },
  { id: "game-builder", label: "لعبة", Icon: Gamepad2 },
] as const;

export default function StudioPage() {
  const { profile } = useCredits();
  const isPro = profile?.plan === "pro";
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState<Item | null>(null);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem("barq_gallery") ?? "[]"));
    } catch {}
  }, []);

  const remove = (id: number) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    if (open?.id === id) setOpen(null);
    try { localStorage.setItem("barq_gallery", JSON.stringify(next)); } catch {}
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-3xl font-black text-white sm:text-4xl">
            <Wand2 className="h-8 w-8 text-amber-300" />
            استوديو برق
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            اصنع صفحات وواجهات وألعابًا وخلفيات وشعارات، جرّبها على الهاتف والحاسوب، واحفظ أفضلها هنا.
          </p>
        </div>
        {!isPro && (
          <Link href="/app/upgrade" className="btn-primary px-5 py-2.5 text-sm">
            <Crown className="h-4 w-4" />
            افتح الاستوديو بـ v6 Pro
          </Link>
        )}
      </header>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CREATE.map(({ id, label, Icon }) => (
          <Link
            key={id}
            href={`/app/tools/${id}`}
            className="pro-card group flex flex-col items-center gap-3 rounded-2xl p-5 text-center"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500/30 to-amber-300/20 text-amber-200 transition group-hover:scale-110">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-sm font-black text-white">{label}</span>
          </Link>
        ))}
      </div>

      <h2 className="mb-4 text-sm font-black text-slate-300">أعمالي المحفوظة ({items.length})</h2>
      {items.length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-slate-400">
          لا توجد أعمال بعد. أنشئ شيئًا ثم اضغط «حفظ» فوق المعاينة.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="glass overflow-hidden rounded-2xl">
              <button type="button" onClick={() => setOpen(it)} className="relative block h-40 w-full overflow-hidden bg-black text-start">
                <iframe
                  title={it.title}
                  srcDoc={it.html}
                  sandbox=""
                  tabIndex={-1}
                  className="pointer-events-none h-[640px] w-[1280px] origin-top-left scale-[0.3] rtl:origin-top-right"
                />
              </button>
              <div className="flex items-center justify-between gap-2 p-3">
                <p className="truncate text-sm font-black text-white">{it.title}</p>
                <button type="button" aria-label="حذف" onClick={() => remove(it.id)} className="text-slate-500 hover:text-rose-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-8">
          <GamePreview html={open.html} height={560} />
        </div>
      )}
    </div>
  );
}
