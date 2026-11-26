import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function splitSqlStatements(sql) {
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");

  return cleaned
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

async function run() {
  const connString = process.env["DATABASE_URL"];
  if (!connString) throw new Error("DATABASE_URL is required");
  const sql = neon(connString);

  await sql`CREATE SCHEMA IF NOT EXISTS genomics;`;
  await sql`
    CREATE TABLE IF NOT EXISTS genomics.schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  const appliedRows = await sql`SELECT version FROM genomics.schema_migrations ORDER BY version ASC;`;
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  const migrationsDir = path.join(__dirname, "../src/genomics/db/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file.split("_")[0];
    if (appliedVersions.has(version)) {
      console.log(`[Migration] Already applied: ${file}`);
      continue;
    }

    console.log(`[Migration] Applying ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const statements = splitSqlStatements(content);

    for (const stmt of statements) {
      if (stmt.trim()) {
        await sql.query(stmt);
      }
    }

    await sql`
      INSERT INTO genomics.schema_migrations (version, name)
      VALUES (${version}, ${file});
    `;
    console.log(`[Migration] Successfully applied ${file}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
