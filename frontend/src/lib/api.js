
import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
});

// Global API loading tracker
let activeRequests = 0;
const loadingListeners = new Set();

const notifyLoadingListeners = () => {
  loadingListeners.forEach((listener) => listener(activeRequests));
};

export const getActiveApiRequests = () => activeRequests;

export const subscribeToApiLoading = (listener) => {
  loadingListeners.add(listener);

  return () => {
    loadingListeners.delete(listener);
  };
};

const finishRequest = () => {
  activeRequests = Math.max(0, activeRequests - 1);
  notifyLoadingListeners();
};

// Attach authentication token and track API requests
api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("cl_token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      activeRequests++;
      notifyLoadingListeners();

      return config;
    },
    (error) => Promise.reject(error)
);

// Track both successful and failed API responses
api.interceptors.response.use(
    (response) => {
      finishRequest();
      return response;
    },
    (error) => {
      // Only decrement if the request interceptor had started tracking.
      if (error.config?._loadingTracked) {
        finishRequest();
      }

      return Promise.reject(error);
    }
);

// Existing error message helper
export const errMsg = (e) => {
  const d = e?.response?.data;

  if (typeof d?.message === "string" && d.message) return d.message;
  if (typeof d?.error === "string") return d.error;

  return e?.message || "Something went wrong";
};

// Supported programming languages
export const LANGS = [
  { id: "python", label: "Python3", monaco: "python" },
  { id: "java", label: "Java", monaco: "java" },
  { id: "cpp", label: "C++", monaco: "cpp" },
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
];

export const langLabel = (id) =>
    LANGS.find((l) => l.id === id)?.label || id;

// Format timestamps as relative time
export const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);

  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;

  return `${Math.floor(s / 86400)}d ago`;
};
