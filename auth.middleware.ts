import { Request, Response, NextFunction } from "express";
import { authService, UserRole, UserStatus } from "./auth.service";

export interface AuthenticatedUserContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  institution: string;
  enrollment_code?: string;
  sessionId: string;
  created_at: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserContext;
  token?: string;
}

/**
 * Extracts authorization token from Bearer header, custom header, or request payload
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers["x-auth-token"];
  if (typeof customHeader === "string") {
    return customHeader.trim();
  }
  if (req.body && typeof req.body.token === "string") {
    return req.body.token.trim();
  }
  return null;
}

/**
 * Express Middleware: requireAuth
 * Validates JWT signature, database-backed session state, expiration, and account status.
 * Attaches sanitized user context (req.user) and token (req.token).
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Unauthorized: Missing authentication token.",
      },
    });
    return;
  }

  try {
    const verification = await authService.verifySession(token);

    if (!verification.valid || !verification.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_SESSION",
          message: verification.error || "Unauthorized: Invalid or expired session.",
        },
      });
      return;
    }

    req.user = {
      id: verification.user.id,
      email: verification.user.email,
      name: verification.user.name,
      role: verification.user.role,
      status: verification.user.status,
      institution: verification.user.institution,
      enrollment_code: verification.user.enrollment_code,
      sessionId: verification.session?.id || verification.payload?.sessionId || "session-active",
      created_at: verification.user.created_at,
    };
    req.token = token;

    next();
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: "AUTH_VERIFICATION_ERROR",
        message: "Failed to verify session status.",
      },
    });
  }
}

/**
 * Express Middleware: requireRole
 * Enforces Role-Based Access Control (RBAC) on top of requireAuth.
 * Always executes AFTER requireAuth.
 * Validates against controlled roles (case-insensitive: "student" | "teacher" | "admin").
 * Never relies on client-supplied role payloads.
 */
export function requireRole(...allowedRoles: string[]) {
  const normalizedAllowed = allowedRoles.map((r) => r.trim().toLowerCase());

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required before role verification.",
        },
      });
      return;
    }

    const userRole = (req.user.role || "").toLowerCase();

    if (!normalizedAllowed.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Authorized roles: ${allowedRoles.join(", ")}. Your role: ${req.user.role}.`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * In-memory sliding window rate limiter for sensitive authentication endpoints
 */
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitBuckets: Map<string, RateLimitBucket> = new Map();

// Periodic cleanup of stale rate-limit buckets every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}, 300000);
if (typeof cleanupTimer?.unref === "function") {
  cleanupTimer.unref();
}

export function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const windowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000", 10); // 15 mins default
  const maxAttempts = parseInt(process.env.AUTH_RATE_LIMIT_MAX || "30", 10);

  const ip =
    (req.headers["x-forwarded-for"] as string) ||
    req.socket.remoteAddress ||
    "127.0.0.1";
  const path = req.path;
  const key = `${ip}:${path}`;
  const now = Date.now();

  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    next();
    return;
  }

  bucket.count++;

  if (bucket.count > maxAttempts) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfterSec);
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many authentication attempts. Please try again later.",
      },
    });
    return;
  }

  next();
}
