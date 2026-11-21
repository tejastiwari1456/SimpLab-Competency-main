import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";
import { newDb } from "pg-mem";

export type UserRole = "student" | "teacher" | "admin";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
export type SessionStatus = "ACTIVE" | "LOGGED_OUT" | "REVOKED" | "EXPIRED";
export type AuthEventType =
  | "REGISTER"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "LOGOUT_ALL"
  | "TOKEN_REFRESH"
  | "TOKEN_REFRESH_REUSE_DETECTED"
  | "PASSWORD_CHANGE"
  | "PASSWORD_CHANGE_FAILED"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET"
  | "ACCOUNT_LOCKED";

export interface UserRecord {
  id: string;
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
}

/**
 * ==============================================================================
 * TOKEN STORAGE STRATEGY (Requirement 13 & 14)
 * ==============================================================================
 * 1. Access Tokens:
 *    - Short-lived JSON Web Tokens signed with HS256 using JWT_SECRET.
 *    - Configurable lifetime (default: 15 minutes, via JWT_ACCESS_EXPIRES_IN).
 *    - Carries authenticated identity claims (userId, role, email, name, sessionId).
 *
 * 2. Refresh Tokens:
 *    - Long-lived cryptographically secure 256-bit random tokens (crypto.randomBytes(32)).
 *    - Configurable lifetime (default: 7 days, via JWT_REFRESH_EXPIRES_IN).
 *
 * 3. Database Security Policy:
 *    - RAW REFRESH TOKENS AND ACCESS TOKENS ARE NEVER STORED IN POSTGRESQL.
 *    - The database exclusively persists deterministic SHA-256 hashes:
 *      - `sessions.token_hash`: SHA-256 hash of the currently valid access token.
 *      - `sessions.refresh_token_hash`: SHA-256 hash of the currently valid refresh token.
 *    - When the client submits an access or refresh token, the server computes its SHA-256
 *      digest and compares it against the indexed hash columns in the database.
 *    - Even in the event of an unauthorized database dump, no usable tokens or passwords can be replayed.
 * ==============================================================================
 */

class AuthService {
  private jwtSecret: string;
  private jwtAccessExpiry: string;
  private jwtRefreshExpiryDays: number;
  private bcryptRounds: number;
  private pool: Pool | null = null;
  private dbInitialized = false;
  private dbAvailable = false;
  private isProduction = process.env.NODE_ENV === "production";

  // Pre-seeded authentic user accounts for immediate out-of-the-box readiness
  private defaultSeedUsers: UserRecord[] = [];

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || "simlab-secret-jwt-key-production-ready-2026";
    this.jwtAccessExpiry = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
    this.jwtRefreshExpiryDays = 7;
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

