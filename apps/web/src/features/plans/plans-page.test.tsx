import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { PlanSource, PlanTemplateType } from '@gigaflow/shared';
import type { Plan } from '@gigaflow/shared';
import { PlansPage } from './PlansPage';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  getPlans: vi.fn(),
  activatePlan: vi.fn(),
  deletePlan: vi.fn(),
  createPlanFromTemplate: vi.fn(),
}));

function renderPlans() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlansPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    userId: 'u1',
    name: 'PPL',
    templateType: PlanTemplateType.PPL,
    source: PlanSource.CUSTOM,
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('PlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getPlans as unknown as Mock).mockResolvedValue([]);
    (api.activatePlan as unknown as Mock).mockResolvedValue({});
    (api.deletePlan as unknown as Mock).mockResolvedValue({ deleted: true });
    (api.createPlanFromTemplate as unknown as Mock).mockResolvedValue({});
  });

  it('renders a row per plan and an Active badge only on the active one', async () => {
    (api.getPlans as unknown as Mock).mockResolvedValue([
      makePlan({ id: 'plan-1', name: 'PPL Plan', isActive: false }),
      makePlan({ id: 'plan-2', name: 'Upper Lower Plan', templateType: PlanTemplateType.UPPER_LOWER, isActive: true }),
    ]);

    renderPlans();

    expect(await screen.findByText('PPL Plan')).toBeInTheDocument();
    expect(screen.getByText('Upper Lower Plan')).toBeInTheDocument();
    expect(screen.getAllByText(/active/i)).toHaveLength(1);
  });

  it('calls activatePlan(id) when Activate is clicked on an inactive row', async () => {
    const user = userEvent.setup();
    (api.getPlans as unknown as Mock).mockResolvedValue([makePlan({ id: 'plan-1', isActive: false })]);

    renderPlans();

    const activateButton = await screen.findByRole('button', { name: /activate/i });
    await user.click(activateButton);

    await waitFor(() => {
      expect(api.activatePlan).toHaveBeenCalledWith('plan-1');
    });
  });

  it('calls deletePlan(id) only after the two-step confirm', async () => {
    const user = userEvent.setup();
    (api.getPlans as unknown as Mock).mockResolvedValue([makePlan({ id: 'plan-1' })]);

    renderPlans();

    const deleteButton = await screen.findByRole('button', { name: /^delete$/i });
    expect(api.deletePlan).not.toHaveBeenCalled();

    await user.click(deleteButton);
    const confirmButton = await screen.findByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(api.deletePlan).toHaveBeenCalledWith('plan-1');
    });
  });

  it('calls createPlanFromTemplate(type) when a preset button is clicked', async () => {
    const user = userEvent.setup();
    (api.getPlans as unknown as Mock).mockResolvedValue([]);

    renderPlans();

    const pplButton = await screen.findByRole('button', { name: /push.*pull.*legs/i });
    await user.click(pplButton);

    await waitFor(() => {
      expect(api.createPlanFromTemplate).toHaveBeenCalledWith(PlanTemplateType.PPL);
    });
  });

  it('shows an empty state with New plan and preset actions when there are no plans', async () => {
    (api.getPlans as unknown as Mock).mockResolvedValue([]);

    renderPlans();

    await waitFor(() => {
      expect(api.getPlans).toHaveBeenCalled();
    });

    expect(await screen.findByRole('button', { name: /new plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /push.*pull.*legs/i })).toBeInTheDocument();
  });
});
