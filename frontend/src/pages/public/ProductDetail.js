import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { rs, PRODUCT_PLACEHOLDER_IMG } from "@/lib/format";
import { OptimizedImage } from "@/components/OptimizedImage";
import { EmptyState, PrimaryLink, SecondaryLink } from "@/components/PublicPolish";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { MessageCircle, MapPin, ShieldCheck, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { PUBLIC_BRAND_NAME } from "@/lib/brand";
import { productContext } from "@/lib/merchandising";

export default function ProductDetail() {
  const { id } = useParams();
  const shop = useSettings();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  const [p, setP] = useState(null);
  const [err, setErr] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  const touchStart = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setP(null);
    setErr(false);
    setPhoto(0);
    setShareStatus("");
    api.get(`/products/${id}`, { signal: controller.signal })
      .then((r) => { if (!controller.signal.aborted) setP(r.data); })
      .catch(() => { if (!controller.signal.aborted) setErr(true); });
    return () => controller.abort();
  }, [id]);

  useDocumentMeta(
    p ? `${p.name} (${p.product_code}) – ${PUBLIC_BRAND_NAME}` : `Product – ${PUBLIC_BRAND_NAME}`,
    p ? `${p.name} ${p.metal || ""} ${p.purity || ""} jewellery from ${PUBLIC_BRAND_NAME}. Enquire on WhatsApp or visit the shop for final price.` : "Gold and silver jewellery product detail."
  );

  if (err) return <div className="brand-shell py-20"><EmptyState title="Product not found">This design may no longer be available online. Please browse the catalogue or contact the shop.</EmptyState></div>;
  if (!p) return <div className="brand-shell py-20"><div className="brand-card rounded-md p-6"><div className="skeleton-shimmer h-80 rounded-md" /></div></div>;

  const photos = p.photos?.length ? p.photos : [PRODUCT_PLACEHOLDER_IMG];
  const selectPhoto = (next) => setPhoto((current) => (next + photos.length) % photos.length);
  const onTouchStart = (event) => { touchStart.current = event.changedTouches[0].clientX; };
  const onTouchEnd = (event) => {
    if (touchStart.current == null) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(delta) > 40) selectPhoto(photo + (delta < 0 ? 1 : -1));
    touchStart.current = null;
  };
  const url = `${window.location.origin}/product/${p.id}`;
  const enquiryWaLink = waLink(`Namaste ${shop.shop_name}! I am interested in "${p.name}" (${p.product_code}). Please share today's price and details. Product link: ${url}`);
  const shareProduct = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${p.name} · ${PUBLIC_BRAND_NAME}`, text: `See ${p.name} (${p.product_code})`, url });
        setShareStatus("Product link shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareStatus("Product link copied");
      } else {
        setShareStatus("Copy this page link to share it");
      }
    } catch (shareError) {
      // Closing the native share sheet is not an error worth showing to a customer.
      if (shareError?.name !== "AbortError") setShareStatus("Could not share the product link");
    }
  };

  return (
    <div className="brand-shell py-12 sm:py-16 grid lg:grid-cols-2 gap-10">
      <div>
        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} role="group" aria-label="Product photo gallery">
        <OptimizedImage
          src={photos[photo]}
          alt={p.name}
          className="w-full h-[360px] sm:h-[520px] object-contain rounded-md border border-[#D4AF37]/25 bg-[#F7F1E6] shadow-[0_24px_70px_rgba(43,27,23,.12)]"
          widths={[360, 640, 900]}
          sizes="(min-width: 1024px) 50vw, 100vw"
          loading="eager"
          fetchPriority="high"
          testId="product-main-photo"
        />
        {photos.length > 1 && <div className="flex justify-between -mt-14 px-3 relative"><button type="button" aria-label="Previous product photo" onClick={() => selectPhoto(photo - 1)} className="h-11 w-11 rounded-full bg-black/55 text-white flex items-center justify-center"><ChevronLeft size={20} /></button><button type="button" aria-label="Next product photo" onClick={() => selectPhoto(photo + 1)} className="h-10 w-10 rounded-full bg-black/55 text-white flex items-center justify-center"><ChevronRight size={20} /></button></div>}
        {photos.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" aria-label="Product photo thumbnails">
            {photos.map((ph, i) => (
              <button key={i} type="button" aria-label={`Show product photo ${i + 1}`} aria-current={i === photo} onClick={() => setPhoto(i)} className={`h-16 w-16 shrink-0 rounded border ${i === photo ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/30" : "border-slate-200"}`}>
                <OptimizedImage
                  src={ph}
                  alt=""
                  className="h-full w-full object-cover rounded"
                  widths={[96, 160]}
                  sizes="64px"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
      <div>
        <p className="brand-eyebrow" data-testid="product-code">Code: {p.product_code}</p>
        <h1 className="font-serif-display text-4xl sm:text-6xl font-bold tracking-tight mt-2 ornament-line" data-testid="product-name">{p.name}</h1>
        {p.name_np && <p className="font-devanagari text-[#5B0D18] mt-3">{p.name_np}</p>}
        <p className="mt-6 text-3xl font-bold text-[#5B0D18]" data-testid="product-price">
          {p.estimated_price ? `${rs(p.estimated_price)}*` : "Inquire for today's price"}
        </p>
        {p.estimated_price && <p className="text-xs text-[#6B5E55]">* Estimate from the published rate. Final price is confirmed at the shop.</p>}
        <div className="mt-6 grid grid-cols-1 gap-3 text-sm min-[360px]:grid-cols-2">
          <Info label="Metal" value={p.metal} cap />
          <Info label="Purity" value={p.purity} />
          <Info label="Weight (tola)" value={`${p.weight_tola} tola`} />
          <Info label="Weight (grams)" value={`${p.weight_grams} g`} />
          <Info label="Category" value={p.category || "—"} />
          <Info label="Collection" value={p.collection || "—"} />
          <Info label="Availability" value={p.status} cap />
        </div>
        {p.description && <p className="mt-6 text-sm leading-relaxed text-[#5F5147]">{p.description}</p>}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {enquiryWaLink && (
            <PrimaryLink href={enquiryWaLink} external icon={false} data-testid="whatsapp-enquiry-button" className="bg-[#25D366] hover:bg-[#1fb457]">
              <MessageCircle size={20} /> Enquire on WhatsApp
            </PrimaryLink>
          )}
          <SecondaryLink to={productContext(p)} data-testid="customise-product-button"><SparklesIcon /> Customise this design</SecondaryLink>
          <SecondaryLink to="/contact"><MapPin size={18} /> Visit the shop</SecondaryLink>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={shareProduct} className="focus-brand inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[#D4AF37]/40 bg-white px-4 py-2 text-sm font-semibold text-[#5B0D18] hover:bg-[#F7F1E6]" data-testid="share-product-button">
            <Share2 size={17} /> Share this design
          </button>
          {shareStatus && <span role="status" className="text-xs text-[#5F5147]">{shareStatus}</span>}
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-md border border-[#D4AF37]/25 bg-white/60 p-4 text-sm text-[#5F5147]">
          <ShieldCheck className="mt-0.5 shrink-0 text-[#D4AF37]" size={20} strokeWidth={1.5} />
          <p>Weight, purity, jarti, jyala and final price are checked and confirmed at the shop counter.</p>
        </div>
        <div className="mt-8 brand-card rounded-md p-4 inline-flex items-center gap-4">
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

const SparklesIcon = () => <span aria-hidden="true" className="text-[#D4AF37]">✦</span>;

const Info = ({ label, value, cap }) => (
  <div className="brand-card rounded-md p-3">
    <p className="text-xs text-[#86786D]">{label}</p>
    <p className={`font-semibold text-[#2B1B17] ${cap ? "capitalize" : ""}`}>{value}</p>
  </div>
);
