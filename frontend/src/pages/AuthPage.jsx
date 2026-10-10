import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Github, Smartphone, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from || "/";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/auth/${mode === "login" ? "login" : "register"}`, form);
      login(data);
      toast.success(`Welcome${mode === "login" ? " back" : ""}, ${data.user.name}`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const google = () => {
    localStorage.setItem("cl_after_login", from);
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const soon = (n) => toast.info(`${n} login is coming soon`);
  const input = "w-full h-11 px-3 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm transition-colors";

  return (
    <main className="relative z-10 min-h-[calc(100vh-48px)] grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between p-14 border-r bg-card">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">algoforge</p>
        <div>
          <h1 className="font-heading text-5xl font-bold tracking-tight leading-[1.05]">Write it. Run it.<br /><span className="text-primary">Ship it.</span></h1>
          <p className="text-muted-foreground mt-5 max-w-md">Sign in to submit solutions against hidden tests, keep a submission history, and watch your heatmap light up.</p>
        </div>
        <pre className="font-mono text-xs text-muted-foreground leading-relaxed">{`> submit two-sum --lang java\n  ✓ 6/6 testcases passed\n  Accepted · 84 ms`}</pre>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="rise w-full max-w-sm" data-testid="auth-modal">
          <h2 className="font-heading text-3xl font-bold tracking-tight">{mode === "login" ? "Sign in" : "Create account"}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">{mode === "login" ? "Good to see you again." : "Join and start solving."}</p>

          <div className="grid gap-2 mb-5">
            <button onClick={google} data-testid="auth-google-button" className="h-11 rounded-lg border flex items-center justify-center gap-2 text-sm font-semibold hover:bg-secondary transition-colors"><GoogleIcon /> Continue with Google</button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => soon("GitHub")} data-testid="auth-github-button" className="h-11 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"><Github className="w-4 h-4" /> GitHub <span className="text-[10px] px-1.5 rounded bg-secondary">soon</span></button>
              <button onClick={() => soon("Mobile OTP")} data-testid="auth-mobile-otp-button" className="h-11 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"><Smartphone className="w-4 h-4" /> OTP <span className="text-[10px] px-1.5 rounded bg-secondary">soon</span></button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-5"><div className="h-px flex-1 bg-border" />or with email<div className="h-px flex-1 bg-border" /></div>

          <form onSubmit={submit} className="grid gap-3">
            {mode === "register" && <input className={input} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="auth-name-input" />}
            <input className={input} type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="auth-email-input" />
            <input className={input} type="password" placeholder="Password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="auth-password-input" />
            <button disabled={busy} data-testid="auth-submit-button" className="h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p className="text-sm text-muted-foreground mt-5 text-center">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary font-semibold hover:underline" data-testid="auth-toggle-mode">
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
