import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export function initDB() {
  const dbDir = path.join(__dirname, 'db');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(process.env.DB_PATH || path.join(dbDir, 'syncpay.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(dbDir, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
  }

  console.log('✓ SQLite database initialized');
  return db;
}

export function getDB() {
  if (!db) throw new Error('DB not initialized — call initDB() first');
  return db;
}
