import dgram from 'node:dgram';
import crypto from 'node:crypto';

// ========== STUN/TURN Constants ==========

const MAGIC_COOKIE = 0x2112A442;

const BINDING_REQUEST            = 0x0001;
const BINDING_SUCCESS            = 0x0101;
const ALLOCATE                   = 0x0003;
const ALLOCATE_SUCCESS           = 0x0103;
const ALLOCATE_ERROR             = 0x0113;
const REFRESH                    = 0x0004;
const REFRESH_SUCCESS            = 0x0104;
const REFRESH_ERROR              = 0x0114;
const SEND_INDICATION            = 0x0016;
const DATA_INDICATION            = 0x0017;
const CREATE_PERMISSION          = 0x0008;
const CREATE_PERMISSION_SUCCESS  = 0x0108;
const CREATE_PERMISSION_ERROR    = 0x0118;

// Attribute types
const ATTR_USERNAME              = 0x0006;
const ATTR_MESSAGE_INTEGRITY     = 0x0008;
const ATTR_ERROR_CODE            = 0x0009;
const ATTR_LIFETIME              = 0x000D;
const ATTR_XOR_PEER_ADDRESS      = 0x0012;
const ATTR_DATA                  = 0x0013;
const ATTR_REALM                 = 0x0014;
const ATTR_NONCE                 = 0x0015;
const ATTR_XOR_RELAYED_ADDRESS   = 0x0016;
const ATTR_XOR_MAPPED_ADDRESS    = 0x0020;
const ATTR_SOFTWARE              = 0x8022;
const ATTR_FINGERPRINT           = 0x8028;

// Error codes
const ERR_UNAUTHORIZED      = 401;
const ERR_ALLOC_MISMATCH    = 437;
const ERR_WRONG_CREDENTIALS = 441;

const SOFTWARE_STR = 'simple-web-chat-turn';

// ========== Types ==========

interface Allocation {
  username: string;
  permissions: Set<string>;
  expiresAt: number;
}

// ========== Buffer helpers ==========

function pad4(n: number): number {
  return (n + 3) & ~3;
}

// ========== STUN Message Parser ==========

interface ParsedSTUN {
  type: number;
  transactionId: Buffer;
  attributes: Map<number, { length: number; value: Buffer }>;
  raw: Buffer;
}

function parseSTUN(buf: Buffer): ParsedSTUN | null {
  if (buf.length < 20) return null;

  const type = buf.readUInt16BE(0);
  const length = buf.readUInt16BE(2);
  const magic = buf.readUInt32BE(4);

  if (magic !== MAGIC_COOKIE) return null;
  if (buf.length < 20 + length) return null;

  const transactionId = buf.subarray(8, 20);
  const attributes = new Map<number, { length: number; value: Buffer }>();
  let offset = 20;
  const end = 20 + length;

  while (offset + 4 <= end) {
    const attrType = buf.readUInt16BE(offset);
    const attrLen = buf.readUInt16BE(offset + 2);
    offset += 4;
    if (offset + attrLen > end) break;
    const value = buf.subarray(offset, offset + attrLen);
    attributes.set(attrType, { length: attrLen, value });
    offset += pad4(attrLen);
  }

  return { type, transactionId, attributes, raw: buf };
}

// ========== STUN Message Builder ==========

function buildHeader(
  type: number,
  bodyLength: number,
  transactionId: Buffer
): Buffer {
  const header = Buffer.allocUnsafe(20);
  header.writeUInt16BE(type, 0);
  header.writeUInt16BE(bodyLength, 2);
  header.writeUInt32BE(MAGIC_COOKIE, 4);
  transactionId.copy(header, 8);
  return header;
}

function buildAttribute(type: number, value: Uint8Array): Buffer {
  const paddedLen = pad4(value.length);
  const buf = Buffer.allocUnsafe(4 + paddedLen);
  buf.writeUInt16BE(type, 0);
  buf.writeUInt16BE(value.length, 2);
  Buffer.from(value).copy(buf, 4);
  if (paddedLen > value.length) {
    buf.fill(0, 4 + value.length, 4 + paddedLen);
  }
  return buf;
}

