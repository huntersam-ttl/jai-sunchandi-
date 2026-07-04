import axios from "axios";
import { supabase } from "@/lib/supabaseClient";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

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

export function apiError(e) {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return e?.response?.data?.message || e?.message || "Something went wrong";
}
