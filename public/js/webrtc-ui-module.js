(function initWebRTCUIModule(global) {
  function createWebRTCUIModule(options) {
    var callbacks = options.callbacks || {};

    var durationTimer = null;
    var durationSeconds = 0;
    var currentCallType = null;
    var currentWindowMode = 'normal';
    var hasRemoteVideo = false;
    var hasLocalVideo = false;
    var videoAspectListenersBound = false;
    var fullscreenListenersBound = false;

    function getOverlay() {
      return document.getElementById('callOverlay');
    }

    function getPrompt() {
      return document.getElementById('callIncomingPrompt');
    }

    function updatePeerLabel(peerLabel) {
      var el = document.getElementById('callPeerLabel');
      if (el) el.textContent = peerLabel || '';
    }

    function updateScreenVideoRole() {
      var overlay = getOverlay();
      if (!overlay || !overlay.classList) return;
      overlay.classList.toggle(
        'call-screen-local-source',
        currentCallType === 'screen' && hasLocalVideo && !hasRemoteVideo
      );
      updateFullscreenButtonState();
      updateMinimizedVideoSize();
    }

    function updateFullscreenButtonState() {
      var overlay = getOverlay();
      var button = document.getElementById('callFocusBtn');
      if (!overlay || !button) return;

      var isVideoCall = currentCallType === 'video' || currentCallType === 'screen';
      var isLocalScreenSource = currentCallType === 'screen' && hasLocalVideo;
      var isAvailable = isVideoCall && isFullscreenSupported(overlay);
      var label = isLocalScreenSource
        ? '共享发起方不能全屏预览，避免画面递归嵌套'
        : '浏览器全屏显示主画面';

      button.style.display = isAvailable ? 'flex' : 'none';
      button.disabled = !isAvailable || isLocalScreenSource;
      button.title = label;
      button.setAttribute('aria-label', label);
    }

    function getMainVideoElement() {
      if (currentCallType === 'screen' && hasLocalVideo && !hasRemoteVideo) {
        return document.getElementById('localVideo');
      }
      return document.getElementById('remoteVideo');
    }

    function updateMinimizedVideoSize() {
      var overlay = getOverlay();
      if (!overlay || !overlay.style || (currentCallType !== 'video' && currentCallType !== 'screen')) return;

      var video = getMainVideoElement();
      var sourceWidth = video && Number(video.videoWidth);
      var sourceHeight = video && Number(video.videoHeight);
      var hasVideoSize = sourceWidth > 0 && sourceHeight > 0;
      var ratio = hasVideoSize ? sourceWidth / sourceHeight : 16 / 9;
      ratio = Math.max(0.25, Math.min(4, ratio));

      var viewportWidth = Number(global.innerWidth) || 360;
      var viewportHeight = Number(global.innerHeight) || 640;
      var maxWidth = Math.min(360, Math.max(160, viewportWidth - 24));
      var maxHeight = Math.min(480, Math.max(120, viewportHeight - 24), Math.max(120, viewportHeight * 0.7));
      var width = maxWidth;
      var height = width / ratio;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }

      overlay.style.setProperty('--call-mini-width', Math.round(width) + 'px');
      overlay.style.setProperty('--call-mini-height', Math.round(height) + 'px');
      overlay.style.setProperty('--call-mini-aspect-ratio', hasVideoSize ? sourceWidth + ' / ' + sourceHeight : '16 / 9');
    }

    function bindVideoAspectListeners() {
      if (videoAspectListenersBound) return;
      videoAspectListenersBound = true;
      ['remoteVideo', 'localVideo'].forEach(function (id) {
        var video = document.getElementById(id);
        if (!video || typeof video.addEventListener !== 'function') return;
        video.addEventListener('loadedmetadata', updateMinimizedVideoSize);
        video.addEventListener('resize', updateMinimizedVideoSize);
      });
      if (typeof global.addEventListener === 'function') {
        global.addEventListener('resize', updateMinimizedVideoSize);
      }
    }

    function getFullscreenElement() {
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function isFullscreenSupported(overlay) {
      if (!overlay) return false;
      if (typeof overlay.requestFullscreen === 'function') return document.fullscreenEnabled !== false;
      return typeof overlay.webkitRequestFullscreen === 'function';
    }

    function requestOverlayFullscreen(overlay) {
      try {
        var result;
        if (typeof overlay.requestFullscreen === 'function') {
          result = overlay.requestFullscreen();
        } else if (typeof overlay.webkitRequestFullscreen === 'function') {
          result = overlay.webkitRequestFullscreen();
        } else {
          return Promise.resolve(false);
        }
        return result && typeof result.then === 'function' ? result.then(function () { return true; }) : Promise.resolve(true);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    function exitBrowserFullscreen() {
      if (!getFullscreenElement()) return Promise.resolve(true);
      try {
        var result;
        if (typeof document.exitFullscreen === 'function') {
          result = document.exitFullscreen();
        } else if (typeof document.webkitExitFullscreen === 'function') {
          result = document.webkitExitFullscreen();
        } else {
          return Promise.resolve(false);
        }
        return result && typeof result.then === 'function' ? result.then(function () { return true; }) : Promise.resolve(true);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    function handleFullscreenChange() {
      var overlay = getOverlay();
      if (!overlay || !currentCallType) return;
      if (getFullscreenElement() === overlay) {
        if (currentWindowMode !== 'focus') setWindowMode('focus');
      } else if (currentWindowMode === 'focus') {
        setWindowMode('normal');
      }
    }

    function bindFullscreenListeners() {
      if (fullscreenListenersBound || typeof document.addEventListener !== 'function') return;
      fullscreenListenersBound = true;
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    }

    function setWindowMode(mode) {
      var overlay = getOverlay();
      if (!overlay || !currentCallType) return false;
      if (mode === 'focus' && currentCallType === 'audio') return false;
      currentWindowMode = mode === 'minimized' || mode === 'focus' ? mode : 'normal';
      hideAudioOutputMenu();
      overlay.className = 'call-overlay call-type-' + currentCallType + ' call-window-' + currentWindowMode;
      updateScreenVideoRole();
      return true;
    }

    function minimizeCallWindow() {
      if (getFullscreenElement()) {
        return exitBrowserFullscreen().catch(function () { return false; }).then(function () {
          return setWindowMode('minimized');
        });
      }
      return setWindowMode('minimized');
    }

    function restoreCallWindow() {
      if (getFullscreenElement()) {
        return exitBrowserFullscreen().catch(function (err) {
          console.warn('[通话全屏] 退出失败:', err);
          return false;
        }).then(function () {
          return setWindowMode('normal');
        });
      }
      return setWindowMode('normal');
    }

    function focusCallVideo() {
      var overlay = getOverlay();
      var isLocalScreenSource = currentCallType === 'screen' && hasLocalVideo;
      if (!overlay || currentCallType === 'audio' || isLocalScreenSource || !isFullscreenSupported(overlay)) {
        return Promise.resolve(false);
      }
      setWindowMode('focus');
      return requestOverlayFullscreen(overlay).catch(function (err) {
        console.warn('[通话全屏] 浏览器拒绝进入全屏:', err);
        setWindowMode('normal');
        return false;
      });
    }

    function showOverlay(callType, peerLabel) {
      var overlay = getOverlay();
      if (!overlay) return;

      overlay.style.display = 'flex';
      currentCallType = callType;
      bindVideoAspectListeners();
      bindFullscreenListeners();
      updatePeerLabel(peerLabel);
      setWindowMode('normal');

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
      var videoContainer = document.getElementById('callVideoContainer');

      if (remoteVideo) remoteVideo.style.display = isVideo ? 'block' : 'none';
      if (videoContainer) videoContainer.style.display = isVideo ? 'block' : 'none';
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
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (audioOutputBtn) audioOutputBtn.style.display = 'flex';
      updateFullscreenButtonState();
      updateMinimizedVideoSize();

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
      hideAudioOutputMenu();
      var overlay = getOverlay();
      if (overlay && getFullscreenElement() === overlay) {
        exitBrowserFullscreen().catch(function () {});
      }
      if (overlay) {
        overlay.style.display = 'none';
        overlay.className = 'call-overlay';
        if (overlay.style && typeof overlay.style.removeProperty === 'function') {
          overlay.style.removeProperty('--call-mini-width');
          overlay.style.removeProperty('--call-mini-height');
          overlay.style.removeProperty('--call-mini-aspect-ratio');
        }
      }
      stopDurationTimer();
      currentCallType = null;
      currentWindowMode = 'normal';
      hasRemoteVideo = false;
      hasLocalVideo = false;
      updatePeerLabel('');

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
      var videoContainer = document.getElementById('callVideoContainer');
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (audioOutputBtn) audioOutputBtn.style.display = 'none';
      if (videoContainer) videoContainer.style.display = 'none';
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
      hasRemoteVideo = Boolean(stream && stream.getVideoTracks && stream.getVideoTracks().length > 0);
      if (video) {
        video.srcObject = stream;
      }
      updateScreenVideoRole();
    }

    function setLocalVideo(stream) {
      var video = document.getElementById('localVideo');
      hasLocalVideo = Boolean(stream && stream.getVideoTracks && stream.getVideoTracks().length > 0);
      if (video) {
        video.srcObject = stream;
        video.style.display = hasLocalVideo ? 'block' : 'none';
      }
      updateScreenVideoRole();
    }

    function showScreenShareEnded() {
      var overlay = getOverlay();
      if (!overlay) return;
      currentCallType = 'audio';
      overlay.className = overlay.className.replace(/\bcall-type-(audio|video|screen)\b/g, 'call-type-audio');
      var remoteVideo = document.getElementById('remoteVideo');
      var localVideo = document.getElementById('localVideo');
      var videoBtn = document.getElementById('callVideoBtn');
      var cameraSwitchBtn = document.getElementById('callCameraSwitchBtn');
      var videoContainer = document.getElementById('callVideoContainer');
      if (remoteVideo) remoteVideo.style.display = 'none';
      if (localVideo) localVideo.style.display = 'none';
      if (videoBtn) videoBtn.style.display = 'none';
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (videoContainer) videoContainer.style.display = 'none';
      updateStatusText('语音通话中');
      updateFullscreenButtonState();
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

    function getAudioOutputElements() {
      return {
        media: document.getElementById('remoteVideo'),
        button: document.getElementById('callAudioOutputBtn'),
        menu: document.getElementById('callAudioOutputMenu')
      };
    }

    function hideAudioOutputMenu() {
      var elements = getAudioOutputElements();
      if (elements.menu) elements.menu.style.display = 'none';
      if (elements.button) elements.button.setAttribute('aria-expanded', 'false');
    }

    function showAudioOutputMessage(message) {
      var elements = getAudioOutputElements();
      if (!elements.menu) return;
      elements.menu.innerHTML = '';
      var item = document.createElement('div');
      item.className = 'call-audio-output-message';
      item.textContent = message;
      elements.menu.appendChild(item);
      elements.menu.style.display = 'block';
      if (elements.button) elements.button.setAttribute('aria-expanded', 'true');
    }

    function applyAudioOutput(device) {
      var elements = getAudioOutputElements();
      if (!elements.media || typeof elements.media.setSinkId !== 'function') {
        return Promise.reject(new Error('当前浏览器不允许网页切换听筒/免提，请使用系统音频输出设置'));
      }
      return elements.media.setSinkId(device.deviceId).then(function () {
        var label = device.label || '音频输出';
        if (elements.button) elements.button.title = '当前：' + label;
        hideAudioOutputMenu();
        return label;
      });
    }

    function createAudioOutputOption(device, index, currentSinkId) {
      var item = document.createElement('button');
      var isActive = device.deviceId === currentSinkId || (!currentSinkId && device.deviceId === 'default');
      item.type = 'button';
      item.className = 'call-audio-output-option' + (isActive ? ' active' : '');
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(isActive));

      var icon = document.createElement('i');
      icon.className = 'fa-solid ' + (isActive ? 'fa-check' : 'fa-volume-high');
      var label = document.createElement('span');
      label.textContent = device.label || ('音频输出 ' + (index + 1));
      item.appendChild(icon);
      item.appendChild(label);
      item.onclick = function (event) {
        event.stopPropagation();
        applyAudioOutput(device).catch(function (err) {
          showAudioOutputMessage(err && err.message ? err.message : '音频输出切换失败');
        });
      };
      return item;
    }

    function renderAudioOutputMenu() {
      var elements = getAudioOutputElements();
      if (!elements.menu || !elements.button) return Promise.resolve(false);
      if (!elements.media || typeof elements.media.setSinkId !== 'function') {
        showAudioOutputMessage('当前浏览器不允许网页切换听筒/免提，请使用系统音频输出设置');
        return Promise.resolve(false);
      }
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
        showAudioOutputMessage('当前浏览器无法枚举音频输出设备');
        return Promise.resolve(false);
      }

      return navigator.mediaDevices.enumerateDevices().then(function (devices) {
        var outputs = devices.filter(function (device) { return device.kind === 'audiooutput'; });
        elements.menu.innerHTML = '';
        outputs.forEach(function (device, index) {
          elements.menu.appendChild(createAudioOutputOption(device, index, elements.media.sinkId));
        });

        if (typeof navigator.mediaDevices.selectAudioOutput === 'function') {
          var systemPicker = document.createElement('button');
          systemPicker.type = 'button';
          systemPicker.className = 'call-audio-output-option';
          systemPicker.innerHTML = '<i class="fa-solid fa-ellipsis"></i><span>选择其他输出设备...</span>';
          systemPicker.onclick = function (event) {
            event.stopPropagation();
            navigator.mediaDevices.selectAudioOutput().then(applyAudioOutput).catch(function (err) {
              var message = err && err.name === 'NotAllowedError'
                ? '已取消或未允许选择音频输出设备'
                : (err && err.message ? err.message : '音频输出选择失败');
              showAudioOutputMessage(message);
            });
          };
          elements.menu.appendChild(systemPicker);
        }

        if (elements.menu.children.length === 0) {
          showAudioOutputMessage('当前浏览器未提供可切换的听筒/免提输出');
          return false;
        }
        elements.menu.style.display = 'block';
        elements.button.setAttribute('aria-expanded', 'true');
        return true;
      }).catch(function (err) {
        showAudioOutputMessage(err && err.message ? err.message : '音频输出设备获取失败');
        return false;
      });
    }

    function toggleAudioOutputMenu() {
      var elements = getAudioOutputElements();
      if (!elements.menu) return Promise.resolve(false);
      if (elements.menu.style.display !== 'none') {
        hideAudioOutputMenu();
        return Promise.resolve(false);
      }
      return renderAudioOutputMenu();
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

    function showCallingStatus(callType, peerLabel) {
      hideAudioOutputMenu();
      var typeLabel = callType === 'audio' ? '语音通话' : callType === 'video' ? '视频通话' : '屏幕共享';
      var overlay = getOverlay();
      if (!overlay) return;

      overlay.style.display = 'flex';
      currentCallType = callType;
      currentWindowMode = 'normal';
      updatePeerLabel(peerLabel);
      overlay.className = 'call-overlay call-type-' + callType + ' call-window-normal call-state-pending';

      var remoteVideo = document.getElementById('remoteVideo');
      var localVideo = document.getElementById('localVideo');
      var videoBtn = document.getElementById('callVideoBtn');
      var cameraSwitchBtn = document.getElementById('callCameraSwitchBtn');
      var audioOutputBtn = document.getElementById('callAudioOutputBtn');
      var videoContainer = document.getElementById('callVideoContainer');

      if (remoteVideo) remoteVideo.style.display = 'none';
      if (localVideo) localVideo.style.display = 'none';
      if (videoBtn) videoBtn.style.display = 'none';
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (audioOutputBtn) audioOutputBtn.style.display = 'none';
      if (videoContainer) videoContainer.style.display = 'none';

      updateStatusText('正在呼叫... (' + typeLabel + ')');
      var dur = document.getElementById('callDuration');
      if (dur) dur.textContent = '';
    }

    function showRingingStatus(callType, peerLabel) {
      hideAudioOutputMenu();
      var typeLabel = callType === 'audio' ? '语音通话' : callType === 'video' ? '视频通话' : '屏幕共享';
      var overlay = getOverlay();
      if (!overlay) return;

      overlay.style.display = 'flex';
      currentCallType = callType;
      currentWindowMode = 'normal';
      updatePeerLabel(peerLabel);
      overlay.className = 'call-overlay call-type-' + callType + ' call-window-normal call-state-pending';

      var cameraSwitchBtn = document.getElementById('callCameraSwitchBtn');
      var audioOutputBtn = document.getElementById('callAudioOutputBtn');
      var videoContainer = document.getElementById('callVideoContainer');
      if (cameraSwitchBtn) cameraSwitchBtn.style.display = 'none';
      if (audioOutputBtn) audioOutputBtn.style.display = 'none';
      if (videoContainer) videoContainer.style.display = 'none';

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
        if (qualityStats.limitationReason) {
          var limitationLabels = { cpu: 'CPU 限制', bandwidth: '带宽限制', other: '系统限制' };
          details.push(limitationLabels[qualityStats.limitationReason] || ('质量限制 ' + qualityStats.limitationReason));
        }
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
      minimizeCallWindow: minimizeCallWindow,
      restoreCallWindow: restoreCallWindow,
      focusCallVideo: focusCallVideo,
      updateStatusText: updateStatusText,
      setRemoteVideo: setRemoteVideo,
      setLocalVideo: setLocalVideo,
      showScreenShareEnded: showScreenShareEnded,
      updateMuteButton: updateMuteButton,
      updateVideoButton: updateVideoButton,
      updateCameraSwitchAvailability: updateCameraSwitchAvailability,
      setCameraSwitching: setCameraSwitching,
      updateCameraFacingMode: updateCameraFacingMode,
      toggleAudioOutputMenu: toggleAudioOutputMenu,
      hideAudioOutputMenu: hideAudioOutputMenu,
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
