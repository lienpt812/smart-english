import { Router } from "express";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import {
  findUserById,
  findUserStats,
} from "../services/userRepository.js";
import { serializeDashboardSummary } from "../serializers/dashboard.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", requireAuth, async (req, res, next) => {
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

    const stats = await findUserStats(pool, userId);

    res.json(serializeDashboardSummary(user, stats));
  } catch (err) {
    next(err);
  }
});
