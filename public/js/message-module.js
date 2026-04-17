(function initMessageModule(global) {
  function createMessageModule(options) {
    const {
      state,
      messageStatus,
      onEditMessage,
      onRecallMessage,
      onAddSession,
      onRenderSessions
    } = options;

    function formatMsgTime(timestamp) {
      if (!timestamp) return '';
      const d = new Date(Number(timestamp));
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    function normalizeMessage(raw, fallbackPeerId) {
      if (!raw) return null;

      const sender = raw.sender || raw.from;
      if (!sender) return null;

      const parsedId = Number(raw.id);
      const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

      let receiver = raw.receiver;
      if (!receiver) {
        receiver = sender === state.myId ? (fallbackPeerId || state.current || '') : state.myId;
      }

      const content = typeof raw.content === 'string' ? raw.content : '';
      const parsedTime = Number(raw.time);
      const time = Number.isFinite(parsedTime) && parsedTime > 0 ? parsedTime : Date.now();

      let status = raw.status || messageStatus.NORMAL;
      if (status !== messageStatus.RECALLED) {
        status = messageStatus.NORMAL;
      }

      const editedAtRaw = raw.editedAt ?? raw.edited_at ?? null;
      const parsedEditedAt = Number(editedAtRaw);
      const editedAt = Number.isFinite(parsedEditedAt) && parsedEditedAt > 0 ? parsedEditedAt : null;

      const readAtRaw = raw.readAt ?? raw.read_at ?? null;
      const parsedReadAt = Number(readAtRaw);
      const readAt = Number.isFinite(parsedReadAt) && parsedReadAt > 0 ? parsedReadAt : null;

      return {
        id,
        sender,
        receiver,
        content,
        time,
        status,
        editedAt,
        readAt
      };
    }

    function getPeerFromMessage(message) {
      return message.sender === state.myId ? message.receiver : message.sender;
    }

    function getMessageDisplayText(message) {
      if (message.status === messageStatus.RECALLED) {
        return message.sender === state.myId ? '你撤回了一条消息' : '对方撤回了一条消息';
      }
      return message.content;
    }

    function getMessageMetaText(message) {
      if (message.status === messageStatus.RECALLED) {
        return '';
      }

      const parts = [];
      const displayTime = message.editedAt || message.time;
      const timeText = formatMsgTime(displayTime);
      if (timeText) parts.push(timeText);
      if (message.editedAt) {
        parts.push('已编辑');
      }
      parts.push(message.readAt ? '已读' : '未读');

      return parts.join(' · ');
    }

    function canOperateMessage(message) {
      return message.sender === state.myId && message.status !== messageStatus.RECALLED && message.id !== null;
    }

    function createMessageActions(message) {
      const actions = document.createElement('div');
      actions.className = 'msg-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'msg-action-btn';
      editBtn.title = '编辑消息';
      editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
      editBtn.onclick = event => {
        event.stopPropagation();
        onEditMessage(message.id);
      };

      const recallBtn = document.createElement('button');
      recallBtn.type = 'button';
      recallBtn.className = 'msg-action-btn recall';
      recallBtn.title = '撤回消息';
      recallBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
      recallBtn.onclick = event => {
        event.stopPropagation();
        onRecallMessage(message.id);
      };

      actions.appendChild(editBtn);
      actions.appendChild(recallBtn);
      return actions;
    }

    function applyMessageToElement(el, message) {
      el.classList.remove('me', 'other', 'recalled');
      el.classList.add(message.sender === state.myId ? 'me' : 'other');
      if (message.status === messageStatus.RECALLED) {
        el.classList.add('recalled');
      }

      if (message.id !== null) {
        el.dataset.messageId = String(message.id);
      }

      el.dataset.sender = message.sender;
      el.dataset.receiver = message.receiver;

      let textEl = el.querySelector('.msg-text');
      if (!textEl) {
        textEl = document.createElement('div');
        textEl.className = 'msg-text';
        el.appendChild(textEl);
      }
      textEl.innerText = getMessageDisplayText(message);

      let metaEl = el.querySelector('.msg-meta');
      if (!metaEl) {
        metaEl = document.createElement('div');
        metaEl.className = 'msg-meta';
        el.appendChild(metaEl);
      }
      const metaText = getMessageMetaText(message);
      metaEl.innerText = metaText;
      metaEl.style.display = metaText ? '' : 'none';

      const oldActions = el.querySelector('.msg-actions');
      if (oldActions) oldActions.remove();

      if (canOperateMessage(message)) {
        el.appendChild(createMessageActions(message));
      }
    }

    function createMessageElement(message) {
      const el = document.createElement('div');
      el.className = 'msg';
      applyMessageToElement(el, message);
      return el;
    }

    function appendMessage(message, scroll) {
      const box = document.getElementById('msgBox');
      box.appendChild(createMessageElement(message));
      if (scroll !== false) {
        box.scrollTop = box.scrollHeight;
      }
    }

    function upsertMessageInCurrentView(message) {
      if (!state.current) return;
      const peerId = getPeerFromMessage(message);
      if (peerId !== state.current) return;

      if (message.id === null) {
        appendMessage(message);
        return;
      }

      const existing = document.querySelector(`.msg[data-message-id="${message.id}"]`);
      if (existing) {
        applyMessageToElement(existing, message);
        return;
      }

      appendMessage(message);
    }

    function renderHistoryMessages(list) {
      const box = document.getElementById('msgBox');
      box.innerHTML = '';

      const fragment = document.createDocumentFragment();
      list.forEach(item => {
        const message = normalizeMessage(item, state.current);
        if (!message) return;
        fragment.appendChild(createMessageElement(message));
      });

      box.appendChild(fragment);
      box.scrollTop = box.scrollHeight;
    }

    function handleIncomingRealtimeMessage(data) {
      const fallbackRaw = data.message
        ? data.message
        : {
          id: data.id,
          sender: data.from,
          receiver: state.myId,
          content: data.content,
          time: Date.now(),
          status: messageStatus.NORMAL,
          editedAt: null
        };

      const message = normalizeMessage(fallbackRaw, data.from || state.current);
      if (!message) return;

      const peerId = getPeerFromMessage(message);
      if (peerId && !state.sessions.includes(peerId)) {
        onAddSession(peerId);
      }

      if (peerId === state.current) {
        upsertMessageInCurrentView(message);
      } else if (message.sender !== state.myId) {
        state.unreadCount[peerId] = (state.unreadCount[peerId] || 0) + 1;
        onRenderSessions();
      }
    }

    function handleMessagePatch(rawMessage) {
      const message = normalizeMessage(rawMessage, state.current);
      if (!message || message.id === null) return;
      upsertMessageInCurrentView(message);
    }

    function handleMessagesRead(list) {
      if (!Array.isArray(list)) return;
      list.forEach(item => handleMessagePatch(item));
    }

    return {
      renderHistoryMessages,
      handleIncomingRealtimeMessage,
      handleMessagePatch,
      handleMessagesRead
    };
  }

  global.ChatMessageModule = {
    createMessageModule
  };
})(window);
