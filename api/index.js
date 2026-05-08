const express = require('express');
const multer = require('multer');
const app = express();

// Health check - no heavy deps needed
app.get('/api/health', (req, res) => res.json({ ok: true, env: !!process.env.SUPABASE_URL }));



const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpezaqvtufrvvczyixwc.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZXphcXZ0dWZydnZjenlpeHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDk5MTksImV4cCI6MjA5MzcyNTkxOX0.WzUQH4ZGn33Omv02m0ZtQgdYCXihGnHsOuhJmwGPXXI';
const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/uploads`;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

async function uploadToSupabase(file, prefix = '') {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = prefix ? `${prefix}-${Date.now()}-${safeName}` : `${Date.now()}-${safeName}`;
  const url = `${SUPABASE_URL}/storage/v1/object/uploads/${filename}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': file.mimetype
    },
    body: file.buffer
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Storage upload failed: ' + err);
  }
  return `${STORAGE_URL}/${filename}`;
}

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../database');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'social-app-secret-key-change-in-prod';
const ADMIN_PASSWORD = 'admin1234';

app.use(express.json());

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.admin) throw new Error();
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    logger.warn('Failed admin login attempt');
    return res.status(401).json({ error: 'Wrong password' });
  }
  logger.info('Admin logged in');
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '4h' });
  res.json({ token });
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    const { data: existing } = await supabase.from('users').select('id').or(`username.eq.${username},email.eq.${email}`).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Username or email already taken' });
    const hashed = bcrypt.hashSync(password, 10);
    const { data: user, error } = await supabase.from('users').insert({ username, email, password: hashed }).select('id, username').single();
    if (error) throw error;
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id, username: user.username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id, username: user.username, hasProfile: !!user.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Supabase OAuth callback ──
app.post('/api/auth/supabase-callback', async (req, res) => {
  try {
    const { access_token, email, name, avatar } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // Check if user exists
    const { data: existing } = await supabase.from('users').select('id, username, name, photo').eq('email', email).maybeSingle();

    if (existing) {
      // Update profile info if needed
      const updates = {};
      if (name && !existing.name) updates.name = name;
      if (avatar && !existing.photo) updates.photo = avatar;
      if (Object.keys(updates).length) {
        await supabase.from('users').update(updates).eq('id', existing.id);
      }
      const token = jwt.sign({ id: existing.id, username: existing.username }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, userId: existing.id, username: existing.username, hasProfile: !!existing.name });
    }

    // Create new user
    const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
    const { data: user, error } = await supabase.from('users').insert({
      username, email, password: 'oauth_' + Date.now(),
      name: name || null, photo: avatar || null
    }).select('id, username').single();

    if (error) throw error;
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id, username: user.username, hasProfile: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  const { data: user } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (!user) return res.status(404).json({ error: 'No account found with that email' });
  const resetToken = jwt.sign({ resetId: user.id }, JWT_SECRET, { expiresIn: '15m' });
  res.json({ resetToken });
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const payload = jwt.verify(resetToken, JWT_SECRET);
    if (!payload.resetId) throw new Error();
    const hashed = bcrypt.hashSync(newPassword, 10);
    await supabase.from('users').update({ password: hashed }).eq('id', payload.resetId);
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'Reset link expired or invalid' }); }
});

