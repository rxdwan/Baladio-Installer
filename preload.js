const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openExternal: (url) => ipcRenderer.send('open-external', url),
    getInstallPath: () => ipcRenderer.invoke('get-install-path'),
    startInstallation: () => ipcRenderer.invoke('start-installation'),
    onInstallProgress: (callback) => ipcRenderer.on('install-progress', (_event, data) => callback(data))
});
