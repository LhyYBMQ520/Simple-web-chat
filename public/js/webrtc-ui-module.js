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

      // 清除上一次通话的连接信息残留，避免显示旧模式（如"UDP中继"）
      var connInfo = document.getElementById('callConnInfo');
      if (connInfo) {
        connInfo.innerHTML = '';
        connInfo.style.display = 'none';
      }

      var isVideo = callType === 'video' || callType === 'screen';

      var remoteVideo = document.getElementById('remoteVideo');
      var localVideo = document.getElementById('localVideo');
      var muteBtn = document.getElementById('callMuteBtn');
      var videoBtn = document.getElementById('callVideoBtn');
      var cameraSwitchBtn = document.getElementById('callCameraSwitchBtn');
      var audioOutputBtn = document.getElementById('callAudioOutputBtn');
      var screenBtn = document.getElementById('callScreenBtn');

      if (remoteVideo) remoteVideo.style.display = isVideo ? 'block' : 'none';
      if (localVideo) {
        localVideo.className = callType === 'screen'
          ? 'call-local-video call-local-video-screen'
          : 'call-local-video';
        localVideo.style.display = localVideo.srcObject && localVideo.srcObject.getVideoTracks().length > 0
          ? 'block'
          : 'none';
      }

      if (videoBtn) {
        videoBtn.style.display = callType === 'video' ? 'flex' : 'none';
      }
      if (screenBtn) {
        screenBtn.style.display = 'none';
      }
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (audioOutputBtn) audioOutputBtn.style.display = 'flex';

      // 每次打开通话界面时重置控制按钮状态，避免上次通话的残留 UI 状态
      if (muteBtn) {
        muteBtn.className = 'call-ctrl-btn';
        muteBtn.title = '静音';
        muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      }
      if (videoBtn && callType === 'video') {
        videoBtn.className = 'call-ctrl-btn';
        videoBtn.title = '关闭摄像头';
        videoBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
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

      // 清除连接信息，防止下次通话显示旧模式
      var connInfo = document.getElementById('callConnInfo');
      if (connInfo) {
        connInfo.innerHTML = '';
        connInfo.style.display = 'none';
      }

      // Clean up video elements
      var remoteVideo = document.getElementById('remoteVideo');
      var localVideo = document.getElementById('localVideo');
      if (remoteVideo) { remoteVideo.srcObject = null; }
      if (localVideo) { localVideo.srcObject = null; }
      var cameraSwitchBtn = document.getElementById('callCameraSwitchBtn');
      var audioOutputBtn = document.getElementById('callAudioOutputBtn');
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (audioOutputBtn) audioOutputBtn.style.display = 'none';
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
        video.style.display = (stream.getVideoTracks().length > 0) ? 'block' : 'none';
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

    function updateCameraSwitchAvailability(available) {
      var btn = document.getElementById('callCameraSwitchBtn');
      if (!btn) return;
      btn.style.display = available ? 'flex' : 'none';
      btn.disabled = false;
    }

    function setCameraSwitching(isSwitching) {
      var btn = document.getElementById('callCameraSwitchBtn');
      if (!btn) return;
      btn.disabled = Boolean(isSwitching);
      btn.title = isSwitching
        ? '正在切换摄像头...'
        : (btn.dataset.switchTitle || '切换前后摄像头');
    }

    function updateCameraFacingMode(facingMode) {
      var btn = document.getElementById('callCameraSwitchBtn');
      if (!btn) return;
      btn.dataset.switchTitle = facingMode === 'environment' ? '切换到前置摄像头' : '切换到后置摄像头';
      btn.title = btn.dataset.switchTitle;
    }

    function switchAudioOutput() {
      var media = document.getElementById('remoteVideo');
      if (!media || typeof media.setSinkId !== 'function') {
        return Promise.reject(new Error('当前浏览器不允许网页切换听筒/免提，请使用系统音频输出设置'));
      }
      if (!navigator.mediaDevices) {
        return Promise.reject(new Error('当前浏览器无法获取音频输出设备'));
      }

      var selectedDevicePromise;
      if (typeof navigator.mediaDevices.selectAudioOutput === 'function') {
        selectedDevicePromise = navigator.mediaDevices.selectAudioOutput();
      } else if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
        selectedDevicePromise = navigator.mediaDevices.enumerateDevices().then(function (devices) {
          var outputs = devices.filter(function (device) { return device.kind === 'audiooutput'; });
          if (outputs.length < 2) {
            throw new Error('当前浏览器未提供可切换的听筒/免提输出');
          }
          var currentIndex = outputs.findIndex(function (device) { return device.deviceId === media.sinkId; });
          if (currentIndex < 0) {
            var nonDefaultIndex = outputs.findIndex(function (device) {
              return device.deviceId && device.deviceId !== 'default';
            });
            return outputs[nonDefaultIndex >= 0 ? nonDefaultIndex : 0];
          }
          return outputs[(currentIndex + 1) % outputs.length];
        });
      } else {
        selectedDevicePromise = Promise.reject(new Error('当前浏览器无法枚举音频输出设备'));
      }

      return selectedDevicePromise.then(function (device) {
        return media.setSinkId(device.deviceId).then(function () {
          var btn = document.getElementById('callAudioOutputBtn');
          var label = device.label || '音频输出';
          if (btn) btn.title = '当前：' + label + '（点击切换）';
          return label;
        });
      }).catch(function (err) {
        if (err && err.name === 'NotAllowedError') {
          throw new Error('请允许选择音频输出设备后重试');
        }
        throw err;
      });
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
      var cameraSwitchBtn = document.getElementById('callCameraSwitchBtn');
      var audioOutputBtn = document.getElementById('callAudioOutputBtn');
      var screenBtn = document.getElementById('callScreenBtn');

      if (remoteVideo) remoteVideo.style.display = 'none';
      if (localVideo) localVideo.style.display = 'none';
      if (videoBtn) videoBtn.style.display = 'none';
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (audioOutputBtn) audioOutputBtn.style.display = 'none';
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

      var cameraSwitchBtn = document.getElementById('callCameraSwitchBtn');
      var audioOutputBtn = document.getElementById('callAudioOutputBtn');
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (audioOutputBtn) audioOutputBtn.style.display = 'none';

      updateStatusText(typeLabel + '来电...');
      var dur = document.getElementById('callDuration');
      if (dur) dur.textContent = '';
    }

    function showError(message) {
      alert(message);
    }

    function formatBitrate(kbps) {
      if (typeof kbps !== 'number' || kbps < 0) return '';
      return kbps >= 1000 ? (Math.round(kbps / 100) / 10) + 'Mbps' : kbps + 'kbps';
    }

    function updateConnectionInfo(modeLabel, modeClass, rttMs, qualityStats) {
      var el = document.getElementById('callConnInfo');
      if (!el) return;
      el.style.display = 'flex';
      var html = '<span class="call-conn-mode ' + modeClass + '">' + modeLabel + '</span>';
      if (typeof rttMs === 'number' && rttMs >= 0) {
        html += '<span>' + rttMs + 'ms</span>';
      }
      if (qualityStats) {
        var details = [];
        if (qualityStats.profileLabel) details.push(qualityStats.profileLabel);
        if (qualityStats.width && qualityStats.height) {
          var videoText = qualityStats.width + '×' + qualityStats.height;
          if (qualityStats.fps) videoText += ' ' + qualityStats.fps + 'fps';
          if (typeof qualityStats.videoKbps === 'number') videoText += ' ' + formatBitrate(qualityStats.videoKbps);
          details.push(videoText);
        } else if (typeof qualityStats.videoKbps === 'number') {
          details.push('视频 ' + formatBitrate(qualityStats.videoKbps));
        }
        if (typeof qualityStats.audioKbps === 'number') details.push('音频 ' + formatBitrate(qualityStats.audioKbps));
        details.push(typeof qualityStats.lossPercent === 'number'
          ? '丢包 ' + qualityStats.lossPercent + '%'
          : '丢包 --');
        if (typeof qualityStats.jitterMs === 'number') details.push('抖动 ' + qualityStats.jitterMs + 'ms');
        if (details.length > 0) {
          html += '<span class="call-quality-stats">' + details.join(' · ') + '</span>';
        }
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
      updateCameraSwitchAvailability: updateCameraSwitchAvailability,
      setCameraSwitching: setCameraSwitching,
      updateCameraFacingMode: updateCameraFacingMode,
      switchAudioOutput: switchAudioOutput,
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
