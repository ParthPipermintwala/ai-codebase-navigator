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
    | "cache"
    | "file_match"
    | "deterministic"
    | "general_llm";
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
          | "cache"
          | "file_match"
          | "deterministic"
          | "general_llm";
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
      | "cache"
      | "file_match"
      | "deterministic"
      | "general_llm";
  } | string;
  placeholder?: string;
}

const sourceLabelMap: Record<string, string> = {
  tech_stack: "Tech Stack",
  code: "Code Context",
  dependencies: "Dependencies",
  summary: "Repository Summary",
  inferred: "Inference",
  context: "Repository Context",
  cache: "Cached Answer",
  file_match: "File Match",
  deterministic: "Deterministic",
  general_llm: "General LLM",
};

const sourceIconMap: Record<string, string> = {
  tech_stack: "🧱",
  code: "</>",
  dependencies: "📦",
  summary: "📝",
  inferred: "🧠",
  context: "📚",
  cache: "🕘",
  file_match: "📄",
  deterministic: "✅",
  general_llm: "🤖",
};

const getConfidenceBadgeClass = (confidence?: MessageReply01["confidence"]) => {
  if (confidence === "high") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (confidence === "low") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
};

const getSourceBadgeClass = (source?: MessageReply01["source"]) => {
  if (source === "cache") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  }
  if (source === "inferred") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  }
  return "border-neutral-500/40 bg-neutral-700/40 text-neutral-200";
};

const getTrustBanner = (msg: MessageReply01) => {
  const isLowConfidence = msg.confidence === "low";
  const inferredOnly = msg.type === "inferred" && msg.source === "inferred";

  if (!isLowConfidence && !inferredOnly) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      Low confidence response. Verify with repository files before applying changes.
    </div>
  );
};

type AnswerBlock =
  | { type: "heading"; text: string; level: number }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string; code: string }
  | { type: "source"; text: string };

type TableBlock = {
  type: "table";
  headers: string[];
  rows: string[][];
};

type ParsedBlock = AnswerBlock | TableBlock;

const normalizeTableCells = (line: string) =>
  line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, cells) => !(index === 0 && cell === "") && !(index === cells.length - 1 && cell === ""));

const isTableSeparatorRow = (line: string) => {
  const cells = normalizeTableCells(line);
  if (cells.length < 2) {
    return false;
  }

  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
};

const isTableRow = (line: string) => {
  const cells = normalizeTableCells(line);
  return cells.length >= 2;
};

