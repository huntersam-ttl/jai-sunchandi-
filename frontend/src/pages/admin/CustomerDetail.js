import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { Card, Badge } from "@/components/admin/ui";

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);

  useEffect(() => { api.get(`/admin/customers/${id}`).then((r) => setC(r.data)); }, [id]);
  if (!c) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="customer-name">{c.name}</h1>
          <p className="text-sm text-slate-500">{c.phone} {c.address && `· ${c.address}`}</p>
          {c.notes && <p className="text-xs text-slate-400 mt-1">Notes: {c.notes}</p>}
        </div>
        <div className="bg-[#0F172A] text-white rounded-md px-6 py-3 text-right" data-testid="customer-outstanding">
          <p className="text-xs text-slate-400">Total Outstanding (Khata)</p>
          <p className="text-2xl font-bold text-[#D4AF37]">{rs(c.total_outstanding)}</p>
        </div>
      </div>

      <Card title={`Orders (${c.orders.length})`}>
        <div className="space-y-2" data-testid="customer-orders">
          {c.orders.length === 0 && <p className="text-xs text-slate-400">No orders.</p>}
          {c.orders.map((o) => (
            <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex flex-wrap justify-between gap-2 text-sm py-2 border-b border-slate-50 hover:bg-slate-50 px-1 rounded">
              <span>{o.order_number} · <span className="capitalize">{o.order_type.replace("_", " ")}</span> · {o.order_date_ad}</span>
              <span className="flex items-center gap-3">
                <span>Total {rs(o.net_payable)}</span>
                <span className="text-[#991B1B]">Due {rs(o.remaining_balance)}</span>
                <Badge status={o.status} colors={STATUS_COLORS} />
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title={`Payments (${c.payments.length})`}>
          <div className="space-y-1.5 text-sm" data-testid="customer-payments">
            {c.payments.length === 0 && <p className="text-xs text-slate-400">No payments.</p>}
            {c.payments.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-slate-50 py-1.5">
                <span>{p.payment_date_ad} · <span className="capitalize">{p.method}</span>{p.note && ` · ${p.note}`}</span>
                <b>{rs(p.amount)}</b>
              </div>
            ))}
          </div>
        </Card>
        <Card title={`Repairs (${c.repairs.length})`}>
          <div className="space-y-1.5 text-sm" data-testid="customer-repairs">
            {c.repairs.length === 0 && <p className="text-xs text-slate-400">No repair jobs.</p>}
            {c.repairs.map((r) => (
              <div key={r.id} className="flex justify-between border-b border-slate-50 py-1.5">
                <span>{r.repair_number} · <span className="capitalize">{r.service_type}</span></span>
                <span className="flex gap-2 items-center">{rs(r.charge)} <Badge status={r.status} colors={STATUS_COLORS} /></span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
