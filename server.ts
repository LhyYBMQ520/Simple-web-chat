import express from 'express';
import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

import { PORT, PUBLIC_DIR } from './src/config/constants.js';
import { createUIDService } from './src/services/uid-service.js';
import { createSessionDBService } from './src/services/session-db-service.js';
import { createConnectionHandler, type ClientInfo } from './src/ws/connection-handler.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.static(PUBLIC_DIR));

const clients = new Map<string, ClientInfo>();
const uidService = createUIDService();
const dbService = createSessionDBService();

dbService.cleanupOrphanedDBFiles();

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
  dbService
}));

const cleanupTimer = setInterval(() => {
  uidService.cleanupExpiredUIDs(dbService.deleteAllSessionDBsForUID);
}, 1 * 60 * 1000);

server.listen(PORT, () => console.log(`运行在 http://localhost:${PORT}`));

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
