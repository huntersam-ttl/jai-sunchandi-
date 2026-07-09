import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { rs } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { billWhatsappLink, buildBillWhatsappMessage, buildBillReferenceText } from "@/lib/billArchive";
import { btnGhost, Card, ConfirmModal } from "@/components/admin/ui";
import AdminPhoto from "@/components/admin/AdminPhoto";
import { Printer, MessageCircle, Copy, Download, RefreshCw, Archive, RotateCcw, Trash2 } from "lucide-react";

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const shop = useSettings();
  const [bill, setBill] = useState(null);
  const [error, setError] = useState(null);
  const [photoBlobUrl, setPhotoBlobUrl] = useState(null);
  const [confirmMode, setConfirmMode] = useState(null); // "archive" | "restore" | "delete"

  const load = () => {
    setError(null);
    api.get(`/admin/bills/${id}`).then((r) => setBill(r.data))
      .catch((err) => { console.error("Bill detail load failed:", err); setError(apiError(err)); });
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (error && !bill) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-6 text-center space-y-3">
        <p className="text-red-700 font-medium">Could not load this bill. Please refresh or contact admin.</p>
        <p className="text-xs text-slate-400">{error}</p>
        <button className={btnGhost} onClick={load}><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }
  if (!bill) return <p className="text-sm text-slate-500">Loading…</p>;

  const message = buildBillWhatsappMessage(bill, shop.shop_name, rs);
  const waLink = billWhatsappLink(bill.customer_phone, message);
  const reference = buildBillReferenceText(bill);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      toast.success("Bill reference copied");
    } catch {
      toast.error("Could not copy reference");
    }
  };

  const runConfirmedAction = async () => {
    try {
      if (confirmMode === "archive") {
        await api.post(`/admin/bills/${id}/archive`);
        toast.success("Bill archived");
        setConfirmMode(null);
        load();
      } else if (confirmMode === "restore") {
        await api.post(`/admin/bills/${id}/restore`);
        toast.success("Bill restored");
        setConfirmMode(null);
        load();
      } else if (confirmMode === "delete") {
        await api.delete(`/admin/bills/${id}`, { data: { confirm: "DELETE BILL" } });
        toast.success("Bill permanently deleted");
        navigate("/admin/bills");
      }
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="bill-number-heading">
            {bill.bill_number || "Bill (no number)"}
            {bill.is_deleted && <span className="ml-2 align-middle inline-block text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Archived</span>}
          </h1>
          <p className="text-sm text-slate-500">
            {bill.customer_name || "—"} {bill.customer_phone && `· ${bill.customer_phone}`} {bill.bill_date && `· ${bill.bill_date}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {bill.total_amount != null && <p className="text-xl font-bold text-[#991B1B]">{rs(bill.total_amount)}</p>}
          {bill.is_deleted ? (
            <>
              <button className={btnGhost} onClick={() => setConfirmMode("restore")} data-testid="bill-restore-btn"><RotateCcw size={14} /> Restore</button>
              <button className="inline-flex items-center gap-2 border border-red-300 text-red-600 px-3 py-2 rounded-md text-sm hover:bg-red-50 transition-colors" onClick={() => setConfirmMode("delete")} data-testid="bill-delete-btn"><Trash2 size={14} /> Delete Permanently</button>
            </>
          ) : (
            <button className="inline-flex items-center gap-2 border border-amber-400 text-amber-700 bg-amber-50 px-3 py-2 rounded-md text-sm hover:bg-amber-100 transition-colors" onClick={() => setConfirmMode("archive")} data-testid="bill-archive-btn"><Archive size={14} /> Archive</button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Bill Photo">
          <div className="print-area">
            <AdminPhoto src={bill.photo_url} alt="Bill" className="w-full min-h-[200px] rounded border border-slate-200"
              testId="bill-photo-full" onReady={setPhotoBlobUrl} />
          </div>
          <div className="no-print mt-3 flex flex-wrap gap-2">
            {photoBlobUrl && (
              <a href={photoBlobUrl} target="_blank" rel="noreferrer" data-testid="bill-view-download-btn"
                className={btnGhost}>
                <Download size={14} /> View / Download
              </a>
            )}
            <button className={btnGhost} onClick={() => window.print()} data-testid="bill-print-btn">
              <Printer size={14} /> Print
            </button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Bill Info">
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Bill Number</span><span>{bill.bill_number || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{bill.bill_date || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span>{bill.total_amount != null ? rs(bill.total_amount) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment Status</span><span className="capitalize">{bill.payment_status}</span></div>
              {bill.notes && <p className="pt-2 border-t border-slate-100 text-slate-600">{bill.notes}</p>}
            </div>
          </Card>

          {(bill.related_order_id || bill.related_repair_id || bill.related_customer_id) && (
            <Card title="Linked Records">
              <div className="text-sm space-y-1">
                {bill.related_customer_id && <Link to={`/admin/customers/${bill.related_customer_id}`} className="block text-[#D4AF37] hover:underline" data-testid="bill-linked-customer">View linked customer →</Link>}
                {bill.related_order_id && <Link to={`/admin/orders/${bill.related_order_id}`} className="block text-[#D4AF37] hover:underline" data-testid="bill-linked-order">View linked order →</Link>}
                {bill.related_repair_id && <Link to="/admin/repairs" className="block text-[#D4AF37] hover:underline" data-testid="bill-linked-repair">View linked repair →</Link>}
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            {waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer" data-testid="bill-whatsapp-btn"
                className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2.5 rounded-md text-sm hover:bg-[#1fb457] transition-colors">
                <MessageCircle size={14} /> Send on WhatsApp
              </a>
            ) : (
              <button className={btnGhost} disabled title="No valid customer phone on this bill" data-testid="bill-whatsapp-disabled">
                <MessageCircle size={14} /> Send on WhatsApp
              </button>
            )}
            <button className={btnGhost} onClick={copyReference} data-testid="bill-copy-reference-btn">
              <Copy size={14} /> Copy Bill Reference
            </button>
          </div>
        </div>
      </div>

      {confirmMode && confirmMode !== "delete" && (
        <ConfirmModal
          title={confirmMode === "archive" ? "Archive this bill?" : "Restore this bill?"}
          recordLabel={bill.bill_number || "Bill (no number)"}
          message={confirmMode === "archive"
            ? "The photo stays private and safe -- it will just be hidden from the default list. You can restore it any time."
            : "It will reappear in the default bill list, and its photo stays accessible."}
          confirmLabel={confirmMode === "archive" ? "Archive" : "Restore"}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmMode(null)}
        />
      )}

      {confirmMode === "delete" && (
        <ConfirmModal
          title="Permanently delete this bill?"
          recordLabel={bill.bill_number || "Bill (no number)"}
          message="This cannot be undone. The bill record and its reference will be gone for good."
          confirmLabel="Delete Permanently"
          danger
          requireTypedConfirm="DELETE BILL"
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmMode(null)}
        />
      )}
    </div>
  );
}
