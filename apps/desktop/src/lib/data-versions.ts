/**
 * Single source of truth for every persisted-data schema version in the app.
 * Both backup export and backup import read from this map, so they can't drift.
 * The CLAUDE.md contract requires every versioned surface to be enumerated here.
 */
export const DATA_SCHEMA_VERSIONS = {
  layers: 1,
  recovery: 1,
  revisions: 1,
  aiProjects: 1,
} as const;

export type DataSchemaKey = keyof typeof DATA_SCHEMA_VERSIONS;

/**
 * Top-level appdata directories included in backup export and removed by wipe.
 * Add a new directory in ONE place, not two.
 */
export const APP_DATA_DIRS = [
  "thumbnails",
  "trash",
  "revisions",
  "recovery",
  "ai-projects",
] as const;

/**
 * Top-level appdata files that the export ZIPs and the wipe removes.
 * (Database WAL/SHM are skipped on import — Rust regenerates them — but are
 * included in the export for completeness.)
 */
export const APP_DATA_FILES = [
  "gallery.db",
  "embeddings.db",
  "embeddings.db-wal",
  "embeddings.db-shm",
  "settings.json",
  "license.json",
] as const;
