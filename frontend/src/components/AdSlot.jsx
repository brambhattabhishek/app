import { useEffect, useRef } from "react";

const CLIENT = process.env.REACT_APP_ADSENSE_CLIENT;
const SLOT = process.env.REACT_APP_ADSENSE_SLOT;

function loadAdsense() {
  if (!CLIENT || document.getElementById("adsense-js")) return;
  const s = document.createElement("script");
  s.id = "adsense-js";
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
  document.head.appendChild(s);
}

export default function AdSlot({ id, className = "" }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (!CLIENT || pushed.current) return;
    loadAdsense();
    pushed.current = true;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ad blockers */ }
  }, []);

  if (!CLIENT) {
    return (
      <div data-testid={`ad-slot-${id}`} className={`rounded-xl border border-dashed grid place-items-center text-xs text-muted-foreground py-6 ${className}`}>
        Advertisement · Google AdSense slot (add publisher ID to enable)
      </div>
    );
  }
  return (
    <ins data-testid={`ad-slot-${id}`} className={`adsbygoogle block ${className}`} style={{ display: "block" }}
      data-ad-client={CLIENT} data-ad-slot={SLOT} data-ad-format="auto" data-full-width-responsive="true" />
  );
}
