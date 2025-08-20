import { createRequire } from "module";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const configs = require("../configs.json");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.resolve(__dirname, "../ipCache.json");

// Ensure cache file exists
(async () => {
  try {
    await fs.access(cachePath);
  } catch(error) {
    console.log("IP info cache file not found, creating a new one.");
    await fs.writeFile(cachePath, "{}", "utf-8");
  }
})();

async function readCache(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeCache(cache: Record<string, any>) {
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}

/**
 * Bulk IP lookup using IP-API (no token required, free for non-commercial use) with cache support.
 * @param {string[]} ips - Array of IP addresses
 * @param {number} chunkSize - Max IPs per bulk request (default 100 for IP-API)
 * @returns {Promise<Object[]>} - Array of lookup results (same order as input)
 */
export async function bulkIpLookup(ips: string[], chunkSize = 100) {
  const cache = await readCache();
  const uncachedIps: string[] = [];
  const ipIndexMap: Record<string, number[]> = {};

 
  ips.forEach((ip, idx) => {
    if (!cache[ip]) {
      uncachedIps.push(ip);
    }
    if (!ipIndexMap[ip]) ipIndexMap[ip] = [];
    ipIndexMap[ip].push(idx);
  });

  let newResults: Record<string, any> = {};
 
  for (let i = 0; i < uncachedIps.length; i += chunkSize) {
    const chunk = uncachedIps.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const res = await fetch("http://ip-api.com/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk.map(ip => ({ query: ip }))),
    });
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
   
    chunk.forEach((ip, idx) => {
      cache[ip] = data[idx];
      newResults[ip] = data[idx];
    });
  }
 
  if (Object.keys(newResults).length > 0) {
    await writeCache(cache);
  }
 
  return ips.map(ip => cache[ip]);
}

