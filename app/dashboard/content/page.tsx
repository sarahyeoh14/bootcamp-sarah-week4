import { getPipelineStatus } from '@/lib/pipeline-status';
import DashboardHeader from '@/components/DashboardHeader';
import {
  getRecommendationsByRole,
  getActOnStats,
  ensureRecommendationsTable,
  expireStaleRecommendations,
  seedRecommendationsIfEmpty,
} from '@/lib/recommendations';
import ContentClient from './ContentClient';

export const dynamic = 'force-dynamic';

export default function ContentDashboard() {
  const { status, lastRunDate } = getPipelineStatus();

  ensureRecommendationsTable();
  expireStaleRecommendations();
  seedRecommendationsIfEmpty();

  const recommendations = getRecommendationsByRole('content');
  const stats = getActOnStats();

  return (
    <div className="min-h-full">
      <DashboardHeader
        title="Content Dashboard"
        subtitle="Quest completion gaps, unmet content needs, and engagement opportunities"
        lastRunDate={lastRunDate}
        pipelineStatus={status}
      />
      <ContentClient
        recommendations={recommendations}
        actOnRate={stats.ratePct}
        actedOnCount={stats.actedOn}
        totalCount={stats.total}
      />
    </div>
  );
}
