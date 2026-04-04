import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { getRepoImpact } from "@/services/api";
import { getRepoId } from "@/utils/storage";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  ChevronRight,
  FileCode2,
  GitBranch,
  Layers3,
  Loader2,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

interface ImpactItem {
  area: string;
  description: string;
  severity: "high" | "medium" | "low";
  files: string[];
}

interface ImpactResponse {
  target: string;
  impact: ImpactItem[];
}

interface SimulationNode {
  label: string;
  note: string;
  tone: "primary" | "warning" | "danger" | "muted";
}

interface DisplayImpactItem extends ImpactItem {
  key: string;
}

const severityStyles: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-300",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  low: "border-green-500/30 bg-green-500/10 text-green-300",
};

const severityRiskWeight: Record<ImpactItem["severity"], number> = {
  high: 40,
  medium: 24,
  low: 10,
};

const severityRank: Record<ImpactItem["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const toneStyles: Record<SimulationNode["tone"], string> = {
  primary: "border-cyan-500/25 bg-cyan-500/10 text-cyan-200",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  danger: "border-red-500/25 bg-red-500/10 text-red-200",
  muted: "border-border/60 bg-card/80 text-muted-foreground",
};

const formatRisk = (value: number) => `${Math.min(99, Math.max(5, value))}%`;

