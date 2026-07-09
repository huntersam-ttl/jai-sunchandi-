import { useState } from "react";

export const inp = "w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] bg-white";
export const btnPrimary = "inline-flex items-center justify-center gap-2 bg-[#0F172A] text-white px-5 py-2.5 rounded-md text-sm font-semibold min-h-[44px] hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50";
export const btnGold = "inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-[#0F172A] px-5 py-2.5 rounded-md text-sm font-semibold min-h-[44px] hover:bg-[#c9a22f] transition-colors duration-200";
export const btnGhost = "inline-flex items-center justify-center gap-2 border border-slate-300 px-4 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors";
// Destructive actions only (permanent delete) -- archive/restore use btnAmber
// so red stays reserved for things that can't be undone.
export const btnDanger = "inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50";
export const btnAmber = "inline-flex items-center justify-center gap-2 border border-amber-400 text-amber-700 bg-amber-50 px-4 py-2 rounded-md text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50";

export const F = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

export const Card = ({ title, children, actions }) => (
  <div className="bg-white border border-slate-200 rounded-md">
    {(title || actions) && (
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-sm">{title}</h3>
        <div className="flex gap-2">{actions}</div>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

export const Badge = ({ status, colors }) => (
  <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full capitalize ${colors[status] || "bg-slate-100 text-slate-700"}`}>
    {String(status || "").replace(/_/g, " ")}
  </span>
);

/**
 * Shared confirmation modal for every archive/restore/cancel/delete action --
 * no destructive or semi-destructive action in the admin fires without one.
 * `recordLabel` shows which specific record this affects (name/number), so
 * an admin never confirms a removal without seeing what they're removing.
 * `requireTypedConfirm`, if set, disables the confirm button until the
 * admin types that exact phrase (used only for the one permanent-delete
 * action in the app).
 */
export function ConfirmModal({
  title, message, recordLabel, confirmLabel = "Confirm", danger = false,
  requireTypedConfirm, onConfirm, onCancel,
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const canConfirm = !requireTypedConfirm || typed === requireTypedConfirm;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" data-testid="confirm-modal">
      <div className="bg-white rounded-md w-full max-w-sm p-5">
        <h3 className="font-bold text-lg">{title}</h3>
        {recordLabel && <p className="text-sm font-medium text-slate-700 mt-1" data-testid="confirm-modal-record">{recordLabel}</p>}
        <p className="text-sm text-slate-600 mt-2">{message}</p>
        {requireTypedConfirm && (
          <input className={`${inp} mt-3`} placeholder={`Type "${requireTypedConfirm}" to confirm`}
            value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="confirm-modal-typed-input" />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={onCancel} data-testid="confirm-modal-cancel">Cancel</button>
          <button className={danger ? btnDanger : btnAmber} onClick={confirm} disabled={!canConfirm || busy} data-testid="confirm-modal-confirm">
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
