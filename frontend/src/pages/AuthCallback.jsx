import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(location.hash.slice(1)).get("session_id");
    const back = localStorage.getItem("cl_after_login") || "/";
    localStorage.removeItem("cl_after_login");
    api.post("/auth/google", { session_id: sid })
      .then(({ data }) => {
        login(data);
        toast.success(`Welcome, ${data.user.name}`);
        navigate(back, { replace: true });
      })
      .catch((e) => {
        toast.error(errMsg(e));
        navigate("/login", { replace: true });
      });
  }, [location.hash, login, navigate]);

  return <div className="min-h-screen bg-background" data-testid="auth-callback" />;
}
