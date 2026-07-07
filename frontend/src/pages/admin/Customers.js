import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { inp, btnGold, btnGhost, F } from "@/components/admin/ui";
import { Plus, X } from "lucide-react";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);

  const load = (query = "") => api.get("/admin/customers", { params: query ? { q: query } : {} }).then((r) => setCustomers(r.data))
    .catch((err) => { console.error("Customers load failed:", err); toast.error(apiError(err)); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.phone) return toast.error("Name and phone required");
    try {
      if (form.id) await api.put(`/admin/customers/${form.id}`, form);
      else await api.post("/admin/customers", form);
      toast.success("Customer saved");
      setForm(null); load(q);
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex gap-2">
          <input className={inp} style={{ width: 220 }} placeholder="Search name/phone…" value={q}
            onChange={(e) => { setQ(e.target.value); load(e.target.value); }} data-testid="customers-search-input" />
          <button className={btnGold} onClick={() => setForm({ name: "", phone: "", address: "", notes: "" })} data-testid="add-customer-btn"><Plus size={16} /> Add Customer</button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="p-3">Name</th><th>Phone</th><th>Address</th><th>Notes</th></tr></thead>
          <tbody data-testid="customers-table">
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3"><Link to={`/admin/customers/${c.id}`} className="font-semibold text-[#0F172A] hover:text-[#D4AF37]" data-testid={`customer-link-${c.phone}`}>{c.name}</Link></td>
                <td>{c.phone}</td><td>{c.address || "—"}</td><td className="text-xs text-slate-500">{c.notes || "—"}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
