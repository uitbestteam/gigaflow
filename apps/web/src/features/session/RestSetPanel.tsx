import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressRing } from '../../components/ProgressRing';
import { RirPicker } from '../../components/RirPicker';
import { PlusIcon } from '../../components/icons';

export interface RestSetPanelProps {
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  weightKg: number;
  repsDone: number;
  rir?: number;
  restSeconds: number;
  restRunning: boolean;
  onToggleRest: () => void;
  onAdjustRest: (deltaSeconds: number) => void;
  /** Commit an edit to the just-logged set (weight/reps). */
  onEdit: (values: { weightKg: number; repsDone: number }) => void;
  onSetRir: (rir: number) => void;
  onDismiss: () => void;
}

const WEIGHT_STEP = 2.5;

function fmtMmSs(total: number): string {
  const s = Math.max(0, total);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The convenience panel shown the moment a set is logged: it sticks to the
 * bottom of the screen so the user never scrolls, and lets them (a) run the
 * rest timer and (b) fix the weight/reps + RIR of the set they just tapped
 * right here — no scrolling down, no double-click needed (double-click on the
 * set still opens the full inline editor). Keyed per set by the caller so the
 * draft inputs reset when a new set is logged.
 */
export function RestSetPanel({
  exerciseName,
  setNumber,
  totalSets,
  weightKg,
  repsDone,
  rir,
  restSeconds,
  restRunning,
  onToggleRest,
  onAdjustRest,
  onEdit,
  onSetRir,
  onDismiss,
}: RestSetPanelProps) {
  const { t } = useTranslation();
  const [initialSeconds] = useState(restSeconds);
  const [weight, setWeight] = useState(String(weightKg));
  const [reps, setReps] = useState(String(repsDone));

  const total = initialSeconds > 0 ? initialSeconds : 1;
  const progress = 1 - Math.min(1, restSeconds / total);

  const commit = (w: string, r: string) => {
    const wv = Number(w);
    const rv = Number(r);
    if (w.trim() !== '' && r.trim() !== '' && !Number.isNaN(wv) && !Number.isNaN(rv)) {
      onEdit({ weightKg: wv, repsDone: rv });
    }
  };

  const bumpWeight = (delta: number) => {
    const next = Math.max(0, Math.round((Number(weight || '0') + delta) * 100) / 100);
    const s = String(next);
    setWeight(s);
    commit(s, reps);
  };
  const bumpReps = (delta: number) => {
    const next = Math.max(0, Math.round(Number(reps || '0') + delta));
    const s = String(next);
    setReps(s);
    commit(weight, s);
  };

  return (
    <div className="glass safe-bottom sticky bottom-0 z-30 -mx-4 border-t border-border-subtle px-4 pb-3 pt-3 shadow-nav">
      {/* header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="truncate text-sm font-semibold text-text">{exerciseName}</span>
          <span className="ml-2 text-xs font-medium text-text-secondary">
            {t('session.restTimerTitle')} · Set {setNumber}/{totalSets}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-pill px-3 py-1 text-xs font-semibold text-text-secondary hover:text-text"
        >
          {t('session.restTimerSkip')}
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* compact timer */}
        <button
          type="button"
          onClick={onToggleRest}
          aria-label={restRunning ? t('session.pause') : t('session.resume')}
          className={restRunning ? 'animate-pulse-glow rounded-full' : ''}
        >
          <ProgressRing value={progress} size={64} strokeWidth={6}>
            <span className="tnum text-sm font-bold text-text">{fmtMmSs(restSeconds)}</span>
          </ProgressRing>
        </button>

        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onAdjustRest(-15)}
              className="min-h-9 rounded-sm border border-border bg-surface-2 px-2 text-xs font-semibold text-text-secondary"
            >
              -15s
            </button>
            <button
              type="button"
              onClick={() => onAdjustRest(15)}
              className="min-h-9 rounded-sm border border-border bg-surface-2 px-2 text-xs font-semibold text-text-secondary"
            >
              +15s
            </button>
          </div>
        </div>

        {/* quick weight / reps steppers */}
        <div className="ml-auto flex gap-3">
          <Stepper
            label={t('session.editWeight')}
            value={weight}
            onInput={(s) => {
              setWeight(s);
              commit(s, reps);
            }}
            onDec={() => bumpWeight(-WEIGHT_STEP)}
            onInc={() => bumpWeight(WEIGHT_STEP)}
            width="w-16"
          />
          <Stepper
            label={t('session.editReps')}
            value={reps}
            onInput={(s) => {
              setReps(s);
              commit(weight, s);
            }}
            onDec={() => bumpReps(-1)}
            onInc={() => bumpReps(1)}
            width="w-12"
          />
        </div>
      </div>

      <div className="mt-3">
        <RirPicker value={rir} onPick={onSetRir} />
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onInput,
  onDec,
  onInc,
  width,
}: {
  label: string;
  value: string;
  onInput: (s: string) => void;
  onDec: () => void;
  onInc: () => void;
  width: string;
}) {
  return (
    <label className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onDec}
          aria-label={`${label} -`}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-surface-2 text-text-secondary"
        >
          <span className="text-base leading-none">−</span>
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onInput(e.target.value)}
          className={`tnum min-h-9 ${width} rounded-sm border border-border bg-surface px-1 text-center text-sm font-bold text-text focus:border-accent focus:outline-none`}
        />
        <button
          type="button"
          onClick={onInc}
          aria-label={`${label} +`}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-surface-2 text-text-secondary"
        >
          <PlusIcon width={14} height={14} />
        </button>
      </div>
    </label>
  );
}
