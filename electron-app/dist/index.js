import { app, BrowserWindow } from 'electron';
import { getVpnList as VPNGate } from './api/VPNGATE-getVpnList.js'; // Ensure this import matches the correct casing
import { getVpnList as OPL } from './api/OPL-getVpnList.js'; // Ensure this import matches the correct casing
import { ipcMain } from 'electron';
// import { getIPInfo, readCache, writeCache } from './api/getIPInfo.js';
import { createRequire } from "module";
import { bulkIpLookup } from './api/getIPInfo.js';
const require = createRequire(import.meta.url);
const configs = require("./configs.json");
let VPNConfigs = [];
const handlers = {
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
        return await bulkIpLookup(ips);
    },
    'getConfigs': () => {
        if (VPNConfigs.length === 0) {
            return new Promise((resolve) => {
                const OPLListPromise = OPL();
                const VPNGateListPromise = VPNGate();
                Promise.all([OPLListPromise, VPNGateListPromise]).then(([opl, vpngate]) => {
                    const oplServers = opl.servers.map((server) => ({ ...server, provider: 'OPL' }));
                    const vpngateServers = vpngate.servers.map((server) => ({ ...server, provider: 'VPNGate' }));
                    const allServers = [...oplServers, ...vpngateServers];
                    const allIps = allServers.map((server) => server.ip);
                    bulkIpLookup(allIps).then((isps) => {
                        const servers = allServers.map((server) => {
                            const ispInfo = isps.find((isp) => isp.query === server.ip) || {};
                            return {
                                isp: ispInfo.isp || "",
                                country: ispInfo.country || "",
                                city: ispInfo.city || "",
                                lat: ispInfo.lat || "",
                                lon: ispInfo.lon || "",
                                timezone: ispInfo.timezone || "",
                                as: ispInfo.as || "",
                                provider: server.provider,
                                download_url: server.download_url || "data:text/opvn;base64," + server.openvpn_configdata_base64 || ""
                            };
                            /* Exemple of return
                             {
                              "isp": "Aussie Broadband",
                              "country": "Australia",
                              "city": "Brisbane",
                              "lat": -27.5073,
                              "lon": 153.0504,
                              "timezone": "Australia/Brisbane",
                              "as": "AS4764 Aussie Broadband",
                              "provider": "VPNGate",
                              "download_url": "data:text/opvn;base64,..."
                            } */
                        });
                        VPNConfigs = servers;
                        resolve(servers);
                    });
                });
            });
        }
        else {
            return VPNConfigs;
        }
    }
};
// Register all handlers
for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => handler(event, ...args));
}
function createWindow() {
    const mainWindow = new BrowserWindow({
        ...configs.mainWindow,
        webPreferences: {
            ...configs.mainWindow.webPreferences,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    // Set CSP headers
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self';" +
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
                        "style-src 'self' 'unsafe-inline';" +
                        "img-src 'self' data: https:;" +
                        "connect-src 'self' http: https:;"
                ]
            }
        });
    });
    if (configs.devMode) {
        mainWindow.loadURL('http://localhost:5173/');
    }
    else {
        mainWindow.loadFile('build/index.html');
    }
    if (configs.devMode) {
        mainWindow.webContents.openDevTools();
    }
}
app.whenReady().then(createWindow);
