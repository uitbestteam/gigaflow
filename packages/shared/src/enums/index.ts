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

export enum Goal {
  STRENGTH = 'strength',
  HYPERTROPHY = 'hypertrophy',
  GENERAL_FITNESS = 'general_fitness',
  WEIGHT_LOSS = 'weight_loss',
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum JobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

export enum AiProviderName {
  GEMINI = 'gemini',
  OPENAI = 'openai',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum ActivityLevel {
  SEDENTARY = 'sedentary',
  LIGHT = 'light',
  MODERATE = 'moderate',
  ACTIVE = 'active',
  VERY_ACTIVE = 'very_active',
}

export enum MealType {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACK = 'snack',
}
