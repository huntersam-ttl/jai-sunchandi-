import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/format";
import { inp, Badge, ConfirmModal } from "@/components/admin/ui";
import AdminPhoto from "@/components/admin/AdminPhoto";
import { Archive, RotateCcw } from "lucide-react";

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [archivedFilter, setArchivedFilter] = useState("active");
  const [confirmAction, setConfirmAction] = useState(null); // { lead, mode: "archive" | "restore" }

  const load = (archived = archivedFilter) => api.get("/admin/leads", { params: { archived } }).then((r) => setLeads(r.data))
    .catch((err) => { console.error("Leads load failed:", err); toast.error(apiError(err)); });
  useEffect(() => { load(archivedFilter); }, [archivedFilter]); // eslint-disable-line

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/admin/leads/${id}/status`, { status });
      toast.success("Lead updated");
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const runConfirmedAction = async () => {
    const { lead, mode } = confirmAction;
    try {
      await api.post(`/admin/leads/${lead.id}/${mode}`);
      toast.success(mode === "archive" ? "Lead archived" : "Lead restored");
      setConfirmAction(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Leads (Website Requests)</h1>
        <select className={inp} style={{ width: 130 }} value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value)} data-testid="leads-archived-filter">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>
      <div className="grid lg:grid-cols-2 gap-4" data-testid="leads-list">
        {leads.length === 0 && <p className="text-sm text-slate-400">No leads yet. Custom order and repair requests from the website appear here.</p>}
        {leads.map((l) => (
          <div key={l.id} className="bg-white border border-slate-200 rounded-md p-4" data-testid={`lead-card-${l.phone}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">
                  {l.name} · {l.phone}
                  {l.is_deleted && <span className="ml-1 inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Archived</span>}
                </p>
                <p className="text-xs text-slate-500 capitalize">{l.lead_type.replace("_", " ")} · {new Date(l.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={l.status} colors={STATUS_COLORS} />
                <select className={inp} style={{ width: 120 }} value={l.status} onChange={(e) => setStatus(l.id, e.target.value)} data-testid={`lead-status-${l.phone}`}>
                  {["new", "contacted", "converted", "closed"].map((s) => <option key={s}>{s}</option>)}
                </select>
                {l.is_deleted ? (
                  <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setConfirmAction({ lead: l, mode: "restore" })} data-testid={`restore-lead-${l.phone}`}><RotateCcw size={15} /></button>
                ) : (
                  <button className="p-2 hover:bg-amber-50 text-amber-700 rounded" onClick={() => setConfirmAction({ lead: l, mode: "archive" })} data-testid={`archive-lead-${l.phone}`}><Archive size={15} /></button>
                )}
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-600 space-y-0.5">
              {l.item_type && <p>Item: {l.item_type} ({l.metal})</p>}
              {l.service_type && <p>Service: {l.service_type}</p>}
              {l.approx_weight && <p>Weight: {l.approx_weight} tola · Budget: {l.budget || "—"}</p>}
              {l.deadline && <p>Deadline: {l.deadline}</p>}
              {l.notes && <p className="text-xs">Notes: {l.notes}</p>}
              {l.photo && <AdminPhoto src={l.photo} alt="lead" className="h-20 w-20 rounded border mt-1" testId={`lead-photo-${l.phone}`} />}
            </div>
          </div>
        ))}
      </div>

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.mode === "archive" ? "Archive this lead?" : "Restore this lead?"}
          recordLabel={`${confirmAction.lead.name} (${confirmAction.lead.phone})`}
          message={confirmAction.mode === "archive"
            ? "It will be hidden from the active leads list. You can restore it any time."
            : "It will reappear in the active leads list."}
          confirmLabel={confirmAction.mode === "archive" ? "Archive" : "Restore"}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