app.put('/api/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'All fields required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const { data: user } = await supabase.from('users').select('password').eq('id', req.user.id).single();
    if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = bcrypt.hashSync(newPassword, 10);
    await supabase.from('users').update({ password: hashed }).eq('id', req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Profile ─────────────────────────────────────────────────────────────────────

app.get('/api/profile/me', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profile', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { name, age, gender, bio } = req.body;
    let photo;

    if (req.file) {
      photo = await uploadToSupabase(req.file, 'avatar');
    } else {
      const { data: user } = await supabase.from('users').select('photo').eq('id', req.user.id).single();
      photo = user.photo;
    }

    const updates = { name, age: parseInt(age), gender, bio, photo };
    await supabase.from('users').update(updates).eq('id', req.user.id);
    res.json({ success: true, photo });
  } catch (err) {
    logger.error('Profile update error', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/members', authMiddleware, async (req, res) => {
  try {
    const { data: users } = await supabase.from('users').select('*').not('name', 'is', null).order('id');
    res.json((users || []).map(({ password, email, ...safe }) => ({ ...safe, online: false })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Messages ───────────────────────────────────────────────────────────────────

app.get('/api/messages/:otherId', authMiddleware, async (req, res) => {
  try {
    const otherId = parseInt(req.params.otherId);
    const myId = req.user.id;
    const { data: messages } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    const { data: allUsers } = await supabase.from('users').select('id, username');
    const usersMap = {}; (allUsers || []).forEach(u => { usersMap[u.id] = u.username; });
    res.json((messages || []).map(m => ({ ...m, sender_name: usersMap[m.sender_id] })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const { data: myMessages } = await supabase.from('messages').select('sender_id, receiver_id')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`);
    const partnerIds = [...new Set((myMessages || []).map(m => m.sender_id === myId ? m.receiver_id : m.sender_id))];
    if (!partnerIds.length) return res.json([]);
    const { data: partners } = await supabase.from('users').select('id, username, name, photo, lastSeen').in('id', partnerIds);
    const conversations = [];
    for (const partner of partners || []) {
      const { data: lastMsg } = await supabase.from('messages').select('content')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      conversations.push({ id: partner.id, username: partner.username, name: partner.name, photo: partner.photo, last_message: lastMsg?.content, online: false, lastSeen: partner.lastSeen });
    }
    res.json(conversations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Message CRUD (replaces Socket.io) ──────────────────────────────────────────

app.post('/api/messages/send', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, type, fileName } = req.body;
    if (!receiverId || (!content?.trim() && type !== 'image' && type !== 'file'))
      return res.status(400).json({ error: 'Invalid message' });

    const { data: message, error } = await supabase.from('messages').insert({
      sender_id: req.user.id,
      receiver_id: parseInt(receiverId),
      content: content?.trim() || '',
      type: type || 'text',
      fileName: fileName || null
    }).select('*').single();

    if (error) throw error;
    const { data: user } = await supabase.from('users').select('username').eq('id', req.user.id).single();
    const full = { ...message, sender_name: user?.username };
    res.json(full);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/messages/:id', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    const { data: msg } = await supabase.from('messages').select('receiver_id').eq('id', req.params.id).eq('sender_id', req.user.id).single();
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    await supabase.from('messages').update({ content: content.trim(), edited: true }).eq('id', req.params.id);
    res.json({ success: true, messageId: parseInt(req.params.id), content: content.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/messages/:id', authMiddleware, async (req, res) => {
  try {
    const { data: msg } = await supabase.from('messages').select('receiver_id').eq('id', req.params.id).eq('sender_id', req.user.id).single();
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    await supabase.from('messages').delete().eq('id', req.params.id);
    res.json({ success: true, messageId: parseInt(req.params.id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin ───────────────────────────────────────────────────────────────────────

app.get('/api/admin/users', adminAuth, async (req, res) => {
  const { data: users } = await supabase.from('users').select('*').order('id');
  res.json((users || []).map(({ password, ...u }) => u));
});

app.get('/api/admin/messages', adminAuth, async (req, res) => {
  const { data: messages } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
  const { data: allUsers } = await supabase.from('users').select('id, username');
  const usersMap = {}; (allUsers || []).forEach(u => { usersMap[u.id] = u.username; });
  res.json((messages || []).map(m => ({ ...m, sender_name: usersMap[m.sender_id] || m.sender_id, receiver_name: usersMap[m.receiver_id] || m.receiver_id })));
});

app.get('/api/admin/stats', adminAuth, async (req, res) => {
  const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });
  const { data: users } = await supabase.from('users').select('name, photo');
  res.json({ totalUsers: totalUsers || 0, totalMessages: totalMessages || 0, usersWithProfile: (users || []).filter(u => u.name).length, usersWithPhoto: (users || []).filter(u => u.photo).length });
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  await supabase.from('messages').delete().or(`sender_id.eq.${id},receiver_id.eq.${id}`);
  await supabase.from('users').delete().eq('id', id);
  res.json({ success: true });
});

app.delete('/api/admin/messages/:id', adminAuth, async (req, res) => {
  await supabase.from('messages').delete().eq('id', parseInt(req.params.id));
  res.json({ success: true });
});

// ── Logs ────────────────────────────────────────────────────────────────────────

app.get('/api/logs', adminAuth, (req, res) => {
  const fs = require('fs');
  try {
    const logFile = logger.LOG_FILE;
    if (!fs.existsSync(logFile)) return res.json({ lines: [] });
    const raw = fs.readFileSync(logFile, 'utf-8');
    res.json({ lines: raw.trim().split('\n').filter(Boolean) });
  } catch (err) { res.status(500).json({ error: 'Could not read logs' }); }
});

app.delete('/api/logs', adminAuth, (req, res) => {
  const fs = require('fs');
  try {
    if (fs.existsSync(logger.LOG_FILE)) fs.unlinkSync(logger.LOG_FILE);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Could not clear logs' }); }
});

// ── Chat file upload ────────────────────────────────────────────────────────────
const uploadChat = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/chat/upload', authMiddleware, uploadChat.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = await uploadToSupabase(req.file, 'chat');
    const isImage = req.file.mimetype.startsWith('image/');
    res.json({ url, type: isImage ? 'image' : 'file', fileName: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Error handler ───────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
