export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export interface LastPerf { sets: { weightKg: number; repsDone: number }[] }
export interface SlotSpec { repRangeMin: number; repRangeMax: number; weightIncrement: number }
export type ProgressionReason = 'first' | 'increase' | 'hold';

export function computeTarget(
  last: LastPerf | null,
  slot: SlotSpec,
): { weightSuggested: number; repsSuggested: number; reason: ProgressionReason } {
  if (!last || last.sets.length === 0) {
    return { weightSuggested: 0, repsSuggested: slot.repRangeMin, reason: 'first' };
  }
  const first = last.sets[0];
  if (!first) {
    return { weightSuggested: 0, repsSuggested: slot.repRangeMin, reason: 'first' };
  }
  const prevWeight = first.weightKg;
  const allHitMax = last.sets.every((s) => s.repsDone >= slot.repRangeMax);
  if (allHitMax) {
    return { weightSuggested: prevWeight + slot.weightIncrement, repsSuggested: slot.repRangeMin, reason: 'increase' };
  }
  return { weightSuggested: prevWeight, repsSuggested: Math.min(first.repsDone + 1, slot.repRangeMax), reason: 'hold' };
}
