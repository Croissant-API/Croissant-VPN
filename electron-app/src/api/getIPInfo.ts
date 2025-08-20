import { createRequire } from "module";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url"; // Ajouté

const require = createRequire(import.meta.url);
const configs = require("../configs.json");

// Correction ici :
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

export async function getIPInfo(ip: string, cache?: Record<string, any>): Promise<any> {
    cache = cache || await readCache();
    if (cache[ip]) {
        // console.log(`IP info for ${ip} loaded from cache`);
        return cache[ip];
    }

    const apiUrl = `http://ip-api.com/json/${ip}?fields=country,city,isp,query,lat,lon,timezone,as&lang=en`;
    // console.log(`Fetching IP info for ${ip} from ${apiUrl}`);
    try {
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': configs.ipInfoUserAgent
            }
        });
        if (!response.ok) {
            throw new Error(`Error fetching IP info: ${response.statusText}`);
        }
        const data = await response.json();
        cache[ip] = data;
        return data;
    } catch (error) {
        console.error('Failed to fetch IP info:', error);
        throw error;
    }
}

export { readCache, writeCache };