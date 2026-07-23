export const PERSISTENT_STORAGE_KEYS = [
  'compos_clean_v8',
  'compos_users',
  'compos_transaction_logs',
  'compos_products',
  'compos_clients',
  'compos_suppliers',
  'compos_purchases',
  'compos_sales',
  'sales_open_drafts',
  'compos_config',
  'compos_familles',
  'compos_supplier_payments',
  'compos_client_payments',
  'vbi_zoom_mode',
  'vbi_sidebar_open',
  'vbi_theme_mode',
  'achats_top_split_width',
  'achats_bottom_split_width',
  'achats_top_section_height',
  'achats_bottom_section_height'
] as const;

type PersistentKey = typeof PERSISTENT_STORAGE_KEYS[number];
type DataMap = Record<string, string>;

type SalesReservationState = {
  products: unknown[];
  openDrafts: unknown[];
  sales?: unknown[];
  clients?: unknown[];
};

type SerializedSalesReservationState = {
  products: string;
  openDrafts: string;
  sales?: string;
  clients?: string;
};

const SALES_RESERVATION_JOURNAL_KEY = 'sales_reservation_journal';

export type DbOperationResult = {
  success: boolean;
  canceled?: boolean;
  path?: string;
  size?: number;
  error?: string;
  restoredFrom?: string;
  safetyBackupPath?: string;
  requiresRestart?: boolean;
  data?: {
    dbPath: string;
    exists: boolean;
    size: number;
  };
};

declare global {
  interface Window {
    vbiDb?: {
      getAllData: (keys?: string[]) => Promise<DataMap>;
      getData: (key: string) => Promise<string | null>;
      saveData: (key: string, value: string) => Promise<boolean>;
      deleteData: (key: string) => Promise<boolean>;
      getMeta: (key: string) => Promise<string | null>;
      setMeta: (key: string, value: string) => Promise<boolean>;
      getDatabaseInfo: () => Promise<DbOperationResult>;
      exportBackup: () => Promise<DbOperationResult>;
      restoreBackup: () => Promise<DbOperationResult>;
      saveSalesReservationState: (payload: SerializedSalesReservationState) => Promise<boolean>;
    };
  }
}

const MIGRATION_META_KEY = 'localStorage_migration_v1';

function hasBridge() {
  return typeof window !== 'undefined' && !!window.vbiDb;
}

function recoverLocalSalesReservationJournal(): void {
  try {
    const raw = localStorage.getItem(SALES_RESERVATION_JOURNAL_KEY);
    if (!raw) return;

    const journal = JSON.parse(raw) as { values?: Record<string, unknown> };
    const values = journal.values;
    if (!values || typeof values !== 'object') return;

    const allowedKeys = ['compos_products', 'sales_open_drafts', 'compos_sales', 'compos_clients'];
    for (const key of allowedKeys) {
      const value = values[key];
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
      }
    }
    localStorage.removeItem(SALES_RESERVATION_JOURNAL_KEY);
  } catch (error) {
    console.error('[localDb] Sales reservation journal recovery failed:', error instanceof Error ? error.message : String(error));
  }
}

export function getStorageString(key: PersistentKey | string, fallback: string | null = null): string | null {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function getStorageJson<T>(key: PersistentKey | string, fallback: T): T {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveData(key: PersistentKey | string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('[localDb] localStorage mirror save failed:', key, error instanceof Error ? error.message : String(error));
  }

  if (!hasBridge()) return;

  try {
    await window.vbiDb!.saveData(key, value);
  } catch (error) {
    console.error('[localDb] SQLite save failed, localStorage fallback kept:', key, error instanceof Error ? error.message : String(error));
  }
}

export function safeStringify(obj: any, indent?: number): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (value && typeof value === 'object') {
        if (typeof window !== 'undefined' && value === window) {
          return '[Window]';
        }
        if (value.constructor && value.constructor.name === 'Window') {
          return '[Window]';
        }
        if (value instanceof Event || (value.constructor && value.constructor.name.endsWith('Event'))) {
          return '[Event]';
        }
        if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
          return '[HTMLElement]';
        }
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }, indent);
  } catch (err) {
    console.error('[localDb] safeStringify failed, falling back to primitive/error representation', err);
    return '"[Serialization Error]"';
  }
}

export async function saveJson(key: PersistentKey | string, value: unknown): Promise<void> {
  await saveData(key, safeStringify(value));
}

