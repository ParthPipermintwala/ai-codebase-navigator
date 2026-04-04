import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { getRepoBugs } from "@/services/api";
import { getRepoId } from "@/utils/storage";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
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
  "information-disclosure": "Information Disclosure",
  "secret-exposure": "Secret Exposure",
  "error-handling": "Error Handling",
  logic: "Logic",
  maintenance: "Maintenance",
  repo_issue: "Open Issue",
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
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Bug Detector"
        description="Scans real repository files and open GitHub issue signals to surface likely bugs, code risks, and unstable paths."
      >
        <button
          type="button"
          onClick={() => setIncludeTestFixture((current) => !current)}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
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
          className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <RefreshCw className="h-4 w-4" />
          Rescan
        </button>
      </PageHeader>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-card via-background to-card shadow-xl"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--destructive)/0.12),transparent_28%),radial-gradient(circle_at_bottom_left,hsl(173_80%_50%/0.12),transparent_35%)]" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300">
              <Bug className="h-3.5 w-3.5" />
              Real repository scan
            </div>
            <div className="max-w-2xl space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
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
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                <Files className="h-4 w-4 text-primary" />
                {report.repository.owner}/{report.repository.name}
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Severity filter</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Focus on the right risk level</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["all", "high", "medium", "low"] as SeverityFilter[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFilter(level)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
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
              <div className="space-y-4">
                {findings.map((finding, index) => {
                  const severity = severityMeta[finding.severity] || severityMeta.medium;
                  return (
                    <motion.article
                      key={finding.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
                    >
                      <div className="border-b border-border/60 px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${severity.className}`}>
                            {severity.label}
                          </span>
                          <span className="rounded-full border border-border/60 bg-secondary/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {typeLabels[finding.type] || finding.type}
                          </span>
                          {finding.filePath && (
                            <span className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                              {finding.filePath}
                            </span>
                          )}
                          {finding.line && (
                            <span className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                              {formatLine(finding.line)}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-foreground">{finding.title}</h3>
                        <div className="mt-2">
                          {renderDescription(finding.description)}
                        </div>
                      </div>

                      <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Evidence</p>
                            <p className="mt-1 rounded-xl border border-border/60 bg-background/80 px-3 py-2 font-mono text-[12px] leading-6 text-foreground">
                              {finding.evidence || "No direct evidence captured."}
                            </p>
                          </div>

                          {finding.snippet && (
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Snippet</p>
                              <pre className="mt-1 overflow-x-auto rounded-xl border border-border/60 bg-neutral-950/90 p-3 text-[12px] leading-6 text-neutral-200">
                                <code>{finding.snippet}</code>
                              </pre>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Confidence</p>
                            <p className="mt-1 text-sm font-medium capitalize text-foreground">{finding.confidence}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recommendation</p>
                            <div className="mt-1 space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                              {finding.recommendation.includes("\n") ? (
                                <pre className="text-xs leading-6 text-emerald-200 font-mono overflow-x-auto">
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
              <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
                No likely bugs were found in the current scan. That does not guarantee the code is bug-free, but it means the current heuristics and open issue signals did not surface a concrete high-confidence problem.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-5">
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
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                  <span className="flex items-center gap-2"><FileCode2 className="h-4 w-4 text-primary" /> Source files</span>
                  <span className="font-medium text-foreground">{summary.sourceFiles}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                  <span className="flex items-center gap-2"><Files className="h-4 w-4 text-primary" /> Candidate files</span>
                  <span className="font-medium text-foreground">{summary.scannedFiles}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                  <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-primary" /> Open issue signals</span>
                  <span className="font-medium text-foreground">{summary.issueSignals}</span>
                </div>
              </div>
            </div>

            {Array.isArray(report.issueSignals) && report.issueSignals.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">GitHub issue signals</p>
                <div className="mt-3 space-y-3">
                  {report.issueSignals.map((issue) => (
                    <div key={issue.number} className="rounded-xl border border-border/60 bg-background/80 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">#{issue.number} {issue.title}</p>
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

            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How it works</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
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