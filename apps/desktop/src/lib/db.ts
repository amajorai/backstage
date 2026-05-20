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

  // Folders table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    )
  `);

  // folderId column on thumbnails (ignore if already exists)
  try {
    await database.execute("ALTER TABLE thumbnails ADD COLUMN folderId TEXT");
  } catch {
    // column already exists
  }

  // sortOrder column on folders (ignore if already exists)
  try {
    await database.execute(
      "ALTER TABLE folders ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    // column already exists
  }

  // isCharacterSet column on folders (ignore if already exists)
  try {
    await database.execute(
      "ALTER TABLE folders ADD COLUMN isCharacterSet INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    // column already exists
  }

  // color column on folders (ignore if already exists)
  try {
    await database.execute("ALTER TABLE folders ADD COLUMN color TEXT");
  } catch {
    // column already exists
  }

  // archivedAt column on thumbnails (ignore if already exists)
  try {
    await database.execute(
      "ALTER TABLE thumbnails ADD COLUMN archivedAt INTEGER"
    );
  } catch {
    // column already exists
  }

  // archiveFolderId column on thumbnails (ignore if already exists)
  try {
    await database.execute(
      "ALTER TABLE thumbnails ADD COLUMN archiveFolderId TEXT"
    );
  } catch {
    // column already exists
  }

  // Archive folders table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS archive_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      color TEXT
    )
  `);

  // AI Projects table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS ai_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // YouTube favourites table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS yt_favourites (
      videoId TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      channelTitle TEXT NOT NULL,
      thumbnailUrl TEXT NOT NULL,
      viewCount INTEGER NOT NULL DEFAULT 0,
      likeCount INTEGER NOT NULL DEFAULT 0,
      commentCount INTEGER NOT NULL DEFAULT 0,
      publishedAt TEXT NOT NULL,
      durationSeconds INTEGER NOT NULL DEFAULT 0,
      savedAt INTEGER NOT NULL
    )
  `);

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

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    dbInitPromise = null;
  }
}
