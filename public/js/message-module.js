(function initMessageModule(global) {
  function createMessageModule(options) {
    const {
      state,
      messageStatus,
      onEditMessage,
      onRecallMessage,
      onQuoteMessage,
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

      const msgType = raw.msgType || 'text';
      const fileKey = raw.fileKey || null;
      const quoteId = raw.quoteId != null ? Number(raw.quoteId) : null;
      const quoteMessage = raw.quoteMessage || null;

      return {
        id,
        sender,
        receiver,
        content,
        time,
        status,
        editedAt,
        readAt,
        msgType,
        fileKey,
        quoteId,
        quoteMessage
      };
    }

    function getPeerFromMessage(message) {
      return message.sender === state.myId ? message.receiver : message.sender;
    }

    function parseFileContent(message) {
      if (message.msgType === 'text') return null;
      try {
        return JSON.parse(message.content);
      } catch (e) {
        return null;
      }
    }

    function getMessageDisplayText(message) {
      if (message.status === messageStatus.RECALLED) {
        return message.sender === state.myId ? '你撤回了一条消息' : '对方撤回了一条消息';
      }
      let prefix = '';
      if (message.quoteId) {
        prefix = '引用: ';
      }
      if (message.msgType === 'image') {
        return prefix + '[图片]';
      }
      if (message.msgType === 'file') {
        const file = parseFileContent(message);
        return prefix + (file ? `[文件] ${file.name}` : '[文件]');
      }
      return prefix + message.content;
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

    function canEditMessage(message) {
      return canOperateMessage(message) && message.msgType === 'text';
    }

    function createMessageActions(message) {
      const actions = document.createElement('div');
      actions.className = 'msg-actions';

      // 引用按钮 - 所有非撤回消息都可引用
      if (message.status !== messageStatus.RECALLED && message.id !== null) {
        const quoteBtn = document.createElement('button');
        quoteBtn.type = 'button';
        quoteBtn.className = 'msg-action-btn quote';
        quoteBtn.title = '引用回复';
        quoteBtn.innerHTML = '<i class="fa-solid fa-quote-left"></i>';
        quoteBtn.onclick = event => {
          event.stopPropagation();
          onQuoteMessage(message);
        };
        actions.appendChild(quoteBtn);
      }

      if (canEditMessage(message)) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'msg-action-btn';
        editBtn.title = '编辑消息';
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
        editBtn.onclick = event => {
          event.stopPropagation();
          onEditMessage(message.id);
        };
        actions.appendChild(editBtn);
      }

      if (canOperateMessage(message)) {
        const recallBtn = document.createElement('button');
        recallBtn.type = 'button';
        recallBtn.className = 'msg-action-btn recall';
        recallBtn.title = '撤回消息';
        recallBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
        recallBtn.onclick = event => {
          event.stopPropagation();
          onRecallMessage(message.id);
        };
        actions.appendChild(recallBtn);
      }

      return actions;
    }

    function applyMessageToElement(el, message) {
      el.classList.remove('me', 'other', 'recalled', 'msg-image', 'msg-file');
      const isMe = message.sender === state.myId;
      el.classList.add(isMe ? 'me' : 'other');
      const row = el.parentNode;
      if (row && row.classList.contains('msg-row')) {
        row.classList.remove('me', 'other');
        row.classList.add(isMe ? 'me' : 'other');
      }
      if (message.status === messageStatus.RECALLED) {
        el.classList.add('recalled');
      }

      if (message.id !== null) {
        el.dataset.messageId = String(message.id);
      }

      el.dataset.sender = message.sender;
      el.dataset.receiver = message.receiver;

      // 清除旧内容
      el.querySelector('.msg-text')?.remove();
      el.querySelector('.msg-image-wrapper')?.remove();
      el.querySelector('.msg-img-name')?.remove();
      el.querySelector('.msg-file-card')?.remove();
      el.querySelector('.msg-actions')?.remove();
      el.querySelector('.msg-quote')?.remove();

      const isRecalled = message.status === messageStatus.RECALLED;

      // 引用消息预览
      if (message.quoteMessage && message.quoteId) {
        const quoteEl = document.createElement('div');
        quoteEl.className = 'msg-quote';
        const qm = message.quoteMessage;
        const isQuotedRecalled = qm.status === 'recalled';
        const quoteSender = qm.sender === state.myId ? '你' : (qm.sender || '').slice(0, 8);
        const quoteContent = isQuotedRecalled
          ? '消息已被撤回'
          : (qm.msgType === 'image' ? '[图片]' : qm.msgType === 'file' ? '[文件]' : qm.content);
        quoteEl.innerHTML =
          '<div class="msg-quote-header"><i class="fa-solid fa-quote-left"></i> ' + escapeHtml(quoteSender) + '</div>' +
          '<div class="msg-quote-content">' + escapeHtml(quoteContent || '') + '</div>';
        quoteEl.title = '点击跳转到原消息';
        quoteEl.onclick = function () {
          const targetRow = document.querySelector('.msg-row[data-message-id="' + qm.id + '"]');
          if (targetRow) {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRow.classList.add('msg-highlight');
            setTimeout(function () { targetRow.classList.remove('msg-highlight'); }, 2000);
          }
        };
        el.appendChild(quoteEl);
      }

      if (isRecalled) {
        const textEl = document.createElement('div');
        textEl.className = 'msg-text';
        textEl.innerText = getMessageDisplayText(message);
        el.appendChild(textEl);
      } else if (message.msgType === 'image') {
        el.classList.add('msg-image');
        const file = parseFileContent(message);
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'msg-image-wrapper';

        const img = document.createElement('img');
        img.className = 'msg-img';
        img.src = file ? file.url : '';
        img.alt = file ? file.name : '图片';
        img.title = file ? file.name : '';
        img.loading = 'lazy';
        img.onclick = function () {
          const lb = document.getElementById('lightbox');
          const lbImg = document.getElementById('lightboxImg');
          if (lb && lbImg) {
            lbImg.src = img.src;
            lb.style.display = 'flex';
          }
        };
        img.onerror = function () {
          console.error('[图片加载失败] URL:', img.src);
          img.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.className = 'msg-image-fallback';
          fallback.innerHTML = '<i class="fa-solid fa-image"></i><span>图片加载失败</span>';
          imgWrapper.appendChild(fallback);
        };

        imgWrapper.appendChild(img);
        el.appendChild(imgWrapper);

        if (file && file.name) {
          const nameEl = document.createElement('div');
          nameEl.className = 'msg-img-name';
          nameEl.innerText = file.name;
          el.appendChild(nameEl);
        }
      } else if (message.msgType === 'file') {
        el.classList.add('msg-file');
        const file = parseFileContent(message);
        const card = document.createElement('a');
        card.className = 'msg-file-card';
        card.href = file ? ('/api/download?key=' + encodeURIComponent(file.fileKey || '') + '&name=' + encodeURIComponent(file.name || '')) : '#';
        card.target = '_blank';
        card.rel = 'noopener';
        card.download = file ? file.name : '';

        const sizeText = file && file.size ? formatFileSize(file.size) : '';
        card.innerHTML =
          '<i class="fa-solid fa-file"></i>' +
          '<div class="msg-file-info">' +
            '<span class="msg-file-name">' + (file ? escapeHtml(file.name) : '未知文件') + '</span>' +
            (sizeText ? '<span class="msg-file-size">' + sizeText + '</span>' : '') +
          '</div>' +
          '<i class="fa-solid fa-download msg-file-download"></i>';

        el.appendChild(card);
      } else {
        el.classList.add('msg-text-only');
        const textEl = document.createElement('div');
        textEl.className = 'msg-text';
        textEl.innerText = getMessageDisplayText(message);
        el.appendChild(textEl);
      }

      let metaEl = el.querySelector('.msg-meta');
      if (!metaEl) {
        metaEl = document.createElement('div');
        metaEl.className = 'msg-meta';
        el.appendChild(metaEl);
      }
      const metaText = getMessageMetaText(message);
      metaEl.innerText = metaText;
      metaEl.style.display = metaText ? '' : 'none';

      // 有引用或可操作则显示按钮栏
      const hasActions = message.status !== messageStatus.RECALLED && message.id !== null;
      if (hasActions) {
        el.appendChild(createMessageActions(message));
      }
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
      return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    function createMessageElement(message) {
      const row = document.createElement('div');
      row.className = 'msg-row';
      row.dataset.messageId = message.id || '';
      const el = document.createElement('div');
      el.className = 'msg';
      row.appendChild(el);
      applyMessageToElement(el, message);
      return row;
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
