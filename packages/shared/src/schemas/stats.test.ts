import { describe, it, expect } from 'vitest';
import { zPersonalRecord, zStatsSummary, zAward, AwardKey } from '../index';

describe('stats schemas', () => {
  it('accepts a personal record', () => {
    expect(zPersonalRecord.safeParse({ exerciseId: 'e1', name: { en: 'Bench', vi: 'Đẩy ngực' }, bestSet: { weightKg: 100, repsDone: 5, e1RM: 116.7 } }).success).toBe(true);
  });
  it('accepts a summary', () => {
    expect(zStatsSummary.safeParse({ totalSessions: 3, totalVolume: 12000, totalPrs: 5, totalExercises: 5 }).success).toBe(true);
  });
  it('rejects a negative summary field', () => {
    expect(zStatsSummary.safeParse({ totalSessions: -1, totalVolume: 0, totalPrs: 0, totalExercises: 0 }).success).toBe(false);
  });
  it('accepts an award', () => {
    expect(zAward.safeParse({ key: AwardKey.FIRST_WORKOUT, name: { en: 'First workout', vi: 'Buổi đầu' }, description: { en: 'x', vi: 'y' }, target: 1, current: 1, earned: true }).success).toBe(true);
  });
});
