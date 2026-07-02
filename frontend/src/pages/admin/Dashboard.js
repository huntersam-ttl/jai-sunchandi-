import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { inp, btnGold, Card, Badge, F } from "@/components/admin/ui";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [rateForm, setRateForm] = useState({ gold_24k: "", gold_22k: "", silver: "" });

  const load = () => api.get("/admin/dashboard").then((r) => {
    setData(r.data);
    if (r.data.rate) setRateForm({ gold_24k: r.data.rate.gold_24k, gold_22k: r.data.rate.gold_22k, silver: r.data.rate.silver });
  });
  useEffect(() => { load(); }, []);

  const saveRate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/rates", {
        gold_24k: +rateForm.gold_24k, gold_22k: +rateForm.gold_22k, silver: +rateForm.silver,
      });
      toast.success("Today's rate updated");
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  if (!data) return <p className="text-slate-500 text-sm">Loading…</p>;

  const stats = [
    ["Today's Sales", rs(data.todays_sales), "todays-sales"],
    ["Pending Orders", data.pending_orders_count, "pending-orders"],
    ["Invoices Today", data.todays_invoices, "invoices-today"],
    ["New Leads", data.new_leads, "new-leads"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Today View</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(([label, value, id]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-md p-4" data-testid={`stat-${id}`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <Card title="Today's Rate (per tola)">
        <form onSubmit={saveRate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end" data-testid="dashboard-rate-form">
          <F label="Gold 24K"><input className={inp} type="number" step="any" value={rateForm.gold_24k} onChange={(e) => setRateForm({ ...rateForm, gold_24k: e.target.value })} data-testid="rate-gold24-input" /></F>
          <F label="Gold 22K"><input className={inp} type="number" step="any" value={rateForm.gold_22k} onChange={(e) => setRateForm({ ...rateForm, gold_22k: e.target.value })} data-testid="rate-gold22-input" /></F>
          <F label="Silver"><input className={inp} type="number" step="any" value={rateForm.silver} onChange={(e) => setRateForm({ ...rateForm, silver: e.target.value })} data-testid="rate-silver-input" /></F>
          <button type="submit" className={btnGold} data-testid="rate-save-btn">Update Rate</button>
        </form>
        {data.rate && <p className="text-xs text-slate-500 mt-2">Last updated: {data.rate.date_ad} (BS {data.rate.bs_date_np})</p>}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <OrderList title="Orders Due Today" orders={data.orders_due_today} testId="due-today" />
        <OrderList title="Orders Due This Week" orders={data.orders_due_week} testId="due-week" />
        <OrderList title="Ready for Collection" orders={data.ready_for_collection} testId="ready" />
        <OrderList title="Pending Payments" orders={data.pending_payments} showBalance testId="pending-pay" />
      </div>
    </div>
  );
}

const OrderList = ({ title, orders, showBalance, testId }) => (
  <Card title={`${title} (${orders.length})`}>
    <div className="space-y-2" data-testid={`list-${testId}`}>
      {orders.length === 0 && <p className="text-xs text-slate-400">Nothing here.</p>}
      {orders.slice(0, 8).map((o) => (
        <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 hover:bg-slate-50 px-1 rounded">
          <span>{o.order_number} · {o.customer_name}</span>
          <span className="flex items-center gap-2">
            {showBalance && <b className="text-[#991B1B]">{rs(o.remaining_balance)}</b>}
            <Badge status={o.status} colors={STATUS_COLORS} />
          </span>
        </Link>
      ))}
    </div>
  </Card>
);
