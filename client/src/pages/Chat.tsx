import { useSearchParams } from "react-router-dom";
import {
  AiInput003,
  type MentionType,
} from "@/components/ai-input-003";
import { chatWithRepository } from "@/services/api";

const Chat = () => {
  const [searchParams] = useSearchParams();

  const handleMessage = async (text: string, _mention: MentionType) => {
    try {
      const repoId =
        searchParams.get("repoId") || localStorage.getItem("repoId") || "";

      if (!repoId) {
        return "No repository selected. Analyze a repository first.";
      }

      const data = await chatWithRepository(repoId, text);
      return {
        answer: data?.answer || "Not found in repository.",
        confidence: data?.confidence || "low",
        type: data?.type || "inferred",
        source: data?.source || "inferred",
      };
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Unable to fetch response. Please try again.";
      return {
        answer: message,
        confidence: "low",
        type: "inferred",
        source: "inferred",
      };
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 w-full flex-col">
      <AiInput003 onSendMessage={handleMessage} />
    </div>
  );
};

export default Chat;
