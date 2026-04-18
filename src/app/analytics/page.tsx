'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import AdminShell from '@/components/AdminShell'

const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false }) as any
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false }) as any
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false }) as any
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false }) as any
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false }) as any
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false }) as any
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false }) as any
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false }) as any
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false }) as any

interface DailyCount { date: string; count: number }
interface EventCount { event_name: string; count: number }

export default function AnalyticsPage() {
  const [signupTrend, setSignupTrend] = useState<DailyCount[]>([])
  const [eventBreakdown, setEventBreakdown] = useState<EventCount[]>([])
  const [subsByCategory, setSubsByCategory] = useState<{ category: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const days = { '7d': 7, '30d': 30, '90d': 90 }[period]
      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceStr = since.toISOString()

      const [usersRes, eventsRes, subsRes] = await Promise.all([
        supabase.from('users').select('created_at').gte('created_at', sinceStr).order('created_at'),
        supabase.from('analytics_events').select('event_name, created_at').gte('created_at', sinceStr),
        supabase.from('subscriptions').select('category_name').eq('is_active', true),
      ])

      // Build signup trend (group by date)
      if (usersRes.data) {
        const byDate: Record<string, number> = {}
        // Pre-fill all dates
        for (let i = 0; i < days; i++) {
          const d = new Date(since)
          d.setDate(d.getDate() + i)
          byDate[d.toISOString().slice(0, 10)] = 0
        }
        usersRes.data.forEach(u => {
          const day = u.created_at.slice(0, 10)
          byDate[day] = (byDate[day] || 0) + 1
        })
        setSignupTrend(Object.entries(byDate).map(([date, count]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count,
        })))
      }

      // Event breakdown
      if (eventsRes.data) {
        const counts: Record<string, number> = {}
        eventsRes.data.forEach(e => { counts[e.event_name] = (counts[e.event_name] || 0) + 1 })
        setEventBreakdown(
          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([event_name, count]) => ({ event_name, count }))
        )
      }

      // Subs by category
      if (subsRes.data) {
        const counts: Record<string, number> = {}
        subsRes.data.forEach(s => {
          const cat = s.category_name || 'Uncategorized'
          counts[cat] = (counts[cat] || 0) + 1
        })
        setSubsByCategory(
          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([category, count]) => ({ category, count }))
        )
      }

      setLoading(false)
    }
    load()
  }, [period])

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-brand-charcoal">Analytics</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                period === p ? 'bg-white text-brand-charcoal shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading analytics…</div>
      ) : (
        <div className="space-y-6">
          {/* Signup Trend */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-4">User Signups</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signupTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#F59E0B"
                    fill="#F59E0B"
                    fillOpacity={0.1}
                    strokeWidth={2}
                    name="Signups"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Event Breakdown */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Top Events</h3>
              {eventBreakdown.length === 0 ? (
                <p className="text-gray-400 text-sm">No events in this period</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="event_name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={120} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Bar dataKey="count" fill="#111827" radius={[0, 4, 4, 0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Subscriptions by Category */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Subscriptions by Category</h3>
              {subsByCategory.length === 0 ? (
                <p className="text-gray-400 text-sm">No subscriptions yet</p>
              ) : (
                <div className="space-y-2">
                  {subsByCategory.map((cat, i) => {
                    const maxCount = subsByCategory[0].count
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-0.5">
                          <span className="text-brand-charcoal">{cat.category}</span>
                          <span className="text-gray-400 text-xs">{cat.count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-amber rounded-full transition-all"
                            style={{ width: `${(cat.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
