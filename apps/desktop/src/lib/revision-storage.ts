import { appDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  size as fsSize,
  readFile,
  remove,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { ensureDir } from "@/lib/fs-utils";
import { logger } from "@/lib/logger";
import { migrate } from "@/lib/schema-migration";
import type { Page } from "@/stores/use-editor-store";

const RECOVERY_DIR = "recovery";
const REVISIONS_DIR = "revisions";
const RECOVERY_SCHEMA_VERSION = 1;
const REVISION_SCHEMA_VERSION = 1;

interface RecoveryFileV1 {
  schemaVersion: 1;
  savedAt: number;
  pages: Page[];
}

interface RevisionFileV1 {
  schemaVersion: 1;
  pages: Page[];
}

const recoveryMigrations = {
  // v0 had no schemaVersion field — same shape, just add the version stamp
  0: (d: Record<string, unknown>) => ({ ...d, schemaVersion: 1 }),
} as const;

async function getRecoveryDir(): Promise<string> {
  const appData = await appDataDir();
  return join(appData, RECOVERY_DIR);
}

async function getRevisionsBaseDir(): Promise<string> {
  const appData = await appDataDir();
  return join(appData, REVISIONS_DIR);
}

export async function saveRecovery(
  projectId: string,
  pages: Page[]
): Promise<void> {
  try {
    const dir = await getRecoveryDir();
    await ensureDir(dir);
    const filePath = await join(dir, `${projectId}.json`);
    const data: RecoveryFileV1 = {
      schemaVersion: RECOVERY_SCHEMA_VERSION,
      savedAt: Date.now(),
      pages,
    };
    await writeFile(filePath, new TextEncoder().encode(JSON.stringify(data)));
  } catch (error) {
    logger.error({ err: error }, "[Recovery] Failed to save");
  }
}

export async function loadRecovery(
  projectId: string
): Promise<{ savedAt: number; pages: Page[] } | null> {
  try {
    const dir = await getRecoveryDir();
    const filePath = await join(dir, `${projectId}.json`);
    if (!(await exists(filePath))) return null;
    const bytes = await readFile(filePath);
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    const data = migrate<RecoveryFileV1>(
      raw,
      recoveryMigrations,
      RECOVERY_SCHEMA_VERSION
    );
    return { savedAt: data.savedAt, pages: data.pages };
  } catch (error) {
    logger.error({ err: error }, "[Recovery] Failed to load");
    return null;
  }
}

export async function deleteRecovery(projectId: string): Promise<void> {
  try {
    const dir = await getRecoveryDir();
    const filePath = await join(dir, `${projectId}.json`);
    if (await exists(filePath)) await remove(filePath);
  } catch (error) {
    logger.error({ err: error }, "[Recovery] Failed to delete");
  }
}

export async function saveRevisionData(
  projectId: string,
  revId: string,
  pages: Page[]
): Promise<void> {
  const base = await getRevisionsBaseDir();
  const projectDir = await join(base, projectId);
  await ensureDir(projectDir);
  const filePath = await join(projectDir, `${revId}.json`);
  const data: RevisionFileV1 = {
    schemaVersion: REVISION_SCHEMA_VERSION,
    pages,
  };
  await writeFile(filePath, new TextEncoder().encode(JSON.stringify(data)));
}

export async function loadRevisionData(
  projectId: string,
  revId: string
): Promise<Page[] | null> {
  try {
    const base = await getRevisionsBaseDir();
    const filePath = await join(base, projectId, `${revId}.json`);
    if (!(await exists(filePath))) return null;
    const bytes = await readFile(filePath);
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    // v0 wrote a bare Page[] array — handle gracefully
    if (Array.isArray(raw)) return raw as Page[];
    const data = migrate<RevisionFileV1>(raw, {}, REVISION_SCHEMA_VERSION);
    return data.pages;
  } catch (error) {
    logger.error({ err: error }, "[Revisions] Failed to load revision data");
    return null;
  }
}

export async function deleteRevisionData(
  projectId: string,
  revId: string
): Promise<void> {
  try {
    const base = await getRevisionsBaseDir();
    const filePath = await join(base, projectId, `${revId}.json`);
    if (await exists(filePath)) await remove(filePath);
  } catch (error) {
    logger.error({ err: error }, "[Revisions] Failed to delete revision file");
  }
}

export async function deleteAllProjectRevisionData(
  projectId: string
): Promise<void> {
  try {
    const base = await getRevisionsBaseDir();
    const projectDir = await join(base, projectId);
    if (await exists(projectDir)) await remove(projectDir, { recursive: true });
  } catch (error) {
    logger.error(
      { err: error },
      "[Revisions] Failed to purge project revisions"
    );
  }
}

export async function deleteAllRevisionData(): Promise<void> {
  try {
    const base = await getRevisionsBaseDir();
    if (await exists(base)) await remove(base, { recursive: true });
  } catch (error) {
    logger.error(
      { err: error },
      "[Revisions] Failed to purge all revision data"
    );
  }
}

export async function getRevisionStorageSize(): Promise<number> {
  try {
    const base = await getRevisionsBaseDir();
    if (!(await exists(base))) return 0;
    return await fsSize(base);
  } catch {
    return 0;
  }
}

export async function getProjectStorageSize(
  projectId: string
): Promise<number> {
  const appData = await appDataDir();
  const paths = [
    await join(appData, "thumbnails", projectId),
    await join(appData, "revisions", projectId),
    await join(appData, "recovery", `${projectId}.json`),
  ];
  let total = 0;
  for (const p of paths) {
    try {
      if (await exists(p)) {
        total += await fsSize(p);
      }
    } catch {
      // ignore per-path errors
    }
  }
  return total;
}
