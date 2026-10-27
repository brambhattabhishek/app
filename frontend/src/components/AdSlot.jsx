import { useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
//  Environment resolution — Vite + CRA compatible
// ═══════════════════════════════════════════════════════════════
const CLIENT =
    (typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_ADSENSE_CLIENT) ||
    (typeof process !== "undefined" &&
        process.env?.REACT_APP_ADSENSE_CLIENT) ||
    "";

const SLOT =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_ADSENSE_SLOT) ||
    (typeof process !== "undefined" &&
        process.env?.REACT_APP_ADSENSE_SLOT) ||
    "";

const isDev =
    (typeof import.meta !== "undefined" && import.meta.env?.DEV) ||
    (typeof process !== "undefined" &&
        process.env?.NODE_ENV === "development");

// ═══════════════════════════════════════════════════════════════
//  AdSense script loader — safe for concurrent callers
// ═══════════════════════════════════════════════════════════════
let loadPromise = null;

function loadAdsense() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.adsbygoogle?.loaded) return Promise.resolve(true);

  // Reuse in-flight load
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    // Already injected by some other code path
    let script = document.getElementById("adsense-js");
    if (!script) {
      script = document.createElement("script");
      script.id = "adsense-js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
          CLIENT
      )}`;
      document.head.appendChild(script);
    }

    // If already loaded (script cached by browser)
    if (window.adsbygoogle?.loaded) {
      resolve(true);
      return;
    }

    const onLoad = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      resolve(true);
    };
    const onError = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (isDev) {
        console.warn("[AdSlot] AdSense script failed to load");
      }
      resolve(false);
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    // Safety: give up after 10s
    setTimeout(() => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      resolve(!!window.adsbygoogle);
    }, 10_000);
  });

  return loadPromise;
}

// ═══════════════════════════════════════════════════════════════
//  AdSlot
// ═══════════════════════════════════════════════════════════════
export default function AdSlot({ id, className = "" }) {
  const adRef = useRef(null);
  const initializedRef = useRef(false);

  // AdSense IDs are optional — graceful no-op when absent
  const enabled = !!CLIENT && !!SLOT;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadAdsense().then((loaded) => {
      if (cancelled || !loaded) return;
      if (!adRef.current) return;
      if (initializedRef.current) return;
      if (adRef.current.dataset.initialized === "true") return;

      initializedRef.current = true;
      adRef.current.dataset.initialized = "true";

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        // AdSense throws if the element isn't fully in DOM yet, or
        // when script is blocked by an extension — treat as non-fatal
        initializedRef.current = false;
        delete adRef.current.dataset.initialized;
        if (isDev) {
          console.warn("[AdSlot] push failed:", error?.message);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // ── No config → render nothing (not even placeholder)
  if (!enabled) {
    return null;
  }

  return (
      <ins
          ref={adRef}
          data-testid={`ad-slot-${id || "default"}`}
          className={`adsbygoogle block ${className}`}
          style={{ display: "block", minHeight: "100px" }}
          data-ad-client={CLIENT}
          data-ad-slot={SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
      />
  );
}