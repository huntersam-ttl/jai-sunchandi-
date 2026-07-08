import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { inp, btnGold, btnGhost, Card, Badge, F } from "@/components/admin/ui";
import {
  Plus, RefreshCw, Gem, Wrench, TrendingUp, Truck, Wallet, Search,
  ClipboardList, PackageCheck,
} from "lucide-react";

// The big daily-workflow shortcuts a non-technical admin reaches for first
// thing every day. "to" navigates; "anchor" scrolls to a section already on
// this page instead of loading a new one.
const DAILY_ACTIONS = [
  { icon: Gem, label: "New Custom Order", note: "Take a new order", to: "/admin/orders?new=1", testId: "daily-new-custom-order" },
  { icon: Wrench, label: "New Repair", note: "Log a repair job", to: "/admin/repairs?new=1", testId: "daily-new-repair" },
  { icon: TrendingUp, label: "Update Today's Rate", note: "Gold & silver rate", to: "/admin/rates", testId: "daily-update-rate" },
  { icon: Truck, label: "Today's Deliveries", note: "Orders due today", anchor: "#due-today-section", testId: "daily-todays-deliveries" },
  { icon: Wallet, label: "Pending Payments", note: "Balance still owed", anchor: "#pending-pay-section", testId: "daily-pending-payments" },
  { icon: Search, label: "Search Customer / Order", note: "Find by name or phone", to: "/admin/customers", testId: "daily-search" },
  { icon: ClipboardList, label: "Pending Orders", note: "All open orders", to: "/admin/orders", testId: "daily-pending-orders" },
  { icon: PackageCheck, label: "Ready for Collection", note: "Waiting for pickup", to: "/admin/orders?status=ready", testId: "daily-ready-collection" },
];

