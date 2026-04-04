import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  Crown,
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Infinity,
  BarChart3,
  Map,
  MessageSquare,
  Route,
  Zap,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { createCheckoutSession } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const freeFeatures = [
  "10 repository analyses",
  "Repository map",
  "Dependency insights",
  "Documentation and settings",
];

const proFeatures = [
  "Unlimited repository analyses",
  "AI chat with repository context",
  "Codebase tour",
  "Impact analysis",
  "Priority access to advanced repo insights",
];

const freeLimitItems = [
  {
    icon: BarChart3,
    title: "10 analyses",
    description: "Enough to evaluate a few projects before upgrading.",
  },
  {
    icon: Map,
    title: "Map + dependencies",
    description: "See structure and packages without paying.",
  },
  {
    icon: FileText,
    title: "Docs + settings",
    description: "Keep using the product and manage your account.",
  },
];

const proLimitItems = [
  {
    icon: Infinity,
    title: "Unlimited analyses",
    description: "Run as many repository scans as you need.",
  },
  {
    icon: Route,
    title: "Codebase tour",
    description: "Step through the codebase with guided context.",
  },
  {
    icon: Zap,
    title: "Impact analysis",
    description: "Understand breakage before you touch code.",
  },
  {
    icon: MessageSquare,
    title: "AI chat",
    description: "Ask repo-specific questions in natural language.",
  },
];

const Subscription = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const returnTo = useMemo(() => {
    const stateReturnTo = (location.state as { returnTo?: string } | null)?.returnTo;
    return stateReturnTo || "/dashboard";
  }, [location.state]);

  useEffect(() => {
    sessionStorage.setItem("subscriptionReturnTo", returnTo);
  }, [returnTo]);

  const handleSubscribe = async () => {
    try {
      setLoadingCheckout(true);
      const response = await createCheckoutSession();
      if (!response?.url) {
        throw new Error("Checkout session could not be created");
      }
      window.location.href = response.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout";
      toast({
        title: "Checkout failed",
        description: message,
        variant: "destructive",
      });
      setLoadingCheckout(false);
    }
  };

  const planName = user?.isSubscribed ? "Pro" : "Free";
  const price = user?.isSubscribed ? "Active" : "$4.99 / month";

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-card via-background to-card shadow-xl"
      >
        <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative p-7 sm:p-10 xl:p-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(173_80%_50%/0.12),transparent_35%)]" />
            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Crown className="h-3.5 w-3.5" />
                {planName} access
              </div>

              <div className="space-y-4 max-w-2xl">
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  Free for exploration.
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-cyan-400">
                    Pro for unlimited depth.
                  </span>
                </h1>
                <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                  Free accounts get 10 analyses and the basics. Pro removes the cap and unlocks the paid workflows: code tour, impact analysis, and AI chat.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current plan</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{planName}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Free quota</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">10 analyses</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pro price</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{price}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {!user?.isSubscribed ? (
                  <Button
                    onClick={handleSubscribe}
                    disabled={loadingCheckout}
                    size="lg"
                    className="gap-2 gradient-primary text-primary-foreground hover:opacity-90"
                  >
                    {loadingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {loadingCheckout ? "Redirecting..." : "Upgrade to Pro"}
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                    Pro access is already enabled on your account.
                  </div>
                )}

                <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")} className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Back to dashboard
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-border/60 p-7 sm:p-10 xl:border-l xl:border-t-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Free</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">Starter</h2>
                  </div>
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">10 analyses, repository map, dependencies, docs, and settings.</p>
              </div>

              <div className="rounded-[1.5rem] border border-amber-500/25 bg-gradient-to-br from-amber-500/15 to-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Pro</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">Unlimited</h2>
                  </div>
                  <Crown className="h-5 w-5 text-amber-500" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Unlimited analyses, AI chat, code tour, and impact analysis.</p>
              </div>
            </div>

            <div className="grid gap-3">
              {freeLimitItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 p-4">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
              {proLimitItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid gap-4 md:grid-cols-3"
      >
        {[
          {
            title: "Free tier",
            value: "10 analyses",
            detail: "Core navigation tools included.",
            tone: "emerald",
          },
          {
            title: "Pro tier",
            value: "Unlimited",
            detail: "No cap on repository scans.",
            tone: "amber",
          },
          {
            title: "Paid features",
            value: "Tour + impact",
            detail: "These are locked behind Pro.",
            tone: "slate",
          },
        ].map((item) => (
          <div
            key={item.title}
            className={`rounded-3xl border p-5 ${
              item.tone === "amber"
                ? "border-amber-500/20 bg-amber-500/10"
                : item.tone === "emerald"
                  ? "border-emerald-500/20 bg-emerald-500/10"
                  : "border-border/60 bg-card"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.title}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </motion.section>

      {user?.isSubscribed ? (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-medium">
            <Check className="h-4 w-4" />
            Subscription active
          </div>
          <p className="mt-1">Your account is already on Pro, so only the pricing presentation changes here.</p>
        </div>
      ) : null}
    </div>
  );
};

export default Subscription;