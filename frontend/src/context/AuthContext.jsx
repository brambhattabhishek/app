import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const checkAuth = useCallback(async () => {
    if (!localStorage.getItem("cl_token")) return setUser(false);
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("cl_token");
      setUser(false);
    }
  }, []);

  useEffect(() => {
    // Skip /me while returning from Google OAuth; AuthCallback establishes the session first
    if (window.location.hash?.includes("session_id=")) return;
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Sync login done in another tab (e.g. Google opened outside the preview iframe)
    const onStorage = (e) => { if (e.key === "cl_token") checkAuth(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [checkAuth]);

  const login = useCallback(({ token, user: u, greeting }) => {
    localStorage.setItem("cl_token", token);
    setUser(u);
    if (greeting === "welcome") toast.success(`Welcome to AlgoForge, ${u.name}!`);
    else if (greeting === "welcome_back") toast.success(`Welcome back, ${u.name}! Good to see you again.`);
    else toast.success(`Signed in as ${u.name}`);
  }, []);
  const logout = () => {
    localStorage.removeItem("cl_token");
    setUser(false);
  };

  return <AuthCtx.Provider value={{ user, setUser, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
