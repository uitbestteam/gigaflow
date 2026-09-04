import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ImageMimeType, type InbodyMetrics, type InbodyResult } from '@gigaflow/shared';
import { analyzeInbody, getInbodyJob, getLatestInbody } from '../../lib/api';
import { useJobPolling } from '../../lib/useJobPolling';
import { JobProgress } from '../../components/JobProgress';
import { ImagePickerInput } from '../../components/ImagePickerInput';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ProgressRing } from '../../components/ProgressRing';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { ChartIcon, UserIcon } from '../../components/icons';

interface MetricSpec {
  key: keyof InbodyMetrics;
  labelKey: string;
  unitKey?: string;
}

/** Ordered metric → i18n-key/unit mapping (spec §4.5). Only `weightKg` is
 * guaranteed present; every other field is rendered only when defined. */
const METRIC_SPECS: readonly MetricSpec[] = [
  { key: 'weightKg', labelKey: 'inbody.metric.weightKg', unitKey: 'inbody.unit.kg' },
  { key: 'bmi', labelKey: 'inbody.metric.bmi' },
  { key: 'bodyFatPercent', labelKey: 'inbody.metric.bodyFatPercent', unitKey: 'inbody.unit.percent' },
  { key: 'skeletalMuscleMassKg', labelKey: 'inbody.metric.skeletalMuscleMassKg', unitKey: 'inbody.unit.kg' },
  { key: 'bodyFatMassKg', labelKey: 'inbody.metric.bodyFatMassKg', unitKey: 'inbody.unit.kg' },
  { key: 'visceralFatLevel', labelKey: 'inbody.metric.visceralFatLevel' },
];

/** The headline metric gets a big animated ring; the rest are compact tiles. */
const RING_METRIC_KEY: MetricSpec['key'] = 'bodyFatPercent';

interface PickedImage {
  base64: string;
  mimeType: ImageMimeType;
}

function MetricTile({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] border border-border-subtle bg-surface p-3">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="tnum text-xl font-bold text-text">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-text-muted">{unit}</span> : null}
      </span>
    </div>
  );
}

/** InBody capture page (spec §4.5): shows the latest InBody result (if any)
 * as an animated stat-ring + tile grid, and lets the user pick + analyze a
 * new photo via the shared job-polling loop. */
export function InbodyPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const latestQuery = useQuery({ queryKey: ['inbodyLatest'], queryFn: () => getLatestInbody() });

  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [pickErrorKey, setPickErrorKey] = useState<string | null>(null);

  const { run, status, result: jobResult, error } = useJobPolling<InbodyResult | null, void>({
    start: () => {
      if (!picked) return Promise.reject(new Error('No image picked'));
      return analyzeInbody({ imageBase64: picked.base64, mimeType: picked.mimeType });
    },
    poll: getInbodyJob,
    fetchResult: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inbodyLatest'] });
      return getLatestInbody();
    },
  });

  const isBusy = status === 'submitting' || status === 'polling';

  const handlePicked = (base64: string, mimeType: ImageMimeType) => {
    setPickErrorKey(null);
    setPicked({ base64, mimeType });
  };

  const handlePickError = (msgKey: string) => {
    setPicked(null);
    setPickErrorKey(msgKey);
  };

  const handleAnalyze = () => {
    if (!picked || isBusy) return;
    void run();
  };

  // Prefer the just-finished job's own fetched result (avoids waiting on the
  // query cache's background refetch), falling back to the query's data.
  const result = status === 'done' && jobResult !== undefined ? jobResult : latestQuery.data;

  const ringSpec = METRIC_SPECS.find((spec) => spec.key === RING_METRIC_KEY);
  const ringValue = result?.metrics[RING_METRIC_KEY];
  const tileSpecs = METRIC_SPECS.filter((spec) => spec.key !== RING_METRIC_KEY);

  return (
    <div className="flex flex-col gap-5 p-4">
      <FadeIn>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-grad-primary shadow-glow-accent">
            <UserIcon className="text-white" width={22} height={22} />
          </span>
          <h1 className="text-lg font-extrabold tracking-tight text-text">{t('inbody.title')}</h1>
        </div>
      </FadeIn>

      {result ? (
        <FadeIn className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <ChartIcon width={16} height={16} />
            <span>{t('inbody.takenAt', { date: new Date(result.takenAt).toLocaleDateString() })}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {ringSpec && ringValue !== undefined && (
              <Card variant="glow" className="flex flex-col items-center gap-2 py-4">
                <ProgressRing value={ringValue / 100} size={96} strokeWidth={9}>
                  <span className="tnum text-lg font-bold text-text">
                    {ringValue}
                    <span className="ml-0.5 text-xs font-normal text-text-muted">{t('inbody.unit.percent')}</span>
                  </span>
                </ProgressRing>
                <span className="text-xs text-text-secondary">{t(ringSpec.labelKey)}</span>
              </Card>
            )}

            <Stagger className="grid flex-1 grid-cols-2 gap-3">
              {tileSpecs.map((spec) => {
                const value = result.metrics[spec.key];
                if (value === undefined) return null;
                return (
                  <StaggerItem key={spec.key}>
                    <MetricTile
                      label={t(spec.labelKey)}
                      value={value}
                      unit={spec.unitKey ? t(spec.unitKey) : undefined}
                    />
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </FadeIn>
      ) : (
        <p className="text-sm text-text-secondary">{t('inbody.noResult')}</p>
      )}

      <ImagePickerInput
        accept="image/png,image/jpeg"
        maxBase64Length={10_000_000}
        onPicked={handlePicked}
        onError={handlePickError}
      />

      {pickErrorKey && <span className="text-sm text-warning">{t(pickErrorKey)}</span>}

      <Button size="lg" fullWidth onClick={handleAnalyze} disabled={!picked || isBusy}>
        {t('inbody.analyze')}
      </Button>

      {isBusy && <JobProgress status={status} error={error} className="justify-center" />}

      {status === 'error' && !isBusy && <span className="text-sm text-warning">{error}</span>}
    </div>
  );
}
