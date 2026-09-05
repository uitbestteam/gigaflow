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
 * bottom of the screen (never scroll) and lets the user run the rest timer AND
 * fix the weight/reps + RIR of the set they just tapped, right here. Laid out
 * to fit any phone width (no horizontal overflow); all controls are ≥44px.
 * Double-clicking a set still opens the full inline editor elsewhere.
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
    setWeight(String(next));
    commit(String(next), reps);
  };
  const bumpReps = (delta: number) => {
    const next = Math.max(0, Math.round(Number(reps || '0') + delta));
    setReps(String(next));
    commit(weight, String(next));
  };

  return (
    <div className="glass safe-bottom sticky bottom-0 z-30 -mx-4 box-border w-[calc(100%+2rem)] overflow-hidden border-t border-border-subtle px-4 pb-3 pt-3 shadow-nav">
      {/* header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-text">{exerciseName}</span>
          <span className="shrink-0 text-xs font-medium text-text-secondary">
            Set {setNumber}/{totalSets}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-9 shrink-0 rounded-pill bg-surface-2 px-3 text-xs font-semibold text-text-secondary active:scale-95"
        >
          {t('session.restTimerSkip')}
        </button>
      </div>

      {/* timer row: ring toggles pause/resume, ±15s fill the rest of the width */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleRest}
          aria-label={restRunning ? t('session.pause') : t('session.resume')}
          className={`shrink-0 rounded-full ${restRunning ? 'animate-pulse-glow' : ''}`}
        >
          <ProgressRing value={progress} size={56} strokeWidth={6}>
            <span className="tnum text-sm font-bold text-text">{fmtMmSs(restSeconds)}</span>
          </ProgressRing>
        </button>
        <button
          type="button"
          onClick={() => onAdjustRest(-15)}
          className="min-h-11 flex-1 rounded-md border border-border bg-surface-2 text-sm font-semibold text-text active:scale-95"
        >
          -15s
        </button>
        <button
          type="button"
          onClick={() => onAdjustRest(15)}
          className="min-h-11 flex-1 rounded-md border border-border bg-surface-2 text-sm font-semibold text-text active:scale-95"
        >
          +15s
        </button>
      </div>

      {/* quick edit: two full-width steppers */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stepper
          label={t('session.editWeight')}
          value={weight}
          onInput={(s) => {
            setWeight(s);
            commit(s, reps);
          }}
          onDec={() => bumpWeight(-WEIGHT_STEP)}
          onInc={() => bumpWeight(WEIGHT_STEP)}
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
        />
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
}: {
  label: string;
  value: string;
  onInput: (s: string) => void;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={onDec}
          aria-label={`${label} -`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-lg font-bold text-text active:scale-95"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onInput(e.target.value)}
          className="tnum h-11 w-full min-w-0 rounded-md border border-border bg-surface text-center text-base font-bold text-text focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={onInc}
          aria-label={`${label} +`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text active:scale-95"
        >
          <PlusIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
