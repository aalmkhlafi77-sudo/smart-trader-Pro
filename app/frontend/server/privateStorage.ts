import type { Express, Request, Response } from "express";
import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";

const pbkdf2Async = promisify(pbkdf2);
const SESSION_COOKIE = "smart_trader_private";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 600_000;
const PASSWORD_BYTES = 32;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

type SessionRecord = {
  userId: string;
  username: string;
  csrfToken: string;
  expiresAt: Date;
};

let pool: Pool | null = null;
let ready = false;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function env(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function databaseConfig() {
  const host = env("MYSQL_HOST", "DB_HOST");
  const user = env("MYSQL_USER", "DB_USER");
  const password = env("MYSQL_PASSWORD", "DB_PASSWORD");
  const database = env("MYSQL_DATABASE", "DB_NAME");
  const port = Number(env("MYSQL_PORT", "DB_PORT") || "3306");
  if (!host || !user || !database) return null;
  return { host, user, password, database, port };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function hashPassword(password: string, saltHex: string) {
  const derived = await pbkdf2Async(
    password,
    Buffer.from(saltHex, "hex"),
    PASSWORD_ITERATIONS,
    PASSWORD_BYTES,
    "sha256"
  );
  return Buffer.from(derived).toString("hex");
}

function safeEqualHex(left: string, right: string) {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function parseCookies(req: Request) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(
    raw
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf("=");
        return index === -1
          ? [decodeURIComponent(part), ""]
          : [
              decodeURIComponent(part.slice(0, index)),
              decodeURIComponent(part.slice(index + 1)),
            ];
      })
  );
}

function setSessionCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res: Response) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS smart_trader_private_users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(120) NOT NULL UNIQUE,
      password_salt CHAR(64) NOT NULL,
      password_hash CHAR(64) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS smart_trader_private_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      csrf_token CHAR(64) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      INDEX idx_private_sessions_user (user_id),
      INDEX idx_private_sessions_expiry (expires_at),
      CONSTRAINT fk_private_session_user
        FOREIGN KEY (user_id) REFERENCES smart_trader_private_users(id)
        ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS smart_trader_private_snapshots (
      owner_id VARCHAR(64) PRIMARY KEY,
      revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
      payload LONGTEXT NULL,
      updated_at DATETIME(3) NOT NULL,
      CONSTRAINT fk_private_snapshot_user
        FOREIGN KEY (owner_id) REFERENCES smart_trader_private_users(id)
        ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(
    "DELETE FROM smart_trader_private_sessions WHERE expires_at <= UTC_TIMESTAMP(3)"
  );
}

async function bootstrapAdmin() {
  if (!pool) return;
  const username = env("PRIVATE_ADMIN_USERNAME");
  const password = env("PRIVATE_ADMIN_PASSWORD");
  if (!username || !password) return;

  const [existing] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM smart_trader_private_users WHERE username = ? LIMIT 1",
    [username]
  );
  if (existing.length) return;

  const id = randomBytes(16).toString("hex");
  const salt = randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(password, salt);
  const now = new Date();
  await pool.execute(
    `INSERT INTO smart_trader_private_users
      (id, username, password_salt, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [id, username, salt, passwordHash, now, now]
  );
  await pool.execute(
    `INSERT INTO smart_trader_private_snapshots
      (owner_id, revision, payload, updated_at) VALUES (?, 0, NULL, ?)`,
    [id, now]
  );
  console.log("[private-storage] private admin account initialized");
}

export async function initializePrivateStorage() {
  const config = databaseConfig();
  if (!config) {
    console.warn("[private-storage] MySQL environment is not configured; local mode remains available.");
    ready = false;
    return;
  }
  try {
    pool = createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      charset: "utf8mb4",
    });
    await pool.query("SELECT 1");
    await ensureSchema();
    await bootstrapAdmin();
    ready = true;
    console.log("[private-storage] MySQL private storage is ready");
  } catch (error) {
    ready = false;
    pool = null;
    console.error("[private-storage] initialization failed", error);
  }
}

async function sessionFromRequest(req: Request): Promise<SessionRecord | null> {
  if (!ready || !pool) return null;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = sha256(token);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.user_id, s.csrf_token, s.expires_at, u.username
       FROM smart_trader_private_sessions s
       JOIN smart_trader_private_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)
      LIMIT 1`,
    [tokenHash]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    userId: String(row.user_id),
    username: String(row.username),
    csrfToken: String(row.csrf_token),
    expiresAt: new Date(row.expires_at),
  };
}

