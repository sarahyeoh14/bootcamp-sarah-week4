/**
 * Feature Release Impact Engine
 *
 * Computes:
 * - Before/after KPI comparison (WAU, weekly retention, revenue) around a release date
 * - Cohort attribution: which ML cohorts were most positively/negatively impacted
 * - Planned release forecasting: projects expected KPI change from historical averages
 * - Forecast accuracy metric: based on consistency (variance) of historical deltas
 */

import { getDb, getAllReleases, FeatureReleaseRow } from './db';
import { getMLCohorts } from './clustering';
import { getCustomerIdsForMlCohort } from './forecasting';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KpiSnapshot {
  wau: number;           // distinct active users in a 7-day window
  retentionPct: number;  // % of week-1 users who returned in week-2 (within 30-day window)
  revenue: number;       // total purchase amounts
}

export interface KpiComparison {
  before: KpiSnapshot;
  after: KpiSnapshot;
  wauDelta: number;
  retentionDelta: number;
  revenueDelta: number;
  wauDeltaPct: number;
  retentionDeltaPct: number;
  revenueDeltaPct: number;
}

export interface CohortImpact {
  cohortId: string;
  cohortName: string;
  cohortType: 'ml' | 'rule';
  impactScore: number;        // delta in avg engagement score
  direction: 'positive' | 'negative' | 'neutral';
  memberCount: number;
  beforeEngagement: number;
  afterEngagement: number;
}

export interface ReleaseDetail {
  release: FeatureReleaseRow;
  kpiComparison: KpiComparison | null;   // null for planned
  cohortImpacts: CohortImpact[];
  topPositive: CohortImpact[];
  topNegative: CohortImpact[];
}

export interface ForecastAccuracy {
  historicalReleaseCount: number;
  averageAccuracyPct: number;
  detail: string;
}

export interface PlannedReleaseForecast {
  forecastedWauDelta: number;
  forecastedWauDeltaPct: number;
  forecastedRetentionDelta: number;
  forecastedRetentionDeltaPct: number;
  forecastedRevenueDelta: number;
  forecastedRevenueDeltaPct: number;
  cohortForecasts: Array<{
    cohortId: string;
    cohortName: string;
    forecastedImpactScore: number;
    direction: 'positive' | 'negative' | 'neutral';
    memberCount: number;
  }>;
  accuracy: ForecastAccuracy;
}

export interface RankedPlannedRelease {
  release: FeatureReleaseRow;
  netCohortImpactScore: number;
  cohortForecasts: PlannedReleaseForecast['cohortForecasts'];
}

// ---------------------------------------------------------------------------
// KPI computation helpers
// ---------------------------------------------------------------------------

/**
 * Compute KPI snapshot for a 30-day window starting at `fromDate`.
 * WAU = distinct users with engagement signals in days 1-7 of the window.
 * Retention = % of WAU-week-1 users who also had engagement in days 8-14.
 * Revenue = sum of purchase amounts in the 30-day window.
 */
