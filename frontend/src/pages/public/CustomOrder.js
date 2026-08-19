import { useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-sm font-semibold text-[#4E4036]">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

export const inputCls = "w-full border border-[#9F7225]/25 rounded-md px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#C99A3D]/45 bg-white/80";

export default function CustomOrder() {
  const shop = useSettings();
  useDocumentMeta(
    `Custom Gold Order – ${shop.shop_name || "Jai Supa Deurali Sun-Chandi Pasal"}`,
    "Request a custom gold or silver ornament made to your design — share your requirement and we'll get in touch."
  );
  const [form, setForm] = useState({ name: "", phone: "", item_type: "", metal: "gold", approx_weight: "", budget: "", deadline: "", notes: "" });
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error("Name and phone are required");
    try {
      await api.post("/leads", { lead_type: "custom_order", ...form });
      setSent(true);
    } catch (err) { toast.error(apiError(err)); }
  };

  if (sent) return (
    <div className="brand-shell max-w-xl py-24 text-center" data-testid="custom-order-success">
      <p className="font-serif-display text-3xl font-bold">धन्यवाद! Thank you!</p>
      <p className="mt-3 text-slate-600">Your custom order request has been received. We will call you on {form.phone} soon.</p>
    </div>
  );

  return (
    <div className="brand-shell max-w-xl py-12 sm:py-16">
      <p className="brand-eyebrow">Custom jewellery</p>
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold tracking-tight ornament-line mt-3">Custom Order Request</h1>
      <p className="text-[#5F5147] mt-5 text-sm leading-relaxed">Tell us what you want made. The shop will contact you to discuss design, weight, jarti, jyala and price estimate.</p>
      <form onSubmit={submit} className="brand-card mt-8 space-y-4 rounded-md p-5 sm:p-6" data-testid="custom-order-form">
        <Field label="Your Name *"><input className={inputCls} value={form.name} onChange={set("name")} data-testid="co-name" /></Field>
        <Field label="Phone Number *"><input className={inputCls} value={form.phone} onChange={set("phone")} data-testid="co-phone" /></Field>
        <Field label="Item Type (e.g. ring, necklace, tilhari)"><input className={inputCls} value={form.item_type} onChange={set("item_type")} data-testid="co-item-type" /></Field>
        <Field label="Metal">
          <select className={inputCls} value={form.metal} onChange={set("metal")} data-testid="co-metal">
            <option value="gold">Gold</option><option value="silver">Silver</option>
          </select>
        </Field>
        <Field label="Approximate Weight (tola)"><input className={inputCls} value={form.approx_weight} onChange={set("approx_weight")} data-testid="co-weight" /></Field>
        <Field label="Budget (Rs.)"><input className={inputCls} value={form.budget} onChange={set("budget")} data-testid="co-budget" /></Field>
        <Field label="Deadline"><input type="date" className={inputCls} value={form.deadline} onChange={set("deadline")} data-testid="co-deadline" /></Field>
        <Field label="Notes / Design details"><textarea rows={3} className={inputCls} value={form.notes} onChange={set("notes")} data-testid="co-notes" /></Field>
        <button type="submit" data-testid="co-submit"
          className="focus-brand w-full bg-[#171310] text-white py-4 rounded-md min-h-[52px] text-base font-semibold hover:bg-[#2B211A] transition-colors duration-300">
          Send Request
        </button>
      </form>
    </div>
  );
}
