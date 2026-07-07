import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { btnGhost, Card, Badge } from "@/components/admin/ui";
import { RefreshCw } from "lucide-react";

export default function Reports() {
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(null);
  const [closingError, setClosingError] = useState(null);

  const load = () => {
    setError(null);
    api.get("/admin/reports").then((res) => setR(res.data))
      .catch((err) => { console.error("Reports load failed:", err); setError(apiError(err)); });
  };
  const loadClosing = () => {
    setClosingError(null);
    api.get("/admin/dashboard").then((res) => setClosing(res.data))
      .catch((err) => { console.error("Daily closing load failed:", err); setClosingError(apiError(err)); });
  };
  useEffect(() => { load(); loadClosing(); }, []);

  if (error && !r) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-6 text-center space-y-3">
        <p className="text-red-700 font-medium">Could not load data. Please refresh or contact admin.</p>
        <p className="text-xs text-slate-400">{error}</p>
        <button className={btnGhost} onClick={load}><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }
  if (!r) return <p className="text-sm text-slate-500">Loading…</p>;

  const cards = [
    ["Today's Sales (payments received)", rs(r.todays_sales), "todays-sales"],
    ["Orders Due This Week", r.orders_due_week, "due-week"],
    ["Pending Payments Total", rs(r.pending_payments_total), "pending-total"],
    ["Pending Payment Orders", r.pending_payments_count, "pending-count"],
    ["Available Stock", r.available_stock, "available-stock"],
    ["Reserved Stock", r.reserved_stock, "reserved-stock"],
    ["Sold Stock", r.sold_stock, "sold-stock"],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([label, value, id]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-md p-5" data-testid={`report-${id}`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">Advanced reports (profit analysis, monthly trends) coming in v2. Profit reporting will only use products with recorded cost price.</p>

      <div className="pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h2 className="text-lg font-bold">Daily Closing</h2>
          <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded px-2 py-1">
            Live summary — not final locked closing.
          </span>
        </div>

        {closingError && !closing && (
          <div className="bg-white border border-red-200 rounded-md p-4 text-center space-y-2" data-testid="closing-error">
            <p className="text-red-700 text-sm">Could not load data. Please refresh or contact admin.</p>
            <button className={btnGhost} onClick={loadClosing}><RefreshCw size={14} /> Retry</button>
          </div>
        )}

        {closing && (
          <div className="grid lg:grid-cols-2 gap-4" data-testid="daily-closing">
            <Card title={`Unpaid Customer Balances (${closing.pending_payments.length})`}>
              <div className="space-y-2" data-testid="closing-pending-payments">
                {closing.pending_payments.length === 0 && <p className="text-xs text-slate-400">No unpaid balances.</p>}
                {closing.pending_payments.slice(0, 8).map((o) => (
                  <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 hover:bg-slate-50 px-1 rounded">
                    <span>{o.order_number} · {o.customer_name}</span>
                    <b className="text-[#991B1B]">{rs(o.remaining_balance)}</b>
                  </Link>
                ))}
              </div>
            </Card>
            <Card title={`Pending Repairs (${closing.pending_repairs.length})`}>
              <div className="space-y-2" data-testid="closing-pending-repairs">
                {closing.pending_repairs.length === 0 && <p className="text-xs text-slate-400">No repairs waiting.</p>}
                {closing.pending_repairs.slice(0, 8).map((rp) => (
                  <Link key={rp.id} to="/admin/repairs" className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 hover:bg-slate-50 px-1 rounded">
                    <span>{rp.repair_number} · {rp.customer_name}</span>
                    <Badge status={rp.status} colors={STATUS_COLORS} />
                  </Link>
                ))}
              </div>
            </Card>
            <Card title={`Recent Leads (${closing.recent_leads.length})`}>
              <div className="space-y-2" data-testid="closing-recent-leads">
                {closing.recent_leads.length === 0 && <p className="text-xs text-slate-400">No enquiries yet.</p>}
                {closing.recent_leads.slice(0, 8).map((l) => (
                  <Link key={l.id} to="/admin/leads" className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 hover:bg-slate-50 px-1 rounded">
                    <span>{l.name} · {l.phone}</span>
                    <Badge status={l.status} colors={STATUS_COLORS} />
                  </Link>
                ))}
              </div>
            </Card>
            <Card title="Today's Rate">
              {closing.rate
                ? <p className="text-sm">24K Gold: <b>{rs(closing.rate.gold_24k)}</b> · Silver: <b>{rs(closing.rate.silver)}</b></p>
                : <p className="text-xs text-amber-700">No rate set today.</p>}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
