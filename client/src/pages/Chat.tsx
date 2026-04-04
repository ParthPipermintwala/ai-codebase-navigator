import { useSearchParams } from "react-router-dom";
import {
  AiInput003,
  type MentionType,
} from "@/components/ai-input-003";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:3000";

const Chat = () => {
  const [searchParams] = useSearchParams();

  const handleMessage = async (text: string, _mention: MentionType) => {
    try {
      const repoId =
        searchParams.get("repoId") || localStorage.getItem("repoId") || "";

      if (!repoId) {
        return "No repository selected. Analyze a repository first.";
      }

      const res = await fetch(
        `${API_BASE_URL}/api/chat/${encodeURIComponent(repoId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: text,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        console.error(err);
        return {
          answer: "Server error",
          confidence: "low",
          type: "inferred",
          source: "inferred",
        };
      }

      const data = await res.json();
      return {
        answer: data?.answer || "Not found in repository.",
        confidence: data?.confidence || "low",
        type: data?.type || "inferred",
        source: data?.source || "inferred",
      };
    } catch (err) {
      console.error(err);
      return {
        answer: "Error fetching response",
        confidence: "low",
        type: "inferred",
        source: "inferred",
      };
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <AiInput003 onSendMessage={handleMessage} />
    </div>
  );
};

export default Chat;
