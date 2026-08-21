'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface WeekRow {
  week: string;
  weekLabel: string;
  total: number;
  loginEligible: number;
  day0LoginPct: number;
  day7LoginPct: number;
  day15ActPct: number;
  day30ActPct: number;
  isMature7: boolean;
  isMature15: boolean;
  isMature30: boolean;
}

interface FilterOptions {
  trafficSources: string[];
  campaignTypes: string[];
  paymentFrequencies: string[];
  devices: string[];
  funnels: string[];
  orderTypes: string[];
  placeInFunnels: string[];
  productTypes: string[];
  productNames: string[];
}

interface SegmentRate {
  total: number;
  day15Rate: number;
  prevDay15Rate: number | null;
  prevTotal: number;
}

interface ProductShift {
  productName: string;
  prevShare: number;
  recentShare: number;
  prevDay15: number;
  recentDay15: number;
  recentCount: number;
  prevQuestShare: number;
  recentQuestShare: number;
}

interface DropoffAnalysis {
  weekRange: { min: string; max: string };
  overall: SegmentRate;
  mcFunnel: SegmentRate;
  nonMcFunnel: SegmentRate;
  hasQuest: SegmentRate;
  noQuest: SegmentRate;
  monthlyCustomers: SegmentRate;
  annualCustomers: SegmentRate;
  threeYearCustomers: SegmentRate;
  problemSegment: SegmentRate;
  bestSegment: SegmentRate;
  topProductShifts: ProductShift[];
}

type Tab = 'ip' | 'engage';

const PRICE_BUCKETS = [
  { label: 'Any',        min: undefined, max: undefined },
  { label: '$0–$49',     min: 0,   max: 49  },
  { label: '$50–$99',    min: 50,  max: 99  },
  { label: '$100–$199',  min: 100, max: 199 },
  { label: '$200–$299',  min: 200, max: 299 },
  { label: '$300+',      min: 300, max: undefined },
];

const TABS: { id: Tab; label: string; owner: string }[] = [
  { id: 'ip',     label: 'IP Team',     owner: 'Immediate Product' },
  { id: 'engage', label: 'Engage Team', owner: 'Engagement & Activation' },
];

const METRIC_DEFS: Record<Tab, { key: string; label: string; color: string; definition: string; denominator?: string }[]> = {
  ip: [
    {
      key: 'day0',
      label: 'Day 0 Login %',
      color: '#8b5cf6',
      definition: 'The share of new buyers who log into the product on the same day as their purchase.',
      denominator: 'New & Trial first-orders only',
    },
    {
      key: 'day7',
      label: 'Day 7 Login %',
      color: '#06b6d4',
      definition: 'The share of new buyers who have logged in at least once within 7 days of purchase, capturing early habit formation.',
      denominator: 'New & Trial first-orders only',
    },
  ],
  engage: [
    {
      key: 'day15',
      label: 'Day 15 Activation %',
      color: '#10b981',
      definition: 'The share of all buyers who complete their first meaningful activation event (e.g. quest started, content consumed) within 15 days.',
    },
    {
      key: 'day30',
      label: 'Day 30 Activation %',
      color: '#f59e0b',
      definition: 'The share of all buyers who complete their first activation event within 30 days — the primary long-window engagement signal.',
    },
  ],
};

const IP_LINES = [
  { key: 'day0LoginPct' as const, label: 'Day 0 Login', color: '#8b5cf6', dash: ''    },
  { key: 'day7LoginPct' as const, label: 'Day 7 Login', color: '#06b6d4', dash: '6 3' },
];
const ENGAGE_LINES = [
  { key: 'day15ActPct' as const, label: 'Day 15 Activation', color: '#10b981', dash: '3 3'     },
  { key: 'day30ActPct' as const, label: 'Day 30 Activation', color: '#f59e0b', dash: '8 3 2 3' },
];

// ---------------------------------------------------------------------------
// Trend chart
// ---------------------------------------------------------------------------

type LineSpec = { key: keyof WeekRow; label: string; color: string; dash: string };

