import axios from "axios";

export const api = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api` });

api.interceptors.request.use((c) => {
  const t = localStorage.getItem("cl_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export const errMsg = (e) => {
  const d = e?.response?.data;
  if (typeof d?.message === "string" && d.message) return d.message;
  if (typeof d?.error === "string") return d.error;
  return e?.message || "Something went wrong";
};

export const LANGS = [
  { id: "python", label: "Python3", monaco: "python" },
  { id: "java", label: "Java", monaco: "java" },
  { id: "cpp", label: "C++", monaco: "cpp" },
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
];

export const langLabel = (id) => LANGS.find((l) => l.id === id)?.label || id;

export const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
