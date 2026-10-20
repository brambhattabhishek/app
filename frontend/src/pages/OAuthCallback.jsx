import { useEffect, useRef } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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

    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const description = params.get("error_description");

    if (!["github", "linkedin"].includes(provider)) {
      toast.error("Unsupported login provider.");
      navigate("/login", { replace: true });
      return;
    }

    if (oauthError || !code || !state) {
      toast.error(
          description
              ? decodeURIComponentSafe(description)
              : oauthError === "access_denied"
                  ? "Login was cancelled."
                  : "Invalid OAuth callback. Please try again."
      );
      navigate("/login", { replace: true });
      return;
    }

    const back = localStorage.getItem("cl_after_login") || "/";
    localStorage.removeItem("cl_after_login");

    api
        .post(`/auth/oauth/${provider}/callback`, { code, state })
        .then(({ data }) => {
          login(data);
          navigate(back, { replace: true });
        })
        .catch((error) => {
          toast.error(errMsg(error));
          navigate("/login", { replace: true });
        });
  }, [params, provider, login, navigate]);

  return (
      <div className="min-h-[calc(100vh-48px)] grid place-items-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Completing {provider} sign in…
        </div>
      </div>
  );
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}
