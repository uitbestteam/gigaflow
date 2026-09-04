/**
 * English catalog. Namespace: `translation` (i18next default). Keys are
 * grouped by feature area — `common`, `auth`, `home`, `session`, `summary` —
 * so later F1 tasks (8–10) can add copy under the matching group without
 * touching this file's structure.
 */
export interface TranslationSchema {
  common: {
    appName: string;
    account: string;
    retry: string;
    cancel: string;
    save: string;
    loading: string;
  };
  nav: {
    home: string;
    plans: string;
    generate: string;
    meal: string;
    stats: string;
  };
  wizard: {
    back: string;
    next: string;
    finish: string;
    stepOf: string;
    optional: string;
  };
  auth: {
    splashLabel: string;
    errorTitle: string;
    errorBody: string;
    retry: string;
    upgradeTitle: string;
    upgradeBody: string;
    continueWithGoogle: string;
    emailLabel: string;
    passwordLabel: string;
    upgradeWithEmail: string;
  };
  home: {
    title: string;
    queueTitle: string;
    queueEmpty: string;
    emptyStateTitle: string;
    emptyStateBody: string;
    presetPpl: string;
    presetUpperLower: string;
    presetFullBody: string;
    startSession: string;
    loadError: string;
  };
  session: {
    title: string;
    restTimerTitle: string;
    restTimerSkip: string;
    rirLabel: string;
    finish: string;
    cancel: string;
    logSet: string;
    prevSet: string;
    pause: string;
    resume: string;
    rirEasy: string;
    rirModerate: string;
    rirHard: string;
    editWeight: string;
    editReps: string;
  };
  summary: {
    title: string;
    doneTitle: string;
    duration: string;
    totalVolume: string;
    newPr: string;
    backHome: string;
    prBadge: string;
    setsAvg: string;
  };
  exercises: {
    title: string;
    searchPlaceholder: string;
    filterAll: string;
    empty: string;
    loadError: string;
    addCustom: string;
    muscle: {
      chest: string;
      back: string;
      legs: string;
      shoulders: string;
      arms: string;
      core: string;
      cardio: string;
    };
    equipment: {
      barbell: string;
      dumbbell: string;
      machine: string;
      bodyweight: string;
      cable: string;
    };
    form: {
      nameEnLabel: string;
      nameViLabel: string;
      muscleGroupLabel: string;
      equipmentTypeLabel: string;
      defaultIncrementLabel: string;
      submit: string;
      nameRequired: string;
    };
  };
  plans: {
    title: string;
    activeBadge: string;
    activate: string;
    edit: string;
    delete: string;
    confirmDelete: string;
    newPlan: string;
    fromPreset: string;
    empty: string;
    loadError: string;
    templateType: {
      ppl: string;
      upper_lower: string;
      full_body: string;
      custom: string;
    };
  };
  builder: {
    planNamePlaceholder: string;
    templateNamePlaceholder: string;
    addDay: string;
    removeDay: string;
    moveUp: string;
    moveDown: string;
    addExercise: string;
    pickExerciseTitle: string;
    removeExercise: string;
    sets: string;
    repMin: string;
    repMax: string;
    increment: string;
    equipment: string;
    colorLabel: string;
    loadError: string;
    saveError: string;
  };
  job: {
    submitting: string;
    polling: string;
    done: string;
  };
  inbody: {
    errBadType: string;
    errTooLarge: string;
    uploadLabel: string;
    uploadHint: string;
    previewAlt: string;
    navLabel: string;
    title: string;
    analyze: string;
    takenAt: string;
    noResult: string;
    metric: {
      weightKg: string;
      bmi: string;
      bodyFatPercent: string;
      skeletalMuscleMassKg: string;
      bodyFatMassKg: string;
      visceralFatLevel: string;
    };
    unit: {
      kg: string;
      percent: string;
    };
  };
  macro: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  stats: {
    trendChart: string;
    noData: string;
    navLabel: string;
    title: string;
    totalSessions: string;
    totalVolume: string;
    totalPrs: string;
    totalExercises: string;
    awardsTitle: string;
    awardsEmpty: string;
    earnedBadge: string;
    prsTitle: string;
    prsEmpty: string;
    e1rm: string;
    weightTitle: string;
    weightLabel: string;
    logWeightSubmit: string;
    loadError: string;
    streakTitle: string;
    streakUnit: string;
    streakBest: string;
    streakNone: string;
    volumeByMuscleTitle: string;
    prTimelineTitle: string;
  };
  onboarding: {
    welcomeTitle: string;
    welcomeBody: string;
    welcomeCta: string;
    profileTitle: string;
    profileSubtitle: string;
    startTitle: string;
    startSubtitle: string;
    startAi: string;
    startAiDesc: string;
    startPreset: string;
    startPresetDesc: string;
    startBuild: string;
    startBuildDesc: string;
    skip: string;
  };
  ai: {
    navLabel: string;
    title: string;
    heroSubtitle: string;
    goalLabel: string;
    experienceLabel: string;
    daysLabel: string;
    submit: string;
    exercisesCount: string;
    editInBuilder: string;
    backToPlans: string;
    stepGoalTitle: string;
    stepGoalSubtitle: string;
    stepScheduleTitle: string;
    stepScheduleSubtitle: string;
    stepEquipmentTitle: string;
    stepEquipmentSubtitle: string;
    stepInjuriesTitle: string;
    stepInjuriesSubtitle: string;
    stepEmphasisTitle: string;
    stepEmphasisSubtitle: string;
    sessionLabel: string;
    minShort: string;
    equipmentPresetLabel: string;
    equipmentCustomLabel: string;
    injuriesLabel: string;
    emphasisLabel: string;
    none: string;
    equipmentPreset: {
      full_gym: string;
      full_gym_desc: string;
      home: string;
      home_desc: string;
      bodyweight: string;
      bodyweight_desc: string;
      custom: string;
      custom_desc: string;
    };
    injury: {
      knee: string;
      lower_back: string;
      shoulder: string;
      elbow_wrist: string;
      hip: string;
      neck: string;
    };
    goal: {
      strength: string;
      hypertrophy: string;
      general_fitness: string;
      weight_loss: string;
    };
    experience: {
      beginner: string;
      intermediate: string;
      advanced: string;
    };
  };
  meal: {
    navLabel: string;
    title: string;
    heroSubtitle: string;
    goalLabel: string;
    genderLabel: string;
    ageLabel: string;
    heightLabel: string;
    weightLabel: string;
    activityLabel: string;
    submit: string;
    dayLabel: string;
    proteinShort: string;
    carbsShort: string;
    fatShort: string;
    stepGoalTitle: string;
    stepGoalSubtitle: string;
    stepBodyTitle: string;
    stepBodySubtitle: string;
    stepCuisineTitle: string;
    stepCuisineSubtitle: string;
    stepDietTitle: string;
    stepDietSubtitle: string;
    stepPrefsTitle: string;
    stepPrefsSubtitle: string;
    cuisineRegionLabel: string;
    cuisineCountryLabel: string;
    anyCountry: string;
    dietaryPatternLabel: string;
    allergiesLabel: string;
    dislikesLabel: string;
    dislikesPlaceholder: string;
    mealsPerDayLabel: string;
    none: string;
    cuisineRegion: {
      east_asian: string;
      southeast_asian: string;
      south_asian: string;
      western: string;
      mediterranean: string;
      latin_american: string;
      middle_eastern: string;
    };
    country: {
      vietnam: string;
      thailand: string;
      japan: string;
      korea: string;
      china: string;
      india: string;
      indonesia: string;
      usa: string;
      uk: string;
      italy: string;
      france: string;
      spain: string;
      greece: string;
      mexico: string;
      brazil: string;
      turkey: string;
    };
    dietaryPattern: {
      omnivore: string;
      vegetarian: string;
      vegan: string;
      pescatarian: string;
      halal: string;
      keto: string;
      low_carb: string;
    };
    allergen: {
      peanuts: string;
      tree_nuts: string;
      shellfish: string;
      fish: string;
      eggs: string;
      dairy: string;
      gluten: string;
      soy: string;
      sesame: string;
    };
    goal: {
      strength: string;
      hypertrophy: string;
      general_fitness: string;
      weight_loss: string;
    };
    gender: {
      male: string;
      female: string;
    };
    activity: {
      sedentary: string;
      light: string;
      moderate: string;
      active: string;
      very_active: string;
    };
    mealType: {
      breakfast: string;
      lunch: string;
      dinner: string;
      snack: string;
    };
  };
  notif: {
    title: string;
    description: string;
    enable: string;
    disable: string;
    deniedHint: string;
    error: string;
  };
  account: {
    title: string;
    subtitle: string;
    moreTitle: string;
    exercisesNav: string;
    inbodyNav: string;
    languageLabel: string;
    guestName: string;
    guestBadge: string;
    signOut: string;
  };
}

