import https from 'https';
import { URL } from 'url';
import { StringDecoder } from 'string_decoder';
import querystring from 'querystring';

// Optional parser dependency — install with `npm install cheerio`
let cheerio: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  cheerio = require('cheerio');
} catch (err) {
  cheerio = null;
}

export interface OpenProxyEntry {
  ip: string;
  port: string;
  protocol?: string;
  country?: string;
  raw?: string;
}

export interface OpenProxyResult {
  proxies: OpenProxyEntry[];
  rawHtml: string;
}

/**
 * Fetches proxy list from openproxylist by POSTing form data (captcha token + page).
 * - page: page number to request
 * - formFields: optional additional form key/values (serialized like the original `#form`)
 * - captchaToken: optional g-recaptcha-response value
 *
 * Returns structured proxies plus raw HTML. Parsing tries to use cheerio when available,
 * and falls back to a regex-based extractor.
 */
export async function getVpnList(
  page = 1,
  formFields: Record<string, string> = {},
  captchaToken?: string
): Promise<OpenProxyResult> {
  const url = new URL('https://openproxylist.com/get-list.html');

  const bodyObj: Record<string, string> = { ...formFields, page: String(page) };
  if (captchaToken) bodyObj['g-recaptcha-response'] = captchaToken;

  const body = querystring.stringify(bodyObj);

  const opts: https.RequestOptions = {
    method: 'POST',
    hostname: url.hostname,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'node-fetch/1.0 (OpenProxyList-client)'
    }
  };

  const html = await new Promise<string>((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const status = res.statusCode ?? 0;
      const decoder = new StringDecoder('utf8');
      let data = '';

      res.on('data', (chunk: Buffer) => {
        data += decoder.write(chunk);
      });

      res.on('end', () => {
        data += decoder.end();
        if (status < 200 || status >= 300) {
          return reject(new Error(`HTTP ${status}`));
        }
        resolve(data);
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });

  // Try to parse proxies
  const proxies: OpenProxyEntry[] = [];

  if (cheerio) {
    const $ = cheerio.load(html);

    // Try common table-based structures first
    const rows = $('table tr');
    if (rows.length > 0) {
      rows.each((i: number, el: any) => {
        const cols = $(el).find('td');
        if (cols.length >= 2) {
          const first = $(cols[0]).text().trim();
          const second = $(cols[1]).text().trim();
          const ipMatch = first.match(/(\d+\.\d+\.\d+\.\d+)/);
          const portMatch = second.match(/(\d{1,5})/);
          if (ipMatch && portMatch) {
            proxies.push({ ip: ipMatch[0], port: portMatch[0], raw: $(el).text().trim() });
          } else {
            // fallback to searching the row text
            const text = $(el).text();
            const m = text.match(/(\d+\.\d+\.\d+\.\d+):(\d{1,5})/);
            if (m) proxies.push({ ip: m[1], port: m[2], raw: text.trim() });
          }
        } else {
          // not a table row — try to find ip:port in the row
          const text = $(el).text();
          const m = text.match(/(\d+\.\d+\.\d+\.\d+):(\d{1,5})/);
          if (m) proxies.push({ ip: m[1], port: m[2], raw: text.trim() });
        }
      });
    } else {
      // If no table rows, scan the #proxy-list container or body for ip:port patterns
      const container = $('#proxy-list');
      const scanText = container.length ? container.text() : $.root().text();
      const regex = /(\d+\.\d+\.\d+\.\d+):(\d{1,5})/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(scanText)) !== null) {
        proxies.push({ ip: m[1], port: m[2], raw: m[0] });
      }
    }
  } else {
    // cheerio not installed — fallback to quick regex extractor
    const regex = /(\d+\.\d+\.\d+\.\d+):(\d{1,5})/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(html)) !== null) {
      proxies.push({ ip: m[1], port: m[2], raw: m[0] });
    }
  }

  // Deduplicate simple duplicates
  const seen = new Set<string>();
  const uniques: OpenProxyEntry[] = [];
  for (const p of proxies) {
    const key = `${p.ip}:${p.port}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniques.push(p);
    }
  }

  return { proxies: uniques, rawHtml: html };
}
