import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MessageCircle, Phone } from "lucide-react";

export default function Rates() {
  const shop = useSettings();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  const [rate, setRate] = useState(null);
  const [history, setHistory] = useState([]);
  useDocumentMeta(
    `Today's Gold & Silver Rate – ${shop.shop_name || "Jai Supa Deurali Sun-Chandi Pasal"}`,
    "Today's gold and silver rate per tola, updated from the shop counter, with 30-day rate history."
  );

  useEffect(() => {
    api.get("/rates/today").then((r) => setRate(r.data)).catch(() => {});
    api.get("/rates/history", { params: { days: 30 } }).then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold tracking-tighter">Today's Rate <span className="gold-gradient-text">आजको दर</span></h1>
      {rate ? (
        <div className="mt-8 grid sm:grid-cols-2 gap-4" data-testid="rates-page-widget">
          {[["24K Gold", rate.gold_24k, rate.gold_24k_np, "gold24"],
            ["Silver", rate.silver, rate.silver_np, "silver"]].map(([label, v, np, key]) => (
            <div key={label} data-testid={`rate-card-${key}`} className="bg-white border border-slate-200 rounded-md p-6">
              <p className="text-sm text-slate-500">{label} / tola</p>
              <p className="text-2xl font-bold mt-1">{rs(v)}</p>
              <p className="text-[#991B1B]">रु. {np}</p>
            </div>
          ))}
          <p className="sm:col-span-2 text-xs text-slate-500">Last updated: {rate.date_ad} (AD) · {rate.bs_date_np} (BS)</p>
        </div>
      ) : (
        <div className="mt-8 bg-white border border-slate-200 rounded-md p-6" data-testid="no-rate-msg">
          <p className="text-slate-600 leading-relaxed">
            Today's gold and silver rate is updated from the shop counter. Please call or WhatsApp us for the
            confirmed live rate.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {shop.whatsapp && (
              <a href={waLink(`Namaste ${shop.shop_name}, could you share today's confirmed gold/silver rate?`)}
                target="_blank" rel="noreferrer" data-testid="no-rate-whatsapp-btn"
                className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2.5 rounded-md text-sm hover:bg-[#1fb457] transition-colors">
                <MessageCircle size={16} /> Ask on WhatsApp
              </a>
            )}
            {shop.phone && (
              <a href={`tel:${shop.phone}`} data-testid="no-rate-phone-btn"
                className="inline-flex items-center gap-2 border border-slate-300 px-4 py-2.5 rounded-md text-sm hover:bg-slate-50 transition-colors">
                <Phone size={16} /> {shop.phone}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-12 bg-white border border-slate-200 rounded-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">30-Day Rate History</h2>
        {history.length > 1 ? (
          <div className="h-72" data-testid="rate-history-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <XAxis dataKey="date_ad" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="gold_24k" name="24K Gold" stroke="#D4AF37" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="silver" name="Silver" stroke="#64748B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Rate history will appear here as daily rates are published.</p>
        )}
      </div>
    </div>
  );
}
