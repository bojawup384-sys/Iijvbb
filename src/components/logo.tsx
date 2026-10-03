"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/** Brand mark: a plain green tile with the Arabic letter "ب" — no gradients, no glow. */
export function Logo({
  size = 36,
  withText = true,
  className,
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid shrink-0 place-items-center bg-white font-bold leading-none text-ink-950"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          fontSize: size * 0.62,
          paddingBottom: size * 0.04,
        }}
      >
        ب
      </span>
      {withText && (
        <span className="text-xl font-bold tracking-tight text-white">
          {t.common.appName}
        </span>
      )}
    </span>
  );
}
