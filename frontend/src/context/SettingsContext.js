import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

// Fallback defaults — used until settings load from backend. Contact fields
// (phone/whatsapp/address/opening_hours) are intentionally left blank rather
// than filled with placeholder-looking values: showing a fake number/address
// as if real would be worse than the page's own "not set yet" empty states.
export const SHOP_DEFAULTS = {
  shop_name: "Jai Supa Deurali Sun-Chandi Pasal",
  shop_name_np: "जय सुपा देउराली सुनचाँदी पसल",
  tagline: "Decades of trust in gold & silver",
  tagline_np: "दशकौंदेखिको विश्वास",
  phone: "",
  whatsapp: "",
  address: "",
  maps_link: "",
  opening_hours: "",
  logo: "",
  default_whatsapp_message: "Namaste! I have an enquiry.",
};

const SettingsContext = createContext(SHOP_DEFAULTS);

// Only let a loaded value override a default when it's actually non-empty,
// so a blank column in shop_settings can't blank out a working default.
function mergeSettings(base, loaded) {
  const merged = { ...base };
  for (const key of Object.keys(loaded || {})) {
    const value = loaded[key];
    if (typeof value === "string" ? value.trim() !== "" : value != null) {
      merged[key] = value;
    }
  }
  return merged;
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(SHOP_DEFAULTS);

  const loadSettings = useCallback(() => {
    api
      .get("/settings")
      .then((r) => setSettings((prev) => mergeSettings(prev, r.data)))
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

/**
 * Build a WhatsApp link using the current settings whatsapp number.
 * Returns null when no number is configured -- callers must not render a
 * "https://wa.me/?text=..." link with no recipient.
 */
export function waLinkFromSettings(settings, message) {
  if (!settings.whatsapp) return null;
  return `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(message)}`;
}
