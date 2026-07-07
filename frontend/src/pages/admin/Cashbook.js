import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { rs } from "@/lib/format";
import { btnGold, btnGhost, inp, F } from "@/components/admin/ui";
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";

export default function Cashbook() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ start_date: "", end_date: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    api.get("/admin/cashbook", { params })
      .then((r) => setData(r.data))
      .catch((err) => {
        console.error("Cashbook load failed:", err?.message || err);
        setError(apiError(err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <p className="text-sm text-slate-500">Loading cashbook…</p>;

  if (error && !data) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-6 text-center space-y-3">
        <p className="text-red-700 font-medium">Could not load cashbook.</p>
        <p className="text-xs text-slate-400">{error}</p>
        <button className={btnGhost} onClick={load}><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }

  const entries = data?.entries || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cashbook</h1>
          <p className="text-sm text-slate-500">Cashbook shows cash movement only. It is not profit/loss.</p>
        </div>
        <button className={btnGhost} onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-4">
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <F label="Start Date"><input className={inp} type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} data-testid="cashbook-start-date" /></F>
          <F label="End Date"><input className={inp} type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} data-testid="cashbook-end-date" /></F>
          <button className={btnGold} onClick={load} data-testid="cashbook-apply-filter">Apply</button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-md p-5" data-testid="cashbook-cash-in">
          <p className="text-xs text-slate-500">Cash In</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{rs(data?.cash_in || 0)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-md p-5" data-testid="cashbook-cash-out">
          <p className="text-xs text-slate-500">Cash Out</p>
          <p className="text-2xl font-bold text-[#991B1B] mt-1">{rs(data?.cash_out || 0)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-md p-5" data-testid="cashbook-net-cash">
          <p className="text-xs text-slate-500">Net Cash Movement</p>
          <p className="text-2xl font-bold mt-1">{rs(data?.net_cash || 0)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b">
              <th className="p-3">Date</th><th>Movement</th><th>Description</th><th>Method</th><th>Cash In</th><th>Cash Out</th><th>Running Balance</th>
            </tr>
          </thead>
          <tbody data-testid="cashbook-table">
            {entries.map((entry) => (
              <tr key={`${entry.type}-${entry.id}`} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3">{entry.date_ad}</td>
                <td>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${entry.type === "cash_in" ? "text-emerald-700" : "text-[#991B1B]"}`}>
                    {entry.type === "cash_in" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                    {entry.type === "cash_in" ? "Cash in" : "Cash out"}
                  </span>
                </td>
                <td>
                  {entry.order_id ? (
                    <Link to={`/admin/orders/${entry.order_id}`} className="font-medium hover:text-[#D4AF37]">
                      {entry.description} · {entry.customer_name}
                    </Link>
                  ) : (
                    <span>{entry.description || entry.category}</span>
                  )}
                  <p className="text-xs text-slate-400 capitalize">{String(entry.category || "").replace(/_/g, " ")}</p>
                </td>
                <td className="capitalize">{entry.payment_method}</td>
                <td className="font-semibold text-emerald-700">{entry.cash_in ? rs(entry.cash_in) : "—"}</td>
                <td className="font-semibold text-[#991B1B]">{entry.cash_out ? rs(entry.cash_out) : "—"}</td>
                <td className="font-bold">{rs(entry.running_balance)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">No cash movement found for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
