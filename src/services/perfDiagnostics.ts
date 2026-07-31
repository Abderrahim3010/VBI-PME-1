type RenderDetails = {
  instanceId?: string;
  isOpen?: boolean;
  isMinimized?: boolean;
};

type TimingDetails = Record<string, string | number | boolean | null>;

type ActivityUpdate = {
  hydration?: boolean;
  persistence?: boolean;
  lastOpenedWindow?: string | null;
};

type PerfRecorder = {
  render: (component: string, details?: RenderDetails) => void;
  timing: (stage: string, durationMs: number, details?: TimingDetails) => void;
  storageRead: (
    key: string,
    serializedBytes: number,
    parseDurationMs: number,
    itemCount: number | null,
    parseFailed: boolean,
    source: 'sqlite' | 'localStorage' | 'fallback'
  ) => void;
  persistenceWrite: (
    layer: string,
    key: string,
    serializedBytes: number,
    durationMs: number,
    unchanged?: boolean
  ) => void;
  interaction: (type: string, windowId?: string | null) => void;
  setOpenWindows: (windowIds: string[]) => void;
  setActivity: (update: ActivityUpdate) => void;
  appMounted: (view: 'login' | 'desktop') => void;
  flush: () => Promise<unknown>;
};

type VbiPerfBridge = {
  enabled: true;
  hardwareAccelerationDisabled: boolean;
  updateSnapshot: (snapshot: unknown) => void;
  flushReport: () => Promise<unknown>;
};

declare global {
  interface Window {
    vbiPerf?: VbiPerfBridge;
    __vbiPerfRecorder?: PerfRecorder;
  }
}

const MAX_TIMINGS = 200;
const MAX_LONG_TASKS = 100;
const MAX_LAYOUT_SHIFTS = 100;
const MAX_INTERACTIONS = 200;
const MAX_IDLE_SAMPLES = 10;
const IDLE_SAMPLE_MS = 60_000;

const bridge = window.vbiPerf;
const installedAt = performance.now();
const encoder = new TextEncoder();
const timings: Array<Record<string, unknown>> = [];
const longTasks: Array<Record<string, unknown>> = [];
const layoutShifts: Array<Record<string, unknown>> = [];
const interactions: Array<Record<string, unknown>> = [];
const idleSamples: Array<Record<string, unknown>> = [];
const storageReads = new Map<string, Record<string, unknown>>();
const persistenceWrites = new Map<string, {
  layer: string;
  key: string;
  count: number;
  unchangedCount: number;
  totalBytes: number;
  totalDurationMs: number;
  maxDurationMs: number;
}>();
const renderCounts = new Map<string, {
  component: string;
  instanceId: string | null;
  count: number;
  hiddenRenderCount: number;
}>();
const resourceStats = new Map<string, {
  origin: string;
  initiatorType: string;
  count: number;
  totalDurationMs: number;
  transferBytes: number;
  decodedBodyBytes: number;
  errorCount: number;
}>();

let openWindows: string[] = [];
let hydrationActive = false;
let persistenceDepth = 0;
let lastOpenedWindow: string | null = null;
let snapshotTimer: number | null = null;
let idleTimer: number | null = null;
let idleBaseline = {
  renderCount: 0,
  writeCount: 0,
  startedAt: performance.now(),
  rendersByComponent: new Map<string, number>(),
  writesByKey: new Map<string, number>()
};
let appMountRecorded = false;

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

function totalRenderCount(): number {
  let total = 0;
  renderCounts.forEach((entry) => {
    total += entry.count;
  });
  return total;
}

function totalWriteCount(): number {
  let total = 0;
  persistenceWrites.forEach((entry) => {
    total += entry.count;
  });
  return total;
}

function mapValues<T>(map: Map<string, T>): T[] {
  return Array.from(map.values());
}

function renderCountSnapshot(): Map<string, number> {
  const result = new Map<string, number>();
  renderCounts.forEach((entry, key) => {
    result.set(key, entry.count);
  });
  return result;
}

function writeCountSnapshot(): Map<string, number> {
  const result = new Map<string, number>();
  persistenceWrites.forEach((entry, key) => {
    result.set(key, entry.count);
  });
  return result;
}

