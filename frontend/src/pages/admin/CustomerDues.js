import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { rs } from "@/lib/format";
import { btnGhost, inp } from "@/components/admin/ui";
import { Eye, MessageCircle, Phone, RefreshCw, Search } from "lucide-react";

const FILTERS = [
  { key: "all", label: "All dues" },
  { key: "high", label: "High dues" },
  { key: "recent", label: "Recent dues" },
];

const whatsappHref = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.length === 10 ? `977${digits}` : digits;
  return `https://wa.me/${normalized}`;
};

const isRecent = (dateText) => {
  if (!dateText) return false;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return false;
  const days = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return days <= 30;
};

export default function CustomerDues() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get("/admin/customers/dues")
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error("Customer dues load failed:", err?.message || err);
        setError(apiError(err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const dues = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (data?.dues || []).filter((row) => {
      const matchesSearch = !query
        || row.customer_name.toLowerCase().includes(query)
        || String(row.phone || "").includes(query);
      const matchesFilter = filter === "all"
        || (filter === "high" && row.outstanding_balance >= 50000)
        || (filter === "recent" && isRecent(row.latest_order_date_ad));
      return matchesSearch && matchesFilter;
    });
  }, [data, q, filter]);

  if (loading && !data) return <p className="text-sm text-slate-500">Loading customer dues…</p>;

  if (error && !data) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-6 text-center space-y-3">
        <p className="text-red-700 font-medium">Could not load Customer Dues.</p>
        <p className="text-xs text-slate-400">{error}</p>
        <button className={btnGhost} onClick={load}><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customer Dues</h1>
          <p className="text-sm text-slate-500">Money customers still need to pay</p>
        </div>
        <button className={btnGhost} onClick={load} disabled={loading} data-testid="customer-dues-retry">
          <RefreshCw size={14} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-md p-5" data-testid="dues-total-outstanding">
          <p className="text-xs text-slate-500">Outstanding Balance</p>
          <p className="text-2xl font-bold text-[#991B1B] mt-1">{rs(data?.total_outstanding || 0)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-md p-5" data-testid="dues-customer-count">
          <p className="text-xs text-slate-500">Customers With Dues</p>
          <p className="text-2xl font-bold mt-1">{data?.customers_with_dues || 0}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative md:max-w-sm w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inp} pl-9`}
              placeholder="Search customer name or phone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="customer-dues-search"
            />
          </div>
          <div className="flex flex-wrap gap-2" data-testid="customer-dues-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-2 rounded-md text-sm border ${filter === f.key ? "bg-[#0F172A] text-white border-[#0F172A]" : "border-slate-200 hover:bg-slate-50"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dues.length === 0 ? (
          <div className="p-8 text-center text-slate-400" data-testid="customer-dues-empty">
            No customer dues right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="p-3">Customer</th>
                  <th>Phone</th>
                  <th>Outstanding Balance</th>
                  <th>Latest Order</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody data-testid="customer-dues-table">
                {dues.map((row) => {
                  const wa = whatsappHref(row.phone);
                  return (
                    <tr key={row.customer_id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="p-3">
                        <Link to={`/admin/customers/${row.customer_id}`} className="font-semibold text-[#0F172A] hover:text-[#D4AF37]">
                          {row.customer_name}
                        </Link>
                        <p className="text-xs text-slate-400">{row.open_orders_count} unpaid order{row.open_orders_count === 1 ? "" : "s"}</p>
                      </td>
                      <td>{row.phone || "—"}</td>
                      <td className="font-bold text-[#991B1B]">{rs(row.outstanding_balance)}</td>
                      <td>
                        {row.latest_order_id ? (
                          <Link to={`/admin/orders/${row.latest_order_id}`} className="hover:text-[#D4AF37]">
                            {row.latest_order_number || "Order"} · {row.latest_order_date_ad || "—"}
                          </Link>
                        ) : "—"}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Link className="p-2 rounded hover:bg-slate-100" to={`/admin/customers/${row.customer_id}`} title="View customer">
                            <Eye size={16} />
                          </Link>
                          {row.phone && (
                            <a className="p-2 rounded hover:bg-slate-100" href={`tel:${row.phone}`} title="Call customer">
                              <Phone size={16} />
                            </a>
                          )}
                          {wa && (
                            <a className="p-2 rounded hover:bg-slate-100" href={wa} target="_blank" rel="noreferrer" title="WhatsApp customer">
                              <MessageCircle size={16} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
