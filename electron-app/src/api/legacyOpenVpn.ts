import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import path, { dirname, join, basename, extname } from 'path';

// Variable globale pour stocker le processus OpenVPN actif
let currentVpnProcess: ChildProcess | null = null;
let currentIp: string | null = null;

function runOpenVpnConfig(ip: string): Promise<number> {
    return new Promise(async (resolve) => {
        const HANDSHAKE_TIMEOUT = 10;
        let timeoutId: NodeJS.Timeout | undefined = undefined;
        let globalTimeout: NodeJS.Timeout | undefined = undefined;
        let isConnected = false;

        const filePath = path.resolve('OVPN-Configs-scraper', 'data', 'configs', `${ip}.ovpn`);
        let isConnecting = false;

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
            console.log(`Connecting to VPN with IP: ${ip}, platform: ${process.platform}`);

            let cmd;
            let args;
            if (process.platform.startsWith('win')) {
                let openvpnPath = path.resolve('windows-exec', 'openvpn.exe');

                // Si le fichier n'existe pas, tente dans resourcesPath (cas packagé)
                if (!existsSync(openvpnPath)) {
                    openvpnPath = path.join(process.resourcesPath, 'windows-exec', 'openvpn.exe');
                }
                
                cmd = openvpnPath;
                args = [
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
            }
            else {
                cmd = 'sudo';
                args = [
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
            }

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

export async function connectToLegacyOpenVpn(ip: string): Promise<number> {

    await disconnectFromOpenVpn();
    return runOpenVpnConfig(ip);
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
