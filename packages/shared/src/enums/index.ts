export enum Language {
  EN = 'en',
  VI = 'vi',
}

export enum AuthSource {
  FIREBASE = 'firebase',
}

export enum AuthProvider {
  ANONYMOUS = 'anonymous',
  PASSWORD = 'password',
  GOOGLE = 'google',
}

export enum MuscleGroup {
  CHEST = 'chest',
  BACK = 'back',
  LEGS = 'legs',
  SHOULDERS = 'shoulders',
  ARMS = 'arms',
  CORE = 'core',
  CARDIO = 'cardio',
}

export enum EquipmentType {
  BARBELL = 'barbell',
  DUMBBELL = 'dumbbell',
  MACHINE = 'machine',
  BODYWEIGHT = 'bodyweight',
  CABLE = 'cable',
}

export enum PlanSource {
  AI = 'ai',
  CUSTOM = 'custom',
}

export enum PlanTemplateType {
  PPL = 'ppl',
  UPPER_LOWER = 'upper_lower',
  FULL_BODY = 'full_body',
  CUSTOM = 'custom',
}

export enum ColorTag {
  PUSH = 'push',
  PULL = 'pull',
  LEGS = 'legs',
  UPPER = 'upper',
  LOWER = 'lower',
  FULL = 'full',
  CUSTOM = 'custom',
}

export enum SessionStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SubscriptionPlan {
  FREE = 'free',
}

export enum GenerationType {
  WORKOUT = 'workout',
  MEAL = 'meal',
  INBODY = 'inbody',
}
