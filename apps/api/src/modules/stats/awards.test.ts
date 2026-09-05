import { describe, it, expect } from 'vitest';
import { AwardKey, type StatsSummary } from '@gigaflow/shared';
import { AWARD_CATALOG, evaluateAwards } from './awards.js';

function summary(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    totalSessions: 0,
    totalVolume: 0,
    totalPrs: 0,
    totalExercises: 0,
    currentStreakWeeks: 0,
    longestStreakWeeks: 0,
    totalMealPlans: 0,
    ...overrides,
  };
}

describe('AWARD_CATALOG', () => {
  it('has all 10 awards with bilingual copy', () => {
    expect(AWARD_CATALOG).toHaveLength(10);
    const keys = AWARD_CATALOG.map((a) => a.key);
    expect(keys).toEqual([
      AwardKey.FIRST_WORKOUT,
      AwardKey.CONSISTENT_10,
      AwardKey.FIRST_PR,
      AwardKey.TEN_EXERCISES,
      AwardKey.VOLUME_50K,
      AwardKey.SESSIONS_25,
      AwardKey.VOLUME_100K,
      AwardKey.FIVE_PRS,
      AwardKey.STREAK_4_WEEKS,
      AwardKey.FIRST_MEAL_PLAN,
    ]);
    for (const def of AWARD_CATALOG) {
      expect(def.name.en).toBeTruthy();
      expect(def.name.vi).toBeTruthy();
      expect(def.description.en).toBeTruthy();
      expect(def.description.vi).toBeTruthy();
    }
  });
});

describe('evaluateAwards', () => {
  it('earns FIRST_WORKOUT but not CONSISTENT_10 at 1 session', () => {
    const awards = evaluateAwards(summary({ totalSessions: 1 }));
    const firstWorkout = awards.find((a) => a.key === AwardKey.FIRST_WORKOUT);
    const consistent10 = awards.find((a) => a.key === AwardKey.CONSISTENT_10);
    expect(firstWorkout?.earned).toBe(true);
    expect(firstWorkout?.current).toBe(1);
    expect(consistent10?.earned).toBe(false);
    expect(consistent10?.current).toBe(1);
  });

  it('earns VOLUME_50K at totalVolume 50000', () => {
    const awards = evaluateAwards(summary({ totalVolume: 50000 }));
    const volume = awards.find((a) => a.key === AwardKey.VOLUME_50K);
    expect(volume?.earned).toBe(true);
    expect(volume?.current).toBe(50000);
  });

  it('caps current at target even when metric exceeds it', () => {
    const awards = evaluateAwards(summary({
      totalVolume: 999999, totalSessions: 50, totalPrs: 20, totalExercises: 30, currentStreakWeeks: 12, totalMealPlans: 5,
    }));
    for (const award of awards) {
      expect(award.current).toBeLessThanOrEqual(award.target);
      expect(award.earned).toBe(true);
    }
  });

  it('earns the new streak/meal-plan/volume awards from their metrics', () => {
    const awards = evaluateAwards(
      summary({ currentStreakWeeks: 4, totalMealPlans: 1, totalVolume: 100000, totalPrs: 5, totalSessions: 25 }),
    );
    const byKey = (key: AwardKey) => awards.find((a) => a.key === key);
    expect(byKey(AwardKey.STREAK_4_WEEKS)?.earned).toBe(true);
    expect(byKey(AwardKey.FIRST_MEAL_PLAN)?.earned).toBe(true);
    expect(byKey(AwardKey.VOLUME_100K)?.earned).toBe(true);
    expect(byKey(AwardKey.FIVE_PRS)?.earned).toBe(true);
    expect(byKey(AwardKey.SESSIONS_25)?.earned).toBe(true);
  });

  it('does not earn the streak award below 4 weeks', () => {
    const awards = evaluateAwards(summary({ currentStreakWeeks: 3 }));
    const streak = awards.find((a) => a.key === AwardKey.STREAK_4_WEEKS);
    expect(streak?.earned).toBe(false);
    expect(streak?.current).toBe(3);
  });

  it('returns one Award per catalog entry with correct key/name/description/target', () => {
    const awards = evaluateAwards(summary());
    expect(awards).toHaveLength(AWARD_CATALOG.length);
    for (const def of AWARD_CATALOG) {
      const award = awards.find((a) => a.key === def.key);
      expect(award).toBeDefined();
      expect(award?.name).toEqual(def.name);
      expect(award?.description).toEqual(def.description);
      expect(award?.target).toBe(def.target);
      expect(award?.current).toBe(0);
      expect(award?.earned).toBe(false);
    }
  });
});
