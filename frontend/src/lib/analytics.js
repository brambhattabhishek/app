import { api } from "@/lib/api";

const GA = process.env.REACT_APP_GA_ID;

export const anonId = () => {
  let id = localStorage.getItem("cl_anon");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("cl_anon", id); }
  return id;
};

export function initAnalytics() {
  if (!GA || window.gtag) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA, { send_page_view: false });
}

export function track(event, data = {}) {
  if (window.gtag) window.gtag("event", event, data);
  api.post("/track", { event, path: window.location.pathname, slug: data.slug, anon_id: anonId() }).catch(() => {});
}
