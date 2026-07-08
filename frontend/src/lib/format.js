export const SHOP = {
  name: "Jai Supa Deurali Sun-Chandi Pasal",
  nameNp: "जय सुपा देउराली सुनचाँदी पसल",
  tagline: "Decades of trust in gold & silver",
  taglineNp: "दशकौंदेखिको विश्वास",
  phone: "+977-9800000000",
  whatsapp: "9779800000000",
  address: "Deurali Bazaar, Nepal",
};

const NEP = { 0: "०", 1: "१", 2: "२", 3: "३", 4: "४", 5: "५", 6: "६", 7: "७", 8: "८", 9: "९" };
export const toNp = (v) => String(v).replace(/[0-9]/g, (d) => NEP[d]);

export const GRAMS_PER_TOLA = 11.664;
export const PURITY_FACTORS = { "24K": 1.0, "22K": 0.916, "21K": 0.875, "18K": 0.75, silver: 1.0 };

export const gramsToTola = (g) => Math.round((g / GRAMS_PER_TOLA) * 10000) / 10000;
export const tolaToGrams = (t) => Math.round(t * GRAMS_PER_TOLA * 1000) / 1000;

export const rs = (n) =>
  "Rs. " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const rsNp = (n) => "रु. " + toNp(Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }));

export const waLink = (message) =>
  `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(message)}`;

export const STATUS_COLORS = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  making: "bg-amber-100 text-amber-800",
  polishing: "bg-purple-100 text-purple-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
  received: "bg-blue-100 text-blue-800",
  working: "bg-amber-100 text-amber-800",
  available: "bg-green-100 text-green-800",
  reserved: "bg-amber-100 text-amber-800",
  sold: "bg-slate-200 text-slate-700",
  inactive: "bg-red-100 text-red-800",
  active: "bg-green-100 text-green-800",
  refunded: "bg-red-100 text-red-800",
  exchanged: "bg-purple-100 text-purple-800",
  contacted: "bg-amber-100 text-amber-800",
  converted: "bg-green-100 text-green-800",
  closed: "bg-slate-200 text-slate-700",
};

export async function compressImage(file, maxDim = 900, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = URL.createObjectURL(file);
  });
}
