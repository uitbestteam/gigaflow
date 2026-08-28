import type { MuscleGroup, SlotTarget } from '@gigaflow/shared';
import { SetBox, type SetBoxStatus, type SetBoxValue } from './SetBox';
import { ProgressionBadge } from './ProgressionBadge';

/**
 * View-model for a slot as rendered in the active-session queue: the raw
 * `SlotTarget` from `@gigaflow/shared` plus the exercise's display name and
 * muscle group, which the parent resolves by joining the slot with its
 * `Exercise` record (this component stays presentational-only).
 */
export interface ExerciseRowSlot extends SlotTarget {
  name: string;
  muscleGroup: MuscleGroup;
}

export interface ExerciseRowSet {
  target: SetBoxValue;
  actual?: SetBoxValue;
  status: SetBoxStatus;
}

export type ExerciseRowStatus = 'pending' | 'active' | 'done';

export interface ExerciseRowProps {
  slot: ExerciseRowSlot;
  sets: ExerciseRowSet[];
  status?: ExerciseRowStatus;
  onSetTap: (index: number) => void;
  onSetEdit: (index: number) => void;
  className?: string;
}

export function ExerciseRow({ slot, sets, status = 'active', onSetTap, onSetEdit, className = '' }: ExerciseRowProps) {
  const classes = [
    'flex flex-col gap-2',
    status === 'pending' ? 'opacity-60' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-text">{slot.name}</span>
          <span className="text-xs uppercase text-text-secondary">{slot.muscleGroup}</span>
        </div>
        <ProgressionBadge lastSet={slot.lastSets?.[0]} />
      </div>
      <div className="flex flex-wrap gap-2">
        {sets.map((set, index) => (
          <SetBox
            key={index}
            target={set.target}
            actual={set.actual}
            status={set.status}
            onTap={() => onSetTap(index)}
            onEdit={() => onSetEdit(index)}
          />
        ))}
      </div>
    </div>
  );
}
