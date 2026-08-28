import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ColorTag } from '@gigaflow/shared';
import type { Exercise } from '@gigaflow/shared';
import type { EditableSlot, EditableTemplate } from '../store/planBuilderStore';
import { resolveTranslatable } from '../lib/i18n';
import { Card } from './Card';
import { Button } from './Button';
import { ColorDot } from './ColorDot';
import { SlotEditorRow } from './SlotEditorRow';

export interface TemplateEditorProps {
  template: EditableTemplate;
  index: number;
  exercisesById: Map<string, Exercise>;
  currentLang: string;
  onNameChange: (name: string) => void;
  onColorChange: (colorTag: ColorTag) => void;
  onAddExercise: () => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onSlotChange: (si: number, patch: Partial<EditableSlot>) => void;
  onSlotRemove: (si: number) => void;
  onSlotMove: (si: number, dir: 'up' | 'down') => void;
  className?: string;
}

const COLOR_TAGS = Object.values(ColorTag);

/**
 * Editor for one workout day (`EditableTemplate`): name, color tag, its
 * `SlotEditorRow`s, and add/remove/move controls for the day itself.
 *
 * F2 simplification: the name input edits a single display string that is
 * mirrored into both `name.en` and `name.vi` (see `onNameChange` callers in
 * `PlanBuilderPage`) rather than exposing separate en/vi fields — a full
 * bilingual editor is out of scope for this task.
 */
export function TemplateEditor({
  template,
  index,
  exercisesById,
  currentLang,
  onNameChange,
  onColorChange,
  onAddExercise,
  onRemove,
  onMove,
  onSlotChange,
  onSlotRemove,
  onSlotMove,
  className = '',
}: TemplateEditorProps) {
  const { t } = useTranslation();
  const nameId = useId();

  return (
    <Card className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary" htmlFor={nameId}>
          {t('builder.templateNamePlaceholder')}
          <input
            id={nameId}
            type="text"
            className="min-h-11 w-full rounded-[10px] border border-border-subtle bg-surface-elevated px-3 text-text"
            placeholder={t('builder.templateNamePlaceholder')}
            value={template.name.en}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-1">
          <Button variant="ghost" aria-label={t('builder.moveUp')} onClick={() => onMove('up')}>
            {'↑'}
          </Button>
          <Button variant="ghost" aria-label={t('builder.moveDown')} onClick={() => onMove('down')}>
            {'↓'}
          </Button>
          <Button variant="ghost" aria-label={t('builder.removeDay')} onClick={onRemove}>
            {'✕'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2" role="group" aria-label={t('builder.equipment')}>
        {COLOR_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-label={tag}
            aria-pressed={template.colorTag === tag}
            className={[
              'flex h-11 w-11 items-center justify-center rounded-full',
              template.colorTag === tag ? 'ring-2 ring-accent' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onColorChange(tag)}
          >
            <ColorDot tag={tag} />
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {template.slots.map((slot, si) => {
          const exercise = exercisesById.get(slot.exerciseId);
          const exerciseName = exercise ? resolveTranslatable(exercise.name, currentLang) : slot.exerciseId;
          return (
            <SlotEditorRow
              key={`${index}-${si}`}
              slot={slot}
              exerciseName={exerciseName}
              onChange={(patch) => onSlotChange(si, patch)}
              onRemove={() => onSlotRemove(si)}
              onMove={(dir) => onSlotMove(si, dir)}
            />
          );
        })}
      </div>

      <Button variant="ghost" className="self-start" onClick={onAddExercise}>
        {t('builder.addExercise')}
      </Button>
    </Card>
  );
}
