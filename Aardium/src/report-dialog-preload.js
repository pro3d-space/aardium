const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reportApi', {
  getReportDialogData: () => ipcRenderer.invoke('get-report-dialog-data'),
  saveZipReport: (userNote) => ipcRenderer.invoke('save-zip-report', userNote),
  submitReport: (method, filePath, userNote) => ipcRenderer.invoke('submit-report', method, filePath, userNote)
});