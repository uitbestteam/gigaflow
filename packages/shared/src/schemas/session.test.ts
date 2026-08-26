import { describe, it, expect } from 'vitest';
import { zTrainingSession, zLogSetInput, zSlotTarget, SessionStatus, EquipmentType } from '../index';

const session = { id: 's1', userId: 'u1', templateId: 't1', sessionNumber: 1, startedAt: new Date(), status: SessionStatus.IN_PROGRESS };
const logInput = { slotId: 'sl1', exerciseId: 'e1', setNumber: 1, weightKg: 80, repsDone: 8, weightSuggested: 80, repsSuggested: 8, isCompleted: true };
const slotTarget = { id: 'sl1', templateId: 't1', exerciseId: 'e1', orderIndex: 0, setsTarget: 4, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5, weightSuggested: 80, repsSuggested: 6 };

describe('session schemas', () => {
  it('accepts a valid in-progress session', () => { expect(zTrainingSession.safeParse(session).success).toBe(true); });
  it('rejects an unknown status', () => { expect(zTrainingSession.safeParse({ ...session, status: 'paused' }).success).toBe(false); });
  it('accepts a valid log-set input', () => { expect(zLogSetInput.safeParse(logInput).success).toBe(true); });
  it('rejects rir out of range', () => { expect(zLogSetInput.safeParse({ ...logInput, rir: 99 }).success).toBe(false); });
  it('accepts a slot target', () => { expect(zSlotTarget.safeParse(slotTarget).success).toBe(true); });
});
