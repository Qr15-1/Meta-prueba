import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL no está configurada.');
  process.exit(1);
}

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(schemaSql);
    console.log('Schema aplicado correctamente.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Error aplicando schema:', error);
  process.exit(1);
});
