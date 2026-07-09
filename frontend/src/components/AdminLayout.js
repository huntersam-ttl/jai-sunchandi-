import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import AdminQuickSearch from "@/components/admin/AdminQuickSearch";
import { LayoutDashboard, Gem, Users, ClipboardList, Receipt, Wrench, Award, Inbox, TrendingUp, BarChart3, LogOut, Menu, X, Settings, ClipboardCheck, Wallet, Banknote, BookOpen, Calculator, Image } from "lucide-react";
const nav = [
  { to: "/admin", label: "Today", icon: LayoutDashboard, end: true },
  { to: "/admin/handover", label: "Handover", icon: ClipboardCheck },
  { to: "/admin/rates", label: "Daily Rates", icon: TrendingUp },
  { to: "/admin/calculator", label: "Calculator", icon: Calculator },
  { to: "/admin/products", label: "Products", icon: Gem },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/customer-dues", label: "Customer Dues", icon: Wallet },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/expenses", label: "Expenses", icon: Banknote },
  { to: "/admin/cashbook", label: "Cashbook", icon: BookOpen },
  { to: "/admin/repairs", label: "Repairs", icon: Wrench },
  { to: "/admin/leads", label: "Leads", icon: Inbox },
  { to: "/admin/bills", label: "Bills Archive", icon: Image },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];
// Phase 2 — not wired to the backend yet; shown as disabled so they don't
// look like broken links.
const comingSoon = [
  { label: "Invoices", icon: Receipt },
  { label: "Certificates", icon: Award },
];
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const shopSettings = useSettings();
  const [open, setOpen] = useState(false);
  if (user === null) return <div className="min-h-screen flex items-center justify-center font-admin">Loading…</div>;
  if (user === false) return <Navigate to="/admin/login" replace />;
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-admin flex">
      <aside className={`no-print fixed lg:static inset-y-0 left-0 z-40 w-60 bg-[#0F172A] text-slate-300 flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 border-b border-slate-800">
          {shopSettings.logo ? (
            <img src={shopSettings.logo} alt="logo" className="h-8 mb-1 object-contain" />
          ) : null}
          <p className="text-white font-bold text-sm leading-tight">{shopSettings.shop_name}</p>
          <p className="text-[#D4AF37] text-xs mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
              data-testid={`admin-nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-200 ${isActive ? "bg-slate-800 text-[#D4AF37] border-l-2 border-[#D4AF37]" : "hover:bg-slate-800/60"}`}>
              <n.icon size={17} strokeWidth={1.5} /> {n.label}
            </NavLink>
          ))}
          {comingSoon.map((n) => (
            <div key={n.label} data-testid={`admin-nav-${n.label.toLowerCase()}-soon`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed" title="Coming soon">
              <span className="flex items-center gap-3"><n.icon size={17} strokeWidth={1.5} /> {n.label}</span>
              <span className="text-[10px] uppercase tracking-wide bg-slate-800 text-slate-400 rounded px-1.5 py-0.5">Soon</span>
            </div>
          ))}
        </nav>
        <button onClick={logout} data-testid="admin-logout-btn"
          className="flex items-center gap-3 px-4 py-3 text-sm border-t border-slate-800 hover:text-red-400 transition-colors">
          <LogOut size={17} strokeWidth={1.5} /> Logout
        </button>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex-1 min-w-0">
        <header className="no-print sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="admin-mobile-menu"><Menu size={20} /></button>
          <AdminQuickSearch />
        </header>
        <main className="p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
