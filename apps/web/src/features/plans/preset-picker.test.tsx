import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, type Mock } from 'vitest';
import { PlanTemplateType } from '@gigaflow/shared';
import { PresetPicker } from './PresetPicker';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  createPlanFromTemplate: vi.fn(),
}));

function renderPicker(onCreated?: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PresetPicker onCreated={onCreated} />
    </QueryClientProvider>,
  );
}

describe('PresetPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the 3 preset buttons', () => {
    renderPicker();

    expect(screen.getByRole('button', { name: /push.*pull.*legs|ppl/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upper.*lower/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full.*body/i })).toBeInTheDocument();
  });

  it('calls createPlanFromTemplate with the matching type when a preset is clicked', async () => {
    const user = userEvent.setup();
    (api.createPlanFromTemplate as unknown as Mock).mockResolvedValue({});

    renderPicker();

    const pplButton = screen.getByRole('button', { name: /push.*pull.*legs|ppl/i });
    await user.click(pplButton);

    await waitFor(() => {
      expect(api.createPlanFromTemplate).toHaveBeenCalledWith(PlanTemplateType.PPL);
    });
  });

  it('calls onCreated after a successful create', async () => {
    const user = userEvent.setup();
    (api.createPlanFromTemplate as unknown as Mock).mockResolvedValue({});
    const onCreated = vi.fn();

    renderPicker(onCreated);

    const upperLowerButton = screen.getByRole('button', { name: /upper.*lower/i });
    await user.click(upperLowerButton);

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
  });
});
