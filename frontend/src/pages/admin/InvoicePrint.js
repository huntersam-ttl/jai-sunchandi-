import { Link } from "react-router-dom";
import { Receipt } from "lucide-react";
import { btnGhost } from "@/components/admin/ui";

export default function InvoicePrint() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Invoices</h1>
      <div className="bg-white border border-slate-200 rounded-md p-10 text-center text-slate-400" data-testid="invoice-print-coming-soon">
        <Receipt size={32} className="mx-auto mb-3 opacity-50" />
        <p className="font-medium">Coming soon</p>
        <p className="text-sm mt-1">Invoice printing is a Phase 2 feature — not connected yet.</p>
        <Link to="/admin/invoices" className={`${btnGhost} inline-flex mt-4`}>Back to Invoices</Link>
      </div>
    </div>
  );
}
