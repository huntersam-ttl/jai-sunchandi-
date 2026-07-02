import { useState } from "react";
import { api } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { inputCls } from "./CustomOrder";

export default function OrderStatus() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);

  const check = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    const { data } = await api.get("/public/order-status", { params: { phone: phone.trim() } });
    setOrders(data);
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl font-bold tracking-tighter">Check Order Status</h1>
      <p className="text-slate-600 mt-2 text-sm">Enter the phone number you gave at the shop.</p>
      <form onSubmit={check} className="mt-6 flex gap-3">
        <input className={inputCls} placeholder="98XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="status-phone-input" />
        <button type="submit" data-testid="status-check-btn"
          className="bg-[#0F172A] text-white px-6 rounded-md min-h-[48px] hover:bg-slate-800 transition-colors whitespace-nowrap">
          {loading ? "…" : "Check"}
        </button>
      </form>
      {orders && (
        <div className="mt-8 space-y-3" data-testid="status-results">
          {orders.length === 0 ? (
            <p className="text-slate-500 text-sm" data-testid="status-no-orders">No active orders found for this phone number.</p>
          ) : orders.map((o) => (
            <div key={o.order_number} className="bg-white border border-slate-200 rounded-md p-4" data-testid={`status-order-${o.order_number}`}>
              <div className="flex justify-between items-center">
                <p className="font-semibold">{o.order_number}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[o.status] || ""}`}>{o.status.replace("_", " ")}</span>
              </div>
              <div className="mt-2 text-sm text-slate-600 space-y-1">
                <p>Type: <span className="capitalize">{o.order_type.replace("_", " ")}</span></p>
                {o.delivery_date_bs_np && <p>Delivery date (BS): {o.delivery_date_bs_np}</p>}
                <p>Remaining balance: <b className="text-[#991B1B]">{rs(o.remaining_balance)}</b> (रु. {o.remaining_balance_np})</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
