import { BrowserWindow } from 'electron';
import path from 'path';
import { getVpnList as OPL } from './api/OPL-getVpnList.js'; // Ensure this import matches the correct casing
OPL().then(res => console.log(res.servers.length)); // For debugging, remove in production
// getVpnList().then(console.log); // For debugging, remove in production
// const { webServer } = require('./webServer'); // Uncomment if you have a web server module
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools();
}
// app.whenReady().then(createWindow);
