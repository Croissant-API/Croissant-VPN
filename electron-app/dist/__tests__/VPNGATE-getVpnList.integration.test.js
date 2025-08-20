import { describe, expect, it, jest } from '@jest/globals';
import { getVpnList } from '../api/VPNGATE-getVpnList';
describe('getVpnList (integration)', () => {
   
    jest.setTimeout(20000);
   
    const runLive = !!process.env.RUN_LIVE_TESTS;
    (runLive ? it : it.skip)('fetches and parses live VPNGate data', async () => {
        const result = await getVpnList();
        expect(Array.isArray(result.servers)).toBe(true);
        expect(result.servers.length).toBeGreaterThan(0);
        expect(Object.keys(result.countries).length).toBeGreaterThan(0);
        const first = result.servers[0];
        expect(typeof first).toBe('object');
    });
});
