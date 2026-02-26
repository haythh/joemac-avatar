const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

// ─── Config paths ─────────────────────────────────────────────────────────────
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');
const CONFIG_FILE = path.join(OPENCLAW_DIR, 'bmo-avatar.json');
const PORT = 7777;

let mainWindow = null;
let tray = null;
let messageWatcher = null;
let httpServer = null;

// ─── Persist config ───────────────────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}
  return { launchAtLogin: false, alwaysOnTop: true, firstRun: true };
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(OPENCLAW_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('Could not save config:', e.message);
  }
}

let config = loadConfig();

// ─── Ensure messages.json exists ──────────────────────────────────────────────
if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify({ text: '', emotion: 'idle', timestamp: 0 }));
}

// ─── OpenClaw detection ───────────────────────────────────────────────────────
function findOpenClawSessions() {
  try {
    const agentsDir = path.join(OPENCLAW_DIR, 'agents');
    if (!fs.existsSync(agentsDir)) return [];
    const agents = fs.readdirSync(agentsDir);
    const sessions = [];
    for (const agent of agents) {
      const sessionsDir = path.join(agentsDir, agent, 'sessions');
      if (!fs.existsSync(sessionsDir)) continue;
      try {
        const files = fs.readdirSync(sessionsDir)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => {
            const fp = path.join(sessionsDir, f);
            return { name: f, path: fp, mtime: fs.statSync(fp).mtimeMs };
          });
        sessions.push(...files);
      } catch (e) {}
    }
    return sessions.sort((a, b) => b.mtime - a.mtime);
  } catch (err) {
    return [];
  }
}

function isOpenClawInstalled() {
  return fs.existsSync(OPENCLAW_DIR) && findOpenClawSessions().length >= 0;
}

function findActiveSession() {
  const sessions = findOpenClawSessions();
  return sessions.length > 0 ? sessions[0].path : null;
}

