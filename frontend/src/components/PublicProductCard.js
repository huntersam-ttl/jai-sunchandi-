import { Link } from "react-router-dom";
import { MessageCircle, Images } from "lucide-react";
import { rs, primaryProductPhoto } from "@/lib/format";
import { OptimizedImage } from "@/components/OptimizedImage";

export function PublicProductCard({ product, index = 0, featured = false }) {
  const photos = product.photos || [];
  return (
    <Link
      to={`/product/${product.id}`}
      data-testid={`product-card-${product.product_code}`}
      className="group brand-card relative rounded-md overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-md focus-brand"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="relative overflow-hidden">
        <OptimizedImage
          src={primaryProductPhoto(product)}
          alt={product.name}
          className="aspect-[4/5] h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
          widths={[240, 360, 520]}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          loading="lazy"
        />
        {featured && <span className="absolute left-3 top-3 rounded-full bg-[#5B0D18] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#FFFDF7]">Festival pick</span>}
        {photos.length > 1 && <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white"><Images size={12} /> {photos.length}</span>}
      </div>
      <div className="p-3 sm:p-4">
        <p className="font-serif-display text-lg font-semibold leading-tight truncate">{product.name}</p>
        <p className="text-[11px] text-[#5B0D18] font-mono mt-1">{product.product_code}</p>
        <p className="text-xs text-[#6B5E55] mt-1 capitalize">{product.metal} · {product.purity} · {product.weight_tola} tola</p>
        <p className="text-sm mt-2 font-bold text-[#5B0D18]">{product.estimated_price ? `${rs(product.estimated_price)}*` : "Inquire for today's price"}</p>
        <span className={`inline-block mt-3 text-[11px] px-2 py-0.5 rounded-full ${product.status === "available" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{product.status}</span>
        <span className="mt-3 hidden items-center gap-1 text-[11px] font-semibold text-[#25D366] sm:flex"><MessageCircle size={13} /> Enquire from detail page</span>
      </div>
    </Link>
  );
}
