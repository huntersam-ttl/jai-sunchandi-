import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { api, apiError } from "@/lib/api";
import { rs, compressImage, STATUS_COLORS, gramsToTola, tolaToGrams, PURITY_FACTORS, GRAMS_PER_TOLA } from "@/lib/format";
import { inp, btnGold, btnGhost, Badge, F } from "@/components/admin/ui";
import { Plus, Pencil, Trash2, QrCode, X, Printer } from "lucide-react";

const EMPTY = {
  name: "", name_np: "", description: "", category: "", collection: "", metal: "gold", purity: "24K",
  weight_mode: "tola", tola: "", lal: "", aana: "", grams: "",
  jarti_percent: 0, jyala_amount: 0, jyala_type: "flat", stone_cost: 0, polishing_cost: 0,
  cutting_cost: 0, worker_charge: 0, other_cost: 0, status: "available",
  show_on_website: true, show_price_on_website: true, photos: [],
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [cols, setCols] = useState([]);
  const [rate, setRate] = useState(null);
  const [editing, setEditing] = useState(null);
  const [qrProduct, setQrProduct] = useState(null);
  const [q, setQ] = useState("");

  const load = () => api.get("/admin/products").then((r) => setProducts(r.data));
  useEffect(() => {
    load();
    api.get("/categories").then((r) => setCats(r.data));
    api.get("/collections").then((r) => setCols(r.data));
    api.get("/rates/today").then((r) => setRate(r.data));
  }, []);

  const del = async (p) => {
    if (!window.confirm(`Soft-delete ${p.name}?`)) return;
    await api.delete(`/admin/products/${p.id}`);
    toast.success("Product removed");
    load();
  };

  const filtered = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.product_code.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex gap-2">
          <input className={inp} style={{ width: 200 }} placeholder="Search name/code…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="products-search-input" />
          <button className={btnGold} onClick={() => setEditing({ ...EMPTY })} data-testid="add-product-btn"><Plus size={16} /> Add Product</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b">
            <th className="p-3">Product</th><th>Metal/Purity</th><th>Weight</th><th>Live Price</th><th>Status</th><th>Website</th><th></th></tr></thead>
          <tbody data-testid="products-table">
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {p.photos?.[0] && <img src={p.photos[0]} alt="" className="h-9 w-9 rounded object-cover" />}
                    <div><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-400">{p.product_code}</p></div>
                  </div>
                </td>
                <td className="capitalize">{p.metal} {p.purity}</td>
                <td>{p.weight_tola} tola<br /><span className="text-xs text-slate-400">{p.weight_grams} g</span></td>
                <td className="font-semibold">{p.live_price ? rs(p.live_price.total_price) : "—"}</td>
                <td><Badge status={p.status} colors={STATUS_COLORS} /></td>
                <td className="text-xs">{p.show_on_website ? "✓ shown" : "hidden"}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setQrProduct(p)} data-testid={`qr-product-${p.product_code}`}><QrCode size={16} /></button>
                    <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setEditing(toForm(p))} data-testid={`edit-product-${p.product_code}`}><Pencil size={16} /></button>
                    <button className="p-2 hover:bg-red-50 text-red-600 rounded" onClick={() => del(p)} data-testid={`delete-product-${p.product_code}`}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No products yet. Add your first product.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <ProductForm form={editing} setForm={setEditing} cats={cats} cols={cols} rate={rate} onSaved={() => { setEditing(null); load(); }} />}
      {qrProduct && <QrModal product={qrProduct} onClose={() => setQrProduct(null)} />}
    </div>
  );
}

const toForm = (p) => ({ ...EMPTY, ...p, weight_mode: "grams", grams: p.weight_grams, tola: "", lal: "", aana: "" });

