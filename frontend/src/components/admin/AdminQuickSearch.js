import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/format";

const EMPTY = { customers: [], orders: [], repairs: [], products: [] };

const GROUPS = [
  { key: "customers", label: "Customers", to: (r) => `/admin/customers/${r.id}` },
  { key: "orders", label: "Orders", to: (r) => `/admin/orders/${r.id}` },
  { key: "repairs", label: "Repairs", to: () => "/admin/repairs" },
  { key: "products", label: "Products", to: () => "/admin/products" },
];

function ResultRow({ group, r }) {
  if (group === "customers") {
    return <><span className="font-medium">{r.name}</span><span className="text-slate-400"> · {r.phone}</span></>;
  }
  if (group === "orders") {
    return (
      <span className="flex items-center justify-between gap-2 w-full">
        <span><span className="font-medium">{r.order_number}</span><span className="text-slate-400"> · {r.customer_name}</span>{r.delivery_date_ad && <span className="text-slate-400"> · {r.delivery_date_ad}</span>}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize shrink-0 ${STATUS_COLORS[r.status] || ""}`}>{r.status?.replace("_", " ")}</span>
      </span>
    );
  }
  if (group === "repairs") {
    return (
      <span className="flex items-center justify-between gap-2 w-full">
        <span><span className="font-medium">{r.repair_number}</span><span className="text-slate-400"> · {r.customer_name}</span>{r.promised_date_ad && <span className="text-slate-400"> · {r.promised_date_ad}</span>}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize shrink-0 ${STATUS_COLORS[r.status] || ""}`}>{r.status?.replace("_", " ")}</span>
      </span>
    );
  }
  // products
  return <><span className="font-medium">{r.product_code}</span><span className="text-slate-400"> · {r.name}</span></>;
}

export default function AdminQuickSearch() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  useEffect(() => {
    const trimmed = qInput.trim();
    if (!trimmed) { setResults(null); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      setQ(trimmed);
      api.get("/admin/search", { params: { q: trimmed } })
        .then((r) => setResults(r.data))
        .catch(() => setResults(EMPTY))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const go = (path) => {
    setOpen(false);
    setQInput("");
    setResults(null);
    navigate(path);
  };

  const hasAnyResults = results && GROUPS.some((g) => results[g.key]?.length > 0);

  return (
    <div className="relative flex-1 max-w-md" ref={boxRef} data-testid="admin-quick-search">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={qInput}
        onChange={(e) => setQInput(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search customer, phone, order or repair…"
        data-testid="admin-quick-search-input"
        className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
      />
      {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
      {!loading && qInput && (
        <button onClick={() => { setQInput(""); setResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" data-testid="admin-quick-search-clear">
          <X size={14} />
        </button>
      )}

      {open && q && results && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-[70vh] overflow-y-auto text-sm" data-testid="admin-quick-search-results">
          {!hasAnyResults && !loading && (
            <p className="p-4 text-slate-400 text-center" data-testid="admin-quick-search-empty">No results found.</p>
          )}
          {GROUPS.map((g) => {
            const rows = results[g.key] || [];
            if (rows.length === 0) return null;
            return (
              <div key={g.key} className="border-b border-slate-50 last:border-0">
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">{g.label}</p>
                {rows.map((r) => (
                  <button key={r.id} onClick={() => go(g.to(r))} data-testid={`admin-quick-search-result-${g.key}`}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center">
                    <ResultRow group={g.key} r={r} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
