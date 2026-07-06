import { useState } from "react";
import { api, apiError } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/format";
import { inputCls } from "./CustomOrder";

export default function OrderStatus() {
  const [form, setForm] = useState({ order_number: "", phone: "" });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const check = async (e) => {
    e.preventDefault();
    if (!form.order_number.trim() || !form.phone.trim()) {
      setError("Enter both your order number and phone number.");
      return;
    }
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const { data } = await api.get("/public/order-status", {
        params: { order_number: form.order_number.trim(), phone: form.phone.trim() },
      });
      setOrder(data);
    } catch (err) {
      setError(
        err?.response?.status === 404
          ? "No active order found for that order number and phone."
          : apiError(err)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl font-bold tracking-tighter">Check Order Status</h1>
      <p className="text-slate-600 mt-2 text-sm">
        Enter your order number and the phone number you gave at the shop.
      </p>
      <form onSubmit={check} className="mt-6 space-y-3">
        <input className={inputCls} placeholder="Order number e.g. ORD-0001"
          value={form.order_number} onChange={set("order_number")} data-testid="status-order-input" />
        <div className="flex gap-3">
          <input className={inputCls} placeholder="98XXXXXXXX"
            value={form.phone} onChange={set("phone")} data-testid="status-phone-input" />
          <button type="submit" data-testid="status-check-btn"
            className="bg-[#0F172A] text-white px-6 rounded-md min-h-[48px] hover:bg-slate-800 transition-colors whitespace-nowrap">
            {loading ? "…" : "Check"}
          </button>
        </div>
      </form>
      {error && <p className="mt-6 text-slate-500 text-sm" data-testid="status-error">{error}</p>}
      {order && (
        <div className="mt-8" data-testid="status-results">
          <div className="bg-white border border-slate-200 rounded-md p-4" data-testid={`status-order-${order.order_number}`}>
            <div className="flex justify-between items-center">
              <p className="font-semibold">{order.order_number}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || ""}`}>
                {order.status.replace("_", " ")}
              </span>
            </div>
            <div className="mt-2 text-sm text-slate-600 space-y-1">
              <p>Type: <span className="capitalize">{order.order_type.replace("_", " ")}</span></p>
              {order.delivery_date_bs_np && <p>Delivery date (BS): {order.delivery_date_bs_np}</p>}
              {order.delivery_date_ad && <p>Delivery date (AD): {order.delivery_date_ad}</p>}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              For payment or balance details, please contact the shop.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
