import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";

// ═══════════════════════════════════════════════════════════════
//  AuthCallback — handles Google OAuth session handoff
//
//  Flow:
//   1. Provider redirects to app with  #session_id=xxx  in URL hash
//   2. We POST that session_id to /auth/google
//   3. Backend validates with provider + returns { token, user }
//   4. We store token (via login()) and navigate to origin page
// ═══════════════════════════════════════════════════════════════

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  // Prevent double-execution (React StrictMode, double effects)
  const done = useRef(false);

  // UI states
  const [error, setError] = useState(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    // ── Parse session_id from URL hash ──
    const hash = (location.hash || "").replace(/^#/, "");
    const sid = new URLSearchParams(hash).get("session_id");

    // ── Resolve post-login destination ──
    const back = localStorage.getItem("cl_after_login") || "/";
    localStorage.removeItem("cl_after_login");

    // ── Clean the hash from URL bar so refresh doesn't retry ──
    try {
      window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
      );
    } catch {
      /* ignore — older browsers */
    }

    // ── Missing session_id → straight to login ──
    if (!sid) {
      const msg = "Sign-in session missing. Please try again.";
      setError(msg);
      toast.error(msg);
      // Small delay so user sees the message before redirect
      setTimeout(() => navigate("/login", { replace: true }), 1200);
      return;
    }

    // ── Slow-network hint after 8s ──
    const slowTimer = setTimeout(() => setSlow(true), 8000);

    // ── Exchange session_id for a real JWT ──
    let cancelled = false;
    api.post("/auth/google", { session_id: sid })
        .then(({ data }) => {
          if (cancelled) return;

          // Defensive — backend should always return { token, user }
          if (!data?.token || !data?.user) {
            const msg = "Sign-in failed — no session returned.";
            setError(msg);
            toast.error(msg);
            setTimeout(() => navigate("/login", { replace: true }), 1200);
            return;
          }

          // Persist via AuthContext (sets user + localStorage)
          login(data);

          // Analytics — best-effort, must not block navigation
          try {
            track("login", { method: data.user.provider || "google" });
          } catch {
            /* ignore */
          }

          // Navigate to origin page
          navigate(back || "/", { replace: true });
        })
        .catch((e) => {
          if (cancelled) return;
          const msg = errMsg(e) || "Could not complete sign-in";
          setError(msg);
          toast.error(msg);
          // Let user read the error briefly, then redirect
          setTimeout(() => navigate("/login", { replace: true }), 1800);
        })
        .finally(() => {
          clearTimeout(slowTimer);
        });

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
    // Intentionally narrow deps — we only run once per mount.
    // location.hash changes shouldn't retrigger (hash is cleaned above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  Error state — user-facing with manual escape
  // ═══════════════════════════════════════════════════════════
  if (error) {
    return (
        <div
            className="min-h-screen bg-background grid place-items-center px-4"
            data-testid="auth-callback-error"
        >
          <div className="max-w-sm text-center">
            <AlertCircle className="w-10 h-10 text-hard mx-auto mb-3" />
            <h2 className="font-heading text-xl font-bold mb-2">
              Sign-in didn't complete
            </h2>
            <p className="text-sm text-muted-foreground mb-5 break-words">
              {error}
            </p>
            <button
                onClick={() => navigate("/login", { replace: true })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </button>
          </div>
        </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Loading state
  // ═══════════════════════════════════════════════════════════
  return (
      <div
          className="min-h-screen bg-background grid place-items-center px-4"
          data-testid="auth-callback"
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing you in…
          </div>
          {slow && (
              <p className="mt-3 text-xs text-muted-foreground animate-pulse-subtle">
                This is taking longer than usual. Please wait…
              </p>
          )}
        </div>
      </div>
  );
}