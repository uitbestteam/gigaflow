import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export interface WizardStep {
  /** Short step title shown as the heading. */
  title: string;
  /** Optional one-line helper under the title. */
  subtitle?: string;
  /** The step's form content. */
  content: ReactNode;
  /** Gate the Next/Finish button. Defaults to true (valid) when omitted. */
  valid?: boolean;
}

export interface WizardProps {
  steps: WizardStep[];
  onComplete: () => void;
  /** Label for the final button; defaults to `wizard.finish`. */
  finishLabel?: string;
  /** Disable the finish button + show it as busy (e.g. while submitting). */
  submitting?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Mobile-first multi-step form. Shows a progress bar + "Step n of N", animates
 * horizontally between steps, and gates Next on each step's `valid` flag. The
 * nav bar sticks to the bottom of the scroll area so Back/Next stay reachable.
 */
export function Wizard({ steps, onComplete, finishLabel, submitting = false }: WizardProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);

  const total = steps.length;
  const clamped = Math.min(index, total - 1);
  const step = steps[clamped];
  if (!step) return null;

  const isLast = clamped === total - 1;
  const canAdvance = step.valid !== false;

  const goNext = () => {
    if (!canAdvance) return;
    if (isLast) {
      onComplete();
      return;
    }
    setDir(1);
    setIndex((i) => Math.min(i + 1, total - 1));
  };
  const goBack = () => {
    setDir(-1);
    setIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
          <span>{t('wizard.stepOf', { current: clamped + 1, total })}</span>
          <span className="tnum">{Math.round(((clamped + 1) / total) * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-surface-3">
          <motion.div
            className="h-full rounded-pill bg-accent"
            initial={false}
            animate={{ width: `${((clamped + 1) / total) * 100}%` }}
            transition={{ duration: 0.35, ease: EASE }}
          />
        </div>
      </div>

      {/* Step header */}
      <div>
        <h1 className="text-xl font-bold text-text">{step.title}</h1>
        {step.subtitle && <p className="mt-1 text-sm text-text-secondary">{step.subtitle}</p>}
      </div>

      {/* Animated step body */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={clamped}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {step.content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="sticky bottom-0 -mx-4 mt-2 flex gap-3 border-t border-border-subtle bg-bg/85 px-4 py-3 backdrop-blur">
        {clamped > 0 && (
          <Button variant="ghost" className="flex-1" onClick={goBack} disabled={submitting}>
            {t('wizard.back')}
          </Button>
        )}
        <Button
          className="flex-[2]"
          onClick={goNext}
          disabled={!canAdvance || submitting}
        >
          {isLast ? (finishLabel ?? t('wizard.finish')) : t('wizard.next')}
        </Button>
      </div>
    </div>
  );
}
