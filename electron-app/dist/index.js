import { app, BrowserWindow } from 'electron';
import path from 'path';
// console.log(getVpnList); // For debugging, remove in production
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
app.whenReady().then(createWindow);
