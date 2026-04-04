import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Layers3,
  Map,
  MessageSquare,
  Package,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DocSection {
  icon: LucideIcon;
  title: string;
  content: string;
  accent: string;
}

const sections: DocSection[] = [
  {
    icon: Rocket,
    title: "Getting Started",
    content: "Paste any public GitHub repository URL into the analyzer. AI CodeNav will fetch the repository metadata, analyze the project structure, and generate insights automatically.",
    accent: "from-cyan-500/20 to-sky-500/10",
  },
  {
    icon: Search,
    title: "Repository Analysis",
    content: "The analysis engine examines file structure, detects programming languages, identifies key modules and entry points, maps dependencies, and generates an AI-powered architecture summary.",
    accent: "from-blue-500/20 to-indigo-500/10",
  },
  {
    icon: MessageSquare,
    title: "AI Chat Assistant",
    content: "Use the chat interface to ask natural language questions about the analyzed codebase. The assistant can explain architecture decisions, describe how modules connect, and help you understand unfamiliar code.",
    accent: "from-violet-500/20 to-fuchsia-500/10",
  },
  {
    icon: Zap,
    title: "Impact Analysis",
    content: "The impact analysis tool predicts which files and modules would be affected when you modify a specific file. This helps developers understand the ripple effects of code changes.",
    accent: "from-amber-500/20 to-orange-500/10",
  },
  {
    icon: Map,
    title: "Repository Map",
    content: "The interactive map provides a visual representation of the project's module structure and dependency relationships, making it easy to understand the overall architecture at a glance.",
    accent: "from-emerald-500/20 to-teal-500/10",
  },
  {
    icon: Compass,
    title: "Codebase Tour",
    content: "The guided tour walks you through key areas of the codebase step-by-step, explaining entry points, routing, components, data layers, and utility functions.",
    accent: "from-rose-500/20 to-pink-500/10",
  },
  {
    icon: Package,
    title: "Dependency Analysis",
    content: "View all frameworks, libraries, and packages used in the repository with version information, categorized by type for easy reference.",
    accent: "from-slate-500/20 to-zinc-500/10",
  },
];

const Docs = () => {
  const navigate = useNavigate();

  const highlights = [
    { label: "Fast analysis", value: "One URL" },
    { label: "Deep visibility", value: "Structure + deps" },
    { label: "Guided help", value: "AI chat + tour" },
    { label: "Security-aware", value: "Private token support" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Documentation"
        description="A practical guide to how AI CodeNav analyzes repositories and helps you navigate them faster."
      >
        <Button variant="outline" className="gap-2" onClick={() => navigate("/analyze")}>
          Open Analyzer
          <ArrowRight className="h-4 w-4" />
        </Button>
      </PageHeader>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl border border-border/60 p-6 sm:p-8 overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8 pointer-events-none" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Product Documentation
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Understand repositories with a clearer workflow.
              </h2>
              <p className="max-w-2xl text-sm sm:text-base leading-7 text-muted-foreground">
                AI CodeNav turns a GitHub repository into a readable map of files,
                dependencies, and architecture decisions. Use this guide to learn
                what each tool does and how to move through a project with confidence.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {highlights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/60 bg-secondary/60 p-4"
                >
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background/60 p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              Quick Start
            </div>
            <div className="space-y-3">
              {[
                "Paste a public GitHub URL.",
                "Run analysis to generate insights.",
                "Use map, chat, tour, and dependencies to explore.",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-2xl border border-border/50 bg-secondary/40 p-3"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border/60 bg-secondary/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                What you get
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Architecture summaries, dependency visibility, impact analysis,
                repository maps, and guided codebase walkthroughs.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="group rounded-3xl border border-border/60 bg-card/80 p-6 transition-all duration-300 hover:border-primary/35 hover:bg-card"
          >
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${section.accent} border border-border/60`}>
              <section.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {section.content}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border/60 bg-secondary/40 p-6 sm:p-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-foreground">Need a fast walkthrough?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with the analyzer, then move into the map or chat for deeper context.
            </p>
          </div>
          <Button className="gap-2 gradient-primary text-primary-foreground hover:opacity-90" onClick={() => navigate("/analyze")}>
            Analyze Repository
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.section>
    </div>
  );
};

export default Docs;
