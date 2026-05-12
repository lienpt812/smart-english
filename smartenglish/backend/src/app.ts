import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import swaggerUi from "swagger-ui-express";

import { redis } from "./cache/redis.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/pool.js";
import { createOpenApiDocument } from "./openapi.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { meRouter } from "./routes/me.js";

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

export async function createApp(): Promise<express.Express> {
  await runMigrations();

  const app = express();
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
    res.json({ name: "smartenglish-backend", version: "0.2.0-phase1" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Không tìm thấy endpoint" },
    });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    const status =
      typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      typeof (err as { statusCode: unknown }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;
    const message =
      err instanceof Error ? err.message : "Lỗi máy chủ không xác định";
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: {
        code: status >= 500 ? "INTERNAL" : "REQUEST_ERROR",
        message,
      },
    });
  };

  app.use(errorHandler);

  return app;
}
