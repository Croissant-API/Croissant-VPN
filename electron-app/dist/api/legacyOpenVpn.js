import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, basename, extname } from 'path';
// Variable globale pour stocker le processus OpenVPN actif
let currentVpnProcess = null;
let currentIp = null;
function convertOvpnConfig(config) {
    // Ajout des deux types de chiffrements (CBC et GCM) pour la compatibilité
    const supportedCiphers = [
        'AES-128-CBC',
        'AES-128-GCM',
        'AES-256-CBC',
        'AES-256-GCM'
    ].join(':');
    // Add TLS settings and cipher configurations
    let convertedConfig = config;
    // Remove any existing tls-version settings
    convertedConfig = convertedConfig.replace(/^tls-version.*$/gm, '');
    // Add our TLS and cipher configurations
    const additionalConfig = `
tls-version-min 1.0
tls-version-max 1.2
data-ciphers ${supportedCiphers}
`;
    // Add the configurations while preserving the original cipher
    return convertedConfig.replace(/^(\s*cipher\s+([^\s]+).*)$/gim, (match, fullLine) => `${fullLine}${additionalConfig}`);
}
async function writeConvertedConfigFile(originalPath, convertedContent) {
    const dir = dirname(originalPath) || '.';
    try {
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
    }
    catch (e) {
        // ignore mkdir errors
    }
    const base = basename(originalPath, extname(originalPath));
    const outName = `${base}-legacy.ovpn`;
    const outPath = join(dir, outName);
    await writeFileSync(outPath, convertedContent, 'utf8');
    return outPath;
}
function runOpenVpnConfig(ip, filePath) {
    return new Promise(async (resolve) => {
        const HANDSHAKE_TIMEOUT = 10;
        let timeoutId = undefined;
        let globalTimeout = undefined;
        let isConnecting = false;
        let isConnected = false;
        try {
            // Vérification du fichier existant...
            await new Promise((checkFile) => {
                const maxAttempts = 10;
                let attempts = 0;
                const checkExists = () => {
                    if (existsSync(filePath)) {
                        checkFile(true);
                    }
                    else {
                        attempts++;
                        if (attempts >= maxAttempts) {
                            checkFile(false);
                        }
                        else {
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
                '--ping-restart', '10' // Redémarrer après 45s sans réponse
            ];
            console.log(`Running OpenVPN with command: ${cmd} ${args.join(' ')}`);
            currentVpnProcess = spawn(cmd, args, { stdio: 'pipe' }); // Changed to pipe for output parsing
            currentIp = ip;
            // Surveiller la sortie pour détecter les étapes de connexion
            currentVpnProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                // Détecter le début d'une tentative de connexion TCP
                if (output.includes('Attempting to establish TCP connection')) {
                    isConnecting = true;
                }
                // Réinitialiser le timeout si la connexion TCP est établie
                if (output.includes('TCP connection established')) {
                    isConnecting = false;
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                }
                // Détecter la connexion réussie
                if (output.includes('Timers: ping')) {
                    isConnected = true;
                    if (globalTimeout) {
                        clearTimeout(globalTimeout);
                    }
                    console.log('VPN connection established successfully');
                    // Ne pas résoudre la promesse ici, on continue d'écouter pour les erreurs
                }
                console.log(output.trim());
            });
            // Gérer les erreurs
            currentVpnProcess.stderr?.on('data', (data) => {
                console.error(data.toString().trim());
            });
            // Timeout global modifié
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
                if (timeoutId)
                    clearTimeout(timeoutId);
                if (globalTimeout)
                    clearTimeout(globalTimeout);
                if (existsSync(filePath)) {
                    try {
                        require('fs').unlinkSync(filePath);
                    }
                    catch (e) {
                        // Ignore unlink errors
                    }
                }
                // Si le processus se termine après une connexion réussie, c'est une déconnexion normale
                if (isConnected) {
                    currentIp = null;
                    resolve(0);
                }
                else {
                    // Si le processus se termine avant d'être connecté, c'est une erreur
                    currentIp = null;
                    resolve(1);
                }
                currentVpnProcess = null;
            });
        }
        catch (error) {
            // ...existing error handling...
        }
    });
}
export function disconnectFromOpenVpn() {
    return new Promise((resolve) => {
        if (currentVpnProcess) {
            const process = currentVpnProcess; // Garde une référence locale
            currentVpnProcess = null; // Reset immédiatement pour éviter les appels multiples
            process.on('exit', () => {
                resolve();
            });
            process.kill();
        }
        else {
            resolve();
        }
    });
}
export async function connectToLegacyOpenVpn(ip, url) {
    // Déconnexion de toute connexion existante
    await disconnectFromOpenVpn();
    if (url.startsWith('data:text/opvn;base64,')) {
        const base64Content = url.split(',')[1];
        const originalConfig = Buffer.from(base64Content, 'base64').toString('utf8');
        const convertedConfig = convertOvpnConfig(originalConfig);
        const outPath = await writeConvertedConfigFile('temp', convertedConfig);
        console.log(`Converted config written to: ${outPath}`);
        return runOpenVpnConfig(ip, outPath);
    }
    else {
        const originalConfig = await fetch(url)
            .then(response => response.text());
        const convertedConfig = convertOvpnConfig(originalConfig);
        const outPath = await writeConvertedConfigFile('temp', convertedConfig);
        console.log(`Converted config written to: ${outPath}`);
        return runOpenVpnConfig(ip, outPath);
    }
}
export function getVpnStatus() {
    return new Promise((resolve) => {
        if (!currentVpnProcess) {
            resolve(false);
            return;
        }
        // Vérifie si le processus est toujours en cours d'exécution
        try {
            if (typeof currentVpnProcess.pid === 'number') {
                // process.kill(currentVpnProcess.pid, 0);
                resolve(currentIp || false);
            }
            else {
                currentVpnProcess = null;
                resolve(false);
            }
        }
        catch (e) {
            currentVpnProcess = null;
            resolve(false);
        }
    });
}
