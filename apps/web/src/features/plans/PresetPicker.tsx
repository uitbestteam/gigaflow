import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PlanTemplateType } from '@gigaflow/shared';
import { createPlanFromTemplate } from '../../lib/api';
import { Button, type ButtonVariant } from '../../components/Button';

const PRESETS: { type: PlanTemplateType; labelKey: 'presetPpl' | 'presetUpperLower' | 'presetFullBody' }[] = [
  { type: PlanTemplateType.PPL, labelKey: 'presetPpl' },
  { type: PlanTemplateType.UPPER_LOWER, labelKey: 'presetUpperLower' },
  { type: PlanTemplateType.FULL_BODY, labelKey: 'presetFullBody' },
];

export interface PresetPickerProps {
  onCreated?: () => void;
  variant?: ButtonVariant;
}

export function PresetPicker({ onCreated, variant = 'solid' }: PresetPickerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const createPlanMutation = useMutation({
    mutationFn: (templateType: PlanTemplateType) => createPlanFromTemplate(templateType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      void queryClient.invalidateQueries({ queryKey: ['activePlan'] });
      onCreated?.();
    },
  });

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.type}
          variant={variant}
          onClick={() => createPlanMutation.mutate(preset.type)}
          disabled={createPlanMutation.isPending}
        >
          {t(`home.${preset.labelKey}`)}
        </Button>
      ))}
    </div>
  );
}
