'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminShell from '@/components/AdminShell'
import type { User, Subscription, EntitlementOverride } from '@/lib/types'

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [overrides, setOverrides] = useState<EntitlementOverride[]>([])
  const [loading, setLoading] = useState(true)

  // Pro grant form
  const [showGrant, setShowGrant] = useState(false)
  const [grantReason, setGrantReason] = useState('')
  const [grantDuration, setGrantDuration] = useState<'7d' | '30d' | '90d' | '1y' | 'permanent'>('30d')
  const [granting, setGranting] = useState(false)

  useEffect(() => {
    async function load() {
      const [userRes, subsRes, overridesRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', id).single(),
        supabase.from('subscriptions').select('*').eq('user_id', id).order('created_at', { ascending: false }),
        supabase.from('entitlement_overrides').select('*').eq('user_id', id).order('granted_at', { ascending: false }),
      ])

      if (userRes.data) setUser(userRes.data)
      if (subsRes.data) setSubs(subsRes.data)
      if (overridesRes.data) setOverrides(overridesRes.data)
      setLoading(false)
    }
    load()
  }, [id])

  async function grantPro() {
    setGranting(true)
    const { data: { user: admin } } = await supabase.auth.getUser()
    if (!admin) { setGranting(false); return }

    let expiresAt: string | null = null
    if (grantDuration !== 'permanent') {
      const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[grantDuration]
      const date = new Date()
      date.setDate(date.getDate() + days)
      expiresAt = date.toISOString()
    }

    const { error } = await supabase.from('entitlement_overrides').insert({
      user_id: id,
      is_pro: true,
      reason: grantReason || null,
      granted_by: admin.id,
      expires_at: expiresAt,
    })

    if (!error) {
      // Log the action
      await supabase.from('admin_audit_log').insert({
        admin_id: admin.id,
        action: 'grant_pro',
        target_user_id: id,
        details: { reason: grantReason, duration: grantDuration, expires_at: expiresAt },
      })

      // Reload overrides
      const { data } = await supabase.from('entitlement_overrides').select('*').eq('user_id', id).order('granted_at', { ascending: false })
      if (data) setOverrides(data)
      setShowGrant(false)
      setGrantReason('')
    }
    setGranting(false)
  }

  async function revokeOverride(overrideId: number) {
    const { data: { user: admin } } = await supabase.auth.getUser()
    if (!admin) return

    await supabase
      .from('entitlement_overrides')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', overrideId)

    await supabase.from('admin_audit_log').insert({
      admin_id: admin.id,
      action: 'revoke_pro',
      target_user_id: id,
      details: { override_id: overrideId },
    })

    const { data } = await supabase.from('entitlement_overrides').select('*').eq('user_id', id).order('granted_at', { ascending: false })
    if (data) setOverrides(data)
  }

  function formatCurrency(cents: number, code: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(cents / 100)
  }

  function overrideStatus(o: EntitlementOverride) {
    if (o.revoked_at) return { label: 'Revoked', color: 'bg-red-50 text-red-600' }
    if (o.expires_at && new Date(o.expires_at) < new Date()) return { label: 'Expired', color: 'bg-gray-100 text-gray-500' }
    return { label: 'Active', color: 'bg-green-50 text-green-600' }
  }

  if (loading) {
    return <AdminShell><div className="text-gray-400 text-sm">Loading user…</div></AdminShell>
  }

  if (!user) {
    return <AdminShell><div className="text-red-500 text-sm">User not found.</div></AdminShell>
  }

  return (
    <AdminShell>
      {/* Header */}
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-4 block">← Back to Users</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-brand-charcoal">{user.display_name || user.email}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Joined {new Date(user.created_at).toLocaleDateString()} · ID: <span className="font-mono">{user.id.slice(0, 8)}…</span>
          </p>
        </div>
        {user.is_admin && (
          <span className="px-3 py-1 bg-brand-amber/10 text-brand-amber-dark text-xs rounded-full font-medium">Admin</span>
        )}
      </div>

      {/* Pro Access Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-500">Pro Access Overrides</h3>
          <button
            onClick={() => setShowGrant(!showGrant)}
            className="px-3 py-1.5 bg-brand-amber text-brand-charcoal text-xs font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            {showGrant ? 'Cancel' : 'Grant Pro'}
          </button>
        </div>

        {/* Grant form */}
        {showGrant && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
              <div className="flex gap-2 flex-wrap">
                {(['7d', '30d', '90d', '1y', 'permanent'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setGrantDuration(d)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      grantDuration === d
                        ? 'bg-brand-charcoal text-white border-brand-charcoal'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {d === '7d' ? '7 Days' : d === '30d' ? '30 Days' : d === '90d' ? '90 Days' : d === '1y' ? '1 Year' : 'Permanent'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={grantReason}
                onChange={e => setGrantReason(e.target.value)}
                placeholder="e.g. Beta tester, support ticket #123"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
              />
            </div>
            <button
              onClick={grantPro}
              disabled={granting}
              className="px-4 py-2 bg-brand-charcoal text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {granting ? 'Granting…' : 'Confirm Grant'}
            </button>
          </div>
        )}

        {/* Override list */}
        {overrides.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-400">No overrides</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-2 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Granted</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Expires</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Reason</th>
                  <th className="px-4 py-2 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {overrides.map(o => {
                  const status = overrideStatus(o)
                  const isActive = !o.revoked_at && (!o.expires_at || new Date(o.expires_at) > new Date())
                  return (
                    <tr key={o.id} className="border-b border-gray-50">
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{new Date(o.granted_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-gray-400">{o.expires_at ? new Date(o.expires_at).toLocaleDateString() : 'Never'}</td>
                      <td className="px-4 py-2 text-gray-400">{o.reason || '—'}</td>
                      <td className="px-4 py-2">
                        {isActive && (
                          <button
                            onClick={() => revokeOverride(o.id)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Subscriptions */}
      <section>
        <h3 className="text-sm font-medium text-gray-500 mb-3">Subscriptions ({subs.length})</h3>
        {subs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-400">No subscriptions</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-2 font-medium text-gray-500">Service</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Price</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Cycle</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Label</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Next Renewal</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-brand-charcoal flex items-center gap-2">
                      {s.logo_url && <img src={s.logo_url} alt="" className="w-5 h-5 rounded" />}
                      {s.name}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{formatCurrency(s.price_cents, s.currency_code)}</td>
                    <td className="px-4 py-2 text-gray-400 capitalize">{s.cycle.toLowerCase()}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">{s.label.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active ? (s.on_free_trial ? 'Trial' : 'Active') : 'Cancelled'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400">{s.next_renewal_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  )
}
