import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { rs } from "@/lib/format";
import { uploadImage } from "@/lib/storage";
import { inp, btnGold, btnGhost, F } from "@/components/admin/ui";
import { Plus, X, Image as ImageIcon } from "lucide-react";

const PAGE_SIZE = 24;
const PAYMENT_STATUSES = ["unknown", "unpaid", "partial", "paid"];
const EMPTY = {
  bill_number: "", customer_name: "", customer_phone: "", bill_date: "",
  total_amount: "", payment_status: "unknown", notes: "",
  related_order_id: "", related_repair_id: "", related_customer_id: "",
  image_path: "", preview: "",
};

export default function Bills() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [bills, setBills] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [form, setForm] = useState(null);

  const load = (query = q) =>
    api.get("/admin/bills", {
      params: {
        limit: PAGE_SIZE, q: query || undefined,
        payment_status: paymentStatus || undefined,
        start_date: startDate || undefined, end_date: endDate || undefined,
      },
    })
      .then((r) => { setBills(r.data.items); setTotal(r.data.total); })
      .catch((err) => { console.error("Bills load failed:", err); toast.error(apiError(err)); });

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; load(""); return; }
    const t = setTimeout(() => { setQ(qInput); load(qInput); }, 350);
    return () => clearTimeout(t);
  }, [qInput]); // eslint-disable-line

  // Only needed for the "link to existing..." dropdowns in the upload form,
  // not for the list/search itself -- capped high like the order form's
  // pickers since these are select options, not a paginated view.
  useEffect(() => {
    api.get("/admin/customers", { params: { limit: 1000 } }).then((r) => setCustomers(r.data.items)).catch(() => {});
    api.get("/admin/orders", { params: { limit: 200 } }).then((r) => setOrders(r.data.items)).catch(() => {});
    api.get("/admin/repairs").then((r) => setRepairs(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (firstRun.current) return;
    load(q);
  }, [paymentStatus, startDate, endDate]); // eslint-disable-line

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await api.get("/admin/bills", {
        params: {
          limit: PAGE_SIZE, offset: bills.length, q: q || undefined,
          payment_status: paymentStatus || undefined, start_date: startDate || undefined, end_date: endDate || undefined,
        },
      });
      setBills((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (err) { toast.error(apiError(err)); } finally { setLoadingMore(false); }
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { path } = await uploadImage(f, "bill");
      setForm((prev) => ({ ...prev, image_path: path, preview: URL.createObjectURL(f) }));
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const save = async () => {
    if (!form.image_path) return toast.error("Upload a photo of the bill first");
    try {
      await api.post("/admin/bills", {
        bill_number: form.bill_number || null, customer_name: form.customer_name || null,
        customer_phone: form.customer_phone || null, bill_date: form.bill_date || null,
        total_amount: form.total_amount === "" ? null : +form.total_amount,
        payment_status: form.payment_status, notes: form.notes || null,
        related_order_id: form.related_order_id || null,
        related_repair_id: form.related_repair_id || null,
        related_customer_id: form.related_customer_id || null,
        image_path: form.image_path,
      });
      toast.success("Bill photo saved");
      setForm(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bills Archive</h1>
        <button className={btnGold} onClick={() => setForm({ ...EMPTY })} data-testid="add-bill-btn">
          <Plus size={16} /> Upload Bill Photo
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className={inp} style={{ width: 240 }} placeholder="Search phone, name, bill or order/repair no…"
          value={qInput} onChange={(e) => setQInput(e.target.value)} data-testid="bills-search-input" />
        <select className={inp} style={{ width: 150 }} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} data-testid="bills-status-filter">
          <option value="">All payment status</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className={inp} style={{ width: 150 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="bills-start-date" />
        <input type="date" className={inp} style={{ width: 150 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="bills-end-date" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="bills-grid">
        {bills.map((b) => (
          <Link key={b.id} to={`/admin/bills/${b.id}`} data-testid={`bill-card-${b.id}`}
            className="bg-white border border-slate-200 rounded-md overflow-hidden hover:-translate-y-0.5 hover:shadow-sm transition-all">
            <div className="h-28 bg-slate-100 flex items-center justify-center">
              {b.photo_url ? (
                <img src={b.photo_url} alt="Bill" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="text-slate-300" size={28} />
              )}
            </div>
            <div className="p-2 text-xs space-y-0.5">
              <p className="font-semibold truncate">{b.bill_number || "No bill #"}</p>
              <p className="text-slate-500 truncate">{b.customer_name || "—"} {b.customer_phone && `· ${b.customer_phone}`}</p>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{b.bill_date || "—"}</span>
                {b.total_amount != null && <span className="font-semibold">{rs(b.total_amount)}</span>}
              </div>
            </div>
          </Link>
        ))}
        {bills.length === 0 && (
          <p className="col-span-full text-center text-slate-400 py-10" data-testid="bills-empty">
            No bill photos yet. Upload the first one.
          </p>
        )}
      </div>

      {bills.length < total && (
        <div className="flex justify-center">
          <button className={btnGhost} onClick={loadMore} disabled={loadingMore} data-testid="bills-load-more">
            {loadingMore ? "Loading…" : `Load more (${bills.length} of ${total})`}
          </button>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-md w-full max-w-2xl my-6 p-5" data-testid="bill-form-modal">
            <div className="flex justify-between mb-4">
              <h2 className="font-bold">Upload Bill Photo</h2>
              <button onClick={() => setForm(null)}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <F label="Bill Photo *" className="sm:col-span-2">
                <input type="file" accept="image/*" capture="environment" className="text-sm" onChange={onPhoto} data-testid="bill-photo-input" />
                {form.preview && <img src={form.preview} alt="Bill preview" className="mt-2 h-40 rounded border object-contain" data-testid="bill-photo-preview" />}
              </F>
              <F label="Bill Number"><input className={inp} value={form.bill_number} onChange={(e) => setForm({ ...form, bill_number: e.target.value })} data-testid="bill-number-input" /></F>
              <F label="Bill Date"><input type="date" className={inp} value={form.bill_date} onChange={(e) => setForm({ ...form, bill_date: e.target.value })} data-testid="bill-date-input" /></F>
              <F label="Customer Name"><input className={inp} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} data-testid="bill-customer-name-input" /></F>
              <F label="Customer Phone"><input className={inp} value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} data-testid="bill-customer-phone-input" /></F>
              <F label="Amount"><input className={inp} type="number" step="any" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} data-testid="bill-amount-input" /></F>
              <F label="Payment Status">
                <select className={inp} value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} data-testid="bill-status-input">
                  {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </F>
              <F label="Link to Customer (optional)">
                <select className={inp} value={form.related_customer_id} onChange={(e) => setForm({ ...form, related_customer_id: e.target.value })} data-testid="bill-link-customer">
                  <option value="">—</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </F>
              <F label="Link to Order (optional)">
                <select className={inp} value={form.related_order_id} onChange={(e) => setForm({ ...form, related_order_id: e.target.value })} data-testid="bill-link-order">
                  <option value="">—</option>
                  {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number} ({o.customer_name})</option>)}
                </select>
              </F>
              <F label="Link to Repair (optional)" className="sm:col-span-2">
                <select className={inp} value={form.related_repair_id} onChange={(e) => setForm({ ...form, related_repair_id: e.target.value })} data-testid="bill-link-repair">
                  <option value="">—</option>
                  {repairs.map((r) => <option key={r.id} value={r.id}>{r.repair_number} ({r.customer_name})</option>)}
                </select>
              </F>
              <F label="Notes" className="sm:col-span-2"><textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="bill-notes-input" /></F>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
              <button className={btnGold} onClick={save} data-testid="bill-save-btn">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
