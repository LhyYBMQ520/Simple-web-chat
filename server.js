const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const { PORT, PUBLIC_DIR } = require('./src/config/constants');
const { createUIDService } = require('./src/services/uid-service');
const { createSessionDBService } = require('./src/services/session-db-service');
const { createConnectionHandler } = require('./src/ws/connection-handler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(express.static(PUBLIC_DIR));

const clients = new Map();
const uidService = createUIDService();
const dbService = createSessionDBService();

// 启动时清理因后端关闭而遗留的过期数据库文件
dbService.cleanupOrphanedDBFiles();

function broadcastOnline() {
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

function closeResources() {
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