export async function saveSalesReservationState(state: SalesReservationState): Promise<void> {
  const serialized: SerializedSalesReservationState = {
    products: safeStringify(state.products),
    openDrafts: safeStringify(state.openDrafts),
    ...(state.sales ? { sales: safeStringify(state.sales) } : {}),
    ...(state.clients ? { clients: safeStringify(state.clients) } : {})
  };

  const values: Record<string, string> = {
    compos_products: serialized.products,
    sales_open_drafts: serialized.openDrafts,
    ...(serialized.sales ? { compos_sales: serialized.sales } : {}),
    ...(serialized.clients ? { compos_clients: serialized.clients } : {})
  };

  if (hasBridge()) {
    await window.vbiDb!.saveSalesReservationState(serialized);
    try {
      for (const [key, value] of Object.entries(values)) {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('[localDb] Sales reservation localStorage mirror failed:', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  const journal = safeStringify({
    version: 1,
    createdAt: new Date().toISOString(),
    values
  });
  localStorage.setItem(SALES_RESERVATION_JOURNAL_KEY, journal);
  for (const [key, value] of Object.entries(values)) {
    localStorage.setItem(key, value);
  }
  localStorage.removeItem(SALES_RESERVATION_JOURNAL_KEY);
}

export async function getData(key: PersistentKey | string): Promise<string | null> {
  if (hasBridge()) {
    try {
      const value = await window.vbiDb!.getData(key);
      if (value !== null) {
        try {
          localStorage.setItem(key, value);
        } catch {}
      }
      return value;
    } catch (error) {
      console.error('[localDb] SQLite read failed, using localStorage fallback:', key, error instanceof Error ? error.message : String(error));
    }
  }

  return getStorageString(key);
}

export async function loadPersistentData(keys: readonly string[] = PERSISTENT_STORAGE_KEYS): Promise<DataMap> {
  recoverLocalSalesReservationJournal();
  if (hasBridge()) {
    try {
      const data = await window.vbiDb!.getAllData([...keys]);
      Object.entries(data).forEach(([key, value]) => {
        try {
          localStorage.setItem(key, value);
        } catch {}
      });
      return data;
    } catch (error) {
      console.error('[localDb] SQLite bulk load failed, using localStorage fallback:', error instanceof Error ? error.message : String(error));
    }
  }

  return keys.reduce<DataMap>((acc, key) => {
    const value = getStorageString(key);
    if (value !== null) acc[key] = value;
    return acc;
  }, {});
}

export async function migrateLocalStorageToSqlite(keys: readonly string[] = PERSISTENT_STORAGE_KEYS): Promise<void> {
  recoverLocalSalesReservationJournal();
  if (!hasBridge()) return;

  try {
    const completed = await window.vbiDb!.getMeta(MIGRATION_META_KEY);
    if (completed === 'true') return;

    const existingSqliteData = await window.vbiDb!.getAllData([...keys]);
    for (const key of keys) {
      const localValue = getStorageString(key);
      if (localValue !== null && existingSqliteData[key] === undefined) {
        await window.vbiDb!.saveData(key, localValue);
      }
    }

    await window.vbiDb!.setMeta(MIGRATION_META_KEY, 'true');
  } catch (error) {
    console.error('[localDb] localStorage to SQLite migration failed; localStorage left untouched:', error instanceof Error ? error.message : String(error));
  }
}

export async function getDatabaseInfo(): Promise<DbOperationResult> {
  if (!hasBridge()) {
    return { success: false, error: 'SQLite bridge is not available in this environment.' };
  }
  try {
    return await window.vbiDb!.getDatabaseInfo();
  } catch (error) {
    console.error('[localDb] SQLite database info failed:', error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function exportBackup(): Promise<DbOperationResult> {
  if (!hasBridge()) {
    return { success: false, error: 'SQLite backup is only available in the Electron app.' };
  }
  try {
    return await window.vbiDb!.exportBackup();
  } catch (error) {
    console.error('[localDb] SQLite backup export failed:', error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function restoreBackup(): Promise<DbOperationResult> {
  if (!hasBridge()) {
    return { success: false, error: 'SQLite restore is only available in the Electron app.' };
  }
  try {
    return await window.vbiDb!.restoreBackup();
  } catch (error) {
    console.error('[localDb] SQLite restore failed:', error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
