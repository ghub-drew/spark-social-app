(function () {
  const token = localStorage.getItem('token');
  if (!token) return;

  const IS_CHAT = window.location.pathname.includes('chat.html');

  // ── Browser notification permission ──────────────────────────
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // ── Show a desktop notification ───────────────────────────────
  window.showMessageNotification = function (msg) {
    const myId = parseInt(localStorage.getItem('userId'));
    if (msg.sender_id === myId) return; // ignore own messages

    const senderName = msg.sender_name || 'Someone';
    let body = msg.content;
    if (msg.type === 'image') body = '📷 Sent a photo';
    else if (msg.type === 'file') body = `📄 ${msg.fileName || 'Sent a file'}`;

    // Desktop notification (works even in background tabs)
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(`💬 ${senderName}`, {
        body,
        icon: '/icon-192.png',
        tag: `msg-${msg.sender_id}`,   // group by sender so they don't stack infinitely
        renotify: true
      });
      n.onclick = () => {
        window.focus();
        window.location.href = `chat.html?with=${msg.sender_id}&name=${encodeURIComponent(senderName)}`;
        n.close();
      };
    }

    // Also flash the page title
    flashTitle(`💬 ${senderName}: ${body}`);
  };

  // ── Flash browser tab title ───────────────────────────────────
  let flashInterval = null;
  const originalTitle = document.title;

  function flashTitle(msg) {
    if (flashInterval) return; // already flashing
    let show = true;
    flashInterval = setInterval(() => {
      document.title = show ? msg : originalTitle;
      show = !show;
    }, 1200);

    // Stop flashing when the window gets focus
    window.addEventListener('focus', stopFlash, { once: true });
  }

  function stopFlash() {
    if (flashInterval) { clearInterval(flashInterval); flashInterval = null; }
    document.title = originalTitle;
  }

  window.stopTitleFlash = stopFlash;

  // ── Persistent socket (non-chat pages only) ───────────────────
  // On chat.html the page manages its own socket; we just provide helpers.
  // On browse/profile we create one to keep the user "online".
  if (!IS_CHAT) {
    if (typeof io === 'undefined') return;

    const globalSocket = io({ auth: { token } });

    // Once connected, re-fetch browse cards so our own status shows correctly
    globalSocket.on('connect', () => {
      if (typeof window.loadMembers === 'function') window.loadMembers();
    });

    globalSocket.on('new_message', (msg) => {
      const myId = parseInt(localStorage.getItem('userId'));
      if (msg.sender_id === myId) return;
      window.showMessageNotification(msg);
    });

    // Update browse page status dots live when someone goes online/offline
    globalSocket.on('user_status', ({ userId, online, lastSeen }) => {
      // Update status dot
      const wrap = document.querySelector(`.member-photo-wrap[data-uid="${userId}"]`);
      if (wrap) {
        const dot = wrap.querySelector('.status-dot');
        if (dot) dot.className = `status-dot ${online ? 'online' : 'offline'}`;
      }
      // Update status text
      const statusEl = document.querySelector(`.member-status[data-uid="${userId}"]`);
      if (statusEl) {
        if (online) {
          statusEl.textContent = 'Online';
          statusEl.className = 'member-status is-online';
        } else {
          statusEl.textContent = lastSeen ? 'Offline · ' + _timeAgo(lastSeen) : 'Offline';
          statusEl.className = 'member-status is-offline';
        }
      }
    });
  }

  function _timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }
})();
