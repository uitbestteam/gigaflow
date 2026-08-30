import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EquipmentType, MuscleGroup, type CreateExerciseInput } from '@gigaflow/shared';
import { createExercise } from '../../lib/api';
import { Button } from '../../components/Button';

export interface CustomExerciseFormProps {
  onCreated?: () => void;
  className?: string;
}

const MUSCLE_GROUPS = Object.values(MuscleGroup);
const EQUIPMENT_TYPES = Object.values(EquipmentType);
const DEFAULT_MUSCLE_GROUP = MUSCLE_GROUPS[0] ?? MuscleGroup.CHEST;
const DEFAULT_EQUIPMENT_TYPE = EQUIPMENT_TYPES[0] ?? EquipmentType.BARBELL;

const FIELD_CLASSES =
  'min-h-11 w-full rounded-[10px] border border-border-subtle bg-surface-elevated px-3 text-text placeholder:text-text-muted';
const LABEL_CLASSES = 'text-sm font-medium text-text-secondary';

export function CustomExerciseForm({ onCreated, className = '' }: CustomExerciseFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [nameEn, setNameEn] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(DEFAULT_MUSCLE_GROUP);
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(DEFAULT_EQUIPMENT_TYPE);
  const [defaultIncrement, setDefaultIncrement] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: CreateExerciseInput) => createExercise(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setNameEn('');
      setNameVi('');
      setDefaultIncrement('');
      setError(null);
      onCreated?.();
    },
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmedEn = nameEn.trim();
    const trimmedVi = nameVi.trim();
    if (!trimmedEn || !trimmedVi) {
      setError(t('exercises.form.nameRequired'));
      return;
    }

    const increment = defaultIncrement.trim() === '' ? undefined : Number(defaultIncrement);

    const input: CreateExerciseInput = {
      name: { en: trimmedEn, vi: trimmedVi },
      muscleGroup,
      equipmentType,
      ...(increment !== undefined && !Number.isNaN(increment) ? { defaultIncrement: increment } : {}),
    };

    createMutation.mutate(input);
  }

  return (
    <form
      className={[
        'flex flex-col gap-3 rounded-[10px] border border-border-subtle bg-surface p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="exercise-name-en" className={LABEL_CLASSES}>
          {t('exercises.form.nameEnLabel')}
        </label>
        <input
          id="exercise-name-en"
          className={FIELD_CLASSES}
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="exercise-name-vi" className={LABEL_CLASSES}>
          {t('exercises.form.nameViLabel')}
        </label>
        <input
          id="exercise-name-vi"
          className={FIELD_CLASSES}
          value={nameVi}
          onChange={(e) => setNameVi(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="exercise-muscle-group" className={LABEL_CLASSES}>
          {t('exercises.form.muscleGroupLabel')}
        </label>
        <select
          id="exercise-muscle-group"
          className={FIELD_CLASSES}
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
        >
          {MUSCLE_GROUPS.map((group) => (
            <option key={group} value={group}>
              {t(`exercises.muscle.${group}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="exercise-equipment-type" className={LABEL_CLASSES}>
          {t('exercises.form.equipmentTypeLabel')}
        </label>
        <select
          id="exercise-equipment-type"
          className={FIELD_CLASSES}
          value={equipmentType}
          onChange={(e) => setEquipmentType(e.target.value as EquipmentType)}
        >
          {EQUIPMENT_TYPES.map((equipment) => (
            <option key={equipment} value={equipment}>
              {t(`exercises.equipment.${equipment}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="exercise-default-increment" className={LABEL_CLASSES}>
          {t('exercises.form.defaultIncrementLabel')}
        </label>
        <input
          id="exercise-default-increment"
          type="number"
          inputMode="decimal"
          className={[FIELD_CLASSES, 'tnum'].join(' ')}
          value={defaultIncrement}
          onChange={(e) => setDefaultIncrement(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-warning">{error}</p>}

      <Button type="submit" disabled={createMutation.isPending}>
        {t('exercises.form.submit')}
      </Button>
    </form>
  );
}
