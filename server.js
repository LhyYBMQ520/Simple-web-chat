// 引入依赖模块
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const Database = require('better-sqlite3');

// 数据库
const db = new Database('chat.db');
db.exec(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT, receiver TEXT, content TEXT, time INTEGER
)`);

const insert = db.prepare("INSERT INTO messages (sender,receiver,content,time) VALUES (?,?,?,?)");
const history = db.prepare("SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY time ASC");

// 服务
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map();

function broadcastOnline() {
  const onlineList = Array.from(clients.keys());

  const data = JSON.stringify({
    type: 'online',
    list: onlineList
  });

  clients.forEach(ws => {
    ws.send(data);
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
        clients.set(uid, ws);

        console.log(`[绑定用户] UID: ${uid} | IP: ${ip}`);

        broadcastOnline(); // ⭐新增
      }

      if (msg.type === 'request') {
        console.log(`[请求连接] ${uid} -> ${msg.to}`);
        const to = clients.get(msg.to);
        if (to) to.send(JSON.stringify({ type: 'request', from: uid }));
      }

      if (msg.type === 'accept') {
        console.log(`[同意连接] ${uid} <-> ${msg.from}`);
        const to = clients.get(msg.from);
        if (to) to.send(JSON.stringify({ type: 'accepted', from: uid }));
        ws.send(JSON.stringify({ type: 'accepted', from: msg.from }));
      }

      // 获取历史消息
      if (msg.type === 'getHistory') {
        const list = history.all(uid, msg.with, msg.with, uid);
        ws.send(JSON.stringify({type:"history", list}));
      }

      if (msg.type === 'message') {
        console.log(`[消息] ${uid} -> ${msg.to} : ${msg.content}`);

        const target = clients.get(msg.to);
        if (target) target.send(JSON.stringify({ type: 'msg', from: uid, content: msg.content }));

        insert.run(uid, msg.to, msg.content, Date.now());
      }
    } catch (e) { }
  });

  ws.on('close', () => {
    console.log(`[连接断开] UID: ${uid || '未绑定'} | IP: ${ip}`);

    // 只有当这个ws还是当前绑定的连接才删除（防止旧连接删除新连接）
    if (uid && clients.get(uid) === ws) {
      clients.delete(uid);
      broadcastOnline(); // ⭐新增
    }
  });
});

server.listen(21451, () => console.log("运行在 http://localhost:21451"));
