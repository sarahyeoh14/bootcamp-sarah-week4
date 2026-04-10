'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MlCohort } from '@/lib/clustering';
import type { CohortCondition } from '@/lib/db';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface RuleCohort {
  id: number;
  name: string;
  conditions: CohortCondition[];
  memberCount: number;
  created_at: string;
  updated_at: string;
}

interface Props {
  initialMlCohorts: MlCohort[];
  initialRuleCohorts: RuleCohort[];
  hasData: boolean;
}

// -----------------------------------------------------------------------
// Condition field / operator metadata
// -----------------------------------------------------------------------

const FIELDS: { value: CohortCondition['field']; label: string; unit?: string }[] = [
  { value: 'quest_completion_pct', label: 'Quest completion %', unit: '%' },
  { value: 'subscription_tier', label: 'Subscription tier (0-4)', unit: '' },
  { value: 'total_purchases', label: 'Total purchases ($)', unit: '$' },
  { value: 'days_since_activity', label: 'Days since activity', unit: 'days' },
  { value: 'event_count_30d', label: 'Engagement events (last 30d)', unit: '' },
];

const OPERATORS: { value: CohortCondition['operator']; label: string }[] = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
];

function operatorLabel(op: CohortCondition['operator']): string {
  return OPERATORS.find(o => o.value === op)?.label ?? op;
}

function fieldLabel(field: CohortCondition['field']): string {
  return FIELDS.find(f => f.value === field)?.label ?? field;
}

// -----------------------------------------------------------------------
// Condition form row
// -----------------------------------------------------------------------

