"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type ScoreRingProps = {
  className?: string;
  label?: string;
  value: number | null;
};

function scoreColor(value: number | null) {
  if (value === null) return "#89909A";
  if (value >= 75) return "#2BC3CE";
  if (value >= 55) return "#F0A13A";
  return "#FF5A4E";
}

export function ScoreRing({ className, label = "Fit score", value }: ScoreRingProps) {
  const reduceMotion = useReducedMotion();
  const normalized = value === null ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div
      aria-label={`${label}: ${value === null ? "not available" : `${Math.round(value)} percent`}`}
      className={cn("relative grid aspect-square w-32 place-items-center", className)}
      role="img"
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" fill="none" r="50" stroke="currentColor" strokeWidth="7" className="text-white/10" />
        <motion.circle
          animate={{ strokeDashoffset: 1 - normalized / 100 }}
          cx="60"
          cy="60"
          fill="none"
          initial={reduceMotion ? false : { strokeDashoffset: 1 }}
          pathLength="1"
          r="50"
          stroke={scoreColor(value)}
          strokeDasharray="1"
          strokeLinecap="round"
          strokeWidth="7"
          transition={{ duration: reduceMotion ? 0 : 0.85, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="relative text-center">
        <p className="text-3xl font-bold text-white">{value === null ? "--" : Math.round(value)}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase text-white/50">{label}</p>
      </div>
    </div>
  );
}
