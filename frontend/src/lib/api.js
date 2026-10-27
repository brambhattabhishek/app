import axios from "axios";

// ═══════════════════════════════════════════════════════════════
//  BACKEND URL resolution — CRA + Vite compatible
//
//  CRA inlines REACT_APP_* at build time → must be read as
//  process.env.REACT_APP_BACKEND_URL (literal, not dynamic).
//
//  Vite exposes import.meta.env at runtime → check safely.
// ═══════════════════════════════════════════════════════════════

// CRA — safe, replaces at build time. Do NOT wrap in typeof guard,
// because CRA needs the literal `process.env.REACT_APP_BACKEND_URL`
// token to find & replace it.
let backendUrl = "";

// Vite detection — only access import.meta.env when actually in Vite
try {
    // eslint-disable-next-line no-undef
    if (typeof import.meta !== "undefined" && import.meta.env) {
        // eslint-disable-next-line no-undef
        backendUrl = import.meta.env.VITE_BACKEND_URL || "";
    }
} catch {
    backendUrl = "";
}

// Fallback to CRA env (build-time replacement)
if (!backendUrl) {
    // eslint-disable-next-line no-undef
    backendUrl = process.env.REACT_APP_BACKEND_URL || "";
}

// Final safety — if still empty, use same origin (which won't work
// for a split deployment, but at least warns the developer)
if (!backendUrl) {
    // eslint-disable-next-line no-console
    console.error(
        "[api] BACKEND_URL is empty! " +
        "Set REACT_APP_BACKEND_URL (CRA) or VITE_BACKEND_URL (Vite) " +
        "and rebuild the frontend."
    );
}

// Strip trailing slash to prevent `/api` double-slash bugs
const CLEAN = backendUrl.replace(/\/+$/, "");

export const BACKEND_URL = CLEAN;

// ═══════════════════════════════════════════════════════════════
//  Axios instance
// ═══════════════════════════════════════════════════════════════
export const api = axios.create({
    baseURL: `${CLEAN}/api`,
    timeout: 30000,
    // Send cookies for same-origin avatar/auth flows
    withCredentials: false,
});

// ═══════════════════════════════════════════════════════════════
//  Global API loading tracker
// ═══════════════════════════════════════════════════════════════
let activeRequests = 0;
const loadingListeners = new Set();

const notifyLoadingListeners = () => {
    loadingListeners.forEach((listener) => listener(activeRequests));
};

export const getActiveApiRequests = () => activeRequests;

export const subscribeToApiLoading = (listener) => {
    loadingListeners.add(listener);
    return () => loadingListeners.delete(listener);
};

const finishRequest = () => {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyLoadingListeners();
};

// ═══════════════════════════════════════════════════════════════
//  Public paths — no Authorization header on these
// ═══════════════════════════════════════════════════════════════
const PUBLIC_PATHS = [
    "/auth/login",
    "/auth/register",
    "/auth/providers",
    "/auth/otp/send",
    "/auth/otp/verify",
];

// ═══════════════════════════════════════════════════════════════
//  Request interceptor — auth token + loading tracking
// ═══════════════════════════════════════════════════════════════
api.interceptors.request.use(
    (config) => {
        const isPublic = PUBLIC_PATHS.some((p) =>
            (config.url || "").includes(p)
        );

        if (!isPublic) {
            const token = localStorage.getItem("cl_token");
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }

        config._loadingTracked = true;
        activeRequests++;
        notifyLoadingListeners();

        return config;
    },
    (error) => Promise.reject(error)
);

// ═══════════════════════════════════════════════════════════════
//  Response interceptor — decrement on success AND failure
// ═══════════════════════════════════════════════════════════════
api.interceptors.response.use(
    (response) => {
        if (response.config?._loadingTracked) {
            finishRequest();
        }
        return response;
    },
    (error) => {
        if (error.config?._loadingTracked) {
            finishRequest();
        }

        // Detect the "SPA fallback returned HTML instead of JSON" case
        // so it surfaces as a helpful error, not silent breakage
        const ct = error?.response?.headers?.["content-type"] || "";
        if (
            error?.response?.status === 200 &&
            ct.includes("text/html")
        ) {
            console.error(
                "[api] Backend returned HTML — this usually means " +
                "REACT_APP_BACKEND_URL is missing from the build. " +
                "Set it in Render env vars and REDEPLOY (env var changes " +
                "require a rebuild for CRA)."
            );
        }

        return Promise.reject(error);
    }
);

// ═══════════════════════════════════════════════════════════════
//  Error message helper
// ═══════════════════════════════════════════════════════════════
export const errMsg = (e) => {
    const d = e?.response?.data;

    if (typeof d === "string" && d.length < 500) return d;
    if (typeof d?.message === "string" && d.message) return d.message;
    if (typeof d?.error === "string" && d.error) return d.error;

    if (e?.code === "ECONNABORTED") return "Request timed out";
    if (e?.message === "Network Error")
        return "Network error — check your connection";

    return e?.message || "Something went wrong";
};

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════
export const LANGS = [
    { id: "python", label: "Python3", monaco: "python" },
    { id: "java", label: "Java", monaco: "java" },
    { id: "cpp", label: "C++", monaco: "cpp" },
    { id: "javascript", label: "JavaScript", monaco: "javascript" },
];

export const langLabel = (id) =>
    LANGS.find((l) => l.id === id)?.label || id;

export const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (!Number.isFinite(s) || s < 0) return "just now";
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};