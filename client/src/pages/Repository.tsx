import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { FileCode, Layers, Package, GitBranch, FolderTree, Code2 } from "lucide-react";

const modules = [
  { name: "API Routes", path: "src/api/", files: 12, type: "Backend" },
  { name: "Components", path: "src/components/", files: 45, type: "Frontend" },
  { name: "Utils", path: "src/utils/", files: 8, type: "Shared" },
  { name: "Hooks", path: "src/hooks/", files: 15, type: "Frontend" },
  { name: "Models", path: "src/models/", files: 6, type: "Data" },
];

const Repository = () => {
  const { repoId } = useParams();
  const repoName = repoId ? decodeURIComponent(repoId) : "Unknown";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title={repoName} description="Repository analysis results" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Files" value="4,250" icon={FileCode} delay={0} />
        <StatCard title="Modules" value={28} icon={Layers} delay={0.1} />
        <StatCard title="Dependencies" value={64} icon={Package} delay={0.2} />
        <StatCard title="Branches" value={12} icon={GitBranch} delay={0.3} />
      </div>

      {/* AI Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-lg p-6 mb-8"
      >
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          AI Architecture Summary
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This is a modern full-stack application built with React and TypeScript on the frontend
          with a Node.js/Express backend. The project follows a modular architecture with clear
          separation of concerns. Key patterns include custom hooks for state management, a
          component-based UI layer, and RESTful API routes. The codebase demonstrates good
          practices with TypeScript for type safety and organized file structure.
        </p>
      </motion.div>

      {/* Modules */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-primary" />
          Detected Modules
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="glass rounded-lg p-4 hover:glow-border transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground text-sm">{mod.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{mod.type}</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground">{mod.path}</p>
              <p className="text-xs text-muted-foreground mt-1">{mod.files} files</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Repository;
