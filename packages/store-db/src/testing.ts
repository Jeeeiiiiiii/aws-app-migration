/** Test helper: a fresh, empty database on the test Postgres server per call. */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { connect, type DbConfig } from "./index.ts";

const admin: DbConfig = {
  host: process.env.TEST_PG_HOST ?? "localhost",
  port: Number(process.env.TEST_PG_PORT ?? 55432),
  user: process.env.TEST_PG_USER ?? "postgres",
  password: process.env.TEST_PG_PASSWORD ?? "test",
  database: "postgres",
};

export interface TestDatabase {
  config: DbConfig;
  pool: pg.Pool;
  drop(): Promise<void>;
}

export async function freshDatabase(): Promise<TestDatabase> {
  const name = `t_${randomUUID().replaceAll("-", "")}`;
  const client = new pg.Client(admin);
  await client.connect();
  await client.query(`create database ${name}`);
  await client.end();
  const config = { ...admin, database: name };
  const pool = connect(config);
  return {
    config,
    pool,
    async drop() {
      await pool.end();
      const c = new pg.Client(admin);
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    },
  };
}
