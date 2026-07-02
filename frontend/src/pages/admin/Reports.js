import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";

export default function Reports() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get("/admin/reports").then((res) => setR(res.data)); }, []);
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
      <p className="text-xs text-slate-400">Advanced reports (profit analysis, monthly trends) coming in v2.</p>
    </div>
  );
}