function buildXorAddress(
  attrType: number,
  ip: string,
  port: number,
  transactionId: Buffer
): Buffer {
  const isIPv4 = ip.includes('.');
  const family = isIPv4 ? 0x01 : 0x02;
  const xPort = port ^ (MAGIC_COOKIE >> 16);

  if (isIPv4) {
    const parts = ip.split('.').map(Number);
    const ipInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    const xIp = ipInt ^ MAGIC_COOKIE;

    const val = Buffer.allocUnsafe(8);
    val.writeUInt8(0, 0);
    val.writeUInt8(family, 1);
    val.writeUInt16BE(xPort, 2);
    val.writeUInt32BE(xIp >>> 0, 4);
    return buildAttribute(attrType, val);
  }

  // IPv6 — rare, allocate zeroed address
  const val = Buffer.allocUnsafe(20);
  val.writeUInt8(0, 0);
  val.writeUInt8(family, 1);
  val.writeUInt16BE(xPort, 2);
  val.fill(0, 4, 20);
  return buildAttribute(attrType, val);
}

function parseXorAddress(
  value: Buffer,
  transactionId: Buffer
): { ip: string; port: number } | null {
  if (value.length < 8) return null;
  const family = value.readUInt8(1);
  const xPort = value.readUInt16BE(2);
  const port = xPort ^ (MAGIC_COOKIE >> 16);

  if (family === 0x01) {
    const xIp = value.readUInt32BE(4);
    const ipInt = (xIp ^ MAGIC_COOKIE) >>> 0;
    const ip = `${(ipInt >> 24) & 0xFF}.${(ipInt >> 16) & 0xFF}.${(ipInt >> 8) & 0xFF}.${ipInt & 0xFF}`;
    return { ip, port };
  }
  return null;
}

function buildErrorResponse(
  responseType: number,
  transactionId: Buffer,
  errorCode: number,
  reason: string,
  extraAttrs: Buffer[] = []
): Buffer {
  const codeHundreds = Math.floor(errorCode / 100);
  const codeUnits = errorCode % 100;
  const errVal = Buffer.allocUnsafe(4 + reason.length);
  errVal.writeUInt16BE(0, 0);
  errVal.writeUInt8(codeHundreds, 2);
  errVal.writeUInt8(codeUnits, 3);
  errVal.write(reason, 4);

  const body = Buffer.concat([
    buildAttribute(ATTR_ERROR_CODE, errVal),
    ...extraAttrs,
  ]);
  return Buffer.concat([buildHeader(responseType, body.length, transactionId), body]);
}

function findAttrOffset(buf: Buffer, attrType: number): number {
  if (buf.length < 20) return -1;
  const msgLen = buf.readUInt16BE(2);
  let offset = 20;
  const end = 20 + msgLen;
  while (offset + 4 <= end) {
    const type = buf.readUInt16BE(offset);
    const len = buf.readUInt16BE(offset + 2);
    if (type === attrType) return offset;
    offset += 4 + pad4(len);
  }
  return -1;
}

// ========== Authentication ==========

function generateKey(username: string, realm: string, password: string): Buffer {
  // RFC 5389 §10.2: key = MD5(username ":" realm ":" SASLprep(password))
  return crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest();
}

function computePassword(secret: string, username: string): string {
  return crypto.createHmac('sha1', secret).update(username).digest('base64');
}

function verifyIntegrity(msg: Buffer, miOffset: number, key: Buffer): boolean {
  // msg must have its header length already adjusted to cover MESSAGE-INTEGRITY
  const receivedHMAC = msg.subarray(miOffset + 4, miOffset + 4 + 20);
  const hmac = crypto.createHmac('sha1', key);
  // Cover header + body up to (but not including) the MESSAGE-INTEGRITY value
  hmac.update(msg.subarray(0, miOffset + 4));
  const computed = hmac.digest();
  return crypto.timingSafeEqual(receivedHMAC, computed);
}

