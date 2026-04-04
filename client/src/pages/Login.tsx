import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Code2, Github, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { getGithubLoginUrl, loginWithGoogleAccessToken } from "@/services/api";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(254, "Email is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password is too long"),
});

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(
    null,
  );
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const oauthStatus = new URLSearchParams(location.search).get("oauth");
    if (!oauthStatus) {
      return;
    }

    const mapping: Record<string, string> = {
      github_not_configured: "GitHub login is not configured on the server.",
      github_code_missing: "GitHub login failed: authorization code is missing.",
      github_state_invalid: "GitHub login failed: invalid security state.",
      github_token_exchange_failed: "GitHub login failed: token exchange failed.",
      github_access_token_missing: "GitHub login failed: access token missing.",
      github_profile_failed: "GitHub login failed: profile fetch failed.",
      github_email_missing: "GitHub login failed: no usable email found.",
      github_failed: "GitHub login failed. Please try again.",
      google_failed: "Google login failed. Please try again.",
    };

    setOauthNotice(mapping[oauthStatus] || "Social login failed. Please try again.");
    navigate(location.pathname, { replace: true, state: location.state });
  }, [location.pathname, location.search, location.state, navigate]);

  const googleLogin = useGoogleLogin({
    flow: "implicit",
    ux_mode: "popup",
    scope: "openid email profile",
    onSuccess: async (response) => {
      if (!response?.access_token) {
        setErrors({ general: "Google login failed: access token missing" });
        return;
      }

      try {
        setSocialLoading("google");
        setErrors({});
        await loginWithGoogleAccessToken(response.access_token);
        await refreshUser();
        const redirectTo = (location.state as any)?.from || "/analyze";
        navigate(redirectTo, { replace: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Google login failed";
        setErrors({ general: message });
      } finally {
        setSocialLoading(null);
      }
    },
    onError: () => {
      setErrors({ general: "Google login was cancelled or failed" });
      setSocialLoading(null);
    },
  });

  const handleGoogleLogin = () => {
    if (!googleClientId) {
      setErrors({ general: "Google login is not configured in client env" });
      return;
    }
    setSocialLoading("google");
    googleLogin();
  };

  const handleGithubLogin = () => {
    setSocialLoading("github");
    window.location.assign(getGithubLoginUrl());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      await loginUser({ email, password });
      const redirectTo = (location.state as any)?.from || "/analyze";
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login failed";
      setErrors({ general: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl text-foreground">AI CodeNav</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <div className="glass rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-border text-foreground hover:bg-secondary gap-2"
              onClick={handleGithubLogin}
              disabled={socialLoading !== null}
            >
              <Github className="h-4 w-4" />
              {socialLoading === "github" ? "Redirecting..." : "GitHub"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-border text-foreground hover:bg-secondary gap-2"
              onClick={handleGoogleLogin}
              disabled={socialLoading !== null}
            >
              <Mail className="h-4 w-4" />
              {socialLoading === "google" ? "Opening..." : "Google"}
            </Button>
          </div>

          {oauthNotice && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {oauthNotice}
            </p>
          )}

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or continue with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({...prev, email: ""})); }}
                  placeholder="you@example.com"
                  className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-11"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({...prev, password: ""})); }}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.password}
                </p>
              )}
            </div>

            {errors.general && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.general}
              </p>
            )}

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading || socialLoading !== null}
              className="w-full gradient-primary text-primary-foreground h-11 font-medium hover:opacity-90"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Create one
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
