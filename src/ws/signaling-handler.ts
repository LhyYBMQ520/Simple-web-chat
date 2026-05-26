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

function peerLabel(uid: string): string {
  return uid.length > 12 ? uid.slice(0, 8) + '...' + uid.slice(-4) : uid;
}

export function handleCallRequest(deps: SignalingDeps, uid: string, msg: { to: string; callType: unknown }): void {
  const callType = String(msg.callType || 'audio');
  if (!['audio', 'video', 'screen'].includes(callType)) {
    sendJSON(deps.clients.get(uid)!.ws, { type: 'error', message: '不支持的通话类型' });
    return;
  }

  const typeLabel = callType === 'audio' ? '语音通话' : callType === 'video' ? '视频通话' : '屏幕共享';
  const target = deps.clients.get(msg.to);

  if (!target || deps.uidService.isUIDExpired(msg.to) || target.ws.readyState !== WebSocket.OPEN) {
    console.log(`[通话请求] ${peerLabel(uid)} -> ${peerLabel(msg.to)} | ${typeLabel} | 状态: 失败(对方不在线)`);
    sendJSON(deps.clients.get(uid)!.ws, { type: 'error', message: '对方不在线或已过期' });
    return;
  }

  console.log(`[通话请求] ${peerLabel(uid)} -> ${peerLabel(msg.to)} | ${typeLabel} | 状态: 已转发`);
  sendJSON(target.ws, { type: 'callRequest', from: uid, callType });
}

export function handleCallAccept(deps: SignalingDeps, uid: string, msg: { from: string }): void {
  const target = deps.clients.get(msg.from);

  if (target && !deps.uidService.isUIDExpired(msg.from) && target.ws.readyState === WebSocket.OPEN) {
    console.log(`[通话接受] ${peerLabel(uid)} 接受 ${peerLabel(msg.from)} | 状态: 已转发`);
    sendJSON(target.ws, { type: 'callAccept', from: uid });
  } else {
    console.log(`[通话接受] ${peerLabel(uid)} 接受 ${peerLabel(msg.from)} | 状态: 对方已离线`);
  }
}

export function handleCallReject(deps: SignalingDeps, uid: string, msg: { from: string; reason?: unknown }): void {
  const target = deps.clients.get(msg.from);
  const reason = typeof msg.reason === 'string' ? msg.reason : 'declined';
  const reasonLabel = reason === 'busy' ? '对方正忙' : reason === 'error' ? '设备错误' : '拒绝接听';

  console.log(`[通话拒绝] ${peerLabel(uid)} 拒绝 ${peerLabel(msg.from)} | 原因: ${reasonLabel}`);

  if (target && !deps.uidService.isUIDExpired(msg.from) && target.ws.readyState === WebSocket.OPEN) {
    sendJSON(target.ws, { type: 'callReject', from: uid, reason });
  }
}

export function handleCallEnd(deps: SignalingDeps, uid: string, msg: { to: string }): void {
  const target = deps.clients.get(msg.to);
  console.log(`[通话挂断] ${peerLabel(uid)} -> ${peerLabel(msg.to)}`);

  if (target && !deps.uidService.isUIDExpired(msg.to) && target.ws.readyState === WebSocket.OPEN) {
    sendJSON(target.ws, { type: 'callEnd', from: uid });
  }
}

// Track SDP/ICE exchange attempts for logging
const sdpLogCount = new Map<string, number>();
const iceLogCount = new Map<string, number>();

function callKey(a: string, b: string): string {
  return a < b ? a + '|' + b : b + '|' + a;
}

export function handleCallOffer(deps: SignalingDeps, uid: string, msg: { to: string; sdp: unknown }): void {
  const target = deps.clients.get(msg.to);
  const key = callKey(uid, msg.to);
  const count = (sdpLogCount.get(key) || 0) + 1;
  sdpLogCount.set(key, count);

  if (!target || deps.uidService.isUIDExpired(msg.to) || target.ws.readyState !== WebSocket.OPEN) {
    console.log(`[SDP Offer #${count}] ${peerLabel(uid)} -> ${peerLabel(msg.to)} | 状态: 失败(对方已离线)`);
    sendJSON(deps.clients.get(uid)!.ws, { type: 'error', message: '对方已离线' });
    return;
  }

  const isRenegotiation = count > 1;
  console.log(`[SDP Offer #${count}] ${peerLabel(uid)} -> ${peerLabel(msg.to)}${isRenegotiation ? ' | 类型: 重协商' : ' | 类型: 初始协商'} | 状态: 已转发`);
  sendJSON(target.ws, { type: 'callOffer', from: uid, sdp: msg.sdp });
}

export function handleCallAnswer(deps: SignalingDeps, uid: string, msg: { to: string; sdp: unknown }): void {
  const target = deps.clients.get(msg.to);
  const key = callKey(uid, msg.to);
  const count = sdpLogCount.get(key) || 0;

  if (!target || deps.uidService.isUIDExpired(msg.to) || target.ws.readyState !== WebSocket.OPEN) {
    console.log(`[SDP Answer] ${peerLabel(uid)} -> ${peerLabel(msg.to)} | 状态: 失败(对方已离线)`);
    sendJSON(deps.clients.get(uid)!.ws, { type: 'error', message: '对方已离线' });
    return;
  }

  console.log(`[SDP Answer] ${peerLabel(uid)} -> ${peerLabel(msg.to)} | 响应 Offer #${count} | 状态: 已转发`);
  sendJSON(target.ws, { type: 'callAnswer', from: uid, sdp: msg.sdp });
}

export function handleIceCandidate(deps: SignalingDeps, uid: string, msg: { to: string; candidate: unknown }): void {
  const target = deps.clients.get(msg.to);
  if (!target || deps.uidService.isUIDExpired(msg.to) || target.ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const key = callKey(uid, msg.to);
  const count = (iceLogCount.get(key) || 0) + 1;
  iceLogCount.set(key, count);

  // Parse candidate to determine type
  let candType = 'unknown';
  let protocol = '';
  if (msg.candidate && typeof msg.candidate === 'object') {
    const c = msg.candidate as Record<string, unknown>;
    candType = typeof c.candidateType === 'string' ? c.candidateType : 'unknown';
    protocol = typeof c.protocol === 'string' ? c.protocol.toLowerCase() : '';
  }

  // Log first few ICE candidates, then only periodically
  if (count <= 5) {
    console.log(`[ICE 候选 #${count}] ${peerLabel(uid)} -> ${peerLabel(msg.to)} | 类型: ${candType}${protocol ? '/' + protocol : ''} | 状态: 已转发`);
  } else if (count % 10 === 0) {
    console.log(`[ICE 候选] ${peerLabel(uid)} -> ${peerLabel(msg.to)} | 累计: ${count} 个 | 最新类型: ${candType}/${protocol}`);
  }

  sendJSON(target.ws, { type: 'iceCandidate', from: uid, candidate: msg.candidate });
}

// Clean up tracking maps (called when connection closes)
export function cleanupCallTracking(uid: string, clients: Map<string, ClientInfo>): void {
  for (const [key] of sdpLogCount) {
    if (key.includes(uid)) sdpLogCount.delete(key);
  }
  for (const [key] of iceLogCount) {
    if (key.includes(uid)) iceLogCount.delete(key);
  }
}
