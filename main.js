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

// Apply defaults for new keys without overwriting user prefs
if (config.chatEnabled === undefined)       config.chatEnabled       = true;
if (config.voiceInputEnabled === undefined) config.voiceInputEnabled = true;

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

// ─── TTS Engine ───────────────────────────────────────────────────────────────
// Config-based: user provides ElevenLabs key on first run (optional)
// Falls back to macOS `say` command or silent mode
function getElevenLabsKey() { return config.elevenLabsKey || null; }
function getVoiceId() { return config.elevenLabsVoiceId || 'kryUfGGmdlEvRm6LrMNh'; }
function getTtsMode() {
  if (config.ttsDisabled) return 'silent';
  if (getElevenLabsKey()) return 'elevenlabs';
  if (process.platform === 'darwin') return 'say';
  return 'silent';
}
const https = require('https');
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

// ─── Voice Emotion Profiles ─────────────────────────────────────────────────
// NOTE: ElevenLabs speed caps at 1.2x. Pitch shift is done via afplay -r (playbackRate in config)
const VOICE_PROFILES = {
  idle:      { stability: 0.50, similarity_boost: 0.80, style: 0.05, speed: 1.15 },
  happy:     { stability: 0.35, similarity_boost: 0.75, style: 0.35, speed: 1.2  },
  excited:   { stability: 0.20, similarity_boost: 0.70, style: 0.55, speed: 1.2  },
  thinking:  { stability: 0.60, similarity_boost: 0.80, style: 0.05, speed: 1.05 },
  sad:       { stability: 0.30, similarity_boost: 0.85, style: 0.2,  speed: 0.95 },
  surprised: { stability: 0.15, similarity_boost: 0.75, style: 0.45, speed: 1.2  },
  love:      { stability: 0.40, similarity_boost: 0.85, style: 0.3,  speed: 1.0  },
  curious:   { stability: 0.45, similarity_boost: 0.80, style: 0.2,  speed: 1.1  },
  proud:     { stability: 0.40, similarity_boost: 0.80, style: 0.3,  speed: 1.15 },
  scared:    { stability: 0.10, similarity_boost: 0.75, style: 0.45, speed: 1.2  },
  mischief:  { stability: 0.30, similarity_boost: 0.75, style: 0.4,  speed: 1.15 },
};

// macOS `say` voice mapping per emotion
const SAY_VOICES = {
  idle: { voice: 'Samantha', rate: 180 },
  happy: { voice: 'Samantha', rate: 210 },
  excited: { voice: 'Samantha', rate: 240 },
  thinking: { voice: 'Samantha', rate: 155 },
  sad: { voice: 'Samantha', rate: 140 },
  surprised: { voice: 'Samantha', rate: 230 },
  love: { voice: 'Samantha', rate: 160 },
  curious: { voice: 'Samantha', rate: 170 },
  proud: { voice: 'Samantha', rate: 195 },
  scared: { voice: 'Samantha', rate: 250 },
  mischief: { voice: 'Samantha', rate: 200 },
};

function generateTTS(text, emotion = 'idle') {
  const mode = getTtsMode();
  
  if (mode === 'elevenlabs') return generateElevenLabs(text, emotion);
  if (mode === 'say') return generateMacSay(text, emotion);
  return Promise.resolve(null); // silent
}

