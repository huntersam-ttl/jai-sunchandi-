import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { api, apiError } from "@/lib/api";
import { toNp } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { inp, btnGold, btnGhost, F } from "@/components/admin/ui";
import { Plus, X, Printer, QrCode } from "lucide-react";

const EMPTY = { product_id: "", metal: "gold", purity: "24K", weight_grams: "", stone_details: "", date_ad: new Date().toISOString().slice(0, 10) };

export default function Certificates() {
  const [certs, setCerts] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [printing, setPrinting] = useState(null);

  const shop = useSettings();
  const load = () => api.get("/admin/certificates").then((r) => setCerts(r.data));
  useEffect(() => { load(); api.get("/admin/products").then((r) => setProducts(r.data)); }, []);

  const save = async () => {
    if (!form.weight_grams) return toast.error("Weight required");
    try {
      await api.post("/admin/certificates", { ...form, product_id: form.product_id || null, weight_grams: +form.weight_grams });
      toast.success("Certificate created");
      setForm(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Certificates</h1>
        <button className={btnGold} onClick={() => setForm({ ...EMPTY })} data-testid="add-certificate-btn"><Plus size={16} /> New Certificate</button>
      </div>
      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b">
            <th className="p-3">Certificate No.</th><th>Metal / Purity</th><th>Weight</th><th>Date</th><th></th></tr></thead>
          <tbody data-testid="certificates-table">
            {certs.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3 font-semibold">{c.certificate_number}</td>
                <td className="capitalize">{c.metal} {c.purity}</td>
                <td>{c.weight_tola} tola / {c.weight_grams} g</td>
                <td>{c.date_ad}<br /><span className="text-xs text-slate-400">BS {c.date_bs_np}</span></td>
                <td><button className={btnGhost} onClick={() => setPrinting(c)} data-testid={`print-cert-${c.certificate_number}`}><QrCode size={14} /> View/Print</button></td>
              </tr>
            ))}
            {certs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No certificates yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-md w-full max-w-lg p-5" data-testid="certificate-form-modal">
            <div className="flex justify-between mb-4"><h2 className="font-bold">New Certificate</h2><button onClick={() => setForm(null)}><X size={18} /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Linked Product (optional)" className="col-span-2">
                <select className={inp} value={form.product_id} onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  setForm(p ? { ...form, product_id: p.id, metal: p.metal, purity: p.purity, weight_grams: p.weight_grams } : { ...form, product_id: "" });
                }} data-testid="cert-product-select">
                  <option value="">— none —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.product_code})</option>)}
                </select>
              </F>
              <F label="Metal"><select className={inp} value={form.metal} onChange={(e) => setForm({ ...form, metal: e.target.value })} data-testid="cert-metal-select"><option value="gold">Gold</option><option value="silver">Silver</option></select></F>
              <F label="Purity"><select className={inp} value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} data-testid="cert-purity-select">{["24K", "22K", "18K", "silver"].map((p) => <option key={p}>{p}</option>)}</select></F>
              <F label="Weight (grams)"><input className={inp} type="number" step="any" value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: e.target.value })} data-testid="cert-weight-input" /></F>
              <F label="Date (AD)"><input type="date" className={inp} value={form.date_ad} onChange={(e) => setForm({ ...form, date_ad: e.target.value })} data-testid="cert-date-input" /></F>
              <F label="Stone details" className="col-span-2"><input className={inp} value={form.stone_details} onChange={(e) => setForm({ ...form, stone_details: e.target.value })} data-testid="cert-stones-input" /></F>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
              <button className={btnGold} onClick={save} data-testid="cert-save-btn">Create</button>
            </div>
          </div>
        </div>
      )}

      {printing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setPrinting(null)}>
          <div className="bg-white rounded-md w-full max-w-md my-8" onClick={(e) => e.stopPropagation()} data-testid="certificate-print-modal">
            <div className="print-area border-4 border-double border-[#D4AF37] m-4 p-6 text-center">
              <p className="font-serif-display text-lg font-bold">{shop.shop_name}</p>
              <p className="text-[#991B1B] text-sm">{shop.shop_name_np}</p>
              <p className="mt-3 font-serif-display text-xl gold-gradient-text font-bold">Certificate of Authenticity</p>
              <p className="text-xs text-slate-500">प्रमाणपत्र</p>
              <div className="mt-4 text-sm text-left space-y-1.5">
                {[["Certificate No.", printing.certificate_number],
                  ["Metal", printing.metal], ["Purity", printing.purity],
                  ["Weight", `${printing.weight_tola} tola / ${printing.weight_grams} g (${toNp(printing.weight_tola)} तोला)`],
                  ["Stones", printing.stone_details || "—"],
                  ["Date", `${printing.date_ad} · BS ${printing.date_bs_np}`]].map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">{l}</span><b className="capitalize">{v}</b></div>
                ))}
              </div>
              <div className="mt-5 flex justify-center">
                <QRCodeSVG value={`${window.location.origin}/verify/certificate/${printing.id}`} size={90} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Scan to verify · प्रमाणीकरण गर्न स्क्यान गर्नुहोस्</p>
            </div>
            <div className="p-4 flex justify-end gap-2 no-print">
              <button className={btnGhost} onClick={() => window.print()} data-testid="cert-print-btn"><Printer size={14} /> Print</button>
              <button className={btnGhost} onClick={() => setPrinting(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