function prepareMsgForHMAC(raw: Buffer): { msg: Buffer; miOffset: number } | null {
  const miOffset = findAttrOffset(raw, ATTR_MESSAGE_INTEGRITY);
  if (miOffset < 0) return null;

  const fpOffset = findAttrOffset(raw, ATTR_FINGERPRINT);
  const msg = Buffer.from(raw);

  // Adjust header length to include MESSAGE-INTEGRITY but NOT FINGERPRINT
  const newBodyEnd = fpOffset >= 0 ? fpOffset : miOffset + 4 + 20;
  const newBodyLen = newBodyEnd - 20;
  msg.writeUInt16BE(newBodyLen, 2);

  return { msg, miOffset };
}

function appendMI(response: Buffer, key: Buffer): Buffer {
  response.writeUInt16BE(response.length - 20 + 24, 2);
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(response);
  const digest = Buffer.from(hmac.digest().buffer, hmac.digest().byteOffset, hmac.digest().byteLength);
  const mi = buildAttribute(ATTR_MESSAGE_INTEGRITY, digest);
  return Buffer.concat([response, mi]) as unknown as Buffer;
}

// ========== TURN Relay State ==========

export interface TURNRelayConfig {
  port: number;
  publicIp?: string;
  realm: string;
  secret: string;
  allocationLifetime: number;
}

export interface TURNRelayInfo {
  enabled: boolean;
  urls: string[];
  username: string;
  credential: string;
}

let relaySocket: dgram.Socket | null = null;
let allocations = new Map<string, Allocation>();
let validNonces = new Map<string, number>(); // nonce -> expiresAt
let currentConfig: TURNRelayConfig | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function clientKey(addr: string, port: number): string {
  return `${addr}:${port}`;
}

function getOwnIp(socket: dgram.Socket): string {
  if (currentConfig?.publicIp) return currentConfig.publicIp;
  const localAddr = socket.address().address;
  if (!isPrivateIP(localAddr)) return localAddr;
  return localAddr;
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127;
}

// ========== Message Handlers ==========

function handleBinding(
  msg: ParsedSTUN,
  rinfo: dgram.RemoteInfo,
  socket: dgram.Socket
): void {
  const body = buildXorAddress(
    ATTR_XOR_MAPPED_ADDRESS,
    rinfo.address,
    rinfo.port,
    msg.transactionId
  );
  const header = buildHeader(BINDING_SUCCESS, body.length, msg.transactionId);
  socket.send(Buffer.concat([header, body]), rinfo.port, rinfo.address);
}

