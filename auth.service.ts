import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Pool, PoolClient } from "pg";
import { eq, sql } from "drizzle-orm";
import { db, pool as sharedPool } from "./src/db/index.ts";
import { users, sessions, authEvents } from "./src/db/schema.ts";
import { adminAuth } from "./src/lib/firebase-admin.ts";
import { validateRegistrationClassSelection } from "./src/server/enrollmentEngine.ts";
import {
  enrollStudentInClassWithinTransaction,
  type EnrollmentOutcome,
} from "./src/server/enrollmentService.ts";

export type UserRole = "student" | "teacher" | "admin";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
export type SessionStatus = "ACTIVE" | "LOGGED_OUT" | "REVOKED" | "EXPIRED";
export type AuthEventType =
  | "REGISTER"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "FIREBASE_LOGIN_SUCCESS"
  | "LOGOUT"
  | "LOGOUT_ALL"
  | "TOKEN_REFRESH"
  | "TOKEN_REFRESH_REUSE_DETECTED"
  | "PASSWORD_CHANGE"
  | "PASSWORD_CHANGE_FAILED"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET"
  | "ACCOUNT_LOCKED"
  | "FACULTY_EVALUATION";

export interface UserRecord {
  id: string;
  firebase_uid?: string | null;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  institution: string;
  enrollment_code?: string;
  last_login_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export type SafeUser = Omit<UserRecord, "password_hash">;

export interface SessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  refresh_token_hash?: string | null;
  user_agent?: string;
  ip_address?: string;
  created_at: Date;
  expires_at: Date;
  last_activity_at: Date;
  revoked_at?: Date | null;
  status: SessionStatus;
  is_revoked: boolean;
}

export interface AuthEventRecord {
  id: string;
  user_id?: string | null;
  event_type: AuthEventType;
  success: boolean;
  session_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: any;
  created_at: Date;
}

export interface PasswordResetRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at?: Date | null;
  created_at: Date;
}

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  institution?: string;
  enrollmentCode?: string;
  classId?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  role?: UserRole;
  userAgent?: string;
  ipAddress?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  user: SafeUser;
  token: string;
  refreshToken: string;
  session: {
    id: string;
    expiresAt: string;
  };
  enrollment?: EnrollmentOutcome;
}

class AuthService {
  private jwtSecret: string;
  private jwtAccessExpiry: string;
  private jwtRefreshExpiryDays: number;
  private bcryptRounds: number;
  private pool: Pool;

  constructor() {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
      this.jwtSecret = process.env.JWT_SECRET.trim();
    } else {
      // Derive a process-local random secret when JWT_SECRET is not configured, avoiding hardcoded secrets
      this.jwtSecret = crypto.randomBytes(32).toString("hex");
      if (process.env.VERCEL) {
        console.error(
          "[AuthService] CRITICAL: JWT_SECRET is not configured in Vercel Environment Variables. Tokens will not persist across serverless cold starts until JWT_SECRET (16+ chars) is set."
        );
      } else {
        console.warn(
          "[AuthService] JWT_SECRET not configured; generated ephemeral runtime secret. Set JWT_SECRET in environment for persistent tokens across restarts."
        );
      }
    }

