import { useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { compressImage } from "@/lib/format";
import { Field, inputCls } from "./CustomOrder";

export default function Repair() {
  const [form, setForm] = useState({ name: "", phone: "", service_type: "repair", notes: "", photo: "" });
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (f) setForm({ ...form, photo: await compressImage(f) });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error("Name and phone are required");
    try {
      await api.post("/leads", { lead_type: "repair", ...form });
      setSent(true);
    } catch (err) { toast.error(apiError(err)); }
  };

  if (sent) return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center" data-testid="repair-success">
      <p className="font-serif-display text-3xl font-bold">धन्यवाद! Request received</p>
      <p className="mt-3 text-slate-600">We will contact you on {form.phone} about your {form.service_type} request.</p>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl font-bold tracking-tighter">Repair / Polish / Cleaning</h1>
      <p className="text-slate-600 mt-2 text-sm">Bring old jewellery back to life. Send a request and visit the shop.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" data-testid="repair-form">
        <Field label="Your Name *"><input className={inputCls} value={form.name} onChange={set("name")} data-testid="rp-name" /></Field>
        <Field label="Phone Number *"><input className={inputCls} value={form.phone} onChange={set("phone")} data-testid="rp-phone" /></Field>
        <Field label="Service Type">
          <select className={inputCls} value={form.service_type} onChange={set("service_type")} data-testid="rp-service">
            <option value="repair">Repair</option>
            <option value="polish">Polish</option>
            <option value="cleaning">Cleaning</option>
          </select>
        </Field>
        <Field label="Notes (what needs fixing?)"><textarea rows={3} className={inputCls} value={form.notes} onChange={set("notes")} data-testid="rp-notes" /></Field>
        <Field label="Photo (optional)">
          <input type="file" accept="image/*" onChange={onPhoto} className="text-sm" data-testid="rp-photo" />
          {form.photo && <img src={form.photo} alt="upload" className="mt-2 h-24 rounded border" />}
        </Field>
        <button type="submit" data-testid="rp-submit"
          className="w-full bg-[#0F172A] text-white py-4 rounded-md min-h-[52px] text-base font-semibold hover:bg-slate-800 transition-colors duration-300">
          Send Request
        </button>
      </form>
    </div>
  );
}
