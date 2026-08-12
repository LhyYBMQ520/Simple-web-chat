(function initAndroidScreenSourceModule(global) {
  const DEFAULT_BASE_URL = 'http://127.0.0.1:18765';
  const DEFAULT_WS_URL = 'ws://127.0.0.1:18765/webrtc';
  const DEFAULT_WORKLET_URL = 'js/android-pcm-worklet.js';

  class AndroidScreenSourceError extends Error {
    constructor(code, message, recoverable) {
      super(message);
      this.name = 'AndroidScreenSourceError';
      this.code = code;
      this.recoverable = Boolean(recoverable);
    }
  }

  function isAndroidDevice() {
    return /Android/i.test((global.navigator && global.navigator.userAgent) || '');
  }

  function create(options) {
    const config = options || {};
    const baseUrl = String(config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    const wsUrl = String(config.wsUrl || DEFAULT_WS_URL);
    const workletUrl = config.workletUrl || DEFAULT_WORKLET_URL;
    const source = {
      onended: null,
      onwarning: null,
      status: null,
      stream: null,
      socket: null,
      pc: null,
      audioContext: null,
      audioNode: null,
      audioDestination: null,
      closed: false,
      acquired: false,
      ended: false,
      pendingCandidates: [],
      remoteDescriptionSet: false,
      pendingAcquireReject: null,
      keepAliveTimer: null,
      disconnectTimer: null,
      ownedTracks: new Set()
    };

    function notifyWarning(message) {
      if (typeof source.onwarning === 'function') source.onwarning(message);
    }

    function emitEnded(reason) {
      if (source.closed || source.ended) return;
      source.ended = true;
      console.warn('[Android 屏幕源] 连接结束:', reason || 'source_ended');
      if (!source.acquired && source.pendingAcquireReject) {
        source.pendingAcquireReject(new AndroidScreenSourceError(
          'SIGNALING',
          'Android 屏幕源在视频建立前已结束',
          false
        ));
        source.pendingAcquireReject = null;
      }
      if (typeof source.onended === 'function') source.onended(reason || 'source_ended');
    }

    function fetchWithTimeout(url, timeoutMs) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = setTimeout(function () {
        if (controller) controller.abort();
      }, timeoutMs);
      return fetch(url, controller ? { signal: controller.signal, cache: 'no-store' } : { cache: 'no-store' })
        .finally(function () { clearTimeout(timeout); });
    }

    async function getStatus() {
      if (!isAndroidDevice()) {
        throw new AndroidScreenSourceError('UNAVAILABLE', '当前设备不是 Android', true);
      }
      let response;
      try {
        response = await fetchWithTimeout(baseUrl + '/status', 1500);
      } catch (err) {
        throw new AndroidScreenSourceError('UNAVAILABLE', 'Android 屏幕共享服务不可访问', true);
      }
      if (!response.ok) {
        throw new AndroidScreenSourceError('UNAVAILABLE', 'Android 屏幕共享服务不可用', true);
      }
      let status;
      try {
        status = await response.json();
      } catch (err) {
        throw new AndroidScreenSourceError('PROTOCOL', 'Android 屏幕共享状态响应无效', false);
      }
      source.status = status;
      if (status.running !== true || status.video !== true) {
        throw new AndroidScreenSourceError(
          'NOT_READY',
          '请打开 Screensharing App，点击“授权并开始”并完成系统授权',
          true
        );
      }
      return status;
    }

    function sendJson(payload) {
      if (source.socket && source.socket.readyState === WebSocket.OPEN) {
        source.socket.send(JSON.stringify(payload));
        return true;
      }
      return false;
    }

    function flushPendingCandidates() {
      const pending = source.pendingCandidates.splice(0);
      pending.forEach(function (candidate) {
        source.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(function (err) {
          console.warn('[Android 屏幕源] 添加早到 ICE 候选失败:', err);
        });
      });
    }

    function parsePcmFrame(data) {
      if (!(data instanceof ArrayBuffer) || data.byteLength < 20) return null;
      const view = new DataView(data);
      const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      const channels = view.getUint8(5);
      const bits = view.getUint16(6, true);
      const sampleRate = view.getUint32(8, true);
      if (magic !== 'APCM' || view.getUint8(4) !== 1 || channels !== 2 || bits !== 16 || sampleRate !== 48000) {
        return null;
      }
      const payloadBytes = data.byteLength - 20;
      if (payloadBytes <= 0 || payloadBytes % 4 !== 0) return null;
      const pcm = new Int16Array(data, 20, payloadBytes / 2);
      const samples = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) samples[i] = Math.max(-1, pcm[i] / 32768);
      return samples;
    }

    async function setupPcmAudio(status) {
      if (status.systemAudio !== true) {
        notifyWarning('系统音频采集不可用，将继续共享屏幕和网页麦克风');
        return null;
      }
      if (!global.AudioContext && !global.webkitAudioContext) {
        notifyWarning('当前浏览器不支持 AudioWorklet，系统音频不可用');
        return null;
      }
      const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
      let context;
      try {
        context = new AudioContextCtor({ sampleRate: 48000, latencyHint: 0.08 });
        source.audioContext = context;
        if (context.sampleRate !== 48000) {
          throw new Error('浏览器未提供 48kHz AudioContext');
        }
        if (!context.audioWorklet || typeof context.audioWorklet.addModule !== 'function') {
          throw new Error('AudioWorklet 不可用');
        }
        await context.audioWorklet.addModule(workletUrl);
        const node = new AudioWorkletNode(context, 'android-pcm', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });
        const destination = context.createMediaStreamDestination();
        node.connect(destination);
        node.port.postMessage({ type: 'configure', sampleRate: 48000 });
        node.port.onmessage = function (event) {
          const data = event.data || {};
          if (data.type !== 'stats') return;
          console.log('[Android 系统音频缓冲] ' + data.bufferedMs + 'ms' +
            ' | underrun=' + data.underruns + ' | overflow=' + data.overflowFrames);
        };
        source.audioNode = node;
        source.audioDestination = destination;
        if (typeof context.resume === 'function') await context.resume();
        const track = destination.stream.getAudioTracks()[0] || null;
        if (track) source.ownedTracks.add(track);
        return track;
      } catch (err) {
        console.warn('[Android 屏幕源] 系统音频初始化失败:', err);
        notifyWarning('系统音频暂不可用，将继续共享屏幕和网页麦克风');
        if (context && typeof context.close === 'function') context.close().catch(function () {});
        source.audioContext = null;
        source.audioNode = null;
        source.audioDestination = null;
        return null;
      }
    }

    function handleSocketMessage(event) {
      if (typeof event.data !== 'string') {
        if (event.data instanceof ArrayBuffer) {
          const samples = parsePcmFrame(event.data);
          if (samples && source.audioNode) {
            source.audioNode.port.postMessage({ type: 'pcm', samples: samples }, [samples.buffer]);
          }
        } else if (event.data && typeof event.data.arrayBuffer === 'function') {
          event.data.arrayBuffer().then(function (buffer) {
            handleSocketMessage({ data: buffer });
          }).catch(function () {});
        }
        return;
      }

      let message;
      try { message = JSON.parse(event.data); } catch (err) { return; }
      if (!message || typeof message.type !== 'string') return;

      if (message.type === 'state' && message.state === 'ready') {
        sendJson({ type: 'ready' });
        return;
      }
      if (message.type === 'offer') {
        source.pc.setRemoteDescription({ type: 'offer', sdp: message.sdp }).then(function () {
          source.remoteDescriptionSet = true;
          flushPendingCandidates();
          return source.pc.createAnswer();
        }).then(function (answer) {
          return source.pc.setLocalDescription(answer);
        }).then(function () {
          sendJson({ type: 'answer', sdp: source.pc.localDescription.sdp });
        }).catch(function (err) {
          notifyWarning('Android 屏幕源 SDP 协商失败');
          console.error('[Android 屏幕源] SDP 处理失败:', err);
          emitEnded('signaling_error');
        });
        return;
      }
      if (message.type === 'ice' && message.candidate) {
        if (!source.remoteDescriptionSet) {
          source.pendingCandidates.push(message.candidate);
        } else {
          source.pc.addIceCandidate(new RTCIceCandidate(message.candidate)).catch(function (err) {
            console.warn('[Android 屏幕源] 添加 ICE 候选失败:', err);
          });
        }
        return;
      }
      if (message.type === 'ended') emitEnded(message.reason || 'source_ended');
      if (message.type === 'error') emitEnded(message.error || 'source_error');
    }

    function closeResources(sendClose) {
      if (source.keepAliveTimer) {
        clearInterval(source.keepAliveTimer);
        source.keepAliveTimer = null;
      }
      if (source.disconnectTimer) {
        clearTimeout(source.disconnectTimer);
        source.disconnectTimer = null;
      }
      if (sendClose) sendJson({ type: 'close' });
      if (source.socket) {
        source.socket.onclose = null;
        source.socket.onerror = null;
        try { source.socket.close(); } catch (err) {}
        source.socket = null;
      }
      if (source.pc) {
        source.pc.ontrack = null;
        source.pc.onicecandidate = null;
        source.pc.onconnectionstatechange = null;
        try { source.pc.close(); } catch (err) {}
        source.pc = null;
      }
      if (source.audioNode) {
        try { source.audioNode.disconnect(); } catch (err) {}
        try { source.audioNode.port.close(); } catch (err) {}
        source.audioNode = null;
      }
      if (source.audioDestination && source.audioDestination.stream) {
        source.audioDestination.stream.getTracks().forEach(function (track) { track.stop(); });
        source.audioDestination = null;
      }
      if (source.audioContext) {
        source.audioContext.close().catch(function () {});
        source.audioContext = null;
      }
      if (source.stream) {
        source.ownedTracks.forEach(function (track) {
          if (track.readyState !== 'ended') track.stop();
          if (typeof source.stream.removeTrack === 'function') source.stream.removeTrack(track);
        });
        source.stream = null;
      }
      source.ownedTracks.clear();
      source.pendingCandidates = [];
      source.remoteDescriptionSet = false;
      source.acquired = false;
    }

    function scheduleDisconnectCheck() {
      if (source.disconnectTimer || source.closed || source.ended) return;
      source.disconnectTimer = setTimeout(function () {
        source.disconnectTimer = null;
        if (!source.closed && !source.ended && source.pc &&
            source.pc.connectionState === 'disconnected') {
          emitEnded('connection_disconnected');
        }
      }, 3000);
    }

    async function acquire() {
      if (source.acquired && source.stream) return source.stream;
      const status = await getStatus();
      source.closed = false;
      source.ended = false;
      source.pendingCandidates = [];
      source.remoteDescriptionSet = false;
      source.stream = new MediaStream();

      const systemAudioTrack = await setupPcmAudio(status);
      if (systemAudioTrack) source.stream.addTrack(systemAudioTrack);

      source.pc = new RTCPeerConnection({ iceServers: [] });
      source.pc.onicecandidate = function (event) {
        if (event.candidate) sendJson({ type: 'ice', candidate: event.candidate.toJSON() });
      };
      source.pc.ontrack = function (event) {
        if (!event.track || event.track.kind !== 'video') return;
        source.ownedTracks.add(event.track);
        source.stream.addTrack(event.track);
        if (!source.acquired) {
          source.acquired = true;
          source.pendingAcquireReject = null;
          resolveAcquire(source.stream);
        }
      };
      source.pc.onconnectionstatechange = function () {
        const state = source.pc.connectionState;
        if (state === 'connected') {
          if (source.disconnectTimer) {
            clearTimeout(source.disconnectTimer);
            source.disconnectTimer = null;
          }
          return;
        }
        if (state === 'disconnected') {
          scheduleDisconnectCheck();
          return;
        }
        if (state === 'failed' || state === 'closed') emitEnded('connection_' + state);
      };

      let resolveAcquire;
      let rejectAcquire;
      const acquirePromise = new Promise(function (resolve, reject) {
        resolveAcquire = resolve;
        rejectAcquire = reject;
      });
      source.pendingAcquireReject = rejectAcquire;
      // The event handler above needs these callbacks before the WebSocket can deliver an offer.
      source.socket = new WebSocket(wsUrl);
      source.socket.binaryType = 'arraybuffer';
      source.socket.onopen = function () {
        if (source.keepAliveTimer) clearInterval(source.keepAliveTimer);
        source.keepAliveTimer = setInterval(function () {
          sendJson({ type: 'ping' });
        }, 2000);
      };
      source.socket.onmessage = handleSocketMessage;
      source.socket.onerror = function () {
        if (!source.acquired) rejectAcquire(new AndroidScreenSourceError('SIGNALING', 'Android 屏幕源 WebRTC 连接失败', false));
        emitEnded('socket_error');
      };
      source.socket.onclose = function (event) {
        if (!source.acquired) rejectAcquire(new AndroidScreenSourceError('SIGNALING', 'Android 屏幕源连接已关闭', false));
        console.warn('[Android 屏幕源] WebSocket 关闭:', event && event.code, event && event.reason,
          '| 本机 PeerConnection:', source.pc && source.pc.connectionState);
        if (source.acquired && source.pc && source.pc.connectionState === 'connected') {
          // The app uses this socket for signaling and PCM delivery. An
          // unexpected socket close does not necessarily stop the already
          // connected video PeerConnection, so keep the screen track alive.
          notifyWarning('Android 系统音频连接已断开，屏幕画面仍在继续');
          return;
        }
        emitEnded('socket_closed');
      };

      try {
        return await Promise.race([
          acquirePromise,
          new Promise(function (_, reject) {
            setTimeout(function () {
              reject(new AndroidScreenSourceError('TIMEOUT', '等待 Android 屏幕源视频超时', false));
            }, 8000);
          })
        ]);
      } catch (err) {
        source.pendingAcquireReject = null;
        closeResources(true);
        throw err;
      }
    }

    source.acquire = acquire;
    source.close = function () {
      if (source.closed) return;
      source.closed = true;
      closeResources(true);
    };
    source.isNativeSource = true;
    return source;
  }

  global.ChatAndroidScreenSource = {
    create: create,
    isAndroidDevice: isAndroidDevice,
    isRecoverableError: function (err) {
      return Boolean(err && err.name === 'AndroidScreenSourceError' && err.recoverable);
    }
  };
})(window);
