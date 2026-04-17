(function initAppStateModule(global) {
  const MESSAGE_STATUS = {
    NORMAL: 'normal',
    RECALLED: 'recalled'
  };

  function createInitialState() {
    return {
      myId: null,
      ws: null,
      current: null,
      sessions: JSON.parse(localStorage.getItem('sessions') || '[]'),
      remarks: JSON.parse(localStorage.getItem('remarks') || '{}'),
      unreadCount: {},
      onlineUsers: [],
      contextMenuTargetId: null,
      connectionState: 'disconnected',
      connectionLatency: null,
      uidStatus: 'valid',
      uidTTL: 0
    };
  }

  function persistSessions(state) {
    localStorage.setItem('sessions', JSON.stringify(state.sessions));
  }

  function persistRemarks(state) {
    localStorage.setItem('remarks', JSON.stringify(state.remarks));
  }

  global.ChatAppState = {
    MESSAGE_STATUS,
    createInitialState,
    persistSessions,
    persistRemarks
  };
})(window);
