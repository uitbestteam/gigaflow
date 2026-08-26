import { describe, it, expect } from 'vitest';
import { zExercise, zCreateExerciseInput, MuscleGroup, EquipmentType } from '../index';

const ex = {
  id: '651f1f77bcf86cd799439011',
  slug: 'bench-barbell',
  name: { en: 'Bench press', vi: 'Đẩy ngực' },
  muscleGroup: MuscleGroup.CHEST,
  equipmentType: EquipmentType.BARBELL,
  defaultIncrement: 2.5,
  isCustom: false,
};

describe('exercise schemas', () => {
  it('accepts a valid preset exercise', () => {
    expect(zExercise.safeParse(ex).success).toBe(true);
  });
  it('rejects an unknown muscle group', () => {
    expect(zExercise.safeParse({ ...ex, muscleGroup: 'neck' }).success).toBe(false);
  });
  it('rejects negative increment', () => {
    expect(zExercise.safeParse({ ...ex, defaultIncrement: -1 }).success).toBe(false);
  });
  it('validates create input (increment optional)', () => {
    const r = zCreateExerciseInput.safeParse({
      name: { en: 'My Curl', vi: 'Cuốn của tôi' },
      muscleGroup: MuscleGroup.ARMS,
      equipmentType: EquipmentType.DUMBBELL,
    });
    expect(r.success).toBe(true);
  });
});
