interface Window {
  api: {
    getVpnList: (source?: string) => Promise<any>;
    getISPs: (ips: string[]) => Promise<any>;
    getISP: (ip: string) => Promise<any>;
    getConfigs: () => Promise<any>;
  }
}