import { simpleGit } from 'simple-git';
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { connectToLegacyOpenVpn, disconnectFromOpenVpn, getVpnStatus } from './api/legacyOpenVpn.js';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const configs = require("./configs.json");
const repoPath = path.resolve('OVPN-Configs-scraper');
const git = simpleGit();
if (!fs.existsSync(repoPath)) {
    console.log('Clonage du dépôt OVPN-Configs-scraper...');
    await git.clone('https://github.com/fox3000foxy/OVPN-Configs-scraper.git', repoPath, ['--depth', '1']);
}
else {
    console.log('Mise à jour du dépôt OVPN-Configs-scraper...');
    const gitRepo = simpleGit(repoPath);
    await gitRepo.pull('origin', 'main');
}
let VPNConfigs = [];
const handlers = {
    'getConfigs': async () => {
        if (VPNConfigs.length > 0) {
            return VPNConfigs;
        }
        try {
            // const configsModule = await import(path.resolve(repoPath, 'data', 'ipCache.json'));
            // VPNConfigs = configsModule.default || configsModule;
            // return VPNConfigs;
            const ipCachePath = path.join(repoPath, 'data', 'ipCache.json');
            const ipCacheContent = fs.readFileSync(ipCachePath, 'utf-8');
            const ipCache = JSON.parse(ipCacheContent);
            VPNConfigs = Object.values(ipCache);
            return VPNConfigs;
        }
        catch (error) {
            console.error('Erreur lors de la récupération des configs:', error);
            return [];
        }
    },
    'connectVPN': async (event, ip, configUrl) => {
        try {
            const exitCode = await connectToLegacyOpenVpn(ip);
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
    // L'élévation n'est requise que sous Windows
    if (process.platform === 'win32' && !(await isElevated())) {
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
