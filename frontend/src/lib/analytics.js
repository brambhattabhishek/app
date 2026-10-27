import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════
//  Environment resolution (Vite + CRA compatible)
// ═══════════════════════════════════════════════════════════════
const GA =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GA_ID) ||
    (typeof process !== "undefined" && process.env?.REACT_APP_GA_ID) ||
    "";

const isDev =
    (typeof import.meta !== "undefined" && import.meta.env?.DEV) ||
    (typeof process !== "undefined" && process.env?.NODE_ENV === "development");

const isBrowser = typeof window !== "undefined";

// ═══════════════════════════════════════════════════════════════
//  UUID helper (with crypto.randomUUID fallback)
// ═══════════════════════════════════════════════════════════════
function uuid() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const anonId = () => {
  if (!isBrowser) return null;
  try {
    let id = localStorage.getItem("cl_anon");
    if (!id || id.length < 8) {
      id = uuid();
      localStorage.setItem("cl_anon", id);
    }
    return id;
  } catch {
    // localStorage disabled (private mode / quota) → fallback in-memory
    return uuid();
  }
};

// ═══════════════════════════════════════════════════════════════
//  Google Analytics — one-time init
// ═══════════════════════════════════════════════════════════════
export function initAnalytics() {
  if (!GA || !isBrowser || window.gtag) return;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA}`;
  s.onerror = () => {
    if (isDev) console.warn("[analytics] GA script failed to load");
  };
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA, {
    send_page_view: false,
    anonymize_ip: true,
  });
}

// ═══════════════════════════════════════════════════════════════
//  Debounce — avoid firing duplicate events within 500ms
// ═══════════════════════════════════════════════════════════════
const recent = new Map();

function shouldFire(event, slug) {
  const key = `${event}:${slug || ""}`;
  const now = Date.now();
  const last = recent.get(key) || 0;
  if (now - last < 500) return false;

  recent.set(key, now);

  // Cleanup old entries — prevent memory leak over long sessions
  if (recent.size > 200) {
    for (const [k, t] of recent) {
      if (now - t > 60_000) recent.delete(k);
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  Batch queue — reduces backend spam
// ═══════════════════════════════════════════════════════════════
const pendingQueue = [];
const MAX_QUEUE = 40;              // hard cap (prevent memory leak)
const MAX_RETRY = 3;               // per-event retry count
const FLUSH_DELAY_MS = 2000;       // batch every 2s
const BATCH_SIZE = 20;             // up to 20 events per flush tick

let flushTimer = null;
let stopped = false;               // set true on beforeunload to avoid loops

// Track retry count per payload (WeakMap keeps it light)
const retryCount = new WeakMap();

function scheduleFlush() {
  if (flushTimer || stopped) return;
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

function flush() {
  flushTimer = null;
  if (!pendingQueue.length || stopped) return;

  const batch = pendingQueue.splice(0, BATCH_SIZE);

  for (const p of batch) {
    // AbortController per-request with 5s timeout
    const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller
        ? setTimeout(() => controller.abort(), 5000)
        : null;

    const config = controller ? { signal: controller.signal } : undefined;

    api.post("/track", p, config)
        .catch((err) => {
          // Aborted (timeout) or network blip — requeue if room
          const name = err?.name || "";
          const isAbort = name === "AbortError" || name === "CanceledError";

          if (isDev && !isAbort) {
            console.warn("[analytics] track failed:", err?.message, p);
          }

          if (pendingQueue.length >= MAX_QUEUE) return;

          // Aborts / 5xx → retry (bounded). 4xx → drop (client bug).
          const status = err?.response?.status;
          const isClientError = status && status >= 400 && status < 500;
          if (isClientError) return;

          const tries = (retryCount.get(p) || 0) + 1;
          if (tries > MAX_RETRY) return;
          retryCount.set(p, tries);

          pendingQueue.push(p);
          scheduleFlush();
        })
        .finally(() => {
          if (timeout) clearTimeout(timeout);
        });
  }
}

function queueTrack(payload) {
  if (stopped) return;
  if (pendingQueue.length >= MAX_QUEUE) {
    // Drop oldest — keep most recent events
    pendingQueue.shift();
  }
  pendingQueue.push(payload);
  scheduleFlush();
}

// ═══════════════════════════════════════════════════════════════
//  Public: track(event, data)
// ═══════════════════════════════════════════════════════════════
export function track(event, data = {}) {
  if (!event || typeof event !== "string") return;
  if (!isBrowser) return;

  // GA (if loaded)
  if (window.gtag) {
    try {
      window.gtag("event", event, data);
    } catch {
      /* GA errors must never break the app */
    }
  }

  const slug = data.slug || data.problem_slug || null;
  if (!shouldFire(event, slug)) return;

  const payload = {
    event: event.slice(0, 40),
    path: window.location.pathname,
    anon_id: anonId(),
  };
  if (slug) payload.slug = String(slug).slice(0, 200);

  queueTrack(payload);
}

// ═══════════════════════════════════════════════════════════════
//  Flush on page unload — use sendBeacon for reliability
// ═══════════════════════════════════════════════════════════════
if (isBrowser) {
  const flushBeacon = () => {
    stopped = true;                    // stop the timer loop
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!pendingQueue.length) return;

    try {
      // baseURL from axios config → full URL
      const base = api?.defaults?.baseURL || "";
      const url = base.replace(/\/+$/, "") + "/track";

      for (const p of pendingQueue.splice(0, 10)) {
        if (navigator.sendBeacon) {
          const body = new Blob([JSON.stringify(p)], {
            type: "application/json",
          });
          navigator.sendBeacon(url, body);
        }
      }
    } catch {
      /* never throw on unload */
    }
  };

  window.addEventListener("beforeunload", flushBeacon);
  window.addEventListener("pagehide", flushBeacon);       // iOS Safari fallback

  // Restore after bfcache back-navigation (Safari/Firefox)
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      stopped = false;
      scheduleFlush();
    }
  });
}