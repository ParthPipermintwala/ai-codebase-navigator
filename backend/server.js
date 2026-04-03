import "dotenv/config";
import app from "./app.js";

const startServer = async () => {
  try {
    console.log("📦 Initializing services...");
    await import("./config/supabase.js");
    await import("./config/redis.js");
    await import("./config/pincone.js");

    console.log("✓ Services initialized!");
    console.log("🚀 Starting server...");

    const server = app.listen(3000, () => {
      console.log("✓ Server running on http://localhost:3000");
    });

    process.on("SIGINT", () => {
      console.log("\n📉 Shutting down...");
      server.close(() => process.exit(0));
    });
  } catch (err) {
    console.error("✗ Failed to start server:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

startServer();
