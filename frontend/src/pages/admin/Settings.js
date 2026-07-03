import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { compressImage } from "@/lib/format";
import { useSettingsReload } from "@/context/SettingsContext";
import { inp, btnGold, btnGhost, F, Card } from "@/components/admin/ui";
import { Save, Upload, RotateCcw, Store } from "lucide-react";

const EMPTY = {
  shop_name: "",
  shop_name_np: "",
  tagline: "",
  tagline_np: "",
  phone: "",
  whatsapp: "",
  address: "",
  maps_link: "",
  opening_hours: "",
  logo: "",
  default_whatsapp_message: "",
};

function validatePhone(value, label) {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return `${label} must have 7–15 digits`;
  }
  return null;
}

export default function Settings() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const reload = useSettingsReload();

  const load = () => {
    setLoading(true);
    api
      .get("/admin/settings")
      .then((r) => {
        setForm({ ...EMPTY, ...r.data });
        setLoading(false);
      })
      .catch((e) => {
        toast.error(apiError(e));
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 400, 0.85);
      set("logo", compressed);
      toast.success("Logo ready — save to apply.");
    } catch {
      toast.error("Failed to process image");
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.shop_name.trim()) errs.shop_name = "Shop name is required";
    const phoneErr = validatePhone(form.phone, "Phone");
    if (phoneErr) errs.phone = phoneErr;
    const waErr = validatePhone(form.whatsapp, "WhatsApp");
    if (waErr) errs.whatsapp = waErr;
    return errs;
  };

  const save = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await api.put("/admin/settings", form);
      toast.success("Settings saved successfully");
      reload(); // refresh SettingsContext across the app
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading settings…</p>;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="admin-settings-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store size={22} /> Shop Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            These values appear on the public website, invoices, and certificates.
          </p>
        </div>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={load} data-testid="settings-reset-btn">
            <RotateCcw size={15} /> Reset
          </button>
          <button
            className={btnGold}
            onClick={save}
            disabled={saving}
            data-testid="settings-save-btn"
          >
            <Save size={15} /> {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>

      <Card title="Shop Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="Shop Name (English) *">
            <input
              className={inp}
              value={form.shop_name}
              onChange={(e) => set("shop_name", e.target.value)}
              data-testid="settings-shop-name"
            />
            {errors.shop_name && <p className="text-red-600 text-xs mt-1">{errors.shop_name}</p>}
          </F>
          <F label="Shop Name (Nepali)">
            <input
              className={inp}
              value={form.shop_name_np}
              onChange={(e) => set("shop_name_np", e.target.value)}
              data-testid="settings-shop-name-np"
            />
          </F>
          <F label="Tagline (English)">
            <input
              className={inp}
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              data-testid="settings-tagline"
            />
          </F>
          <F label="Tagline (Nepali)">
            <input
              className={inp}
              value={form.tagline_np}
              onChange={(e) => set("tagline_np", e.target.value)}
              data-testid="settings-tagline-np"
            />
          </F>
        </div>
      </Card>

      <Card title="Contact Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="Phone Number *">
            <input
              className={inp}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+977-9800000000"
              data-testid="settings-phone"
            />
            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
          </F>
          <F label="WhatsApp Number * (digits only, with country code)">
            <input
              className={inp}
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="9779800000000"
              data-testid="settings-whatsapp"
            />
            {errors.whatsapp && (
              <p className="text-red-600 text-xs mt-1">{errors.whatsapp}</p>
            )}
          </F>
          <F label="Address" className="sm:col-span-2">
            <input
              className={inp}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              data-testid="settings-address"
            />
          </F>
          <F label="Google Maps Link" className="sm:col-span-2">
            <input
              className={inp}
              value={form.maps_link}
              onChange={(e) => set("maps_link", e.target.value)}
              placeholder="https://maps.google.com/?q=..."
              data-testid="settings-maps-link"
            />
          </F>
          <F label="Opening Hours" className="sm:col-span-2">
            <input
              className={inp}
              value={form.opening_hours}
              onChange={(e) => set("opening_hours", e.target.value)}
              placeholder="Sun–Fri: 10am – 7pm"
              data-testid="settings-opening-hours"
            />
          </F>
        </div>
      </Card>

      <Card title="WhatsApp & Messaging">
        <F label="Default WhatsApp Message">
          <textarea
            className={inp}
            rows={3}
            value={form.default_whatsapp_message}
            onChange={(e) => set("default_whatsapp_message", e.target.value)}
            data-testid="settings-whatsapp-message"
          />
          <p className="text-xs text-slate-400 mt-1">
            Used as the pre-filled text when visitors click WhatsApp buttons.
          </p>
        </F>
      </Card>

      <Card title="Shop Logo">
        <div className="flex items-start gap-6">
          {form.logo ? (
            <div className="flex-shrink-0">
              <img
                src={form.logo}
                alt="Shop logo"
                className="h-20 w-20 object-contain border border-slate-200 rounded-md bg-white"
                data-testid="settings-logo-preview"
              />
              <button
                className="text-xs text-red-500 mt-1 hover:underline"
                onClick={() => set("logo", "")}
                data-testid="settings-logo-remove"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="h-20 w-20 border-2 border-dashed border-slate-300 rounded-md flex items-center justify-center text-slate-400 text-xs">
              No logo
            </div>
          )}
          <label className={btnGhost + " cursor-pointer"} data-testid="settings-logo-upload">
            <Upload size={15} /> Upload Logo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </label>
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          className={btnGold}
          onClick={save}
          disabled={saving}
          data-testid="settings-save-bottom-btn"
        >
          <Save size={15} /> {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