// ─── Emotion & text helpers ───────────────────────────────────────────────────
function detectEmotion(text) {
  const lower = text.toLowerCase();
  // Strong signals first — order matters
  if (/(!{3,}|🎉|🎊|holy shit|insane|incredible|amazing|mind.?blow|🤯)/i.test(lower)) return 'excited';
  if (/❤️|💕|love|adore|heart/i.test(lower)) return 'love';
  if (/😂|lol|lmao|haha|😏|sneaky|trick|mischie/i.test(lower)) return 'mischief';
  if (/\?{2,}|hmm|wonder|curious|interesting|what if/i.test(lower)) return 'curious';
  if (/whoa|wow|😱|😮|wait what|unexpected|no way/i.test(lower)) return 'surprised';
  if (/⚠️|careful|warning|watch out|oh no|uh oh/i.test(lower)) return 'scared';
  if (/well done|proud|nailed|killed it|congrat|nice work|ship.?it/i.test(lower)) return 'proud';
  if (/🔥|🚀|nice|awesome|done|fixed|pushed|deployed|live|let's go|cool|great|good/i.test(lower)) return 'happy';
  if (/thinking|let me|checking|looking|figuring|scanning/i.test(lower)) return 'thinking';
  if (/sorry|error|fail|broke|bug|unfortunately|bad news|😢/i.test(lower)) return 'sad';
  return 'idle';
}

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

// ─── ElevenLabs TTS ───────────────────────────────────────────────────────────
const ELEVENLABS_KEY = 'sk_b57bd5718cffa86860c10c9a04becf10e76b4a10a1dc7960';
const BMO_VOICE_ID = 'kryUfGGmdlEvRm6LrMNh';
const https = require('https');
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

function generateTTS(text) {
  return new Promise((resolve, reject) => {
    // Truncate for TTS (save API credits)
    const ttsText = text.length > 300 ? text.substring(0, 297) + '...' : text;
    
    const body = JSON.stringify({
      text: ttsText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.6, similarity_boost: 0.85 }
    });

    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${BMO_VOICE_ID}`,
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', c => errBody += c);
        res.on('end', () => {
          console.error('TTS error:', res.statusCode, errBody.substring(0, 200));
          resolve(null);
        });
        return;
      }
      const audioFile = path.join(audioDir, `bmo-${Date.now()}.mp3`);
      const fileStream = fs.createWriteStream(audioFile);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        // Clean up old audio files (keep last 5)
        try {
          const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3')).sort();
          while (files.length > 5) {
            fs.unlinkSync(path.join(audioDir, files.shift()));
          }
        } catch(e) {}
        resolve(audioFile);
      });
      fileStream.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

// ─── Send message to BMO renderer ─────────────────────────────────────────────
async function sendToBmo(text, emotion = 'idle') {
  if (!text || text.trim() === '' || text === 'NO_REPLY' || text === 'HEARTBEAT_OK') return;
  const displayText = text.length > 200 ? text.substring(0, 197) + '...' : text;
  const msg = { text: displayText, emotion, timestamp: Date.now(), audioPath: null };

  // Generate TTS audio
  try {
    const audioFile = await generateTTS(displayText);
    if (audioFile) msg.audioPath = audioFile;
  } catch (e) {
    console.error('TTS failed:', e.message);
  }

  // Write to file for compatibility
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msg, null, 2));
  } catch (e) {}

  // Play audio via system player + get duration for mouth sync
  if (msg.audioPath && process.platform === 'darwin') {
    const { exec: execCmd } = require('child_process');
    // Get audio duration first
    execCmd(`afinfo "${msg.audioPath}" | grep duration`, (err, stdout) => {
      const match = stdout && stdout.match(/([\d.]+)\s*sec/);
      if (match) {
        msg.audioDuration = Math.ceil(parseFloat(match[1]) * 1000); // ms
      }
      // Send to renderer with duration info
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('new-message', msg);
      }
      // Play audio
      execCmd(`afplay "${msg.audioPath}"`);
    });
    // Write to file for compatibility
    try { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msg, null, 2)); } catch (e) {}
    return; // skip the send below since we send after getting duration
  }

  // Send directly to renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('new-message', msg);
  }
}

// ─── Session JSONL tailing ────────────────────────────────────────────────────
let lastSessionPath = null;
let lastSize = 0;
let sessionWatcher = null;
let seenTimestamps = new Set();
let sessionCheckInterval = null;

function startSessionTailing() {
  const sessionPath = findActiveSession();

  if (!sessionPath) {
    console.log('⏳ No OpenClaw session found, retrying in 5s...');
    setTimeout(startSessionTailing, 5000);
    return;
  }

  if (sessionPath !== lastSessionPath) {
    if (sessionWatcher) { sessionWatcher.close(); sessionWatcher = null; }
    lastSessionPath = sessionPath;
    lastSize = fs.statSync(sessionPath).size; // Don't replay history
    seenTimestamps.clear();
    console.log(`📂 Watching: ${path.basename(sessionPath)}`);
  }

  let debounce = null;

  try {
    sessionWatcher = fs.watch(sessionPath, (eventType) => {
      if (eventType !== 'change') return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          const stat = fs.statSync(sessionPath);
          if (stat.size <= lastSize) return;

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

              const ts = entry.message.timestamp || entry.timestamp;
              if (seenTimestamps.has(ts)) continue;
              seenTimestamps.add(ts);
              if (seenTimestamps.size > 100) {
                seenTimestamps = new Set([...seenTimestamps].slice(-50));
              }

              const text = extractText(entry.message.content);
              if (!text) continue;
              if (text.startsWith('NO_REPLY') || text.startsWith('HEARTBEAT_OK')) continue;

              const emotion = detectEmotion(text);
              sendToBmo(text, emotion);
            } catch (e) {}
          }
        } catch (err) {
          console.error('Tail error:', err.message);
        }
      }, 200);
    });

    sessionWatcher.on('error', (err) => {
      console.error('Session watcher error:', err.message);
    });
  } catch (err) {
    console.error('Could not watch session file:', err.message);
  }

  // Periodically switch to newer sessions
  if (!sessionCheckInterval) {
    sessionCheckInterval = setInterval(() => {
      const newest = findActiveSession();
      if (newest && newest !== lastSessionPath) {
        console.log('🔄 New session detected, switching...');
        startSessionTailing();
      }
    }, 30000);
  }
}

// ─── HTTP fallback server (port 7777) ─────────────────────────────────────────
function startHttpServer() {
  httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
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

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} already in use (another bridge running?)`);
    } else {
      console.error('HTTP server error:', err.message);
    }
  });

  httpServer.listen(PORT, '127.0.0.1', () => {
    console.log(`🌐 HTTP fallback: http://127.0.0.1:${PORT}`);
  });
}

