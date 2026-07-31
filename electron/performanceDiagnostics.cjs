const fs = require('fs');
const path = require('path');

const MAX_MAIN_EVENTS = 200;

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function elapsedMs(startNs) {
  return Number(process.hrtime.bigint() - startNs) / 1e6;
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function sanitizeGpuInfo(info) {
  if (!info || typeof info !== 'object') return null;

  const devices = Array.isArray(info.gpuDevice)
    ? info.gpuDevice.slice(0, 4).map((device) => ({
        active: Boolean(device.active),
        vendorId: safeNumber(device.vendorId),
        deviceId: safeNumber(device.deviceId),
        driverVendor: typeof device.driverVendor === 'string' ? device.driverVendor.slice(0, 120) : null,
        driverVersion: typeof device.driverVersion === 'string' ? device.driverVersion.slice(0, 120) : null
      }))
    : [];

  const aux = info.auxAttributes && typeof info.auxAttributes === 'object'
    ? info.auxAttributes
    : {};

  return {
    devices,
    auxAttributes: {
      amdSwitchable: typeof aux.amdSwitchable === 'boolean' ? aux.amdSwitchable : null,
      canSupportThreadedTextureMailbox:
        typeof aux.canSupportThreadedTextureMailbox === 'boolean'
          ? aux.canSupportThreadedTextureMailbox
          : null,
      directRenderingVersion:
        typeof aux.directRenderingVersion === 'string'
          ? aux.directRenderingVersion.slice(0, 120)
          : null,
      glImplementationParts:
        typeof aux.glImplementationParts === 'string'
          ? aux.glImplementationParts.slice(0, 160)
          : null,
      glRenderer:
        typeof aux.glRenderer === 'string' ? aux.glRenderer.slice(0, 200) : null,
      glVendor:
        typeof aux.glVendor === 'string' ? aux.glVendor.slice(0, 160) : null,
      inProcessGpu: typeof aux.inProcessGpu === 'boolean' ? aux.inProcessGpu : null,
      passthroughCmdDecoder:
        typeof aux.passthroughCmdDecoder === 'boolean' ? aux.passthroughCmdDecoder : null,
      sandboxed: typeof aux.sandboxed === 'boolean' ? aux.sandboxed : null
    }
  };
}

function sanitizeRendererSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};

  const serialized = JSON.stringify(snapshot);
  if (Buffer.byteLength(serialized, 'utf8') > 512 * 1024) {
    return { rejected: true, reason: 'Renderer diagnostic snapshot exceeded 512 KiB.' };
  }

  return JSON.parse(serialized);
}

