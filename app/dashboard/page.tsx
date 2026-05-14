import Link from 'next/link';
import { getJourneyFunnel } from '@/lib/journey';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';
import { getPipelineStatus } from '@/lib/pipeline-status';

export const dynamic = 'force-dynamic';

function fmt(n: number) {
  return n.toLocaleString();
}

const STAGES = [
  {
    key: 'acquisition',
    label: 'Acquisition',
    path: '/dashboard/acquisition',
    description: 'Active subscribers',
    bgCard: 'bg-sky-50',
    border: 'border-sky-200',
    numColor: 'text-sky-700',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    iconColor: 'text-sky-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    key: 'activation',
    label: 'Activation',
    path: '/dashboard/activation',
    description: 'Logged in this month',
    bgCard: 'bg-violet-50',
    border: 'border-violet-200',
    numColor: 'text-violet-700',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    iconColor: 'text-violet-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    key: 'transform',
    label: 'Transform',
    path: '/dashboard/transform',
    description: 'Made content progress',
    bgCard: 'bg-emerald-50',
    border: 'border-emerald-200',
    numColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    iconColor: 'text-emerald-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    key: 'ai-adoption',
    label: 'EVE Adoption',
    path: '/dashboard/ai-adoption',
    description: 'Used EVE this month',
    bgCard: 'bg-amber-50',
    border: 'border-amber-200',
    numColor: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    iconColor: 'text-amber-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
] as const;

export default function DashboardPage() {
  const { status, lastRunDate } = getPipelineStatus();
  const f = getJourneyFunnel();

  const stageCounts = [f.active, f.loggedIn, f.hasProgress, f.eveUsers];
  const stageRates = [null, f.loginRate, f.progressRate, f.eveRate];

  // MoM change for active subscribers
  const prev = f.trend.length >= 2 ? f.trend[f.trend.length - 2] : null;
  const activeMoM = prev && prev.active > 0 ? Math.round(((f.active - prev.active) / prev.active) * 100) : null;

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Customer Journey</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-500">
                Snapshot: <span className="font-medium text-gray-700">{f.monthLabel}</span>
              </p>
              {activeMoM !== null && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${activeMoM >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {activeMoM >= 0 ? '+' : ''}{activeMoM}% MoM
                </span>
              )}
            </div>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Funnel cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAGES.map((stage, i) => {
            const count = stageCounts[i];
            const rate = stageRates[i];
            return (
              <Link
                key={stage.key}
                href={stage.path}
                className={`relative rounded-xl border p-5 hover:shadow-md transition-all group ${stage.bgCard} ${stage.border}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={stage.iconColor}>{stage.icon}</span>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${stage.badgeText}`}>
                    {stage.label}
                  </span>
                </div>
                <div className={`text-3xl font-bold ${stage.numColor} mb-1`}>{fmt(count)}</div>
                <div className="text-xs text-gray-500">{stage.description}</div>
                {rate !== null && (
                  <div className={`mt-3 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${stage.badgeBg} ${stage.badgeText}`}>
                    {rate}% of active
                  </div>
                )}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className={`w-4 h-4 ${stage.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 6-month trend */}
        {f.trend.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">6-Month Trend</h2>
              <p className="text-xs text-gray-500 mt-0.5">Monthly snapshot across all journey stages</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-medium">Month</th>
                    <th className="text-right px-4 py-3 font-medium text-sky-600">Active</th>
                    <th className="text-right px-4 py-3 font-medium text-violet-600">Login %</th>
                    <th className="text-right px-4 py-3 font-medium text-emerald-600">Progress %</th>
                    <th className="text-right px-4 py-3 font-medium text-amber-600">EVE %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {f.trend.map((row, i) => {
                    const isLatest = i === f.trend.length - 1;
                    return (
                      <tr key={row.month} className={`${isLatest ? 'bg-gray-50' : 'hover:bg-gray-50'} transition-colors`}>
                        <td className="px-5 py-3 font-medium text-gray-700">
                          {row.label}
                          {isLatest && <span className="ml-2 text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">Latest</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-sky-700">{fmt(row.active)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${row.loginRate >= 40 ? 'text-violet-700' : row.loginRate >= 30 ? 'text-gray-700' : 'text-red-500'}`}>
                            {row.loginRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${row.progressRate >= 20 ? 'text-emerald-700' : 'text-gray-500'}`}>
                            {row.progressRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${row.eveRate >= 5 ? 'text-amber-600' : row.eveRate > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                            {row.eveRate > 0 ? `${row.eveRate}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Key signals */}
        {f.hasData && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Key Signals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Login gap */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activation Gap</span>
                </div>
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-gray-900">{fmt(f.active - f.loggedIn)}</span> active subscribers didn't log in this month
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Login rate has been declining — was 44% in mid-2025</p>
                <Link href="/dashboard/activation" className="inline-flex items-center gap-1 mt-3 text-xs text-violet-600 font-medium hover:text-violet-800">
                  View activation →
                </Link>
              </div>

              {/* Progress gap */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transform Gap</span>
                </div>
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-gray-900">{fmt(f.loggedIn - f.hasProgress)}</span> members logged in but didn't engage with content
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Content progress rate dropped from 26% (mid-2025) to {f.progressRate}%</p>
                <Link href="/dashboard/transform" className="inline-flex items-center gap-1 mt-3 text-xs text-emerald-600 font-medium hover:text-emerald-800">
                  View transform →
                </Link>
              </div>

              {/* EVE opportunity */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">EVE Opportunity</span>
                </div>
                <p className="text-sm text-gray-700">
                  Only <span className="font-bold text-gray-900">{f.eveRate}%</span> of subscribers used EVE this month
                </p>
                <p className="text-xs text-gray-400 mt-1.5">EVE launched Aug 2025. April 2026 is the highest adoption yet at {f.eveRate}%</p>
                <Link href="/dashboard/ai-adoption" className="inline-flex items-center gap-1 mt-3 text-xs text-amber-600 font-medium hover:text-amber-800">
                  View EVE adoption →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
