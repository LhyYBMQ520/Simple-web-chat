    let myId;
    let ws;
    let current = null;
    let sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    let remarks = JSON.parse(localStorage.getItem('remarks') || '{}'); // 备注存储
    let unreadCount = {}; // 未读消息计数
    let onlineUsers = [];
    let contextMenuTargetId = null; // 右键菜单目标
    
    // ========== UID 状态管理 ==========
    let uidStatus = 'valid'; // valid, about_to_expire, expired
    let uidTTL = 0; // 剩余时间（毫秒）

    // 初始化ID
    function initID() {
      const id = localStorage.getItem('uid');
      const exp = +localStorage.getItem('exp') || 0;
      const now = Date.now();
      
      // 前端本地检查（备用）
      if (!id || now >= exp) {
        // 生成新 UID
        myId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('uid', myId);
        localStorage.setItem('exp', now + 24 * 60 * 60 * 1000); // 24小时
      } else {
        myId = id;
      }
      
      updateUIDDisplay();
    }

    // 更新 UID 显示（显示状态和剩余时间）
    function updateUIDDisplay() {
      const element = document.getElementById('myId');
      let statusText = '';
      let statusColor = '#2ecc71'; // 绿色：有效
      
      if (uidStatus === 'expired') {
        statusText = '❌ 已过期，请刷新页面';
        statusColor = '#e74c3c'; // 红色：过期
      } else if (uidStatus === 'about_to_expire') {
        const minutes = Math.floor(uidTTL / 60000);
        const seconds = Math.floor((uidTTL % 60000) / 1000);
        statusText = `⚠️ 即将过期（${minutes}:${String(seconds).padStart(2, '0')}）`;
        statusColor = '#f39c12'; // 橙色：即将过期
      } else {
        const hours = Math.floor(uidTTL / 3600000);
        const minutes = Math.floor((uidTTL % 3600000) / 60000);
        statusText = `✓ ${hours}小时${minutes}分钟后过期`;
        statusColor = '#2ecc71'; // 绿色：有效
      }
      
      element.innerHTML = `
        <span>${myId}</span>
        <span style="
          display: inline-block;
          background: ${statusColor};
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-left: 8px;
        ">${statusText}</span>
        <button class="copy-btn" onclick="copyMyId()" title="复制ID">
          <i class="fa-solid fa-copy"></i>
        </button>
      `;
    }

    // 定期更新 UID 显示（每秒更新一次）
    function startUIDStatusUpdater() {
      setInterval(() => {
        if (uidTTL > 0) {
          uidTTL -= 1000;
          if (uidTTL < 0) uidTTL = 0;
          
          // ✨ 自动状态转换：当剩余时间少于5分钟时
          if (uidTTL < 5 * 60 * 1000 && uidTTL > 0 && uidStatus === 'valid') {
            uidStatus = 'about_to_expire';
          }
          
          updateUIDDisplay();
          
          // ✨ 时间到期时自动刷新（任何非'expired'状态都会触发）
          if (uidTTL <= 0 && uidStatus !== 'expired') {
            uidStatus = 'expired';
            updateUIDDisplay();
            setTimeout(() => {
              alert('❌ 您的 UID 已过期！将刷新页面...');
              location.reload();
            }, 500);
          }
        }
      }, 1000);
    }

    // 复制我的ID
    function copyMyId() {
      // 方法1：使用Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(myId).then(() => {
          showCopySuccess();
        }).catch(() => {
          // 备选方法2：使用 execCommand
          copyWithExecCommand();
        });
      } else {
        // 备选方法2：使用 execCommand
        copyWithExecCommand();
      }
    }

    // 备选复制方法
    function copyWithExecCommand() {
      const textarea = document.createElement('textarea');
      textarea.value = myId;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showCopySuccess();
      } catch (err) {
        console.error('复制失败:', err);
      }
      document.body.removeChild(textarea);
    }

    // 显示复制成功反馈
    function showCopySuccess() {
      const btn = document.querySelector('.copy-btn');
      if (btn) {
        const icon = btn.querySelector('i');
        const originalClass = icon.className;
        icon.className = 'fa-solid fa-check';
        setTimeout(() => {
          icon.className = originalClass;
        }, 1500);
      }
    }

    // 连接WebSocket
    function connect() {
      // 关闭旧连接（防止刷新时连接冲突）
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + window.location.host);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'bind', uid: myId }));
      };

      ws.onmessage = e => {
        const d = JSON.parse(e.data);
        
        // ========== 处理 UID 绑定结果 ==========
        if (d.type === 'bindResult') {
          if (!d.success) {
            // UID 已过期
            uidStatus = 'expired';
            updateUIDDisplay();
            alert('❌ 您的 UID 已过期！\n\n' + d.message);
            // 清除本地存储，迫使用户刷新页面
            localStorage.removeItem('uid');
            localStorage.removeItem('exp');
            setTimeout(() => location.reload(), 1500);
            return;
          }
          
          // 绑定成功
          uidTTL = d.ttl;
          uidStatus = d.status;
          updateUIDDisplay();
          console.log(`[UID 绑定成功] 状态: ${d.status} | 剩余: ${Math.floor(d.ttl / 1000)}秒`);
          return;
        }
        
        // ========== 处理错误消息 ==========
        if (d.type === 'error') {
          console.error('[后端错误]', d.message);
          if (d.message.includes('过期')) {
            uidStatus = 'expired';
            updateUIDDisplay();
          }
          return;
        }
        
        if (d.type === 'request') {
          if (confirm(`${d.from.slice(0, 8)} 请求连接，是否同意？`)) {
            accept(d.from);
          }
        }
        if (d.type === 'accepted') { addSession(d.from); select(d.from); }
        if (d.type === 'history') {
          document.getElementById('msgBox').innerHTML = '';
          d.list.forEach(m => {
            const cls = m.sender === myId ? 'me' : 'other';
            const prefix = cls === 'me' ? '我' : m.sender;
            addMsg(prefix + '：' + m.content, cls);
          });
        }
        if (d.type === 'msg') {
          // 只有当消息来源是当前打开的会话时，才显示消息
          if (d.from === current) {
            addMsg(d.from + '：' + d.content, 'other');
          } else {
            // 消息来自其他会话，标记为未读
            unreadCount[d.from] = (unreadCount[d.from] || 0) + 1;
            render(); // 更新UI显示未读点
          }
        }
        if (d.type === 'online') {
          onlineUsers = d.list;
          render(); // 重新渲染列表
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 2000);
      };
    }

    // 发送好友请求
    function sendRequest() {
      const to = document.getElementById('targetId').value.trim();
      if (!to || to === myId) {
        alert("请输入正确的对方ID");
        return;
      }
      if (ws.readyState !== WebSocket.OPEN) {
        alert("连接未就绪，请稍候重试");
        return;
      }
      ws.send(JSON.stringify({ type: 'request', to }));
      alert("请求已发送！等待对方同意");
    }

    // 同意请求
    function accept(from) {
      ws.send(JSON.stringify({ type: 'accept', from }));
      addSession(from);
      select(from);
    }

    // 确认删除会话
    function confirmDelete(id) {
      if (confirm('确定要删除此会话吗？')) {
        deleteSession(id);
      }
    }

    // 删除会话
    function deleteSession(id) {
      sessions = sessions.filter(item => item !== id);
      localStorage.setItem('sessions', JSON.stringify(sessions));
      // 清除未读计数
      delete unreadCount[id];
      if (current === id) {
        current = null;
        document.getElementById('title').innerText = "请选择会话";
        document.getElementById('msgBox').innerHTML = "";
        // 隐藏输入框
        document.querySelector('.input-bar').style.display = 'none';
        // 手机端：删除当前会话时返回到列表
        if (window.innerWidth <= 768) {
          backToSessions();
        }
      }
      render();
    }

    // 会话管理
    function addSession(id) {
      if (!sessions.includes(id)) sessions.push(id);
      localStorage.setItem('sessions', JSON.stringify(sessions));
      render();
    }

    function render() {
      document.getElementById('sessions').innerHTML = sessions.map(i => {
        const isOnline = onlineUsers.includes(i);
        const dotColor = isOnline ? '#2ecc71' : '#e74c3c';
        const displayName = remarks[i] ? `(${remarks[i]}) ${i}` : i;
        const hasUnread = unreadCount[i] && unreadCount[i] > 0;

        return `
          <div class="session ${current === i ? 'active' : ''}" onclick="select('${i}')" oncontextmenu="showContextMenu(event, '${i}')" style="position:relative;">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="
                width:10px;
                height:10px;
                border-radius:50%;
                background:${dotColor};
                display:inline-block;
                flex-shrink:0;
              "></span>
              <i class="fa-solid fa-user"></i> ${displayName}
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
      // 同步更新聊天头部
      updateChatHeader();
    }

    // 选中聊天对象 → 加载历史记录
    function select(id) {
      current = id;
      document.getElementById('msgBox').innerHTML = '';
      updateChatHeader();
      // 加载历史消息
      ws.send(JSON.stringify({type:"getHistory", with:id}));
      
      // 清除该会话的未读计数
      unreadCount[id] = 0;
      
      render();
      
      // 显示输入框
      document.querySelector('.input-bar').style.display = 'flex';
      
      // 手机端：切换到聊天界面
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.add('hidden');
        document.querySelector('.chat').classList.remove('hidden');
      }
    }

    // 返回会话列表（手机端）
    function backToSessions() {
      current = null; // 清空当前选中的会话，确保未读消息能正确显示红点
      // 隐藏输入框
      document.querySelector('.input-bar').style.display = 'none';
      document.querySelector('.sidebar').classList.remove('hidden');
      document.querySelector('.chat').classList.add('hidden');
      // 重置聊天头部和消息区域
      document.getElementById('title').innerText = "请选择会话";
      document.getElementById('msgBox').innerHTML = "";
      render(); // 重新渲染会话列表
    }

    // 更新聊天头部（包含在线状态）
    function updateChatHeader() {
      if (!current) return;
      const isOnline = onlineUsers.includes(current);
      const dotColor = isOnline ? '#2ecc71' : '#e74c3c';
      const displayName = remarks[current] ? `(${remarks[current]}) ${current}` : current;
      
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

    // 发送消息
    function send() {
      const text = document.getElementById('msgInput').value.trim();
      if (!text || !current) return;
      ws.send(JSON.stringify({ type: 'message', to: current, content: text }));
      addMsg('我：' + text, 'me');
      document.getElementById('msgInput').value = '';
    }

    // 显示右键菜单
    function showContextMenu(event, id) {
      event.preventDefault();
      contextMenuTargetId = id;

      // 移除旧菜单
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

      // 点击其他地方关闭菜单
      setTimeout(() => {
        document.addEventListener('click', closeContextMenu, { once: true });
      }, 0);
    }

    // 关闭右键菜单
    function closeContextMenu() {
      const menu = document.querySelector('.context-menu');
      if (menu) menu.remove();
    }

    // 打开备注对话框
    function openRemarkModal(id) {
      contextMenuTargetId = id;
      closeContextMenu();
      const remarkInput = document.getElementById('remarkInput');
      remarkInput.value = remarks[id] || '';
      document.getElementById('remarkModalOverlay').style.display = 'flex';
      remarkInput.focus();
    }

    // 关闭备注对话框
    function closeRemarkModal() {
      document.getElementById('remarkModalOverlay').style.display = 'none';
      document.getElementById('remarkInput').value = '';
    }

    // 确认备注
    function confirmRemark() {
      const remarkText = document.getElementById('remarkInput').value.trim();
      
      if (!remarkText) {
        // 空备注 = 删除备注
        delete remarks[contextMenuTargetId];
      } else if (remarkText.length > 20) {
        alert('备注名称不能超过20个字符');
        return;
      } else {
        remarks[contextMenuTargetId] = remarkText;
      }
      
      localStorage.setItem('remarks', JSON.stringify(remarks));
      closeRemarkModal();
      render();
    }

    // 工具
    function addMsg(text, cls) {
      const m = document.createElement('div');
      m.className = 'msg ' + cls;
      m.innerText = text;
      msgBox.appendChild(m);
      msgBox.scrollTop = 999999;
    }

    // 绑定所有事件
    window.onload = () => {
      initID();
      startUIDStatusUpdater(); // ⭐新增：启动 UID 状态更新器
      connect();
      render();

      document.getElementById('sendRequestBtn').onclick = sendRequest;
      document.querySelector('.send').onclick = send;
      document.getElementById('msgInput').onkeydown = e => {
        if (e.key === 'Enter') send();
      };

      // 初始化：隐藏消息输入框
      document.querySelector('.input-bar').style.display = 'none';

      // 手机端初始化：隐藏聊天区域
      if (window.innerWidth <= 768) {
        document.querySelector('.chat').classList.add('hidden');
      }

      // 监听窗口大小变化 - 跨过768px界限时刷新页面
      let lastIsMobile = window.innerWidth <= 768;
      window.addEventListener('resize', () => {
        const isMobile = window.innerWidth <= 768;
        
        // 检测是否跨过768px界限
        if (lastIsMobile !== isMobile) {
          lastIsMobile = isMobile;
          // 刷新页面
          location.reload();
        }
      });
    };
    