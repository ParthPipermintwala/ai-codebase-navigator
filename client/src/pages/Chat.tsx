import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Send, Bot, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MessageWithSources extends Message {
  sources?: Array<{ file: string; snippet: string }>;
}

const initialMessages: MessageWithSources[] = [
  {
    role: "assistant",
    content: "Hi! I'm your AI Codebase Assistant. Ask me anything about the repository you've analyzed — architecture, specific files, dependencies, or how components connect.",
  },
];

const Chat = () => {
  const [searchParams] = useSearchParams();
  const repoId = searchParams.get("repoId") || "";
  
  const [messages, setMessages] = useState<MessageWithSources[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg: MessageWithSources = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      // Call backend API
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg.content,
          repoId: repoId || "default",
          conversationId: `conv-${Date.now()}`
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to get response');
      }

      const data = await response.json();
      
      const assistantMsg: MessageWithSources = {
        role: "assistant",
        content: data.message || "I couldn't generate a response. Please try again.",
        sources: data.sources
      };
      
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-6 pb-0">
        <PageHeader title="AI Chat" description="Ask questions about the analyzed repository" />
      </div>

      {error && (
        <div className="px-6 pt-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 pb-4 space-y-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[75%] ${msg.role === "user" ? "" : "flex flex-col gap-2"}`}>
              <div
                className={`rounded-lg p-4 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "glass"
                }`}
              >
                {msg.content}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="ml-8 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Sources:</p>
                  {msg.sources.map((source, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      <p className="font-mono">{source.file}</p>
                      <p className="line-clamp-2">{source.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="glass rounded-lg p-4">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-4 glass">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 max-w-4xl mx-auto"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the codebase..."
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || loading}
            className="gradient-primary text-primary-foreground hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
