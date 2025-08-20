import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script is running');

contextBridge.exposeInMainWorld('api', {
  getVpnList: (source = "All") => {
    console.log('getVpnList called with source:', source);
    return ipcRenderer.invoke('getVpnList', source);
  },
  getISPs: async (ips: string[]) => {
    if (!ips || ips.length === 0) {
      throw new Error("No IPs provided");
    }
    return ipcRenderer.invoke('getISPs', ips);
  },
  getISP: async (ip: string) => {
    const results = await ipcRenderer.invoke('getISPs', [ip]);
    return results[0] || {};
  },
  getConfigs: () => ipcRenderer.invoke('getConfigs')
});