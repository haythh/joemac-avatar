#!/usr/bin/env node
/**
 * JoeMac Avatar Bridge
 * 
 * Tails the active OpenClaw session JSONL for assistant messages,
 * then writes them to messages.json so BMO animates.
 * Also runs an HTTP server for manual message injection.
 * 
 * Usage: node bridge.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const SESSIONS_DIR = path.join(require('os').homedir(), '.openclaw', 'agents', 'main', 'sessions');
const PORT = 7777;

// ─── Find the most recent (active) session JSONL ───
function findActiveSession() {
  try {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        path: path.join(SESSIONS_DIR, f),
        mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? files[0].path : null;
  } catch (err) {
    console.error('Could not find sessions:', err.message);
    return null;
  }
}

// ─── Send message to BMO ───
function sendToBmo(text, emotion = 'idle') {
  if (!text || text.trim() === '' || text === 'NO_REPLY' || text === 'HEARTBEAT_OK') return;
  
  // Truncate very long messages for the speech bubble
  const displayText = text.length > 200 ? text.substring(0, 197) + '...' : text;
  
  const payload = {
    text: displayText,
    emotion: emotion,
    timestamp: Date.now()
  };
  
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(payload, null, 2));
    console.log(`[${new Date().toLocaleTimeString()}] 💬 ${displayText.substring(0, 80)}${displayText.length > 80 ? '...' : ''}`);
  } catch (err) {
    console.error('Write error:', err.message);
  }
}

// ─── Detect emotion from text ───
function detectEmotion(text) {
  const lower = text.toLowerCase();
  if (/🔥|🚀|nice|awesome|done|fixed|pushed|deployed|live|let's go/i.test(lower)) return 'happy';
  if (/hmm|thinking|let me|checking|looking/i.test(lower)) return 'thinking';
  if (/sorry|error|fail|broke|bug/i.test(lower)) return 'sad';
  return 'idle';
}

// ─── Extract clean text from assistant message content ───
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }
  return '';
}

// ─── Tail the session JSONL ───
let lastSessionPath = null;
let lastSize = 0;
let watcher = null;
let seenTimestamps = new Set();

function startTailing() {
  const sessionPath = findActiveSession();
  if (!sessionPath) {
    console.log('⏳ No active session found, retrying in 5s...');
    setTimeout(startTailing, 5000);
    return;
  }

  // If session changed, reset
  if (sessionPath !== lastSessionPath) {
    if (watcher) watcher.close();
    lastSessionPath = sessionPath;
    lastSize = fs.statSync(sessionPath).size; // Start from current end (don't replay history)
    seenTimestamps.clear();
    console.log(`📂 Watching: ${path.basename(sessionPath)}`);
  }

  let debounce = null;

  watcher = fs.watch(sessionPath, (eventType) => {
    if (eventType !== 'change') return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try {
        const stat = fs.statSync(sessionPath);
        if (stat.size <= lastSize) return;

        // Read only the new bytes
        const fd = fs.openSync(sessionPath, 'r');
        const buf = Buffer.alloc(stat.size - lastSize);
        fs.readSync(fd, buf, 0, buf.length, lastSize);
        fs.closeSync(fd);
        lastSize = stat.size;

        const newLines = buf.toString('utf8').split('\n').filter(l => l.trim());
        
        for (const line of newLines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type !== 'message') continue;
            if (!entry.message || entry.message.role !== 'assistant') continue;
            
            // Skip if we've seen this timestamp (dedup)
            const ts = entry.message.timestamp || entry.timestamp;
            if (seenTimestamps.has(ts)) continue;
            seenTimestamps.add(ts);
            // Keep set from growing unbounded
            if (seenTimestamps.size > 100) {
              const arr = [...seenTimestamps];
              seenTimestamps = new Set(arr.slice(-50));
            }

            // Skip tool-only messages (no text content)
            const text = extractText(entry.message.content);
            if (!text) continue;
            
            // Skip internal/system stuff
            if (text.startsWith('NO_REPLY') || text.startsWith('HEARTBEAT_OK')) continue;

            const emotion = detectEmotion(text);
            sendToBmo(text, emotion);
          } catch (parseErr) {
            // Skip malformed lines
          }
        }
      } catch (err) {
        console.error('Tail error:', err.message);
      }
    }, 200);
  });

  // Periodically check if a newer session started
  setInterval(() => {
    const newest = findActiveSession();
    if (newest && newest !== lastSessionPath) {
      console.log('🔄 New session detected, switching...');
      startTailing();
    }
  }, 30000);
}

// ─── HTTP Server (manual injection + health) ───
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/message') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        sendToBmo(msg.text, msg.emotion || 'idle');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      uptime: process.uptime(),
      session: lastSessionPath ? path.basename(lastSessionPath) : null
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🎮 JoeMac Avatar Bridge v2`);
  console.log(`   HTTP: http://127.0.0.1:${PORT}`);
  console.log(`   Mode: Session JSONL tailer + HTTP fallback\n`);
  startTailing();
});

process.on('SIGINT', () => { console.log('\n👋 Bye!'); server.close(); if (watcher) watcher.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); if (watcher) watcher.close(); process.exit(0); });
