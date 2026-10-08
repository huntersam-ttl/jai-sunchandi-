import { useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { PUBLIC_BRAND_NAME } from "@/lib/brand";
import { uploadImage } from "@/lib/storage";
import { COLLECTOR_METHODS, COUNTRY_OPTIONS, FULFILMENT_OPTIONS } from "@/lib/fulfilment";

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-sm font-semibold text-[#4E4036]">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

export const inputCls = "w-full border border-[#5B0D18]/25 rounded-md px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/45 bg-white/80";

export default function CustomOrder() {
  const shop = useSettings();
  useDocumentMeta(
    `Custom Gold Order – ${PUBLIC_BRAND_NAME}`,
    "Request a custom gold or silver ornament made to your design — share your requirement and we'll get in touch."
  );
  const [form, setForm] = useState({ name: "", phone: "", item_type: "", metal: "gold", purity: "", size: "", approx_weight: "", budget: "", deadline: "", country: "NP", fulfilment_method: "self_collect", collector_name: "", collector_phone: "", collector_relationship: "", notes: "" });
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error("Name and phone are required");
    try {
      setUploading(true);
      if (files.some((file) => file.size > 5 * 1024 * 1024)) return toast.error("Each reference photo must be 5 MB or smaller");
      const uploaded = await Promise.all(files.slice(0, 5).map((file) => uploadImage(file, "lead")));
      const photo_urls = uploaded.map((item) => item.path);
      await api.post("/leads", { lead_type: "custom_order", ...form, photo_urls, photo_url: photo_urls[0] || "" });
      setSent(true);
    } catch (err) { toast.error(apiError(err)); } finally { setUploading(false); }
  };

  if (sent) return (
    <div className="brand-shell max-w-xl py-24 text-center" data-testid="custom-order-success">
      <p className="font-serif-display text-3xl font-bold">धन्यवाद! Thank you!</p>
      <p className="mt-3 text-slate-600">Your request has been received. We will call you on {form.phone} to confirm the design, purity, weight, making charges and fulfilment plan.</p>
      <a className="inline-flex mt-6 text-sm font-semibold text-[#5B0D18] underline" href="/order-status">Already have an order? Check its status</a>
    </div>
  );

  return (
    <div className="brand-shell max-w-xl py-12 sm:py-16">
      <p className="brand-eyebrow">Custom jewellery</p>
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold tracking-tight ornament-line mt-3">Custom Order Request</h1>
      <p className="text-[#5F5147] mt-5 text-sm leading-relaxed">Share your idea, a reference photo, and the basics. The shop will confirm the design, weight, purity, jarti, jyala, price and delivery or collection plan with you.</p>
      <form onSubmit={submit} className="brand-card mt-8 space-y-4 rounded-md p-5 sm:p-6" data-testid="custom-order-form">
        <Field label="Your Name *"><input className={inputCls} value={form.name} onChange={set("name")} data-testid="co-name" /></Field>
        <Field label="Phone Number *"><input className={inputCls} value={form.phone} onChange={set("phone")} data-testid="co-phone" /></Field>
        <Field label="Item Type (e.g. ring, necklace, tilhari)"><input className={inputCls} value={form.item_type} onChange={set("item_type")} data-testid="co-item-type" /></Field>
        <Field label="Metal">
          <select className={inputCls} value={form.metal} onChange={set("metal")} data-testid="co-metal">
            <option value="gold">Gold</option><option value="silver">Silver</option>
          </select>
        </Field>
        <Field label="Preferred Purity"><select className={inputCls} value={form.purity} onChange={set("purity")} data-testid="co-purity"><option value="">To be discussed</option><option>24K</option><option>22K</option><option>18K</option><option>Silver</option></select></Field>
        <Field label="Ring / bangle size (if relevant)"><input className={inputCls} value={form.size} onChange={set("size")} placeholder="e.g. ring size 16 or bangle 2.6" data-testid="co-size" /></Field>
        <Field label="Approximate Weight (tola)"><input className={inputCls} value={form.approx_weight} onChange={set("approx_weight")} data-testid="co-weight" /></Field>
        <Field label="Budget (Rs.)"><input className={inputCls} value={form.budget} onChange={set("budget")} data-testid="co-budget" /></Field>
        <Field label="Deadline"><input type="date" className={inputCls} value={form.deadline} onChange={set("deadline")} data-testid="co-deadline" /></Field>
        <Field label="Where should we fulfil this?"><select className={inputCls} value={form.fulfilment_method} onChange={set("fulfilment_method")} data-testid="co-fulfilment">{FULFILMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
        <Field label="Country"><input className={inputCls} list="country-options" maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} placeholder="NP" data-testid="co-country" /><datalist id="country-options">{COUNTRY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist><p className="text-xs text-slate-500 mt-1">Use a two-letter country code: NP, GB, AU, or another ISO code.</p></Field>
        {COLLECTOR_METHODS.has(form.fulfilment_method) && <><Field label="Collector full name *"><input className={inputCls} value={form.collector_name} onChange={set("collector_name")} data-testid="co-collector-name" /></Field><Field label="Collector phone *"><input className={inputCls} value={form.collector_phone} onChange={set("collector_phone")} data-testid="co-collector-phone" /></Field><Field label="Relationship / note"><input className={inputCls} value={form.collector_relationship} onChange={set("collector_relationship")} data-testid="co-collector-relationship" /></Field></>}
        <Field label="Reference photos (up to 5)"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} className="w-full text-sm" data-testid="co-photos" /><p className="text-xs text-slate-500 mt-1">Photos are compressed before upload and used only to understand your request.</p>{files.length > 0 && <p className="text-xs text-[#5B0D18] mt-1">{files.length} photo{files.length === 1 ? "" : "s"} selected</p>}</Field>
        <Field label="Notes / Design details"><textarea rows={3} className={inputCls} value={form.notes} onChange={set("notes")} data-testid="co-notes" /></Field>
        <button type="submit" data-testid="co-submit"
          className="focus-brand w-full bg-[#5B0D18] text-white py-4 rounded-md min-h-[52px] text-base font-semibold hover:bg-[#2B1B17] transition-colors duration-300">
          {uploading ? "Sending…" : "Send Request"}
        </button>
      </form>
    </div>
  );
}
