import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

import { PORT, PUBLIC_DIR, MAX_FILE_SIZE } from './src/config/constants.js';
import { getIceServers, hasTurnServers } from './src/config/webrtc-config.js';
import { createUIDService } from './src/services/uid-service.js';
import { createSessionDBService } from './src/services/session-db-service.js';
import { createStorageService } from './src/services/storage-service.js';
import { createAccountService } from './src/services/account-service.js';
import { createConnectionHandler, type ClientInfo } from './src/ws/connection-handler.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.json());

// 向前端注入服务端配置
// 注意：必须禁用缓存，否则浏览器可能使用旧的 TURN 配置
// 导致 RTCPeerConnection 仍然携带已删除的 TURN 服务器
app.get('/js/config.js', (_req, res) => {
  const iceServers = getIceServers();
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(
    `window.__CHAT_CONFIG__ = {` +
    `  maxFileSize: ${MAX_FILE_SIZE},` +
    `  webrtc: { iceServers: ${JSON.stringify(iceServers)}, turnConfigured: ${hasTurnServers()} }` +
    `};`
  );
});

app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use(express.static(PUBLIC_DIR));

const clients = new Map<string, ClientInfo>();
const uidService = createUIDService();
const dbService = createSessionDBService();
const storageService = createStorageService();
const accountService = createAccountService();

dbService.cleanupOrphanedDBFiles();

app.get('/api/download', async (req, res) => {
  const { key: fileKey, name: fileName } = req.query;

  if (!fileKey || typeof fileKey !== 'string') {
    res.status(400).json({ error: '缺少文件标识' });
    return;
  }

  if (!storageService.isConfigured()) {
    res.status(503).json({ error: '对象存储未配置' });
    return;
  }

  try {
    const safeName = typeof fileName === 'string' && fileName
      ? fileName
      : fileKey.split('/').pop() || 'download';
    const presignedUrl = await storageService.generateDownloadUrl(fileKey, safeName);
    res.redirect(307, presignedUrl);
  } catch (err) {
    console.error('[下载签名] 失败:', (err as Error).message);
    res.status(500).json({ error: '生成下载链接失败' });
  }
});

app.post('/api/account/challenge', (req, res) => {
  const publicKey = typeof req.body?.publicKey === 'string' ? req.body.publicKey : '';
  if (!/^[A-Za-z0-9_-]{80,1200}$/.test(publicKey)) {
    res.status(400).json({ error: '公钥格式无效' });
    return;
  }
  res.json(accountService.createChallenge(publicKey));
});

app.post('/api/account/verify', (req, res) => {
  const publicKey = typeof req.body?.publicKey === 'string' ? req.body.publicKey : '';
  const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
  const signature = typeof req.body?.signature === 'string' ? req.body.signature : '';
  if (!publicKey || !challengeId || !signature) {
    res.status(400).json({ error: '认证参数不完整' });
    return;
  }
  const result = accountService.verifyChallenge(publicKey, challengeId, signature);
  if (!result) {
    res.status(401).json({ error: '账号签名验证失败' });
    return;
  }
  res.json({ success: true, ...result });
});

app.post('/api/upload/presign', async (req, res) => {
  try {
    if (!storageService.isConfigured()) {
      res.status(503).json({ error: '对象存储未配置，请检查 .env 文件中的 R2 凭据' });
      return;
    }

    const { fileName, contentType, fileSize } = req.body;
    if (!fileName || !contentType) {
      res.status(400).json({ error: '缺少 fileName 或 contentType' });
      return;
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      const limitMB = (MAX_FILE_SIZE / 1048576).toFixed(0);
      const fileMB = (fileSize / 1048576).toFixed(2);
      res.status(413).json({ error: `文件大小 ${fileMB}MB 超出限制 ${limitMB}MB` });
      return;
    }

    // 仅拒绝空类型和 HTML 注入风险类型，其余全部放行
    if (!contentType || contentType.includes('text/html')) {
      res.status(400).json({ error: `不支持的文件类型: ${contentType || '未知'}` });
      return;
    }

    console.log(`[上传预签名] 请求: fileName=${fileName} contentType=${contentType}`);
    const result = await storageService.generateUploadUrl(fileName, contentType);
    console.log(`[上传预签名] 成功: fileKey=${result.fileKey}`);
    console.log(`[上传预签名] uploadUrl(前120字): ${result.uploadUrl.substring(0, 120)}...`);
    console.log(`[上传预签名] publicUrl: ${result.publicUrl}`);
    res.json(result);
  } catch (err) {
    const message = (err as Error).message || String(err);
    console.error('[上传预签名] 失败:', message);
    res.status(500).json({ error: `生成上传凭证失败: ${message}` });
  }
});

function broadcastOnline(): void {
  const onlineList = Array.from(clients.keys());

  const data = JSON.stringify({
    type: 'online',
    list: onlineList
  });

  clients.forEach(clientInfo => {
    if (clientInfo.ws.readyState === WebSocket.OPEN) {
      clientInfo.ws.send(data);
    }
  });
}

wss.on('connection', createConnectionHandler({
  clients,
  broadcastOnline,
  uidService,
  dbService,
  storageService,
  accountService
}));

const cleanupTimer = setInterval(() => {
  uidService.cleanupExpiredUIDs((uid) => {
    dbService.deleteAllSessionDBsForUID(uid);
  });
}, 1 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`运行在 http://localhost:${PORT}`);
  console.log(`[存储配置] provider=${process.env.STORAGE_PROVIDER || '未设置'}`);
  console.log(`[存储配置] endpoint=${process.env.STORAGE_ENDPOINT || '未设置'}`);
  console.log(`[存储配置] bucket=${process.env.STORAGE_BUCKET || '未设置'}`);
  console.log(`[存储配置] publicUrl=${process.env.STORAGE_PUBLIC_URL || '未设置'}`);
  console.log(`[存储配置] 状态=${storageService.isConfigured() ? '已就绪' : '未配置（文件传输不可用）'}`);

  const iceServers = getIceServers();
  const hasTurn = hasTurnServers();
  console.log(`[WebRTC] STUN 服务器: ${iceServers.filter(s => !('username' in s)).length} 个`);
  console.log(`[WebRTC] TURN 服务器: ${hasTurn ? '已配置' : '未配置（仅 STUN 直连）'}`);
});

function closeResources(): void {
  clearInterval(cleanupTimer);
  dbService.closeAllSessionDBs();
  accountService.close();
}

process.on('exit', () => {
  closeResources();
});

process.on('SIGINT', () => {
  console.log('\n[关闭] 收到中断信号，正在关闭数据库连接...');
  closeResources();
  process.exit(0);
});
