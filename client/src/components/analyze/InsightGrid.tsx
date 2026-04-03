import { Blocks, CalendarClock, FileText, Layers3, type LucideIcon } from "lucide-react";

interface InsightGridProps {
  totalFiles: number;
  totalDependencies: number;
  lastUpdated: string;
  techStack: string[];
}

const InsightCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) => (
  <div className="glass rounded-xl p-4 border border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
    <p className="mt-2 text-lg font-semibold text-foreground break-words">{value}</p>
  </div>
);

export const InsightGrid = ({
  totalFiles,
  totalDependencies,
  lastUpdated,
  techStack,
}: InsightGridProps) => {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Quick Insights
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <InsightCard icon={FileText} label="Total Files" value={String(totalFiles)} />
        <InsightCard icon={Blocks} label="Total Dependencies" value={String(totalDependencies)} />
        <InsightCard icon={CalendarClock} label="Last Updated" value={lastUpdated} />
        <InsightCard
          icon={Layers3}
          label="Tech Stack"
          value={techStack.length > 0 ? techStack.join(", ") : "Not detected"}
        />
      </div>
    </section>
  );
};
