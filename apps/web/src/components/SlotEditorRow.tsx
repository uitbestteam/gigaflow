import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EquipmentType } from '@gigaflow/shared';
import type { EditableSlot } from '../store/planBuilderStore';
import { Card } from './Card';
import { Button } from './Button';

export interface SlotEditorRowProps {
  slot: EditableSlot;
  exerciseName: string;
  onChange: (patch: Partial<EditableSlot>) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
  className?: string;
}

const EQUIPMENT_TYPES = Object.values(EquipmentType);

const numberInputClasses =
  'min-h-11 w-full rounded-[10px] border border-border-subtle bg-surface-elevated px-3 text-text tabular-nums';

type NumericField = 'setsTarget' | 'repRangeMin' | 'repRangeMax' | 'weightIncrement';

// Mirrors zSlotInput's minimums (packages/shared/src/schemas/plan.ts): sets
// and rep-range fields are `min(1)`, weightIncrement is `min(0)`. An emptied
// or invalid field must never silently become a value that fails that
// schema on save.
const FIELD_MIN: Record<NumericField, number> = {
  setsTarget: 1,
  repRangeMin: 1,
  repRangeMax: 1,
  weightIncrement: 0,
};

/**
 * Backs one numeric input with a local text draft so the user can freely
 * clear/retype (including a momentary empty box) without the field
 * collapsing to `0` mid-edit. Valid keystrokes (>= the schema minimum) are
 * committed to the store immediately; an empty or below-minimum value is
 * clamped to the minimum on blur, so a save immediately after clearing a
 * field can never submit an invalid `0`.
 */
function useNumericField(
  value: number,
  field: NumericField,
  onChange: (patch: Partial<EditableSlot>) => void,
) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const min = FIELD_MIN[field];

  function handleChange(raw: string) {
    setDraft(raw);
    const parsed = Number(raw);
    if (raw.trim() !== '' && !Number.isNaN(parsed) && parsed >= min) {
      onChange({ [field]: parsed } as Partial<EditableSlot>);
    }
  }

  function handleBlur() {
    const parsed = Number(draft);
    if (draft.trim() === '' || Number.isNaN(parsed) || parsed < min) {
      setDraft(String(min));
      onChange({ [field]: min } as Partial<EditableSlot>);
    }
  }

  return { draft, handleChange, handleBlur };
}

/**
 * One exercise slot inside a `TemplateEditor`: exercise name, the numeric
 * targets (sets/rep range/increment — all `tabular-nums` for stable column
 * widths), an equipment select, and remove/move controls.
 */
export function SlotEditorRow({ slot, exerciseName, onChange, onRemove, onMove, className = '' }: SlotEditorRowProps) {
  const { t } = useTranslation();
  const setsId = useId();
  const repMinId = useId();
  const repMaxId = useId();
  const incrementId = useId();
  const equipmentId = useId();

  const sets = useNumericField(slot.setsTarget, 'setsTarget', onChange);
  const repMin = useNumericField(slot.repRangeMin, 'repRangeMin', onChange);
  const repMax = useNumericField(slot.repRangeMax, 'repRangeMax', onChange);
  const increment = useNumericField(slot.weightIncrement, 'weightIncrement', onChange);

  return (
    <Card className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-text">{exerciseName}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" aria-label={t('builder.moveUp')} onClick={() => onMove('up')}>
            {'↑'}
          </Button>
          <Button variant="ghost" aria-label={t('builder.moveDown')} onClick={() => onMove('down')}>
            {'↓'}
          </Button>
          <Button variant="ghost" aria-label={t('builder.removeExercise')} onClick={onRemove}>
            {'✕'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm text-text-secondary" htmlFor={setsId}>
          {t('builder.sets')}
          <input
            id={setsId}
            type="number"
            inputMode="numeric"
            className={numberInputClasses}
            value={sets.draft}
            onChange={(e) => sets.handleChange(e.target.value)}
            onBlur={sets.handleBlur}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary" htmlFor={repMinId}>
          {t('builder.repMin')}
          <input
            id={repMinId}
            type="number"
            inputMode="numeric"
            className={numberInputClasses}
            value={repMin.draft}
            onChange={(e) => repMin.handleChange(e.target.value)}
            onBlur={repMin.handleBlur}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary" htmlFor={repMaxId}>
          {t('builder.repMax')}
          <input
            id={repMaxId}
            type="number"
            inputMode="numeric"
            className={numberInputClasses}
            value={repMax.draft}
            onChange={(e) => repMax.handleChange(e.target.value)}
            onBlur={repMax.handleBlur}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary" htmlFor={incrementId}>
          {t('builder.increment')}
          <input
            id={incrementId}
            type="number"
            inputMode="decimal"
            step="0.5"
            className={numberInputClasses}
            value={increment.draft}
            onChange={(e) => increment.handleChange(e.target.value)}
            onBlur={increment.handleBlur}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-text-secondary" htmlFor={equipmentId}>
        {t('builder.equipment')}
        <select
          id={equipmentId}
          className="min-h-11 w-full rounded-[10px] border border-border-subtle bg-surface-elevated px-3 text-text"
          value={slot.equipmentType}
          onChange={(e) => onChange({ equipmentType: e.target.value as EquipmentType })}
        >
          {EQUIPMENT_TYPES.map((eq) => (
            <option key={eq} value={eq}>
              {t(`exercises.equipment.${eq}`)}
            </option>
          ))}
        </select>
      </label>
    </Card>
  );
}
