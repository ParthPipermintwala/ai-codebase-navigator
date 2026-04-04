import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Loader2, Youtube } from "lucide-react";

export type MentionType = "google" | "youtube" | null;

export interface MessageReply01 {
  id: string;
  text: string;
  sender: "user" | "ai";
  mention?: MentionType;
  timestamp: number;
  confidence?: "high" | "medium" | "low";
  type?: "context" | "inferred";
  source?:
    | "tech_stack"
    | "code"
    | "dependencies"
    | "summary"
    | "inferred"
    | "context"
    | "cache";
}

interface AiInput003Props {
  onSendMessage?: (
    message: string,
    mention: MentionType,
  ) => Promise<
    | {
        answer: string;
        confidence: "high" | "medium" | "low";
        type?: "context" | "inferred";
        source?:
          | "tech_stack"
          | "code"
          | "dependencies"
          | "summary"
          | "inferred"
          | "context"
          | "cache";
      }
    | string
  > | {
    answer: string;
    confidence: "high" | "medium" | "low";
    type?: "context" | "inferred";
    source?:
      | "tech_stack"
      | "code"
      | "dependencies"
      | "summary"
      | "inferred"
      | "context"
      | "cache";
  } | string;
  placeholder?: string;
}

const MentionBadge: React.FC<{ type: MentionType; compact?: boolean }> = ({
  type,
  compact = false,
}) => {
  if (!type) return null;
  const isGoogle = type === "google";
  const label = isGoogle ? "Google Search" : "Youtube Analyzer";

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all duration-300 select-none ${compact ? "text-xs" : "text-sm"} border border-neutral-200 bg-neutral-100 dark:border-[#333] dark:bg-[#222]`}
    >
      {isGoogle ? (
        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-100 bg-white shadow-sm dark:border-transparent">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        </div>
      ) : (
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-red-600 shadow-sm">
          <Youtube size={14} className="fill-white text-white" />
        </div>
      )}
      <span className="font-medium text-neutral-600 dark:text-neutral-300">
        {label}
      </span>
    </div>
  );
};

const renderAnswerContent = (text: string) => {
  const value = String(text || "").trim();
  if (!value) {
    return null;
  }

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const getSectionName = (line: string): "summary" | "keyPoints" | "source" | null => {
    const match = line.match(/^[*\-•]?\s*(summary|key\s*points?|source)\s*:?\s*(.*)$/i);
    if (!match) {
      return null;
    }

    const name = match[1].toLowerCase().replace(/\s+/g, "");
    if (name.startsWith("summary")) return "summary";
    if (name.startsWith("key")) return "keyPoints";
    if (name.startsWith("source")) return "source";
    return null;
  };

  const sections: {
    summary: string[];
    keyPoints: string[];
    source: string[];
  } = {
    summary: [],
    keyPoints: [],
    source: [],
  };

  let currentSection: "summary" | "keyPoints" | "source" | null = null;

  for (const rawLine of lines) {
    const detected = getSectionName(rawLine);
    if (detected) {
      currentSection = detected;
      const trailing = rawLine.replace(/^[*\-•]?\s*(summary|key\s*points?|source)\s*:?\s*/i, "").trim();
      if (trailing) {
        sections[detected].push(trailing.replace(/^[*\-•]\s+/, ""));
      }
      continue;
    }

    const cleaned = rawLine.replace(/^[*\-•]\s+/, "").trim();
    if (!cleaned) {
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(cleaned);
    } else {
      sections.summary.push(cleaned);
    }
  }

  const hasStructuredSections =
    sections.summary.length > 0 ||
    sections.keyPoints.length > 0 ||
    sections.source.length > 0;

  if (hasStructuredSections) {
    return (
      <div className="space-y-4">
        {sections.summary.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-gray-200">Summary</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-400">
              {sections.summary.join("\n")}
            </p>
          </div>
        )}

        {sections.keyPoints.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-gray-200">Key Points</h3>
            <ul className="ml-5 list-disc space-y-1 text-sm text-gray-400">
              {sections.keyPoints.map((point, index) => (
                <li key={`${point}-${index}`}>{point}</li>
              ))}
            </ul>
          </div>
        )}

        {sections.source.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-gray-200">Source</h3>
            <ul className="text-sm text-blue-400">
              {sections.source.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));

  if (bulletLines.length > 0) {
    return (
      <ul className="space-y-1 pl-4 text-sm text-gray-300">
        {lines.map((line, index) => {
          const bulletText = line.replace(/^[-*]\s+/, "");
          return (
            <li key={`${line}-${index}`} className="list-disc">
              {bulletText}
            </li>
          );
        })}
      </ul>
    );
  }

  return <p className="whitespace-pre-line text-sm text-gray-300">{value}</p>;
};

