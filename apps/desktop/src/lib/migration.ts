import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";

const OLD_LOCALSTORAGE_KEY = "youtube.pub:clipboard:v1";
const NEW_LOCALSTORAGE_KEY = "backstage:clipboard:v1";

async function migrateAppData(): Promise<void> {
  try {
    const migrated = await invoke<boolean>("migrate_app_data");
    if (migrated) {
      logger.info("[Migration] App data migrated from pub.youtube.desktop");
    }
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