function snapshot() {
  return {
    clock: 'Renderer performance.now, milliseconds since navigation start',
    diagnosticStartedAtMs: roundMs(installedAt),
    developmentMode: window.location.protocol === 'http:' || window.location.protocol === 'https:',
    reactStrictMode: true,
    hardwareAccelerationDisabled: Boolean(bridge?.hardwareAccelerationDisabled),
    currentState: {
      hydrationActive,
      persistenceActive: persistenceDepth > 0,
      openWindows,
      lastOpenedWindow
    },
    timings,
    storage: {
      keyReads: mapValues(storageReads),
      writes: mapValues(persistenceWrites)
    },
    renders: mapValues(renderCounts),
    longTasks,
    layoutShifts,
    interactions,
    idleSamples,
    remoteResources: mapValues(resourceStats)
  };
}

function sendSnapshot() {
  if (!bridge) return;
  if (snapshotTimer !== null) {
    window.clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
  bridge.updateSnapshot(snapshot());
}

function scheduleSnapshot() {
  if (!bridge || snapshotTimer !== null) return;
  snapshotTimer = window.setTimeout(() => {
    snapshotTimer = null;
    sendSnapshot();
  }, 500);
}

function recordTiming(stage: string, durationMs: number, details: TimingDetails = {}) {
  timings.push({
    stage: stage.slice(0, 120),
    durationMs: roundMs(durationMs),
    ...details
  });
  if (timings.length > MAX_TIMINGS) {
    timings.splice(0, timings.length - MAX_TIMINGS);
  }
  scheduleSnapshot();
}

function recordRender(component: string, details: RenderDetails = {}) {
  const instanceId = details.instanceId?.slice(0, 80) ?? null;
  const key = instanceId ? `${component}:${instanceId}` : component;
  const existing = renderCounts.get(key) ?? {
    component: component.slice(0, 100),
    instanceId,
    count: 0,
    hiddenRenderCount: 0
  };
  existing.count += 1;
  if (details.isOpen === false || details.isMinimized === true) {
    existing.hiddenRenderCount += 1;
  }
  renderCounts.set(key, existing);
  scheduleSnapshot();
}

function recordStorageRead(
  key: string,
  serializedBytes: number,
  parseDurationMs: number,
  itemCount: number | null,
  parseFailed: boolean,
  source: 'sqlite' | 'localStorage' | 'fallback'
) {
  storageReads.set(key, {
    key: key.slice(0, 120),
    serializedBytes,
    parseDurationMs: roundMs(parseDurationMs),
    itemCount,
    parseFailed,
    source,
    aboveOneMiB: serializedBytes > 1024 * 1024
  });
  scheduleSnapshot();
}

function recordPersistenceWrite(
  layer: string,
  key: string,
  serializedBytes: number,
  durationMs: number,
  unchanged = false
) {
  const id = `${layer}:${key}`;
  const existing = persistenceWrites.get(id) ?? {
    layer: layer.slice(0, 80),
    key: key.slice(0, 120),
    count: 0,
    unchangedCount: 0,
    totalBytes: 0,
    totalDurationMs: 0,
    maxDurationMs: 0
  };
  existing.count += 1;
  existing.unchangedCount += unchanged ? 1 : 0;
  existing.totalBytes += serializedBytes;
  existing.totalDurationMs = roundMs(existing.totalDurationMs + durationMs);
  existing.maxDurationMs = Math.max(existing.maxDurationMs, roundMs(durationMs));
  persistenceWrites.set(id, existing);
  scheduleSnapshot();
}

function windowIdForTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const windowElement = target.closest<HTMLElement>('[id^="window-"]');
  return windowElement?.id.replace(/^window-/, '').slice(0, 80) ?? null;
}

function recordInteraction(type: string, windowId: string | null = null) {
  interactions.push({
    type: type.slice(0, 80),
    windowId: windowId?.slice(0, 80) ?? null,
    atMs: roundMs(performance.now()),
    renderCountTotal: totalRenderCount(),
    persistenceWriteCountTotal: totalWriteCount()
  });
  if (interactions.length > MAX_INTERACTIONS) {
    interactions.splice(0, interactions.length - MAX_INTERACTIONS);
  }
  resetIdleTimer();
  scheduleSnapshot();
}

