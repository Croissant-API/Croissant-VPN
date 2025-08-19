import { describe, expect, it, jest } from '@jest/globals';
import { getVpnList } from '../api/OpenProxy-getVpnList';

describe('OpenProxy getVpnList - integration', () => {
  jest.setTimeout(20000);
  const runLive = !!process.env.RUN_LIVE_TESTS;
  (runLive ? it : it.skip)('fetches live proxies', async () => {
    const res = await getVpnList(1, {}, undefined);
    expect(res.proxies.length).toBeGreaterThan(0);
  });
});
