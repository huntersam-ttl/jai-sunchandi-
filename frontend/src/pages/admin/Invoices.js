import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { inp, Badge } from "@/components/admin/ui";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [q, setQ] = useState("");

  const load = (query = "") => api.get("/admin/invoices", { params: query ? { q: query } : {} }).then((r) => setInvoices(r.data));
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Invoice Archive</h1>
        <input className={inp} style={{ width: 240 }} placeholder="Search bill no / customer…" value={q}
          onChange={(e) => { setQ(e.target.value); load(e.target.value); }} data-testid="invoices-search-input" />
      </div>
      <p className="text-xs text-slate-500">Physical stamped bills remain the official bill. This is the searchable digital archive.</p>
      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b">
            <th className="p-3">Bill No.</th><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Remaining</th><th>Status</th></tr></thead>
          <tbody data-testid="invoices-table">
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3"><Link to={`/admin/invoices/${inv.id}`} className="font-semibold hover:text-[#D4AF37]" data-testid={`invoice-link-${inv.bill_number}`}>{inv.bill_number}</Link></td>
                <td>{inv.order_number}</td>
                <td>{inv.invoice_date_ad}<br /><span className="text-xs text-slate-400">BS {inv.invoice_date_bs_np}</span></td>
                <td>{inv.customer.name}<br /><span className="text-xs text-slate-400">{inv.customer.phone}</span></td>
                <td className="font-semibold">{rs(inv.net_payable)}</td>
                <td className="text-[#991B1B]">{rs(inv.remaining_balance)}</td>
                <td><Badge status={inv.status} colors={STATUS_COLORS} /></td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No invoices yet. Create one from an order.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
