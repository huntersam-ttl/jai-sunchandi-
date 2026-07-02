import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { BadgeCheck, ShieldX } from "lucide-react";

export default function VerifyCertificate() {
  const { id } = useParams();
  const [cert, setCert] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api.get(`/verify/certificate/${id}`).then((r) => setCert(r.data)).catch(() => setErr(true));
  }, [id]);

  if (err) return (
    <div className="max-w-md mx-auto px-6 py-24 text-center" data-testid="cert-verify-notfound">
      <ShieldX size={48} className="mx-auto text-red-600" strokeWidth={1.5} />
      <p className="mt-4 font-semibold">Certificate not found</p>
    </div>
  );
  if (!cert) return <div className="py-24 text-center text-slate-500">Verifying…</div>;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16" data-testid="cert-verify-page">
      <div className="bg-white border-2 border-[#D4AF37] rounded-md p-8 text-center">
        <BadgeCheck size={48} className="mx-auto text-[#D4AF37]" strokeWidth={1.5} />
        <p className="font-serif-display text-xl font-bold mt-4">{cert.shop_name}</p>
        <p className="text-xs text-green-700 font-semibold mt-1 uppercase tracking-widest">✓ Verified Certificate</p>
        <div className="mt-6 text-left text-sm space-y-3">
          {[["Certificate No.", cert.certificate_number],
            ["Product ID", cert.product_code || "—"],
            ["Metal", cert.metal],
            ["Purity", cert.purity],
            ["Weight", `${cert.weight_tola} tola / ${cert.weight_grams} g`],
            ["Stones", cert.stone_details || "—"],
            ["Date", `${cert.date_ad} · BS ${cert.date_bs_np}`]].map(([l, v]) => (
            <div key={l} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <span className="text-slate-500">{l}</span>
              <span className="font-semibold capitalize text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
