import { getLatestPipelineRun, getSourceCountsForRun, SourceCounts } from './db';

export interface PipelineStatus {
  status: 'ok' | 'no_data' | 'error';
  lastRunDate: string | null;
  sourceCounts: SourceCounts | null;
  runId: number | null;
}

export function getPipelineStatus(): PipelineStatus {
  try {
    const latestRun = getLatestPipelineRun();

    if (!latestRun) {
      return { status: 'no_data', lastRunDate: null, sourceCounts: null, runId: null };
    }

    const sourceCounts = getSourceCountsForRun(latestRun.id);

    return {
      status: 'ok',
      lastRunDate: latestRun.run_date,
      sourceCounts,
      runId: latestRun.id,
    };
  } catch {
    return { status: 'error', lastRunDate: null, sourceCounts: null, runId: null };
  }
}
