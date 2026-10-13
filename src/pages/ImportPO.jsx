import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

export default function ImportPO() {
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
      const part_name = row['Part_Name']?.toString().trim()
      const quantity = parseInt(row['Quantity'])
      const unit_cost = parseFloat(row['Unit_Cost'])
      const selling_price = parseFloat(row['Selling_Price'] || 0)
      const category = row['Category']?.toString().trim() || ''
      const po_number = row['PO_Number']?.toString().trim()
      const supplier = row['Supplier']?.toString().trim()
      const date = row['Date']?.toString().trim()

      if (!part_code || !part_name || isNaN(quantity) || isNaN(unit_cost)) {
        errors.push(`Skipped row — missing data: ${part_code || 'unknown'}`)
        continue
      }

      // Check if part exists in inventory
     const { data: existingArr } = await supabase
  .from('inventory')
  .select('*')
  .eq('part_code', part_code)

const existing = existingArr && existingArr.length > 0 ? existingArr[0] : null
      if (existing) {
        // Update quantity
        await supabase
          .from('inventory')
          .update({
            quantity: existing.quantity + quantity,
            unit_cost: unit_cost,
            updated_at: new Date().toISOString()
          })
          .eq('part_code', part_code)
      } else {
        // Insert new part
        await supabase
          .from('inventory')
          .insert({
            part_code,
            part_name,
            category,
            quantity,
            unit_cost,
            selling_price,
            low_stock_alert: 10
          })
      }

      // Always log the PO row
      await supabase.from('purchase_orders').insert({
        po_number,
        date,
        supplier,
        part_code,
        quantity,
        unit_cost
      })

      success++
    }

    setStatus({ success, errors })
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Import Purchase Order</h1>
      <p className="text-gray-500 text-sm mb-6">
        Upload your Excel file. New parts will be added to inventory, existing parts will have quantity updated.
      </p>

      {/* Excel format reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-sm text-blue-800">
        <strong>Required Excel columns:</strong><br />
        PO_Number | Date | Supplier | Part_Code | Part_Name | Category | Quantity | Unit_Cost | Selling_Price
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
            className="mt-4 bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? 'Importing...' : 'Import to Inventory'}
          </button>
        </div>
      )}

      {/* Result */}
      {status && (
        <div className="mt-4">
          <div className="bg-green-100 text-green-700 px-4 py-3 rounded mb-2">
            ✅ {status.success} parts imported successfully
          </div>
          {status.errors.map((e, i) => (
            <div key={i} className="bg-red-100 text-red-600 px-4 py-2 rounded text-sm mb-1">⚠️ {e}</div>
          ))}
        </div>
      )}
    </div>
  )
}