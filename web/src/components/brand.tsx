"use client";

import { motion, useReducedMotion } from "motion/react";

import { useTranslations } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  animated?: boolean;
  className?: string;
};

export function BrandMark({ animated = false, className }: BrandMarkProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;

  return (
    <svg
      aria-label="ApplyWise"
      className={cn("shrink-0", className)}
      role="img"
      viewBox="0 0 48 48"
    >
      <rect fill="#101318" height="48" rx="10" width="48" />
      <motion.path
        animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
        d="M9 37 21 11"
        fill="none"
        initial={shouldAnimate ? { pathLength: 0, opacity: 0.35 } : undefined}
        stroke="#FF5A4E"
        strokeLinecap="round"
        strokeWidth="5"
        transition={{ duration: 0.75, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <motion.path
        animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
        d="M39 37 27 11"
        fill="none"
        initial={shouldAnimate ? { pathLength: 0, opacity: 0.35 } : undefined}
        stroke="#2BC3CE"
        strokeLinecap="round"
        strokeWidth="5"
        transition={{ delay: 0.12, duration: 0.75, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <motion.path
        animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
        d="M16 27h16"
        fill="none"
        initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : undefined}
        stroke="white"
        strokeLinecap="round"
        strokeWidth="3"
        transition={{ delay: 0.45, duration: 0.42 }}
      />
      <motion.circle
        animate={shouldAnimate ? { opacity: 1, scale: 1 } : undefined}
        cx="24"
        cy="9"
        fill="white"
        initial={shouldAnimate ? { opacity: 0, scale: 0.4 } : undefined}
        r="3"
        transition={{ delay: 0.72, duration: 0.3 }}
      />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className="h-9 w-9" />
      {compact ? null : (
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-current">ApplyWise</p>
          <p className="truncate text-[11px] text-current opacity-55">{t("Career signal system")}</p>
        </div>
      )}
    </div>
  );
}
