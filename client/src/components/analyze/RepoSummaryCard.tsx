import {
  BookText,
  GitFork,
  Github,
  Languages,
  type LucideIcon,
  Star,
  UserCircle2,
} from "lucide-react";

interface RepoSummaryData {
  name?: string;
  owner?: string;
  description?: string;
  stars?: number;
  forks?: number;
  language?: string;
}

interface RepoSummaryCardProps {
  data: RepoSummaryData;
}

const InfoPill = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
    <p className="mt-1 text-sm font-medium text-foreground truncate">{value}</p>
  </div>
);

export const RepoSummaryCard = ({ data }: RepoSummaryCardProps) => {
  return (
    <section className="glass rounded-2xl p-5 md:p-6 border border-border/50 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
            <Github className="h-3.5 w-3.5" />
            Repository Summary
          </div>
          <h2 className="mt-3 text-xl md:text-2xl font-semibold text-foreground truncate">
            {data.name || "Unknown Repository"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {data.description || "No description available for this repository."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <InfoPill icon={UserCircle2} label="Owner" value={data.owner || "Unknown"} />
        <InfoPill icon={Star} label="Stars" value={String(data.stars ?? 0)} />
        <InfoPill icon={GitFork} label="Forks" value={String(data.forks ?? 0)} />
        <InfoPill icon={Languages} label="Primary Language" value={data.language || "Unknown"} />
        <InfoPill icon={BookText} label="Repository" value={data.name || "Unknown"} />
      </div>
    </section>
  );
};
