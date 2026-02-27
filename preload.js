const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const MESSAGES_FILE = path.join(__dirname, 'messages.json');

contextBridge.exposeInMainWorld('joemac', {
  // Listen for new messages pushed from main process
  onMessage: (callback) => {
    ipcRenderer.on('new-message', (_event, msg) => callback(msg));
  },

  // Remove message listener
  offMessage: (callback) => {
    ipcRenderer.removeListener('new-message', callback);
  },

  // Write a message to the messages file (for test triggers)
  sendMessage: (text, emotion = 'idle') => {
    const msg = { text, emotion, timestamp: Date.now() };
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msg, null, 2));
  },

  // Get messages file path
  getMessagesPath: () => ipcRenderer.invoke('get-messages-path'),

  // Read audio file as base64 data URL
  readAudioFile: (filePath) => {
    try {
      const data = fs.readFileSync(filePath);
      return 'data:audio/mpeg;base64,' + data.toString('base64');
    } catch (e) {
      console.error('Failed to read audio:', e.message);
      return null;
    }
  },

  // Platform info
  platform: process.platform,

  // Window physics
  getWindowPos: () => ipcRenderer.invoke('get-window-pos'),
  setWindowPos: (x, y) => ipcRenderer.send('set-window-pos', { x, y }),
  getScreenBounds: () => ipcRenderer.invoke('get-screen-bounds'),
  startDrag: () => ipcRenderer.send('start-manual-drag'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),

  // ─── Chat / AI ────────────────────────────────────────────────────────────
  // Send a chat message to Gemini, returns { ok, text, emotion, error }
  sendChatMessage: (text) => ipcRenderer.invoke('chat-message', text),

  // Listen for BMO's chat response (stripped of emotion tag)
  onChatResponse: (callback) => {
    ipcRenderer.on('chat-response', (_event, data) => callback(data));
  },

  // Voice input
  startListening: () => ipcRenderer.send('start-listening'),
  stopListening:  () => { ipcRenderer.send('stop-listening'); ipcRenderer.send('voice-ended'); },
  sendVoiceAudio: (base64) => ipcRenderer.invoke('voice-audio', base64),

  // Global hotkey hold-to-talk
  onToggleVoice: (callback) => {
    ipcRenderer.on('toggle-voice', () => callback());
  },
  onVoiceStart: (callback) => {
    ipcRenderer.on('voice-start', () => callback());
  },
  onVoiceStop: (callback) => {
    ipcRenderer.on('voice-stop', () => callback());
  },
});
