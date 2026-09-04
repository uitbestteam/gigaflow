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
  VERTEX = 'vertex',
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

export enum AwardKey {
  FIRST_WORKOUT = 'first_workout',
  CONSISTENT_10 = 'consistent_10',
  FIRST_PR = 'first_pr',
  TEN_EXERCISES = 'ten_exercises',
  VOLUME_50K = 'volume_50k',
}

export enum ImageMimeType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
}

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

/** Joint/area a user reports as injured — the AI avoids loading it. */
export enum InjuryArea {
  KNEE = 'knee',
  LOWER_BACK = 'lower_back',
  SHOULDER = 'shoulder',
  ELBOW_WRIST = 'elbow_wrist',
  HIP = 'hip',
  NECK = 'neck',
}

/** Coarse cuisine family for meal generation. */
export enum CuisineRegion {
  EAST_ASIAN = 'east_asian',
  SOUTHEAST_ASIAN = 'southeast_asian',
  SOUTH_ASIAN = 'south_asian',
  WESTERN = 'western',
  MEDITERRANEAN = 'mediterranean',
  LATIN_AMERICAN = 'latin_american',
  MIDDLE_EASTERN = 'middle_eastern',
}

/** Specific country whose cuisine to model meals on (optional, refines region). */
export enum Country {
  VIETNAM = 'vietnam',
  THAILAND = 'thailand',
  JAPAN = 'japan',
  KOREA = 'korea',
  CHINA = 'china',
  INDIA = 'india',
  INDONESIA = 'indonesia',
  USA = 'usa',
  UK = 'uk',
  ITALY = 'italy',
  FRANCE = 'france',
  SPAIN = 'spain',
  GREECE = 'greece',
  MEXICO = 'mexico',
  BRAZIL = 'brazil',
  TURKEY = 'turkey',
}

/** Overall eating pattern / restriction the meal plan must follow. */
export enum DietaryPattern {
  OMNIVORE = 'omnivore',
  VEGETARIAN = 'vegetarian',
  VEGAN = 'vegan',
  PESCATARIAN = 'pescatarian',
  HALAL = 'halal',
  KETO = 'keto',
  LOW_CARB = 'low_carb',
}

/** Common food allergens/intolerances to exclude entirely. */
export enum Allergen {
  PEANUTS = 'peanuts',
  TREE_NUTS = 'tree_nuts',
  SHELLFISH = 'shellfish',
  FISH = 'fish',
  EGGS = 'eggs',
  DAIRY = 'dairy',
  GLUTEN = 'gluten',
  SOY = 'soy',
  SESAME = 'sesame',
}
