import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MuscleGroup, type Exercise, type PlanWithTemplates, type SessionStartResult } from '@gigaflow/shared';
import { cancelSession, finishSession, getExercises, logSets } from '../../lib/api';
import { resolveTranslatable } from '../../lib/i18n';
import { useSessionStore } from '../../store/sessionStore';
import { ROUTES, sessionSummaryPath } from '../../routes';
import { ExerciseRow, type ExerciseRowSet, type ExerciseRowSlot, type ExerciseRowStatus } from '../../components/ExerciseRow';
import { RestTimer } from '../../components/RestTimer';
import { RirPicker } from '../../components/RirPicker';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SkeletonList } from '../../components/Skeleton';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { CheckIcon } from '../../components/icons';
import type { SetBoxStatus } from '../../components/SetBox';
import { SetEditor } from './SetEditor';

const DEFAULT_REST_SECONDS = 90;

/**
 * Last-resort placeholder for a slot whose `exerciseId` isn't found in the
 * `/exercises` catalog (a data-consistency gap, not the expected path —
 * normally every slot's exercise resolves via `getExercises()`).
 */
const FALLBACK_MUSCLE_GROUP = MuscleGroup.CHEST;

/** Muscle-group -> accent border color, using the app's identity tokens. */
const MUSCLE_GROUP_ACCENT: Record<MuscleGroup, string> = {
  [MuscleGroup.CHEST]: 'border-push',
  [MuscleGroup.SHOULDERS]: 'border-push',
  [MuscleGroup.ARMS]: 'border-push',
  [MuscleGroup.BACK]: 'border-pull',
  [MuscleGroup.LEGS]: 'border-legs',
  [MuscleGroup.CORE]: 'border-core',
  [MuscleGroup.CARDIO]: 'border-accent',
};

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

interface ActiveRest {
  slotId: string;
  setIndex: number;
}

interface EditingSet {
  slotId: string;
  setIndex: number;
}

