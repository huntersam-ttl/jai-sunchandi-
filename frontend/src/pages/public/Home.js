import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { rs, toNp } from "@/lib/format";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { MessageCircle, ArrowRight, ShieldCheck, Scale, HandCoins } from "lucide-react";
const HERO_IMG = "https://images.unsplash.com/photo-1721103418312-b0057a8c31c2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwzfHxnb2xkJTIwamV3ZWxyeSUyMG5lY2tsYWNlJTIwcHJlbWl1bXxlbnwwfHx8fDE3ODMwMzIzMTR8MA&ixlib=rb-4.1.0&q=85";
export default function Home() {
  const shop = useSettings();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  const [rate, setRate] = useState(null);
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  useEffect(() => {
    api.get("/rates/today").then((r) => setRate(r.data)).catch(() => {});
    api.get("/collections").then((r) => setCollections(r.data)).catch(() => {});
    api.get("/products").then((r) => setProducts(r.data.slice(0, 4))).catch(() => {});
  }, []);
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 fade-up">
            <p className="text-[#991B1B] text-sm tracking-widest uppercase mb-4">{shop.tagline_np} · Since decades</p>
            <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05]">
              Pure Gold. <span className="gold-gradient-text">Pure Trust.</span>
            </h1>
            <p className="mt-3 font-serif-display text-2xl text-slate-700">{shop.shop_name_np}</p>
            <p className="mt-5 text-base text-slate-600 max-w-xl">
              A decades-old family jewellery shop serving generations with honest weight, fair pricing and handcrafted gold & silver ornaments.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/catalogue" data-testid="hero-catalogue-btn"
                className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-6 py-3.5 rounded-md min-h-[48px] hover:bg-slate-800 transition-colors duration-300">
                Browse Catalogue <ArrowRight size={18} />
              </Link>
              <a href={waLink(shop.default_whatsapp_message || `Namaste! I want to enquire about jewellery at ${shop.shop_name}.`)} target="_blank" rel="noreferrer"
                data-testid="hero-whatsapp-btn"
                className="inline-flex items-center gap-2 border border-[#0F172A] px-6 py-3.5 rounded-md min-h-[48px] hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-colors duration-300">
                <MessageCircle size={18} /> WhatsApp Us
              </a>
            </div>
          </div>
          <div className="lg:col-span-5 fade-up" style={{ animationDelay: "150ms" }}>
            {shop.logo ? (
              <img src={shop.logo} alt={shop.shop_name} className="rounded-md w-full h-[320px] lg:h-[420px] object-contain shadow-xl" />
            ) : (
              <img src={HERO_IMG} alt="Gold jewellery" className="rounded-md w-full h-[320px] lg:h-[420px] object-cover shadow-xl" />
            )}
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div data-testid="home-rate-widget" className="bg-[#0F172A] text-white rounded-md p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          <div>
            <p className="text-[#D4AF37] font-serif-display text-lg">आजको दर</p>
            <p className="text-xs text-slate-400">Last updated {rate ? `· ${rate.date_ad}` : ""}</p>
          </div>
          {rate ? (
            <>
              <RateBox label="24K Gold / tola" value={rs(rate.gold_24k)} np={rate.gold_24k_np} testId="today-gold-rate" />
              <RateBox label="Silver / tola" value={rs(rate.silver)} np={rate.silver_np} testId="today-silver-rate" />
            </>
          ) : (
            <p className="sm:col-span-2 text-slate-400 text-sm">Today's rate has not been published yet. Please contact the shop.</p>
          )}
        </div>
        <div className="text-right mt-2">
          <Link to="/rates" className="text-sm text-[#991B1B] hover:text-[#D4AF37]">View 30-day rate history →</Link>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
        <h2 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight">Featured Collections</h2>
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((c) => (
            <Link key={c.id} to={`/catalogue?collection=${encodeURIComponent(c.name)}`}
              data-testid={`collection-card-${c.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="group bg-white border border-slate-200 rounded-md p-6 hover:-translate-y-1 hover:border-[#D4AF37] transition-all duration-300">
              <p className="font-serif-display text-lg">{c.name}</p>
              <p className="text-xs text-slate-500 mt-1 group-hover:text-[#D4AF37]">Explore →</p>
            </Link>
          ))}
        </div>
      </section>
      {products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <div className="flex items-end justify-between">
            <h2 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight">New Arrivals</h2>
            <Link to="/catalogue" className="text-sm text-[#991B1B]">View all →</Link>
          </div>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="bg-white border border-slate-200 rounded-md overflow-hidden hover:-translate-y-1 transition-transform duration-300">
                <img src={p.photos?.[0] || HERO_IMG} alt={p.name} className="h-40 w-full object-cover" />
                <div className="p-3">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.purity} · {p.weight_tola} tola</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 grid sm:grid-cols-3 gap-6">
        {[{ icon: ShieldCheck, t: "Decades of Trust", d: "Family-run shop serving generations with honesty." },
          { icon: Scale, t: "Honest Weight", d: "Accurate tola weight, transparent jarti and jyala." },
          { icon: HandCoins, t: "Old Gold Exchange", d: "Fair valuation for purano sun/chandi satta." }].map((f) => (
          <div key={f.t} className="bg-white border border-slate-200 rounded-md p-6">
            <f.icon className="text-[#D4AF37]" strokeWidth={1.5} />
            <p className="font-semibold mt-3">{f.t}</p>
            <p className="text-sm text-slate-600 mt-1">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
const RateBox = ({ label, value, np, testId }) => (
  <div data-testid={testId}>
    <p className="text-xs text-slate-400">{label}</p>
    <p className="text-xl font-bold text-[#D4AF37]">{value}</p>
    <p className="text-sm text-slate-300">रु. {np}</p>
  </div>
);
