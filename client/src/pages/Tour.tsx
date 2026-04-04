import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { getRepoTour } from "@/services/api";
import { getRepoId } from "@/utils/storage";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileCode2,
  Loader2,
  Maximize2,
  Minimize2,
  Route,
  Sparkles,
} from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  files: string[];
  primaryFile?: string;
  code?: string;
}

interface TourRepository {
  owner?: string;
  name?: string;
  branch?: string;
}

const Tour = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [tourRepository, setTourRepository] = useState<TourRepository | null>(
    null,
  );
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"timeline" | "focus">("timeline");
  const [activeStep, setActiveStep] = useState(0);
  const [isCodeFullscreen, setIsCodeFullscreen] = useState(false);

  const repoId = useMemo(
    () =>
      searchParams.get("repoId") ||
      getRepoId() ||
      localStorage.getItem("repoId") ||
      "",
    [searchParams],
  );

  useEffect(() => {
    const fetchTour = async () => {
      if (!repoId) {
        setError("No repository selected. Analyze a repository first.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await getRepoTour(repoId);
        const nextSteps = Array.isArray(response?.tour?.steps)
          ? response.tour.steps
          : [];
        const nextRepository =
          response?.tour?.repository && typeof response.tour.repository === "object"
            ? response.tour.repository
            : null;

        setSteps(nextSteps);
        setTourRepository(nextRepository);
        setActiveStep(0);
        setIsCodeFullscreen(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load codebase tour";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [repoId]);

  useEffect(() => {
    if (!isCodeFullscreen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCodeFullscreen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isCodeFullscreen]);

  const progress =
    steps.length > 0 ? Math.round(((activeStep + 1) / steps.length) * 100) : 0;
  const currentStep = steps[activeStep] || null;
  const currentFilePath =
    currentStep?.primaryFile || (currentStep?.files || [])[0] || "";
  const currentCode =
    currentStep?.code && String(currentStep.code).trim()
      ? String(currentStep.code)
      : "// No code preview available for this step yet.";
  const codeLineCount = currentCode.split("\n").length;
  const isLongCodePreview = codeLineCount > 120 || currentCode.length > 5000;
  const githubFileUrl = useMemo(() => {
    if (!tourRepository?.owner || !tourRepository?.name || !currentFilePath) {
      return "";
    }

    const branch = String(tourRepository.branch || "main").trim() || "main";
    const encodedPath = currentFilePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    return `https://github.com/${encodeURIComponent(
      String(tourRepository.owner).trim(),
    )}/${encodeURIComponent(String(tourRepository.name).trim())}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
  }, [tourRepository, currentFilePath]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        title="Codebase Tour"
        description="Guided walkthrough of your repository structure and key files"
      />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl border border-neutral-700/80 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 p-5"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-28 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI Guided Walkthrough
            </p>
            <h2 className="text-lg font-semibold text-white">
              Explore the codebase step by step
            </h2>
            <p className="text-sm text-neutral-400">
              Highlights entry points, architecture flow, and important files.
            </p>
          </div>

          {!loading && !error && steps.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 p-1">
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
                  viewMode === "timeline"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                }`}
              >
                Timeline View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("focus")}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
                  viewMode === "focus"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                }`}
              >
                Full Tour Mode
              </button>
            </div>
          )}
        </div>
      </motion.section>

      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="space-y-3 rounded-2xl border border-neutral-700 bg-neutral-900 p-5"
            >
              <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-700" />
              <div className="h-3 w-full animate-pulse rounded bg-neutral-800" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-800" />
              <div className="flex gap-2 pt-1">
                <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-800" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-800" />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Building your tour...
          </div>
        </motion.div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && steps.length === 0 && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-sm text-muted-foreground">
          No tour steps found for this repository.
        </div>
      )}

      {!loading && !error && steps.length > 0 && (
        <AnimatePresence mode="wait">
          {viewMode === "timeline" ? (
            <motion.div
              key="timeline-view"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28 }}
              className="space-y-6"
            >
              <div className="relative space-y-5 pl-3">
                <div className="pointer-events-none absolute left-[0.35rem] top-3 h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-cyan-500/40 via-neutral-700 to-transparent" />

                {steps.map((step, index) => (
                  <motion.article
                    key={`${step.title}-${index}`}
                    initial={{ opacity: 0, x: -10, y: 12 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.3 }}
                    whileHover={{ y: -2, scale: 1.002 }}
                    className="relative ml-5 space-y-3 rounded-2xl border border-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm transition-all duration-300 hover:border-cyan-500/40 hover:shadow-lg"
                  >
                    <div className="absolute -left-[1.55rem] top-5 flex h-6 w-6 items-center justify-center rounded-full border border-cyan-500/50 bg-neutral-900 text-[10px] font-semibold text-cyan-300">
                      {index + 1}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-cyan-300">
                      <Route className="h-3.5 w-3.5" />
                      Step {index + 1}
                    </div>

                    <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-neutral-400">{step.description}</p>

                    {Array.isArray(step.files) && step.files.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-neutral-500">Files</p>
                        <div className="flex flex-wrap gap-2">
                          {step.files.map((file, fileIndex) => (
                            <motion.span
                              key={`${file}-${fileIndex}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.08 + fileIndex * 0.03 }}
                              className="inline-flex items-center gap-1 rounded-full border border-neutral-600 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300"
                            >
                              <FileCode2 className="h-3 w-3 text-cyan-400" />
                              {file}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.article>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.section
              key="focus-view"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28 }}
              className="space-y-5"
            >
              <div className="space-y-3 rounded-2xl border border-neutral-700 bg-neutral-900 p-4">
                <div className="flex items-center justify-between text-sm text-neutral-300">
                  <span>
                    Step {activeStep + 1} of {steps.length}
                  </span>
                  <span className="font-semibold text-cyan-300">{progress}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {steps.map((_, index) => (
                    <button
                      key={`step-btn-${index}`}
                      type="button"
                      onClick={() => setActiveStep(index)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-all duration-200 ${
                        index === activeStep
                          ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-300"
                          : index < activeStep
                            ? "border-teal-500/30 bg-teal-500/10 text-teal-300"
                            : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                      }`}
                    >
                      {index < activeStep ? (
                        <CheckCircle2 className="mx-auto h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {currentStep && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentStep.title}-${activeStep}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="grid gap-4 lg:grid-cols-2"
                  >
                    <div className="h-[430px] space-y-3 overflow-auto rounded-2xl border border-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-cyan-300">
                        Step {activeStep + 1}
                      </p>
                      <h3 className="text-2xl font-bold text-white">{currentStep.title}</h3>
                      {currentStep.primaryFile && (
                        <div className="inline-flex items-center gap-2 text-lg text-neutral-400">
                          <FileCode2 className="h-4 w-4 text-cyan-400" />
                          <span className="font-mono text-sm">{currentStep.primaryFile}</span>
                        </div>
                      )}
                      <p className="text-base leading-relaxed text-neutral-400">
                        {currentStep.description}
                      </p>
                    </div>

                    <div className="group relative h-[430px] overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950">
                      <button
                        type="button"
                        onClick={() => setIsCodeFullscreen(true)}
                        className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-lg border border-neutral-600 bg-black/70 px-2 py-1 text-xs text-neutral-200 opacity-0 transition-all duration-200 hover:border-cyan-500 hover:text-cyan-300 group-hover:opacity-100"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Fullscreen
                      </button>

                      <div className="border-b border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm font-medium text-neutral-300">
                        <div className="inline-flex items-center gap-2">
                          <FileCode2 className="h-4 w-4 text-cyan-400" />
                          <span className="font-mono text-sm text-neutral-400">
                            {currentFilePath || "No file selected"}
                          </span>
                        </div>
                      </div>
                      <pre className="m-0 h-[calc(430px-53px)] overflow-auto bg-black/60 px-6 pb-6 pt-3 font-mono text-[14px] leading-8 text-neutral-300">
                        <code>{currentCode}</code>
                      </pre>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              <AnimatePresence>
                {isCodeFullscreen && currentStep && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsCodeFullscreen(false)}
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-gradient-to-br from-black/95 via-neutral-950/90 to-cyan-950/40 p-4 backdrop-blur-md md:p-6"
                  >
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                      <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />
                    </div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.98, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: 10 }}
                      onClick={(event) => event.stopPropagation()}
                      className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-neutral-950/95 shadow-2xl shadow-black/60"
                    >
                      <div className="border-b border-neutral-700 bg-gradient-to-r from-neutral-900 to-neutral-900/70 px-4 py-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs text-neutral-400">Press Esc to exit fullscreen</div>

                          <button
                            type="button"
                            onClick={() => setIsCodeFullscreen(false)}
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-600 bg-black/70 px-2 py-1 text-xs text-neutral-200 transition-all duration-200 hover:border-cyan-500 hover:text-cyan-300"
                          >
                            <Minimize2 className="h-3.5 w-3.5" />
                            Minimize
                          </button>
                        </div>

                        <div className="inline-flex items-center gap-2 text-sm font-medium text-neutral-300">
                          <FileCode2 className="h-4 w-4 text-cyan-400" />
                          <span className="font-mono text-sm text-neutral-400">
                            {currentFilePath || "No file selected"}
                          </span>
                        </div>
                      </div>

                      <pre className="m-0 min-h-0 flex-1 overflow-auto bg-black/70 px-6 pb-6 pt-3 font-mono text-[15px] leading-8 text-neutral-300">
                        <code>{currentCode}</code>
                      </pre>

                      {githubFileUrl && (
                        <div className="flex items-center justify-between gap-3 border-t border-neutral-700 bg-neutral-900/80 px-4 py-3">
                          <p className="text-xs text-neutral-400">
                            {isLongCodePreview
                              ? "Code preview is long. Open the exact file in GitHub for full navigation."
                              : "Open the exact file in GitHub."}
                          </p>
                          <a
                            href={githubFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
                          >
                            Open Full File
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                  disabled={activeStep === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-300 transition-all duration-200 hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveStep((prev) => Math.min(steps.length - 1, prev + 1))
                  }
                  disabled={activeStep >= steps.length - 1}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 py-2.5 text-sm font-medium text-black transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default Tour;
