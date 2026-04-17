(function initWsModule(global) {
  function createWsModule(options) {
    const { state, handlers } = options;
    let heartbeatTimer = null;

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

    function sendChatMessage(to, content) {
      return sendJSON({ type: 'message', to, content });
    }

    function sendEditMessage(to, messageId, content) {
      return sendJSON({ type: 'editMessage', to, messageId, content });
    }

    function sendRecallMessage(to, messageId) {
      return sendJSON({ type: 'recallMessage', to, messageId });
    }

    function connect() {
      notifyConnectionState('connecting');

      if (state.ws && state.ws.readyState !== WebSocket.CLOSED) {
        state.ws.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      state.ws = new WebSocket(protocol + '//' + window.location.host);

      state.ws.onopen = () => {
        notifyConnectionState('connected');
        notifyLatency(null);
        state.ws.send(JSON.stringify({ type: 'bind', uid: state.myId }));
        startHeartbeat();
      };

      state.ws.onmessage = event => {
        const d = JSON.parse(event.data);

        if (d.type === 'pong') {
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
        }
      };

      state.ws.onclose = () => {
        stopHeartbeat();
        notifyLatency(null);
        notifyConnectionState('reconnecting');
        setTimeout(connect, 2000);
      };

      state.ws.onerror = () => {
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
      syncActiveChatState
    };
  }

  global.ChatWsModule = {
    createWsModule
  };
})(window);
