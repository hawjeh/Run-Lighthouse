process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
Store.initRenderer();
const lighthouse = (...args) => import('./node_modules/lighthouse/core/index.js').then(({ default: lighthouse }) => lighthouse(...args));

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 980,
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      devTools: process.env['APP_ENVIRONMENT'] === 'debug'
    }
  });

  mainWindow.setMenuBarVisibility(process.env['APP_ENVIRONMENT'] === 'debug' ? true : false);
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  // custom events
  ipcMain.on('openDirectory', async (event, arg) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    event.returnValue = result;
  });

  ipcMain.on('openFile', async (event, arg) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
    });
    event.returnValue = result;
  });

  ipcMain.handle('buildReport', async (event, arg) => {
    const result = await lighthouse(arg.url, arg.options);
    return result;
  })
};

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})