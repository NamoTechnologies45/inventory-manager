import { supabase } from './supabase'
import * as XLSX from 'xlsx'

export async function downloadBackup() {
  const [
    { data: inventory },
    { data: bills },
    { data: bill_items },
    { data: expenses },
    { data: customers },
    { data: purchase_orders },
    { data: sell_orders }
  ] = await Promise.all([
    supabase.from('inventory').select('*'),
    supabase.from('bills').select('*'),
    supabase.from('bill_items').select('*'),
    supabase.from('expenses').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('purchase_orders').select('*'),
    supabase.from('sell_orders').select('*')
  ])

  const wb = XLSX.utils.book_new()

  const sheets = {
    'Inventory': inventory,
    'Bills': bills,
    'Bill Items': bill_items,
    'Expenses': expenses,
    'Customers': customers,
    'Purchase Orders': purchase_orders,
    'Sell Orders': sell_orders
  }

  for (const [name, data] of Object.entries(sheets)) {
    if (data && data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, name)
    }
  }

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `GaneshElectronics_Backup_${date}.xlsx`)
}