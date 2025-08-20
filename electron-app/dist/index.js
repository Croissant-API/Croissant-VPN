import { app, BrowserWindow } from 'electron';
import { getVpnList as VPNGate } from './api/VPNGATE-getVpnList.js'; // Ensure this import matches the correct casing
import { getVpnList as OPL } from './api/OPL-getVpnList.js'; // Ensure this import matches the correct casing
import { ipcMain } from 'electron';
import { getIPInfo } from './api/getIPInfo.js';
function initSharedFunctions() {
    window.OPL = {
        getVpnList: () => require('electron').ipcRenderer.invoke('OPL:getVpnList')
    };
    window.VPNGate = {
        getVpnList: () => require('electron').ipcRenderer.invoke('VPNGate:getVpnList')
    };
    window.getVpnList = (source = "All") => {
        return require('electron').ipcRenderer.invoke('getVpnList', source);
    };
    window.getISPs = (ips) => {
        return require('electron').ipcRenderer.invoke('getISPs', ips);
    };
    window.getVPNGateISPs = async () => {
        const vpnGateList = await window.VPNGate.getVpnList();
        const ips = vpnGateList.servers.map((i) => i.ip);
        const isps = await window.getISPs(ips);
        return isps;
    };
}
ipcMain.handle('OPL:getVpnList', async () => {
    console.log('Fetching VPN list from OPL');
    return await OPL();
});
ipcMain.handle('VPNGate:getVpnList', async () => {
    console.log('Fetching VPN list from VPNGate');
    return await VPNGate();
});
ipcMain.handle('getVpnList', async (event, source) => {
    if (source === 'OPL') {
        console.log('Fetching VPN list from OPL');
        const vpnList = await OPL();
        return vpnList;
    }
    else if (source === 'VPNGate') {
        console.log('Fetching VPN list from VPNGate');
        const vpnList = await VPNGate();
        return vpnList;
    }
    else if (source === "All") {
        console.log('Fetching VPN list from both OPL and VPNGate');
        const [oplList, vpnGateList] = await Promise.all([OPL(), VPNGate()]);
        return { opl: oplList, vpnGate: vpnGateList };
    }
    else {
        console.error('Unknown source for VPN list:', source);
        return { error: 'Unknown source' };
    }
});
ipcMain.handle('getISPs', async (event, ips) => {
    const results = await Promise.all(ips.map((ip) => getIPInfo(ip)));
    return results;
});
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
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(initSharedFunctions.toString() + ";initSharedFunctions();");
    });
    mainWindow.webContents.openDevTools(); // Uncomment to open DevTools by default
}
app.whenReady().then(createWindow);
