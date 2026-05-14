'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      router.push(data.redirectTo);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600 mb-5 shadow-lg shadow-violet-900/50">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Mission OS</h1>
          <p className="text-slate-400 text-sm mt-2">Customer Journey Intelligence</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-base font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-6">Enter your name to access the product dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
                Your name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sarah Chen"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-700/80 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700/60 text-red-300 text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm shadow-lg shadow-violet-900/30"
            >
              {loading ? 'Entering…' : 'Enter Mission OS'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Mindvalley · Product Intelligence — Internal Tool
        </p>
      </div>
    </div>
  );
}
