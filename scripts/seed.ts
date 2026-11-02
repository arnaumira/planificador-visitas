import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(readFileSync(join(process.cwd(), "db", "seed.sql"), "utf8"));
  await client.end();
  console.log("Dades d'exemple carregades.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
