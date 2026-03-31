// 引入依赖模块
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

// ========== UID 生命周期管理 ==========
const UID_LIFETIME = 24 * 60 * 60 * 1000; // 24小时
const DB_DIR = path.join(__dirname, 'db');
const uids = new Map(); // 存储 UID 的创建时间和过期时间: {uid: {createdAt, expiresAt}}

// 确保 /db 目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('[初始化] 创建数据库目录:', DB_DIR);
}

/**
 * 注册或更新 UID，返回过期状态
 * @returns {Object} {valid: boolean, ttl: number, status: 'valid'|'expired'|'about_to_expire'}
 */
function registerUID(uid) {
  const now = Date.now();
  
  if (!uids.has(uid)) {
    // 首次注册
    uids.set(uid, {
      createdAt: now,
      expiresAt: now + UID_LIFETIME
    });
  }
  
  const uidData = uids.get(uid);
  const ttl = uidData.expiresAt - now;
  
  // 判断过期状态
  if (ttl <= 0) {
    return { valid: false, ttl: 0, status: 'expired' };
  } else if (ttl < 5 * 60 * 1000) { // 剩余时间少于5分钟
    return { valid: true, ttl, status: 'about_to_expire' };
  } else {
    return { valid: true, ttl, status: 'valid' };
  }
}

/**
 * 检查 UID 是否已过期
 */
function isUIDExpired(uid) {
  if (!uids.has(uid)) return true;
  return uids.get(uid).expiresAt < Date.now();
}

/**
 * 清理过期 UID 的数据库文件
 */
function cleanupExpiredUIDs() {
  const expiredUIDs = Array.from(uids.entries())
    .filter(([uid, data]) => data.expiresAt < Date.now())
    .map(([uid]) => uid);

  expiredUIDs.forEach(uid => {
    // 删除该 UID 的所有会话数据库
    deleteAllSessionDBsForUID(uid);
    uids.delete(uid);
  });

  if (expiredUIDs.length > 0) {
    console.log('[清理] 删除过期 UID:', expiredUIDs);
  }
}

/**
 * 删除该 UID 的所有相关数据库文件
 */
function deleteAllSessionDBsForUID(targetUID) {
  if (!fs.existsSync(DB_DIR)) {
    console.log('[清理] db 目录不存在');
    return;
  }
  
  const files = fs.readdirSync(DB_DIR);
  console.log(`[清理] 开始清理 UID: ${targetUID} 的数据库, 当前 db 目录有 ${files.length} 个文件`);
  
  files.forEach(file => {
    if (!file.endsWith('.db')) return;
    
    // 数据库文件格式: uid1,uid2.db (使用逗号分隔)
    const fileName = file.replace('.db', '');
    const [uid1, uid2] = fileName.split(',');
    
    // 检查 targetUID 是否在这个会话中
    if (uid1 === targetUID || uid2 === targetUID) {
      console.log(`[清理] 找到需要删除的数据库文件: ${file}`);
      
      // ⭐ 关键：删除前先关闭数据库连接
      closeSessionDB(uid1, uid2);
      
      const filePath = path.join(DB_DIR, file);
      
      // 立即尝试删除，如果失败则多次重试
      const tryDelete = (attempts = 5, delay = 100) => {
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
            console.log('[清理] ✅ 删除会话数据库:', file);
          } catch (err) {
            // ENOENT 表示文件已经不存在，无需继续重试
            if (err.code === 'ENOENT') {
              console.log('[清理] ℹ️ 文件已被清理:', file);
              return;
            }
            
            if (attempts > 1 && err.code === 'EBUSY') {
              // 文件仍被占用，继续重试
              console.log(`[清理] ⏳ 数据库被占用，${delay}ms 后重试... (${attempts-1} 次尝试剩余) - ${file}`);
              tryDelete(attempts - 1, delay * 2);
            } else if (attempts > 1) {
              // 其他错误也重试
              console.log(`[清理] ⏳ 删除失败 (${err.code}), ${delay}ms 后重试... (${attempts-1} 次尝试剩余)`);
              tryDelete(attempts - 1, delay * 2);
            } else {
              // 最后一次重试仍失败
              console.error('[清理] ❌ 删除数据库失败:', file, err.message);
            }
          }
        }, delay);
      };
      
      tryDelete();
    }
  });
}

/**
 * 获取会话数据库文件路径
 * @param {string} uid1 
 * @param {string} uid2 
 * @returns {string} 数据库文件路径
 */
function getSessionDBPath(uid1, uid2) {
  // 排序 UID，避免重复
  const [smaller, larger] = [uid1, uid2].sort();
  return path.join(DB_DIR, `${smaller},${larger}.db`);
}

// 数据库连接缓存，避免重复打开
const sessionDBCache = new Map();

/**
 * 获取或创建会话数据库（缓存连接）
 */
