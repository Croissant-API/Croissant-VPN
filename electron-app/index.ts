const app = require('electron').app;
const BrowserWindow = require('electron').BrowserWindow;
const path = require('path');

const { getVpnList } = require('./api'); // Assuming you have an API module to handle backend logic

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
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);