import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { rs, primaryProductPhoto } from "@/lib/format";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import {
  MessageCircle, ArrowRight, ShieldCheck, Scale, HandCoins, Sparkles,
  Wrench, Gem, Camera, Star, ImageOff,
} from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1721103418312-b0057a8c31c2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwzfHxnb2xkJTIwamV3ZWxyeSUyMG5lY2tsYWNlJTIwcHJlbWl1bXxlbnwwfHx8fDE3ODMwMzIzMTR8MA&ixlib=rb-4.1.0&q=85";
const STORY_IMG = "https://images.unsplash.com/photo-1613966561243-c6959a886009?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

// Short, natural descriptions for the collection names this shop typically
// runs (Bridal / Daily Wear / Festival / Dashain-Tihar / Wedding Set / Silver
// Collection). Falls back to a generic line for anything else the admin adds.
const COLLECTION_INFO = {
  bridal: "Complete bridal sets crafted for the big day — necklace, earrings, and tikka to match.",
  "daily wear": "Light, comfortable gold pieces you can wear every day without a second thought.",
  festival: "Festive designs for Teej, Dashain and every celebration in between.",
  "dashain/tihar": "Special pieces and gifting sets for Dashain and Tihar season.",
  "dashain tihar": "Special pieces and gifting sets for Dashain and Tihar season.",
  "wedding set": "Full wedding sets for the bride, groom's family, and everyone in the baraat.",
  "silver collection": "Silver ornaments and puja items — daily wear and traditional pieces alike.",
};
function collectionDescription(name) {
  return COLLECTION_INFO[(name || "").trim().toLowerCase()] || "Explore this collection in our catalogue.";
}

const SERVICES = [
  { icon: Scale, t: "Honest Weight", d: "Every piece is weighed in front of you on a calibrated scale — no surprises at billing." },
  { icon: ShieldCheck, t: "Transparent Jarti & Jyala", d: "Making charges (jyala) and purity deduction (jarti) are explained clearly before you buy, not hidden in the total." },
  { icon: HandCoins, t: "Old Gold Exchange", d: "Fair valuation for your purano sun-chandi (old gold/silver) toward a new purchase, checked and explained on the spot." },
  { icon: Sparkles, t: "Custom Orders", d: "Bring a design, a photo, or an idea — we craft gold and silver ornaments to your exact requirement." },
  { icon: Wrench, t: "Repairs", d: "Broken clasps, resizing, polishing, and repairs handled with care by experienced karigars." },
  { icon: Gem, t: "Gold & Silver Ornaments", d: "From daily-wear rings to full bridal sets — a wide range of handcrafted gold and silver jewellery." },
];

