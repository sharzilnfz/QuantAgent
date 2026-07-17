import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  issueAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
} from "./auth.service.js";
import { requireAuth } from "./auth.middleware.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("auth-routes");
const router: Router = Router();

// ─── Validation schemas ─────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Cookie config ──────────────────────────────────────────────────────────

function setRefreshCookie(res: Response, token: string, maxAgeMs: number) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: maxAgeMs,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
  });
}

// ─── POST /api/auth/register ────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response) => {
  try {
    const body = registerSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Validation failed", details: body.error.flatten() });
      return;
    }

    const { email, password } = body.data;

    // Check if user already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const user = await createUser(email, password);

    // Issue tokens
    const accessToken = issueAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    const { ttlSeconds } = await storeRefreshToken(user.id, refreshToken);

    setRefreshCookie(res, refreshToken, ttlSeconds * 1000);

    res.status(201).json({
      accessToken,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    logger.error({ err }, "Registration failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/auth/login ───────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  try {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Validation failed", details: body.error.flatten() });
      return;
    }

    const { email, password } = body.data;

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Issue tokens
    const accessToken = issueAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    const { ttlSeconds } = await storeRefreshToken(user.id, refreshToken);

    setRefreshCookie(res, refreshToken, ttlSeconds * 1000);

    logger.info({ userId: user.id }, "User logged in");

    res.json({
      accessToken,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    logger.error({ err }, "Login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/auth/refresh ─────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const oldToken = req.cookies?.refresh_token;
    if (!oldToken) {
      res.status(401).json({ error: "No refresh token provided" });
      return;
    }

    const result = await rotateRefreshToken(oldToken);
    if (!result) {
      clearRefreshCookie(res);
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    setRefreshCookie(res, result.refreshToken, result.ttlSeconds * 1000);

    res.json({
      accessToken: result.accessToken,
      user: { id: result.user.id, email: result.user.email },
    });
  } catch (err) {
    logger.error({ err }, "Token refresh failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/auth/logout ──────────────────────────────────────────────────

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    await revokeAllUserTokens(req.user!.userId);
    clearRefreshCookie(res);
    res.json({ message: "Logged out" });
  } catch (err) {
    logger.error({ err }, "Logout failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/auth/me ───────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  res.json({
    user: { id: req.user!.userId, email: req.user!.email },
  });
});

export { router as authRouter };
