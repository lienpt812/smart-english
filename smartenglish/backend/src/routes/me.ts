import { Router } from "express";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import {
  findUserById,
  updateUserProfile,
  type UserPatch,
} from "../services/userRepository.js";
import { serializeUser } from "../serializers/user.js";

export const meRouter = Router();

meRouter.get("/", requireAuth, async (req, res, next) => {
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

    const userId = req.auth!.userId;
    const user = await findUserById(pool, userId);
    if (!user) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Không tìm thấy người dùng" },
      });
      return;
    }

    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

meRouter.patch("/", requireAuth, async (req, res, next) => {
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

    const body = req.body as Record<string, unknown>;
    const patch: UserPatch = {};

    if (body.locale !== undefined) {
      if (typeof body.locale !== "string" || body.locale.length > 16) {
        res.status(400).json({
          error: {
            code: "VALIDATION",
            message: "locale phải là chuỗi tối đa 16 ký tự",
          },
        });
        return;
      }
      patch.locale = body.locale;
    }

    if (body.placementCompleted !== undefined) {
      if (typeof body.placementCompleted !== "boolean") {
        res.status(400).json({
          error: {
            code: "VALIDATION",
            message: "placementCompleted phải là boolean",
          },
        });
        return;
      }
      patch.placementCompleted = body.placementCompleted;
    }

    if (body.placementSkipped !== undefined) {
      if (typeof body.placementSkipped !== "boolean") {
        res.status(400).json({
          error: {
            code: "VALIDATION",
            message: "placementSkipped phải là boolean",
          },
        });
        return;
      }
      patch.placementSkipped = body.placementSkipped;
    }

    const updated = await updateUserProfile(pool, req.auth!.userId, patch);
    if (!updated) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Không tìm thấy người dùng" },
      });
      return;
    }

    res.json({ user: serializeUser(updated) });
  } catch (err) {
    next(err);
  }
});
