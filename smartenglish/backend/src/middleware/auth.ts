import type { RequestHandler } from "express";

import { verifyAccessToken } from "../lib/tokens.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  try {
    req.auth = verifyAccessToken(req.headers.authorization);
    next();
  } catch (err: unknown) {
    const status =
      typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      typeof (err as { statusCode: unknown }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 401;
    const message =
      err instanceof Error ? err.message : "Không được phép truy cập";
    res.status(status).json({
      error: { code: "UNAUTHORIZED", message },
    });
  }
};
