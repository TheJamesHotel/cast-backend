import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbDir = process.env.DB_DIR || path.join(process.cwd(), "data");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "cast.db");
const db = new Database(dbPath);

const schemaPath = path.join(process.cwd(), "db", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

export default db;