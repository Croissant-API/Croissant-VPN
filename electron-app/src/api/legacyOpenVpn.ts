import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, basename, extname } from 'path';

/**
 * Convert an OpenVPN config string from legacy "cipher" to new "data-ciphers" lines.
 * It replaces lines starting with optional whitespace + cipher with data-ciphers preserving the rest of the line.
 */
export function convertOvpnConfig(config: string): string {
    return config.replace(/^\s*cipher\s+(.+)$/gim, 'data-ciphers $1');
}

/**
 * Write converted config into same directory as original or into given directory.
 * Returns the path to the written file.
 */
export function writeConvertedConfigFile(originalPath: string, convertedContent: string): string {
    const dir = dirname(originalPath) || '.';
    try {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    } catch (e) {
        // ignore mkdir errors
    }

    const base = basename(originalPath, extname(originalPath));
    const outName = `${base}-legacy.ovpn`;
    const outPath = join(dir, outName);
    writeFileSync(outPath, convertedContent, 'utf8');
    return outPath;
}

/**
 * Run openvpn on the converted file using sudo. Returns numeric exit status.
 */
export function runOpenVpnConfig(filePath: string): number {
    const cmd = 'sudo';
    const args = ['openvpn', '--config', filePath, '--verb', '0'];
    const res = spawnSync(cmd, args, { stdio: 'inherit' });
    return res.status ?? 0;
}

// CLI: if executed directly, take a path to an .ovpn file and run the conversion + openvpn.
if (require.main === module) {
    const argv = process.argv.slice(2);
    if (argv.length === 0) {
        console.log('Usage: node legacyOpenVpn.js <path-to-file.ovpn>');
        process.exit(1);
    }
    const inputPath = argv[0];
    if (!existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        process.exit(2);
    }
    try {
        const original = readFileSync(inputPath, 'utf8');
        const converted = convertOvpnConfig(original);
        const outPath = writeConvertedConfigFile(inputPath, converted);
        console.log(`Wrote converted file: ${outPath}`);
        const status = runOpenVpnConfig(outPath);
        process.exit(status);
    } catch (err: any) {
        console.error('Error:', err && err.message ? err.message : err);
        process.exit(3);
    }
}