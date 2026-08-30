import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { ColorTag, EquipmentType, MuscleGroup, PlanSource, PlanTemplateType } from '@gigaflow/shared';
import type { Exercise, PlanWithTemplates } from '@gigaflow/shared';
import { PlanBuilderPage } from './PlanBuilderPage';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  getExercises: vi.fn(),
  getPlan: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
}));

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex1',
    slug: 'bench-press',
    name: { en: 'Bench Press', vi: 'Đẩy ngực' },
    muscleGroup: MuscleGroup.CHEST,
    equipmentType: EquipmentType.BARBELL,
    defaultIncrement: 2.5,
    isCustom: false,
    ...overrides,
  };
}

function makePlan(overrides: Partial<PlanWithTemplates> = {}): PlanWithTemplates {
  return {
    id: 'p1',
    userId: 'u1',
    name: 'PPL',
    templateType: PlanTemplateType.PPL,
    source: PlanSource.CUSTOM,
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    templates: [
      {
        id: 't1',
        planId: 'p1',
        name: { en: 'Push Day', vi: 'Ngày đẩy' },
        orderIndex: 0,
        colorTag: ColorTag.PUSH,
        slots: [
          {
            id: 's1',
            templateId: 't1',
            exerciseId: 'ex1',
            orderIndex: 0,
            setsTarget: 3,
            repRangeMin: 8,
            repRangeMax: 12,
            equipmentType: EquipmentType.BARBELL,
            weightIncrement: 2.5,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/plans/new" element={<PlanBuilderPage />} />
          <Route path="/plans/:id/edit" element={<PlanBuilderPage />} />
          <Route path="/plans" element={<div>Plans Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlanBuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (api.getExercises as unknown as Mock).mockResolvedValue([makeExercise()]);
    (api.getPlan as unknown as Mock).mockImplementation(() => Promise.resolve(makePlan()));
    (api.createPlan as unknown as Mock).mockResolvedValue(makePlan());
    (api.updatePlan as unknown as Mock).mockResolvedValue(makePlan());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('new plan: pick an exercise, edit sets, save -> createPlan with the picked exercise + edited sets, then navigate to /plans', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderAt('/plans/new');

    const addExerciseButton = await screen.findByRole('button', { name: /add exercise/i });
    await user.click(addExerciseButton);

    const pickItem = await screen.findByText('Bench Press');
    await user.click(pickItem);

    const setsInput = await screen.findByLabelText(/sets/i);
    await user.clear(setsInput);
    await user.type(setsInput, '4');

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(api.createPlan).toHaveBeenCalledTimes(1);
    });

    const call = (api.createPlan as unknown as Mock).mock.calls[0];
    if (!call) throw new Error('createPlan was not called');
    const input = call[0] as { templates: { slots: { exerciseId: string; setsTarget: number }[] }[] };
    expect(input.templates[0]?.slots[0]?.exerciseId).toBe('ex1');
    expect(input.templates[0]?.slots[0]?.setsTarget).toBe(4);

    expect(await screen.findByText('Plans Page')).toBeInTheDocument();
  });

  it('edit plan: renders the existing slot and save -> updatePlan(id, input) with the graph', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderAt('/plans/p1/edit');

    await waitFor(() => {
      expect(api.getPlan).toHaveBeenCalledWith('p1');
    });

    expect(await screen.findByText('Bench Press')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(api.updatePlan).toHaveBeenCalledTimes(1);
    });

    const call = (api.updatePlan as unknown as Mock).mock.calls[0];
    if (!call) throw new Error('updatePlan was not called');
    const [id, input] = call as [string, { templates: { slots: { exerciseId: string }[] }[] }];
    expect(id).toBe('p1');
    expect(input.templates[0]?.slots[0]?.exerciseId).toBe('ex1');

    expect(await screen.findByText('Plans Page')).toBeInTheDocument();
  });

  it('does not clobber an unsaved edit when the plan query refetches with the same server data', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/plans/p1/edit']}>
          <Routes>
            <Route path="/plans/:id/edit" element={<PlanBuilderPage />} />
            <Route path="/plans" element={<div>Plans Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(api.getPlan).toHaveBeenCalledTimes(1);
    });

    const setsInput = await screen.findByLabelText(/sets/i);
    await user.clear(setsInput);
    await user.type(setsInput, '7');
    expect(setsInput).toHaveValue(7);

    // Simulate a background refetch (window refocus, an invalidation fired
    // from elsewhere in the app, etc.). `getPlan` is mocked to return a
    // freshly-constructed object each call (same field values, new
    // reference), so `planQuery.data` genuinely changes identity here --
    // without the once-guard, the page's effect (keyed on `planQuery.data`)
    // would re-run and reset the store. Forcing the refetch also bypasses
    // `staleTime`, so this proves the once-guard itself, not staleTime.
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['plan', 'p1'] });
    });

    await waitFor(() => {
      expect(api.getPlan).toHaveBeenCalledTimes(2);
    });

    // The store must still hold the user's edit -- a naive effect that
    // re-runs `init(plan)` on every `planQuery.data` change would have
    // reset this back to the server's `setsTarget: 3`.
    expect(screen.getByLabelText(/sets/i)).toHaveValue(7);
  });

  it('clamps an emptied sets field to 1 on blur, so save never submits an invalid 0', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderAt('/plans/new');

    const addExerciseButton = await screen.findByRole('button', { name: /add exercise/i });
    await user.click(addExerciseButton);

    const pickItem = await screen.findByText('Bench Press');
    await user.click(pickItem);

    const setsInput = await screen.findByLabelText(/sets/i);
    await user.clear(setsInput);
    expect(setsInput).toHaveValue(null);

    // Clicking Save blurs the still-empty sets field before the mutation
    // fires; the blur-clamp must coerce it to the schema minimum (1), never
    // to 0.
    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(api.createPlan).toHaveBeenCalledTimes(1);
    });

    const call = (api.createPlan as unknown as Mock).mock.calls[0];
    if (!call) throw new Error('createPlan was not called');
    const input = call[0] as { templates: { slots: { setsTarget: number }[] }[] };
    expect(input.templates[0]?.slots[0]?.setsTarget).toBe(1);
  });
});
