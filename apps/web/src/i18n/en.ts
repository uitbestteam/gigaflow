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
    presetPpl: string;
    presetUpperLower: string;
    presetFullBody: string;
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
  };
  ai: {
    navLabel: string;
    title: string;
    goalLabel: string;
    experienceLabel: string;
    daysLabel: string;
    submit: string;
    exercisesCount: string;
    editInBuilder: string;
    backToPlans: string;
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
    presetPpl: 'Push / Pull / Legs',
    presetUpperLower: 'Upper / Lower',
    presetFullBody: 'Full body',
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
  },
  ai: {
    navLabel: 'AI generate',
    title: 'Generate a workout plan',
    goalLabel: 'Goal',
    experienceLabel: 'Experience level',
    daysLabel: 'Days per week',
    submit: 'Generate plan',
    exercisesCount: 'exercises',
    editInBuilder: 'Edit in builder',
    backToPlans: 'Back to plans',
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
};

export default en;
