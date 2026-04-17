(function initUIDModule(global) {
  function initID(state, updateUIDDisplay) {
    const id = localStorage.getItem('uid');
    const exp = Number(localStorage.getItem('exp')) || 0;
    const now = Date.now();

    if (!id || now >= exp) {
      state.myId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('uid', state.myId);
      localStorage.setItem('exp', now + 24 * 60 * 60 * 1000);
    } else {
      state.myId = id;
    }

    updateUIDDisplay();
  }

  function updateUIDDisplay(state) {
    const element = document.getElementById('myId');
    let statusText = '';
    let statusColor = '#2ecc71';

    if (state.uidStatus === 'expired') {
      statusText = '❌ 已过期，请刷新页面';
      statusColor = '#e74c3c';
    } else if (state.uidStatus === 'about_to_expire') {
      const minutes = Math.floor(state.uidTTL / 60000);
      const seconds = Math.floor((state.uidTTL % 60000) / 1000);
      statusText = `⚠️ 即将过期（${minutes}:${String(seconds).padStart(2, '0')}）`;
      statusColor = '#f39c12';
    } else {
      const hours = Math.floor(state.uidTTL / 3600000);
      const minutes = Math.floor((state.uidTTL % 3600000) / 60000);
      statusText = `✓ ${hours}小时${minutes}分钟后过期`;
      statusColor = '#2ecc71';
    }

    element.innerHTML = `
      <span>${state.myId}</span>
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

  function startUIDStatusUpdater(state, updateUIDDisplay) {
    setInterval(() => {
      if (state.uidTTL > 0) {
        state.uidTTL -= 1000;
        if (state.uidTTL < 0) state.uidTTL = 0;

        if (state.uidTTL < 5 * 60 * 1000 && state.uidTTL > 0 && state.uidStatus === 'valid') {
          state.uidStatus = 'about_to_expire';
        }

        updateUIDDisplay();

        if (state.uidTTL <= 0 && state.uidStatus !== 'expired') {
          state.uidStatus = 'expired';
          updateUIDDisplay();
          setTimeout(() => {
            alert('❌ 您的 UID 已过期！将刷新页面...');
            location.reload();
          }, 500);
        }
      }
    }, 1000);
  }

  function copyWithExecCommand(text, onSuccess) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      onSuccess();
    } catch (err) {
      console.error('复制失败:', err);
    }

    document.body.removeChild(textarea);
  }

  function showCopySuccess() {
    const btn = document.querySelector('.copy-btn');
    if (!btn) return;

    const icon = btn.querySelector('i');
    const originalClass = icon.className;
    icon.className = 'fa-solid fa-check';
    setTimeout(() => {
      icon.className = originalClass;
    }, 1500);
  }

  function copyMyId(state) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.myId).then(() => {
        showCopySuccess();
      }).catch(() => {
        copyWithExecCommand(state.myId, showCopySuccess);
      });
      return;
    }

    copyWithExecCommand(state.myId, showCopySuccess);
  }

  global.ChatUIDModule = {
    initID,
    updateUIDDisplay,
    startUIDStatusUpdater,
    copyMyId
  };
})(window);
