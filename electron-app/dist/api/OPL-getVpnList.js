import { app, BrowserWindow } from "electron";
import { load } from 'cheerio';
async function getListsScriptFn() {
    while (window.grecaptcha === undefined || window.grecaptcha.execute === undefined) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const grecaptcha = window.grecaptcha;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for the token to be ready
    const fetchPage = async (page) => {
        const token = await grecaptcha.execute("6LepNaEaAAAAAMcfZb4shvxaVWulaKUfjhOxOHRS", { action: "homepage" });
        return fetch("https://openproxylist.com/get-list.html", {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
            },
            referrer: "https://openproxylist.com/openvpn/",
            body: "g-recaptcha-response=" + token + "&response=&sort=sortlast&dataType=openvpn&page=" + page,
            method: "POST",
            mode: "cors",
        }).then(r => {
            if (!r.ok)
                throw new Error("Network response was not ok");
            return r.text();
        });
    };
    while (document.querySelector('.pagination .page-link[page-data]') === null) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const pageElements = Array.from(document.querySelectorAll('.pagination .page-link[page-data]'))
        .filter(el => !isNaN(parseInt(el.innerText)));
    const pageNumbers = pageElements[pageElements.length - 1].innerText;
    console.log("Total pages:", pageNumbers);
    const pages = Array.from({ length: parseInt(pageNumbers) }, (_, i) => (i + 1).toString());
    const fetchPromises = pages.map((page, idx) => fetchPage(page).then(result => ({ idx, result })));
    const unorderedResults = await Promise.all(fetchPromises);
    // Sort by original page order
    const orderedResults = unorderedResults
        .sort((a, b) => a.idx - b.idx)
        .map(item => item.result);
    return orderedResults.join("\\n<!--PAGE_BREAK-->\\n");
}
const getListsScript = `
    ${getListsScriptFn.toString()}
    getListsScriptFn();
`;
function getVpnListHTML() {
    return new Promise((resolve, reject) => {
        app.on('ready', () => {
            const win = new BrowserWindow({ show: true, webPreferences: { contextIsolation: false } });
            win.webContents.session.webRequest.onBeforeRequest({ urls: ["*://*/*.js", "*://*/*.ads*", "*://*/*ad*"] }, (details, callback) => {
                // Block requests to common ad scripts and ad-related URLs
                if (details.url.includes("ads") ||
                    details.url.includes("doubleclick") ||
                    details.url.includes("googlesyndication") ||
                    details.url.includes("adservice") ||
                    details.url.includes("adserver")) {
                    return callback({ cancel: true });
                }
                callback({});
            });
            win.loadURL('https://openproxylist.com/openvpn/');
            // open the dev tools for debugging
            win.webContents.openDevTools();
            win.webContents.once('did-finish-load', async () => {
                try {
                    const result = await win.webContents.executeJavaScript(getListsScript);
                    resolve(result);
                }
                catch (err) {
                    reject(err);
                }
                finally {
                    // win.close();
                }
            });
        });
    });
}
function parseVpnList(html) {
    const $ = load(html);
    const servers = [];
    const countries = {};
    $('tr').each((index, element) => {
        if (index === 0 || index === 1)
            return; // Skip header rows
        const ip = $(element).find('th').first().text().trim();
        const cells = $(element).find('td');
        if (!ip)
            return; // Skip if no IP found
        const server = {
            ip: ip,
            country: $(cells[1]).text().trim().split(",")[0]?.trim() || "",
            city: $(cells[1]).text().trim().split(",")[1]?.trim() || "",
            response_time: $(cells[2]).text().trim(),
            isp: $(cells[3]).text().trim(),
            last_check: $(cells[4]).text().trim(),
        };
        countries[server.country.toLowerCase().replace(" ", "_")] = server.country;
        servers.push(server);
    });
    return { servers, countries };
}
export async function getVpnList() {
    try {
        const html = await getVpnListHTML();
        return parseVpnList(html);
    }
    catch (error) {
        console.error("Error fetching VPN list:", error);
        return { servers: [], countries: {} };
    }
}
