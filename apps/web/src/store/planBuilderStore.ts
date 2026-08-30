import { create } from 'zustand';
import { ColorTag, EquipmentType, PlanTemplateType } from '@gigaflow/shared';
import type { CreatePlanInput, Exercise, PlanWithTemplates, Translatable } from '@gigaflow/shared';

export interface EditableSlot {
  exerciseId: string;
  setsTarget: number;
  repRangeMin: number;
  repRangeMax: number;
  equipmentType: EquipmentType;
  weightIncrement: number;
}

export interface EditableTemplate {
  name: Translatable;
  focus?: Translatable;
  colorTag: ColorTag;
  slots: EditableSlot[];
}

export interface PlanBuilderState {
  name: string;
  templateType: PlanTemplateType;
  templates: EditableTemplate[];
  init: (fromPlan?: PlanWithTemplates) => void;
  setName: (name: string) => void;
  addTemplate: () => void;
  removeTemplate: (ti: number) => void;
  setTemplateMeta: (ti: number, patch: Partial<Pick<EditableTemplate, 'name' | 'focus' | 'colorTag'>>) => void;
  moveTemplate: (ti: number, dir: 'up' | 'down') => void;
  addSlot: (ti: number, exercise: Exercise) => void;
  updateSlot: (ti: number, si: number, patch: Partial<EditableSlot>) => void;
  removeSlot: (ti: number, si: number) => void;
  moveSlot: (ti: number, si: number, dir: 'up' | 'down') => void;
  toInput: () => CreatePlanInput;
  reset: () => void;
}

function blankTemplate(): EditableTemplate {
  return {
    name: { en: '', vi: '' },
    colorTag: ColorTag.CUSTOM,
    slots: [],
  };
}

function moveItem<T>(items: T[], index: number, dir: 'up' | 'down'): T[] {
  const targetIndex = dir === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const a = next[index];
  const b = next[targetIndex];
  if (a === undefined || b === undefined) return items;
  next[index] = b;
  next[targetIndex] = a;
  return next;
}

export const usePlanBuilderStore = create<PlanBuilderState>((set, get) => ({
  name: '',
  templateType: PlanTemplateType.CUSTOM,
  templates: [],

  init: (fromPlan) => {
    if (!fromPlan) {
      set({ name: '', templateType: PlanTemplateType.CUSTOM, templates: [blankTemplate()] });
      return;
    }
    const templates: EditableTemplate[] = fromPlan.templates
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((tmpl) => ({
        name: { ...tmpl.name },
        focus: tmpl.focus ? { ...tmpl.focus } : undefined,
        colorTag: tmpl.colorTag,
        slots: tmpl.slots
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((slot) => ({
            exerciseId: slot.exerciseId,
            setsTarget: slot.setsTarget,
            repRangeMin: slot.repRangeMin,
            repRangeMax: slot.repRangeMax,
            equipmentType: slot.equipmentType,
            weightIncrement: slot.weightIncrement,
          })),
      }));
    set({ name: fromPlan.name, templateType: fromPlan.templateType, templates });
  },

  setName: (name) => set({ name }),

  addTemplate: () => set({ templates: [...get().templates, blankTemplate()] }),

  removeTemplate: (ti) => {
    const templates = get().templates;
    if (ti < 0 || ti >= templates.length) return;
    set({ templates: templates.filter((_, i) => i !== ti) });
  },

  setTemplateMeta: (ti, patch) => {
    const templates = get().templates;
    const target = templates[ti];
    if (!target) return;
    const next = templates.map((tmpl, i) => (i === ti ? { ...tmpl, ...patch } : tmpl));
    set({ templates: next });
  },

  moveTemplate: (ti, dir) => set({ templates: moveItem(get().templates, ti, dir) }),

  addSlot: (ti, exercise) => {
    const templates = get().templates;
    const target = templates[ti];
    if (!target) return;
    const newSlot: EditableSlot = {
      exerciseId: exercise.id,
      setsTarget: 3,
      repRangeMin: 8,
      repRangeMax: 12,
      equipmentType: exercise.equipmentType,
      weightIncrement: exercise.defaultIncrement ?? 2.5,
    };
    const next = templates.map((tmpl, i) => (i === ti ? { ...tmpl, slots: [...tmpl.slots, newSlot] } : tmpl));
    set({ templates: next });
  },

  updateSlot: (ti, si, patch) => {
    const templates = get().templates;
    const target = templates[ti];
    if (!target) return;
    const targetSlot = target.slots[si];
    if (!targetSlot) return;
    const nextSlots = target.slots.map((slot, i) => (i === si ? { ...slot, ...patch } : slot));
    const next = templates.map((tmpl, i) => (i === ti ? { ...tmpl, slots: nextSlots } : tmpl));
    set({ templates: next });
  },

  removeSlot: (ti, si) => {
    const templates = get().templates;
    const target = templates[ti];
    if (!target) return;
    if (si < 0 || si >= target.slots.length) return;
    const nextSlots = target.slots.filter((_, i) => i !== si);
    const next = templates.map((tmpl, i) => (i === ti ? { ...tmpl, slots: nextSlots } : tmpl));
    set({ templates: next });
  },

  moveSlot: (ti, si, dir) => {
    const templates = get().templates;
    const target = templates[ti];
    if (!target) return;
    const nextSlots = moveItem(target.slots, si, dir);
    const next = templates.map((tmpl, i) => (i === ti ? { ...tmpl, slots: nextSlots } : tmpl));
    set({ templates: next });
  },

  toInput: () => {
    const state = get();
    return {
      name: state.name,
      templateType: state.templateType,
      templates: state.templates.map((tmpl, ti) => ({
        name: tmpl.name,
        focus: tmpl.focus,
        orderIndex: ti,
        colorTag: tmpl.colorTag,
        slots: tmpl.slots.map((slot, si) => ({
          exerciseId: slot.exerciseId,
          orderIndex: si,
          setsTarget: slot.setsTarget,
          repRangeMin: slot.repRangeMin,
          repRangeMax: slot.repRangeMax,
          equipmentType: slot.equipmentType,
          weightIncrement: slot.weightIncrement,
        })),
      })),
    };
  },

  reset: () => set({ name: '', templateType: PlanTemplateType.CUSTOM, templates: [] }),
}));
