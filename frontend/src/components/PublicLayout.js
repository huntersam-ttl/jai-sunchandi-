import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { MessageCircle, Menu, X, Gem, TrendingUp, PackageSearch, MapPin, Phone, Clock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { useJsonLd } from "@/lib/useDocumentMeta";
import { NEPALI_SHOP_NAME, OFFICIAL_SHOP_NAME, PUBLIC_BRAND_NAME } from "@/lib/brand";
const links = [
  { to: "/", label: "Home" },
  { to: "/rates", label: "Rates" },
  { to: "/catalogue", label: "Catalogue" },
  { to: "/custom-order", label: "Custom Order" },
  { to: "/repair", label: "Repair" },
  { to: "/order-status", label: "Order Status" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

// Route-aware WhatsApp intro so the message already reflects what the
// visitor was looking at, instead of one generic line everywhere.
function contextualWhatsappMessage(pathname, shop) {
  if (pathname.startsWith("/custom-order")) {
    return `Namaste ${shop.shop_name}, I'd like to enquire about a custom gold/silver order.`;
  }
  if (pathname.startsWith("/repair")) {
    return `Namaste ${shop.shop_name}, I have a jewellery repair enquiry.`;
  }
  if (pathname.startsWith("/catalogue") || pathname.startsWith("/product")) {
    return `Namaste ${shop.shop_name}, I have an enquiry about gold/silver jewellery.`;
  }
  if (pathname.startsWith("/rates")) {
    return `Namaste ${shop.shop_name}, could you share today's confirmed gold/silver rate?`;
  }
  return shop.default_whatsapp_message || `Namaste ${shop.shop_name}, I have an enquiry about gold/silver jewellery.`;
}

const mobileQuickActions = [
  { to: "/catalogue", label: "Catalogue", icon: Gem },
  { to: "/rates", label: "Rates", icon: TrendingUp },
  { to: "/order-status", label: "Order Status", icon: PackageSearch },
];

const FLOATING_WHATSAPP_MESSAGE = "Namaste! I visited your website and have a question about your jewellery.";

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const shop = useSettings();
  const location = useLocation();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  const contextualMsg = contextualWhatsappMessage(location.pathname, shop);
  const floatingWhatsappLink = waLink(FLOATING_WHATSAPP_MESSAGE);
  const hasWhatsapp = Boolean(shop.whatsapp);
  const hasAddress = Boolean(shop.address);
  const hasPhone = Boolean(shop.phone);
  const hasVisitDetails = hasAddress || hasPhone || shop.opening_hours;

  // JewelryStore structured data -- only include fields that are actually
  // configured; never fabricate an address, phone, or review to satisfy
  // schema.org's expected shape.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    name: PUBLIC_BRAND_NAME,
    alternateName: [OFFICIAL_SHOP_NAME, NEPALI_SHOP_NAME],
    ...(shop.tagline && { description: shop.tagline }),
    ...(shop.phone && { telephone: shop.phone }),
    ...(shop.address && { address: { "@type": "PostalAddress", streetAddress: shop.address, addressCountry: "NP" } }),
    ...(shop.opening_hours && { openingHours: shop.opening_hours }),
    ...(shop.maps_link && { hasMap: shop.maps_link }),
    ...(shop.logo && { image: shop.logo }),
    priceRange: "$$",
  };
  useJsonLd("jewelry-store-schema", shop.shop_name ? jsonLd : null);

  return (
    <div className="brand-page min-h-screen text-[#2B1B17]">
      <header className="sticky top-0 z-40 border-b border-[#D4AF37]/20 bg-[#FFFDF7]/86 shadow-[0_1px_24px_rgba(43,27,23,.06)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" data-testid="header-shop-name" className="focus-brand group flex items-center gap-3 leading-tight rounded-md">
            {shop.logo && (
              <img
                src={shop.logo}
                alt="logo"
                className="h-9 w-9 object-contain"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            )}
            <span className="flex flex-col">
              <span className="font-serif-display text-xl font-bold tracking-tight transition-colors group-hover:text-[#5B0D18]">{PUBLIC_BRAND_NAME}</span>
              <span className="font-devanagari text-xs text-[#5B0D18]">{shop.shop_name_np}</span>
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} data-testid={`nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={({ isActive }) => `focus-brand rounded-sm text-sm font-semibold transition-colors duration-300 hover:text-[#5B0D18] ${isActive ? "text-[#5B0D18]" : "text-[#4E4036]"}`}>
                {l.label}
              </NavLink>
            ))}
            {hasWhatsapp && (
              <a href={waLink(contextualMsg)} target="_blank" rel="noreferrer"
                data-testid="header-whatsapp-btn"
                className="focus-brand inline-flex items-center gap-2 rounded-md border border-[#D4AF37]/30 bg-[#5B0D18] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,13,24,.18)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#25D366]">
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
          </nav>
          <button className="focus-brand lg:hidden rounded-full border border-[#D4AF37]/30 bg-white/70 p-2" data-testid="mobile-menu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Open navigation">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="lg:hidden border-t border-[#D4AF37]/20 bg-[#FFFDF7] px-6 py-5 shadow-xl">
            <div className="grid gap-2">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
                className={({ isActive }) => `focus-brand rounded-md px-3 py-2 text-base font-semibold ${isActive ? "bg-[#F7F1E6] text-[#5B0D18]" : "text-[#3A2721]"}`}>{l.label}</NavLink>
            ))}
            </div>
          </nav>
        )}
        {/* Always-visible mobile quick actions -- the golden-path CTAs
            shouldn't require opening the hamburger menu first. */}
        <div className="lg:hidden flex items-stretch gap-2 px-3 pb-2 overflow-x-auto">
          {mobileQuickActions.map((a) => (
            <Link key={a.to} to={a.to} data-testid={`mobile-quick-${a.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="focus-brand flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D4AF37]/20 bg-white/70 px-3 py-2 text-xs font-semibold text-[#4E4036] transition-colors hover:bg-[#F7F1E6]">
              <a.icon size={14} /> {a.label}
            </Link>
          ))}
          {hasWhatsapp && (
            <a href={waLink(contextualMsg)} target="_blank" rel="noreferrer" data-testid="mobile-quick-whatsapp"
              className="focus-brand flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#25D366] px-3 py-2 text-xs font-semibold text-white shadow-sm">
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
        </div>
      </header>
      <main className="pb-20 sm:pb-0">
        <Outlet />
      </main>
      {hasWhatsapp && (
        <a href={floatingWhatsappLink} target="_blank" rel="noreferrer"
          data-testid="floating-whatsapp-btn"
          aria-label="Chat with us on WhatsApp"
          title="Chat with us on WhatsApp"
          className="focus-brand fixed bottom-24 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_18px_44px_rgba(37,211,102,.34)] ring-4 ring-white/90 transition-all duration-300 hover:-translate-y-1 hover:bg-[#1DA851] sm:bottom-6 sm:right-6">
          <MessageCircle size={26} aria-hidden="true" />
        </a>
      )}
      <footer className="brand-dark mt-12 sm:mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            {shop.logo && (
              <img
                src={shop.logo}
                alt="logo"
                className="h-12 mb-2 object-contain"
                loading="lazy"
                decoding="async"
              />
            )}
            <p className="font-serif-display text-2xl text-white">{PUBLIC_BRAND_NAME}</p>
            <p className="mt-1 text-sm text-[#E8DFD2]">{OFFICIAL_SHOP_NAME}</p>
            <p className="font-devanagari text-[#F1D77A] text-sm mt-1">{shop.shop_name_np}</p>
            {shop.tagline && <p className="text-sm mt-3 text-[#E8DFD2] leading-relaxed">{shop.tagline}</p>}
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#E8C774]/25 px-3 py-1.5 text-xs text-[#E8DFD2]">
              <ShieldCheck size={14} /> Family-run jewellery shop
            </p>
          </div>
          <div className="text-sm space-y-2">
            <p className="text-white font-semibold">Visit Us</p>
            {hasAddress && <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-[#E8C774]" />{shop.address}</p>}
            {hasPhone && <p className="flex gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-[#E8C774]" />{shop.phone}</p>}
            {shop.opening_hours && <p className="flex gap-2"><Clock size={16} className="mt-0.5 shrink-0 text-[#E8C774]" />{shop.opening_hours}</p>}
            {!hasVisitDetails && hasWhatsapp && <p className="text-[#E8DFD2]">Message us on WhatsApp before visiting.</p>}
            {shop.maps_link && (
              <a href={shop.maps_link} target="_blank" rel="noreferrer" className="focus-brand text-[#E8C774] hover:underline text-xs inline-block">
                View on Google Maps →
              </a>
            )}
          </div>
          <div className="text-sm space-y-2">
            <p className="text-white font-semibold">Quick Links</p>
            <Link to="/rates" className="focus-brand block hover:text-[#E8C774]">Gold & Silver Rates</Link>
            <Link to="/catalogue" className="focus-brand block hover:text-[#E8C774]">Catalogue</Link>
            <Link to="/order-status" className="focus-brand block hover:text-[#E8C774]">Check Order Status</Link>
            <Link to="/contact" className="focus-brand block hover:text-[#E8C774]">Contact Us</Link>
            <Link to="/privacy-policy" className="focus-brand block hover:text-[#E8C774]">Privacy Policy</Link>
            <Link to="/terms" className="focus-brand block hover:text-[#E8C774]">Terms of Service</Link>
            {hasWhatsapp && (
              <a href={waLink(contextualMsg)} target="_blank" rel="noreferrer"
                className="focus-brand block hover:text-[#E8C774]">
                Message on WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-[#E8C774]/10 py-4 text-center text-xs text-[#B8AA9A]">
          © {new Date().getFullYear()} {shop.shop_name}{shop.tagline_np ? ` · ${shop.tagline_np}` : ""}
        </div>
      </footer>
    </div>
  );
}
