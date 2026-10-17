import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  'Delivery', 'Pickup', 'Packaging', 'Transport',
  'Tools', 'Rent', 'Electricity', 'Other'
]

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Delivery',
    description: '',
    amount: '',
    paid_to: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchExpenses()
  }, [])

  async function fetchExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.amount || !form.description) return alert('Fill amount and description')
    setSaving(true)

    await supabase.from('expenses').insert({
      date: form.date,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      paid_to: form.paid_to
    })

    setForm({
      date: new Date().toISOString().split('T')[0],
      category: 'Delivery',
      description: '',
      amount: '',
      paid_to: ''
    })
    setShowForm(false)
    setSaving(false)
    fetchExpenses()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  const filtered = filter === 'all'
    ? expenses
    : expenses.filter(e => e.category === filter)

  const totalAll = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, e) => s + (e.amount || 0), 0)

  // Category wise totals
  const categoryTotals = CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0)
  })).filter(c => c.total > 0)

  if (loading) return <div className="text-center mt-20 text-gray-500">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-800">Expenses</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold"
        >
          {showForm ? '✕ Cancel' : '+ Add Expense'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow px-4 py-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              >
                {CATEGORIES.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Description</label>
            <input
              type="text"
              placeholder="e.g. Delivery to customer Raj"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Amount (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Paid To (optional)</label>
              <input
                type="text"
                placeholder="Name"
                value={form.paid_to}
                onChange={e => setForm({ ...form, paid_to: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-700 text-white py-2 rounded text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : '💾 Save Expense'}
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-xs text-gray-500">This Month</div>
          <div className="text-xl font-bold text-red-600">₹{thisMonth}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="text-xs text-gray-500">Total All Time</div>
          <div className="text-xl font-bold text-orange-600">₹{totalAll}</div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryTotals.length > 0 && (
        <div className="bg-white rounded-lg shadow px-4 py-3 mb-4">
          <div className="text-xs font-semibold text-gray-500 mb-2">BY CATEGORY</div>
          <div className="space-y-2">
            {categoryTotals.map(c => (
              <div key={c.cat} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{c.cat}</span>
                <span className="font-semibold text-red-600">₹{c.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            filter === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-600'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              filter === c ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Expense List */}
      {filtered.length === 0 ? (
        <div className="text-gray-400 text-center py-10">No expenses found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exp => (
            <div key={exp.id} className="bg-white rounded-lg shadow px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{exp.description}</div>
                <div className="text-xs text-gray-400">
                  {exp.category} • {new Date(exp.date).toLocaleDateString('en-IN')}
                  {exp.paid_to && ` • ${exp.paid_to}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-red-600">₹{exp.amount}</span>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="text-gray-300 hover:text-red-400 text-sm"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}