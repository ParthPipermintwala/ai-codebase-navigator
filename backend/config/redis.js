import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
  },
});

// Connect safely
(async () => {
  try {
    await client.connect();
    console.log("Redis Connected");
  } catch (err) {
    console.error("Redis Connection Failed:", err.message);
  }
})();

client.on("error", (err) => console.log("Redis Error:", err));
process.on("SIGINT", async () => {
  await client.quit();
  console.log("Redis Disconnected");
  process.exit(0);
});

console.log("Redis Connected");

export default client;
