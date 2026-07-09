import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { rs, STATUS_COLORS } from "@/lib/format";
import { computeQuote, resolveRatePerTola } from "@/lib/calculator";
import { inp, btnGold, btnGhost, Badge, F, ConfirmModal } from "@/components/admin/ui";
import { Plus, X, Trash2, Archive, RotateCcw } from "lucide-react";

const ORDER_STATUSES = ["new", "in_progress", "making", "polishing", "ready", "delivered", "cancelled"];
const PAGE_SIZE = 50;

export default function Orders() {
  // Dashboard shortcuts land here with ?new=1 (open the form right away) or
  // ?status=ready (pre-filter) instead of making the admin click twice.
  const [params] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(() => params.get("status") || "");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [archivedFilter, setArchivedFilter] = useState("active");
  const [showForm, setShowForm] = useState(() => params.get("new") === "1");
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { order, mode: "archive" | "restore" }

  const load = (query = q) =>
    api.get("/admin/orders", { params: { limit: PAGE_SIZE, status: status || undefined, q: query || undefined, archived: archivedFilter } })
      .then((r) => { setOrders(r.data.items); setTotal(r.data.total); })
      .catch((err) => { console.error("Orders load failed:", err); toast.error(apiError(err)); });

  useEffect(() => { load(q); }, [status, archivedFilter]); // eslint-disable-line

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { setQ(qInput); load(qInput); }, 350);
    return () => clearTimeout(t);
  }, [qInput]); // eslint-disable-line

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await api.get("/admin/orders", {
        params: { limit: PAGE_SIZE, offset: orders.length, status: status || undefined, q: q || undefined, archived: archivedFilter },
      });
      setOrders((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (err) { toast.error(apiError(err)); } finally { setLoadingMore(false); }
  };

  const runConfirmedAction = async () => {
    const { order, mode } = confirmAction;
    try {
      await api.post(`/admin/orders/${order.id}/${mode}`);
      toast.success(mode === "archive" ? "Order archived" : "Order restored");
      setConfirmAction(null);
      load(q);
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex gap-2">
          <input className={inp} style={{ width: 200 }} placeholder="Search order, customer, phone…"
            value={qInput} onChange={(e) => setQInput(e.target.value)} data-testid="orders-search-input" />
          <select className={inp} style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)} data-testid="orders-status-filter">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select className={inp} style={{ width: 130 }} value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value)} data-testid="orders-archived-filter">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <button className={btnGold} onClick={() => setShowForm(true)} data-testid="add-order-btn"><Plus size={16} /> New Order</button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b">
            <th className="p-3">Order</th><th>Customer</th><th>Type</th><th>Delivery</th><th>Net Payable</th><th>Remaining</th><th>Status</th><th></th></tr></thead>
          <tbody data-testid="orders-table">
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-3">
                  <Link to={`/admin/orders/${o.id}`} className="font-semibold hover:text-[#D4AF37]" data-testid={`order-link-${o.order_number}`}>{o.order_number}</Link>
                  {o.is_deleted && <span className="ml-1 inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Archived</span>}
                </td>
                <td>{o.customer_name}<br /><span className="text-xs text-slate-400">{o.customer_phone}</span></td>
                <td className="capitalize">{o.order_type.replace("_", " ")}</td>
                <td>{o.delivery_date_ad || "—"}{o.delivery_date_bs_np && <><br /><span className="text-xs text-slate-400">BS {o.delivery_date_bs_np}</span></>}</td>
                <td className="font-semibold">{rs(o.net_payable)}</td>
                <td className="text-[#991B1B] font-semibold">{rs(o.remaining_balance)}</td>
                <td><Badge status={o.status} colors={STATUS_COLORS} /></td>
                <td className="p-2">
                  {o.is_deleted ? (
                    <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setConfirmAction({ order: o, mode: "restore" })} data-testid={`restore-order-${o.order_number}`}><RotateCcw size={16} /></button>
                  ) : (
                    <button className="p-2 hover:bg-amber-50 text-amber-700 rounded" onClick={() => setConfirmAction({ order: o, mode: "archive" })} data-testid={`archive-order-${o.order_number}`}><Archive size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {orders.length < total && (
        <div className="flex justify-center">
          <button className={btnGhost} onClick={loadMore} disabled={loadingMore} data-testid="orders-load-more">
            {loadingMore ? "Loading…" : `Load more (${orders.length} of ${total})`}
          </button>
        </div>
      )}
      {showForm && <OrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.mode === "archive" ? "Archive this order?" : "Restore this order?"}
          recordLabel={`${confirmAction.order.order_number} — ${confirmAction.order.customer_name}`}
          message={confirmAction.mode === "archive"
            ? "The receipt and payment history are kept -- it will just be hidden from the active order list. You can restore it any time."
            : "It will reappear in the active order list."}
          confirmLabel={confirmAction.mode === "archive" ? "Archive" : "Restore"}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

const EMPTY_ITEM = { product_id: null, name: "", metal: "gold", purity: "24K", weight_grams: "", rate_per_tola: "", jarti_percent: 0, jyala_amount: 0, jyala_type: "flat", stone_cost: 0, polishing_cost: 0, cutting_cost: 0, worker_charge: 0, other_cost: 0, discount: 0 };

function OrderForm({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [rate, setRate] = useState(null);
  const [form, setForm] = useState({ customer_id: "", order_type: "purchase", delivery_date_ad: "", delivery_time: "", notes: "", custom_description: "" });
  const [items, setItems] = useState([]);
  const [oldGold, setOldGold] = useState({ enabled: false, old_item_description: "", old_weight_tola: "", old_valuation_rate_per_tola: "", old_deduction_percent: "" });

  useEffect(() => {
    // These populate dropdowns for the order form -- they need the full
    // available set, not a paginated page, so ask for a high limit.
    api.get("/admin/customers", { params: { limit: 1000 } }).then((r) => setCustomers(r.data.items))
      .catch((err) => console.error("Customers load failed:", err));
    api.get("/admin/products", { params: { status: "available", limit: 1000 } }).then((r) => setProducts(r.data.items))
      .catch((err) => console.error("Products load failed:", err));
    api.get("/rates/today").then((r) => setRate(r.data)).catch((err) => console.error("Rate load failed:", err));
  }, []);

  const addStockItem = (pid) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    // Resolve by the product's actual purity, not always the 24K rate --
    // a 22K/18K stock item used to get prefilled with the 24K figure.
    const rpt = resolveRatePerTola(rate, p.metal, p.purity) || 0;
    setItems([...items, { ...EMPTY_ITEM, product_id: p.id, name: `${p.name} (${p.product_code})`, metal: p.metal, purity: p.purity, weight_grams: p.weight_grams, rate_per_tola: rpt, jarti_percent: p.jarti_percent, jyala_amount: p.jyala_amount, jyala_type: p.jyala_type, stone_cost: p.stone_cost, polishing_cost: p.polishing_cost, cutting_cost: p.cutting_cost, worker_charge: p.worker_charge, other_cost: p.other_cost }]);
  };

  const addCustomItem = () => {
    const rpt = resolveRatePerTola(rate, "gold", "24K") || 0;
    setItems([...items, { ...EMPTY_ITEM, rate_per_tola: rpt }]);
  };

  const setItem = (i, k, v) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));

  // Same computeQuote() the calculator page and product form use -- one
  // formula for metal value/jarti/jyala/extras/discount, not three.
  const itemTotal = (it) => computeQuote({
    weightGrams: it.weight_grams, ratePerTola: it.rate_per_tola, purity: it.purity,
    jartiPercent: it.jarti_percent, jyalaAmount: it.jyala_amount, jyalaType: it.jyala_type,
    stoneCost: it.stone_cost, polishingCost: it.polishing_cost, cuttingCost: it.cutting_cost,
    workerCharge: it.worker_charge, otherCost: it.other_cost, discount: it.discount,
  }).finalPrice;

  const total = items.reduce((s, it) => s + itemTotal(it), 0);
  const oldValue = oldGold.enabled ? (+oldGold.old_weight_tola || 0) * (+oldGold.old_valuation_rate_per_tola || 0) * (1 - (+oldGold.old_deduction_percent || 0) / 100) : 0;
  const net = total - oldValue;

  const save = async () => {
    if (!form.customer_id) return toast.error("Select a customer");
    if (items.length === 0 && form.order_type === "purchase") return toast.error("Add at least one item");
    try {
      await api.post("/admin/orders", {
        ...form,
        delivery_date_ad: form.delivery_date_ad || null,
        items: items.map((it) => ({ ...it, weight_grams: +it.weight_grams, rate_per_tola: +it.rate_per_tola, jarti_percent: +it.jarti_percent || 0, jyala_amount: +it.jyala_amount || 0, stone_cost: +it.stone_cost || 0, polishing_cost: +it.polishing_cost || 0, cutting_cost: +it.cutting_cost || 0, worker_charge: +it.worker_charge || 0, other_cost: +it.other_cost || 0, discount: +it.discount || 0 })),
        old_gold: oldGold.enabled ? { old_item_description: oldGold.old_item_description, old_weight_tola: +oldGold.old_weight_tola || 0, old_valuation_rate_per_tola: +oldGold.old_valuation_rate_per_tola || 0, old_deduction_percent: +oldGold.old_deduction_percent || 0 } : null,
      });
      toast.success("Order created");
      onSaved();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-md w-full max-w-4xl my-6" data-testid="order-form-modal">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h2 className="font-bold">New Order</h2>
          <button onClick={onClose} data-testid="order-form-close"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            <F label="Customer *">
              <select className={inp} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} data-testid="of-customer">
                <option value="">Select…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
              </select>
            </F>
            <F label="Order Type">
              <select className={inp} value={form.order_type} onChange={(e) => setForm({ ...form, order_type: e.target.value })} data-testid="of-type">
                <option value="purchase">Purchase (stock)</option>
                <option value="custom_order">Custom Order</option>
                <option value="repair">Repair/Polish</option>
              </select>
            </F>
            <F label="Delivery Date (AD)"><input type="date" className={inp} value={form.delivery_date_ad} onChange={(e) => setForm({ ...form, delivery_date_ad: e.target.value })} data-testid="of-delivery-date" /></F>
            <F label="Delivery Time"><input className={inp} value={form.delivery_time} onChange={(e) => setForm({ ...form, delivery_time: e.target.value })} placeholder="e.g. 3pm" data-testid="of-delivery-time" /></F>
          </div>
          {form.order_type !== "purchase" && (
            <F label="Custom Description"><textarea rows={2} className={inp} value={form.custom_description} onChange={(e) => setForm({ ...form, custom_description: e.target.value })} data-testid="of-custom-desc" /></F>
          )}

          <div className="border border-slate-200 rounded-md p-3">
            {!rate && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2 mb-3">
                Today's rate not published yet — items will prefill with rate 0/tola; enter a rate per item manually below.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="font-semibold text-sm">Items</p>
              <div className="flex gap-2">
                <select className={inp} style={{ width: 220 }} onChange={(e) => { if (e.target.value) { addStockItem(e.target.value); e.target.value = ""; } }} data-testid="of-add-stock-item">
                  <option value="">+ Add from stock…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.product_code})</option>)}
                </select>
                <button className={btnGhost} onClick={addCustomItem} data-testid="of-add-custom-item"><Plus size={14} /> Custom item</button>
              </div>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-3 bg-slate-50 p-2 rounded items-end" data-testid={`of-item-${i}`}>
                <F label="Name" className="col-span-2"><input className={inp} value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} data-testid={`of-item-name-${i}`} /></F>
                <F label="Purity"><select className={inp} value={it.purity} onChange={(e) => setItem(i, "purity", e.target.value)} data-testid={`of-item-purity-${i}`}>{["24K", "22K", "18K", "silver"].map((p) => <option key={p}>{p}</option>)}</select></F>
                <F label="Weight (g)"><input className={inp} type="number" step="any" value={it.weight_grams} onChange={(e) => setItem(i, "weight_grams", e.target.value)} data-testid={`of-item-weight-${i}`} /></F>
                <F label="Rate/tola"><input className={inp} type="number" step="any" value={it.rate_per_tola} onChange={(e) => setItem(i, "rate_per_tola", e.target.value)} data-testid={`of-item-rate-${i}`} /></F>
                <F label="Jarti %"><input className={inp} type="number" step="any" value={it.jarti_percent} onChange={(e) => setItem(i, "jarti_percent", e.target.value)} data-testid={`of-item-jarti-${i}`} /></F>
                <F label="Jyala"><input className={inp} type="number" step="any" value={it.jyala_amount} onChange={(e) => setItem(i, "jyala_amount", e.target.value)} data-testid={`of-item-jyala-${i}`} /></F>
                <F label="Jyala Type"><select className={inp} value={it.jyala_type} onChange={(e) => setItem(i, "jyala_type", e.target.value)}><option value="flat">Flat</option><option value="per_tola">Per Tola</option></select></F>
                <F label="Stone"><input className={inp} type="number" step="any" value={it.stone_cost} onChange={(e) => setItem(i, "stone_cost", e.target.value)} /></F>
                <F label="Other"><input className={inp} type="number" step="any" value={it.other_cost} onChange={(e) => setItem(i, "other_cost", e.target.value)} /></F>
                <F label="Discount"><input className={inp} type="number" step="any" value={it.discount} onChange={(e) => setItem(i, "discount", e.target.value)} /></F>
                <div className="flex items-center justify-between col-span-2">
                  <b className="text-sm" data-testid={`of-item-total-${i}`}>{rs(itemTotal(it))}</b>
                  <button className="text-red-600 p-1" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-slate-400">No items added.</p>}
            {items.length > 0 && <p className="text-xs text-slate-400 mt-1">Each item's total is calculated automatically from weight, purity, rate, jarti/jyala and extra charges.</p>}
          </div>

          <div className="border border-amber-200 bg-amber-50/40 rounded-md p-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={oldGold.enabled} onChange={(e) => setOldGold({ ...oldGold, enabled: e.target.checked })} data-testid="of-oldgold-toggle" />
              Old Gold/Silver Exchange (पुरानो सुन सट्टा)
            </label>
            {oldGold.enabled && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <F label="Description" className="col-span-2"><input className={inp} value={oldGold.old_item_description} onChange={(e) => setOldGold({ ...oldGold, old_item_description: e.target.value })} data-testid="of-oldgold-desc" /></F>
                <F label="Weight (tola)"><input className={inp} type="number" step="any" value={oldGold.old_weight_tola} onChange={(e) => setOldGold({ ...oldGold, old_weight_tola: e.target.value })} data-testid="of-oldgold-weight" /></F>
                <F label="Valuation rate/tola"><input className={inp} type="number" step="any" value={oldGold.old_valuation_rate_per_tola} onChange={(e) => setOldGold({ ...oldGold, old_valuation_rate_per_tola: e.target.value })} data-testid="of-oldgold-rate" /></F>
                <F label="Deduction %"><input className={inp} type="number" step="any" value={oldGold.old_deduction_percent} onChange={(e) => setOldGold({ ...oldGold, old_deduction_percent: e.target.value })} data-testid="of-oldgold-deduction" /></F>
                <p className="col-span-2 text-sm self-end">Old gold value: <b data-testid="of-oldgold-value">{rs(oldValue)}</b></p>
              </div>
            )}
          </div>

          <F label="Notes"><textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="of-notes" /></F>

          <div className="bg-[#0F172A] text-white rounded-md p-4 flex flex-wrap gap-6 text-sm" data-testid="of-totals">
            <span>Total: <b>{rs(total)}</b></span>
            {oldGold.enabled && <span>Old gold: <b className="text-amber-400">- {rs(oldValue)}</b></span>}
            <span>Net Payable: <b className="text-[#D4AF37]" data-testid="of-net-payable">{rs(net)}</b></span>
          </div>
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnGold} onClick={save} data-testid="of-save-btn">Create Order</button>
        </div>
      </div>
    </div>
  );
}
