import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

export default function ImportSO() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target.result, { type: 'binary' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(sheet)
      setRows(data)
      setStatus(null)
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    if (rows.length === 0) return
    setLoading(true)
    setStatus(null)

    let success = 0
    let errors = []

    for (const row of rows) {
      const part_code = row['Part_Code']?.toString().trim()
      const quantity = parseInt(row['Quantity'])
      const unit_price = parseFloat(row['Unit_Price'])
      const so_number = row['SO_Number']?.toString().trim()
      const customer = row['Customer']?.toString().trim()
      const date = row['Date']?.toString().trim()

      if (!part_code || isNaN(quantity) || isNaN(unit_price)) {
        errors.push(`Skipped row — missing data: ${part_code || 'unknown'}`)
        continue
      }

      // Check inventory
      const { data: existingArr } = await supabase
        .from('inventory')
        .select('*')
        .eq('part_code', part_code)

      const existing = existingArr && existingArr.length > 0 ? existingArr[0] : null

      if (!existing) {
        errors.push(`Part not found in inventory: ${part_code}`)
        continue
      }

      if (existing.quantity < quantity) {
        errors.push(`Insufficient stock for ${part_code} — available: ${existing.quantity}, requested: ${quantity}`)
        continue
      }

      // Deduct quantity
      await supabase
        .from('inventory')
        .update({
          quantity: existing.quantity - quantity,
          updated_at: new Date().toISOString()
        })
        .eq('part_code', part_code)

      // Log sell order
      await supabase.from('sell_orders').insert({
        so_number,
        date,
        customer,
        part_code,
        quantity,
        unit_price
      })

      success++
    }

    setStatus({ success, errors })
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Import Sell Order</h1>
      <p className="text-gray-500 text-sm mb-6">
        Upload your sell order Excel. Stock will be deducted from inventory automatically.
      </p>

      {/* Excel format reminder */}
      <div className="bg-green-50 border border-green-200 rounded p-4 mb-6 text-sm text-green-800">
        <strong>Required Excel columns:</strong><br />
        SO_Number | Date | Customer | Part_Code | Quantity | Unit_Price
      </div>

      {/* File upload */}
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        className="mb-4 block"
      />

      {/* Preview */}
      {rows.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">{rows.length} rows detected — preview:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs bg-white shadow rounded overflow-hidden">
              <thead className="bg-gray-200">
                <tr>
                  {Object.keys(rows[0]).map(k => (
                    <th key={k} className="px-3 py-2 text-left">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-3 py-2">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && <p className="text-xs text-gray-400 mt-1">...and {rows.length - 5} more rows</p>}

          <button
            onClick={handleImport}
            disabled={loading}
            className="mt-4 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Import Sell Order'}
          </button>
        </div>
      )}

      {/* Result */}
      {status && (
        <div className="mt-4">
          <div className="bg-green-100 text-green-700 px-4 py-3 rounded mb-2">
            ✅ {status.success} parts processed successfully
          </div>
          {status.errors.map((e, i) => (
            <div key={i} className="bg-red-100 text-red-600 px-4 py-2 rounded text-sm mb-1">⚠️ {e}</div>
          ))}
        </div>
      )}
    </div>
  )
}