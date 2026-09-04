import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { PersonalRecord, SetLog, TrainingSession } from '@gigaflow/shared';
import { getExercises, getPrs } from '../../lib/api';
import { resolveTranslatable } from '../../lib/i18n';
import { ROUTES } from '../../routes';
import { SummaryRow } from '../../components/SummaryRow';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { SparklesIcon } from '../../components/icons';

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

interface ExerciseSummary {
  exerciseId: string;
  setCount: number;
  avgWeightKg: number;
}

function groupSetLogs(setLogs: SetLog[]): ExerciseSummary[] {
  const byExercise = new Map<string, { total: number; count: number }>();
  const order: string[] = [];
  for (const log of setLogs) {
    let entry = byExercise.get(log.exerciseId);
    if (!entry) {
      entry = { total: 0, count: 0 };
      byExercise.set(log.exerciseId, entry);
      order.push(log.exerciseId);
    }
    entry.total += log.weightKg;
    entry.count += 1;
  }
  return order.map((exerciseId) => {
    const entry = byExercise.get(exerciseId)!;
    return {
      exerciseId,
      setCount: entry.count,
      avgWeightKg: Math.round((entry.total / entry.count) * 10) / 10,
    };
  });
}

export function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const session = id ? queryClient.getQueryData<TrainingSession>(['session', id]) : undefined;
  const setLogs = id ? queryClient.getQueryData<SetLog[]>(['session', id, 'sets']) : undefined;

  const exercisesQuery = useQuery({ queryKey: ['exercises'], queryFn: () => getExercises() });
  const prsQuery = useQuery<PersonalRecord[]>({ queryKey: ['prs'], queryFn: getPrs });

  const exercisesById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    for (const exercise of exercisesQuery.data ?? []) {
      map.set(exercise.id, { name: resolveTranslatable(exercise.name, i18n.language) });
    }
    return map;
  }, [exercisesQuery.data, i18n.language]);

  const exerciseSummaries = useMemo(() => (setLogs ? groupSetLogs(setLogs) : []), [setLogs]);

  if (!id || !session) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const prExerciseIds = new Set((prsQuery.data ?? []).map((pr) => pr.exerciseId));

  return (
    <div className="flex flex-col gap-5 p-4">
      <FadeIn className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-grad-primary shadow-glow-accent animate-pop">
          <SparklesIcon className="text-white" width={30} height={30} />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-gradient">
          ✓ {t('summary.doneTitle', { n: session.sessionNumber })}
        </h1>
      </FadeIn>

      <div className="grid grid-cols-2 gap-3">
        <Card variant="flat" className="flex flex-col items-center gap-1 py-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {t('summary.duration')}
          </span>
          <span className="tnum text-2xl font-extrabold text-text">{formatMmSs(session.durationSeconds ?? 0)}</span>
        </Card>
        <Card variant="flat" className="flex flex-col items-center gap-1 py-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {t('summary.totalVolume')}
          </span>
          <span className="tnum text-2xl font-extrabold text-text">{session.totalVolume ?? 0}</span>
        </Card>
      </div>

      <Card variant="default" className="p-0">
        <Stagger className="flex flex-col divide-y divide-border-subtle px-4">
          {exerciseSummaries.map((summary) => (
            <StaggerItem key={summary.exerciseId}>
              <SummaryRow
                name={exercisesById.get(summary.exerciseId)?.name ?? summary.exerciseId}
                setCount={summary.setCount}
                avgWeightKg={summary.avgWeightKg}
                hasPR={prExerciseIds.has(summary.exerciseId)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      </Card>

      <Button size="lg" fullWidth onClick={() => navigate(ROUTES.home)}>
        {t('summary.backHome')}
      </Button>
    </div>
  );
}
