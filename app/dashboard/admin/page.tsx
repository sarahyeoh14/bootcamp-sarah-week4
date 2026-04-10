import { getPipelineStatus } from '@/lib/pipeline-status';
import { getAllPipelineRuns, getSourceCountsForRun, getCumulativeSourceCounts } from '@/lib/db';
import DashboardHeader from '@/components/DashboardHeader';
import RunPipelineButton from '@/components/RunPipelineButton';

export const dynamic = 'force-dynamic';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminDashboard() {
  const { status, lastRunDate } = getPipelineStatus();
  const allRuns = getAllPipelineRuns();
  const sourceCounts = status !== 'no_data' ? getCumulativeSourceCounts() : null;

  return (
    <div className="min-h-full">
      <DashboardHeader
        title="Admin — Pipeline Monitor"
        subtitle="Data ingestion status, record counts, and pipeline run history"
        lastRunDate={lastRunDate}
        pipelineStatus={status}
      />

      <div className="p-6 space-y-6">
        {/* Run Pipeline button */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Data Sources</h2>
          <RunPipelineButton />
        </div>

        {/* Source record counts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              key: 'purchase_history' as const,
              label: 'Purchase History',
              icon: (
                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              ),
              color: 'violet',
            },
            {
              key: 'quest_progress' as const,
              label: 'Quest Progress',
              icon: (
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              ),
              color: 'blue',
            },
            {
              key: 'engagement_signals' as const,
              label: 'Engagement Signals',
              icon: (
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
              ),
              color: 'emerald',
            },
            {
              key: 'subscription_tiers' as const,
              label: 'Subscription Tiers',
              icon: (
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              ),
              color: 'amber',
            },
          ].map(source => {
            const count = sourceCounts ? sourceCounts[source.key] : null;
            const colorMap: Record<string, string> = {
              violet: 'bg-violet-50',
              blue: 'bg-blue-50',
              emerald: 'bg-emerald-50',
              amber: 'bg-amber-50',
            };

            return (
              <div key={source.key} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className={`w-10 h-10 rounded-lg ${colorMap[source.color]} flex items-center justify-center mb-4`}>
                  {source.icon}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-0.5 tabular-nums">
                  {count !== null ? count.toLocaleString() : (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
                <div className="text-sm font-medium text-gray-700">{source.label}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {status === 'no_data' ? 'No pipeline runs yet' : 'Total records (all runs)'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pipeline run history */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Pipeline Run History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 10 pipeline executions</p>
          </div>

          {allRuns.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium">No pipeline runs yet</p>
              <p className="text-gray-400 text-xs mt-1">Click &ldquo;Run Pipeline Now&rdquo; to ingest data from all four sources.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Run ID</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Data Date</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Completed</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Purchases</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Quests</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Signals</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Subscriptions</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allRuns.map(run => {
                    const counts = run.status === 'success' ? getSourceCountsForRun(run.id) : null;
                    return (
                      <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">#{run.id}</td>
                        <td className="px-5 py-3.5 text-gray-700 font-medium">{run.run_date}</td>
                        <td className="px-5 py-3.5 text-gray-500">{formatDate(run.completed_at)}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{counts ? counts.purchase_history.toLocaleString() : '—'}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{counts ? counts.quest_progress.toLocaleString() : '—'}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{counts ? counts.engagement_signals.toLocaleString() : '—'}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{counts ? counts.subscription_tiers.toLocaleString() : '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            run.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : run.status === 'failed'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              run.status === 'success' ? 'bg-emerald-400' :
                              run.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                            }`} />
                            {run.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-2">Running the Pipeline via CLI</h3>
          <p className="text-slate-600 text-sm mb-3">
            The pipeline can also be triggered from the terminal. Each run ingests fresh mock data from all four sources and updates the freshness indicator across all dashboards.
          </p>
          <code className="block bg-slate-900 text-emerald-400 text-xs px-4 py-3 rounded-lg font-mono">
            pnpm pipeline
          </code>
        </div>
      </div>
    </div>
  );
}
