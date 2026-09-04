import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { Exercise } from '@gigaflow/shared';
import { getExercises, getPlan, createPlan, updatePlan } from '../../lib/api';
import { usePlanBuilderStore } from '../../store/planBuilderStore';
import { ROUTES } from '../../routes';
import { Button } from '../../components/Button';
import { SkeletonList } from '../../components/Skeleton';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { PlusIcon } from '../../components/icons';
import { TemplateEditor } from '../../components/TemplateEditor';
import { ExercisePickerModal } from '../../components/ExercisePickerModal';

export function PlanBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [pickerTemplateIndex, setPickerTemplateIndex] = useState<number | null>(null);

  const name = usePlanBuilderStore((s) => s.name);
  const templates = usePlanBuilderStore((s) => s.templates);
  const init = usePlanBuilderStore((s) => s.init);
  const reset = usePlanBuilderStore((s) => s.reset);
  const setName = usePlanBuilderStore((s) => s.setName);
  const addTemplate = usePlanBuilderStore((s) => s.addTemplate);
  const removeTemplate = usePlanBuilderStore((s) => s.removeTemplate);
  const setTemplateMeta = usePlanBuilderStore((s) => s.setTemplateMeta);
  const moveTemplate = usePlanBuilderStore((s) => s.moveTemplate);
  const addSlot = usePlanBuilderStore((s) => s.addSlot);
  const updateSlot = usePlanBuilderStore((s) => s.updateSlot);
  const removeSlot = usePlanBuilderStore((s) => s.removeSlot);
  const moveSlot = usePlanBuilderStore((s) => s.moveSlot);
  const toInput = usePlanBuilderStore((s) => s.toInput);

  const planQuery = useQuery({
    queryKey: ['plan', id],
    queryFn: () => getPlan(id as string),
    enabled: Boolean(id),
    // Defense-in-depth alongside the seeded-once guard below: a background
    // refetch (window refocus, manual invalidation elsewhere) must never
    // silently replace the user's in-progress edits.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => getExercises(),
  });

  const exercisesById = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const exercise of exercisesQuery.data ?? []) {
      map.set(exercise.id, exercise);
    }
    return map;
  }, [exercisesQuery.data]);

  // Seeds the builder store from the server copy exactly once per plan id
  // (or once for a blank "/plans/new" builder). `planQuery.data` gets a new
  // object reference on every refetch (window refocus, staleTime elapsing,
  // an invalidation fired elsewhere) — re-running `init()` on every such
  // emission would silently discard whatever the user has typed since the
  // first load. `seededKeyRef` remembers what we've already seeded for and
  // blocks re-seeding until the identity actually changes (a real
  // navigation to a different plan, or new -> edit).
  const seededKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = id ?? 'new';
    if (seededKeyRef.current === key) return;
    if (id) {
      if (!planQuery.data) return;
      init(planQuery.data);
    } else {
      init();
    }
    seededKeyRef.current = key;
  }, [id, planQuery.data, init]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const invalidateAfterSave = () => {
    void queryClient.invalidateQueries({ queryKey: ['plans'] });
    if (id && planQuery.data?.isActive) {
      void queryClient.invalidateQueries({ queryKey: ['activePlan'] });
    }
  };

  const createMutation = useMutation({
    mutationFn: () => createPlan(toInput()),
    onSuccess: () => {
      invalidateAfterSave();
      navigate(ROUTES.plans);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updatePlan(id as string, toInput()),
    onSuccess: () => {
      invalidateAfterSave();
      navigate(ROUTES.plans);
    },
  });

  function handleSave() {
    if (id) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  function handleCancel() {
    navigate(ROUTES.plans);
  }

  if (id && planQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <SkeletonList rows={3} />
      </div>
    );
  }

  if (id && planQuery.isError) {
    return (
      <FadeIn className="flex flex-col items-center gap-3 p-4 py-14 text-center">
        <p className="text-text-secondary">{t('builder.loadError')}</p>
        <Button onClick={() => void planQuery.refetch()}>{t('common.retry')}</Button>
      </FadeIn>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.isError || updateMutation.isError;

  return (
    <div className="flex flex-col gap-4 p-4">
      <FadeIn>
        <input
          type="text"
          className="min-h-11 w-full rounded-md border border-border-subtle bg-surface-2 px-3 text-lg font-semibold text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder={t('builder.planNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FadeIn>

      <Stagger className="flex flex-col gap-3">
        {templates.map((template, ti) => (
          <StaggerItem key={ti}>
            <TemplateEditor
              template={template}
              index={ti}
              exercisesById={exercisesById}
              currentLang={i18n.language}
              onNameChange={(value) => setTemplateMeta(ti, { name: { en: value, vi: value } })}
              onColorChange={(colorTag) => setTemplateMeta(ti, { colorTag })}
              onAddExercise={() => setPickerTemplateIndex(ti)}
              onRemove={() => removeTemplate(ti)}
              onMove={(dir) => moveTemplate(ti, dir)}
              onSlotChange={(si, patch) => updateSlot(ti, si, patch)}
              onSlotRemove={(si) => removeSlot(ti, si)}
              onSlotMove={(si, dir) => moveSlot(ti, si, dir)}
            />
          </StaggerItem>
        ))}
      </Stagger>

      <Button variant="outline" className="self-start" onClick={() => addTemplate()}>
        <PlusIcon width={16} height={16} />
        {t('builder.addDay')}
      </Button>

      {saveError && <p className="text-sm text-warning">{t('builder.saveError')}</p>}

      <div className="sticky bottom-24 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface/90 p-2 shadow-card backdrop-blur">
        <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
          {t('common.cancel')}
        </Button>
      </div>

      <ExercisePickerModal
        open={pickerTemplateIndex !== null}
        onPick={(exercise) => {
          if (pickerTemplateIndex !== null) addSlot(pickerTemplateIndex, exercise);
        }}
        onClose={() => setPickerTemplateIndex(null)}
      />
    </div>
  );
}
