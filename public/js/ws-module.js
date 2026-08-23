(function initWsModule(global) {
  function createWsModule(options) {
    const { state, handlers } = options;
    let heartbeatTimer = null;
    let reconnectTimer = null;
    let reconnectAttempt = 0;
    let connectInProgress = false;
    let connectionStartedAt = 0;
    let lastPongAt = 0;
    let lifecycleListenersBound = false;

    function notifyConnectionState(nextState) {
      if (state.connectionState === nextState) return;
      state.connectionState = nextState;
      if (typeof handlers.onConnectionStateChange === 'function') {
        handlers.onConnectionStateChange(nextState);
      }
    }

    function notifyLatency(latency) {
      state.connectionLatency = Number.isFinite(latency) ? Math.max(0, Math.round(latency)) : null;
      if (typeof handlers.onLatencyUpdate === 'function') {
        handlers.onLatencyUpdate(state.connectionLatency);
      }
    }

    function isOpen() {
      return !!(state.ws && state.ws.readyState === WebSocket.OPEN);
    }

    function clearReconnectTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function scheduleReconnect(immediate) {
      if (reconnectTimer || connectInProgress) return;
      const delay = immediate ? 0 : Math.min(30000, 1000 * Math.pow(2, Math.min(reconnectAttempt, 5)));
      reconnectAttempt++;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    function ensureConnection(immediate) {
      if (isOpen()) {
        // A frozen mobile page can leave a socket object in OPEN state even
        // though the underlying network path is gone.
        if (lastPongAt && Date.now() - lastPongAt > 30000) {
          const staleSocket = state.ws;
          state.ws = null;
          stopHeartbeat();
          try { staleSocket.close(); } catch (err) {}
          connectInProgress = false;
          clearReconnectTimer();
          scheduleReconnect(true);
        }
        return;
      }
      if (connectInProgress && connectionStartedAt && Date.now() - connectionStartedAt > 15000) {
        const staleSocket = state.ws;
        state.ws = null;
        connectInProgress = false;
        try { if (staleSocket) staleSocket.close(); } catch (err) {}
      }
      scheduleReconnect(immediate);
    }

    function bindLifecycleListeners() {
      if (lifecycleListenersBound || typeof global.addEventListener !== 'function') return;
      lifecycleListenersBound = true;
      global.addEventListener('online', () => ensureConnection(true));
      global.addEventListener('pageshow', () => ensureConnection(true));
      global.addEventListener('focus', () => ensureConnection(true));
      if (global.document && typeof global.document.addEventListener === 'function') {
        global.document.addEventListener('visibilitychange', () => {
          if (global.document.visibilityState === 'visible') ensureConnection(true);
        });
      }
    }

    function sendJSON(payload) {
      if (!isOpen()) {
        return false;
      }
      state.ws.send(JSON.stringify(payload));
      return true;
    }

    function sendPing() {
      const sentAt = Date.now();
      sendJSON({ type: 'ping', clientTime: sentAt });
    }

    function startHeartbeat() {
      stopHeartbeat();
      sendPing();
      lastPongAt = Date.now();
      heartbeatTimer = setInterval(() => {
        sendPing();
      }, 10000);
    }

    function stopHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }

    function syncActiveChatState() {
      sendJSON({ type: 'activeChat', with: state.current || null });
    }

    function sendRequest(to) {
      return sendJSON({ type: 'request', to });
    }

    function sendAccept(from) {
      return sendJSON({ type: 'accept', from });
    }

    function sendGetHistory(peerId) {
      return sendJSON({ type: 'getHistory', with: peerId });
    }

    function sendChatMessage(to, content, quoteId) {
      const payload = { type: 'message', to, content };
      if (quoteId != null) payload.quoteId = quoteId;
      return sendJSON(payload);
    }

    function sendEditMessage(to, messageId, content) {
      return sendJSON({ type: 'editMessage', to, messageId, content });
    }

    function sendRecallMessage(to, messageId) {
      return sendJSON({ type: 'recallMessage', to, messageId });
    }

    function sendFileMessage(to, msgType, content, quoteId) {
      const payload = { type: 'file_message', to, msgType, content };
      if (quoteId != null) payload.quoteId = quoteId;
      return sendJSON(payload);
    }

    function sendCallRequest(to, callType) {
      return sendJSON({ type: 'callRequest', to, callType });
    }

    function sendCallAccept(from) {
      return sendJSON({ type: 'callAccept', from });
    }

    function sendCallReject(from, reason) {
      return sendJSON({ type: 'callReject', from, reason });
    }

    function sendCallEnd(to) {
      return sendJSON({ type: 'callEnd', to });
    }

    function sendCallMediaState(to, mediaType, reason) {
      return sendJSON({ type: 'callMediaState', to, mediaType, reason });
    }

    function sendCallRestart(to) {
      return sendJSON({ type: 'callRestart', to });
    }

    function sendCallOffer(to, sdp) {
      return sendJSON({ type: 'callOffer', to, sdp });
    }

    function sendCallAnswer(to, sdp) {
      return sendJSON({ type: 'callAnswer', to, sdp });
    }

    function sendIceCandidate(to, candidate) {
      return sendJSON({ type: 'iceCandidate', to, candidate });
    }

    function connect() {
      bindLifecycleListeners();
      clearReconnectTimer();
      if (connectInProgress) return;
      connectInProgress = true;
      connectionStartedAt = Date.now();
      notifyConnectionState('connecting');

      if (state.ws && state.ws.readyState !== WebSocket.CLOSED) {
        state.ws.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(protocol + '//' + window.location.host);
      state.ws = socket;

      socket.onopen = () => {
        if (state.ws !== socket) return;
        connectInProgress = false;
        connectionStartedAt = 0;
        reconnectAttempt = 0;
        notifyConnectionState('connected');
        notifyLatency(null);
        const bindPayload = { type: 'bind', uid: state.myId };
        if (state.identityType === 'permanent' && state.accountSessionToken) bindPayload.authToken = state.accountSessionToken;
        socket.send(JSON.stringify(bindPayload));
        startHeartbeat();
      };

      socket.onmessage = event => {
        if (state.ws !== socket) return;
        const d = JSON.parse(event.data);

        if (d.type === 'pong') {
          lastPongAt = Date.now();
          const serverEchoTs = Number(d.clientTime);
          if (Number.isFinite(serverEchoTs) && serverEchoTs > 0) {
            notifyLatency(Date.now() - serverEchoTs);
          }
          return;
        }

        if (d.type === 'bindResult') {
          handlers.onBindResult(d);
          return;
        }

        if (d.type === 'error') {
          handlers.onError(d);
          return;
        }

        if (d.type === 'request') {
          handlers.onRequest(d);
          return;
        }

        if (d.type === 'accepted') {
          handlers.onAccepted(d);
          return;
        }

        if (d.type === 'history') {
          handlers.onHistory(d);
          return;
        }

        if (d.type === 'msg') {
          handlers.onMsg(d);
          return;
        }

        if (d.type === 'messageEdited' || d.type === 'messageRecalled') {
          handlers.onMessagePatched(d);
          return;
        }

        if (d.type === 'messagesRead') {
          handlers.onMessagesRead(d);
          return;
        }

        if (d.type === 'online') {
          handlers.onOnline(d);
          return;
        }

        if (d.type === 'callRequest') {
          handlers.onCallRequest(d);
          return;
        }

        if (d.type === 'callAccept') {
          handlers.onCallAccept(d);
          return;
        }

        if (d.type === 'callReject') {
          handlers.onCallReject(d);
          return;
        }

        if (d.type === 'callEnd') {
          handlers.onCallEnd(d);
          return;
        }

        if (d.type === 'callMediaState') {
          handlers.onCallMediaState(d);
          return;
        }

        if (d.type === 'callRestart') {
          handlers.onCallRestart(d);
          return;
        }

        if (d.type === 'callOffer') {
          handlers.onCallOffer(d);
          return;
        }

        if (d.type === 'callAnswer') {
          handlers.onCallAnswer(d);
          return;
        }

        if (d.type === 'iceCandidate') {
          handlers.onIceCandidate(d);
        }
      };

      socket.onclose = () => {
        if (state.ws !== socket) return;
        connectInProgress = false;
        connectionStartedAt = 0;
        stopHeartbeat();
        notifyLatency(null);
        notifyConnectionState('reconnecting');
        scheduleReconnect(false);
      };

      socket.onerror = () => {
        if (state.ws !== socket) return;
        notifyConnectionState('disconnected');
      };
    }

    return {
      connect,
      isOpen,
      sendRequest,
      sendAccept,
      sendGetHistory,
      sendChatMessage,
      sendEditMessage,
      sendRecallMessage,
      sendFileMessage,
      syncActiveChatState,
      sendCallRequest,
      sendCallAccept,
      sendCallReject,
      sendCallEnd,
      sendCallMediaState,
      sendCallRestart,
      sendCallOffer,
      sendCallAnswer,
      sendIceCandidate
    };
  }

  global.ChatWsModule = {
    createWsModule
  };
})(window);
