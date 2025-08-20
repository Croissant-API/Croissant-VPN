import { app, BrowserWindow } from "electron";
import { load } from "cheerio";

declare global {
    interface Window {
        grecaptcha: {
            execute: (siteKey: string, options: { action: string }) => Promise<string>;
        };
    }
}

const SITE_KEY = "6LepNaEaAAAAAMcfZb4shvxaVWulaKUfjhOxOHRS";
const URL = "https://openproxylist.com/openvpn/";

function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
}

async function getListsScriptFn() {
    while (!window.grecaptcha?.execute) await sleep(100);
    await sleep(1000);

    const fetchPage = async (page: string) => {
        const token = await window.grecaptcha.execute(SITE_KEY, { action: "homepage" });
        return fetch("https://openproxylist.com/get-list.html", {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
            },
            referrer: URL,
            body: `g-recaptcha-response=${token}&response=&sort=sortlast&dataType=openvpn&page=${page}`,
            method: "POST",
            mode: "cors",
        }).then(r => r.ok ? r.text() : Promise.reject("Network error"));
    };

    while (!document.querySelector('.pagination .page-link[page-data]')) await sleep(100);

    const pages = Array.from(document.querySelectorAll('.pagination .page-link[page-data]'))
        .filter(el => !isNaN(parseInt((el as HTMLElement).innerText)));
    const lastPage = parseInt((pages[pages.length - 1] as HTMLElement).innerText);
    const results = await Promise.all(
        Array.from({ length: lastPage }, (_, i) => fetchPage((i + 1).toString()))
    );
    return results.join("\\n<!--PAGE_BREAK-->\\n");
}

const getListsScript = `
    ${sleep.toString()}
    ${getListsScriptFn.toString()}
    getListsScriptFn();
`;

function getVpnListHTML(): Promise<string> {
    return new Promise((resolve, reject) => {
        app.on("ready", () => {
            const win = new BrowserWindow({ show: true, webPreferences: { contextIsolation: false } });
            win.webContents.session.webRequest.onBeforeRequest(
                { urls: ["*://*/*.js", "*://*/*.ads*", "*://*/*ad*"] },
                (details, cb) => {
                    if (
                        /ads|doubleclick|googlesyndication|adservice|adserver/.test(details.url)
                    ) return cb({ cancel: true });
                    cb({});
                }
            );
            win.loadURL(URL);
            win.webContents.openDevTools();
            win.webContents.once("did-finish-load", async () => {
                try {
                    const result = await win.webContents.executeJavaScript(getListsScript);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            });
        });
    });
}

interface VpnServer {
    ip: string;
    country: string;
    city: string;
    response_time: string;
    isp: string;
    last_check: string;
}

function parseVpnList(html: string): { servers: VpnServer[]; countries: { [k: string]: string } } {
    const $ = load(html);
    const servers: VpnServer[] = [];
    const countries: { [k: string]: string } = {};

    $("tr").each((i, el) => {
        if (i < 2) return;
        const ip = $(el).find("th").first().text().trim();
        if (!ip) return;
        const cells = $(el).find("td");
        const [country, city = ""] = $(cells[1]).text().trim().split(",").map(s => s.trim());
        const server: VpnServer = {
            ip,
            country,
            city,
            response_time: $(cells[2]).text().trim(),
            isp: $(cells[3]).text().trim(),
            last_check: $(cells[4]).text().trim(),
        };
        countries[country.toLowerCase().replace(/ /g, "_")] = country;
        servers.push(server);
    });

    return { servers, countries };
}

export async function getVpnList(): Promise<{ servers: VpnServer[]; countries: { [k: string]: string } }> {
    try {
        const html = await getVpnListHTML();
        return parseVpnList(html);
    } catch (e) {
        console.error("Error fetching VPN list:", e);
        return { servers: [], countries: {} };
    }
}