function TrendChart({ weeks, lines, loading }: { weeks: WeekRow[]; lines: LineSpec[]; loading: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(800);
  const [tooltip, setTooltip] = useState<{ x: number; week: WeekRow } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setChartW(e[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const PAD = { top: 16, right: 24, bottom: 48, left: 40 };
  const H = 220;
  const W = chartW;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = weeks.length;

  const Y_MIN = 50;
  const Y_MAX = 100;
  const xOf = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yOf = (v: number) => PAD.top + innerH - ((Math.max(Y_MIN, v) - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;

  const yTicks = [50, 60, 70, 80, 90, 100];
  const step = Math.max(1, Math.round(n / 7));
  const xLabels = weeks.map((w, i) => ({ i, label: w.weekLabel })).filter((_, i) => i % step === 0 || i === n - 1);

  function pathFor(key: keyof WeekRow) {
    if (n === 0) return '';
    return weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(w[key] as number).toFixed(1)}`).join(' ');
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const mx = e.clientX - rect.left - PAD.left;
    const idx = Math.max(0, Math.min(n - 1, Math.round((mx / innerW) * (n - 1))));
    setTooltip({ x: xOf(idx), week: weeks[idx] });
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {loading ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
        </div>
      ) : n === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No data</div>
      ) : (
        <svg ref={svgRef} width={W} height={H} className="w-full"
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
          {/* Grid */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} stroke="#f3f4f6" strokeWidth={v === 50 ? 1.5 : 1} />
              <text x={PAD.left - 6} y={yOf(v) + 4} fontSize={10} fill="#9ca3af" textAnchor="end">{v}%</text>
            </g>
          ))}
          {xLabels.map(({ i, label }) => (
            <text key={i} x={xOf(i)} y={H - 8} fontSize={10} fill="#9ca3af" textAnchor="middle">{label}</text>
          ))}
          {/* Maturing region */}
          {(() => { const fi = weeks.findIndex(w => !w.isMature15); return fi >= 0 ? (
            <rect x={xOf(fi)} y={PAD.top} width={W - PAD.right - xOf(fi)} height={innerH} fill="#f5f3ff" opacity={0.5} />
          ) : null; })()}
          {/* Lines */}
          {lines.map(l => (
            <path key={l.key} d={pathFor(l.key)} fill="none" stroke={l.color} strokeWidth={2.5}
              strokeDasharray={l.dash} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* Hover */}
          {tooltip && <>
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 2" />
            {lines.map(l => (
              <circle key={l.key} cx={tooltip.x} cy={yOf(tooltip.week[l.key] as number)}
                r={4} fill={l.color} stroke="white" strokeWidth={1.5} />
            ))}
          </>}
        </svg>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div className="pointer-events-none absolute z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]"
          style={{ left: tooltip.x + 40 > chartW * 0.6 ? tooltip.x - 170 : tooltip.x + 16, top: 16 }}>
          <div className="font-semibold text-gray-800 mb-2">
            {tooltip.week.weekLabel}
            <span className="ml-2 text-gray-400 font-normal">{tooltip.week.total.toLocaleString()} users</span>
          </div>
          {lines.map(l => (
            <div key={l.key} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: l.color }} />
                <span className="text-gray-600">{l.label}</span>
              </div>
              <span className="font-bold" style={{ color: l.color }}>{tooltip.week[l.key] as number}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctColor(pct: number, lo: number, hi: number) {
  if (pct >= hi) return 'text-emerald-700 font-bold';
  if (pct >= lo) return 'text-amber-600 font-semibold';
  return 'text-red-500 font-semibold';
}

function Bar({ pct, color, mature }: { pct: number; color: string; mature: boolean }) {
  return (
    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: mature ? color : '#d1d5db' }} />
    </div>
  );
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[140px]">
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function PurchaseCohortsClient() {
  const [activeTab, setActiveTab] = useState<Tab>('ip');
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [dropoff, setDropoff] = useState<DropoffAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [trafficSource, setTrafficSource] = useState('');
  const [campaignType, setCampaignType] = useState('');
  const [payFreq, setPayFreq] = useState('');
  const [device, setDevice] = useState('');
  const [hasDiscount, setHasDiscount] = useState('');
  const [priceBucket, setPriceBucket] = useState(0);
  const [productFunnel, setProductFunnel] = useState('');
  const [isMC, setIsMC] = useState(false);
  const [isVSL, setIsVSL] = useState(false);
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [orderType, setOrderType] = useState('');
  const [placeInFunnel, setPlaceInFunnel] = useState('');
  const [productType, setProductType] = useState('');
  const [hasFunnelQuest, setHasFunnelQuest] = useState('');
  const [productName, setProductName] = useState('');

  const fetchData = useCallback(async (includeOptions: boolean) => {
    setLoading(true);
    try {
      const bucket = PRICE_BUCKETS[priceBucket];
      const params = new URLSearchParams();
      if (trafficSource) params.set('traffic_source', trafficSource);
      if (campaignType) params.set('campaign_type', campaignType);
      if (payFreq) params.set('payment_frequency', payFreq);
      if (device) params.set('device_category', device);
      if (hasDiscount) params.set('has_discount', hasDiscount);
      if (bucket.min !== undefined) params.set('min_price', String(bucket.min));
      if (bucket.max !== undefined) params.set('max_price', String(bucket.max));
      if (productFunnel) params.set('product_funnel', productFunnel);
      if (isMC) params.set('is_mc_funnel', '1');
      if (isVSL) params.set('is_vsl_funnel', '1');
      if (firstOrderOnly) params.set('is_first_order', '1');
      if (orderType) params.set('order_type', orderType);
      if (placeInFunnel) params.set('place_in_funnel', placeInFunnel);
      if (productType) params.set('product_type', productType);
      if (hasFunnelQuest) params.set('has_funnel_quest', hasFunnelQuest);
      if (productName) params.set('product_name', productName);
      if (includeOptions) params.set('include_options', '1');
      params.set('include_dropoff', '1');

      const res = await fetch(`/api/purchase-cohorts?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setWeeks(data.weeks ?? []);
      if (data.options) setOptions(data.options);
      setDropoff(data.dropoff ?? null);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [trafficSource, campaignType, payFreq, device, hasDiscount, priceBucket, productFunnel, isMC, isVSL, firstOrderOnly, orderType, placeInFunnel, productType, hasFunnelQuest, productName]);

  useEffect(() => { fetchData(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isInitialMount = useState(true);
  useEffect(() => {
    if (isInitialMount[0]) { isInitialMount[1](false); return; }
    fetchData(false);
  }, [trafficSource, campaignType, payFreq, device, hasDiscount, priceBucket, productFunnel, isMC, isVSL, firstOrderOnly, orderType, placeInFunnel, productType, hasFunnelQuest, productName]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = () => {
    setTrafficSource(''); setCampaignType(''); setPayFreq('');
    setDevice(''); setHasDiscount(''); setPriceBucket(0);
    setProductFunnel(''); setIsMC(false); setIsVSL(false); setFirstOrderOnly(false);
    setOrderType(''); setPlaceInFunnel(''); setProductType(''); setHasFunnelQuest(''); setProductName('');
  };

  const hasActiveFilters = trafficSource || campaignType || payFreq || device || hasDiscount || priceBucket > 0 || productFunnel || isMC || isVSL || firstOrderOnly || orderType || placeInFunnel || productType || hasFunnelQuest || productName;
  const totalUsers = weeks.reduce((s, w) => s + w.total, 0);

  // Exclude only the current partial week (last entry) — it has < 7 days of data.
  // All other completed weeks are included, even if immature.
  const completedWeeks = weeks.slice(0, -1);
  const recent4 = completedWeeks.slice(-4);
  const prev4 = completedWeeks.slice(-8, -4);
  const weekAvg = (ws: WeekRow[], key: keyof WeekRow): number | null =>
    ws.length > 0
      ? Math.round(ws.reduce((s, w) => s + (w[key] as number), 0) / ws.length * 10) / 10
      : null;
  const momDelta = (key: keyof WeekRow): number | null => {
    const cur = weekAvg(recent4, key);
    const prv = weekAvg(prev4, key);
    if (cur === null || prv === null || prv === 0) return null;
    return Math.round((cur - prv) * 10) / 10;
  };

  // Per-tab config
  const isIP = activeTab === 'ip';

  const lines = isIP ? IP_LINES : ENGAGE_LINES;
  const cards = isIP
    ? [
        { key: 'day0LoginPct' as const, label: 'Day 0 Login',  detail: 'Same-day login',   color: '#8b5cf6', lo: 50, hi: 70 },
        { key: 'day7LoginPct' as const, label: 'Day 7 Login',  detail: 'Login within 7d',  color: '#06b6d4', lo: 60, hi: 80 },
      ]
    : [
        { key: 'day15ActPct' as const, label: 'Day 15 Activation', detail: 'Activated within 15d', color: '#10b981', lo: 30, hi: 50 },
        { key: 'day30ActPct' as const, label: 'Day 30 Activation', detail: 'Activated within 30d', color: '#f59e0b', lo: 35, hi: 55 },
      ];

  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">

      {/* Team tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Metric definitions */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Metric Definitions</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {METRIC_DEFS[activeTab].map(d => (
            <div key={d.key} className="flex gap-3">
              <span className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <div>
                <div className="text-xs font-semibold text-gray-800">{d.label}</div>
                <div className="text-xs text-gray-600 mt-0.5 leading-relaxed">{d.definition}</div>
                {d.denominator && (
                  <div className="text-xs text-violet-500 mt-1 font-medium">Denominator: {d.denominator}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Filters</h2>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-xs text-violet-600 hover:text-violet-800 font-medium">Reset all</button>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          {options && (
            <>
              <SelectFilter label="Traffic Source"  value={trafficSource}  options={options.trafficSources}    onChange={setTrafficSource} />
              <SelectFilter label="Campaign Type"   value={campaignType}   options={options.campaignTypes}     onChange={setCampaignType} />
              <SelectFilter label="Payment"         value={payFreq}        options={options.paymentFrequencies} onChange={setPayFreq} />
              <SelectFilter label="Device"          value={device}         options={options.devices}           onChange={setDevice} />
              <SelectFilter label="Funnel"          value={productFunnel}  options={options.funnels}           onChange={setProductFunnel} />
            </>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Price</label>
            <select value={priceBucket} onChange={e => setPriceBucket(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[120px]">
              {PRICE_BUCKETS.map((b, i) => <option key={i} value={i}>{b.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Discount</label>
            <select value={hasDiscount} onChange={e => setHasDiscount(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[120px]">
              <option value="">All</option>
              <option value="yes">With discount</option>
              <option value="no">No discount</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Funnel type</label>
            <div className="flex gap-2 pt-1">
              {[
                { label: 'MC',  active: isMC,  toggle: () => { setIsMC(p => !p);  if (!isMC) setIsVSL(false); } },
                { label: 'VSL', active: isVSL, toggle: () => { setIsVSL(p => !p); if (!isVSL) setIsMC(false); } },
              ].map(({ label, active, toggle }) => (
                <button key={label} onClick={toggle}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">First order</label>
            <button onClick={() => setFirstOrderOnly(p => !p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${firstOrderOnly ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
              First order only
            </button>
          </div>
          {options && (
            <>
              <SelectFilter label="Order Type"       value={orderType}      options={options.orderTypes}      onChange={setOrderType} />
              <SelectFilter label="Place in Funnel"  value={placeInFunnel}  options={options.placeInFunnels}  onChange={setPlaceInFunnel} />
            </>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Funnel Quest</label>
            <select value={hasFunnelQuest} onChange={e => setHasFunnelQuest(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[120px]">
              <option value="">All</option>
              <option value="yes">Has quest</option>
              <option value="no">No quest</option>
            </select>
          </div>
          {options && (
            <SelectFilter label="Product Name" value={productName} options={options.productNames} onChange={setProductName} />
          )}
        </div>
      </div>

      {/* Summary cards */}
      {!loading && recent4.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {cards.map(c => {
            const val = weekAvg(recent4, c.key);
            const delta = momDelta(c.key);
            const isUp = delta !== null && delta > 0;
            const isDown = delta !== null && delta < 0;
            return (
              <div key={c.key} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-1 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                  <span className="text-xs text-gray-500">{c.detail}</span>
                </div>
                <div className="flex items-end gap-3">
                  <div className={`text-3xl ${val !== null ? pctColor(val, c.lo, c.hi) : 'text-gray-300'}`}>
                    {val !== null ? `${val}%` : '—'}
                  </div>
                  {delta !== null && (
                    <div className={`flex items-center gap-0.5 text-sm font-semibold mb-1 ${isUp ? 'text-emerald-600' : isDown ? 'text-red-500' : 'text-gray-400'}`}>
                      {isUp ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                      ) : isDown ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                        </svg>
                      ) : null}
                      {Math.abs(delta)}pp
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium text-gray-700 mt-1">{c.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Last 4 weeks avg
                  {prev4.length > 0 && <span className="ml-1">· vs prev 4 weeks</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trend chart */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">
              {isIP ? 'IP Team — Login Trend' : 'Engage Team — Activation Trend'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${weeks.length} weeks · ${totalUsers.toLocaleString()} users`}
              {hasActiveFilters && !loading && <span className="ml-2 text-violet-600 font-medium">· filtered</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            {lines.map(l => (
              <div key={l.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <svg width="20" height="8">
                  <line x1="0" y1="4" x2="20" y2="4" stroke={l.color} strokeWidth="2.5" strokeDasharray={l.dash} />
                </svg>
                {l.label}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block bg-violet-100" />
              Maturing
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <TrendChart weeks={weeks} lines={lines} loading={loading} />
        </div>
      </div>

      {/* What's driving the decline? — Engage Team only */}
      {!isIP && dropoff && !loading && dropoff.topProductShifts.length > 0 && (() => {
        const manifesting = dropoff.topProductShifts.find(p => p.productName.toLowerCase().includes('manifesting'));
        const annualGap = Math.round(Math.abs(dropoff.monthlyCustomers.day15Rate - dropoff.annualCustomers.day15Rate) * 10) / 10;
        const overallDecline = dropoff.overall.prevDay15Rate !== null ? dropoff.overall.day15Rate - dropoff.overall.prevDay15Rate : 0;

        // Mix shift impact: Σ (Δshare/100 × prevDay15) across all products
        const mixShiftPp = dropoff.topProductShifts.reduce((sum, p) =>
          sum + ((p.recentShare - p.prevShare) / 100) * p.prevDay15, 0);

        // Manifesting internal rate impact: prevShare/100 × Δrate
        const manifestingRatePp = manifesting
          ? (manifesting.prevShare / 100) * (manifesting.recentDay15 - manifesting.prevDay15)
          : 0;

        // F2: combined payment frequency impact
        // = rate change within annual (recent share × Δrate)
        // + mix shift drag (Δannual_share × annual-vs-monthly gap)
        const prevAnnualShare = dropoff.overall.prevTotal > 0 ? dropoff.annualCustomers.prevTotal / dropoff.overall.prevTotal : 0;
        const recentAnnualShare = dropoff.overall.total > 0 ? dropoff.annualCustomers.total / dropoff.overall.total : 0;
        const annualRateChange = dropoff.annualCustomers.day15Rate - (dropoff.annualCustomers.prevDay15Rate ?? dropoff.annualCustomers.day15Rate);
        const annualMonthlyGap = dropoff.annualCustomers.day15Rate - dropoff.monthlyCustomers.day15Rate;
        const paymentMixPp = recentAnnualShare * annualRateChange + (recentAnnualShare - prevAnnualShare) * annualMonthlyGap;

        const fmtPp = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}pp`;
        const fmtPct = (n: number) => overallDecline !== 0 ? `${Math.round(n / overallDecline * 100)}% of decline` : '';

        return (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">What&apos;s driving the decline?</h2>
              <p className="text-xs text-gray-500 mt-0.5">3 root causes identified · overall {fmtPp(overallDecline)} ({dropoff.overall.prevDay15Rate}% → {dropoff.overall.day15Rate}%)</p>
            </div>
            <div className="p-5 space-y-4">

              {/* Finding 1 — Mix shift */}
              <div className="border border-orange-100 bg-orange-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Finding 1</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">Product mix shifted away from high-activation products</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">{fmtPp(mixShiftPp)}</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Quest Only Membership (high activation) lost volume share while Manifesting Pathway and Entrepreneurship &amp; AI grew. A counterfactual shows this mix shift almost entirely explains the overall rate decline.
                </p>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-orange-100">
                        <th className="text-left pb-2 pl-1 font-medium">Product</th>
                        <th className="text-right pb-2 font-medium">Prev share</th>
                        <th className="text-right pb-2 font-medium">Recent share</th>
                        <th className="text-right pb-2 pr-1 font-medium">Day 15</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dropoff.topProductShifts.slice(0, 4).map(p => {
                        const shareDelta = p.recentShare - p.prevShare;
                        const shareColor = Math.abs(shareDelta) > 0.5
                          ? (shareDelta > 0 ? 'text-amber-700 font-semibold' : 'text-blue-600 font-semibold')
                          : 'text-gray-600';
                        const rateColor = p.recentDay15 >= 78 ? '#059669' : p.recentDay15 >= 73 ? '#d97706' : '#dc2626';
                        return (
                          <tr key={p.productName} className="border-b border-orange-50 last:border-0">
                            <td className="py-1.5 pl-1 font-medium text-gray-700" style={{ maxWidth: 160 }}>
                              <div className="truncate" title={p.productName}>{p.productName}</div>
                            </td>
                            <td className="py-1.5 text-right text-gray-400">{p.prevShare}%</td>
                            <td className="py-1.5 text-right">
                              <span className={shareColor}>
                                {p.recentShare}%{Math.abs(shareDelta) > 0.5 && <span className="ml-0.5">{shareDelta > 0 ? '↑' : '↓'}</span>}
                              </span>
                            </td>
                            <td className="py-1.5 text-right pr-1 font-semibold" style={{ color: rateColor }}>{p.recentDay15}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Finding 2 — Annual growing */}
              <div className="border border-amber-100 bg-amber-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Finding 2</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">Annual customers are growing — and activate at lower rates</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">{fmtPp(paymentMixPp)}</span>
                </div>
                <p className="text-xs text-gray-600">
                  Monthly customers activate at <strong>{dropoff.monthlyCustomers.day15Rate}%</strong> vs Annual at <strong>{dropoff.annualCustomers.day15Rate}%</strong> — a <strong>{annualGap}pp gap</strong>. Annual&apos;s share of the cohort grew from the prior period
                  {dropoff.annualCustomers.prevDay15Rate !== null && (
                    <span> (annual: {dropoff.annualCustomers.prevDay15Rate}% → {dropoff.annualCustomers.day15Rate}%)</span>
                  )}, pulling the blended average down.
                </p>
              </div>

              {/* Finding 3 — Manifesting Pathway internal decline */}
              {manifesting && (
                <div className="border border-violet-100 bg-violet-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Finding 3</span>
                    <span className="text-sm font-semibold text-gray-800 flex-1">Manifesting Pathway&apos;s internal rate is declining</span>
                    <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">{fmtPp(manifestingRatePp)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    Day 15 rate within Manifesting Pathway fell from <strong>{manifesting.prevDay15}%</strong> to <strong>{manifesting.recentDay15}%</strong>. This is the largest product by volume ({manifesting.recentShare}% of cohort, {manifesting.recentCount.toLocaleString()} users).
                  </p>
                  <div className="text-xs text-violet-800 bg-violet-100 rounded-lg px-3 py-2">
                    <strong>Note — empty funnel quest ID:</strong> Manifesting Pathway customers have essentially no funnel quest IDs. As the product grows to {manifesting.recentShare}% of the cohort, it amplifies the overall mix toward the lower-activation &quot;no quest&quot; segment. The internal rate decline compounds this — more buyers in a product with no quest content to drive Day 15 activation.
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Weekly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                <th className="text-left px-5 py-3 font-medium">Week</th>
                <th className="text-right px-4 py-3 font-medium">{isIP ? 'Eligible' : 'Cohort'}</th>
                {cards.map(c => (
                  <th key={c.key} className="text-right px-4 py-3 font-medium" style={{ color: c.color }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? '80px' : '50px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : weeks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-gray-400">No data for selected filters</td>
                </tr>
              ) : (
                weeks.map(row => {
                  const mature = isIP
                    ? { day0LoginPct: true, day7LoginPct: row.isMature7 }
                    : { day15ActPct: row.isMature15, day30ActPct: row.isMature30 };
                  return (
                    <tr key={row.week} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{row.weekLabel}</div>
                        <div className="text-xs text-gray-400">{row.week}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-600">{(isIP ? row.loginEligible : row.total).toLocaleString()}</div>
                        {isIP && <div className="text-xs text-gray-400">{row.total.toLocaleString()} total</div>}
                      </td>
                      {cards.map(c => {
                        const val = row[c.key] as number;
                        const m = mature[c.key as keyof typeof mature] ?? true;
                        return (
                          <td key={c.key} className="px-4 py-3 text-right">
                            <div className={`${pctColor(val, c.lo, c.hi)} ${!m ? 'opacity-50' : ''}`}>
                              {val}%{!m && <span className="ml-1 text-gray-400 font-normal text-xs">~</span>}
                            </div>
                            <Bar pct={val} color={c.color} mature={m} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
