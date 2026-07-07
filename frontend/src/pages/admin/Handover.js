import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { inp, btnGold, btnGhost, Card, F } from "@/components/admin/ui";
import { Plus, X, Check, RotateCcw, RefreshCw } from "lucide-react";

const EMPTY = { title: "", description: "", due_date_ad: "", priority: "normal" };

export default function Handover() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [showDone, setShowDone] = useState(false);

  const load = () => {
    setError(null);
    api.get("/admin/tasks").then((r) => setTasks(r.data))
      .catch((err) => { console.error("Handover tasks load failed:", err); setError(apiError(err)); });
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim()) return toast.error("Enter a note or task");
    try {
      await api.post("/admin/tasks", { ...form, due_date_ad: form.due_date_ad || null });
      toast.success("Added to handover list");
      setForm(null); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/admin/tasks/${id}`, { status });
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  if (error && !tasks) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-6 text-center space-y-3">
        <p className="text-red-700 font-medium">Could not load data. Please refresh or contact admin.</p>
        <p className="text-xs text-slate-400">{error}</p>
        <button className={btnGhost} onClick={load} data-testid="handover-retry-btn"><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }
  if (!tasks) return <p className="text-sm text-slate-500">Loading…</p>;

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Handover Notes</h1>
          <p className="text-sm text-slate-500">Leave a note for whoever is running the shop next — customer pickups, pending repairs, reminders.</p>
        </div>
        <button className={btnGold} onClick={() => setForm({ ...EMPTY })} data-testid="add-handover-btn"><Plus size={16} /> Add Note</button>
      </div>

      <Card title={`Open (${open.length})`}>
        <div className="space-y-2" data-testid="handover-open-list">
          {open.length === 0 && <p className="text-xs text-slate-400">Nothing pending — all clear.</p>}
          {open.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 border-b border-slate-50 py-2" data-testid={`handover-item-${t.id}`}>
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.priority === "high" && <span className="text-[#991B1B] font-semibold mr-2">High priority</span>}
                  {t.due_date_ad ? `Due ${t.due_date_ad}` : "No due date"}
                </p>
              </div>
              <button className={btnGhost} onClick={() => setStatus(t.id, "done")} data-testid={`handover-done-${t.id}`}>
                <Check size={14} /> Done
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <button className="text-xs text-slate-500 underline" onClick={() => setShowDone(!showDone)} data-testid="handover-toggle-done">
          {showDone ? "Hide" : "Show"} completed ({done.length})
        </button>
      </div>

      {showDone && (
        <Card title={`Completed (${done.length})`}>
          <div className="space-y-2" data-testid="handover-done-list">
            {done.length === 0 && <p className="text-xs text-slate-400">Nothing completed yet.</p>}
            {done.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 border-b border-slate-50 py-2 opacity-60">
                <div>
                  <p className="text-sm font-medium line-through">{t.title}</p>
                  {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                </div>
                <button className={btnGhost} onClick={() => setStatus(t.id, "pending")} data-testid={`handover-reopen-${t.id}`}>
                  <RotateCcw size={14} /> Reopen
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-md w-full max-w-md p-5" data-testid="handover-form-modal">
            <div className="flex justify-between mb-4"><h2 className="font-bold">Add Handover Note</h2><button onClick={() => setForm(null)}><X size={18} /></button></div>
            <div className="space-y-3">
              <F label="Note *"><input className={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Customer Ram pickup ring tomorrow" data-testid="handover-title-input" /></F>
              <F label="Details"><textarea rows={2} className={inp} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="handover-description-input" /></F>
              <F label="Due Date (optional)"><input type="date" className={inp} value={form.due_date_ad} onChange={(e) => setForm({ ...form, due_date_ad: e.target.value })} data-testid="handover-due-date-input" /></F>
              <F label="Priority"><select className={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} data-testid="handover-priority-select"><option value="normal">Normal</option><option value="high">High</option></select></F>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
              <button className={btnGold} onClick={create} data-testid="handover-save-btn">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
