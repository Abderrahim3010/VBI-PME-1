const electronProcessStartedAt = process.hrtime.bigint();
const { app, BrowserWindow, Menu, ipcMain, dialog, screen } = require('electron');
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
  getPerformanceDiagnosticsSnapshot,
  exportBackup,
  restoreBackup,
  getDefaultBackupName,
  saveSalesReservationState
} = require('./db/database.cjs');
const {
  createPerformanceDiagnostics,
  elapsedMs
} = require('./performanceDiagnostics.cjs');

const hardwareAccelerationDisabled =
  process.env.VBI_DISABLE_HARDWARE_ACCELERATION === '1';
const performanceDiagnosticsEnabled =
  process.env.VBI_PERF_DIAGNOSTICS === '1';

// Diagnostic escape hatch for problematic store-PC GPU drivers.
if (hardwareAccelerationDisabled) {
  app.disableHardwareAcceleration();
}

app.setName('VBI PME');

if (
  typeof process.env.VBI_DIAGNOSTIC_USER_DATA_DIR === 'string' &&
  process.env.VBI_DIAGNOSTIC_USER_DATA_DIR.trim()
) {
  app.setPath(
    'userData',
    path.resolve(process.env.VBI_DIAGNOSTIC_USER_DATA_DIR.trim())
  );
}

const performanceDiagnostics = createPerformanceDiagnostics({
  app,
  appStartNs: electronProcessStartedAt,
  hardwareAccelerationDisabled,
  enabled: performanceDiagnosticsEnabled
});

// Performance Tune: Optimize memory & rendering operations
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-oop-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-background-timer-throttled-processes');

let mainWindow;

function serializedBytes(value) {
  return typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : 0;
}

function safeArrayItemCount(value) {
  if (typeof value !== 'string' || !value.trimStart().startsWith('[')) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

function registerDbIpcHandlers() {
  ipcMain.handle('vbi-db:save-sales-reservation-state', (_event, payload) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid sales reservation payload');
    }

    const required = ['products', 'openDrafts'];
    const optional = ['sales', 'clients'];
    for (const key of required) {
      if (typeof payload[key] !== 'string') {
        throw new Error(`Invalid sales reservation ${key} payload`);
      }
    }
    for (const key of optional) {
      if (payload[key] !== undefined && typeof payload[key] !== 'string') {
        throw new Error(`Invalid sales reservation ${key} payload`);
      }
    }

    for (const key of [...required, ...optional]) {
      if (payload[key] !== undefined && !Array.isArray(JSON.parse(payload[key]))) {
        throw new Error(`Sales reservation ${key} must be a JSON array`);
      }
    }
    if (!performanceDiagnostics.enabled) {
      return saveSalesReservationState(payload);
    }

    const startedAt = process.hrtime.bigint();
    const result = saveSalesReservationState(payload);
    const durationMs = elapsedMs(startedAt);
    const entries = [
      ['compos_products', payload.products],
      ['sales_open_drafts', payload.openDrafts],
      ...(payload.sales !== undefined ? [['compos_sales', payload.sales]] : []),
      ...(payload.clients !== undefined ? [['compos_clients', payload.clients]] : [])
    ];
    entries.forEach(([key, value], index) => {
      performanceDiagnostics.recordSqliteWrite({
        operation: 'saveSalesReservationState',
        key,
        durationMs: index === 0 ? durationMs : 0,
        serializedBytes: serializedBytes(value),
        itemCount: safeArrayItemCount(value)
      });
    });
    return result;
  });

  ipcMain.handle('vbi-db:get-all-data', (_event, keys) => {
    if (!performanceDiagnostics.enabled) return getAllData(keys);

    const startedAt = process.hrtime.bigint();
    const data = getAllData(keys);
    performanceDiagnostics.recordSqliteRead({
      operation: 'getAllData',
      durationMs: elapsedMs(startedAt),
      requestedKeyCount: Array.isArray(keys) ? keys.length : null,
      returnedKeyCount: Object.keys(data).length,
      serializedBytes: Object.values(data).reduce(
        (total, value) => total + serializedBytes(value),
        0
      )
    });
    return data;
  });

  ipcMain.handle('vbi-db:get-data', (_event, key) => {
    if (!performanceDiagnostics.enabled) return getData(key);

    const startedAt = process.hrtime.bigint();
    const value = getData(key);
    performanceDiagnostics.recordSqliteRead({
      operation: 'getData',
      durationMs: elapsedMs(startedAt),
      requestedKeyCount: 1,
      returnedKeyCount: value === null ? 0 : 1,
      serializedBytes: serializedBytes(value)
    });
    return value;
  });

  ipcMain.handle('vbi-db:save-data', (_event, key, value) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new Error('Invalid SQLite key-value payload');
    }
    if (!performanceDiagnostics.enabled) return saveData(key, value);

    const startedAt = process.hrtime.bigint();
    const result = saveData(key, value);
    performanceDiagnostics.recordSqliteWrite({
      operation: 'saveData',
      key,
      durationMs: elapsedMs(startedAt),
      serializedBytes: serializedBytes(value),
      itemCount: safeArrayItemCount(value)
    });
    return result;
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

  if (performanceDiagnostics.enabled) {
    performanceDiagnostics.registerIpc(
      ipcMain,
      () => getPerformanceDiagnosticsSnapshot()
    );
  }
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
  if (performanceDiagnostics.enabled) {
    performanceDiagnostics.recordTiming(
      'electron.renderer_load_started',
      elapsedMs(electronProcessStartedAt),
      { measurement: 'since-process-start' }
    );
  }
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (!performanceDiagnostics.enabled) return;
    performanceDiagnostics.recordTiming(
      'electron.renderer_did_finish_load',
      elapsedMs(electronProcessStartedAt),
      { measurement: 'since-process-start' }
    );
  });

  mainWindow.once('ready-to-show', () => {
    if (performanceDiagnostics.enabled) {
      performanceDiagnostics.recordTiming(
        'electron.ready_to_show',
        elapsedMs(electronProcessStartedAt),
        { measurement: 'since-process-start' }
      );
    }
    mainWindow.show();

    if (performanceDiagnostics.enabled) {
      void performanceDiagnostics.collectSystemSnapshot(mainWindow, screen);
    }
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
    if (performanceDiagnostics.enabled) {
      performanceDiagnostics.recordTiming(
        'electron.application_initialization',
        elapsedMs(electronProcessStartedAt),
        { measurement: 'process-start-to-app-ready' }
      );
    }

    const databaseInitialization = initializeDatabase(
      app.getPath('userData'),
      performanceDiagnostics.enabled
    );
    if (performanceDiagnostics.enabled && databaseInitialization.timings) {
      performanceDiagnostics.recordTiming(
        'sqlite.database_open',
        databaseInitialization.timings.databaseOpenMs
      );
      performanceDiagnostics.recordTiming(
        'sqlite.database_migration',
        databaseInitialization.timings.migrationMs
      );
      performanceDiagnostics.recordTiming(
        'sqlite.database_initialization',
        databaseInitialization.timings.totalMs
      );
      performanceDiagnostics.setDatabaseSnapshot(
        getPerformanceDiagnosticsSnapshot()
      );
      console.log(
        `[VBI PERF] Report file: ${performanceDiagnostics.getReportPath()}`
      );
    }
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
