interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'bg-brand-amber/10 border-brand-amber/30' : 'bg-white border-gray-100'}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-brand-charcoal mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
