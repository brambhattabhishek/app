import { api } from "@/lib/api";

const GA =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GA_ID) ||
    (typeof process !== "undefined" && process.env?.REACT_APP_GA_ID) ||
    "";

const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;

// ─── Fallback UUID for older browsers ─────────────────────────
function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const anonId = () => {
  let id = localStorage.getItem("cl_anon");
  if (!id) {
    id = uuid();
    localStorage.setItem("cl_anon", id);
  }
  return id;
};

export function initAnalytics() {
  if (!GA || typeof window === "undefined" || window.gtag) return;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA, {
    send_page_view: false,
    anonymize_ip: true,
  });
}

// ─── Debounce duplicate events ────────────────────────────────
const recent = new Map();
function shouldFire(event, slug) {
  const key = `${event}:${slug || ""}`;
  const now = Date.now();
  const last = recent.get(key) || 0;
  if (now - last < 500) return false;
  recent.set(key, now);
  return true;
}

// ─── Batch queue (prevents backend spam) ──────────────────────
const pendingQueue = [];
let flushTimer = null;

function flush() {
  flushTimer = null;
  if (!pendingQueue.length) return;
  const batch = pendingQueue.splice(0, 20);

  for (const p of batch) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    api.post("/track", p, { signal: controller.signal })
        .catch((err) => {
          // Silent in prod, warn in dev
          if (isDev && err?.name !== "AbortError") {
            console.warn("[analytics] track failed:", err?.message, p);
          }
          // Re-queue for retry (max 20 to prevent leak)
          if (pendingQueue.length < 20 && err?.name !== "AbortError") {
            pendingQueue.push(p);
          }
        })
        .finally(() => clearTimeout(timeout));
  }
}

function queueTrack(payload) {
  pendingQueue.push(payload);
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 2000);   // batch every 2s
  }
}

// ─── Public API ──────────────────────────────────────────────
export function track(event, data = {}) {
  if (!event || typeof event !== "string") return;

  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", event, data);
  }

  const slug = data.slug || data.problem_slug || null;
  if (!shouldFire(event, slug)) return;

  const payload = {
    event,
    path: typeof window !== "undefined" ? window.location.pathname : null,
    anon_id: anonId(),
  };
  if (slug) payload.slug = slug;

  queueTrack(payload);
}

// ─── Flush on page unload (last-second events) ──────────────
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (pendingQueue.length) {
      // use sendBeacon for reliable last-second delivery
      const url = (api.defaults?.baseURL || "") + "/track";
      for (const p of pendingQueue.splice(0, 10)) {
        navigator.sendBeacon?.(url, JSON.stringify(p));
      }
    }
  });
}