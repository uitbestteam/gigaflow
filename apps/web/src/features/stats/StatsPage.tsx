import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAwards, getPrs, getStatsSummary, getVolumeByWeek, getWeightHistory, logWeight } from '../../lib/api';
import { resolveTranslatable } from '../../lib/i18n';
import { StatTile, type StatTileAccent } from '../../components/StatTile';
import { MiniBarChart } from '../../components/MiniBarChart';
import { Button } from '../../components/Button';
import { Skeleton, SkeletonList } from '../../components/Skeleton';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { FlameIcon, SparklesIcon, CheckIcon, ListIcon } from '../../components/icons';
import { AwardCard } from './AwardCard';
import { VolumeByMuscleChart } from './VolumeByMuscleChart';

function shortDate(value: Date): string {
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ErrorRetry({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface p-6 text-center">
      <p className="text-sm text-text-secondary">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

/** Stats dashboard (spec §4.6): summary tiles, awards, PRs, and a
 * bodyweight trend chart with a log-weight form. */
export function StatsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({ queryKey: ['statsSummary'], queryFn: () => getStatsSummary() });
  const awardsQuery = useQuery({ queryKey: ['awards'], queryFn: () => getAwards() });
  const prsQuery = useQuery({ queryKey: ['prs'], queryFn: () => getPrs() });
  const volumeByWeekQuery = useQuery({ queryKey: ['volumeByWeek'], queryFn: () => getVolumeByWeek() });
  const weightHistoryQuery = useQuery({ queryKey: ['weightHistory'], queryFn: () => getWeightHistory() });

  const [weightKg, setWeightKg] = useState('');

  const logWeightMutation = useMutation({
    mutationFn: (input: { weightKg: number }) => logWeight(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['weightHistory'] });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(weightKg);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    logWeightMutation.mutate({ weightKg: parsed });
    setWeightKg('');
  };

  const summary = summaryQuery.data;
  const awards = awardsQuery.data ?? [];
  const prs = prsQuery.data ?? [];
  const volumeByWeek = volumeByWeekQuery.data ?? [];
  const weightHistory = weightHistoryQuery.data ?? [];

  const chartPoints = weightHistory.map((log) => ({
    label: shortDate(log.loggedAt),
    value: log.weightKg,
  }));

  const tiles: { label: string; value: number; unit?: string; accent: StatTileAccent; icon: ReactNode }[] = summary
    ? [
        // Icons here are deliberately chosen from the icon set with no <rect>
        // shapes (unlike ChartIcon/DumbbellIcon) so they don't collide with
        // MiniBarChart's own `<rect>` bars in tests that query the page globally.
        { label: t('stats.totalSessions'), value: summary.totalSessions, accent: 'push', icon: <FlameIcon width={16} height={16} /> },
        { label: t('stats.totalVolume'), value: summary.totalVolume, unit: 'kg', accent: 'legs', icon: <SparklesIcon width={16} height={16} /> },
        { label: t('stats.totalPrs'), value: summary.totalPrs, accent: 'pull', icon: <CheckIcon width={16} height={16} /> },
        { label: t('stats.totalExercises'), value: summary.totalExercises, accent: 'core', icon: <ListIcon width={16} height={16} /> },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8 p-4 pb-4">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">{t('stats.title')}</h1>
      </FadeIn>

      <section className="flex flex-col gap-2">
        {summaryQuery.isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {summaryQuery.isError && (
          <ErrorRetry message={t('stats.loadError')} retryLabel={t('common.retry')} onRetry={() => void summaryQuery.refetch()} />
        )}
        {summary && (
          <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((tile) => (
              <StaggerItem key={tile.label}>
                <StatTile label={tile.label} value={tile.value} unit={tile.unit} accent={tile.accent} icon={tile.icon} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {summary && (
        <FadeIn>
          <div className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface p-4">
            <span
              aria-hidden="true"
              className={summary.currentStreakWeeks > 0 ? 'text-push' : 'text-text-muted'}
            >
              <FlameIcon width={28} height={28} />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('stats.streakTitle')}
              </span>
              {summary.currentStreakWeeks > 0 ? (
                <>
                  <span className="text-lg font-extrabold text-text">
                    {t('stats.streakUnit', { count: summary.currentStreakWeeks })}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {t('stats.streakBest', { count: summary.longestStreakWeeks })}
                  </span>
                </>
              ) : (
                <span className="text-sm text-text-secondary">{t('stats.streakNone')}</span>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      <FadeIn className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-text">{t('stats.awardsTitle')}</h2>
        {awardsQuery.isLoading && <SkeletonList rows={2} />}
        {awardsQuery.isError && (
          <ErrorRetry message={t('stats.loadError')} retryLabel={t('common.retry')} onRetry={() => void awardsQuery.refetch()} />
        )}
        {awards.length === 0 && !awardsQuery.isLoading && !awardsQuery.isError && (
          <p className="text-sm text-text-secondary">{t('stats.awardsEmpty')}</p>
        )}
        <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {awards.map((award) => (
            <StaggerItem key={award.key}>
              <AwardCard award={award} />
            </StaggerItem>
          ))}
        </Stagger>
      </FadeIn>

      <FadeIn className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-text">{t('stats.volumeByMuscleTitle')}</h2>
        {volumeByWeekQuery.isLoading && <Skeleton className="h-36 w-full" />}
        {volumeByWeekQuery.isError && (
          <ErrorRetry message={t('stats.loadError')} retryLabel={t('common.retry')} onRetry={() => void volumeByWeekQuery.refetch()} />
        )}
        {!volumeByWeekQuery.isLoading && !volumeByWeekQuery.isError && (
          <VolumeByMuscleChart data={volumeByWeek} />
        )}
      </FadeIn>

      <FadeIn className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-text">{t('stats.prTimelineTitle')}</h2>
        {prsQuery.isLoading && <SkeletonList rows={3} />}
        {prsQuery.isError && <ErrorRetry message={t('stats.loadError')} retryLabel={t('common.retry')} onRetry={() => void prsQuery.refetch()} />}
        {prs.length === 0 && !prsQuery.isLoading && !prsQuery.isError && (
          <p className="text-sm text-text-secondary">{t('stats.prsEmpty')}</p>
        )}
        <Stagger className="flex flex-col">
          {prs.map((pr, index) => {
            const exerciseName = resolveTranslatable(pr.name, i18n.language);
            const isLast = index === prs.length - 1;
            return (
              <StaggerItem key={pr.exerciseId} className="flex items-stretch gap-3">
                <div className="flex flex-col items-center" aria-hidden="true">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  {!isLast && <span className="w-px flex-1 bg-border-subtle" />}
                </div>
                <div className={`flex flex-1 items-center justify-between gap-3 ${isLast ? '' : 'pb-3'}`}>
                  <span className="font-medium text-text">{exerciseName}</span>
                  <span className="tnum text-sm text-text-secondary">
                    {pr.bestSet.weightKg}kg &times; {pr.bestSet.repsDone} ({t('stats.e1rm')}: {pr.bestSet.e1RM})
                  </span>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </FadeIn>

      <FadeIn className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-text">{t('stats.weightTitle')}</h2>

        {weightHistoryQuery.isLoading && <Skeleton className="h-24 w-full" />}
        {weightHistoryQuery.isError && (
          <ErrorRetry message={t('stats.loadError')} retryLabel={t('common.retry')} onRetry={() => void weightHistoryQuery.refetch()} />
        )}
        {!weightHistoryQuery.isLoading && !weightHistoryQuery.isError && (
          <MiniBarChart points={chartPoints} unit="kg" />
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('stats.weightLabel')}</span>
            <input
              type="number"
              step="0.1"
              min={0}
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              className="min-h-11 max-w-[8rem] rounded-md border border-border bg-surface px-3 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            />
          </label>
          <Button type="submit" disabled={logWeightMutation.isPending || weightKg.trim() === ''}>
            {t('stats.logWeightSubmit')}
          </Button>
        </form>

        {weightHistory.length > 0 && (
          <ul className="flex flex-col gap-1">
            {weightHistory.map((log) => (
              <li key={log.id} className="tnum text-sm text-text-secondary">
                {shortDate(log.loggedAt)}: {log.weightKg}kg
              </li>
            ))}
          </ul>
        )}
      </FadeIn>
    </div>
  );
}
