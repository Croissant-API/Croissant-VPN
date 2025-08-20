import { BrowserWindow } from "electron";
import { load } from "cheerio";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const configs = require("../configs.json");
function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}
async function getListsScriptFn() {
    while (!window.grecaptcha?.execute)
        await sleep(100);
    await sleep(1000);
    const fetchPage = async (page) => {
        const token = await window.grecaptcha.execute(configs.oplConstants.site_key, { action: "homepage" });
        return fetch("https://openproxylist.com/get-list.html", {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
            },
            referrer: configs.oplConstants.base_url,
            body: `g-recaptcha-response=${token}&response=&sort=sortlast&dataType=openvpn&page=${page}`,
            method: "POST",
            mode: "cors",
        }).then(r => r.ok ? r.text() : Promise.reject("Network error"));
    };
    while (!document.querySelector('.pagination .page-link[page-data]'))
        await sleep(100);
    const pages = Array.from(document.querySelectorAll('.pagination .page-link[page-data]'))
        .filter(el => !isNaN(parseInt(el.innerText)));
    const lastPage = !configs.devMode ? parseInt(pages[pages.length - 1].innerText) : 1;
    const results = await Promise.all(Array.from({ length: lastPage }, (_, i) => fetchPage((i + 1).toString())));
    return results.join("\\n<!--PAGE_BREAK-->\\n");
}
const getListsScript = `
    const configs = ${JSON.stringify(configs)};
    ${sleep.toString()}
    ${getListsScriptFn.toString()}
    getListsScriptFn();
`;
function getVpnListHTML() {
    return new Promise((resolve, reject) => {
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                contextIsolation: true,
               
                webSecurity: true,
                allowRunningInsecureContent: false
            }
        });
       
        win.webContents.session.webRequest.onHeadersReceived(({ responseHeaders }, callback) => {
            if (responseHeaders) {
                delete responseHeaders['content-security-policy'];
                delete responseHeaders['content-security-policy-report-only'];
            }
            callback({
                responseHeaders: {
                    ...responseHeaders,
                    'content-security-policy': ["script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com"]
                }
            });
        });
       
        win.webContents.session.webRequest.onBeforeRequest({ urls: ["*://*/*.js", "*://*/*.ads*", "*://*/*ad*"] }, (details, cb) => {
            if (/ads|doubleclick|googlesyndication|adservice|adserver/.test(details.url))
                return cb({ cancel: true });
            cb({});
        });
        win.loadURL(configs.oplConstants.base_url);
        win.webContents.once("did-finish-load", async () => {
            try {
                console.log("Executing script to fetch VPN list HTML");
                const result = await win.webContents.executeJavaScript(getListsScript);
                resolve(result);
            }
            catch (err) {
                reject(err);
            }
            finally {
                win.close();
            }
        });
    });
}
function parseVpnList(html) {
    const $ = load(html);
    const servers = [];
    const countries = {};
    $("tr").each((i, el) => {
        if (i < 2)
            return;
        const ip = $(el).find("th").first().text().trim();
        if (!ip)
            return;
        const cells = $(el).find("td");
        const [country, city = ""] = $(cells[1]).text().trim().split(",").map(s => s.trim());
        const server = {
            ip,
            download_url: "https://openproxylist.com" + $(cells[0]).find("a").attr("href") || "",
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
export async function getVpnList() {
    try {
        console.log("Fetching VPN list HTML from OPL");
        const html = await getVpnListHTML();
        console.log("Fetched VPN list HTML successfully");
        return parseVpnList(html);
    }
    catch (e) {
        console.error("Error fetching VPN list:", e);
        return { servers: [], countries: {} };
    }
}
