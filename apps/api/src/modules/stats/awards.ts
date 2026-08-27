import { AwardKey, type Award, type StatsSummary, type Translatable } from '@gigaflow/shared';

export interface AwardDef {
  key: AwardKey;
  name: Translatable;
  description: Translatable;
  target: number;
  metric: (s: StatsSummary) => number;
}

export const AWARD_CATALOG: AwardDef[] = [
  {
    key: AwardKey.FIRST_WORKOUT,
    name: { en: 'First Workout', vi: 'Buổi tập đầu tiên' },
    description: {
      en: 'Complete your first training session',
      vi: 'Hoàn thành buổi tập đầu tiên của bạn',
    },
    target: 1,
    metric: (s) => s.totalSessions,
  },
  {
    key: AwardKey.CONSISTENT_10,
    name: { en: 'Consistent 10', vi: '10 buổi liên tục' },
    description: {
      en: 'Complete 10 training sessions',
      vi: 'Hoàn thành 10 buổi tập luyện',
    },
    target: 10,
    metric: (s) => s.totalSessions,
  },
  {
    key: AwardKey.FIRST_PR,
    name: { en: 'First Personal Record', vi: 'Kỷ lục cá nhân đầu tiên' },
    description: {
      en: 'Set your first personal record',
      vi: 'Lập kỷ lục cá nhân đầu tiên của bạn',
    },
    target: 1,
    metric: (s) => s.totalPrs,
  },
  {
    key: AwardKey.TEN_EXERCISES,
    name: { en: 'Ten Exercises', vi: 'Mười bài tập' },
    description: {
      en: 'Log performance for 10 different exercises',
      vi: 'Ghi nhận thành tích cho 10 bài tập khác nhau',
    },
    target: 10,
    metric: (s) => s.totalExercises,
  },
  {
    key: AwardKey.VOLUME_50K,
    name: { en: '50K Volume', vi: '50K khối lượng' },
    description: {
      en: 'Lift a total volume of 50,000 kg',
      vi: 'Nâng tổng khối lượng 50.000 kg',
    },
    target: 50000,
    metric: (s) => s.totalVolume,
  },
];

export function evaluateAwards(summary: StatsSummary): Award[] {
  return AWARD_CATALOG.map((def) => {
    const value = def.metric(summary);
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      target: def.target,
      current: Math.min(value, def.target),
      earned: value >= def.target,
    };
  });
}
