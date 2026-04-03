import "dotenv/config";
import app from "./app.js";

// Validate PORT
const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    // Initialize services (ensure they are ready)
    await import("./config/db.js");
    await import("./config/redis.js");
    await import("./config/pincone.js");

    // Start server AFTER everything is ready
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error(" Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();