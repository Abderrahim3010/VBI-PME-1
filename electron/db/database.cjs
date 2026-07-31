const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrations.cjs');

let db;
let dbPath;
let currentUserDataPath;

function elapsedMs(startNs) {
  return Number(process.hrtime.bigint() - startNs) / 1e6;
}

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

function initializeDatabase(userDataPath, collectTimings = false) {
  if (db) return { dbPath };

  const initializationStartedAt = collectTimings ? process.hrtime.bigint() : null;
  currentUserDataPath = userDataPath;
  fs.mkdirSync(userDataPath, { recursive: true });
  dbPath = path.join(userDataPath, 'VBI-PME.sqlite');

  const databaseOpenStartedAt = collectTimings ? process.hrtime.bigint() : null;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const databaseOpenMs = databaseOpenStartedAt ? elapsedMs(databaseOpenStartedAt) : null;

  const migrationStartedAt = collectTimings ? process.hrtime.bigint() : null;
  runMigrations(db);
  const migrationMs = migrationStartedAt ? elapsedMs(migrationStartedAt) : null;

  return {
    dbPath,
    ...(collectTimings
      ? {
          timings: {
            databaseOpenMs,
            migrationMs,
            totalMs: elapsedMs(initializationStartedAt)
          }
        }
      : {})
  };
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

function saveSalesReservationState(payload) {
  ensureInitialized();
  const entries = [
    ['compos_products', payload.products],
    ['sales_open_drafts', payload.openDrafts]
  ];
  if (payload.sales !== undefined) entries.push(['compos_sales', payload.sales]);
  if (payload.clients !== undefined) entries.push(['compos_clients', payload.clients]);

  const statement = db.prepare(`
    INSERT INTO app_data (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  const saveTransaction = db.transaction((rows) => {
    const updatedAt = nowIso();
    for (const [key, value] of rows) {
      statement.run(key, value, updatedAt);
    }
  });
  saveTransaction(entries);
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

function serializedByteLength(value) {
  return typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : 0;
}

function decodedBase64ByteLength(base64) {
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function dataUrlByteLength(value) {
  if (typeof value !== 'string') return 0;
  const match = value.match(/^data:image\/[^;,]+;base64,([A-Za-z0-9+/=\r\n]+)$/);
  return match ? decodedBase64ByteLength(match[1].replace(/\s/g, '')) : 0;
}

function getPerformanceDiagnosticsSnapshot() {
  ensureInitialized();

  const jsonKeys = new Set([
    'compos_users',
    'compos_transaction_logs',
    'compos_products',
    'compos_clients',
    'compos_suppliers',
    'compos_purchases',
    'compos_sales',
    'purchase_open_drafts',
    'sales_open_drafts',
    'compos_config',
    'compos_familles',
    'compos_supplier_payments',
    'compos_client_payments',
    'compos_manual_cash_logs'
  ]);

  const collectionKeys = {
    productCount: 'compos_products',
    clientCount: 'compos_clients',
    supplierCount: 'compos_suppliers',
    purchaseCount: 'compos_purchases',
    saleCount: 'compos_sales',
    supplierPaymentCount: 'compos_supplier_payments',
    clientPaymentCount: 'compos_client_payments',
    transactionLogCount: 'compos_transaction_logs',
    openPurchaseDraftCount: 'purchase_open_drafts',
    openSalesDraftCount: 'sales_open_drafts'
  };

  const rows = db.prepare('SELECT key, value FROM app_data ORDER BY key').all();
  const parsedByKey = new Map();
  const keyStats = [];
  let totalSerializedBytes = 0;
  let base64ImageCount = 0;
  let totalBase64ImageBytes = 0;
  let largestBase64ImageBytes = 0;

  for (const row of rows) {
    const serializedBytes = serializedByteLength(row.value);
    totalSerializedBytes += serializedBytes;

    let itemCount = null;
    let parseFailed = false;
    if (jsonKeys.has(row.key)) {
      try {
        const parsed = JSON.parse(row.value);
        parsedByKey.set(row.key, parsed);
        if (Array.isArray(parsed)) itemCount = parsed.length;
      } catch {
        parseFailed = true;
      }
    }

    const matches = row.value.matchAll(/data:image\/[^;,]+;base64,([A-Za-z0-9+/=\r\n]+)/g);
    for (const match of matches) {
      const imageBytes = decodedBase64ByteLength(match[1].replace(/\s/g, ''));
      base64ImageCount += 1;
      totalBase64ImageBytes += imageBytes;
      largestBase64ImageBytes = Math.max(largestBase64ImageBytes, imageBytes);
    }

    keyStats.push({
      key: row.key,
      serializedBytes,
      itemCount,
      parseFailed,
      aboveOneMiB: serializedBytes > 1024 * 1024
    });
  }

  const collectionCounts = {};
  for (const [label, key] of Object.entries(collectionKeys)) {
    const parsed = parsedByKey.get(key);
    collectionCounts[label] = Array.isArray(parsed) ? parsed.length : 0;
  }
  collectionCounts.paymentCount =
    collectionCounts.supplierPaymentCount + collectionCounts.clientPaymentCount;

  const config = parsedByKey.get('compos_config');
  const deliveryLogoBytes = dataUrlByteLength(config?.deliveryInfo?.logo);
  const invoiceLogoBytes = dataUrlByteLength(config?.invoiceInfo?.logo);
  const wallpaperBytes = dataUrlByteLength(config?.affichage?.backgroundImage);
  const companyLogoBytes = Math.max(deliveryLogoBytes, invoiceLogoBytes);

  const largestKey = keyStats.reduce(
    (largest, entry) => (!largest || entry.serializedBytes > largest.serializedBytes ? entry : largest),
    null
  );

  const warnings = [];
  for (const entry of keyStats) {
    if (entry.aboveOneMiB) {
      warnings.push({
        type: 'stored-key-above-1MiB',
        key: entry.key,
        serializedBytes: entry.serializedBytes
      });
    }
    if (entry.parseFailed) {
      warnings.push({
        type: 'malformed-json',
        key: entry.key
      });
    }
  }
  if (largestBase64ImageBytes > 500 * 1024) {
    warnings.push({
      type: 'base64-image-above-500KiB',
      serializedBytes: largestBase64ImageBytes
    });
  }
  if (collectionCounts.transactionLogCount > 10000) {
    warnings.push({
      type: 'large-transaction-log',
      itemCount: collectionCounts.transactionLogCount
    });
  }

  return {
    databaseFileBytes: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    walFileBytes: fs.existsSync(`${dbPath}-wal`) ? fs.statSync(`${dbPath}-wal`).size : 0,
    appDataRowCount: rows.length,
    totalSerializedBytes,
    keyStats,
    largestStoredKey: largestKey
      ? {
          key: largestKey.key,
          serializedBytes: largestKey.serializedBytes
        }
      : null,
    collectionCounts,
    base64Images: {
      count: base64ImageCount,
      totalBytes: totalBase64ImageBytes,
      largestBytes: largestBase64ImageBytes,
      companyLogoBytes,
      wallpaperBytes
    },
    warnings
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
  saveSalesReservationState,
  deleteData,
  getMeta,
  setMeta,
  getDatabaseInfo,
  getPerformanceDiagnosticsSnapshot,
  exportBackup,
  restoreBackup,
  getDefaultBackupName
};
