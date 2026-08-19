import { useSettings } from "@/context/SettingsContext";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

export default function PrivacyPolicy() {
  const shop = useSettings();
  const shopName = shop.shop_name || "Jai Supa Deurali Sun-Chandi Pasal";

  useDocumentMeta(
    `Privacy Policy - ${shopName}`,
    "Simple privacy policy for jewellery enquiries, WhatsApp messages, custom orders, repairs, and customer contact details."
  );

  return (
    <div className="brand-shell max-w-4xl py-12 sm:py-16">
      <p className="brand-eyebrow">Privacy Policy</p>
      <h1 className="font-serif-display text-4xl sm:text-6xl font-bold tracking-tight ornament-line mt-3">
        How we handle your information
      </h1>
      <p className="mt-5 text-[#5F5147] leading-relaxed">
        {shopName} only collects the information needed to answer enquiries, prepare orders, track repairs, and
        contact customers about shop work. We keep this simple and use it only for the shop.
      </p>

      <div className="mt-10 space-y-5 text-[#5F5147]">
        <section>
          <h2 className="text-xl font-semibold text-slate-900">Information we may collect</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>Name and phone number shared through WhatsApp, phone calls, or enquiry forms.</li>
            <li>Messages about jewellery designs, custom orders, old gold exchange, or repair requests.</li>
            <li>Order, repair, delivery, and payment details needed to complete shop work.</li>
            <li>Photos you choose to send for custom design, repair, or bill reference.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">How we use it</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>To reply to your enquiry and confirm order or repair details.</li>
            <li>To prepare jewellery, estimate price, arrange pickup, or share order status.</li>
            <li>To keep shop records such as bills, deposits, balances, and repair history.</li>
            <li>To contact you if there is a delay, price confirmation, or delivery update.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Sharing</h2>
          <p className="mt-3 leading-relaxed">
            We do not sell or share customer information with third parties for marketing. We only share details
            when it is needed to complete your request, such as with a worker handling jewellery repair or custom
            making. We do not publish private customer details on the website.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">WhatsApp and phone</h2>
          <p className="mt-3 leading-relaxed">
            If you contact us on WhatsApp or by phone, your message and contact details may stay in our shop
            WhatsApp account or phone records so we can continue the conversation and support your order.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Website analytics</h2>
          <p className="mt-3 leading-relaxed">
            We may use basic website analytics to understand which public pages are being visited and improve the
            website. This is used for shop website improvement, not for selling customer information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Questions or corrections</h2>
          <p className="mt-3 leading-relaxed">
            If your contact details or order information are wrong, please contact the shop and we will correct
            our records. You can also ask us to remove enquiry information that is no longer needed.
          </p>
        </section>
      </div>
    </div>
  );
}
