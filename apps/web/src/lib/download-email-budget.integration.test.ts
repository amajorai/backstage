import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { MongoClient } from "mongodb";

const uri = process.env.QUOTA_TEST_MONGO_URL;
const mongo = uri ? new MongoClient(uri) : null;
const database = mongo?.db(
  `download_security_${crypto.randomUUID().replaceAll("-", "")}`
);
mock.module("./download-email-database", () => ({
  downloadEmailDatabase: async () => database,
}));
const { reserveDownloadEmail } = await import("./download-email-budget");
beforeAll(async () => {
  await mongo?.connect();
});
afterAll(async () => {
  await database?.dropDatabase();
  await mongo?.close();
});
const integrationTest = uri ? test : test.skip;
integrationTest(
  "concurrent sends cannot overspend recipient or shared daily send limits",
  async () => {
    if (!database) throw new Error("Missing test database");
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        reserveDownloadEmail("User@example.com")
      )
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await reserveDownloadEmail("user@example.com")).toBe(false);
    const day = new Date().toISOString().slice(0, 10);
    expect(
      (
        await database
          .collection<{ _id: string; count: number }>("download_email_budgets")
          .findOne({ _id: `global:${day}` })
      )?.count
    ).toBe(3);
    await database
      .collection<{ _id: string; count: number }>("download_email_budgets")
      .updateOne({ _id: `global:${day}` }, { $set: { count: 499 } });
    const global = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        reserveDownloadEmail(`user-${index}@example.com`)
      )
    );
    expect(global.filter(Boolean)).toHaveLength(1);
    expect(
      (
        await database
          .collection<{ _id: string; count: number }>("download_email_budgets")
          .findOne({ _id: `global:${day}` })
      )?.count
    ).toBe(500);
  },
  30_000
);
