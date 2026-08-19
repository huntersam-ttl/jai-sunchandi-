import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";
import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MessageCircle, Phone } from "lucide-react";
import { EmptyState, PrimaryLink } from "@/components/PublicPolish";
import { PUBLIC_BRAND_NAME } from "@/lib/brand";

function rateStatus(rate) {
  if (!rate?.date_ad) return { title: "Gold & Silver Rates", label: "Rate from the shop counter" };
  const today = new Date().toISOString().slice(0, 10);
  return rate.date_ad === today
    ? { title: "Today's Gold & Silver Rates", label: `Published today · ${rate.date_ad}` }
    : { title: "Last Published Gold & Silver Rates", label: `Last published · ${rate.date_ad}` };
}

export default function Rates() {
  const shop = useSettings();
  const waLink = (msg) => waLinkFromSettings(shop, msg);
  const [rate, setRate] = useState(null);
  const [history, setHistory] = useState([]);
  useDocumentMeta(
    `Gold & Silver Rates – ${PUBLIC_BRAND_NAME}`,
    "24K gold and silver rate per tola from Jai Supa Deurali Jewellers, with published date and 30-day history."
  );

  useEffect(() => {
    api.get("/rates/today").then((r) => setRate(r.data)).catch(() => {});
    api.get("/rates/history", { params: { days: 30 } }).then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  const status = rateStatus(rate);

  return (
    <div className="brand-shell max-w-5xl py-12 sm:py-16">
      <p className="brand-eyebrow">Shop counter reference</p>
      <h1 className="font-serif-display text-4xl sm:text-6xl font-bold tracking-tight ornament-line mt-3">{status.title} <span className="gold-gradient-text">आजको दर</span></h1>
      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#5F5147]">
        Public shop rates focus on 24K Gold and Silver. Final jewellery price depends on weight, purity, jarti, jyala and agreed making work.
      </p>
      {rate ? (
        <div className="mt-8 grid sm:grid-cols-2 gap-4" data-testid="rates-page-widget">
          {[["24K Gold", rate.gold_24k, rate.gold_24k_np, "gold24"],
            ["Silver", rate.silver, rate.silver_np, "silver"]].map(([label, v, np, key]) => (
            <div key={label} data-testid={`rate-card-${key}`} className="brand-card rounded-md p-6">
              <p className="text-sm font-semibold text-[#6B5E55]">{label} / tola</p>
              <p className="text-3xl font-bold mt-2 text-[#2B1B17]">{rs(v)}</p>
              <p className="text-[#5B0D18]">रु. {np}</p>
            </div>
          ))}
          <p className="sm:col-span-2 text-xs text-[#6B5E55]">{status.label} (AD) · {rate.bs_date_np} (BS)</p>
        </div>
      ) : (
        <div className="mt-8" data-testid="no-rate-msg">
          <EmptyState title="Today's rate has not been published yet">
            Please contact the shop for the confirmed 24K gold and silver rate.
          </EmptyState>
          <div className="mt-4 flex flex-wrap gap-3">
            {shop.whatsapp && (
              <PrimaryLink href={waLink(`Namaste ${shop.shop_name}, could you share today's confirmed gold/silver rate?`)}
                external icon={false} data-testid="no-rate-whatsapp-btn"
                className="bg-[#25D366] hover:bg-[#1fb457]">
                <MessageCircle size={16} /> Ask on WhatsApp
              </PrimaryLink>
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

      <div className="mt-12 brand-card rounded-md p-4 sm:p-6">
        <h2 className="font-serif-display text-2xl font-semibold mb-4">30-Day Rate History</h2>
        {history.length > 1 ? (
          <div className="h-72" data-testid="rate-history-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <XAxis dataKey="date_ad" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="gold_24k" name="24K Gold" stroke="#D4AF37" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="silver" name="Silver" stroke="#6B7280" strokeWidth={2} dot={false} />
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