function ProductForm({ form, setForm, cats, cols, rate, onSaved }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const isEdit = !!form.id;

  const grams = form.weight_mode === "grams"
    ? +form.grams || 0
    : tolaToGrams((+form.tola || 0) + (+form.aana || 0) / 16 + (+form.lal || 0) / 100);

  const preview = useMemo(() => {
    if (!rate || grams <= 0) return null;
    const rpt = form.metal === "gold" ? rate.gold_24k : rate.silver;
    const tola = grams / GRAMS_PER_TOLA;
    const metal = tola * rpt * (PURITY_FACTORS[form.purity] || 1);
    const jarti = metal * (+form.jarti_percent || 0) / 100;
    const jyala = form.jyala_type === "per_tola" ? (+form.jyala_amount || 0) * tola : +form.jyala_amount || 0;
    const total = metal + jarti + jyala + (+form.stone_cost || 0) + (+form.polishing_cost || 0) + (+form.cutting_cost || 0) + (+form.worker_charge || 0) + (+form.other_cost || 0);
    return { metal, jarti, jyala, total };
  }, [form, grams, rate]);

  const onPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    setForm({ ...form, photos: [...(form.photos || []), ...compressed] });
  };

  const save = async () => {
    if (!form.name) return toast.error("Name is required");
    if (grams <= 0) return toast.error("Enter a valid weight");
    const body = {
      name: form.name, name_np: form.name_np, description: form.description,
      category: form.category, collection: form.collection, metal: form.metal, purity: form.purity,
      weight: form.weight_mode === "grams" ? { grams: +form.grams } : { tola: +form.tola || 0, lal: +form.lal || 0, aana: +form.aana || 0 },
      jarti_percent: +form.jarti_percent || 0, jyala_amount: +form.jyala_amount || 0, jyala_type: form.jyala_type,
      stone_cost: +form.stone_cost || 0, polishing_cost: +form.polishing_cost || 0, cutting_cost: +form.cutting_cost || 0,
      worker_charge: +form.worker_charge || 0, other_cost: +form.other_cost || 0,
      status: form.status, show_on_website: !!form.show_on_website, show_price_on_website: !!form.show_price_on_website,
      photos: form.photos || [],
    };
    try {
      if (isEdit) await api.put(`/admin/products/${form.id}`, body);
      else await api.post("/admin/products", body);
      toast.success(isEdit ? "Product updated" : "Product added");
      onSaved();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-md w-full max-w-3xl my-6" data-testid="product-form-modal">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h2 className="font-bold">{isEdit ? `Edit ${form.product_code}` : "Add Product"}</h2>
          <button onClick={() => setForm(null)} data-testid="product-form-close"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <F label="Name *" className="sm:col-span-2"><input className={inp} value={form.name} onChange={set("name")} data-testid="pf-name" /></F>
          <F label="Nepali Name"><input className={inp} value={form.name_np} onChange={set("name_np")} data-testid="pf-name-np" /></F>
          <F label="Category"><select className={inp} value={form.category} onChange={set("category")} data-testid="pf-category"><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></F>
          <F label="Collection"><select className={inp} value={form.collection} onChange={set("collection")} data-testid="pf-collection"><option value="">—</option>{cols.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></F>
          <F label="Status"><select className={inp} value={form.status} onChange={set("status")} data-testid="pf-status">{["available", "reserved", "sold", "inactive"].map((s) => <option key={s}>{s}</option>)}</select></F>
          <F label="Metal"><select className={inp} value={form.metal} onChange={(e) => setForm({ ...form, metal: e.target.value, purity: e.target.value === "silver" ? "silver" : "24K" })} data-testid="pf-metal"><option value="gold">Gold</option><option value="silver">Silver</option></select></F>
          <F label="Purity"><select className={inp} value={form.purity} onChange={set("purity")} data-testid="pf-purity">{(form.metal === "silver" ? ["silver"] : ["24K", "22K", "18K"]).map((p) => <option key={p}>{p}</option>)}</select></F>
          <F label="Weight Input">
            <select className={inp} value={form.weight_mode} onChange={set("weight_mode")} data-testid="pf-weight-mode">
              <option value="tola">Tola / Lal / Aana</option><option value="grams">Grams</option>
            </select>
          </F>
          {form.weight_mode === "grams" ? (
            <F label="Weight (grams)"><input className={inp} type="number" step="any" value={form.grams} onChange={set("grams")} data-testid="pf-grams" /></F>
          ) : (
            <>
              <F label="Tola"><input className={inp} type="number" step="any" value={form.tola} onChange={set("tola")} data-testid="pf-tola" /></F>
              <F label="Lal"><input className={inp} type="number" step="any" value={form.lal} onChange={set("lal")} data-testid="pf-lal" /></F>
              <F label="Aana"><input className={inp} type="number" step="any" value={form.aana} onChange={set("aana")} data-testid="pf-aana" /></F>
            </>
          )}
          <div className="sm:col-span-3 text-xs bg-slate-50 rounded p-2" data-testid="pf-weight-preview">
            = <b>{grams.toFixed(3)} g</b> · <b>{gramsToTola(grams)} tola</b>
          </div>
          <F label="Jarti %"><input className={inp} type="number" step="any" value={form.jarti_percent} onChange={set("jarti_percent")} data-testid="pf-jarti" /></F>
          <F label="Jyala (making charge)"><input className={inp} type="number" step="any" value={form.jyala_amount} onChange={set("jyala_amount")} data-testid="pf-jyala" /></F>
          <F label="Jyala Type"><select className={inp} value={form.jyala_type} onChange={set("jyala_type")} data-testid="pf-jyala-type"><option value="flat">Flat</option><option value="per_tola">Per Tola</option></select></F>
          <F label="Stone Cost"><input className={inp} type="number" step="any" value={form.stone_cost} onChange={set("stone_cost")} data-testid="pf-stone" /></F>
          <F label="Polishing Cost"><input className={inp} type="number" step="any" value={form.polishing_cost} onChange={set("polishing_cost")} data-testid="pf-polishing" /></F>
          <F label="Cutting Cost"><input className={inp} type="number" step="any" value={form.cutting_cost} onChange={set("cutting_cost")} data-testid="pf-cutting" /></F>
          <F label="Worker Charge"><input className={inp} type="number" step="any" value={form.worker_charge} onChange={set("worker_charge")} data-testid="pf-worker" /></F>
          <F label="Other Cost"><input className={inp} type="number" step="any" value={form.other_cost} onChange={set("other_cost")} data-testid="pf-other" /></F>
          <F label="Description" className="sm:col-span-3"><textarea rows={2} className={inp} value={form.description} onChange={set("description")} data-testid="pf-description" /></F>
          <div className="sm:col-span-3 flex flex-wrap gap-6 items-center">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.show_on_website} onChange={set("show_on_website")} data-testid="pf-show-website" /> Show on website</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.show_price_on_website} onChange={set("show_price_on_website")} data-testid="pf-show-price" /> Show price on website</label>
          </div>
          <F label="Photos (auto-compressed)" className="sm:col-span-3">
            <input type="file" accept="image/*" multiple onChange={onPhotos} className="text-sm" data-testid="pf-photos" />
            <div className="flex gap-2 mt-2 flex-wrap">
              {(form.photos || []).map((ph, i) => (
                <div key={i} className="relative">
                  <img src={ph} alt="" className="h-16 w-16 rounded object-cover border" />
                  <button className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5" onClick={() => setForm({ ...form, photos: form.photos.filter((_, j) => j !== i) })}><X size={11} /></button>
                </div>
              ))}
            </div>
          </F>
          {preview && (
            <div className="sm:col-span-3 bg-[#FDFCF8] border border-[#D4AF37]/40 rounded p-3 text-sm" data-testid="pf-price-preview">
              <p className="font-semibold text-xs text-slate-500 mb-1">Live price at today's rate</p>
              Metal {rs(preview.metal)} + Jarti {rs(preview.jarti)} + Jyala {rs(preview.jyala)} + costs = <b className="text-[#991B1B]">{rs(preview.total)}</b>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
          <button className={btnGold} onClick={save} data-testid="pf-save-btn">{isEdit ? "Update Product" : "Save Product"}</button>
        </div>
      </div>
    </div>
  );
}

function QrModal({ product, onClose }) {
  const url = `${window.location.origin}/product/${product.id}`;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-md p-6 text-center" onClick={(e) => e.stopPropagation()} data-testid="product-qr-modal">
        <div className="print-area border border-dashed border-slate-300 p-4 rounded inline-block">
          <QRCodeSVG value={url} size={140} />
          <p className="text-xs font-bold mt-2">{product.product_code}</p>
          <p className="text-[10px] text-slate-500 capitalize">{product.metal} {product.purity} · {product.weight_tola} tola</p>
        </div>
        <div className="mt-4 flex gap-2 justify-center no-print">
          <button className={btnGhost} onClick={() => window.print()} data-testid="print-qr-btn"><Printer size={14} /> Print Tag</button>
          <button className={btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
