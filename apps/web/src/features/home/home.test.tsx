import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { ColorTag, PlanSource, PlanTemplateType } from '@gigaflow/shared';
import type { PlanWithTemplates } from '@gigaflow/shared';
import { HomePage } from './HomePage';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  getActivePlan: vi.fn(),
  getLastSession: vi.fn(),
  createPlanFromTemplate: vi.fn(),
  startSession: vi.fn(),
  // HomePage now imports authStore (for the onboarding gate), which statically
  // imports these from the api module — the mock must provide them.
  postAuthSession: vi.fn(),
  saveProfile: vi.fn(),
}));

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makePlan(): PlanWithTemplates {
  return {
    id: 'plan-1',
    userId: 'user-1',
    name: 'My Plan',
    templateType: PlanTemplateType.PPL,
    source: PlanSource.AI,
    isActive: true,
    createdAt: new Date(),
    templates: [
      {
        id: 'tpl-1',
        planId: 'plan-1',
        name: { en: 'Push Day', vi: 'Ngày đẩy' },
        orderIndex: 0,
        colorTag: ColorTag.PUSH,
        slots: [],
      },
      {
        id: 'tpl-2',
        planId: 'plan-1',
        name: { en: 'Pull Day', vi: 'Ngày kéo' },
        orderIndex: 1,
        colorTag: ColorTag.PULL,
        slots: [],
      },
    ],
  };
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getLastSession as unknown as Mock).mockResolvedValue(null);
  });

  it('renders the active plan templates, suggesting the first and starting it', async () => {
    (api.getActivePlan as unknown as Mock).mockResolvedValue(makePlan());

    renderHome();

    expect(await screen.findByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText('Pull Day')).toBeInTheDocument();
    // No history → the first day is the suggested hero with the "Start session" CTA.
    expect(screen.getAllByRole('button', { name: /start/i })).toHaveLength(1);
  });

  it('lets the user start ANY day, not just the suggested one', async () => {
    (api.getActivePlan as unknown as Mock).mockResolvedValue(makePlan());
    (api.startSession as unknown as Mock).mockResolvedValue({
      session: { id: 's-9', templateId: 'tpl-2' },
      slots: [],
    });

    renderHome();

    // Tap the non-suggested day (Pull) — its whole row is a start button.
    const pullButton = await screen.findByRole('button', { name: /pull day/i });
    await userEvent.click(pullButton);

    await waitFor(() => {
      expect(api.startSession).toHaveBeenCalledWith('tpl-2');
    });
  });

  it('suggests the day after the last completed session (rotation)', async () => {
    (api.getActivePlan as unknown as Mock).mockResolvedValue(makePlan());
    // Last completed was Push (tpl-1) → Pull (tpl-2) becomes the suggested hero.
    (api.getLastSession as unknown as Mock).mockResolvedValue({ templateId: 'tpl-1' });

    renderHome();

    // The suggested hero shows the big "Start session" CTA; assert Pull is the hero
    // by checking the start CTA is present and Push is now a compact row button.
    expect(await screen.findByRole('button', { name: /start session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /push day/i })).toBeInTheDocument();
  });

  it('renders the 3 preset options when there is no active plan', async () => {
    (api.getActivePlan as unknown as Mock).mockResolvedValue(null);

    renderHome();

    expect(await screen.findByRole('button', { name: /push.*pull.*legs|ppl/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upper.*lower/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full.*body/i })).toBeInTheDocument();
  });

  it('calls createPlanFromTemplate when a preset is clicked', async () => {
    (api.getActivePlan as unknown as Mock).mockResolvedValue(null);
    (api.createPlanFromTemplate as unknown as Mock).mockResolvedValue(makePlan());

    renderHome();

    const pplButton = await screen.findByRole('button', { name: /push.*pull.*legs|ppl/i });
    await userEvent.click(pplButton);

    await waitFor(() => {
      expect(api.createPlanFromTemplate).toHaveBeenCalledWith(PlanTemplateType.PPL);
    });
  });
});
