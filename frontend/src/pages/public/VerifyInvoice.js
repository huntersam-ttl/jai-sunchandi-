import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";
import { ShieldCheck, ShieldX } from "lucide-react";

export default function VerifyInvoice() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api.get(`/verify/invoice/${id}`).then((r) => setInv(r.data)).catch(() => setErr(true));
  }, [id]);

  if (err) return (
    <div className="max-w-md mx-auto px-6 py-24 text-center" data-testid="invoice-verify-notfound">
      <ShieldX size={48} className="mx-auto text-red-600" strokeWidth={1.5} />
      <p className="mt-4 font-semibold">Invoice not found</p>
    </div>
  );
  if (!inv) return <div className="py-24 text-center text-slate-500">Verifying…</div>;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16" data-testid="invoice-verify-page">
      <div className="bg-white border border-slate-200 rounded-md p-8 text-center">
        <ShieldCheck size={48} className="mx-auto text-green-700" strokeWidth={1.5} />
        <p className="font-serif-display text-xl font-bold mt-4">{inv.shop_name}</p>
        <p className="text-xs text-slate-500 mt-1">Bill Verification</p>
        <div className="mt-6 text-left text-sm space-y-3">
          <Row label="Bill Number" value={`${inv.bill_number} (${inv.bill_number_np})`} testId="verify-bill-number" />
          <Row label="Date" value={`${inv.invoice_date_ad} · BS ${inv.invoice_date_bs_np}`} />
          <Row label="Customer" value={inv.customer_name_masked} />
          <Row label="Total Amount" value={`${rs(inv.total_amount)} (रु. ${inv.total_amount_np})`} />
          <Row label="Status" value={inv.status} cap testId="verify-status" />
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value, cap, testId }) => (
  <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
    <span className="text-slate-500">{label}</span>
    <span className={`font-semibold text-right ${cap ? "capitalize" : ""}`} data-testid={testId}>{value}</span>
  </div>
);
