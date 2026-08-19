import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { Phone, MapPin, MessageCircle, Clock, Map, Navigation } from "lucide-react";
import { EmptyState, PrimaryLink, SecondaryLink } from "@/components/PublicPolish";
export default function Contact() {
  const shop = useSettings();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  useDocumentMeta(
    `Contact Us – ${shop.shop_name || "Jai Supa Deurali Sun-Chandi Pasal"}`,
    "Visit or contact our gold and silver jewellery shop in Nepal — address, phone, WhatsApp, and opening hours."
  );
  const hasWhatsapp = Boolean(shop.whatsapp);
  const hasAddress = Boolean(shop.address);
  const hasPhone = Boolean(shop.phone);
  const hasAnyDetails = hasAddress || hasPhone || shop.opening_hours;
  return (
    <div className="brand-shell max-w-5xl py-12 sm:py-16">
      <p className="brand-eyebrow">Visit or message</p>
      <h1 className="font-serif-display text-4xl sm:text-6xl font-bold tracking-tight ornament-line mt-3">Contact / सम्पर्क</h1>
      <p className="text-[#5F5147] mt-5 max-w-2xl text-sm leading-relaxed">Reach the shop for jewellery designs, custom orders, repair questions, old gold exchange and daily rate confirmation.</p>
      <div className="mt-8 grid sm:grid-cols-2 gap-4 items-stretch">
        <div className="brand-card rounded-md p-6 space-y-4">
          {hasAddress && (
            <p className="flex items-center gap-3" data-testid="contact-address"><MapPin className="text-[#D4AF37] shrink-0" strokeWidth={1.5} /> {shop.address}</p>
          )}
          {hasPhone && (
            <p className="flex items-center gap-3" data-testid="contact-phone"><Phone className="text-[#D4AF37] shrink-0" strokeWidth={1.5} /> {shop.phone}</p>
          )}
          {shop.opening_hours && (
            <p className="flex items-center gap-3" data-testid="contact-hours"><Clock className="text-[#D4AF37] shrink-0" strokeWidth={1.5} /> {shop.opening_hours}</p>
          )}
          {!hasAnyDetails && (
            <div data-testid="contact-details-pending">
              <EmptyState title="Visit the shop">
                Official phone, address, map and opening hours are managed from shop settings so customers only see confirmed details.
              </EmptyState>
            </div>
          )}
          {shop.maps_link && (
            <a href={shop.maps_link} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 text-[#D4AF37] hover:underline text-sm" data-testid="contact-maps-link">
              <Map strokeWidth={1.5} size={20} /> View on Google Maps
            </a>
          )}
          {hasWhatsapp && (
            <PrimaryLink href={waLink(shop.default_whatsapp_message || `Namaste ${shop.shop_name}!`)} external icon={false} data-testid="contact-whatsapp-btn"
              className="bg-[#25D366] hover:bg-[#1fb457]">
              <MessageCircle size={18} /> Message on WhatsApp
            </PrimaryLink>
          )}
        </div>
        <div className="rounded-md min-h-[240px] overflow-hidden">
          {shop.maps_link ? (
            <a href={shop.maps_link} target="_blank" rel="noreferrer" className="block h-full">
              <div className="bg-slate-100 border border-slate-200 w-full h-full min-h-[240px] flex flex-col items-center justify-center gap-2 text-slate-600 text-sm text-center px-4 hover:bg-slate-200 transition-colors">
                <MapPin className="text-[#D4AF37]" strokeWidth={1.5} size={28} />
                {hasAddress && <span>{shop.address}</span>}
                <span className="text-xs text-slate-400">Tap to open directions</span>
              </div>
            </a>
          ) : (
            <div className="brand-dark w-full h-full min-h-[240px] flex flex-col items-center justify-center gap-2 text-[#E8DFD2] text-sm text-center px-6">
              <Navigation className="text-[#D4AF37]" strokeWidth={1.5} size={28} />
              {hasAddress ? (
                <span>Visit us at {shop.address}</span>
              ) : (
                <div>
                  <p className="font-serif-display text-2xl text-white">Jai Supa Deurali</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#E8C774]">Shop directions</p>
                </div>
              )}
              {hasWhatsapp && (
                <SecondaryLink href={waLink(shop.default_whatsapp_message || `Namaste ${shop.shop_name}!`)} external
                  className="mt-3 border-white/25 bg-white/10 text-white hover:bg-white/15">
                  Get directions on WhatsApp →
                </SecondaryLink>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
