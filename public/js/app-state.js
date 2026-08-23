(function initAppStateModule(global) {
  const MESSAGE_STATUS = {
    NORMAL: 'normal',
    RECALLED: 'recalled'
  };

  function loadCallQualityProfile() {
    const value = localStorage.getItem('callQualityProfile') || 'auto';
    return ['auto', 'low', 'standard', 'high'].includes(value) ? value : 'auto';
  }

  function loadEnabledPreference(key) {
    return localStorage.getItem(key) !== 'false';
  }

  function createInitialState() {
    return {
      myId: null,
      identityType: localStorage.getItem('chatIdentityMode') === 'permanent' ? 'permanent' : 'guest',
      accountSessionToken: sessionStorage.getItem('chatAccountSessionToken') || '',
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
      uidTTL: 0,
      webrtc: {
        pc: null,
        localStream: null,
        remoteStream: null,
        androidScreenSource: null,
        screenSource: null,
        screenShareActive: false,
        micAudioTrack: null,
        systemAudioTrack: null,
        callState: 'idle',
        callType: null,
        forceRelay: localStorage.getItem('forceRelay') === 'true',
        qualityProfile: loadCallQualityProfile(),
        activeQualityProfile: 'auto',
        echoCancellation: loadEnabledPreference('callEchoCancellation'),
        noiseSuppression: loadEnabledPreference('callNoiseSuppression'),
        autoGainControl: loadEnabledPreference('callAutoGainControl'),
        activeIceTransportPolicy: 'all',
        isMuted: false,
        isVideoOff: false,
        pendingCandidates: [],
        prePcCandidates: [],
        callStartTime: null,
        callPeerId: null
      }
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
