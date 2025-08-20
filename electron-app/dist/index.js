import { app, BrowserWindow } from 'electron';
import path from 'path';
import { getVpnList as VPNGate } from './api/VPNGATE-getVpnList.js'; // Ensure this import matches the correct casing
import { getVpnList as OPL } from './api/OPL-getVpnList.js'; // Ensure this import matches the correct casing
import { ipcMain } from 'electron';
import { createRequire } from "module";
import { bulkIpLookup } from './api/getIPInfo.js';
const require = createRequire(import.meta.url);
const configs = require("./configs.json");
import { URL } from 'url';
const __dirname = path.dirname(new URL(import.meta.url).pathname);
let VPNConfigs = [];
let pendingConfigPromise = null;
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
        if (VPNConfigs.length > 0) {
            return VPNConfigs;
        }
        // Si une promesse est déjà en cours, retourner celle-ci
        if (pendingConfigPromise) {
            return pendingConfigPromise;
        }
        // Créer une nouvelle promesse et la stocker
        pendingConfigPromise = new Promise((resolve) => {
            const OPLListPromise = OPL(); // Ensure this import matches the correct casing
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
                            ip: server.ip,
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
                    });
                    VPNConfigs = servers;
                    pendingConfigPromise = null; // Réinitialiser la promesse en cours
                    resolve(servers);
                });
            }).catch((error) => {
                pendingConfigPromise = null; // Réinitialiser en cas d'erreur
                throw error;
            });
        });
        return pendingConfigPromise;
    }
};
// Register all handlers
for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => handler(event, ...args));
}
function createWindow() {
    console.log(path.join(decodeURI(__dirname), "..", "..", "public", 'icons', 'favicon.ico'));
    const mainWindow = new BrowserWindow({
        ...configs.mainWindow,
        webPreferences: {
            ...configs.mainWindow.webPreferences,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(decodeURI(__dirname), 'preload.js') // Chemin absolu vers le preload script
        },
        icon: path.join(decodeURI(__dirname), "..", "..", "public", 'icons', 'favicon.ico') // Chemin absolu vers l'icône
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
