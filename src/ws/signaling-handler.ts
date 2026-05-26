import { WebSocket } from 'ws';
import type { ClientInfo } from './connection-handler.js';
import type { UIDService } from '../services/uid-service.js';

export interface SignalingDeps {
  clients: Map<string, ClientInfo>;
  uidService: UIDService;
}

function sendJSON(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function handleCallRequest(deps: SignalingDeps, uid: string, msg: { to: string; callType: unknown }): void {
  const callType = String(msg.callType || 'audio');
  if (!['audio', 'video', 'screen'].includes(callType)) {
    sendJSON(deps.clients.get(uid)!.ws, { type: 'error', message: '不支持的通话类型' });
    return;
  }

  const target = deps.clients.get(msg.to);
  if (!target || deps.uidService.isUIDExpired(msg.to) || target.ws.readyState !== WebSocket.OPEN) {
    sendJSON(deps.clients.get(uid)!.ws, { type: 'error', message: '对方不在线或已过期' });
    return;
  }

  console.log(`[通话请求] ${uid} -> ${msg.to} | 类型: ${callType}`);
  sendJSON(target.ws, { type: 'callRequest', from: uid, callType });
}

export function handleCallAccept(deps: SignalingDeps, uid: string, msg: { from: string }): void {
  const target = deps.clients.get(msg.from);
  console.log(`[通话接受] ${uid} 接受 ${msg.from}`);

  if (target && !deps.uidService.isUIDExpired(msg.from) && target.ws.readyState === WebSocket.OPEN) {
    sendJSON(target.ws, { type: 'callAccept', from: uid });
  }
}

export function handleCallReject(deps: SignalingDeps, uid: string, msg: { from: string; reason?: unknown }): void {
  const target = deps.clients.get(msg.from);
  const reason = typeof msg.reason === 'string' ? msg.reason : 'declined';
  console.log(`[通话拒绝] ${uid} 拒绝 ${msg.from} | 原因: ${reason}`);

  if (target && !deps.uidService.isUIDExpired(msg.from) && target.ws.readyState === WebSocket.OPEN) {
    sendJSON(target.ws, { type: 'callReject', from: uid, reason });
  }
}

export function handleCallEnd(deps: SignalingDeps, uid: string, msg: { to: string }): void {
  const target = deps.clients.get(msg.to);
  console.log(`[通话结束] ${uid} -> ${msg.to}`);

  if (target && !deps.uidService.isUIDExpired(msg.to) && target.ws.readyState === WebSocket.OPEN) {
    sendJSON(target.ws, { type: 'callEnd', from: uid });
  }
}

export function handleCallOffer(deps: SignalingDeps, uid: string, msg: { to: string; sdp: unknown }): void {
  const target = deps.clients.get(msg.to);
  if (!target || deps.uidService.isUIDExpired(msg.to) || target.ws.readyState !== WebSocket.OPEN) {
    sendJSON(deps.clients.get(uid)!.ws, { type: 'error', message: '对方已离线' });
    return;
  }
  sendJSON(target.ws, { type: 'callOffer', from: uid, sdp: msg.sdp });
}

export function handleCallAnswer(deps: SignalingDeps, uid: string, msg: { to: string; sdp: unknown }): void {
  const target = deps.clients.get(msg.to);
  if (!target || deps.uidService.isUIDExpired(msg.to) || target.ws.readyState !== WebSocket.OPEN) {
    sendJSON(deps.clients.get(uid)!.ws, { type: 'error', message: '对方已离线' });
    return;
  }
  sendJSON(target.ws, { type: 'callAnswer', from: uid, sdp: msg.sdp });
}

export function handleIceCandidate(deps: SignalingDeps, uid: string, msg: { to: string; candidate: unknown }): void {
  const target = deps.clients.get(msg.to);
  if (!target || deps.uidService.isUIDExpired(msg.to) || target.ws.readyState !== WebSocket.OPEN) {
    return;
  }
  sendJSON(target.ws, { type: 'iceCandidate', from: uid, candidate: msg.candidate });
}