    this.jwtAccessExpiry = process.env.JWT_ACCESS_EXPIRES_IN || "2h";
    this.jwtRefreshExpiryDays = 7;
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
    // Use the lazy Cloud SQL PostgreSQL connection pool (no eager startup probes, no pg-mem fallback)
    this.pool = sharedPool;
  }

  /**
   * Retained for compatibility with existing callers/tests.
   * Connection pooling is lazy via pg.Pool — no eager startup probes are executed.
   */
  public async initDatabase(): Promise<void> {
    return;
  }

  /**
   * Acquire database client from the Cloud SQL PostgreSQL connection pool.
   */
  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Hash a plaintext password with bcrypt
   */
  public async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.bcryptRounds);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verify plaintext password against stored bcrypt hash
   */
  public async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Compute deterministic SHA-256 hash of a token string
   */
  public hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Generate signed JSON Web Token (Access Token)
   */
  public generateToken(payload: Omit<JWTPayload, "iat" | "exp">, expiresIn?: string): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: (expiresIn || this.jwtAccessExpiry) as jwt.SignOptions["expiresIn"],
    });
  }

  /**
   * Generate cryptographically random Refresh Token
   */
  public generateRefreshToken(): string {
    return `sim_rt_${crypto.randomBytes(32).toString("hex")}`;
  }

  /**
   * Decode and verify cryptographic signature of a JWT token
   */
  public verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Record an authentication or security audit event into auth_events table
   */
  public async recordAuthEvent(
    event: Omit<AuthEventRecord, "id" | "created_at">,
    client?: PoolClient
  ): Promise<void> {
    const id = `evt-${crypto.randomUUID()}`;
    const query = `
      INSERT INTO auth_events (id, user_id, event_type, success, session_id, ip_address, user_agent, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
    `;
    const params = [
      id,
      event.user_id || null,
      event.event_type,
      event.success,
      event.session_id || null,
      event.ip_address || null,
      event.user_agent || null,
      event.metadata ? JSON.stringify(event.metadata) : null,
    ];

    if (client) {
      await client.query(query, params);
    } else {
      const cli = await this.getClient();
      try {
        await cli.query(query, params);
      } finally {
        cli.release();
      }
    }
  }

  /**
   * Authenticate with a Firebase Auth ID Token (Google Sign-In).
   * Verifies the token via Firebase Admin SDK, upserts the user record in Cloud SQL
   * using Drizzle's onConflictDoUpdate, and opens a database-tracked session.
   */
  public async loginWithFirebaseIdToken(
    idToken: string,
    clientInfo?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    if (!idToken) {
      throw new Error("Firebase ID token is required.");
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const emailNorm = (decoded.email || `${uid}@firebase.local`).trim().toLowerCase();
    const displayName = (decoded.name || emailNorm.split("@")[0] || "SimLab User").trim();

    try {
      return await db.transaction(async (tx) => {
        // Check if an existing user with this email already exists so we link firebaseUid without losing their role
        const existingByEmail = await tx
          .select()
          .from(users)
          .where(sql`LOWER(${users.email}) = ${emailNorm}`)
          .limit(1);

        let userRow: typeof users.$inferSelect;

        if (existingByEmail.length > 0) {
          const [updated] = await tx
            .update(users)
            .set({
              firebaseUid: uid,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingByEmail[0].id))
            .returning();
          userRow = updated;
        } else {
          // Concurrent-safe upsert keyed on firebaseUid
          const placeholderHash = await this.hashPassword(crypto.randomBytes(24).toString("hex"));
          const newId = `usr-fb-${crypto.randomUUID().slice(0, 12)}`;
          const [upserted] = await tx
            .insert(users)
            .values({
              id: newId,
              firebaseUid: uid,
              email: emailNorm,
              passwordHash: placeholderHash,
              name: displayName,
              role: "student",
              status: "ACTIVE",
              institution: "National Institute of Science & Technology",
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: users.firebaseUid,
              set: {
                email: emailNorm,
                name: displayName,
                lastLoginAt: new Date(),
                updatedAt: new Date(),
              },
            })
            .returning();
          userRow = upserted;
        }

        if (userRow.status !== "ACTIVE") {
          throw new Error(
            `Your account has been ${userRow.status.toLowerCase()}. Please contact your institution administrator.`
          );
        }

        const sessionId = `ses-${crypto.randomUUID()}`;
        const token = this.generateToken({
          userId: userRow.id,
          email: userRow.email,
          role: userRow.role as UserRole,
          name: userRow.name,
          sessionId,
        });
        const refreshToken = this.generateRefreshToken();
        const expiresAt = new Date(Date.now() + this.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000);

        await tx.insert(sessions).values({
          id: sessionId,
          userId: userRow.id,
          tokenHash: this.hashToken(token),
          refreshTokenHash: this.hashToken(refreshToken),
          userAgent: clientInfo?.userAgent || null,
          ipAddress: clientInfo?.ipAddress || null,
          expiresAt,
          status: "ACTIVE",
          isRevoked: false,
        });

        await tx.insert(authEvents).values({
          id: `evt-${crypto.randomUUID()}`,
          userId: userRow.id,
          eventType: "FIREBASE_LOGIN_SUCCESS",
          success: true,
          sessionId,
          ipAddress: clientInfo?.ipAddress || null,
          userAgent: clientInfo?.userAgent || null,
          metadata: { provider: "google.com", role: userRow.role },
        });

        const safeUser: SafeUser = {
          id: userRow.id,
          firebase_uid: userRow.firebaseUid,
          email: userRow.email,
          name: userRow.name,
          role: userRow.role as UserRole,
          status: userRow.status as UserStatus,
          institution: userRow.institution,
          enrollment_code: userRow.enrollmentCode || undefined,
          last_login_at: userRow.lastLoginAt?.toISOString() || null,
          created_at: userRow.createdAt.toISOString(),
          updated_at: userRow.updatedAt.toISOString(),
        };

        return {
          user: safeUser,
          token,
          refreshToken,
          session: {
            id: sessionId,
            expiresAt: expiresAt.toISOString(),
          },
        };
      });
    } catch (error: any) {
      if (error?.message?.includes("suspended") || error?.message?.includes("disabled")) {
        throw error;
      }
      console.error("[AuthService] Firebase authentication failed:", error);
      throw new Error("Failed to authenticate with Google account.", { cause: error });
    }
  }

  /**
   * Register a new user account with bcrypt hashing and immediate audit event
   */
  public async register(
    data: RegisterDTO,
    clientInfo?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    const emailNorm = data.email.trim().toLowerCase();

    if (data.role !== "student" && data.role !== "teacher") {
      throw new Error("Invalid role specified. Only 'student' and 'teacher' accounts may be registered.");
    }

    // For student registrations, require a class selection (e.g. PHY101-A or SCI204-B)
    const classValidation = validateRegistrationClassSelection(data.role, data.classId);
    if (!classValidation.valid) {
      throw new Error(`INVALID_CLASS: ${classValidation.error}`);
    }

    const client = await this.getClient();
    try {
      const existingRes = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;",
        [emailNorm]
      );
      if (existingRes.rows.length > 0) {
        throw new Error("An account with this email address already exists.");
      }

      const passwordHash = await this.hashPassword(data.password);
      const userId = `usr-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      const newUser: UserRecord = {
        id: userId,
        email: emailNorm,
        password_hash: passwordHash,
        name: data.name.trim(),
        role: data.role,
        status: "ACTIVE",
        institution: (data.institution || "").trim(),
        enrollment_code: data.enrollmentCode ? data.enrollmentCode.trim() : undefined,
        last_login_at: now,
        created_at: now,
        updated_at: now,
      };

      await client.query("BEGIN;");

      await client.query(
        `INSERT INTO users (id, email, password_hash, name, role, status, institution, enrollment_code, last_login_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
        [
          newUser.id,
          newUser.email,
          newUser.password_hash,
          newUser.name,
          newUser.role,
          newUser.status,
          newUser.institution,
          newUser.enrollment_code || null,
          newUser.last_login_at,
          newUser.created_at,
          newUser.updated_at,
        ]
      );

      // Atomically enroll student in selected class & notify the assigned faculty member
      let enrollmentOutcome: EnrollmentOutcome | undefined;
      if (newUser.role === "student") {
        enrollmentOutcome = await enrollStudentInClassWithinTransaction(client, {
          student: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            enrollmentCode: newUser.enrollment_code || null,
          },
          classIdOrCode: classValidation.normalizedClassSelector,
        });
      }

      const sessionId = `ses-${crypto.randomUUID()}`;
      const token = this.generateToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        sessionId,
      });
      const refreshToken = this.generateRefreshToken();

      const tokenHash = this.hashToken(token);
      const refreshTokenHash = this.hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + this.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO sessions (id, user_id, token_hash, refresh_token_hash, user_agent, ip_address, expires_at, created_at, last_activity_at, status, is_revoked)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 'ACTIVE', FALSE);`,
        [
          sessionId,
          newUser.id,
          tokenHash,
          refreshTokenHash,
          clientInfo?.userAgent || null,
          clientInfo?.ipAddress || null,
          expiresAt,
        ]
      );

      await this.recordAuthEvent(
        {
          user_id: newUser.id,
          event_type: "REGISTER",
          success: true,
          session_id: sessionId,
          ip_address: clientInfo?.ipAddress,
          user_agent: clientInfo?.userAgent,
          metadata: {
            role: newUser.role,
            institution: newUser.institution,
            ...(enrollmentOutcome
              ? {
                  enrollmentId: enrollmentOutcome.enrollmentId,
                  classId: enrollmentOutcome.classId,
                  classCode: enrollmentOutcome.classCode,
                  facultyId: enrollmentOutcome.facultyId,
                }
              : {}),
          },
        },
        client
      );

      await client.query("COMMIT;");

      return {
        user: this.toSafeUser(newUser),
        token,
        refreshToken,
        session: {
          id: sessionId,
          expiresAt: expiresAt.toISOString(),
        },
        enrollment: enrollmentOutcome,
      };
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Authenticate user credentials with transaction, bcrypt verification, session persistence, and audit logging
   */
  public async login(data: LoginDTO): Promise<AuthResult> {
    const emailNorm = data.email.trim().toLowerCase();
    const client = await this.getClient();

    try {
      const userRes = await client.query(
        "SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1;",
        [emailNorm]
      );
      const user = userRes.rows[0] as UserRecord | undefined;

      if (!user) {
        await this.recordAuthEvent({
          user_id: null,
          event_type: "LOGIN_FAILURE",
          success: false,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          metadata: { attempted_email: emailNorm, reason: "USER_NOT_FOUND" },
        });
        throw new Error("Invalid email or password.");
      }

      if (user.status === "SUSPENDED" || user.status === "DISABLED") {
        await this.recordAuthEvent({
          user_id: user.id,
          event_type: "ACCOUNT_LOCKED",
          success: false,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          metadata: { status: user.status },
        });
        throw new Error(
          `Your account has been ${user.status.toLowerCase()}. Please contact your institution administrator.`
        );
      }

      const isPasswordValid = await this.comparePassword(data.password, user.password_hash);
      if (!isPasswordValid) {
        await this.recordAuthEvent({
          user_id: user.id,
          event_type: "LOGIN_FAILURE",
          success: false,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          metadata: { reason: "INVALID_PASSWORD" },
        });
        throw new Error("Invalid email or password.");
      }

      if (data.role && user.role.toLowerCase() !== data.role.toLowerCase()) {
        throw new Error(
          `This account is registered as a ${user.role}. Please switch your sign-in role to ${user.role}.`
        );
      }

      await client.query("BEGIN;");

      const sessionId = `ses-${crypto.randomUUID()}`;
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        sessionId,
      });
      const refreshToken = this.generateRefreshToken();

      const tokenHash = this.hashToken(token);
      const refreshTokenHash = this.hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + this.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO sessions (id, user_id, token_hash, refresh_token_hash, user_agent, ip_address, expires_at, created_at, last_activity_at, status, is_revoked)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 'ACTIVE', FALSE);`,
        [
          sessionId,
          user.id,
          tokenHash,
          refreshTokenHash,
          data.userAgent || null,
          data.ipAddress || null,
          expiresAt,
        ]
      );

      await client.query(
        "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1;",
        [user.id]
      );

      await this.recordAuthEvent(
        {
          user_id: user.id,
          event_type: "LOGIN_SUCCESS",
          success: true,
          session_id: sessionId,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          metadata: { role: user.role },
        },
        client
      );

      await client.query("COMMIT;");

      user.last_login_at = new Date().toISOString();

      return {
        user: this.toSafeUser(user),
        token,
        refreshToken,
        session: {
          id: sessionId,
          expiresAt: expiresAt.toISOString(),
        },
      };
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Verify active session: validates JWT signature, database hash, expiration, revocation, and user status
   */
  public async verifySession(
    token: string
  ): Promise<{ valid: boolean; user?: SafeUser; session?: SessionRecord; payload?: JWTPayload; error?: string }> {
    if (!token) {
      return { valid: false, error: "Missing authorization token." };
    }

    const payload = this.verifyToken(token);
    if (!payload) {
      return { valid: false, error: "Invalid or expired token." };
    }

    const tokenHash = this.hashToken(token);
    const client = await this.getClient();

    try {
      const sessionRes = await client.query(
        `SELECT * FROM sessions WHERE id = $1 AND token_hash = $2 LIMIT 1;`,
        [payload.sessionId, tokenHash]
      );

      if (sessionRes.rows.length === 0) {
        return { valid: false, error: "Session not found or token rotated." };
      }

      const session = sessionRes.rows[0] as SessionRecord;

      if (session.is_revoked || session.status === "REVOKED" || session.status === "LOGGED_OUT") {
        return { valid: false, error: "Session has been revoked. Please sign in again." };
      }

      if (new Date(session.expires_at) < new Date() || session.status === "EXPIRED") {
        return { valid: false, error: "Session has expired. Please sign in again." };
      }

      const userRes = await client.query("SELECT * FROM users WHERE id = $1 LIMIT 1;", [
        session.user_id,
      ]);
      if (userRes.rows.length === 0) {
        return { valid: false, error: "Associated user account no longer exists." };
      }

      const user = userRes.rows[0] as UserRecord;
      if (user.status !== "ACTIVE") {
        return { valid: false, error: `Account is ${user.status.toLowerCase()}. Access denied.` };
      }

      client.query("UPDATE sessions SET last_activity_at = NOW() WHERE id = $1;", [session.id]).catch(() => {});

      return {
        valid: true,
        user: this.toSafeUser(user),
        session,
        payload,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Refresh Token Endpoint with Token Rotation and Reuse Detection
   */
  public async refresh(
    refreshToken: string,
    clientInfo?: { userAgent?: string; ipAddress?: string }
  ): Promise<{ token: string; refreshToken: string; session: { id: string; expiresAt: string }; user: SafeUser }> {
    if (!refreshToken) {
      throw new Error("Refresh token is required.");
    }

    const refreshHash = this.hashToken(refreshToken);
    const client = await this.getClient();

    try {
      const sessionRes = await client.query(
        "SELECT * FROM sessions WHERE refresh_token_hash = $1 LIMIT 1;",
        [refreshHash]
      );

      if (sessionRes.rows.length === 0) {
        await this.recordAuthEvent({
          event_type: "TOKEN_REFRESH_REUSE_DETECTED",
          success: false,
          ip_address: clientInfo?.ipAddress,
          user_agent: clientInfo?.userAgent,
          metadata: { reason: "UNKNOWN_REFRESH_TOKEN_HASH" },
        });
        throw new Error("Invalid or expired refresh token.");
      }

      const session = sessionRes.rows[0] as SessionRecord;

      if (session.is_revoked || session.status !== "ACTIVE") {
        await this.recordAuthEvent(
          {
            user_id: session.user_id,
            session_id: session.id,
            event_type: "TOKEN_REFRESH_REUSE_DETECTED",
            success: false,
            ip_address: clientInfo?.ipAddress,
            user_agent: clientInfo?.userAgent,
            metadata: { session_status: session.status },
          },
          client
        );
        throw new Error("Refresh token has been revoked.");
      }

      if (new Date(session.expires_at) < new Date()) {
        await client.query("UPDATE sessions SET status = 'EXPIRED' WHERE id = $1;", [session.id]);
        throw new Error("Refresh token has expired. Please sign in again.");
      }

      const userRes = await client.query("SELECT * FROM users WHERE id = $1 LIMIT 1;", [
        session.user_id,
      ]);
      if (userRes.rows.length === 0) {
        throw new Error("User account associated with session does not exist.");
      }

      const user = userRes.rows[0] as UserRecord;
      if (user.status !== "ACTIVE") {
        throw new Error(`User account is ${user.status.toLowerCase()}.`);
      }

      const newAccessToken = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        sessionId: session.id,
      });
      const newRefreshToken = this.generateRefreshToken();

      const newTokenHash = this.hashToken(newAccessToken);
      const newRefreshHash = this.hashToken(newRefreshToken);

      await client.query("BEGIN;");

      await client.query(
        `UPDATE sessions
         SET token_hash = $1, refresh_token_hash = $2, last_activity_at = NOW()
         WHERE id = $3;`,
        [newTokenHash, newRefreshHash, session.id]
      );

      await this.recordAuthEvent(
        {
          user_id: user.id,
          session_id: session.id,
          event_type: "TOKEN_REFRESH",
          success: true,
          ip_address: clientInfo?.ipAddress,
          user_agent: clientInfo?.userAgent,
        },
        client
      );

      await client.query("COMMIT;");

      return {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        session: {
          id: session.id,
          expiresAt: new Date(session.expires_at).toISOString(),
        },
        user: this.toSafeUser(user),
      };
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke session on logout and record LOGOUT audit event
   */
  public async revokeSession(
    tokenOrSessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    if (!tokenOrSessionId) return false;

    const tokenHash = this.hashToken(tokenOrSessionId);
    const client = await this.getClient();

    try {
      const res = await client.query(
        `UPDATE sessions
         SET is_revoked = TRUE, status = 'LOGGED_OUT', revoked_at = NOW(), last_activity_at = NOW()
         WHERE token_hash = $1 OR id = $2 OR refresh_token_hash = $1
         RETURNING user_id, id;`,
        [tokenHash, tokenOrSessionId]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        await this.recordAuthEvent(
          {
            user_id: row.user_id,
            session_id: row.id,
            event_type: "LOGOUT",
            success: true,
            ip_address: ipAddress,
            user_agent: userAgent,
          },
          client
        );
        return true;
      }
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke all active sessions for a user
   */
  public async revokeAllSessions(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<number> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `UPDATE sessions
         SET is_revoked = TRUE, status = 'REVOKED', revoked_at = NOW()
         WHERE user_id = $1 AND is_revoked = FALSE
         RETURNING id;`,
        [userId]
      );

      const revokedCount = res.rowCount || 0;

      await this.recordAuthEvent(
        {
          user_id: userId,
          event_type: "LOGOUT_ALL",
          success: true,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: { revokedCount },
        },
        client
      );

      return revokedCount;
    } finally {
      client.release();
    }
  }

  /**
   * Change user password securely with verification, hashing, and audit
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long.");
    }

    const client = await this.getClient();
    try {
      const userRes = await client.query("SELECT * FROM users WHERE id = $1 LIMIT 1;", [userId]);
      if (userRes.rows.length === 0) {
        throw new Error("User not found.");
      }

      const user = userRes.rows[0] as UserRecord;
      const isValid = await this.comparePassword(currentPassword, user.password_hash);
      if (!isValid) {
        await this.recordAuthEvent(
          {
            user_id: userId,
            event_type: "PASSWORD_CHANGE_FAILED",
            success: false,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: { reason: "CURRENT_PASSWORD_MISMATCH" },
          },
          client
        );
        throw new Error("Incorrect current password.");
      }

      const newHash = await this.hashPassword(newPassword);

      await client.query("BEGIN;");
      await client.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2;",
        [newHash, userId]
      );

      await this.recordAuthEvent(
        {
          user_id: userId,
          event_type: "PASSWORD_CHANGE",
          success: true,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        client
      );

      await client.query("COMMIT;");
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Request password reset token
   */
  public async requestPasswordReset(
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string | null> {
    const emailNorm = email.trim().toLowerCase();
    const client = await this.getClient();

    try {
      const userRes = await client.query(
        "SELECT id, status FROM users WHERE LOWER(email) = $1 LIMIT 1;",
        [emailNorm]
      );

      if (userRes.rows.length === 0 || userRes.rows[0].status !== "ACTIVE") {
        return null;
      }

      const userId = userRes.rows[0].id;
      const resetToken = `rst_${crypto.randomBytes(32).toString("hex")}`;
      const tokenHash = this.hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await client.query("BEGIN;");

      await client.query(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, NOW());`,
        [`reset-${crypto.randomUUID()}`, userId, tokenHash, expiresAt]
      );

      await this.recordAuthEvent(
        {
          user_id: userId,
          event_type: "PASSWORD_RESET_REQUEST",
          success: true,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        client
      );

      await client.query("COMMIT;");

      return resetToken;
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Complete password reset using token
   */
  public async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!token) throw new Error("Reset token is required.");
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long.");
    }

    const tokenHash = this.hashToken(token);
    const client = await this.getClient();

    try {
      const resetRes = await client.query(
        `SELECT * FROM password_resets
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         LIMIT 1;`,
        [tokenHash]
      );

      if (resetRes.rows.length === 0) {
        throw new Error("Invalid or expired password reset token.");
      }

      const resetRecord = resetRes.rows[0] as PasswordResetRecord;
      const newHash = await this.hashPassword(newPassword);

      await client.query("BEGIN;");

      await client.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2;",
        [newHash, resetRecord.user_id]
      );

      await client.query("UPDATE password_resets SET used_at = NOW() WHERE id = $1;", [
        resetRecord.id,
      ]);

      await client.query(
        "UPDATE sessions SET is_revoked = TRUE, status = 'REVOKED', revoked_at = NOW() WHERE user_id = $1;",
        [resetRecord.user_id]
      );

      await this.recordAuthEvent(
        {
          user_id: resetRecord.user_id,
          event_type: "PASSWORD_RESET",
          success: true,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        client
      );

      await client.query("COMMIT;");
    } catch (err) {
      await client.query("ROLLBACK;").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve safe audit sessions for the authenticated user
   */
  public async getUserSessions(userId: string, currentSessionId?: string): Promise<any[]> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `SELECT id, created_at, expires_at, last_activity_at, status, user_agent, ip_address, is_revoked
         FROM sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20;`,
        [userId]
      );

      return res.rows.map((row) => ({
        id: row.id,
        loginAt: row.created_at,
        lastActivityAt: row.last_activity_at,
        expiresAt: row.expires_at,
        status: row.is_revoked ? "REVOKED" : row.status,
        userAgent: row.user_agent || "Standard Browser Client",
        ipAddress: row.ip_address || "127.0.0.1",
        isCurrent: row.id === currentSessionId,
      }));
    } finally {
      client.release();
    }
  }

  public async findUserById(id: string): Promise<UserRecord | null> {
    const client = await this.getClient();
    try {
      const res = await client.query("SELECT * FROM users WHERE id = $1 LIMIT 1;", [id]);
      return (res.rows[0] as UserRecord) || null;
    } finally {
      client.release();
    }
  }

  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    const client = await this.getClient();
    try {
      const res = await client.query("SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1;", [
        email.trim().toLowerCase(),
      ]);
      return (res.rows[0] as UserRecord) || null;
    } finally {
      client.release();
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  public toSafeUser(user: UserRecord): SafeUser {
    const { password_hash, ...safe } = user;
    return safe;
  }
}

export const authService = new AuthService();
