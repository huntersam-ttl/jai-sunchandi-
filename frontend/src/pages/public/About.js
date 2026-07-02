import { SHOP } from "@/lib/format";

const IMG = "https://images.unsplash.com/photo-1613966561243-c6959a886009?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

export default function About() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold tracking-tighter">Decades of <span className="gold-gradient-text">Trust</span></h1>
      <p className="text-[#991B1B] mt-2">{SHOP.nameNp} · {SHOP.taglineNp}</p>
      <div className="mt-10 grid lg:grid-cols-2 gap-10 items-center">
        <img src={IMG} alt="Traditional jewellery" className="rounded-md h-[380px] w-full object-cover" />
        <div className="space-y-4 text-slate-700">
          <p><b>{SHOP.name}</b> is a family-run gold and silver shop that has served its community for decades. Generations of families have trusted us for weddings, festivals and everyday ornaments.</p>
          <p>We believe in <b>honest weight</b>, transparent <b>jarti</b> and <b>jyala</b>, and fair valuation for old gold exchange (purano sun satta). Every sale comes with our official stamped bill.</p>
          <p>From bridal sets to daily wear, from Dashain-Tihar gifts to silver puja items — everything is crafted and checked with care.</p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[["Decades", "of service"], ["1000s", "of happy families"], ["100%", "honest weight"]].map(([a, b]) => (
              <div key={a} className="bg-white border border-slate-200 rounded-md p-4 text-center">
                <p className="font-serif-display text-2xl font-bold text-[#D4AF37]">{a}</p>
                <p className="text-xs text-slate-500">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
