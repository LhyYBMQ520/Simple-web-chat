import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ACCOUNT_CHAT_DB_DIR, ACCOUNT_DB_DIR, SESSION_DB_DIR } from '../config/constants.js';

const CHALLENGE_TTL = 2 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

interface ChallengeRecord {
  publicKey: string;
  challenge: string;
  expiresAt: number;
}

export interface ConversationRecord {
  peerId: string;
  remark: string | null;
  lastMessageTime: number | null;
  createdAt: number;
}

export interface AccountService {
  createChallenge(publicKey: string): { challengeId: string; challenge: string; accountId: string; created: boolean };
  verifyChallenge(publicKey: string, challengeId: string, signature: string): { accountId: string; sessionToken: string; expiresAt: number } | null;
  verifySession(token: string, accountId: string): boolean;
  getSessionAccountId(token: string): string | null;
  getAccount(accountId: string): { id: string; displayName: string | null } | null;
  updateDisplayName(accountId: string, displayName: string | null): boolean;
  getConversations(accountId: string): ConversationRecord[];
  upsertConversation(accountId: string, peerId: string, remark?: string | null, lastMessageTime?: number | null): boolean;
  deleteConversation(accountId: string, peerId: string): boolean;
  updateRemark(accountId: string, peerId: string, remark: string | null): boolean;
  migrateConversationsFromChatFiles(accountId: string): void;
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_conversations (
      account_id TEXT NOT NULL,
      peer_id TEXT NOT NULL,
      remark TEXT,
      last_message_time INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      PRIMARY KEY (account_id, peer_id)
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_account_conversations_account ON account_conversations(account_id, last_message_time DESC);`);
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
    migrateConversationsFromChatFiles(accountId);
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

  function getSessionAccountId(token: string): string | null {
    if (!token) return null;
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const row = sessionDB.prepare('SELECT account_id, expires_at FROM account_sessions WHERE token_hash=?').get(hash) as { account_id: string; expires_at: number } | undefined;
    if (!row || row.expires_at <= Date.now()) return null;
    return row.account_id;
  }

  function updateDisplayName(accountId: string, displayName: string | null): boolean {
    const value = displayName === null ? null : displayName.trim();
    if (value !== null && (value.length < 1 || value.length > 20)) return false;
    const result = db.prepare('UPDATE accounts SET display_name=? WHERE id=? AND disabled=0').run(value, accountId);
    return result.changes > 0;
  }

  function getConversations(accountId: string): ConversationRecord[] {
    const rows = db.prepare('SELECT peer_id AS peerId, remark, last_message_time AS lastMessageTime, created_at AS createdAt FROM account_conversations WHERE account_id=? ORDER BY last_message_time DESC, created_at DESC')
      .all(accountId) as ConversationRecord[];
    return rows;
  }

  function upsertConversation(accountId: string, peerId: string, remark?: string | null, lastMessageTime?: number | null): boolean {
    const existing = db.prepare('SELECT 1 FROM account_conversations WHERE account_id=? AND peer_id=?').get(accountId, peerId);
    const now = Date.now();
    if (existing) {
      const updates: string[] = [];
      const params: (string | number | null)[] = [];
      if (remark !== undefined) {
        updates.push('remark=?');
        params.push(remark === null ? null : remark.trim());
      }
      if (lastMessageTime !== undefined && Number.isFinite(lastMessageTime)) {
        updates.push('last_message_time=?');
        params.push(lastMessageTime);
      }
      if (updates.length === 0) return true;
      params.push(accountId, peerId);
      db.prepare(`UPDATE account_conversations SET ${updates.join(', ')} WHERE account_id=? AND peer_id=?`).run(...params);
    } else {
      db.prepare('INSERT INTO account_conversations (account_id, peer_id, remark, last_message_time, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(accountId, peerId, remark === null || remark === undefined ? null : remark.trim(), lastMessageTime ?? null, now);
    }
    return true;
  }

  function deleteConversation(accountId: string, peerId: string): boolean {
    const result = db.prepare('DELETE FROM account_conversations WHERE account_id=? AND peer_id=?').run(accountId, peerId);
    return result.changes > 0;
  }

  function updateRemark(accountId: string, peerId: string, remark: string | null): boolean {
    const value = remark === null ? null : remark.trim();
    if (value !== null && value.length > 20) return false;
    const existing = db.prepare('SELECT 1 FROM account_conversations WHERE account_id=? AND peer_id=?').get(accountId, peerId);
    if (existing) {
      db.prepare('UPDATE account_conversations SET remark=? WHERE account_id=? AND peer_id=?').run(value, accountId, peerId);
    } else {
      db.prepare('INSERT INTO account_conversations (account_id, peer_id, remark, last_message_time, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(accountId, peerId, value, null, Date.now());
    }
    return true;
  }

  function migrateConversationsFromChatFiles(accountId: string): void {
    const hasAny = db.prepare('SELECT 1 FROM account_conversations WHERE account_id=? LIMIT 1').get(accountId);
    if (hasAny) return;
    if (!fs.existsSync(ACCOUNT_CHAT_DB_DIR)) return;

    const now = Date.now();
    const insert = db.prepare('INSERT OR IGNORE INTO account_conversations (account_id, peer_id, remark, last_message_time, created_at) VALUES (?, ?, ?, ?, ?)');

    for (const file of fs.readdirSync(ACCOUNT_CHAT_DB_DIR)) {
      if (!file.endsWith('.db')) continue;
      const base = file.slice(0, -3);
      const parts = base.split(',');
      if (parts.length !== 2) continue;
      const [id1, id2] = parts;
      if (id1 === accountId) {
        insert.run(accountId, id2, null, null, now);
      } else if (id2 === accountId) {
        insert.run(accountId, id1, null, null, now);
      }
    }
  }

  const cleanupTimer = setInterval(() => {
    sessionDB.prepare('DELETE FROM account_sessions WHERE expires_at<=?').run(Date.now());
    for (const [id, record] of challenges) if (record.expiresAt <= Date.now()) challenges.delete(id);
  }, 60 * 1000);

  return {
    createChallenge,
    verifyChallenge,
    verifySession,
    getSessionAccountId,
    getAccount,
    updateDisplayName,
    getConversations,
    upsertConversation,
    deleteConversation,
    updateRemark,
    migrateConversationsFromChatFiles,
    close: () => { clearInterval(cleanupTimer); db.close(); sessionDB.close(); }
  };
}
