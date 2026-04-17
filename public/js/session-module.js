(function initSessionModule(global) {
  function createSessionModule(options) {
    const {
      state,
      onSelect,
      onConfirmDelete,
      onBackToSessions,
      onRenderSessions,
      onPersistRemarks
    } = options;

    function updateChatHeader() {
      if (!state.current) return;

      const isOnline = state.onlineUsers.includes(state.current);
      const dotColor = isOnline ? '#2ecc71' : '#e74c3c';
      const displayName = state.remarks[state.current]
        ? `(${state.remarks[state.current]}) ${state.current}`
        : state.current;

      document.getElementById('title').innerHTML = `
        <button class="back-btn" onclick="backToSessions()" title="返回">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <i class="fa-solid fa-message"></i> 聊天：${displayName}
        <span style="
          width:10px;
          height:10px;
          border-radius:50%;
          background:${dotColor};
          display:inline-block;
          margin-left:auto;
          flex-shrink:0;
        "></span>
      `;
    }

    function renderSessions() {
      const html = state.sessions.map(i => {
        const isOnline = state.onlineUsers.includes(i);
        const dotColor = isOnline ? '#2ecc71' : '#e74c3c';
        const displayName = state.remarks[i] ? `(${state.remarks[i]}) ${i}` : i;
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
