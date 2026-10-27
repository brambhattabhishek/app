import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Github,
  Linkedin,
  Smartphone,
  Mail,
  Loader2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";

// ═══════════════════════════════════════════════════════════════
//  Google icon
// ═══════════════════════════════════════════════════════════════
const GoogleIcon = () => (
    <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden="true">
      <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
);

// ═══════════════════════════════════════════════════════════════
//  Shared styles
// ═══════════════════════════════════════════════════════════════
const inputCls =
    "w-full h-11 px-3 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm transition-colors";
const btnCls =
    "h-11 rounded-lg border flex items-center justify-center gap-2 text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const primaryCls =
    "h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed";

// ═══════════════════════════════════════════════════════════════
//  Email / password form
// ═══════════════════════════════════════════════════════════════
function EmailForm({ onDone }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Basic client validation
  const canSubmit = useMemo(() => {
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
    const passOk = (form.password || "").length >= 6;
    const nameOk = mode === "login" || (form.name || "").trim().length > 0;
    return emailOk && passOk && nameOk;
  }, [form, mode]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      const { data } = await api.post(
          `/auth/${mode === "login" ? "login" : "register"}`,
          payload
      );
      onDone(data);
    } catch (err) {
      const msg = errMsg(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
      <>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          {mode === "register" && (
              <input
                  className={inputCls}
                  placeholder="Name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                  }
                  disabled={busy}
                  maxLength={60}
                  data-testid="auth-name-input"
              />
          )}
          <input
              className={inputCls}
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={busy}
              data-testid="auth-email-input"
          />
          <input
              className={inputCls}
              type="password"
              placeholder="Password (min 6 chars)"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              value={form.password}
              onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
              }
              disabled={busy}
              data-testid="auth-password-input"
          />

          {error && (
              <div
                  className="flex items-start gap-2 text-xs text-hard bg-[color:var(--hard)]/10 px-3 py-2 rounded-lg"
                  data-testid="auth-error"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="break-words">{error}</span>
              </div>
          )}

          <button
              disabled={busy || !canSubmit}
              data-testid="auth-submit-button"
              className={primaryCls}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-muted-foreground mt-4 text-center">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              className="text-primary font-semibold hover:underline"
              disabled={busy}
              data-testid="auth-toggle-mode"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  OTP form
// ═══════════════════════════════════════════════════════════════
function OtpForm({ onDone, demo }) {
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const phoneOk = /^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s-]/g, ""));

  const send = async (e) => {
    e?.preventDefault();
    if (busy) return;
    if (!phoneOk) {
      const msg = "Use full international format, e.g. +919876543210";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/otp/send", { phone });
      setSent(data);
      toast.success(
          data.demo ? "Demo OTP generated" : "OTP sent to your phone"
      );
    } catch (err) {
      const msg = errMsg(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    if (busy || code.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/otp/verify", { phone, code });
      onDone(data);
    } catch (err) {
      const msg = errMsg(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
      <div className="grid gap-3" data-testid="otp-form">
        {demo && (
            <p
                className="text-xs px-3 py-2 rounded-lg bg-[color:var(--medium)]/10 text-medium"
                data-testid="otp-demo-banner"
            >
              DEMO MODE — Twilio isn't connected yet, so the OTP is shown
              on screen instead of being sent by SMS.
            </p>
        )}

        {!sent ? (
            <form onSubmit={send} className="grid gap-3" noValidate>
              <input
                  className={inputCls}
                  type="tel"
                  placeholder="+919876543210"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy}
                  data-testid="otp-phone-input"
              />
              {error && (
                  <div
                      className="flex items-start gap-2 text-xs text-hard bg-[color:var(--hard)]/10 px-3 py-2 rounded-lg"
                      data-testid="auth-error"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="break-words">{error}</span>
                  </div>
              )}
              <button
                  disabled={busy || !phoneOk}
                  className={primaryCls}
                  data-testid="otp-send-button"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Send OTP
              </button>
            </form>
        ) : (
            <form onSubmit={verify} className="grid gap-3" noValidate>
              <p className="text-sm text-muted-foreground">
                Code sent to{" "}
                <span className="text-foreground font-semibold">
                            {phone}
                        </span>
              </p>
              {sent.demo_code && (
                  <p
                      className="font-mono text-sm"
                      data-testid="otp-demo-code"
                  >
                    Your demo OTP:{" "}
                    <span className="text-primary font-bold tracking-widest">
                                {sent.demo_code}
                            </span>
                  </p>
              )}
              <input
                  className={`${inputCls} font-mono tracking-[0.5em] text-center`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, ""))
                  }
                  disabled={busy}
                  data-testid="otp-code-input"
              />
              {error && (
                  <div
                      className="flex items-start gap-2 text-xs text-hard bg-[color:var(--hard)]/10 px-3 py-2 rounded-lg"
                      data-testid="auth-error"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="break-words">{error}</span>
                  </div>
              )}
              <button
                  disabled={busy || code.length < 4}
                  className={primaryCls}
                  data-testid="otp-verify-button"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Verify &amp; sign in
              </button>
              <div className="flex justify-between text-xs">
                <button
                    type="button"
                    onClick={() => {
                      setSent(null);
                      setCode("");
                      setError(null);
                    }}
                    disabled={busy}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Change number
                </button>
                <button
                    type="button"
                    onClick={send}
                    disabled={busy}
                    className="text-primary font-semibold disabled:opacity-50"
                    data-testid="otp-resend-button"
                >
                  Resend OTP
                </button>
              </div>
            </form>
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Providers loader — display setup-pending tag
// ═══════════════════════════════════════════════════════════════
function soonTag(on) {
  if (on) return null;
  return (
      <span className="text-[10px] px-1.5 rounded bg-secondary text-muted-foreground font-medium">
            setup pending
        </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Main AuthPage
// ═══════════════════════════════════════════════════════════════
export default function AuthPage() {
  const [method, setMethod] = useState(null);
  const [providers, setProviders] = useState({});
  const [providersLoading, setProvidersLoading] = useState(true);
  const [oauthBusy, setOauthBusy] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  // ═══ Load providers ═══
  useEffect(() => {
    let cancelled = false;
    api.get("/auth/providers")
        .then(({ data }) => {
          if (!cancelled && data && typeof data === "object") {
            setProviders(data);
          }
        })
        .catch(() => {
          // Silent — fallback UI shows all buttons with "setup pending"
        })
        .finally(() => {
          if (!cancelled) setProvidersLoading(false);
        });
    return () => {
      cancelled = true;
    };
  }, []);

  // ═══ Post-login completion ═══
  const done = (data) => {
    if (!data?.token || !data?.user) {
      toast.error("Sign-in failed — please try again");
      return;
    }
    login(data);
    track("login", { method: data.user.provider || "email" });
    navigate(from, { replace: true });
  };

  // ═══ Google OAuth (via emergent auth) ═══
  const google = () => {
    if (oauthBusy) return;
    setOauthBusy("google");
    try {
      localStorage.setItem("cl_after_login", from);
      // DO NOT hardcode this URL, or add fallbacks — it breaks the auth flow
      const redirectUrl = window.location.origin + "/";
      const url = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
          redirectUrl
      )}`;
      if (window.self !== window.top) {
        const w = window.open(url, "_blank");
        if (!w) {
          toast.error("Pop-up blocked. Allow pop-ups and try again.");
          return;
        }
        toast.info(
            "Google sign-in opened in a new tab (it can't run inside the preview frame)."
        );
      } else {
        window.location.href = url;
      }
    } catch (e) {
      toast.error("Could not start Google sign-in");
    } finally {
      // Reset busy after a short delay (page nav usually happens fast)
      setTimeout(() => setOauthBusy(null), 2000);
    }
  };

  // ═══ GitHub / LinkedIn OAuth ═══
  const oauth = async (provider) => {
    if (oauthBusy) return;
    setOauthBusy(provider);
    try {
      localStorage.setItem("cl_after_login", from);
      const redirect_uri = `${window.location.origin}/auth/oauth/${provider}`;
      const { data } = await api.get(`/auth/oauth/${provider}/start`, {
        params: { redirect_uri },
      });
      if (!data?.url) {
        toast.error("Provider did not return a login URL");
        return;
      }
      if (window.self !== window.top) {
        const w = window.open(data.url, "_blank");
        if (!w) {
          toast.error("Pop-up blocked. Allow pop-ups and try again.");
          return;
        }
      } else {
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setTimeout(() => setOauthBusy(null), 2000);
    }
  };

  return (
      <main className="relative z-10 min-h-[calc(100vh-48px)] grid lg:grid-cols-2">
        {/* ── Left promo panel ── */}
        <section className="hidden lg:flex flex-col justify-between p-14 border-r bg-card">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            algoforge
          </p>
          <div>
            <h1 className="font-heading text-5xl font-bold tracking-tight leading-[1.05]">
              Write it. Run it.
              <br />
              <span className="text-primary">Ship it.</span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-md">
              Sign in to submit solutions against hidden tests, get
              problems picked for your interests, and watch your
              heatmap light up.
            </p>
          </div>
          <pre className="font-mono text-xs text-muted-foreground leading-relaxed">
                    {`> submit two-sum --lang java\n  ✓ 6/6 testcases passed\n  Accepted · 84 ms`}
                </pre>
        </section>

        {/* ── Right auth panel ── */}
        <section className="flex items-center justify-center p-6">
          <div className="rise w-full max-w-sm" data-testid="auth-modal">
            <h2 className="font-heading text-3xl font-bold tracking-tight">
              Sign in
            </h2>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Choose how you'd like to continue.
            </p>

            {method && (
                <button
                    onClick={() => setMethod(null)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
                    data-testid="auth-back-button"
                >
                  <ArrowLeft className="w-4 h-4" />
                  All sign-in options
                </button>
            )}

            {method === "email" && <EmailForm onDone={done} />}
            {method === "otp" && (
                <OtpForm onDone={done} demo={providers.otp === "demo"} />
            )}

            {!method && (
                <div className="grid gap-2.5">
                  {providersLoading ? (
                      // Skeleton while providers load
                      <div className="grid gap-2.5 animate-pulse">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-11 rounded-lg bg-secondary"
                            />
                        ))}
                      </div>
                  ) : (
                      <>
                        <button
                            onClick={google}
                            disabled={!!oauthBusy}
                            data-testid="auth-google-button"
                            className={btnCls}
                        >
                          {oauthBusy === "google" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                              <GoogleIcon />
                          )}
                          Continue with Google
                        </button>

                        <button
                            onClick={() => oauth("github")}
                            disabled={
                                !!oauthBusy ||
                                providers.github === false
                            }
                            data-testid="auth-github-button"
                            className={btnCls}
                        >
                          {oauthBusy === "github" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                              <Github className="w-4 h-4" />
                          )}
                          Continue with GitHub{" "}
                          {soonTag(providers.github)}
                        </button>

                        <button
                            onClick={() => oauth("linkedin")}
                            disabled={
                                !!oauthBusy ||
                                providers.linkedin === false
                            }
                            data-testid="auth-linkedin-button"
                            className={btnCls}
                        >
                          {oauthBusy === "linkedin" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                              <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                          )}
                          Continue with LinkedIn{" "}
                          {soonTag(providers.linkedin)}
                        </button>

                        <button
                            onClick={() => setMethod("otp")}
                            disabled={!!oauthBusy}
                            data-testid="auth-mobile-otp-button"
                            className={btnCls}
                        >
                          <Smartphone className="w-4 h-4" />
                          Continue with Mobile OTP{" "}
                          {providers.otp === "demo" && (
                              <span className="text-[10px] px-1.5 rounded bg-secondary text-medium">
                                                demo
                                            </span>
                          )}
                        </button>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground my-2">
                          <div className="h-px flex-1 bg-border" />
                          or
                          <div className="h-px flex-1 bg-border" />
                        </div>

                        <button
                            onClick={() => setMethod("email")}
                            disabled={!!oauthBusy}
                            data-testid="auth-email-method-button"
                            className={btnCls}
                        >
                          <Mail className="w-4 h-4" /> Email &amp;
                          password
                        </button>
                      </>
                  )}
                </div>
            )}
          </div>
        </section>
      </main>
  );
}