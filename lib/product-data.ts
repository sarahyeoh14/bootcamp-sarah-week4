/**
 * Product Data — loads product_data_full.json (NDJSON, one row per user) into
 * SQLite and provides analytics queries.
 *
 * Column-name compatibility: the DB keeps the old column names so that all
 * existing query code (analysis.ts, pages) works without changes.  The new
 * JSON fields are mapped / derived during seeding.
 *
 * Derived columns (computed at seed time):
 *   has_login_in_month       = last_login_timestamp >= RECENT_CUTOFF
 *   has_progress_in_month    = total_months_with_progress > 0
 *   has_used_eve_in_month    = has_ever_used_eve
 *   has_adopted_eve_before_month = has_ever_used_eve  (snapshot — no separation)
 *   is_new_subscriber        = subscription_start_date >= RECENT_CUTOFF
 *   is_eve_repeat_user       = total_months_with_eve >= 2
 *   eve_active_days          = total_eve_active_days (JSON field)
 *   web_or_app               = sales_channel (web | app)
 *   month                    = SNAPSHOT_MONTH  (hardcoded — single snapshot)
 */

import path from 'path';
import fs from 'fs';
import { getDb } from './db';

const DATA_PATH = path.join(process.cwd(), 'data', 'product_data_full.json');

/** All data treated as this single snapshot month */
const SNAPSHOT_MONTH = '2026-05';

/** "Active in last 30 days" cutoff — 30 days before snapshot date 2026-05-14 */
const RECENT_CUTOFF = '2026-04-14';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlySnapshot {
  month: string;
  active: number;
  loggedIn: number;
  loginRate: number;
  hasProgress: number;
  progressRate: number;
  eveUsers: number;
  eveRate: number;
}

export interface TrendRow {
  month: string;
  label: string;
  active: number;
  loggedIn: number;
  loginRate: number;
  hasProgress: number;
  progressRate: number;
  eveUsers: number;
  eveRate: number;
}