function resetIdleTimer() {
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleBaseline = {
    renderCount: totalRenderCount(),
    writeCount: totalWriteCount(),
    startedAt: performance.now(),
    rendersByComponent: renderCountSnapshot(),
    writesByKey: writeCountSnapshot()
  };
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    const renderDeltas = mapValues(renderCounts)
      .map((entry) => {
        const key = entry.instanceId
          ? `${entry.component}:${entry.instanceId}`
          : entry.component;
        return {
          component: entry.component,
          instanceId: entry.instanceId,
          renderCount: entry.count - (idleBaseline.rendersByComponent.get(key) ?? 0)
        };
      })
      .filter((entry) => entry.renderCount > 0);
    const writeDeltas = mapValues(persistenceWrites)
      .map((entry) => {
        const key = `${entry.layer}:${entry.key}`;
        return {
          layer: entry.layer,
          key: entry.key,
          writeCount: entry.count - (idleBaseline.writesByKey.get(key) ?? 0)
        };
      })
      .filter((entry) => entry.writeCount > 0);
    idleSamples.push({
      durationMs: roundMs(performance.now() - idleBaseline.startedAt),
      renderCount: totalRenderCount() - idleBaseline.renderCount,
      persistenceWriteCount: totalWriteCount() - idleBaseline.writeCount,
      openWindows,
      renderDeltas,
      writeDeltas
    });
    if (idleSamples.length > MAX_IDLE_SAMPLES) {
      idleSamples.splice(0, idleSamples.length - MAX_IDLE_SAMPLES);
    }
    scheduleSnapshot();
    void bridge?.flushReport();
  }, IDLE_SAMPLE_MS);
}

function setOpenWindows(nextWindowIds: string[]) {
  const sanitized = nextWindowIds.map((id) => id.slice(0, 80)).sort();
  const previous = new Set(openWindows);
  const newlyOpened = sanitized.filter((id) => !previous.has(id));
  openWindows = sanitized;
  if (newlyOpened.length > 0) {
    lastOpenedWindow = newlyOpened[newlyOpened.length - 1];
    recordInteraction('window-opened', lastOpenedWindow);
  } else {
    scheduleSnapshot();
  }
}

function setActivity(update: ActivityUpdate) {
  if (typeof update.hydration === 'boolean') {
    hydrationActive = update.hydration;
  }
  if (typeof update.persistence === 'boolean') {
    persistenceDepth = Math.max(0, persistenceDepth + (update.persistence ? 1 : -1));
  }
  if (update.lastOpenedWindow !== undefined) {
    lastOpenedWindow = update.lastOpenedWindow?.slice(0, 80) ?? null;
  }
  scheduleSnapshot();
}

function recordResource(entry: PerformanceResourceTiming) {
  let origin: string;
  try {
    const parsed = new URL(entry.name);
    if (!/^https?:$/.test(parsed.protocol)) return;
    origin = parsed.origin;
  } catch {
    return;
  }

  const initiatorType = entry.initiatorType || 'unknown';
  const key = `${origin}:${initiatorType}`;
  const existing = resourceStats.get(key) ?? {
    origin,
    initiatorType,
    count: 0,
    totalDurationMs: 0,
    transferBytes: 0,
    decodedBodyBytes: 0,
    errorCount: 0
  };
  existing.count += 1;
  existing.totalDurationMs = roundMs(existing.totalDurationMs + entry.duration);
  existing.transferBytes += entry.transferSize || 0;
  existing.decodedBodyBytes += entry.decodedBodySize || 0;
  resourceStats.set(key, existing);
  scheduleSnapshot();
}

function recordRemoteError(event: Event) {
  const target = event.target as (HTMLImageElement | HTMLLinkElement | HTMLScriptElement | null);
  const resource = target && ('src' in target ? target.src : 'href' in target ? target.href : '');
  if (!resource) return;

  try {
    const parsed = new URL(resource);
    if (!/^https?:$/.test(parsed.protocol)) return;
    const key = `${parsed.origin}:error`;
    const existing = resourceStats.get(key) ?? {
      origin: parsed.origin,
      initiatorType: 'error',
      count: 0,
      totalDurationMs: 0,
      transferBytes: 0,
      decodedBodyBytes: 0,
      errorCount: 0
    };
    existing.count += 1;
    existing.errorCount += 1;
    resourceStats.set(key, existing);
    scheduleSnapshot();
  } catch {
    // Ignore malformed resource URLs.
  }
}

