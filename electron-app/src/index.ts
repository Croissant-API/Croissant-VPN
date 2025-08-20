import { app, BrowserWindow } from 'electron';

import { getVpnList as VPNGate } from './api/VPNGATE-getVpnList.js'; // Ensure this import matches the correct casing
import { getVpnList as OPL } from './api/OPL-getVpnList.js'; // Ensure this import matches the correct casing

import { ipcMain } from 'electron';
// import { getIPInfo, readCache, writeCache } from './api/getIPInfo.js';

import { createRequire } from "module";
import { bulkIpLookup } from './api/getIPInfo.js';
const require = createRequire(import.meta.url);
const configs = require("./configs.json");

declare global {
  interface Window {
    [key: string]: any;
  }
}


function initSharedFunctions() {
  let VPNConfigs: object[] = []
  const ipcRenderer = require('electron').ipcRenderer;
  window.getVpnList = (source = "All") => {
    return ipcRenderer.invoke('getVpnList', source);
  };
  window.getISPs = async (ips: string[]) => {
    if (!ips || ips.length === 0) {
      throw new Error("No IPs provided");
    }
    else {
      return ipcRenderer.invoke('getISPs', ips);
    }
  }
  window.getISP = async (ip: string) => {
    return ipcRenderer.invoke('getISPs', [ip]).then((results: any[]) => {
      return results[0] || {};
    });
  }
  window.getConfigs = () => {
    if (VPNConfigs.length === 0) {
      return new Promise((resolve) => {
        const OPLListPromise = ipcRenderer.invoke('getVpnList', 'OPL');
        const VPNGateListPromise = ipcRenderer.invoke('getVpnList', 'VPNGate');

        Promise.all([OPLListPromise, VPNGateListPromise]).then(([opl, vpngate]) => {
          const oplServers = opl.servers.map((server: any) => ({ ...server, provider: 'OPL' }));
          const vpngateServers = vpngate.servers.map((server: any) => ({ ...server, provider: 'VPNGate' }));
          const allServers = [...oplServers, ...vpngateServers];
          const allIps = allServers.map((server: any) => server.ip);

          ipcRenderer.invoke('getISPs', allIps).then((isps: any[]) => {
            const servers = allServers.map((server: any) => {
              const ispInfo = isps.find((isp: any) => isp.query === server.ip) || {};
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
  };
}

const handlers: { [key: string]: Function } = {
  'getVpnList': async (event: any, source: string) => {
    if (source === 'OPL') {
      const vpnList = await OPL();
      return vpnList;
    } else if (source === 'VPNGate') {
      const vpnList = await VPNGate();
      return vpnList;
    } else if (source === "All") {
      const [oplList, vpnGateList] = await Promise.all([OPL(), VPNGate()]);
      return { opl: oplList, vpnGate: vpnGateList };
    } else {
      return { error: 'Unknown source' };
    }
  },
  'getISPs': async (event: any, ips: string[]) => {
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