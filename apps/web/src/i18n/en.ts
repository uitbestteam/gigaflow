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
    presetPush: string;
    presetPull: string;
    presetLegs: string;
    startSession: string;
  };
  session: {
    title: string;
    restTimerTitle: string;
    restTimerSkip: string;
    rirLabel: string;
    finish: string;
    cancel: string;
    logSet: string;
  };
  summary: {
    title: string;
    duration: string;
    totalVolume: string;
    newPr: string;
    backHome: string;
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
    presetPush: 'Push',
    presetPull: 'Pull',
    presetLegs: 'Legs',
    startSession: 'Start session',
  },
  session: {
    title: 'Active session',
    restTimerTitle: 'Rest',
    restTimerSkip: 'Skip rest',
    rirLabel: 'RIR (reps in reserve)',
    finish: 'Finish session',
    cancel: 'Cancel session',
    logSet: 'Log set',
  },
  summary: {
    title: 'Session summary',
    duration: 'Duration',
    totalVolume: 'Total volume',
    newPr: 'New PR',
    backHome: 'Back to home',
  },
};

export default en;
