import express from 'express';
import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

import { PORT, PUBLIC_DIR, MAX_FILE_SIZE } from './src/config/constants.js';
import { createUIDService } from './src/services/uid-service.js';
import { createSessionDBService } from './src/services/session-db-service.js';
import { createStorageService } from './src/services/storage-service.js';
import { createConnectionHandler, type ClientInfo } from './src/ws/connection-handler.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.json());

// 向前端注入服务端配置
app.get('/js/config.js', (_req, res) => {
  res.type('application/javascript');
  res.send(`window.__CHAT_CONFIG__ = { maxFileSize: ${MAX_FILE_SIZE} };`);
});

app.use(express.static(PUBLIC_DIR));

const clients = new Map<string, ClientInfo>();
const uidService = createUIDService();
const dbService = createSessionDBService();
const storageService = createStorageService();

dbService.cleanupOrphanedDBFiles();

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
  storageService
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
});

function closeResources(): void {
  clearInterval(cleanupTimer);
  dbService.closeAllSessionDBs();
}

process.on('exit', () => {
  closeResources();
});

process.on('SIGINT', () => {
  console.log('\n[关闭] 收到中断信号，正在关闭数据库连接...');
  closeResources();
  process.exit(0);
});
