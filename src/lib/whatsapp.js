const owner = import.meta.env.VITE_OWNER_PHONE
const partner = import.meta.env.VITE_PARTNER_PHONE

export function sendWhatsApp(phone, message) {
  const encoded = encodeURIComponent(message)
  window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank')
}

export function notifyBothMsg(message) {
  return message
}

export function billCreatedMsg(billNo, customer, amount) {
  return `🧾 *New Bill Created*\nBill: ${billNo}\nCustomer: ${customer}\nAmount: ₹${amount}\n\n_Ganesh Electronics_`
}

export function paymentReceivedMsg(billNo, customer, amount) {
  return `✅ *Payment Received*\nBill: ${billNo}\nCustomer: ${customer}\nAmount: ₹${amount}\n\n_Ganesh Electronics_`
}

export function purchaseOrderMsg(partCount, supplier) {
  return `🛒 *Purchase Order Imported*\n${partCount} parts added\nSupplier: ${supplier || 'Unknown'}\n\n_Ganesh Electronics_`
}

export function lowStockMsg(parts) {
  const list = parts.map(p => `• ${p.part_name}: ${p.quantity} left`).join('\n')
  return `⚠️ *Low Stock Alert*\n${list}\n\n_Ganesh Electronics_`
}

export { owner, partner }