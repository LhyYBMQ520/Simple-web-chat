(function initFileUploadModule(global) {
  function createFileUploadModule(options) {
    const { state, wsModule, onUploadStart, onUploadProgress, onUploadComplete, onUploadError } = options;
    var activeXhr = null;

    function isImageType(contentType) {
      return /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(contentType);
    }

    async function getPresignedUrl(fileName, contentType, fileSize) {
      const resp = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, contentType, fileSize })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || `服务器错误 ${resp.status}`);
      }

      return resp.json();
    }

    async function uploadToStorage(uploadUrl, file, contentType, extraHeaders) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeXhr = xhr;
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', contentType);
        if (extraHeaders) {
          Object.keys(extraHeaders).forEach(function (key) {
            xhr.setRequestHeader(key, extraHeaders[key]);
          });
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && typeof onUploadProgress === 'function') {
            onUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          activeXhr = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`上传失败: HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          activeXhr = null;
          console.error('[上传失败] 状态码:', xhr.status, 'URL:', uploadUrl);
          reject(new Error(xhr.status === 0
            ? '请求被浏览器拦截（CORS 跨域），请在 R2 控制台为存储桶添加 CORS 策略（状态码=0 表示浏览器阻止了请求）'
            : '网络错误，HTTP ' + xhr.status + '：可能是对象存储 CORS 未配置，或 endpoint 不可达'));
        };
        xhr.ontimeout = () => { activeXhr = null; reject(new Error('上传超时')); };
        xhr.onabort = () => { activeXhr = null; reject(new Error('上传已取消')); };
        xhr.send(file);
      });
    }

    function cancelUpload() {
      if (activeXhr) {
        activeXhr.abort();
        activeXhr = null;
      }
    }

    async function sendFile(file) {
      if (!state.current) {
        alert('请先选择一个会话');
        return;
      }

      if (!wsModule.isOpen()) {
        alert('连接未就绪，请稍后重试');
        return;
      }

      var maxSize = (window.__CHAT_CONFIG__ && window.__CHAT_CONFIG__.maxFileSize) || 104857600;
      if (file.size > maxSize) {
        var limitMB = (maxSize / 1048576).toFixed(0);
        var fileMB = (file.size / 1048576).toFixed(2);
        alert('文件大小 ' + fileMB + 'MB 超出限制 ' + limitMB + 'MB');
        return;
      }

      if (typeof onUploadStart === 'function') onUploadStart();

      try {
        const presigned = await getPresignedUrl(file.name, file.type, file.size);
        await uploadToStorage(presigned.uploadUrl, file, file.type, presigned.headers);

        const msgType = isImageType(file.type) ? 'image' : 'file';
        wsModule.sendFileMessage(state.current, msgType, {
          name: file.name,
          size: file.size,
          url: presigned.publicUrl,
          fileKey: presigned.fileKey
        });

        if (typeof onUploadComplete === 'function') onUploadComplete();
      } catch (err) {
        var msg = err.message || '上传失败';
        if (msg !== '上传已取消' && typeof onUploadError === 'function') onUploadError(msg);
      }
    }

    async function sendPastedImage(file) {
      if (!state.current) {
        alert('请先选择一个会话');
        return;
      }

      if (!wsModule.isOpen()) return;

      var maxSize = (window.__CHAT_CONFIG__ && window.__CHAT_CONFIG__.maxFileSize) || 104857600;
      if (file.size > maxSize) {
        var limitMB = (maxSize / 1048576).toFixed(0);
        var fileMB = (file.size / 1048576).toFixed(2);
        alert('图片大小 ' + fileMB + 'MB 超出限制 ' + limitMB + 'MB');
        return;
      }

      try {
        const presigned = await getPresignedUrl(file.name || 'paste.png', file.type, file.size);
        await uploadToStorage(presigned.uploadUrl, file, file.type, presigned.headers);
        wsModule.sendFileMessage(state.current, 'image', {
          name: file.name || 'paste.png',
          size: file.size,
          url: presigned.publicUrl,
          fileKey: presigned.fileKey
        });
      } catch (err) {
        console.error('[粘贴图片上传失败]', err);
      }
    }

    return {
      sendFile,
      sendPastedImage,
      cancelUpload,
      isImageType
    };
  }

  global.ChatFileUploadModule = { createFileUploadModule };
})(window);