const normalizeImpactItems = (impactItems: ImpactItem[] = []): DisplayImpactItem[] => {
  if (!Array.isArray(impactItems) || impactItems.length === 0) {
    return [];
  }

  const grouped = new Map<
    string,
    {
      area: ImpactItem["area"];
      severity: ImpactItem["severity"];
      descriptions: string[];
      files: string[];
    }
  >();

  for (const item of impactItems) {
    const files = Array.from(new Set((Array.isArray(item.files) ? item.files : []).filter(Boolean))).slice(0, 6);
    const primaryFile = files[0] || "no-file";
    const area = String(item.area || "Core").trim() || "Core";
    const description = String(item.description || "No impact details available.").trim();
    const severity = (item.severity || "medium") as ImpactItem["severity"];
    const groupKey = `${area.toLowerCase()}|${primaryFile.toLowerCase()}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        area,
        severity,
        descriptions: description ? [description] : [],
        files,
      });
      continue;
    }

    const existing = grouped.get(groupKey)!;
    if (severityRank[severity] > severityRank[existing.severity]) {
      existing.severity = severity;
    }

    if (description && !existing.descriptions.includes(description)) {
      existing.descriptions.push(description);
    }

    const mergedFiles = Array.from(new Set([...existing.files, ...files])).slice(0, 6);
    existing.files = mergedFiles;
  }

  const normalized = Array.from(grouped.entries()).map(([groupKey, item]) => ({
    key: groupKey,
    area: item.area,
    severity: item.severity,
    description:
      item.descriptions.length > 1
        ? `${item.descriptions[0]} ${item.descriptions[1]}`.slice(0, 320)
        : (item.descriptions[0] || "No impact details available.").slice(0, 320),
    files: item.files,
  }));

  return normalized.slice(0, 5);
};

const buildSimulationNodes = (
  targetLabel: string,
  impactItems: ImpactItem[] = [],
): SimulationNode[] => {
  if (!targetLabel) {
    return [];
  }

  const primaryFiles = Array.from(
    new Set(
      impactItems
        .flatMap((item) => (Array.isArray(item.files) ? item.files : []))
        .filter(Boolean),
    ),
  ).slice(0, 4);

  const nodes: SimulationNode[] = [
    {
      label: targetLabel,
      note: "Selected file or module",
      tone: "primary",
    },
  ];

  for (const filePath of primaryFiles) {
    nodes.push({
      label: filePath,
      note: "Directly affected",
      tone: "warning",
    });
  }

  const downstreamCount = Math.max(0, impactItems.length - 1);
  if (downstreamCount > 0) {
    nodes.push({
      label: `${downstreamCount} downstream area${downstreamCount > 1 ? "s" : ""}`,
      note: "Cascade effects",
      tone: "danger",
    });
  }

  return nodes;
};

const Impact = () => {
  const [searchParams] = useSearchParams();
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImpactResponse | null>(null);

  const repoId = useMemo(
    () =>
      searchParams.get("repoId") ||
      getRepoId() ||
      localStorage.getItem("repoId") ||
      "",
    [searchParams],
  );

  const onAnalyzeImpact = async () => {
    const nextTarget = String(target || "").trim();
    if (!nextTarget) {
      setError("Enter a file, module, or function name first.");
      setResult(null);
      return;
    }

    if (!repoId) {
      setError("No repository selected. Analyze a repository first.");
      setResult(null);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await getRepoImpact(repoId, nextTarget);
      const payload = response?.impact;
      const impactItems = Array.isArray(payload?.impact) ? payload.impact : [];

      if (!payload || impactItems.length === 0) {
        setError("No impact result found for this target.");
        setResult(null);
        return;
      }

      setResult({
        target: String(payload?.target || nextTarget),
        impact: impactItems,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to analyze impact";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const normalizedImpact = useMemo(() => normalizeImpactItems(result?.impact || []), [result]);

  const riskScore = useMemo(() => {
    if (!result) {
      return 0;
    }

    const baseScore = normalizedImpact.reduce((total, item, index) => {
      return total + (severityRiskWeight[item.severity] || 10) / (index + 1);
    }, 0);

    const fileCount = normalizedImpact.reduce(
      (total, item) => total + (Array.isArray(item.files) ? item.files.length : 0),
      0,
    );

    return Math.round(Math.min(99, baseScore + fileCount * 2.25));
  }, [normalizedImpact, result]);

  const riskBreakdown = useMemo(() => {
    const rawScores = normalizedImpact.map((item) => {
      const weight = severityRiskWeight[item.severity] || severityRiskWeight.medium;
      const fileTotal = Array.isArray(item.files) ? item.files.length : 0;
      return weight + fileTotal * 3;
    });

    const total = rawScores.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return normalizedImpact.map(() => 0);
    }

    return rawScores.map((score) => Math.round((score / total) * 100));
  }, [normalizedImpact]);

  const simulationNodes = useMemo(
    () => buildSimulationNodes(result?.target || target, normalizedImpact),
    [normalizedImpact, result?.target, target],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-gradient-to-br from-card via-background to-card shadow-xl sm:rounded-[2rem]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_32%),radial-gradient(circle_at_bottom_left,hsl(173_80%_50%/0.14),transparent_40%)]" />

        <div className="relative grid gap-0 xl:grid-cols-[1.1fr_0.9fr] xl:gap-8">
          <div className="space-y-5 p-5 sm:p-6 md:p-8 xl:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Live simulation
            </div>

            <div className="max-w-2xl space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                What happens if I change this?
              </h1>
              <p className="text-sm leading-7 text-muted-foreground sm:text-base lg:text-lg">
                Select a file or module and we simulate the blast radius visually: affected files, cascade chain, and a risk percentage.
              </p>
              <p className="text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">
                We don’t just explain code — we predict the effect of changes across the system.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Impact signal</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Visual cascade</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Risk</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{result ? formatRisk(riskScore) : "0%"}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Coverage</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Files + downstream areas</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !loading) {
                    onAnalyzeImpact();
                  }
                }}
                placeholder="Enter file/module/function (e.g. auth.js)"
                className="h-12 w-full rounded-2xl border border-border/70 bg-background/90 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={onAnalyzeImpact}
                disabled={loading || !repoId}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 text-sm font-medium text-black transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {loading ? "Simulating..." : "Simulate impact"}
              </button>
            </div>

            {!repoId && (
              <p className="text-sm text-yellow-300">
                Analyze a repository first, then return here to run impact analysis.
              </p>
            )}

            {error && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 p-6 sm:p-8 xl:border-l xl:border-t-0">
            <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Simulation output</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">Blast radius</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Target</p>
                <p className="mt-1 break-all font-mono text-sm text-cyan-300">
                  {result?.target || target || "Select a file to start"}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Risk score</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{result ? formatRisk(riskScore) : "0%"}</p>
                  </div>
                  <div className="w-24 rounded-full bg-muted/60 p-1">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-300"
                      style={{ width: result ? formatRisk(riskScore) : "0%" }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Higher means more files are likely to cascade from the selected change.
                </p>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />
                  Cascade chain
                </div>

                {simulationNodes.length > 0 ? (
                  simulationNodes.map((node, index) => (
                    <motion.div
                      key={`${node.label}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`rounded-2xl border px-4 py-3 ${toneStyles[node.tone]}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current/20 bg-background/80 text-xs font-semibold">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{node.label}</p>
                          <p className="text-xs opacity-80">{node.note}</p>
                        </div>
                        {index < simulationNodes.length - 1 && <ChevronRight className="h-4 w-4 opacity-70" />}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                    Run a simulation to see the chain of affected files.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          Mapping dependencies, cascade paths, and risk...
        </motion.div>
      )}

      {!loading && result && (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:gap-5">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Affect map</p>
                  <h3 className="text-base font-semibold text-foreground sm:text-lg">Affected files highlighted</h3>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {normalizedImpact.map((item, index) => {
                  const files = Array.isArray(item.files) ? item.files : [];
                  const topFile = files[0];

                  return (
                    <motion.article
                      key={item.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{item.area}</h4>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                            severityStyles[item.severity] || severityStyles.medium
                          }`}
                        >
                          {item.severity}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>

                      <div className="mt-3 space-y-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Files affected</p>
                        {files.length > 0 ? (
                          files.slice(0, 4).map((filePath, fileIndex) => (
                            <div
                              key={`${filePath}-${fileIndex}`}
                              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                                fileIndex === 0
                                  ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-200"
                                  : "border-border/60 bg-muted/20 text-muted-foreground"
                              }`}
                            >
                              <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 break-all font-mono leading-5">{filePath}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No specific files identified.</p>
                        )}
                      </div>

                      {topFile ? (
                        <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-[11px] text-muted-foreground">
                          <ArrowRight className="h-3 w-3" />
                          <span className="min-w-0 truncate">Primary ripple: {topFile}</span>
                        </div>
                      ) : null}
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Risk detail</p>
                  <h3 className="text-base font-semibold text-foreground sm:text-lg">Why this change is risky</h3>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {normalizedImpact.map((item, index) => {
                  const fileTotal = Array.isArray(item.files) ? item.files.length : 0;
                  return (
                    <div key={`${item.key}-risk`} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-foreground">{item.area}</p>
                          <p className="text-xs text-muted-foreground">{fileTotal} affected file{fileTotal === 1 ? "" : "s"}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Risk contribution</p>
                          <p className="text-lg font-semibold text-foreground">{riskBreakdown[index] || 0}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pitch</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                We don’t just explain code — we predict the effect of changes across the system.
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                This simulation makes the blast radius visible before the first edit lands.
              </p>
            </div>
          </motion.section>
        </div>
      )}
    </div>
  );
};

export default Impact;
