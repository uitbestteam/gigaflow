import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { EquipmentType, SessionStatus } from '@gigaflow/shared';
import type { SessionStartResult } from '@gigaflow/shared';
import { ActiveSessionPage } from './ActiveSessionPage';
import { useSessionStore } from '../../store/sessionStore';
import { ROUTES } from '../../routes';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  logSets: vi.fn(),
  finishSession: vi.fn(),
  cancelSession: vi.fn(),
  getSession: vi.fn(),
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
  });

  it('renders the two SetBoxes with target text', () => {
    renderActiveSession(makeStartResult());

    expect(screen.getAllByText('80 × 8')).toHaveLength(2);
  });

  it('tapping the first SetBox marks it done and activates the second', async () => {
    const user = userEvent.setup();
    renderActiveSession(makeStartResult());

    const [firstBox] = screen.getAllByRole('button', { name: '80 × 8' });
    await user.click(firstBox!);

    await waitFor(() => {
      const slots = useSessionStore.getState().slots;
      expect(slots['slot-1']?.sets[0]).toMatchObject({ status: 'done' });
      expect(slots['slot-1']?.sets[1]?.status).toBe('active');
    });
  });

  it('clicking Finish calls logSets with 2 completed inputs, then finishSession, then navigates to summary', async () => {
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

    const [firstBox] = screen.getAllByRole('button', { name: '80 × 8' });
    await user.click(firstBox!);

    // Wait for the SetBox tap debounce to resolve so the store reflects the
    // completed set (and its auto-activated sibling) before Finish reads it.
    await waitFor(() => {
      expect(useSessionStore.getState().slots['slot-1']?.sets[1]?.status).toBe('active');
    });

    const finishButton = screen.getByRole('button', { name: /finish/i });
    await user.click(finishButton);

    expect(await screen.findByText('Summary Page')).toBeInTheDocument();

    expect(api.logSets).toHaveBeenCalledTimes(1);
    const [sessionId, sets] = (api.logSets as unknown as Mock).mock.calls[0] as [string, unknown[]];
    expect(sessionId).toBe('s1');
    expect(sets).toHaveLength(2);
    expect(sets.every((s) => (s as { isCompleted: boolean }).isCompleted)).toBe(true);

    expect(api.finishSession).toHaveBeenCalledWith('s1');
  });

  it('redirects to Home when the start result is missing from the cache', () => {
    renderActiveSession(undefined);

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });
});
