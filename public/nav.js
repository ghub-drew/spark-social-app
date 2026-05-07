(async function () {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  if (!token) return;

  const nameEl = document.getElementById('navName');
  const initialEl = document.getElementById('navInitial');
  if (!nameEl || !initialEl) return;

  // Show username immediately from localStorage
  nameEl.textContent = username || '…';
  initialEl.textContent = (username || '?')[0].toUpperCase();

  // Then fetch full profile for display name + photo
  try {
    const res = await fetch('/api/profile/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const user = await res.json();

    const display = user.name || user.username;
    nameEl.textContent = display;
    initialEl.textContent = display[0].toUpperCase();

    if (user.photo) {
      const img = document.createElement('img');
      img.className = 'nav-user-avatar';
      img.src = user.photo;
      img.alt = display;
      img.onerror = () => img.replaceWith(initialEl);
      initialEl.replaceWith(img);
    }
  } catch (_) {}
})();
