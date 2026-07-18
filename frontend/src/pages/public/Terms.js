import { useSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

export default function Terms() {
  const shop = useSettings();
  const shopName = shop.shop_name || "Jai Supa Deurali Sun-Chandi Pasal";

  useDocumentMeta(
    `Terms of Service - ${shopName}`,
    "Simple shop terms for gold and silver orders, custom jewellery deposits, old gold exchange, repairs, and pickup."
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <p className="text-sm font-semibold text-[#991B1B]">Terms of Service</p>
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold tracking-tighter mt-2">
        Simple shop terms
      </h1>
      <p className="mt-4 text-slate-600 leading-relaxed">
        These terms explain how {shopName} handles jewellery orders, custom work, old gold exchange, and repairs.
        We use clear shop records and will explain price, weight, jarti, jyala, deposits, and delivery timing before
        final confirmation.
      </p>

      <div className="mt-10 space-y-8 text-slate-700">
        <section>
          <h2 className="text-xl font-semibold text-slate-900">Orders and pricing</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>Gold and silver prices can change with the daily market rate.</li>
            <li>Final price depends on weight, purity, jarti, jyala or making charge, stone, polish, and other agreed work.</li>
            <li>We try to give clear estimates, but final weight and price may change slightly after the item is completed.</li>
            <li>Please keep your bill or order number for pickup, payment, exchange, or future reference.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Custom work and deposits</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>Custom jewellery work may require an advance deposit before work begins.</li>
            <li>Design, weight, delivery date, and charges should be confirmed before making starts.</li>
            <li>If a customer changes the design after work begins, extra cost or extra time may be needed.</li>
            <li>Deposits are adjusted in the final bill unless the shop and customer agree otherwise.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Old gold exchange</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>Old gold is checked for weight and purity before exchange value is confirmed.</li>
            <li>Stone, dirt, wax, thread, or non-gold parts may reduce the final exchange weight.</li>
            <li>The exchange value is based on the agreed purity, market rate, and shop checking process.</li>
            <li>Please ask any questions before agreeing to exchange or melt old jewellery.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Repairs</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>Repair time and cost depend on the condition of the jewellery and the work needed.</li>
            <li>Some repairs may reveal hidden weakness, cracks, missing parts, or extra work after inspection.</li>
            <li>We will contact you if repair cost or timing changes meaningfully.</li>
            <li>Please collect repaired items with your repair number, bill, or phone confirmation.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Pickup and balance payment</h2>
          <p className="mt-3 leading-relaxed">
            Remaining balance should be paid when the item is collected, unless another arrangement is clearly
            agreed with the shop. Please check the item, weight, and bill before leaving the shop.
          </p>
        </section>
      </div>
    </div>
  );
}
