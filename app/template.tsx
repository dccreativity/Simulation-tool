'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/** A calm fade-and-rise between pages (instant when reduced motion is preferred). */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
