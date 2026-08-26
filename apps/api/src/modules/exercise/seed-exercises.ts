import { EquipmentType as EQ, MuscleGroup as MG } from '@gigaflow/shared';
import { upsertPreset, type PresetSeed } from './exercise.repo.js';

export const PRESET_EXERCISES: PresetSeed[] = [
  // Chest
  { slug: 'bench-barbell', name: { en: 'Bench press', vi: 'Đẩy ngực tạ đòn' }, muscleGroup: MG.CHEST, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'bench-incline-bb', name: { en: 'Incline barbell press', vi: 'Đẩy ngực trên tạ đòn' }, muscleGroup: MG.CHEST, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'bench-incline-db', name: { en: 'Incline dumbbell press', vi: 'Đẩy ngực trên tạ đơn' }, muscleGroup: MG.CHEST, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'bench-db', name: { en: 'Dumbbell bench press', vi: 'Đẩy ngực tạ đơn' }, muscleGroup: MG.CHEST, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'chest-fly-cable', name: { en: 'Cable chest fly', vi: 'Ép ngực cáp' }, muscleGroup: MG.CHEST, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'chest-fly-db', name: { en: 'Dumbbell fly', vi: 'Ép ngực tạ đơn' }, muscleGroup: MG.CHEST, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'chest-press-machine', name: { en: 'Chest press machine', vi: 'Máy đẩy ngực' }, muscleGroup: MG.CHEST, equipmentType: EQ.MACHINE, defaultIncrement: 5 },
  { slug: 'pushup', name: { en: 'Push-up', vi: 'Hít đất' }, muscleGroup: MG.CHEST, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'dip-chest', name: { en: 'Chest dip', vi: 'Xà nhúng ngực' }, muscleGroup: MG.CHEST, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  // Back
  { slug: 'pullup', name: { en: 'Pull-up', vi: 'Hít xà' }, muscleGroup: MG.BACK, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'chinup', name: { en: 'Chin-up', vi: 'Hít xà ngửa' }, muscleGroup: MG.BACK, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'row-barbell', name: { en: 'Barbell row', vi: 'Chèo tạ đòn' }, muscleGroup: MG.BACK, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'row-db', name: { en: 'Dumbbell row', vi: 'Chèo tạ đơn' }, muscleGroup: MG.BACK, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'row-tbar', name: { en: 'T-bar row', vi: 'Chèo T-bar' }, muscleGroup: MG.BACK, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'lat-pulldown', name: { en: 'Lat pulldown', vi: 'Kéo xô' }, muscleGroup: MG.BACK, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'seated-row-cable', name: { en: 'Seated cable row', vi: 'Chèo cáp ngồi' }, muscleGroup: MG.BACK, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'facepull', name: { en: 'Face pull', vi: 'Kéo cáp ngang mặt' }, muscleGroup: MG.BACK, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'deadlift', name: { en: 'Deadlift', vi: 'Kéo đất' }, muscleGroup: MG.BACK, equipmentType: EQ.BARBELL, defaultIncrement: 5 },
  { slug: 'pullover-db', name: { en: 'Dumbbell pullover', vi: 'Kéo tạ qua đầu' }, muscleGroup: MG.BACK, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  // Legs
  { slug: 'squat-barbell', name: { en: 'Barbell squat', vi: 'Squat tạ đòn' }, muscleGroup: MG.LEGS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'front-squat', name: { en: 'Front squat', vi: 'Squat trước' }, muscleGroup: MG.LEGS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'rdl', name: { en: 'Romanian deadlift', vi: 'Kéo đất kiểu Romania' }, muscleGroup: MG.LEGS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'leg-press', name: { en: 'Leg press', vi: 'Máy đạp chân' }, muscleGroup: MG.LEGS, equipmentType: EQ.MACHINE, defaultIncrement: 5 },
  { slug: 'leg-curl', name: { en: 'Leg curl', vi: 'Máy cuốn chân' }, muscleGroup: MG.LEGS, equipmentType: EQ.MACHINE, defaultIncrement: 2.5 },
  { slug: 'leg-extension', name: { en: 'Leg extension', vi: 'Máy duỗi chân' }, muscleGroup: MG.LEGS, equipmentType: EQ.MACHINE, defaultIncrement: 2.5 },
  { slug: 'lunge-db', name: { en: 'Dumbbell lunge', vi: 'Bước tấn tạ đơn' }, muscleGroup: MG.LEGS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'bulgarian-split', name: { en: 'Bulgarian split squat', vi: 'Squat chẻ Bulgaria' }, muscleGroup: MG.LEGS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'calf-raise', name: { en: 'Calf raise', vi: 'Nhón bắp chân' }, muscleGroup: MG.LEGS, equipmentType: EQ.MACHINE, defaultIncrement: 5 },
  { slug: 'hip-thrust', name: { en: 'Hip thrust', vi: 'Đẩy hông' }, muscleGroup: MG.LEGS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'goblet-squat', name: { en: 'Goblet squat', vi: 'Squat ôm tạ' }, muscleGroup: MG.LEGS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  // Shoulders
  { slug: 'ohp-barbell', name: { en: 'Overhead press', vi: 'Đẩy vai tạ đòn' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'ohp-db', name: { en: 'Dumbbell shoulder press', vi: 'Đẩy vai tạ đơn' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'lateral-raise', name: { en: 'Lateral raise', vi: 'Nâng tạ ngang vai' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'front-raise', name: { en: 'Front raise', vi: 'Nâng tạ trước vai' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'rear-delt-fly', name: { en: 'Rear delt fly', vi: 'Ép vai sau' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'upright-row', name: { en: 'Upright row', vi: 'Chèo đứng' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'shrug-db', name: { en: 'Dumbbell shrug', vi: 'Nhún vai tạ đơn' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  // Arms
  { slug: 'curl-barbell', name: { en: 'Barbell curl', vi: 'Cuốn tạ đòn' }, muscleGroup: MG.ARMS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'curl-db', name: { en: 'Dumbbell curl', vi: 'Cuốn tạ đơn' }, muscleGroup: MG.ARMS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'curl-hammer', name: { en: 'Hammer curl', vi: 'Cuốn tạ búa' }, muscleGroup: MG.ARMS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'curl-preacher', name: { en: 'Preacher curl', vi: 'Cuốn tạ ghế dốc' }, muscleGroup: MG.ARMS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'tricep-pushdown', name: { en: 'Tricep pushdown', vi: 'Đẩy cáp tay sau' }, muscleGroup: MG.ARMS, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'tricep-overhead', name: { en: 'Overhead tricep extension', vi: 'Duỗi tay sau qua đầu' }, muscleGroup: MG.ARMS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'skull-crusher', name: { en: 'Skull crusher', vi: 'Đập trán' }, muscleGroup: MG.ARMS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'dip-tricep', name: { en: 'Tricep dip', vi: 'Xà nhúng tay sau' }, muscleGroup: MG.ARMS, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  // Core
  { slug: 'plank', name: { en: 'Plank', vi: 'Plank' }, muscleGroup: MG.CORE, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'crunch-cable', name: { en: 'Cable crunch', vi: 'Gập bụng cáp' }, muscleGroup: MG.CORE, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'ab-wheel', name: { en: 'Ab wheel rollout', vi: 'Con lăn bụng' }, muscleGroup: MG.CORE, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'hanging-leg-raise', name: { en: 'Hanging leg raise', vi: 'Nâng chân treo xà' }, muscleGroup: MG.CORE, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'russian-twist', name: { en: 'Russian twist', vi: 'Xoay bụng Nga' }, muscleGroup: MG.CORE, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  // Cardio
  { slug: 'treadmill', name: { en: 'Treadmill run', vi: 'Chạy máy' }, muscleGroup: MG.CARDIO, equipmentType: EQ.MACHINE, defaultIncrement: 0 },
  { slug: 'rowing-erg', name: { en: 'Rowing machine', vi: 'Máy chèo' }, muscleGroup: MG.CARDIO, equipmentType: EQ.MACHINE, defaultIncrement: 0 },
];

export async function seedPresets(): Promise<number> {
  for (const p of PRESET_EXERCISES) {
    await upsertPreset(p);
  }
  return PRESET_EXERCISES.length;
}
