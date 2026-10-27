import { useEffect, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════
const SUPPORTED_PROVIDERS = ["github", "linkedin"];

// ═══════════════════════════════════════════════════════════════
//  Safe decoding for query params (URL-encoded messages from provider)
// ═══════════════════════════════════════════════════════════════
function decodeURIComponentSafe(value) {
  if (typeof value !== "string") return value;
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

// ═══════════════════════════════════════════════════════════════
//  Human-friendly provider names for display
// ═══════════════════════════════════════════════════════════════
function providerLabel(p) {
  switch (p) {
    case "github":
      return "GitHub";
    case "linkedin":
      return "LinkedIn";
    default:
      return p || "provider";
  }
}

// ═══════════════════════════════════════════════════════════════
//  Main component
// ═══════════════════════════════════════════════════════════════
export default function OAuthCallback() {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const done = useRef(false);
  const [error, setError] = useState(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    // ═══ Parse provider + params ═══
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const description = params.get("error_description");

    // ═══ Resolve post-login destination (read before cleanup) ═══
    const back = localStorage.getItem("cl_after_login") || "/";
    localStorage.removeItem("cl_after_login");

    // ═══ Clean query params from URL so refresh doesn't retry ═══
    try {
      window.history.replaceState(
          null,
          "",
          window.location.pathname
      );
    } catch {
      /* ignore in exotic environments */
    }

    // ═══ Helper: fail fast with user-facing message ═══
    const fail = (msg, redirectDelayMs = 1400) => {
      const safeMsg = msg || "Login failed. Please try again.";
      setError(safeMsg);
      toast.error(safeMsg);
      setTimeout(
          () => navigate("/login", { replace: true }),
          redirectDelayMs
      );
    };

    // ═══ Validate provider ═══
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      fail("This login provider isn't supported.", 1000);
      return;
    }

    // ═══ Provider returned an error (user cancelled, config issue, etc.) ═══
    if (oauthError) {
      let msg;
      if (description) {
        msg = decodeURIComponentSafe(description);
      } else if (oauthError === "access_denied") {
        msg = "Login was cancelled.";
      } else {
        msg = `Could not complete ${providerLabel(
            provider
        )} sign-in.`;
      }
      fail(msg);
      return;
    }

    // ═══ Missing required params ═══
    if (!code || !state) {
      fail("Invalid OAuth callback. Please try again.");
      return;
    }

    // ═══ Slow network hint after 8 seconds ═══
    const slowTimer = setTimeout(() => setSlow(true), 8000);

    // ═══ Exchange code + state for a JWT ═══
    let cancelled = false;
    api.post(`/auth/oauth/${provider}/callback`, { code, state })
        .then(({ data }) => {
          if (cancelled) return;

          // Defensive — backend should always return { token, user }
          if (!data?.token || !data?.user) {
            fail("Sign-in failed — no session returned.");
            return;
          }

          // Persist via AuthContext (sets user + localStorage)
          login(data);

          // Analytics — never block navigation
          try {
            track("login", {
              method: data.user.provider || provider,
            });
          } catch {
            /* ignore */
          }

          // Navigate to origin page
          navigate(back || "/", { replace: true });
        })
        .catch((e) => {
          if (cancelled) return;
          const msg = errMsg(e) || "Could not complete sign-in";
          fail(msg, 1800);
        })
        .finally(() => {
          clearTimeout(slowTimer);
        });

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
    // Intentionally narrow deps — we only run once per mount.
    // The URL params are cleaned above so re-mounts won't re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  Error state
  // ═══════════════════════════════════════════════════════════
  if (error) {
    return (
        <div
            className="min-h-[calc(100vh-48px)] grid place-items-center px-4"
            data-testid="oauth-callback-error"
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
  const label = providerLabel(provider);

  return (
      <div
          className="min-h-[calc(100vh-48px)] grid place-items-center px-4"
          data-testid="oauth-callback"
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Completing {label} sign in…
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