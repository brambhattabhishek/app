import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
    window.history.replaceState(null, "", window.location.pathname);
    api.post("/auth/google", { session_id: sid })
      .then(({ data }) => { login(data); navigate(back, { replace: true }); })
      .catch((e) => { toast.error(errMsg(e)); navigate("/login", { replace: true }); });
  }, [location.hash, login, navigate]);

  return (
    <div className="min-h-screen bg-background grid place-items-center" data-testid="auth-callback">
      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" />Signing you in…</div>
    </div>
  );
}
