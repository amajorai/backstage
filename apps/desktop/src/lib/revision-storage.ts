import { appDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readFile,
  remove,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { logger } from "@/lib/logger";
import type { Page } from "@/stores/use-editor-store";

const RECOVERY_DIR = "recovery";
const REVISIONS_DIR = "revisions";

async function getRecoveryDir(): Promise<string> {
  const appData = await appDataDir();
  return join(appData, RECOVERY_DIR);
}

async function getRevisionsBaseDir(): Promise<string> {
  const appData = await appDataDir();
  return join(appData, REVISIONS_DIR);
}

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true });
  }
}

interface RecoveryFile {
  savedAt: number;
  pages: Page[];
}

export async function saveRecovery(
  projectId: string,
  pages: Page[]
): Promise<void> {
  try {
    const dir = await getRecoveryDir();
    await ensureDir(dir);
    const filePath = await join(dir, `${projectId}.json`);
    const data: RecoveryFile = { savedAt: Date.now(), pages };
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
    const data = JSON.parse(new TextDecoder().decode(bytes)) as RecoveryFile;
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
  await writeFile(filePath, new TextEncoder().encode(JSON.stringify(pages)));
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
    return JSON.parse(new TextDecoder().decode(bytes)) as Page[];
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
