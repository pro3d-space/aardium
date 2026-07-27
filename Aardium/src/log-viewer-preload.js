const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('logApi', {
  getLogData: () => ipcRenderer.invoke('get-log-data'),
  onLogLine: (callback) => ipcRenderer.on('new-log-line', (_, line) => callback(line)),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder')
});