import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { api, apiError } from "@/lib/api";
import { toNp, SHOP, compressImage } from "@/lib/format";
import { btnGold, btnGhost, inp } from "@/components/admin/ui";
import { Printer } from "lucide-react";

const np = (n) => toNp(Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }));

export default function InvoicePrint() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [size, setSize] = useState("a5");

  const load = () => api.get(`/admin/invoices/${id}`).then((r) => setInv(r.data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (!inv) return <p className="text-sm text-slate-500">Loading…</p>;

  const setStatus = async (status) => {
    try { await api.patch(`/admin/invoices/${id}/status`, { status }); toast.success("Status updated"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const uploadScan = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    toast.info("Scan attached (stored with invoice record)");
    const photo = await compressImage(f, 1200);
    setInv({ ...inv, physical_bill_photo: photo });
  };

  const verifyUrl = `${window.location.origin}/verify/invoice/${inv.id}`;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bill #{inv.bill_number}</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <select className={inp} style={{ width: 100 }} value={size} onChange={(e) => setSize(e.target.value)} data-testid="invoice-size-select">
            <option value="a5">A5</option><option value="a4">A4</option>
          </select>
          <select className={inp} style={{ width: 130 }} value={inv.status} onChange={(e) => setStatus(e.target.value)} data-testid="invoice-status-select">
            {["active", "refunded", "exchanged", "cancelled"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className={btnGhost + " cursor-pointer"}>
            Attach bill scan <input type="file" accept="image/*" className="hidden" onChange={uploadScan} data-testid="invoice-scan-upload" />
          </label>
          <button className={btnGold} onClick={() => window.print()} data-testid="invoice-print-btn"><Printer size={16} /> Print</button>
        </div>
      </div>

      <div className={`print-area bg-white border border-slate-300 mx-auto p-6 sm:p-8 ${size === "a5" ? "max-w-[148mm]" : "max-w-[210mm]"}`} data-testid="invoice-print-area" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="text-center border-b-2 border-[#D4AF37] pb-4">
          <p className="font-serif-display text-xl font-bold">{SHOP.name}</p>
          <p className="text-[#991B1B] font-semibold">{SHOP.nameNp}</p>
          <p className="text-xs text-slate-600 mt-1">{SHOP.address} · {SHOP.phone}</p>
        </div>

        <div className="flex justify-between mt-4 text-sm">
          <div>
            <p><span className="text-slate-500">बिल नं. (Bill No.):</span> <b data-testid="print-bill-number">{inv.bill_number} / {toNp(inv.bill_number)}</b></p>
            <p><span className="text-slate-500">ग्राहकको नाम (Customer):</span> <b>{inv.customer.name}</b></p>
            <p><span className="text-slate-500">फोन (Phone):</span> {inv.customer.phone}</p>
          </div>
          <div className="text-right">
            <p><span className="text-slate-500">मिति (BS):</span> <b data-testid="print-bs-date">{inv.invoice_date_bs_np}</b></p>
            <p><span className="text-slate-500">Date (AD):</span> {inv.invoice_date_ad}</p>
            <p><span className="text-slate-500">Order:</span> {inv.order_number}</p>
          </div>
        </div>

        <table className="w-full mt-4 text-sm border-collapse">
          <thead>
            <tr className="border-y border-slate-300 text-left text-xs">
              <th className="py-1.5">विवरण (Item)</th><th>तौल (Weight)</th><th>शुद्धता</th><th>दर/तोला</th><th>जर्ती</th><th>ज्याला</th><th className="text-right">जम्मा (Total)</th>
            </tr>
          </thead>
          <tbody data-testid="print-items">
            {inv.items.map((it) => (
              <tr key={it.id} className="border-b border-slate-100 align-top">
                <td className="py-2">{it.name}</td>
                <td>{toNp(it.weight_tola)} तोला<br /><span className="text-xs text-slate-500">{toNp(it.weight_grams)} ग्राम</span></td>
                <td>{it.purity === "silver" ? "चाँदी" : toNp(it.purity)}</td>
                <td>रु {np(it.rate_per_tola)}</td>
                <td>{toNp(it.jarti_percent)}%<br /><span className="text-xs text-slate-500">रु {np(it.jarti_amount)}</span></td>
                <td>रु {np(it.jyala_amount)}</td>
                <td className="text-right font-semibold">रु {np(it.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {inv.items.some((it) => it.stone_cost + it.polishing_cost + it.cutting_cost + it.worker_charge + it.other_cost > 0) && (
          <p className="text-xs text-slate-600 mt-2">
            अन्य खर्च (Extra costs): {inv.items.map((it) => {
              const extra = it.stone_cost + it.polishing_cost + it.cutting_cost + it.worker_charge + it.other_cost;
              return extra > 0 ? `${it.name}: रु ${np(extra)}` : null;
            }).filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-4 ml-auto w-64 text-sm space-y-1.5" data-testid="print-totals">
          <div className="flex justify-between"><span>जम्मा (Total)</span><b>रु {np(inv.total_price)}</b></div>
          {inv.old_gold_value > 0 && (
            <div className="flex justify-between text-amber-800"><span>पुरानो सुन कटौती (Old gold)</span><b>− रु {np(inv.old_gold_value)}</b></div>
          )}
          <div className="flex justify-between border-t border-slate-300 pt-1.5"><span>तिर्नुपर्ने (Net Payable)</span><b>रु {np(inv.net_payable)}</b></div>
          <div className="flex justify-between"><span>अग्रिम (Advance)</span><b>रु {np(inv.advance_paid)}</b></div>
          <div className="flex justify-between text-base border-t-2 border-[#D4AF37] pt-1.5"><span>बाँकी (Remaining)</span><b className="text-[#991B1B]" data-testid="print-remaining">रु {np(inv.remaining_balance)}</b></div>
        </div>

        {inv.old_gold && inv.old_gold_value > 0 && (
          <p className="text-xs text-slate-600 mt-3">पुरानो सुन: {inv.old_gold.old_item_description} · {toNp(inv.old_gold.old_weight_tola)} तोला · दर रु {np(inv.old_gold.old_valuation_rate_per_tola)} · कटौती {toNp(inv.old_gold.old_deduction_percent)}%</p>
        )}

        <div className="mt-8 flex justify-between items-end">
          <div className="text-center">
            <QRCodeSVG value={verifyUrl} size={72} data-testid="print-qr" />
            <p className="text-[9px] text-slate-500 mt-1">बिल प्रमाणीकरण QR</p>
          </div>
          <div className="text-xs text-slate-500 text-center max-w-[200px]">
            <p>यो बिल पसलको आधिकारिक छाप सहितको कागजी बिलको डिजिटल अभिलेख हो।</p>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 w-40 pt-1 text-xs">हस्ताक्षर / छाप (Signature/Stamp)</div>
          </div>
        </div>
        <p className="text-center text-xs text-[#991B1B] mt-4">धन्यवाद! फेरि आउनुहोला।</p>
      </div>

      {inv.physical_bill_photo && (
        <div className="no-print max-w-md mx-auto">
          <p className="text-xs text-slate-500 mb-1">Attached physical bill scan:</p>
          <img src={inv.physical_bill_photo} alt="Physical bill" className="rounded border" />
        </div>
      )}
    </div>
  );
}
