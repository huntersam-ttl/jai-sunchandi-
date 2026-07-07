import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import VerifyInvoice from "@/pages/public/VerifyInvoice";
import VerifyCertificate from "@/pages/public/VerifyCertificate";
import Login from "@/pages/admin/Login";
import Dashboard from "@/pages/admin/Dashboard";
import Handover from "@/pages/admin/Handover";
import RatesAdmin from "@/pages/admin/Rates";
import Products from "@/pages/admin/Products";
import Customers from "@/pages/admin/Customers";
import CustomerDues from "@/pages/admin/CustomerDues";
import CustomerDetail from "@/pages/admin/CustomerDetail";
import Expenses from "@/pages/admin/Expenses";
import Cashbook from "@/pages/admin/Cashbook";
import Orders from "@/pages/admin/Orders";
import OrderDetail from "@/pages/admin/OrderDetail";
import Invoices from "@/pages/admin/Invoices";
import InvoicePrint from "@/pages/admin/InvoicePrint";
import Repairs from "@/pages/admin/Repairs";
import Certificates from "@/pages/admin/Certificates";
import Leads from "@/pages/admin/Leads";
import Reports from "@/pages/admin/Reports";
import Settings from "@/pages/admin/Settings";

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
                <Route path="/verify/invoice/:id" element={<VerifyInvoice />} />
                <Route path="/verify/certificate/:id" element={<VerifyCertificate />} />
              </Route>
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="handover" element={<Handover />} />
                <Route path="rates" element={<RatesAdmin />} />
                <Route path="products" element={<Products />} />
                <Route path="customers" element={<Customers />} />
                <Route path="customer-dues" element={<CustomerDues />} />
                <Route path="customers/:id" element={<CustomerDetail />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="cashbook" element={<Cashbook />} />
                <Route path="orders" element={<Orders />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="invoices/:id" element={<InvoicePrint />} />
                <Route path="repairs" element={<Repairs />} />
                <Route path="certificates" element={<Certificates />} />
                <Route path="leads" element={<Leads />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
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
