import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

// Fallback defaults — used until settings load from backend
export const SHOP_DEFAULTS = {
  shop_name: "Jai Supa Deurali Sun-Chandi Pasal",
  shop_name_np: "जय सुपा देउराली सुनचाँदी पसल",
  tagline: "Decades of trust in gold & silver",
  tagline_np: "दशकौंदेखिको विश्वास",
  phone: "+977-9800000000",
  whatsapp: "9779800000000",
  address: "Deurali Bazaar, Nepal",
  maps_link: "",
  opening_hours: "Sun–Fri: 10am – 7pm",
  logo: "",
  default_whatsapp_message: "Namaste! I have an enquiry.",
};

const SettingsContext = createContext(SHOP_DEFAULTS);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(SHOP_DEFAULTS);

  const loadSettings = useCallback(() => {
    api
      .get("/settings")
      .then((r) => setSettings({ ...SHOP_DEFAULTS, ...r.data }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{ settings, reload: loadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext).settings;
}

export function useSettingsReload() {
  return useContext(SettingsContext).reload;
}

/** Build a WhatsApp link using the current settings whatsapp number */
export function waLinkFromSettings(settings, message) {
  return `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(message)}`;
}
