import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Github,
  Star,
  GitFork,
  Eye,
  Loader2,
  Plus,
  Calendar,
  GitBranch,
  Map,
  MessageSquare,
  Boxes,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { getUserRepositories, getRepository } from "@/services/api";
import { getRepoId, setRepoId } from "@/utils/storage";

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
  updated_at?: string;
  created_at?: string;
}

interface RepoListItem {
  id: string;
  name: string;
  owner?: string;
  description?: string | null;
  updated_at?: string;
  created_at?: string;
}

interface RepositoriesResponseShape {
  data?: unknown;
  repositories?: unknown;
}

const normalizeRepoList = (payload: unknown): RepoListItem[] => {
  if (Array.isArray(payload)) {
    return payload as RepoListItem[];
  }

  if (payload && typeof payload === "object") {
    const parsed = payload as RepositoriesResponseShape;
    if (Array.isArray(parsed.data)) {
      return parsed.data as RepoListItem[];
    }

    if (Array.isArray(parsed.repositories)) {
      return parsed.repositories as RepoListItem[];
    }
  }

  return [];
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<RepoListItem[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<RepositoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRepositories = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await getUserRepositories();
        const repoList = normalizeRepoList(response);
        setRepos(repoList);

        if (repoList.length > 0) {
          const storedRepoId = getRepoId();
          const preferredRepo =
            repoList.find((repo) => repo.id === storedRepoId) || repoList[0];
          await loadRepoDetails(preferredRepo.id);
        }
      } catch (err) {
        console.error("Error loading repositories:", err);
        const message =
          err instanceof Error ? err.message : "Failed to fetch repositories";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadRepositories();
  }, []);

  const loadRepoDetails = async (repoId: string) => {
    try {
      setLoadingDetails(true);
      setError("");
      const response = await getRepository(repoId);
      setSelectedRepo(response?.data || null);
      setRepoId(repoId);
    } catch (err) {
      console.error("Error loading repository:", err);
      const message =
        err instanceof Error ? err.message : "Failed to fetch repository details";
      setError(message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectRepo = async (repo: RepoListItem) => {
    await loadRepoDetails(repo.id);
  };

  const insights = useMemo(() => {
    if (!selectedRepo) return [];
    return [
      {
        label: "Default Branch",
        value: selectedRepo?.default_branch || "-",
      },
      {
        label: "Open Issues",
        value: selectedRepo?.open_issues ?? 0,
      },
      {
        label: "Watchers",
        value: selectedRepo?.watchers ?? 0,
      },
      {
        label: "Tech Stack",
        value:
          Array.isArray(selectedRepo?.tech_stack) && selectedRepo?.tech_stack.length > 0
            ? selectedRepo?.tech_stack.join(", ")
            : "Not detected",
      },
    ];
  }, [selectedRepo]);

  const techStackItems = useMemo(() => {
    if (!selectedRepo?.tech_stack || !Array.isArray(selectedRepo.tech_stack)) {
      return [];
    }

    return selectedRepo.tech_stack
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }, [selectedRepo]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your recently analyzed repositories and quick actions"
      >
        <Button onClick={() => navigate("/analyze")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Analysis
        </Button>
      </PageHeader>

      {loading && (
        <div className="glass rounded-xl p-10 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading recent repositories...</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass rounded-xl p-4 border-destructive/40 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try analyzing a repository, then return to dashboard.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && repos.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-10 sm:p-14 text-center"
        >
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
            <Github className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold text-foreground">No recent repositories yet</h3>
          <p className="text-muted-foreground text-sm mt-2 mb-6 max-w-lg mx-auto">
            Analyze your first repository and it will appear here as a recent visit.
          </p>
          <Button onClick={() => navigate("/analyze")} className="gap-2">
            <Plus className="h-4 w-4" />
            Analyze Repository
          </Button>
        </motion.div>
      )}

      {!loading && !error && repos.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <motion.aside
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-2xl p-4 sm:p-5 h-[68vh] min-h-[620px] max-h-[760px] overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Recent Visits
              </p>
              <span className="text-xs text-primary font-medium">{repos.length}</span>
            </div>

            <div className="space-y-2 h-[calc(100%-2rem)] overflow-y-auto pr-2 scrollbar-modern">
              {repos.map((repo) => {
                const isSelected = selectedRepo?.id === repo.id;
                return (
                  <button
                    key={repo.id}
                    onClick={() => handleSelectRepo(repo)}
                    className={`w-full rounded-xl p-3 text-left border transition-colors ${
                      isSelected
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground truncate">
                      {repo.owner ? `${repo.owner}/${repo.name}` : repo.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
                      {repo.description || "No description provided"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Updated {formatDate(repo.updated_at || repo.created_at)}
                    </p>
                  </button>
                );
              })}
            </div>
          </motion.aside>

          <section className="space-y-5">
            {loadingDetails && (
              <div className="glass rounded-2xl p-10 flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading repository details...</p>
              </div>
            )}

            {!loadingDetails && selectedRepo && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl p-5 sm:p-6"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Selected Repository</p>
                      <h2 className="text-2xl font-bold text-foreground break-all">
                        {selectedRepo.owner}/{selectedRepo.name}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                        {selectedRepo.description || "No repository description available."}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[540px]">
                      <Button
                        variant="outline"
                        className="h-11 w-full justify-center gap-2 rounded-xl border-border/80 bg-background/30"
                        onClick={() => navigate("/map")}
                      >
                        <Map className="h-4 w-4 shrink-0" />
                        Map
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 w-full justify-center gap-2 rounded-xl border-border/80 bg-background/30"
                        onClick={() => navigate("/dependencies")}
                      >
                        <Boxes className="h-4 w-4 shrink-0" />
                        Dependencies
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 w-full justify-center gap-2 rounded-xl border-border/80 bg-background/30"
                        onClick={() => navigate("/chat")}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        Chat
                      </Button>
                    </div>
                  </div>
                </motion.div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="glass rounded-xl p-4">
                    <p className="text-xs text-muted-foreground">Stars</p>
                    <p className="text-xl font-semibold text-foreground mt-1 flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      {selectedRepo.stars ?? 0}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-xs text-muted-foreground">Forks</p>
                    <p className="text-xl font-semibold text-foreground mt-1 flex items-center gap-2">
                      <GitFork className="h-4 w-4 text-primary" />
                      {selectedRepo.forks ?? 0}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-xs text-muted-foreground">Watchers</p>
                    <p className="text-xl font-semibold text-foreground mt-1 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      {selectedRepo.watchers ?? 0}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-xs text-muted-foreground">Open Issues</p>
                    <p className="text-xl font-semibold text-foreground mt-1 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      {selectedRepo.open_issues ?? 0}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {insights
                    .filter((item) => item.label !== "Tech Stack")
                    .map((item) => (
                      <div key={item.label} className="glass rounded-xl p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
                        <p className="text-sm sm:text-base font-medium text-foreground mt-2 break-all flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-primary" />
                          {item.value}
                        </p>
                      </div>
                    ))}

                  <div className="glass rounded-xl p-4 sm:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Tech Stack</p>

                    {techStackItems.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {techStackItems.map((tech) => (
                          <span
                            key={tech}
                            className="inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground"
                            title={tech}
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Not detected</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
