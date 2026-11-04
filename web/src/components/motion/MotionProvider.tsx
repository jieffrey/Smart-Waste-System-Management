"use client";

import { MotionConfig } from "motion/react";

// Every animation in the admin pages (ours and the Bklit charts') turns off its movement when the user
// prefers reduced motion.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
