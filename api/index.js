const express = require('express');
const app = express();

// Minimal health check that doesn't require any imports
app.get('/api/health', (req, res) => res.json({ ok: true, env: !!process.env.SUPABASE_URL }));

// Only load heavy deps if we need them
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../database');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'social-app-secret-key-change-in-prod';

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

const ADMIN_PASSWORD = 'admin1234';

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

// Admin login
app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    logger.warn('Failed admin login attempt');
    return res.status(401).json({ error: 'Wrong password' });
  }
  logger.info('Admin logged in');
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '4h' });
  res.json({ token });
});

// Admin users
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { data: users } = await supabase.from('users').select('*').order('id');
    const safe = (users || []).map(({ password, ...u }) => u);
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    const { data: existing } = await supabase
      .from('users').select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();
    if (existing) return res.status(400).json({ error: 'Username or email already taken' });
    const hashed = bcrypt.hashSync(password, 10);
    const { data: user, error } = await supabase
      .from('users').insert({ username, email, password: hashed })
      .select('id, username').single();
    if (error) throw error;
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user } = await supabase
      .from('users').select('*').eq('email', email).maybeSingle();
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id, username: user.username, hasProfile: !!user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile
app.get('/api/profile/me', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Members
app.get('/api/members', authMiddleware, async (req, res) => {
  try {
    const { data: users } = await supabase
      .from('users').select('*').not('name', 'is', null).order('id');
    const members = (users || []).map(({ password, email, ...safe }) => ({
      ...safe, online: false
    }));
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });
    const { data: users } = await supabase.from('users').select('name, photo');
    res.json({
      totalUsers: totalUsers || 0,
      totalMessages: totalMessages || 0,
      usersWithProfile: (users || []).filter(u => u.name).length,
      usersWithPhoto: (users || []).filter(u => u.photo).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Messages
app.get('/api/messages/:otherId', authMiddleware, async (req, res) => {
  try {
    const otherId = parseInt(req.params.otherId);
    const myId = req.user.id;
    const { data: messages } = await supabase
      .from('messages').select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    const { data: allUsers } = await supabase.from('users').select('id, username');
    const usersMap = {};
    (allUsers || []).forEach(u => { usersMap[u.id] = u.username; });
    res.json((messages || []).map(m => ({ ...m, sender_name: usersMap[m.sender_id] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Conversations
app.get('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const { data: myMessages } = await supabase
      .from('messages').select('sender_id, receiver_id')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`);
    const partnerIds = [...new Set((myMessages || []).map(m => m.sender_id === myId ? m.receiver_id : m.sender_id))];
    if (!partnerIds.length) return res.json([]);
    const { data: partners } = await supabase
      .from('users').select('id, username, name, photo, lastSeen')
      .in('id', partnerIds);
    const conversations = [];
    for (const partner of partners || []) {
      const { data: lastMsg } = await supabase
        .from('messages').select('content')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      conversations.push({
        id: partner.id, username: partner.username, name: partner.name,
        photo: partner.photo, last_message: lastMsg?.content,
        online: false, lastSeen: partner.lastSeen
      });
    }
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin messages
app.get('/api/admin/messages', adminAuth, async (req, res) => {
  try {
    const { data: messages } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    const { data: allUsers } = await supabase.from('users').select('id, username');
    const usersMap = {};
    (allUsers || []).forEach(u => { usersMap[u.id] = u.username; });
    res.json((messages || []).map(m => ({
      ...m, sender_name: usersMap[m.sender_id] || m.sender_id,
      receiver_name: usersMap[m.receiver_id] || m.receiver_id
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await supabase.from('messages').delete().or(`sender_id.eq.${id},receiver_id.eq.${id}`);
    await supabase.from('users').delete().eq('id', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete message
app.delete('/api/admin/messages/:id', adminAuth, async (req, res) => {
  try {
    await supabase.from('messages').delete().eq('id', parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forgot password
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  const { data: user } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (!user) return res.status(404).json({ error: 'No account found with that email' });
  const resetToken = jwt.sign({ resetId: user.id }, JWT_SECRET, { expiresIn: '15m' });
  res.json({ resetToken });
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const payload = jwt.verify(resetToken, JWT_SECRET);
    if (!payload.resetId) throw new Error();
    const hashed = bcrypt.hashSync(newPassword, 10);
    await supabase.from('users').update({ password: hashed }).eq('id', payload.resetId);
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Reset link expired or invalid' });
  }
});

// Change password
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs
app.get('/api/logs', adminAuth, (req, res) => {
  const fs = require('fs');
  try {
    const logFile = logger.LOG_FILE;
    if (!fs.existsSync(logFile)) return res.json({ lines: [] });
    const raw = fs.readFileSync(logFile, 'utf-8');
    res.json({ lines: raw.trim().split('\n').filter(Boolean) });
  } catch (err) {
    res.status(500).json({ error: 'Could not read logs' });
  }
});

app.delete('/api/logs', adminAuth, (req, res) => {
  const fs = require('fs');
  try {
    if (fs.existsSync(logger.LOG_FILE)) fs.unlinkSync(logger.LOG_FILE);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not clear logs' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
