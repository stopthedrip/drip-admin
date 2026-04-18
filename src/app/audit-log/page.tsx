'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import AdminShell from '@/components/AdminShell'
import type { AuditLogEntry } from '@/lib/types'

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  grant_pro:  { label: 'Grant Pro', color: 'bg-green-50 text-green-600' },
  revoke_pro: { label: 'Revoke Pro', color: 'bg-red-50 text-red-600' },
  view_user:  { label: 'View User', color: 'bg-blue-50 text-blue-600' },
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<(AuditLogEntry & { admin_email?: string; target_email?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState<string>('')
  const PAGE_SIZE = 25

  const load = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (actionFilter) {
      query = query.eq('action', actionFilter)
    }

    const { data, count } = await query

    if (data) {
      // Fetch admin and target emails
      const adminIds = [...new Set(data.map(e => e.admin_id))]
      const targetIds = [...new Set(data.filter(e => e.target_user_id).map(e => e.target_user_id!))]
      const allIds = [...new Set([...adminIds, ...targetIds])]

      const { data: users } = await supabase.from('users').select('id, email').in('id', allIds)
      const emailMap: Record<string, string> = {}
      users?.forEach(u => { emailMap[u.id] = u.email })

      setEntries(data.map(e => ({
        ...e,
        admin_email: emailMap[e.admin_id],
        target_email: e.target_user_id ? emailMap[e.target_user_id] : undefined,
      })))
    }

    if (count !== null) setTotal(count)
    setLoading(false)
  }, [page, actionFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [actionFilter])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function formatDetails(details: Record<string, unknown>): string {
    const parts: string[] = []
    if (details.reason) parts.push(`Reason: ${details.reason}`)
    if (details.duration) parts.push(`Duration: ${details.duration}`)
    if (details.override_id) parts.push(`Override #${details.override_id}`)
    return parts.join(' · ') || '—'
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-brand-charcoal">Audit Log</h2>
        <span className="text-sm text-gray-400">{total} entries</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActionFilter('')}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            !actionFilter ? 'bg-brand-charcoal text-white border-brand-charcoal' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        {Object.entries(ACTION_LABELS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setActionFilter(key)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              actionFilter === key ? 'bg-brand-charcoal text-white border-brand-charcoal' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {val.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-500">Time</th>
              <th className="px-4 py-3 font-medium text-gray-500">Action</th>
              <th className="px-4 py-3 font-medium text-gray-500">Admin</th>
              <th className="px-4 py-3 font-medium text-gray-500">Target User</th>
              <th className="px-4 py-3 font-medium text-gray-500">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No audit log entries</td></tr>
            ) : (
              entries.map(entry => {
                const actionInfo = ACTION_LABELS[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.admin_email || entry.admin_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.target_email || entry.target_user_id?.slice(0, 8) || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDetails(entry.details)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">Page {page + 1} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </AdminShell>
  )
}
