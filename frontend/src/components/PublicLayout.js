import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { MessageCircle, Menu, X, Gem, TrendingUp, PackageSearch } from "lucide-react";
import { useState } from "react";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { useJsonLd } from "@/lib/useDocumentMeta";
const links = [
  { to: "/", label: "Home" },
  { to: "/rates", label: "Today's Rate" },
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
  { to: "/rates", label: "Today's Rate", icon: TrendingUp },
  { to: "/order-status", label: "Order Status", icon: PackageSearch },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const shop = useSettings();
  const location = useLocation();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  const contextualMsg = contextualWhatsappMessage(location.pathname, shop);
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
    name: shop.shop_name,
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
    <div className="min-h-screen bg-[#FDFCF8] text-slate-900">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" data-testid="header-shop-name" className="flex items-center gap-3 leading-tight">
            {shop.logo && <img src={shop.logo} alt="logo" className="h-9 w-9 object-contain" />}
            <span className="flex flex-col">
              <span className="font-serif-display font-bold text-lg tracking-tight">{shop.shop_name}</span>
              <span className="text-xs text-[#991B1B]">{shop.shop_name_np}</span>
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} data-testid={`nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={({ isActive }) => `text-sm transition-colors duration-300 hover:text-[#D4AF37] ${isActive ? "text-[#D4AF37] font-semibold" : "text-slate-700"}`}>
                {l.label}
              </NavLink>
            ))}
            {hasWhatsapp && (
              <a href={waLink(contextualMsg)} target="_blank" rel="noreferrer"
                data-testid="header-whatsapp-btn"
                className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-md text-sm hover:bg-[#25D366] transition-colors duration-300">
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
          </nav>
          <button className="lg:hidden p-2" data-testid="mobile-menu-btn" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="lg:hidden bg-white border-t border-slate-200 px-6 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
                className="text-base py-1 text-slate-800">{l.label}</NavLink>
            ))}
          </nav>
        )}
        {/* Always-visible mobile quick actions -- the golden-path CTAs
            shouldn't require opening the hamburger menu first. */}
        <div className="lg:hidden flex items-stretch gap-2 px-3 pb-2 overflow-x-auto">
          {mobileQuickActions.map((a) => (
            <Link key={a.to} to={a.to} data-testid={`mobile-quick-${a.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-700 bg-slate-100 px-3 py-2 rounded-full hover:bg-slate-200 transition-colors">
              <a.icon size={14} /> {a.label}
            </Link>
          ))}
          {hasWhatsapp && (
            <a href={waLink(contextualMsg)} target="_blank" rel="noreferrer" data-testid="mobile-quick-whatsapp"
              className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-white bg-[#25D366] px-3 py-2 rounded-full">
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
        </div>
      </header>
      <main className="pb-20 sm:pb-0">
        <Outlet />
      </main>
      {hasWhatsapp && (
        <a href={waLink(contextualMsg)} target="_blank" rel="noreferrer"
          data-testid="floating-whatsapp-btn"
          className="fixed bottom-5 right-5 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:-translate-y-1 transition-transform duration-300">
          <MessageCircle size={24} />
        </a>
      )}
      <footer className="bg-[#0F172A] text-slate-300 mt-12 sm:mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            {shop.logo && <img src={shop.logo} alt="logo" className="h-12 mb-2 object-contain" />}
            <p className="font-serif-display text-white text-lg">{shop.shop_name}</p>
            <p className="text-[#D4AF37] text-sm mt-1">{shop.shop_name_np}</p>
            {shop.tagline && <p className="text-sm mt-3 text-slate-400">{shop.tagline}</p>}
          </div>
          <div className="text-sm space-y-2">
            <p className="text-white font-semibold">Visit Us</p>
            {hasAddress && <p>{shop.address}</p>}
            {hasPhone && <p>{shop.phone}</p>}
            {shop.opening_hours && <p>{shop.opening_hours}</p>}
            {!hasVisitDetails && (
              <p className="text-slate-400">
                {hasWhatsapp ? "Message us on WhatsApp for address and hours." : "Details coming soon."}
              </p>
            )}
            {shop.maps_link && (
              <a href={shop.maps_link} target="_blank" rel="noreferrer" className="text-[#D4AF37] hover:underline text-xs inline-block">
                View on Google Maps →
              </a>
            )}
          </div>
          <div className="text-sm space-y-2">
            <p className="text-white font-semibold">Quick Links</p>
            <Link to="/rates" className="block hover:text-[#D4AF37]">Today's Rate</Link>
            <Link to="/catalogue" className="block hover:text-[#D4AF37]">Catalogue</Link>
            <Link to="/order-status" className="block hover:text-[#D4AF37]">Check Order Status</Link>
            <Link to="/contact" className="block hover:text-[#D4AF37]">Contact Us</Link>
            {hasWhatsapp && (
              <a href={waLink(contextualMsg)} target="_blank" rel="noreferrer"
                className="block hover:text-[#D4AF37]">
                Message on WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {shop.shop_name}{shop.tagline_np ? ` · ${shop.tagline_np}` : ""}
        </div>
      </footer>
    </div>
  );
}
