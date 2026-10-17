import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function SellOrders() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [billItems, setBillItems] = useState([])
  const [billExtras, setBillExtras] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchBills()
  }, [])

  async function fetchBills() {
    const { data } = await supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false })
    setBills(data || [])
    setLoading(false)
  }

  async function openBill(bill) {
    setSelected(bill)
    const { data: items } = await supabase
      .from('bill_items')
      .select('*')
      .eq('bill_id', bill.id)
    const { data: extras } = await supabase
      .from('bill_extras')
      .select('*')
      .eq('bill_id', bill.id)
    setBillItems(items || [])
    setBillExtras(extras || [])
  }

  async function markPaid(bill) {
    await supabase
      .from('bills')
      .update({ payment_status: 'paid' })
      .eq('id', bill.id)
    fetchBills()
    if (selected?.id === bill.id) {
      setSelected({ ...bill, payment_status: 'paid' })
    }
  }

  async function markPending(bill) {
    await supabase
      .from('bills')
      .update({ payment_status: 'pending' })
      .eq('id', bill.id)
    fetchBills()
    if (selected?.id === bill.id) {
      setSelected({ ...bill, payment_status: 'pending' })
    }
  }

  function exportBillPDF(bill, items, extras) {
    const doc = new jsPDF()
    const date = new Date(bill.date).toLocaleDateString('en-IN')

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Ganesh Electronics', 14, 18)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Tax Invoice / Bill', 14, 25)
    doc.line(14, 27, 196, 27)

    doc.setFontSize(10)
    doc.text(`Bill No: ${bill.bill_number}`, 14, 34)
    doc.text(`Date: ${date}`, 140, 34)
    doc.text(`Customer: ${bill.customer_name}`, 14, 41)
    if (bill.customer_phone) doc.text(`Phone: ${bill.customer_phone}`, 14, 47)

    let startY = bill.customer_phone ? 54 : 48

    autoTable(doc, {
      startY,
      head: [['#', 'Part Name', 'Qty', 'Unit Price', 'Total']],
      body: items.map((i, idx) => [
        idx + 1, i.part_name, i.quantity,
        `Rs.${i.unit_price}`, `Rs.${i.total}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [29, 78, 216] },
      styles: { fontSize: 9 }
    })

    startY = doc.lastAutoTable.finalY + 6

    const totalsData = [['Subtotal', `Rs.${bill.subtotal}`]]
    extras.forEach(e => totalsData.push([e.label, `Rs.${e.amount}`]))
    if (bill.discount > 0) totalsData.push(['Discount', `-Rs.${bill.discount}`])
    totalsData.push(['GRAND TOTAL', `Rs.${bill.grand_total}`])

    autoTable(doc, {
      startY,
      body: totalsData,
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 50, halign: 'right' }
      },
      didParseCell: (data) => {
        if (data.row.index === totalsData.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 12
        }
      }
    })

    if (bill.notes) {
      doc.setFontSize(9)
      doc.text(`Notes: ${bill.notes}`, 14, doc.lastAutoTable.finalY + 8)
    }

    doc.save(`Bill_${bill.bill_number}.pdf`)
  }

  const filtered = bills.filter(b => {
    const matchFilter = filter === 'all' || b.payment_status === filter
    const matchSearch = b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.bill_number?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const totalRevenue = bills.reduce((s, b) => s + (b.grand_total || 0), 0)
  const totalPending = bills
    .filter(b => b.payment_status === 'pending')
    .reduce((s, b) => s + (b.grand_total || 0), 0)

  if (loading) return <div className="text-center mt-20 text-gray-500">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto">

      {/* Bill Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b flex justify-between items-center">
              <div>
                <div className="font-bold text-gray-800">{selected.bill_number}</div>
                <div className="text-xs text-gray-400">{selected.customer_name}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* Status */}
              <div className="flex justify-between items-center">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selected.payment_status === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {selected.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                </span>
                <span className="text-sm text-gray-400">
                  {new Date(selected.date).toLocaleDateString('en-IN')}
                </span>
              </div>

              {/* Items */}
              <div className="bg-gray-50 rounded overflow-hidden">
                <div className="text-xs font-semibold text-gray-500 px-3 py-2 bg-gray-200">Items</div>
                {billItems.map((item, i) => (
                  <div key={i} className="flex justify-between px-3 py-2 border-b text-sm">
                    <div>
                      <div>{item.part_name}</div>
                      <div className="text-xs text-gray-400">{item.quantity} × ₹{item.unit_price}</div>
                    </div>
                    <div className="font-semibold">₹{item.total}</div>
                  </div>
                ))}
              </div>

              {/* Extras */}
              {billExtras.length > 0 && (
                <div className="bg-gray-50 rounded overflow-hidden">
                  <div className="text-xs font-semibold text-gray-500 px-3 py-2 bg-gray-200">Extra Charges</div>
                  {billExtras.map((e, i) => (
                    <div key={i} className="flex justify-between px-3 py-2 border-b text-sm">
                      <span>{e.label}</span>
                      <span>₹{e.amount}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="bg-gray-50 rounded px-3 py-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>₹{selected.subtotal}</span>
                </div>
                {selected.discount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Discount</span>
                    <span>-₹{selected.discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t">
                  <span>Grand Total</span>
                  <span className="text-green-700">₹{selected.grand_total}</span>
                </div>
              </div>

              {selected.notes && (
                <div className="text-xs text-gray-500">Notes: {selected.notes}</div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 pb-4">
                <button
                  onClick={() => exportBillPDF(selected, billItems, billExtras)}
                  className="w-full bg-blue-700 text-white py-2 rounded text-sm font-semibold"
                >
                  📄 Download Bill PDF
                </button>
                {selected.payment_status === 'pending' ? (
                  <button
                    onClick={() => markPaid(selected)}
                    className="w-full bg-green-600 text-white py-2 rounded text-sm font-semibold"
                  >
                    ✅ Mark as Paid
                  </button>
                ) : (
                  <button
                    onClick={() => markPending(selected)}
                    className="w-full bg-yellow-500 text-white py-2 rounded text-sm font-semibold"
                  >
                    ⏳ Mark as Pending
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-xl font-bold mb-1 text-gray-800">Sell Orders</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs text-gray-500">Total Revenue</div>
          <div className="text-xl font-bold text-green-700">₹{totalRevenue}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-xs text-gray-500">Pending Payment</div>
          <div className="text-xl font-bold text-yellow-600">₹{totalPending}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <input
        type="text"
        placeholder="Search by customer or bill number..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'paid'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
              filter === f
                ? 'bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bills List */}
      {filtered.length === 0 ? (
        <div className="text-gray-400 text-center py-10">No bills found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(bill => (
            <div
              key={bill.id}
              onClick={() => openBill(bill)}
              className="bg-white rounded-lg shadow px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-50"
            >
              <div>
                <div className="font-semibold text-sm">{bill.bill_number}</div>
                <div className="text-xs text-gray-500">{bill.customer_name}</div>
                <div className="text-xs text-gray-400">
                  {new Date(bill.date).toLocaleDateString('en-IN')}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-700">₹{bill.grand_total}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
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
  )
}