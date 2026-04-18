'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminShell from '@/components/AdminShell'
import StatCard from '@/components/StatCard'
import type { DashboardStats } from '@/lib/types'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentSignups, setRecentSignups] = useState<{ email: string; created_at: string }[]>([])
  const [topSubs, setTopSubs] = useState<{ name: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [statsRes, signupsRes, subsRes] = await Promise.all([
        supabase.from('dashboard_stats').select('*').single(),
        supabase.from('users').select('email, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('subscriptions').select('name').eq('is_active', true),
      ])

      if (statsRes.data) setStats(statsRes.data)
      if (signupsRes.data) setRecentSignups(signupsRes.data)

      // Aggregate top subscriptions client-side
      if (subsRes.data) {
        const counts: Record<string, number> = {}
        subsRes.data.forEach(s => { counts[s.name] = (counts[s.name] || 0) + 1 })
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, count]) => ({ name, count }))
        setTopSubs(sorted)
      }

      setLoading(false)
    }
    load()
  }, [])

  return (
    <AdminShell>
      <h2 className="text-xl font-semibold text-brand-charcoal mb-6">Dashboard</h2>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading metrics…</div>
      ) : stats ? (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Users" value={stats.total_users.toLocaleString()} accent />
            <StatCard label="New (7d)" value={stats.new_users_7d.toLocaleString()} />
            <StatCard label="New (30d)" value={stats.new_users_30d.toLocaleString()} />
            <StatCard label="DAU" value={stats.dau.toLocaleString()} sub={`WAU: ${stats.wau.toLocaleString()}`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Active Subscriptions" value={stats.active_subscriptions.toLocaleString()} />
            <StatCard label="Users with Subs" value={stats.users_with_subs.toLocaleString()} />
            <StatCard label="Pro Overrides" value={stats.active_pro_overrides.toLocaleString()} accent />
            <StatCard
              label="Avg Subs / User"
              value={stats.users_with_subs > 0 ? (stats.active_subscriptions / stats.users_with_subs).toFixed(1) : '—'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent signups */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Recent Signups</h3>
              {recentSignups.length === 0 ? (
                <p className="text-gray-400 text-sm">No signups yet</p>
              ) : (
                <ul className="space-y-2">
                  {recentSignups.map((u, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-brand-charcoal truncate">{u.email}</span>
                      <span className="text-gray-400 text-xs shrink-0 ml-2">
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Top subscriptions */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Top Tracked Services</h3>
              {topSubs.length === 0 ? (
                <p className="text-gray-400 text-sm">No subscriptions yet</p>
              ) : (
                <ul className="space-y-2">
                  {topSubs.map((s, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-brand-charcoal">{s.name}</span>
                      <span className="text-gray-400 text-xs">{s.count} users</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-red-500 text-sm">Failed to load dashboard stats.</div>
      )}
    </AdminShell>
  )
}
