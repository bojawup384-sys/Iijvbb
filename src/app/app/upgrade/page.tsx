"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Crown,
  KeyRound,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { usePro } from "@/lib/pro-i18n";
import { InlineNotice, useCredits } from "@/components/app/app-shell";
import { cn } from "@/lib/utils";

function UpgradeInner() {
  const { t, locale } = useI18n();
  const pro = usePro();
  const { authFetch } = useAuth();
  const { profile, refresh } = useCredits();
  const params = useSearchParams();

  const [payBusy, setPayBusy] = useState<"monthly" | "yearly" | null>(null);
  const [payNote, setPayNote] = useState(false);
  const [code, setCode] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<"ok" | "bad" | null>(null);
  const [redeemErr, setRedeemErr] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (params.get("status") === "success") {
      setShowSuccess(true);
      void refresh();
    }
  }, [params, refresh]);

  const pay = async (period: "monthly" | "yearly") => {
    setPayBusy(period);
    setPayNote(false);
    try {
      const res = await authFetch("/api/billing/chargily", {
        method: "POST",
        body: JSON.stringify({ period }),
      });
      const data = (await res.json()) as { checkout_url?: string };
      if (res.ok && data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      setPayNote(true);
    } catch {
      setPayNote(true);
    } finally {
      setPayBusy(null);
    }
  };

  const redeem = async () => {
    if (!code.trim() || redeemBusy) return;
    setRedeemBusy(true);
    setRedeemMsg(null);
    setRedeemErr(null);
    try {
      const res = await authFetch("/api/billing/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setRedeemMsg(res.ok ? "ok" : "bad");
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { code?: string; detail?: string };
        const ar = locale === "ar";
        const map: Record<string, string> = {
          INVALID_CODE: ar ? "هذا الكود غير موجود" : "This code does not exist",
          USED: ar ? "هذا الكود مستعمل من قبل" : "This code was already used",
          RATE: ar ? "محاولات كثيرة، انتظر دقيقة ثم أعد المحاولة" : "Too many attempts, wait a minute",
          UNAUTHENTICATED: ar ? "سجّل الدخول من جديد ثم أعد المحاولة" : "Please sign in again",
          DB: ar ? "خطأ في السيرفر/قاعدة البيانات (تحقق من DATABASE_URL في Vercel)" : "Server/database error (check DATABASE_URL in Vercel)",
        };
        if (d.code === "DB" && d.detail) {
          setRedeemErr(`${map.DB}\n${d.detail}`);
          return;
        }
        setRedeemErr(map[d.code ?? ""] ?? (ar ? `خطأ غير متوقع (${res.status})` : `Unexpected error (${res.status})`));
      }
      if (res.ok) {
        setCode("");
        await refresh();
      }
    } catch {
      setRedeemMsg("bad");
    } finally {
      setRedeemBusy(false);
    }
  };

  const isPro = profile?.plan === "pro";
  const fmtDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-9 text-center"
      >
        <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-black text-amber-300">
          <Crown className="h-3.5 w-3.5" />
          {t.app.proBadge}
        </span>
        <h1 className="text-2xl font-black text-white sm:text-4xl">
          {t.app.upgradeTitle}
        </h1>
        <p className="mt-3 text-slate-400">{t.app.upgradeSub}</p>
      </motion.div>

      {showSuccess && (
        <div className="mb-6">
          <InlineNotice kind="info" text={t.app.redeemOk} />
        </div>
      )}

      {/* current plan */}
      <div className="glass mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "grid h-12 w-12 place-items-center rounded-2xl",
              isPro
                ? "bg-amber-400 text-ink-950"
                : "bg-white/8 text-slate-300"
            )}
          >
            <Crown className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-400">
              {t.app.currentPlan}
            </p>
            <p className="text-lg font-black text-white">
              {isPro ? t.app.proPlanTag : t.app.freePlanTag}
              {isPro && profile?.planExpiresAt && (
                <span className="ms-2 text-xs font-bold text-slate-400">
                  {t.app.activeUntil} {fmtDate(profile.planExpiresAt)}
                </span>
              )}
            </p>
          </div>
        </div>
        {isPro && (
          <span className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300 ring-1 ring-emerald-400/25">
            <BadgeCheck className="h-4 w-4" />
            {t.app.unlimited}
          </span>
        )}
      </div>

      {/* what v6 Pro adds */}
      <div className="glass-deep mb-8 rounded-3xl p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-amber-200">
          <Crown className="h-4 w-4" />
          {pro.proFeaturesTitle}
        </h2>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {pro.proFeatures.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm leading-relaxed text-slate-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <p className="mb-4 text-sm font-black text-slate-300">
        {t.app.choosePay}
      </p>

      {/* payment plans */}
      <div className="grid gap-5 sm:grid-cols-2">
        {(
          [
            { period: "monthly" as const, price: t.app.dzdMonth, per: t.app.perMo, name: t.app.monthPlan },
            { period: "yearly" as const, price: t.app.dzdYear, per: t.app.perYr, name: t.app.yearPlan, save: t.pricing.save },
          ]
        ).map((p, i) => (
          <motion.div
            key={p.period}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cn(
              "relative flex flex-col rounded-3xl p-6",
              p.period === "yearly" ? "glass-deep ring-brand" : "glass"
            )}
          >
            {p.save && (
              <span className="absolute -top-3 end-5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-400/30">
                {p.save}
              </span>
            )}
            <p className="text-sm font-black text-slate-300">{p.name}</p>
            <div className="my-4 flex items-end gap-1.5">
              <span className="font-display text-4xl font-black text-white">
                {p.price}
              </span>
              <span className="pb-1 text-xs font-bold text-slate-400">
                {p.per}
              </span>
            </div>
            <ul className="mb-5 space-y-2 text-xs text-slate-400">
              {t.pricing.pro.features.slice(0, 3).map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-300" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={payBusy !== null}
              onClick={() => void pay(p.period)}
              className={cn(
                "mt-auto flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black transition",
                p.period === "yearly"
                  ? "bg-amber-400 text-ink-950 hover:brightness-110"
                  : "btn-primary"
              )}
            >
              {payBusy === p.period ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <CreditCard className="h-4.5 w-4.5" />
              )}
              {t.app.payCard}
            </button>
            <p className="mt-2.5 text-center text-[11px] text-slate-500">
              {t.app.payCardNote}
            </p>
          </motion.div>
        ))}
      </div>

      {payNote && (
        <div className="mt-5">
          <InlineNotice kind="warn" text={t.app.payUnavailable} />
        </div>
      )}

      {/* redeem */}
      <div className="glass mt-8 rounded-3xl p-6">
        <h3 className="mb-1 flex items-center gap-2 text-base font-black text-white">
          <KeyRound className="h-5 w-5 text-brand-300" />
          {t.app.redeemTitle}
        </h3>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setRedeemMsg(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && void redeem()}
            placeholder={t.app.redeemPh}
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            className="input-base flex-1 font-display tracking-widest"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void redeem()}
            disabled={redeemBusy || !code.trim()}
            className="btn-primary px-7"
          >
            {redeemBusy ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              t.app.redeemBtn
            )}
          </button>
        </div>
        {redeemMsg === "ok" && (
          <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300">
            {t.app.redeemOk}
          </p>
        )}
        {redeemMsg === "bad" && (
          <p dir="auto" className="mt-3 whitespace-pre-line break-words rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300">
            {redeemErr ?? t.app.redeemBad}
          </p>
        )}
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={null}>
      <UpgradeInner />
    </Suspense>
  );
}
