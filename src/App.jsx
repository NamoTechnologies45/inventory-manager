import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import ImportPO from './pages/ImportPO'
import Quotation from './pages/Quotation'
import SellOrders from './pages/SellOrders'
import Customers from './pages/Customers'
import Expenses from './pages/Expenses'
import PasswordGate from './components/PasswordGate'
export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { to: '/', label: '🏠 Dashboard' },
    { to: '/inventory', label: '📦 Inventory' },
    { to: '/import-po', label: '🛒 Purchase Order' },
    { to: '/quotation', label: '📋 Quotation' },
    { to: '/sell-orders', label: '🧾 Sell Orders' },
    { to: '/customers', label: '👥 Customers' },
    { to: '/expenses', label: '💸 Expenses' },
  ]

  return (
     <PasswordGate>
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">

        <nav className="bg-blue-700 text-white px-4 py-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-base">⚡ Ganesh Electronics</span>
            <button
              className="md:hidden text-white text-2xl"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
            <div className="hidden md:flex gap-4 text-sm">
              {links.map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    isActive ? 'underline font-semibold' : 'hover:underline'
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>

          {menuOpen && (
            <div className="md:hidden mt-3 flex flex-col gap-3 text-sm pb-2">
              {links.map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    isActive ? 'underline font-semibold' : 'hover:underline'
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/import-po" element={<ImportPO />} />
            <Route path="/quotation" element={<Quotation />} />
            <Route path="/sell-orders" element={<SellOrders />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/expenses" element={<Expenses />} />
          </Routes>
        </div>

      </div>
    </BrowserRouter>
    </PasswordGate>
  )
}