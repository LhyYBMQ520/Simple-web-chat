import fs from 'node:fs';
import path from 'node:path';

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
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
