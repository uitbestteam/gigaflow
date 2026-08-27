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

  const exercisesQuery = useQuery({ queryKey: ['exercises'], queryFn: getExercises });
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
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text">
          ✓ {t('summary.doneTitle', { n: session.sessionNumber })}
        </h1>
        <div className="flex items-center gap-4 text-sm text-text-secondary">
          <span>
            {t('summary.duration')}: <span className="tnum">{formatMmSs(session.durationSeconds ?? 0)}</span>
          </span>
          <span>
            {t('summary.totalVolume')}: <span className="tnum">{session.totalVolume ?? 0}</span>
          </span>
        </div>
      </header>

      <div className="flex flex-col divide-y divide-border-subtle">
        {exerciseSummaries.map((summary) => (
          <SummaryRow
            key={summary.exerciseId}
            name={exercisesById.get(summary.exerciseId)?.name ?? summary.exerciseId}
            setCount={summary.setCount}
            avgWeightKg={summary.avgWeightKg}
            hasPR={prExerciseIds.has(summary.exerciseId)}
          />
        ))}
      </div>

      <Button onClick={() => navigate(ROUTES.home)}>{t('summary.backHome')}</Button>
    </div>
  );
}