function appMounted(view: 'login' | 'desktop') {
  if (appMountRecorded) return;
  appMountRecorded = true;
  recordTiming('renderer.app_first_mount', performance.now(), {
    measurement: 'navigation-start-to-first-effect',
    view
  });

  const markResponsive = () => {
    recordTiming('renderer.application_responsive', performance.now(), {
      measurement: 'navigation-start-to-idle-callback',
      view
    });
    console.info('[VBI PERF] Renderer reached the initial responsive checkpoint.');
    void bridge?.flushReport();
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(markResponsive, { timeout: 2000 });
      } else {
        setTimeout(markResponsive, 0);
      }
    });
  });
}

function installLocalStorageInstrumentation() {
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function instrumentedSetItem(key: string, value: string) {
    if (this !== window.localStorage) {
      return originalSetItem.call(this, key, value);
    }

    const previous = this.getItem(key);
    const startedAt = performance.now();
    const result = originalSetItem.call(this, key, value);
    recordPersistenceWrite(
      'localStorage',
      key,
      byteLength(value),
      performance.now() - startedAt,
      previous === value
    );
    return result;
  };

  Storage.prototype.removeItem = function instrumentedRemoveItem(key: string) {
    if (this !== window.localStorage) {
      return originalRemoveItem.call(this, key);
    }

    const startedAt = performance.now();
    const result = originalRemoveItem.call(this, key);
    recordPersistenceWrite(
      'localStorage.remove',
      key,
      0,
      performance.now() - startedAt
    );
    return result;
  };
}

function installObservers() {
  if (!('PerformanceObserver' in window)) return;

  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration < 50) continue;
        longTasks.push({
          startTimeMs: roundMs(entry.startTime),
          durationMs: roundMs(entry.duration),
          openWindows,
          hydrationActive,
          persistenceActive: persistenceDepth > 0,
          lastOpenedWindow
        });
      }
      if (longTasks.length > MAX_LONG_TASKS) {
        longTasks.splice(0, longTasks.length - MAX_LONG_TASKS);
      }
      scheduleSnapshot();
    });
    longTaskObserver.observe({ type: 'longtask', buffered: true });
  } catch {
    // Long-task observation is not supported by every Electron/Chromium build.
  }

  try {
    performance.getEntriesByType('resource').forEach((entry) => {
      recordResource(entry as PerformanceResourceTiming);
    });
    const resourceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        recordResource(entry as PerformanceResourceTiming);
      });
    });
    resourceObserver.observe({ type: 'resource', buffered: true });
  } catch {
    // Resource timing observation is optional.
  }

  try {
    const layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & {
          value?: number;
          hadRecentInput?: boolean;
        };
        if (layoutShift.hadRecentInput) continue;
        layoutShifts.push({
          startTimeMs: roundMs(layoutShift.startTime),
          score: typeof layoutShift.value === 'number'
            ? Math.round(layoutShift.value * 100000) / 100000
            : null,
          openWindows
        });
      }
      if (layoutShifts.length > MAX_LAYOUT_SHIFTS) {
        layoutShifts.splice(0, layoutShifts.length - MAX_LAYOUT_SHIFTS);
      }
      scheduleSnapshot();
    });
    layoutShiftObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // Layout-shift observation is optional.
  }
}

export function installPerformanceDiagnostics() {
  if (!bridge?.enabled || window.__vbiPerfRecorder) return;

  window.__vbiPerfRecorder = {
    render: recordRender,
    timing: recordTiming,
    storageRead: recordStorageRead,
    persistenceWrite: recordPersistenceWrite,
    interaction: recordInteraction,
    setOpenWindows,
    setActivity,
    appMounted,
    flush: () => bridge.flushReport()
  };

  installLocalStorageInstrumentation();
  installObservers();

  window.addEventListener('pointerdown', (event) => {
    recordInteraction('pointerdown', windowIdForTarget(event.target));
  }, { capture: true, passive: true });
  window.addEventListener('keydown', (event) => {
    recordInteraction('keydown', windowIdForTarget(event.target));
  }, { capture: true });
  window.addEventListener('input', (event) => {
    recordInteraction('input', windowIdForTarget(event.target));
  }, { capture: true });
  window.addEventListener('error', recordRemoteError, true);

  resetIdleTimer();
  recordTiming('renderer.diagnostics_installed', performance.now(), {
    measurement: 'navigation-start-to-diagnostics-install'
  });
  console.info('[VBI PERF] Renderer diagnostics enabled.');
  sendSnapshot();
}

export {};
