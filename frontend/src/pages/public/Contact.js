import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { Phone, MapPin, MessageCircle, Clock, Map } from "lucide-react";
export default function Contact() {
  const shop = useSettings();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl font-bold tracking-tighter">Contact / सम्पर्क</h1>
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-4">
          <p className="flex items-center gap-3" data-testid="contact-address"><MapPin className="text-[#D4AF37]" strokeWidth={1.5} /> {shop.address}</p>
          <p className="flex items-center gap-3" data-testid="contact-phone"><Phone className="text-[#D4AF37]" strokeWidth={1.5} /> {shop.phone}</p>
          {shop.opening_hours && (
            <p className="flex items-center gap-3" data-testid="contact-hours"><Clock className="text-[#D4AF37]" strokeWidth={1.5} /> {shop.opening_hours}</p>
          )}
          {shop.maps_link && (
            <a href={shop.maps_link} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 text-[#D4AF37] hover:underline text-sm" data-testid="contact-maps-link">
              <Map strokeWidth={1.5} size={20} /> View on Google Maps
            </a>
          )}
          <a href={waLink(shop.default_whatsapp_message || `Namaste ${shop.shop_name}!`)} target="_blank" rel="noreferrer" data-testid="contact-whatsapp-btn"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white px-6 py-3.5 rounded-md min-h-[48px] hover:bg-[#1fb457] transition-colors">
            <MessageCircle size={18} /> Message on WhatsApp
          </a>
        </div>
        <div className="rounded-md min-h-[240px] overflow-hidden">
          {shop.maps_link ? (
            <a href={shop.maps_link} target="_blank" rel="noreferrer" className="block h-full">
              <div className="bg-slate-200 w-full h-full min-h-[240px] flex items-center justify-center text-slate-500 text-sm hover:bg-slate-300 transition-colors">
                📍 {shop.address}
                <br />Click to open in Maps
              </div>
            </a>
          ) : (
            <div className="bg-slate-200 w-full h-full min-h-[240px] flex items-center justify-center text-slate-500 text-sm">
              {shop.address}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
