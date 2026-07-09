import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { inp, btnGold, btnGhost, F, ConfirmModal } from "@/components/admin/ui";
import { Plus, X, Archive, RotateCcw } from "lucide-react";

const PAGE_SIZE = 50;

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [archivedFilter, setArchivedFilter] = useState("active");
  const [form, setForm] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { customer, mode: "archive" | "restore" }

  const load = (query = "", archived = archivedFilter) =>
    api.get("/admin/customers", { params: { limit: PAGE_SIZE, q: query || undefined, archived } })
      .then((r) => { setCustomers(r.data.items); setTotal(r.data.total); })
      .catch((err) => { console.error("Customers load failed:", err); toast.error(apiError(err)); });

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; load(""); return; }
    const t = setTimeout(() => { setQ(qInput); load(qInput); }, 350);
    return () => clearTimeout(t);
  }, [qInput]); // eslint-disable-line

  useEffect(() => {
    if (firstRun.current) return;
    load(q, archivedFilter);
  }, [archivedFilter]); // eslint-disable-line

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await api.get("/admin/customers", {
        params: { limit: PAGE_SIZE, offset: customers.length, q: q || undefined, archived: archivedFilter },
      });
      setCustomers((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (err) { toast.error(apiError(err)); } finally { setLoadingMore(false); }
  };

  const save = async () => {
    if (!form.name || !form.phone) return toast.error("Name and phone required");
    try {
      if (form.id) await api.put(`/admin/customers/${form.id}`, form);
      else await api.post("/admin/customers", form);
      toast.success("Customer saved");
      setForm(null); load(q);
    } catch (e) { toast.error(apiError(e)); }
  };

  const runConfirmedAction = async () => {
    const { customer, mode } = confirmAction;
    try {
      await api.post(`/admin/customers/${customer.id}/${mode}`);
      toast.success(mode === "archive" ? "Customer archived" : "Customer restored");
      setConfirmAction(null);
      load(q);
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex gap-2">
          <input className={inp} style={{ width: 220 }} placeholder="Search name/phone…" value={qInput}
            onChange={(e) => setQInput(e.target.value)} data-testid="customers-search-input" />
          <select className={inp} style={{ width: 130 }} value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value)} data-testid="customers-archived-filter">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <button className={btnGold} onClick={() => setForm({ name: "", phone: "", address: "", notes: "" })} data-testid="add-customer-btn"><Plus size={16} /> Add Customer</button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="p-3">Name</th><th>Phone</th><th>Address</th><th>Notes</th><th></th></tr></thead>
          <tbody data-testid="customers-table">
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3">
                  <Link to={`/admin/customers/${c.id}`} className="font-semibold text-[#0F172A] hover:text-[#D4AF37]" data-testid={`customer-link-${c.phone}`}>{c.name}</Link>
                  {c.is_deleted && <span className="ml-1 inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Archived</span>}
                </td>
                <td>{c.phone}</td><td>{c.address || "—"}</td><td className="text-xs text-slate-500">{c.notes || "—"}</td>
                <td className="p-2">
                  {c.is_deleted ? (
                    <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setConfirmAction({ customer: c, mode: "restore" })} data-testid={`restore-customer-${c.phone}`}><RotateCcw size={16} /></button>
                  ) : (
                    <button className="p-2 hover:bg-amber-50 text-amber-700 rounded" onClick={() => setConfirmAction({ customer: c, mode: "archive" })} data-testid={`archive-customer-${c.phone}`}><Archive size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>

      {customers.length < total && (
        <div className="flex justify-center">
          <button className={btnGhost} onClick={loadMore} disabled={loadingMore} data-testid="customers-load-more">
            {loadingMore ? "Loading…" : `Load more (${customers.length} of ${total})`}
          </button>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-md w-full max-w-md p-5" data-testid="customer-form-modal">
            <div className="flex justify-between mb-4"><h2 className="font-bold">{form.id ? "Edit" : "Add"} Customer</h2><button onClick={() => setForm(null)}><X size={18} /></button></div>
            <div className="space-y-3">
              <F label="Name *"><input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="cf-name" /></F>
              <F label="Phone *"><input className={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="cf-phone" /></F>
              <F label="Address"><input className={inp} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="cf-address" /></F>
              <F label="Notes"><textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="cf-notes" /></F>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
              <button className={btnGold} onClick={save} data-testid="cf-save-btn">Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.mode === "archive" ? "Archive this customer?" : "Restore this customer?"}
          recordLabel={`${confirmAction.customer.name} (${confirmAction.customer.phone})`}
          message={confirmAction.mode === "archive"
            ? "Their order/repair/bill history is kept -- they'll just be hidden from the active customer list and search. You can restore them any time."
            : "They'll reappear in the active customer list and search."}
          confirmLabel={confirmAction.mode === "archive" ? "Archive" : "Restore"}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
