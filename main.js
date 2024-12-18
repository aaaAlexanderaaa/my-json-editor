const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const JsonConverter = require('./src/utils/jsonConverter');
const JsonFormatter = require('./src/utils/jsonFormatter');
const fs = require('fs').promises;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    }
  });

  mainWindow.webContents.openDevTools();
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));
}

// IPC handlers for JSON operations
ipcMain.handle('format-json', async (event, json) => {
  return JsonFormatter.format(json);
});

ipcMain.handle('compress-json', async (event, json) => {
  return JsonFormatter.compress(json);
});

ipcMain.handle('convert-to-xml', async (event, json) => {
  try {
    return await JsonConverter.jsonToXml(json);
  } catch (e) {
    throw new Error(`XML conversion failed: ${e.message}`);
  }
});

ipcMain.handle('convert-to-typescript', async (event, json) => {
  return JsonConverter.jsonToTypeScript(json);
});

ipcMain.handle('load-json-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const content = await fs.readFile(result.filePaths[0], 'utf8');
    return content;
  }
  return null;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 