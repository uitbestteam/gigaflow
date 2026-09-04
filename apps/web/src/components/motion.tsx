import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Shared motion primitives for the neon redesign. Every animation respects
 * `prefers-reduced-motion` automatically via framer-motion's reduced-motion
 * handling (transforms collapse to opacity-only). Spring defaults give the
 * app its "flow" feel without per-component tuning.
 */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Wraps a route's content: fade + slide-up on enter, fade on exit. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}

/** Single element that fades + rises into view on mount. */
export function FadeIn({
  children,
  delay = 0,
  className,
  ...rest
}: { children: ReactNode; delay?: number } & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Container whose direct <StaggerItem> children reveal in sequence. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={staggerChild} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/** Tap-scale wrapper for large interactive surfaces (cards, tiles). */
export function Pressable({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
