import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { rs, primaryProductPhoto } from "@/lib/format";
import { OptimizedImage } from "@/components/OptimizedImage";
import { EmptyState, ProductSkeletonGrid } from "@/components/PublicPolish";
import { useSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { MessageCircle } from "lucide-react";

export default function Catalogue() {
  const shop = useSettings();
  useDocumentMeta(
    `Catalogue – ${shop.shop_name || "Jai Supa Deurali Sun-Chandi Pasal"}`,
    "Browse our gold and silver jewellery catalogue — bridal sets, daily wear, festival jewellery, and more."
  );
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
    api.get("/products", { params: p })
      .then((r) => { setProducts(r.data); setFailed(false); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
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
    <div className="brand-shell py-12 sm:py-16">
      <p className="brand-eyebrow">Browse jewellery</p>
      <h1 className="font-serif-display text-4xl sm:text-6xl font-bold tracking-tight ornament-line mt-3">Catalogue</h1>
      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#5F5147]">
        Explore available gold and silver designs from the shop. Prices are estimates from the published rate and are confirmed at the counter.
      </p>
      <div className="brand-card mt-8 flex flex-wrap gap-3 rounded-md p-3">
        <Select label="Metal" k="metal" options={[{ value: "gold", label: "Gold" }, { value: "silver", label: "Silver" }]} />
        <Select label="Category" k="category" options={categories.map((c) => ({ value: c.name, label: c.name }))} />
        <Select label="Collection" k="collection" options={collections.map((c) => ({ value: c.name, label: c.name }))} />
        <Select label="Availability" k="availability" options={[{ value: "available", label: "Available" }, { value: "reserved", label: "Reserved" }]} />
      </div>

      {loading ? <ProductSkeletonGrid count={4} /> : failed ? (
        <div className="mt-8">
          <EmptyState title="Catalogue could not load">
            Please refresh the page or contact the shop for available designs.
          </EmptyState>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8" data-testid="catalogue-empty">
          <EmptyState
            title="Products coming soon"
            action={<a href="/contact" className="text-sm font-semibold text-[#8F1D18] hover:text-[#C99A3D]">Visit the shop or WhatsApp us for available designs</a>}
          >
            The online catalogue will show jewellery here once the shop adds product photos and details.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="catalogue-grid">
          {products.map((p, i) => (
            <Link key={p.id} to={`/product/${p.id}`} data-testid={`product-card-${p.product_code}`}
              className="group brand-card rounded-md overflow-hidden hover:-translate-y-1 hover:border-[#C99A3D] transition-all duration-300 fade-up"
              style={{ animationDelay: `${i * 40}ms` }}>
              <OptimizedImage
                src={primaryProductPhoto(p)}
                alt={p.name}
                className="aspect-[4/5] h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
                widths={[240, 360, 520]}
                sizes="(min-width: 1024px) 25vw, 50vw"
                loading="lazy"
              />
              <div className="p-3">
                <p className="font-serif-display text-lg font-semibold leading-tight truncate">{p.name}</p>
                <p className="text-[11px] text-[#8F1D18] font-mono mt-1">{p.product_code}</p>
                <p className="text-xs text-[#6B5E55] mt-1 capitalize">{p.metal} · {p.purity} · {p.weight_tola} tola</p>
                <p className="text-sm mt-2 font-bold text-[#8F1D18]">
                  {p.estimated_price ? `${rs(p.estimated_price)}*` : "Inquire for today's price"}
                </p>
                <span className={`inline-block mt-3 text-[11px] px-2 py-0.5 rounded-full ${p.status === "available" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {p.status}
                </span>
                <span className="mt-3 hidden items-center gap-1 text-[11px] font-semibold text-[#25D366] sm:flex"><MessageCircle size={13} /> Enquire from detail page</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-slate-400">* Estimated from today's rate. Final price confirmed at shop.</p>
    </div>
  );
}
