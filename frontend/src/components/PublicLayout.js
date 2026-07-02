import { Link, NavLink, Outlet } from "react-router-dom";
import { MessageCircle, Menu, X } from "lucide-react";
import { useState } from "react";
import { SHOP, waLink } from "@/lib/format";

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

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#FDFCF8] text-slate-900">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" data-testid="header-shop-name" className="flex flex-col leading-tight">
            <span className="font-serif-display font-bold text-lg tracking-tight">{SHOP.name}</span>
            <span className="text-xs text-[#991B1B]">{SHOP.nameNp}</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} data-testid={`nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={({ isActive }) => `text-sm transition-colors duration-300 hover:text-[#D4AF37] ${isActive ? "text-[#D4AF37] font-semibold" : "text-slate-700"}`}>
                {l.label}
              </NavLink>
            ))}
            <a href={waLink(`Namaste! I have an enquiry for ${SHOP.name}.`)} target="_blank" rel="noreferrer"
              data-testid="header-whatsapp-btn"
              className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-md text-sm hover:bg-[#25D366] transition-colors duration-300">
              <MessageCircle size={16} /> WhatsApp
            </a>
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
      </header>
      <Outlet />
      <a href={waLink(`Namaste! I have an enquiry for ${SHOP.name}.`)} target="_blank" rel="noreferrer"
        data-testid="floating-whatsapp-btn"
        className="fixed bottom-5 right-5 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:-translate-y-1 transition-transform duration-300">
        <MessageCircle size={24} />
      </a>
      <footer className="bg-[#0F172A] text-slate-300 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <p className="font-serif-display text-white text-lg">{SHOP.name}</p>
            <p className="text-[#D4AF37] text-sm mt-1">{SHOP.nameNp}</p>
            <p className="text-sm mt-3 text-slate-400">{SHOP.tagline}</p>
          </div>
          <div className="text-sm space-y-2">
            <p className="text-white font-semibold">Visit Us</p>
            <p>{SHOP.address}</p>
            <p>{SHOP.phone}</p>
          </div>
          <div className="text-sm space-y-2">
            <p className="text-white font-semibold">Quick Links</p>
            <Link to="/rates" className="block hover:text-[#D4AF37]">Today's Rate</Link>
            <Link to="/catalogue" className="block hover:text-[#D4AF37]">Catalogue</Link>
            <Link to="/order-status" className="block hover:text-[#D4AF37]">Check Order Status</Link>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {SHOP.name} · {SHOP.taglineNp}
        </div>
      </footer>
    </div>
  );
}
