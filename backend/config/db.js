import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

(async () => {
  try {
    const client = await pool.connect();
    console.log("PostgreSQL Connected");
    client.release();
  } catch (err) {
    console.error("Failed to connect to PostgreSQL:", err.message);
    if (
      /ENOTFOUND/.test(err.message || "") &&
      /\.supabase\.co/.test(process.env.DATABASE_URL || "")
    ) {
      console.error(
        "Supabase direct DB host is often IPv6-only. This machine cannot route IPv6 right now. Use the Supabase pooler (IPv4) connection string from Dashboard > Connect > Transaction pooler.",
      );
      console.error(
        "Expected format: postgresql://postgres.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres",
      );
    }
  }
})();

pool.on("connect", () => {
  console.log("PostgreSQL Connected");
});
// Pool error handler
pool.on("error", (err) => {
  console.error("PostgreSQL Pool Error:", err);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await pool.end();
  console.log("PostgreSQL Disconnected");
  process.exit(0);
});

export default pool;
