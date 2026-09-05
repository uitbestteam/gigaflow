import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  AuthProvider,
  AuthSource,
  ExperienceLevel,
  Goal,
  Language,
  type User,
} from '@gigaflow/shared';
import { HomePage } from '../home/HomePage';
import { useAuthStore } from '../../store/authStore';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  getActivePlan: vi.fn(),
  getLastSession: vi.fn().mockResolvedValue(null),
  createPlanFromTemplate: vi.fn(),
  startSession: vi.fn(),
  saveProfile: vi.fn(),
  postAuthSession: vi.fn(),
}));

const baseUser: User = {
  authId: 'uid_1',
  authSource: AuthSource.FIREBASE,
  authProvider: AuthProvider.ANONYMOUS,
  isGuest: true,
  timezone: 'Asia/Ho_Chi_Minh',
  language: Language.EN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage onboarding gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    useAuthStore.setState({ user: undefined });
  });

  it('shows the onboarding flow for a signed-in user without onboardedAt', async () => {
    (api.getActivePlan as unknown as Mock).mockResolvedValue(null);
    useAuthStore.setState({ user: { ...baseUser, onboardedAt: undefined } });

    renderHome();

    // Welcome step of the wizard.
    expect(await screen.findByText('Welcome to GigaFlow')).toBeInTheDocument();
    // The normal empty-state home CTA must NOT render.
    expect(screen.queryByText('Start your first plan')).not.toBeInTheDocument();
  });

  it('shows the normal home once the user has onboardedAt', async () => {
    (api.getActivePlan as unknown as Mock).mockResolvedValue(null);
    useAuthStore.setState({
      user: {
        ...baseUser,
        onboardedAt: new Date(),
        profile: { goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 3 },
      },
    });

    renderHome();

    // Falls through to the normal (empty-plan) home surface with preset picker.
    expect(await screen.findByRole('button', { name: /push.*pull.*legs|ppl/i })).toBeInTheDocument();
    expect(screen.queryByText('Welcome to GigaFlow')).not.toBeInTheDocument();
  });
});
