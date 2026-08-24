(function initSessionModule(global) {
  function createSessionModule(options) {
    const {
      state,
      onSelect,
      onConfirmDelete,
      onBackToSessions,
      onRenderSessions,
      onPersistRemarks,
      isTurnConfigured
    } = options;

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function getPeerLabel(id) {
      const profile = state.accountProfiles && state.accountProfiles[id];
      return profile && profile.displayName ? profile.displayName : id;
    }

    function getDisplayName(id) {
      const label = getPeerLabel(id);
      return state.remarks[id] ? `(${escapeHtml(state.remarks[id])}) ${escapeHtml(label)}` : escapeHtml(label);
    }

    function updateChatHeader() {
      if (!state.current) return;

      const isOnline = state.onlineUsers.includes(state.current);
      const dotColor = isOnline ? '#2ecc71' : '#e74c3c';
      const displayName = getDisplayName(state.current);

      const isInCall = state.webrtc && state.webrtc.callState !== 'idle';
      const turnAvailable = typeof isTurnConfigured === 'function' && isTurnConfigured();
      const forceRelay = turnAvailable && state.webrtc && state.webrtc.forceRelay;
      const qualityProfile = state.webrtc && state.webrtc.qualityProfile || 'auto';
      const relayTitle = !turnAvailable
        ? '服务端未配置 TURN，无法强制中继'
        : isInCall
          ? '通话中无法更改连接策略'
          : forceRelay
            ? '已开启：本端发起的新通话仅使用 TURN 中继'
            : '已关闭：新通话自动选择 LAN、P2P 或 TURN';
      const callMenuTitle = isInCall ? '通话进行中' : '选择通话方式';
      document.getElementById('title').innerHTML = `
        <button class="back-btn" onclick="backToSessions()" title="返回">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="chat-header-peer">
          <i class="fa-solid fa-message"></i>
          <span class="chat-header-peer-name">聊天：${displayName}</span>
          <span class="chat-header-online-dot" style="background:${dotColor};"></span>
        </div>
        <div class="chat-header-call-actions">
          <label class="relay-policy-toggle ${forceRelay ? 'enabled' : ''} ${!turnAvailable ? 'unavailable' : ''} ${isInCall ? 'locked' : ''}" title="${relayTitle}">
            <input type="checkbox" onchange="toggleForceRelay(this.checked)" aria-label="强制 TURN 中继" ${forceRelay ? 'checked' : ''} ${isInCall || !turnAvailable ? 'disabled' : ''}>
            <span class="relay-policy-track"><span class="relay-policy-thumb"></span></span>
            <span class="relay-policy-label">中继</span>
          </label>
          <details class="call-menu ${isInCall ? 'locked' : ''}">
            <summary class="call-menu-trigger ${isInCall ? 'active-call' : ''}" title="${callMenuTitle}" aria-label="${callMenuTitle}" aria-disabled="${isInCall ? 'true' : 'false'}" onclick="if (this.parentElement.classList.contains('locked')) event.preventDefault()">
              <i class="fa-solid fa-phone"></i>
              <i class="fa-solid fa-chevron-down call-menu-chevron"></i>
            </summary>
            <div class="call-menu-panel" role="menu" aria-label="通话方式">
              <div class="call-menu-quality">
                <span class="call-menu-quality-label"><i class="fa-solid fa-sliders"></i> 通话质量</span>
                <details class="call-quality-picker ${isInCall ? 'locked' : ''}">
                  <summary class="call-quality-picker-trigger" aria-label="选择通话质量" aria-disabled="${isInCall ? 'true' : 'false'}" onclick="if (this.parentElement.classList.contains('locked')) event.preventDefault()">
                    <span>${qualityProfile === 'low' ? '省流' : qualityProfile === 'standard' ? '标准' : qualityProfile === 'high' ? '高清' : '自动'}</span><i class="fa-solid fa-chevron-down"></i>
                  </summary>
                  <div class="call-quality-picker-menu" role="menu">
                    <button type="button" role="menuitem" class="${qualityProfile === 'auto' ? 'active' : ''}" onclick="setCallQuality('auto')">自动</button>
                    <button type="button" role="menuitem" class="${qualityProfile === 'low' ? 'active' : ''}" onclick="setCallQuality('low')">省流</button>
                    <button type="button" role="menuitem" class="${qualityProfile === 'standard' ? 'active' : ''}" onclick="setCallQuality('standard')">标准</button>
                    <button type="button" role="menuitem" class="${qualityProfile === 'high' ? 'active' : ''}" onclick="setCallQuality('high')">高清</button>
                  </div>
                </details>
              </div>
              <div class="call-menu-audio-settings">
                <span class="call-menu-section-title"><i class="fa-solid fa-microphone-lines"></i> 麦克风处理</span>
                <label><input type="checkbox" onchange="setAudioProcessing('echoCancellation', this.checked)" ${state.webrtc.echoCancellation ? 'checked' : ''} ${isInCall ? 'disabled' : ''}> 回声消除</label>
                <label><input type="checkbox" onchange="setAudioProcessing('noiseSuppression', this.checked)" ${state.webrtc.noiseSuppression ? 'checked' : ''} ${isInCall ? 'disabled' : ''}> 降噪</label>
                <label><input type="checkbox" onchange="setAudioProcessing('autoGainControl', this.checked)" ${state.webrtc.autoGainControl ? 'checked' : ''} ${isInCall ? 'disabled' : ''}> 自动增益</label>
              </div>
              <div class="call-menu-separator"></div>
              <button type="button" class="call-menu-option" role="menuitem" onclick="startAudioCall()">
                <i class="fa-solid fa-phone"></i>
                <span>语音通话</span>
              </button>
              <button type="button" class="call-menu-option" role="menuitem" onclick="startVideoCall()">
                <i class="fa-solid fa-video"></i>
                <span>视频通话</span>
              </button>
              <button type="button" class="call-menu-option" role="menuitem" onclick="startScreenShare()">
                <i class="fa-solid fa-desktop"></i>
                <span>屏幕共享</span>
              </button>
            </div>
          </details>
        </div>
      `;
    }

    document.addEventListener('click', function (event) {
      const menu = document.querySelector('.call-menu[open]');
      if (menu && !menu.contains(event.target)) menu.removeAttribute('open');
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      const menu = document.querySelector('.call-menu[open]');
      if (menu) menu.removeAttribute('open');
    });

    function renderSessions() {
      const html = state.sessions.map(i => {
        const isOnline = state.onlineUsers.includes(i);
        const dotColor = isOnline ? '#2ecc71' : '#e74c3c';
        const displayName = getDisplayName(i);
        const hasUnread = state.unreadCount[i] && state.unreadCount[i] > 0;

        return `
          <div class="session ${state.current === i ? 'active' : ''}" onclick="select('${i}')" oncontextmenu="showContextMenu(event, '${i}')" style="position:relative;">
            <div class="session-main">
              <span style="
                width:10px;
                height:10px;
                border-radius:50%;
                background:${dotColor};
                display:inline-block;
                flex-shrink:0;
              "></span>
              <i class="fa-solid fa-user"></i>
              <span class="session-name">${displayName}</span>
            </div>

            <div class="del-btn" onclick="event.stopPropagation(); confirmDelete('${i}')">
              <i class="fa-solid fa-xmark"></i>
            </div>

            ${hasUnread ? `
              <span style="
                position:absolute;
                top:4px;
                right:4px;
                width:10px;
                height:10px;
                background:#ef4444;
                border-radius:50%;
              "></span>
            ` : ''}
          </div>
        `;
      }).join('') || '<div style="color:#999;text-align:center">暂无会话</div>';

      document.getElementById('sessions').innerHTML = html;
      updateChatHeader();
    }

    function showContextMenu(event, id) {
      event.preventDefault();
      state.contextMenuTargetId = id;

      const oldMenu = document.querySelector('.context-menu');
      if (oldMenu) oldMenu.remove();

      const menu = document.createElement('div');
      menu.className = 'context-menu';
      menu.style.left = event.clientX + 'px';
      menu.style.top = event.clientY + 'px';
      menu.innerHTML = `
        <div class="context-menu-item" onclick="openRemarkModal('${id}')">
          <i class="fa-solid fa-pen"></i> 设置备注
        </div>
        <div class="context-menu-item" onclick="confirmDelete('${id}'); closeContextMenu()">
          <i class="fa-solid fa-trash"></i> 删除会话
        </div>
      `;
      document.body.appendChild(menu);

      setTimeout(() => {
        document.addEventListener('click', closeContextMenu, { once: true });
      }, 0);
    }

    function closeContextMenu() {
      const menu = document.querySelector('.context-menu');
      if (menu) menu.remove();
    }

    function openRemarkModal(id) {
      state.contextMenuTargetId = id;
      closeContextMenu();
      const remarkInput = document.getElementById('remarkInput');
      remarkInput.value = state.remarks[id] || '';
      document.getElementById('remarkModalOverlay').style.display = 'flex';
      remarkInput.focus();
    }

    function closeRemarkModal() {
      document.getElementById('remarkModalOverlay').style.display = 'none';
      document.getElementById('remarkInput').value = '';
    }

    function confirmRemark() {
      const remarkText = document.getElementById('remarkInput').value.trim();

      if (!remarkText) {
        delete state.remarks[state.contextMenuTargetId];
      } else if (remarkText.length > 20) {
        alert('备注名称不能超过20个字符');
        return;
      } else {
        state.remarks[state.contextMenuTargetId] = remarkText;
      }

      onPersistRemarks();
      closeRemarkModal();
      onRenderSessions();
    }

    return {
      updateChatHeader,
      renderSessions,
      showContextMenu,
      closeContextMenu,
      openRemarkModal,
      closeRemarkModal,
      confirmRemark,
      onSelect,
      onConfirmDelete,
      onBackToSessions
    };
  }

  global.ChatSessionModule = {
    createSessionModule
  };
})(window);
