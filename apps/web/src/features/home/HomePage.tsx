import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { WorkoutTemplate } from '@gigaflow/shared';
import { getActivePlan, getLastSession, startSession } from '../../lib/api';
import { resolveTranslatable } from '../../lib/i18n';
import { Button } from '../../components/Button';
import { SkeletonList } from '../../components/Skeleton';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { SparklesIcon } from '../../components/icons';
import { SessionQueueItem, type SessionQueueStatus } from '../../components/SessionQueueItem';
import { sessionPath } from '../../routes';
import { PresetPicker } from '../plans/PresetPicker';
import { useAuthStore } from '../../store/authStore';
import { OnboardingFlow } from '../onboarding/OnboardingFlow';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const activePlanQuery = useQuery({
    queryKey: ['activePlan'],
    queryFn: getActivePlan,
  });

  // The most recently completed session tells us which day to suggest next.
  const lastSessionQuery = useQuery({
    queryKey: ['lastSession'],
    queryFn: getLastSession,
  });

  const startSessionMutation = useMutation({
    mutationFn: (templateId: string) => startSession(templateId),
    onSuccess: (result) => {
      queryClient.setQueryData(['session', result.session.id], result);
      navigate(sessionPath(result.session.id));
    },
  });

  // First-run gate: a signed-in user who hasn't finished onboarding gets the
  // onboarding flow instead of the home surface.
  if (user && !user.onboardedAt) {
    return <OnboardingFlow />;
  }

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

  // Suggest the day AFTER the last completed one (rotation). Any day can still
  // be started — the suggestion is only the highlighted hero.
  const lastTemplateId = lastSessionQuery.data?.templateId;
  const lastIndex = lastTemplateId ? templates.findIndex((tpl) => tpl.id === lastTemplateId) : -1;
  const suggestedIndex = lastIndex >= 0 && templates.length > 0 ? (lastIndex + 1) % templates.length : 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-extrabold tracking-tight text-text">{t('home.queueTitle')}</h1>
      <Stagger className="flex flex-col gap-3">
        {templates.map((template, index) => {
          const status: SessionQueueStatus = index === suggestedIndex ? 'next' : 'upcoming';
          return (
            <StaggerItem key={template.id}>
              <SessionQueueItem
                template={{
                  id: template.id,
                  name: resolveTranslatable(template.name, i18n.language),
                  colorTag: template.colorTag,
                }}
                status={status}
                // Every day is startable — not just the suggested one.
                onStart={() => startSessionMutation.mutate(template.id)}
              />
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