function loginKey(req: Request, username: string) {
  return `${req.ip || "unknown"}:${username.toLowerCase()}`;
}

function loginAllowed(key: string) {
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || state.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  return state.count < LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(key: string) {
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || state.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  state.count += 1;
}

async function snapshotMeta(userId: string) {
  if (!pool) return { revision: 0, hasSnapshot: false, updatedAt: null };
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT revision, payload IS NOT NULL AS has_snapshot, updated_at FROM smart_trader_private_snapshots WHERE owner_id = ? LIMIT 1",
    [userId]
  );
  const row = rows[0];
  return {
    revision: Number(row?.revision || 0),
    hasSnapshot: Boolean(row?.has_snapshot),
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export function registerPrivateStorageRoutes(app: Express) {
  app.get("/api/private/status", async (req, res) => {
    if (!ready || !pool) {
      res.json({ databaseReady: false, authenticated: false });
      return;
    }
    const session = await sessionFromRequest(req);
    if (!session) {
      res.json({ databaseReady: true, authenticated: false });
      return;
    }
    const meta = await snapshotMeta(session.userId);
    res.json({
      databaseReady: true,
      authenticated: true,
      username: session.username,
      csrfToken: session.csrfToken,
      ...meta,
    });
  });

  app.post("/api/private/login", async (req, res) => {
    if (!ready || !pool) {
      res.status(503).json({ error: "PRIVATE_STORAGE_NOT_READY" });
      return;
    }
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || username.length > 120 || password.length < 8 || password.length > 256) {
      res.status(400).json({ error: "INVALID_CREDENTIALS" });
      return;
    }
    const key = loginKey(req, username);
    if (!loginAllowed(key)) {
      res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });
      return;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, username, password_salt, password_hash FROM smart_trader_private_users WHERE username = ? LIMIT 1",
      [username]
    );
    const user = rows[0];
    if (!user) {
      recordLoginFailure(key);
      res.status(401).json({ error: "INVALID_CREDENTIALS" });
      return;
    }
    const candidate = await hashPassword(password, String(user.password_salt));
    if (!safeEqualHex(candidate, String(user.password_hash))) {
      recordLoginFailure(key);
      res.status(401).json({ error: "INVALID_CREDENTIALS" });
      return;
    }

    loginAttempts.delete(key);
    const token = randomBytes(32).toString("hex");
    const csrfToken = randomBytes(32).toString("hex");
    const tokenHash = sha256(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await pool.execute(
      `INSERT INTO smart_trader_private_sessions
        (token_hash, user_id, csrf_token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      [tokenHash, String(user.id), csrfToken, expiresAt, now]
    );
    setSessionCookie(res, token);
    const meta = await snapshotMeta(String(user.id));
    res.json({
      authenticated: true,
      username: String(user.username),
      csrfToken,
      ...meta,
    });
  });

  app.post("/api/private/logout", async (req, res) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token && pool) {
      await pool.execute(
        "DELETE FROM smart_trader_private_sessions WHERE token_hash = ?",
        [sha256(token)]
      );
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/private/account", async (req, res) => {
    const session = await sessionFromRequest(req);
    if (!session || !pool) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    if (req.get("x-csrf-token") !== session.csrfToken) {
      res.status(403).json({ error: "CSRF" });
      return;
    }

    const currentPassword = String(req.body?.currentPassword || "");
    const nextUsername = String(req.body?.username || "").trim();
    const nextPassword = String(req.body?.password || "");

    if (!currentPassword || (!nextUsername && !nextPassword)) {
      res.status(400).json({ error: "INVALID_ACCOUNT_UPDATE" });
      return;
    }
    if (nextUsername && nextUsername.length > 120) {
      res.status(400).json({ error: "INVALID_USERNAME" });
      return;
    }
    if (nextPassword && (nextPassword.length < 8 || nextPassword.length > 256)) {
      res.status(400).json({ error: "INVALID_PASSWORD" });
      return;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT username, password_salt, password_hash FROM smart_trader_private_users WHERE id = ? LIMIT 1",
      [session.userId]
    );
    const user = rows[0];
    if (!user) {
      res.status(404).json({ error: "ACCOUNT_NOT_FOUND" });
      return;
    }

    const currentHash = await hashPassword(currentPassword, String(user.password_salt));
    if (!safeEqualHex(currentHash, String(user.password_hash))) {
      res.status(401).json({ error: "CURRENT_PASSWORD_INCORRECT" });
      return;
    }

    let username = String(user.username);
    let salt = String(user.password_salt);
    let passwordHash = String(user.password_hash);

    if (nextUsername) username = nextUsername;
    if (nextPassword) {
      salt = randomBytes(32).toString("hex");
      passwordHash = await hashPassword(nextPassword, salt);
    }

    try {
      await pool.execute(
        `UPDATE smart_trader_private_users
            SET username = ?, password_salt = ?, password_hash = ?, updated_at = ?
          WHERE id = ?`,
        [username, salt, passwordHash, new Date(), session.userId]
      );
    } catch (error) {
      const code = String((error as { code?: string })?.code || "");
      if (code === "ER_DUP_ENTRY") {
        res.status(409).json({ error: "USERNAME_EXISTS" });
        return;
      }
      throw error;
    }

    await pool.execute(
      "DELETE FROM smart_trader_private_sessions WHERE user_id = ?",
      [session.userId]
    );
    clearSessionCookie(res);
    res.json({ ok: true, username });
  });

  app.get("/api/private/snapshot", async (req, res) => {
    const session = await sessionFromRequest(req);
    if (!session || !pool) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT revision, payload, updated_at FROM smart_trader_private_snapshots WHERE owner_id = ? LIMIT 1",
      [session.userId]
    );
    const row = rows[0];
    res.json({
      revision: Number(row?.revision || 0),
      payload: row?.payload ? JSON.parse(String(row.payload)) : null,
      updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    });
  });

  app.put("/api/private/snapshot", async (req, res) => {
    const session = await sessionFromRequest(req);
    if (!session || !pool) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    if (req.get("x-csrf-token") !== session.csrfToken) {
      res.status(403).json({ error: "CSRF" });
      return;
    }
    const expectedRevision = Number(req.body?.expectedRevision);
    const payload = req.body?.payload;
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0 || !payload) {
      res.status(400).json({ error: "INVALID_SNAPSHOT" });
      return;
    }
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, "utf8") > 32 * 1024 * 1024) {
      res.status(413).json({ error: "SNAPSHOT_TOO_LARGE" });
      return;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT revision FROM smart_trader_private_snapshots WHERE owner_id = ? FOR UPDATE",
        [session.userId]
      );
      const currentRevision = Number(rows[0]?.revision || 0);
      if (currentRevision !== expectedRevision) {
        await connection.rollback();
        res.status(409).json({ error: "REVISION_CONFLICT", revision: currentRevision });
        return;
      }
      const nextRevision = currentRevision + 1;
      await connection.execute(
        "UPDATE smart_trader_private_snapshots SET revision = ?, payload = ?, updated_at = ? WHERE owner_id = ?",
        [nextRevision, serialized, new Date(), session.userId]
      );
      await connection.commit();
      res.json({ revision: nextRevision, updatedAt: new Date().toISOString() });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
