import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Package, AlertCircle, Boxes, Layers3, Database, FileCode2 } from "lucide-react";
import { getDependencies } from "@/services/api";
import { getRepoId } from "@/utils/storage";

interface DependencyItem {
  name: string;
  version: string | null;
}

interface DependencyResponse {
  type: string;
  dependencies: DependencyItem[];
  runtimeDependencies?: DependencyItem[];
  devDependencies?: DependencyItem[];
}

const normalizeDependencyVersion = (version?: string | null) => {
  const raw = String(version || "").trim();

  if (!raw || raw === "*" || raw.toLowerCase() === "latest") {
    return "latest";
  }

  const workspaceMatch = raw.match(/^workspace:(.+)$/i);
  if (workspaceMatch?.[1]) {
    return normalizeDependencyVersion(workspaceMatch[1]);
  }

  const semverToken = raw.match(/\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?/);
  if (semverToken?.[0]) {
    return semverToken[0];
  }

  const cleaned = raw.replace(/^[~^><=v\s]+/, "").trim();
  return cleaned || raw;
};

const formatDependencyVersion = (version?: string | null) => {
  const normalized = normalizeDependencyVersion(version);
  return normalized === "latest"
    ? normalized
    : /^\d/.test(normalized)
      ? `v${normalized}`
      : normalized;
};

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

  const dependencies = data?.dependencies || [];
  const runtimeDependencies = Array.isArray(data?.runtimeDependencies)
    ? data.runtimeDependencies
    : [];
  const devDependencies = Array.isArray(data?.devDependencies)
    ? data.devDependencies
    : [];
  const detectedType = data?.type || "unknown";
  const hasGroupedDependencies =
    runtimeDependencies.length > 0 || devDependencies.length > 0;
  const versionedDependencies = dependencies.filter((dep) => Boolean(dep.version));

  const renderDependencyCard = (dep: DependencyItem) => (
    <div
      key={`${dep.name}-${dep.version || "unknown"}`}
      className="glass rounded-2xl p-4 border border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{dep.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {dep.version ? formatDependencyVersion(dep.version) : "latest"}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
          <FileCode2 className="h-3 w-3" />
          {detectedType}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-border/70 bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
          Version {dep.version ? formatDependencyVersion(dep.version) : "latest"}
        </span>
      </div>
    </div>
  );

  const renderDependencySection = (title: string, items: DependencyItem[], tone: string) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        <span className={`rounded-full px-3 py-1 text-xs font-medium border ${tone}`}>
          {items.length}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((dep) => renderDependencyCard(dep))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-5 border border-border/50 text-sm text-muted-foreground">
          No {title.toLowerCase()} were detected for this repository.
        </div>
      )}
    </section>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Dependencies"
        description="Detected package dependencies for your repository"
      />

      {!loading && !error && data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="glass rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Boxes className="h-3.5 w-3.5" />
              <span>Package Type</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-foreground capitalize">
              {detectedType}
            </p>
          </div>

          <div className="glass rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Layers3 className="h-3.5 w-3.5" />
              <span>Total Dependencies</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {dependencies.length}
            </p>
          </div>

          <div className="glass rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Database className="h-3.5 w-3.5" />
              <span>Versioned Packages</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {versionedDependencies.length}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="glass rounded-2xl p-10 text-center border border-border/50">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Loading dependencies...</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass rounded-xl p-4 flex items-start gap-3 border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-destructive font-medium">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select a repository from Dashboard or run a new analysis first.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="glass rounded-2xl p-5 border border-border/50">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Repository Package Scan</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Versions are normalized for readability and shown as package chips below.
                </p>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {detectedType.toUpperCase()}
              </div>
            </div>
          </div>

          {hasGroupedDependencies ? (
            <div className="space-y-6">
              {renderDependencySection(
                "Runtime Dependencies",
                runtimeDependencies,
                "border-primary/20 bg-primary/10 text-primary",
              )}
              <div className="border-t border-border/60" />
              {renderDependencySection(
                "Dev Dependencies",
                devDependencies,
                "border-border/60 bg-muted/40 text-muted-foreground",
              )}
            </div>
          ) : dependencies.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dependencies.map((dep) => renderDependencyCard(dep))}
            </div>
          ) : (
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground border border-border/50">
              No dependencies were detected for this repository.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dependencies;
