const { UID_LIFETIME } = require('../config/constants');

function createUIDService() {
  const uids = new Map();

  function registerUID(uid) {
    const now = Date.now();

    if (!uids.has(uid)) {
      uids.set(uid, {
        createdAt: now,
        expiresAt: now + UID_LIFETIME
      });
    }

    const uidData = uids.get(uid);
    const ttl = uidData.expiresAt - now;

    if (ttl <= 0) {
      return { valid: false, ttl: 0, status: 'expired' };
    }

    if (ttl < 5 * 60 * 1000) {
      return { valid: true, ttl, status: 'about_to_expire' };
    }

    return { valid: true, ttl, status: 'valid' };
  }

  function isUIDExpired(uid) {
    if (!uids.has(uid)) return true;
    return uids.get(uid).expiresAt < Date.now();
  }

  function getUIDInfo(uid) {
    return uids.get(uid) || null;
  }

  function cleanupExpiredUIDs(deleteAllSessionDBsForUID) {
    const now = Date.now();
    const expiredUIDs = Array.from(uids.entries())
      .filter(([, data]) => data.expiresAt < now)
      .map(([uid]) => uid);

    expiredUIDs.forEach(uid => {
      if (typeof deleteAllSessionDBsForUID === 'function') {
        deleteAllSessionDBsForUID(uid);
      }
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

module.exports = {
  createUIDService
};
