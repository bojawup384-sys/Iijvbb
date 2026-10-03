"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  AudioLines,
  Command,
  Layers,
  MessageSquareQuote,
  SquareSlash,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { PERSONAS } from "@/lib/personas";
import { SectionHeading } from "@/components/landing/sections";
import { cn } from "@/lib/utils";

type Copy = {
  kicker: string;
  title: string;
  highlight: string;
  sub: string;
  cards: { title: string; text: string }[];
  cta: string;
};

const COPY: Record<"ar" | "fr" | "en", Copy> = {
  ar: {
    kicker: "جديد في v9",
    title: "كل ما تحتاجه",
    highlight: "بين أصابعك",
    sub: "أوضاع ذكية، أوامر بالسلاش، لوحة بحث سريعة، وردود تتكلّم. بلا تعقيد.",
    cards: [
      { title: "8 أوضاع شخصية", text: "مبرمج، باحث، أستاذ، كاتب، تاجر، مترجم، أو «خويا» بالدارجة. كل وضع يغيّر طريقة تفكير برق وأسلوبه." },
      { title: "لوحة الأوامر", text: "اضغط Ctrl + K من أي صفحة: تنقّل، أدوات، أوضاع وقوالب في ثانية." },
      { title: "أوامر بالسلاش", text: "اكتب / داخل المحادثة واختر: لخّص، ترجم، صحّح الكود، خطة عمل…" },
      { title: "اسمع الرد", text: "برق يقرأ الجواب بصوت عالٍ بالعربية أو الفرنسية أو الإنجليزية." },
      { title: "متابعة بنقرة", text: "اختصر، اشرح أكثر، بالدارجة، En français، أو حوّله لجدول." },
    ],
    cta: "جرّب برق الآن",
  },
  fr: {
    kicker: "Nouveau en v9",
    title: "Tout ce qu'il faut,",
    highlight: "sous vos doigts",
    sub: "Modes intelligents, commandes /, palette de recherche et réponses audio. Sans complexité.",
    cards: [
      { title: "8 modes", text: "Développeur, chercheur, prof, rédacteur, business, traducteur ou « khouya » en darija." },
      { title: "Palette de commandes", text: "Ctrl + K partout : pages, outils, modes et modèles en une seconde." },
      { title: "Commandes /", text: "Tapez / dans le chat : résumer, traduire, corriger le code, plan d'action…" },
      { title: "Écoutez la réponse", text: "Barq lit la réponse à voix haute en arabe, français ou anglais." },
      { title: "Suites en un clic", text: "Raccourcir, détailler, darija, français ou tableau." },
    ],
    cta: "Essayer Barq",
  },
  en: {
    kicker: "New in v9",
    title: "Everything you need,",
    highlight: "at your fingertips",
    sub: "Smart modes, slash commands, a quick command palette and answers that talk back.",
    cards: [
      { title: "8 personas", text: "Developer, researcher, teacher, writer, business, translator, or a Darija-speaking friend." },
      { title: "Command palette", text: "Press Ctrl + K anywhere: pages, tools, modes and templates in a second." },
      { title: "Slash commands", text: "Type / in the chat: summarize, translate, fix code, action plan…" },
      { title: "Read it aloud", text: "Barq reads the answer out loud in Arabic, French or English." },
      { title: "One-tap follow-ups", text: "Shorten, expand, Darija, French or turn it into a table." },
    ],
    cta: "Try Barq",
  },
};

const ICONS: LucideIcon[] = [UserRoundCog, Command, SquareSlash, AudioLines, MessageSquareQuote];

/** Soft light that follows the pointer inside a card (CSS variables only). */
function useGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return { ref, onMove };
}

function Card({
  className,
  tone,
  children,
}: {
  className?: string;
  tone?: "gold" | "aqua";
  children: React.ReactNode;
}) {
  const { ref, onMove } = useGlow();
  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      data-tone={tone}
      className={cn("bento-card", className)}
    >
      {children}
    </motion.div>
  );
}

export function V9Features() {
  const { locale } = useI18n();
  const c = COPY[locale] ?? COPY.ar;

  return (
    <section id="v9" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading kicker={c.kicker} title={c.title} highlight={c.highlight} sub={c.sub} />

      <div className="bento">
        {/* personas: the memorable one */}
        <Card className="b-big" tone="gold">
          <div className="flex items-center gap-2 text-gold-300">
            <Layers className="h-5 w-5" />
            <h3 className="text-lg font-black text-white">{c.cards[0].title}</h3>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">{c.cards[0].text}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {PERSONAS.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[13px] font-bold text-slate-200"
              >
                <span aria-hidden>{p.emoji}</span>
                {p.label}
              </span>
            ))}
          </div>
        </Card>

        <Card className="b-mid">
          {(() => {
            const Icon = ICONS[1];
            return <Icon className="h-6 w-6 text-brand-300" />;
          })()}
          <h3 className="mt-3 text-lg font-black text-white">{c.cards[1].title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{c.cards[1].text}</p>
          <div dir="ltr" className="mt-4 flex items-center gap-1.5">
            <span className="kbd">Ctrl</span>
            <span className="text-slate-500">+</span>
            <span className="kbd">K</span>
          </div>
        </Card>

        <Card className="b-wide" tone="aqua">
          {(() => {
            const Icon = ICONS[2];
            return <Icon className="h-6 w-6 text-aqua-300" />;
          })()}
          <h3 className="mt-3 text-lg font-black text-white">{c.cards[2].title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{c.cards[2].text}</p>
          <div dir="ltr" className="mt-4 flex flex-wrap gap-1.5 text-[12px] font-black text-gold-200">
            {["/لخص", "/ترجم", "/كود", "/خطة", "/قارن"].map((x) => (
              <span key={x} className="rounded-lg bg-white/8 px-2 py-1">{x}</span>
            ))}
          </div>
        </Card>

        <Card className="b-mid">
          {(() => {
            const Icon = ICONS[3];
            return <Icon className="h-6 w-6 text-brand-300" />;
          })()}
          <h3 className="mt-3 text-lg font-black text-white">{c.cards[3].title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{c.cards[3].text}</p>
        </Card>

        <Card className="b-mid">
          {(() => {
            const Icon = ICONS[4];
            return <Icon className="h-6 w-6 text-gold-300" />;
          })()}
          <h3 className="mt-3 text-lg font-black text-white">{c.cards[4].title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{c.cards[4].text}</p>
        </Card>
      </div>

      <div className="mt-10 flex justify-center">
        <Link href="/signup" className="btn-primary px-8 py-3.5 text-base">
          {c.cta}
        </Link>
      </div>
    </section>
  );
}
