import "@/App.css";
import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import PublicLayout from "@/components/PublicLayout";
import AdminLayout from "@/components/AdminLayout";
import Home from "@/pages/public/Home";
import Rates from "@/pages/public/Rates";
import Catalogue from "@/pages/public/Catalogue";
import ProductDetail from "@/pages/public/ProductDetail";
import CustomOrder from "@/pages/public/CustomOrder";
import Repair from "@/pages/public/Repair";
import OrderStatus from "@/pages/public/OrderStatus";
import About from "@/pages/public/About";
import Contact from "@/pages/public/Contact";
import PrivacyPolicy from "@/pages/public/PrivacyPolicy";
import Terms from "@/pages/public/Terms";
import VerifyInvoice from "@/pages/public/VerifyInvoice";
import VerifyCertificate from "@/pages/public/VerifyCertificate";

// Admin pages are route-based code-split: none of this is needed to render
// the public site or the login form, so it shouldn't be in the bundle a
// phone has to parse before /admin becomes interactive.
const Login = lazy(() => import("@/pages/admin/Login"));
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Handover = lazy(() => import("@/pages/admin/Handover"));
const RatesAdmin = lazy(() => import("@/pages/admin/Rates"));
const Products = lazy(() => import("@/pages/admin/Products"));
const Customers = lazy(() => import("@/pages/admin/Customers"));
const CustomerDues = lazy(() => import("@/pages/admin/CustomerDues"));
const CustomerDetail = lazy(() => import("@/pages/admin/CustomerDetail"));
const Expenses = lazy(() => import("@/pages/admin/Expenses"));
const Cashbook = lazy(() => import("@/pages/admin/Cashbook"));
const Orders = lazy(() => import("@/pages/admin/Orders"));
const OrderDetail = lazy(() => import("@/pages/admin/OrderDetail"));
const Invoices = lazy(() => import("@/pages/admin/Invoices"));
const InvoicePrint = lazy(() => import("@/pages/admin/InvoicePrint"));
const Repairs = lazy(() => import("@/pages/admin/Repairs"));
const Certificates = lazy(() => import("@/pages/admin/Certificates"));
const Leads = lazy(() => import("@/pages/admin/Leads"));
const Bills = lazy(() => import("@/pages/admin/Bills"));
const BillDetail = lazy(() => import("@/pages/admin/BillDetail"));
const Reports = lazy(() => import("@/pages/admin/Reports"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const PriceCalculator = lazy(() => import("@/pages/admin/Calculator"));

const AdminPageFallback = () => <div className="p-6 text-sm text-slate-400">Loading…</div>;

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/rates" element={<Rates />} />
                <Route path="/catalogue" element={<Catalogue />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/custom-order" element={<CustomOrder />} />
                <Route path="/repair" element={<Repair />} />
                <Route path="/order-status" element={<OrderStatus />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/verify/invoice/:id" element={<VerifyInvoice />} />
                <Route path="/verify/certificate/:id" element={<VerifyCertificate />} />
              </Route>
              <Route path="/Emergent/*" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/login" element={
                <Suspense fallback={<AdminPageFallback />}><Login /></Suspense>
              } />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Suspense fallback={<AdminPageFallback />}><Dashboard /></Suspense>} />
                <Route path="handover" element={<Suspense fallback={<AdminPageFallback />}><Handover /></Suspense>} />
                <Route path="rates" element={<Suspense fallback={<AdminPageFallback />}><RatesAdmin /></Suspense>} />
                <Route path="products" element={<Suspense fallback={<AdminPageFallback />}><Products /></Suspense>} />
                <Route path="customers" element={<Suspense fallback={<AdminPageFallback />}><Customers /></Suspense>} />
                <Route path="customer-dues" element={<Suspense fallback={<AdminPageFallback />}><CustomerDues /></Suspense>} />
                <Route path="customers/:id" element={<Suspense fallback={<AdminPageFallback />}><CustomerDetail /></Suspense>} />
                <Route path="expenses" element={<Suspense fallback={<AdminPageFallback />}><Expenses /></Suspense>} />
                <Route path="cashbook" element={<Suspense fallback={<AdminPageFallback />}><Cashbook /></Suspense>} />
                <Route path="orders" element={<Suspense fallback={<AdminPageFallback />}><Orders /></Suspense>} />
                <Route path="orders/:id" element={<Suspense fallback={<AdminPageFallback />}><OrderDetail /></Suspense>} />
                <Route path="invoices" element={<Suspense fallback={<AdminPageFallback />}><Invoices /></Suspense>} />
                <Route path="invoices/:id" element={<Suspense fallback={<AdminPageFallback />}><InvoicePrint /></Suspense>} />
                <Route path="repairs" element={<Suspense fallback={<AdminPageFallback />}><Repairs /></Suspense>} />
                <Route path="certificates" element={<Suspense fallback={<AdminPageFallback />}><Certificates /></Suspense>} />
                <Route path="leads" element={<Suspense fallback={<AdminPageFallback />}><Leads /></Suspense>} />
                <Route path="bills" element={<Suspense fallback={<AdminPageFallback />}><Bills /></Suspense>} />
                <Route path="bills/:id" element={<Suspense fallback={<AdminPageFallback />}><BillDetail /></Suspense>} />
                <Route path="reports" element={<Suspense fallback={<AdminPageFallback />}><Reports /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<AdminPageFallback />}><Settings /></Suspense>} />
                <Route path="calculator" element={<Suspense fallback={<AdminPageFallback />}><PriceCalculator /></Suspense>} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </SettingsProvider>
      </AuthProvider>
    </div>
  );
}
export default App;
