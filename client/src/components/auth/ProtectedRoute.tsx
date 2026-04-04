import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiresSubscription?: boolean;
};

export const ProtectedRoute = ({
  children,
  requiresSubscription = false,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requiresSubscription && !user.isSubscribed) {
    return (
      <Navigate
        to="/subscription"
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
};
