import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { parseOrderWithGemini } from '../lib/gemini'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

function useLocalState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : defaultValue
    } catch { return defaultValue }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [state, key])

  return [state, setState]
}

export default function Quotation() {
  const [input, setInput] = useLocalState('q_input', '')
  const [customerName, setCustomerName] = useLocalState('q_customerName', '')
  const [customerPhone, setCustomerPhone] = useLocalState('q_customerPhone', '')
  const [available, setAvailable] = useLocalState('q_available', [])
  const [unavailable, setUnavailable] = useLocalState('q_unavailable', [])
  const [alternatives, setAlternatives] = useLocalState('q_alternatives', [])
  const [searched, setSearched] = useLocalState('q_searched', false)
  const [showBill, setShowBill] = useLocalState('q_showBill', false)
  const [billItems, setBillItems] = useLocalState('q_billItems', [])
  const [extras, setExtras] = useLocalState('q_extras', [{ label: '', amount: '' }])
  const [discount, setDiscount] = useLocalState('q_discount', 0)
  const [notes, setNotes] = useLocalState('q_notes', '')
  const [billSaved, setBillSaved] = useLocalState('q_billSaved', false)
  const [savedBillNo, setSavedBillNo] = useLocalState('q_savedBillNo', '')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  async function handleSearch() {
    if (!input.trim()) return
    setLoading(true)
    setSearched(false)
    setShowBill(false)
    setBillSaved(false)
    setAvailable([])
    setUnavailable([])
    setAlternatives([])

    try {
      setLoadingMsg('Fetching inventory...')
      const { data: inventory } = await supabase.from('inventory').select('*')

      setLoadingMsg('AI is analysing order...')
      const parsed = await parseOrderWithGemini(input, inventory)

      const availableList = []
      const unavailableList = []
      const alternativeList = []

      for (const item of parsed) {
        const matched = item.matched_part_code
          ? inventory.find(i => i.part_code === item.matched_part_code)
          : null

        if (matched) {
          if (matched.quantity >= item.quantity) {
            availableList.push({
              part_code: matched.part_code,
              part_name: matched.part_name,
              qty: item.quantity,
              unit_price: matched.selling_price,
              total: item.quantity * matched.selling_price
            })
          } else {
            unavailableList.push({
              name: item.cleaned,
              qty: item.quantity,
              reason: `Only ${matched.quantity} in stock`
            })
            if (item.alternative_part_code) {
              const alt = inventory.find(i => i.part_code === item.alternative_part_code)
              if (alt) {
                alternativeList.push({
                  requested: item.cleaned,
                  qty: item.quantity,
                  alt_part_code: alt.part_code,
                  alt_part_name: alt.part_name,
                  alt_qty: alt.quantity,
                  reason: item.alternative_reason
                })
              }
            }
          }
        } else {
          unavailableList.push({
            name: item.cleaned || item.original,
            qty: item.quantity,
            reason: 'Not found in inventory'
          })
          if (item.alternative_part_code) {
            const alt = inventory.find(i => i.part_code === item.alternative_part_code)
            if (alt) {
              alternativeList.push({
                requested: item.cleaned || item.original,
                qty: item.quantity,
                alt_part_code: alt.part_code,
                alt_part_name: alt.part_name,
                alt_qty: alt.quantity,
                reason: item.alternative_reason
              })
            }
          }
        }
      }

      setAvailable(availableList)
      setUnavailable(unavailableList)
      setAlternatives(alternativeList)
      setSearched(true)
    } catch (err) {
      alert('Error: ' + err.message)
    }

    setLoading(false)
    setLoadingMsg('')
  }

  function handleConvertToBill() {
    setBillItems(available.map(i => ({ ...i })))
    setExtras([{ label: '', amount: '' }])
    setDiscount(0)
    setNotes('')
    setShowBill(true)
    setBillSaved(false)
  }

  function updateBillItem(index, field, value) {
    const updated = [...billItems]
    updated[index][field] = field === 'qty' || field === 'unit_price'
      ? parseFloat(value) || 0
      : value
    updated[index].total = updated[index].qty * updated[index].unit_price
    setBillItems(updated)
  }

  function removeBillItem(index) {
    setBillItems(billItems.filter((_, i) => i !== index))
  }

  function addExtra() {
    setExtras([...extras, { label: '', amount: '' }])
  }

  function updateExtra(index, field, value) {
    const updated = [...extras]
    updated[index][field] = value
    setExtras(updated)
  }

  function removeExtra(index) {
    setExtras(extras.filter((_, i) => i !== index))
  }

  const subtotal = billItems.reduce((s, i) => s + (i.total || 0), 0)
  const extrasTotal = extras.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const grandTotal = subtotal + extrasTotal - (parseFloat(discount) || 0)

  function generateBillNumber() {
    return 'BILL-' + Date.now().toString().slice(-6)
  }

  async function handleSaveBill() {
    if (billItems.length === 0) return alert('No items in bill')
    if (!customerName.trim()) return alert('Please enter customer name')

    setLoading(true)
    setLoadingMsg('Saving bill...')

    const billNo = generateBillNumber()

    try {
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          bill_number: billNo,
          date: new Date().toISOString().split('T')[0],
          customer_name: customerName,
          customer_phone: customerPhone,
          subtotal,
          extra_charges: extrasTotal,
          discount: parseFloat(discount) || 0,
          grand_total: grandTotal,
          payment_status: 'pending',
          notes
        })
        .select()
        .single()

      if (billError) throw billError

      await supabase.from('bill_items').insert(
        billItems.map(i => ({
          bill_id: bill.id,
          part_code: i.part_code,
          part_name: i.part_name,
          quantity: i.qty,
          unit_price: i.unit_price,
          total: i.total
        }))
      )

      const validExtras = extras.filter(e => e.label && e.amount)
      if (validExtras.length > 0) {
        await supabase.from('bill_extras').insert(
          validExtras.map(e => ({
            bill_id: bill.id,
            label: e.label,
            amount: parseFloat(e.amount)
          }))
        )
      }

      for (const item of billItems) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('part_code', item.part_code)

        if (inv && inv.length > 0) {
          await supabase
            .from('inventory')
            .update({ quantity: inv[0].quantity - item.qty })
            .eq('part_code', item.part_code)
        }

        await supabase.from('sell_orders').insert({
          so_number: billNo,
          date: new Date().toISOString().split('T')[0],
          customer: customerName,
          part_code: item.part_code,
          quantity: item.qty,
          unit_price: item.unit_price
        })
      }

      setSavedBillNo(billNo)
      setBillSaved(true)
    } catch (err) {
      alert('Error saving bill: ' + err.message)
    }

    setLoading(false)
    setLoadingMsg('')
  }

  function exportBillPDF() {
    const doc = new jsPDF()
    const date = new Date().toLocaleDateString('en-IN')
    const billNo = savedBillNo || generateBillNumber()

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Ganesh Electronics', 14, 18)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Tax Invoice / Bill', 14, 25)
    doc.line(14, 27, 196, 27)

    doc.setFontSize(10)
    doc.text(`Bill No: ${billNo}`, 14, 34)
    doc.text(`Date: ${date}`, 140, 34)
    doc.text(`Customer: ${customerName}`, 14, 41)
    if (customerPhone) doc.text(`Phone: ${customerPhone}`, 14, 47)

    let startY = customerPhone ? 54 : 48

    autoTable(doc, {
      startY,
      head: [['#', 'Part Name', 'Qty', 'Unit Price', 'Total']],
      body: billItems.map((i, idx) => [
        idx + 1, i.part_name, i.qty, `Rs.${i.unit_price}`, `Rs.${i.total}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [29, 78, 216] },
      styles: { fontSize: 9 }
    })

    startY = doc.lastAutoTable.finalY + 6

    const totalsData = [['Subtotal', `Rs.${subtotal}`]]
    extras.filter(e => e.label && e.amount).forEach(e => {
      totalsData.push([e.label, `Rs.${e.amount}`])
    })
    if (discount > 0) totalsData.push(['Discount', `-Rs.${discount}`])
    totalsData.push(['GRAND TOTAL', `Rs.${grandTotal}`])

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

    if (notes) {
      doc.setFontSize(9)
      doc.text(`Notes: ${notes}`, 14, doc.lastAutoTable.finalY + 8)
    }

    doc.save(`Bill_${billNo}.pdf`)
  }

  function exportSellOrderExcel() {
    const billNo = savedBillNo || generateBillNumber()
    const rows = billItems.map(i => ({
      SO_Number: billNo,
      Date: new Date().toLocaleDateString('en-IN'),
      Customer: customerName,
      Part_Code: i.part_code,
      Part_Name: i.part_name,
      Quantity: i.qty,
      Unit_Price: i.unit_price,
      Total: i.total
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sell Order')
    XLSX.writeFile(wb, `SellOrder_${billNo}.xlsx`)
  }

  function exportQuotePDF() {
    const doc = new jsPDF()
    const date = new Date().toLocaleDateString('en-IN')
    const quoteNo = 'Q-' + Date.now().toString().slice(-6)

    doc.setFontSize(16)
    doc.text('Ganesh Electronics', 14, 18)
    doc.setFontSize(10)
    doc.text(`Quotation No: ${quoteNo}`, 14, 28)
    doc.text(`Date: ${date}`, 140, 28)
    if (customerName) doc.text(`Customer: ${customerName}`, 14, 35)

    let startY = customerName ? 42 : 35

    if (available.length > 0) {
      doc.setFontSize(11)
      doc.text('Available Parts', 14, startY)
      autoTable(doc, {
        startY: startY + 4,
        head: [['Part Name', 'Qty', 'Unit Price', 'Total']],
        body: available.map(i => [i.part_name, i.qty, `Rs.${i.unit_price}`, `Rs.${i.total}`]),
        foot: [['', '', 'Total', `Rs.${available.reduce((s, i) => s + i.total, 0)}`]],
        theme: 'striped',
        headStyles: { fillColor: [29, 78, 216] },
        footStyles: { fillColor: [220, 252, 231], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      })
      startY = doc.lastAutoTable.finalY + 8
    }

    if (unavailable.length > 0) {
      doc.setFontSize(11)
      doc.text('Unavailable Parts', 14, startY)
      autoTable(doc, {
        startY: startY + 4,
        head: [['Requested', 'Qty', 'Reason']],
        body: unavailable.map(i => [i.name, i.qty, i.reason]),
        theme: 'striped',
        headStyles: { fillColor: [185, 28, 28] },
        styles: { fontSize: 9 }
      })
    }

    doc.save(`Quotation_${quoteNo}.pdf`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-1 text-gray-800">Quotation</h1>
      <p className="text-gray-500 text-sm mb-4">Type order — AI checks inventory and builds quotation.</p>

      <div className="flex flex-col gap-2 mb-3">
        <input
          type="text"
          placeholder="Customer name"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          placeholder="Customer phone (optional)"
          value={customerPhone}
          onChange={e => setCustomerPhone(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-xs text-blue-800">
        One item per line: <span className="font-mono">bc547 x 50</span>
      </div>

      <textarea
        rows={6}
        placeholder={"bc547 x 50\nlm358 x 10\n10k res x 100"}
        value={input}
        onChange={e => setInput(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 mb-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <button
        onClick={handleSearch}
        disabled={loading}
        className="w-full bg-blue-700 text-white py-2 rounded text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 mb-4"
      >
        {loading ? loadingMsg : '🔍 Generate Quotation'}
      </button>

      {searched && !showBill && (
        <div className="space-y-4">
          {available.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-green-700 mb-2">✅ Available ({available.length})</h2>
              <div className="bg-white rounded shadow overflow-hidden">
                {available.map((item, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-2 border-b text-sm">
                    <div>
                      <div className="font-medium">{item.part_name}</div>
                      <div className="text-xs text-gray-400">Qty: {item.qty} × ₹{item.unit_price}</div>
                    </div>
                    <div className="font-semibold text-green-700">₹{item.total}</div>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 bg-green-50 font-bold text-sm">
                  <span>Total</span>
                  <span className="text-green-700">₹{available.reduce((s, i) => s + i.total, 0)}</span>
                </div>
              </div>
            </div>
          )}

          {alternatives.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-yellow-600 mb-2">💡 Alternatives</h2>
              <div className="bg-white rounded shadow overflow-hidden">
                {alternatives.map((item, i) => (
                  <div key={i} className="px-3 py-2 border-b text-sm">
                    <div className="text-red-400 text-xs">{item.requested}</div>
                    <div className="font-medium">{item.alt_part_name}</div>
                    <div className="text-xs text-gray-400">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unavailable.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 mb-2">❌ Unavailable ({unavailable.length})</h2>
              <div className="bg-white rounded shadow overflow-hidden">
                {unavailable.map((item, i) => (
                  <div key={i} className="flex justify-between px-3 py-2 border-b text-sm">
                    <span>{item.name} × {item.qty}</span>
                    <span className="text-red-400 text-xs">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={exportQuotePDF}
              className="w-full bg-gray-600 text-white py-2 rounded text-sm font-semibold hover:bg-gray-700"
            >
              📄 Download Quotation PDF
            </button>
            {available.length > 0 && (
              <button
                onClick={handleConvertToBill}
                className="w-full bg-green-600 text-white py-2 rounded text-sm font-semibold hover:bg-green-700"
              >
                ✅ Customer Confirmed — Convert to Bill
              </button>
            )}
          </div>
        </div>
      )}

      {showBill && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">🧾 Bill</h2>
            <button onClick={() => setShowBill(false)} className="text-xs text-gray-400 underline">
              ← Back to Quotation
            </button>
          </div>

          <div className="bg-white rounded shadow overflow-hidden">
            <div className="bg-blue-700 text-white text-xs px-3 py-2 font-semibold">Items</div>
            {billItems.map((item, i) => (
              <div key={i} className="px-3 py-2 border-b">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium flex-1 pr-2">{item.part_name}</span>
                  <button onClick={() => removeBillItem(i)} className="text-red-400 text-xs">✕</button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Qty</label>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={e => updateBillItem(i, 'qty', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Price (₹)</label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={e => updateBillItem(i, 'unit_price', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Total</label>
                    <div className="text-sm font-semibold pt-1">₹{item.total}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2 bg-gray-50 text-sm font-semibold">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
          </div>

          <div className="bg-white rounded shadow overflow-hidden">
            <div className="bg-gray-600 text-white text-xs px-3 py-2 font-semibold">Extra Charges</div>
            {extras.map((e, i) => (
              <div key={i} className="flex gap-2 px-3 py-2 border-b items-center">
                <input
                  type="text"
                  placeholder="Label (e.g. Delivery)"
                  value={e.label}
                  onChange={ev => updateExtra(i, 'label', ev.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  placeholder="₹"
                  value={e.amount}
                  onChange={ev => updateExtra(i, 'amount', ev.target.value)}
                  className="w-24 border rounded px-2 py-1 text-sm"
                />
                <button onClick={() => removeExtra(i)} className="text-red-400 text-xs">✕</button>
              </div>
            ))}
            <button onClick={addExtra} className="w-full text-blue-600 text-sm py-2 hover:bg-blue-50">
              + Add Charge
            </button>
          </div>

          <div className="bg-white rounded shadow px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-24">Discount (₹)</label>
              <input
                type="number"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-24">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="flex-1 border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded px-4 py-3 flex justify-between items-center">
            <span className="font-bold text-gray-700">Grand Total</span>
            <span className="text-2xl font-bold text-green-700">₹{grandTotal}</span>
          </div>

          {!billSaved ? (
            <button
              onClick={handleSaveBill}
              disabled={loading}
              className="w-full bg-blue-700 text-white py-3 rounded font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? loadingMsg : '💾 Save Bill & Deduct Inventory'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="bg-green-100 text-green-700 px-4 py-3 rounded text-sm font-semibold text-center">
                ✅ Bill {savedBillNo} saved! Inventory updated.
              </div>
              <button
                onClick={exportBillPDF}
                className="w-full bg-blue-700 text-white py-2 rounded text-sm font-semibold hover:bg-blue-800"
              >
                📄 Download Bill PDF
              </button>
              <button
                onClick={exportSellOrderExcel}
                className="w-full bg-green-600 text-white py-2 rounded text-sm font-semibold hover:bg-green-700"
              >
                📊 Download Sell Order Excel
              </button>
              <button
                onClick={() => {
                  setInput('')
                  setSearched(false)
                  setShowBill(false)
                  setBillSaved(false)
                  setAvailable([])
                  setUnavailable([])
                  setAlternatives([])
                  setCustomerName('')
                  setCustomerPhone('')
                }}
                className="w-full bg-gray-400 text-white py-2 rounded text-sm font-semibold hover:bg-gray-500"
              >
                🔄 New Quotation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}