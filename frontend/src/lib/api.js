import axios from "axios";
import { supabase } from "@/lib/supabaseClient";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const ADMIN_SESSION_EXPIRED_EVENT = "admin-session-expired";

export const api = axios.create({ baseURL: API });

function isAdminSessionError(error) {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  return status === 401 && [
    "Invalid token",
    "Token expired",
    "Not authenticated",
  ].includes(detail);
}

// Attach the current Supabase access token (verified by the FastAPI backend).
// No token is stored in localStorage by the app.
api.interceptors.request.use(async (config) => {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isAdminSessionError(error)) {
      error.userMessage = "Session expired. Please log out and log in again.";
      if (supabase) {
        try { await supabase.auth.signOut(); } catch (e) { /* best-effort */ }
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

export function apiError(e) {
  if (e?.userMessage) return e.userMessage;
  if (isAdminSessionError(e)) return "Session expired. Please log out and log in again.";
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return e?.response?.data?.message || e?.message || "Something went wrong";
}
