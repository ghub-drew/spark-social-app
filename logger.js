const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'error.log');

const LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };

function formatTime() {
  return new Date().toISOString();
}

function write(level, message, details) {
  const timestamp = formatTime();
  let line = `[${timestamp}] [${level}] ${message}`;
  if (details) {
    const detailStr = typeof details === 'string' ? details : JSON.stringify(details);
    line += ` — ${detailStr}`;
  }
  line += '\n';

  try {
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (err) {
    console.error('Logger failed to write:', err.message);
  }
}

module.exports = {
  info: (msg, details) => write(LEVELS.INFO, msg, details),
  warn: (msg, details) => write(LEVELS.WARN, msg, details),
  error: (msg, details) => write(LEVELS.ERROR, msg, details),
  LOG_FILE,
};
