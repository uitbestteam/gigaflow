import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAwards, getPrs, getStatsSummary, getWeightHistory, logWeight } from '../../lib/api';
import { resolveTranslatable } from '../../lib/i18n';
import { StatTile } from '../../components/StatTile';
import { MiniBarChart } from '../../components/MiniBarChart';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { AwardCard } from './AwardCard';

function shortDate(value: Date): string {
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Stats dashboard (spec §4.6): summary tiles, awards, PRs, and a
 * bodyweight trend chart with a log-weight form. */
export function StatsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({ queryKey: ['statsSummary'], queryFn: () => getStatsSummary() });
  const awardsQuery = useQuery({ queryKey: ['awards'], queryFn: () => getAwards() });
  const prsQuery = useQuery({ queryKey: ['prs'], queryFn: () => getPrs() });
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
  const weightHistory = weightHistoryQuery.data ?? [];

  const chartPoints = weightHistory.map((log) => ({
    label: shortDate(log.loggedAt),
    value: log.weightKg,
  }));

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold text-text">{t('stats.title')}</h1>

      <section className="flex flex-col gap-2">
        {summaryQuery.isLoading && (
          <div className="flex items-center justify-center p-8">
            <Spinner label={t('common.loading')} />
          </div>
        )}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={t('stats.totalSessions')} value={summary.totalSessions} />
            <StatTile label={t('stats.totalVolume')} value={summary.totalVolume} unit="kg" />
            <StatTile label={t('stats.totalPrs')} value={summary.totalPrs} />
            <StatTile label={t('stats.totalExercises')} value={summary.totalExercises} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-text">{t('stats.awardsTitle')}</h2>
        {awards.length === 0 && !awardsQuery.isLoading && (
          <p className="text-sm text-text-secondary">{t('stats.awardsEmpty')}</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {awards.map((award) => (
            <AwardCard key={award.key} award={award} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-text">{t('stats.prsTitle')}</h2>
        {prs.length === 0 && !prsQuery.isLoading && (
          <p className="text-sm text-text-secondary">{t('stats.prsEmpty')}</p>
        )}
        <div className="flex flex-col gap-2">
          {prs.map((pr) => {
            const exerciseName = resolveTranslatable(pr.name, i18n.language);
            return (
              <div
                key={pr.exerciseId}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-border-subtle bg-surface p-3"
              >
                <span className="text-text">{exerciseName}</span>
                <span className="tnum text-sm text-text-secondary">
                  {pr.bestSet.weightKg}kg &times; {pr.bestSet.repsDone} ({t('stats.e1rm')}: {pr.bestSet.e1RM})
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-text">{t('stats.weightTitle')}</h2>
        <MiniBarChart points={chartPoints} unit="kg" />

        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('stats.weightLabel')}</span>
            <input
              type="number"
              step="0.1"
              min={0}
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              className="min-h-11 max-w-[8rem] rounded-[10px] border border-border bg-surface px-3 text-text"
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
      </section>
    </div>
  );
}
