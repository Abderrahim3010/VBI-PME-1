const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrations.cjs');

let db;
let dbPath;
let currentUserDataPath;

function nowIso() {
  return new Date().toISOString();
}

function timestampForFile() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${hh}${min}`;
}

function ensureInitialized() {
  if (!db) {
    throw new Error('SQLite database is not initialized');
  }
}

function initializeDatabase(userDataPath) {
  if (db) return { dbPath };

  currentUserDataPath = userDataPath;
  fs.mkdirSync(userDataPath, { recursive: true });
  dbPath = path.join(userDataPath, 'VBI-PME.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  return { dbPath };
}

function getData(key) {
  ensureInitialized();
  const row = db.prepare('SELECT value FROM app_data WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getAllData(keys) {
  ensureInitialized();
  const rows = Array.isArray(keys) && keys.length > 0
    ? db.prepare(`SELECT key, value FROM app_data WHERE key IN (${keys.map(() => '?').join(',')})`).all(...keys)
    : db.prepare('SELECT key, value FROM app_data').all();

  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function saveData(key, value) {
  ensureInitialized();
  db.prepare(`
    INSERT INTO app_data (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, nowIso());
  return true;
}

function deleteData(key) {
  ensureInitialized();
  db.prepare('DELETE FROM app_data WHERE key = ?').run(key);
  return true;
}

function getMeta(key) {
  ensureInitialized();
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  ensureInitialized();
  db.prepare(`
    INSERT INTO app_meta (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, nowIso());
  return true;
}

function getDatabaseInfo() {
  ensureInitialized();
  return {
    dbPath,
    exists: fs.existsSync(dbPath),
    size: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
  };
}

function exportBackup(destinationPath) {
  ensureInitialized();
  if (!fs.existsSync(dbPath)) {
    throw new Error('SQLite database file does not exist');
  }
  if (!destinationPath) {
    throw new Error('Backup destination path is required');
  }

  db.pragma('wal_checkpoint(TRUNCATE)');
  fs.copyFileSync(dbPath, destinationPath);
  return {
    path: destinationPath,
    size: fs.statSync(destinationPath).size
  };
}

function verifySqliteFile(filePath) {
  const allowedExtensions = new Set(['.sqlite', '.db', '.sqlite3']);
  const ext = path.extname(filePath).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    throw new Error('Selected file must have a .sqlite, .db, or .sqlite3 extension');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('Selected backup file does not exist');
  }

  let candidate;
  try {
    candidate = new Database(filePath, { readonly: true, fileMustExist: true });
    const tables = candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('app_data', 'app_meta')").all();
    if (!tables.some((table) => table.name === 'app_data')) {
      throw new Error('Selected SQLite file is not a VBI PME backup');
    }
  } finally {
    if (candidate) candidate.close();
  }
}

function restoreBackup(sourcePath) {
  ensureInitialized();
  verifySqliteFile(sourcePath);
  if (!fs.existsSync(dbPath)) {
    throw new Error('Current SQLite database file does not exist');
  }

  const safetyBackupPath = path.join(
    path.dirname(dbPath),
    `VBI-PME-before-restore-${timestampForFile()}.sqlite`
  );

  db.pragma('wal_checkpoint(TRUNCATE)');
  fs.copyFileSync(dbPath, safetyBackupPath);

  try {
    db.close();
    db = undefined;
    fs.copyFileSync(sourcePath, dbPath);
    initializeDatabase(currentUserDataPath || path.dirname(dbPath));
  } catch (error) {
    try {
      if (fs.existsSync(safetyBackupPath)) {
        fs.copyFileSync(safetyBackupPath, dbPath);
      }
      initializeDatabase(currentUserDataPath || path.dirname(dbPath));
    } catch (rollbackError) {
      throw new Error(`Restore failed and rollback also failed: ${rollbackError.message}`);
    }
    throw error;
  }

  return {
    restoredFrom: sourcePath,
    safetyBackupPath,
    requiresRestart: true
  };
}

function getDefaultBackupName() {
  return `VBI-PME-backup-${timestampForFile()}.sqlite`;
}

module.exports = {
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
};