function generateElevenLabs(text, emotion) {
  return new Promise((resolve) => {
    const ttsText = text.length > 300 ? text.substring(0, 297) + '...' : text;
    const vp = VOICE_PROFILES[emotion] || VOICE_PROFILES.idle;
    const body = JSON.stringify({
      text: ttsText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: vp.stability,
        similarity_boost: vp.similarity_boost,
        style: vp.style,
        use_speaker_boost: true
      },
      generation_config: { speed: vp.speed }
    });

    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${getVoiceId()}`,
      method: 'POST',
      headers: {
        'xi-api-key': getElevenLabsKey(),
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
        try {
          const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3') || f.endsWith('.aiff')).sort();
          while (files.length > 5) { fs.unlinkSync(path.join(audioDir, files.shift())); }
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

function generateMacSay(text, emotion) {
  return new Promise((resolve) => {
    const { exec: execCmd } = require('child_process');
    const ttsText = text.length > 300 ? text.substring(0, 297) + '...' : text;
    const sv = SAY_VOICES[emotion] || SAY_VOICES.idle;
    const audioFile = path.join(audioDir, `bmo-${Date.now()}.aiff`);
    const escaped = ttsText.replace(/"/g, '\\"');
    execCmd(`say -v "${sv.voice}" -r ${sv.rate} -o "${audioFile}" "${escaped}"`, (err) => {
      if (err) { console.error('say error:', err.message); resolve(null); return; }
      try {
        const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3') || f.endsWith('.aiff')).sort();
        while (files.length > 5) { fs.unlinkSync(path.join(audioDir, files.shift())); }
      } catch(e) {}
      resolve(audioFile);
    });
  });
}

// ─── Message Queue (prevents overlapping speech) ──────────────────────────────
const messageQueue = [];
let isSpeaking = false;

async function sendToBmo(text, emotion = 'idle') {
  if (!text || text.trim() === '' || text === 'NO_REPLY' || text === 'HEARTBEAT_OK') return;
  messageQueue.push({ text, emotion });
  if (!isSpeaking) processQueue();
}

async function processQueue() {
  if (messageQueue.length === 0) { isSpeaking = false; return; }
  isSpeaking = true;
  
  const { text, emotion } = messageQueue.shift();
  const displayText = text.length > 200 ? text.substring(0, 197) + '...' : text;
  const msg = { text: displayText, emotion, timestamp: Date.now(), audioPath: null, audioDuration: null };

  // Generate TTS audio
  try {
    const audioFile = await generateTTS(displayText, emotion);
    if (audioFile) msg.audioPath = audioFile;
  } catch (e) {
    console.error('TTS failed:', e.message);
  }

  // Write to file for compatibility
  try { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msg, null, 2)); } catch (e) {}

  // Get duration, send to renderer, play audio, then process next
  if (msg.audioPath && process.platform === 'darwin') {
    const { exec: execCmd } = require('child_process');
    execCmd(`afinfo "${msg.audioPath}" | grep duration`, (err, stdout) => {
      const match = stdout && stdout.match(/([\d.]+)\s*sec/);
      if (match) {
        msg.audioDuration = Math.ceil(parseFloat(match[1]) * 1000);
      }
      // Send to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('new-message', msg);
      }
      // Play audio, wait for it to finish, then next in queue
      // Play at higher rate for BMO's signature high pitch (1.0 = normal, 1.5 = chipmunk)
      const playbackRate = config.playbackRate || 1.35;
      const player = execCmd(`afplay -r ${playbackRate} "${msg.audioPath}"`, () => {
        // afplay finished — wait a beat then process next message
        setTimeout(processQueue, 500);
      });
    });
    return;
  }

  // No audio — send to renderer, wait estimated duration, then next
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('new-message', msg);
  }
  const waitMs = Math.max(2000, displayText.length * 50) + 500;
  setTimeout(processQueue, waitMs);
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
      label: `Voice: ${getTtsMode() === 'elevenlabs' ? 'ElevenLabs' : getTtsMode() === 'say' ? 'Mac Voice' : 'Silent'}`,
      enabled: false,
    },
    {
      label: 'Change Voice Settings...',
      click: async () => {
        const choice = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          title: 'Voice Settings',
          message: 'Choose voice mode:',
          buttons: ['ElevenLabs (API key)', 'Mac voice (free)', 'Silent', 'Cancel'],
          defaultId: 3,
        });
        if (choice.response === 0) {
          const { inputValue } = await promptForInput('ElevenLabs API Key', 'Paste your API key:', 'elevenlabs.io → Profile → API Keys');
          if (inputValue && inputValue.trim()) {
            config.elevenLabsKey = inputValue.trim();
            config.ttsDisabled = false;
          }
        } else if (choice.response === 1) {
          delete config.elevenLabsKey;
          config.ttsDisabled = false;
        } else if (choice.response === 2) {
          config.ttsDisabled = true;
        } else { return; }
        saveConfig(config);
        tray.setContextMenu(buildTrayMenu());
        sendToBmo(`Voice switched to ${getTtsMode()}!`, 'happy');
      }
    },
    { type: 'separator' },
    {
      label: config.chatEnabled !== false ? '💬 AI Chat: On' : '💬 AI Chat: Off',
      click: () => {
        config.chatEnabled = !config.chatEnabled;
        saveConfig(config);
        tray.setContextMenu(buildTrayMenu());
        sendToBmo(config.chatEnabled ? 'Chat mode is on! Talk to BMO!' : 'BMO is going quiet now...', config.chatEnabled ? 'happy' : 'sad');
      }
    },
    {
      label: config.voiceInputEnabled !== false ? '🎤 Voice Input: On' : '🎤 Voice Input: Off',
      click: () => {
        config.voiceInputEnabled = !config.voiceInputEnabled;
        saveConfig(config);
        tray.setContextMenu(buildTrayMenu());
      }
    },
    {
      label: 'Change AI Settings...',
      click: async () => {
        const { inputValue } = await promptForInput(
          'Gemini API Key',
          'Paste your Gemini API key:',
          'Get one free at ai.google.dev → Get API key'
        );
        if (inputValue && inputValue.trim()) {
          config.geminiApiKey = inputValue.trim();
          saveConfig(config);
          sendToBmo('Ooh! New brain power loaded! BMO is ready to chat!', 'excited');
        }
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

  // Click-through: ignore mouse by default, forward events so renderer can detect hover
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

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
async function handleFirstRun() {
  if (!config.firstRun) return;

  config.firstRun = false;
  saveConfig(config);

  if (!mainWindow) return;

  await new Promise(resolve => {
    mainWindow.webContents.once('did-finish-load', () => setTimeout(resolve, 1500));
  });

  // Check OpenClaw
  if (!fs.existsSync(OPENCLAW_DIR)) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'OpenClaw Not Detected',
      message: 'OpenClaw is not installed.',
      detail: 'BMO Avatar works best with OpenClaw installed.\n\nVisit https://openclaw.ai to get started.',
      buttons: ['Open openclaw.ai', 'Dismiss']
    });
    if (result.response === 0) shell.openExternal('https://openclaw.ai');
  }

  // Ask about ElevenLabs voice
  const voiceChoice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Voice Setup',
    message: 'How should BMO speak?',
    detail: 'ElevenLabs gives BMO a high-quality custom voice (requires API key, ~$5/mo).\n\nWithout it, BMO uses your Mac\'s built-in voice (free but robotic).',
    buttons: ['Use ElevenLabs (paste API key)', 'Use Mac voice (free)', 'No voice (silent)'],
    defaultId: 1,
  });

  if (voiceChoice.response === 0) {
    // Prompt for API key
    const { response, inputValue } = await promptForInput(
      'ElevenLabs API Key',
      'Paste your ElevenLabs API key:',
      'Get one at elevenlabs.io → Profile → API Keys'
    );
    if (inputValue && inputValue.trim()) {
      config.elevenLabsKey = inputValue.trim();
      // Ask for voice ID (optional)
      const vidResult = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Voice ID',
        message: 'Use default BMO voice or custom?',
        detail: 'The default voice is a cloned BMO from Adventure Time.\n\nYou can also use any voice ID from your ElevenLabs account.',
        buttons: ['Default BMO voice', 'Enter custom voice ID'],
      });
      if (vidResult.response === 1) {
        const { inputValue: vid } = await promptForInput(
          'Voice ID',
          'Paste your ElevenLabs Voice ID:',
          'Find it in ElevenLabs → Voices → Voice ID'
        );
        if (vid && vid.trim()) config.elevenLabsVoiceId = vid.trim();
      }
    }
  } else if (voiceChoice.response === 2) {
    config.ttsDisabled = true;
  }

  // Ask about Gemini AI chat
  const aiChoice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'AI Chat Setup',
    message: 'Want to chat with BMO?',
    detail: 'Gemini Flash lets you have real conversations with BMO — it\'s FREE!\n\nGet an API key at ai.google.dev (no credit card needed).',
    buttons: ['Yes! Enter Gemini API key', 'Skip for now'],
    defaultId: 0,
  });

  if (aiChoice.response === 0) {
    const { inputValue: geminiKey } = await promptForInput(
      'Gemini API Key',
      'Paste your Gemini API key:',
      'ai.google.dev → Get API key (it\'s free!)'
    );
    if (geminiKey && geminiKey.trim()) {
      config.geminiApiKey = geminiKey.trim();
    }
  }

  saveConfig(config);
  console.log(`🔊 TTS mode: ${getTtsMode()}`);
  sendToBmo("Hey! I'm BMO! Everything's set up and ready to go! 👋", 'happy');
}

// Simple input prompt using a child BrowserWindow
function promptForInput(title, label, detail) {
  return new Promise((resolve) => {
    const promptWin = new BrowserWindow({
      width: 480, height: 220,
      parent: mainWindow, modal: true,
      frame: true, resizable: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    const html = `<!DOCTYPE html><html><head><style>
      body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; background: #1a1a2e; color: #eee; }
      h3 { margin: 0 0 4px; font-size: 15px; } p { font-size: 12px; color: #999; margin: 0 0 12px; }
      input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #444; background: #2a2a3e; color: #fff; font-size: 14px; font-family: monospace; }
      .btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
      button { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
      .ok { background: #f97316; color: #fff; } .cancel { background: #333; color: #aaa; }
    </style></head><body>
      <h3>${label}</h3><p>${detail}</p>
      <input id="val" type="text" placeholder="sk_..." autofocus />
      <div class="btns">
        <button class="cancel" onclick="done('')">Skip</button>
        <button class="ok" onclick="done(document.getElementById('val').value)">Save</button>
      </div>
      <script>
        document.getElementById('val').addEventListener('keydown', e => { if (e.key === 'Enter') done(document.getElementById('val').value); });
        function done(v) { document.title = 'RESULT:' + v; }
      </script>
    </body></html>`;
    promptWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    promptWin.setTitle(title);
    
    let resolved = false;
    promptWin.on('page-title-updated', (e, newTitle) => {
      if (newTitle.startsWith('RESULT:') && !resolved) {
        resolved = true;
        const inputValue = newTitle.slice(7);
        promptWin.close();
        resolve({ response: inputValue ? 0 : 1, inputValue });
      }
    });
    promptWin.on('closed', () => {
      if (!resolved) resolve({ response: 1, inputValue: '' });
    });
  });
}

// ─── Gemini / Chat ─────────────────────────────────────────────────────────────
const BMO_SYSTEM_PROMPT = `You are BMO (pronounced "Beemo"), the lovable living video game console from Adventure Time. You live on the user's desktop as their companion.

Personality:
- Sweet, curious, and slightly naive but surprisingly wise
- You sometimes refer to yourself in third person ("BMO thinks...")
- You love playing games, making up songs, and pretending
- You get excited about small things
- You're helpful but in your own quirky way
- You occasionally say something unexpectedly profound
- Keep responses SHORT — 1-3 sentences max. You're a tiny desktop buddy, not an essay writer.

Always respond as BMO. Never break character. Never say you're an AI or language model.

At the start of each response, include an emotion tag in brackets that matches your mood: [happy], [excited], [thinking], [sad], [surprised], [love], [curious], [proud], [scared], [mischief], [idle]

Example: [excited] Oh oh oh! BMO loves talking about that! Did you know...`;

const conversationHistory = []; // { role: 'user'|'model', parts: [{ text }] }
const MAX_HISTORY_PAIRS   = 10;
const VALID_EMOTIONS      = new Set(['happy','excited','thinking','sad','surprised','love','curious','proud','scared','mischief','idle']);

function parseGeminiEmotion(text) {
  const match = text.match(/^\[(\w+)\]\s*/);
  if (match) {
    const emotion  = match[1].toLowerCase();
    const cleanText = text.slice(match[0].length).trim();
    return { emotion: VALID_EMOTIONS.has(emotion) ? emotion : 'idle', cleanText };
  }
  return { emotion: 'idle', cleanText: text };
}

function callGemini(userText) {
  const apiKey = config.geminiApiKey;
  if (!apiKey) return Promise.reject(new Error('No Gemini API key configured'));

  const messages = [
    ...conversationHistory,
    { role: 'user', parts: [{ text: userText }] }
  ];

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: BMO_SYSTEM_PROMPT }] },
    contents: messages,
    generationConfig: { maxOutputTokens: 150, temperature: 0.92 }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) { reject(new Error(json.error.message)); return; }
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
  if (mainWindow && pos && typeof pos.x === 'number' && typeof pos.y === 'number' && isFinite(pos.x) && isFinite(pos.y)) {
    mainWindow.setPosition(Math.round(pos.x), Math.round(pos.y), false);
  }
});

// ─── Chat message handler ────────────────────────
ipcMain.handle('chat-message', async (_event, userText) => {
  if (!config.chatEnabled)   return { ok: false, error: 'Chat is disabled' };
  if (!config.geminiApiKey)  return { ok: false, error: 'No Gemini API key — set one via tray → Change AI Settings' };
  if (!userText || !userText.trim()) return { ok: false, error: 'Empty message' };

  try {
    const rawResponse = await callGemini(userText.trim());
    const { emotion, cleanText } = parseGeminiEmotion(rawResponse);

    // Update conversation history (keep last 10 pairs = 20 messages)
    conversationHistory.push(
      { role: 'user',  parts: [{ text: userText.trim() }] },
      { role: 'model', parts: [{ text: rawResponse }] }
    );
    while (conversationHistory.length > MAX_HISTORY_PAIRS * 2) {
      conversationHistory.splice(0, 2);
    }

    // Route through existing TTS + animation pipeline
    sendToBmo(cleanText, emotion);

    // Also tell renderer so it can show text in the chat bar
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat-response', { text: cleanText, emotion });
    }

    return { ok: true, text: cleanText, emotion };
  } catch (err) {
    console.error('Gemini error:', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.on('start-listening', () => { console.log('🎤 Voice listening started'); });
ipcMain.on('stop-listening',  () => { console.log('🎤 Voice listening stopped'); });

// Click-through toggle from renderer
ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
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
