import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('api', {
    getVpnList: (source = "All") => ipcRenderer.invoke('getVpnList', source),
    getISPs: async (ips) => {
        if (!ips || ips.length === 0) {
            throw new Error("No IPs provided");
        }
        return ipcRenderer.invoke('getISPs', ips);
    },
    getISP: async (ip) => {
        const results = await ipcRenderer.invoke('getISPs', [ip]);
        return results[0] || {};
    },
    getConfigs: () => ipcRenderer.invoke('getConfigs')
});
