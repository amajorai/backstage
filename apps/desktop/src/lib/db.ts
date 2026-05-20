import Database from "@tauri-apps/plugin-sql";
import { logger } from "@/lib/logger";

let db: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

// Bump this whenever you add a new migration below.
const TARGET_SCHEMA_VERSION = 7;

type MigrationFn = (database: Database) => Promise<void>;

/**
 * SQLite throws on `ALTER TABLE ... ADD COLUMN` when the column already exists.
 * That's intolerable for our bootstrap path: a user on a pre-tracker install
 * may already have any subset of v1-v6 columns/tables but report
 * `user_version = 0`. Every migration step needs to be safely re-runnable.
 *
 * `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` already are.
 * For ADD COLUMN, swallow the specific "duplicate column name" error and
 * rethrow anything else.
 */
async function safeAddColumn(database: Database, sql: string): Promise<void> {
  try {
    await database.execute(sql);
  } catch (err) {
    const msg = String(err).toLowerCase();
    if (msg.includes("duplicate column name")) return;
    throw err;
  }
}

const migrations: Record<number, MigrationFn> = {
  1: async (database) => {
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
    await database.execute(`
      CREATE TABLE IF NOT EXISTS project_revisions (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        name TEXT NOT NULL
      )
    `);
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_project_revisions_projectId ON project_revisions(projectId, createdAt)"
    );
    await database.execute(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `);
  },
  2: async (database) => {
    await safeAddColumn(
      database,
      "ALTER TABLE thumbnails ADD COLUMN folderId TEXT"
    );
    await safeAddColumn(
      database,
      "ALTER TABLE folders ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0"
    );
  },
  3: async (database) => {
    await safeAddColumn(
      database,
      "ALTER TABLE folders ADD COLUMN isCharacterSet INTEGER NOT NULL DEFAULT 0"
    );
    await safeAddColumn(database, "ALTER TABLE folders ADD COLUMN color TEXT");
  },
  4: async (database) => {
    await safeAddColumn(
      database,
      "ALTER TABLE thumbnails ADD COLUMN archivedAt INTEGER"
    );
    await safeAddColumn(
      database,
      "ALTER TABLE thumbnails ADD COLUMN archiveFolderId TEXT"
    );
    await database.execute(`
      CREATE TABLE IF NOT EXISTS archive_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        color TEXT
      )
    `);
  },
  5: async (database) => {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS ai_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);
  },
  6: async (database) => {
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
  },
  7: async (_database) => {
    // Schema version tracking introduced — no structural changes needed.
    // Future migrations go here as version 8, 9, etc.
  },
};

async function runMigrations(database: Database): Promise<void> {
  const rows = await database.select<[{ user_version: number }]>(
    "PRAGMA user_version"
  );
  const current = rows[0]?.user_version ?? 0;

  if (current >= TARGET_SCHEMA_VERSION) return;

  logger.info(
    { from: current, to: TARGET_SCHEMA_VERSION },
    "[DB] Running migrations"
  );

  // CLAUDE.md mandates running migrations in a transaction so a partial
  // failure rolls back cleanly. Every migration is idempotent (CREATE IF
  // NOT EXISTS, safeAddColumn) so running them all from current+1 is safe
  // even on a pre-tracker install that already has v1-v6 columns/tables.
  await database.execute("BEGIN TRANSACTION");
  try {
    for (let v = current + 1; v <= TARGET_SCHEMA_VERSION; v++) {
      const fn = migrations[v];
      if (fn) {
        logger.info({ version: v }, "[DB] Applying migration");
        await fn(database);
      }
      await database.execute(`PRAGMA user_version = ${v}`);
    }
    await database.execute("COMMIT");
  } catch (err) {
    await database.execute("ROLLBACK");
    logger.error({ err }, "[DB] Migration failed, rolled back");
    throw err;
  }
}

async function initDb(): Promise<Database> {
  logger.info("[DB] Initializing shared database...");
  const database = await Database.load("sqlite:gallery.db");
  logger.info("[DB] Database connection established");

  try {
    await database.execute("PRAGMA journal_mode=WAL;");
    await database.execute("PRAGMA synchronous=NORMAL;");
    await runMigrations(database);
  } catch (err) {
    // Close the handle so we don't leak it, and clear the cached promise so a
    // subsequent getDb() call gets a fresh attempt rather than re-awaiting a
    // permanently-rejected promise.
    try {
      await database.close();
    } catch {
      // ignore close errors during cleanup
    }
    dbInitPromise = null;
    throw err;
  }

  logger.info("[DB] Ready");
  return database;
}

export async function getDb(): Promise<Database> {
  if (db) return db;
  if (!dbInitPromise) dbInitPromise = initDb();
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

/** Returns the SQLite `PRAGMA user_version` — the current schema version. */
export async function getSqliteSchemaVersion(): Promise<number> {
  const database = await getDb();
  const rows = await database.select<[{ user_version: number }]>(
    "PRAGMA user_version"
  );
  return rows[0]?.user_version ?? 0;
}