function handleAllocate(
  msg: ParsedSTUN,
  rinfo: dgram.RemoteInfo,
  socket: dgram.Socket
): void {
  const ck = clientKey(rinfo.address, rinfo.port);
  const config = currentConfig!;

  const usernameAttr = msg.attributes.get(ATTR_USERNAME);
  const realmAttr = msg.attributes.get(ATTR_REALM);
  const nonceAttr = msg.attributes.get(ATTR_NONCE);
  const miAttr = msg.attributes.get(ATTR_MESSAGE_INTEGRITY);

  // No auth → send 401 challenge
  if (!usernameAttr || !realmAttr || !nonceAttr || !miAttr) {
    const nonce = crypto.randomBytes(16).toString('hex');
    validNonces.set(nonce, Date.now() + 600_000);

    const errResp = buildErrorResponse(
      ALLOCATE_ERROR,
      msg.transactionId,
      ERR_UNAUTHORIZED,
      'Authentication Required',
      [
        buildAttribute(ATTR_REALM, Buffer.from(config.realm, 'utf-8')),
        buildAttribute(ATTR_NONCE, Buffer.from(nonce, 'utf-8')),
        buildAttribute(ATTR_SOFTWARE, Buffer.from(SOFTWARE_STR)),
      ]
    );
    socket.send(errResp, rinfo.port, rinfo.address);
    return;
  }

  const username = usernameAttr.value.toString('utf-8');
  const realm = realmAttr.value.toString('utf-8');
  const nonce = nonceAttr.value.toString('utf-8');

  // Validate nonce
  const nonceExpiry = validNonces.get(nonce);
  if (!nonceExpiry || nonceExpiry < Date.now()) {
    validNonces.delete(nonce);
    const newNonce = crypto.randomBytes(16).toString('hex');
    validNonces.set(newNonce, Date.now() + 600_000);
    const errResp = buildErrorResponse(
      ALLOCATE_ERROR,
      msg.transactionId,
      ERR_UNAUTHORIZED,
      'Stale Nonce',
      [
        buildAttribute(ATTR_REALM, Buffer.from(config.realm)),
        buildAttribute(ATTR_NONCE, Buffer.from(newNonce)),
      ]
    );
    socket.send(errResp, rinfo.port, rinfo.address);
    return;
  }

  // Verify MESSAGE-INTEGRITY
  const password = computePassword(config.secret, username);
  const key = generateKey(username, realm, password);

  const prepared = prepareMsgForHMAC(msg.raw);
  if (!prepared || !verifyIntegrity(prepared.msg, prepared.miOffset, key)) {
    const errResp = buildErrorResponse(
      ALLOCATE_ERROR,
      msg.transactionId,
      ERR_WRONG_CREDENTIALS,
      'Authentication Failed'
    );
    socket.send(errResp, rinfo.port, rinfo.address);
    return;
  }

  validNonces.delete(nonce);

  // Create or update allocation
  const existing = allocations.get(ck);
  if (existing) {
    existing.expiresAt = Date.now() + config.allocationLifetime * 1000;
    existing.username = username;
  }

  const ownIp = getOwnIp(socket);
  const ownPort = socket.address().port;

  const body = Buffer.concat([
    buildXorAddress(ATTR_XOR_RELAYED_ADDRESS, ownIp, ownPort, msg.transactionId),
    buildXorAddress(ATTR_XOR_MAPPED_ADDRESS, rinfo.address, rinfo.port, msg.transactionId),
    buildAttribute(ATTR_LIFETIME, (() => { const b = Buffer.allocUnsafe(4); b.writeUInt32BE(config.allocationLifetime, 0); return b; })()),
    buildAttribute(ATTR_SOFTWARE, Buffer.from(SOFTWARE_STR)),
  ]);

  let response: Buffer = Buffer.concat([
    buildHeader(ALLOCATE_SUCCESS, body.length, msg.transactionId),
    body,
  ]);

  response = appendMI(response, key);

  if (!existing) {
    allocations.set(ck, {
      username,
      permissions: new Set(),
      expiresAt: Date.now() + config.allocationLifetime * 1000,
    });
  }

  socket.send(response, rinfo.port, rinfo.address);
}

function handleRefresh(
  msg: ParsedSTUN,
  rinfo: dgram.RemoteInfo,
  socket: dgram.Socket
): void {
  const ck = clientKey(rinfo.address, rinfo.port);
  const alloc = allocations.get(ck);
  if (!alloc) {
    const errResp = buildErrorResponse(
      REFRESH_ERROR, msg.transactionId, ERR_ALLOC_MISMATCH, 'No Such Allocation'
    );
    socket.send(errResp, rinfo.port, rinfo.address);
    return;
  }

  const miAttr = msg.attributes.get(ATTR_MESSAGE_INTEGRITY);
  if (!miAttr) return;

  const config = currentConfig!;
  const password = computePassword(config.secret, alloc.username);
  const key = generateKey(alloc.username, config.realm, password);

  const prepared = prepareMsgForHMAC(msg.raw);
  if (!prepared || !verifyIntegrity(prepared.msg, prepared.miOffset, key)) return;

  let lifetime = config.allocationLifetime;
  const lifetimeAttr = msg.attributes.get(ATTR_LIFETIME);
  if (lifetimeAttr && lifetimeAttr.length >= 4) {
    const requested = lifetimeAttr.value.readUInt32BE(0);
    if (requested > 0 && requested < lifetime) lifetime = Math.max(requested, 30);
  }

  alloc.expiresAt = Date.now() + lifetime * 1000;

  const lifeBuf = Buffer.allocUnsafe(4);
  lifeBuf.writeUInt32BE(lifetime, 0);
  const body = buildAttribute(ATTR_LIFETIME, lifeBuf);

  let response: Buffer = Buffer.concat([
    buildHeader(REFRESH_SUCCESS, body.length, msg.transactionId),
    body,
  ]);
  response = appendMI(response, key);

  socket.send(response, rinfo.port, rinfo.address);
}

