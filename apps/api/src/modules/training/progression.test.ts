import { describe, it, expect } from 'vitest';
import { epley1RM, computeTarget } from './progression';

describe('epley1RM', () => {
  it('computes Epley 1RM', () => { expect(epley1RM(100, 5)).toBeCloseTo(116.7, 1); });
  it('is 0 for non-positive reps', () => { expect(epley1RM(100, 0)).toBe(0); });
});

describe('computeTarget', () => {
  const slot = { repRangeMin: 6, repRangeMax: 10, weightIncrement: 2.5 };
  it('first session → repRangeMin at weight 0', () => {
    expect(computeTarget(null, slot)).toEqual({ weightSuggested: 0, repsSuggested: 6, reason: 'first' });
  });
  it('all sets hit max → increase weight, reset reps to min', () => {
    const r = computeTarget({ sets: [{ weightKg: 80, repsDone: 10 }, { weightKg: 80, repsDone: 10 }] }, slot);
    expect(r).toEqual({ weightSuggested: 82.5, repsSuggested: 6, reason: 'increase' });
  });
  it('not all sets hit max → hold weight, +1 rep capped at max', () => {
    const r = computeTarget({ sets: [{ weightKg: 80, repsDone: 8 }, { weightKg: 80, repsDone: 7 }] }, slot);
    expect(r).toEqual({ weightSuggested: 80, repsSuggested: 9, reason: 'hold' });
  });
});
