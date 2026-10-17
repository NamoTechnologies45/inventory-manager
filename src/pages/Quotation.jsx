import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseOrderWithGemini } from '../lib/gemini'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Quotation() {
  const [input, setInput] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [available, setAvailable] = useState([])
  const [unavailable, setUnavailable] = useState([])
  const [alternatives, setAlternatives] = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  async function handleSearch() {
    if (!input.trim()) return
    setLoading(true)
    setSearched(false)
    setAvailable([])
    setUnavailable([])
    setAlternatives([])

    try {
      setLoadingMsg('Fetching inventory...')
      const { data: inventory } = await supabase.from('inventory').select('*')

      setLoadingMsg('Analysing your order with AI...')
      const parsed = await parseOrderWithGemini(input, inventory)

      const availableList = []
      const unavailableList = []
      const alternativeList = []

      for (const item of parsed) {
        // Find matched item in inventory
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
              reason: `Only ${matched.quantity} in stock (need ${item.quantity})`
            })

            // Check alternative
            if (item.alternative_part_code) {
              const alt = inventory.find(i => i.part_code === item.alternative_part_code)
              if (alt && alt.quantity >= item.quantity) {
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

          // Check alternative
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
      console.error(err)
      alert('Error: ' + err.message)
    }

    setLoading(false)
    setLoadingMsg('')
  }

  function exportPDF() {
    const doc = new jsPDF()
    const date = new Date().toLocaleDateString('en-IN')
    const quoteNo = 'Q-' + Date.now().toString().slice(-6)

    doc.setFontSize(16)
    doc.text('Ganesh Electronics', 14, 20)
    doc.setFontSize(10)
    doc.text(`Quotation No: ${quoteNo}`, 14, 30)
    doc.text(`Date: ${date}`, 14, 36)
    if (customerName) doc.text(`Customer: ${customerName}`, 14, 42)

    let startY = customerName ? 50 : 44

    if (available.length > 0) {
      doc.setFontSize(12)
      doc.text('Available Parts', 14, startY)
      autoTable(doc, {
        startY: startY + 4,
        head: [['Part Code', 'Part Name', 'Qty', 'Unit Price (₹)', 'Total (₹)']],
        body: available.map(i => [i.part_code, i.part_name, i.qty, `₹${i.unit_price}`, `₹${i.total}`]),
        foot: [['', '', '', 'Grand Total', `₹${available.reduce((s, i) => s + i.total, 0)}`]],
        theme: 'striped',
        headStyles: { fillColor: [29, 78, 216] },
        footStyles: { fillColor: [220, 252, 231], textColor: [0, 0, 0], fontStyle: 'bold' }
      })
      startY = doc.lastAutoTable.finalY + 10
    }

    if (alternatives.length > 0) {
      doc.setFontSize(12)
      doc.text('Alternative Suggestions', 14, startY)
      autoTable(doc, {
        startY: startY + 4,
        head: [['Requested', 'Suggested Alternative', 'Available Qty', 'Reason']],
        body: alternatives.map(i => [i.requested, i.alt_part_name, i.alt_qty, i.reason]),
        theme: 'striped',
        headStyles: { fillColor: [161, 98, 7] }
      })
      startY = doc.lastAutoTable.finalY + 10
    }

    if (unavailable.length > 0) {
      doc.setFontSize(12)
      doc.text('Unavailable Parts', 14, startY)
      autoTable(doc, {
        startY: startY + 4,
        head: [['Requested', 'Qty', 'Reason']],
        body: unavailable.map(i => [i.name, i.qty, i.reason]),
        theme: 'striped',
        headStyles: { fillColor: [185, 28, 28] }
      })
    }

    doc.save(`Quotation_${quoteNo}.pdf`)
  }

  const grandTotal = available.reduce((s, i) => s + i.total, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Quotation Generator</h1>
      <p className="text-gray-500 text-sm mb-6">
        Type naturally — AI will understand abbreviations, spelling mistakes and suggest alternatives.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-sm text-blue-800">
        <strong>Format:</strong> One item per line — PartName x Quantity<br />
        <span className="font-mono">
          bc547 x 50<br />
          lm 358 x 10<br />
          10k res x 100<br />
          100uf 25v cap x 20<br />
          m2f jumpr wire x 10
        </span>
      </div>

      <input
        type="text"
        placeholder="Customer name (optional)"
        value={customerName}
        onChange={e => setCustomerName(e.target.value)}
        className="w-full md:w-1/2 border border-gray-300 rounded px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <textarea
        rows={8}
        placeholder={"bc547 x 50\nlm358 x 10\n10k res x 100"}
        value={input}
        onChange={e => setInput(e.target.value)}
        className="w-full border border-gray-300 rounded px-4 py-2 mb-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <button
        onClick={handleSearch}
        disabled={loading}
        className="bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-800 disabled:opacity-50 mr-3"
      >
        {loading ? loadingMsg : 'Generate Quotation'}
      </button>

      {searched && (
        <button
          onClick={exportPDF}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
        >
          Export PDF
        </button>
      )}

      {searched && (
        <div className="mt-6 space-y-6">

          {/* Available */}
          {available.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-green-700 mb-2">✅ Available Parts</h2>
              <table className="w-full bg-white shadow rounded overflow-hidden text-sm">
                <thead className="bg-green-600 text-white">
                  <tr>
                    <th className="px-4 py-2 text-left">Part Code</th>
                    <th className="px-4 py-2 text-left">Part Name</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Unit Price</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 font-mono text-blue-600">{item.part_code}</td>
                      <td className="px-4 py-2">{item.part_name}</td>
                      <td className="px-4 py-2 text-right">{item.qty}</td>
                      <td className="px-4 py-2 text-right">₹{item.unit_price}</td>
                      <td className="px-4 py-2 text-right font-semibold">₹{item.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-green-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right font-bold">Grand Total</td>
                    <td className="px-4 py-2 text-right font-bold text-green-700">₹{grandTotal}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-yellow-600 mb-2">💡 Alternative Suggestions</h2>
              <table className="w-full bg-white shadow rounded overflow-hidden text-sm">
                <thead className="bg-yellow-500 text-white">
                  <tr>
                    <th className="px-4 py-2 text-left">Requested</th>
                    <th className="px-4 py-2 text-left">Suggested</th>
                    <th className="px-4 py-2 text-right">Available Qty</th>
                    <th className="px-4 py-2 text-left">Why it works</th>
                  </tr>
                </thead>
                <tbody>
                  {alternatives.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-red-500">{item.requested}</td>
                      <td className="px-4 py-2 font-semibold">{item.alt_part_name}</td>
                      <td className="px-4 py-2 text-right">{item.alt_qty}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Unavailable */}
          {unavailable.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-red-600 mb-2">❌ Unavailable Parts</h2>
              <table className="w-full bg-white shadow rounded overflow-hidden text-sm">
                <thead className="bg-red-600 text-white">
                  <tr>
                    <th className="px-4 py-2 text-left">Requested</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {unavailable.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2 text-right">{item.qty}</td>
                      <td className="px-4 py-2 text-red-500">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  )
}