import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function OAuthCallback() {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const code = params.get("code"), state = params.get("state");
    const back = localStorage.getItem("cl_after_login") || "/";
    localStorage.removeItem("cl_after_login");
    if (!code) {
      toast.error(params.get("error_description") || "Login was cancelled");
      navigate("/login", { replace: true });
      return;
    }
    api.post(`/auth/oauth/${provider}/callback`, { code, state })
      .then(({ data }) => { login(data); navigate(back, { replace: true }); })
      .catch((e) => { toast.error(errMsg(e)); navigate("/login", { replace: true }); });
  }, [params, provider, login, navigate]);

  return (
    <div className="min-h-[calc(100vh-48px)] grid place-items-center" data-testid="oauth-callback">
      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" />Completing {provider} sign in…</div>
    </div>
  );
}
