/**
 * generate_docs.js
 * Run:    node generate_docs.js
 * Output: Spark_Documentation.pdf
 *
 * Re-run any time you add features.
 */

const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');

// ── Palette ───────────────────────────────────────────────────────────────────
const BRAND    = '#16a34a';
const BRAND_MID= '#22c55e';
const BRAND_LT = '#f0fdf4';
const DARK     = '#1e293b';
const MID      = '#64748b';
const LIGHT    = '#f8fafc';
const BORDER   = '#e2e8f0';
const CODE_BG  = '#f1f5f9';
const WHITE    = '#ffffff';

// ── Geometry ──────────────────────────────────────────────────────────────────
const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BODY_BTM  = PAGE_H - MARGIN - 32;  // content bottom edge (leaves room for footer)

// ── Document ──────────────────────────────────────────────────────────────────
// bufferPages: true   -  let PDFKit accumulate all pages, then we add footers at the end
const doc = new PDFDocument({
  size: 'A4',
  margin: MARGIN,
  autoFirstPage: false,
  bufferPages: true,
});

const outPath = path.join(__dirname, 'Spark_Documentation.pdf');
const ws = fs.createWriteStream(outPath);
doc.pipe(ws);
ws.on('finish', () => console.log(`\nDone!  Saved to:\n  ${outPath}\n`));

// ── 4-pointed star ────────────────────────────────────────────────────────────
function drawStar(cx, cy, outer, inner, color) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI / 4) - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  doc.save().fillColor(color).moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
  doc.closePath().fill().restore();
}

// ── Ensure space for block elements (tables, code blocks, headers) ─────────────
function ensureSpace(h) {
  if (doc.y + h > BODY_BTM) doc.addPage();
}

// ── Section header ────────────────────────────────────────────────────────────
function sectionHeader(title) {
  const needed = 22 + 32;
  if (doc.y + needed > BODY_BTM) {
    doc.addPage();
  } else {
    // Only add gap if we are not right at the top of the page
    if (doc.y > MARGIN + 20) doc.moveDown(1.2);
  }
  const y = doc.y;
  doc.save()
    .rect(MARGIN, y, CONTENT_W, 22).fill(BRAND)
    .fontSize(10).fillColor(WHITE).font('Helvetica-Bold')
    .text(title, MARGIN + 8, y + 5, { width: CONTENT_W - 16, lineBreak: false })
    .restore();
  doc.y = y + 28;
}

// ── Sub-header ────────────────────────────────────────────────────────────────
function subHeader(title) {
  ensureSpace(40);
  if (doc.y > MARGIN + 10) doc.moveDown(0.7);
  doc.fontSize(9.5).fillColor(BRAND).font('Helvetica-Bold').text(title, { lineBreak: false });
  doc.moveDown(0.2);
}

// ── Body paragraph ────────────────────────────────────────────────────────────
function body(text, opts = {}) {
  doc.fontSize(8.5).fillColor(DARK).font('Helvetica').text(text, { lineGap: 1.5, ...opts });
}

// ── Bullet list ───────────────────────────────────────────────────────────────
function bullet(items) {
  items.forEach(item => {
    doc.fontSize(8.5).fillColor(DARK).font('Helvetica')
       .text(`•  ${item}`, { indent: 12, lineGap: 1.5, paragraphGap: 2 });
  });
  doc.moveDown(0.3);
}

