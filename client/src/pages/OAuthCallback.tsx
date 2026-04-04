import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { setStoredAuthToken } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const payload = useMemo(() => {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const token = String(params.get("token") || "").trim();
    const next = String(params.get("next") || "/analyze").trim() || "/analyze";
    return { token, next };
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!payload.token) {
        navigate("/login?oauth=github_failed", { replace: true });
        return;
      }

      setStoredAuthToken(payload.token);

      try {
        await refreshUser();
        navigate(payload.next.startsWith("/") ? payload.next : "/analyze", {
          replace: true,
        });
      } catch {
        setStoredAuthToken("");
        navigate("/login?oauth=github_failed", { replace: true });
      }
    };

    run();
  }, [navigate, payload.next, payload.token, refreshUser]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Finishing sign-in...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