function handleCreatePermission(
  msg: ParsedSTUN,
  rinfo: dgram.RemoteInfo,
  socket: dgram.Socket
): void {
  const ck = clientKey(rinfo.address, rinfo.port);
  const alloc = allocations.get(ck);
  if (!alloc) {
    const errResp = buildErrorResponse(
      CREATE_PERMISSION_ERROR, msg.transactionId, ERR_ALLOC_MISMATCH, 'No Such Allocation'
    );
    socket.send(errResp, rinfo.port, rinfo.address);
    return;
  }

  const miAttr = msg.attributes.get(ATTR_MESSAGE_INTEGRITY);
  if (!miAttr) return;

  const config = currentConfig!;
  const password = computePassword(config.secret, alloc.username);
  const key = generateKey(alloc.username, config.realm, password);

  const prepared = prepareMsgForHMAC(msg.raw);
  if (!prepared || !verifyIntegrity(prepared.msg, prepared.miOffset, key)) return;

  msg.attributes.forEach((attr, type) => {
    if (type === ATTR_XOR_PEER_ADDRESS) {
      const peer = parseXorAddress(attr.value, msg.transactionId);
      if (peer) alloc.permissions.add(`${peer.ip}:${peer.port}`);
    }
  });

  const body = buildAttribute(ATTR_SOFTWARE, Buffer.from(SOFTWARE_STR));
  let response: Buffer = Buffer.concat([
    buildHeader(CREATE_PERMISSION_SUCCESS, body.length, msg.transactionId),
    body,
  ]);
  response = appendMI(response, key);

  socket.send(response, rinfo.port, rinfo.address);
}

function handleSendIndication(
  msg: ParsedSTUN,
  rinfo: dgram.RemoteInfo,
  socket: dgram.Socket
): void {
  const ck = clientKey(rinfo.address, rinfo.port);
  const alloc = allocations.get(ck);
  if (!alloc) return;

  const peerAttr = msg.attributes.get(ATTR_XOR_PEER_ADDRESS);
  const dataAttr = msg.attributes.get(ATTR_DATA);
  if (!peerAttr || !dataAttr) return;

  const peer = parseXorAddress(peerAttr.value, msg.transactionId);
  if (!peer) return;
  if (!alloc.permissions.has(`${peer.ip}:${peer.port}`)) return;

  socket.send(dataAttr.value, peer.port, peer.ip);
}

function handleChannelData(
  buf: Buffer,
  rinfo: dgram.RemoteInfo,
  socket: dgram.Socket
): void {
  if (buf.length < 4) return;
  const dataLen = buf.readUInt16BE(2);
  if (buf.length < 4 + dataLen) return;

  const data = buf.subarray(4, 4 + dataLen);
  const ck = clientKey(rinfo.address, rinfo.port);
  const alloc = allocations.get(ck);
  if (!alloc) return;

  for (const perm of alloc.permissions) {
    const idx = perm.lastIndexOf(':');
    const ip = perm.slice(0, idx);
    const port = parseInt(perm.slice(idx + 1), 10);
    socket.send(data, port, ip);
  }
}

function handlePeerData(
  buf: Buffer,
  rinfo: dgram.RemoteInfo,
  socket: dgram.Socket
): void {
  const peerAddr = `${rinfo.address}:${rinfo.port}`;

  for (const [ck, alloc] of allocations) {
    if (!alloc.permissions.has(peerAddr)) continue;

    const idx = ck.lastIndexOf(':');
    const clientIp = ck.slice(0, idx);
    const clientPort = parseInt(ck.slice(idx + 1), 10);

    const tid = crypto.randomBytes(12);
    const body = Buffer.concat([
      buildXorAddress(ATTR_XOR_PEER_ADDRESS, rinfo.address, rinfo.port, tid),
      buildAttribute(ATTR_DATA, buf),
    ]);

    const header = buildHeader(DATA_INDICATION, body.length, tid);
    socket.send(Buffer.concat([header, body]), clientPort, clientIp);
  }
}

