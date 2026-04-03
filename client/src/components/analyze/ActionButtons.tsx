import { motion } from "framer-motion";
import {
  ArrowRight,
  GitGraph,
  MessageCircle,
  PackageSearch,
  Route,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ActionButtonsProps {
  repoId: string;
}

const actions = [
  {
    label: "View Repository Map",
    path: "/map",
    icon: GitGraph,
  },
  {
    label: "Open AI Chat",
    path: "/chat",
    icon: MessageCircle,
  },
  {
    label: "View Dependencies",
    path: "/dependencies",
    icon: PackageSearch,
  },
  {
    label: "Start Codebase Tour",
    path: "/tour",
    icon: Route,
  },
  {
    label: "Impact Analysis",
    path: "/impact",
    icon: Sparkles,
  },
];

export const ActionButtons = ({ repoId }: ActionButtonsProps) => {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    const query = `repoId=${encodeURIComponent(repoId)}`;
    navigate(`${path}?${query}`);
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Continue Exploring
      </h3>
      <div className="flex flex-wrap gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * index }}
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => handleNavigate(action.path)}
                className="group border-border/70 hover:border-primary/50 hover:bg-primary/10"
              >
                <Icon className="h-4 w-4 mr-2" />
                {action.label}
                <ArrowRight className="h-3.5 w-3.5 ml-2 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
