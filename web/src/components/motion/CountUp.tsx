"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

// Counts a number up from 0 on first load (400ms). The server renders the real value, so the number is
// correct without JavaScript; with reduced motion it never animates.
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || value === 0) {
      return;
    }
    const controls = animate(0, value, {
      duration: 0.4,
      ease: [0.2, 0, 0, 1],
      onUpdate: (latest) => {
        node.textContent = String(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
