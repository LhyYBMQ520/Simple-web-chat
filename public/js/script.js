(function bootstrapChatApp(global) {
  const appStateModule = global.ChatAppState;
  const uidModule = global.ChatUIDModule;
  const messageModuleFactory = global.ChatMessageModule;
  const sessionModuleFactory = global.ChatSessionModule;
  const wsModuleFactory = global.ChatWsModule;
  const fileUploadModuleFactory = global.ChatFileUploadModule;
  const emojiDataModule = global.ChatEmojiData;
  const emojiModuleFactory = global.ChatEmojiModule;

  if (!appStateModule || !uidModule || !messageModuleFactory || !sessionModuleFactory || !wsModuleFactory || !fileUploadModuleFactory || !emojiDataModule || !emojiModuleFactory) {
    throw new Error('聊天模块加载失败，请检查 js 文件加载顺序');
  }

  const state = appStateModule.createInitialState();
  const MESSAGE_STATUS = appStateModule.MESSAGE_STATUS;

  let sessionModule;
  let messageModule;
  let wsModule;
  let fileUploadModule;
  let emojiModule;

  function getConnectionUIModel() {
    if (state.connectionState === 'connected') {
      const latencyText = Number.isFinite(state.connectionLatency) ? `${state.connectionLatency}ms` : '--ms';
      return {
        className: 'connected',
        icon: 'fa-solid fa-signal',
        text: latencyText,
        title: `已连接，延迟 ${latencyText}`
      };
    }

    if (state.connectionState === 'reconnecting') {
      return {
        className: 'reconnecting',
        icon: 'fa-solid fa-rotate fa-spin',
        text: '重连中',
        title: '与服务器断开，正在重连'
      };
    }

    if (state.connectionState === 'connecting') {
      return {
        className: 'connecting',
        icon: 'fa-solid fa-circle-notch fa-spin',
        text: '连接中',
        title: '正在连接服务器'
      };
    }

    return {
      className: 'disconnected',
      icon: 'fa-solid fa-circle-xmark',
      text: '已断开',
      title: '未连接到服务器'
    };
  }

  function updateConnectionStatusUI() {
    const el = document.getElementById('connectionStatus');
    if (!el) return;

    const model = getConnectionUIModel();
    el.className = `connection-status ${model.className}`;
    el.title = model.title;
    el.innerHTML = `
      <i class="${model.icon}"></i>
      <span>${model.text}</span>
    `;
  }

  function render() {
    sessionModule.renderSessions();
  }

  function addSession(id) {
    if (!state.sessions.includes(id)) {
      state.sessions.push(id);
      appStateModule.persistSessions(state);
      render();
    }
  }

  function accept(from) {
    wsModule.sendAccept(from);
    addSession(from);
    select(from);
  }

  function sendRequest() {
    const to = document.getElementById('targetId').value.trim();
    if (!to || to === state.myId) {
      alert('请输入正确的对方ID');
      return;
    }

    if (!wsModule.isOpen()) {
      alert('连接未就绪，请稍候重试');
      return;
    }

    wsModule.sendRequest(to);
    alert('请求已发送！等待对方同意');
  }

  function send() {
    const el = document.getElementById('msgInput');
    const text = el.value.trim();
    if (!text || !state.current) return;

    if (!wsModule.isOpen()) {
      alert('连接未就绪，请稍后重试');
      return;
    }

    if (editingMessageId !== null) {
      wsModule.sendEditMessage(state.current, editingMessageId, text);
      editingMessageId = null;
    } else {
      wsModule.sendChatMessage(state.current, text);
    }

    el.value = '';
    el.style.height = '';
    el.focus();
    updateSendButtonState();
  }

  function editOwnMessage(messageId) {
    if (!state.current || !Number.isInteger(messageId)) return;

    const target = document.querySelector(`.msg[data-message-id="${messageId}"]`);
    const textEl = target ? target.querySelector('.msg-text') : null;
    if (!textEl) return;

    const msgInput = document.getElementById('msgInput');
    msgInput.value = textEl.innerText;
    editingMessageId = messageId;

    autoResizeTextarea();
    updateSendButtonState();

    msgInput.focus();
    msgInput.selectionStart = msgInput.selectionEnd = msgInput.value.length;
  }

  function recallOwnMessage(messageId) {
    if (!state.current || !Number.isInteger(messageId)) return;

    if (!confirm('确定要撤回这条消息吗？')) return;

    if (!wsModule.isOpen()) {
      alert('连接未就绪，请稍后重试');
      return;
    }

    wsModule.sendRecallMessage(state.current, messageId);
  }

  function select(id) {
    if (window.innerWidth > 768 && state.current === id) {
      state.current = null;
      wsModule.syncActiveChatState();
      document.getElementById('title').innerText = '请选择会话';
      document.getElementById('msgBox').innerHTML = '';
      document.querySelector('.input-bar').style.display = 'none';
      render();
      return;
    }

    state.current = id;
    document.getElementById('msgBox').innerHTML = '';
    sessionModule.updateChatHeader();
    wsModule.syncActiveChatState();

    if (wsModule.isOpen()) {
      wsModule.sendGetHistory(id);
    }

    state.unreadCount[id] = 0;
    render();

    document.querySelector('.input-bar').style.display = 'flex';

    if (window.innerWidth <= 768) {
      document.querySelector('.sidebar').classList.add('hidden');
      document.querySelector('.chat').classList.remove('hidden');
    }
  }

  function backToSessions() {
    state.current = null;
    wsModule.syncActiveChatState();

    document.querySelector('.input-bar').style.display = 'none';
    document.querySelector('.sidebar').classList.remove('hidden');
    document.querySelector('.chat').classList.add('hidden');

    document.getElementById('title').innerText = '请选择会话';
    document.getElementById('msgBox').innerHTML = '';

    render();
  }

  function deleteSession(id) {
    state.sessions = state.sessions.filter(item => item !== id);
    appStateModule.persistSessions(state);

    delete state.unreadCount[id];

    if (state.current === id) {
      state.current = null;
      wsModule.syncActiveChatState();
      document.getElementById('title').innerText = '请选择会话';
      document.getElementById('msgBox').innerHTML = '';
      document.querySelector('.input-bar').style.display = 'none';

      if (window.innerWidth <= 768) {
        backToSessions();
      }
    }

    render();
  }

  function confirmDelete(id) {
    if (confirm('确定要删除此会话吗？')) {
      deleteSession(id);
    }
  }

  function handleBindResult(d) {
    if (!d.success) {
      state.uidStatus = 'expired';
      uidModule.updateUIDDisplay(state);
      alert('❌ 您的 UID 已过期！\n\n' + d.message);
      localStorage.removeItem('uid');
      localStorage.removeItem('exp');
      setTimeout(() => location.reload(), 1500);
      return;
    }

    state.uidTTL = d.ttl;
    state.uidStatus = d.status;
    uidModule.updateUIDDisplay(state);
    console.log(`[UID 绑定成功] 状态: ${d.status} | 剩余: ${Math.floor(d.ttl / 1000)}秒`);
    wsModule.syncActiveChatState();
  }

  function handleError(d) {
    console.error('[后端错误]', d.message);
    if (d.message.includes('过期')) {
      state.uidStatus = 'expired';
      uidModule.updateUIDDisplay(state);
    }
    alert(d.message);
  }

  function handleRequest(d) {
    if (confirm(`${d.from.slice(0, 8)} 请求连接，是否同意？`)) {
      accept(d.from);
    }
  }

  function handleAccepted(d) {
    addSession(d.from);
    select(d.from);
  }

  function handleHistory(d) {
    messageModule.renderHistoryMessages(d.list || []);
  }

  function handleMsg(d) {
    messageModule.handleIncomingRealtimeMessage(d);
  }

  function handleMessagePatched(d) {
    messageModule.handleMessagePatch(d.message);
  }

  function handleMessagesRead(d) {
    messageModule.handleMessagesRead(d.messages || []);
  }

  function handleOnline(d) {
    state.onlineUsers = d.list || [];
    render();
  }

  function handleConnectionStateChange(nextState) {
    state.connectionState = nextState;
    updateConnectionStatusUI();
  }

  function handleLatencyUpdate(latency) {
    state.connectionLatency = Number.isFinite(latency) ? latency : null;
    updateConnectionStatusUI();
  }

  sessionModule = sessionModuleFactory.createSessionModule({
    state,
    onSelect: select,
    onConfirmDelete: confirmDelete,
    onBackToSessions: backToSessions,
    onRenderSessions: render,
    onPersistRemarks: () => appStateModule.persistRemarks(state)
  });

  messageModule = messageModuleFactory.createMessageModule({
    state,
    messageStatus: MESSAGE_STATUS,
    onEditMessage: editOwnMessage,
    onRecallMessage: recallOwnMessage,
    onAddSession: addSession,
    onRenderSessions: render
  });

  wsModule = wsModuleFactory.createWsModule({
    state,
    handlers: {
      onBindResult: handleBindResult,
      onError: handleError,
      onRequest: handleRequest,
      onAccepted: handleAccepted,
      onHistory: handleHistory,
      onMsg: handleMsg,
      onMessagePatched: handleMessagePatched,
      onMessagesRead: handleMessagesRead,
      onOnline: handleOnline,
      onConnectionStateChange: handleConnectionStateChange,
      onLatencyUpdate: handleLatencyUpdate
    }
  });

  fileUploadModule = fileUploadModuleFactory.createFileUploadModule({
    state,
    wsModule,
    onUploadStart: function () {
      const bar = document.getElementById('uploadProgress');
      const barInner = document.getElementById('uploadProgressBar');
      const barText = document.getElementById('uploadProgressText');
      if (bar) bar.style.display = 'block';
      if (barInner) barInner.style.width = '0%';
      if (barText) barText.innerText = '上传中...';
    },
    onUploadProgress: function (pct) {
      const barInner = document.getElementById('uploadProgressBar');
      const barText = document.getElementById('uploadProgressText');
      if (barInner) barInner.style.width = pct + '%';
      if (barText) barText.innerText = '上传中 ' + pct + '%';
    },
    onUploadComplete: function () {
      const bar = document.getElementById('uploadProgress');
      if (bar) bar.style.display = 'none';
    },
    onUploadError: function (msg) {
      const bar = document.getElementById('uploadProgress');
      if (bar) bar.style.display = 'none';
      alert('文件发送失败: ' + msg);
    }
  });

  document.getElementById('uploadCancelBtn').onclick = function () {
    fileUploadModule.cancelUpload();
    var bar = document.getElementById('uploadProgress');
    if (bar) bar.style.display = 'none';
  };

  // Initialize emoji module
  emojiModule = emojiModuleFactory.createEmojiModule({
    emojiData: emojiDataModule,
    onInsertEmoji: function (emojiChar) {
      var msgInput = document.getElementById('msgInput');
      if (!msgInput) return;
      var start = msgInput.selectionStart;
      var end = msgInput.selectionEnd;
      var val = msgInput.value;
      msgInput.value = val.substring(0, start) + emojiChar + val.substring(end);
      // Place cursor after inserted emoji
      var newPos = start + emojiChar.length;
      msgInput.selectionStart = msgInput.selectionEnd = newPos;
      msgInput.focus();
      autoResizeTextarea();
      updateSendButtonState();
    }
  });

  global.copyMyId = function copyMyId() {
    uidModule.copyMyId(state);
  };
  global.select = select;
  global.showContextMenu = function showContextMenu(event, id) {
    sessionModule.showContextMenu(event, id);
  };
  global.confirmDelete = confirmDelete;
  global.openRemarkModal = function openRemarkModal(id) {
    sessionModule.openRemarkModal(id);
  };
  global.closeContextMenu = function closeContextMenu() {
    sessionModule.closeContextMenu();
  };
  global.closeRemarkModal = function closeRemarkModal() {
    sessionModule.closeRemarkModal();
  };
  global.confirmRemark = function confirmRemark() {
    sessionModule.confirmRemark();
  };
  global.backToSessions = backToSessions;

  let updateSendButtonState;
  let autoResizeTextarea;
  let editingMessageId = null;

  window.onload = () => {
    updateConnectionStatusUI();
    uidModule.initID(state, () => uidModule.updateUIDDisplay(state));
    uidModule.startUIDStatusUpdater(state, () => uidModule.updateUIDDisplay(state));
    wsModule.connect();
    render();

    document.getElementById('sendRequestBtn').onclick = sendRequest;

    const msgInput = document.getElementById('msgInput');
    const sendBtn = document.querySelector('.send');
    sendBtn.onclick = send;

    let isComposing = false;
    msgInput.addEventListener('compositionstart', () => { isComposing = true; });
    msgInput.addEventListener('compositionend', () => { isComposing = false; });

    autoResizeTextarea = () => {
      const style = getComputedStyle(msgInput);
      const lineHeight = parseFloat(style.lineHeight);
      const paddingTop = parseFloat(style.paddingTop);
      const paddingBottom = parseFloat(style.paddingBottom);
      const borderTop = parseFloat(style.borderTopWidth);
      const borderBottom = parseFloat(style.borderBottomWidth);
      const maxH = lineHeight * 3 + paddingTop + paddingBottom + borderTop + borderBottom;

      msgInput.style.height = 'auto';
      msgInput.style.height = Math.min(msgInput.scrollHeight, maxH) + 'px';
      msgInput.style.overflowY = msgInput.scrollHeight > maxH ? 'auto' : 'hidden';
    };

    updateSendButtonState = () => {
      const hasContent = msgInput.value.trim().length > 0;
      sendBtn.disabled = !hasContent;
      sendBtn.title = hasContent ? '' : '不能发送空消息';
    };

    const insertNewline = () => {
      const start = msgInput.selectionStart;
      const end = msgInput.selectionEnd;
      const val = msgInput.value;
      msgInput.value = val.substring(0, start) + '\n' + val.substring(end);
      msgInput.selectionStart = msgInput.selectionEnd = start + 1;
      autoResizeTextarea();
      updateSendButtonState();
    };

    msgInput.addEventListener('keydown', e => {
      if (e.key === 'Escape' && editingMessageId !== null) {
        e.preventDefault();
        editingMessageId = null;
        msgInput.value = '';
        msgInput.style.height = '';
        autoResizeTextarea();
        updateSendButtonState();
        return;
      }

      if (e.key !== 'Enter') return;
      if (isComposing) return;

      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault();
        insertNewline();
        return;
      }

      // 移动端：Enter 仅换行，不发送
      if (window.innerWidth <= 768) {
        e.preventDefault();
        insertNewline();
        return;
      }

      // 桌面端：Enter 发送
      e.preventDefault();
      if (msgInput.value.trim().length > 0) {
        send();
      }
    });

    msgInput.addEventListener('paste', () => {
      setTimeout(() => {
        msgInput.selectionStart = msgInput.selectionEnd = msgInput.value.length;
        autoResizeTextarea();
        updateSendButtonState();
      }, 0);
    });

    msgInput.addEventListener('input', () => {
      autoResizeTextarea();
      updateSendButtonState();
    });

    updateSendButtonState();

    document.getElementById('emojiBtn').onclick = function (e) {
      e.stopPropagation();
      emojiModule.show(document.getElementById('emojiBtn'));
    };

    document.getElementById('imageBtn').onclick = function () {
      document.getElementById('fileInput').click();
    };

    document.getElementById('fileBtn').onclick = function () {
      document.getElementById('docInput').click();
    };

    document.getElementById('fileInput').onchange = function () {
      var files = this.files;
      if (files && files.length > 0) {
        for (var i = 0; i < files.length; i++) {
          fileUploadModule.sendFile(files[i]);
        }
        this.value = '';
      }
    };

    document.getElementById('docInput').onchange = function () {
      var files = this.files;
      if (files && files.length > 0) {
        fileUploadModule.sendFile(files[0]);
        this.value = '';
      }
    };

    msgInput.addEventListener('paste', function (e) {
      var items = (e.clipboardData || window.clipboardData).items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          var blob = items[i].getAsFile();
          if (blob) {
            if (!blob.name) {
              blob = new File([blob], 'paste-' + Date.now() + '.png', { type: blob.type });
            }
            fileUploadModule.sendPastedImage(blob);
          }
          break;
        }
      }
    });

    var msgBox = document.getElementById('msgBox');
    msgBox.addEventListener('dragover', function (e) { e.preventDefault(); });
    msgBox.addEventListener('drop', function (e) {
      e.preventDefault();
      var files = e.dataTransfer.files;
      if (files && files.length > 0) {
        for (var i = 0; i < files.length; i++) {
          fileUploadModule.sendFile(files[i]);
        }
      }
    });

    var lightbox = document.getElementById('lightbox');
    if (lightbox) {
      lightbox.onclick = function (e) {
        if (e.target === lightbox || e.target.className === 'lightbox-close') {
          lightbox.style.display = 'none';
          document.getElementById('lightboxImg').src = '';
        }
      };
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var lb = document.getElementById('lightbox');
        if (lb && lb.style.display !== 'none') {
          lb.style.display = 'none';
          document.getElementById('lightboxImg').src = '';
        }
      }
    });

    document.querySelector('.input-bar').style.display = 'none';

    if (window.innerWidth <= 768) {
      document.querySelector('.chat').classList.add('hidden');
    }

    let lastIsMobile = window.innerWidth <= 768;
    window.addEventListener('resize', () => {
      const isMobile = window.innerWidth <= 768;
      if (lastIsMobile !== isMobile) {
        lastIsMobile = isMobile;
        location.reload();
      }
    });
  };
})(window);
