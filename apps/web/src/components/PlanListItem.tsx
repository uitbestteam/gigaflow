import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlanTemplateType, type Plan } from '@gigaflow/shared';
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
 * Color-codes each plan row by its split, reusing the push/pull/legs
 * identity tokens (no new tokens introduced): PPL leans on push (rose),
 * upper/lower on pull (green), full body on legs (amber). Custom plans stay
 * on the neutral accent gradient.
 */
const SPLIT_ACCENT: Record<PlanTemplateType, string> = {
  [PlanTemplateType.PPL]: 'bg-grad-push',
  [PlanTemplateType.UPPER_LOWER]: 'bg-grad-pull',
  [PlanTemplateType.FULL_BODY]: 'bg-grad-legs',
  [PlanTemplateType.CUSTOM]: 'bg-grad-primary',
};

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
    <Card
      variant={plan.isActive ? 'glow' : 'default'}
      className={['relative overflow-hidden pl-5', className].filter(Boolean).join(' ')}
    >
      <span
        aria-hidden="true"
        className={['absolute inset-y-0 left-0 w-1.5', SPLIT_ACCENT[plan.templateType]].join(' ')}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-text">{plan.name}</span>
            {plan.isActive && (
              <span className="shrink-0 rounded-pill bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">
                {t('plans.activeBadge')}
              </span>
            )}
          </div>
          <span className="text-sm text-text-secondary">{t(`plans.templateType.${plan.templateType}`)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!plan.isActive && (
            <Button variant="ghost" size="sm" onClick={() => onActivate(plan.id)}>
              {t('plans.activate')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit(plan.id)}>
            {t('plans.edit')}
          </Button>
          {confirmingDelete ? (
            <Button variant="danger" size="sm" onClick={() => onDelete(plan.id)}>
              {t('plans.confirmDelete')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
              {t('plans.delete')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
