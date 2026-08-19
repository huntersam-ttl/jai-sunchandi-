import { useSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Reveal } from "@/components/PublicPolish";
const IMG = "https://images.unsplash.com/photo-1613966561243-c6959a886009?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";
export default function About() {
  const shop = useSettings();
  useDocumentMeta(
    `About Us – ${shop.shop_name || "Jai Supa Deurali Sun-Chandi Pasal"}`,
    "A family-run gold and silver jewellery shop in Nepal, trusted for generations for honest weight, transparent jarti and jyala, and fair old gold exchange."
  );
  return (
    <div className="brand-shell max-w-5xl py-12 sm:py-16">
      <p className="brand-eyebrow">About the shop</p>
      <h1 className="font-serif-display text-4xl sm:text-6xl font-bold tracking-tight ornament-line mt-3">Jewellery made with <span className="gold-gradient-text">care</span></h1>
      <p className="font-devanagari text-[#8F1D18] mt-4">{shop.shop_name_np} · {shop.tagline_np}</p>
      <Reveal className="mt-10 grid lg:grid-cols-2 gap-10 items-center">
        <OptimizedImage
          src={IMG}
          alt="Traditional jewellery"
          className="rounded-md h-[380px] w-full object-cover shadow-[0_24px_70px_rgba(23,19,16,.12)]"
          widths={[360, 640, 900]}
          sizes="(min-width: 1024px) 50vw, 100vw"
          loading="eager"
          fetchPriority="high"
        />
        <div className="space-y-4 text-[#5F5147] leading-relaxed">
          <p><b>{shop.shop_name}</b> is a family-run gold and silver shop that has served its community for decades. Generations of families have trusted us for weddings, festivals and everyday ornaments.</p>
          <p>We believe in <b>honest weight</b>, transparent <b>jarti</b> and <b>jyala</b>, and fair valuation for old gold exchange (purano sun satta). Every sale comes with our official stamped bill.</p>
          <p>From bridal sets to daily wear, from Dashain-Tihar gifts to silver puja items — everything is crafted and checked with care.</p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[["Family-run", "local service"], ["Transparent", "weight and charges"], ["Careful", "repair and custom work"]].map(([a, b]) => (
              <div key={a} className="brand-card rounded-md p-4 text-center">
                <p className="font-serif-display text-2xl font-bold text-[#C99A3D]">{a}</p>
                <p className="text-xs text-slate-500">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
      <div className="mt-12 grid sm:grid-cols-2 gap-4 text-sm text-[#5F5147] leading-relaxed">
        <p>
          As a trusted <b>gold jewellery shop</b> and <b>silver jewellery shop</b>, we handcraft everything from
          daily-wear rings to full bridal sets, and we're always happy to take on <b>custom gold ornaments</b>
          built to your own design.
        </p>
        <p>
          Bring in your <b>old gold exchange</b> or a piece that needs <b>jewellery repair</b> — resizing, a broken
          clasp, or a polish — and we'll take a look while you wait, right at the counter.
        </p>
      </div>
    </div>
  );
}
