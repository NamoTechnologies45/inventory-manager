import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import { parseExcelWithGemini } from "../lib/gemini";
import {
  purchaseOrderMsg,
  lowStockMsg,
  owner,
  partner,
  sendWhatsApp,
} from "../lib/whatsapp";
export default function ImportPO() {
  const [rawData, setRawData] = useState([]);
  const [parsed, setParsed] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [lowStockMsg2, setLowStockMsg2] = useState("");
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target.result, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      setRawData(data);
      setParsed([]);
      setStatus(null);
    };
    reader.readAsBinaryString(file);
  }

  async function handleAnalyse() {
    if (rawData.length === 0) return;
    setLoading(true);
    setLoadingMsg("Fetching existing inventory...");

    try {
      const { data: existingInventory } = await supabase
        .from("inventory")
        .select("part_code, part_name");

      setLoadingMsg("AI is reading your Excel...");
      const result = await parseExcelWithGemini(
        rawData,
        existingInventory || [],
      );
      setParsed(result);
    } catch (err) {
      alert("Error analysing file: " + err.message);
    }

    setLoading(false);
    setLoadingMsg("");
  }

  async function handleImport() {
    if (parsed.length === 0) return;

    setLoading(true);
    setLoadingMsg("Importing to inventory...");

    let success = 0;
    let errors = [];

    for (const item of parsed) {
      const {
        part_code,
        part_name,
        category,
        quantity,
        unit_cost,
        selling_price,
      } = item;

      if (!part_code || !part_name || !quantity) {
        errors.push(`Skipped: ${part_name || "unknown"}`);
        continue;
      }

      const { data: existingArr } = await supabase
        .from("inventory")
        .select("*")
        .eq("part_code", part_code);

      const existing =
        existingArr && existingArr.length > 0 ? existingArr[0] : null;

      if (existing) {
        await supabase
          .from("inventory")
          .update({
            quantity: existing.quantity + quantity,
            unit_cost,
            selling_price,
            updated_at: new Date().toISOString(),
          })
          .eq("part_code", part_code);
      } else {
        await supabase.from("inventory").insert({
          part_code,
          part_name,
          category,
          quantity,
          unit_cost,
          selling_price,
          low_stock_alert: 5,
        });
      }

      await supabase.from("purchase_orders").insert({
        po_number: "AI-IMPORT",
        date: new Date().toISOString().split("T")[0],
        supplier: "Unknown",
        part_code,
        quantity,
        unit_cost,
      });

      success++;
    }

    setStatus({ success, errors });
    // Check low stock after import
    const { data: inventory } = await supabase.from("inventory").select("*");
    const lowItems =
      inventory?.filter((i) => i.quantity <= i.low_stock_alert) || [];
    if (lowItems.length > 0) {
      setLowStockMsg2(lowStockMsg(lowItems));
    }
    setWhatsappMsg(purchaseOrderMsg(success, "Imported"));
    setLoading(false);
    setLoadingMsg("");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-gray-800">
        Import Purchase Order
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        Upload any Excel format — AI will read and structure it automatically.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-sm text-blue-800">
        ✨ <strong>No fixed format needed</strong> — just upload your Excel
        as-is. AI handles the rest.
      </div>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        className="mb-4 block"
      />

      {rawData.length > 0 && parsed.length === 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">
            {rawData.length} raw rows detected
          </p>
          <button
            onClick={handleAnalyse}
            disabled={loading}
            className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? loadingMsg : "✨ Analyse with AI"}
          </button>
        </div>
      )}

      {parsed.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">
            AI found <strong>{parsed.length} parts</strong> — review before
            importing:
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs bg-white shadow rounded overflow-hidden">
              <thead className="bg-purple-600 text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Part Code</th>
                  <th className="px-3 py-2 text-left">Part Name</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Cost (₹)</th>
                  <th className="px-3 py-2 text-right">Selling (₹)</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((item, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-3 py-2 font-mono text-blue-600">
                      {item.part_code}
                    </td>
                    <td className="px-3 py-2">{item.part_name}</td>
                    <td className="px-3 py-2 text-gray-500">{item.category}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">₹{item.unit_cost}</td>
                    <td className="px-3 py-2 text-right">
                      ₹{item.selling_price}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.is_existing ? (
                        <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-semibold">
                          Existing
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-semibold">
                          New
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={loading}
              className="bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? loadingMsg : "Import to Inventory"}
            </button>
            <button
              onClick={() => {
                setParsed([]);
                setRawData([]);
              }}
              disabled={loading}
              className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="mt-4">
          <div className="bg-green-100 text-green-700 px-4 py-3 rounded mb-2">
            ✅ {status.success} parts imported successfully
          </div>
          {whatsappMsg && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-gray-500 font-semibold">
                📲 Notify via WhatsApp:
              </div>
              <button
                onClick={() => sendWhatsApp(owner, whatsappMsg)}
                className="w-full bg-green-500 text-white py-2 rounded text-sm font-semibold"
              >
                📲 Send to Me
              </button>
              <button
                onClick={() => sendWhatsApp(partner, whatsappMsg)}
                className="w-full bg-green-400 text-white py-2 rounded text-sm font-semibold"
              >
                📲 Send to Partner
              </button>
              {lowStockMsg2 && (
                <button
                  onClick={() => sendWhatsApp(owner, lowStockMsg2)}
                  className="w-full bg-red-500 text-white py-2 rounded text-sm font-semibold"
                >
                  ⚠️ Send Low Stock Alert to Me
                </button>
              )}
            </div>
          )}
          {status.errors.map((e, i) => (
            <div
              key={i}
              className="bg-red-100 text-red-600 px-4 py-2 rounded text-sm mb-1"
            >
              ⚠️ {e}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
