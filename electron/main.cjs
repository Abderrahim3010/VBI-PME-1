const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const {
  initializeDatabase,
  getData,
  getAllData,
  saveData,
  deleteData,
  getMeta,
  setMeta,
  getDatabaseInfo,
  exportBackup,
  restoreBackup,
  getDefaultBackupName
} = require('./db/database.cjs');

app.setName('VBI PME');

// Performance Tune: Optimize memory & rendering operations
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-oop-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-background-timer-throttled-processes');

let mainWindow;

function registerDbIpcHandlers() {
  ipcMain.handle('vbi-db:get-all-data', (_event, keys) => {
    return getAllData(keys);
  });

  ipcMain.handle('vbi-db:get-data', (_event, key) => {
    return getData(key);
  });

  ipcMain.handle('vbi-db:save-data', (_event, key, value) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new Error('Invalid SQLite key-value payload');
    }
    return saveData(key, value);
  });

  ipcMain.handle('vbi-db:delete-data', (_event, key) => {
    if (typeof key !== 'string') {
      throw new Error('Invalid SQLite delete key');
    }
    return deleteData(key);
  });

  ipcMain.handle('vbi-db:get-meta', (_event, key) => {
    return getMeta(key);
  });

  ipcMain.handle('vbi-db:set-meta', (_event, key, value) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new Error('Invalid SQLite meta payload');
    }
    return setMeta(key, value);
  });

  ipcMain.handle('vbi-db:get-database-info', () => {
    try {
      return { success: true, data: getDatabaseInfo() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('vbi-db:export-backup', async () => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Créer une sauvegarde VBI PME',
        defaultPath: getDefaultBackupName(),
        filters: [
          { name: 'SQLite database', extensions: ['sqlite'] },
          { name: 'All files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      const backup = exportBackup(result.filePath);
      return { success: true, path: backup.path, size: backup.size };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('vbi-db:restore-backup', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Restaurer une sauvegarde VBI PME',
        properties: ['openFile'],
        filters: [
          { name: 'SQLite database', extensions: ['sqlite', 'db', 'sqlite3'] }
        ]
      });

      if (result.canceled || !result.filePaths?.[0]) {
        return { success: false, canceled: true };
      }

      const restore = restoreBackup(result.filePaths[0]);
      return {
        success: true,
        restoredFrom: restore.restoredFrom,
        safetyBackupPath: restore.safetyBackupPath,
        requiresRestart: restore.requiresRestart
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    title: "VBI PME",
    icon: path.join(__dirname, '../public/favicon.ico'), // Fallback if present
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Prevents lagging when window is in background
      spellcheck: false
    },
    show: false // Wait for ready-to-show to prevent white screens / flickering
  });

  // Load the built index.html from dist
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Disable default menu for a clean client experience (or create custom compact menu)
  Menu.setApplicationMenu(null);
}

// Ensure single instance lock for better performance & robustness
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    initializeDatabase(app.getPath('userData'));
    registerDbIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
