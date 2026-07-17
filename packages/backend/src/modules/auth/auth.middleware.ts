import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "./auth.service.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("auth-middleware");

/**
 * Extend Express Request to include authenticated user info.
 */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware that verifies the JWT access token from the Authorization header.
 * Injects `req.user` with `{ userId, email }` on success.
 * Returns 401 if token is missing, invalid, or expired.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    logger.debug({ err }, "Access token verification failed");
    res.status(401).json({ error: "Invalid or expired access token" });
    return;
  }
}
