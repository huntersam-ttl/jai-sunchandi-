import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { uploadImage } from "@/lib/storage";
import { inp, btnGold, btnGhost, Badge, F, ConfirmModal } from "@/components/admin/ui";
import AdminPhoto from "@/components/admin/AdminPhoto";
import { Plus, X, Pencil, Archive, RotateCcw } from "lucide-react";

const REPAIR_STATUSES = ["received", "working", "ready", "delivered", "cancelled"];
const EMPTY = { customer_id: "", service_type: "repair", description: "", intake_photo: "", damage_photo: "", after_photo: "", promised_date_ad: "", charge: 0, status: "received" };

export default function Repairs() {
  // Dashboard's "New Repair" shortcut lands here with ?new=1 to open the
  // form right away instead of making the admin click twice.
  const [params] = useSearchParams();
  const [repairs, setRepairs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [archivedFilter, setArchivedFilter] = useState("active");
  const [form, setForm] = useState(() => (params.get("new") === "1" ? { ...EMPTY } : null));
  const [confirmAction, setConfirmAction] = useState(null); // { repair, mode: "archive" | "restore" }

  const firstRun = useRef(true);
  const load = (archived = archivedFilter) => api.get("/admin/repairs", { params: { archived } }).then((r) => setRepairs(r.data))
    .catch((err) => { console.error("Repairs load failed:", err); toast.error(apiError(err)); });
  useEffect(() => {
    load();
    api.get("/admin/customers", { params: { limit: 1000 } }).then((r) => setCustomers(r.data.items)).catch((err) => console.error("Customers load failed:", err));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    load(archivedFilter);
  }, [archivedFilter]); // eslint-disable-line

  const save = async () => {
    if (!form.customer_id) return toast.error("Select a customer");
    try {
      const body = { ...form, charge: +form.charge || 0, promised_date_ad: form.promised_date_ad || null };
      if (form.id) await api.put(`/admin/repairs/${form.id}`, body);
      else await api.post("/admin/repairs", body);
      toast.success("Repair job saved");
      setForm(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const runConfirmedAction = async () => {
    const { repair, mode } = confirmAction;
    try {
      await api.post(`/admin/repairs/${repair.id}/${mode}`);
      toast.success(mode === "archive" ? "Repair archived" : "Repair restored");
      setConfirmAction(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const photoInput = (key, label) => (
    <F label={label}>
      <input type="file" accept="image/*" className="text-xs" data-testid={`repair-${key}`}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const { path } = await uploadImage(f, "repair");
            setForm({ ...form, [`${key}_url`]: path, [key]: URL.createObjectURL(f) });
          } catch (err) {
            toast.error(apiError(err));
          }
        }} />
      {form[key] && (
        // A freshly-picked file is a local blob: preview (no auth needed);
        // an existing repair's photo is our admin-auth-protected proxy path.
        form[key].startsWith("blob:")
          ? <img src={form[key]} alt="" className="h-14 mt-1 rounded border" />
          : <AdminPhoto src={form[key]} alt="" className="h-14 w-14 mt-1 rounded border" testId={`repair-${key}-preview`} />
      )}
    </F>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Repair Jobs</h1>
        <div className="flex gap-2">
          <select className={inp} style={{ width: 130 }} value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value)} data-testid="repairs-archived-filter">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <button className={btnGold} onClick={() => setForm({ ...EMPTY })} data-testid="add-repair-btn"><Plus size={16} /> New Repair Job</button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b">
            <th className="p-3">Job</th><th>Customer</th><th>Service</th><th>Promised (BS)</th><th>Charge</th><th>Status</th><th></th></tr></thead>
          <tbody data-testid="repairs-table">
            {repairs.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3 font-semibold">
                  {r.repair_number}
                  {r.is_deleted && <span className="ml-1 inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Archived</span>}
                </td>
                <td>{r.customer_name}<br /><span className="text-xs text-slate-400">{r.customer_phone}</span></td>
                <td className="capitalize">{r.service_type}</td>
                <td>{r.promised_date_bs_np || "—"}</td>
                <td>{rs(r.charge)}</td>
                <td><Badge status={r.status} colors={STATUS_COLORS} /></td>
                <td className="flex gap-1">
                  <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setForm({ ...EMPTY, ...r })} data-testid={`edit-repair-${r.repair_number}`}><Pencil size={15} /></button>
                  {r.is_deleted ? (
                    <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setConfirmAction({ repair: r, mode: "restore" })} data-testid={`restore-repair-${r.repair_number}`}><RotateCcw size={15} /></button>
                  ) : (
                    <button className="p-2 hover:bg-amber-50 text-amber-700 rounded" onClick={() => setConfirmAction({ repair: r, mode: "archive" })} data-testid={`archive-repair-${r.repair_number}`}><Archive size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
            {repairs.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No repair jobs.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-md w-full max-w-2xl my-6 p-5" data-testid="repair-form-modal">
            <div className="flex justify-between mb-4"><h2 className="font-bold">{form.id ? `Edit ${form.repair_number}` : "New Repair Job"}</h2><button onClick={() => setForm(null)}><X size={18} /></button></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <F label="Customer *" className="col-span-2">
                <select className={inp} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} data-testid="repair-customer-select" disabled={!!form.id}>
                  <option value="">Select…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </F>
              <F label="Service">
                <select className={inp} value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} data-testid="repair-service-select">
                  {["repair", "polish", "cleaning"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Promised Date (AD)"><input type="date" className={inp} value={form.promised_date_ad || ""} onChange={(e) => setForm({ ...form, promised_date_ad: e.target.value })} data-testid="repair-date-input" /></F>
              <F label="Charge"><input className={inp} type="number" step="any" value={form.charge} onChange={(e) => setForm({ ...form, charge: e.target.value })} data-testid="repair-charge-input" /></F>
              <F label="Status"><select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} data-testid="repair-status-select">{REPAIR_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Description" className="col-span-3"><textarea rows={2} className={inp} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="repair-desc-input" /></F>
              {photoInput("intake_photo", "Intake Photo")}
              {photoInput("damage_photo", "Damage Photo")}
              {photoInput("after_photo", "After Photo")}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
              <button className={btnGold} onClick={save} data-testid="repair-save-btn">Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.mode === "archive" ? "Archive this repair job?" : "Restore this repair job?"}
          recordLabel={`${confirmAction.repair.repair_number} — ${confirmAction.repair.customer_name}`}
          message={confirmAction.mode === "archive"
            ? "Photos and history are kept -- it will just be hidden from the active repair list. You can restore it any time."
            : "It will reappear in the active repair list."}
          confirmLabel={confirmAction.mode === "archive" ? "Archive" : "Restore"}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
