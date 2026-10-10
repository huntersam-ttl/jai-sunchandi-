import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ADMIN_SESSION_EXPIRED_EVENT, api, apiError } from "@/lib/api";

const AuthContext = createContext(null);

// Auth now runs on Supabase Auth (email/password). user is the Supabase user
// object when signed in, false when signed out, null while resolving.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setUser(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? false);
    });
    const expireSession = () => setUser(false);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, expireSession);
    return () => {
      listener?.subscription?.unsubscribe();
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, expireSession);
    };
  }, []);

  const login = async (email, password) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Supabase signing in does not prove authorization to use the shop API.
    // Verify our server's allowlist before letting a user enter the admin UI.
    try {
      await api.get("/admin/whoami");
    } catch (accessError) {
      await supabase.auth.signOut();
      setUser(false);
      throw new Error(accessError?.response?.status === 403
        ? "This account is not authorized to manage the shop."
        : apiError(accessError));
    }
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch (e) { /* best-effort */ }
    }
    setUser(false);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
