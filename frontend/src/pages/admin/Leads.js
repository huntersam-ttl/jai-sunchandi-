import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/format";
import { inp, Badge } from "@/components/admin/ui";

export default function Leads() {
  const [leads, setLeads] = useState([]);

  const load = () => api.get("/admin/leads").then((r) => setLeads(r.data));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await api.patch(`/admin/leads/${id}/status`, { status });
    toast.success("Lead updated");
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leads (Website Requests)</h1>
      <div className="grid lg:grid-cols-2 gap-4" data-testid="leads-list">
        {leads.length === 0 && <p className="text-sm text-slate-400">No leads yet. Custom order and repair requests from the website appear here.</p>}
        {leads.map((l) => (
          <div key={l.id} className="bg-white border border-slate-200 rounded-md p-4" data-testid={`lead-card-${l.phone}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{l.name} · {l.phone}</p>
                <p className="text-xs text-slate-500 capitalize">{l.lead_type.replace("_", " ")} · {new Date(l.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={l.status} colors={STATUS_COLORS} />
                <select className={inp} style={{ width: 120 }} value={l.status} onChange={(e) => setStatus(l.id, e.target.value)} data-testid={`lead-status-${l.phone}`}>
                  {["new", "contacted", "converted", "closed"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-600 space-y-0.5">
              {l.item_type && <p>Item: {l.item_type} ({l.metal})</p>}
              {l.service_type && <p>Service: {l.service_type}</p>}
              {l.approx_weight && <p>Weight: {l.approx_weight} tola · Budget: {l.budget || "—"}</p>}
              {l.deadline && <p>Deadline: {l.deadline}</p>}
              {l.notes && <p className="text-xs">Notes: {l.notes}</p>}
              {l.photo && <img src={l.photo} alt="lead" className="h-20 rounded border mt-1" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
