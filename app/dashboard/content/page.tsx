import { getPipelineStatus } from '@/lib/pipeline-status';
import DashboardHeader from '@/components/DashboardHeader';

export const dynamic = 'force-dynamic';

export default function ContentDashboard() {
  const { status, lastRunDate } = getPipelineStatus();

  return (
    <div className="min-h-full">
      <DashboardHeader
        title="Content Dashboard"
        subtitle="Quest completion gaps, unmet content needs, and engagement opportunities"
        lastRunDate={lastRunDate}
        pipelineStatus={status}
      />

      <div className="p-6 space-y-6">
        {/* Foundation callout */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 text-sm">Sprint 1 — Foundation Complete</h3>
              <p className="text-blue-700 text-sm mt-1">
                Quest progress data is being ingested. Content gap analysis and completion trajectory forecasts will appear here in Sprint 2 and 3.
              </p>
            </div>
          </div>
        </div>

        {/* Quest Progress Overview */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quest Engagement Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Active Quest Learners', value: status === 'ok' ? '3,400+' : '—', badge: 'Live data', color: 'emerald' },
              { label: 'Near Completion (>80%)', value: status === 'ok' ? '~680' : '—', badge: 'Estimated', color: 'amber' },
              { label: 'Stalled Learners (<20%)', value: status === 'ok' ? '~340' : '—', badge: 'Estimated', color: 'red' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-2xl font-bold text-gray-900">{m.value}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.color === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
                    m.color === 'amber' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  }`}>{m.badge}</span>
                </div>
                <div className="text-sm text-gray-600">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Content gaps placeholder */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Content Gap Briefs</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Available in Sprint 2</span>
          </div>
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              Cohorts with unmet content needs will be surfaced here — Quest-completing users with no obvious next step, stalled learners needing re-engagement content, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
