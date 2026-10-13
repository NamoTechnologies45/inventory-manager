import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import ImportPO from './pages/ImportPO'
import ImportSO from './pages/ImportSO'
import Quotation from './pages/Quotation'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        
        {/* Navbar */}
        <nav className="bg-blue-700 text-white px-6 py-4 flex gap-6 items-center">
          <span className="font-bold text-lg mr-4">⚡ Ganesh Electronics</span>
          <NavLink to="/" className={({isActive}) => isActive ? "underline font-semibold" : "hover:underline"}>Dashboard</NavLink>
          <NavLink to="/inventory" className={({isActive}) => isActive ? "underline font-semibold" : "hover:underline"}>Inventory</NavLink>
          <NavLink to="/import-po" className={({isActive}) => isActive ? "underline font-semibold" : "hover:underline"}>Purchase Order</NavLink>
          <NavLink to="/import-so" className={({isActive}) => isActive ? "underline font-semibold" : "hover:underline"}>Sell Order</NavLink>
          <NavLink to="/quotation" className={({isActive}) => isActive ? "underline font-semibold" : "hover:underline"}>Quotation</NavLink>
        </nav>

        {/* Pages */}
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/import-po" element={<ImportPO />} />
            <Route path="/import-so" element={<ImportSO />} />
            <Route path="/quotation" element={<Quotation />} />
          </Routes>
        </div>

      </div>
    </BrowserRouter>
  )
}