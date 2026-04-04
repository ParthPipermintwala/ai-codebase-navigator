import { useAuth } from "@/context/AuthContext";

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card/90 backdrop-blur-xl p-6 text-center space-y-4">
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <div>
            <p className="text-base font-semibold text-foreground">Loading your workspace</p>
            <p className="text-sm text-muted-foreground mt-1">
              Verifying your session and preparing the app...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
