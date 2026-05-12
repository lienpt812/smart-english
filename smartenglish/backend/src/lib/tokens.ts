import { createHash, randomBytes } from "crypto";

import jwt from "jsonwebtoken";

function jwtSecret(): string {
  return process.env.JWT_SECRET ?? "";
}

export function assertJwtConfigured(): void {
  const secret = jwtSecret();
  if (!secret || secret.length < 16) {
    throw Object.assign(
      new Error("JWT_SECRET phải được đặt (tối thiểu 16 ký tự)"),
      { statusCode: 503 }
    );
  }
}

export function signAccessToken(
  userId: string,
  email: string
): { token: string; expiresInSec: number } {
  assertJwtConfigured();
  const expiresInSec = Number(process.env.JWT_ACCESS_EXPIRES_SEC ?? 900);
  const token = jwt.sign(
    { sub: userId, email, typ: "access" },
    jwtSecret(),
    { expiresIn: expiresInSec, algorithm: "HS256" }
  );
  return { token, expiresInSec };
}

export function verifyAccessToken(
  authorizationHeader: string | undefined
): { userId: string; email: string } {
  assertJwtConfigured();
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Thiếu Bearer access token"), {
      statusCode: 401,
    });
  }
  const raw = authorizationHeader.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(raw, jwtSecret()) as jwt.JwtPayload;
    if (
      payload.typ !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string"
    ) {
      throw new Error("invalid payload");
    }
    return { userId: payload.sub, email: payload.email };
  } catch {
    throw Object.assign(new Error("Access token không hợp lệ hoặc hết hạn"), {
      statusCode: 401,
    });
  }
}

export function generateRefreshTokenRaw(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function refreshExpiresAt(): Date {
  const days = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30);
  return new Date(Date.now() + days * 86_400_000);
}
