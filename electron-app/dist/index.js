import { app, BrowserWindow } from 'electron';
import { getVpnList as VPNGate } from './api/VPNGATE-getVpnList.js'; // Ensure this import matches the correct casing
import { getVpnList as OPL } from './api/OPL-getVpnList.js'; // Ensure this import matches the correct casing
import { ipcMain } from 'electron';
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    mainWindow.loadFile('index.html');
    ipcMain.handle('OPL:getVpnList', async () => {
        console.log('Fetching VPN list from OPL');
        return await OPL();
    });
    ipcMain.handle('VPNGate:getVpnList', async () => {
        console.log('Fetching VPN list from VPNGate');
        return await VPNGate();
    });
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
      window.OPL = {
        getVpnList: () => require('electron').ipcRenderer.invoke('OPL:getVpnList')
      };
      window.VPNGate = {
        getVpnList: () => require('electron').ipcRenderer.invoke('VPNGate:getVpnList')
      };
    `);
    });
    mainWindow.webContents.openDevTools(); // Uncomment to open DevTools by default
}
app.whenReady().then(createWindow);