function createPerformanceDiagnostics({
  app,
  appStartNs,
  hardwareAccelerationDisabled,
  enabled
}) {
  if (!enabled) {
    return {
      enabled: false,
      recordTiming() {},
      recordSqliteRead() {},
      recordSqliteWrite() {},
      setDatabaseSnapshot() {},
      registerIpc() {},
      async collectSystemSnapshot() {},
      writeReport() {},
      getReportPath() {
        return null;
      }
    };
  }

  const report = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    applicationVersion: app.getVersion(),
    diagnosticMode: true,
    hardwareAccelerationDisabled,
    startup: {
      clock: 'Electron process.hrtime, milliseconds',
      timings: []
    },
    gpu: {
      featureStatus: null,
      basicInfo: null
    },
    display: null,
    processMemory: {
      main: null,
      renderer: null
    },
    sqlite: {
      reads: [],
      writes: [],
      summary: null
    },
    renderer: {},
    remoteResources: {
      auditedStaticResources: [
        {
          type: 'stylesheet',
          origin: 'https://fonts.googleapis.com',
          purpose: 'Outfit, Plus Jakarta Sans, and JetBrains Mono font CSS'
        },
        {
          type: 'font',
          origin: 'https://fonts.gstatic.com',
          purpose: 'Google Fonts binary files'
        },
        {
          type: 'image',
          origin: 'https://images.unsplash.com',
          purpose: 'Optional built-in configuration wallpaper choices'
        }
      ]
    },
    mainEvents: []
  };

  let reportPath = null;
  let writeTimer = null;

  function log(message, details) {
    if (details === undefined) {
      console.log(`[VBI PERF] ${message}`);
      return;
    }
    console.log(`[VBI PERF] ${message}`, details);
  }

  function ensureReportPath() {
    if (!reportPath) {
      reportPath = path.join(app.getPath('userData'), 'vbi-performance-report.json');
    }
    return reportPath;
  }

  function writeReport() {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }

    try {
      const target = ensureReportPath();
      report.timestamp = new Date().toISOString();
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      return target;
    } catch (error) {
      log('Unable to write diagnostic report.', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  function scheduleWrite() {
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      writeReport();
    }, 1000);
    writeTimer.unref?.();
  }

  function recordTiming(stage, durationMs, details = {}) {
    report.startup.timings.push({
      stage: String(stage).slice(0, 120),
      durationMs: roundMs(durationMs),
      ...details
    });
    if (report.startup.timings.length > MAX_MAIN_EVENTS) {
      report.startup.timings.splice(0, report.startup.timings.length - MAX_MAIN_EVENTS);
    }
    scheduleWrite();
  }

  function recordSqliteRead(entry) {
    report.sqlite.reads.push({
      operation: String(entry.operation).slice(0, 80),
      durationMs: roundMs(entry.durationMs),
      requestedKeyCount: safeNumber(entry.requestedKeyCount),
      returnedKeyCount: safeNumber(entry.returnedKeyCount),
      serializedBytes: safeNumber(entry.serializedBytes)
    });
    if (report.sqlite.reads.length > MAX_MAIN_EVENTS) {
      report.sqlite.reads.splice(0, report.sqlite.reads.length - MAX_MAIN_EVENTS);
    }
    scheduleWrite();
  }

  function recordSqliteWrite(entry) {
    report.sqlite.writes.push({
      operation: String(entry.operation).slice(0, 80),
      key: String(entry.key).slice(0, 120),
      durationMs: roundMs(entry.durationMs),
      serializedBytes: safeNumber(entry.serializedBytes),
      itemCount: safeNumber(entry.itemCount)
    });
    if (report.sqlite.writes.length > MAX_MAIN_EVENTS) {
      report.sqlite.writes.splice(0, report.sqlite.writes.length - MAX_MAIN_EVENTS);
    }
    scheduleWrite();
  }

  function setDatabaseSnapshot(snapshot) {
    report.sqlite.summary = snapshot;
    scheduleWrite();
  }

  async function collectSystemSnapshot(mainWindow, screen) {
    try {
      report.gpu.featureStatus = app.getGPUFeatureStatus();
    } catch (error) {
      report.gpu.featureStatus = { error: error instanceof Error ? error.message : String(error) };
    }

    try {
      report.gpu.basicInfo = sanitizeGpuInfo(await app.getGPUInfo('basic'));
    } catch (error) {
      report.gpu.basicInfo = { error: error instanceof Error ? error.message : String(error) };
    }

    try {
      const display = screen.getPrimaryDisplay();
      report.display = {
        size: {
          width: display.size.width,
          height: display.size.height
        },
        workAreaSize: {
          width: display.workAreaSize.width,
          height: display.workAreaSize.height
        },
        scaleFactor: display.scaleFactor
      };
    } catch (error) {
      report.display = { error: error instanceof Error ? error.message : String(error) };
    }

    try {
      const memory = await process.getProcessMemoryInfo();
      report.processMemory.main = {
        privateKiB: memory.private,
        residentSetKiB: memory.residentSet,
        sharedKiB: memory.shared
      };
    } catch (error) {
      report.processMemory.main = { error: error instanceof Error ? error.message : String(error) };
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        if (typeof mainWindow.webContents.getProcessMemoryInfo === 'function') {
          const memory = await mainWindow.webContents.getProcessMemoryInfo();
          report.processMemory.renderer = {
            privateKiB: memory.private,
            residentSetKiB: memory.residentSet,
            sharedKiB: memory.shared
          };
        } else {
          const rendererPid = mainWindow.webContents.getOSProcessId();
          const rendererMetric = app.getAppMetrics().find(
            (metric) => metric.pid === rendererPid
          );
          report.processMemory.renderer = rendererMetric
            ? {
                privateKiB: rendererMetric.memory.privateBytes,
                residentSetKiB: rendererMetric.memory.workingSetSize,
                sharedKiB: rendererMetric.memory.sharedBytes,
                peakResidentSetKiB: rendererMetric.memory.peakWorkingSetSize
              }
            : { error: 'Renderer process metric was not available.' };
        }
      } catch (error) {
        report.processMemory.renderer = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    report.mainEvents.push({
      type: 'system-snapshot',
      sinceProcessStartMs: roundMs(elapsedMs(appStartNs))
    });
    scheduleWrite();
  }

  function registerIpc(ipcMain, refreshDatabaseSnapshot) {
    ipcMain.on('vbi-perf:renderer-snapshot', (_event, snapshot) => {
      report.renderer = sanitizeRendererSnapshot(snapshot);
      scheduleWrite();
    });

    ipcMain.handle('vbi-perf:flush', async () => {
      if (typeof refreshDatabaseSnapshot === 'function') {
        try {
          report.sqlite.summary = refreshDatabaseSnapshot();
        } catch (error) {
          report.sqlite.summaryError = error instanceof Error ? error.message : String(error);
        }
      }
      return {
        success: Boolean(writeReport()),
        reportPath: ensureReportPath()
      };
    });
  }

  app.once('before-quit', () => {
    writeReport();
  });

  log('Diagnostic mode enabled.');
  scheduleWrite();

  return {
    enabled: true,
    recordTiming,
    recordSqliteRead,
    recordSqliteWrite,
    setDatabaseSnapshot,
    registerIpc,
    collectSystemSnapshot,
    writeReport,
    getReportPath: ensureReportPath
  };
}

module.exports = {
  createPerformanceDiagnostics,
  elapsedMs
};
