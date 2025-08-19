import nock from 'nock';
import fs from 'fs';
import path from 'path';
import { getVpnList } from '../api/OpenProxy-getVpnList';
import { afterEach, describe, expect, it } from '@jest/globals';

describe('OpenProxy getVpnList - unit', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('parses proxies from fixture HTML', async () => {
    const fixture = fs.readFileSync(path.resolve(__dirname, './fixtures/openproxy-sample.html'), 'utf8');

    nock('https://openproxylist.com')
      .post('/get-list.html')
      .reply(200, fixture, { 'Content-Type': 'text/html' });

    const res = await getVpnList(1, { some: 'field' }, 'test-token');
    expect(res.proxies.length).toBeGreaterThanOrEqual(2);
    expect(res.proxies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ip: '192.0.2.1', port: '8080' }),
        expect.objectContaining({ ip: '198.51.100.4', port: '3128' }),
      ])
    );
  });
});
