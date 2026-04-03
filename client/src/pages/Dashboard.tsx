import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, AlertCircle, Github, Star, GitFork, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { getRepository } from "@/services/api";
import { getRepoId } from "@/utils/storage";

interface RepositoryData {
  id: string;
  name: string;
  owner: string;
  description: string | null;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  default_branch: string;
  tech_stack?: string[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [repo, setRepo] = useState<RepositoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRepository = async () => {
      const repoId = getRepoId();

      if (!repoId) {
        setError("No repository selected. Analyze a repository first.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await getRepository(repoId);
        setRepo(response?.data || null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch repository";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadRepository();
  }, []);

  const insights = useMemo(() => {
    return [
      {
        label: "Default Branch",
        value: repo?.default_branch || "-",
      },
      {
        label: "Open Issues",
        value: repo?.open_issues ?? 0,
      },
      {
        label: "Watchers",
        value: repo?.watchers ?? 0,
      },
      {
        label: "Tech Stack",
        value:
          Array.isArray(repo?.tech_stack) && repo?.tech_stack.length > 0
            ? repo?.tech_stack.join(", ")
            : "Not detected",
      },
    ];
  }, [repo]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Dashboard"
        description="Repository overview and key insights"
      >
        <Button
          className="gradient-primary text-primary-foreground hover:opacity-90"
          onClick={() => navigate("/analyze")}
        >
          New Analysis <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </PageHeader>

      {loading && (
        <div className="glass rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass rounded-lg p-4 flex items-center gap-2 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {!loading && !error && repo && (
        <>
          <div className="glass rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Github className="h-5 w-5 text-primary" />
                  {repo.owner}/{repo.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {repo.description || "No description available"}
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/map")}>View Map</Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Stars" value={repo.stars ?? 0} icon={Star} delay={0} />
            <StatCard title="Forks" value={repo.forks ?? 0} icon={GitFork} delay={0.1} />
            <StatCard title="Watchers" value={repo.watchers ?? 0} icon={Eye} delay={0.2} />
            <StatCard
              title="Open Issues"
              value={repo.open_issues ?? 0}
              icon={AlertCircle}
              delay={0.3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {insights.map((item) => (
              <div key={item.label} className="glass rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
