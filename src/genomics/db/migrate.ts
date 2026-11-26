import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function splitSqlStatements(sql: string): string[] {
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

export async function runGenomicsMigrations(databaseUrl?: string) {
  const connString = databaseUrl || process.env["DATABASE_URL"];
  if (!connString) {
    throw new Error("DATABASE_URL is required to run genomics migrations");
  }

  const sql = neon(connString);

  console.log("--> Initializing genomics schema and migration tracker...");
  await sql`CREATE SCHEMA IF NOT EXISTS genomics;`;
  await sql`
    CREATE TABLE IF NOT EXISTS genomics.schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  const appliedRows = await sql`SELECT version FROM genomics.schema_migrations ORDER BY version ASC;`;
  const appliedVersions = new Set(appliedRows.map((r: any) => r.version));

  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`--> Found ${files.length} migration file(s) in ${migrationsDir}`);

  const results: { file: string; status: "applied" | "already_applied" | "failed"; error?: string }[] = [];

  for (const file of files) {
    const version = file.split("_")[0] || file;
    if (appliedVersions.has(version)) {
      console.log(`    [SKIP] ${file} (already applied)`);
      results.push({ file, status: "already_applied" });
      continue;
    }

    console.log(`    [APPLYING] ${file}...`);
    const fullPath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(fullPath, "utf-8");
    const statements = splitSqlStatements(sqlContent);

    try {
      // Execute each statement in order
      for (const stmt of statements) {
        await sql.query(stmt);
      }

      // Record migration
      await sql`
        INSERT INTO genomics.schema_migrations (version, name)
        VALUES (${version}, ${file})
        ON CONFLICT (version) DO NOTHING;
      `;

      console.log(`    [SUCCESS] ${file} applied (${statements.length} statements).`);
      results.push({ file, status: "applied" });
    } catch (err: any) {
      console.error(`    [ERROR] Failed to apply ${file}:`, err.message);
      results.push({ file, status: "failed", error: err.message });
      throw err;
    }
  }

  console.log("--> Genomics migrations complete.");
  return results;
}

// Allow direct CLI invocation: node --env-file=.env ...
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runGenomicsMigrations()
    .then((r) => {
      console.log("Migration summary:", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
