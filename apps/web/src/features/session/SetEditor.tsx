import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';

export interface SetEditorValue {
  weightKg: number;
  repsDone: number;
}

export interface SetEditorProps {
  initial: SetEditorValue;
  onSave: (value: SetEditorValue) => void;
  onCancel: () => void;
  className?: string;
}

/**
 * Inline replacement for the old `window.prompt`-based set editor: two
 * number inputs (weight, reps) prefilled from `initial`, plus Save/Cancel.
 * Draft values live in local state as strings so the inputs can hold an
 * intermediate empty/invalid value while typing; Save is disabled (and a
 * no-op) until both parse to a real number.
 */
export function SetEditor({ initial, onSave, onCancel, className = '' }: SetEditorProps) {
  const { t } = useTranslation();
  const [weight, setWeight] = useState(String(initial.weightKg));
  const [reps, setReps] = useState(String(initial.repsDone));

  const weightKg = Number(weight);
  const repsDone = Number(reps);
  const canSave = weight.trim() !== '' && reps.trim() !== '' && !Number.isNaN(weightKg) && !Number.isNaN(repsDone);

  const handleSave = () => {
    if (!canSave) return;
    onSave({ weightKg, repsDone });
  };

  return (
    <div
      className={`flex flex-wrap items-end gap-3 rounded-[10px] border border-border-subtle bg-surface-elevated p-3 ${className}`}
    >
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        {t('session.editWeight')}
        <input
          type="number"
          inputMode="decimal"
          className="tnum min-h-11 w-24 rounded-[8px] border border-border-subtle bg-surface px-2 text-text"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        {t('session.editReps')}
        <input
          type="number"
          inputMode="numeric"
          className="tnum min-h-11 w-20 rounded-[8px] border border-border-subtle bg-surface px-2 text-text"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={!canSave}>
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
