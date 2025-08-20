import { app, BrowserWindow } from 'electron';
import { getVpnList as VPNGate } from './api/VPNGATE-getVpnList.js'; // Ensure this import matches the correct casing
import { getVpnList as OPL } from './api/OPL-getVpnList.js'; // Ensure this import matches the correct casing
import { ipcMain } from 'electron';
// import { getIPInfo, readCache, writeCache } from './api/getIPInfo.js';
import { createRequire } from "module";
import { bulkIpLookup } from './api/getIPInfo.js';
const require = createRequire(import.meta.url);
const configs = require("./configs.json");
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
    window.getOPL_ISPs = async () => {
        const oplList = await window.OPL.getVpnList();
        const ips = oplList.servers.map((i) => i.ip);
        const isps = await window.getISPs(ips);
        return isps;
    };
}
const handlers = {
    'OPL:getVpnList': async () => {
        console.log('Fetching VPN list from OPL');
        return await OPL();
    },
    'VPNGate:getVpnList': async () => {
        console.log('Fetching VPN list from VPNGate');
        return await VPNGate();
    },
    'getVpnList': async (event, source) => {
        if (source === 'OPL') {
            const vpnList = await OPL();
            return vpnList;
        }
        else if (source === 'VPNGate') {
            const vpnList = await VPNGate();
            return vpnList;
        }
        else if (source === "All") {
            const [oplList, vpnGateList] = await Promise.all([OPL(), VPNGate()]);
            return { opl: oplList, vpnGate: vpnGateList };
        }
        else {
            return { error: 'Unknown source' };
        }
    },
    'getISPs': async (event, ips) => {
        // const cache = await readCache();
        // const results = await Promise.all(ips.map((ip: string) => getIPInfo(ip, cache)));
        // await writeCache(cache); // On écrit le cache une seule fois à la fin
        // return results;
        const results = await bulkIpLookup(ips);
        return results.map((result) => ({
            country: result.country,
            city: result.city,
            isp: result.isp,
            query: result.query,
            lat: result.lat,
            lon: result.lon,
            timezone: result.timezone,
            as: result.as
        }));
    }
};
// Register all handlers
for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => handler(event, ...args));
}
function createWindow() {
    const mainWindow = new BrowserWindow(configs.mainWindow);
    mainWindow.loadFile('index.html');
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(initSharedFunctions.toString() + ";initSharedFunctions();");
    });
    if (configs.devMode)
        mainWindow.webContents.openDevTools();
}
app.whenReady().then(createWindow);
