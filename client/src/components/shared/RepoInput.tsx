import { useState } from "react";
import { motion } from "framer-motion";
import { Search, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RepoInputProps {
  onSubmit: (url: string) => void;
  loading?: boolean;
  size?: "default" | "large";
}

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/;

export function RepoInput({ onSubmit, loading, size = "default" }: RepoInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a repository URL");
      return;
    }
    if (!GITHUB_URL_REGEX.test(trimmed)) {
      setError("Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo)");
      return;
    }
    setError("");
    onSubmit(trimmed);
  };

  const isLarge = size === "large";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className={`flex gap-2 ${isLarge ? "flex-col sm:flex-row" : ""}`}>
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${isLarge ? "h-5 w-5" : "h-4 w-4"}`} />
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError("");
            }}
            placeholder="https://github.com/owner/repository"
            className={`pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:ring-primary ${isLarge ? "h-12 text-base" : "h-10 text-sm"}`}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className={`gradient-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity ${isLarge ? "h-12 px-6" : "h-10 px-4"}`}
        >
          {loading ? (
            <span className="animate-pulse">Analyzing...</span>
          ) : (
            <>
              Analyze
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mt-2 text-destructive text-sm"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </motion.div>
      )}
    </form>
  );
}
