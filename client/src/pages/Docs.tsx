import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Rocket, Search, MessageSquare, Zap, Map, Compass, Package } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface DocSection {
  icon: LucideIcon;
  title: string;
  content: string;
}

const sections: DocSection[] = [
  {
    icon: Rocket,
    title: "Getting Started",
    content: "Paste any public GitHub repository URL into the analyzer. AI CodeNav will fetch the repository metadata, analyze the project structure, and generate insights automatically.",
  },
  {
    icon: Search,
    title: "Repository Analysis",
    content: "The analysis engine examines file structure, detects programming languages, identifies key modules and entry points, maps dependencies, and generates an AI-powered architecture summary.",
  },
  {
    icon: MessageSquare,
    title: "AI Chat Assistant",
    content: "Use the chat interface to ask natural language questions about the analyzed codebase. The assistant can explain architecture decisions, describe how modules connect, and help you understand unfamiliar code.",
  },
  {
    icon: Zap,
    title: "Impact Analysis",
    content: "The impact analysis tool predicts which files and modules would be affected when you modify a specific file. This helps developers understand the ripple effects of code changes.",
  },
  {
    icon: Map,
    title: "Repository Map",
    content: "The interactive map provides a visual representation of the project's module structure and dependency relationships, making it easy to understand the overall architecture at a glance.",
  },
  {
    icon: Compass,
    title: "Codebase Tour",
    content: "The guided tour walks you through key areas of the codebase step-by-step, explaining entry points, routing, components, data layers, and utility functions.",
  },
  {
    icon: Package,
    title: "Dependency Analysis",
    content: "View all frameworks, libraries, and packages used in the repository with version information, categorized by type for easy reference.",
  },
];

const Docs = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Documentation" description="Learn how AI Codebase Navigator works" />

      <div className="grid sm:grid-cols-2 gap-4">
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass rounded-lg p-6 hover:glow-border transition-all duration-300 group"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <section.icon className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground mb-2">{section.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Docs;
