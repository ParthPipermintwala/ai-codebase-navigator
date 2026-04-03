import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Zap, ArrowRight } from "lucide-react";

const impacts = [
  {
    file: "src/utils/auth.ts",
    affected: ["src/routes/user.ts", "src/middleware/auth.ts", "src/controllers/login.ts"],
    severity: "high",
  },
  {
    file: "src/models/User.ts",
    affected: ["src/routes/user.ts", "src/services/userService.ts"],
    severity: "medium",
  },
  {
    file: "src/config/database.ts",
    affected: ["src/models/User.ts", "src/models/Repo.ts", "src/models/Analysis.ts", "src/index.ts"],
    severity: "high",
  },
  {
    file: "src/components/Button.tsx",
    affected: ["src/pages/Dashboard.tsx"],
    severity: "low",
  },
];

const severityColors: Record<string, string> = {
  high: "text-destructive bg-destructive/10",
  medium: "text-warning bg-warning/10",
  low: "text-success bg-success/10",
};

const Impact = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Impact Analysis" description="See which modules are affected by file changes" />

      <div className="space-y-4">
        {impacts.map((item, i) => (
          <motion.div
            key={item.file}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-lg p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm text-foreground">{item.file}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${severityColors[item.severity]}`}>
                {item.severity}
              </span>
            </div>
            <div className="pl-7 space-y-1">
              {item.affected.map((af) => (
                <div key={af} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="h-3 w-3 text-primary/50" />
                  <span className="font-mono">{af}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Impact;
