import { useId } from 'react';
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

  function handleNumberChange(field: keyof EditableSlot, raw: string) {
    const parsed = Number(raw);
    onChange({ [field]: Number.isNaN(parsed) ? 0 : parsed } as Partial<EditableSlot>);
  }

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
            value={slot.setsTarget}
            onChange={(e) => handleNumberChange('setsTarget', e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary" htmlFor={repMinId}>
          {t('builder.repMin')}
          <input
            id={repMinId}
            type="number"
            inputMode="numeric"
            className={numberInputClasses}
            value={slot.repRangeMin}
            onChange={(e) => handleNumberChange('repRangeMin', e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary" htmlFor={repMaxId}>
          {t('builder.repMax')}
          <input
            id={repMaxId}
            type="number"
            inputMode="numeric"
            className={numberInputClasses}
            value={slot.repRangeMax}
            onChange={(e) => handleNumberChange('repRangeMax', e.target.value)}
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
            value={slot.weightIncrement}
            onChange={(e) => handleNumberChange('weightIncrement', e.target.value)}
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
