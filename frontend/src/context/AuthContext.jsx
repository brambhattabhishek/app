import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════
//  AuthContext
//
//  The `user` state carries one of THREE meaningful values:
//
//    null   →  auth check still in flight (DO NOT treat as guest)
//    false  →  confirmed guest (no valid token)
//    {...}  →  authenticated user object
//
//  Consumers MUST check `user === null` separately from `!user`.
//  Hooks (see hooks/useProblemsQuery.js) rely on this distinction.
// ═══════════════════════════════════════════════════════════════

const AuthCtx = createContext(null);

// Token key used everywhere — single source of truth
const TOKEN_KEY = "cl_token";

// Safe localStorage helpers — private mode / quota can throw
const safeGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};
const safeRemove = (k) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

// ═══════════════════════════════════════════════════════════════
//  Provider
// ═══════════════════════════════════════════════════════════════
export function AuthProvider({ children }) {
  // null → checking | false → guest | {} → logged in
  const [user, setUser] = useState(null);

  // Guard against concurrent /auth/me calls
  const checkingRef = useRef(false);

  // ═══════════════════════════════════════════════════════════
  //  checkAuth — validate stored token against backend
  // ═══════════════════════════════════════════════════════════
  const checkAuth = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    const token = safeGet(TOKEN_KEY);
    if (!token) {
      setUser(false);
      checkingRef.current = false;
      return;
    }

    try {
      const { data } = await api.get("/auth/me");
      // Guard against malformed responses
      if (data && typeof data === "object" && data.user_id) {
        setUser(data);
      } else {
        safeRemove(TOKEN_KEY);
        setUser(false);
      }
    } catch (err) {
      // 401 / 403 → token invalid or expired → clear and logout
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        safeRemove(TOKEN_KEY);
      }
      // For transient errors (network, 500) — keep token; user can retry
      // But we still mark them as guest to allow guest browsing
      setUser(false);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  Initial check on mount
  //  Skip while returning from OAuth — AuthCallback handles it
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const isOAuthReturn =
        hash.includes("session_id=") ||
        search.includes("session_id=") ||
        /\/auth\/oauth\//.test(window.location.pathname);

    if (isOAuthReturn) {
      // AuthCallback / OAuthCallback will call login() once done
      return;
    }
    checkAuth();
  }, [checkAuth]);

  // ═══════════════════════════════════════════════════════════
  //  Cross-tab sync — login/logout in another tab
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const onStorage = (e) => {
      // Token added / removed / changed in another tab
      if (e.key === TOKEN_KEY) {
        if (e.newValue) {
          checkAuth();
        } else {
          setUser(false);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [checkAuth]);

  // ═══════════════════════════════════════════════════════════
  //  login — called by login forms / OAuth callbacks
  // ═══════════════════════════════════════════════════════════
  const login = useCallback((payload) => {
    const { token, user: u, greeting } = payload || {};

    // Defensive — never persist a broken session
    if (!token || !u || !u.user_id) {
      console.warn("[auth] login() called with invalid payload", payload);
      toast.error("Sign-in failed — please try again");
      return;
    }

    safeSet(TOKEN_KEY, token);
    setUser(u);

    const name = u.name || u.email || "there";
    if (greeting === "welcome") {
      toast.success(`Welcome to AlgoForge, ${name}!`);
    } else if (greeting === "welcome_back") {
      toast.success(`Welcome back, ${name}! Good to see you again.`);
    } else {
      toast.success(`Signed in as ${name}`);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  logout — clear token and mark as guest
  // ═══════════════════════════════════════════════════════════
  const logout = useCallback(() => {
    safeRemove(TOKEN_KEY);
    setUser(false);
    // Best-effort: also clear per-user query cache
    try {
      // If the app passes a queryClient in, we can call it here.
      // Otherwise TanStack handles cache partitioning via user_id
      // in the query key (guest vs user_id) — so no stale data leaks.
    } catch {
      /* ignore */
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  refresh — manually re-check auth (e.g., after admin role change)
  // ═══════════════════════════════════════════════════════════
  const refresh = useCallback(() => {
    if (user && user !== false) {
      // Already logged in — refetch fresh user data
      checkAuth();
    } else if (user === false) {
      // Guest — try to promote if a token appeared
      checkAuth();
    }
    // If null (checking) — nothing to do
  }, [user, checkAuth]);

  const value = {
    user,
    setUser,
    login,
    logout,
    refresh,
    // Convenience flags
    isLoading: user === null,
    isGuest: user === false,
    isAuthenticated: !!user && user !== false,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// ═══════════════════════════════════════════════════════════════
//  useAuth hook
// ═══════════════════════════════════════════════════════════════
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
};