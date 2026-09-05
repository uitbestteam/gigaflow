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

// framer-motion's AnimatePresence mode="wait" never completes its exit
// animation under jsdom, which strands wizard steps mid-transition. Render
// motion elements and AnimatePresence as plain passthroughs so step changes
// are synchronous and deterministic in tests.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const DROP = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'custom',
    'layout',
    'layoutId',
    'whileTap',
    'whileHover',
    'whileFocus',
    'whileInView',
    'drag',
  ]);
  const clean = (props: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(props).filter(([k]) => !DROP.has(k)));
  // Cache one stable component per tag — a fresh component identity on every
  // access would remount the subtree each render and detach inputs.
  const cache = new Map<string, React.ElementType>();
  const motion = new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        let comp = cache.get(tag);
        if (!comp) {
          comp = React.forwardRef((props: Record<string, unknown>, ref) =>
            React.createElement(tag, { ref, ...clean(props) }, props.children as React.ReactNode),
          );
          cache.set(tag, comp);
        }
        return comp;
      },
    },
  );
  return {
    __esModule: true,
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => true,
  };
});

vi.mock('../../lib/api', () => ({
  generateWorkout: vi.fn(),
  getGenerationJob: vi.fn(),
  getPlan: vi.fn(),
  // GeneratePlanPage now imports authStore (to pre-fill from the profile),
  // which statically imports postAuthSession from the api module.
  postAuthSession: vi.fn(),
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

// Walks the wizard: goal + experience, days + session, equipment preset,
// injuries (skipped), emphasis (skipped), then finishes.
async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  // Step 1 — goal + experience
  await user.click(screen.getByRole('button', { name: /hypertrophy/i }));
  await user.click(screen.getByRole('button', { name: /intermediate/i }));
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 2 — days per week (chips) + optional session length
  await user.click(screen.getByRole('button', { name: '4' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 3 — equipment preset
  await user.click(screen.getByRole('button', { name: /bodyweight only/i }));
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 4 — injuries (skip)
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 5 — emphasis (skip) then finish
  await user.click(screen.getByRole('button', { name: /generate plan/i }));
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
      availableEquipment: [EquipmentType.BODYWEIGHT],
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
