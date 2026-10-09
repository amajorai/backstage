import { createHash } from "node:crypto";
import { downloadEmailDatabase } from "./download-email-database";

let indexes: Promise<unknown> | undefined;
export async function reserveDownloadEmail(email: string): Promise<boolean> {
  const client = await downloadEmailDatabase();
  const counters = client.collection<{
    _id: string;
    count: number;
    expiresAt: Date;
  }>("download_email_budgets");
  indexes ??= counters
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  await indexes;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const expiresAt = new Date(now.getTime() + 48 * 3_600_000);
  async function reserve(id: string, limit: number) {
    const filter = { _id: id, count: { $lt: limit } };
    try {
      const result = await counters.updateOne(
        filter,
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true }
      );
      return result.modifiedCount === 1 || result.upsertedCount === 1;
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== 11_000
      )
        throw error;
      // A first-use race can lose the insert while capacity still remains.
      const result = await counters.updateOne(filter, { $inc: { count: 1 } });
      return result.modifiedCount === 1;
    }
  }
  const recipient = createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex");
  return (
    (await reserve(`recipient:${day}:${recipient}`, 3)) &&
    (await reserve(`global:${day}`, 500))
  );
}
