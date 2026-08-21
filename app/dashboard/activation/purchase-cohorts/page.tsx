import Link from 'next/link';
import { seedPurchaseMetricsIfNeeded } from '@/lib/purchase-metrics';
import PurchaseCohortsClient from './PurchaseCohortsClient';

export const dynamic = 'force-dynamic';

export default function PurchaseCohortsPage() {
  seedPurchaseMetricsIfNeeded();

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">Journey</Link>
              <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <Link href="/dashboard/activation" className="text-xs text-gray-400 hover:text-gray-600">Activation</Link>
              <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-xs text-violet-600 font-medium">Product North Star</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Product North Star</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Weekly cohorts · last 26 weeks
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <PurchaseCohortsClient />
      </div>
    </div>
  );
}
