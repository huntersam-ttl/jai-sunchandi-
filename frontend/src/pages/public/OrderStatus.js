import { useState } from "react";
import { Search, MessageCircle } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/format";
import { inputCls } from "./CustomOrder";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";

export default function OrderStatus() {
  const shop = useSettings();
  const [form, setForm] = useState({ order_number: "", phone: "" });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
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
    setSearched(true);
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
    <div className="min-h-[calc(100vh-4rem-14rem)] flex items-start justify-center px-4 sm:px-6 py-12 sm:py-16">
      <div className="max-w-xl w-full">
        <div className="text-center sm:text-left">
          <h1 className="font-serif-display text-4xl font-bold tracking-tighter">Check Order Status</h1>
          <p className="text-slate-600 mt-2 text-sm">
            Enter your order number and the phone number you gave at the shop.
          </p>
        </div>
        <form onSubmit={check} className="mt-6 space-y-3 bg-white border border-slate-200 rounded-md p-5 sm:p-6">
          <input className={inputCls} placeholder="Order number e.g. ORD-0001"
            value={form.order_number} onChange={set("order_number")} data-testid="status-order-input" />
          <div className="flex flex-col sm:flex-row gap-3">
            <input className={inputCls} placeholder="98XXXXXXXX"
              value={form.phone} onChange={set("phone")} data-testid="status-phone-input" />
            <button type="submit" data-testid="status-check-btn"
              className="bg-[#0F172A] text-white px-6 rounded-md min-h-[48px] hover:bg-slate-800 transition-colors whitespace-nowrap flex items-center justify-center gap-2">
              <Search size={16} /> {loading ? "Checking…" : "Check"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 bg-white border border-slate-200 rounded-md p-4 text-sm text-slate-500" data-testid="status-error">
            {error}
          </div>
        )}

        {order && (
          <div className="mt-6" data-testid="status-results">
            <div className="bg-white border border-slate-200 rounded-md p-4 sm:p-5" data-testid={`status-order-${order.order_number}`}>
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

        {!searched && (
          <div className="mt-6 bg-slate-50 border border-dashed border-slate-200 rounded-md p-5 text-sm text-slate-500 space-y-2" data-testid="status-help">
            <p className="font-medium text-slate-600">Not sure of your order number?</p>
            <p>It's printed on the receipt we gave you at the shop — it looks like <span className="font-mono">ORD-0001</span>.</p>
            {shop.whatsapp && (
              <a href={waLinkFromSettings(shop, shop.default_whatsapp_message || `Namaste ${shop.shop_name}, could you help me find my order number?`)}
                target="_blank" rel="noreferrer" data-testid="status-help-whatsapp"
                className="inline-flex items-center gap-2 text-[#D4AF37] hover:underline font-medium">
                <MessageCircle size={15} /> Ask us on WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
