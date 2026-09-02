import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

async function start() {
  // Make first run reliable even when Drizzle migrations have not been pushed yet.
  await db.execute(sql`CREATE TABLE IF NOT EXISTS visitors (
    id serial PRIMARY KEY,
    name text NOT NULL,
    phone text NOT NULL,
    person_to_meet text NOT NULL,
    purpose text NOT NULL,
    checked_in_at timestamptz NOT NULL DEFAULT now()
  )`);

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Unable to start API server");
  process.exit(1);
});

process.on("SIGTERM", async () => { await pool.end(); });
process.on("SIGINT", async () => { await pool.end(); });