// ── Code block ───────────────────────────────────────────────────────────────
function codeBlock(lines) {
  const LINE_H = 14;
  const PAD    = 8;
  const H      = lines.length * LINE_H + PAD * 2;
  ensureSpace(H + 10);
  const y = doc.y;
  doc.save().rect(MARGIN, y, CONTENT_W, H).fill(CODE_BG).restore();
  doc.save().rect(MARGIN, y, 3, H).fill(BRAND_MID).restore();
  lines.forEach((line, i) => {
    doc.save().fontSize(8).fillColor('#0f172a').font('Courier')
       .text(line, MARGIN + 10, y + PAD + i * LINE_H,
             { width: CONTENT_W - 14, lineBreak: false })
       .restore();
  });
  doc.y = y + H + 8;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function table(cols, rows) {
  const HDR_H = 20;
  const ROW_H = 18;

  function hdr(y) {
    doc.save().rect(MARGIN, y, CONTENT_W, HDR_H).fill('#fde8ee').restore();
    doc.save().rect(MARGIN, y, CONTENT_W, HDR_H).strokeColor(BORDER).lineWidth(0.5).stroke().restore();
    let x = MARGIN;
    cols.forEach(c => {
      doc.save().fontSize(8).fillColor(BRAND).font('Helvetica-Bold')
         .text(c.label, x + 4, y + 5, { width: c.w - 8, lineBreak: false, ellipsis: true, align: c.align || 'left' })
         .restore();
      x += c.w;
    });
  }

  function row(cells, y, even) {
    if (even) doc.save().rect(MARGIN, y, CONTENT_W, ROW_H).fill(LIGHT).restore();
    doc.save().rect(MARGIN, y, CONTENT_W, ROW_H).strokeColor(BORDER).lineWidth(0.4).stroke().restore();
    let x = MARGIN;
    cells.forEach((cell, i) => {
      const c = cols[i] || { w: 80 };
      doc.save().fontSize(7.5).fillColor(DARK).font('Helvetica')
         .text(String(cell == null ? '' : cell), x + 4, y + 4,
               { width: c.w - 8, lineBreak: false, ellipsis: true, align: c.align || 'left' })
         .restore();
      x += c.w;
    });
  }

  ensureSpace(HDR_H + ROW_H * 2);
  hdr(doc.y);
  doc.y += HDR_H;

  rows.forEach((cells, idx) => {
    if (doc.y + ROW_H > BODY_BTM) {
      doc.addPage();
      hdr(doc.y);
      doc.y += HDR_H;
    }
    row(cells, doc.y, idx % 2 === 0);
    doc.y += ROW_H;
  });
  doc.moveDown(0.7);
}

// ─────────────────────────────────────────────────────────────────────────────
//  COVER PAGE  (page index 0  -  no footer)
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();

// Rose hero band
doc.save().rect(0, 0, PAGE_W, PAGE_H * 0.50).fill(BRAND).restore();

// Subtle dot grid on band (using light solid color  -  no opacity API to avoid crashes)
const DOT_COLOR = '#f43f6a';
for (let gx = 55; gx < PAGE_W - 20; gx += 58) {
  for (let gy = 22; gy < PAGE_H * 0.47; gy += 48) {
    doc.save().circle(gx, gy, 1.3).fill(DOT_COLOR).restore();
  }
}

// ── Logo ──────────────────────────────────────────────────────────────────────
const CX = PAGE_W / 2;
const CY = 110;

// Outer ring (slightly lighter pink)
doc.save().circle(CX, CY, 40).fill('#f43f6a').restore();
// White circle
doc.save().circle(CX, CY, 30).fill(WHITE).restore();
// 4-pointed rose star
drawStar(CX, CY, 22, 8, BRAND);
// Small white dots at diagonals
[45, 135, 225, 315].forEach(deg => {
  const rad = deg * Math.PI / 180;
  doc.save().circle(CX + 36 * Math.cos(rad), CY + 36 * Math.sin(rad), 2.5).fill(WHITE).restore();
});

// ── Title ─────────────────────────────────────────────────────────────────────
doc.fontSize(42).fillColor(WHITE).font('Helvetica-Bold')
   .text('Spark', 0, CY + 46, { align: 'center', width: PAGE_W, lineBreak: false });

doc.fontSize(11).fillColor('#fecdd3').font('Helvetica')
   .text('Social App', 0, CY + 93, { align: 'center', width: PAGE_W, lineBreak: false });

// Divider line
doc.save()
   .moveTo(PAGE_W / 2 - 42, CY + 113).lineTo(PAGE_W / 2 + 42, CY + 113)
   .strokeColor('#fda4af').lineWidth(0.8).stroke().restore();

doc.fontSize(9).fillColor(WHITE).font('Helvetica')
   .text('Technical Documentation', 0, CY + 120, { align: 'center', width: PAGE_W, lineBreak: false });

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
doc.fontSize(7.5).fillColor('#fda4af')
   .text(`Generated: ${today}`, 0, CY + 138, { align: 'center', width: PAGE_W, lineBreak: false });

// ── Stat chips ────────────────────────────────────────────────────────────────
const CHIPS = [['10','Features'],['19','API Routes'],['6','Socket Events'],['11','Pages']];
const CW = 98, CH = 54, CGAP = 10;
const totalChipW = CHIPS.length * CW + (CHIPS.length - 1) * CGAP;
let cx0 = (PAGE_W - totalChipW) / 2;
const CY2 = 296;

CHIPS.forEach(([num, lbl]) => {
  doc.save().roundedRect(cx0, CY2, CW, CH, 7).fill(BRAND_LT).restore();
  doc.save().roundedRect(cx0, CY2, CW, 4, 2).fill(BRAND).restore();
  doc.fontSize(21).fillColor(BRAND).font('Helvetica-Bold')
     .text(num, cx0, CY2 + 10, { width: CW, align: 'center', lineBreak: false });
  doc.fontSize(7.5).fillColor(MID).font('Helvetica')
     .text(lbl, cx0, CY2 + 36, { width: CW, align: 'center', lineBreak: false });
  cx0 += CW + CGAP;
});

// ── Blurb ─────────────────────────────────────────────────────────────────────
doc.fontSize(8.5).fillColor(DARK).font('Helvetica')
   .text(
     'This document covers the complete Spark social app  -  built with Node.js,\n' +
     'Supabase Realtime, and a plain-HTML frontend.  Re-run  node generate_docs.js  to update.',
     MARGIN + 40, CY2 + 68,
     { width: CONTENT_W - 80, align: 'center', lineGap: 2 }
   );

// ── Table of Contents ─────────────────────────────────────────────────────────
const TOC_Y = CY2 + 110;
doc.save().rect(MARGIN, TOC_Y, CONTENT_W, 21).fill(BRAND).restore();
doc.fontSize(9).fillColor(WHITE).font('Helvetica-Bold')
   .text('Contents', MARGIN + 8, TOC_Y + 5, { lineBreak: false });

const TOC_ITEMS = [
  ['1','Tech Stack'],['2','How to Run'],['3','Features'],
  ['4','API Endpoints'],['5','Socket.io Events'],
  ['6','File Structure'],['7','Credentials & Config'],['8','Data Models'],
  ['9','Reasonix Setup'],['10','Supabase Local Setup'],
];
const TROW = 19;
TOC_ITEMS.forEach(([n, title], i) => {
  const ty = TOC_Y + 21 + i * TROW;
  doc.save().rect(MARGIN, ty, CONTENT_W, TROW).fill(i % 2 === 0 ? LIGHT : WHITE).restore();
  doc.save().rect(MARGIN, ty, CONTENT_W, TROW).strokeColor(BORDER).lineWidth(0.3).stroke().restore();
  doc.fontSize(8).fillColor(BRAND).font('Helvetica-Bold')
     .text(`${n}.`, MARGIN + 6, ty + 4, { width: 22, lineBreak: false });
  doc.fontSize(8).fillColor(DARK).font('Helvetica')
     .text(title, MARGIN + 28, ty + 4, { width: CONTENT_W - 36, lineBreak: false });
});

// Cover disclaimer  -  draw below default margin so we must disable overflow check
{
  const mb = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(7).fillColor(MID)
     .text('For internal use  -  do not share credentials publicly.',
           0, PAGE_H - 28, { align: 'center', width: PAGE_W, lineBreak: false });
  doc.page.margins.bottom = mb;
  doc.y = MARGIN;  // reset cursor to safe position
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1  -  TECH STACK
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
sectionHeader('1.  Tech Stack');

table(
  [
    { label: 'Layer',        w: 100 },
    { label: 'Technology',   w: 150 },
    { label: 'Notes',        w: CONTENT_W - 250 },
  ],
  [
    ['Backend',      'Node.js + Express 4',     'REST API + static file serving'],
    ['Real-time',    'Supabase Realtime',        'Instant messaging via DB subscriptions'],
    ['Database',     'Supabase (PostgreSQL)',    'Cloud Postgres + Realtime + Storage'],
    ['Auth',         'JWT + bcryptjs',           '7-day tokens stored in localStorage'],
    ['File Uploads', 'Multer',                   'Profile photos (5 MB), chat files (10 MB)'],
    ['Frontend',     'HTML + CSS + Vanilla JS', 'No framework  -  zero build step'],
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2  -  HOW TO RUN
// ─────────────────────────────────────────────────────────────────────────────
sectionHeader('2.  How to Run');

subHeader('Prerequisites');
bullet(['Node.js v16 or later  (nodejs.org)', 'A terminal / command prompt']);

subHeader('First-time setup');
body('Open a terminal in the project folder and run:');
doc.moveDown(0.3);
codeBlock([
  'cd "C:\\Users\\andre\\Documents\\Deepseek\\Code App"',
  'npm install',
]);

subHeader('Start the server');
codeBlock(['node server.js']);

subHeader('Open in browser');
bullet([
  'Navigate to  http://localhost:3000',
  'Register an account, complete your profile, then start browsing.',
  'Admin panel:  http://localhost:3000/admin.html',
]);
body('Always use http://localhost:3000  -  opening the HTML file directly via file:// will not work.');

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3  -  FEATURES
// ─────────────────────────────────────────────────────────────────────────────
sectionHeader('3.  Features');

const FEATURES = [
  {
    num: '3.1', title: 'Authentication',
    files: 'public/index.html  ·  server.js',
    items: [
      'Register with username, email, and password (bcrypt-hashed  -  never stored plain)',
      'Login returns a 7-day JWT stored in localStorage',
      'Forgot password  -  2-step: verify email, then set a new password (no email server needed)',
      'Change password on the Profile page (current password required)',
      'Clear error shown when app is opened as file:// instead of http://localhost:3000',
    ],
  },
  {
    num: '3.2', title: 'Profile',
    files: 'public/profile.html  ·  server.js',
    items: [
      'Upload a profile photo (JPEG / PNG, max 5 MB) shown as a circular thumbnail',
      'Set display name, age, gender, and bio (300-character counter)',
      'Email shown read-only',
      'Navbar chip shows name and avatar on all pages; falls back to initial letter',
    ],
  },
  {
    num: '3.3', title: 'Discover / Browse',
    files: 'public/browse.html  ·  server.js',
    items: [
      'Responsive card grid of all members who completed their profile',
      '88 px circular photo with a live green/grey online status dot',
      'Shows name, age, gender, bio, and last-seen time',
      'Click any card or the Message button to open a chat with that person',
      'Your own card is included and always shows Online while you are logged in',
    ],
  },
  {
    num: '3.4', title: 'Real-Time Chat',
    files: 'public/chat.html  ·  server.js',
    items: [
      'Instant messaging via Socket.io  -  no page refresh needed',
      'Conversation sidebar with last-message preview and per-conversation unread badge',
      'Emoji picker with 7 categories: Smileys, Hearts, Hands, Nature, Food, Activity, Symbols',
      'File & image sharing up to 10 MB; images shown inline, other files as download links',
      'Preview bar before sending with X to cancel',
      'Edit own messages  -  hover to reveal button, confirm with Enter; shows "(edited)"',
      'Delete own messages  -  removed instantly for both sender and receiver',
    ],
  },
  {
    num: '3.5', title: 'Online / Offline Presence',
    files: 'public/global.js  ·  server.js  ·  browse.html  ·  chat.html',
    items: [
      'Green = online, grey = offline on every member card and in the chat header',
      'Updates in real time via user_status socket event  -  no page reload needed',
      'Shows "Online" when connected, "Offline · Xm ago" after disconnect',
      'Global: user stays online while on Browse, Profile, or any other authenticated page',
      'Last-seen timestamp saved to db.json on socket disconnect',
    ],
  },
  {
    num: '3.6', title: 'Unread Badges & Browser Notifications',
    files: 'public/chat.html  ·  public/global.js',
    items: [
      'Red badge counter per conversation in the sidebar',
      'Nav-bar badge showing total unread count across all conversations',
      'Desktop browser notifications when a message arrives (requires user permission)',
      'Clicking a notification opens the relevant chat directly',
      'Browser tab title flashes with the sender name when the window is not focused',
    ],
  },
  {
    num: '3.7', title: 'Admin Panel',
    files: 'public/admin.html  ·  server.js',
    items: [
      'Separate password-protected dashboard at /admin.html',
      'Stats bar: total users, complete profiles, users with photos, total messages',
      'Users tab: searchable table with all fields and a delete button per row',
      'Messages tab: full log with sender, receiver, content, timestamp; delete per row',
      'Refresh button reloads live data without a page reload',
      'One-click link to Error Logs page',
    ],
  },
  {
    num: '3.8', title: 'Error Logging',
    files: 'logger.js  ·  server.js  ·  public/logs.html',
    items: [
      'All uncaught exceptions and unhandled promise rejections are written to error.log',
      'Route errors, failed login attempts, and admin login events are also logged',
      'Admin-only /api/logs endpoint to read the log file',
      'Admin-only DELETE /api/logs to clear the log',
      'Dedicated log viewer at /logs.html with dark terminal theme',
      'Auto-refresh every 5 seconds  -  no page reload needed',
      'Color-coded entries: INFO (green), WARN (amber), ERROR (red) with full stack traces',
    ],
  },
  {
    num: '3.9', title: 'Contact Form',
    files: 'public/profile.html  ·  server.js',
    items: [
      'Send Message button on the Profile page opens a modal contact form',
      'Fields: Your Name, Subject, Message (1000-character limit with counter)',
      'Messages are sent via Formspree API to the developer email',
      'Success confirmation on submission, auto-closes after 2 seconds',
      'Accessible to all authenticated users from the Profile page',
    ],
  },
];

FEATURES.forEach(f => {
  ensureSpace(50);
  if (doc.y > MARGIN + 10) doc.moveDown(0.7);
  // Feature number + title (bold, brand color)
  doc.fontSize(9.5).fillColor(BRAND).font('Helvetica-Bold')
     .text(`${f.num}  ${f.title}`, { lineGap: 1 });
  // Files reference on its own line (small, muted, consistent indent)
  doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
     .text(`    ${f.files}`, { indent: 12, lineGap: 2 });
  doc.moveDown(0.2);
  bullet(f.items);
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4  -  API ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
sectionHeader('4.  API Endpoints');
body('All routes are relative to http://localhost:3000.  Auth = Bearer token required.  Admin = admin JWT required.');
doc.moveDown(0.4);

table(
  [
    { label: 'Method',      w: 50,  align: 'center' },
    { label: 'Route',       w: 178 },
    { label: 'Auth?',       w: 42,  align: 'center' },
    { label: 'Description', w: CONTENT_W - 270 },
  ],
  [
    ['POST',   '/api/register',            'No',    'Create a new account'],
    ['POST',   '/api/login',               'No',    'Login  -  returns JWT + userId'],
    ['POST',   '/api/forgot-password',    'No',    'Verify email exists, return reset token (15 min TTL)'],
    ['POST',   '/api/reset-password',     'No',    'Set new password using reset token'],
    ['PUT',    '/api/change-password',    'Yes',   'Change password (current password required)'],
    ['PUT',    '/api/profile',            'Yes',   'Update profile fields + optional photo upload'],
    ['GET',    '/api/profile/me',         'Yes',   'Get own profile data'],
    ['GET',    '/api/members',            'Yes',   'List all members with complete profiles'],
    ['GET',    '/api/messages/:otherId',  'Yes',   'Message history with another user'],
    ['GET',    '/api/conversations',      'Yes',   'Conversation list with last-message preview'],
    ['POST',   '/api/chat/upload',        'Yes',   'Upload a file for use in chat'],
    ['POST',   '/api/admin/login',        'No',    'Admin login  -  returns admin JWT'],
    ['GET',    '/api/admin/users',        'Admin', 'All users (passwords excluded)'],
    ['GET',    '/api/admin/messages',     'Admin', 'Full message log with sender/receiver names'],
    ['GET',    '/api/admin/stats',        'Admin', 'Aggregate stats (users, messages, etc.)'],
    ['DELETE', '/api/admin/users/:id',    'Admin', 'Delete user and all their messages'],
    ['DELETE', '/api/admin/messages/:id', 'Admin', 'Delete a single message'],
    ['GET',    '/api/logs',               'Admin', 'Read the server error log file'],
    ['DELETE', '/api/logs',               'Admin', 'Clear the error log file'],
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5  -  SOCKET.IO EVENTS
// ─────────────────────────────────────────────────────────────────────────────
sectionHeader('5.  Socket.io Events');
body('All socket connections pass  auth: { token }  in the handshake on port 3000.');
doc.moveDown(0.4);

table(
  [
    { label: 'Event',          w: 128 },
    { label: 'Direction',      w: 100, align: 'center' },
    { label: 'Payload Fields', w: 162 },
    { label: 'Description',    w: CONTENT_W - 390 },
  ],
  [
    ['send_message',    'Client -> Server', 'receiverId, content, type, fileName',                    'Send message; server saves + routes it'],
    ['new_message',     'Server -> Client', 'id, sender_id, receiver_id, content, type, sender_name', 'Delivered to sender and receiver'],
    ['edit_message',    'Client -> Server', 'messageId, content',                                     'Edit own message'],
    ['message_edited',  'Server -> Client', 'messageId, content',                                     'Both parties update the message text'],
    ['delete_message',  'Client -> Server', 'messageId',                                               'Delete own message'],
    ['message_deleted', 'Server -> Client', 'messageId',                                               'Both parties remove the message'],
    ['user_status',     'Server -> All',    'userId, online, lastSeen',                                'Emitted on every connect / disconnect'],
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6  -  FILE STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────
sectionHeader('6.  File Structure');

table(
  [
    { label: 'Path',    w: 200 },
    { label: 'Purpose', w: CONTENT_W - 200 },
  ],
  [
    ['Code App/',             '-- project root'],
    ['  server.js',           'Express API + Socket.io + Logger (all backend logic)'],
    ['  logger.js',           'Error logging module -- writes timestamped entries to error.log'],
    ['  error.log',           'Auto-generated log file (created at runtime)'],
    ['  database.js',         'Supabase client setup -- exports @supabase/supabase-js instance'],
    ['  db.json',             'Legacy JSON database (archived -- Supabase now active)'],
    ['  generate_docs.js',    'This script -- re-run to regenerate this PDF'],
    ['  package.json',        'npm dependency manifest'],
    ['  public/',             '-- static frontend files served by Express'],
    ['    index.html',        'Login, Register, Forgot Password'],
    ['    profile.html',      'Profile editing + Change Password'],
    ['    browse.html',       'Discover member grid'],
    ['    chat.html',         'Real-time chat UI'],
    ['    admin.html',        'Admin dashboard'],
    ['    logs.html',         'Error log viewer (admin-only, auto-refresh)'],
    ['    documentation.html','Full technical documentation (this page)'],
    ['    terms.html',        'Terms & Conditions'],
    ['    privacy.html',      'Privacy Policy'],
    ['    faq.html',          'FAQ & Troubleshooting'],
    ['    changelog.html',    'Version history & changelog'],
    ['    nav.js',            'Shared navbar chip (name + avatar)'],
    ['    global.js',         'Persistent socket, notifications, tab-title flash'],
    ['    style.css',         'All styles for all pages'],
    ['  uploads/',            'Profile photos + chat files (exclude from git)'],
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 7  -  CREDENTIALS & CONFIG
// ─────────────────────────────────────────────────────────────────────────────
sectionHeader('7.  Credentials & Configuration');

table(
  [
    { label: 'Setting',         w: 150 },
    { label: 'Value',           w: 180 },
    { label: 'Where to change', w: CONTENT_W - 330 },
  ],
  [
    ['Server port',         '3000',                                'server.js -- const PORT'],
    ['JWT secret',          'social-app-secret-key-change-in-prod','server.js -- const JWT_SECRET'],
    ['JWT expiry',          '7 days',                              'server.js -- jwt.sign expiresIn'],
    ['Admin password',      'admin1234',                           'server.js -- const ADMIN_PASSWORD'],
    ['Profile photo limit', '5 MB',                               'server.js -- upload multer config'],
    ['Chat file limit',     '10 MB',                              'server.js -- uploadChat multer config'],
    ['Database file',       'db.json',                            'database.js -- FileSync path'],
  ]
);

doc.moveDown(0.4);
ensureSpace(30);
const WY = doc.y;
doc.save().rect(MARGIN, WY, CONTENT_W, 26).fill('#f0fdf4').restore();
doc.save().rect(MARGIN, WY, 3, 26).fill('#16a34a').restore();
doc.save()
   .fontSize(8).fillColor('#14532d').font('Helvetica-Bold')
   .text('Security note:', MARGIN + 8, WY + 9, { lineBreak: false })
   .restore();
doc.save()
   .fontSize(8).fillColor('#9a3412').font('Helvetica')
   .text('  Change JWT_SECRET and ADMIN_PASSWORD before deploying to any public server.',
         MARGIN + 80, WY + 9, { lineBreak: false })
   .restore();
doc.y = WY + 32;

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 8  -  DATA MODELS
// ─────────────────────────────────────────────────────────────────────────────
sectionHeader('8.  Data Models  (db.json)');

subHeader('User');
table(
  [
    { label: 'Field',       w: 95  },
    { label: 'Type',        w: 115 },
    { label: 'Description', w: CONTENT_W - 210 },
  ],
  [
    ['id',         'number',        'Auto-incrementing primary key'],
    ['username',   'string',        'Unique; chosen at registration'],
    ['email',      'string',        'Unique email address'],
    ['password',   'string',        'bcrypt hash -- never returned by any API route'],
    ['name',       'string | null', 'Display name set on Profile page'],
    ['age',        'number | null', 'Age set on Profile page'],
    ['gender',     'string | null', 'Gender set on Profile page'],
    ['bio',        'string | null', 'Short bio, max 300 characters'],
    ['photo',      'string | null', 'Server path, e.g. /uploads/photo.jpg'],
    ['created_at', 'ISO string',    'Registration timestamp'],
    ['lastSeen',   'ISO string',    'Updated on socket disconnect'],
  ]
);

subHeader('Message');
table(
  [
    { label: 'Field',       w: 95  },
    { label: 'Type',        w: 115 },
    { label: 'Description', w: CONTENT_W - 210 },
  ],
  [
    ['id',          'number',                'Auto-incrementing primary key'],
    ['sender_id',   'number',                'ID of the sending user'],
    ['receiver_id', 'number',                'ID of the recipient'],
    ['content',     'string',                'Message text or /uploads/... path for files'],
    ['type',        '"text"|"image"|"file"', 'Defaults to "text"'],
    ['fileName',    'string | null',         'Original filename for attachments'],
    ['edited',      'boolean',               'true if the sender edited this message'],
    ['created_at',  'ISO string',            'Send timestamp (server time)'],
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 9  -  REASONIX SETUP
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
sectionHeader('9.  Reasonix Setup');

body('Reasonix is a DeepSeek-native coding agent that runs in the terminal. It uses DeepSeek\'s API directly  -  cache-first loop, flash-first cost control, and automatic tool-call repair.');
doc.moveDown(0.4);

subHeader('Prerequisites');
bullet([
  'Node.js 20.10+  -  verify with node --version',
  'DeepSeek API key  -  obtain from platform.deepseek.com',
  'Git for Windows (Windows users only)',
]);

subHeader('Step-by-Step Setup');
doc.fontSize(8.5).fillColor(DARK).font('Helvetica');
const STEPS = [
  'Open Command Prompt  -  Win + R, type cmd, press Enter',
  'Navigate to project folder: cd C:\\Users\\andre\\Documents\\Deepseek\\Code App',
  'Run Reasonix: npx reasonix@latest code (first run prompts for API key)',
  'Enter your API key when prompted  -  saved to C:\\Users\\andre\\.reasonix\\config.json',
  '(Optional) Customise config: notepad C:\\Users\\andre\\.reasonix\\config.json',
];
STEPS.forEach((step, i) => {
  doc.text(`${i + 1}.  ${step}`, { indent: 12, lineGap: 2, paragraphGap: 3 });
});
doc.moveDown(0.4);

subHeader('Cost Comparison');
doc.moveDown(0.2);
table(
  [
    { label: 'Model',                w: 100 },
    { label: 'Cost / Turn',          w: 80, align: 'center' },
    { label: 'Turns for $4.98',      w: 100, align: 'center' },
    { label: 'Best For',             w: CONTENT_W - 280 },
  ],
  [
    ['Flash (default)',  '~$0.0006',      '~8,000',  'Quick edits, exploration'],
    ['Pro (/preset max)','~$0.01–0.03',   '~200',    'Complex reasoning tasks'],
  ]
);

subHeader('Key Commands');
doc.moveDown(0.2);
table(
  [
    { label: 'Shortcut / Command', w: 140 },
    { label: 'Action',             w: CONTENT_W - 140 },
  ],
  [
    ['Ctrl + L',               'Clear terminal'],
    ['Ctrl + C',               'Exit Reasonix'],
    ['Shift + Tab',            'Auto-apply all suggestions'],
    ['y / n',                  'Accept or discard a change'],
    ['/preset max',            'Switch to DeepSeek Pro model'],
    ['/stats',                 'Display token / cost statistics'],
    ['/cost',                  'Show running cost for the session'],
    ['/clear',                 'Clear the conversation context'],
    ['/help',                  'Show all available commands'],
  ]
);

doc.moveDown(0.3);
const TIP_Y = doc.y;
doc.save().rect(MARGIN, TIP_Y, CONTENT_W, 30).fill('#f0fdf4').restore();
doc.save().rect(MARGIN, TIP_Y, 3, 30).fill('#16a34a').restore();
doc.save()
   .fontSize(8).fillColor('#14532d').font('Helvetica-Bold')
   .text('Tip:', MARGIN + 8, TIP_Y + 8, { lineBreak: false })
   .restore();
doc.fontSize(7.5).fillColor('#166534').font('Helvetica')
   .text('Use Flash for quick exploration; switch to Pro with /preset max for deep reasoning.', MARGIN + 30, TIP_Y + 8);

subHeader('Quick-Start Cheat Sheet');
doc.moveDown(0.2);
codeBlock([
  'cd C:\\Users\\andre\\Documents\\Deepseek\\Code App',
  'npx reasonix@latest code',
  '/preset max',
  '/stats',
]);

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 10  -  SUPABASE LOCAL SETUP
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
sectionHeader('10.  Supabase Local Setup');

body('Spark has migrated from lowdb (JSON file) to Supabase (PostgreSQL) for better scalability and Vercel deployment readiness.');
doc.moveDown(0.4);

subHeader('Prerequisites');
bullet([
  'Docker Desktop -- install from docker.com',
  'Supabase CLI -- installed via npx (no global install needed)',
]);

subHeader('Local Setup');
doc.moveDown(0.2);
codeBlock([
  'cd C:\\Users\\andre\\Documents\\Deepseek\\Code App',
  'npx supabase init',
  'npx supabase start',
]);
body('This spins up PostgreSQL + Supabase Studio + all supporting services locally via Docker.');
doc.moveDown(0.4);

subHeader('Local URLs');
doc.moveDown(0.2);
table(
  [
    { label: 'Service',             w: 160 },
    { label: 'URL',                  w: CONTENT_W - 160 },
  ],
  [
    ['Supabase Studio (web UI)',   'http://127.0.0.1:54323'],
    ['API Endpoint',               'http://127.0.0.1:54321'],
    ['Database URL',               'postgresql://postgres:postgres@127.0.0.1:54322/postgres'],
    ['Mailpit (test emails)',      'http://127.0.0.1:54324'],
  ]
);

subHeader('Cloud Supabase');
body('Spark uses a cloud Supabase project (CWD) at https://hpezaqvtufrvvczyixwc.supabase.co for production data. The local Supabase instance is used for development and testing.');
doc.moveDown(0.4);

subHeader('Migration Complete');
doc.fontSize(8.5).fillColor(DARK).font('Helvetica');
const PLAN = [
  'Phase 1 -- Set up Supabase locally   ✅',
  'Phase 2 -- Create tables (users, messages, contacts)   ✅',
  'Phase 3 -- Migrated 5 users, 19 messages, 2 contacts from db.json   ✅',
  'Phase 4 -- Replaced all lowdb queries with Supabase   ✅',
  'Phase 5 -- File uploads moved to Supabase Storage   ✅',
  'Phase 6 -- Deploy to Vercel   ✅  -- live at spark-social-app-ys49.vercel.app',
];
PLAN.forEach((step, i) => {
  doc.text(`${i + 1}.  ${step}`, { indent: 12, lineGap: 2, paragraphGap: 3 });
});
doc.moveDown(0.6);

// ─────────────────────────────────────────────────────────────────────────────
//  FOOTER PASS  -  draw footers on all pages EXCEPT the cover (index 0)
//
//  IMPORTANT: after drawing text near the bottom of a page, doc.y is left at
//  ~820 which triggers PDFKit's auto-overflow and creates blank pages.
//  Fix: save doc.y before and restore it after each footer draw.
// ─────────────────────────────────────────────────────────────────────────────
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  if (i === range.start) continue;          // skip cover page
  doc.switchToPage(i);
  const savedY = doc.y;                     // save before drawing
  const pageNum = i - range.start;          // 1-based content page number
  const fy = PAGE_H - 22;
  // Disable bottom-margin overflow check so text at fy=PAGE_H-22 doesn't
  // trigger PDFKit's auto-addPage while we're drawing the footer.
  const mb = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save()
     .moveTo(MARGIN, fy - 5).lineTo(PAGE_W - MARGIN, fy - 5)
     .strokeColor(BORDER).lineWidth(0.5).stroke()
     .fontSize(7.5).fillColor(MID).font('Helvetica')
     .text('Spark -- Technical Documentation', MARGIN, fy,
           { width: CONTENT_W / 2, lineBreak: false })
     .text(`Page ${pageNum}`, MARGIN, fy,
           { width: CONTENT_W, align: 'right', lineBreak: false })
     .restore();
  doc.page.margins.bottom = mb;
  doc.y = savedY;                           // restore cursor
}

// ── Finalize ──────────────────────────────────────────────────────────────────
doc.flushPages();
doc.end();