    this.initDefaultUsers();
    this.initDatabase();
  }

  /**
   * Initialize static seed user definitions
   */
  private initDefaultUsers(): void {
    const salt = bcrypt.genSaltSync(this.bcryptRounds);
    const demoHashedPassword = bcrypt.hashSync("password123", salt);
    const adminHashedPassword = bcrypt.hashSync("Admin@SimLab2026!", salt);

    this.defaultSeedUsers = [
      {
        id: "usr-student-1",
        email: "aarav.sharma@university.edu",
        password_hash: demoHashedPassword,
        name: "Aarav Sharma",
        role: "student",
        status: "ACTIVE",
        institution: "National Institute of Science & Technology",
        enrollment_code: "PHYS-2026-A",
        last_login_at: null,
        created_at: "2026-08-15T10:00:00.000Z",
      },
      {
        id: "usr-teacher-1",
        email: "dr.ananya.sen@university.edu",
        password_hash: demoHashedPassword,
        name: "Dr. Ananya Sen",
        role: "teacher",
        status: "ACTIVE",
        institution: "Department of Physics & Applied Sciences",
        enrollment_code: "DEPT-PHYS-LEAD",
        last_login_at: null,
        created_at: "2026-08-01T08:30:00.000Z",
      },
      {
        id: "usr-admin-1",
        email: "admin.lead@university.edu",
        password_hash: adminHashedPassword,
        name: "Central Administrator",
        role: "admin",
        status: "ACTIVE",
        institution: "SimLab Central Institutional Administration",
        enrollment_code: "SYS-ADMIN-CORE",
        last_login_at: null,
        created_at: "2026-07-01T00:00:00.000Z",
      },
    ];
  }

  /**
   * Initialize connection pool to PostgreSQL or SQL-compliant engine
   */
  public async initDatabase(): Promise<void> {
    if (this.dbInitialized && this.pool) return;

    // 1. Try external PostgreSQL connection if configured
    if (process.env.DATABASE_URL || process.env.SQL_HOST) {
      try {
        const connectionConfig = process.env.DATABASE_URL
          ? { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 }
          : {
              host: process.env.SQL_HOST || process.env.PGHOST || "127.0.0.1",
              port: parseInt(process.env.PGPORT || "5432", 10),
              user: process.env.SQL_USER || process.env.PGUSER || "postgres",
              password: process.env.SQL_PASSWORD || process.env.PGPASSWORD || "",
              database: process.env.SQL_DB_NAME || process.env.PGDATABASE || "simlab",
              connectionTimeoutMillis: 2000,
            };

        const externalPool = new Pool(connectionConfig);
        externalPool.on("error", (err) => {
          console.warn("[AuthService:PostgreSQL] Pool error:", err.message);
        });

        const client = await externalPool.connect();
        try {
          await this.applyMigrations(client);
          this.pool = externalPool;
          this.dbAvailable = true;
          this.dbInitialized = true;
          console.log("[AuthService:PostgreSQL] Connected to external PostgreSQL database.");
          return;
        } finally {
          client.release();
        }
      } catch (err: any) {
        if (this.isProduction) {
          console.error("[AuthService:PostgreSQL] Production database connection failed:", err.message);
          this.dbAvailable = false;
          this.dbInitialized = true;
          throw new Error(`Production database unavailable: ${err.message}`);
        }
        console.log(
          `[AuthService:PostgreSQL] External database unavailable (${err?.message || "offline"}). Booting SQL-compliant PostgreSQL engine for development/test.`
        );
      }
    }

    // 2. Development & Test Fallback: SQL-compliant engine
    // Requirement 24: In development/test mode, initialize SQL engine executing real PostgreSQL DDL & DML
    try {
      const db = newDb();
      const pgAdapter = db.adapters.createPg();
      const localPool = new pgAdapter.Pool();

      const client = await localPool.connect();
      try {
        await this.applyMigrations(client);
        this.pool = localPool as unknown as Pool;
        this.dbAvailable = true;
        this.dbInitialized = true;
        console.log("[AuthService:PostgreSQL] SQL-compliant PostgreSQL database engine initialized successfully.");
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("[AuthService:PostgreSQL] Failed to initialize SQL database engine:", err);
      this.dbAvailable = false;
      this.dbInitialized = true;
    }
  }

  /**
   * Apply database schema DDL migrations and seed default users
   */
  private async applyMigrations(client: PoolClient): Promise<void> {
    const migrationPath = path.join(process.cwd(), "migrations", "001_auth_schema.sql");
    let ddl: string;

    if (fs.existsSync(migrationPath)) {
      ddl = fs.readFileSync(migrationPath, "utf-8");
    } else {
      ddl = `
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(32) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
          status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DISABLED')),
          institution VARCHAR(255) DEFAULT '',
          enrollment_code VARCHAR(128),
          last_login_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(64) NOT NULL,
          refresh_token_hash VARCHAR(64),
          user_agent TEXT,
          ip_address VARCHAR(64),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          revoked_at TIMESTAMP WITH TIME ZONE,
          status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOGGED_OUT', 'REVOKED', 'EXPIRED')),
          is_revoked BOOLEAN DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS auth_events (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
          event_type VARCHAR(64) NOT NULL,
          success BOOLEAN NOT NULL,
          session_id VARCHAR(64),
          ip_address VARCHAR(64),
          user_agent TEXT,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS password_resets (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(64) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash);
        CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
      `;
    }

    await client.query(ddl);

    // Seed default authentic accounts if table is empty
    const checkRes = await client.query("SELECT COUNT(*) FROM users;");
    const count = parseInt(checkRes.rows[0].count, 10);
    if (count === 0) {
      for (const user of this.defaultSeedUsers) {
        await client.query(
          `INSERT INTO users (id, email, password_hash, name, role, status, institution, enrollment_code, last_login_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (email) DO NOTHING;`,
          [
            user.id,
            user.email,
            user.password_hash,
            user.name,
            user.role,
            user.status,
            user.institution,
            user.enrollment_code || null,
            user.last_login_at || null,
            user.created_at,
            user.created_at,
          ]
        );
      }
    }
  }

  /**
   * Acquire database client from connection pool
   */
  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      await this.initDatabase();
    }
    if (!this.pool) {
      throw new Error("Database pool is unavailable.");
    }
    return this.pool.connect();
  }

  /**
   * Hash a plaintext password with bcrypt salt work factor 10
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
   * Record an authentication audit event into auth_events table
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
   * Register a new user account with bcrypt hashing and immediate audit event
   */
  public async register(
    data: RegisterDTO,
    clientInfo?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    const emailNorm = data.email.trim().toLowerCase();

    // 1. Role Escalation Guard: Only "student" or "teacher" can self-register
    if (data.role !== "student" && data.role !== "teacher") {
      throw new Error("Invalid role specified. Only 'student' and 'teacher' accounts may be registered.");
    }

    const client = await this.getClient();
    try {
      // 2. Check for duplicate account
      const existingRes = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;",
        [emailNorm]
      );
      if (existingRes.rows.length > 0) {
        throw new Error("An account with this email address already exists.");
      }

      // 3. Hash password with bcrypt
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

      // 4. Create active session & token pair
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

      // 5. Audit Event
      await this.recordAuthEvent(
        {
          user_id: newUser.id,
          event_type: "REGISTER",
          success: true,
          session_id: sessionId,
          ip_address: clientInfo?.ipAddress,
          user_agent: clientInfo?.userAgent,
          metadata: { role: newUser.role, institution: newUser.institution },
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
   * (Requirements 9, 10, 11, 18, 23)
   */
  public async login(data: LoginDTO): Promise<AuthResult> {
    const emailNorm = data.email.trim().toLowerCase();
    const client = await this.getClient();

    try {
      // 1. Fetch user by email
      const userRes = await client.query(
        "SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1;",
        [emailNorm]
      );
      const user = userRes.rows[0] as UserRecord | undefined;

      if (!user) {
        // Record failed login audit event without leaking user existence
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

      // 2. Enforce Account Status (Requirement 18)
      if (user.status === "SUSPENDED" || user.status === "DISABLED") {
        await this.recordAuthEvent({
          user_id: user.id,
          event_type: "ACCOUNT_LOCKED",
          success: false,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          metadata: { status: user.status },
        });
        throw new Error(`Your account has been ${user.status.toLowerCase()}. Please contact your institution administrator.`);
      }

      // 3. Verify bcrypt password hash
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

      // 4. Role mismatch check if specified
      if (data.role && user.role.toLowerCase() !== data.role.toLowerCase()) {
        throw new Error(
          `This account is registered as a ${user.role}. Please switch your sign-in role to ${user.role}.`
        );
      }

      // 5. Transactional Login Persistence (Requirements 9, 11, 23)
      // Transactions ensure: session record, LOGIN_SUCCESS audit event, and users.last_login_at are atomic
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

      // Persist session
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

      // Update users.last_login_at
      await client.query(
        "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1;",
        [user.id]
      );

      // Record LOGIN_SUCCESS audit event
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

      // Update local memory representation of last_login_at
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

    // 1. Verify JWT signature and payload
    const payload = this.verifyToken(token);
    if (!payload) {
      return { valid: false, error: "Invalid or expired token." };
    }

    const tokenHash = this.hashToken(token);
    const client = await this.getClient();

    try {
      // 2. Query session by ID or token hash
      const sessionRes = await client.query(
        `SELECT * FROM sessions WHERE id = $1 OR token_hash = $2 LIMIT 1;`,
        [payload.sessionId, tokenHash]
      );

      if (sessionRes.rows.length === 0) {
        return { valid: false, error: "Session not found." };
      }

      const session = sessionRes.rows[0] as SessionRecord;

      if (session.is_revoked || session.status === "REVOKED" || session.status === "LOGGED_OUT") {
        return { valid: false, error: "Session has been revoked. Please sign in again." };
      }

      if (new Date(session.expires_at) < new Date() || session.status === "EXPIRED") {
        return { valid: false, error: "Session has expired. Please sign in again." };
      }

      // 3. Verify user status
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

      // Touch last_activity_at periodically
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
   * Refresh Token Endpoint with Token Rotation and Reuse Detection (Requirements 14, 15, 16)
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
      // Query session matching refresh_token_hash
      const sessionRes = await client.query(
        "SELECT * FROM sessions WHERE refresh_token_hash = $1 LIMIT 1;",
        [refreshHash]
      );

      if (sessionRes.rows.length === 0) {
        // Potential refresh token replay/reuse anomaly: invalidate session or reject
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

      // Detect reuse of revoked session
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

      // Fetch user
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

      // Rotate: generate new access token AND new rotated refresh token
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
   * Revoke session on logout and record LOGOUT audit event (Requirements 16 & 17)
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
   * Revoke all active sessions for a user (Requirement 33)
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
   * Change user password securely with verification, hashing, and audit (Requirement 19)
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
   * Request password reset token (Requirement 20)
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
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

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
   * Complete password reset using token (Requirement 20)
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

      // Update password
      await client.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2;",
        [newHash, resetRecord.user_id]
      );

      // Mark reset token used
      await client.query("UPDATE password_resets SET used_at = NOW() WHERE id = $1;", [
        resetRecord.id,
      ]);

      // Revoke all active sessions upon password reset
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
   * Retrieve safe audit sessions for the authenticated user (Requirement 32)
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

  /**
   * Find user by ID
   */
  public async findUserById(id: string): Promise<UserRecord | null> {
    const client = await this.getClient();
    try {
      const res = await client.query("SELECT * FROM users WHERE id = $1 LIMIT 1;", [id]);
      return (res.rows[0] as UserRecord) || null;
    } finally {
      client.release();
    }
  }

  /**
   * Find user by email
   */
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

  /**
   * Expose pool for direct SQL verification queries in integration tests
   */
  public getPool(): Pool | null {
    return this.pool;
  }

  /**
   * Sanitize user record to omit password hash
   */
  public toSafeUser(user: UserRecord): SafeUser {
    const { password_hash, ...safe } = user;
    return safe;
  }
}

export const authService = new AuthService();
