const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  formatJson: (json) => ipcRenderer.invoke('format-json', json),
  compressJson: (json) => ipcRenderer.invoke('compress-json', json),
  convertToXml: (json) => ipcRenderer.invoke('convert-to-xml', json),
  convertToTypeScript: (json) => ipcRenderer.invoke('convert-to-typescript', json),
  loadJsonFile: () => ipcRenderer.invoke('load-json-file')
}); 