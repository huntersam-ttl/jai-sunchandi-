import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { MessageCircle } from "lucide-react";

const FALLBACK = "https://images.unsplash.com/photo-1722410180687-b05b50922362?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

export default function ProductDetail() {
  const { id } = useParams();
  const shop = useSettings();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  const [p, setP] = useState(null);
  const [err, setErr] = useState(false);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    api.get(`/products/${id}`).then((r) => setP(r.data)).catch(() => setErr(true));
  }, [id]);

  if (err) return <div className="max-w-4xl mx-auto px-6 py-20 text-center text-slate-500">Product not found or no longer available.</div>;
  if (!p) return <div className="max-w-4xl mx-auto px-6 py-20 text-center text-slate-500">Loading…</div>;

  const photos = p.photos?.length ? p.photos : [FALLBACK];
  const url = `${window.location.origin}/product/${p.id}`;
  const enquiryWaLink = waLink(`Namaste ${shop.shop_name}! I am interested in "${p.name}" (${p.product_code}). Please share today's price and details.`);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid lg:grid-cols-2 gap-10">
      <div>
        <img src={photos[photo]} alt={p.name} className="w-full h-[360px] sm:h-[440px] object-cover rounded-md border border-slate-200" data-testid="product-main-photo" />
        {photos.length > 1 && (
          <div className="flex gap-2 mt-3">
            {photos.map((ph, i) => (
              <button key={i} onClick={() => setPhoto(i)} className={`h-16 w-16 rounded border ${i === photo ? "border-[#D4AF37]" : "border-slate-200"}`}>
                <img src={ph} alt="" className="h-full w-full object-cover rounded" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-mono" data-testid="product-code">Code: {p.product_code}</p>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold tracking-tight mt-1" data-testid="product-name">{p.name}</h1>
        {p.name_np && <p className="text-[#991B1B] mt-1">{p.name_np}</p>}
        <p className="mt-4 text-2xl font-bold text-[#991B1B]" data-testid="product-price">
          {p.estimated_price ? `${rs(p.estimated_price)}*` : "Inquire for today's price"}
        </p>
        {p.estimated_price && <p className="text-xs text-slate-400">* Live estimate from today's rate</p>}
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Info label="Metal" value={p.metal} cap />
          <Info label="Purity" value={p.purity} />
          <Info label="Weight (tola)" value={`${p.weight_tola} tola`} />
          <Info label="Weight (grams)" value={`${p.weight_grams} g`} />
          <Info label="Category" value={p.category || "—"} />
          <Info label="Collection" value={p.collection || "—"} />
          <Info label="Availability" value={p.status} cap />
        </div>
        {p.description && <p className="mt-5 text-sm text-slate-600">{p.description}</p>}
        {enquiryWaLink && (
          <a href={enquiryWaLink}
            target="_blank" rel="noreferrer" data-testid="whatsapp-enquiry-button"
            className="mt-8 inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-[#25D366] text-white px-8 py-4 rounded-md min-h-[52px] text-base font-semibold hover:bg-[#1fb457] transition-colors duration-300">
            <MessageCircle size={20} /> Enquire on WhatsApp
          </a>
        )}
        <div className="mt-8 bg-white border border-slate-200 rounded-md p-4 inline-flex items-center gap-4">
          <QRCodeSVG value={url} size={88} data-testid="product-qr" />
          <div className="text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Product QR</p>
            <p>Scan to open this product</p>
            <p className="mt-1">{p.product_code}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Info = ({ label, value, cap }) => (
  <div className="bg-white border border-slate-200 rounded-md p-3">
    <p className="text-xs text-slate-400">{label}</p>
    <p className={`font-semibold ${cap ? "capitalize" : ""}`}>{value}</p>
  </div>
);
