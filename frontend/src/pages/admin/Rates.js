import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { rs, toNp } from "@/lib/format";
import { validateDailyRateInput } from "@/lib/ratesInput";
import { inp, btnGold, Card, F } from "@/components/admin/ui";

export default function RatesAdmin() {
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date_ad: new Date().toISOString().slice(0, 10), gold_24k: "", gold_22k: "", silver: "" });

  const load = () => api.get("/rates/history", { params: { days: 90 } }).then((r) => setHistory(r.data.slice().reverse()))
    .catch((err) => { console.error("Rate history load failed:", err); toast.error(apiError(err)); });
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const validationError = validateDailyRateInput(form);
    if (validationError) { toast.error(validationError); return; }
    setSaving(true);
    try {
      await api.post("/admin/rates", { date_ad: form.date_ad, gold_24k: +form.gold_24k, gold_22k: +form.gold_22k, silver: +form.silver });
      toast.success("Rate saved");
      load();
    } catch (err) { toast.error(apiError(err)); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Daily Rates</h1>
      <Card title="Enter Rate (per tola)">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" data-testid="rates-admin-form">
          <F label="Date (AD)"><input className={inp} type="date" value={form.date_ad} onChange={(e) => setForm({ ...form, date_ad: e.target.value })} data-testid="rates-date-input" /></F>
          <F label="24K Gold"><input className={inp} type="number" step="any" value={form.gold_24k} onChange={(e) => setForm({ ...form, gold_24k: e.target.value })} data-testid="rates-gold24-input" /></F>
          <F label="22K Gold"><input className={inp} type="number" step="any" value={form.gold_22k} onChange={(e) => setForm({ ...form, gold_22k: e.target.value })} data-testid="rates-gold22-input" /></F>
          <F label="Silver"><input className={inp} type="number" step="any" value={form.silver} onChange={(e) => setForm({ ...form, silver: e.target.value })} data-testid="rates-silver-input" /></F>
          <button type="submit" className={btnGold} disabled={saving} data-testid="rates-save-btn">{saving ? "Saving…" : "Save Rate"}</button>
        </form>
        <p className="text-xs text-slate-500 mt-2">Enter confirmed shop rates separately for 24K Gold, 22K Gold, and Silver. Jewellery prices also depend on weight, jarti and making charges.</p>
      </Card>
      {history.length > 0 && history[history.length - 1].date_ad < new Date().toISOString().slice(0, 10) && (
        <p role="alert" data-testid="rates-stale-warning" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">The most recent rate is from {history[history.length - 1].date_ad}. Confirm and update today’s shop prices before quoting customers.</p>
      )}
      <Card title="Rate History">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b">
              <th className="py-2">Date AD</th><th>Date BS</th><th>24K Gold</th><th>22K Gold</th><th>Silver</th></tr></thead>
            <tbody data-testid="rates-history-table">
              {history.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2">{r.date_ad}</td>
                  <td>{r.bs_date_np || toNp(r.bs_date || "")}</td>
                  <td>{rs(r.gold_24k)}</td><td>{rs(r.gold_22k)}</td><td>{rs(r.silver)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
