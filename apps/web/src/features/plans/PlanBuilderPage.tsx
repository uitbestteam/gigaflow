import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { Exercise } from '@gigaflow/shared';
import { getExercises, getPlan, createPlan, updatePlan } from '../../lib/api';
import { usePlanBuilderStore } from '../../store/planBuilderStore';
import { ROUTES } from '../../routes';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
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
      <div className="flex items-center justify-center p-8">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  if (id && planQuery.isError) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-text-secondary">{t('builder.loadError')}</p>
        <Button onClick={() => void planQuery.refetch()}>{t('common.retry')}</Button>
      </div>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4 p-4">
      <input
        type="text"
        className="min-h-11 w-full rounded-[10px] border border-border-subtle bg-surface-elevated px-3 text-lg font-semibold text-text"
        placeholder={t('builder.planNamePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex flex-col gap-3">
        {templates.map((template, ti) => (
          <TemplateEditor
            key={ti}
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
        ))}
      </div>

      <Button variant="ghost" className="self-start" onClick={() => addTemplate()}>
        {t('builder.addDay')}
      </Button>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={isSaving}>
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
