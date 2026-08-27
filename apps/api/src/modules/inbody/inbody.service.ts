import { GenerationType, JobStatus, zAnalyzeInbodyInput } from '@gigaflow/shared';
import type { VisionAnalyzer } from './vision.js';
import { analyzeInbody } from './inbody.engine.js';
import { createInbodyResult } from './inbody.repo.js';
import { rollbackUsage } from '../subscription/quota.service.js';
import { findJobById, setJobStatus } from '../workout/generation-job.repo.js';

export interface InbodyDeps {
  analyzer: VisionAnalyzer;
}

export async function processAnalyzeInbody(jobId: string, deps: InbodyDeps): Promise<void> {
  const job = await findJobById(jobId);
  if (!job) throw new Error(`GenerationJob ${jobId} not found`);
  const { userId } = job;

  try {
    await setJobStatus(jobId, { status: JobStatus.PROCESSING });

    const input = zAnalyzeInbodyInput.parse(job.input);

    const metrics = await analyzeInbody(deps.analyzer, {
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
    });

    const result = await createInbodyResult(userId, metrics);

    await setJobStatus(jobId, { status: JobStatus.DONE, resultId: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setJobStatus(jobId, { status: JobStatus.FAILED, error: message });
    await rollbackUsage(userId, GenerationType.INBODY);
    throw err;
  }
}
