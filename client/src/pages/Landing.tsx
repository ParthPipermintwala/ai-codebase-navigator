import { motion } from "framer-motion";
import { ArrowRight, GitBranch, Brain, Map, MessageSquare, Package, Zap, Code2, Layers, ChevronRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RepoInput } from "@/components/shared/RepoInput";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  { icon: Brain, title: "AI Architecture Summary", desc: "Automatic analysis of your project's structure and patterns" },
  { icon: Map, title: "Interactive Repo Map", desc: "Visual representation of modules and dependencies" },
  { icon: MessageSquare, title: "AI Chat Assistant", desc: "Ask questions about any codebase in natural language" },
  { icon: Package, title: "Dependency Analysis", desc: "Deep dive into frameworks and libraries used" },
  { icon: Zap, title: "Impact Analysis", desc: "Predict which files are affected by changes" },
  { icon: Layers, title: "Guided Codebase Tour", desc: "Step-by-step walkthrough of key components" },
];

const steps = [
  { step: "01", title: "Paste a URL", desc: "Enter any public GitHub repository URL" },
  { step: "02", title: "AI Analyzes", desc: "Our AI engine scans structure, deps, and patterns" },
  { step: "03", title: "Explore Insights", desc: "Navigate architecture maps, chat with AI, and more" },
];

const Landing = () => {
  const navigate = useNavigate();

  const handleAnalyze = (url: string) => {
    navigate(`/analyze?repo=${encodeURIComponent(url)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border glass sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Code2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">AI CodeNav</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground hidden sm:inline-flex" onClick={() => navigate("/docs")}>
              Docs
            </Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => navigate("/login")}>
              Login
            </Button>
            <Button className="gradient-primary text-primary-foreground hover:opacity-90" onClick={() => navigate("/create-account")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(173_80%_50%/0.08),transparent_60%)]" />
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary text-xs text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-primary" />
              AI-Powered Repository Understanding
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Understand any codebase
              <br />
              <span className="text-gradient">in minutes, not days</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Paste a GitHub repository URL and get instant AI-powered insights — architecture summaries,
              dependency maps, impact analysis, and an interactive chat assistant.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="max-w-xl mx-auto">
            <RepoInput onSubmit={handleAnalyze} size="large" />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">How it works</h2>
          <p className="text-muted-foreground">Three simple steps to understand any repository</p>
        </motion.div>
        <div className="grid sm:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="text-4xl font-bold text-primary/20 mb-3 font-mono">{s.step}</div>
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              {i < steps.length - 1 && (
                <ChevronRight className="h-5 w-5 text-border mx-auto mt-4 hidden sm:block" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Architecture Preview */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass rounded-xl p-8 glow-border"
        >
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { dir: "src/", files: "124 files" },
              { dir: "components/", files: "48 files" },
              { dir: "utils/", files: "16 files" },
            ].map((item) => (
              <div key={item.dir} className="bg-secondary rounded-lg p-4 text-center hover:bg-surface-hover transition-colors">
                <div className="h-8 w-8 mx-auto rounded bg-primary/10 flex items-center justify-center mb-2">
                  <Code2 className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-mono text-foreground font-medium">{item.dir}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.files}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono">Architecture Preview</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Everything you need to navigate code</h2>
          <p className="text-muted-foreground">Powerful AI-driven tools for developers who want to understand codebases faster.</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="glass rounded-lg p-6 hover:glow-border transition-all duration-300 group cursor-pointer"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to explore?</h2>
          <p className="text-muted-foreground mb-8">Start analyzing any GitHub repository in seconds.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button className="gradient-primary text-primary-foreground h-12 px-8 text-base hover:opacity-90" onClick={() => navigate("/analyze")}>
              Analyze Repository <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" className="border-border text-foreground h-12 px-8 text-base hover:bg-secondary" onClick={() => navigate("/create-account")}>
              Create Free Account
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded gradient-primary flex items-center justify-center">
              <Code2 className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">AI Codebase Navigator</span>
          </div>
          <p className="text-xs text-muted-foreground">Built for developers who value understanding.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
