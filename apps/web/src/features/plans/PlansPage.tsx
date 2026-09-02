import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { activatePlan, deletePlan, getPlans } from '../../lib/api';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { PlanListItem } from '../../components/PlanListItem';
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">{t('plans.title')}</h1>
        <Button onClick={() => navigate(planNewPath())}>{t('plans.newPlan')}</Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-text-secondary">{t('plans.fromPreset')}</span>
        <PresetPicker />
      </div>

      {plansQuery.isLoading && (
        <div className="flex items-center justify-center p-8">
          <Spinner label={t('common.loading')} />
        </div>
      )}

      {plansQuery.isError && (
        <div>
          <p className="text-text-secondary">{t('plans.loadError')}</p>
          <Button className="mt-3" onClick={() => void plansQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {plansQuery.data && plansQuery.data.length === 0 && (
        <p className="text-text-secondary">{t('plans.empty')}</p>
      )}

      {plansQuery.data && plansQuery.data.length > 0 && (
        <div className="flex flex-col gap-2">
          {plansQuery.data.map((plan) => (
            <PlanListItem
              key={plan.id}
              plan={plan}
              onActivate={(id) => activateMutation.mutate(id)}
              onEdit={(id) => navigate(planEditPath(id))}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
