(async function () {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  if (!token) return;

  // Desktop navbar elements
  const nameEl = document.getElementById('navName');
  const initialEl = document.getElementById('navInitial');

  // Hamburger drawer elements
  const drawerName = document.getElementById('drawerName');
  const drawerAvatar = document.getElementById('drawerAvatar');
  const drawerStatus = document.getElementById('drawerStatus');
  const hamburgerAvatar = document.getElementById('hamburgerAvatar');

  // ── Presence state ────────────────────────────────────────────────
  let isOnline = true;        // user is on the page = online
  let lastHeartbeatOk = true; // last heartbeat succeeded

  const setInitial = (display) => {
    const char = (display || '?')[0].toUpperCase();
    if (nameEl) nameEl.textContent = display || '…';
    if (initialEl) initialEl.textContent = char;
    if (drawerName) drawerName.textContent = display || '…';
    if (drawerAvatar) drawerAvatar.textContent = char;
    if (hamburgerAvatar) hamburgerAvatar.textContent = char;
  };

  // Show immediately from localStorage
  setInitial(username);

  // Show "Online now" — user is on the page
  updateDrawerStatus('online');

  // ── Fetch full profile ─────────────────────────────────────────
  try {
    const res = await fetch('/api/profile/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const user = await res.json();

    const display = user.name || user.username;
    setInitial(display);

    // Set photo if available
    if (user.photo) {
      [drawerAvatar, hamburgerAvatar, initialEl].forEach(el => {
        if (!el) return;
        const img = document.createElement('img');
        img.className = el === drawerAvatar ? 'drawer-avatar-img' : 'nav-user-avatar';
        img.src = user.photo;
        img.alt = display;
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
        img.onerror = () => img.replaceWith(document.createTextNode(display[0]));
        // Clear and append
        el.textContent = '';
        el.appendChild(img);
      });
    }
  } catch (_) {
    // Fine — we already showed localStorage data
  }

  // ── Drawer status helpers ──────────────────────────────────────
  function updateDrawerStatus(state, lastSeenIso) {
    if (!drawerStatus) return;
    // Remove any existing dot
    const existingDot = drawerStatus.querySelector('.drawer-status-dot');
    if (existingDot) existingDot.remove();

    const dot = document.createElement('span');
    dot.className = 'drawer-status-dot';

    if (state === 'online') {
      dot.classList.add('online');
      drawerStatus.textContent = '';
      drawerStatus.appendChild(dot);
      drawerStatus.appendChild(document.createTextNode(' Online now'));
      drawerStatus.className = 'drawer-status online';
    } else if (state === 'recently-active') {
      dot.classList.add('offline');
      const ago = timeAgo(lastSeenIso);
      drawerStatus.textContent = '';
      drawerStatus.appendChild(dot);
      drawerStatus.appendChild(document.createTextNode(' Active ' + ago));
      drawerStatus.className = 'drawer-status offline';
    } else {
      dot.classList.add('offline');
      drawerStatus.textContent = '';
      drawerStatus.appendChild(dot);
      drawerStatus.appendChild(document.createTextNode(' Offline'));
      drawerStatus.className = 'drawer-status offline';
    }
  }

  // ── Heartbeat: keep lastSeen fresh ─────────────────────────────
  let heartbeatTimer = null;
  let fastMode = true; // 30s when visible, 3min when hidden

  async function sendHeartbeat() {
    try {
      const res = await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      lastHeartbeatOk = res.ok;
      if (isOnline) {
        updateDrawerStatus('online');
      }
    } catch (_) {
      lastHeartbeatOk = false;
    }
  }

  function scheduleHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    const interval = fastMode ? 30_000 : 180_000; // 30s or 3min
    heartbeatTimer = setInterval(sendHeartbeat, interval);
  }

  // Fire immediately, then schedule
  sendHeartbeat();
  scheduleHeartbeat();

  // ── Visibility: fast heartbeat when visible, slow when hidden ──
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      fastMode = false;
      scheduleHeartbeat();
    } else {
      fastMode = true;
      scheduleHeartbeat();
      sendHeartbeat(); // immediate refresh on return
    }
  });

  // ── Before unload: notify server we're going offline ───────────
  window.addEventListener('beforeunload', () => {
    // fetch with keepalive supports custom headers (unlike sendBeacon)
    fetch('/api/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: '{}',
      keepalive: true
    }).catch(() => {});
  });

  // ── Expose for global.js cross-updates ─────────────────────────
  window.updateDrawerPresence = function (online) {
    if (online) {
      isOnline = true;
      updateDrawerStatus('online');
    } else {
      isOnline = false;
      updateDrawerStatus('offline');
    }
  };

  // ── timeAgo helper ─────────────────────────────────────────────
  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return new Date(iso).toLocaleDateString();
  }
})();