// ─── Tray ──────────────────────────────────────────────────────────────────────
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'BMO Avatar', enabled: false },
    { type: 'separator' },
    {
      label: 'Show / Hide',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        }
      }
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: config.alwaysOnTop !== false,
      click: (item) => {
        config.alwaysOnTop = item.checked;
        saveConfig(config);
        if (mainWindow) mainWindow.setAlwaysOnTop(config.alwaysOnTop);
      }
    },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: !!config.launchAtLogin,
      click: (item) => {
        config.launchAtLogin = item.checked;
        saveConfig(config);
        app.setLoginItemSettings({ openAtLogin: item.checked });
      }
    },
    { type: 'separator' },
    {
      label: 'Send Test Message',
      click: () => {
        sendToBmo("Hey! I'm BMO 👋 Everything's running great!", 'happy');
      }
    },
    { type: 'separator' },
    {
      label: `About BMO Avatar v${app.getVersion()}`,
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'BMO Avatar',
          message: `BMO Avatar v${app.getVersion()}`,
          detail: 'A floating desktop companion powered by OpenClaw.\n\nhttps://openclaw.ai',
          buttons: ['OK']
        });
      }
    },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);
}

function createTrayIcon() {
  const iconPath = path.join(__dirname, 'renderer', 'tray-icon.png');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('BMO Avatar');
  tray.setContextMenu(buildTrayMenu());

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

// ─── Main window ───────────────────────────────────────────────────────────────
function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 320,
    height: 540,
    x: screenW - 360,
    y: screenH - 580,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: config.alwaysOnTop !== false,
    resizable: true,
    minWidth: 200,
    minHeight: 300,
    skipTaskbar: true,
    hasShadow: false,
    vibrancy: undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Uncomment for debugging:
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Legacy messages.json watcher (for compatibility with external tools)
  startMessageFileWatcher();
}

function startMessageFileWatcher() {
  if (messageWatcher) {
    messageWatcher.close();
  }

  let debounceTimer = null;
  let lastTimestamp = 0;

  messageWatcher = fs.watch(MESSAGES_FILE, (eventType) => {
    if (eventType === 'change') {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          const raw = fs.readFileSync(MESSAGES_FILE, 'utf8');
          const msg = JSON.parse(raw);
          // Only forward if newer than last we sent (avoids echo loop)
          if (mainWindow && msg.text && msg.timestamp > 0 && msg.timestamp !== lastTimestamp) {
            lastTimestamp = msg.timestamp;
            mainWindow.webContents.send('new-message', msg);
          }
        } catch (err) {
          console.error('Error reading messages.json:', err.message);
        }
      }, 100);
    }
  });

  messageWatcher.on('error', (err) => {
    console.error('File watcher error:', err.message);
  });
}

// ─── First-run experience ──────────────────────────────────────────────────────
function handleFirstRun() {
  if (!config.firstRun) return;

  config.firstRun = false;
  saveConfig(config);

  // Wait for renderer to load before sending welcome
  if (mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (!fs.existsSync(OPENCLAW_DIR)) {
          // OpenClaw not detected
          dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'OpenClaw Not Detected',
            message: 'OpenClaw is not installed.',
            detail: 'BMO Avatar works best with OpenClaw installed.\n\nVisit https://openclaw.ai to get started.',
            buttons: ['Open openclaw.ai', 'Dismiss']
          }).then(result => {
            if (result.response === 0) {
              shell.openExternal('https://openclaw.ai');
            }
          });
        } else {
          // OpenClaw detected — send welcome
          sendToBmo("Hey! I'm connected to OpenClaw! 👋", 'happy');
        }
      }, 1500);
    });
  }
}

// ─── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('start-drag', () => {});
ipcMain.handle('get-messages-path', () => MESSAGES_FILE);

// ─── Window Physics IPC ──────────────────────────
ipcMain.handle('get-window-pos', () => {
  if (!mainWindow) return { x: 0, y: 0 };
  const pos = mainWindow.getPosition();
  return { x: pos[0], y: pos[1] };
});

ipcMain.on('set-window-pos', (event, pos) => {
  if (mainWindow && pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
    mainWindow.setPosition(Math.round(pos.x), Math.round(pos.y), false);
  }
});

ipcMain.handle('get-screen-bounds', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTrayIcon();
  startHttpServer();

  // Start session tailing if OpenClaw exists
  if (fs.existsSync(OPENCLAW_DIR)) {
    startSessionTailing();
  }

  // First run experience
  handleFirstRun();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (messageWatcher) { messageWatcher.close(); messageWatcher = null; }
  if (sessionWatcher) { sessionWatcher.close(); sessionWatcher = null; }
  if (sessionCheckInterval) { clearInterval(sessionCheckInterval); sessionCheckInterval = null; }
  if (httpServer) { httpServer.close(); httpServer = null; }
});
