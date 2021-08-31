process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
Store.initRenderer();

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 980,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      devTools: process.env['APP_ENVIRONMENT'] === 'debug'
    }
  });

  mainWindow.setMenuBarVisibility(process.env['APP_ENVIRONMENT'] === 'debug' ? true : false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // custom events
  ipcMain.on('open-directory', async (event, arg) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    event.returnValue = result;
  });

  ipcMain.on('open-file', async (event, arg) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
    });
    event.returnValue = result;
  });
};

app.on('ready', createWindow);
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