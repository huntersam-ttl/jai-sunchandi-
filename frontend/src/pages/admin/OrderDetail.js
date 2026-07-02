import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { api, apiError } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { inp, btnGold, btnGhost, Card, Badge, F } from "@/components/admin/ui";

const ORDER_STATUSES = ["new", "in_progress", "making", "polishing", "ready", "delivered", "cancelled"];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [pay, setPay] = useState({ amount: "", method: "cash", note: "", payment_date_ad: new Date().toISOString().slice(0, 10) });
  const [bill, setBill] = useState("");

  const load = () => api.get(`/admin/orders/${id}`).then((r) => setOrder(r.data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (!order) return <p className="text-sm text-slate-500">Loading…</p>;

  const setStatus = async (status) => {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      toast.success(`Status: ${status}`);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const addPayment = async () => {
    if (!pay.amount) return toast.error("Enter amount");
    try {
      await api.post(`/admin/orders/${id}/payments`, { ...pay, amount: +pay.amount });
      toast.success("Payment recorded");
      setPay({ ...pay, amount: "", note: "" });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const createInvoice = async () => {
    if (!bill.trim()) return toast.error("Enter physical bill number first");
    try {
      const { data } = await api.post("/admin/invoices", { order_id: id, bill_number: bill.trim() });
      toast.success(`Invoice ${data.bill_number} created`);
      navigate(`/admin/invoices/${data.id}`);
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="order-number">{order.order_number}</h1>
          <p className="text-sm text-slate-500">
            <Link to={`/admin/customers/${order.customer_id}`} className="underline hover:text-[#D4AF37]">{order.customer_name}</Link> · {order.customer_phone} · <span className="capitalize">{order.order_type.replace("_", " ")}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">Order: {order.order_date_ad} (BS {order.order_date_bs_np}) {order.delivery_date_ad && `· Delivery: ${order.delivery_date_ad} (BS ${order.delivery_date_bs_np}) ${order.delivery_time || ""}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={order.status} colors={STATUS_COLORS} />
          <select className={inp} style={{ width: 150 }} value={order.status} onChange={(e) => setStatus(e.target.value)} data-testid="order-status-select">
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Items (price snapshot frozen at order time)">
            <div className="space-y-3" data-testid="order-items">
              {order.items.map((it) => (
                <div key={it.id} className="border border-slate-100 rounded p-3 text-sm">
                  <div className="flex justify-between font-semibold"><span>{it.name}</span><span>{rs(it.total_price)}</span></div>
                  <p className="text-xs text-slate-500 mt-1">
                    {it.weight_tola} tola ({it.weight_grams} g) · {it.purity} (factor {it.purity_factor}) · rate {rs(it.rate_per_tola)}/tola
                  </p>
                  <p className="text-xs text-slate-500">
                    Metal {rs(it.metal_value)} + Jarti {it.jarti_percent}% ({rs(it.jarti_amount)}) + Jyala {rs(it.jyala_amount)}
                    {it.stone_cost > 0 && ` + Stone ${rs(it.stone_cost)}`}
                    {it.other_cost > 0 && ` + Other ${rs(it.other_cost)}`}
                    {it.discount > 0 && ` − Discount ${rs(it.discount)}`}
                  </p>
                </div>
              ))}
              {order.custom_description && <p className="text-sm text-slate-600">Description: {order.custom_description}</p>}
            </div>
          </Card>

          {order.old_gold && order.old_gold.old_gold_value > 0 && (
            <Card title="Old Gold Exchange (पुरानो सुन सट्टा)">
              <div className="text-sm space-y-1" data-testid="order-oldgold">
                <p>{order.old_gold.old_item_description}</p>
                <p className="text-slate-500 text-xs">{order.old_gold.old_weight_tola} tola ({order.old_gold.old_weight_grams} g) · rate {rs(order.old_gold.old_valuation_rate_per_tola)}/tola · deduction {order.old_gold.old_deduction_percent}%</p>
                <p>Value: <b className="text-amber-700">- {rs(order.old_gold.old_gold_value)}</b></p>
              </div>
            </Card>
          )}

          <Card title="Payments / Khata">
            <div className="space-y-1.5 text-sm mb-4" data-testid="order-payments">
              {order.payments.length === 0 && <p className="text-xs text-slate-400">No payments recorded.</p>}
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between border-b border-slate-50 py-1.5">
                  <span>{p.payment_date_ad} (BS {p.payment_date_bs_np}) · <span className="capitalize">{p.method}</span>{p.note && ` · ${p.note}`}</span>
                  <b>{rs(p.amount)}</b>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              <F label="Amount"><input className={inp} type="number" step="any" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} data-testid="payment-amount-input" /></F>
              <F label="Date"><input className={inp} type="date" value={pay.payment_date_ad} onChange={(e) => setPay({ ...pay, payment_date_ad: e.target.value })} data-testid="payment-date-input" /></F>
              <F label="Method"><select className={inp} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} data-testid="payment-method-select">{["cash", "bank", "wallet", "other"].map((m) => <option key={m}>{m}</option>)}</select></F>
              <F label="Note"><input className={inp} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} data-testid="payment-note-input" /></F>
              <button className={btnGold} onClick={addPayment} data-testid="payment-add-btn">Add Payment</button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="bg-[#0F172A] text-white rounded-md p-5 space-y-2 text-sm" data-testid="order-summary">
            <div className="flex justify-between"><span>Total Price</span><b>{rs(order.total_price)}</b></div>
            {order.old_gold_value > 0 && <div className="flex justify-between text-amber-400"><span>Old Gold</span><b>- {rs(order.old_gold_value)}</b></div>}
            <div className="flex justify-between border-t border-slate-700 pt-2"><span>Net Payable</span><b className="text-[#D4AF37]">{rs(order.net_payable)}</b></div>
            <div className="flex justify-between"><span>Advance Paid</span><b>{rs(order.advance_total)}</b></div>
            <div className="flex justify-between text-lg"><span>Remaining</span><b className="text-red-400" data-testid="order-remaining">{rs(order.remaining_balance)}</b></div>
          </div>

          <Card title="Create Invoice (physical bill sync)">
            <p className="text-xs text-slate-500 mb-2">Enter the bill number from the physical stamped bill book. System entry must exist before writing the paper bill.</p>
            <div className="flex gap-2">
              <input className={inp} placeholder="Bill No. e.g. 1234" value={bill} onChange={(e) => setBill(e.target.value)} data-testid="invoice-bill-number-input" />
              <button className={btnGold} onClick={createInvoice} data-testid="invoice-create-btn">Create</button>
            </div>
          </Card>

          <Card title="Order QR">
            <div className="flex items-center gap-4">
              <QRCodeSVG value={`${window.location.origin}/admin/orders/${order.id}`} size={96} data-testid="order-qr" />
              <div className="text-xs text-slate-500">
                <p>Scan opens this order (admin login required).</p>
                <button className={`${btnGhost} mt-2`} onClick={() => window.print()}>Print</button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
