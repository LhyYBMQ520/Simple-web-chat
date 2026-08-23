import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ACCOUNT_DB_DIR, SESSION_DB_DIR } from '../config/constants.js';

const CHALLENGE_TTL = 2 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

interface ChallengeRecord {
  publicKey: string;
  challenge: string;
  expiresAt: number;
}

export interface AccountService {
  createChallenge(publicKey: string): { challengeId: string; challenge: string; accountId: string; created: boolean };
  verifyChallenge(publicKey: string, challengeId: string, signature: string): { accountId: string; sessionToken: string; expiresAt: number } | null;
  verifySession(token: string, accountId: string): boolean;
  getAccount(accountId: string): { id: string; displayName: string | null } | null;
  close(): void;
}

function ensureDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function base64Url(data: Buffer): string {
  return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function accountIdFor(publicKey: string): string {
  return `p_${crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 24)}`;
}

export function createAccountService(): AccountService {
  ensureDirectory(ACCOUNT_DB_DIR);
  ensureDirectory(SESSION_DB_DIR);
  const db = new Database(path.join(ACCOUNT_DB_DIR, 'accounts.db'));
  const sessionDB = new Database(path.join(SESSION_DB_DIR, 'account-sessions.db'));
  db.pragma('journal_mode = WAL');
  sessionDB.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      public_key TEXT UNIQUE NOT NULL,
      display_name TEXT,
      created_at INTEGER NOT NULL,
      last_login_at INTEGER NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0
    );
  `);
  sessionDB.exec(`CREATE TABLE IF NOT EXISTS account_sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );`);

  const challenges = new Map<string, ChallengeRecord>();

  function createChallenge(publicKey: string) {
    const existing = db.prepare('SELECT id FROM accounts WHERE public_key=? AND disabled=0').get(publicKey) as { id: string } | undefined;
    const accountId = existing?.id || accountIdFor(publicKey);
    const challengeId = base64Url(crypto.randomBytes(18));
    const challenge = base64Url(crypto.randomBytes(32));
    challenges.set(challengeId, { publicKey, challenge, expiresAt: Date.now() + CHALLENGE_TTL });
    return { challengeId, challenge, accountId, created: !existing };
  }

  function verifyChallenge(publicKey: string, challengeId: string, signature: string) {
    const record = challenges.get(challengeId);
    challenges.delete(challengeId);
    if (!record || record.publicKey !== publicKey || record.expiresAt < Date.now()) return null;

    try {
      const keyObject = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64url'), format: 'der', type: 'spki' });
      const verifier = crypto.createVerify('SHA256');
      verifier.update(Buffer.from(record.challenge, 'utf8'));
      verifier.end();
      if (!verifier.verify({ key: keyObject, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))) return null;
    } catch {
      return null;
    }

    const now = Date.now();
    const accountId = accountIdFor(publicKey);
    db.prepare(`INSERT INTO accounts (id, public_key, created_at, last_login_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(public_key) DO UPDATE SET last_login_at=excluded.last_login_at`).run(accountId, publicKey, now, now);
    const token = base64Url(crypto.randomBytes(32));
    const expiresAt = now + SESSION_TTL;
    sessionDB.prepare('INSERT INTO account_sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(crypto.createHash('sha256').update(token).digest('hex'), accountId, expiresAt, now);
    return { accountId, sessionToken: token, expiresAt };
  }

  function verifySession(token: string, accountId: string): boolean {
    if (!token || !accountId) return false;
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const row = sessionDB.prepare('SELECT expires_at FROM account_sessions WHERE token_hash=? AND account_id=?').get(hash, accountId) as { expires_at: number } | undefined;
    if (!row) return false;
    if (row.expires_at <= Date.now()) {
      sessionDB.prepare('DELETE FROM account_sessions WHERE token_hash=?').run(hash);
      return false;
    }
    return true;
  }

  function getAccount(accountId: string) {
    const row = db.prepare('SELECT id, display_name AS displayName FROM accounts WHERE id=? AND disabled=0').get(accountId) as { id: string; displayName: string | null } | undefined;
    return row || null;
  }

  const cleanupTimer = setInterval(() => {
    sessionDB.prepare('DELETE FROM account_sessions WHERE expires_at<=?').run(Date.now());
    for (const [id, record] of challenges) if (record.expiresAt <= Date.now()) challenges.delete(id);
  }, 60 * 1000);

  return { createChallenge, verifyChallenge, verifySession, getAccount, close: () => { clearInterval(cleanupTimer); db.close(); sessionDB.close(); } };
}