function computeKpiForWindow(fromDate: string, toDate: string): KpiSnapshot {
  const db = getDb();

  // WAU: distinct users active in the first 7 days of this window
  const wauWindow = addDays(fromDate, 7);
  const wauRow = db.prepare(`
    SELECT COUNT(DISTINCT customer_id) AS wau
    FROM engagement_signals
    WHERE recorded_date >= ? AND recorded_date < ?
  `).get(fromDate, wauWindow) as { wau: number };

  // Retention: users active in week 1 who came back in week 2
  const week2Start = addDays(fromDate, 7);
  const week2End = addDays(fromDate, 14);

  const week1UsersRows = db.prepare(`
    SELECT DISTINCT customer_id
    FROM engagement_signals
    WHERE recorded_date >= ? AND recorded_date < ?
  `).all(fromDate, wauWindow) as { customer_id: string }[];

  const week1Users = week1UsersRows.map(r => r.customer_id);
  let retentionPct = 0;
  if (week1Users.length > 0) {
    const placeholders = week1Users.map(() => '?').join(',');
    const retainedRow = db.prepare(`
      SELECT COUNT(DISTINCT customer_id) AS retained
      FROM engagement_signals
      WHERE customer_id IN (${placeholders})
        AND recorded_date >= ? AND recorded_date < ?
    `).get(...week1Users, week2Start, week2End) as { retained: number };
    retentionPct = Math.round((retainedRow.retained / week1Users.length) * 100);
  }

  // Revenue: sum of purchases in the full window
  const revenueRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM purchase_history
    WHERE purchased_at >= ? AND purchased_at < ?
  `).get(fromDate, toDate) as { total: number };

  return {
    wau: wauRow.wau,
    retentionPct,
    revenue: Math.round(revenueRow.total * 100) / 100,
  };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pctDelta(before: number, after: number): number {
  if (before === 0) return after > 0 ? 100 : 0;
  return Math.round(((after - before) / before) * 1000) / 10; // one decimal
}

// ---------------------------------------------------------------------------
// Before/after KPI comparison (AC2)
// ---------------------------------------------------------------------------

export function computeReleaseKpiComparison(releaseDate: string): KpiComparison {
  const beforeStart = addDays(releaseDate, -30);
  const beforeEnd = releaseDate;
  const afterStart = releaseDate;
  const afterEnd = addDays(releaseDate, 30);

  const before = computeKpiForWindow(beforeStart, beforeEnd);
  const after = computeKpiForWindow(afterStart, afterEnd);

  return {
    before,
    after,
    wauDelta: after.wau - before.wau,
    retentionDelta: after.retentionPct - before.retentionPct,
    revenueDelta: Math.round((after.revenue - before.revenue) * 100) / 100,
    wauDeltaPct: pctDelta(before.wau, after.wau),
    retentionDeltaPct: after.retentionPct - before.retentionPct, // already in pct points
    revenueDeltaPct: pctDelta(before.revenue, after.revenue),
  };
}

// ---------------------------------------------------------------------------
// Cohort impact attribution (AC3)
// ---------------------------------------------------------------------------

/**
 * For each ML cohort, compare average engagement event count per member
 * in 30 days before vs 30 days after the release date.
 * Rank by delta (impactScore).
 */
export function computeCohortImpacts(releaseDate: string): CohortImpact[] {
  const db = getDb();
  const mlCohorts = getMLCohorts();
  const impacts: CohortImpact[] = [];

  const beforeStart = addDays(releaseDate, -30);
  const afterEnd = addDays(releaseDate, 30);

  for (const cohort of mlCohorts) {
    const customerIds = getCustomerIdsForMlCohort(cohort.id);
    if (customerIds.length === 0) continue;

    const placeholders = customerIds.map(() => '?').join(',');

    // Avg engagement per member — before
    const beforeRow = db.prepare(`
      SELECT COALESCE(SUM(event_count), 0) AS total
      FROM engagement_signals
      WHERE customer_id IN (${placeholders})
        AND recorded_date >= ? AND recorded_date < ?
    `).get(...customerIds, beforeStart, releaseDate) as { total: number };

    // Avg engagement per member — after
    const afterRow = db.prepare(`
      SELECT COALESCE(SUM(event_count), 0) AS total
      FROM engagement_signals
      WHERE customer_id IN (${placeholders})
        AND recorded_date >= ? AND recorded_date < ?
    `).get(...customerIds, releaseDate, afterEnd) as { total: number };

    const beforeAvg = customerIds.length > 0 ? beforeRow.total / customerIds.length : 0;
    const afterAvg = customerIds.length > 0 ? afterRow.total / customerIds.length : 0;
    const delta = afterAvg - beforeAvg;
    const impactScore = Math.round(delta * 100) / 100;

    let direction: 'positive' | 'negative' | 'neutral';
    if (impactScore > 0.1) direction = 'positive';
    else if (impactScore < -0.1) direction = 'negative';
    else direction = 'neutral';

    impacts.push({
      cohortId: cohort.id,
      cohortName: cohort.name,
      cohortType: 'ml',
      impactScore,
      direction,
      memberCount: customerIds.length,
      beforeEngagement: Math.round(beforeAvg * 100) / 100,
      afterEngagement: Math.round(afterAvg * 100) / 100,
    });
  }

  // Sort by impactScore descending
  impacts.sort((a, b) => b.impactScore - a.impactScore);
  return impacts;
}

// ---------------------------------------------------------------------------
// Historical average deltas (for forecasting)
// ---------------------------------------------------------------------------

interface HistoricalDelta {
  wauDeltaPct: number;
  retentionDeltaPct: number;
  revenueDeltaPct: number;
  cohortDeltas: Map<string, number>; // cohortId → avg engagement delta
}

function computeHistoricalDeltas(): HistoricalDelta[] {
  const releases = getAllReleases().filter(r => r.status === 'released');
  const deltas: HistoricalDelta[] = [];

  for (const release of releases) {
    try {
      const comparison = computeReleaseKpiComparison(release.release_date);
      const cohortImpacts = computeCohortImpacts(release.release_date);

      const cohortDeltas = new Map<string, number>();
      for (const ci of cohortImpacts) {
        cohortDeltas.set(ci.cohortId, ci.impactScore);
      }

      deltas.push({
        wauDeltaPct: comparison.wauDeltaPct,
        retentionDeltaPct: comparison.retentionDeltaPct,
        revenueDeltaPct: comparison.revenueDeltaPct,
        cohortDeltas,
      });
    } catch {
      // Skip releases with insufficient data
    }
  }

  return deltas;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function variance(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = avg(nums);
  return avg(nums.map(n => (n - mean) ** 2));
}

// ---------------------------------------------------------------------------
// Forecast accuracy (AC6)
// ---------------------------------------------------------------------------

export function computeForecastAccuracy(): ForecastAccuracy {
  const releases = getAllReleases().filter(r => r.status === 'released');
  const historicalReleaseCount = releases.length;

  if (historicalReleaseCount === 0) {
    return {
      historicalReleaseCount: 0,
      averageAccuracyPct: 0,
      detail: 'No historical releases available to compute accuracy.',
    };
  }

  const deltas = computeHistoricalDeltas();
  if (deltas.length === 0) {
    return {
      historicalReleaseCount,
      averageAccuracyPct: 50,
      detail: `Based on ${historicalReleaseCount} historical releases. Insufficient data for accuracy estimate.`,
    };
  }

  const wauVars = variance(deltas.map(d => d.wauDeltaPct));
  const retVars = variance(deltas.map(d => d.retentionDeltaPct));
  const revVars = variance(deltas.map(d => d.revenueDeltaPct));

  // Normalize variance to 0-100 accuracy scale:
  // Higher variance = lower accuracy. Max useful variance ~400 (std dev ~20%)
  const MAX_VAR = 400;
  const avgVar = (wauVars + retVars + revVars) / 3;
  const accuracyPct = Math.round(Math.max(10, Math.min(95, 95 - (avgVar / MAX_VAR) * 85)));

  return {
    historicalReleaseCount,
    averageAccuracyPct: accuracyPct,
    detail: `Projected from ${historicalReleaseCount} historical releases. Accuracy is derived from consistency of before/after KPI deltas — lower variance in past releases yields a higher accuracy score.`,
  };
}

// ---------------------------------------------------------------------------
// Planned release forecast (AC5)
// ---------------------------------------------------------------------------

export function computePlannedReleaseForecast(releaseId: number): PlannedReleaseForecast {
  const deltas = computeHistoricalDeltas();
  const accuracy = computeForecastAccuracy();
  const mlCohorts = getMLCohorts();

  // Average KPI deltas across historical releases
  const forecastedWauDeltaPct = Math.round(avg(deltas.map(d => d.wauDeltaPct)) * 10) / 10;
  const forecastedRetentionDeltaPct = Math.round(avg(deltas.map(d => d.retentionDeltaPct)) * 10) / 10;
  const forecastedRevenueDeltaPct = Math.round(avg(deltas.map(d => d.revenueDeltaPct)) * 10) / 10;

  // For each ML cohort, compute avg expected impact from historical data
  const cohortForecasts = mlCohorts.map(cohort => {
    const historicalImpacts = deltas
      .map(d => d.cohortDeltas.get(cohort.id))
      .filter((v): v is number => v !== undefined);

    const forecastedScore = historicalImpacts.length > 0
      ? Math.round(avg(historicalImpacts) * 100) / 100
      : 0;

    let direction: 'positive' | 'negative' | 'neutral';
    if (forecastedScore > 0.05) direction = 'positive';
    else if (forecastedScore < -0.05) direction = 'negative';
    else direction = 'neutral';

    const customerIds = getCustomerIdsForMlCohort(cohort.id);

    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      forecastedImpactScore: forecastedScore,
      direction,
      memberCount: customerIds.length,
    };
  });

  // Sort by forecasted impact score descending
  cohortForecasts.sort((a, b) => b.forecastedImpactScore - a.forecastedImpactScore);

  // Fake baseline WAU/revenue to compute absolute deltas from percentages
  // Use current real baseline for display
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = addDays(today, -30);
  const baselineKpi = computeKpiForWindow(thirtyDaysAgo, today);

  const forecastedWauDelta = Math.round(baselineKpi.wau * forecastedWauDeltaPct / 100);
  const forecastedRevenueDelta = Math.round(baselineKpi.revenue * forecastedRevenueDeltaPct / 100 * 100) / 100;
  const forecastedRetentionDelta = forecastedRetentionDeltaPct;

  return {
    forecastedWauDelta,
    forecastedWauDeltaPct,
    forecastedRetentionDelta,
    forecastedRetentionDeltaPct,
    forecastedRevenueDelta,
    forecastedRevenueDeltaPct,
    cohortForecasts,
    accuracy,
  };
}

// ---------------------------------------------------------------------------
// Planned releases ranked by projected net cohort impact (AC7)
// ---------------------------------------------------------------------------

export function getRankedPlannedReleases(): RankedPlannedRelease[] {
  const releases = getAllReleases().filter(r => r.status === 'planned');
  const deltas = computeHistoricalDeltas();

  const mlCohorts = getMLCohorts();

  const ranked: RankedPlannedRelease[] = releases.map(release => {
    const cohortForecasts = mlCohorts.map(cohort => {
      const historicalImpacts = deltas
        .map(d => d.cohortDeltas.get(cohort.id))
        .filter((v): v is number => v !== undefined);

      const forecastedScore = historicalImpacts.length > 0
        ? Math.round(avg(historicalImpacts) * 100) / 100
        : 0;

      let direction: 'positive' | 'negative' | 'neutral';
      if (forecastedScore > 0.05) direction = 'positive';
      else if (forecastedScore < -0.05) direction = 'negative';
      else direction = 'neutral';

      const customerIds = getCustomerIdsForMlCohort(cohort.id);

      return {
        cohortId: cohort.id,
        cohortName: cohort.name,
        forecastedImpactScore: forecastedScore,
        direction,
        memberCount: customerIds.length,
      };
    });

    // Net cohort impact score = sum of positive impacts - sum of |negative impacts|
    // Weighted by member count
    const netScore = cohortForecasts.reduce((acc, cf) => {
      const weightedImpact = cf.forecastedImpactScore * cf.memberCount;
      return acc + weightedImpact;
    }, 0);

    return {
      release,
      netCohortImpactScore: Math.round(netScore * 100) / 100,
      cohortForecasts,
    };
  });

  // Sort highest net impact first
  ranked.sort((a, b) => b.netCohortImpactScore - a.netCohortImpactScore);
  return ranked;
}

// ---------------------------------------------------------------------------
// Full release detail (AC2 + AC3 combined)
// ---------------------------------------------------------------------------

export function getReleaseDetail(release: FeatureReleaseRow): ReleaseDetail {
  if (release.status === 'released') {
    const kpiComparison = computeReleaseKpiComparison(release.release_date);
    const cohortImpacts = computeCohortImpacts(release.release_date);

    const positiveImpacts = cohortImpacts.filter(c => c.direction === 'positive').slice(0, 2);
    const negativeImpacts = cohortImpacts.filter(c => c.direction === 'negative').slice(0, 2);

    return {
      release,
      kpiComparison,
      cohortImpacts,
      topPositive: positiveImpacts,
      topNegative: negativeImpacts,
    };
  } else {
    // Planned — no historical KPI comparison
    const cohortImpacts = computeCohortImpacts(new Date().toISOString().slice(0, 10));
    return {
      release,
      kpiComparison: null,
      cohortImpacts,
      topPositive: cohortImpacts.filter(c => c.direction === 'positive').slice(0, 2),
      topNegative: cohortImpacts.filter(c => c.direction === 'negative').slice(0, 2),
    };
  }
}
