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
    if (msg.sender_id === myId) return;

    const senderName = msg.sender_name || 'Someone';
    let body = msg.content;
    if (msg.type === 'image') body = '📷 Sent a photo';
    else if (msg.type === 'file') body = `📄 ${msg.fileName || 'Sent a file'}`;

    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(`💬 ${senderName}`, {
        body,
        tag: `msg-${msg.sender_id}`,
        renotify: true
      });
      n.onclick = () => {
        window.focus();
        window.location.href = `chat.html?with=${msg.sender_id}&name=${encodeURIComponent(senderName)}`;
        n.close();
      };
    }

    flashTitle(`💬 ${senderName}: ${body}`);
  };

  // ── Flash browser tab title ───────────────────────────────────
  let flashInterval = null;
  const originalTitle = document.title;

  function flashTitle(msg) {
    if (flashInterval) return;
    let show = true;
    flashInterval = setInterval(() => {
      document.title = show ? msg : originalTitle;
      show = !show;
    }, 1200);
    window.addEventListener('focus', stopFlash, { once: true });
  }

  function stopFlash() {
    if (flashInterval) { clearInterval(flashInterval); flashInterval = null; }
    document.title = originalTitle;
  }

  window.stopTitleFlash = stopFlash;

  // ── Supabase Realtime for new message notifications ──────────
  if (!IS_CHAT) {
    const supabaseUrl = 'https://hpezaqvtufrvvczyixwc.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZXphcXZ0dWZydnZjenlpeHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDk5MTksImV4cCI6MjA5MzcyNTkxOX0.WzUQH4ZGn33Omv02m0ZtQgdYCXihGnHsOuhJmwGPXXI';

    if (typeof supabase === 'undefined') return;
    const _supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

    _supabase.channel('global-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new;
        const myId = parseInt(localStorage.getItem('userId'));
        if (msg.receiver_id !== myId) return;
        // Fetch sender name then notify
        fetch('/api/members', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(members => {
            const sender = members.find(m => m.id === msg.sender_id);
            if (typeof window.showMessageNotification === 'function') {
              window.showMessageNotification({
                ...msg,
                sender_name: sender?.name || sender?.username || 'Someone'
              });
            }
          });
      })
      .subscribe();
  }
})();
