import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { matchesProductQuery } from "@/lib/merchandising";
import { PublicProductCard } from "@/components/PublicProductCard";
import { EmptyState, ProductSkeletonGrid } from "@/components/PublicPolish";
import { useSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { PUBLIC_BRAND_NAME } from "@/lib/brand";

export default function Catalogue() {
  const shop = useSettings();
  useDocumentMeta(
    `Catalogue – ${PUBLIC_BRAND_NAME}`,
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
    q: params.get("q") || "",
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

  const clearFilters = () => setParams(new URLSearchParams());
  const visibleProducts = products.filter((product) => matchesProductQuery(product, filters.q));

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
        <label className="flex min-h-[44px] flex-1 basis-full items-center rounded-md border border-slate-200 bg-white px-3 sm:basis-56"><span className="sr-only">Search catalogue</span><input value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Search designs, code or metal" className="w-full bg-transparent text-sm outline-none" data-testid="catalogue-search" /></label>
        <Select label="Metal" k="metal" options={[{ value: "gold", label: "Gold" }, { value: "silver", label: "Silver" }]} />
        <Select label="Category" k="category" options={categories.map((c) => ({ value: c.name, label: c.name }))} />
        <Select label="Collection" k="collection" options={collections.map((c) => ({ value: c.name, label: c.name }))} />
        <Select label="Availability" k="availability" options={[{ value: "available", label: "Available" }, { value: "reserved", label: "Reserved" }]} />
        {(filters.q || filters.metal || filters.category || filters.collection || filters.availability) && <button type="button" onClick={clearFilters} className="min-h-[44px] rounded-md px-3 text-sm font-semibold text-[#5B0D18] hover:bg-[#F7F1E6]">Clear filters</button>}
      </div>

      {loading ? <ProductSkeletonGrid count={4} /> : failed ? (
        <div className="mt-8">
          <EmptyState title="Catalogue could not load">
            Please refresh the page or contact the shop for available designs.
          </EmptyState>
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="mt-8" data-testid="catalogue-empty">
          <EmptyState
            title="Products coming soon"
            action={<a href="/contact" className="text-sm font-semibold text-[#5B0D18] hover:text-[#D4AF37]">Visit the shop or WhatsApp us for available designs</a>}
          >
            The online catalogue will show jewellery here once the shop adds product photos and details.
          </EmptyState>
        </div>
      ) : (
        <>
        <div className="mb-3 text-xs text-slate-500" data-testid="catalogue-count">Showing {visibleProducts.length} design{visibleProducts.length === 1 ? "" : "s"}</div>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="catalogue-grid">
          {visibleProducts.map((product, index) => <PublicProductCard key={product.id} product={product} index={index} />)}
        </div>
        </>
      )}
      <p className="mt-6 text-xs text-slate-400">* Estimated from today's rate. Final price confirmed at shop.</p>
    </div>
  );
}
