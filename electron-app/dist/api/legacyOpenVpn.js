import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, basename, extname } from 'path';
// Variable globale pour stocker le processus OpenVPN actif
let currentVpnProcess = null;
function convertOvpnConfig(config) {
    return config.replace(/^\s*cipher\s+(.+)$/gim, 'data-ciphers $1');
}
function writeConvertedConfigFile(originalPath, convertedContent) {
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
    writeFileSync(outPath, convertedContent, 'utf8');
    return outPath;
}
function runOpenVpnConfig(filePath) {
    return new Promise((resolve) => {
        // On ne kill pas le processus ici, on utilise la fonction dédiée
        const cmd = 'sudo';
        const args = ['openvpn', '--config', filePath, '--verb', '0'];
        console.log(`Running OpenVPN with command: ${cmd} ${args.join(' ')}`);
        currentVpnProcess = spawn(cmd, args, { stdio: 'inherit' });
        currentVpnProcess.on('exit', (code) => {
            if (existsSync(filePath)) {
                try {
                    require('fs').unlinkSync(filePath);
                }
                catch (e) {
                    // Ignore unlink errors
                }
            }
            currentVpnProcess = null;
            resolve(code ?? 0);
        });
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
export async function connectToLegacyOpenVpn(url) {
    // Déconnexion de toute connexion existante
    await disconnectFromOpenVpn();
    if (url.startsWith('data:text/opvn;base64,')) {
        const base64Content = url.split(',')[1];
        const originalConfig = Buffer.from(base64Content, 'base64').toString('utf8');
        const convertedConfig = convertOvpnConfig(originalConfig);
        const outPath = writeConvertedConfigFile('temp-legacy.ovpn', convertedConfig);
        console.log(`Converted config written to: ${outPath}`);
        return runOpenVpnConfig(outPath);
    }
    else {
        const originalConfig = await fetch(url)
            .then(response => response.text());
        const convertedConfig = convertOvpnConfig(originalConfig);
        const outPath = writeConvertedConfigFile('temp-legacy.ovpn', convertedConfig);
        console.log(`Converted config written to: ${outPath}`);
        return runOpenVpnConfig(outPath);
    }
}
