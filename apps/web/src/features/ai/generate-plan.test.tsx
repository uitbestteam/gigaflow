import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import {
  ColorTag,
  EquipmentType,
  ExperienceLevel,
  GenerationType,
  Goal,
  JobStatus,
  PlanSource,
  PlanTemplateType,
} from '@gigaflow/shared';
import type { GenerationJob, PlanWithTemplates } from '@gigaflow/shared';
import { GeneratePlanPage } from './GeneratePlanPage';

vi.mock('../../lib/api', () => ({
  generateWorkout: vi.fn(),
  getGenerationJob: vi.fn(),
  getPlan: vi.fn(),
}));

import * as api from '../../lib/api';

function EditCapture() {
  const { id } = useParams<{ id: string }>();
  return <div>edit-route:{id}</div>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/generate']}>
        <Routes>
          <Route path="/generate" element={<GeneratePlanPage />} />
          <Route path="/plans/:id/edit" element={<EditCapture />} />
          <Route path="/plans" element={<div>plans-route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeJob(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: 'job-1',
    userId: 'u1',
    type: GenerationType.WORKOUT,
    status: JobStatus.QUEUED,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePlan(overrides: Partial<PlanWithTemplates> = {}): PlanWithTemplates {
  return {
    id: 'plan9',
    userId: 'u1',
    name: 'AI PPL Plan',
    templateType: PlanTemplateType.PPL,
    source: PlanSource.AI,
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    templates: [
      {
        id: 'tpl-1',
        planId: 'plan9',
        name: { en: 'Push Day', vi: 'Ngày đẩy' },
        orderIndex: 0,
        colorTag: ColorTag.PUSH,
        slots: [
          {
            id: 'slot-1',
            templateId: 'tpl-1',
            exerciseId: 'ex-1',
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

// Fills the form (goal, experience, days) and clicks submit.
async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /hypertrophy/i }));
  await user.click(screen.getByRole('button', { name: /intermediate/i }));

  const daysInput = screen.getByLabelText(/days per week/i);
  await user.clear(daysInput);
  await user.type(daysInput, '4');

  await user.click(screen.getByRole('button', { name: /generate/i }));
}

// Flushes pending microtasks so the mocked api promises (and the resulting
// state updates from useJobPolling) settle before assertions run. The mocks
// below always resolve on their very first call, so no real/fake timer wait
// is ever entered — this keeps the test deterministic without fake timers.
async function flushMicrotasks() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
}

describe('GeneratePlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the form, polls, and shows a preview with an edit-in-builder CTA', async () => {
    const user = userEvent.setup();

    (api.generateWorkout as unknown as Mock).mockResolvedValue({ jobId: 'job-1' });
    (api.getGenerationJob as unknown as Mock).mockResolvedValue(
      makeJob({ status: JobStatus.DONE, resultId: 'plan9' }),
    );
    (api.getPlan as unknown as Mock).mockResolvedValue(makePlan());

    renderPage();

    await fillAndSubmit(user);
    await flushMicrotasks();

    expect(api.generateWorkout).toHaveBeenCalledWith({
      goal: Goal.HYPERTROPHY,
      experienceLevel: ExperienceLevel.INTERMEDIATE,
      daysPerWeek: 4,
    });

    expect(screen.getByText('AI PPL Plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit in builder|chỉnh trong builder/i })).toBeInTheDocument();
  });

  it('navigates to the plan builder when "edit in builder" is clicked', async () => {
    const user = userEvent.setup();

    (api.generateWorkout as unknown as Mock).mockResolvedValue({ jobId: 'job-1' });
    (api.getGenerationJob as unknown as Mock).mockResolvedValue(
      makeJob({ status: JobStatus.DONE, resultId: 'plan9' }),
    );
    (api.getPlan as unknown as Mock).mockResolvedValue(makePlan());

    renderPage();

    await fillAndSubmit(user);
    await flushMicrotasks();

    const editButton = screen.getByRole('button', { name: /edit in builder|chỉnh trong builder/i });
    await user.click(editButton);

    expect(screen.getByText('edit-route:plan9')).toBeInTheDocument();
  });

  it('shows an error message and does not navigate when generation fails', async () => {
    const user = userEvent.setup();

    (api.generateWorkout as unknown as Mock).mockResolvedValue({ jobId: 'job-1' });
    (api.getGenerationJob as unknown as Mock).mockResolvedValue(
      makeJob({ status: JobStatus.FAILED, error: 'quota' }),
    );

    renderPage();

    await fillAndSubmit(user);
    await flushMicrotasks();

    expect(screen.getByText('quota')).toBeInTheDocument();
    expect(api.getPlan).not.toHaveBeenCalled();
    expect(screen.queryByText(/edit-route/)).not.toBeInTheDocument();
  });
});
