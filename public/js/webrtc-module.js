(function initWebRTCModule(global) {
  function createWebRTCModule(options) {
    const { state, wsModule, handlers } = options;
    const wrtc = state.webrtc;
    var disconnectTimer = null;
    var restartRetryTimer = null;
    var restartInProgress = false;
    var makingOffer = false;
    var ignoreOffer = false;
    var settingRemoteDescription = false;
    var bufferLocalCandidates = false;
    var bufferedLocalCandidates = [];
    var remoteRelayProtocols = Object.create(null);
    var hasConnectedOnce = false;
    var cameraFacingMode = 'user';
    var cameraSwitchInProgress = false;
    var connectionStatusPending = false;
    var SCREEN_SHARE_UNSUPPORTED_MESSAGE = '当前浏览器/系统未作兼容，或当前浏览器/系统不支持此功能。';
    var QUALITY_PROFILES = {
      auto: {
        label: '自动', audioBitrate: null,
        camera: { width: 1280, height: 720, frameRate: 30, maxBitrate: null },
        screen: { width: 1920, height: 1080, frameRate: 30, maxBitrate: null }
      },
      low: {
        label: '省流', audioBitrate: 32000,
        camera: { width: 854, height: 480, frameRate: 15, maxBitrate: 800000 },
        screen: { width: 1280, height: 720, frameRate: 15, maxBitrate: 1500000 }
      },
      standard: {
        label: '标准', audioBitrate: 48000,
        camera: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2500000 },
        screen: { width: 1920, height: 1080, frameRate: 15, maxBitrate: 3500000 }
      },
      high: {
        label: '高清', audioBitrate: 96000,
        camera: { width: 1920, height: 1080, frameRate: 60, maxBitrate: 10000000 },
        screen: { width: 1920, height: 1080, frameRate: 60, maxBitrate: 12000000 }
      }
    };

    function getIceServers() {
      if (window.__CHAT_CONFIG__ && window.__CHAT_CONFIG__.webrtc && window.__CHAT_CONFIG__.webrtc.iceServers) {
        return window.__CHAT_CONFIG__.webrtc.iceServers;
      }
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }

    function isTurnConfigured() {
      var config = window.__CHAT_CONFIG__ && window.__CHAT_CONFIG__.webrtc;
      if (config && typeof config.turnConfigured === 'boolean') {
        return config.turnConfigured;
      }
      return getIceServers().some(function (server) {
        var urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some(function (url) { return /^turns?:/i.test(String(url || '')); });
      });
    }

    function setForceRelay(enabled) {
      if (wrtc.callState !== 'idle') return false;
      if (enabled && !isTurnConfigured()) return false;
      wrtc.forceRelay = Boolean(enabled);
      localStorage.setItem('forceRelay', String(wrtc.forceRelay));
      return true;
    }

    function setQualityProfile(profileName) {
      if (wrtc.callState !== 'idle') return false;
      if (!QUALITY_PROFILES[profileName]) return false;
      wrtc.qualityProfile = profileName;
      localStorage.setItem('callQualityProfile', profileName);
      return true;
    }

    function setAudioProcessing(settingName, enabled) {
      if (wrtc.callState !== 'idle') return false;
      var storageKeys = {
        echoCancellation: 'callEchoCancellation',
        noiseSuppression: 'callNoiseSuppression',
        autoGainControl: 'callAutoGainControl'
      };
      if (!storageKeys[settingName]) return false;
      wrtc[settingName] = Boolean(enabled);
      localStorage.setItem(storageKeys[settingName], String(wrtc[settingName]));
      return true;
    }

    function getActiveQualityProfile() {
      return QUALITY_PROFILES[wrtc.activeQualityProfile] || QUALITY_PROFILES.standard;
    }

    if (wrtc.forceRelay && !isTurnConfigured()) {
      wrtc.forceRelay = false;
      localStorage.setItem('forceRelay', 'false');
    }
    if (!QUALITY_PROFILES[wrtc.qualityProfile]) {
      wrtc.qualityProfile = 'standard';
      localStorage.setItem('callQualityProfile', 'standard');
    }

    function createPeerConnection(iceTransportPolicy) {
      var transportPolicy = iceTransportPolicy === 'relay' ? 'relay' : 'all';
      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
        iceTransportPolicy: transportPolicy,
        iceCandidatePoolSize: 1
      });
      console.log('[WebRTC] ICE 传输策略: ' + transportPolicy +
        (transportPolicy === 'relay' ? '（仅 TURN 中继）' : '（自动选择 LAN/P2P/TURN）'));

      pc.onicecandidate = function (event) {
        if (event.candidate && wrtc.callPeerId) {
          var cand = event.candidate.toJSON();
          // Parse candidate type and protocol from the candidate string
          // Format: "candidate:<foundation> <component> <protocol> <priority> <ip> <port> typ <type> ..."
          var candStr = event.candidate.candidate || '';
          var typMatch = candStr.match(/\btyp\s+(\S+)/i);
          var protoMatch = candStr.match(/^\S+\s+\S+\s+(\S+)/);
          if (typMatch) { cand.candidateType = typMatch[1]; }
          if (protoMatch) { cand.protocol = protoMatch[1]; }
          if (cand.candidateType === 'relay') {
            cand.relayProtocol = inferRelayProtocol(event.candidate, cand);
          }
          if (transportPolicy === 'relay' && cand.candidateType && cand.candidateType !== 'relay') {
            console.warn('[ICE 候选] 强制中继模式已丢弃非 relay 候选: ' + cand.candidateType);
            return;
          }
          if (bufferLocalCandidates) {
            bufferedLocalCandidates.push(cand);
          } else {
            wsModule.sendIceCandidate(wrtc.callPeerId, cand);
          }
        }
      };

      pc.ontrack = function (event) {
        if (event.streams && event.streams[0]) {
          if (!wrtc.remoteStream || wrtc.remoteStream !== event.streams[0]) {
            wrtc.remoteStream = event.streams[0];
            if (handlers.onRemoteStream) {
              handlers.onRemoteStream(event.streams[0]);
            }
          }
        }
      };

      pc.oniceconnectionstatechange = function () {
        console.log('[ICE 状态变更] ' + pc.iceConnectionState +
          ' | 本地候选: ' + (pc.localDescription ? pc.localDescription.type : 'none') +
          ' | 远端候选: ' + (pc.remoteDescription ? pc.remoteDescription.type : 'none'));

        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          showPendingConnectionState();
          scheduleIceRecovery(pc.iceConnectionState === 'failed' ? 0 : 1500);
        }
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          hasConnectedOnce = true;
          applyQualityToAllSenders();
          markConnectionReady();
          // Log the actual candidate pair being used
          pc.getStats(null).then(function (report) {
            report.forEach(function (stat) {
              if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
                var localCand = report.get(stat.localCandidateId);
                var remoteCand = report.get(stat.remoteCandidateId);
                var localType = localCand ? localCand.candidateType : '?';
                var remoteType = remoteCand ? remoteCand.candidateType : '?';
                var localProto = localCand ? (localCand.protocol || 'udp') : 'udp';
                var remoteProto = remoteCand ? (remoteCand.protocol || 'udp') : 'udp';
                var rtt = typeof stat.currentRoundTripTime === 'number' && stat.currentRoundTripTime > 0
                  ? Math.round(stat.currentRoundTripTime * 1000) + 'ms' : 'N/A';
                console.log('[ICE 连接建立] local: ' + localType + '/' + localProto +
                  ' | remote: ' + remoteType + '/' + remoteProto + ' | RTT: ' + rtt);
              }
            });
          }).catch(function () {});
        }
      };

      pc.onconnectionstatechange = function () {
        if (pc.connectionState === 'connected') {
          hasConnectedOnce = true;
          markConnectionReady();
        } else if ((pc.connectionState === 'disconnected' || pc.connectionState === 'failed') &&
            pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
          showPendingConnectionState();
          scheduleIceRecovery(pc.connectionState === 'failed' ? 0 : 1500);
        }
      };

      return pc;
    }

    function inferRelayProtocol(candidate, candidateJson) {
      var nativeRelayProtocol = String(candidate.relayProtocol || candidateJson.relayProtocol || '').toLowerCase();
      if (nativeRelayProtocol) return nativeRelayProtocol;
      var url = String(candidate.url || candidateJson.url || '').toLowerCase();
      var transportMatch = url.match(/[?&]transport=([^&]+)/);
      if (transportMatch) return transportMatch[1] === 'tcp' ? 'tcp' : 'udp';
      if (url.indexOf('turns:') === 0) return 'tls';
      return String(candidateJson.protocol || 'udp').toLowerCase();
    }

    function getCandidateFoundation(candidate) {
      if (candidate && candidate.foundation) return String(candidate.foundation);
      var match = String(candidate && candidate.candidate || '').match(/^candidate:([^\s]+)/i);
      return match ? match[1] : '';
    }

    function rememberRemoteRelayProtocol(candidate) {
      if (!candidate || candidate.candidateType !== 'relay' || !candidate.relayProtocol) return;
      var foundation = getCandidateFoundation(candidate);
      if (foundation) remoteRelayProtocols[foundation] = String(candidate.relayProtocol).toLowerCase();
    }

    function requestDisplayMedia(constraints) {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        var unsupportedError = new Error(SCREEN_SHARE_UNSUPPORTED_MESSAGE);
        unsupportedError.name = 'NotSupportedError';
        return Promise.reject(unsupportedError);
      }

      try {
        return Promise.resolve(navigator.mediaDevices.getDisplayMedia(constraints));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    function getScreenShareErrorMessage(err) {
      if (err && (
        err.name === 'NotSupportedError' ||
        err.name === 'SecurityError' ||
        err.name === 'TypeError'
      )) {
        return SCREEN_SHARE_UNSUPPORTED_MESSAGE;
      }
      if (err && err.name === 'NotAllowedError') {
        return '已取消屏幕共享，或未授予屏幕捕捉权限';
      }
      if (err && err.name === 'NotReadableError') {
        return '无法读取屏幕画面，请关闭其他屏幕录制应用后重试';
      }
      if (err && err.name === 'AbortError') {
        return '屏幕共享已取消';
      }
      if (err && err.name === 'InvalidStateError') {
        return '无法启动屏幕共享，请直接点击屏幕共享按钮后重试';
      }
      return '屏幕共享开启失败，请稍后重试';
    }

    function getSupportedMediaConstraints() {
      try {
        return navigator.mediaDevices && typeof navigator.mediaDevices.getSupportedConstraints === 'function'
          ? navigator.mediaDevices.getSupportedConstraints()
          : null;
      } catch (err) {
        return null;
      }
    }

    function createAudioConstraints() {
      var supported = getSupportedMediaConstraints();
      var constraints = {};
      function add(name, value) {
        if (!supported || supported[name]) constraints[name] = value;
      }
      add('echoCancellation', wrtc.echoCancellation !== false);
      add('noiseSuppression', wrtc.noiseSuppression !== false);
      add('autoGainControl', wrtc.autoGainControl !== false);
      add('channelCount', { ideal: 1 });
      add('sampleRate', { ideal: 48000 });
      add('sampleSize', { ideal: 16 });
      return constraints;
    }

    function createVideoConstraints(kind, facingMode) {
      var config = getActiveQualityProfile()[kind];
      var constraints = {
        width: { ideal: config.width, max: config.width },
        height: { ideal: config.height, max: config.height },
        frameRate: { ideal: config.frameRate, max: config.frameRate }
      };
      if (kind === 'camera') constraints.facingMode = { ideal: facingMode || cameraFacingMode || 'user' };
      return constraints;
    }

    function refreshCameraSwitchAvailability() {
      if (!handlers.onCameraSwitchAvailability) return;
      if (wrtc.callState !== 'connected' || wrtc.callType !== 'video' || !navigator.mediaDevices ||
          typeof navigator.mediaDevices.enumerateDevices !== 'function') {
        handlers.onCameraSwitchAvailability(false);
        return;
      }
      navigator.mediaDevices.enumerateDevices().then(function (devices) {
        var cameraCount = devices.filter(function (device) {
          return device.kind === 'videoinput';
        }).length;
        if (handlers.onCameraSwitchAvailability) {
          handlers.onCameraSwitchAvailability(
            wrtc.callState === 'connected' && wrtc.callType === 'video' && cameraCount > 1
          );
        }
      }).catch(function () {
        if (handlers.onCameraSwitchAvailability) handlers.onCameraSwitchAvailability(false);
      });
    }

    function switchCamera() {
      if (cameraSwitchInProgress) return Promise.reject(new Error('摄像头正在切换中'));
      if (wrtc.callState !== 'connected' || wrtc.callType !== 'video' || !wrtc.pc) {
        return Promise.reject(new Error('当前通话不支持切换摄像头'));
      }
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        return Promise.reject(new Error('当前浏览器不支持切换摄像头'));
      }

      var oldTrack = wrtc.localStream && wrtc.localStream.getVideoTracks()[0];
      var sender = wrtc.pc.getSenders().find(function (item) {
        return item.track && item.track.kind === 'video';
      });
      if (!oldTrack || !sender) return Promise.reject(new Error('未找到可切换的摄像头'));

      var nextFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
      var previousFacingMode = cameraFacingMode;
      var wasEnabled = oldTrack.enabled;
      cameraSwitchInProgress = true;
      if (handlers.onCameraSwitching) handlers.onCameraSwitching(true);

      function acquireCamera(facingMode) {
        return navigator.mediaDevices.getUserMedia({
          audio: false,
          video: createVideoConstraints('camera', facingMode)
        });
      }

      function installCamera(stream, requestedFacingMode) {
        var newTrack = stream.getVideoTracks()[0];
        if (!newTrack) throw new Error('新摄像头未返回视频画面');
        newTrack.enabled = wasEnabled;
        setTrackContentHint(newTrack, false);
        return sender.replaceTrack(newTrack).then(function () {
          if (wrtc.localStream) {
            wrtc.localStream.removeTrack(oldTrack);
            wrtc.localStream.addTrack(newTrack);
          }
          var settings = typeof newTrack.getSettings === 'function' ? newTrack.getSettings() : {};
          cameraFacingMode = settings.facingMode || requestedFacingMode;
          wrtc.isVideoOff = !newTrack.enabled;
          if (handlers.onLocalStream) handlers.onLocalStream(wrtc.localStream);
          if (handlers.onCameraFacingModeChange) handlers.onCameraFacingModeChange(cameraFacingMode);
          if (handlers.onVideoToggle) handlers.onVideoToggle(wrtc.isVideoOff);
          return applySenderQuality(sender, newTrack, false).then(function () { return true; });
        }).catch(function (err) {
          newTrack.stop();
          throw err;
        });
      }

      // Some Android devices cannot open the rear camera while the front
      // camera still owns the hardware, so release it before requesting the
      // opposite facing mode. If that fails, attempt to restore the old side.
      oldTrack.stop();
      return acquireCamera(nextFacingMode).then(function (stream) {
        return installCamera(stream, nextFacingMode);
      }).catch(function (switchError) {
        console.warn('切换目标摄像头失败，尝试恢复原摄像头:', switchError);
        return acquireCamera(previousFacingMode).then(function (recoveryStream) {
          return installCamera(recoveryStream, previousFacingMode).then(function () {
            throw switchError;
          });
        }).catch(function (recoveryError) {
          if (recoveryError !== switchError) {
            console.error('原摄像头恢复失败:', recoveryError);
            wrtc.isVideoOff = true;
            if (handlers.onVideoToggle) handlers.onVideoToggle(true);
          }
          throw switchError;
        });
      }).catch(function (err) {
        console.error('切换摄像头失败:', err);
        throw new Error(err && err.name === 'NotAllowedError'
          ? '请允许访问摄像头后重试'
          : '摄像头切换失败，当前设备可能不支持前后摄像头切换');
      }).finally(function () {
        cameraSwitchInProgress = false;
        if (handlers.onCameraSwitching) handlers.onCameraSwitching(false);
      });
    }

    function logMediaStreamSettings(stream, callType) {
      if (!stream || typeof stream.getTracks !== 'function') return;
      var profile = getActiveQualityProfile();
      console.log('[媒体质量] 档位: ' + profile.label + ' | 通话类型: ' + callType);
      stream.getTracks().forEach(function (track) {
        if (typeof track.getSettings !== 'function') return;
        var settings = track.getSettings();
        if (track.kind === 'audio') {
          var audioLabel = (callType === 'screen' && track !== wrtc.micAudioTrack) ? '系统音频' : '麦克风处理';
          console.log('[' + audioLabel + '] sampleRate=' + (settings.sampleRate || '?') +
            ' | channels=' + (settings.channelCount || '?') +
            ' | echoCancellation=' + String(settings.echoCancellation) +
            ' | noiseSuppression=' + String(settings.noiseSuppression) +
            ' | autoGainControl=' + String(settings.autoGainControl));
        } else if (track.kind === 'video') {
          console.log('[视频采集] ' + (settings.width || '?') + 'x' + (settings.height || '?') +
            ' @ ' + (settings.frameRate || '?') + 'fps');
        }
      });
    }

    function setTrackContentHint(track, isScreenVideo) {
      if (!track || !('contentHint' in track)) return;
      try {
        if (track.kind === 'video') {
          track.contentHint = isScreenVideo ? 'detail' : 'motion';
        } else if (track.kind === 'audio') {
          var isSystemAudio = (wrtc.callType === 'screen' || wrtc.isScreenSharing) &&
            track !== wrtc.micAudioTrack;
          track.contentHint = isSystemAudio ? 'music' : 'speech';
        }
      } catch (err) {}
    }

    function applySenderQuality(sender, track, isScreenVideo) {
      if (!sender || !track) return Promise.resolve(false);
      setTrackContentHint(track, isScreenVideo);
      if (typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') {
        return Promise.resolve(false);
      }

      var profile = getActiveQualityProfile();
      var parameters = sender.getParameters() || {};
      if (!parameters.encodings || parameters.encodings.length === 0) parameters.encodings = [{}];
      var encoding = parameters.encodings[0];
      var maxBitrate = track.kind === 'audio'
        ? profile.audioBitrate
        : (isScreenVideo ? profile.screen.maxBitrate : profile.camera.maxBitrate);

      if (maxBitrate) encoding.maxBitrate = maxBitrate;
      if (track.kind === 'video') {
        var videoConfig = isScreenVideo ? profile.screen : profile.camera;
        encoding.maxFramerate = videoConfig.frameRate;
        encoding.scaleResolutionDownBy = 1;
      }
      if ('priority' in encoding) encoding.priority = 'high';
      if ('networkPriority' in encoding) encoding.networkPriority = 'high';
      if ('degradationPreference' in parameters) {
        parameters.degradationPreference = isScreenVideo ? 'maintain-resolution' : 'balanced';
      }

      return sender.setParameters(parameters).then(function () {
        console.log('[发送质量] ' + track.kind +
          (track.kind === 'video' ? (isScreenVideo ? '/screen' : '/camera') : '') +
          ' | maxBitrate=' + (maxBitrate ? Math.round(maxBitrate / 1000) + 'kbps' : 'auto'));
        return true;
      }).catch(function (err) {
        console.warn('[发送质量] 浏览器拒绝部分编码参数，继续使用默认设置:', err);
        return false;
      });
    }

    function applyQualityToAllSenders() {
      if (!wrtc.pc || typeof wrtc.pc.getSenders !== 'function') return;
      wrtc.pc.getSenders().forEach(function (sender) {
        if (!sender.track) return;
        var isScreenVideo = sender.track.kind === 'video' &&
          (wrtc.callType === 'screen' || wrtc.isScreenSharing);
        applySenderQuality(sender, sender.track, isScreenVideo);
      });
    }

    function getLocalStream(callType) {
      if (callType === 'audio') {
        return navigator.mediaDevices.getUserMedia({
          audio: createAudioConstraints(),
          video: false
        });
      }

      if (callType === 'video') {
        return navigator.mediaDevices.getUserMedia({
          audio: createAudioConstraints(),
          video: createVideoConstraints('camera')
        });
      }

      if (callType === 'screen') {
        return requestDisplayMedia({
          video: createVideoConstraints('screen'),
          audio: true
        }).then(function(screenStream) {
          return navigator.mediaDevices.getUserMedia({
            audio: createAudioConstraints(),
            video: false
          }).then(function(micStream) {
            var micTrack = micStream.getAudioTracks()[0];
            if (micTrack) {
              wrtc.micAudioTrack = micTrack;
              screenStream.addTrack(micTrack);
            }
            return screenStream;
          });
        });
      }

      return Promise.reject(new Error('不支持的通话类型'));
    }

    function addLocalTracksToPC(pc, stream, callType) {
      stream.getTracks().forEach(function (track) {
        var sender = pc.addTrack(track, stream);
        applySenderQuality(sender, track, callType === 'screen' && track.kind === 'video');
      });
    }

    function startCall(callType) {
      if (wrtc.callState !== 'idle') return;
      if (!state.current) return;

      if (wrtc.forceRelay && !isTurnConfigured()) {
        setForceRelay(false);
        if (handlers.onCallError) handlers.onCallError('服务端未配置 TURN，无法强制中继');
        return;
      }

      wrtc.callState = 'calling';
      wrtc.callType = callType;
      wrtc.callPeerId = state.current;
      wrtc.activeQualityProfile = wrtc.qualityProfile;
      wrtc.activeIceTransportPolicy = wrtc.forceRelay ? 'relay' : 'all';
      wrtc.isMuted = false;
      wrtc.isVideoOff = false;
      wrtc.isScreenSharing = (callType === 'screen');
      cameraFacingMode = 'user';
      wrtc.pendingCandidates = [];
      wrtc.prePcCandidates = [];
      remoteRelayProtocols = Object.create(null);
      hasConnectedOnce = false;

      if (handlers.onCallStateChange) {
        handlers.onCallStateChange('calling', callType);
      }

      getLocalStream(callType).then(function (stream) {
        wrtc.localStream = stream;
        logMediaStreamSettings(stream, callType);

        if (callType === 'screen') {
          var videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = function () {
              handleScreenShareEnded();
            };
          }
        }

        if (handlers.onLocalStream) {
          handlers.onLocalStream(stream);
        }
        refreshCameraSwitchAvailability();

        wrtc.pc = createPeerConnection(wrtc.activeIceTransportPolicy);
        addLocalTracksToPC(wrtc.pc, stream, callType);

        bufferLocalCandidates = true;
        bufferedLocalCandidates = [];
        wrtc.pc.createOffer().then(function (offer) {
          return wrtc.pc.setLocalDescription(offer);
        }).then(function () {
          if (!wsModule.sendCallRequest(wrtc.callPeerId, callType)) {
            throw new Error('信令连接尚未建立');
          }
          releaseBufferedLocalCandidates();
        }).catch(function (err) {
          discardBufferedLocalCandidates();
          handleMediaError(err);
        });
      }).catch(function (err) {
        handleMediaError(err);
      });
    }

    function handleIncomingCall(from, callType) {
      wrtc.callState = 'ringing';
      wrtc.callType = callType;
      wrtc.callPeerId = from;
      wrtc.activeQualityProfile = wrtc.qualityProfile;
      // The local toggle only controls calls initiated by this browser.
      wrtc.activeIceTransportPolicy = 'all';
      wrtc.pendingCandidates = [];
      remoteRelayProtocols = Object.create(null);
      hasConnectedOnce = false;
      // Buffer ICE candidates that arrive before the PC is created.
      // Without this, the caller's early srflx/host candidates are discarded,
      // forcing the connection through relay (whose candidates arrive later).
      wrtc.prePcCandidates = [];
      cameraFacingMode = 'user';

      if (handlers.onIncomingCall) {
        handlers.onIncomingCall(from, callType);
      }
    }

    function acceptCall() {
      if (wrtc.callState !== 'ringing') return;

      // Screen share is one-way: callee only needs audio, caller shares screen
      var streamPromise;
      if (wrtc.callType === 'screen') {
        streamPromise = navigator.mediaDevices.getUserMedia({
          audio: createAudioConstraints(),
          video: false
        });
      } else {
        streamPromise = getLocalStream(wrtc.callType);
      }

      streamPromise.then(function (stream) {
        wrtc.localStream = stream;
        if (wrtc.callType === 'screen' && !wrtc.micAudioTrack) {
          wrtc.micAudioTrack = stream.getAudioTracks()[0] || null;
        }
        logMediaStreamSettings(stream, wrtc.callType);

        if (handlers.onLocalStream) {
          handlers.onLocalStream(stream);
        }
        refreshCameraSwitchAvailability();

        wrtc.pc = createPeerConnection(wrtc.activeIceTransportPolicy);
        addLocalTracksToPC(wrtc.pc, stream, wrtc.callType);

        // Flush pre-PC ICE candidates (received before the PC was created)
        // into the pending queue. They will be added once the remote description
        // is set via handleRemoteOffer().
        if (wrtc.prePcCandidates && wrtc.prePcCandidates.length > 0) {
          var preCount = wrtc.prePcCandidates.length;
          wrtc.pendingCandidates = wrtc.prePcCandidates.concat(wrtc.pendingCandidates);
          wrtc.prePcCandidates = [];
          console.log('[ICE 候选] 已恢复 ' + preCount + ' 个早期候选（PC 创建前收到）');
        }

        wrtc.callState = 'connected';
        wrtc.isMuted = false;
        wrtc.isVideoOff = (wrtc.callType !== 'screen');
        wrtc.isScreenSharing = false;

        // 先更新 UI（showOverlay 会清除旧连接信息），再启动统计轮询
        if (handlers.onCallStateChange) {
          handlers.onCallStateChange('connected', wrtc.callType);
        }
        refreshCameraSwitchAvailability();
        startConnectionStats();

        wsModule.sendCallAccept(wrtc.callPeerId);
      }).catch(function (err) {
        handleMediaError(err);
      });
    }

    function rejectCall(reason) {
      if (wrtc.callState !== 'ringing') return;
      wsModule.sendCallReject(wrtc.callPeerId, reason || 'declined');
      resetCallState();
    }

    function handleCallAccepted(from) {
      if (wrtc.callState !== 'calling') return;
      wrtc.callState = 'connected';
      wrtc.callStartTime = Date.now();

      // 先更新 UI（showOverlay 会清除旧连接信息），再启动统计轮询
      if (handlers.onCallStateChange) {
        handlers.onCallStateChange('connected', wrtc.callType);
      }
      refreshCameraSwitchAvailability();
      startConnectionStats();

      wsModule.sendCallOffer(from, wrtc.pc.localDescription);
    }

    function handleCallRejected(from, reason) {
      if (wrtc.callPeerId === from) {
        if (handlers.onCallError) {
          var msg = reason === 'busy' ? '对方正忙' : '对方拒绝了通话';
          handlers.onCallError(msg);
        }
        endCall(false);
      }
    }

    function handleRemoteOffer(from, sdp) {
      if (!wrtc.pc) return;
      var pc = wrtc.pc;
      var offerCollision = makingOffer || pc.signalingState !== 'stable';
      var isPolite = String(state.myId || '') > String(from || '');
      ignoreOffer = !isPolite && offerCollision;

      if (ignoreOffer) {
        console.log('[SDP] 忽略同时到达的 Offer，由当前本地协商继续');
        return;
      }

      settingRemoteDescription = true;
      bufferLocalCandidates = true;
      bufferedLocalCandidates = [];
      var prepare = offerCollision && pc.signalingState !== 'stable'
        ? pc.setLocalDescription({ type: 'rollback' })
        : Promise.resolve();

      prepare.then(function () {
        return pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }).then(function () {
        settingRemoteDescription = false;
        ignoreOffer = false;
        flushPendingCandidates();
        return pc.createAnswer();
      }).then(function (answer) {
        return pc.setLocalDescription(answer);
      }).then(function () {
        if (!wsModule.sendCallAnswer(from, pc.localDescription)) {
          throw new Error('信令连接尚未恢复');
        }
        releaseBufferedLocalCandidates();
      }).catch(function (err) {
        settingRemoteDescription = false;
        discardBufferedLocalCandidates();
        console.error('处理远端 Offer 失败:', err);
      });
    }

    function handleRemoteAnswer(from, sdp) {
      if (!wrtc.pc) return;
      if (wrtc.pc.signalingState !== 'have-local-offer') {
        console.log('[SDP] 忽略已过期的 Answer，当前状态: ' + wrtc.pc.signalingState);
        return;
      }
      settingRemoteDescription = true;
      wrtc.pc.setRemoteDescription(new RTCSessionDescription(sdp)).then(function () {
        settingRemoteDescription = false;
        ignoreOffer = false;
        restartInProgress = false;
        flushPendingCandidates();
      }).catch(function (err) {
        settingRemoteDescription = false;
        console.error('处理远端 Answer 失败:', err);
      });
    }

    function handleRemoteCandidate(from, candidate) {
      rememberRemoteRelayProtocol(candidate);
      // If PC doesn't exist yet (callee hasn't accepted), buffer the candidate.
      // This prevents early srflx/host candidates from being lost, which would
      // force the connection through relay.
      if (!wrtc.pc) {
        if (wrtc.prePcCandidates) {
          wrtc.prePcCandidates.push(candidate);
        }
        return;
      }
      var iceCandidate = new RTCIceCandidate(candidate);
      if (ignoreOffer) return;
      if (!settingRemoteDescription && wrtc.pc.remoteDescription && wrtc.pc.remoteDescription.type) {
        wrtc.pc.addIceCandidate(iceCandidate).catch(function (err) {
          console.error('添加 ICE 候选失败:', err);
        });
      } else {
        wrtc.pendingCandidates.push(candidate);
      }
    }

    function flushPendingCandidates() {
      var pending = wrtc.pendingCandidates.splice(0);
      pending.forEach(function (c) {
        wrtc.pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {});
      });
    }

    function endCall(sendSignal) {
      if (wrtc.callState === 'idle') return;

      if (sendSignal !== false && wrtc.callPeerId && wrtc.callState !== 'ringing') {
        wsModule.sendCallEnd(wrtc.callPeerId);
      }

      cleanupMedia();
      resetCallState();

      if (handlers.onCallStateChange) {
        handlers.onCallStateChange('idle');
      }
    }

    function handleRemoteEndCall() {
      if (wrtc.callState === 'idle') return;

      cleanupMedia();
      resetCallState();

      if (handlers.onCallStateChange) {
        handlers.onCallStateChange('idle');
      }
      if (handlers.onCallError) {
        handlers.onCallError('对方已挂断');
      }
    }

    function toggleMute() {
      if (!wrtc.localStream) return;
      wrtc.isMuted = !wrtc.isMuted;

      // For screen calls, only mute the microphone; system audio stays unmuted
      if (wrtc.callType === 'screen' && wrtc.micAudioTrack) {
        wrtc.micAudioTrack.enabled = !wrtc.isMuted;
      } else {
        wrtc.localStream.getAudioTracks().forEach(function (track) {
          track.enabled = !wrtc.isMuted;
        });
      }

      if (handlers.onMuteChange) {
        handlers.onMuteChange(wrtc.isMuted);
      }
    }

    function toggleVideo() {
      if (!wrtc.localStream) return;
      if (wrtc.callType !== 'video') return;
      wrtc.isVideoOff = !wrtc.isVideoOff;
      wrtc.localStream.getVideoTracks().forEach(function (track) {
        track.enabled = !wrtc.isVideoOff;
      });
      if (handlers.onVideoToggle) {
        handlers.onVideoToggle(wrtc.isVideoOff);
      }
    }

    function startScreenShare() {
      if (wrtc.callState !== 'connected') return;
      if (wrtc.isScreenSharing) return;
      if (wrtc.callType === 'screen') return;

      // Turn off camera first (mutual exclusion)
      if (wrtc.localStream && !wrtc.isVideoOff) {
        toggleVideo();
      }

      requestDisplayMedia({
        video: createVideoConstraints('screen'),
        audio: true
      }).then(function (screenStream) {
        wrtc.screenStream = screenStream;
        wrtc.isScreenSharing = true;

        var screenVideoTrack = screenStream.getVideoTracks()[0];
        if (screenVideoTrack) {
          screenVideoTrack.onended = function () {
            handleScreenShareEnded();
          };
        }

        var sender = wrtc.pc.getSenders().find(function (s) {
          return s.track && s.track.kind === 'video';
        });

        if (sender && screenVideoTrack) {
          sender.replaceTrack(screenVideoTrack).then(function () {
            applySenderQuality(sender, screenVideoTrack, true);
          }).catch(function () {});
        } else if (screenVideoTrack) {
          sender = wrtc.pc.addTrack(screenVideoTrack, screenStream);
          applySenderQuality(sender, screenVideoTrack, true);
        }

        var audioTrack = screenStream.getAudioTracks()[0];
        if (audioTrack) {
          var audioSender = wrtc.pc.getSenders().find(function (s) {
            return s.track && s.track.kind === 'audio';
          });
          if (audioSender) {
            audioSender.replaceTrack(audioTrack).then(function () {
              applySenderQuality(audioSender, audioTrack, false);
            }).catch(function () {});
          }
        }

        renegotiate();

        if (handlers.onScreenShareChange) {
          handlers.onScreenShareChange(true);
        }
      }).catch(function (err) {
        console.error('屏幕共享失败:', err);
        if (handlers.onCallError) {
          handlers.onCallError(getScreenShareErrorMessage(err));
        }
      });
    }

    function stopScreenShare() {
      if (!wrtc.screenStream) return;

      wrtc.screenStream.getTracks().forEach(function (t) { t.stop(); });
      wrtc.screenStream = null;
      wrtc.isScreenSharing = false;

      if (wrtc.callType === 'video') {
        // Restore camera - user needs to manually re-enable
        wrtc.isVideoOff = true;
        if (handlers.onVideoToggle) {
          handlers.onVideoToggle(true);
        }
      }

      renegotiate();

      if (handlers.onScreenShareChange) {
        handlers.onScreenShareChange(false);
      }
    }

    function handleScreenShareEnded() {
      // Screen stream from startScreenShare (during active video call)
      if (wrtc.screenStream) {
        wrtc.screenStream.getTracks().forEach(function (t) { t.stop(); });
        wrtc.screenStream = null;
      }

      // Screen stream from startCall('screen') — stored in localStream
      // The video track is already ended by the browser; remove it from PC
      if (wrtc.localStream && wrtc.callType === 'screen') {
        wrtc.localStream.getVideoTracks().forEach(function (t) {
          // Track already ended by browser, just ensure it's stopped
          if (t.readyState !== 'ended') { t.stop(); }
        });
        // Keep audio track alive for continued voice chat
      }

      wrtc.isScreenSharing = false;

      if (handlers.onScreenShareChange) {
        handlers.onScreenShareChange(false);
      }

      if (wrtc.callType === 'screen') {
        if (handlers.onCallError) {
          handlers.onCallError('屏幕共享已停止，已切换为纯语音通话');
        }
      } else {
        wrtc.isVideoOff = true;
        if (handlers.onVideoToggle) {
          handlers.onVideoToggle(true);
        }
      }

      renegotiate();
    }

    function renegotiate() {
      createAndSendOffer(false);
    }

    function createAndSendOffer(iceRestart) {
      var pc = wrtc.pc;
      if (!pc || !wrtc.callPeerId || makingOffer || pc.signalingState !== 'stable') {
        return Promise.resolve(false);
      }

      makingOffer = true;
      bufferLocalCandidates = true;
      bufferedLocalCandidates = [];
      return pc.createOffer(iceRestart ? { iceRestart: true } : undefined).then(function (offer) {
        return pc.setLocalDescription(offer);
      }).then(function () {
        applyQualityToAllSenders();
        var sent = wsModule.sendCallOffer(wrtc.callPeerId, pc.localDescription);
        if (!sent) throw new Error('信令连接尚未恢复');
        releaseBufferedLocalCandidates();
        return true;
      }).catch(function (err) {
        console.error(iceRestart ? 'ICE 重启协商失败:' : '重协商失败:', err);
        if (wrtc.pc === pc && pc.signalingState === 'have-local-offer') {
          return pc.setLocalDescription({ type: 'rollback' }).catch(function () {}).then(function () {
            return false;
          });
        }
        return false;
      }).finally(function () {
        discardBufferedLocalCandidates();
        makingOffer = false;
      });
    }

    function releaseBufferedLocalCandidates() {
      bufferLocalCandidates = false;
      bufferedLocalCandidates.splice(0).forEach(function (candidate) {
        wsModule.sendIceCandidate(wrtc.callPeerId, candidate);
      });
    }

    function discardBufferedLocalCandidates() {
      bufferLocalCandidates = false;
      bufferedLocalCandidates = [];
    }

    function showReconnectingState() {
      connectionStatusPending = true;
      if (handlers.onCallStatusChange) {
        handlers.onCallStatusChange('网络变化，正在恢复通话...');
      }
      if (handlers.onConnectionInfo) {
        handlers.onConnectionInfo('重连中…', 'connecting', null);
      }
      lastModeLabel = '';
      lastModeClass = '';
    }

    function showConnectingState() {
      connectionStatusPending = true;
      if (handlers.onCallStatusChange) {
        handlers.onCallStatusChange('正在连接...');
      }
      if (handlers.onConnectionInfo) {
        handlers.onConnectionInfo('连接中…', 'connecting', null);
      }
      lastModeLabel = '';
      lastModeClass = '';
    }

    function showPendingConnectionState() {
      if (hasConnectedOnce) {
        showReconnectingState();
      } else {
        showConnectingState();
      }
    }

    function markConnectionReady() {
      clearRecoveryTimers();
      restartInProgress = false;
      if (!connectionStatusPending) return;
      connectionStatusPending = false;
      if (handlers.onCallStatusChange) handlers.onCallStatusChange('已连接');
    }

    function clearRecoveryTimers() {
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      if (restartRetryTimer) {
        clearTimeout(restartRetryTimer);
        restartRetryTimer = null;
      }
    }

    function scheduleIceRecovery(delay) {
      if (wrtc.callState !== 'connected' || !wrtc.pc || disconnectTimer || restartInProgress) return;
      disconnectTimer = setTimeout(function () {
        disconnectTimer = null;
        requestIceRecovery();
      }, delay);
    }

    function requestIceRecovery() {
      if (wrtc.callState !== 'connected' || !wrtc.pc || !wrtc.callPeerId) return;

      showPendingConnectionState();
      if (wsModule.isOpen()) {
        // The request/echo handshake confirms both signaling sockets are online.
        wsModule.sendCallRestart(wrtc.callPeerId);
      }

      if (restartRetryTimer) clearTimeout(restartRetryTimer);
      restartRetryTimer = setTimeout(function () {
        restartRetryTimer = null;
        if (wrtc.pc && wrtc.pc.iceConnectionState !== 'connected' && wrtc.pc.iceConnectionState !== 'completed') {
          requestIceRecovery();
        }
      }, 5000);
    }

    function handleRestartRequest(from) {
      if (!wrtc.pc || wrtc.callState !== 'connected' || from !== wrtc.callPeerId) return;

      // A stable ordering prevents both peers from creating restart offers at once.
      if (String(state.myId || '') < String(from || '')) {
        performIceRestart();
      } else {
        wsModule.sendCallRestart(from);
      }
    }

    function performIceRestart() {
      var pc = wrtc.pc;
      if (!pc || restartInProgress || makingOffer) return;
      if (pc.signalingState !== 'stable') {
        scheduleIceRecovery(1000);
        return;
      }

      restartInProgress = true;
      console.log('[ICE 连接恢复] 开始完整 ICE restart 协商');
      showPendingConnectionState();
      createAndSendOffer(true).then(function (sent) {
        if (!sent) restartInProgress = false;
      });

      if (restartRetryTimer) clearTimeout(restartRetryTimer);
      restartRetryTimer = setTimeout(function () {
        restartRetryTimer = null;
        restartInProgress = false;
        if (wrtc.pc && wrtc.pc.iceConnectionState !== 'connected' && wrtc.pc.iceConnectionState !== 'completed') {
          if (wrtc.pc.signalingState === 'have-local-offer') {
            wrtc.pc.setLocalDescription({ type: 'rollback' }).catch(function () {}).then(requestIceRecovery);
          } else {
            requestIceRecovery();
          }
        }
      }, 10000);
    }

    function handleSignalingReconnected() {
      if (wrtc.callState !== 'connected' || !wrtc.pc) return;
      var iceState = wrtc.pc.iceConnectionState;
      if (iceState !== 'connected' && iceState !== 'completed') {
        console.log('[信令已恢复] 请求恢复 WebRTC 媒体连接');
        requestIceRecovery();
      }
    }

    // === Connection stats polling ===
    var statsTimer = null;
    var lastModeLabel = '';
    var lastModeClass = '';
    var previousMediaSamples = Object.create(null);
    var previousLossSamples = Object.create(null);
    var lastLossPercent = null;

    function resetQualityStatsSamples() {
      previousMediaSamples = Object.create(null);
      previousLossSamples = Object.create(null);
      lastLossPercent = null;
    }

    function startConnectionStats() {
      stopConnectionStats();
      lastModeLabel = '';
      lastModeClass = '';
      resetQualityStatsSamples();
      // 首次 ICE 建连不是网络恢复，保持“正在连接”文案。
      showConnectingState();
      // 延迟首次轮询：ICE 候选协商需要时间完成，立即轮询大概率找不到
      // nominated pair，导致 UI 保持旧状态不更新
      setTimeout(function () {
        if (wrtc.callState === 'connected' && wrtc.pc) {
          pollConnectionStats();
        }
      }, 800);
      statsTimer = setInterval(pollConnectionStats, 3000);
    }

    function stopConnectionStats() {
      if (statsTimer) {
        clearInterval(statsTimer);
        statsTimer = null;
      }
      resetQualityStatsSamples();
      if (handlers.onConnectionInfo) {
        handlers.onConnectionInfo(null, '', null);
      }
    }

    function collectMediaQualityStats(report) {
      var profile = getActiveQualityProfile();
      var quality = {
        profileLabel: profile.label,
        audioKbps: null,
        videoKbps: null,
        width: null,
        height: null,
        fps: null,
        lossPercent: null,
        jitterMs: null,
        limitationReason: null
      };
      var outbound = {
        audioBitsPerSecond: 0, videoBitsPerSecond: 0,
        hasAudioBitrate: false, hasVideoBitrate: false, hasVideo: false,
        width: null, height: null, fps: null, jitterMs: null, limitationReason: null
      };
      var inbound = {
        audioBitsPerSecond: 0, videoBitsPerSecond: 0,
        hasAudioBitrate: false, hasVideoBitrate: false, hasVideo: false,
        width: null, height: null, fps: null, jitterMs: null, limitationReason: null
      };

      function collectRtpMedia(stat, direction, target) {
        var kind = stat.kind || stat.mediaType;
        if (kind !== 'audio' && kind !== 'video') return;
        if (kind === 'video') target.hasVideo = true;

        var bytesField = direction === 'out' ? 'bytesSent' : 'bytesReceived';
        var framesField = direction === 'out' ? 'framesEncoded' : 'framesDecoded';
        var currentBytes = Number(stat[bytesField]);
        var currentTimestamp = Number(stat.timestamp);
        var currentFrames = Number(stat[framesField]);
        var sampleKey = direction + ':' + stat.id;
        var previous = previousMediaSamples[sampleKey];

        if (previous && Number.isFinite(currentBytes) && Number.isFinite(currentTimestamp)) {
          var elapsedSeconds = (currentTimestamp - previous.timestamp) / 1000;
          var byteDelta = currentBytes - previous.bytes;
          if (elapsedSeconds > 0 && byteDelta >= 0) {
            var bitrate = byteDelta * 8 / elapsedSeconds;
            if (kind === 'audio') {
              target.audioBitsPerSecond += bitrate;
              target.hasAudioBitrate = true;
            } else {
              target.videoBitsPerSecond += bitrate;
              target.hasVideoBitrate = true;
            }
          }
          if (kind === 'video' && typeof stat.framesPerSecond !== 'number' &&
              Number.isFinite(currentFrames) && Number.isFinite(previous.frames) && elapsedSeconds > 0) {
            target.fps = Math.max(target.fps || 0, (currentFrames - previous.frames) / elapsedSeconds);
          }
        }

        if (Number.isFinite(currentBytes) && Number.isFinite(currentTimestamp)) {
          previousMediaSamples[sampleKey] = {
            bytes: currentBytes,
            timestamp: currentTimestamp,
            frames: currentFrames
          };
        }

        if (kind === 'video') {
          if (typeof stat.frameWidth === 'number') target.width = Math.max(target.width || 0, stat.frameWidth);
          if (typeof stat.frameHeight === 'number') target.height = Math.max(target.height || 0, stat.frameHeight);
          if (typeof stat.framesPerSecond === 'number') target.fps = Math.max(target.fps || 0, stat.framesPerSecond);
          if (typeof stat.qualityLimitationReason === 'string' && stat.qualityLimitationReason !== 'none') {
            target.limitationReason = stat.qualityLimitationReason;
          }
        }
        if (typeof stat.jitter === 'number') {
          target.jitterMs = Math.max(target.jitterMs || 0, stat.jitter * 1000);
        }
      }

      report.forEach(function (stat) {
        if (stat.type === 'outbound-rtp' && !stat.isRemote) {
          collectRtpMedia(stat, 'out', outbound);
        } else if (stat.type === 'inbound-rtp' && !stat.isRemote) {
          collectRtpMedia(stat, 'in', inbound);
        } else if (stat.type === 'remote-inbound-rtp' && typeof stat.jitter === 'number') {
          outbound.jitterMs = Math.max(outbound.jitterMs || 0, stat.jitter * 1000);
        }
      });

      // A screen-share viewer has no outbound video. In that case report the
      // actually received screen resolution/FPS/bitrate instead of leaving
      // those fields blank. Normal video calls continue to show local send data.
      var videoStats = outbound.hasVideo ? outbound : inbound;
      var preferInbound = !outbound.hasVideo && inbound.hasVideo;
      var audioStats = outbound.hasAudioBitrate ? outbound : inbound;
      quality.width = videoStats.width;
      quality.height = videoStats.height;
      quality.fps = videoStats.fps;
      quality.limitationReason = videoStats.limitationReason;
      if (videoStats.hasVideoBitrate) quality.videoKbps = Math.round(videoStats.videoBitsPerSecond / 1000);
      if (audioStats.hasAudioBitrate) quality.audioKbps = Math.round(audioStats.audioBitsPerSecond / 1000);
      if (quality.fps !== null) quality.fps = Math.round(quality.fps);
      var selectedJitter = preferInbound ? inbound.jitterMs : outbound.jitterMs;
      if (selectedJitter === null) selectedJitter = preferInbound ? outbound.jitterMs : inbound.jitterMs;
      if (selectedJitter !== null) quality.jitterMs = Math.round(selectedJitter);

      function collectLoss(type, samplePrefix) {
        var lostDelta = 0;
        var totalDelta = 0;
        var hasUsableSample = false;

        report.forEach(function (stat) {
          if (stat.type !== type || (type === 'inbound-rtp' && stat.isRemote)) return;
          var lost = Number(stat.packetsLost);
          if (!Number.isFinite(lost) || lost < 0) lost = 0;

          var received = Number(stat.packetsReceived);
          var total = Number.isFinite(received) && received >= 0 ? received + lost : null;
          if (total === null && type === 'remote-inbound-rtp' && stat.localId) {
            var relatedOutbound = report.get(stat.localId);
            var packetsSent = relatedOutbound && Number(relatedOutbound.packetsSent);
            if (Number.isFinite(packetsSent) && packetsSent >= 0) total = packetsSent;
          }
          if (!Number.isFinite(total) || total <= 0 || lost > total) return;

          var key = samplePrefix + ':' + stat.id;
          var previous = previousLossSamples[key];
          var currentLostDelta = lost;
          var currentTotalDelta = total;
          if (previous && lost >= previous.lost && total >= previous.total) {
            currentLostDelta = lost - previous.lost;
            currentTotalDelta = total - previous.total;
          }
          previousLossSamples[key] = { lost: lost, total: total };
          if (currentTotalDelta > 0 && currentLostDelta >= 0 && currentLostDelta <= currentTotalDelta) {
            lostDelta += currentLostDelta;
            totalDelta += currentTotalDelta;
            hasUsableSample = true;
          }
        });

        return hasUsableSample && totalDelta >= 20
          ? Math.round(lostDelta * 1000 / totalDelta) / 10
          : null;
      }

      var outboundLoss = collectLoss('remote-inbound-rtp', 'remote');
      var inboundLoss = collectLoss('inbound-rtp', 'inbound');
      var currentLoss = preferInbound ? inboundLoss : outboundLoss;
      if (currentLoss === null) currentLoss = preferInbound ? outboundLoss : inboundLoss;
      if (currentLoss !== null) lastLossPercent = currentLoss;
      quality.lossPercent = lastLossPercent;
      return quality;
    }

    function pollConnectionStats() {
      if (!wrtc.pc || wrtc.callState !== 'connected') return;
      var pc = wrtc.pc;
      if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
        showPendingConnectionState();
        return;
      }

      pc.getStats(null).then(function (report) {
        if (wrtc.pc !== pc || (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed')) {
          return;
        }
        var selectedPair = null;
        var qualityStats = collectMediaQualityStats(report);

        // Modern browsers expose the exact pair selected by the ICE transport.
        report.forEach(function (stat) {
          if (stat.type === 'transport' && stat.selectedCandidatePairId) {
            selectedPair = report.get(stat.selectedCandidatePairId) || selectedPair;
          }
        });

        if (!selectedPair) {
          report.forEach(function (stat) {
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && (stat.nominated || stat.selected)) {
              selectedPair = stat;
            }
          });
        }

        if (selectedPair) {
          // A nominated pair with fresh stats proves media recovered even if a
          // browser omitted or reordered the final connection-state event.
          markConnectionReady();
          // Fetch both local and remote candidates to correctly determine connection mode
          var localCandidate = null;
          var remoteCandidate = null;

          if (selectedPair.localCandidateId) {
            localCandidate = report.get(selectedPair.localCandidateId);
          }
          if (selectedPair.remoteCandidateId) {
            remoteCandidate = report.get(selectedPair.remoteCandidateId);
          }

          // Determine connection mode based on BOTH candidates
          // If EITHER candidate is relay, the connection is relayed (both sides see the same label)
          var localType = localCandidate ? (localCandidate.candidateType || 'unknown') : 'unknown';
          var remoteType = remoteCandidate ? (remoteCandidate.candidateType || 'unknown') : 'unknown';
          var localProtocol = localCandidate ? (localCandidate.protocol || 'udp').toLowerCase() : 'udp';
          var remoteProtocol = remoteCandidate ? (remoteCandidate.protocol || 'udp').toLowerCase() : 'udp';
          var localAddress = localCandidate ? (localCandidate.address || localCandidate.ip || '') : '';
          var remoteAddress = remoteCandidate ? (remoteCandidate.address || remoteCandidate.ip || '') : '';

          var isRelay = (localType === 'relay' || remoteType === 'relay');
          var isAllHost = localType === 'host' && remoteType === 'host';
          var isIPv6HostPair = isAllHost && isIPv6Address(localAddress) && isIPv6Address(remoteAddress);
          var isSameIPv6Lan = isIPv6HostPair && isSameIPv6Prefix64(localAddress, remoteAddress);
          var isLan = isAllHost &&
            ((isPrivateHostAddress(localAddress) && isPrivateHostAddress(remoteAddress)) || isSameIPv6Lan);

          var modeLabel = '';
          var modeClass = '';

          if (isRelay) {
            // Connection is relayed — check the relay candidate's protocol
            var relayCandidate = localType === 'relay' ? localCandidate : remoteCandidate;
            var relayFoundation = getCandidateFoundation(relayCandidate);
            var relayProtocol = String(
              relayCandidate && relayCandidate.relayProtocol ||
              remoteRelayProtocols[relayFoundation] ||
              (localType === 'relay' ? localProtocol : remoteProtocol)
            ).toLowerCase();
            if (relayProtocol === 'tcp' || relayProtocol === 'tls' || relayProtocol === 'tcp-act' || relayProtocol === 'tcp-pass') {
              modeLabel = 'TCP 中继';
              modeClass = 'relay-tcp';
            } else {
              modeLabel = 'UDP 中继';
              modeClass = 'relay-udp';
            }
          } else if (isLan) {
            modeLabel = isIPv6HostPair ? 'IPv6 LAN' : 'LAN 直连';
            modeClass = 'host';
          } else {
            // host+srflx/prflx is a normal public P2P path, not a LAN path.
            modeLabel = isIPv6HostPair ? 'IPv6 P2P' : 'P2P 直连';
            modeClass = 'srflx';
          }

          if (wrtc.activeIceTransportPolicy === 'relay' && !isRelay) {
            console.error('[WebRTC] 强制中继策略下选中了非 relay 候选对', localType, remoteType);
          }

          var rtt = null;
          if (typeof selectedPair.currentRoundTripTime === 'number' && selectedPair.currentRoundTripTime > 0) {
            rtt = Math.round(selectedPair.currentRoundTripTime * 1000);
          }

          // Log mode transitions
          if (modeLabel !== lastModeLabel || modeClass !== lastModeClass) {
            var prevLabel = lastModeLabel || '初始连接';
            console.log('[连接模式切换] ' + prevLabel + ' -> ' + modeLabel +
              ' | local: ' + localType + '/' + localProtocol + '@' + (localAddress || '?') +
              ' | remote: ' + remoteType + '/' + remoteProtocol + '@' + (remoteAddress || '?') +
              (rtt !== null ? ' | RTT: ' + rtt + 'ms' : ''));
            lastModeLabel = modeLabel;
            lastModeClass = modeClass;
          }

          if (handlers.onConnectionInfo) {
            handlers.onConnectionInfo(modeLabel, modeClass, rtt, qualityStats);
          }
        }
      }).catch(function () {});
    }

    function isPrivateHostAddress(address) {
      var value = String(address || '').toLowerCase().replace(/^\[|\]$/g, '');
      if (!value) return false;
      if (value.indexOf('::ffff:') === 0) value = value.slice(7);
      if (value.endsWith('.local')) return true;
      if (value === '::1' || /^fe[89ab]/.test(value) || value.indexOf('fc') === 0 || value.indexOf('fd') === 0) {
        return true;
      }

      var parts = value.split('.').map(Number);
      if (parts.length !== 4 || parts.some(function (part) { return !Number.isInteger(part) || part < 0 || part > 255; })) {
        return false;
      }
      return parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 169 && parts[1] === 254) ||
        parts[0] === 127;
    }

    function isIPv6Address(address) {
      return String(address || '').replace(/^\[|\]$/g, '').indexOf(':') >= 0;
    }

    function parseIPv6Address(address) {
      var value = String(address || '').toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
      if (!value || value.indexOf(':') < 0 || value.indexOf('.') >= 0) return null;
      var halves = value.split('::');
      if (halves.length > 2) return null;
      var left = halves[0] ? halves[0].split(':') : [];
      var right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
      var missing = 8 - left.length - right.length;
      if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
      var parts = left.concat(new Array(missing).fill('0'), right);
      if (parts.length !== 8 || parts.some(function (part) { return !/^[0-9a-f]{1,4}$/.test(part); })) {
        return null;
      }
      return parts.map(function (part) { return parseInt(part, 16); });
    }

    function isSameIPv6Prefix64(leftAddress, rightAddress) {
      var left = parseIPv6Address(leftAddress);
      var right = parseIPv6Address(rightAddress);
      if (!left || !right) return false;
      return left.slice(0, 4).every(function (part, index) { return part === right[index]; });
    }

    function handleMediaError(err) {
      console.error('媒体采集失败:', err);

      var message = '媒体设备访问失败';
      if (wrtc.callType === 'screen') {
        message = getScreenShareErrorMessage(err);
      } else if (err.name === 'NotAllowedError') {
        message = '请授予麦克风/摄像头权限以进行通话';
      } else if (err.name === 'NotFoundError') {
        message = '未检测到麦克风或摄像头设备';
      } else if (err.name === 'NotReadableError') {
        message = '媒体设备被其他应用占用';
      }

      if (handlers.onCallError) {
        handlers.onCallError(message);
      }

      if (wrtc.callState === 'ringing') {
        wsModule.sendCallReject(wrtc.callPeerId, 'error');
      }

      cleanupMedia();
      resetCallState();

      if (handlers.onCallStateChange) {
        handlers.onCallStateChange('idle');
      }
    }

    function cleanupMedia() {
      clearRecoveryTimers();
      restartInProgress = false;
      connectionStatusPending = false;
      cameraSwitchInProgress = false;
      makingOffer = false;
      ignoreOffer = false;
      settingRemoteDescription = false;
      discardBufferedLocalCandidates();
      stopConnectionStats();
      wrtc.micAudioTrack = null;
      if (wrtc.localStream) {
        wrtc.localStream.getTracks().forEach(function (t) { t.stop(); });
        wrtc.localStream = null;
      }
      if (wrtc.screenStream) {
        wrtc.screenStream.getTracks().forEach(function (t) { t.stop(); });
        wrtc.screenStream = null;
      }
      if (wrtc.remoteStream) {
        wrtc.remoteStream = null;
      }
      if (wrtc.pc) {
        wrtc.pc.close();
        wrtc.pc = null;
      }
      if (handlers.onCameraSwitchAvailability) handlers.onCameraSwitchAvailability(false);
    }

    function resetCallState() {
      wrtc.callState = 'idle';
      wrtc.callType = null;
      wrtc.callPeerId = null;
      wrtc.callStartTime = null;
      wrtc.activeQualityProfile = wrtc.qualityProfile;
      wrtc.activeIceTransportPolicy = 'all';
      wrtc.isMuted = false;
      wrtc.isVideoOff = false;
      wrtc.isScreenSharing = false;
      wrtc.pendingCandidates = [];
      wrtc.prePcCandidates = [];
      wrtc.micAudioTrack = null;
      cameraFacingMode = 'user';
      remoteRelayProtocols = Object.create(null);
      hasConnectedOnce = false;
    }

    function getCallState() {
      return {
        callState: wrtc.callState,
        callType: wrtc.callType,
        callPeerId: wrtc.callPeerId,
        forceRelay: wrtc.forceRelay,
        qualityProfile: wrtc.qualityProfile,
        activeQualityProfile: wrtc.activeQualityProfile,
        echoCancellation: wrtc.echoCancellation,
        noiseSuppression: wrtc.noiseSuppression,
        autoGainControl: wrtc.autoGainControl,
        activeIceTransportPolicy: wrtc.activeIceTransportPolicy,
        isMuted: wrtc.isMuted,
        isVideoOff: wrtc.isVideoOff,
        isScreenSharing: wrtc.isScreenSharing
      };
    }

    function isCallActive() {
      return wrtc.callState !== 'idle';
    }

    return {
      startCall: startCall,
      acceptCall: acceptCall,
      rejectCall: rejectCall,
      endCall: endCall,
      toggleMute: toggleMute,
      toggleVideo: toggleVideo,
      switchCamera: switchCamera,
      startScreenShare: startScreenShare,
      stopScreenShare: stopScreenShare,
      handleIncomingCall: handleIncomingCall,
      handleCallAccepted: handleCallAccepted,
      handleCallRejected: handleCallRejected,
      handleRemoteOffer: handleRemoteOffer,
      handleRemoteAnswer: handleRemoteAnswer,
      handleRemoteCandidate: handleRemoteCandidate,
      handleRestartRequest: handleRestartRequest,
      handleSignalingReconnected: handleSignalingReconnected,
      handleRemoteEndCall: handleRemoteEndCall,
      isTurnConfigured: isTurnConfigured,
      setForceRelay: setForceRelay,
      setQualityProfile: setQualityProfile,
      setAudioProcessing: setAudioProcessing,
      getCallState: getCallState,
      isCallActive: isCallActive
    };
  }

  global.ChatWebRTCModule = {
    createWebRTCModule: createWebRTCModule
  };
})(window);
