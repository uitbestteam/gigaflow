import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { activatePlan, deletePlan, getPlans } from '../../lib/api';
import { Button } from '../../components/Button';
import { PlanListItem } from '../../components/PlanListItem';
import { SkeletonList } from '../../components/Skeleton';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { DumbbellIcon, PlusIcon } from '../../components/icons';
import { planEditPath, planNewPath } from '../../routes';
import { PresetPicker } from './PresetPicker';

export function PlansPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: () => getPlans(),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => activatePlan(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      void queryClient.invalidateQueries({ queryKey: ['activePlan'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <FadeIn className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-text">{t('plans.title')}</h1>
        <Button onClick={() => navigate(planNewPath())}>
          <PlusIcon width={18} height={18} />
          {t('plans.newPlan')}
        </Button>
      </FadeIn>

      <FadeIn delay={0.05} className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text-secondary">{t('plans.fromPreset')}</span>
        <PresetPicker variant="ghost" />
      </FadeIn>

      {plansQuery.isLoading && <SkeletonList rows={3} />}

      {plansQuery.isError && (
        <FadeIn className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-text-secondary">{t('plans.loadError')}</p>
          <Button onClick={() => void plansQuery.refetch()}>{t('common.retry')}</Button>
        </FadeIn>
      )}

      {plansQuery.data && plansQuery.data.length === 0 && (
        <FadeIn className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-grad-primary-soft text-accent">
            <DumbbellIcon width={28} height={28} />
          </div>
          <p className="text-text-secondary">{t('plans.empty')}</p>
        </FadeIn>
      )}

      {plansQuery.data && plansQuery.data.length > 0 && (
        <Stagger className="flex flex-col gap-3 pb-2">
          {plansQuery.data.map((plan) => (
            <StaggerItem key={plan.id}>
              <PlanListItem
                plan={plan}
                onActivate={(id) => activateMutation.mutate(id)}
                onEdit={(id) => navigate(planEditPath(id))}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
