import { useAuth } from "@/context/AuthContext";

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto animate-pulse space-y-6">
          <div className="h-12 rounded-xl bg-secondary" />
          <div className="h-40 rounded-xl bg-secondary" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="h-28 rounded-xl bg-secondary" />
            <div className="h-28 rounded-xl bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
