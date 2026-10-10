import { ShieldX } from "lucide-react";

export default function VerifyCertificate() {
  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center" data-testid="cert-verify-unavailable">
      <ShieldX size={48} className="mx-auto text-amber-600" strokeWidth={1.5} />
      <p className="mt-4 font-semibold">Certificate verification is not available yet</p>
      <p className="mt-2 text-sm text-slate-600">Certificate records are not part of the current Supabase release candidate. Please contact the shop directly before relying on a certificate.</p>
    </div>
  );
}
