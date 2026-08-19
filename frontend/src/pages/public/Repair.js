import { useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { uploadImage } from "@/lib/storage";
import { useSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { Field, inputCls } from "./CustomOrder";
import { PUBLIC_BRAND_NAME } from "@/lib/brand";

export default function Repair() {
  const shop = useSettings();
  useDocumentMeta(
    `Jewellery Repair – ${PUBLIC_BRAND_NAME}`,
    "Request a jewellery repair — resizing, broken clasps, polishing, and more — from our experienced karigars."
  );
  const [form, setForm] = useState({ name: "", phone: "", service_type: "repair", notes: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onPhoto = (e) => {
    const f = e.target.files?.[0] || null;
    setPhotoFile(f);
    setPhotoPreview(f ? URL.createObjectURL(f) : "");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error("Name and phone are required");
    setSubmitting(true);
    try {
      let photo_url = "";
      if (photoFile) {
        // Uploads to the private repair-photos bucket (anon write-only); we store
        // only the path — the admin views it later via a signed URL.
        const { path } = await uploadImage(photoFile, "repair");
        photo_url = path;
      }
      await api.post("/leads", { lead_type: "repair", ...form, photo_url });
      setSent(true);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) return (
    <div className="brand-shell max-w-xl py-24 text-center" data-testid="repair-success">
      <p className="font-serif-display text-3xl font-bold">धन्यवाद! Request received</p>
      <p className="mt-3 text-slate-600">We will contact you on {form.phone} about your {form.service_type} request.</p>
    </div>
  );

  return (
    <div className="brand-shell max-w-xl py-12 sm:py-16">
      <p className="brand-eyebrow">Repair service</p>
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold tracking-tight ornament-line mt-3">Repair / Polish / Cleaning</h1>
      <p className="text-[#5F5147] mt-5 text-sm leading-relaxed">Bring old jewellery back to life. Send a request and visit the shop for inspection and final repair guidance.</p>
      <form onSubmit={submit} className="brand-card mt-8 space-y-4 rounded-md p-5 sm:p-6" data-testid="repair-form">
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
          {photoPreview && <img src={photoPreview} alt="upload preview" className="mt-2 h-24 rounded border" />}
        </Field>
        <button type="submit" disabled={submitting} data-testid="rp-submit"
          className="focus-brand w-full bg-[#5B0D18] text-white py-4 rounded-md min-h-[52px] text-base font-semibold hover:bg-[#2B1B17] transition-colors duration-300 disabled:opacity-60">
          {submitting ? "Sending…" : "Send Request"}
        </button>
      </form>
    </div>
  );
}
