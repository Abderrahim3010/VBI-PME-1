const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vbiDb', {
  getAllData: (keys) => ipcRenderer.invoke('vbi-db:get-all-data', keys),
  getData: (key) => ipcRenderer.invoke('vbi-db:get-data', key),
  saveData: (key, value) => ipcRenderer.invoke('vbi-db:save-data', key, value),
  deleteData: (key) => ipcRenderer.invoke('vbi-db:delete-data', key),
  getMeta: (key) => ipcRenderer.invoke('vbi-db:get-meta', key),
  setMeta: (key, value) => ipcRenderer.invoke('vbi-db:set-meta', key, value),
  getDatabaseInfo: () => ipcRenderer.invoke('vbi-db:get-database-info'),
  exportBackup: () => ipcRenderer.invoke('vbi-db:export-backup'),
  restoreBackup: () => ipcRenderer.invoke('vbi-db:restore-backup'),
  saveSalesReservationState: (payload) => ipcRenderer.invoke('vbi-db:save-sales-reservation-state', payload)
});

if (process.env.VBI_PERF_DIAGNOSTICS === '1') {
  contextBridge.exposeInMainWorld('vbiPerf', {
    enabled: true,
    hardwareAccelerationDisabled:
      process.env.VBI_DISABLE_HARDWARE_ACCELERATION === '1',
    updateSnapshot: (snapshot) => {
      ipcRenderer.send('vbi-perf:renderer-snapshot', snapshot);
    },
    flushReport: () => ipcRenderer.invoke('vbi-perf:flush')
  });
}
