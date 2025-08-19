import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import http from 'http';
import { getVpnList } from '../api/VPNGATE-getVpnList';

describe('getVpnList', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves with parsed servers and countries when API returns 200', async () => {
    const csv = '\n"cols"\n"hdr1,hdr2,hdr3,hdr4,hdr5,countryName,countryCode"\n"val1,val2,val3,val4,val5,CountryName,US"\n--\n';

    const fakeRes = new EventEmitter() as unknown as http.IncomingMessage;
    (fakeRes as any).statusCode = 200;

    const fakeReq = {
      on: jest.fn(),
      end: jest.fn(),
    } as any;

    jest.spyOn(http, 'get').mockImplementation((url: string, cb: (res: http.IncomingMessage) => void) => {
      process.nextTick(() => {
        cb(fakeRes);
        fakeRes.emit('data', Buffer.from(csv));
        fakeRes.emit('end');
      });
      return fakeReq;
    });

    const result = await getVpnList();
    expect(result.servers.length).toBeGreaterThan(0);
    expect(result.countries['us']).toBe('CountryName');
  });

  it('rejects / returns empty when statusCode !== 200', async () => {
    const fakeRes = new EventEmitter() as unknown as http.IncomingMessage;
    (fakeRes as any).statusCode = 500;
    const fakeReq = { on: jest.fn(), end: jest.fn() } as any;

    jest.spyOn(http, 'get').mockImplementation((url: string, cb: (res: http.IncomingMessage) => void) => {
      process.nextTick(() => {
        cb(fakeRes);
        fakeRes.emit('end');
      });
      return fakeReq;
    });

    await expect(getVpnList()).rejects.toEqual({ servers: [], countries: {} });
  });
});