const parseInlineFragments = (text: string) => {
  const value = String(text || "");
  const fragments: Array<{ type: "text" | "bold" | "code"; text: string }> = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      fragments.push({ type: "text", text: value.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      fragments.push({ type: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      fragments.push({ type: "code", text: token.slice(1, -1) });
    } else {
      fragments.push({ type: "text", text: token });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < value.length) {
    fragments.push({ type: "text", text: value.slice(lastIndex) });
  }

  if (fragments.length === 0) {
    fragments.push({ type: "text", text: value });
  }

  return fragments;
};

const renderInlineText = (text: string, keyPrefix: string) =>
  parseInlineFragments(text).map((fragment, index) => {
    if (fragment.type === "bold") {
      return (
        <strong key={`${keyPrefix}-bold-${index}`} className="font-semibold text-gray-100">
          {fragment.text}
        </strong>
      );
    }

    if (fragment.type === "code") {
      return (
        <code
          key={`${keyPrefix}-code-${index}`}
          className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[0.92em] text-cyan-300"
        >
          {fragment.text}
        </code>
      );
    }

    return <span key={`${keyPrefix}-text-${index}`}>{fragment.text}</span>;
  });

const getHeadingClassName = (level: number) => {
  if (level <= 1) {
    return "text-xl font-bold text-gray-50 sm:text-2xl";
  }

  if (level === 2) {
    return "text-lg font-semibold text-gray-100 sm:text-xl";
  }

  if (level === 3) {
    return "text-base font-semibold text-gray-100 sm:text-lg";
  }

  if (level === 4) {
    return "text-sm font-semibold uppercase tracking-wide text-gray-200";
  }

  if (level === 5) {
    return "text-sm font-medium text-gray-200";
  }

  return "text-xs font-medium uppercase tracking-wide text-gray-300";
};

const parseAnswerBlocks = (text: string): ParsedBlock[] => {
  const value = String(text || "").trim();
  if (!value) {
    return [];
  }

  const lines = value.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let codeLanguage = "";
  let inCodeBlock = false;
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      tableBuffer = [];
      return;
    }

    const [headerLine, separatorLine, ...rowLines] = tableBuffer;
    if (!isTableSeparatorRow(separatorLine)) {
      tableBuffer = [];
      return;
    }

    const headers = normalizeTableCells(headerLine);
    const rows = rowLines
      .filter((rowLine) => isTableRow(rowLine))
      .map((rowLine) => normalizeTableCells(rowLine));

    if (headers.length > 0 && rows.length > 0) {
      blocks.push({ type: "table", headers, rows });
    }

    tableBuffer = [];
  };

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim() });
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: "list", items: listBuffer });
      listBuffer = [];
    }
  };

  const flushCode = () => {
    if (codeBuffer.length > 0) {
      blocks.push({
        type: "code",
        language: codeLanguage.trim(),
        code: codeBuffer.join("\n"),
      });
      codeBuffer = [];
      codeLanguage = "";
    }
  };

  const pushHeading = (textLine: string) => {
    const cleaned = textLine.trim();
    if (!cleaned) {
      return;
    }

    const headingMatch = cleaned.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        text: headingMatch[2].trim(),
        level: headingMatch[1].length,
      });
      return;
    }

    const sectionMatch = cleaned.match(/^(summary|key\s*points?|code|source)\s*:?(.*)$/i);
    if (sectionMatch) {
      blocks.push({
        type: "heading",
        text: sectionMatch[1].replace(/\s+/g, " "),
        level: 3,
      });
      const trailing = sectionMatch[2].trim().replace(/^[-•*]\s+/, "");
      if (trailing) {
        blocks.push({ type: "paragraph", text: trailing });
      }
      return;
    }

    blocks.push({ type: "heading", text: cleaned });
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();

    const fenceMatch = trimmed.match(/^```\s*([a-z0-9_-]+)?\s*$/i);
    if (fenceMatch) {
      if (inCodeBlock) {
        flushParagraph();
        flushList();
        flushTable();
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushTable();
        inCodeBlock = true;
        codeLanguage = fenceMatch[1] || "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    const looksLikeTableRow = trimmed.includes("|") && isTableRow(trimmed);
    if (looksLikeTableRow) {
      flushParagraph();
      flushList();
      tableBuffer.push(trimmed);
      continue;
    }

    if (tableBuffer.length > 0) {
      flushTable();
    }

    if (/^(#{1,6})\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushTable();
      pushHeading(trimmed);
      continue;
    }

    const sectionCandidate = trimmed.match(/^(summary|key\s*points?|code|source)\s*:?(.*)$/i);
    if (sectionCandidate) {
      flushParagraph();
      flushList();
      flushTable();
      pushHeading(trimmed);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch || numberedMatch) {
      flushParagraph();
      flushTable();
      listBuffer.push((bulletMatch?.[1] || numberedMatch?.[1] || "").trim());
      continue;
    }

    flushList();
    flushTable();
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushTable();
  if (inCodeBlock) {
    flushCode();
  }

  return blocks;
};

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
  const blocks = parseAnswerBlocks(text);
  if (blocks.length === 0) {
    return null;
  }
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const headingLevel = Math.min(Math.max(block.level, 1), 6);
          const HeadingTag = (`h${Math.min(headingLevel + 1, 6)}` as keyof JSX.IntrinsicElements);
          return (
            <HeadingTag key={`${block.type}-${index}`} className={getHeadingClassName(headingLevel)}>
              {renderInlineText(block.text, `${block.type}-${index}`)}
            </HeadingTag>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={`${block.type}-${index}`} className="whitespace-pre-wrap text-xs leading-relaxed text-gray-300 sm:text-sm">
              {renderInlineText(block.text, `${block.type}-${index}`)}
            </p>
          );
        }

        if (block.type === "source") {
          return (
            <p key={`${block.type}-${index}`} className="text-xs font-medium text-blue-400 sm:text-sm">
              {renderInlineText(block.text, `${block.type}-${index}`)}
            </p>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`} className="space-y-1 pl-5 text-xs text-gray-300 sm:text-sm">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-disc leading-relaxed">
                  {renderInlineText(item, `${block.type}-${index}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "table") {
          return (
            <div key={`${block.type}-${index}`} className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950/80">
              <div className="border-b border-neutral-800 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                Table
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-xs text-gray-200 sm:text-sm">
                  <thead className="bg-neutral-900/80 text-neutral-300">
                    <tr>
                      {block.headers.map((header, headerIndex) => (
                        <th
                          key={`${header}-${headerIndex}`}
                          className="whitespace-nowrap border-b border-neutral-800 px-3 py-2 font-semibold"
                        >
                          {renderInlineText(header, `${block.type}-${index}-head-${headerIndex}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${block.type}-${index}-${rowIndex}`} className="border-t border-neutral-800/70 odd:bg-neutral-900/30">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${cell}-${cellIndex}`}
                            className="align-top border-b border-neutral-800/60 px-3 py-2 text-gray-300"
                          >
                            {renderInlineText(cell, `${block.type}-${index}-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        return (
          <div key={`${block.type}-${index}`} className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950/80">
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              <span>{block.language || "Code"}</span>
              <span>snippet</span>
            </div>
            <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed text-gray-100 sm:text-sm">
              <code className="font-mono">{block.code}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );
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
                  <div className="max-w-[85%] rounded-2xl border border-neutral-700/70 bg-neutral-800 px-3 py-2 text-[13px] leading-relaxed text-neutral-100 shadow-sm transition-all duration-200 sm:max-w-[72%] sm:px-4 sm:py-3 sm:text-sm">
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-[92%] space-y-2.5 rounded-2xl border border-neutral-700 bg-gradient-to-br from-neutral-800 to-neutral-900 p-3 text-left shadow-md transition-all duration-200 hover:shadow-lg sm:max-w-2xl sm:space-y-3 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide sm:px-2.5 sm:text-[11px] ${getSourceBadgeClass(msg.source)}`}
                      >
                        <span aria-hidden="true" className="text-[11px] leading-none sm:text-xs">
                          {sourceIconMap[msg.source || ""] || "•"}
                        </span>
                        {sourceLabelMap[msg.source || ""] || "Unknown Source"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide sm:px-2.5 sm:text-[11px] ${getConfidenceBadgeClass(msg.confidence)}`}
                      >
                        <span aria-hidden="true" className="leading-none">●</span>
                        {msg.confidence || "medium"} confidence
                      </span>
                    </div>

                    {getTrustBanner(msg)}

                    {renderAnswerContent(msg.text)}
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
