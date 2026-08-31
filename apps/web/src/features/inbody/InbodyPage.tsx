import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ImageMimeType, type InbodyMetrics, type InbodyResult } from '@gigaflow/shared';
import { analyzeInbody, getInbodyJob, getLatestInbody } from '../../lib/api';
import { useJobPolling } from '../../lib/useJobPolling';
import { JobProgress } from '../../components/JobProgress';
import { ImagePickerInput } from '../../components/ImagePickerInput';
import { StatTile } from '../../components/StatTile';
import { Button } from '../../components/Button';

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

interface PickedImage {
  base64: string;
  mimeType: ImageMimeType;
}

/** InBody capture page (spec §4.5): shows the latest InBody result (if any)
 * as a grid of metric tiles, and lets the user pick + analyze a new photo
 * via the shared job-polling loop. */
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
  const result = (status === 'done' ? jobResult : undefined) ?? latestQuery.data;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-text">{t('inbody.title')}</h1>

      {result ? (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-text-secondary">
            {t('inbody.takenAt', { date: new Date(result.takenAt).toLocaleDateString() })}
          </span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {METRIC_SPECS.map((spec) => {
              const value = result.metrics[spec.key];
              if (value === undefined) return null;
              return (
                <StatTile
                  key={spec.key}
                  label={t(spec.labelKey)}
                  value={value}
                  unit={spec.unitKey ? t(spec.unitKey) : undefined}
                />
              );
            })}
          </div>
        </div>
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

      <Button onClick={handleAnalyze} disabled={!picked || isBusy}>
        {t('inbody.analyze')}
      </Button>

      {isBusy && <JobProgress status={status} error={error} />}

      {status === 'error' && !isBusy && <span className="text-sm text-warning">{error}</span>}
    </div>
  );
}
