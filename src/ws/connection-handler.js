const WebSocket = require('ws');

function createConnectionHandler({ clients, broadcastOnline, uidService, dbService }) {
  return (ws, req) => {
    let uid;

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    console.log(`[连接建立] IP: ${ip}`);

    ws.on('message', data => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'ping') {
          const clientTime = Number(msg.clientTime);
          ws.send(JSON.stringify({
            type: 'pong',
            clientTime: Number.isFinite(clientTime) ? clientTime : null,
            serverTime: Date.now()
          }));
          return;
        }

        if (msg.type === 'bind') {
          uid = msg.uid;
          const uidStatus = uidService.registerUID(uid);

          if (!uidStatus.valid) {
            ws.send(JSON.stringify({
              type: 'bindResult',
              success: false,
              reason: 'uid_expired',
              message: '您的 UID 已过期，请刷新页面生成新的 UID'
            }));
            console.log(`[绑定失败] UID: ${uid} 已过期 | IP: ${ip}`);
            return;
          }

          const uidInfo = uidService.getUIDInfo(uid);
          clients.set(uid, {
            ws,
            status: uidStatus.status,
            expiresAt: uidInfo ? uidInfo.expiresAt : null,
            activeChat: null
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
          if (uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
            return;
          }

          console.log(`[请求连接] ${uid} -> ${msg.to}`);
          const target = clients.get(msg.to);

          if (target && !uidService.isUIDExpired(msg.to) && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'request', from: uid }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: '对方 UID 已过期或离线' }));
          }
        }

        if (msg.type === 'accept') {
          if (uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
            return;
          }

          console.log(`[同意连接] ${uid} <-> ${msg.from}`);
          const target = clients.get(msg.from);

          if (target && !uidService.isUIDExpired(msg.from) && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'accepted', from: uid }));
          }
          ws.send(JSON.stringify({ type: 'accepted', from: msg.from }));
        }

        if (msg.type === 'getHistory') {
          if (uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
            return;
          }

          const sessionDB = dbService.getSessionDB(uid, msg.with);
          const readUpdates = dbService.updateMessagesReadState(sessionDB, uid, msg.with);
          const history = sessionDB.prepare('SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY time ASC');
          const list = history.all(uid, msg.with, msg.with, uid).map(dbService.toMessagePayload);

          ws.send(JSON.stringify({ type: 'history', list }));

          if (readUpdates.length > 0) {
            const target = clients.get(msg.with);
            if (target && !uidService.isUIDExpired(msg.with) && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(JSON.stringify({ type: 'messagesRead', messages: readUpdates }));
            }
          }
        }

        if (msg.type === 'activeChat') {
          if (!uid || !clients.has(uid)) {
            return;
          }

          const clientInfo = clients.get(uid);
          clientInfo.activeChat = typeof msg.with === 'string' && msg.with.trim() ? msg.with.trim() : null;
          clients.set(uid, clientInfo);

          if (clientInfo.activeChat) {
            console.log(`[会话激活] ${uid} 正在查看与 ${clientInfo.activeChat} 的会话`);
          }
        }

        if (msg.type === 'message') {
          if (uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期，无法发送消息' }));
            return;
          }

          if (!msg.to) {
            ws.send(JSON.stringify({ type: 'error', message: '接收方不能为空' }));
            return;
          }

          const content = typeof msg.content === 'string' ? msg.content.trim() : '';
          if (!content) {
            ws.send(JSON.stringify({ type: 'error', message: '消息内容不能为空' }));
            return;
          }

          console.log(`[消息] ${uid} -> ${msg.to} : ${content}`);

          const sessionDB = dbService.getSessionDB(uid, msg.to);
          const now = Date.now();
          const target = clients.get(msg.to);
          const receiverIsActive = !!(
            target &&
            !uidService.isUIDExpired(msg.to) &&
            target.ws.readyState === WebSocket.OPEN &&
            target.activeChat === uid
          );
          const readAt = receiverIsActive ? now : null;

          const insert = sessionDB.prepare('INSERT INTO messages (sender,receiver,content,time,status,edited_at,read_at) VALUES (?,?,?,?,?,?,?)');
          const result = insert.run(uid, msg.to, content, now, 'normal', null, readAt);

          const messagePayload = {
            id: Number(result.lastInsertRowid),
            sender: uid,
            receiver: msg.to,
            content,
            time: now,
            status: 'normal',
            editedAt: null,
            readAt
          };

          ws.send(JSON.stringify({ type: 'msg', message: messagePayload }));

          if (target && !uidService.isUIDExpired(msg.to) && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'msg', message: messagePayload }));
          }
        }

        if (msg.type === 'editMessage') {
          if (uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期，无法编辑消息' }));
            return;
          }

          const messageId = Number(msg.messageId);
          const newContent = typeof msg.content === 'string' ? msg.content.trim() : '';

          console.log(`[消息编辑请求] ${uid} -> ${msg.to || '未知目标'} | 消息ID: ${messageId || '无效'}`);

          if (!Number.isInteger(messageId) || messageId <= 0 || !msg.to) {
            ws.send(JSON.stringify({ type: 'error', message: '编辑参数无效' }));
            return;
          }

          if (!newContent) {
            ws.send(JSON.stringify({ type: 'error', message: '编辑内容不能为空' }));
            return;
          }

          const sessionDB = dbService.getSessionDB(uid, msg.to);
          const row = dbService.getConversationMessage(sessionDB, messageId, uid, msg.to);

          if (!row) {
            ws.send(JSON.stringify({ type: 'error', message: '消息不存在或不在当前会话中' }));
            return;
          }

          if (row.sender !== uid) {
            ws.send(JSON.stringify({ type: 'error', message: '只能编辑自己发送的消息' }));
            return;
          }

          if ((row.status || 'normal') === 'recalled') {
            ws.send(JSON.stringify({ type: 'error', message: '已撤回消息不能编辑' }));
            return;
          }

          const oldContent = row.content;
          const editedAt = Date.now();
          const update = sessionDB.prepare('UPDATE messages SET content=?, edited_at=? WHERE id=?');
          update.run(newContent, editedAt, messageId);

          const updatedPayload = dbService.toMessagePayload({
            ...row,
            content: newContent,
            edited_at: editedAt,
            status: row.status || 'normal'
          });
          const eventPayload = JSON.stringify({ type: 'messageEdited', message: updatedPayload });

          ws.send(eventPayload);

          const target = clients.get(msg.to);
          if (target && !uidService.isUIDExpired(msg.to) && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(eventPayload);
          }

          console.log(
            `[消息编辑] ${uid} -> ${msg.to} | 消息ID: ${messageId} | 原文: "${dbService.previewContent(oldContent)}" | 新文: "${dbService.previewContent(newContent)}"`
          );
        }

        if (msg.type === 'recallMessage') {
          if (uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期，无法撤回消息' }));
            return;
          }

          const messageId = Number(msg.messageId);
          console.log(`[消息撤回请求] ${uid} -> ${msg.to || '未知目标'} | 消息ID: ${messageId || '无效'}`);

          if (!Number.isInteger(messageId) || messageId <= 0 || !msg.to) {
            ws.send(JSON.stringify({ type: 'error', message: '撤回参数无效' }));
            return;
          }

          const sessionDB = dbService.getSessionDB(uid, msg.to);
          const row = dbService.getConversationMessage(sessionDB, messageId, uid, msg.to);

          if (!row) {
            ws.send(JSON.stringify({ type: 'error', message: '消息不存在或不在当前会话中' }));
            return;
          }

          if (row.sender !== uid) {
            ws.send(JSON.stringify({ type: 'error', message: '只能撤回自己发送的消息' }));
            return;
          }

          const wasRecalled = (row.status || 'normal') === 'recalled';
          const originalContent = row.content;
          if ((row.status || 'normal') !== 'recalled') {
            const update = sessionDB.prepare("UPDATE messages SET content='[消息已撤回]', status='recalled', edited_at=NULL WHERE id=?");
            update.run(messageId);
          }

          const recalledPayload = dbService.toMessagePayload({
            ...row,
            content: '[消息已撤回]',
            status: 'recalled',
            edited_at: null
          });
          const eventPayload = JSON.stringify({ type: 'messageRecalled', message: recalledPayload });

          ws.send(eventPayload);

          const target = clients.get(msg.to);
          if (target && !uidService.isUIDExpired(msg.to) && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(eventPayload);
          }

          if (wasRecalled) {
            console.log(`[消息撤回] ${uid} -> ${msg.to} | 消息ID: ${messageId} | 状态: 已是撤回消息`);
          } else {
            console.log(
              `[消息撤回] ${uid} -> ${msg.to} | 消息ID: ${messageId} | 原文: "${dbService.previewContent(originalContent)}"`
            );
          }
        }
      } catch (e) {
        console.error('[错误]', e.message);
      }
    });

    ws.on('close', () => {
      console.log(`[连接断开] UID: ${uid || '未绑定'} | IP: ${ip}`);

      if (uid && clients.get(uid)?.ws === ws) {
        clients.delete(uid);
        broadcastOnline();
      }
    });
  };
}

module.exports = {
  createConnectionHandler
};
