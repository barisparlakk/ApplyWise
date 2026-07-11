"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type SignalFieldProps = {
  className?: string;
  compact?: boolean;
};

const paths = [
  "M80 150 C210 150 230 280 350 280 S530 190 710 210",
  "M25 470 C170 430 240 520 350 470 S540 330 770 390",
  "M100 740 C230 610 360 700 430 600 S570 500 740 610",
  "M180 40 C250 170 370 120 420 250 S520 440 680 470",
];

const nodes = [
  { cx: 80, cy: 150, color: "#FF5A4E", delay: 0 },
  { cx: 350, cy: 280, color: "#FFFFFF", delay: 0.2 },
  { cx: 710, cy: 210, color: "#2BC3CE", delay: 0.4 },
  { cx: 25, cy: 470, color: "#2BC3CE", delay: 0.1 },
  { cx: 350, cy: 470, color: "#FF5A4E", delay: 0.3 },
  { cx: 770, cy: 390, color: "#FFFFFF", delay: 0.5 },
  { cx: 100, cy: 740, color: "#FFFFFF", delay: 0.15 },
  { cx: 430, cy: 600, color: "#2BC3CE", delay: 0.35 },
  { cx: 740, cy: 610, color: "#FF5A4E", delay: 0.55 },
];

export function SignalField({ className, compact = false }: SignalFieldProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg className="h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 820">
        <g opacity="0.12">
          {Array.from({ length: 12 }, (_, index) => (
            <line key={`horizontal-${index}`} stroke="white" strokeWidth="1" x1="0" x2="800" y1={index * 72} y2={index * 72} />
          ))}
          {Array.from({ length: 11 }, (_, index) => (
            <line key={`vertical-${index}`} stroke="white" strokeWidth="1" x1={index * 80} x2={index * 80} y1="0" y2="820" />
          ))}
        </g>

        <g fill="none" stroke="white" strokeLinecap="round" strokeWidth={compact ? 1.4 : 1.8}>
          {paths.map((path, index) => (
            <motion.path
              animate={{ opacity: index % 2 ? 0.34 : 0.48, pathLength: 1 }}
              d={path}
              initial={reduceMotion ? false : { opacity: 0, pathLength: 0 }}
              key={path}
              transition={{ delay: index * 0.16, duration: 1.15, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ))}
        </g>

        {nodes.map((node) => (
          <g key={`${node.cx}-${node.cy}`}>
            <motion.circle
              animate={reduceMotion ? undefined : { opacity: [0.14, 0.3, 0.14], r: [13, 19, 13] }}
              cx={node.cx}
              cy={node.cy}
              fill="none"
              initial={false}
              r="13"
              stroke={node.color}
              strokeWidth="1"
              transition={{ delay: node.delay, duration: 2.8, repeat: Infinity }}
            />
            <motion.circle
              animate={{ opacity: 1, scale: 1 }}
              cx={node.cx}
              cy={node.cy}
              fill={node.color}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
              r="4.5"
              transition={{ delay: 0.45 + node.delay, duration: 0.35 }}
            />
          </g>
        ))}

        {reduceMotion ? null : (
          <>
            <motion.circle animate={{ cx: [80, 350, 710], cy: [150, 280, 210] }} fill="#FF5A4E" r="3" transition={{ duration: 5.5, ease: "linear", repeat: Infinity }} />
            <motion.circle animate={{ cx: [100, 430, 740], cy: [740, 600, 610] }} fill="#2BC3CE" r="3" transition={{ delay: 1.2, duration: 6.4, ease: "linear", repeat: Infinity }} />
          </>
        )}
      </svg>
    </div>
  );
}