const en: TranslationSchema = {
  common: {
    appName: 'GigaFlow',
    account: 'Account',
    retry: 'Retry',
    cancel: 'Cancel',
    save: 'Save',
    loading: 'Loading…',
  },
  nav: {
    home: 'Train',
    plans: 'Plans',
    generate: 'AI',
    meal: 'Meal',
    stats: 'Stats',
  },
  wizard: {
    back: 'Back',
    next: 'Next',
    finish: 'Generate',
    stepOf: 'Step {{current}} of {{total}}',
    optional: 'Optional',
  },
  auth: {
    splashLabel: 'Signing you in…',
    errorTitle: 'Something went wrong',
    errorBody: 'We could not sign you in.',
    retry: 'Retry',
    upgradeTitle: 'Save your progress',
    upgradeBody: 'Link an account so your training history is never lost.',
    continueWithGoogle: 'Continue with Google',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    upgradeWithEmail: 'Create account',
  },
  home: {
    title: 'Home',
    queueTitle: 'Up next',
    queueEmpty: 'No sessions queued yet.',
    emptyStateTitle: 'Start your first plan',
    emptyStateBody: 'Pick a preset to get going in seconds.',
    presetPpl: 'Push / Pull / Legs',
    presetUpperLower: 'Upper / Lower',
    presetFullBody: 'Full body',
    startSession: 'Start session',
    loadError: 'Could not load your plan.',
  },
  session: {
    title: 'Active session',
    restTimerTitle: 'Rest',
    restTimerSkip: 'Skip rest',
    rirLabel: 'RIR (reps in reserve)',
    finish: 'Finish session',
    cancel: 'Cancel session',
    logSet: 'Log set',
    prevSet: 'prev: {{weight}} × {{reps}}',
    pause: 'Pause',
    resume: 'Resume',
    rirEasy: 'Easy (3 RIR)',
    rirModerate: 'Moderate (1 RIR)',
    rirHard: 'Hard (0 RIR)',
    editWeight: 'Weight (kg)',
    editReps: 'Reps',
  },
  summary: {
    title: 'Session summary',
    doneTitle: 'Session #{{n}} complete',
    duration: 'Duration',
    totalVolume: 'Total volume',
    newPr: 'New PR',
    backHome: 'Back to home',
    prBadge: 'PR',
    setsAvg: '{{count}} sets · avg {{avg}}kg',
  },
  exercises: {
    title: 'Exercise library',
    searchPlaceholder: 'Search exercises',
    filterAll: 'All',
    empty: 'No exercises found.',
    loadError: 'Could not load exercises.',
    addCustom: '＋ Custom',
    muscle: {
      chest: 'Chest',
      back: 'Back',
      legs: 'Legs',
      shoulders: 'Shoulders',
      arms: 'Arms',
      core: 'Core',
      cardio: 'Cardio',
    },
    equipment: {
      barbell: 'Barbell',
      dumbbell: 'Dumbbell',
      machine: 'Machine',
      bodyweight: 'Bodyweight',
      cable: 'Cable',
    },
    form: {
      nameEnLabel: 'Name (English)',
      nameViLabel: 'Name (Vietnamese)',
      muscleGroupLabel: 'Muscle group',
      equipmentTypeLabel: 'Equipment type',
      defaultIncrementLabel: 'Default increment (kg)',
      submit: 'Add exercise',
      nameRequired: 'Both names are required.',
    },
  },
  plans: {
    title: 'Plans',
    activeBadge: 'Active',
    activate: 'Activate',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Confirm?',
    newPlan: 'New plan',
    fromPreset: 'From preset',
    empty: 'No plans yet. Create one to get started.',
    loadError: 'Could not load your plans.',
    templateType: {
      ppl: 'Push / Pull / Legs',
      upper_lower: 'Upper / Lower',
      full_body: 'Full body',
      custom: 'Custom',
    },
  },
  builder: {
    planNamePlaceholder: 'Plan name',
    templateNamePlaceholder: 'Day name',
    addDay: '＋ Add day',
    removeDay: 'Remove day',
    moveUp: 'Move up',
    moveDown: 'Move down',
    addExercise: '＋ Add exercise',
    pickExerciseTitle: 'Pick an exercise',
    removeExercise: 'Remove',
    sets: 'Sets',
    repMin: 'Rep min',
    repMax: 'Rep max',
    increment: 'Increment (kg)',
    equipment: 'Equipment',
    colorLabel: 'Color',
    loadError: 'Could not load this plan.',
    saveError: 'Could not save this plan. Please check your entries and try again.',
  },
  job: {
    submitting: 'Submitting…',
    polling: 'Processing…',
    done: 'Done',
  },
  inbody: {
    errBadType: 'Please choose a JPEG or PNG image.',
    errTooLarge: 'This image is too large. Please choose a smaller one.',
    uploadLabel: 'Upload image',
    uploadHint: 'Upload a clear photo of your InBody scan.',
    previewAlt: 'Selected image preview',
    navLabel: 'InBody',
    title: 'InBody capture',
    analyze: 'Analyze',
    takenAt: 'Taken on {{date}}',
    noResult: 'No InBody result yet. Upload a scan photo to get started.',
    metric: {
      weightKg: 'Weight',
      bmi: 'BMI',
      bodyFatPercent: 'Body fat',
      skeletalMuscleMassKg: 'Skeletal muscle mass',
      bodyFatMassKg: 'Body fat mass',
      visceralFatLevel: 'Visceral fat level',
    },
    unit: {
      kg: 'kg',
      percent: '%',
    },
  },
  macro: {
    calories: 'Cal',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
  },
  stats: {
    trendChart: 'Trend chart',
    noData: 'No data yet',
    navLabel: 'Stats',
    title: 'Stats',
    totalSessions: 'Sessions',
    totalVolume: 'Total volume',
    totalPrs: 'Personal records',
    totalExercises: 'Exercises trained',
    awardsTitle: 'Awards',
    awardsEmpty: 'No awards yet',
    earnedBadge: 'Earned',
    prsTitle: 'Personal records',
    prsEmpty: 'No personal records yet',
    e1rm: 'e1RM',
    weightTitle: 'Bodyweight',
    weightLabel: 'Weight (kg)',
    logWeightSubmit: 'Log weight',
    loadError: 'Could not load this. Please try again.',
    streakTitle: 'Streak',
    streakUnit: '{{count}}-week streak',
    streakBest: 'Best: {{count}} weeks',
    streakNone: 'Train this week to start a streak',
    volumeByMuscleTitle: 'Volume by muscle group',
    prTimelineTitle: 'PR timeline',
  },
  onboarding: {
    welcomeTitle: 'Welcome to GigaFlow',
    welcomeBody: 'Answer a few quick questions and we’ll set up your training in seconds.',
    welcomeCta: 'Get started',
    profileTitle: 'About your training',
    profileSubtitle: 'This tailors your plans and AI suggestions.',
    startTitle: 'How do you want to start?',
    startSubtitle: 'You can change everything later.',
    startAi: 'Let AI build my plan',
    startAiDesc: 'A personalized weekly plan from your profile.',
    startPreset: 'Pick a preset',
    startPresetDesc: 'Push/Pull/Legs, Upper/Lower or Full body.',
    startBuild: 'Build my own',
    startBuildDesc: 'Create a plan from scratch.',
    skip: 'Skip for now',
  },
  ai: {
    navLabel: 'AI generate',
    title: 'Generate a workout plan',
    heroSubtitle: 'Answer a few questions and let AI build your week.',
    goalLabel: 'Goal',
    experienceLabel: 'Experience level',
    daysLabel: 'Days per week',
    submit: 'Generate plan',
    exercisesCount: 'exercises',
    editInBuilder: 'Edit in builder',
    backToPlans: 'Back to plans',
    stepGoalTitle: 'Your goal',
    stepGoalSubtitle: 'What do you want to get out of training?',
    stepScheduleTitle: 'Your schedule',
    stepScheduleSubtitle: 'How often and how long can you train?',
    stepEquipmentTitle: 'Your equipment',
    stepEquipmentSubtitle: 'What do you have access to?',
    stepInjuriesTitle: 'Injuries to protect',
    stepInjuriesSubtitle: 'We will avoid loading these areas.',
    stepEmphasisTitle: 'Muscles to emphasize',
    stepEmphasisSubtitle: 'Pick any areas you want extra volume on.',
    sessionLabel: 'Session length',
    minShort: 'min',
    equipmentPresetLabel: 'Equipment',
    equipmentCustomLabel: 'Pick your equipment',
    injuriesLabel: 'Areas to protect',
    emphasisLabel: 'Emphasis',
    none: 'None',
    equipmentPreset: {
      full_gym: 'Full gym',
      full_gym_desc: 'Barbells, machines, cables and more.',
      home: 'Home gym',
      home_desc: 'Dumbbells, cables and bodyweight.',
      bodyweight: 'Bodyweight only',
      bodyweight_desc: 'No equipment needed.',
      custom: 'Custom',
      custom_desc: 'Choose exactly what you have.',
    },
    injury: {
      knee: 'Knee',
      lower_back: 'Lower back',
      shoulder: 'Shoulder',
      elbow_wrist: 'Elbow / wrist',
      hip: 'Hip',
      neck: 'Neck',
    },
    goal: {
      strength: 'Strength',
      hypertrophy: 'Hypertrophy',
      general_fitness: 'General fitness',
      weight_loss: 'Weight loss',
    },
    experience: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    },
  },
  meal: {
    navLabel: 'Meal plan',
    title: 'Meal planner',
    heroSubtitle: 'Personalized macros, sized to your goal.',
    goalLabel: 'Goal',
    genderLabel: 'Gender',
    ageLabel: 'Age',
    heightLabel: 'Height (cm)',
    weightLabel: 'Weight (kg)',
    activityLabel: 'Activity level',
    submit: 'Generate meal plan',
    dayLabel: 'Day {{n}}',
    proteinShort: 'P',
    carbsShort: 'C',
    fatShort: 'F',
    stepGoalTitle: 'Your goal',
    stepGoalSubtitle: 'What are you eating toward?',
    stepBodyTitle: 'About you',
    stepBodySubtitle: 'We size your macros from these.',
    stepCuisineTitle: 'Cuisine',
    stepCuisineSubtitle: 'Which flavours should we cook in?',
    stepDietTitle: 'Diet & allergies',
    stepDietSubtitle: 'Anything the plan must respect?',
    stepPrefsTitle: 'Preferences',
    stepPrefsSubtitle: 'A few final touches.',
    cuisineRegionLabel: 'Region',
    cuisineCountryLabel: 'Country',
    anyCountry: 'Any country',
    dietaryPatternLabel: 'Eating pattern',
    allergiesLabel: 'Allergies',
    dislikesLabel: 'Foods to avoid',
    dislikesPlaceholder: 'e.g. cilantro, liver, blue cheese',
    mealsPerDayLabel: 'Meals per day',
    none: 'None',
    cuisineRegion: {
      east_asian: 'East Asian',
      southeast_asian: 'Southeast Asian',
      south_asian: 'South Asian',
      western: 'Western',
      mediterranean: 'Mediterranean',
      latin_american: 'Latin American',
      middle_eastern: 'Middle Eastern',
    },
    country: {
      vietnam: 'Vietnam',
      thailand: 'Thailand',
      japan: 'Japan',
      korea: 'Korea',
      china: 'China',
      india: 'India',
      indonesia: 'Indonesia',
      usa: 'USA',
      uk: 'UK',
      italy: 'Italy',
      france: 'France',
      spain: 'Spain',
      greece: 'Greece',
      mexico: 'Mexico',
      brazil: 'Brazil',
      turkey: 'Turkey',
    },
    dietaryPattern: {
      omnivore: 'Omnivore',
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      pescatarian: 'Pescatarian',
      halal: 'Halal',
      keto: 'Keto',
      low_carb: 'Low carb',
    },
    allergen: {
      peanuts: 'Peanuts',
      tree_nuts: 'Tree nuts',
      shellfish: 'Shellfish',
      fish: 'Fish',
      eggs: 'Eggs',
      dairy: 'Dairy',
      gluten: 'Gluten',
      soy: 'Soy',
      sesame: 'Sesame',
    },
    goal: {
      strength: 'Strength',
      hypertrophy: 'Hypertrophy',
      general_fitness: 'General fitness',
      weight_loss: 'Weight loss',
    },
    gender: {
      male: 'Male',
      female: 'Female',
    },
    activity: {
      sedentary: 'Sedentary',
      light: 'Light',
      moderate: 'Moderate',
      active: 'Active',
      very_active: 'Very active',
    },
    mealType: {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
    },
  },
  notif: {
    title: 'Reminders',
    description: 'Get a push notification when it is time to train.',
    enable: 'Enable reminders',
    disable: 'Disable reminders',
    deniedHint: 'Notifications are blocked. Please allow notifications in your browser settings to enable reminders.',
    error: 'Something went wrong. Please try again.',
  },
  account: {
    title: 'Account',
    subtitle: 'Manage your profile, data and preferences.',
    moreTitle: 'More',
    exercisesNav: 'Exercise library',
    inbodyNav: 'InBody',
    languageLabel: 'Language',
    guestName: 'Guest',
    guestBadge: 'Guest',
    signOut: 'Sign out',
  },
};

export default en;
