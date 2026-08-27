import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlanTemplateType, type WorkoutTemplate } from '@gigaflow/shared';
import { createPlanFromTemplate, getActivePlan, startSession } from '../../lib/api';
import { resolveTranslatable } from '../../lib/i18n';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { SessionQueueItem, type SessionQueueStatus } from '../../components/SessionQueueItem';
import { sessionPath } from '../../routes';

const PRESETS: { type: PlanTemplateType; labelKey: 'presetPpl' | 'presetUpperLower' | 'presetFullBody' }[] = [
  { type: PlanTemplateType.PPL, labelKey: 'presetPpl' },
  { type: PlanTemplateType.UPPER_LOWER, labelKey: 'presetUpperLower' },
  { type: PlanTemplateType.FULL_BODY, labelKey: 'presetFullBody' },
];

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activePlanQuery = useQuery({
    queryKey: ['activePlan'],
    queryFn: getActivePlan,
  });

  const createPlanMutation = useMutation({
    mutationFn: (templateType: PlanTemplateType) => createPlanFromTemplate(templateType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activePlan'] });
    },
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
      <div className="flex items-center justify-center p-8">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  if (activePlanQuery.isError) {
    return (
      <div className="p-4">
        <p className="text-text-secondary">{t('home.loadError')}</p>
        <Button className="mt-3" onClick={() => void activePlanQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const plan = activePlanQuery.data;

  if (!plan) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold text-text">{t('home.emptyStateTitle')}</h1>
        <p className="mt-1 text-text-secondary">{t('home.emptyStateBody')}</p>
        <div className="mt-4 flex flex-col gap-3">
          {PRESETS.map((preset) => (
            <Button
              key={preset.type}
              onClick={() => createPlanMutation.mutate(preset.type)}
              disabled={createPlanMutation.isPending}
            >
              {t(`home.${preset.labelKey}`)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const templates: WorkoutTemplate[] = [...plan.templates].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-text">{t('home.queueTitle')}</h1>
      <div className="mt-3 flex flex-col gap-2">
        {templates.map((template, index) => {
          const status: SessionQueueStatus = index === 0 ? 'next' : 'upcoming';
          return (
            <SessionQueueItem
              key={template.id}
              template={{
                id: template.id,
                name: resolveTranslatable(template.name, i18n.language),
                colorTag: template.colorTag,
              }}
              status={status}
              onStart={status === 'next' ? () => startSessionMutation.mutate(template.id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
