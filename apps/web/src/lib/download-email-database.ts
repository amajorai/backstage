import { MongoClient } from "mongodb";

let connection: Promise<MongoClient> | undefined;
export async function downloadEmailDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Download email database is not configured");
  connection ??= new MongoClient(url, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  })
    .connect()
    .catch((error) => {
      connection = undefined;
      throw error;
    });
  return (await connection).db("backstage");
}
