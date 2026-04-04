import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { confirmCheckoutSession, getCurrentUser } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const SubscriptionSuccess = () => {
  const [searchParams] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const sessionId = searchParams.get("session_id");
  const subscribed = Boolean(user?.isSubscribed);
  const returnTo = useMemo(() => {
    const stored = sessionStorage.getItem("subscriptionReturnTo");
    return (state as { returnTo?: string } | null)?.returnTo || stored || "/dashboard";
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    const confirm = async () => {
      if (subscribed) {
        setConfirmed(true);
        setLoading(false);
        return;
      }

      if (!sessionId) {
        setLoading(false);
        return;
      }

      setFailureMessage("");

      const maxAttempts = 8;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) {
          return;
        }

        try {
          await confirmCheckoutSession(sessionId);

          if (cancelled) {
            return;
          }

          const currentUserResponse = await getCurrentUser();
          await refreshUser();

          if (cancelled) {
            return;
          }

          if (Boolean(currentUserResponse?.user?.isSubscribed)) {
            setConfirmed(true);
            setLoading(false);
            return;
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not confirm subscription";
          setFailureMessage(message);

          const currentUserResponse = await getCurrentUser().catch(() => null);
          await refreshUser();

          if (cancelled) {
            return;
          }

          if (Boolean(currentUserResponse?.user?.isSubscribed)) {
            setConfirmed(true);
            setLoading(false);
            return;
          }

          if (attempt < maxAttempts - 1) {
            await delay(1500);
            continue;
          }

          setLoading(false);
          return;
        }

        const currentUserResponse = await getCurrentUser().catch(() => null);
        await refreshUser();

        if (cancelled) {
          return;
        }

        if (Boolean(currentUserResponse?.user?.isSubscribed)) {
          setConfirmed(true);
          setLoading(false);
          return;
        }

        if (attempt < maxAttempts - 1) {
          await delay(1500);
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    confirm();
    return () => {
      cancelled = true;
    };
  }, [refreshUser, retryTick, sessionId, subscribed]);

  useEffect(() => {
    if (!loading && (confirmed || user?.isSubscribed)) {
      sessionStorage.removeItem("subscriptionReturnTo");
      const timer = window.setTimeout(() => {
        navigate(returnTo, { replace: true });
      }, 1500);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [loading, confirmed, navigate, returnTo, user?.isSubscribed]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader title="Subscription status" description="Finalizing your premium access." />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border/60 bg-card p-8 text-center shadow-sm"
      >
        {loading ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Confirming subscription</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We are syncing your payment back into <span className="font-mono">is_subscribed</span>.
              </p>
            </div>
          </div>
        ) : confirmed || subscribed ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Subscription activated</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Premium access is now available on your account.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button onClick={() => navigate(returnTo, { replace: true })} className="gap-2 gradient-primary text-primary-foreground hover:opacity-90">
                <Sparkles className="h-4 w-4" />
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <Loader2 className="h-7 w-7 text-amber-500" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                {sessionId ? "Payment is still processing" : "No checkout session found"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {sessionId
                  ? failureMessage || "We are waiting for the subscription flag to update. If it does not appear soon, use Retry status."
                  : "Open the subscription page to start a new checkout session."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button onClick={() => navigate("/subscription", { replace: true })} className="gap-2 gradient-primary text-primary-foreground hover:opacity-90">
                <Sparkles className="h-4 w-4" />
                Open subscription
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  setLoading(true);
                  setFailureMessage("");
                  setRetryTick((current) => current + 1);
                }}
                className="gap-2"
              >
                Retry status
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard", { replace: true })} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Dashboard
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SubscriptionSuccess;