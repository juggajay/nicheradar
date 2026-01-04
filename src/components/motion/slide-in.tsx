'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

type Direction = 'left' | 'right' | 'up' | 'down';

interface SlideInProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
}

const directionOffset = {
  left: { x: -30, y: 0 },
  right: { x: 30, y: 0 },
  up: { x: 0, y: -30 },
  down: { x: 0, y: 30 },
};

export function SlideIn({ children, direction = 'left', delay = 0, className }: SlideInProps) {
  const offset = directionOffset[direction];

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
