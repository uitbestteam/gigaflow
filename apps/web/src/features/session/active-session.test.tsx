import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { EquipmentType, MuscleGroup, SessionStatus } from '@gigaflow/shared';
import type { Exercise, SessionStartResult } from '@gigaflow/shared';
import { ActiveSessionPage } from './ActiveSessionPage';
import { useSessionStore } from '../../store/sessionStore';
import { ROUTES } from '../../routes';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  logSets: vi.fn(),
  finishSession: vi.fn(),
  cancelSession: vi.fn(),
  getSession: vi.fn(),
  getExercises: vi.fn(),
}));

function makeStartResult(): SessionStartResult {
  return {
    session: {
      id: 's1',
      userId: 'user-1',
      templateId: 'tmpl-1',
      sessionNumber: 3,
      startedAt: new Date('2026-01-01T00:00:00Z'),
      status: SessionStatus.IN_PROGRESS,
    },
    slots: [
      {
        id: 'slot-1',
        templateId: 'tmpl-1',
        exerciseId: 'ex-1',
        orderIndex: 0,
        setsTarget: 2,
        repRangeMin: 8,
        repRangeMax: 12,
        equipmentType: EquipmentType.BARBELL,
        weightIncrement: 2.5,
        weightSuggested: 80,
        repsSuggested: 8,
      },
    ],
  };
}

function makeExercises(): Exercise[] {
  return [
    {
      id: 'ex-1',
      slug: 'bench-press',
      name: { en: 'Bench Press', vi: 'Đẩy ngực' },
      muscleGroup: MuscleGroup.CHEST,
      equipmentType: EquipmentType.BARBELL,
      defaultIncrement: 2.5,
      isCustom: false,
    },
  ];
}

