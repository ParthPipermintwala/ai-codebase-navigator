import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { RepoInput } from "@/components/shared/RepoInput";
import { GitBranch, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeRepository, getDependencies, getRepository } from "@/services/api";
import { getRepoId, setRepoId } from "@/utils/storage";
import { RepoSummaryCard } from "@/components/analyze/RepoSummaryCard";
import { InsightGrid } from "@/components/analyze/InsightGrid";
import { DependenciesList } from "@/components/analyze/DependenciesList";
import { ActionButtons } from "@/components/analyze/ActionButtons";

const steps = [
  "Fetching repository metadata...",
  "Analyzing project structure...",
  "Detecting modules and entry points...",
  "Mapping dependencies...",
  "Generating AI summary...",
];

interface DependencyItem {
  name: string;
  version?: string | null;
}

interface RepoData {
  id?: string;
  name?: string;
  owner?: string;
  description?: string;
  stars?: number;
  forks?: number;
  languages?: Record<string, number>;
  language?: string;
  tech_stack?: string[];
  techStack?: string[];
  updated_at?: string;
  updatedAt?: string;
  created_at?: string;
  structure?: {
    total_items?: number;
  };
}

const Analyze = () => {
  const [searchParams] = useSearchParams();
  const initialRepo = searchParams.get("repoId") || getRepoId() || "";
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [repoId, setRepoIdState] = useState(initialRepo);
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [dependencies, setDependencies] = useState<DependencyItem[]>([]);
  const [dependencyType, setDependencyType] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const bootstrap = async () => {
      if (!initialRepo) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [repoResponse, dependencyResponse] = await Promise.all([
          getRepository(initialRepo),
          getDependencies(initialRepo),
        ]);

        setRepoIdState(String(initialRepo));
        setRepoData(repoResponse?.data || null);
        setDependencies(
          Array.isArray(dependencyResponse?.dependencies)
            ? dependencyResponse.dependencies
            : [],
        );
        setDependencyType(dependencyResponse?.type || "Unknown");
      } catch {
        // Keep the page usable if there is stale local storage data.
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [initialRepo]);

  const handleSubmit = async (url: string) => {
    setLoading(true);
    setError("");
    setCurrentStep(0);

    try {
      // Simulate UI steps for better UX
      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setCurrentStep(i + 1);
      }

      const analyzed = await analyzeRepository(url);
      const nextRepoId = analyzed?.repoId || analyzed?.id;

      if (!nextRepoId) {
        throw new Error("Server error");
      }

      setRepoId(String(nextRepoId));
      setRepoIdState(String(nextRepoId));

      const [repoResponse, dependencyResponse] = await Promise.all([
        getRepository(nextRepoId),
        getDependencies(nextRepoId),
      ]);

      setRepoData(repoResponse?.data || analyzed || null);
      setDependencies(
        Array.isArray(dependencyResponse?.dependencies)
          ? dependencyResponse.dependencies
          : [],
      );
      setDependencyType(dependencyResponse?.type || "Unknown");

      toast({
        title: "Analysis Complete!",
        description:
          analyzed?.message || `Successfully analyzed ${analyzed?.name || url}`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An error occurred during analysis";
      setError(message);
      toast({
        title: "Analysis Failed",
        description: message,
        variant: "destructive",
      });
      console.error("Analyze error:", err);
    } finally {
      setLoading(false);
      setCurrentStep(0);
    }
  };

  const languageFromMap = repoData?.languages
    ? Object.keys(repoData.languages)[0]
    : undefined;
  const lastUpdatedSource =
    repoData?.updated_at || repoData?.updatedAt || repoData?.created_at;
  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : Array.isArray(repoData?.techStack)
      ? repoData.techStack
      : [];
  const totalFiles = Number(repoData?.structure?.total_items || 0);
  const lastUpdated = lastUpdatedSource
    ? new Date(lastUpdatedSource).toLocaleDateString()
    : "Unknown";
  const hasResults = Boolean(repoId) && (Boolean(repoData) || dependencies.length > 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Analyze Repository" description="Enter a GitHub repository URL to start analysis" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-lg p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">GitHub Repository</h2>
            <p className="text-xs text-muted-foreground">Paste the full URL of a public GitHub repository</p>
          </div>
        </div>

        <RepoInput onSubmit={handleSubmit} loading={loading} size="large" />

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-sm text-destructive">{error}</span>
          </motion.div>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-8 space-y-3"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.2 }}
                className="flex items-center gap-3"
              >
                {currentStep > i ? (
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                ) : currentStep === i ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                )}
                <span className={`text-sm ${currentStep > i ? "text-foreground" : currentStep === i ? "text-primary" : "text-muted-foreground"}`}>
                  {step}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {!loading && hasResults && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          <RepoSummaryCard
            data={{
              name: repoData?.name,
              owner: repoData?.owner,
              description: repoData?.description,
              stars: repoData?.stars,
              forks: repoData?.forks,
              language: repoData?.language || languageFromMap,
            }}
          />

          <InsightGrid
            totalFiles={totalFiles}
            totalDependencies={dependencies.length}
            lastUpdated={lastUpdated}
            techStack={techStack}
          />

          <DependenciesList dependencies={dependencies} type={dependencyType} />

          {repoId && <ActionButtons repoId={repoId} />}
        </motion.div>
      )}

      {!loading && !error && repoId && !hasResults && (
        <div className="glass rounded-lg p-6 text-sm text-muted-foreground">
          No data found for this repository. Try running analysis again.
        </div>
      )}
    </div>
  );
};

export default Analyze;
