import { Receipt } from "lucide-react";

export default function Invoices() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Invoices</h1>
      <div className="bg-white border border-slate-200 rounded-md p-10 text-center text-slate-400" data-testid="invoices-coming-soon">
        <Receipt size={32} className="mx-auto mb-3 opacity-50" />
        <p className="font-medium">Coming soon</p>
        <p className="text-sm mt-1">Invoice printing is a Phase 2 feature — not connected yet.</p>
      </div>
    </div>
  );
}
