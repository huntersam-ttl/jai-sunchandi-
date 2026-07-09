import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { rs } from "@/lib/format";
import { btnGold, btnGhost, inp, F, ConfirmModal } from "@/components/admin/ui";
import { Pencil, Plus, RefreshCw, X, Trash2 } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { date_ad: today(), category: "other", description: "", amount: "", payment_method: "cash" };
const categories = ["other", "rent", "salary", "electricity", "tea_snacks", "travel", "packaging", "maintenance"];
const methods = ["cash", "bank", "wallet", "other"];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null); // the expense pending delete confirmation

  const load = () => {
    setLoading(true);
    setError(null);
    api.get("/admin/expenses")
      .then((r) => setExpenses(r.data))
      .catch((err) => {
        console.error("Expenses load failed:", err?.message || err);
        setError(apiError(err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.amount || +form.amount <= 0) return toast.error("Enter a valid expense amount");
    try {
      const body = { ...form, amount: +form.amount };
      if (form.id) await api.patch(`/admin/expenses/${form.id}`, body);
      else await api.post("/admin/expenses", body);
      toast.success("Expense saved");
      setForm(null);
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/admin/expenses/${deleting.id}`);
      toast.success("Expense deleted");
      setDeleting(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  if (loading && expenses.length === 0) return <p className="text-sm text-slate-500">Loading expenses…</p>;

  if (error && expenses.length === 0) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-6 text-center space-y-3">
        <p className="text-red-700 font-medium">Could not load expenses.</p>
        <p className="text-xs text-slate-400">{error}</p>
        <button className={btnGhost} onClick={load}><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-slate-500">Money spent from the shop cashbook</p>
        </div>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          <button className={btnGold} onClick={() => setForm({ ...EMPTY })} data-testid="add-expense-btn"><Plus size={16} /> Add Expense</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b">
              <th className="p-3">Date</th><th>Category</th><th>Description</th><th>Method</th><th>Amount</th><th></th>
            </tr>
          </thead>
          <tbody data-testid="expenses-table">
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3">{e.date_ad}</td>
                <td className="capitalize">{String(e.category).replace(/_/g, " ")}</td>
                <td>{e.description || "—"}</td>
                <td className="capitalize">{e.payment_method}</td>
                <td className="font-bold text-[#991B1B]">{rs(e.amount)}</td>
                <td className="p-2 text-right">
                  <button className="p-2 rounded hover:bg-slate-100" onClick={() => setForm({ ...e })} data-testid={`edit-expense-${e.id}`}>
                    <Pencil size={16} />
                  </button>
                  <button className="p-2 rounded hover:bg-red-50 text-red-600" onClick={() => setDeleting(e)} data-testid={`delete-expense-${e.id}`}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">No expenses recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-md w-full max-w-lg p-5" data-testid="expense-form-modal">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{form.id ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={() => setForm(null)}><X size={18} /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Date"><input className={inp} type="date" value={form.date_ad || today()} onChange={(e) => setForm({ ...form, date_ad: e.target.value })} data-testid="expense-date" /></F>
              <F label="Category">
                <select className={inp} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="expense-category">
                  {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </F>
              <F label="Amount"><input className={inp} type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="expense-amount" /></F>
              <F label="Payment Method">
                <select className={inp} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} data-testid="expense-method">
                  {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </F>
              <F label="Description" className="sm:col-span-2">
                <textarea className={inp} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="expense-description" />
              </F>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
              <button className={btnGold} onClick={save} data-testid="expense-save-btn">Save Expense</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this expense?"
          recordLabel={`${deleting.description || deleting.category} — ${rs(deleting.amount)}`}
          message="This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
