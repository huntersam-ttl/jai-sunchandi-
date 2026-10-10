import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { matchesProductQuery } from "@/lib/merchandising";
import { PublicProductCard } from "@/components/PublicProductCard";
import { EmptyState, ProductSkeletonGrid } from "@/components/PublicPolish";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { PUBLIC_BRAND_NAME } from "@/lib/brand";

export default function Catalogue() {
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = {
    metal: params.get("metal") || "",
    category: params.get("category") || "",
    collection: params.get("collection") || "",
    availability: params.get("availability") || "",
    q: params.get("q") || "",
  };

  useEffect(() => {
    let active = true;
    api.get("/categories").then((r) => { if (active) setCategories(r.data); }).catch(() => {});
    api.get("/collections").then((r) => { if (active) setCollections(r.data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Search is local: changing one letter should not issue another server request.
  // Cancel stale filter requests so older responses cannot replace newer results.
  const serverFilters = params.toString().split("&").filter((part) => !part.startsWith("q=")).join("&");
  useEffect(() => {
    const controller = new AbortController();
    const serverParams = new URLSearchParams(serverFilters);
    setLoading(true);
    setFailed(false);
    api.get("/products", { params: Object.fromEntries(serverParams), signal: controller.signal })
      .then((r) => { if (!controller.signal.aborted) setProducts(r.data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [serverFilters]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => setParams(new URLSearchParams());
  const visibleProducts = products.filter((product) => matchesProductQuery(product, filters.q));
  const activeFilterCount = ["metal", "category", "collection", "availability"].filter((key) => Boolean(filters[key])).length;

  const Select = ({ label, k, options }) => (
    <select value={filters[k]} onChange={(e) => setFilter(k, e.target.value)} data-testid={`filter-${k}`}
      className="w-full min-h-[44px] rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm sm:w-auto">
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
      <div className="brand-card mt-8 rounded-md p-3 sm:p-4" role="search" aria-label="Search jewellery catalogue">
        <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-[44px] flex-1 basis-full items-center rounded-md border border-slate-200 bg-white px-3 sm:basis-56"><span className="sr-only">Search catalogue</span><input value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Search designs, code or metal" className="w-full min-w-0 bg-transparent py-3 text-base outline-none sm:text-sm" data-testid="catalogue-search" /></label>
        <button type="button" className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-[#D4AF37]/40 bg-[#FFFDF7] px-4 text-sm font-semibold text-[#5B0D18] sm:hidden" aria-expanded={mobileFiltersOpen} aria-controls="catalogue-advanced-filters" onClick={() => setMobileFiltersOpen((open) => !open)} data-testid="catalogue-mobile-filter-toggle">Filters{activeFilterCount ? ` (${activeFilterCount})` : ""} <span aria-hidden="true" className="ml-2">{mobileFiltersOpen ? "−" : "+"}</span></button>
        </div>
        <div id="catalogue-advanced-filters" className={`${mobileFiltersOpen ? "flex" : "hidden"} mt-3 flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap`}>
        <Select label="Metal" k="metal" options={[{ value: "gold", label: "Gold" }, { value: "silver", label: "Silver" }]} />
        <Select label="Category" k="category" options={categories.map((c) => ({ value: c.name, label: c.name }))} />
        <Select label="Collection" k="collection" options={collections.map((c) => ({ value: c.name, label: c.name }))} />
        <Select label="Availability" k="availability" options={[{ value: "available", label: "Available" }, { value: "reserved", label: "Reserved" }]} />
        {(filters.q || filters.metal || filters.category || filters.collection || filters.availability) && <button type="button" onClick={clearFilters} className="min-h-[44px] rounded-md px-3 text-sm font-semibold text-[#5B0D18] hover:bg-[#F7F1E6]">Clear filters</button>}
        </div>
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
            title={filters.q || activeFilterCount ? "No matching jewellery" : "Products coming soon"}
            action={<a href="/contact" className="text-sm font-semibold text-[#5B0D18] hover:text-[#D4AF37]">Visit the shop or WhatsApp us for available designs</a>}
          >
            {filters.q || activeFilterCount ? "Try a different search or clear the filters to see more designs." : "The online catalogue will show jewellery here once the shop adds product photos and details."}
          </EmptyState>
        </div>
      ) : (
        <>
        <div className="mt-6 mb-3 text-xs text-slate-500" aria-live="polite" data-testid="catalogue-count">Showing {visibleProducts.length} design{visibleProducts.length === 1 ? "" : "s"}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" data-testid="catalogue-grid">
          {visibleProducts.map((product, index) => <PublicProductCard key={product.id} product={product} index={index} />)}
        </div>
        </>
      )}
      <p className="mt-6 text-xs text-slate-400">* Where shown, prices are estimates. The shop confirms final prices and availability before any purchase. No online checkout or payment is offered.</p>
    </div>
  );
}
