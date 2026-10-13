import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Inventory() {
  const [inventory, setInventory] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInventory()
  }, [])

  async function fetchInventory() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('part_name', { ascending: true })

    if (error) console.error(error)
    else setInventory(data)
    setLoading(false)
  }

  const filtered = inventory.filter(item =>
    item.part_name.toLowerCase().includes(search.toLowerCase()) ||
    item.part_code.toLowerCase().includes(search.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return <div className="text-center mt-20 text-gray-500">Loading...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Inventory</h1>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by part name, code or category..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full md:w-1/2 border border-gray-300 rounded px-4 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-gray-500">No parts found. Import a purchase order to add parts.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white shadow rounded-lg overflow-hidden text-sm">
            <thead className="bg-blue-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left">Part Code</th>
                <th className="px-4 py-3 text-left">Part Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Cost Price (₹)</th>
                <th className="px-4 py-3 text-right">Selling Price (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-mono text-blue-600">{item.part_code}</td>
                  <td className="px-4 py-3">{item.part_name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">₹{item.unit_cost}</td>
                  <td className="px-4 py-3 text-right">₹{item.selling_price}</td>
                  <td className="px-4 py-3 text-center">
                    {item.quantity <= item.low_stock_alert ? (
                      <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-semibold">Low Stock</span>
                    ) : (
                      <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-semibold">In Stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}