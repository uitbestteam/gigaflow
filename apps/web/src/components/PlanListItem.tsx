import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Plan } from '@gigaflow/shared';
import { Card } from './Card';
import { Button } from './Button';

export interface PlanListItemProps {
  plan: Plan;
  onActivate: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

/**
 * A single row in the plans list: name + templateType label + an Active
 * badge when `plan.isActive`, plus Activate/Edit/Delete actions.
 *
 * Delete is guarded by an inline two-step confirm (Delete -> Confirm?)
 * rather than `window.confirm`, so tests stay pristine (no dialog noise)
 * and the UI stays fully keyboard/DOM-driven.
 */
export function PlanListItem({ plan, onActivate, onEdit, onDelete, className = '' }: PlanListItemProps) {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Card className={['flex items-center justify-between gap-3', className].filter(Boolean).join(' ')}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text">{plan.name}</span>
          {plan.isActive && (
            <span className="rounded-full bg-success px-2 py-0.5 text-xs font-medium text-white">
              {t('plans.activeBadge')}
            </span>
          )}
        </div>
        <span className="text-sm text-text-secondary">{t(`plans.templateType.${plan.templateType}`)}</span>
      </div>
      <div className="flex items-center gap-2">
        {!plan.isActive && (
          <Button variant="ghost" onClick={() => onActivate(plan.id)}>
            {t('plans.activate')}
          </Button>
        )}
        <Button variant="ghost" onClick={() => onEdit(plan.id)}>
          {t('plans.edit')}
        </Button>
        {confirmingDelete ? (
          <Button variant="ghost" onClick={() => onDelete(plan.id)}>
            {t('plans.confirmDelete')}
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            {t('plans.delete')}
          </Button>
        )}
      </div>
    </Card>
  );
}
