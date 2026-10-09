import { expect, mock, test } from "bun:test";
import { join as nodeJoin } from "node:path";

const operations: { name: string; path: string; target?: string }[] = [];
const files = new Map<string, Uint8Array>();
mock.module("@tauri-apps/api/path", () => ({
  appDataDir: () => Promise.resolve("/fixture/app"),
  join: (...parts: string[]) => Promise.resolve(nodeJoin(...parts)),
}));
mock.module("@tauri-apps/plugin-fs", () => ({
  exists: (path: string) => {
    operations.push({ name: "exists", path });
    return Promise.resolve(true);
  },
  readFile: (path: string) => {
    operations.push({ name: "read", path });
    return Promise.resolve(files.get(path) ?? new Uint8Array());
  },
  writeFile: (path: string, data: Uint8Array) => {
    operations.push({ name: "write", path });
    files.set(path, data);
  },
  remove: (path: string) => {
    operations.push({ name: "remove", path });
  },
  rename: (path: string, target: string) => {
    operations.push({ name: "rename", path, target });
  },
}));
mock.module("@/lib/fs-utils", () => ({
  ensureDir: (path: string) => {
    operations.push({ name: "mkdir", path });
  },
  bytesToDataUrl: () => "data:image/webp;base64,AA==",
  dataUrlToBytes: () => new Uint8Array(),
}));
mock.module("@/lib/logger", () => ({
  logger: {
    error: () => undefined,
    warn: () => undefined,
    info: () => undefined,
  },
}));
mock.module("@/lib/schema-migration", () => ({
  migrate: (value: unknown) => value,
}));
const storage = await import("./thumbnail-storage");
test("traversal and absolute identifiers never reach thumbnail or trash filesystem operations", async () => {
  for (const id of [
    "../secure_storage",
    "/tmp/escape",
    "..\\secure_storage",
    "a/b",
    "C:escape",
    "%2e%2e",
    "",
    "x".repeat(201),
  ]) {
    operations.length = 0;
    await expect(storage.saveLayerData(id, [])).rejects.toThrow(
      "Invalid thumbnail identifier"
    );
    await storage.loadLayerData(id);
    await storage.loadPreview(id);
    await storage.loadFullImage(id);
    await storage.deleteThumbnailFiles(id);
    await storage.moveFilesToTrash(id);
    await storage.restoreFilesFromTrash(id);
    await storage.deleteFromTrash(id);
    await storage.loadTrashPreview(id);
    expect(operations).toHaveLength(0);
  }
});
test("ordinary generated identifiers retain layer persistence and trash moves", async () => {
  operations.length = 0;
  const id = "9f024f44-29ad-4da0-817c-508aa8a23432";
  await storage.saveLayerData(id, [{ type: "text", value: "Title" }]);
  expect(await storage.loadLayerData(id)).toEqual([
    { type: "text", value: "Title" },
  ]);
  await storage.moveFilesToTrash(id);
  await storage.restoreFilesFromTrash(id);
  expect(operations.filter((operation) => operation.name === "rename")).toEqual(
    [
      {
        name: "rename",
        path: `/fixture/app/thumbnails/${id}`,
        target: `/fixture/app/trash/${id}`,
      },
      {
        name: "rename",
        path: `/fixture/app/trash/${id}`,
        target: `/fixture/app/thumbnails/${id}`,
      },
    ]
  );
});
