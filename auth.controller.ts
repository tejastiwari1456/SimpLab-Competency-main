import { Request, Response, NextFunction, Router } from "express";
import { authService, UserRole } from "./auth.service";
import {
  requireAuth,
  requireRole,
  authRateLimiter,
  extractToken,
  AuthenticatedRequest,
} from "./auth.middleware";

export { requireAuth, requireRole, authRateLimiter };
export type { AuthenticatedRequest };

export class AuthController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initRoutes();
  }

  private initRoutes(): void {
    // Public authentication routes (with rate-limiting on sensitive entrypoints)
    this.router.post("/register", authRateLimiter, this.register.bind(this));
    this.router.post("/login", authRateLimiter, this.login.bind(this));
    this.router.get("/verify", this.verifySession.bind(this));
    this.router.post("/refresh", this.refresh.bind(this));
    this.router.post("/forgot-password", authRateLimiter, this.forgotPassword.bind(this));
    this.router.post("/reset-password", authRateLimiter, this.resetPassword.bind(this));

    // Authenticated identity & session management routes
    this.router.get("/me", requireAuth, this.getCurrentUser.bind(this));
    this.router.post("/logout", this.logout.bind(this));
    this.router.post("/logout-all", requireAuth, this.logoutAll.bind(this));
    this.router.get("/sessions", requireAuth, this.getUserSessions.bind(this));
    this.router.post("/change-password", requireAuth, this.changePassword.bind(this));
  }

  /**
   * Helper to format consistent, secure API responses
   */
  private errorResponse(res: Response, status: number, code: string, message: string): void {
    res.status(status).json({
      success: false,
      error: message, // Backward-compatible with existing frontend: data.error
      details: {
        code,
        message,
      },
    });
  }

  /**
   * POST /api/auth/register
   * Registers a new user account with bcrypt password hashing
   */
  public async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, role, institution, enrollmentCode } = req.body;

      // 1. Validate Email
      if (!email || typeof email !== "string" || !email.includes("@")) {
        this.errorResponse(res, 400, "INVALID_EMAIL", "A valid email address is required.");
        return;
      }

      // 2. Validate Password
      if (!password || typeof password !== "string" || password.length < 6) {
        this.errorResponse(
          res,
          400,
          "WEAK_PASSWORD",
          "Password must be at least 6 characters long."
        );
        return;
      }

      // 3. Validate Name
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        this.errorResponse(res, 400, "MISSING_NAME", "Full name is required.");
        return;
      }

      // 4. Validate Role & Prevent Role Escalation (Requirement 3 & 5)
      // Only "student" or "teacher" can register; "admin" cannot be self-registered
      const normalizedRole = typeof role === "string" ? (role.toLowerCase() as UserRole) : null;
      if (!normalizedRole || (normalizedRole !== "student" && normalizedRole !== "teacher")) {
        this.errorResponse(
          res,
          400,
          "INVALID_ROLE",
          "Invalid role specified. Only 'student' and 'teacher' accounts may be registered."
        );
        return;
      }

      const userAgent = req.headers["user-agent"];
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;

      const authResult = await authService.register(
        {
          email,
          password,
          name,
          role: normalizedRole,
          institution,
          enrollmentCode,
        },
        { userAgent, ipAddress }
      );

      res.status(201).json({
        success: true,
        message: "Account registered successfully.",
        user: authResult.user,
        token: authResult.token,
        refreshToken: authResult.refreshToken,
        session: authResult.session,
      });
    } catch (err: any) {
      const message = err?.message || "Registration failed. Please try again.";
      const status = message.includes("already exists") ? 409 : 500;
      this.errorResponse(
        res,
        status,
        status === 409 ? "USER_ALREADY_EXISTS" : "REGISTRATION_FAILED",
        message
      );
    }
  }

  /**
   * POST /api/auth/login
   * Authenticates user with bcrypt verification, transactional session persistence, and audit logging
   */
  public async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, role } = req.body;

      if (!email || typeof email !== "string") {
        this.errorResponse(res, 400, "MISSING_EMAIL", "Email address is required.");
        return;
      }

      if (!password || typeof password !== "string") {
        this.errorResponse(res, 400, "MISSING_PASSWORD", "Password is required.");
        return;
      }

      const userAgent = req.headers["user-agent"];
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;

      const normalizedRole = typeof role === "string" ? (role.toLowerCase() as UserRole) : undefined;

      const authResult = await authService.login({
        email,
        password,
        role: normalizedRole,
        userAgent,
        ipAddress: typeof ipAddress === "string" ? ipAddress : undefined,
      });

      res.status(200).json({
        success: true,
        message: "Logged in successfully.",
        user: authResult.user,
        token: authResult.token,
        refreshToken: authResult.refreshToken,
        session: authResult.session,
      });
    } catch (err: any) {
      const message = err?.message || "Authentication failed.";
      const status = message.includes("suspended") || message.includes("disabled") ? 403 : 401;
      this.errorResponse(res, status, "INVALID_CREDENTIALS", message);
    }
  }

  /**
   * GET /api/auth/me
   * Retrieves profile for currently authenticated user
   */
  public async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      this.errorResponse(res, 401, "UNAUTHENTICATED", "Unauthorized.");
      return;
    }

    res.status(200).json({
      success: true,
      user: req.user,
    });
  }

  /**
   * POST /api/auth/logout
   * Revokes current session and marks status in database
   */
  public async logout(req: Request, res: Response): Promise<void> {
    try {
      const token = extractToken(req);
      const userAgent = req.headers["user-agent"];
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;

      if (token) {
        await authService.revokeSession(token, ipAddress, userAgent);
      }

      res.status(200).json({
        success: true,
        message: "Logged out successfully. Session invalidated.",
      });
    } catch (err: any) {
      this.errorResponse(res, 500, "LOGOUT_ERROR", "Failed to cleanly revoke session.");
    }
  }

  /**
   * POST /api/auth/logout-all
   * Revokes all active sessions for authenticated user (Requirement 33)
   */
  public async logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.errorResponse(res, 401, "UNAUTHENTICATED", "Unauthorized.");
        return;
      }

      const userAgent = req.headers["user-agent"];
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;

      const count = await authService.revokeAllSessions(req.user.id, ipAddress, userAgent);

      res.status(200).json({
        success: true,
        message: `All ${count} active sessions have been revoked.`,
        revokedSessionsCount: count,
      });
    } catch (err: any) {
      this.errorResponse(res, 500, "LOGOUT_ALL_ERROR", "Failed to revoke all sessions.");
    }
  }

  /**
   * GET /api/auth/verify
   * Verifies if provided token represents active, non-revoked session
   */
  public async verifySession(req: Request, res: Response): Promise<void> {
    try {
      const token = extractToken(req);

      if (!token) {
        res.status(400).json({
          success: false,
          valid: false,
          error: "Token missing from request.",
        });
        return;
      }

      const result = await authService.verifySession(token);
      res.status(result.valid ? 200 : 401).json({
        success: result.valid,
        valid: result.valid,
        user: result.user || null,
        error: result.error || null,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        valid: false,
        error: "Session verification error.",
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Rotates refresh token and issues new access token (Requirement 14 & 15)
   */
  public async refresh(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.body?.refreshToken;

      if (!refreshToken || typeof refreshToken !== "string") {
        this.errorResponse(res, 400, "MISSING_REFRESH_TOKEN", "Refresh token is required.");
        return;
      }

      const userAgent = req.headers["user-agent"];
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;

      const refreshResult = await authService.refresh(refreshToken, { userAgent, ipAddress });

      res.status(200).json({
        success: true,
        token: refreshResult.token,
        refreshToken: refreshResult.refreshToken,
        session: refreshResult.session,
        user: refreshResult.user,
      });
    } catch (err: any) {
      this.errorResponse(
        res,
        401,
        "REFRESH_FAILED",
        err?.message || "Invalid or expired refresh token."
      );
    }
  }

  /**
   * POST /api/auth/change-password
   * Securely changes password for authenticated user (Requirement 19)
   */
  public async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.errorResponse(res, 401, "UNAUTHENTICATED", "Unauthorized.");
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        this.errorResponse(
          res,
          400,
          "MISSING_FIELDS",
          "Current password and new password are both required."
        );
        return;
      }

      if (typeof newPassword !== "string" || newPassword.length < 8) {
        this.errorResponse(
          res,
          400,
          "WEAK_PASSWORD",
          "New password must be at least 8 characters long."
        );
        return;
      }

      const userAgent = req.headers["user-agent"];
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;

      await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: "Password changed successfully.",
      });
    } catch (err: any) {
      this.errorResponse(res, 400, "PASSWORD_CHANGE_FAILED", err?.message || "Failed to change password.");
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Requests a password reset token (Requirement 20)
   */
  public async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        this.errorResponse(res, 400, "INVALID_EMAIL", "Valid email address is required.");
        return;
      }

      const userAgent = req.headers["user-agent"];
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;

      const resetToken = await authService.requestPasswordReset(email, ipAddress, userAgent);

      // Generic response to prevent user enumeration attacks
      res.status(200).json({
        success: true,
        message:
          "If an account exists with this email address, password reset instructions have been dispatched.",
        ...(process.env.NODE_ENV !== "production" && resetToken ? { devResetToken: resetToken } : {}),
      });
    } catch (err: any) {
      res.status(200).json({
        success: true,
        message:
          "If an account exists with this email address, password reset instructions have been dispatched.",
      });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Sets new password using reset token (Requirement 20)
   */
  public async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || typeof token !== "string") {
        this.errorResponse(res, 400, "MISSING_TOKEN", "Reset token is required.");
        return;
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        this.errorResponse(
          res,
          400,
          "WEAK_PASSWORD",
          "New password must be at least 8 characters long."
        );
        return;
      }

      const userAgent = req.headers["user-agent"];
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;

      await authService.resetPassword(token, newPassword, ipAddress, userAgent);

      res.status(200).json({
        success: true,
        message: "Password reset successful. Please sign in with your new password.",
      });
    } catch (err: any) {
      this.errorResponse(
        res,
        400,
        "RESET_FAILED",
        err?.message || "Password reset token is invalid or has expired."
      );
    }
  }

  /**
   * GET /api/auth/sessions
   * Retrieves active/recent sessions for current user (Requirement 32)
   */
  public async getUserSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.errorResponse(res, 401, "UNAUTHENTICATED", "Unauthorized.");
        return;
      }

      const sessions = await authService.getUserSessions(req.user.id, req.user.sessionId);

      res.status(200).json({
        success: true,
        sessions,
      });
    } catch (err: any) {
      this.errorResponse(res, 500, "SESSIONS_FETCH_ERROR", "Failed to retrieve session history.");
    }
  }
}

export const authController = new AuthController();
export const authRouter = authController.router;
