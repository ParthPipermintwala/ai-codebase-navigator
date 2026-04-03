import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Package, AlertCircle } from "lucide-react";
import { getDependencies } from "@/services/api";
import { getRepoId } from "@/utils/storage";

interface DependencyItem {
  name: string;
  version: string | null;
}

interface DependencyResponse {
  type: string;
  dependencies: DependencyItem[];
}

const Dependencies = () => {
  const [data, setData] = useState<DependencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDependencies = async () => {
      const repoId = getRepoId();

      if (!repoId) {
        setError("No repository selected. Analyze a repository first.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await getDependencies(repoId);
        setData(response);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch dependencies";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadDependencies();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Dependencies" description="Detected package dependencies for your repository" />

      {loading && (
        <div className="glass rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading dependencies...</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass rounded-lg p-4 flex items-center gap-2 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="glass rounded-lg p-4 mb-4">
            <p className="text-sm text-muted-foreground">
              Language Type: <span className="font-medium text-foreground uppercase">{data.type || "unknown"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.dependencies?.length || 0} dependencies detected
            </p>
          </div>

          {data.dependencies?.length > 0 ? (
            <div className="space-y-3">
              {data.dependencies.map((dep, i) => (
                <motion.div
                  key={dep.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-foreground truncate">
                        {dep.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dep.version ? `v${dep.version}` : "Version not specified"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="glass rounded-lg p-6 text-sm text-muted-foreground">
              No dependencies were detected for this repository.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dependencies;
