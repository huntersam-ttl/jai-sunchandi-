import { SHOP, waLink } from "@/lib/format";
import { Phone, MapPin, MessageCircle, Clock } from "lucide-react";

export default function Contact() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl font-bold tracking-tighter">Contact / सम्पर्क</h1>
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-4">
          <p className="flex items-center gap-3"><MapPin className="text-[#D4AF37]" strokeWidth={1.5} /> {SHOP.address}</p>
          <p className="flex items-center gap-3"><Phone className="text-[#D4AF37]" strokeWidth={1.5} /> {SHOP.phone}</p>
          <p className="flex items-center gap-3"><Clock className="text-[#D4AF37]" strokeWidth={1.5} /> Sun–Fri: 10am – 7pm</p>
          <a href={waLink(`Namaste ${SHOP.name}!`)} target="_blank" rel="noreferrer" data-testid="contact-whatsapp-btn"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white px-6 py-3.5 rounded-md min-h-[48px] hover:bg-[#1fb457] transition-colors">
            <MessageCircle size={18} /> Message on WhatsApp
          </a>
        </div>
        <div className="bg-slate-200 rounded-md min-h-[240px] flex items-center justify-center text-slate-500 text-sm">
          Shop photo / map placeholder
        </div>
      </div>
    </div>
  );
}
