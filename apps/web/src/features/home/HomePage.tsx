import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { WorkoutTemplate } from '@gigaflow/shared';
import { getActivePlan, startSession } from '../../lib/api';
import { resolveTranslatable } from '../../lib/i18n';
import { Button } from '../../components/Button';
import { SkeletonList } from '../../components/Skeleton';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { SparklesIcon } from '../../components/icons';
import { SessionQueueItem, type SessionQueueStatus } from '../../components/SessionQueueItem';
import { sessionPath } from '../../routes';
import { PresetPicker } from '../plans/PresetPicker';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activePlanQuery = useQuery({
    queryKey: ['activePlan'],
    queryFn: getActivePlan,
  });

  const startSessionMutation = useMutation({
    mutationFn: (templateId: string) => startSession(templateId),
    onSuccess: (result) => {
      queryClient.setQueryData(['session', result.session.id], result);
      navigate(sessionPath(result.session.id));
    },
  });

  if (activePlanQuery.isLoading) {
    return (
      <div className="p-4">
        <SkeletonList rows={3} />
      </div>
    );
  }

  if (activePlanQuery.isError) {
    return (
      <FadeIn className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-danger">
          <SparklesIcon width={28} height={28} />
        </span>
        <p className="text-text-secondary">{t('home.loadError')}</p>
        <Button onClick={() => void activePlanQuery.refetch()}>{t('common.retry')}</Button>
      </FadeIn>
    );
  }

  const plan = activePlanQuery.data;

  if (!plan) {
    return (
      <FadeIn className="flex flex-col gap-5 p-4">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-grad-primary shadow-glow-accent animate-pulse-glow">
            <SparklesIcon className="text-white" width={30} height={30} />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight text-gradient">{t('home.emptyStateTitle')}</h1>
          <p className="text-text-secondary">{t('home.emptyStateBody')}</p>
        </div>
        <PresetPicker />
      </FadeIn>
    );
  }

  const templates: WorkoutTemplate[] = [...plan.templates].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-extrabold tracking-tight text-text">{t('home.queueTitle')}</h1>
      <Stagger className="flex flex-col gap-3">
        {templates.map((template, index) => {
          const status: SessionQueueStatus = index === 0 ? 'next' : 'upcoming';
          return (
            <StaggerItem key={template.id}>
              <SessionQueueItem
                template={{
                  id: template.id,
                  name: resolveTranslatable(template.name, i18n.language),
                  colorTag: template.colorTag,
                }}
                status={status}
                onStart={status === 'next' ? () => startSessionMutation.mutate(template.id) : undefined}
              />
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
