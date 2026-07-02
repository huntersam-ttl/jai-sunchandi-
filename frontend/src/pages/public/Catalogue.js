import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";

const FALLBACK = "https://images.unsplash.com/photo-1721034917345-d17c5405ead0?crop=entropy&cs=srgb&fm=jpg&q=85&w=600";

export default function Catalogue() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  const filters = {
    metal: params.get("metal") || "",
    category: params.get("category") || "",
    collection: params.get("collection") || "",
    availability: params.get("availability") || "",
  };

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data));
    api.get("/collections").then((r) => setCollections(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.get("/products", { params: p }).then((r) => { setProducts(r.data); setLoading(false); });
  }, [params]); // eslint-disable-line

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  const Select = ({ label, k, options }) => (
    <select value={filters[k]} onChange={(e) => setFilter(k, e.target.value)} data-testid={`filter-${k}`}
      className="border border-slate-200 rounded-md px-3 py-2.5 text-sm bg-white min-h-[44px]">
      <option value="">{label}: All</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl font-bold tracking-tighter">Catalogue</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <Select label="Metal" k="metal" options={[{ value: "gold", label: "Gold" }, { value: "silver", label: "Silver" }]} />
        <Select label="Category" k="category" options={categories.map((c) => ({ value: c.name, label: c.name }))} />
        <Select label="Collection" k="collection" options={collections.map((c) => ({ value: c.name, label: c.name }))} />
        <Select label="Availability" k="availability" options={[{ value: "available", label: "Available" }, { value: "reserved", label: "Reserved" }]} />
      </div>

      {loading ? <p className="mt-10 text-slate-500">Loading…</p> : products.length === 0 ? (
        <p className="mt-10 text-slate-500" data-testid="catalogue-empty">No products found. Try different filters or contact us on WhatsApp.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="catalogue-grid">
          {products.map((p, i) => (
            <Link key={p.id} to={`/product/${p.id}`} data-testid={`product-card-${p.product_code}`}
              className="bg-white border border-slate-200 rounded-md overflow-hidden hover:-translate-y-1 hover:border-[#D4AF37] transition-all duration-300 fade-up"
              style={{ animationDelay: `${i * 40}ms` }}>
              <img src={p.photos?.[0] || FALLBACK} alt={p.name} className="h-44 w-full object-cover" loading="lazy" />
              <div className="p-3">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">{p.metal} · {p.purity} · {p.weight_tola} tola</p>
                <p className="text-sm mt-1.5 font-semibold text-[#991B1B]">
                  {p.estimated_price ? `${rs(p.estimated_price)}*` : "Inquire for today's price"}
                </p>
                <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full ${p.status === "available" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-slate-400">* Estimated from today's rate. Final price confirmed at shop.</p>
    </div>
  );
}
