const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const MESSAGES_FILE = path.join(__dirname, 'messages.json');

let mainWindow = null;
let tray = null;
let messageWatcher = null;

// Ensure messages.json exists
if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify({ text: '', emotion: 'idle', timestamp: 0 }));
}

function createTrayIcon() {
  // Create a simple 16x16 teal square as tray icon (canvas-free fallback)
  const iconPath = path.join(__dirname, 'renderer', 'tray-icon.png');

  // Use nativeImage to create a small colored icon
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // Fallback: empty 16x16 icon
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('JoeMac Avatar');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'JoeMac Avatar',
      enabled: false
    },
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
      label: 'Send Test Message',
      click: () => {
        const msg = {
          text: "Hey! I'm JoeMac 👋",
          emotion: 'happy',
          timestamp: Date.now()
        };
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msg, null, 2));
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Click tray icon to toggle window
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
    alwaysOnTop: true,
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

  // Watch messages file
  startMessageWatcher();
}

function startMessageWatcher() {
  if (messageWatcher) {
    messageWatcher.close();
  }

  let debounceTimer = null;

  messageWatcher = fs.watch(MESSAGES_FILE, (eventType) => {
    if (eventType === 'change') {
      // Debounce to avoid double-fires
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          const raw = fs.readFileSync(MESSAGES_FILE, 'utf8');
          const msg = JSON.parse(raw);
          if (mainWindow && msg.text && msg.timestamp > 0) {
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

// IPC: renderer can request window drag
ipcMain.on('start-drag', () => {
  // Drag is handled via -webkit-app-region in CSS
});

// IPC: renderer requests current messages file path
ipcMain.handle('get-messages-path', () => MESSAGES_FILE);

app.whenReady().then(() => {
  createWindow();
  createTrayIcon();

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
  if (messageWatcher) {
    messageWatcher.close();
    messageWatcher = null;
  }
});
