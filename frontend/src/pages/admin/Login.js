import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { SHOP } from "@/lib/format";
import { inp, btnGold } from "@/components/admin/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(apiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4 font-admin">
      <div className="w-full max-w-sm bg-white rounded-md p-8">
        <p className="font-serif-display font-bold text-lg text-center">{SHOP.name}</p>
        <p className="text-center text-xs text-[#991B1B] mt-1">{SHOP.nameNp} · Admin</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input className={inp} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email-input" />
          <input className={inp} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" />
          {error && <p className="text-sm text-red-600" data-testid="login-error">{error}</p>}
          <button type="submit" disabled={loading} className={`${btnGold} w-full`} data-testid="login-submit-button">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
