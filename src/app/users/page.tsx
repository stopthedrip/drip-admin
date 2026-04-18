'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import AdminShell from '@/components/AdminShell'
import Link from 'next/link'
import type { User } from '@/lib/types'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const loadUsers = useCallback(async (searchTerm: string, pageNum: number) => {
    setLoading(true)
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (searchTerm.trim()) {
      query = query.or(`email.ilike.%${searchTerm.trim()}%,display_name.ilike.%${searchTerm.trim()}%`)
    }

    const { data, count } = await query
    if (data) setUsers(data)
    if (count !== null) setTotal(count)
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers(search, page) }, [loadUsers, search, page])

  // Reset to first page when search changes
  const [prevSearch, setPrevSearch] = useState(search)
  if (search !== prevSearch) {
    setPrevSearch(search)
    if (page !== 0) setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-brand-charcoal">Users</h2>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500">Admin</th>
              <th className="px-4 py-3 font-medium text-gray-500">Joined</th>
              <th className="px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-brand-charcoal">{user.email}</td>
                  <td className="px-4 py-3 text-gray-600">{user.display_name || '—'}</td>
                  <td className="px-4 py-3">
                    {user.is_admin && (
                      <span className="px-2 py-0.5 bg-brand-amber/10 text-brand-amber-dark text-xs rounded-full font-medium">Admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/users/${user.id}`}
                      className="text-brand-amber hover:text-brand-amber-dark text-xs font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
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
