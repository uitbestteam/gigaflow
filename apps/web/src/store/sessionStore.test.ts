import { describe, it, expect, beforeEach } from 'vitest';
import type { TrainingSession, SlotTarget } from '@gigaflow/shared';
import { EquipmentType, SessionStatus } from '@gigaflow/shared';
import { useSessionStore } from './sessionStore';

const session: TrainingSession = {
  id: 'sess_1',
  userId: 'user_1',
  templateId: 'tmpl_1',
  sessionNumber: 1,
  startedAt: new Date(),
  status: SessionStatus.IN_PROGRESS,
};

const slots: SlotTarget[] = [
  {
    id: 'slot_1',
    templateId: 'tmpl_1',
    exerciseId: 'ex_1',
    orderIndex: 0,
    setsTarget: 3,
    repRangeMin: 8,
    repRangeMax: 12,
    equipmentType: EquipmentType.BARBELL,
    weightIncrement: 2.5,
    weightSuggested: 60,
    repsSuggested: 10,
  },
];

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('initFromSlots builds setsTarget SetStates per slot, seeded pending, first set active', () => {
    useSessionStore.getState().initFromSlots(session, slots);
    const sets = useSessionStore.getState().slots['slot_1']?.sets;
    expect(sets).toHaveLength(3);
    expect(sets?.[0]).toMatchObject({ status: 'active', weightKg: 60, repsDone: 10 });
    expect(sets?.[1]).toMatchObject({ status: 'pending', weightKg: 60, repsDone: 10 });
    expect(sets?.[2]).toMatchObject({ status: 'pending', weightKg: 60, repsDone: 10 });
  });

  it('markDone marks the set done keeping values and activates the next pending set', () => {
    useSessionStore.getState().initFromSlots(session, slots);
    useSessionStore.getState().markDone('slot_1', 0);
    const sets = useSessionStore.getState().slots['slot_1']?.sets;
    expect(sets?.[0]).toMatchObject({ status: 'done', weightKg: 60, repsDone: 10 });
    expect(sets?.[1]?.status).toBe('active');
    expect(sets?.[2]?.status).toBe('pending');
  });

  it('markDone on the last set leaves no set active', () => {
    useSessionStore.getState().initFromSlots(session, slots);
    useSessionStore.getState().markDone('slot_1', 0);
    useSessionStore.getState().markDone('slot_1', 1);
    useSessionStore.getState().markDone('slot_1', 2);
    const sets = useSessionStore.getState().slots['slot_1']?.sets;
    expect(sets?.every((s) => s.status === 'done')).toBe(true);
  });

  it('editSet marks the set edited with new values', () => {
    useSessionStore.getState().initFromSlots(session, slots);
    useSessionStore.getState().editSet('slot_1', 0, { weightKg: 65, repsDone: 8 });
    const sets = useSessionStore.getState().slots['slot_1']?.sets;
    expect(sets?.[0]).toMatchObject({ status: 'edited', weightKg: 65, repsDone: 8 });
  });

  it('setRest and setRir update the targeted set only', () => {
    useSessionStore.getState().initFromSlots(session, slots);
    useSessionStore.getState().setRest('slot_1', 0, 90);
    useSessionStore.getState().setRir('slot_1', 0, 2);
    const sets = useSessionStore.getState().slots['slot_1']?.sets;
    expect(sets?.[0]).toMatchObject({ restSeconds: 90, rir: 2 });
    expect(sets?.[1]?.restSeconds).toBeUndefined();
  });

  it('toLogSetInput flattens only non-pending sets with 1-based setNumber and isCompleted true', () => {
    useSessionStore.getState().initFromSlots(session, slots);
    useSessionStore.getState().markDone('slot_1', 0);
    useSessionStore.getState().editSet('slot_1', 1, { weightKg: 62.5, repsDone: 9 });
    const result = useSessionStore.getState().toLogSetInput();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      slotId: 'slot_1',
      exerciseId: 'ex_1',
      setNumber: 1,
      weightKg: 60,
      repsDone: 10,
      weightSuggested: 60,
      repsSuggested: 10,
      isCompleted: true,
    });
    expect(result[1]).toMatchObject({
      slotId: 'slot_1',
      exerciseId: 'ex_1',
      setNumber: 2,
      weightKg: 62.5,
      repsDone: 9,
      weightSuggested: 60,
      repsSuggested: 10,
      isCompleted: true,
    });
  });

  it('reset clears all slots', () => {
    useSessionStore.getState().initFromSlots(session, slots);
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().slots).toEqual({});
    expect(useSessionStore.getState().toLogSetInput()).toEqual([]);
  });
});
