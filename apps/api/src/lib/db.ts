import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(uri: string, dbName: string): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not connected. Call connectDb() first.');
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
