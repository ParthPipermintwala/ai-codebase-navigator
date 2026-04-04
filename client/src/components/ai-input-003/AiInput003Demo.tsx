import { AiInput003, type MentionType } from ".";
import { chatWithRepository } from "@/services/api";

export default function AiInput003Demo() {
  const handleMessage = async (text: string, mention: MentionType) => {
    try {
      const repoId = localStorage.getItem("repoId");

      if (!repoId) {
        return "No repository selected. Analyze a repository first.";
      }

      const data = await chatWithRepository(repoId, text);
      return data?.answer || "No response received.";
    } catch (err) {
      // ✅ FIX: Log error details for debugging
      console.error("Chat fetch error:", err);
      return "Error fetching response";
    }
  };

  return (
    <div className="min-h-screen">
      <AiInput003 onSendMessage={handleMessage} />
    </div>
  );
}
