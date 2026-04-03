import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Code2, CheckCircle, FileCode, FolderOpen } from "lucide-react";

const tourSteps = [
  {
    title: "Project Entry Point",
    path: "src/index.ts",
    description: "The main entry point bootstraps the application, initializes configuration, and sets up the Express server with middleware.",
    code: `import express from 'express';\nimport { config } from './config';\nimport { setupRoutes } from './routes';\n\nconst app = express();\nsetupRoutes(app);\napp.listen(config.port);`,
  },
  {
    title: "Route Configuration",
    path: "src/routes/",
    description: "Routes are organized by domain — each feature has its own router module that handles HTTP methods and validation.",
    code: `import { Router } from 'express';\nimport { userRouter } from './user';\nimport { repoRouter } from './repo';\n\nexport function setupRoutes(app) {\n  app.use('/api/users', userRouter);\n  app.use('/api/repos', repoRouter);\n}`,
  },
  {
    title: "Component Architecture",
    path: "src/components/",
    description: "UI components follow an atomic design pattern with shared primitives, composed into feature-specific modules.",
    code: `// Atomic design structure\n├── atoms/\n│   ├── Button.tsx\n│   └── Input.tsx\n├── molecules/\n│   └── SearchBar.tsx\n└── organisms/\n    └── Dashboard.tsx`,
  },
  {
    title: "Data Layer",
    path: "src/models/",
    description: "Database models use Mongoose schemas with TypeScript interfaces for type-safe data access.",
    code: `interface IUser {\n  name: string;\n  email: string;\n  repos: string[];\n}\n\nconst UserSchema = new Schema<IUser>({\n  name: { type: String, required: true },\n  email: { type: String, unique: true },\n});`,
  },
  {
    title: "Utility Functions",
    path: "src/utils/",
    description: "Shared utilities include validation helpers, formatting functions, and API response builders.",
    code: `export function formatBytes(bytes: number) {\n  const units = ['B', 'KB', 'MB', 'GB'];\n  let i = 0;\n  while (bytes >= 1024 && i < units.length - 1) {\n    bytes /= 1024; i++;\n  }\n  return \`\${bytes.toFixed(1)} \${units[i]}\`;\n}`,
  },
];

const Tour = () => {
  const [current, setCurrent] = useState(0);
  const step = tourSteps[current];
  const progress = ((current + 1) / tourSteps.length) * 100;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Codebase Tour" description="Step-by-step walkthrough of key project areas" />

      {/* Animated progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Step {current + 1} of {tourSteps.length}</span>
          <span className="text-xs text-primary font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="flex mt-3 gap-1">
          {tourSteps.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-1 py-1.5 text-xs rounded transition-all duration-200 ${
                i === current
                  ? "bg-primary/15 text-primary font-medium"
                  : i < current
                  ? "bg-primary/5 text-primary/60"
                  : "bg-secondary text-muted-foreground hover:bg-surface-hover"
              }`}
            >
              {i <= current ? <CheckCircle className="h-3 w-3 mx-auto" /> : <span>{i + 1}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Info panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="glass rounded-lg p-6"
          >
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="text-xs text-primary font-mono">Step {current + 1}</span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">{step.title}</h2>
            <p className="text-xs font-mono text-muted-foreground mb-4 flex items-center gap-1">
              <FileCode className="h-3 w-3" /> {step.path}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          </motion.div>
        </AnimatePresence>

        {/* Code preview panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`code-${current}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-lg overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/50">
              <Code2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-mono text-muted-foreground">{step.path}</span>
            </div>
            <pre className="p-4 text-xs font-mono text-foreground/80 overflow-auto leading-relaxed bg-card">
              <code>{step.code}</code>
            </pre>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0} className="border-border text-foreground hover:bg-secondary">
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <Button onClick={() => setCurrent(Math.min(tourSteps.length - 1, current + 1))} disabled={current === tourSteps.length - 1} className="gradient-primary text-primary-foreground hover:opacity-90">
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default Tour;
