/**
 * K-means clustering engine for ML-driven cohort identification.
 *
 * Features used per customer:
 *   - avgEngagementEventsPerWeek
 *   - avgQuestCompletionPct
 *   - subscriptionTierLevel (0-4)
 *   - totalPurchaseAmount
 *   - daysSinceLastActivity
 *
 * Produces 5 named clusters with meaningful business labels.
 */

import { getDb } from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomerFeatures {
  customerId: string;
  avgEngagementPerWeek: number;
  avgQuestCompletion: number;
  tierLevel: number;
  totalPurchaseAmount: number;
  daysSinceLastActivity: number;
}

export interface MlCohort {
  id: string; // slug like "high-value-engaged"
  name: string;
  memberCount: number;
  summary: string;
  topSignals: TopSignal[];
  centroid: number[];
}

export interface TopSignal {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Named cluster definitions (index → display info)
// ---------------------------------------------------------------------------

const CLUSTER_META: Array<{ id: string; name: string; summaryTemplate: (c: MlCohort, avg: number[]) => string }> = [
  {
    id: 'high-value-engaged',
    name: 'High-Value Engaged',
    summaryTemplate: (c) =>
      `High engagement, active purchasers — ${c.memberCount.toLocaleString()} members`,
  },
  {
    id: 'quest-graduates',
    name: 'Quest Graduates',
    summaryTemplate: (c) =>
      `Near or past quest completion — ${c.memberCount.toLocaleString()} members`,
  },
  {
    id: 'at-risk-disengaged',
    name: 'At-Risk Disengaged',
    summaryTemplate: (c) =>
      `Low recent activity, disengaging — ${c.memberCount.toLocaleString()} members`,
  },
  {
    id: 'new-joiners',
    name: 'New Joiners',
    summaryTemplate: (c) =>
      `Recent starts, low quest completion — ${c.memberCount.toLocaleString()} members`,
  },
  {
    id: 'passive-subscribers',
    name: 'Passive Subscribers',
    summaryTemplate: (c) =>
      `Active subscription, low engagement — ${c.memberCount.toLocaleString()} members`,
  },
];

// ---------------------------------------------------------------------------
// Data extraction
// ---------------------------------------------------------------------------

function extractCustomerFeatures(): CustomerFeatures[] {
  const db = getDb();

  // Get all unique customer IDs that appear in any table
  const customers = db.prepare(`
    SELECT DISTINCT customer_id FROM subscription_tiers
    UNION
    SELECT DISTINCT customer_id FROM quest_progress
    UNION
    SELECT DISTINCT customer_id FROM purchase_history
    UNION
    SELECT DISTINCT customer_id FROM engagement_signals
  `).all() as { customer_id: string }[];

  if (customers.length === 0) return [];

  // Engagement events per customer in the last 7 days (weekly avg)
  const engagementMap = new Map<string, number>();
  const engRows = db.prepare(`
    SELECT customer_id, SUM(event_count) as total_events
    FROM engagement_signals
    WHERE recorded_date >= datetime('now', '-7 days')
    GROUP BY customer_id
  `).all() as { customer_id: string; total_events: number }[];
  for (const row of engRows) {
    engagementMap.set(row.customer_id, row.total_events / 1); // 1 week window → per-week count
  }

  // Avg quest completion
  const questMap = new Map<string, number>();
  const questRows = db.prepare(`
    SELECT customer_id, AVG(completion_percentage) as avg_completion
    FROM quest_progress
    GROUP BY customer_id
  `).all() as { customer_id: string; avg_completion: number }[];
  for (const row of questRows) {
    questMap.set(row.customer_id, row.avg_completion);
  }

  // Latest subscription tier
  const tierMap = new Map<string, number>();
  const tierRows = db.prepare(`
    SELECT customer_id, MAX(tier_level) as tier_level
    FROM subscription_tiers
    WHERE is_active = 1
    GROUP BY customer_id
  `).all() as { customer_id: string; tier_level: number }[];
  for (const row of tierRows) {
    tierMap.set(row.customer_id, row.tier_level);
  }

  // Total purchase amount
  const purchaseMap = new Map<string, number>();
  const purchaseRows = db.prepare(`
    SELECT customer_id, SUM(amount) as total_amount
    FROM purchase_history
    GROUP BY customer_id
  `).all() as { customer_id: string; total_amount: number }[];
  for (const row of purchaseRows) {
    purchaseMap.set(row.customer_id, row.total_amount);
  }

  // Days since last activity (from quest and engagement)
  const lastActivityMap = new Map<string, number>();
  const lastQuestRows = db.prepare(`
    SELECT customer_id, MAX(last_activity_at) as last_at
    FROM quest_progress
    GROUP BY customer_id
  `).all() as { customer_id: string; last_at: string }[];
  for (const row of lastQuestRows) {
    const days = daysDiff(row.last_at);
    lastActivityMap.set(row.customer_id, days);
  }
  const lastEngRows = db.prepare(`
    SELECT customer_id, MAX(recorded_date) as last_at
    FROM engagement_signals
    GROUP BY customer_id
  `).all() as { customer_id: string; last_at: string }[];
  for (const row of lastEngRows) {
    const days = daysDiff(row.last_at);
    const existing = lastActivityMap.get(row.customer_id);
    // Take the more recent (smaller days value)
    if (existing === undefined || days < existing) {
      lastActivityMap.set(row.customer_id, days);
    }
  }

  return customers.map(({ customer_id }) => ({
    customerId: customer_id,
    avgEngagementPerWeek: engagementMap.get(customer_id) ?? 0,
    avgQuestCompletion: questMap.get(customer_id) ?? 0,
    tierLevel: tierMap.get(customer_id) ?? 0,
    totalPurchaseAmount: purchaseMap.get(customer_id) ?? 0,
    daysSinceLastActivity: lastActivityMap.get(customer_id) ?? 60,
  }));
}

function daysDiff(isoDate: string): number {
  const d = new Date(isoDate);
  const now = new Date();
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Feature normalisation (min-max to [0, 1])
// ---------------------------------------------------------------------------

function normalise(features: CustomerFeatures[]): { normalised: number[][]; min: number[]; max: number[] } {
  const keys: (keyof Omit<CustomerFeatures, 'customerId'>)[] = [
    'avgEngagementPerWeek',
    'avgQuestCompletion',
    'tierLevel',
    'totalPurchaseAmount',
    'daysSinceLastActivity',
  ];

  const min = keys.map(k => Math.min(...features.map(f => f[k] as number)));
  const max = keys.map(k => Math.max(...features.map(f => f[k] as number)));

  const normalised = features.map(f =>
    keys.map((k, i) => {
      const range = max[i] - min[i];
      return range === 0 ? 0 : ((f[k] as number) - min[i]) / range;
    })
  );

  return { normalised, min, max };
}

// ---------------------------------------------------------------------------
// K-means implementation
// ---------------------------------------------------------------------------

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function meanVector(points: number[][]): number[] {
  if (points.length === 0) return new Array(5).fill(0);
  const dim = points[0].length;
  const sums = new Array(dim).fill(0);
  for (const p of points) {
    for (let i = 0; i < dim; i++) sums[i] += p[i];
  }
  return sums.map(s => s / points.length);
}

function kmeans(
  points: number[][],
  k: number,
  maxIter = 50
): { assignments: number[]; centroids: number[][] } {
  const n = points.length;
  if (n === 0) return { assignments: [], centroids: [] };

  // Initialise centroids using k-means++ style spread selection
  const centroids: number[][] = [];
  // Pick first centroid randomly (deterministic seed)
  centroids.push([...points[Math.floor(points.length * 0.17)]]);

  for (let c = 1; c < k; c++) {
    // For each point, compute distance to nearest centroid
    const distances = points.map(p =>
      Math.min(...centroids.map(cent => euclidean(p, cent)))
    );
    const totalDist = distances.reduce((a, b) => a + b, 0);
    // Pick the point farthest from existing centroids (deterministic variant)
    let maxDist = -1;
    let maxIdx = 0;
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] > maxDist) {
        maxDist = distances[i];
        maxIdx = i;
      }
    }
    centroids.push([...points[maxIdx]]);
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    const newAssignments = points.map(p => {
      let minDist = Infinity;
      let best = 0;
      for (let c = 0; c < k; c++) {
        const d = euclidean(p, centroids[c]);
        if (d < minDist) { minDist = d; best = c; }
      }
      return best;
    });

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;

