import {
  ColorTag, PlanSource, PlanTemplateType, type Translatable, type PlanWithTemplates,
} from '@gigaflow/shared';
import { findBySlugs } from '../exercise/exercise.repo.js';
import { insertPlanGraph, type NewTemplate } from './workout.repo.js';

export interface PresetSlotDef { slug: string; setsTarget: number; repRangeMin: number; repRangeMax: number }
export interface PresetTemplateDef { name: Translatable; colorTag: ColorTag; focus?: Translatable; slots: PresetSlotDef[] }

const S = (slug: string, setsTarget: number, repRangeMin: number, repRangeMax: number): PresetSlotDef => ({ slug, setsTarget, repRangeMin, repRangeMax });

export const PRESET_TEMPLATES: Record<
  PlanTemplateType.PPL | PlanTemplateType.UPPER_LOWER | PlanTemplateType.FULL_BODY,
  { name: string; templates: PresetTemplateDef[] }
> = {
  [PlanTemplateType.PPL]: {
    name: 'Push / Pull / Legs',
    templates: [
      { name: { en: 'Push A', vi: 'Đẩy A' }, colorTag: ColorTag.PUSH, slots: [S('bench-barbell', 4, 6, 10), S('ohp-barbell', 3, 8, 12), S('bench-incline-db', 3, 10, 15), S('lateral-raise', 3, 12, 20), S('tricep-pushdown', 3, 10, 15)] },
      { name: { en: 'Pull A', vi: 'Kéo A' }, colorTag: ColorTag.PULL, slots: [S('pullup', 4, 6, 12), S('row-barbell', 4, 6, 10), S('lat-pulldown', 3, 10, 15), S('facepull', 3, 15, 25), S('curl-barbell', 3, 10, 15)] },
      { name: { en: 'Legs A', vi: 'Chân A' }, colorTag: ColorTag.LEGS, slots: [S('squat-barbell', 4, 6, 10), S('rdl', 3, 8, 12), S('leg-press', 3, 10, 15), S('leg-curl', 3, 10, 15), S('calf-raise', 4, 12, 20)] },
      { name: { en: 'Push B', vi: 'Đẩy B' }, colorTag: ColorTag.PUSH, slots: [S('bench-incline-bb', 4, 6, 10), S('ohp-db', 3, 8, 12), S('chest-fly-cable', 3, 12, 15), S('lateral-raise', 3, 12, 20), S('skull-crusher', 3, 8, 12)] },
      { name: { en: 'Pull B', vi: 'Kéo B' }, colorTag: ColorTag.PULL, slots: [S('deadlift', 3, 5, 8), S('row-db', 4, 8, 12), S('seated-row-cable', 3, 10, 15), S('rear-delt-fly', 3, 15, 20), S('curl-hammer', 3, 10, 15)] },
      { name: { en: 'Legs B', vi: 'Chân B' }, colorTag: ColorTag.LEGS, slots: [S('front-squat', 4, 6, 10), S('hip-thrust', 3, 8, 12), S('lunge-db', 3, 10, 12), S('leg-extension', 3, 12, 15), S('calf-raise', 4, 12, 20)] },
    ],
  },
  [PlanTemplateType.UPPER_LOWER]: {
    name: 'Upper / Lower',
    templates: [
      { name: { en: 'Upper A', vi: 'Thân trên A' }, colorTag: ColorTag.UPPER, slots: [S('bench-barbell', 4, 6, 10), S('row-barbell', 4, 6, 10), S('ohp-barbell', 3, 8, 12), S('lat-pulldown', 3, 10, 15), S('curl-db', 3, 10, 15)] },
      { name: { en: 'Lower A', vi: 'Thân dưới A' }, colorTag: ColorTag.LOWER, slots: [S('squat-barbell', 4, 6, 10), S('rdl', 3, 8, 12), S('leg-press', 3, 10, 15), S('leg-curl', 3, 10, 15), S('calf-raise', 4, 12, 20)] },
      { name: { en: 'Upper B', vi: 'Thân trên B' }, colorTag: ColorTag.UPPER, slots: [S('bench-incline-db', 4, 8, 12), S('pullup', 4, 6, 12), S('ohp-db', 3, 8, 12), S('seated-row-cable', 3, 10, 15), S('tricep-pushdown', 3, 10, 15)] },
      { name: { en: 'Lower B', vi: 'Thân dưới B' }, colorTag: ColorTag.LOWER, slots: [S('deadlift', 3, 5, 8), S('front-squat', 3, 8, 10), S('lunge-db', 3, 10, 12), S('leg-extension', 3, 12, 15), S('hip-thrust', 3, 10, 12)] },
    ],
  },
  [PlanTemplateType.FULL_BODY]: {
    name: 'Full body',
    templates: [
      { name: { en: 'Full A', vi: 'Toàn thân A' }, colorTag: ColorTag.FULL, slots: [S('squat-barbell', 3, 6, 10), S('bench-barbell', 3, 6, 10), S('row-barbell', 3, 8, 12), S('ohp-db', 3, 10, 12), S('plank', 3, 1, 1)] },
      { name: { en: 'Full B', vi: 'Toàn thân B' }, colorTag: ColorTag.FULL, slots: [S('deadlift', 3, 5, 8), S('bench-incline-db', 3, 8, 12), S('lat-pulldown', 3, 10, 15), S('lateral-raise', 3, 12, 20), S('curl-barbell', 3, 10, 15)] },
      { name: { en: 'Full C', vi: 'Toàn thân C' }, colorTag: ColorTag.FULL, slots: [S('front-squat', 3, 6, 10), S('pushup', 3, 10, 20), S('pullup', 3, 6, 12), S('leg-curl', 3, 10, 15), S('tricep-pushdown', 3, 10, 15)] },
    ],
  },
};

export async function createPlanFromTemplate(userId: string, templateType: PlanTemplateType): Promise<PlanWithTemplates> {
  const def = (PRESET_TEMPLATES as Record<string, { name: string; templates: PresetTemplateDef[] }>)[templateType];
  if (!def) throw new Error('Unknown preset template');

  const allSlugs = def.templates.flatMap((t) => t.slots.map((s) => s.slug));
  const bySlug = await findBySlugs(Array.from(new Set(allSlugs)));

  const templates: NewTemplate[] = def.templates.map((t, ti) => ({
    name: t.name,
    ...(t.focus ? { focus: t.focus } : {}),
    orderIndex: ti,
    colorTag: t.colorTag,
    slots: t.slots.map((s, si) => {
      const ex = bySlug.get(s.slug);
      if (!ex) throw new Error(`Preset references unknown exercise: ${s.slug}`);
      return {
        exerciseId: ex.id, orderIndex: si, setsTarget: s.setsTarget,
        repRangeMin: s.repRangeMin, repRangeMax: s.repRangeMax,
        equipmentType: ex.equipmentType, weightIncrement: ex.defaultIncrement,
      };
    }),
  }));

  return insertPlanGraph(userId, { name: def.name, templateType, source: PlanSource.CUSTOM, isActive: true }, templates);
}
