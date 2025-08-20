import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, basename, extname } from 'path';

// Variable globale pour stocker le processus OpenVPN actif
let currentVpnProcess: ChildProcess | null = null;
let currentIp: string | null = null;

function convertOvpnConfig(config: string): string {
   
    const supportedCiphers = [
        'AES-128-CBC',
        'AES-128-GCM',
        'AES-256-CBC',
        'AES-256-GCM'
    ].join(':');

   
    let convertedConfig = config;

   
    convertedConfig = convertedConfig.replace(/^tls-version.*$/gm, '');

   
    const additionalConfig = `
tls-version-min 1.0
tls-version-max 1.2
data-ciphers ${supportedCiphers}
`;

   
    return convertedConfig.replace(/^(\s*cipher\s+([^\s]+).*)$/gim,
        (match, fullLine) => `${fullLine}${additionalConfig}`);
}

async function writeConvertedConfigFile(originalPath: string, convertedContent: string): Promise<string> {
    const dir = dirname(originalPath) || '.';
    try {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    } catch (e) {
       
    }

    const base = basename(originalPath, extname(originalPath));
    const outName = `${base}-legacy.ovpn`;
    const outPath = join(dir, outName);
    await writeFileSync(outPath, convertedContent, 'utf8');
    return outPath;
}

function runOpenVpnConfig(ip: string, filePath: string): Promise<number> {
    return new Promise(async (resolve) => {
        const HANDSHAKE_TIMEOUT = 10;
        let timeoutId: NodeJS.Timeout | undefined = undefined;
        let globalTimeout: NodeJS.Timeout | undefined = undefined;
        let isConnecting = false;
        let isConnected = false;

        try {
           
            await new Promise((checkFile) => {
                const maxAttempts = 10;
                let attempts = 0;

                const checkExists = () => {
                    if (existsSync(filePath)) {
                        checkFile(true);
                    } else {
                        attempts++;
                        if (attempts >= maxAttempts) {
                            checkFile(false);
                        } else {
                            setTimeout(checkExists, 100);
                        }
                    }
                };

                checkExists();
            });

            console.log(`Config file verified at: ${filePath}`);

            const cmd = 'sudo';
            const args = [
                'openvpn',
                '--config', filePath,
                '--connect-retry-max', '1',
                '--remote-cert-tls', 'server',
                '--auth-nocache',          
                '--nobind',                
                '--persist-key',           
                '--persist-tun',           
                '--ping', '5',            
                '--ping-restart', '10'     
            ];

            console.log(`Running OpenVPN with command: ${cmd} ${args.join(' ')}`);
            currentVpnProcess = spawn(cmd, args, { stdio: 'pipe' });
            currentIp = ip;

           
            currentVpnProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();

               
                if (output.includes('Attempting to establish TCP connection')) {
                    isConnecting = true;
                }

               
                if (output.includes('TCP connection established')) {
                    isConnecting = false;
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                }

               
                if (output.includes('Timers: ping')) {
                    isConnected = true;
                    if (globalTimeout) {
                        clearTimeout(globalTimeout);
                    }
                    console.log('VPN connection established successfully');
                   
                }

                console.log(output.trim());
            });

           
            currentVpnProcess.stderr?.on('data', (data: Buffer) => {
                console.error(data.toString().trim());
            });

           
            globalTimeout = setTimeout(() => {
                if (!isConnected && currentVpnProcess) {
                    console.log('Global connection timeout reached');
                    currentVpnProcess.kill();
                    currentVpnProcess = null;
                    currentIp = null;
                    resolve(1);
                }
            }, HANDSHAKE_TIMEOUT * 1000);

            currentVpnProcess.on('exit', () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (globalTimeout) clearTimeout(globalTimeout);

                if (existsSync(filePath)) {
                    try {
                        require('fs').unlinkSync(filePath);
                    } catch (e) {
                       
                    }
                }

               
                if (isConnected) {
                    currentIp = null;
                    resolve(0);
                } else {
                   
                    currentIp = null;
                    resolve(1);
                }
                currentVpnProcess = null;
            });

        } catch (error) {
           
        }
    });
}

export function disconnectFromOpenVpn(): Promise<void> {
    return new Promise((resolve) => {
        if (currentVpnProcess) {
            const process = currentVpnProcess;
            currentVpnProcess = null;

            process.on('exit', () => {
                resolve();
            });

            process.kill();
        } else {
            resolve();
        }
    });
}

export async function connectToLegacyOpenVpn(ip: string, url: string): Promise<number> {
   
    await disconnectFromOpenVpn();

    if (url.startsWith('data:text/opvn;base64,')) {
        const base64Content = url.split(',')[1];
        const originalConfig = Buffer.from(base64Content, 'base64').toString('utf8');
        const convertedConfig = convertOvpnConfig(originalConfig);
        const outPath = await writeConvertedConfigFile('temp', convertedConfig);

        console.log(`Converted config written to: ${outPath}`);
        return runOpenVpnConfig(ip, outPath);
    } else {
        const originalConfig = await fetch(url)
            .then(response => response.text())
        const convertedConfig = convertOvpnConfig(originalConfig);
        const outPath = await writeConvertedConfigFile('temp', convertedConfig);

        console.log(`Converted config written to: ${outPath}`);
        return runOpenVpnConfig(ip, outPath);
    }
}

export function getVpnStatus(): Promise<boolean | string> {
    return new Promise((resolve) => {
        if (!currentVpnProcess) {
            resolve(false);
            return;
        }

       
        try {
            if (typeof currentVpnProcess.pid === 'number') {
               
                resolve(currentIp || false);
            } else {
                currentVpnProcess = null;
                resolve(false);
            }
        } catch (e) {
            currentVpnProcess = null;
            resolve(false);
        }
    });
}
