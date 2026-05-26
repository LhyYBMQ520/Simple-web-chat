(function initWebRTCUIModule(global) {
  function createWebRTCUIModule(options) {
    var callbacks = options.callbacks || {};

    var durationTimer = null;
    var durationSeconds = 0;

    function getOverlay() {
      return document.getElementById('callOverlay');
    }

    function getPrompt() {
      return document.getElementById('callIncomingPrompt');
    }

    function showOverlay(callType) {
      var overlay = getOverlay();
      if (!overlay) return;

      overlay.style.display = 'flex';
      overlay.className = 'call-overlay';

      var isVideo = callType === 'video' || callType === 'screen';

      var remoteVideo = document.getElementById('remoteVideo');
      var localVideo = document.getElementById('localVideo');
      var muteBtn = document.getElementById('callMuteBtn');
      var videoBtn = document.getElementById('callVideoBtn');
      var screenBtn = document.getElementById('callScreenBtn');

      if (remoteVideo) remoteVideo.style.display = isVideo ? 'block' : 'none';
      if (localVideo) localVideo.style.display = callType === 'video' ? 'block' : 'none';

      if (videoBtn) {
        videoBtn.style.display = (callType === 'video' || callType === 'screen') ? 'flex' : 'none';
      }
      if (screenBtn) {
        screenBtn.style.display = 'none';
      }

      updateStatusText(callType === 'audio' ? '语音通话中' : callType === 'video' ? '视频通话中' : '屏幕共享中');

      // Start duration timer
      durationSeconds = 0;
      updateDurationDisplay();
      startDurationTimer();
    }

    function hideOverlay() {
      var overlay = getOverlay();
      if (overlay) {
        overlay.style.display = 'none';
      }
      stopDurationTimer();

      // Clean up video elements
      var remoteVideo = document.getElementById('remoteVideo');
      var localVideo = document.getElementById('localVideo');
      if (remoteVideo) { remoteVideo.srcObject = null; }
      if (localVideo) { localVideo.srcObject = null; }
    }

    function updateStatusText(text) {
      var el = document.getElementById('callStatusText');
      if (el) el.textContent = text;
    }

    function updateDurationDisplay() {
      var el = document.getElementById('callDuration');
      if (el) {
        var m = Math.floor(durationSeconds / 60);
        var s = durationSeconds % 60;
        el.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
      }
    }

    function startDurationTimer() {
      stopDurationTimer();
      durationTimer = setInterval(function () {
        durationSeconds++;
        updateDurationDisplay();
      }, 1000);
    }

    function stopDurationTimer() {
      if (durationTimer) {
        clearInterval(durationTimer);
        durationTimer = null;
      }
    }

    function setRemoteVideo(stream) {
      var video = document.getElementById('remoteVideo');
      if (video) {
        video.srcObject = stream;
      }
    }

    function setLocalVideo(stream) {
      var video = document.getElementById('localVideo');
      if (video) {
        video.srcObject = stream;
      }
    }

    function updateMuteButton(isMuted) {
      var btn = document.getElementById('callMuteBtn');
      if (!btn) return;
      if (isMuted) {
        btn.className = 'call-ctrl-btn muted';
        btn.title = '取消静音';
        btn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
      } else {
        btn.className = 'call-ctrl-btn';
        btn.title = '静音';
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      }
    }

    function updateVideoButton(isVideoOff) {
      var btn = document.getElementById('callVideoBtn');
      if (!btn) return;
      if (isVideoOff) {
        btn.className = 'call-ctrl-btn video-off';
        btn.title = '开启摄像头';
        btn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
      } else {
        btn.className = 'call-ctrl-btn';
        btn.title = '关闭摄像头';
        btn.innerHTML = '<i class="fa-solid fa-video"></i>';
      }
    }

    function updateScreenShareButton(isSharing) {
      var btn = document.getElementById('callScreenBtn');
      if (!btn) return;
      if (isSharing) {
        btn.style.display = 'flex';
        btn.title = '停止屏幕共享';
        btn.innerHTML = '<i class="fa-solid fa-desktop"></i>';
      } else {
        btn.style.display = 'none';
      }
    }

    function showIncomingCallPrompt(fromId, callType) {
      var prompt = getPrompt();
      if (!prompt) return;

      var typeLabel = callType === 'audio' ? '语音通话' : callType === 'video' ? '视频通话' : '屏幕共享';
      var typeIcon = callType === 'audio' ? 'fa-phone' : callType === 'video' ? 'fa-video' : 'fa-desktop';

      prompt.innerHTML = '' +
        '<div class="call-incoming-header"><i class="fa-solid ' + typeIcon + '"></i> 收到' + typeLabel + '请求</div>' +
        '<div class="call-incoming-id">来自: ' + fromId + '</div>' +
        '<div class="call-incoming-actions">' +
          '<button class="call-incoming-accept" id="callAcceptBtn" title="接听"><i class="fa-solid fa-phone"></i></button>' +
          '<button class="call-incoming-reject" id="callRejectBtn" title="拒绝"><i class="fa-solid fa-phone-slash"></i></button>' +
        '</div>';

      prompt.style.display = 'flex';

      document.getElementById('callAcceptBtn').onclick = function () {
        hideIncomingCallPrompt();
        if (callbacks.onAccept) callbacks.onAccept();
      };

      document.getElementById('callRejectBtn').onclick = function () {
        hideIncomingCallPrompt();
        if (callbacks.onReject) callbacks.onReject();
      };

      // Auto dismiss after 45 seconds
      setTimeout(function () {
        if (getPrompt() && getPrompt().style.display !== 'none') {
          hideIncomingCallPrompt();
          if (callbacks.onReject) callbacks.onReject();
        }
      }, 45000);
    }

    function hideIncomingCallPrompt() {
      var prompt = getPrompt();
      if (prompt) {
        prompt.style.display = 'none';
        prompt.innerHTML = '';
      }
    }

    function showCallingStatus(callType) {
      var typeLabel = callType === 'audio' ? '语音通话' : callType === 'video' ? '视频通话' : '屏幕共享';
      var overlay = getOverlay();
      if (!overlay) return;

      overlay.style.display = 'flex';
      overlay.className = 'call-overlay call-overlay-audio';

      var remoteVideo = document.getElementById('remoteVideo');
      var localVideo = document.getElementById('localVideo');
      var videoBtn = document.getElementById('callVideoBtn');
      var screenBtn = document.getElementById('callScreenBtn');

      if (remoteVideo) remoteVideo.style.display = 'none';
      if (localVideo) localVideo.style.display = 'none';
      if (videoBtn) videoBtn.style.display = 'none';
      if (screenBtn) screenBtn.style.display = 'none';

      updateStatusText('正在呼叫... (' + typeLabel + ')');
      var dur = document.getElementById('callDuration');
      if (dur) dur.textContent = '';
    }

    function showRingingStatus(callType) {
      var typeLabel = callType === 'audio' ? '语音通话' : callType === 'video' ? '视频通话' : '屏幕共享';
      var overlay = getOverlay();
      if (!overlay) return;

      overlay.style.display = 'flex';
      overlay.className = 'call-overlay call-overlay-audio';

      updateStatusText(typeLabel + '来电...');
      var dur = document.getElementById('callDuration');
      if (dur) dur.textContent = '';
    }

    function showError(message) {
      alert(message);
    }

    function updateConnectionInfo(modeLabel, modeClass, rttMs) {
      var el = document.getElementById('callConnInfo');
      if (!el) return;
      el.style.display = 'flex';
      var html = '<span class="call-conn-mode ' + modeClass + '">' + modeLabel + '</span>';
      if (typeof rttMs === 'number' && rttMs >= 0) {
        html += '<span>' + rttMs + 'ms</span>';
      }
      el.innerHTML = html;
    }

    function hideConnectionInfo() {
      var el = document.getElementById('callConnInfo');
      if (el) el.style.display = 'none';
    }

    return {
      showOverlay: showOverlay,
      hideOverlay: hideOverlay,
      updateStatusText: updateStatusText,
      setRemoteVideo: setRemoteVideo,
      setLocalVideo: setLocalVideo,
      updateMuteButton: updateMuteButton,
      updateVideoButton: updateVideoButton,
      updateScreenShareButton: updateScreenShareButton,
      showIncomingCallPrompt: showIncomingCallPrompt,
      hideIncomingCallPrompt: hideIncomingCallPrompt,
      showCallingStatus: showCallingStatus,
      showRingingStatus: showRingingStatus,
      showError: showError,
      updateConnectionInfo: updateConnectionInfo,
      hideConnectionInfo: hideConnectionInfo
    };
  }

  global.ChatWebRTCUIModule = {
    createWebRTCUIModule: createWebRTCUIModule
  };
})(window);
