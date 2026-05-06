const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const { DB_DIR, UID_LIFETIME } = require('../config/constants');

function createSessionDBService() {
  const sessionDBCache = new Map();

  function ensureDBDirExists() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      console.log('[初始化] 创建数据库目录:', DB_DIR);
    }
  }

  function getSessionDBPath(uid1, uid2) {
    const [smaller, larger] = [uid1, uid2].sort();
    return path.join(DB_DIR, `${smaller},${larger}.db`);
  }

  function getSessionDB(uid1, uid2) {
    const dbPath = getSessionDBPath(uid1, uid2);
    const key = dbPath;

    if (sessionDBCache.has(key)) {
      return sessionDBCache.get(key);
    }

    const db = new Database(dbPath);

    db.exec(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT,
      receiver TEXT,
      content TEXT,
      time INTEGER,
      status TEXT DEFAULT 'normal',
      edited_at INTEGER,
      read_at INTEGER
    )`);

    const columns = db.prepare('PRAGMA table_info(messages)').all().map(col => col.name);
    if (!columns.includes('status')) {
      db.exec("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'normal'");
    }
    if (!columns.includes('edited_at')) {
      db.exec('ALTER TABLE messages ADD COLUMN edited_at INTEGER');
    }
    if (!columns.includes('read_at')) {
      db.exec('ALTER TABLE messages ADD COLUMN read_at INTEGER');
    }

    sessionDBCache.set(key, db);
    return db;
  }

  function closeSessionDB(uid1, uid2) {
    const dbPath = getSessionDBPath(uid1, uid2);
    const key = dbPath;

    if (sessionDBCache.has(key)) {
      try {
        const db = sessionDBCache.get(key);
        db.close();
        sessionDBCache.delete(key);
      } catch (err) {
        console.error('[警告] 关闭数据库失败:', err.message);
      }
    }
  }

  function closeAllSessionDBs() {
    sessionDBCache.forEach((db, key) => {
      try {
        db.close();
      } catch (err) {
        console.error('[警告] 关闭数据库失败:', key, err.message);
      }
    });
    sessionDBCache.clear();
  }

  function deleteAllSessionDBsForUID(targetUID) {
    if (!fs.existsSync(DB_DIR)) {
      console.log('[清理] db 目录不存在');
      return;
    }

    const files = fs.readdirSync(DB_DIR);
    console.log(`[清理] 开始清理 UID: ${targetUID} 的数据库, 当前 db 目录有 ${files.length} 个文件`);

    files.forEach(file => {
      if (!file.endsWith('.db')) return;

      const fileName = file.replace('.db', '');
      const [uid1, uid2] = fileName.split(',');

      if (uid1 === targetUID || uid2 === targetUID) {
        console.log(`[清理] 找到需要删除的数据库文件: ${file}`);
        closeSessionDB(uid1, uid2);

        const filePath = path.join(DB_DIR, file);

        const tryDelete = (attempts = 5, delay = 100) => {
          setTimeout(() => {
            try {
              fs.unlinkSync(filePath);
              console.log('[清理] 删除会话数据库:', file);
            } catch (err) {
              if (err.code === 'ENOENT') {
                console.log('[清理] 文件已被清理:', file);
                return;
              }

              if (attempts > 1 && err.code === 'EBUSY') {
                console.log(`[清理] 数据库被占用，${delay}ms 后重试... (${attempts - 1} 次尝试剩余) - ${file}`);
                tryDelete(attempts - 1, delay * 2);
              } else if (attempts > 1) {
                console.log(`[清理] 删除失败 (${err.code}), ${delay}ms 后重试... (${attempts - 1} 次尝试剩余)`);
                tryDelete(attempts - 1, delay * 2);
              } else {
                console.error('[清理] 删除数据库失败:', file, err.message);
              }
            }
          }, delay);
        };

        tryDelete();
      }
    });
  }

  function toMessagePayload(row) {
    return {
      id: row.id,
      sender: row.sender,
      receiver: row.receiver,
      content: row.content,
      time: row.time,
      status: row.status || 'normal',
      editedAt: row.edited_at || null,
      readAt: row.read_at || null
    };
  }

  function updateMessagesReadState(sessionDB, readerUid, peerUid) {
    const unreadRows = sessionDB.prepare(
      "SELECT id FROM messages WHERE sender=? AND receiver=? AND read_at IS NULL AND (status IS NULL OR status != 'recalled')"
    ).all(peerUid, readerUid);

    if (unreadRows.length === 0) {
      return [];
    }

    const now = Date.now();
    const ids = unreadRows.map(row => row.id);
    const placeholders = ids.map(() => '?').join(',');

    sessionDB.prepare(`UPDATE messages SET read_at=? WHERE id IN (${placeholders})`).run(now, ...ids);

    const updatedRows = sessionDB.prepare(
      `SELECT * FROM messages WHERE id IN (${placeholders}) ORDER BY time ASC`
    ).all(...ids);

    console.log(`[消息已读] ${readerUid} 已读来自 ${peerUid} 的 ${ids.length} 条消息`);

    return updatedRows.map(toMessagePayload);
  }

  function getConversationMessage(sessionDB, messageId, uid1, uid2) {
    const stmt = sessionDB.prepare(
      'SELECT * FROM messages WHERE id=? AND ((sender=? AND receiver=?) OR (sender=? AND receiver=?))'
    );
    return stmt.get(messageId, uid1, uid2, uid2, uid1);
  }

  function previewContent(content, maxLength = 36) {
    const text = String(content || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength)}...`;
  }

  function cleanupOrphanedDBFiles() {
    if (!fs.existsSync(DB_DIR)) return;

    const files = fs.readdirSync(DB_DIR);
    const now = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
      if (!file.endsWith('.db')) return;

      const filePath = path.join(DB_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        const fileAgeMs = stat.birthtimeMs || stat.ctimeMs;

        if (now - fileAgeMs > UID_LIFETIME) {
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log('[启动清理] 删除过期数据库:', file);
          } catch (err) {
            if (err.code !== 'ENOENT') {
              console.error('[启动清理] 删除失败:', file, err.message);
            }
          }
        }
      } catch (err) {
        console.error('[启动清理] 检查文件失败:', file, err.message);
      }
    });

    if (deletedCount > 0) {
      console.log(`[启动清理] 共清理 ${deletedCount} 个过期数据库文件`);
    }
  }

  ensureDBDirExists();

  return {
    getSessionDB,
    closeSessionDB,
    closeAllSessionDBs,
    deleteAllSessionDBsForUID,
    cleanupOrphanedDBFiles,
    toMessagePayload,
    updateMessagesReadState,
    getConversationMessage,
    previewContent
  };
}

module.exports = {
  createSessionDBService
};