function getSessionDB(uid1, uid2) {
  const dbPath = getSessionDBPath(uid1, uid2);
  const key = dbPath;
  
  // 如果缓存中已有该连接，直接返回
  if (sessionDBCache.has(key)) {
    return sessionDBCache.get(key);
  }
  
  // 创建新连接
  const db = new Database(dbPath);
  
  // 创建表（如果不存在）
  db.exec(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT, receiver TEXT, content TEXT, time INTEGER
  )`);
  
  // 缓存连接
  sessionDBCache.set(key, db);
  
  return db;
}

/**
 * 关闭并移除缓存中的数据库连接
 */
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

// 定时清理过期UID（每1分钟执行一次）
setInterval(() => {
  cleanupExpiredUIDs();
}, 1 * 60 * 1000);

// 服务
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map(); // {uid -> {ws, status}}

function broadcastOnline() {
  const onlineList = Array.from(clients.keys());

  const data = JSON.stringify({
    type: 'online',
    list: onlineList
  });

  clients.forEach(clientInfo => {
    clientInfo.ws.send(data);
  });
}

wss.on('connection', (ws, req) => {
  let uid;

  // 获取 IP（兼容代理）
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress;

  console.log(`[连接建立] IP: ${ip}`);

  ws.on('message', data => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'bind') {
        uid = msg.uid;
        
        // 注册 UID 并检查过期状态
        const uidStatus = registerUID(uid);
        
        if (!uidStatus.valid) {
          // UID 已过期，拒绝连接
          ws.send(JSON.stringify({ 
            type: 'bindResult', 
            success: false, 
            reason: 'uid_expired',
            message: '您的 UID 已过期，请刷新页面生成新的 UID'
          }));
          console.log(`[绑定失败] UID: ${uid} 已过期 | IP: ${ip}`);
          return;
        }
        
        // 保存客户端连接信息
        clients.set(uid, {
          ws,
          status: uidStatus.status,
          expiresAt: uids.get(uid).expiresAt
        });

        ws.send(JSON.stringify({ 
          type: 'bindResult', 
          success: true, 
          ttl: uidStatus.ttl,
          status: uidStatus.status
        }));

        console.log(`[绑定成功] UID: ${uid} | 状态: ${uidStatus.status} | 剩余: ${Math.floor(uidStatus.ttl / 1000)}秒 | IP: ${ip}`);

        broadcastOnline();
      }

      if (msg.type === 'request') {
        // 检查当前 UID 是否还有效
        if (isUIDExpired(uid)) {
          ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
          return;
        }

        console.log(`[请求连接] ${uid} -> ${msg.to}`);
        const target = clients.get(msg.to);
        
        // 检查目标 UID 是否还有效
        if (target && !isUIDExpired(msg.to)) {
          target.ws.send(JSON.stringify({ type: 'request', from: uid }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: '对方 UID 已过期或离线' }));
        }
      }

      if (msg.type === 'accept') {
        // 检查当前 UID 是否还有效
        if (isUIDExpired(uid)) {
          ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
          return;
        }

        console.log(`[同意连接] ${uid} <-> ${msg.from}`);
        const target = clients.get(msg.from);
        
        if (target && !isUIDExpired(msg.from)) {
          target.ws.send(JSON.stringify({ type: 'accepted', from: uid }));
        }
        ws.send(JSON.stringify({ type: 'accepted', from: msg.from }));
      }

      // 获取历史消息
      if (msg.type === 'getHistory') {
        if (isUIDExpired(uid)) {
          ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
          return;
        }

        // 获取会话数据库
        const sessionDB = getSessionDB(uid, msg.with);
        const history = sessionDB.prepare("SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY time ASC");
        const list = history.all(uid, msg.with, msg.with, uid);
        
        ws.send(JSON.stringify({type:"history", list}));
      }

      if (msg.type === 'message') {
        // 检查当前 UID 是否还有效
        if (isUIDExpired(uid)) {
          ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期，无法发送消息' }));
          return;
        }

        console.log(`[消息] ${uid} -> ${msg.to} : ${msg.content}`);

        const target = clients.get(msg.to);
        if (target && !isUIDExpired(msg.to)) {
          target.ws.send(JSON.stringify({ type: 'msg', from: uid, content: msg.content }));
        }

        // 保存到会话数据库
        const sessionDB = getSessionDB(uid, msg.to);
        const insert = sessionDB.prepare("INSERT INTO messages (sender,receiver,content,time) VALUES (?,?,?,?)");
        insert.run(uid, msg.to, msg.content, Date.now());
      }
    } catch (e) { 
      console.error('[错误]', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[连接断开] UID: ${uid || '未绑定'} | IP: ${ip}`);

    // 只有当这个ws还是当前绑定的连接才删除（防止旧连接删除新连接）
    if (uid && clients.get(uid)?.ws === ws) {
      clients.delete(uid);
      broadcastOnline();
    }
  });
});

server.listen(21451, () => console.log("运行在 http://localhost:21451"));

// ========== 程序退出时关闭所有数据库连接 ==========
process.on('exit', () => {
  sessionDBCache.forEach((db, key) => {
    try {
      db.close();
    } catch (err) {
      console.error('[警告] 退出时关闭数据库失败:', key, err.message);
    }
  });
  sessionDBCache.clear();
});

process.on('SIGINT', () => {
  console.log('\n[关闭] 收到中断信号，正在关闭数据库连接...');
  sessionDBCache.forEach((db, key) => {
    try {
      db.close();
    } catch (err) {
      console.error('[警告] 关闭数据库失败:', key, err.message);
    }
  });
  sessionDBCache.clear();
  process.exit(0);
});
