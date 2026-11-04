"use client";

import { motion } from "motion/react";

// Page content fades in and slides up slightly on every navigation (280ms). With reduced motion,
// MotionConfig drops the movement.
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}>
      {children}
    </motion.div>
  );
}
