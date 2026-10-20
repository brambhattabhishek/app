import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Github, Linkedin, Smartphone, Mail, Loader2, ArrowLeft } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);

const input = "w-full h-11 px-3 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm transition-colors";
const btn = "h-11 rounded-lg border flex items-center justify-center gap-2 text-sm font-semibold hover:bg-secondary transition-colors";
const primary = "h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60";

function EmailForm({ onDone, from }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/auth/${mode === "login" ? "login" : "register"}`, form);
      onDone(data);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <>
      <form onSubmit={submit} className="grid gap-3">
        {mode === "register" && <input className={input} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="auth-name-input" />}
        <input className={input} type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="auth-email-input" />
        <input className={input} type="password" placeholder="Password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="auth-password-input" />
        <button disabled={busy} data-testid="auth-submit-button" className={primary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="text-sm text-muted-foreground mt-4 text-center">
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary font-semibold hover:underline" data-testid="auth-toggle-mode">
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </>
  );
}

function OtpForm({ onDone, demo }) {
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/otp/send", { phone });
      setSent(data);
      toast.success(data.demo ? "Demo OTP generated" : "OTP sent to your phone");
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const { data } = await api.post("/auth/otp/verify", { phone, code }); onDone(data); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-3" data-testid="otp-form">
      {demo && <p className="text-xs px-3 py-2 rounded-lg bg-[color:var(--medium)]/10 text-medium" data-testid="otp-demo-banner">DEMO MODE — Twilio isn't connected yet, so the OTP is shown on screen instead of being sent by SMS.</p>}
      {!sent ? (
        <form onSubmit={send} className="grid gap-3">
          <input className={input} type="tel" placeholder="+919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="otp-phone-input" />
          <button disabled={busy} className={primary} data-testid="otp-send-button">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send OTP</button>
        </form>
      ) : (
        <form onSubmit={verify} className="grid gap-3">
          <p className="text-sm text-muted-foreground">Code sent to <span className="text-foreground font-semibold">{phone}</span></p>
          {sent.demo_code && <p className="font-mono text-sm" data-testid="otp-demo-code">Your demo OTP: <span className="text-primary font-bold tracking-widest">{sent.demo_code}</span></p>}
          <input className={`${input} font-mono tracking-[0.5em] text-center`} inputMode="numeric" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} data-testid="otp-code-input" />
          <button disabled={busy || code.length < 4} className={primary} data-testid="otp-verify-button">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Verify &amp; sign in</button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => { setSent(null); setCode(""); }} className="text-muted-foreground hover:text-foreground">Change number</button>
            <button type="button" onClick={send} className="text-primary font-semibold" data-testid="otp-resend-button">Resend OTP</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AuthPage() {
  const [method, setMethod] = useState(null);
  const [providers, setProviders] = useState({});
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from || "/";

  useEffect(() => { api.get("/auth/providers").then(({ data }) => setProviders(data)).catch(() => {}); }, []);

  const done = (data) => { login(data); track("login", { method: data.user.provider }); navigate(from, { replace: true }); };

  const google = () => {
    const backendUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "");
    if (!backendUrl) {
      toast.error("Backend API URL is not configured.");
      return;
    }
    localStorage.setItem("cl_after_login", from);
    window.location.href =
        `${backendUrl}/oauth2/authorization/google`;
  };

  const oauth = async (provider) => {
    try {
      localStorage.setItem("cl_after_login", from);
      const { data } = await api.get(`/auth/oauth/${provider}/start`, { params: { redirect_uri: `${window.location.origin}/auth/oauth/${provider}` } });
      if (window.self !== window.top) window.open(data.url, "_blank"); else window.location.href = data.url;
    } catch (e) { toast.error(errMsg(e)); }
  };

  const soonTag = (on) => (!on ? <span className="text-[10px] px-1.5 rounded bg-secondary text-muted-foreground font-medium">setup pending</span> : null);

  return (
    <main className="relative z-10 min-h-[calc(100vh-48px)] grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between p-14 border-r bg-card">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">algoforge</p>
        <div>
          <h1 className="font-heading text-5xl font-bold tracking-tight leading-[1.05]">Write it. Run it.<br /><span className="text-primary">Ship it.</span></h1>
          <p className="text-muted-foreground mt-5 max-w-md">Sign in to submit solutions against hidden tests, get problems picked for your interests, and watch your heatmap light up.</p>
        </div>
        <pre className="font-mono text-xs text-muted-foreground leading-relaxed">{`> submit two-sum --lang java\n  ✓ 6/6 testcases passed\n  Accepted · 84 ms`}</pre>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="rise w-full max-w-sm" data-testid="auth-modal">
          <h2 className="font-heading text-3xl font-bold tracking-tight">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Choose how you'd like to continue.</p>

          {method && (
            <button onClick={() => setMethod(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="auth-back-button"><ArrowLeft className="w-4 h-4" />All sign-in options</button>
          )}
          {method === "email" && <EmailForm onDone={done} />}
          {method === "otp" && <OtpForm onDone={done} demo={providers.otp === "demo"} />}

          {!method && (
            <div className="grid gap-2.5">
              <button onClick={google} data-testid="auth-google-button" className={btn}><GoogleIcon /> Continue with Google</button>
              <button onClick={() => oauth("github")} data-testid="auth-github-button" className={btn}><Github className="w-4 h-4" /> Continue with GitHub {soonTag(providers.github)}</button>
              <button onClick={() => oauth("linkedin")} data-testid="auth-linkedin-button" className={btn}><Linkedin className="w-4 h-4 text-[#0A66C2]" /> Continue with LinkedIn {soonTag(providers.linkedin)}</button>
              <button onClick={() => setMethod("otp")} data-testid="auth-mobile-otp-button" className={btn}><Smartphone className="w-4 h-4" /> Continue with Mobile OTP {providers.otp === "demo" && <span className="text-[10px] px-1.5 rounded bg-secondary text-medium">demo</span>}</button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground my-2"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
              <button onClick={() => setMethod("email")} data-testid="auth-email-method-button" className={btn}><Mail className="w-4 h-4" /> Email &amp; password</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