export interface ChannelBreakdown {
  name: string;
  count: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fmtMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function bool(v: unknown): number {
  return v === 'true' || v === true || v === 1 ? 1 : 0;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || v === 'Not Available') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function clean(v: unknown): string | null {
  if (!v || v === 'Not Available' || v === 'None' || v === 'null') return null;
  return String(v);
}

/** Returns 1 if a date string (any format starting YYYY-MM-DD) is >= cutoff */
function isRecent(dateStr: unknown): number {
  if (!dateStr || typeof dateStr !== 'string' || dateStr === 'None') return 0;
  return dateStr.substring(0, 10) >= RECENT_CUTOFF ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function ensureProductDataTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      auth0_user_id TEXT NOT NULL,
      subscription_status TEXT,
      membership_product_name TEXT,
      tier TEXT,
      payment_frequency TEXT,
      tenure_days INTEGER,
      is_new_subscriber INTEGER DEFAULT 0,
      country TEXT,
      total_tenure_days INTEGER,
      lifetime_value REAL,
      n_content_viewed INTEGER,
      content_watched_min INTEGER,
      acquisition_type TEXT,
      acquisition_channel TEXT,
      acquisition_source TEXT,
      traffic_channel TEXT,
      payment_method_type TEXT,
      order_type TEXT,
      sales_channel TEXT,
      gender TEXT,
      age_bracket TEXT,
      language TEXT,
      has_login_within_15d INTEGER DEFAULT 0,
      has_content_progress_within_15d INTEGER DEFAULT 0,
      has_login_in_month INTEGER DEFAULT 0,
      has_progress_in_month INTEGER DEFAULT 0,
      has_used_eve_in_month INTEGER DEFAULT 0,
      has_adopted_eve_before_month INTEGER DEFAULT 0,
      eve_first_use_date TEXT,
      is_eve_repeat_user INTEGER DEFAULT 0,
      eve_active_days INTEGER DEFAULT 0,
      web_or_app TEXT,
      subscription_start_date TEXT,
      last_login_timestamp TEXT,
      total_months_with_login INTEGER DEFAULT 0,
      total_months_with_progress INTEGER DEFAULT 0,
      total_months_with_eve INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_pd_month ON product_data(month);
    CREATE INDEX IF NOT EXISTS idx_pd_status ON product_data(subscription_status);
    CREATE INDEX IF NOT EXISTS idx_pd_eve ON product_data(has_used_eve_in_month);
    CREATE INDEX IF NOT EXISTS idx_pd_month_status ON product_data(month, subscription_status);
    CREATE INDEX IF NOT EXISTS idx_pd_gender ON product_data(gender);
    CREATE INDEX IF NOT EXISTS idx_pd_age ON product_data(age_bracket);
    CREATE INDEX IF NOT EXISTS idx_pd_login ON product_data(has_login_in_month);
  `);
}

/** Drop and recreate if schema is missing new columns. */
function migrateProductDataIfNeeded(): void {
  const db = getDb();
  try {
    const cols = db.prepare('PRAGMA table_info(product_data)').all() as { name: string }[];
    const hasNewSchema = cols.some(c => c.name === 'total_months_with_login');
    if (!hasNewSchema) {
      db.exec('DROP TABLE IF EXISTS product_data');
      ensureProductDataTable();
    }
  } catch {
    // table doesn't exist yet — ensureProductDataTable will create it
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export function seedProductDataIfNeeded(): void {
  try {
    migrateProductDataIfNeeded();
    ensureProductDataTable();
    const db = getDb();

    const count = (
      db.prepare('SELECT COUNT(*) as cnt FROM product_data').get() as { cnt: number }
    ).cnt;
    if (count > 0) return;

    if (!fs.existsSync(DATA_PATH)) return;

    const insert = db.prepare(`
      INSERT INTO product_data (
        month, auth0_user_id, subscription_status, membership_product_name,
        tier, payment_frequency, tenure_days, is_new_subscriber, country,
        total_tenure_days, lifetime_value, n_content_viewed, content_watched_min,
        acquisition_type, acquisition_channel, acquisition_source,
        traffic_channel, payment_method_type, order_type, sales_channel,
        gender, age_bracket, language,
        has_login_within_15d, has_content_progress_within_15d,
        has_login_in_month, has_progress_in_month,
        has_used_eve_in_month, has_adopted_eve_before_month,
        eve_first_use_date, is_eve_repeat_user, eve_active_days, web_or_app,
        subscription_start_date, last_login_timestamp,
        total_months_with_login, total_months_with_progress, total_months_with_eve
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertBatch = db.transaction((rows: any[]) => {
      for (const r of rows) {
        const totalMonthsLogin = num(r.total_months_with_login) ?? 0;
        const totalMonthsProgress = num(r.total_months_with_progress) ?? 0;
        const totalMonthsEVE = num(r.total_months_with_eve) ?? 0;
        const hasEverUsedEVE = bool(r.has_ever_used_eve);
        const subStart = clean(r.subscription_start_date);
        const lastLogin = clean(r.last_login_timestamp);

        insert.run(
          SNAPSHOT_MONTH,                               // month
          r.auth0_user_id,
          r.subscription_status ?? null,
          r.membership_product_name ?? null,
          clean(r.tier),
          clean(r.payment_frequency),
          num(r.tenure_of_latest_subscription_days),   // tenure_days
          isRecent(subStart),                           // is_new_subscriber
          r.country ?? null,
          num(r.total_tenure_days),
          num(r.lifetime_value),
          num(r.n_content_viewed),
          num(r.content_watched_min),
          r.acquisition_type ?? null,
          r.acquisition_channel ?? null,
          clean(r.acquisition_source),
          clean(r.traffic_channel),
          clean(r.payment_method_type),
          clean(r.order_type),
          clean(r.sales_channel),
          clean(r.gender),
          clean(r.age_bracket),
          clean(r.language),
          bool(r.has_login_within_15d_of_order),       // has_login_within_15d
          bool(r.has_content_progress_within_15d_of_order), // has_content_progress_within_15d
          isRecent(lastLogin),                          // has_login_in_month (last 30 days)
          totalMonthsProgress > 0 ? 1 : 0,             // has_progress_in_month
          hasEverUsedEVE,                               // has_used_eve_in_month
          hasEverUsedEVE,                               // has_adopted_eve_before_month
          null,                                         // eve_first_use_date (not available)
          totalMonthsEVE >= 2 ? 1 : 0,                 // is_eve_repeat_user
          num(r.total_eve_active_days) ?? 0,            // eve_active_days
          clean(r.sales_channel) ?? 'web',              // web_or_app
          subStart,
          lastLogin,
          totalMonthsLogin,
          totalMonthsProgress,
          totalMonthsEVE
        );
      }
    });

    // Stream NDJSON line by line — batch every 5 000 rows to keep memory bounded
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    const lines = raw.split('\n');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let batch: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      batch.push(JSON.parse(trimmed));
      if (batch.length >= 5000) {
        insertBatch(batch);
        batch = [];
      }
    }
    if (batch.length > 0) insertBatch(batch);
  } catch (e) {
    console.error('[product-data] seed error:', e);
  }
}

// ---------------------------------------------------------------------------
// Core queries
// ---------------------------------------------------------------------------

export function getLatestMonth(): string {
  return SNAPSHOT_MONTH;
}