function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
  showRemove,
}: {
  condition: CohortCondition;
  index: number;
  onChange: (index: number, updated: CohortCondition) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={condition.field}
        onChange={e => onChange(index, { ...condition, field: e.target.value as CohortCondition['field'] })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        {FIELDS.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={e => onChange(index, { ...condition, operator: e.target.value as CohortCondition['operator'] })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        {OPERATORS.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      <input
        type="number"
        value={condition.value as number}
        onChange={e => onChange(index, { ...condition, value: parseFloat(e.target.value) || 0 })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 w-24 focus:outline-none focus:ring-2 focus:ring-violet-500"
        placeholder="0"
      />

      {showRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
          title="Remove condition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Cohort form modal
// -----------------------------------------------------------------------

function defaultCondition(): CohortCondition {
  return { field: 'quest_completion_pct', operator: 'gt', value: 50 };
}

function CohortFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: RuleCohort | null;
  onClose: () => void;
  onSave: (cohort: RuleCohort) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [conditions, setConditions] = useState<CohortCondition[]>(
    initial?.conditions?.length ? initial.conditions : [defaultCondition()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addCondition() {
    setConditions(prev => [...prev, defaultCondition()]);
  }

  function removeCondition(index: number) {
    setConditions(prev => prev.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updated: CohortCondition) {
    setConditions(prev => prev.map((c, i) => (i === index ? updated : c)));
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (conditions.length === 0) { setError('At least one condition is required'); return; }

    setSaving(true);
    setError('');

    try {
      const method = initial ? 'PUT' : 'POST';
      const url = initial ? `/api/cohorts/${initial.id}` : '/api/cohorts';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), conditions }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Save failed');
      } else {
        onSave(data.cohort);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Cohort' : 'Create Rule-Based Cohort'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cohort Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. High-Progress Learners"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conditions <span className="text-gray-400 font-normal">(all must match)</span>
            </label>
            <div className="space-y-2.5">
              {conditions.map((c, i) => (
                <ConditionRow
                  key={i}
                  condition={c}
                  index={i}
                  onChange={updateCondition}
                  onRemove={removeCondition}
                  showRemove={conditions.length > 1}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addCondition}
              className="mt-3 text-sm text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add condition
            </button>
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Cohort'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------

export default function CohortsClient({ initialMlCohorts, initialRuleCohorts, hasData }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [ruleCohorts, setRuleCohorts] = useState<RuleCohort[]>(initialRuleCohorts);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<RuleCohort | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filtered ML cohorts
  const filteredMl = initialMlCohorts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.summary.toLowerCase().includes(search.toLowerCase())
  );

  // Filtered rule cohorts
  const filteredRule = ruleCohorts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditTarget(null);
    setShowForm(true);
  }

  function openEdit(cohort: RuleCohort) {
    setEditTarget(cohort);
    setShowForm(true);
  }

  function handleSaved(cohort: RuleCohort) {
    if (editTarget) {
      setRuleCohorts(prev => prev.map(c => (c.id === cohort.id ? cohort : c)));
    } else {
      setRuleCohorts(prev => [cohort, ...prev]);
    }
    setShowForm(false);
    setEditTarget(null);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this cohort? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/cohorts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setRuleCohorts(prev => prev.filter(c => c.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  function navigateTo(href: string) {
    startTransition(() => router.push(href));
  }

  return (
    <div className="p-6 space-y-8">
      {/* Search + Create */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cohorts by name…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Cohort
        </button>
      </div>

      {/* ML-identified cohorts */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-gray-900">ML-Identified Cohorts</h2>
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Auto-detected</span>
        </div>

        {!hasData ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
            No pipeline data yet. Run the pipeline first to enable ML clustering.
          </div>
        ) : filteredMl.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
            No ML cohorts match your search.
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredMl.map(cohort => (
              <button
                key={cohort.id}
                onClick={() => navigateTo(`/dashboard/cohorts/ml-${cohort.id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-violet-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                      <span className="font-semibold text-gray-900 text-sm">{cohort.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">ML</span>
                    </div>
                    <p className="text-sm text-gray-500 ml-4">{cohort.summary}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold text-gray-900">{cohort.memberCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">members</div>
                  </div>
                </div>
                <div className="mt-1 ml-4">
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <span className="text-xs text-gray-400 group-hover:text-violet-500 ml-1 transition-colors">View details</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Rule-based cohorts */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Analyst-Defined Cohorts</h2>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Rule-based</span>
        </div>

        {filteredRule.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {search
                ? 'No rule-based cohorts match your search.'
                : 'No analyst-defined cohorts yet. Create one to get started.'}
            </p>
            {!search && (
              <button
                onClick={openCreate}
                className="text-sm text-violet-600 hover:text-violet-800 font-medium"
              >
                Create your first cohort
              </button>
            )}
          </div>
        )}

        {filteredRule.length > 0 && (
          <div className="grid gap-3">
            {filteredRule.map(cohort => (
              <div
                key={cohort.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Clickable area for detail */}
                  <button
                    onClick={() => navigateTo(`/dashboard/cohorts/rule-${cohort.id}`)}
                    className="flex-1 text-left min-w-0 group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="font-semibold text-gray-900 text-sm">{cohort.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Rule</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-4">
                      {cohort.conditions.map((c, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-gray-400 mx-1">AND</span>}
                          <span className="font-mono bg-gray-50 border border-gray-100 rounded px-1">
                            {fieldLabel(c.field)} {operatorLabel(c.operator)} {c.value}
                          </span>
                        </span>
                      ))}
                    </p>
                    <div className="mt-1.5 ml-4">
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-emerald-400 transition-colors inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      <span className="text-xs text-gray-400 group-hover:text-emerald-500 ml-1 transition-colors">View details</span>
                    </div>
                  </button>

                  {/* Member count + actions */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900">{cohort.memberCount.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">members</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(cohort)}
                        className="text-xs text-gray-500 hover:text-violet-600 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cohort.id)}
                        disabled={deletingId === cohort.id}
                        className="text-xs text-gray-400 hover:text-red-500 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        {deletingId === cohort.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Form modal */}
      {showForm && (
        <CohortFormModal
          initial={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}