    // Recompute centroids
    for (let c = 0; c < k; c++) {
      const clusterPoints = points.filter((_, i) => assignments[i] === c);
      if (clusterPoints.length > 0) {
        centroids[c] = meanVector(clusterPoints);
      }
    }

    if (!changed) break;
  }

  return { assignments, centroids };
}

// ---------------------------------------------------------------------------
// Map raw cluster index → named cohort
// ---------------------------------------------------------------------------

/**
 * Given 5 centroids (in normalised space), assign each to the best-matching
 * named cohort definition based on the centroid's feature profile.
 *
 * Features (indices):
 *   0: avgEngagementPerWeek   (higher = more engaged)
 *   1: avgQuestCompletion     (higher = more complete)
 *   2: tierLevel              (higher = better tier)
 *   3: totalPurchaseAmount    (higher = bigger spender)
 *   4: daysSinceLastActivity  (higher = more churned)
 */
function assignCohortNames(centroids: number[][]): number[] {
  // Score each centroid for each named cohort
  // Returns mapping: centroid index → CLUSTER_META index
  const k = centroids.length;

  // Compute a "profile score" for each (centroid, named-cluster) pair
  // Higher score = better match
  function profileScore(centroid: number[], metaIdx: number): number {
    const [eng, quest, tier, purchase, daysInactive] = centroid;
    switch (metaIdx) {
      case 0: // High-Value Engaged: high eng, high tier, high purchase, low inactive
        return eng * 3 + tier * 2 + purchase * 2 - daysInactive * 2;
      case 1: // Quest Graduates: high quest completion, moderate engagement
        return quest * 4 + eng * 1 - daysInactive;
      case 2: // At-Risk Disengaged: high days inactive, low engagement
        return daysInactive * 4 - eng * 3 - quest;
      case 3: // New Joiners: low quest completion, low purchase, low inactive (recently active)
        return -quest * 2 - purchase * 2 - daysInactive + 2;
      case 4: // Passive Subscribers: moderate tier, low engagement
        return tier * 2 - eng * 3 - quest;
      default: return 0;
    }
  }

  // Greedy assignment: pick best match for each meta cluster, no duplicates
  const used = new Set<number>();
  const metaAssignment = new Array(k).fill(-1); // centroid idx → meta idx

  // For each meta cluster (in priority order), find the best unassigned centroid
  for (let m = 0; m < CLUSTER_META.length && m < k; m++) {
    let bestCentroid = -1;
    let bestScore = -Infinity;
    for (let c = 0; c < k; c++) {
      if (used.has(c)) continue;
      const score = profileScore(centroids[c], m);
      if (score > bestScore) {
        bestScore = score;
        bestCentroid = c;
      }
    }
    if (bestCentroid >= 0) {
      metaAssignment[bestCentroid] = m;
      used.add(bestCentroid);
    }
  }

  // Fill any unassigned (shouldn't happen if k <= CLUSTER_META.length)
  for (let c = 0; c < k; c++) {
    if (metaAssignment[c] === -1) metaAssignment[c] = c % CLUSTER_META.length;
  }

  return metaAssignment;
}

