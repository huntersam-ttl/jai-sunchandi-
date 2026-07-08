import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { Phone, MapPin, MessageCircle, Clock, Map, Navigation } from "lucide-react";
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl font-bold tracking-tighter">Contact / सम्पर्क</h1>
      <p className="text-slate-600 mt-2 text-sm">We'd love to hear from you — visit the shop or reach out below.</p>
      <div className="mt-8 grid sm:grid-cols-2 gap-4 items-stretch">
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-4">
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
            <p className="text-sm text-slate-500" data-testid="contact-details-pending">
              Our address and phone number will be listed here shortly. In the meantime, please reach out on WhatsApp below.
            </p>
          )}
          {shop.maps_link && (
            <a href={shop.maps_link} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 text-[#D4AF37] hover:underline text-sm" data-testid="contact-maps-link">
              <Map strokeWidth={1.5} size={20} /> View on Google Maps
            </a>
          )}
          {hasWhatsapp && (
            <a href={waLink(shop.default_whatsapp_message || `Namaste ${shop.shop_name}!`)} target="_blank" rel="noreferrer" data-testid="contact-whatsapp-btn"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white px-6 py-3.5 rounded-md min-h-[48px] hover:bg-[#1fb457] transition-colors">
              <MessageCircle size={18} /> Message on WhatsApp
            </a>
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
            <div className="bg-slate-100 border border-slate-200 w-full h-full min-h-[240px] flex flex-col items-center justify-center gap-2 text-slate-600 text-sm text-center px-6">
              <Navigation className="text-[#D4AF37]" strokeWidth={1.5} size={28} />
              <span className="font-medium">Map coming soon</span>
              {hasAddress ? (
                <span>Visit us at {shop.address}</span>
              ) : (
                <span>Message us on WhatsApp and we'll send you directions.</span>
              )}
              {hasWhatsapp && (
                <a href={waLink(shop.default_whatsapp_message || `Namaste ${shop.shop_name}!`)} target="_blank" rel="noreferrer"
                  className="mt-1 text-[#D4AF37] hover:underline text-xs font-medium">
                  Get directions on WhatsApp →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
