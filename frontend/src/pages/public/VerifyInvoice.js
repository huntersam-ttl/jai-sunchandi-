import { ShieldX } from "lucide-react";

export default function VerifyInvoice() {
  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center" data-testid="invoice-verify-unavailable">
      <ShieldX size={48} className="mx-auto text-amber-600" strokeWidth={1.5} />
      <p className="mt-4 font-semibold">Invoice verification is not available yet</p>
      <p className="mt-2 text-sm text-slate-600">This release candidate has not migrated the legacy invoice-verification records. Please contact the shop directly before relying on a bill.</p>
    </div>
  );
}
