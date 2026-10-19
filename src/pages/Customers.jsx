import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [bills, setBills] = useState([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', address: ''
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('Enter customer name')
    setSaving(true)
    await supabase.from('customers').insert({
      name: form.name,
      phone: form.phone,
      address: form.address
    })
    setForm({ name: '', phone: '', address: '' })
    setShowForm(false)
    setSaving(false)
    fetchCustomers()
  }

  async function openCustomer(customer) {
    setSelected(customer)
    const { data } = await supabase
      .from('bills')
      .select('*')
      .eq('customer_name', customer.name)
      .order('created_at', { ascending: false })
    setBills(data || [])
  }

  async function handleDelete(id) {
    if (!confirm('Delete this customer?')) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  const totalSpent = bills.reduce((s, b) => s + (b.grand_total || 0), 0)
  const pendingAmount = bills
    .filter(b => b.payment_status === 'pending')
    .reduce((s, b) => s + (b.grand_total || 0), 0)

  if (loading) return <div className="text-center mt-20 text-gray-500">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto">

      {/* Customer Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b flex justify-between items-center">
              <div>
                <div className="font-bold text-gray-800">{selected.name}</div>
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="text-xs text-blue-600">
                    📞 {selected.phone}
                  </a>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Total Spent</div>
                  <div className="text-xl font-bold text-green-700">₹{totalSpent}</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Pending</div>
                  <div className="text-xl font-bold text-yellow-600">₹{pendingAmount}</div>
                </div>
              </div>

              {selected.address && (
                <div className="text-xs text-gray-500">📍 {selected.address}</div>
              )}

              {/* Order History */}
              <div>
                <div className="text-xs font-semibold text-gray-400 mb-2">ORDER HISTORY</div>
                {bills.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center">No orders yet</div>
                ) : (
                  <div className="space-y-2">
                    {bills.map(bill => (
                      <div key={bill.id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-2">
                        <div>
                          <div className="text-sm font-medium">{bill.bill_number}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(bill.date).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-700 text-sm">₹{bill.grand_total}</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            bill.payment_status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {bill.payment_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* WhatsApp */}
              {selected.phone && (
                <a
                  href={`https://wa.me/91${selected.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full bg-green-500 text-white py-2 rounded text-sm font-semibold text-center"
                >
                  💬 Open WhatsApp
                </a>
              )}

              <button
                onClick={() => handleDelete(selected.id)}
                className="w-full bg-red-50 text-red-500 py-2 rounded text-sm font-semibold mb-4"
              >
                🗑 Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-800">Customers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold"
        >
          {showForm ? '✕ Cancel' : '+ Add Customer'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow px-4 py-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500">Name *</label>
            <input
              type="text"
              placeholder="Customer name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Phone</label>
            <input
              type="tel"
              placeholder="10 digit number"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Address</label>
            <input
              type="text"
              placeholder="Optional"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-700 text-white py-2 rounded text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : '💾 Save Customer'}
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Customer List */}
      {filtered.length === 0 ? (
        <div className="text-gray-400 text-center py-10">
          No customers yet. Add your first customer.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => (
            <div
              key={customer.id}
              onClick={() => openCustomer(customer)}
              className="bg-white rounded-lg shadow px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-50"
            >
              <div>
                <div className="font-semibold text-sm">{customer.name}</div>
                {customer.phone && (
                  <div className="text-xs text-gray-400">📞 {customer.phone}</div>
                )}
                {customer.address && (
                  <div className="text-xs text-gray-400">📍 {customer.address}</div>
                )}
              </div>
              <div className="text-gray-300 text-lg">›</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}