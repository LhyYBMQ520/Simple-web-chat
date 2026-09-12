(function initTestVersionNoticeModule(global) {
  const STORAGE_KEY = 'lchatTestVersionNoticeAcknowledged';

  function hasAcknowledged() {
    try {
      return global.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }

  function acknowledge(overlay) {
    try {
      global.localStorage.setItem(STORAGE_KEY, 'true');
    } catch (_) {
      // 本次仍允许关闭；存储不可用时，下次访问将再次提示。
    }
    overlay.remove();
  }

  function showNotice() {
    if (hasAcknowledged()) return;

    const style = document.createElement('style');
    style.textContent = `
      .test-version-notice-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(15, 23, 42, 0.5);
      }

      .test-version-notice-dialog {
        width: min(500px, 100%);
        padding: 24px;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.24);
      }

      .test-version-notice-dialog h2 {
        margin-bottom: 14px;
        color: #0f172a;
        font-size: 20px;
      }

      .test-version-notice-dialog p {
        margin-top: 10px;
        color: #475569;
        font-size: 14px;
        line-height: 1.7;
      }

      .test-version-notice-dialog strong {
        color: #dc2626;
      }

      .test-version-notice-dialog button {
        width: 100%;
        min-height: 40px;
        margin-top: 20px;
        border: 1px solid #2563eb;
        border-radius: 7px;
        background: #2563eb;
        color: #fff;
        cursor: pointer;
      }

      .test-version-notice-dialog button:hover {
        background: #1d4ed8;
      }

      .test-version-notice-dialog button:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.3);
        outline-offset: 2px;
      }
    `;

    const overlay = document.createElement('div');
    overlay.className = 'test-version-notice-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'testVersionNoticeTitle');
    overlay.innerHTML = `
      <div class="test-version-notice-dialog">
        <h2 id="testVersionNoticeTitle">测试版本提示</h2>
        <p>该项目目前仍处于开发测试阶段。<br>即使您使用永久账户，网页中的聊天文本、上传文件，乃至账号本身，都有可能因版本更新被删除、初始化。</p>
        <p>为避免数据丢失带来损失，请<strong>不要使用本站存储任何重要数据</strong>。</p>
        <button type="button">我已知晓</button>
      </div>
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    const button = overlay.querySelector('button');
    button.addEventListener('click', () => acknowledge(overlay));
    button.focus();
  }

  showNotice();
})(window);
