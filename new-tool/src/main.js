import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import lighthouse from 'lighthouse';
import Store from 'electron-store';
const store = new Store();
import 'dotenv/config'

const createWindow = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 980,
    webPreferences: {
      preload: path.join(__dirname, "./preload.mjs"),
      nodeIntegrationInWorker: true,
      contextIsolation: true,
      devTools: process.env['APP_ENVIRONMENT'] === 'debug'
    },
  });

  mainWindow.setMenuBarVisibility(process.env['APP_ENVIRONMENT'] === 'debug');
  mainWindow.loadFile(path.join(__dirname, "./index.html"));
  mainWindow.webContents.openDevTools();

  // custom events
  ipcMain.on('openFile', async (event, arg) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
    });
    event.returnValue = result;
  });

  ipcMain.on('openDirectory', async (event, arg) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    event.returnValue = result;
  });

  ipcMain.handle('buildReport', async (event, arg) => {
    const result = await lighthouse(arg.url, arg.options);
    return result;
  });

  ipcMain.handle('saveSetting', async (event, arg) => {
    store.set('options', arg.options);
  });

  ipcMain.handle('getSetting', async (event, arg) => {
    return store.get('options');
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

}).catch((err) => {
  console.log(err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})