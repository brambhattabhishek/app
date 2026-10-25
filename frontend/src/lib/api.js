import axios from "axios";

// ═══════════════════════════════════════════════════════════════
//  Base URL — Vite + CRA compatible
// ═══════════════════════════════════════════════════════════════
const BACKEND_URL =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) ||
    (typeof process !== "undefined" && process.env?.REACT_APP_BACKEND_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_BACKEND_URL) ||
    "";

export const api = axios.create({
    baseURL: `${BACKEND_URL}/api`,
    timeout: 30000,
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

        // ★ Set the flag BEFORE incrementing so error handler decrements correctly
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
        // ★ Always decrement on failures that started tracking
        if (error.config?._loadingTracked) {
            finishRequest();
        }
        return Promise.reject(error);
    }
);

// ═══════════════════════════════════════════════════════════════
//  Error message helper
// ═══════════════════════════════════════════════════════════════
export const errMsg = (e) => {
    const d = e?.response?.data;

    if (typeof d?.message === "string" && d.message) return d.message;
    if (typeof d?.error === "string" && d.error) return d.error;

    // Fallback for network errors, timeouts
    if (e?.code === "ECONNABORTED") return "Request timed out";
    if (e?.message === "Network Error") return "Network error — check your connection";

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

    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;

    return `${Math.floor(s / 86400)}d ago`;
};