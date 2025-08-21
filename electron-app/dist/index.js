import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { getVpnList as VPNGate } from './api/VPNGATE-getVpnList.js';
import { getVpnList as OPL } from './api/OPL-getVpnList.js';
import { ipcMain } from 'electron';
import { createRequire } from "module";
import { bulkIpLookup } from './api/getIPInfo.js';
const require = createRequire(import.meta.url);
const configs = require("./configs.json");
import { URL } from 'url';
import { connectToLegacyOpenVpn, disconnectFromOpenVpn, getVpnStatus } from './api/legacyOpenVpn.js';
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
        if (pendingConfigPromise) {
            return pendingConfigPromise;
        }
        pendingConfigPromise = new Promise((resolve) => {
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
                    pendingConfigPromise = null;
                    resolve(servers);
                });
            }).catch((error) => {
                console.log(error);
                pendingConfigPromise = null;
                throw error;
            });
        });
        return pendingConfigPromise;
    },
    'connectVPN': async (event, ip, configUrl) => {
        try {
            const exitCode = await connectToLegacyOpenVpn(ip, configUrl);
            return { success: exitCode === 0 };
        }
        catch (error) {
            console.error('VPN connection error:', error);
            return { success: false, error: error.message };
        }
    },
    'disconnectVPN': async () => {
        try {
            await disconnectFromOpenVpn();
            return { success: true };
        }
        catch (error) {
            console.error('VPN disconnection error:', error);
            return { success: false, error: error.message };
        }
    },
    'getVpnStatus': async () => {
        try {
            const isConnected = await getVpnStatus();
            return { success: true, connected: isConnected };
        }
        catch (error) {
            console.error('VPN status check error:', error);
            return { success: false, error: error.message };
        }
    }
};
// Register all handlers
for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => handler(event, ...args));
}
function createWindow() {
    // Gestion des chemins pour preload et icône compatibles asar
    let preloadPath = path.resolve('electron-app', 'dist', 'preload.js');
    if (!fs.existsSync(preloadPath)) {
        preloadPath = path.join(process.resourcesPath, 'electron-app', 'dist', 'preload.js');
        if (!fs.existsSync(preloadPath)) {
            preloadPath = path.join(process.resourcesPath, 'app.asar', 'electron-app', 'dist', 'preload.js');
        }
    }
    let iconPath = path.resolve('public', 'icons', 'favicon.ico');
    if (!fs.existsSync(iconPath)) {
        iconPath = path.join(process.resourcesPath, 'public', 'icons', 'favicon.ico');
        if (!fs.existsSync(iconPath)) {
            iconPath = path.join(process.resourcesPath, 'app.asar', 'public', 'icons', 'favicon.ico');
        }
    }
    const mainWindow = new BrowserWindow({
        ...configs.mainWindow,
        webPreferences: {
            ...configs.mainWindow.webPreferences,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: preloadPath
        },
        icon: iconPath
    });
    mainWindow.maximize();
    mainWindow.setMenuBarVisibility(false);
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
        // Supporte build local et build packagé (asar)
        let indexPath = path.resolve('build', 'index.html');
        if (!fs.existsSync(indexPath)) {
            // Si non trouvé, tente dans le dossier resources (asar ou non)
            indexPath = path.join(process.resourcesPath, 'app.asar', 'build', 'index.html');
            if (!fs.existsSync(indexPath)) {
                // Si toujours pas trouvé, tente sans app.asar (certains packagers extraient le build à la racine de resources)
                indexPath = path.join(process.resourcesPath, 'build', 'index.html');
            }
        }
        if (!fs.existsSync(indexPath)) {
            console.error('Index file not found at:', indexPath);
            app.quit();
            return;
        }
        console.log('Loading file from:', indexPath);
        mainWindow.loadFile(indexPath);
    }
    // if (configs.devMode) {
    //   mainWindow.webContents.openDevTools();
    // }
}
import isElevated from 'is-elevated';
import sudo from 'sudo-prompt';
(async () => {
    console.log('Début du bootstrap Croissant VPN');
    if (!(await isElevated())) {
        const isPackaged = app.isPackaged;
        let execPath;
        let args = [];
        if (isPackaged) {
            execPath = process.execPath;
            args = [];
        }
        else {
            execPath = process.execPath;
            if (process.argv[1]) {
                args = [process.argv[1], ...process.argv.slice(2)];
            }
        }
        const cmd = `"${execPath}"${args.length ? ' ' + args.map(a => `"${a}"`).join(' ') : ''}`;
        console.log('Tentative d\'élévation avec la commande:', cmd);
        sudo.exec(cmd, { name: 'Croissant VPN', cwd: process.cwd() }, (error, stdout, stderr) => {
            if (stdout)
                console.log('Élévation stdout:', stdout);
            if (stderr)
                console.error('Élévation stderr:', stderr);
            if (error) {
                console.error('Erreur élévation:', error);
                process.exit(1); // Pour debug, commente cette ligne
            }
            process.exit(0); // Pour debug, commente cette ligne
        });
        return;
    }
    console.log('Élévation réussie ou non requise, lancement de la fenêtre...');
    app.whenReady().then(createWindow);
})();