const DailyActionCard = ({ a }) => {
  const content = (
    <>
      <a.icon className="text-[#D4AF37]" size={26} strokeWidth={1.5} />
      <p className="font-semibold text-sm mt-2 leading-tight">{a.label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{a.note}</p>
    </>
  );
  const className = "bg-white border border-slate-200 rounded-md p-4 flex flex-col items-start hover:-translate-y-0.5 hover:border-[#D4AF37] hover:shadow-sm transition-all duration-200";
  if (a.anchor) {
    return <a href={a.anchor} data-testid={a.testId} className={className}>{content}</a>;
  }
  return <Link to={a.to} data-testid={a.testId} className={className}>{content}</Link>;
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rateForm, setRateForm] = useState({ gold_24k: "", silver: "" });
  const [openTasks, setOpenTasks] = useState([]);

  const load = () => {
    setLoading(true);
    setError(null);
    return api.get("/admin/dashboard")
      .then((r) => {
        setData(r.data);
        if (r.data.rate) setRateForm({ gold_24k: r.data.rate.gold_24k, silver: r.data.rate.silver });
      })
      .catch((err) => {
        console.error("Dashboard load failed:", err);
        setError(apiError(err));
      })
      .finally(() => setLoading(false));
  };
  const loadTasks = () => {
    api.get("/admin/tasks", { params: { status: "pending" } }).then((r) => setOpenTasks(r.data))
      .catch((err) => console.error("Handover tasks load failed:", err));
  };
  useEffect(() => { load(); loadTasks(); }, []);

  const saveRate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/rates", {
        gold_24k: +rateForm.gold_24k, gold_22k: +rateForm.gold_24k, silver: +rateForm.silver,
      });
      toast.success("Today's rate updated");
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  if (loading && !data) return <DashboardSkeleton />;

  if (error && !data) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-6 text-center space-y-3">
        <p className="text-red-700 font-medium">Could not load data. Please refresh or contact admin.</p>
        <p className="text-xs text-slate-400">{error}</p>
        <button className={btnGhost} onClick={load} data-testid="dashboard-retry-btn">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const stats = [
    ["Today's Sales", rs(data.todays_sales), "todays-sales"],
    ["Pending Orders", data.pending_orders_count, "pending-orders"],
    ["Pending Repairs", data.pending_repairs_count ?? 0, "pending-repairs"],
    ["New Leads", data.new_leads, "new-leads"],
  ];

  const quickActions = [
    ["Add Product", "/admin/products"],
    ["Add Rate", "/admin/rates"],
    ["Add Customer", "/admin/customers"],
    ["Add Order", "/admin/orders"],
    ["Add Repair", "/admin/repairs"],
    ["Handover Notes", "/admin/handover"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Today View</h1>
        {error && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Some data may be out of date — last refresh failed. <button className="underline" onClick={load}>Retry</button>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="daily-actions">
        {DAILY_ACTIONS.map((a) => <DailyActionCard key={a.label} a={a} />)}
      </div>

      <Card title="Quick Actions">
        <div className="flex flex-wrap gap-2" data-testid="quick-actions">
          {quickActions.map(([label, to]) => (
            <Link key={label} to={to} className={btnGhost} data-testid={`quick-action-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              <Plus size={14} /> {label}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(([label, value, id]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-md p-4" data-testid={`stat-${id}`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <Card title="Today's Rate (per tola)">
        <form onSubmit={saveRate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end" data-testid="dashboard-rate-form">
          <F label="24K Gold"><input className={inp} type="number" step="any" value={rateForm.gold_24k} onChange={(e) => setRateForm({ ...rateForm, gold_24k: e.target.value })} data-testid="rate-gold24-input" /></F>
          <F label="Silver"><input className={inp} type="number" step="any" value={rateForm.silver} onChange={(e) => setRateForm({ ...rateForm, silver: e.target.value })} data-testid="rate-silver-input" /></F>
          <button type="submit" className={btnGold} data-testid="rate-save-btn">Update Rate</button>
        </form>
        {data.rate
          ? <p className="text-xs text-slate-500 mt-2">Last updated: {data.rate.date_ad} (BS {data.rate.bs_date_np})</p>
          : <p className="text-xs text-amber-700 mt-2">No rate set yet today — enter one above so the website shows a live price.</p>}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <div id="due-today-section" className="scroll-mt-20">
          <OrderList title="Orders Due Today" orders={data.orders_due_today} testId="due-today" />
        </div>
        <OrderList title="Orders Due This Week" orders={data.orders_due_week} testId="due-week" />
        <OrderList title="Ready for Collection" orders={data.ready_for_collection} testId="ready" />
        <div id="pending-pay-section" className="scroll-mt-20">
          <OrderList title="Pending Payments" orders={data.pending_payments} showBalance testId="pending-pay" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <RepairList repairs={data.pending_repairs} />
        <LeadList leads={data.recent_leads} />
      </div>

      <HandoverList tasks={openTasks} />
    </div>
  );
}

const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse" data-testid="dashboard-skeleton">
    <div className="h-7 w-32 bg-slate-200 rounded" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-md p-4 h-20">
          <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
          <div className="h-6 w-10 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
    <div className="bg-white border border-slate-200 rounded-md h-28" />
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-md h-40" />
      <div className="bg-white border border-slate-200 rounded-md h-40" />
    </div>
  </div>
);

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

const RepairList = ({ repairs = [] }) => (
  <Card title={`Pending Repairs (${repairs.length})`}>
    <div className="space-y-2" data-testid="list-pending-repairs">
      {repairs.length === 0 && <p className="text-xs text-slate-400">No repairs waiting on the shop right now.</p>}
      {repairs.map((r) => (
        <Link key={r.id} to="/admin/repairs" className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 hover:bg-slate-50 px-1 rounded">
          <span>{r.repair_number} · {r.customer_name}</span>
          <Badge status={r.status} colors={STATUS_COLORS} />
        </Link>
      ))}
    </div>
  </Card>
);

const HandoverList = ({ tasks = [] }) => (
  <Card title={`Handover Notes — Open (${tasks.length})`} actions={<Link to="/admin/handover" className="text-xs underline text-slate-500">View all</Link>}>
    <div className="space-y-2" data-testid="list-handover-tasks">
      {tasks.length === 0 && <p className="text-xs text-slate-400">Nothing to hand over right now.</p>}
      {tasks.slice(0, 5).map((t) => (
        <Link key={t.id} to="/admin/handover" className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 hover:bg-slate-50 px-1 rounded">
          <span>{t.title}{t.priority === "high" && <span className="text-[#991B1B] text-xs font-semibold ml-2">High</span>}</span>
          <span className="text-xs text-slate-400">{t.due_date_ad || ""}</span>
        </Link>
      ))}
    </div>
  </Card>
);

const LeadList = ({ leads = [] }) => (
  <Card title={`Recent Leads (${leads.length})`}>
    <div className="space-y-2" data-testid="list-recent-leads">
      {leads.length === 0 && <p className="text-xs text-slate-400">No customer enquiries yet.</p>}
      {leads.map((l) => (
        <Link key={l.id} to="/admin/leads" className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 hover:bg-slate-50 px-1 rounded">
          <span>{l.name} · {l.phone}</span>
          <Badge status={l.status} colors={STATUS_COLORS} />
        </Link>
      ))}
    </div>
  </Card>
);
