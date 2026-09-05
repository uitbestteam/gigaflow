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
  });

  it('renders the active plan templates as a queue with Start on the first', async () => {
    (api.getActivePlan as unknown as Mock).mockResolvedValue(makePlan());

    renderHome();

    expect(await screen.findByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText('Pull Day')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /start/i })).toHaveLength(1);
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