export const AiInput003: React.FC<AiInput003Props> = ({
  onSendMessage,
  placeholder = "Ask about your codebase...",
}) => {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<MessageReply01[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [mention, setMention] = useState<MentionType>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasHydratedHistory = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("chatHistory");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch {
        localStorage.removeItem("chatHistory");
      }
    }
    hasHydratedHistory.current = true;
  }, []);

  useEffect(() => {
    const handleClearHistory = () => {
      setMessages([]);
      localStorage.removeItem("chatHistory");
    };

    window.addEventListener("chat-history-cleared", handleClearHistory as EventListener);
    return () => {
      window.removeEventListener(
        "chat-history-cleared",
        handleClearHistory as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedHistory.current) {
      return;
    }

    localStorage.setItem("chatHistory", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.includes("@goog")) setMention("google");
    else if (val.includes("@yt")) setMention("youtube");
    else if (!val.includes("@")) setMention(null);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);

    const userMessage: MessageReply01 = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      mention,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);

    const loadingMessage: MessageReply01 = {
      id: "loading",
      text: "Analyzing codebase...",
      sender: "ai",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    const prompt = inputValue;
    const promptMention = mention;

    setInputValue("");
    setMention(null);
    setIsTyping(true);

    try {
      const aiResponse = onSendMessage
        ? await onSendMessage(prompt, promptMention)
        : "No message handler configured.";

      const normalizedResponse =
        typeof aiResponse === "string"
          ? {
              answer: aiResponse,
              confidence: "medium" as const,
              type: "inferred" as const,
              source: "context" as const,
            }
          : aiResponse;

      const aiMessage: MessageReply01 = {
        id: `${Date.now()}-ai`,
        text: normalizedResponse?.answer || "No response received.",
        sender: "ai",
        timestamp: Date.now(),
        confidence: normalizedResponse?.confidence || "medium",
        type: normalizedResponse?.type || "context",
        source: normalizedResponse?.source || "context",
      };

      setMessages((prev) =>
        prev.map((message) =>
          message.id === "loading" ? aiMessage : message,
        ),
      );
    } catch {
      const aiMessage: MessageReply01 = {
        id: `${Date.now()}-err`,
        text: "Error fetching response",
        sender: "ai",
        timestamp: Date.now(),
        confidence: "low",
        type: "inferred",
        source: "context",
      };

      setMessages((prev) =>
        prev.map((message) =>
          message.id === "loading" ? aiMessage : message,
        ),
      );
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -bottom-[10%] left-1/2 h-[30%] w-[100%] -translate-x-1/2 bg-cyan-500/10 blur-[120px]" />
      </div>

      <div
        ref={scrollRef}
        className="relative z-10 h-[calc(100vh-120px)] overflow-y-auto px-4 py-6"
      >
        <div className="max-w-4xl mx-auto w-full space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "user" ? (
                  <div className="max-w-[72%] rounded-2xl border border-neutral-700/70 bg-neutral-800 px-4 py-3 text-sm leading-relaxed text-neutral-100 shadow-sm transition-all duration-200">
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-2xl space-y-3 rounded-2xl border border-neutral-700 bg-gradient-to-br from-neutral-800 to-neutral-900 p-5 text-left shadow-md transition-all duration-200 hover:shadow-lg">
                    {msg.type === "context" && (
                      <div className="inline-flex items-center gap-2 rounded-lg border border-green-700 bg-green-900/30 px-3 py-1 text-xs text-green-400">
                        ✅ Based on repository code
                      </div>
                    )}
                    {msg.type === "inferred" && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        ⚠ Based on analysis (may not be exact)
                      </div>
                    )}
                    {renderAnswerContent(msg.text)}
                    <span className={`text-xs ${msg.confidence === "high" ? "text-green-400" : msg.confidence === "medium" ? "text-yellow-400" : "text-red-400"}`}>
                      {msg.confidence || "medium"}
                    </span>
                  </div>
                )}

                {msg.mention && msg.sender === "user" && (
                  <div className="mt-2">
                    <MentionBadge type={msg.mention} compact />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <div className="flex items-center text-sm text-neutral-400 px-2">
              typing...
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-neutral-800 bg-black/80 p-4 backdrop-blur-md">
        <div className="relative w-full max-w-4xl mx-auto">
          <AnimatePresence>
            {mention && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-4 mb-4"
              >
                <MentionBadge type={mention} />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            animate={{
              scale: isSending ? 0.985 : 1,
              borderColor: isSending ? "rgba(239,68,68,0.35)" : "transparent",
              boxShadow: isSending
                ? "0 0 18px rgba(239,68,68,0.12)"
                : "0 4px 12px rgba(0,0,0,0.03)",
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 28,
            }}
            className="group relative flex items-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-900 px-6 py-3 pr-4 transition-colors duration-300"
          >
            {isSending && (
              <motion.div
                initial={{ y: "220%" }}
                animate={{ y: "-120%" }}
                transition={{
                  duration: 0.6,
                  ease: "easeInOut",
                }}
                className="pointer-events-none absolute inset-0 z-0 skew-x-12 bg-gradient-to-t from-red-500/25 via-red-500/10 to-white/10 blur-md"
              />
            )}

            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={placeholder}
              className="z-10 flex-1 border-none bg-transparent py-2 text-[16px] font-medium text-neutral-100 placeholder-neutral-500 outline-none"
              autoFocus
            />

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isSending}
              className={`z-10 ml-4 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
                inputValue.trim() && !isSending
                  ? "bg-white text-black shadow-sm shadow-neutral-700 active:scale-95"
                  : "bg-neutral-700 text-neutral-300"
              }`}
            >
              {isSending ? (
                <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
              ) : (
                <ArrowUp size={20} strokeWidth={3} />
              )}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
