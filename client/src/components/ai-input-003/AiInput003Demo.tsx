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

      // ✅ FIX: Check response.ok BEFORE parsing JSON
      if (!response.ok) {
        console.error(`Chat API failed: ${response.status} ${response.statusText}`);
        return "Server error. Please try again.";
      }

      const data = await response.json();
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
