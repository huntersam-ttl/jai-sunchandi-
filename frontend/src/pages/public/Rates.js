import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function Rates() {
  const [rate, setRate] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get("/rates/today").then((r) => setRate(r.data)).catch(() => {});
    api.get("/rates/history", { params: { days: 30 } }).then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold tracking-tighter">Today's Rate <span className="gold-gradient-text">आजको दर</span></h1>
      {rate ? (
        <div className="mt-8 grid sm:grid-cols-3 gap-4" data-testid="rates-page-widget">
          {[["Gold 24K", rate.gold_24k, rate.gold_24k_np, "gold24"],
            ["Gold 22K", rate.gold_22k, rate.gold_22k_np, "gold22"],
            ["Silver", rate.silver, rate.silver_np, "silver"]].map(([label, v, np, key]) => (
            <div key={label} data-testid={`rate-card-${key}`} className="bg-white border border-slate-200 rounded-md p-6">
              <p className="text-sm text-slate-500">{label} / tola</p>
              <p className="text-2xl font-bold mt-1">{rs(v)}</p>
              <p className="text-[#991B1B]">रु. {np}</p>
            </div>
          ))}
          <p className="sm:col-span-3 text-xs text-slate-500">Updated: {rate.date_ad} (AD) · {rate.bs_date_np} (BS)</p>
        </div>
      ) : (
        <p className="mt-8 text-slate-500" data-testid="no-rate-msg">Today's rate is not published yet. Please contact the shop.</p>
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
                <Line type="monotone" dataKey="gold_24k" name="Gold 24K" stroke="#D4AF37" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="gold_22k" name="Gold 22K" stroke="#B45309" strokeWidth={2} dot={false} />
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