export function ActiveSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const startResult = id ? queryClient.getQueryData<SessionStartResult>(['session', id]) : undefined;

  const exercisesQuery = useQuery({ queryKey: ['exercises'], queryFn: () => getExercises() });
  const exercisesById = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const exercise of exercisesQuery.data ?? []) {
      map.set(exercise.id, exercise);
    }
    return map;
  }, [exercisesQuery.data]);

  const storeSlots = useSessionStore((s) => s.slots);
  const initFromSlots = useSessionStore((s) => s.initFromSlots);
  const markDone = useSessionStore((s) => s.markDone);
  const editSet = useSessionStore((s) => s.editSet);
  const setRest = useSessionStore((s) => s.setRest);
  const setRir = useSessionStore((s) => s.setRir);
  const toLogSetInput = useSessionStore((s) => s.toLogSetInput);
  const reset = useSessionStore((s) => s.reset);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeRest, setActiveRest] = useState<ActiveRest | null>(null);
  const [editingSet, setEditingSet] = useState<EditingSet | null>(null);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const [restRunning, setRestRunning] = useState(false);
  const restElapsedRef = useRef(0);

  // Best-effort: the session-start payload doesn't carry a template name,
  // but HomePage already caches the active plan (`['activePlan']`) that the
  // session was started from. Join on `templateId` to resolve a real name;
  // fall back to the generic `session.title` copy if that cache is absent
  // (e.g. a page reload landed the user directly on `/session/:id` — though
  // that also loses the `['session', id]` cache and redirects to Home).
  const activePlan = queryClient.getQueryData<PlanWithTemplates>(['activePlan']);
  const template = activePlan?.templates.find((tpl) => tpl.id === startResult?.session.templateId);
  const sessionName = template ? resolveTranslatable(template.name, i18n.language) : t('session.title');

  useEffect(() => {
    if (!startResult) return;
    initFromSlots(startResult.session, startResult.slots);
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeRest || !restRunning) return;
    const interval = setInterval(() => {
      restElapsedRef.current += 1;
      setRestSeconds((prev) => {
        if (prev <= 1) {
          setRestRunning(false);
          setRest(activeRest.slotId, activeRest.setIndex, restElapsedRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRest, restRunning, setRest]);

  // Not memoized with useCallback: it reads the current `activeRest` state
  // directly (a fresh closure each render), which keeps the "persist the
  // outgoing rest before replacing it" logic below correct without a stale
  // closure over a previous `activeRest`.
  const startRest = (slotId: string, setIndex: number) => {
    if (activeRest && (activeRest.slotId !== slotId || activeRest.setIndex !== setIndex)) {
      // Switching to a different set while a rest is still counting down —
      // persist how long the outgoing set's rest actually ran instead of
      // silently dropping it.
      setRest(activeRest.slotId, activeRest.setIndex, restElapsedRef.current);
    }
    restElapsedRef.current = 0;
    setActiveRest({ slotId, setIndex });
    setRestSeconds(DEFAULT_REST_SECONDS);
    setRestRunning(true);
  };

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('missing session id');
      const setLogs = await logSets(id, toLogSetInput());
      const finished = await finishSession(id);
      return { finished, setLogs };
    },
    onSuccess: ({ finished, setLogs }) => {
      if (!id) return;
      queryClient.setQueryData(['session', id], finished);
      queryClient.setQueryData(['session', id, 'sets'], setLogs);
      reset();
      navigate(sessionSummaryPath(id));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('missing session id');
      return cancelSession(id);
    },
    onSuccess: () => {
      reset();
      navigate(ROUTES.home);
    },
  });

  if (!id || !startResult) {
    return <Navigate to={ROUTES.home} replace />;
  }

  if (exercisesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <SkeletonList rows={4} />
      </div>
    );
  }

  const handleSetTap = (slotId: string, index: number) => {
    markDone(slotId, index);
    startRest(slotId, index);
  };

  const handleSetEdit = (slotId: string, index: number) => {
    setEditingSet({ slotId, setIndex: index });
  };

  const handleSetEditorSave = (values: { weightKg: number; repsDone: number }) => {
    if (!editingSet) return;
    editSet(editingSet.slotId, editingSet.setIndex, values);
    setEditingSet(null);
  };

  const handleSetEditorCancel = () => {
    setEditingSet(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <FadeIn className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-lg font-extrabold tracking-tight text-text">
            {sessionName} <span className="font-semibold text-text-secondary">#{startResult.session.sessionNumber}</span>
          </h1>
          <span className="tnum text-2xl font-extrabold text-gradient" aria-live="off">
            {formatMmSs(elapsedSeconds)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2">
          <Button size="sm" onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}>
            {t('session.finish')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
            {t('session.cancel')}
          </Button>
        </div>
      </FadeIn>

      <Stagger className="flex flex-col gap-4">
        {startResult.slots.map((slotTarget) => {
          const slotSession = storeSlots[slotTarget.id];
          if (!slotSession) return null;

          const sets: ExerciseRowSet[] = slotSession.sets.map((set) => {
            const boxStatus: SetBoxStatus = set.status === 'active' ? 'pending' : set.status;
            return {
              target: { weightKg: slotSession.weightSuggested, repsDone: slotSession.repsSuggested },
              actual: set.status === 'done' || set.status === 'edited' ? { weightKg: set.weightKg, repsDone: set.repsDone } : undefined,
              status: boxStatus,
            };
          });

          const allDone = slotSession.sets.every((s) => s.status === 'done' || s.status === 'edited');
          const anyStarted = slotSession.sets.some((s) => s.status !== 'pending');
          const rowStatus: ExerciseRowStatus = allDone ? 'done' : anyStarted ? 'active' : 'pending';

          const exercise = exercisesById.get(slotTarget.exerciseId);
          const slot: ExerciseRowSlot = {
            ...slotTarget,
            name: exercise ? resolveTranslatable(exercise.name, i18n.language) : slotTarget.exerciseId,
            muscleGroup: exercise?.muscleGroup ?? FALLBACK_MUSCLE_GROUP,
          };

          const editingSetInSlot = editingSet && editingSet.slotId === slotTarget.id ? editingSet : undefined;
          const editingThisSlot = editingSetInSlot ? slotSession.sets[editingSetInSlot.setIndex] : undefined;

          const accentClass = MUSCLE_GROUP_ACCENT[slot.muscleGroup] ?? 'border-accent';

          return (
            <StaggerItem key={slotTarget.id} className="flex flex-col gap-2">
              <div
                className={[
                  'relative rounded-lg border-l-4 bg-surface p-3 shadow-card transition-opacity',
                  accentClass,
                  rowStatus === 'pending' ? 'opacity-50' : '',
                  rowStatus === 'active' ? 'ring-1 ring-accent/40' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {rowStatus === 'done' && (
                  <span
                    aria-hidden="true"
                    className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-success text-white animate-pop"
                  >
                    <CheckIcon width={14} height={14} />
                  </span>
                )}
                <ExerciseRow
                  slot={slot}
                  sets={sets}
                  status={rowStatus}
                  onSetTap={(index) => handleSetTap(slotTarget.id, index)}
                  onSetEdit={(index) => handleSetEdit(slotTarget.id, index)}
                />
              </div>
              {editingThisSlot && (
                <SetEditor
                  key={`${editingSetInSlot?.slotId}-${editingSetInSlot?.setIndex}`}
                  initial={{ weightKg: editingThisSlot.weightKg, repsDone: editingThisSlot.repsDone }}
                  onSave={handleSetEditorSave}
                  onCancel={handleSetEditorCancel}
                />
              )}
            </StaggerItem>
          );
        })}
      </Stagger>

      {activeRest && (
        <FadeIn>
          <Card variant="glow" className="flex flex-col items-center gap-4">
            <span className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              {t('session.restTimerTitle')}
            </span>
            <RestTimer
              seconds={restSeconds}
              running={restRunning}
              onToggle={() => setRestRunning((r) => !r)}
              onAdjust={(delta) => setRestSeconds((s) => Math.max(0, s + delta))}
            />
            <RirPicker
              value={storeSlots[activeRest.slotId]?.sets[activeRest.setIndex]?.rir}
              onPick={(rir) => setRir(activeRest.slotId, activeRest.setIndex, rir)}
            />
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
