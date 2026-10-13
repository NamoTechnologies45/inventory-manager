import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalParts: 0,
    lowStock: 0,
    totalPOs: 0,
    totalSOs: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    const { data: inventory } = await supabase.from('inventory').select('*')
    const { data: pos } = await supabase.from('purchase_orders').select('id')
    const { data: sos } = await supabase.from('sell_orders').select('id')

    setStats({
      totalParts: inventory?.length || 0,
      lowStock: inventory?.filter(i => i.quantity <= i.low_stock_alert).length || 0,
      totalPOs: pos?.length || 0,
      totalSOs: sos?.length || 0,
    })
    setLoading(false)
  }

  if (loading) return <div className="text-center mt-20 text-gray-500">Loading...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Parts" value={stats.totalParts} color="blue" />
        <StatCard label="Low Stock" value={stats.lowStock} color="red" />
        <StatCard label="Purchase Orders" value={stats.totalPOs} color="green" />
        <StatCard label="Sell Orders" value={stats.totalSOs} color="purple" />
      </div>

      {/* Low stock warning */}
      {stats.lowStock > 0 && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          ⚠️ {stats.lowStock} part(s) are running low on stock. Check Inventory.
        </div>
      )}

      <div className="bg-white rounded-lg p-6 shadow text-gray-500 text-sm">
        Use the navbar to import orders or generate quotations.
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <div className={`rounded-lg p-5 shadow ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  )
}