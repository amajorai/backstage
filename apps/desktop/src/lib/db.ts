import Database from "@tauri-apps/plugin-sql";
import { logger } from "@/lib/logger";

let db: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

async function initDb(): Promise<Database> {
  logger.info("[DB] Initializing shared database...");
  const database = await Database.load("sqlite:gallery.db");
  logger.info("[DB] Database connection established");

  // Enable WAL mode for better concurrency and performance
  await database.execute("PRAGMA journal_mode=WAL;");
  await database.execute("PRAGMA synchronous=NORMAL;"); // Faster, still safe in WAL mode

  // Create tables sequentially to avoid locking issues
  logger.info("[DB] Verifying schemas...");

  // Gallery table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS thumbnails (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      canvasWidth INTEGER,
      canvasHeight INTEGER
    )
  `);

  // Trash table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS trash (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      deletedAt INTEGER NOT NULL,
      originalCreatedAt INTEGER NOT NULL,
      originalUpdatedAt INTEGER NOT NULL,
      canvasWidth INTEGER,
      canvasHeight INTEGER
    )
  `);

  // Project revisions table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS project_revisions (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      name TEXT NOT NULL
    )
  `);

  try {
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_project_revisions_projectId ON project_revisions(projectId, createdAt)"
    );
  } catch {
    // Index likely already exists
  }

  logger.info("[DB] Tables verified");
  return database;
}

export async function getDb(): Promise<Database> {
  if (db) {
    return db;
  }
  if (!dbInitPromise) {
    dbInitPromise = initDb();
  }
  db = await dbInitPromise;
  return db;
}
