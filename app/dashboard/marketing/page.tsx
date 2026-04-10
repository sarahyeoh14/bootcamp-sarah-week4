import { getPipelineStatus } from '@/lib/pipeline-status';
import DashboardHeader from '@/components/DashboardHeader';
import {
  getRecommendationsByRole,
  getActOnStats,
  ensureRecommendationsTable,
  expireStaleRecommendations,
  seedRecommendationsIfEmpty,
} from '@/lib/recommendations';
import MarketingClient from './MarketingClient';

export const dynamic = 'force-dynamic';

export default function MarketingDashboard() {
  const { status, lastRunDate } = getPipelineStatus();

  ensureRecommendationsTable();
  expireStaleRecommendations();
  seedRecommendationsIfEmpty();

  const recommendations = getRecommendationsByRole('marketing');
  const stats = getActOnStats();

  return (
    <div className="min-h-full">
      <DashboardHeader
        title="Marketing Dashboard"
        subtitle="Cohort targeting, reactivation opportunities, and campaign recommendations"
        lastRunDate={lastRunDate}
        pipelineStatus={status}
      />
      <MarketingClient
        recommendations={recommendations}
        actOnRate={stats.ratePct}
        actedOnCount={stats.actedOn}
        totalCount={stats.total}
      />
    </div>
  );
}
