
import { useEffect, useRef } from "react";

const CLIENT = process.env.REACT_APP_ADSENSE_CLIENT;
const SLOT = process.env.REACT_APP_ADSENSE_SLOT;

function loadAdsense() {
  if (window.adsbygoogle) {
    return Promise.resolve(true);
  }

  let script = document.getElementById("adsense-js");

  if (!script) {
    script = document.createElement("script");
    script.id = "adsense-js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src =
        `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
    document.head.appendChild(script);
  }

  return new Promise((resolve) => {
    script.addEventListener("load", () => resolve(true), {
      once: true,
    });
    script.addEventListener("error", () => resolve(false), {
      once: true,
    });

    // Avoid waiting if the existing script has already loaded.
    if (window.adsbygoogle) resolve(true);
  });
}

export default function AdSlot({ id, className = "" }) {
  const adRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    if (!CLIENT || !SLOT || !adRef.current) return;

    loadAdsense().then((loaded) => {
      if (!loaded || cancelled || !adRef.current) return;
      if (adRef.current.dataset.initialized === "true") return;

      adRef.current.dataset.initialized = "true";

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        delete adRef.current.dataset.initialized;
        console.error("AdSense error:", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!CLIENT || !SLOT) {
    return ( ""
        // <div
        //     data-testid={`ad-slot-${id}`}
        //     className={`rounded-xl border border-dashed grid place-items-center text-xs text-muted-foreground py-6 ${className}`}
        // >
        //   Advertisement
        // </div>
    );
  }

  return (""
      // <ins
      //     ref={adRef}
      //     data-testid={`ad-slot-${id}`}
      //     className={`adsbygoogle block ${className}`}
      //     style={{ display: "block", minHeight: "100px" }}
      //     data-ad-client={CLIENT}
      //     data-ad-slot={SLOT}
      //     data-ad-format="auto"
      //     data-full-width-responsive="true"
      // />
  );
}