// ========== Credential Management ==========

let cachedCredentials: { username: string; credential: string; expiresAt: number } | null = null;

function getCredentials(): { username: string; credential: string } {
  if (!cachedCredentials || Date.now() > cachedCredentials.expiresAt - 300_000) {
    const config = currentConfig!;
    const expiry = Math.floor(Date.now() / 1000) + config.allocationLifetime * 10;
    const randId = crypto.randomBytes(8).toString('hex');
    const username = `${expiry}:${randId}`;
    const credential = computePassword(config.secret, username);
    cachedCredentials = { username, credential, expiresAt: expiry * 1000 };
  }
  return cachedCredentials;
}

function cleanupStale(): void {
  const now = Date.now();
  for (const [ck, alloc] of allocations) {
    if (alloc.expiresAt < now) allocations.delete(ck);
  }
  for (const [nonce, expires] of validNonces) {
    if (expires < now) validNonces.delete(nonce);
  }
}

// ========== Public API ==========

export function startTURNServer(config: TURNRelayConfig): boolean {
  currentConfig = config;

  try {
    relaySocket = dgram.createSocket('udp4');

    relaySocket.on('message', (buf: Buffer, rinfo: dgram.RemoteInfo) => {
      try {
        // Dispatch by first two bits
        if (buf.length >= 20 && (buf[0] & 0xC0) === 0) {
          const parsed = parseSTUN(buf);
          if (!parsed) return;
          switch (parsed.type) {
            case BINDING_REQUEST:       handleBinding(parsed, rinfo, relaySocket!); break;
            case ALLOCATE:              handleAllocate(parsed, rinfo, relaySocket!); break;
            case REFRESH:               handleRefresh(parsed, rinfo, relaySocket!); break;
            case CREATE_PERMISSION:     handleCreatePermission(parsed, rinfo, relaySocket!); break;
            case SEND_INDICATION:       handleSendIndication(parsed, rinfo, relaySocket!); break;
          }
        } else if (buf.length >= 4 && (buf[0] & 0xC0) === 0x40) {
          handleChannelData(buf, rinfo, relaySocket!);
        } else {
          handlePeerData(buf, rinfo, relaySocket!);
        }
      } catch {
        // Per-message errors are silent
      }
    });

    relaySocket.on('error', (err: Error) => {
      console.error(`[TURN中继] UDP 错误: ${err.message}`);
    });

    relaySocket.bind(config.port, () => {
      const addr = relaySocket!.address();
      console.log(`[TURN中继] 已启动 — 监听 udp://${addr.address}:${addr.port}`);
      console.log(`[TURN中继] realm=${config.realm}  分配生命周期=${config.allocationLifetime}秒`);
    });

    cleanupTimer = setInterval(cleanupStale, 30_000);
    return true;
  } catch (err) {
    console.error(`[TURN中继] 启动失败: ${(err as Error).message}`);
    return false;
  }
}

export function getTURNRelayInfo(): TURNRelayInfo | null {
  if (!relaySocket || !currentConfig) return null;
  const addr = relaySocket.address();
  const ownIp = currentConfig.publicIp || addr.address;
  const creds = getCredentials();
  return {
    enabled: true,
    urls: [`turn:${ownIp}:${addr.port}?transport=udp`],
    username: creds.username,
    credential: creds.credential,
  };
}

export function isTURNRelayRunning(): boolean {
  return relaySocket !== null;
}

export function stopTURNServer(): void {
  if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
  if (relaySocket) { relaySocket.close(); relaySocket = null; }
  allocations.clear();
  validNonces.clear();
  console.log('[TURN中继] 已停止');
}
