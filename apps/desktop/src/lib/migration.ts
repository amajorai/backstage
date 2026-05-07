import { appDataDir, join } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir, readDir } from "@tauri-apps/plugin-fs";
import { logger } from "@/lib/logger";

const OLD_APP_IDENTIFIER = "pub.youtube.desktop";
const OLD_LOCALSTORAGE_KEY = "youtube.pub:clipboard:v1";
const NEW_LOCALSTORAGE_KEY = "backstage:clipboard:v1";

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  if (!(await exists(dest))) {
    await mkdir(dest, { recursive: true });
  }
  const entries = await readDir(src);
  for (const entry of entries) {
    const srcPath = await join(src, entry.name);
    const destPath = await join(dest, entry.name);
    if (entry.isDirectory) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function migrateAppData(): Promise<void> {
  try {
    const newAppData = await appDataDir();
    // Derive old path: replace new identifier with old one in the path
    const newIdentifier = "com.backstage.desktop";
    const oldAppData = newAppData.replace(newIdentifier, OLD_APP_IDENTIFIER);

    if (oldAppData === newAppData) return;
    if (!(await exists(oldAppData))) return;

    logger.info("[Migration] Migrating app data from old folder to Backstage");
    await copyDirRecursive(oldAppData, newAppData);
    logger.info("[Migration] App data migration complete");
  } catch (error) {
    logger.error({ err: error }, "[Migration] App data migration failed");
  }
}

function migrateLocalStorage(): void {
  try {
    const old = localStorage.getItem(OLD_LOCALSTORAGE_KEY);
    if (old !== null) {
      localStorage.setItem(NEW_LOCALSTORAGE_KEY, old);
      localStorage.removeItem(OLD_LOCALSTORAGE_KEY);
      logger.info("[Migration] Clipboard localStorage key migrated");
    }
  } catch {
    // ignore
  }
}

export async function runMigrations(): Promise<void> {
  migrateLocalStorage();
  await migrateAppData();
}
