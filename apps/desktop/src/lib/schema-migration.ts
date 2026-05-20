type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

export function migrate<T>(
  raw: unknown,
  migrations: Record<number, MigrationFn>,
  currentVersion: number
): T {
  let current =
    raw != null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  if (typeof current.schemaVersion !== "number") {
    current = { ...current, schemaVersion: 0 };
  }

  let version = current.schemaVersion as number;
  while (version < currentVersion) {
    const fn = migrations[version];
    if (!fn) break;
    current = fn(current);
    version = current.schemaVersion as number;
  }

  return current as T;
}
