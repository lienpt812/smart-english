import { Router } from "express";

import { pool } from "../db/pool.js";
import {
  generateRefreshTokenRaw,
  hashRefreshToken,
  refreshExpiresAt,
  signAccessToken,
} from "../lib/tokens.js";
import { verifyGoogleCredential } from "../services/googleAuth.js";
import {
  consumeRefreshToken,
  insertRefreshToken,
  revokeRefreshToken,
} from "../services/refreshTokenRepository.js";
import {
  ensureUserStats,
  findUserById,
  upsertUserFromGoogle,
} from "../services/userRepository.js";
import { serializeUser } from "../serializers/user.js";

export const authRouter = Router();

authRouter.post("/google", async (req, res, next) => {
  try {
    if (!pool) {
      res.status(503).json({
        error: {
          code: "NO_DATABASE",
          message: "DATABASE_URL chưa được cấu hình",
        },
      });
      return;
    }

    const credential =
      typeof req.body?.credential === "string"
        ? req.body.credential
        : typeof req.body?.idToken === "string"
          ? req.body.idToken
          : null;

    if (!credential) {
      res.status(400).json({
        error: {
          code: "VALIDATION",
          message:
            "Thiếu credential hoặc idToken (JWT từ Google Identity Services)",
        },
      });
      return;
    }

    const profile = await verifyGoogleCredential(credential);
    const user = await upsertUserFromGoogle(pool, profile);
    await ensureUserStats(pool, user.id);

    const refreshRaw = generateRefreshTokenRaw();
    await insertRefreshToken(
      pool,
      user.id,
      hashRefreshToken(refreshRaw),
      refreshExpiresAt()
    );

    const { token, expiresInSec } = signAccessToken(user.id, user.email);

    res.status(200).json({
      accessToken: token,
      refreshToken: refreshRaw,
      expiresIn: expiresInSec,
      tokenType: "Bearer",
      user: serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    if (!pool) {
      res.status(503).json({
        error: {
          code: "NO_DATABASE",
          message: "DATABASE_URL chưa được cấu hình",
        },
      });
      return;
    }

    const refreshRaw =
      typeof req.body?.refreshToken === "string"
        ? req.body.refreshToken
        : null;

    if (!refreshRaw) {
      res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Thiếu refreshToken",
        },
      });
      return;
    }

    const consumed = await consumeRefreshToken(
      pool,
      hashRefreshToken(refreshRaw)
    );

    if (!consumed) {
      res.status(401).json({
        error: {
          code: "INVALID_REFRESH",
          message: "Refresh token không hợp lệ hoặc đã hết hạn",
        },
      });
      return;
    }

    const user = await findUserById(pool, consumed.user_id);
    if (!user) {
      res.status(401).json({
        error: {
          code: "INVALID_REFRESH",
          message: "Người dùng không tồn tại",
        },
      });
      return;
    }

    const newRefreshRaw = generateRefreshTokenRaw();
    await insertRefreshToken(
      pool,
      user.id,
      hashRefreshToken(newRefreshRaw),
      refreshExpiresAt()
    );

    const { token, expiresInSec } = signAccessToken(user.id, user.email);

    res.status(200).json({
      accessToken: token,
      refreshToken: newRefreshRaw,
      expiresIn: expiresInSec,
      tokenType: "Bearer",
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    if (pool) {
      const refreshRaw =
        typeof req.body?.refreshToken === "string"
          ? req.body.refreshToken
          : null;
      if (refreshRaw) {
        await revokeRefreshToken(pool, hashRefreshToken(refreshRaw));
      }
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
