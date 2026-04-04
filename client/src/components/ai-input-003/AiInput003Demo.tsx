import { AiInput003, type MentionType } from ".";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:3000";

export default function AiInput003Demo() {
  const handleMessage = async (text: string, mention: MentionType) => {
    try {
      const repoId = localStorage.getItem("repoId");

      if (!repoId) {
        return "No repository selected. Analyze a repository first.";
      }

      const response = await fetch(
        `${API_BASE_URL}/api/chat/${encodeURIComponent(repoId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: text,
            mention,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return data?.message || "Error fetching response";
      }

      return data?.answer || "No response received.";
    } catch {
      return "Error fetching response";
    }
  };

  return (
    <div className="min-h-screen">
      <AiInput003 onSendMessage={handleMessage} />
    </div>
  );
}
