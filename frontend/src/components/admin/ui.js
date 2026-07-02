export const inp = "w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] bg-white";
export const btnPrimary = "inline-flex items-center justify-center gap-2 bg-[#0F172A] text-white px-5 py-2.5 rounded-md text-sm font-semibold min-h-[44px] hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50";
export const btnGold = "inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-[#0F172A] px-5 py-2.5 rounded-md text-sm font-semibold min-h-[44px] hover:bg-[#c9a22f] transition-colors duration-200";
export const btnGhost = "inline-flex items-center justify-center gap-2 border border-slate-300 px-4 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors";

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
