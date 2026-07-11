"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export function PageMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("min-w-0", className)}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      transition={{ delay: reduceMotion ? 0 : delay, duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
      viewport={{ amount: 0.2, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
      className={className}
      id={id}
    >
      {children}
    </motion.div>
  );
}

export function MotionBar({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const width = `${Math.max(0, Math.min(100, value))}%`;

  return (
    <motion.div
      animate={{ width }}
      className={cn("h-full origin-left", className)}
      initial={reduceMotion ? { width } : { width: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.2, 0.8, 0.2, 1] }}
    />
  );
}
