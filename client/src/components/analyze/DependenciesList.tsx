import { Code2, Package2 } from "lucide-react";

interface DependencyItem {
  name: string;
  version?: string | null;
}

interface DependenciesListProps {
  dependencies: DependencyItem[];
  type?: string;
}

const resolveDependencyType = (value?: string) => {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("python")) return "Python";
  if (normalized.includes("java")) return "Java";
  if (normalized.includes("node") || normalized.includes("npm") || normalized.includes("js")) return "Node";
  return value || "Unknown";
};

const formatDependencyVersion = (version?: string | null) => {
  const raw = String(version || "").trim();
  if (!raw || raw === "*" || raw.toLowerCase() === "latest") {
    return "latest";
  }

  if (raw.startsWith("workspace:")) {
    const workspaceVersion = raw.replace(/^workspace:/, "").trim();
    return workspaceVersion || "latest";
  }

  const semverToken = raw.match(/\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?/);
  if (semverToken?.[0]) {
    return semverToken[0];
  }

  const cleaned = raw.replace(/^[~^><=v\s]+/, "").trim();
  return cleaned || raw;
};

const toVersionLabel = (version?: string | null) => {
  const normalized = formatDependencyVersion(version);
  if (normalized === "latest") {
    return normalized;
  }

  return /^\d/.test(normalized) ? `v${normalized}` : normalized;
};

export const DependenciesList = ({ dependencies, type }: DependenciesListProps) => {
  const dependencyType = resolveDependencyType(type);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Dependencies
        </h3>
        <span className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs border border-primary/20">
          {dependencyType}
        </span>
      </div>

      {dependencies.length === 0 ? (
        <div className="glass rounded-xl p-4 border border-border/50 text-sm text-muted-foreground">
          No dependencies found for this repository.
        </div>
      ) : (
        <div className="glass rounded-xl border border-border/50 p-3 max-h-72 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {dependencies.map((dep) => (
              <div
                key={`${dep.name}-${dep.version || "unknown"}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs transition-colors hover:bg-secondary/60"
              >
                <Package2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">{dep.name}</span>
                <span className="text-muted-foreground">{toVersionLabel(dep.version)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Code2 className="h-3 w-3" />
                  {dependencyType}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
