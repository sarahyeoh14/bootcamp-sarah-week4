import Link from 'next/link';
import { getPipelineStatus } from '@/lib/pipeline-status';
import { getRankedPlannedReleases, computeForecastAccuracy } from '@/lib/releases';
import { getAllReleases } from '@/lib/db';
import DashboardHeader from '@/components/DashboardHeader';

export const dynamic = 'force-dynamic';

export default function ProductDashboard() {
  const { status, lastRunDate } = getPipelineStatus();
  const rankedPlanned = getRankedPlannedReleases();
  const allReleases = getAllReleases();
  const pastReleases = allReleases.filter(r => r.status === 'released');
  const accuracy = computeForecastAccuracy();

  return (
    <div className="min-h-full">
      <DashboardHeader
        title="Product Dashboard"
        subtitle="Feature prioritization, cohort impact signals, and release attribution"
        lastRunDate={lastRunDate}
        pipelineStatus={status}
      />

      <div className="p-6 space-y-6">
        {/* Quick-stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'Past Releases',
              value: pastReleases.length.toString(),
              detail: 'Last 90 days',
              href: '/dashboard/releases',
            },
            {
              label: 'Planned Features',
              value: rankedPlanned.length.toString(),
              detail: 'In pipeline',
              href: '/dashboard/releases',
            },
            {
              label: 'Forecast Accuracy',
              value: accuracy.historicalReleaseCount > 0 ? `${accuracy.averageAccuracyPct}%` : '—',
              detail: `From ${accuracy.historicalReleaseCount} releases`,
              href: '/dashboard/releases',
            },
            {
              label: 'Data Sources',
              value: status === 'ok' ? '4' : '0',
              detail: status === 'ok' ? 'All active' : 'Unavailable',
              href: '/dashboard/cohorts',
            },
          ].map(s => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all group"
            >
              <div className="text-2xl font-bold text-gray-900 group-hover:text-violet-700 transition-colors">{s.value}</div>
              <div className="text-sm font-medium text-gray-700 mt-0.5">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.detail}</div>
            </Link>
          ))}
        </div>

        {/* Feature Prioritization by Cohort Impact */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Feature Prioritization by Cohort Impact</h2>
              <p className="text-xs text-gray-500 mt-0.5">Planned features ranked by projected net cohort impact score</p>
            </div>
            <Link
              href="/dashboard/releases"
              className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors flex items-center gap-1"
            >
              View all
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>

          {rankedPlanned.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-3">No planned features yet.</p>
              <Link
                href="/dashboard/releases"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                Add a planned release
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rankedPlanned.slice(0, 5).map((item, idx) => {
                const score = item.netCohortImpactScore;
                const isPos = score > 0;
                const isNeg = score < 0;
                return (
                  <li key={item.release.id}>
                    <Link
                      href={`/dashboard/releases/${item.release.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                          {item.release.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{item.release.description}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={`text-sm font-semibold ${isPos ? 'text-emerald-600' : isNeg ? 'text-red-600' : 'text-gray-500'}`}>
                          {isPos ? '+' : ''}{score.toFixed(1)}
                        </span>
                        <div className="text-xs text-gray-400">impact score</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-violet-500 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent releases */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Recent Releases</h2>
              <p className="text-xs text-gray-500 mt-0.5">Click a release to see before/after KPI attribution</p>
            </div>
            <Link
              href="/dashboard/releases"
              className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors flex items-center gap-1"
            >
              View all
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>

          {pastReleases.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              No past releases found.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pastReleases.slice(0, 4).map(release => {
                const d = new Date(release.release_date + 'T00:00:00');
                const daysAgo = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <li key={release.id}>
                    <Link
                      href={`/dashboard/releases/${release.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                          {release.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{release.description}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <div className="text-xs text-gray-400">{daysAgo}d ago</div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Released</span>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Data snapshot */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Behavioral Data Available</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                label: 'Purchase History',
                value: status === 'ok' ? 'Active' : 'Unavailable',
                detail: 'Products, amounts, categories — 90-day window',
                ok: status === 'ok',
              },
              {
                label: 'Engagement Signals',
                value: status === 'ok' ? 'Active' : 'Unavailable',
                detail: 'Events across web, iOS, Android, email — 7-day window',
                ok: status === 'ok',
              },
              {
                label: 'Quest Progress',
                value: status === 'ok' ? 'Active' : 'Unavailable',
                detail: 'Completion %, last activity, start date per learner',
                ok: status === 'ok',
              },
              {
                label: 'Subscription Tiers',
                value: status === 'ok' ? 'Active' : 'Unavailable',
                detail: 'Free → All Access + Live tiers, renewal dates',
                ok: status === 'ok',
              },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
                <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${s.ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div>
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    {s.label}
                    <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${s.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {s.value}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
