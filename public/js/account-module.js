(function initAccountModule(global) {
  const DB_NAME = 'lchat-account';
  const STORE = 'keys';

  function bytesToBase64Url(bytes) {
    let binary = '';
    new Uint8Array(bytes).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function base64UrlToBytes(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readKey(name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(name);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function writeKey(name, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, name);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  async function authenticate() {
    let keyPair = await readKey('keyPair');
    if (!keyPair) {
      keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      await writeKey('keyPair', keyPair);
    }
    const publicDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKey = bytesToBase64Url(publicDer);
    const challengeResponse = await fetch('/api/account/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicKey }) });
    if (!challengeResponse.ok) throw new Error('无法创建账号认证挑战');
    const challengeData = await challengeResponse.json();
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, new TextEncoder().encode(challengeData.challenge));
    const verifyResponse = await fetch('/api/account/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicKey, challengeId: challengeData.challengeId, signature: bytesToBase64Url(signature) }) });
    if (!verifyResponse.ok) throw new Error('永久账号签名验证失败');
    const result = await verifyResponse.json();
    localStorage.setItem('chatIdentityMode', 'permanent');
    localStorage.setItem('chatAccountId', result.accountId);
    localStorage.setItem('chatAccountPublicKey', publicKey);
    sessionStorage.setItem('chatAccountSessionToken', result.sessionToken);
    return { accountId: result.accountId, sessionToken: result.sessionToken };
  }

  async function exportCredential() {
    const keyPair = await readKey('keyPair');
    if (!keyPair) throw new Error('未找到永久账号密钥');
    const publicKey = bytesToBase64Url(await crypto.subtle.exportKey('spki', keyPair.publicKey));
    const privateKey = bytesToBase64Url(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
    const password = prompt('请设置账号凭据导出密码（至少 8 位）');
    if (!password || password.length < 8) throw new Error('导出密码过短');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const plaintext = new TextEncoder().encode(JSON.stringify({ accountId: localStorage.getItem('chatAccountId'), publicKey, privateKey }));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
    const blob = new Blob([JSON.stringify({ version: 2, algorithm: 'AES-GCM', salt: bytesToBase64Url(salt), iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(ciphertext) }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'lchat-permanent-account.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importCredential(file) {
    const data = JSON.parse(await file.text());
    if (data.version !== 2 || data.algorithm !== 'AES-GCM') throw new Error('账号凭据格式无效');
    const password = prompt('请输入账号凭据导入密码');
    if (!password) throw new Error('未输入导入密码');
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: base64UrlToBytes(data.salt), iterations: 150000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(data.iv) }, aesKey, base64UrlToBytes(data.ciphertext));
    const credential = JSON.parse(new TextDecoder().decode(plaintext));
    if (typeof credential.publicKey !== 'string' || typeof credential.privateKey !== 'string') throw new Error('账号凭据内容无效');
    const privateKey = await crypto.subtle.importKey('pkcs8', base64UrlToBytes(credential.privateKey), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const publicKey = await crypto.subtle.importKey('spki', base64UrlToBytes(credential.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
    await writeKey('keyPair', { privateKey, publicKey });
    localStorage.setItem('chatIdentityMode', 'permanent');
    localStorage.setItem('chatAccountId', credential.accountId || '');
    localStorage.setItem('chatAccountPublicKey', credential.publicKey);
    location.reload();
  }

  function switchMode(state) {
    const overlay = document.getElementById('identitySwitchConfirmOverlay');
    const confirmButton = document.getElementById('identitySwitchConfirmBtn');
    const cancelButton = document.getElementById('identitySwitchCancelBtn');
    if (!overlay || !confirmButton || !cancelButton) return;
    const targetMode = state.identityType === 'permanent' ? 'guest' : 'permanent';
    const text = document.getElementById('identitySwitchConfirmText');
    if (text) text.textContent = targetMode === 'permanent'
      ? '切换到永久账号后将清理当前游客模式的会话列表和备注，确定继续吗？'
      : '切换到游客模式后将清理当前永久账号模式的会话列表和备注，确定继续吗？';
    overlay.style.display = 'flex';
    cancelButton.onclick = () => { overlay.style.display = 'none'; };
    confirmButton.onclick = () => {
      overlay.style.display = 'none';
      completeModeSwitch(state);
    };
  }

  function completeModeSwitch(state) {
    localStorage.removeItem('sessions');
    localStorage.removeItem('remarks');
    if (state.identityType === 'permanent') {
      localStorage.setItem('chatIdentityMode', 'guest');
      sessionStorage.removeItem('chatAccountSessionToken');
    } else {
      localStorage.setItem('chatIdentityMode', 'permanent');
    }
    location.reload();
  }

  function chooseMode() {
    const saved = localStorage.getItem('chatIdentityMode');
    if (saved === 'guest' || saved === 'permanent') return Promise.resolve(saved);
    return new Promise(resolve => {
      const overlay = document.getElementById('identityModeOverlay');
      overlay.style.display = 'flex';
      overlay.querySelector('[data-mode="guest"]').onclick = () => { localStorage.setItem('chatIdentityMode', 'guest'); overlay.style.display = 'none'; resolve('guest'); };
      overlay.querySelector('[data-mode="permanent"]').onclick = () => { overlay.style.display = 'none'; resolve('permanent'); };
    });
  }

  async function initialize(state) {
    const mode = await chooseMode();
    const previousMode = localStorage.getItem('chatLastIdentityMode');
    if (previousMode && previousMode !== mode) {
      localStorage.removeItem('sessions');
      localStorage.removeItem('remarks');
    }
    localStorage.setItem('chatLastIdentityMode', mode);
    if (mode === 'permanent') {
      const account = await authenticate();
      state.identityType = 'permanent';
      state.myId = account.accountId;
      state.accountSessionToken = account.sessionToken;
      return;
    }
    state.identityType = 'guest';
    localStorage.setItem('chatIdentityMode', 'guest');
  }

  global.ChatAccountModule = { initialize, exportCredential, importCredential, switchMode };
})(window);
