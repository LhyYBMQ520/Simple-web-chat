import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

function findProjectRoot(dir: string): string {
  let current = dir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dir;
}

const PROJECT_ROOT = findProjectRoot(__dirname);

export const UID_LIFETIME = 24 * 60 * 60 * 1000;
export const PORT = 21451;
export const DB_DIR = path.join(PROJECT_ROOT, 'db');
export const GUEST_CHAT_DB_DIR = path.join(DB_DIR, 'guest-chats');
export const ACCOUNT_CHAT_DB_DIR = path.join(DB_DIR, 'account-chats');
export const ACCOUNT_DB_DIR = path.join(DB_DIR, 'accounts');
export const SESSION_DB_DIR = path.join(DB_DIR, 'sessions');
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

export const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'r2';
export const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT || '';
export const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'chat-files';
export const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY || '';
export const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY || '';
export const STORAGE_PUBLIC_URL = process.env.STORAGE_PUBLIC_URL || '';
export const STORAGE_REGION = process.env.STORAGE_REGION || 'auto';
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);
export const UPLOAD_URL_EXPIRY = parseInt(process.env.UPLOAD_URL_EXPIRY || '300', 10);

export const TURN_SERVER_URLS = process.env.TURN_SERVER_URLS || '';
export const TURN_USERNAME = process.env.TURN_USERNAME || '';
export const TURN_CREDENTIAL = process.env.TURN_CREDENTIAL || '';
