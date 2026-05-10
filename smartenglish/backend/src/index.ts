import "dotenv/config";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { Redis } from "ioredis";
import pg from "pg";

import { createOpenApiDocument } from "./openapi.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);
app.use(express.json());

const openApiDocument = createOpenApiDocument();

app.get("/api/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  : null;

async function checkPostgres(): Promise<boolean> {
  if (!pool) return false;
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    client.release();
  }
}

async function checkRedis(): Promise<boolean> {
  if (!redis) return false;
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

app.get("/health", async (_req, res) => {
  const [db, cache] = await Promise.all([checkPostgres(), checkRedis()]);
  res.json({
    ok: db && cache,
    services: {
      postgres: db,
      redis: cache,
    },
  });
});

app.get("/api/version", (_req, res) => {
  res.json({ name: "smartenglish-backend", version: "0.1.0" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
});
