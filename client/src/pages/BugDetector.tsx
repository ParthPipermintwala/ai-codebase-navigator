import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { getRepoBugs } from "@/services/api";
import { getRepoId } from "@/utils/storage";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle2,
  KeyRound,
  Lock,
  LockKeyhole,
  Filter,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Files,
  FileCode2,
  ExternalLink,
  TestTube,
} from "lucide-react";

interface BugFinding {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  filePath: string | null;
  line: number | null;
  recommendation: string;
  confidence: "high" | "medium" | "low";
  evidence: string | null;
  snippet: string | null;
  issueNumber?: number | null;
  labels?: string[];
}

interface BugReport {
  repository?: {
    owner?: string;
    name?: string;
    branch?: string;
  };
  summary?: {
    scannedFiles: number;
    sourceFiles: number;
    totalFindings: number;
    high: number;
    medium: number;
    low: number;
    issueSignals: number;
  };
  findings?: BugFinding[];
  filesScanned?: string[];
  sourceFiles?: string[];
  issueSignals?: Array<{
    number: number;
    title: string;
    labels: string[];
    state: string;
    url?: string | null;
  }>;
}

type SeverityFilter = "all" | "high" | "medium" | "low";

const severityMeta: Record<BugFinding["severity"], { label: string; className: string }> = {
  high: { label: "High", className: "border-red-500/30 bg-red-500/10 text-red-300" },
  medium: { label: "Medium", className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300" },
  low: { label: "Low", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
};

const typeLabels: Record<string, string> = {
  security: "Security",
  "environment-exposure": "Environment Exposure",
  "secret-exposure": "Secret Exposure",
  "jwt-secret-exposure": "JWT Secret Exposure",
  "password-disclosure": "Password Disclosure",
  "information-disclosure": "Information Disclosure",
  "error-handling": "Error Handling",
  logic: "Logic",
  maintenance: "Maintenance",
  repo_issue: "Open Issue",
};

const typeMeta: Record<
  string,
  { className: string; accentClassName: string; icon: React.ElementType }
> = {
  security: {
    className: "border-red-500/30 bg-red-500/10 text-red-300",
    accentClassName: "bg-red-400",
    icon: ShieldAlert,
  },
  "environment-exposure": {
    className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    accentClassName: "bg-orange-400",
    icon: AlertTriangle,
  },
  "secret-exposure": {
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    accentClassName: "bg-amber-400",
    icon: KeyRound,
  },
  "jwt-secret-exposure": {
    className: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
    accentClassName: "bg-fuchsia-400",
    icon: LockKeyhole,
  },
  "password-disclosure": {
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    accentClassName: "bg-rose-400",
    icon: Lock,
  },
  "information-disclosure": {
    className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    accentClassName: "bg-sky-400",
    icon: AlertCircle,
  },
  "error-handling": {
    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    accentClassName: "bg-yellow-400",
    icon: AlertTriangle,
  },
  logic: {
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    accentClassName: "bg-cyan-400",
    icon: CheckCircle2,
  },
  maintenance: {
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    accentClassName: "bg-emerald-400",
    icon: Bug,
  },
  repo_issue: {
    className: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    accentClassName: "bg-violet-400",
    icon: ExternalLink,
  },
};

const formatLine = (line: number | null) => (line ? `Line ${line}` : "Line not available");

// ✅ Helper: Format bug description with sections
const renderDescription = (desc: string) => {
  if (!desc.includes("\n")) return <p className="text-sm leading-7 text-muted-foreground">{desc}</p>;
  
  const sections = desc.split("\n").filter(s => s.trim());
  return (
    <div className="space-y-2 text-sm leading-7">
      {sections.map((section, idx) => {
        if (section.includes("EXACT ISSUE:") || section.includes("PROBLEM:") || section.includes("RESULT:")) {
          return (
            <div key={idx} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-red-200">
              <p>{section}</p>
            </div>
          );
        }
        if (section.includes("WHAT HAPPENS:") || section.includes("SHOULD BE:")) {
          return (
            <div key={idx} className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-yellow-200">
              <p>{section}</p>
            </div>
          );
        }
        if (section.includes("FIX:") || section.includes("Example:")) {
          return (
            <div key={idx} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-emerald-200">
              <p className="font-mono text-xs">{section}</p>
            </div>
          );
        }
        return <p key={idx} className="text-muted-foreground">{section}</p>;
      })}
    </div>
  );
};

const BugDetector = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<BugReport | null>(null);
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [includeTestFixture, setIncludeTestFixture] = useState(false);

  const repoId = useMemo(
    () =>
      searchParams.get("repoId") ||
      getRepoId() ||
      localStorage.getItem("repoId") ||
      "",
    [searchParams],
  );

  const loadBugs = async () => {
    if (!repoId) {
      setError("No repository selected. Analyze a repository first.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await getRepoBugs(repoId, {
        includeTestFixture,
      });
      const bugReport = response?.bugReport || null;

      if (!bugReport) {
        setError("No bug report returned for this repository.");
        setReport(null);
        return;
      }

      setReport(bugReport);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run bug detection";
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBugs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTestFixture, repoId]);

  const findings = useMemo(() => {
    const list = Array.isArray(report?.findings) ? report.findings : [];
    return filter === "all" ? list : list.filter((item) => item.severity === filter);
  }, [filter, report]);

  const summary = report?.summary || {
    scannedFiles: 0,
    sourceFiles: 0,
    totalFindings: 0,
    high: 0,
    medium: 0,
    low: 0,
    issueSignals: 0,
  };

  const hasFindings = findings.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4 overflow-x-hidden p-4 sm:space-y-5 sm:p-5 lg:p-6">
      <PageHeader
        title="Bug Detector"
        description="Scans real repository files and open GitHub issue signals to surface likely bugs, code risks, and unstable paths."
      >
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => setIncludeTestFixture((current) => !current)}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors sm:w-auto ${
              includeTestFixture
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-border/70 bg-card text-foreground hover:bg-secondary"
            }`}
          >
            <TestTube className="h-4 w-4" />
            {includeTestFixture ? "Test fixture on" : "Enable test fixture"}
          </button>
          <button
            type="button"
            onClick={loadBugs}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Rescan
          </button>
        </div>
      </PageHeader>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full min-w-0 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-background to-card shadow-xl"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--destructive)/0.12),transparent_28%),radial-gradient(circle_at_bottom_left,hsl(173_80%_50%/0.12),transparent_35%)]" />
        <div className="relative grid min-w-0 gap-5 p-4 md:p-5 2xl:grid-cols-[1.28fr_0.72fr] 2xl:p-6">
          <div className="min-w-0 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300">
              <Bug className="h-3.5 w-3.5" />
              Real repository scan
            </div>
            <div className="max-w-2xl space-y-2.5">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl xl:text-5xl">
                Find likely bugs before they ship
              </h1>
              <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                This scanner inspects actual source files, highlights suspicious code paths, and cross-checks open bug-like GitHub issues for the selected repository.
              </p>
              <p className="text-sm leading-7 text-muted-foreground">
                It is deterministic, repo-scoped, and designed to point you at concrete files, lines, and remediation steps.
              </p>
            </div>

            {report?.repository && (
              <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                <Files className="h-4 w-4 text-primary" />
                <span className="break-all font-medium text-foreground">{report.repository.owner}/{report.repository.name}</span>
                <span className="rounded-full border border-border/60 bg-secondary/70 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {report.repository.branch || "main"}
                </span>
                {report.testFixtureEnabled && (
                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-rose-300">
                    test fixture
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-1">
            {[
              { label: "Files scanned", value: summary.scannedFiles, icon: Files },
              { label: "Findings", value: summary.totalFindings, icon: ShieldAlert },
              { label: "High severity", value: summary.high, icon: TriangleAlert },
              { label: "Open issue signals", value: summary.issueSignals, icon: AlertCircle },
            ].map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
          Scanning repository files and open issues...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium text-red-100">{error}</p>
              <p className="mt-1 text-xs text-red-200/80">
                Select a repository from Dashboard or run analysis again first.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && report && (
        <div className="grid min-w-0 gap-6 2xl:grid-cols-[1.35fr_0.65fr]">
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Severity filter</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Focus on the right risk level</h2>
                </div>
                <div className="flex max-w-full flex-wrap gap-2">
                  {(["all", "high", "medium", "low"] as SeverityFilter[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFilter(level)}
                      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        filter === level
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {hasFindings ? (
              <div className="min-w-0 space-y-4">
                {findings.map((finding, index) => {
                  const severity = severityMeta[finding.severity] || severityMeta.medium;
                  const typeStyle = typeMeta[finding.type] || typeMeta.security;
                  const TypeIcon = typeStyle.icon;
                  return (
                    <motion.article
                      key={finding.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/70 shadow-sm transition-all hover:border-primary/20"
                    >
                      <div className="border-b border-border/60 px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${severity.className}`}>
                            {severity.label}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${typeStyle.className}`}>
                            <TypeIcon className="h-3.5 w-3.5" />
                            {typeLabels[finding.type] || finding.type}
                          </span>
                          {finding.filePath && (
                            <span title={finding.filePath} className="max-w-full rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground break-all">
                              {finding.filePath}
                            </span>
                          )}
                          {finding.line && (
                            <span className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                              {formatLine(finding.line)}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 flex items-start gap-2 text-lg font-semibold leading-tight text-foreground sm:text-xl">
                          <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background ${typeStyle.className}`}>
                            <TypeIcon className="h-3.5 w-3.5" />
                          </span>
                          <span>{finding.title}</span>
                        </h3>
                        <p className="mt-2 break-all font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-primary/90 sm:text-xs">
                          Exact location: {finding.filePath || "unknown-file"}
                          {finding.line ? `:${finding.line}` : ""}
                        </p>
                        <div className="mt-2">
                          {renderDescription(finding.description)}
                        </div>
                      </div>

                      <div className="grid min-w-0 gap-4 p-4 sm:p-5 xl:grid-cols-[1.3fr_0.7fr]">
                        <div className="min-w-0 space-y-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Evidence</p>
                            <p className="mt-1 break-all whitespace-pre-wrap rounded-xl border border-border/60 bg-background/80 px-3 py-2 font-mono text-[12px] leading-6 text-foreground">
                              {finding.evidence || "No direct evidence captured."}
                            </p>
                          </div>

                          {finding.snippet && (
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Snippet</p>
                              <pre className="mt-1 max-h-56 overflow-auto rounded-xl border border-border/60 bg-neutral-950/90 p-3 text-[12px] leading-6 text-neutral-200">
                                <code>{finding.snippet}</code>
                              </pre>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Confidence</p>
                            <p className="mt-1 text-sm font-medium capitalize text-foreground">{finding.confidence}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recommendation</p>
                            <div className="mt-1 space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                              {finding.recommendation.includes("\n") ? (
                                <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-emerald-200">
                                  {finding.recommendation}
                                </pre>
                              ) : (
                                <p className="text-sm leading-6 text-muted-foreground">{finding.recommendation}</p>
                              )}
                            </div>
                          </div>
                          {finding.issueNumber && (
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Issue signal</p>
                              <p className="mt-1 text-sm text-muted-foreground">GitHub issue #{finding.issueNumber}</p>
                            </div>
                          )}
                          {Array.isArray(finding.labels) && finding.labels.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {finding.labels.slice(0, 4).map((label) => (
                                <span
                                  key={label}
                                  className="rounded-full border border-border/60 bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-background p-5 sm:p-6 text-sm text-muted-foreground">
                No likely bugs were found in the current scan. That does not guarantee the code is bug-free, but it means the current heuristics and open issue signals did not surface a concrete high-confidence problem.
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4 2xl:sticky 2xl:top-6 2xl:self-start">
            <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Scan breakdown</p>
                  <h3 className="text-lg font-semibold text-foreground">What was analyzed</h3>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/80 px-4 py-2.5">
                  <span className="flex items-center gap-2"><FileCode2 className="h-4 w-4 text-primary" /> Source files</span>
                  <span className="font-medium text-foreground">{summary.sourceFiles}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/80 px-4 py-2.5">
                  <span className="flex items-center gap-2"><Files className="h-4 w-4 text-primary" /> Candidate files</span>
                  <span className="font-medium text-foreground">{summary.scannedFiles}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/80 px-4 py-2.5">
                  <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-primary" /> Open issue signals</span>
                  <span className="font-medium text-foreground">{summary.issueSignals}</span>
                </div>
              </div>
            </div>

            {Array.isArray(report.issueSignals) && report.issueSignals.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">GitHub issue signals</p>
                <div className="mt-3 space-y-3">
                  {report.issueSignals.map((issue) => (
                    <div key={issue.number} className="rounded-xl border border-border/60 bg-background/80 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground break-words">#{issue.number} {issue.title}</p>
                        {issue.url && (
                          <a href={issue.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {issue.labels.slice(0, 4).map((label) => (
                          <span key={label} className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How it works</p>
              <ul className="mt-3 space-y-1.5 text-sm leading-6 text-muted-foreground">
                <li>• Reads actual repository files from the analyzed project.</li>
                <li>• Flags risky code patterns, empty error handling, and unsafe constructs.</li>
                <li>• Cross-checks open GitHub issues that look bug-related.</li>
                <li>• Returns line references, snippets, and remediation steps.</li>
                <li>• Optional test fixture can inject one known bug for UI validation.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BugDetector;