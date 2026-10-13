import { useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../lib/supabase'

const MARKUP = 1.2 // used only when selling_price is 0: unit_cost + 20%

// ---------- Parser: turns pasted text into [{ query, qty }] ----------
function parseOrder(text) {
  return text
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(line => {
      let m
      // "BC547 x50", "10k resistor x 100", "LM358 - 20"
      if ((m = line.match(/^(.+?)\s*(?:[x×*:]|\s-\s)\s*(\d+)\s*(?:pcs|nos|pc)?$/i)))
        return { query: m[1].trim(), qty: parseInt(m[2]) }
      // "50 BC547", "50 pcs 7805", "50x 7805"
      if ((m = line.match(/^(\d+)\s*(?:x|×|pcs|pc|nos)?\s+(.+)$/i)))
        return { query: m[2].trim(), qty: parseInt(m[1]) }
      // "BC547 50"
      if ((m = line.match(/^(.+?)\s+(\d+)\s*(?:pcs|nos|pc)?$/i)))
        return { query: m[1].trim(), qty: parseInt(m[2]) }
      // no quantity given
      return { query: line, qty: 1 }
    })
}

const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ---------- Matcher: finds the best inventory item ----------
function findPart(query, inventory) {
  const q = norm(query)
  if (!q) return null

  // 1. exact part code
  let hit = inventory.find(p => norm(p.part_code) === q)
  if (hit) return { part: hit, approx: false }

  // 2. partial match on code or name
  hit = inventory.find(p => {
    const code = norm(p.part_code)
    const name = norm(p.part_name)
    return (
      (code && (code.includes(q) || q.includes(code))) ||
      (name && name.includes(q))
    )
  })
  if (hit) return { part: hit, approx: true }

  return null
}

export default function Quotation() {
  const [text, setText] = useState('')
  const [customer, setCustomer] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    const { data: inventory, error } = await supabase.from('inventory').select('*')
    setLoading(false)
    if (error) return alert('Could not load inventory: ' + error.message)
let items
try {
  const r = await fetch('/api/parse-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!r.ok) throw new Error('AI failed')
  items = (await r.json()).items
} catch {
  items = parseOrder(text) // falls back to your regex parser
}
    const available = []
    const partial = []
    const unavailable = []

    for (const { query, qty } of items) {
      const match = findPart(query, inventory)
      if (!match) {
        unavailable.push({ query, qty, reason: 'Not in inventory' })
        continue
      }

      const { part, approx } = match
      const sell = Number(part.selling_price) || 0
      const cost = Number(part.unit_cost) || 0
      const price = sell > 0 ? sell : cost * MARKUP
      const priceIsEstimate = sell === 0 && cost > 0

      if (part.quantity >= qty) {
        available.push({ ...part, query, qty, price, approx, priceIsEstimate, total: price * qty })
      } else if (part.quantity > 0) {
        partial.push({
          ...part, query, qty, price, approx, priceIsEstimate,
          availableQty: part.quantity,
          shortBy: qty - part.quantity,
          total: price * part.quantity,
        })
      } else {
        unavailable.push({
          query, qty,
          reason: `Out of stock (${part.part_code})`,
          estPrice: price,
          estTotal: price * qty,
        })
      }
    }

    const grandTotal =
      available.reduce((s, i) => s + i.total, 0) +
      partial.reduce((s, i) => s + i.total, 0)

    setResult({ available, partial, unavailable, grandTotal })
  }

  function downloadPDF() {
    const doc = new jsPDF()
    const date = new Date().toLocaleDateString('en-IN')

    doc.setFontSize(18)
    doc.text('QUOTATION', 14, 18)
    doc.setFontSize(10)
    doc.text(`Date: ${date}`, 14, 26)
    if (customer) doc.text(`Customer: ${customer}`, 14, 32)

    const rows = [
      ...result.available.map(i => [
        i.part_code, i.qty, i.price.toFixed(2), i.total.toFixed(2), 'In stock',
      ]),
      ...result.partial.map(i => [
        i.part_code, i.availableQty, i.price.toFixed(2), i.total.toFixed(2),
        `Only ${i.availableQty} of ${i.qty} available`,
      ]),
    ]

    autoTable(doc, {
      startY: 38,
      head: [['Part', 'Qty', 'Unit Price (Rs)', 'Total (Rs)', 'Status']],
      body: rows,
      foot: [['', '', 'Grand Total', result.grandTotal.toFixed(2), '']],
      headStyles: { fillColor: [37, 99, 235] },
      footStyles: { fillColor: [229, 231, 235], textColor: 20 },
    })

    if (result.unavailable.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Not in stock', 'Qty', 'Approx price (Rs)', 'Note']],
        body: result.unavailable.map(i => [
          i.query,
          i.qty,
          i.estPrice ? `${i.estPrice.toFixed(2)} each` : '-',
          i.reason,
        ]),
        headStyles: { fillColor: [220, 38, 38] },
      })
    }

    doc.save(`quotation_${customer || 'customer'}_${Date.now()}.pdf`)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Generate Quotation</h1>
      <p className="text-gray-500 text-sm mb-6">
        Paste the customer's message. Example: <code>BC547 x50, 10k resistor x100, 7805 x10</code>
      </p>

      <input
        value={customer}
        onChange={e => setCustomer(e.target.value)}
        placeholder="Customer name (optional)"
        className="border rounded px-3 py-2 mb-3 w-full max-w-md block"
      />

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        placeholder={'BC547 x50\nLM358 20\n100 10KRES'}
        className="border rounded px-3 py-2 w-full max-w-2xl block mb-3"
      />

      <button
        onClick={generate}
        disabled={!text.trim() || loading}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Checking stock...' : 'Generate Quotation'}
      </button>

      {result && (
        <div className="mt-8 space-y-6">
          {result.available.length > 0 && (
            <Section title="✅ Available" color="green">
              {result.available.map((i, k) => (
                <Row
                  key={k}
                  left={`${i.part_code}${i.approx ? ` (approx match for "${i.query}")` : ''}`}
                  right={`${i.qty} × ₹${i.price.toFixed(2)}${i.priceIsEstimate ? ' (est.)' : ''} = ₹${i.total.toFixed(2)}`}
                />
              ))}
            </Section>
          )}

          {result.partial.length > 0 && (
            <Section title="⚠️ Partially available" color="yellow">
              {result.partial.map((i, k) => (
                <Row
                  key={k}
                  left={`${i.part_code} — wanted ${i.qty}, only ${i.availableQty} in stock`}
                  right={`${i.availableQty} × ₹${i.price.toFixed(2)}${i.priceIsEstimate ? ' (est.)' : ''} = ₹${i.total.toFixed(2)}`}
                />
              ))}
            </Section>
          )}

          {result.unavailable.length > 0 && (
            <Section title="❌ Not available" color="red">
              {result.unavailable.map((i, k) => (
                <Row
                  key={k}
                  left={`${i.query} × ${i.qty}`}
                  right={
                    i.estPrice
                      ? `${i.reason} — approx ₹${i.estPrice.toFixed(2)} each (₹${i.estTotal.toFixed(2)})`
                      : i.reason
                  }
                />
              ))}
            </Section>
          )}

          <div className="text-xl font-bold text-gray-800">
            Grand Total: ₹{result.grandTotal.toFixed(2)}
          </div>

          <button
            onClick={downloadPDF}
            className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900"
          >
            📄 Download PDF
          </button>
        </div>
      )}
    </div>
  )
}

const colors = {
  green: 'bg-green-50 border-green-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  red: 'bg-red-50 border-red-200',
}

function Section({ title, color, children }) {
  return (
    <div className={`border rounded p-4 ${colors[color]}`}>
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </div>
  )
}

function Row({ left, right }) {
  return (
    <div className="flex justify-between text-sm py-1 border-t first:border-t-0 gap-4">
      <span>{left}</span>
      <span className="text-gray-600 text-right">{right}</span>
    </div>
  )
}