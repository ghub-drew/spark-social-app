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

  // Show offline status
  if (drawerStatus) drawerStatus.textContent = 'Offline';

  // Fetch full profile
  try {
    const res = await fetch('/api/profile/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const user = await res.json();

    const display = user.name || user.username;
    setInitial(display);

    // Update status
    if (drawerStatus) {
      drawerStatus.textContent = user.lastSeen
        ? 'Offline · ' + timeAgo(user.lastSeen)
        : 'Offline';
    }

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
  } catch (_) {}

  function timeAgo(iso) {
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