export function getMonthlySnapshot(month: string): MonthlySnapshot {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";

  const active = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;
  const loggedIn = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_login_in_month = 1`).get(month) as { n: number }
  ).n;
  const hasProgress = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_progress_in_month = 1`).get(month) as { n: number }
  ).n;
  const eveUsers = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_used_eve_in_month = 1`).get(month) as { n: number }
  ).n;

  return {
    month,
    active,
    loggedIn,
    loginRate: active > 0 ? Math.round((loggedIn / active) * 100) : 0,
    hasProgress,
    progressRate: active > 0 ? Math.round((hasProgress / active) * 100) : 0,
    eveUsers,
    eveRate: active > 0 ? Math.round((eveUsers / active) * 100) : 0,
  };
}

/** No monthly time-series in full snapshot — returns empty array. */
export function getMonthlyTrend(_latestMonth: string, _n = 6): TrendRow[] {
  return [];
}

// ---------------------------------------------------------------------------
// Acquisition
// ---------------------------------------------------------------------------

export function getAcquisitionData(month: string) {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;

  const channels = db
    .prepare(
      `SELECT COALESCE(acquisition_channel,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY cnt DESC LIMIT 10`
    )
    .all(month) as { name: string; cnt: number }[];

  const acqTypes = db
    .prepare(
      `SELECT COALESCE(acquisition_type,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY cnt DESC`
    )
    .all(month) as { name: string; cnt: number }[];

  const tiers = db
    .prepare(
      `SELECT COALESCE(tier,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY name`
    )
    .all(month) as { name: string; cnt: number }[];

  const freqs = db
    .prepare(
      `SELECT COALESCE(payment_frequency,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY cnt DESC`
    )
    .all(month) as { name: string; cnt: number }[];

  const countries = db
    .prepare(
      `SELECT COALESCE(country,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY cnt DESC LIMIT 10`
    )
    .all(month) as { name: string; cnt: number }[];

  const ltvRow = db
    .prepare(`SELECT AVG(lifetime_value) as avg_ltv, SUM(lifetime_value) as total_ltv ${base}`)
    .get(month) as { avg_ltv: number | null; total_ltv: number | null };

  const newSubs = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND is_new_subscriber = 1`).get(month) as { n: number }
  ).n;

  const toBreakdown = (rows: { name: string; cnt: number }[]): ChannelBreakdown[] =>
    rows.map((r) => ({
      name: r.name,
      count: r.cnt,
      pct: total > 0 ? Math.round((r.cnt / total) * 100) : 0,
    }));

  return {
    total,
    newSubs,
    avgLTV: Math.round(ltvRow?.avg_ltv ?? 0),
    totalLTV: Math.round(ltvRow?.total_ltv ?? 0),
    channels: toBreakdown(channels),
    acqTypes: toBreakdown(acqTypes),
    tiers: toBreakdown(tiers),
    paymentFreqs: toBreakdown(freqs),
    topCountries: toBreakdown(countries),
  };
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function getActivationData(month: string) {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;
  const loggedIn = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_login_in_month = 1`).get(month) as { n: number }
  ).n;

  // New subs who activated within 15d
  const newSubs = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND is_new_subscriber = 1`).get(month) as { n: number }
  ).n;
  const newActivated15d = (
    db
      .prepare(
        `SELECT COUNT(*) as n ${base} AND is_new_subscriber = 1 AND has_content_progress_within_15d = 1`
      )
      .get(month) as { n: number }
  ).n;

  // Web vs app split (web_or_app = sales_channel)
  const platforms = db
    .prepare(
      `SELECT COALESCE(web_or_app,'web') as platform, COUNT(*) as cnt
       ${base} AND has_login_in_month = 1 GROUP BY platform`
    )
    .all(month) as { platform: string; cnt: number }[];

  // Login by tier
  const tierLogin = db
    .prepare(
      `SELECT COALESCE(tier,'Unknown') as tier,
        COUNT(*) as total_in_tier,
        SUM(has_login_in_month) as logged_in
       ${base} GROUP BY tier ORDER BY tier`
    )
    .all(month) as { tier: string; total_in_tier: number; logged_in: number }[];

  return {
    total,
    loggedIn,
    loginRate: total > 0 ? Math.round((loggedIn / total) * 100) : 0,
    notLoggedIn: total - loggedIn,
    newSubs,
    newActivated15d,
    activation15dRate: newSubs > 0 ? Math.round((newActivated15d / newSubs) * 100) : 0,
    platforms: platforms.map((p) => ({
      platform: p.platform,
      count: p.cnt,
      pct: loggedIn > 0 ? Math.round((p.cnt / loggedIn) * 100) : 0,
    })),
    tierLogin: tierLogin.map((t) => ({
      tier: t.tier,
      total: t.total_in_tier,
      loggedIn: t.logged_in,
      rate: t.total_in_tier > 0 ? Math.round((t.logged_in / t.total_in_tier) * 100) : 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

export function getTransformData(month: string) {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;
  const hasProgress = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_progress_in_month = 1`).get(month) as { n: number }
  ).n;

  const contentRow = db
    .prepare(
      `SELECT
        AVG(n_content_viewed) as avg_content,
        AVG(content_watched_min) as avg_watch,
        MAX(n_content_viewed) as max_content,
        AVG(total_tenure_days) as avg_tenure
       ${base} AND has_progress_in_month = 1`
    )
    .get(month) as {
    avg_content: number | null;
    avg_watch: number | null;
    max_content: number | null;
    avg_tenure: number | null;
  };

  const allTenureRow = db
    .prepare(`SELECT AVG(total_tenure_days) as avg_tenure ${base}`)
    .get(month) as { avg_tenure: number | null };

  // Engagement tiers: high (>500 mins), medium (100–500), low (<100)
  const engagementTiers = db
    .prepare(
      `SELECT
        SUM(CASE WHEN content_watched_min >= 500 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN content_watched_min >= 100 AND content_watched_min < 500 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN content_watched_min < 100 THEN 1 ELSE 0 END) as low
       ${base} AND has_progress_in_month = 1 AND content_watched_min IS NOT NULL`
    )
    .get(month) as { high: number; medium: number; low: number };

  return {
    total,
    hasProgress,
    progressRate: total > 0 ? Math.round((hasProgress / total) * 100) : 0,
    notProgress: total - hasProgress,
    avgContentViewed: Math.round(contentRow?.avg_content ?? 0),
    avgWatchMins: Math.round(contentRow?.avg_watch ?? 0),
    avgTenureDays: Math.round(allTenureRow?.avg_tenure ?? 0),
    engagementTiers: {
      high: engagementTiers?.high ?? 0,
      medium: engagementTiers?.medium ?? 0,
      low: engagementTiers?.low ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// EVE / AI Adoption
// ---------------------------------------------------------------------------

export function getEVEData(month: string) {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;
  const eveUsers = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_used_eve_in_month = 1`).get(month) as { n: number }
  ).n;
  const repeatUsers = (
    db
      .prepare(
        `SELECT COUNT(*) as n ${base} AND has_used_eve_in_month = 1 AND is_eve_repeat_user = 1`
      )
      .get(month) as { n: number }
  ).n;
  // In a single snapshot, "ever adopted" = current users (no lapsed concept)
  const everAdopted = eveUsers;

  const avgDaysRow = db
    .prepare(
      `SELECT AVG(eve_active_days) as avg FROM product_data WHERE month = ? AND has_used_eve_in_month = 1`
    )
    .get(month) as { avg: number | null };

  // Single snapshot — no monthly trend available
  const trend: { month: string; label: string; users: number; rate: number }[] = [];

  return {
    total,
    eveUsers,
    eveRate: total > 0 ? Math.round((eveUsers / total) * 100) : 0,
    repeatUsers,
    repeatRate: eveUsers > 0 ? Math.round((repeatUsers / eveUsers) * 100) : 0,
    everAdopted,
    lapsedEVE: 0, // not determinable from single snapshot
    neverTriedEVE: total - eveUsers,
    avgActiveDays: parseFloat((avgDaysRow?.avg ?? 0).toFixed(1)),
    trend,
    hasData: eveUsers > 0,
  };
}

// ---------------------------------------------------------------------------
// Segment revenue breakdown (for Forecast page)
// ---------------------------------------------------------------------------
// Mutually exclusive priority: EVE repeat > EVE user > with progress > logged in > new not activated > inactive

export function getSegmentBreakdown(month: string) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      CASE
        WHEN is_eve_repeat_user = 1 THEN 'eve_repeat'
        WHEN has_used_eve_in_month = 1 THEN 'eve_user'
        WHEN has_progress_in_month = 1 THEN 'with_progress'
        WHEN has_login_in_month = 1 THEN 'logged_in'
        WHEN is_new_subscriber = 1 AND has_content_progress_within_15d = 0 THEN 'new_not_activated'
        ELSE 'inactive'
      END as segment,
      COUNT(*) as users,
      ROUND(AVG(COALESCE(lifetime_value, 0)), 2) as avg_ltv
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
    GROUP BY segment
  `).all(month) as { segment: string; users: number; avg_ltv: number }[];

  const by = Object.fromEntries(rows.map(r => [r.segment, r]));
  const seg = (key: string) => ({ users: by[key]?.users ?? 0, avgLtv: by[key]?.avg_ltv ?? 0 });

  return {
    eveRepeat: seg('eve_repeat'),
    eveUser: seg('eve_user'),
    withProgress: seg('with_progress'),
    loggedIn: seg('logged_in'),
    newNotActivated: seg('new_not_activated'),
    inactive: seg('inactive'),
  };
}
