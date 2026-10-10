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
    let active = true;
    // A restored Supabase session may belong to an unapproved account.
    // Never unlock the admin UI until our API confirms shop permissions.
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data.session?.user) { setUser(false); return; }
      try {
        await api.get("/admin/whoami");
        if (active) setUser(data.session.user);
      } catch (err) {
        if (!active) return;
        // Denied users must not remain signed in to the protected shop UI.
        if ([401, 403].includes(err?.response?.status)) {
          await supabase.auth.signOut().catch(() => {});
          if (active) setUser(false);
        } else {
          // Network/API outages must not masquerade as a successful login.
          if (active) setUser(false);
        }
      }
    }).catch(() => { if (active) setUser(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) setUser(false);
      // Signed-in events alone are not admin authorization. Login and
      // restored-session verification explicitly authorize access.
    });
    const expireSession = () => setUser(false);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, expireSession);
    return () => {
      active = false;
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