export default function Home() {
  const shop = useSettings();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  const heroWaLink = waLink(shop.default_whatsapp_message || `Namaste! I want to enquire about jewellery at ${shop.shop_name}.`);
  const [rate, setRate] = useState(null);
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  useDocumentMeta(
    `${shop.shop_name || "Jai Supa Deurali Sun-Chandi Pasal"} – Gold & Silver Jewellery Shop in Nepal`,
    "A family-run gold and silver jewellery shop in Nepal offering honest weight, transparent jarti and jyala, old gold exchange, custom gold ornaments, and jewellery repair. Sun-chandi pasal serving generations with trust."
  );
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
              A decades-old family jewellery shop serving generations with honest weight, fair pricing and handcrafted gold & silver ornaments — your trusted Nepali sun-chandi pasal.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/catalogue" data-testid="hero-catalogue-btn"
                className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-6 py-3.5 rounded-md min-h-[48px] hover:bg-slate-800 transition-colors duration-300">
                Browse Catalogue <ArrowRight size={18} />
              </Link>
              {heroWaLink && (
                <a href={heroWaLink} target="_blank" rel="noreferrer"
                  data-testid="hero-whatsapp-btn"
                  className="inline-flex items-center gap-2 border border-[#0F172A] px-6 py-3.5 rounded-md min-h-[48px] hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-colors duration-300">
                  <MessageCircle size={18} /> WhatsApp Us
                </a>
              )}
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
            <p className="sm:col-span-2 text-slate-300 text-sm leading-relaxed" data-testid="home-no-rate-msg">
              Today's gold and silver rate is updated from the shop counter. Please call or WhatsApp us for the confirmed live rate.
            </p>
          )}
        </div>
        <div className="text-right mt-2">
          <Link to="/rates" className="text-sm text-[#991B1B] hover:text-[#D4AF37]">View 30-day rate history →</Link>
        </div>
      </section>

      {/* Our Story */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 grid lg:grid-cols-2 gap-10 items-center">
        <img src={STORY_IMG} alt="Family jewellery shop" className="rounded-md h-[320px] w-full object-cover order-2 lg:order-1" />
        <div className="order-1 lg:order-2">
          <h2 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight">Our Story</h2>
          <div className="mt-4 space-y-4 text-slate-700 text-sm sm:text-base leading-relaxed">
            <p>
              {shop.shop_name} began as a small family counter and has grown, generation after generation,
              into a shop trusted by families across the community for their most important moments —
              weddings, Dashain-Tihar, birthdays, and everyday gold.
            </p>
            <p>
              What hasn't changed is how we do business: honest weight on a calibrated scale, clear explanation
              of jarti (purity deduction) and jyala (making charge) before you pay, and a fair word on old gold
              exchange. Every family that walks in once tends to come back for the next occasion too.
            </p>
          </div>
        </div>
      </section>

      {/* Services / what we offer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
        <h2 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight">What We Offer</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((f) => (
            <div key={f.t} className="bg-white border border-slate-200 rounded-md p-6">
              <f.icon className="text-[#D4AF37]" strokeWidth={1.5} />
              <p className="font-semibold mt-3">{f.t}</p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Collections */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
        <h2 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight">Featured Collections</h2>
        {collections.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {collections.map((c) => (
              <Link key={c.id} to={`/catalogue?collection=${encodeURIComponent(c.name)}`}
                data-testid={`collection-card-${c.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className="group bg-white border border-slate-200 rounded-md p-6 flex flex-col hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-md transition-all duration-300">
                <Gem className="text-[#D4AF37]" strokeWidth={1.5} />
                <p className="font-serif-display text-lg mt-3">{c.name}</p>
                <p className="text-sm text-slate-500 mt-1 flex-1">{collectionDescription(c.name)}</p>
                <p className="text-xs font-medium text-[#991B1B] mt-4 group-hover:text-[#D4AF37]">Explore catalogue →</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-500">Collections will appear here once added by the shop.</p>
        )}
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
                <img src={primaryProductPhoto(p)} alt={p.name} className="h-40 w-full object-cover" />
                <div className="p-3">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.purity} · {p.weight_tola} tola</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trust signals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
        <h2 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight">Trusted by Families Like Yours</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <ComingSoonCard icon={Star} title="Customer Reviews" note="Real customer reviews and Google ratings will be added here soon." />
          <ComingSoonCard icon={Camera} title="Shop Photos" note="Photos of our shop counter and workshop are coming soon." />
          <ComingSoonCard icon={ImageOff} title="Our Family" note="A photo of the family behind the counter — coming soon." />
        </div>
        {shop.maps_link && (
          <div className="mt-5">
            <a href={shop.maps_link} target="_blank" rel="noreferrer" className="text-sm text-[#D4AF37] hover:underline font-medium">
              See us on Google Maps →
            </a>
          </div>
        )}
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

const ComingSoonCard = ({ icon: Icon, title, note }) => (
  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-md p-6 text-center flex flex-col items-center">
    <Icon className="text-slate-400" strokeWidth={1.5} size={28} />
    <p className="font-medium mt-3 text-slate-700">{title}</p>
    <p className="text-xs text-slate-500 mt-1">{note}</p>
  </div>
);