function renderActiveSession(startResult: SessionStartResult | undefined) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (startResult) {
    queryClient.setQueryData(['session', startResult.session.id], startResult);
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/session/s1']}>
        <Routes>
          <Route path={ROUTES.session} element={<ActiveSessionPage />} />
          <Route path={ROUTES.sessionSummary} element={<div>Summary Page</div>} />
          <Route path={ROUTES.home} element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ActiveSessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    (api.getExercises as unknown as Mock).mockResolvedValue(makeExercises());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the two SetBoxes with target text, resolving the real exercise name via getExercises', async () => {
    renderActiveSession(makeStartResult());

    expect(await screen.findAllByText('80 × 8')).toHaveLength(2);
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText(MuscleGroup.CHEST)).toBeInTheDocument();
  });

  it('falls back to the exerciseId when the exercise catalog has no matching entry', async () => {
    (api.getExercises as unknown as Mock).mockResolvedValue([]);
    renderActiveSession(makeStartResult());

    expect(await screen.findAllByText('80 × 8')).toHaveLength(2);
    expect(screen.getByText('ex-1')).toBeInTheDocument();
  });

  it('tapping the first SetBox marks it done (shown as the success/green box) and activates the second', async () => {
    const user = userEvent.setup();
    renderActiveSession(makeStartResult());

    const boxes = await screen.findAllByRole('button', { name: '80 × 8' });
    const [firstBox] = boxes;
    await user.click(firstBox!);

    await waitFor(() => {
      const slots = useSessionStore.getState().slots;
      expect(slots['slot-1']?.sets[0]).toMatchObject({ status: 'done' });
      expect(slots['slot-1']?.sets[1]?.status).toBe('active');
    });

    // The first box re-renders with the success/green "done" styling.
    expect(firstBox!.className).toMatch(/success/);
  });

  it('clicking Finish calls logSets with exactly 1 completed input (only the tapped set), then finishSession, then navigates to summary', async () => {
    const user = userEvent.setup();
    (api.logSets as unknown as Mock).mockResolvedValue([]);
    (api.finishSession as unknown as Mock).mockResolvedValue({
      id: 's1',
      userId: 'user-1',
      templateId: 'tmpl-1',
      sessionNumber: 3,
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: new Date('2026-01-01T00:30:00Z'),
      status: SessionStatus.COMPLETED,
    });

    renderActiveSession(makeStartResult());

    const boxes = await screen.findAllByRole('button', { name: '80 × 8' });
    const [firstBox] = boxes;
    await user.click(firstBox!);

    // Wait for the SetBox tap debounce to resolve so the store reflects the
    // completed set (and its auto-activated-but-untapped sibling) before
    // Finish reads it.
    await waitFor(() => {
      expect(useSessionStore.getState().slots['slot-1']?.sets[1]?.status).toBe('active');
    });

    const finishButton = screen.getByRole('button', { name: /finish/i });
    await user.click(finishButton);

    expect(await screen.findByText('Summary Page')).toBeInTheDocument();

    expect(api.logSets).toHaveBeenCalledTimes(1);
    const [sessionId, sets] = (api.logSets as unknown as Mock).mock.calls[0] as [string, unknown[]];
    expect(sessionId).toBe('s1');
    // Only the set the user actually tapped (status 'done') is submitted —
    // the auto-activated second set (never tapped, status 'active') must
    // NOT be included, so history/PRs aren't polluted with fabricated data.
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ slotId: 'slot-1', setNumber: 1, isCompleted: true });

    expect(api.finishSession).toHaveBeenCalledWith('s1');
  });

  it('clicking Cancel calls cancelSession and navigates to Home', async () => {
    const user = userEvent.setup();
    (api.cancelSession as unknown as Mock).mockResolvedValue({
      id: 's1',
      userId: 'user-1',
      templateId: 'tmpl-1',
      sessionNumber: 3,
      startedAt: new Date('2026-01-01T00:00:00Z'),
      status: SessionStatus.CANCELLED,
    });

    renderActiveSession(makeStartResult());
    await screen.findAllByText('80 × 8');

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(await screen.findByText('Home Page')).toBeInTheDocument();
    expect(api.cancelSession).toHaveBeenCalledWith('s1');
  });

  it('redirects to Home when the start result is missing from the cache', () => {
    renderActiveSession(undefined);

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('double-clicking a SetBox opens the inline SetEditor; Save updates weight/reps in the store and marks it edited, with no window.prompt used', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    const user = userEvent.setup();
    renderActiveSession(makeStartResult());

    const boxes = await screen.findAllByRole('button', { name: '80 × 8' });
    const [firstBox] = boxes;
    fireEvent.doubleClick(firstBox!);

    const weightInput = await screen.findByLabelText(/weight/i);
    const repsInput = screen.getByLabelText(/reps/i);

    await user.clear(weightInput);
    await user.type(weightInput, '90');
    await user.clear(repsInput);
    await user.type(repsInput, '10');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().slots['slot-1']?.sets[0]).toMatchObject({
        status: 'edited',
        weightKg: 90,
        repsDone: 10,
      });
    });

    // The editor closes after Save.
    expect(screen.queryByLabelText(/weight/i)).not.toBeInTheDocument();
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it('Cancel in the inline SetEditor closes it without changing the store', async () => {
    const user = userEvent.setup();
    renderActiveSession(makeStartResult());

    const boxes = await screen.findAllByRole('button', { name: '80 × 8' });
    const [firstBox] = boxes;
    fireEvent.doubleClick(firstBox!);

    await screen.findByLabelText(/weight/i);
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByLabelText(/weight/i)).not.toBeInTheDocument();
    expect(useSessionStore.getState().slots['slot-1']?.sets[0]).toMatchObject({ status: 'active', weightKg: 80 });
  });

  it('double-clicking a different set in the same slot while the editor is open shows that set\'s values, not a stale draft', async () => {
    const user = userEvent.setup();
    renderActiveSession(makeStartResult());

    const boxes = await screen.findAllByRole('button', { name: '80 × 8' });
    const [firstBox, secondBox] = boxes;

    // Open the editor for set 0 and type an unsaved draft value.
    fireEvent.doubleClick(firstBox!);
    const firstWeightInput = await screen.findByLabelText(/weight/i);
    await user.clear(firstWeightInput);
    await user.type(firstWeightInput, '999');
    expect(screen.getByLabelText(/weight/i)).toHaveValue(999);

    // Without closing, open the editor for set 1 in the same slot. The
    // editor must remount and show set 1's real values, not the unsaved
    // '999' draft left over from set 0.
    fireEvent.doubleClick(secondBox!);

    const secondWeightInput = await screen.findByLabelText(/weight/i);
    const secondRepsInput = screen.getByLabelText(/reps/i);
    expect(secondWeightInput).toHaveValue(80);
    expect(secondRepsInput).toHaveValue(8);
  });

  it('rest timer supports ±15s adjust and Pause/Resume, ticking deterministically', async () => {
    renderActiveSession(makeStartResult());
    const boxes = await screen.findAllByRole('button', { name: '80 × 8' });
    const [firstBox] = boxes;

    vi.useFakeTimers();

    fireEvent.click(firstBox!);
    act(() => {
      vi.advanceTimersByTime(250); // flush the SetBox tap debounce
    });

    // Default rest is 90s.
    expect(screen.getByText('01:30')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+15s' }));
    expect(screen.getByText('01:45')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '-15s' }));
    fireEvent.click(screen.getByRole('button', { name: '-15s' }));
    expect(screen.getByText('01:15')).toBeInTheDocument();

    // Pause: the countdown must not advance while paused.
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('01:15')).toBeInTheDocument();

    // Resume: the countdown ticks again.
    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('01:12')).toBeInTheDocument();
  });
});
