import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

// Validate env
if (!process.env.PINECONE_API_KEY) {
  throw new Error("PINECONE_API_KEY is missing in .env");
}

if (!process.env.PINECONE_INDEX) {
  throw new Error("PINECONE_INDEX is missing in .env");
}

// Initialize client
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Get index
export const index = pc.index(process.env.PINECONE_INDEX);

(async () => {
  try {
    const stats = await index.describeIndexStats();
    console.log("Pinecone Connected");
  } catch (err) {
    console.error("Pinecone Connection Failed:", err.message);
  }
})();