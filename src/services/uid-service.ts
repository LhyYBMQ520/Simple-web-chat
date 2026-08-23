import { UID_LIFETIME } from '../config/constants.js';

export interface UIDRecord {
  createdAt: number;
  expiresAt: number;
}

export type UIDStatus = 'valid' | 'about_to_expire' | 'expired';

export interface UIDRegisterResult {
  valid: boolean;
  ttl: number;
  status: UIDStatus;
}

export interface UIDService {
  registerUID(uid: string): UIDRegisterResult;
  isUIDExpired(uid: string): boolean;
  getUIDInfo(uid: string): UIDRecord | null;
  cleanupExpiredUIDs(deleteAllSessionDBsForUID?: (uid: string) => void): void;
}

export function createUIDService(): UIDService {
  const uids = new Map<string, UIDRecord>();

  function registerUID(uid: string): UIDRegisterResult {
    const now = Date.now();

    if (!uids.has(uid)) {
      uids.set(uid, {
        createdAt: now,
        expiresAt: now + UID_LIFETIME
      });
    }

    const uidData = uids.get(uid)!;
    const ttl = uidData.expiresAt - now;

    if (ttl <= 0) {
      return { valid: false, ttl: 0, status: 'expired' };
    }

    if (ttl < 5 * 60 * 1000) {
      return { valid: true, ttl, status: 'about_to_expire' };
    }

    return { valid: true, ttl, status: 'valid' };
  }

  function isUIDExpired(uid: string): boolean {
    if (uid.startsWith('p_')) return false;
    if (!uids.has(uid)) return true;
    return uids.get(uid)!.expiresAt < Date.now();
  }

  function getUIDInfo(uid: string): UIDRecord | null {
    return uids.get(uid) || null;
  }

  function cleanupExpiredUIDs(deleteAllSessionDBsForUID?: (uid: string) => void): void {
    const now = Date.now();
    const expiredUIDs = Array.from(uids.entries())
      .filter(([, data]) => data.expiresAt < now)
      .map(([uid]) => uid);

    expiredUIDs.forEach(uid => {
      deleteAllSessionDBsForUID?.(uid);
      uids.delete(uid);
    });

    if (expiredUIDs.length > 0) {
      console.log('[清理] 删除过期 UID:', expiredUIDs);
    }
  }

  return {
    registerUID,
    isUIDExpired,
    getUIDInfo,
    cleanupExpiredUIDs
  };
}
