import http from "http";

interface VpnServer {
    [key: string]: string;
}

interface VpnListResult {
    servers: VpnServer[];
    countries: { [key: string]: string };
}

export function getVpnList(): Promise<VpnListResult> {
    return new Promise((resolve, reject) => {
        const vpnGateApiUrl = "http://www.vpngate.net/api/iphone/";
        const req = http.get(vpnGateApiUrl, (res: http.IncomingMessage) => {
            let data = "";

            res.on("data", (chunk: Buffer) => {
                data += chunk.toString();
            });

            res.on("end", () => {
                if (res.statusCode !== 200) {
                    reject({ servers: [], countries: {} });
                } else {
                    try {
                        const servers: VpnServer[] = [];
                        const countries: { [key: string]: string } = {};
                        const returnData: VpnListResult = { servers, countries };

                        let lines = data.trim().split("\n");

                        if (lines.length < 2) {
                            reject(returnData);
                            return;
                        }

                        const headers = lines[1]
                            .slice(1, -1)
                            .split(",")
                            .map((header) => header.trim());

                        lines = lines.slice(2, lines.length - 2);

                        lines.forEach((vpn) => {
                            const values = vpn.split(",");
                            countries[values[6]?.toLowerCase() ?? ""] = values[5] ?? "";
                            const obj: VpnServer = {};
                            for (let j = 0; j < values.length; j++) {
                                const excludeHeaders = [
                                    "numvpnsessions",
                                    "uptime",
                                    "totalusers",
                                    "totaltraffic",
                                    "logtype",
                                    "message"
                                ];
                                const headerKey = headers[j]?.toLowerCase() ?? "";
                                if (!excludeHeaders.includes(headerKey)) {
                                    obj[headerKey] = values[j]?.trim() ?? "";
                                }
                            }
                            servers.push(obj);
                        });

                        resolve(returnData);
                    } catch (error) {
                        reject({ servers: [], countries: {} });
                    }
                }
            });
        });

        console.log("Fetching VPN list from VPNGate API");

        req.on("error", () => {
            reject({ servers: [], countries: {} });
        });

        req.end();
    });
}
