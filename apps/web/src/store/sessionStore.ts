import { create } from 'zustand';
import type { LogSetInput, SessionStartResult, SlotTarget, TrainingSession } from '@gigaflow/shared';

export type SetStateStatus = 'pending' | 'active' | 'done' | 'edited';

export interface SetState {
  status: SetStateStatus;
  weightKg: number;
  repsDone: number;
  restSeconds?: number;
  rir?: number;
}

interface SlotSession {
  exerciseId: string;
  weightSuggested: number;
  repsSuggested: number;
  sets: SetState[];
}

export interface SessionStoreState {
  slots: Record<string, SlotSession>;
  initFromSlots: (session: TrainingSession | SessionStartResult['session'], slots: SlotTarget[]) => void;
  markDone: (slotId: string, setIndex: number) => void;
  editSet: (slotId: string, setIndex: number, values: { weightKg: number; repsDone: number }) => void;
  setRest: (slotId: string, setIndex: number, seconds: number) => void;
  setRir: (slotId: string, setIndex: number, rir: number) => void;
  toLogSetInput: () => LogSetInput[];
  reset: () => void;
}

/**
 * Updates a single set inside a single slot immutably, returning a fresh
 * `slots` record. `updater` receives the current set and must return the
 * replacement (guarded — never mutates the original array/object).
 */
function updateSet(
  slots: Record<string, SlotSession>,
  slotId: string,
  setIndex: number,
  updater: (set: SetState) => SetState,
): Record<string, SlotSession> {
  const slot = slots[slotId];
  if (!slot) return slots;
  const current = slot.sets[setIndex];
  if (!current) return slots;

  const nextSets = slot.sets.map((s, i) => (i === setIndex ? updater(s) : s));
  return { ...slots, [slotId]: { ...slot, sets: nextSets } };
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  slots: {},

  initFromSlots: (_session, slots) => {
    const next: Record<string, SlotSession> = {};
    slots.forEach((slotTarget, slotIdx) => {
      const sets: SetState[] = Array.from({ length: slotTarget.setsTarget }, (_, setIdx) => ({
        status: slotIdx === 0 && setIdx === 0 ? 'active' : 'pending',
        weightKg: slotTarget.weightSuggested,
        repsDone: slotTarget.repsSuggested,
      }));
      next[slotTarget.id] = {
        exerciseId: slotTarget.exerciseId,
        weightSuggested: slotTarget.weightSuggested,
        repsSuggested: slotTarget.repsSuggested,
        sets,
      };
    });
    set({ slots: next });
  },

  markDone: (slotId, setIndex) => {
    const slot = get().slots[slotId];
    if (!slot) return;
    const target = slot.sets[setIndex];
    if (!target) return;

    let nextSets = slot.sets.map((s, i) => (i === setIndex ? { ...s, status: 'done' as const } : s));
    const nextPendingIndex = nextSets.findIndex((s) => s.status === 'pending');
    if (nextPendingIndex !== -1) {
      nextSets = nextSets.map((s, i) => (i === nextPendingIndex ? { ...s, status: 'active' as const } : s));
    }

    set({ slots: { ...get().slots, [slotId]: { ...slot, sets: nextSets } } });
  },

  editSet: (slotId, setIndex, values) => {
    set({
      slots: updateSet(get().slots, slotId, setIndex, (s) => ({
        ...s,
        status: 'edited',
        weightKg: values.weightKg,
        repsDone: values.repsDone,
      })),
    });
  },

  setRest: (slotId, setIndex, seconds) => {
    set({
      slots: updateSet(get().slots, slotId, setIndex, (s) => ({ ...s, restSeconds: seconds })),
    });
  },

  setRir: (slotId, setIndex, rir) => {
    set({
      slots: updateSet(get().slots, slotId, setIndex, (s) => ({ ...s, rir })),
    });
  },

  toLogSetInput: () => {
    const result: LogSetInput[] = [];
    for (const [slotId, slot] of Object.entries(get().slots)) {
      slot.sets.forEach((s, i) => {
        if (s.status === 'pending') return;
        result.push({
          slotId,
          exerciseId: slot.exerciseId,
          setNumber: i + 1,
          weightKg: s.weightKg,
          repsDone: s.repsDone,
          weightSuggested: slot.weightSuggested,
          repsSuggested: slot.repsSuggested,
          restSeconds: s.restSeconds,
          rir: s.rir,
          isCompleted: true,
        });
      });
    }
    return result;
  },

  reset: () => set({ slots: {} }),
}));
