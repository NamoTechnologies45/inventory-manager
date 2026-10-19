import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { downloadBackup } from '../lib/backup'
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const [
      { data: inventory },
      { data: bills },
      { data: expenses },
      { data: pos },
    ] = await Promise.all([
      supabase.from("inventory").select("*"),
      supabase.from("bills").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("purchase_orders").select("*"),
    ]);

    const totalParts = inventory?.length || 0;
    const lowStockItems =
      inventory?.filter((i) => i.quantity <= i.low_stock_alert) || [];

    const totalRevenue =
      bills?.reduce((s, b) => s + (b.grand_total || 0), 0) || 0;
    const monthRevenue =
      bills
        ?.filter((b) => b.date >= monthStart)
        .reduce((s, b) => s + (b.grand_total || 0), 0) || 0;

    const totalExpenses =
      expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
    const monthExpenses =
      expenses
        ?.filter((e) => e.date >= monthStart)
        .reduce((s, e) => s + (e.amount || 0), 0) || 0;

    const totalCOGS = bills?.reduce((s, b) => s + (b.subtotal || 0), 0) || 0;
    const totalProfit = totalRevenue - totalExpenses;

    const pendingAmount =
      bills
        ?.filter((b) => b.payment_status === "pending")
        .reduce((s, b) => s + (b.grand_total || 0), 0) || 0;

    const recentBillsList =
      bills
        ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5) || [];

    setStats({
      totalParts,
      totalRevenue,
      monthRevenue,
      totalExpenses,
      monthExpenses,
      totalProfit,
      pendingAmount,
      totalBills: bills?.length || 0,
      totalPOs: pos?.length || 0,
    });
    setLowStock(lowStockItems);
    setRecentBills(recentBillsList);
    setLoading(false);
  }

  if (loading)
    return <div className="text-center mt-20 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>

      {/* Low stock warning */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3">
          <div className="text-sm font-semibold text-red-700 mb-1">
            ⚠️ {lowStock.length} part(s) low on stock
          </div>
          <div className="space-y-1">
            {lowStock.map((item) => (
              <div
                key={item.id}
                className="flex justify-between text-xs text-red-600"
              >
                <span>{item.part_name}</span>
                <span>Only {item.quantity} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* This Month */}
      <div className="bg-white rounded-lg shadow px-4 py-3">
        <div className="text-xs font-semibold text-gray-400 mb-3">
          THIS MONTH
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Revenue</div>
            <div className="text-xl font-bold text-green-700">
              ₹{stats.monthRevenue}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Expenses</div>
            <div className="text-xl font-bold text-red-600">
              ₹{stats.monthExpenses}
            </div>
          </div>
        </div>
        <div
          className={`mt-3 rounded-lg p-3 ${
            stats.monthRevenue - stats.monthExpenses >= 0
              ? "bg-blue-50"
              : "bg-orange-50"
          }`}
        >
          <div className="text-xs text-gray-500">Net This Month</div>
          <div
            className={`text-2xl font-bold ${
              stats.monthRevenue - stats.monthExpenses >= 0
                ? "text-blue-700"
                : "text-orange-600"
            }`}
          >
            ₹{stats.monthRevenue - stats.monthExpenses}
          </div>
        </div>
      </div>

      {/* Overall */}
      <div className="bg-white rounded-lg shadow px-4 py-3">
        <div className="text-xs font-semibold text-gray-400 mb-3">ALL TIME</div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total Revenue</span>
            <span className="font-semibold text-green-700">
              ₹{stats.totalRevenue}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total Expenses</span>
            <span className="font-semibold text-red-600">
              ₹{stats.totalExpenses}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="font-bold">Net Profit</span>
            <span
              className={`font-bold text-lg ${
                stats.totalProfit >= 0 ? "text-blue-700" : "text-orange-600"
              }`}
            >
              ₹{stats.totalProfit}
            </span>
          </div>
        </div>
      </div>

      {/* Pending Payments */}
      {stats.pendingAmount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-500">Pending Payments</div>
            <div className="text-xl font-bold text-yellow-600">
              ₹{stats.pendingAmount}
            </div>
          </div>
          <span className="text-2xl">⏳</span>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">
            {stats.totalParts}
          </div>
          <div className="text-xs text-gray-500">Parts</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className="text-2xl font-bold text-green-700">
            {stats.totalBills}
          </div>
          <div className="text-xs text-gray-500">Bills</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className="text-2xl font-bold text-purple-700">
            {stats.totalPOs}
          </div>
          <div className="text-xs text-gray-500">Orders</div>
        </div>
      </div>

      {/* Recent Bills */}
      {recentBills.length > 0 && (
        <div className="bg-white rounded-lg shadow px-4 py-3">
          <div className="text-xs font-semibold text-gray-400 mb-3">
            RECENT BILLS
          </div>
          <div className="space-y-2">
            {recentBills.map((bill) => (
              <div
                key={bill.id}
                className="flex justify-between items-center text-sm"
              >
                <div>
                  <div className="font-medium">{bill.customer_name}</div>
                  <div className="text-xs text-gray-400">
                    {bill.bill_number}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-700">
                    ₹{bill.grand_total}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      bill.payment_status === "paid"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {bill.payment_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={downloadBackup}
        className="w-full bg-gray-700 text-white py-3 rounded-lg text-sm font-semibold mt-2"
      >
        📥 Download Full Backup
      </button>
    </div>
  );
}
