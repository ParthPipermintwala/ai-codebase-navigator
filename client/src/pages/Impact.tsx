import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { getRepoImpact } from "@/services/api";
import { getRepoId } from "@/utils/storage";
import { AlertCircle, ArrowRight, Loader2, Sparkles, Zap } from "lucide-react";

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

const severityStyles: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-300",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  low: "border-green-500/30 bg-green-500/10 text-green-300",
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        title="Impact Analysis"
        description="Understand what breaks before you change a file or module"
      />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl border border-neutral-700/80 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 p-5"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-28 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative z-10 space-y-4">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI Change Forecast
            </p>
            <h2 className="text-lg font-semibold text-white">
              Analyze dependency and breakage risk for a target file/module
            </h2>
            <p className="text-sm text-neutral-400">
              Enter a filename like auth.js or a module/function to get focused impact points.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading) {
                  onAnalyzeImpact();
                }
              }}
              placeholder="Enter file/module/function (e.g. auth.js)"
              className="h-11 rounded-xl border border-neutral-700 bg-neutral-950/90 px-4 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-500 focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={onAnalyzeImpact}
              disabled={loading || !repoId}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 text-sm font-medium text-black transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {loading ? "Analyzing..." : "Analyze Impact"}
            </button>
          </div>

          {!repoId && (
            <p className="text-sm text-yellow-300">
              Analyze a repository first, then return here to run impact analysis.
            </p>
          )}

          {error && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </motion.section>

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-300"
        >
          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
          Mapping impact areas and dependent files...
        </motion.div>
      )}

      {!loading && result && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-300">
            Target: <span className="font-mono text-cyan-300">{result.target}</span>
          </div>

          <div className="space-y-3">
            {result.impact.map((item, index) => (
              <motion.article
                key={`${item.area}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="space-y-2 rounded-xl border border-neutral-700 bg-neutral-900 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-white">{item.area}</h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                      severityStyles[item.severity] || severityStyles.medium
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-neutral-300">
                  {item.description}
                </p>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Files</p>
                  {Array.isArray(item.files) && item.files.length > 0 ? (
                    item.files.map((filePath, fileIndex) => (
                      <div
                        key={`${filePath}-${fileIndex}`}
                        className="inline-flex w-full items-center gap-2 text-xs text-neutral-400"
                      >
                        <ArrowRight className="h-3 w-3 text-cyan-400" />
                        <span className="font-mono">{filePath}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-500">No specific files identified.</p>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
};

export default Impact;
