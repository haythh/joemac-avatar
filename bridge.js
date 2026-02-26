#!/usr/bin/env node
/**
 * JoeMac Avatar Bridge
 * 
 * Polls the Telegram Bot API for outbound messages from JoeMac to Haythem,
 * then writes them to messages.json so the BMO avatar animates.
 * 
 * Usage: node bridge.js
 * 
 * Alternatively, any process can write to messages.json directly:
 *   echo '{"text":"Hello!","emotion":"happy","timestamp":1234567890}' > messages.json
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const PORT = 7777; // Local HTTP server for receiving messages

// ─── HTTP Server (receives messages from OpenClaw or any source) ───
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/message') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        const payload = {
          text: msg.text || '',
          emotion: msg.emotion || 'idle',
          timestamp: Date.now()
        };
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(payload, null, 2));
        console.log(`[${new Date().toLocaleTimeString()}] 💬 ${payload.text.substring(0, 60)}${payload.text.length > 60 ? '...' : ''}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error('Parse error:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🎮 JoeMac Avatar Bridge running on http://127.0.0.1:${PORT}`);
  console.log(`   POST /message — send a message to BMO`);
  console.log(`   GET  /health  — health check\n`);
  console.log(`   Example:`);
  console.log(`   curl -X POST http://127.0.0.1:${PORT}/message -H "Content-Type: application/json" -d '{"text":"Hello!","emotion":"happy"}'\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Bridge shutting down...');
  server.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
