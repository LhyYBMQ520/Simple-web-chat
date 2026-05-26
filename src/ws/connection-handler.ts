import { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { UIDService } from '../services/uid-service.js';
import type { SessionDBService } from '../services/session-db-service.js';
import type { StorageService } from '../services/storage-service.js';
import {
  handleCallRequest,
  handleCallAccept,
  handleCallReject,
  handleCallEnd,
  handleCallOffer,
  handleCallAnswer,
  handleIceCandidate,
  cleanupCallTracking
} from './signaling-handler.js';

export interface ClientInfo {
  ws: WebSocket;
  status: string;
  expiresAt: number | null;
  activeChat: string | null;
}

export interface ConnectionHandlerDeps {
  clients: Map<string, ClientInfo>;
  broadcastOnline: () => void;
  uidService: UIDService;
  dbService: SessionDBService;
  storageService: StorageService;
}

type WSMessage =
  | { type: 'ping'; clientTime?: unknown }
  | { type: 'bind'; uid: string }
  | { type: 'request'; to: string }
  | { type: 'accept'; from: string }
  | { type: 'getHistory'; with: string }
  | { type: 'activeChat'; with?: string }
  | { type: 'message'; to: string; content: unknown; quoteId?: unknown }
  | { type: 'file_message'; to: string; msgType: unknown; content: unknown; quoteId?: unknown }
  | { type: 'editMessage'; messageId: unknown; to: string; content: unknown }
  | { type: 'recallMessage'; messageId: unknown; to: string }
  | { type: 'callRequest'; to: string; callType: unknown }
  | { type: 'callAccept'; from: string }
  | { type: 'callReject'; from: string; reason?: unknown }
  | { type: 'callEnd'; to: string }
  | { type: 'callOffer'; to: string; sdp: unknown }
  | { type: 'callAnswer'; to: string; sdp: unknown }
  | { type: 'iceCandidate'; to: string; candidate: unknown };

export function createConnectionHandler({ clients, broadcastOnline, uidService, dbService, storageService }: ConnectionHandlerDeps) {
  return (ws: WebSocket, req: IncomingMessage): void => {
    let uid: string | undefined;

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    console.log(`[连接建立] IP: ${ip}`);

    ws.on('message', data => {
      try {
        const msg: WSMessage = JSON.parse(data.toString());

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
          if (!uid || uidService.isUIDExpired(uid)) {
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
          if (!uid || uidService.isUIDExpired(uid)) {
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
          if (!uid || uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
            return;
          }

          const sessionDB = dbService.getSessionDB(uid, msg.with);
          const readUpdates = dbService.updateMessagesReadState(sessionDB, uid, msg.with);
          const history = sessionDB.prepare('SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY time ASC');
          const list = history.all(uid, msg.with, msg.with, uid).map(row => {
            const payload = dbService.toMessagePayload(row as Parameters<typeof dbService.toMessagePayload>[0]);
            if (payload.quoteId !== null) {
              payload.quoteMessage = dbService.getQuotedMessage(sessionDB, payload.quoteId);
            }
            return payload;
          });

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

          const clientInfo = clients.get(uid)!;
          clientInfo.activeChat = typeof msg.with === 'string' && msg.with.trim() ? msg.with.trim() : null;

          if (clientInfo.activeChat) {
            console.log(`[会话激活] ${uid} 正在查看与 ${clientInfo.activeChat} 的会话`);
          }
        }

        if (msg.type === 'message') {
          if (!uid || uidService.isUIDExpired(uid)) {
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

          const quoteId = Number.isInteger(Number(msg.quoteId)) && Number(msg.quoteId) > 0 ? Number(msg.quoteId) : null;
          let quoteMessage = null;

          const sessionDB = dbService.getSessionDB(uid, msg.to);

          if (quoteId !== null) {
            quoteMessage = dbService.getQuotedMessage(sessionDB, quoteId);
            if (!quoteMessage) {
              ws.send(JSON.stringify({ type: 'error', message: '引用的消息不存在' }));
              return;
            }
          }

          console.log(`[消息] ${uid} -> ${msg.to} : ${content}${quoteId ? ' | 引用消息ID: ' + quoteId : ''}`);

          const now = Date.now();
          const target = clients.get(msg.to);
          const receiverIsActive = !!(
            target &&
            !uidService.isUIDExpired(msg.to) &&
            target.ws.readyState === WebSocket.OPEN &&
            target.activeChat === uid
          );
          const readAt = receiverIsActive ? now : null;

          const insert = sessionDB.prepare('INSERT INTO messages (sender,receiver,content,time,status,edited_at,read_at,msg_type,quote_id) VALUES (?,?,?,?,?,?,?,?,?)');
          const result = insert.run(uid, msg.to, content, now, 'normal', null, readAt, 'text', quoteId);

          const messagePayload = {
            id: Number(result.lastInsertRowid),
            sender: uid,
            receiver: msg.to,
            content,
            time: now,
            status: 'normal',
            editedAt: null,
            readAt,
            msgType: 'text',
            quoteId,
            quoteMessage
          };

          ws.send(JSON.stringify({ type: 'msg', message: messagePayload }));

          if (target && !uidService.isUIDExpired(msg.to) && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'msg', message: messagePayload }));
          }
        }

        if (msg.type === 'file_message') {
          if (!uid || uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期，无法发送消息' }));
            return;
          }

          if (!msg.to) {
            ws.send(JSON.stringify({ type: 'error', message: '接收方不能为空' }));
            return;
          }

          const msgType = String(msg.msgType || 'file');
          if (msgType !== 'image' && msgType !== 'file') {
            ws.send(JSON.stringify({ type: 'error', message: '不支持的消息类型' }));
            return;
          }

          if (typeof msg.content !== 'object' || msg.content === null || typeof (msg.content as Record<string, unknown>).url !== 'string') {
            ws.send(JSON.stringify({ type: 'error', message: '文件消息格式错误' }));
            return;
          }

          const contentStr = JSON.stringify(msg.content);

          const quoteId = Number.isInteger(Number(msg.quoteId)) && Number(msg.quoteId) > 0 ? Number(msg.quoteId) : null;
          let quoteMessage = null;

          const sessionDB = dbService.getSessionDB(uid, msg.to);

          if (quoteId !== null) {
            quoteMessage = dbService.getQuotedMessage(sessionDB, quoteId);
            if (!quoteMessage) {
              ws.send(JSON.stringify({ type: 'error', message: '引用的消息不存在' }));
              return;
            }
          }

          console.log(`[文件消息] ${uid} -> ${msg.to} : ${msgType} | ${(msg.content as Record<string, string>).name || 'unknown'}${quoteId ? ' | 引用消息ID: ' + quoteId : ''}`);

          const now = Date.now();
          const target = clients.get(msg.to);
          const receiverIsActive = !!(
            target &&
            !uidService.isUIDExpired(msg.to) &&
            target.ws.readyState === WebSocket.OPEN &&
            target.activeChat === uid
          );
          const readAt = receiverIsActive ? now : null;

          const fileKey = typeof (msg.content as Record<string, unknown>).fileKey === 'string'
            ? (msg.content as Record<string, string>).fileKey : null;

          const insert = sessionDB.prepare('INSERT INTO messages (sender,receiver,content,time,status,edited_at,read_at,msg_type,file_key,quote_id) VALUES (?,?,?,?,?,?,?,?,?,?)');
          const result = insert.run(uid, msg.to, contentStr, now, 'normal', null, readAt, msgType, fileKey, quoteId);

          const messagePayload = {
            id: Number(result.lastInsertRowid),
            sender: uid,
            receiver: msg.to,
            content: contentStr,
            time: now,
            status: 'normal',
            editedAt: null,
            readAt,
            msgType,
            fileKey,
            quoteId,
            quoteMessage
          };

          ws.send(JSON.stringify({ type: 'msg', message: messagePayload }));

          if (target && !uidService.isUIDExpired(msg.to) && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'msg', message: messagePayload }));
          }
        }

        if (msg.type === 'editMessage') {
          if (!uid || uidService.isUIDExpired(uid)) {
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
          if (updatedPayload.quoteId !== null) {
            updatedPayload.quoteMessage = dbService.getQuotedMessage(sessionDB, updatedPayload.quoteId);
          }
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
          if (!uid || uidService.isUIDExpired(uid)) {
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

            if ((row.msg_type === 'image' || row.msg_type === 'file') && row.file_key && storageService.isConfigured()) {
              storageService.deleteFile(row.file_key).catch(err =>
                console.error('[消息撤回] 删除 R2 文件失败:', row.file_key, (err as Error).message)
              );
              console.log(`[消息撤回] 已请求删除 R2 文件: ${row.file_key}`);
            }
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

        if (msg.type === 'callRequest') {
          if (!uid || uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
            return;
          }
          handleCallRequest({ clients, uidService }, uid, msg);
          return;
        }

        if (msg.type === 'callAccept') {
          if (!uid || uidService.isUIDExpired(uid)) {
            ws.send(JSON.stringify({ type: 'error', message: '您的 UID 已过期' }));
            return;
          }
          handleCallAccept({ clients, uidService }, uid, msg);
          return;
        }

        if (msg.type === 'callReject') {
          if (!uid || uidService.isUIDExpired(uid)) {
            return;
          }
          handleCallReject({ clients, uidService }, uid, msg);
          return;
        }

        if (msg.type === 'callEnd') {
          if (!uid) return;
          handleCallEnd({ clients, uidService }, uid, msg);
          return;
        }

        if (msg.type === 'callOffer') {
          if (!uid) return;
          handleCallOffer({ clients, uidService }, uid, msg);
          return;
        }

        if (msg.type === 'callAnswer') {
          if (!uid) return;
          handleCallAnswer({ clients, uidService }, uid, msg);
          return;
        }

        if (msg.type === 'iceCandidate') {
          if (!uid) return;
          handleIceCandidate({ clients, uidService }, uid, msg);
        }
      } catch (e) {
        console.error('[错误]', (e as Error).message);
      }
    });

    ws.on('close', () => {
      console.log(`[连接断开] UID: ${uid || '未绑定'} | IP: ${ip}`);

      if (uid && clients.get(uid)?.ws === ws) {
        clients.delete(uid);
        cleanupCallTracking(uid, clients);
        broadcastOnline();
      }
    });
  };
}
