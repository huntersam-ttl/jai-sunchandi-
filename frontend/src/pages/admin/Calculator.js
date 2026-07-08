import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import {
  tolaLalAanaToGrams, computeQuote, quoteWhatsappLink, buildQuoteText, PURITY_FACTORS,
} from "@/lib/calculator";
import { inp, btnGold, btnGhost, Card, F } from "@/components/admin/ui";
import { Calculator as CalculatorIcon, RotateCcw, Copy, MessageCircle } from "lucide-react";

const GOLD_PURITIES = ["24K", "22K", "21K", "18K"];

const EMPTY = {
  metal: "gold",
  purity: "24K",
  weightMode: "grams",
  grams: "",
  tola: "",
  lal: "",
  aana: "",
  jartiPercent: "",
  jyalaAmount: "",
  jyalaType: "flat",
  stoneCost: "",
  polishingCost: "",
  cuttingCost: "",
  workerCharge: "",
  otherCost: "",
  discount: "",
  customerPhone: "",
};

export default function Calculator() {
  const shop = useSettings();
  const [form, setForm] = useState(EMPTY);
  const [rate, setRate] = useState(null);
  const [rateError, setRateError] = useState(false);
  const [manualRate, setManualRate] = useState("");

  useEffect(() => {
    api.get("/rates/today").then((r) => setRate(r.data)).catch(() => setRateError(true));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const purityOptions = form.metal === "gold" ? GOLD_PURITIES : ["Silver"];
  useEffect(() => {
    // Keep the purity selection valid when switching metal.
    if (form.metal === "gold" && !GOLD_PURITIES.includes(form.purity)) {
      setForm((f) => ({ ...f, purity: "24K" }));
    }
    if (form.metal === "silver" && form.purity !== "Silver") {
      setForm((f) => ({ ...f, purity: "Silver" }));
    }
  }, [form.metal]); // eslint-disable-line

  const weightGrams = form.weightMode === "grams"
    ? +form.grams || 0
    : tolaLalAanaToGrams(form.tola, form.lal, form.aana);

  const autoRatePerTola = rate
    ? (form.metal === "gold"
        ? (form.purity === "22K" ? rate.gold_22k
          : form.purity === "24K" ? rate.gold_24k
          // Rate table only publishes 24K/22K; derive 21K/18K from 24K using
          // the same purity-factor math the final price already uses.
          : rate.gold_24k * ((PURITY_FACTORS[form.purity] ?? 1) / PURITY_FACTORS["24K"]))
        : rate.silver)
    : null;

  const ratePerTola = autoRatePerTola != null ? autoRatePerTola : (+manualRate || 0);
  const purityKey = form.metal === "silver" ? "silver" : form.purity;

  const quote = useMemo(() => computeQuote({
    weightGrams,
    ratePerTola,
    purity: purityKey,
    jartiPercent: form.jartiPercent,
    jyalaAmount: form.jyalaAmount,
    jyalaType: form.jyalaType,
    stoneCost: form.stoneCost,
    polishingCost: form.polishingCost,
    cuttingCost: form.cuttingCost,
    workerCharge: form.workerCharge,
    otherCost: form.otherCost,
    discount: form.discount,
  }), [weightGrams, ratePerTola, purityKey, form.jartiPercent, form.jyalaAmount, form.jyalaType,
      form.stoneCost, form.polishingCost, form.cuttingCost, form.workerCharge, form.otherCost, form.discount]);

  const quoteText = buildQuoteText(
    { ...quote, metal: form.metal === "gold" ? "Gold" : "Silver" },
    shop.shop_name, rs
  );
  const waLink = quoteWhatsappLink(form.customerPhone, quoteText);

  const reset = () => { setForm(EMPTY); setManualRate(""); };

  const copyQuote = async () => {
    try {
      await navigator.clipboard.writeText(quoteText);
      toast.success("Quote copied");
    } catch {
      toast.error("Could not copy quote");
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <CalculatorIcon className="text-[#D4AF37]" size={22} />
        <h1 className="text-2xl font-bold">Price Calculator</h1>
      </div>
      <p className="text-sm text-slate-500 -mt-2">
        Quick counter estimate — doesn't create an order or save anything.
      </p>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card title="Metal & Weight">
            <div className="grid grid-cols-2 gap-4">
              <F label="Metal">
                <select className={inp} value={form.metal} onChange={set("metal")} data-testid="calc-metal">
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                </select>
              </F>
              <F label="Purity">
                <select className={inp} value={form.purity} onChange={set("purity")} data-testid="calc-purity" disabled={form.metal === "silver"}>
                  {purityOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </F>
            </div>

            <div className="mt-4">
              <F label="Weight Input">
                <select className={inp} value={form.weightMode} onChange={set("weightMode")} data-testid="calc-weight-mode">
                  <option value="grams">Grams</option>
                  <option value="tola">Tola / Lal / Aana</option>
                </select>
              </F>
            </div>

            {form.weightMode === "grams" ? (
              <div className="mt-3">
                <F label="Weight (grams)">
                  <input className={inp} type="number" step="any" value={form.grams} onChange={set("grams")} data-testid="calc-grams" />
                </F>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <F label="Tola"><input className={inp} type="number" step="any" value={form.tola} onChange={set("tola")} data-testid="calc-tola" /></F>
                <F label="Lal"><input className={inp} type="number" step="any" value={form.lal} onChange={set("lal")} data-testid="calc-lal" /></F>
                <F label="Aana"><input className={inp} type="number" step="any" value={form.aana} onChange={set("aana")} data-testid="calc-aana" /></F>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2" data-testid="calc-weight-converted">
              = <b>{quote.weightGrams} g</b> · <b>{quote.weightTola} tola</b>
            </p>
          </Card>

          <Card title="Today's Rate">
            {rate ? (
              <div className="text-sm space-y-1" data-testid="calc-rate-loaded">
                <p>24K Gold: <b>{rs(rate.gold_24k)}</b>/tola</p>
                <p>22K Gold: <b>{rs(rate.gold_22k)}</b>/tola</p>
                <p>Silver: <b>{rs(rate.silver)}</b>/tola</p>
                <p className="text-xs text-slate-400 mt-1">Used for this quote: {rs(ratePerTola)}/tola</p>
              </div>
            ) : (
              <div className="space-y-2" data-testid="calc-rate-missing">
                <p className="text-amber-700 text-sm">
                  {rateError ? "Could not load today's rate." : "Loading today's rate…"} Today's rate not published yet.
                </p>
                <F label={`Manual rate (per tola, ${form.metal === "gold" ? form.purity : "Silver"})`}>
                  <input className={inp} type="number" step="any" value={manualRate} onChange={(e) => setManualRate(e.target.value)} data-testid="calc-manual-rate" />
                </F>
              </div>
            )}
          </Card>

          <Card title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <F label="Jarti %"><input className={inp} type="number" step="any" value={form.jartiPercent} onChange={set("jartiPercent")} data-testid="calc-jarti" /></F>
              <F label="Jyala / Making Charge"><input className={inp} type="number" step="any" value={form.jyalaAmount} onChange={set("jyalaAmount")} data-testid="calc-jyala" /></F>
              <F label="Jyala Type">
                <select className={inp} value={form.jyalaType} onChange={set("jyalaType")} data-testid="calc-jyala-type">
                  <option value="flat">Flat</option>
                  <option value="per_tola">Per Tola</option>
                </select>
              </F>
              <F label="Stone Cost"><input className={inp} type="number" step="any" value={form.stoneCost} onChange={set("stoneCost")} data-testid="calc-stone" /></F>
              <F label="Polishing Cost"><input className={inp} type="number" step="any" value={form.polishingCost} onChange={set("polishingCost")} data-testid="calc-polish" /></F>
              <F label="Cutting Cost"><input className={inp} type="number" step="any" value={form.cuttingCost} onChange={set("cuttingCost")} data-testid="calc-cutting" /></F>
              <F label="Worker Charge"><input className={inp} type="number" step="any" value={form.workerCharge} onChange={set("workerCharge")} data-testid="calc-worker" /></F>
              <F label="Other Cost"><input className={inp} type="number" step="any" value={form.otherCost} onChange={set("otherCost")} data-testid="calc-other" /></F>
              <F label="Discount (optional)"><input className={inp} type="number" step="any" value={form.discount} onChange={set("discount")} data-testid="calc-discount" /></F>
              <F label="Customer Phone (optional)"><input className={inp} value={form.customerPhone} onChange={set("customerPhone")} placeholder="98XXXXXXXX" data-testid="calc-phone" /></F>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="bg-[#0F172A] text-white rounded-md p-5 space-y-2 text-sm sticky top-20" data-testid="calc-result">
            <p className="text-[#D4AF37] font-serif-display text-lg mb-2">Quote</p>
            <div className="flex justify-between"><span>Weight</span><span>{quote.weightGrams} g ({quote.weightTola} tola)</span></div>
            <div className="flex justify-between"><span>Purity Factor</span><span>{quote.purityFactor}</span></div>
            <div className="flex justify-between"><span>Rate Used</span><span>{rs(quote.ratePerTola)}/tola</span></div>
            <div className="border-t border-slate-700 my-2" />
            <div className="flex justify-between"><span>Metal Value</span><b>{rs(quote.metalValue)}</b></div>
            <div className="flex justify-between"><span>Jarti Amount</span><b>{rs(quote.jartiAmount)}</b></div>
            <div className="flex justify-between"><span>Jyala</span><b>{rs(quote.jyalaAmount)}</b></div>
            <div className="flex justify-between"><span>Extra Charges</span><b>{rs(quote.extras)}</b></div>
            {quote.discount > 0 && <div className="flex justify-between text-amber-400"><span>Discount</span><b>- {rs(quote.discount)}</b></div>}
            <div className="border-t border-slate-700 my-2" />
            <div className="flex justify-between text-lg"><span>Final Quote Price</span><b className="text-[#D4AF37]" data-testid="calc-final-price">{rs(quote.finalPrice)}</b></div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={reset} data-testid="calc-reset-btn"><RotateCcw size={14} /> Reset</button>
            <button className={btnGold} onClick={copyQuote} data-testid="calc-copy-btn"><Copy size={14} /> Copy Quote</button>
            {waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer" data-testid="calc-whatsapp-btn"
                className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2.5 rounded-md text-sm hover:bg-[#1fb457] transition-colors">
                <MessageCircle size={14} /> Send Quote on WhatsApp
              </a>
            ) : (
              <button className={btnGhost} disabled title="Enter a valid customer phone to enable" data-testid="calc-whatsapp-disabled">
                <MessageCircle size={14} /> Send Quote on WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
