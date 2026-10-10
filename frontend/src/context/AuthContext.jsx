import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

  const login = ({ token, user: u }) => {
    localStorage.setItem("cl_token", token);
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem("cl_token");
    setUser(false);
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
