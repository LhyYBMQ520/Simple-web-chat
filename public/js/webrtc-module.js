(function initWebRTCModule(global) {
  function createWebRTCModule(options) {
    const { state, wsModule, handlers } = options;
    const wrtc = state.webrtc;

    function getIceServers() {
      if (window.__CHAT_CONFIG__ && window.__CHAT_CONFIG__.webrtc && window.__CHAT_CONFIG__.webrtc.iceServers) {
        return window.__CHAT_CONFIG__.webrtc.iceServers;
      }
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }

    function createPeerConnection() {
      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 1
      });

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
          wsModule.sendIceCandidate(wrtc.callPeerId, cand);
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

        if (pc.iceConnectionState === 'failed') {
          console.log('[ICE 连接失败] 尝试 ICE 重启...');
          pc.restartIce();
        }
        if (pc.iceConnectionState === 'disconnected') {
          // give it a moment to reconnect before declaring failure
          setTimeout(function () {
            if (pc.iceConnectionState === 'disconnected') {
              if (handlers.onCallStatusChange) {
                handlers.onCallStatusChange('网络不稳定，正在重连...');
              }
            }
          }, 3000);
        }
        if (pc.iceConnectionState === 'connected') {
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
          if (handlers.onCallStatusChange) {
            handlers.onCallStatusChange('已连接');
          }
        }
      };

      pc.onconnectionstatechange = function () {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          endCall(true);
        }
      };

      return pc;
    }

    function getLocalStream(callType) {
      if (callType === 'audio') {
        return navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      }

      if (callType === 'video') {
        return navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
      }

      if (callType === 'screen') {
        return navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        }).then(function(screenStream) {
          return navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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

    function addLocalTracksToPC(pc, stream) {
      stream.getTracks().forEach(function (track) {
        pc.addTrack(track, stream);
      });
    }

    function startCall(callType) {
      if (wrtc.callState !== 'idle') return;
      if (!state.current) return;

      wrtc.callState = 'calling';
      wrtc.callType = callType;
      wrtc.callPeerId = state.current;
      wrtc.isMuted = false;
      wrtc.isVideoOff = false;
      wrtc.isScreenSharing = (callType === 'screen');
      wrtc.pendingCandidates = [];

      if (handlers.onCallStateChange) {
        handlers.onCallStateChange('calling', callType);
      }

      getLocalStream(callType).then(function (stream) {
        wrtc.localStream = stream;

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

        wrtc.pc = createPeerConnection();
        addLocalTracksToPC(wrtc.pc, stream);

        wrtc.pc.createOffer().then(function (offer) {
          return wrtc.pc.setLocalDescription(offer);
        }).then(function () {
          wsModule.sendCallRequest(wrtc.callPeerId, callType);
        }).catch(function (err) {
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
      wrtc.pendingCandidates = [];
      // Buffer ICE candidates that arrive before the PC is created.
      // Without this, the caller's early srflx/host candidates are discarded,
      // forcing the connection through relay (whose candidates arrive later).
      wrtc.prePcCandidates = [];

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
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
      } else {
        streamPromise = getLocalStream(wrtc.callType);
      }

      streamPromise.then(function (stream) {
        wrtc.localStream = stream;

        if (handlers.onLocalStream) {
          handlers.onLocalStream(stream);
        }

        wrtc.pc = createPeerConnection();
        addLocalTracksToPC(wrtc.pc, stream);

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

      wrtc.pc.setRemoteDescription(new RTCSessionDescription(sdp)).then(function () {
        flushPendingCandidates();

        return wrtc.pc.createAnswer();
      }).then(function (answer) {
        return wrtc.pc.setLocalDescription(answer);
      }).then(function () {
        wsModule.sendCallAnswer(from, wrtc.pc.localDescription);
      }).catch(function (err) {
        console.error('处理远端 Offer 失败:', err);
      });
    }

    function handleRemoteAnswer(from, sdp) {
      if (!wrtc.pc) return;
      wrtc.pc.setRemoteDescription(new RTCSessionDescription(sdp)).then(function () {
        flushPendingCandidates();
      }).catch(function (err) {
        console.error('处理远端 Answer 失败:', err);
      });
    }

    function handleRemoteCandidate(from, candidate) {
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
      if (wrtc.pc.remoteDescription && wrtc.pc.remoteDescription.type) {
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

      navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
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
          sender.replaceTrack(screenVideoTrack).catch(function () {});
        } else if (screenVideoTrack) {
          wrtc.pc.addTrack(screenVideoTrack, screenStream);
        }

        var audioTrack = screenStream.getAudioTracks()[0];
        if (audioTrack) {
          var audioSender = wrtc.pc.getSenders().find(function (s) {
            return s.track && s.track.kind === 'audio';
          });
          if (audioSender) {
            audioSender.replaceTrack(audioTrack).catch(function () {});
          }
        }

        renegotiate();

        if (handlers.onScreenShareChange) {
          handlers.onScreenShareChange(true);
        }
      }).catch(function (err) {
        console.error('屏幕共享失败:', err);
        if (handlers.onCallError) {
          handlers.onCallError('屏幕共享开启失败');
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
      if (!wrtc.pc) return;
      wrtc.pc.createOffer().then(function (offer) {
        return wrtc.pc.setLocalDescription(offer);
      }).then(function () {
        if (wrtc.callPeerId) {
          wsModule.sendCallOffer(wrtc.callPeerId, wrtc.pc.localDescription);
        }
      }).catch(function (err) {
        console.error('重协商失败:', err);
      });
    }

    // === Connection stats polling ===
    var statsTimer = null;
    var lastModeLabel = '';
    var lastModeClass = '';

    function startConnectionStats() {
      stopConnectionStats();
      lastModeLabel = '';
      lastModeClass = '';
      // 发送初始状态，清除上一次通话残留的连接模式显示
      if (handlers.onConnectionInfo) {
        handlers.onConnectionInfo('连接中…', 'connecting', null);
      }
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
      if (handlers.onConnectionInfo) {
        handlers.onConnectionInfo(null, '', null);
      }
    }

    function pollConnectionStats() {
      if (!wrtc.pc || wrtc.callState !== 'connected') return;

      wrtc.pc.getStats(null).then(function (report) {
        var selectedPair = null;

        report.forEach(function (stat) {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
            selectedPair = stat;
          }
        });
        // Fallback: use any succeeded pair (take the last one, as it's most recent)
        if (!selectedPair) {
          report.forEach(function (stat) {
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              selectedPair = stat;
            }
          });
        }

        if (selectedPair) {
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

          var isRelay = (localType === 'relay' || remoteType === 'relay');
          var isAllHost = (localType === 'host' && remoteType === 'host');
          var isAllSrflxOrPrflx = !isRelay && !isAllHost &&
            ((localType === 'srflx' || localType === 'prflx') && (remoteType === 'srflx' || remoteType === 'prflx'));

          var modeLabel = '';
          var modeClass = '';

          if (isRelay) {
            // Connection is relayed — check the relay candidate's protocol
            var relayProtocol = localType === 'relay' ? localProtocol : remoteProtocol;
            if (relayProtocol === 'tcp' || relayProtocol === 'tcp-act' || relayProtocol === 'tcp-pass') {
              modeLabel = 'TCP 中继';
              modeClass = 'relay-tcp';
            } else {
              modeLabel = 'UDP 中继';
              modeClass = 'relay-udp';
            }
          } else if (isAllHost) {
            modeLabel = 'LAN 直连';
            modeClass = 'host';
          } else if (isAllSrflxOrPrflx) {
            modeLabel = 'P2P 直连';
            modeClass = 'srflx';
          } else {
            // Mixed or unknown: use local type as fallback
            if (localType === 'host') {
              modeLabel = 'LAN 直连';
              modeClass = 'host';
            } else if (localType === 'srflx' || localType === 'prflx') {
              modeLabel = 'P2P 直连';
              modeClass = 'srflx';
            } else {
              modeLabel = localType + '/' + localProtocol;
              modeClass = 'host';
            }
          }

          var rtt = null;
          if (typeof selectedPair.currentRoundTripTime === 'number' && selectedPair.currentRoundTripTime > 0) {
            rtt = Math.round(selectedPair.currentRoundTripTime * 1000);
          }

          // Log mode transitions
          if (modeLabel !== lastModeLabel || modeClass !== lastModeClass) {
            var prevLabel = lastModeLabel || '初始连接';
            console.log('[连接模式切换] ' + prevLabel + ' -> ' + modeLabel +
              ' | local: ' + localType + '/' + localProtocol +
              ' | remote: ' + remoteType + '/' + remoteProtocol +
              (rtt !== null ? ' | RTT: ' + rtt + 'ms' : ''));
            lastModeLabel = modeLabel;
            lastModeClass = modeClass;
          }

          if (handlers.onConnectionInfo) {
            handlers.onConnectionInfo(modeLabel, modeClass, rtt);
          }
        }
      }).catch(function () {});
    }

    function handleMediaError(err) {
      console.error('媒体采集失败:', err);

      var message = '媒体设备访问失败';
      if (err.name === 'NotAllowedError') {
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
    }

    function resetCallState() {
      wrtc.callState = 'idle';
      wrtc.callType = null;
      wrtc.callPeerId = null;
      wrtc.callStartTime = null;
      wrtc.isMuted = false;
      wrtc.isVideoOff = false;
      wrtc.isScreenSharing = false;
      wrtc.pendingCandidates = [];
      wrtc.prePcCandidates = [];
      wrtc.micAudioTrack = null;
    }

    function getCallState() {
      return {
        callState: wrtc.callState,
        callType: wrtc.callType,
        callPeerId: wrtc.callPeerId,
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
      startScreenShare: startScreenShare,
      stopScreenShare: stopScreenShare,
      handleIncomingCall: handleIncomingCall,
      handleCallAccepted: handleCallAccepted,
      handleCallRejected: handleCallRejected,
      handleRemoteOffer: handleRemoteOffer,
      handleRemoteAnswer: handleRemoteAnswer,
      handleRemoteCandidate: handleRemoteCandidate,
      handleRemoteEndCall: handleRemoteEndCall,
      getCallState: getCallState,
      isCallActive: isCallActive
    };
  }

  global.ChatWebRTCModule = {
    createWebRTCModule: createWebRTCModule
  };
})(window);
