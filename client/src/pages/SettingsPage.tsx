import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Key,
  Monitor,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  User,
  Sparkles,
  Trash2,
  Check,
  AlertCircle,
  CheckCircle2,
  Loader,
  Crown,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/context/AuthContext";
import { updateCurrentUser, verifyGithubToken } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [githubApiKey, setGithubApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [removeGithubKey, setRemoveGithubKey] = useState(false);
  const [keyChanged, setKeyChanged] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    valid: boolean;
    user?: string;
    name?: string;
  } | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(user?.name || "");
  }, [user]);

  // Clear auto-filled token input on mount
  useEffect(() => {
    if (tokenInputRef.current) {
      // Clear immediately
      tokenInputRef.current.value = "";
      setGithubApiKey("");
      
      // Also clear after a short delay in case password manager fills it later
      const timeoutId = setTimeout(() => {
        if (tokenInputRef.current) {
          tokenInputRef.current.value = "";
          setGithubApiKey("");
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, []);

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  const handleSave = async () => {
    try {
      setSaving(true);

      const payload: { name?: string; githubApiKey?: string } = {};

      if (displayName.trim() && displayName !== user?.name) {
        payload.name = displayName.trim();
      }

      if (githubApiKey.trim()) {
        if (!githubApiKey.startsWith("ghp_") && !githubApiKey.startsWith("github_pat_")) {
          toast({
            title: "Invalid GitHub token format",
            description: "Token should start with 'ghp_' or 'github_pat_'",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        payload.githubApiKey = githubApiKey.trim();
      } else if (removeGithubKey) {
        payload.githubApiKey = "";
      }

      if (Object.keys(payload).length === 0) {
        toast({
          title: "Nothing to save",
          description: "Make changes to your name or GitHub API key first.",
        });
        setSaving(false);
        return;
      }

      const response = await updateCurrentUser(payload);
      setGithubApiKey("");
      setRemoveGithubKey(false);
      setKeyChanged(false);
      setVerificationStatus(null);
      await refreshUser();

      toast({
        title: "✓ Settings saved successfully",
        description: response?.message || "Your profile has been updated.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings";
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyToken = async () => {
    const trimmedToken = githubApiKey.trim();

    if (!trimmedToken) {
      toast({
        title: "Token required",
        description: "Enter a GitHub token first",
        variant: "destructive",
      });
      return;
    }

    // Quick validation before sending to backend
    if (trimmedToken.length < 20) {
      toast({
        title: "Invalid token",
        description: "Token appears to be incomplete or invalid",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedToken.startsWith("ghp_") && !trimmedToken.startsWith("github_pat_")) {
      toast({
        title: "Invalid token format",
        description: "Token should start with 'ghp_' or 'github_pat_'",
        variant: "destructive",
      });
      return;
    }

    try {
      setVerifying(true);
      const result = await verifyGithubToken(trimmedToken);

      setVerificationStatus({
        valid: result.valid,
        user: result.github_user,
        name: result.github_name,
      });

      if (result.valid) {
        toast({
          title: "✓ Token verified",
          description: `Connected as @${result.github_user}`,
        });
      } else {
        toast({
          title: "Token invalid",
          description: result.message || "The token is not valid",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to verify token";
      setVerificationStatus({ valid: false });
      toast({
        title: "Verification failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile, security, and GitHub integration"
      />

      {/* Profile Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 border border-border/50 backdrop-blur-xl"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Your Account
              </p>
              <h2 className="text-2xl font-bold text-foreground truncate">
                {user?.name || "Welcome"}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 text-primary px-4 py-2 text-xs font-medium flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure Storage
            </span>
            {user?.isSubscribed && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 text-xs font-medium flex items-center gap-2">
                <Crown className="h-3.5 w-3.5" />
                Pro
              </span>
            )}
            {user?.hasGithubToken && (
              <span className="rounded-full border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 text-xs font-medium flex items-center gap-2">
                <Check className="h-3.5 w-3.5" />
                GitHub Connected
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
          {/* Profile Section */}
          <div className="glass rounded-2xl p-6 border border-border/50 space-y-5">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Profile</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wide">
                  Display Name
                </label>
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="bg-secondary border-border text-foreground h-10 rounded-lg"
                  placeholder="Enter your display name"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wide">
                  Email Address
                </label>
                <Input
                  value={user?.email || ""}
                  readOnly
                  className="bg-muted border-border text-muted-foreground h-10 rounded-lg"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Email is managed through authentication
                </p>
              </div>
            </div>
          </div>

          {/* GitHub API Key Section */}
          <div className="glass rounded-2xl p-6 border border-border/50 space-y-5">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">
                GitHub Integration
              </h3>
            </div>

            {/* Status indicator */}
            {user?.hasGithubToken && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
              >
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                  GitHub token is configured and active
                </span>
              </motion.div>
            )}

            {!user?.hasGithubToken && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
              >
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                  No GitHub token configured yet
                </span>
              </motion.div>
            )}

            {/* Verification feedback */}
            {verificationStatus && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  verificationStatus.valid
                    ? "bg-green-500/10 border-green-500/20"
                    : "bg-red-500/10 border-red-500/20"
                }`}
              >
                {verificationStatus.valid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div className="text-sm">
                      <p className="text-green-700 dark:text-green-300 font-medium">
                        Token verified successfully
                      </p>
                      {verificationStatus.user && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Connected as @{verificationStatus.user}
                          {verificationStatus.name && ` (${verificationStatus.name})`}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                      Token verification failed
                    </p>
                  </>
                )}
              </motion.div>
            )}

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wide">
                    Personal Access Token
                  </label>
                  {user?.hasGithubToken && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      ✓ Token saved (not shown for security)
                    </span>
                  )}
                </div>
                <Input
                  ref={tokenInputRef}
                  type="password"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  onFocus={(e) => {
                    // Clear any auto-filled content when user focuses on the field
                    if (e.target.value && !githubApiKey) {
                      e.target.value = "";
                    }
                  }}
                  onBlur={(e) => {
                    // If field has content but state is empty, it was auto-filled - clear it
                    if (e.target.value && !githubApiKey) {
                      e.target.value = "";
                    }
                  }}
                  onChange={(event) => {
                    setGithubApiKey(event.target.value);
                    setRemoveGithubKey(false);
                    setKeyChanged(true);
                    setVerificationStatus(null);
                  }}
                  className="bg-secondary border-border text-foreground h-10 rounded-lg placeholder:text-muted-foreground/50"
                />

                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Your token is encrypted and stored server-side. It's never displayed back or sent to the client.{" "}
                  <a
                    href="https://github.com/settings/tokens?type=beta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Create a token →
                  </a>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {githubApiKey.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={verifying}
                    className="gap-2"
                    onClick={handleVerifyToken}
                  >
                    {verifying ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Verify Token
                      </>
                    )}
                  </Button>
                )}

                {user?.hasGithubToken && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setGithubApiKey("");
                      setRemoveGithubKey(true);
                      setKeyChanged(true);
                      setVerificationStatus(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove Token
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="glass rounded-2xl p-6 border border-border/50 space-y-5">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sun className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">
                Appearance
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                    theme === opt.value
                      ? "border-primary bg-primary/10 text-primary shadow-md"
                      : "border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:bg-secondary/80"
                  }`}
                >
                  <opt.icon className="h-6 w-6" />
                  <span className="text-xs font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 gap-2 gradient-primary text-primary-foreground hover:opacity-90 shadow-lg transition-all duration-200"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
