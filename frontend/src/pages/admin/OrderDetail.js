import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { api, apiError } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { orderWhatsappLink, orderStatusLink, buildOrderWhatsappMessage } from "@/lib/receipt";
import { inp, btnGold, btnGhost, Card, Badge, F } from "@/components/admin/ui";
import { RefreshCw, Printer, MessageCircle, Link2 } from "lucide-react";

const ORDER_STATUSES = ["new", "in_progress", "making", "polishing", "ready", "delivered", "cancelled"];

export default function OrderDetail() {
  const { id } = useParams();
  const shop = useSettings();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [pay, setPay] = useState({ amount: "", method: "cash", note: "", payment_date_ad: new Date().toISOString().slice(0, 10) });

  const load = () => {
    setError(null);
    api.get(`/admin/orders/${id}`).then((r) => setOrder(r.data))
      .catch((err) => { console.error("Order detail load failed:", err); setError(apiError(err)); });
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (error && !order) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-6 text-center space-y-3">
        <p className="text-red-700 font-medium">Could not load data. Please refresh or contact admin.</p>
        <p className="text-xs text-slate-400">{error}</p>
        <button className={btnGhost} onClick={load}><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }
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

  const whatsappLink = orderWhatsappLink(order, buildOrderWhatsappMessage(order, shop.shop_name));
  const statusLink = orderStatusLink(order);
  const copyStatusLink = async () => {
    try {
      await navigator.clipboard.writeText(statusLink);
      toast.success("Status link copied");
    } catch {
      toast.error("Could not copy link");
    }
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

          <Card title="Receipt">
            <div className="print-area space-y-3 text-sm" data-testid="order-receipt">
              <div className="text-center border-b border-slate-100 pb-2">
                <p className="font-serif-display font-bold">{shop.shop_name}</p>
                {shop.shop_name_np && <p className="text-xs text-slate-500">{shop.shop_name_np}</p>}
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Order</span><b>{order.order_number}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Customer</span><span>{order.customer_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Phone</span><span>{order.customer_phone}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="capitalize">{order.order_type.replace("_", " ")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Order Date</span><span>{order.order_date_ad}</span></div>
              {order.delivery_date_ad && (
                <div className="flex justify-between"><span className="text-slate-500">Delivery</span><span>{order.delivery_date_ad}{order.delivery_time ? ` ${order.delivery_time}` : ""}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="capitalize">{order.status.replace("_", " ")}</span></div>

              {order.items.length > 0 && (
                <div className="border-t border-slate-100 pt-2 space-y-2">
                  {order.items.map((it) => (
                    <div key={it.id}>
                      <div className="flex justify-between font-medium"><span>{it.name}</span><span>{rs(it.total_price)}</span></div>
                      <p className="text-xs text-slate-500">
                        {it.metal} · {it.purity} · {it.weight_tola} tola ({it.weight_grams} g)
                      </p>
                      <p className="text-xs text-slate-500">
                        Jarti {it.jarti_percent}% ({rs(it.jarti_amount)}) · Jyala {rs(it.jyala_amount)}
                        {it.stone_cost > 0 && ` · Stone ${rs(it.stone_cost)}`}
                        {it.polishing_cost > 0 && ` · Polish ${rs(it.polishing_cost)}`}
                        {it.cutting_cost > 0 && ` · Cutting ${rs(it.cutting_cost)}`}
                        {it.worker_charge > 0 && ` · Worker ${rs(it.worker_charge)}`}
                        {it.other_cost > 0 && ` · Other ${rs(it.other_cost)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {order.custom_description && (
                <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">{order.custom_description}</p>
              )}

              <div className="border-t border-slate-100 pt-2 space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Total</span><b>{rs(order.net_payable)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Advance Paid</span><span>{rs(order.advance_total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Remaining Balance</span><b className="text-[#991B1B]">{rs(order.remaining_balance)}</b></div>
              </div>

              {order.notes && (
                <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">Notes: {order.notes}</p>
              )}
            </div>

            <div className="no-print mt-4 flex flex-wrap gap-2">
              <button className={btnGhost} onClick={() => window.print()} data-testid="print-receipt-btn">
                <Printer size={14} /> Print Receipt
              </button>
              {whatsappLink ? (
                <a href={whatsappLink} target="_blank" rel="noreferrer" data-testid="receipt-whatsapp-btn"
                  className="inline-flex items-center gap-2 bg-[#25D366] text-white px-3 py-2 rounded-md text-sm hover:bg-[#1fb457] transition-colors">
                  <MessageCircle size={14} /> Send on WhatsApp
                </a>
              ) : (
                <button className={btnGhost} disabled title="No valid phone number on this order" data-testid="receipt-whatsapp-disabled">
                  <MessageCircle size={14} /> Send on WhatsApp
                </button>
              )}
              <button className={btnGhost} onClick={copyStatusLink} data-testid="copy-status-link-btn">
                <Link2 size={14} /> Copy Status Link
              </button>
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