// ---------------------------------------------------------------------------
// Build cohort top signals
// ---------------------------------------------------------------------------

function buildTopSignals(
  centroid: number[],
  metaIdx: number,
  memberCount: number,
  min: number[],
  max: number[]
): TopSignal[] {
  // Denormalise centroid back to real values
  const denorm = centroid.map((v, i) => v * (max[i] - min[i]) + min[i]);
  const [eng, quest, tier, purchase, daysInactive] = denorm;

  const tierNames = ['Free', 'Plus', 'Tribe', 'All Access', 'All Access + Live'];
  const tierName = tierNames[Math.round(Math.min(4, Math.max(0, tier)))] ?? 'Free';

  return [
    { label: 'Avg quest completion', value: `${Math.round(quest)}%` },
    { label: 'Avg weekly engagement events', value: Math.round(eng).toString() },
    { label: 'Most common tier', value: tierName },
    { label: 'Avg lifetime purchases', value: `$${Math.round(purchase).toLocaleString()}` },
    { label: 'Avg days since last activity', value: `${Math.round(daysInactive)} days` },
    { label: 'Member count', value: memberCount.toLocaleString() },
  ];
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  cohorts: MlCohort[];
  computedAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getMLCohorts(forceRefresh = false): MlCohort[] {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.computedAt < CACHE_TTL_MS) {
    return cache.cohorts;
  }

  const features = extractCustomerFeatures();

  if (features.length === 0) {
    // Return empty cohorts
    const cohorts = CLUSTER_META.map(meta => ({
      id: meta.id,
      name: meta.name,
      memberCount: 0,
      summary: `${meta.name} — no data yet`,
      topSignals: [],
      centroid: [],
    }));
    cache = { cohorts, computedAt: now };
    return cohorts;
  }

  const K = Math.min(5, CLUSTER_META.length);
  const { normalised, min, max } = normalise(features);
  const { assignments, centroids } = kmeans(normalised, K);

  // Count members per cluster
  const counts = new Array(K).fill(0);
  for (const a of assignments) counts[a]++;

  // Map cluster indices to named cohorts
  const centroidToMeta = assignCohortNames(centroids);

  // Build MlCohort objects
  const cohorts: MlCohort[] = [];
  for (let c = 0; c < K; c++) {
    const metaIdx = centroidToMeta[c];
    const meta = CLUSTER_META[metaIdx];
    const memberCount = counts[c];

    const topSignals = buildTopSignals(centroids[c], metaIdx, memberCount, min, max);
    const cohort: MlCohort = {
      id: meta.id,
      name: meta.name,
      memberCount,
      summary: meta.summaryTemplate({ id: meta.id, name: meta.name, memberCount, summary: '', topSignals, centroid: centroids[c] }, centroids[c]),
      topSignals,
      centroid: centroids[c],
    };
    cohorts.push(cohort);
  }

  // Sort by member count descending
  cohorts.sort((a, b) => b.memberCount - a.memberCount);

  cache = { cohorts, computedAt: now };
  return cohorts;
}

export function getMlCohortById(id: string): MlCohort | null {
  const cohorts = getMLCohorts();
  return cohorts.find(c => c.id === id) ?? null;
}
