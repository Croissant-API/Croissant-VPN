import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { afterAll, beforeAll, describe, expect } from '@jest/globals';

// Guarded integration test: only run when RUN_LEGACY_INTEGRATION is set
const runLive = !!process.env.RUN_LEGACY_INTEGRATION;
(runLive ? describe : describe.skip)('legacyOpenVpn integration', () => {
  const tmpPrefix = join(tmpdir(), 'legacy-openvpn-');
  let workdir = '';

  beforeAll(() => {
    // create temp working directory
    workdir = mkdtempSync(tmpPrefix);

    // create fake repo structure auto-ovpn/configs and a JP.ovpn file
    const repoDir = join(workdir, 'auto-ovpn');
    const configsDir = join(repoDir, 'configs');
    mkdirSync(configsDir, { recursive: true });
    const ovpnPath = join(configsDir, 'JP.ovpn');
    // include a cipher line to test replacement
    writeFileSync(ovpnPath, 'client\nremote example.com 1194\ncipher AES-256-CBC\n');

    // create a fake bin directory with sudo and openvpn wrappers
    const binDir = join(workdir, 'fakebin');
    mkdirSync(binDir, { recursive: true });

    const isWin = process.platform === 'win32';
    if (isWin) {
      // create sudo.cmd and openvpn.cmd that echo and exit 0
      writeFileSync(join(binDir, 'sudo.cmd'), '@echo off\r\n%*\r\nexit /b 0\r\n');
      writeFileSync(join(binDir, 'openvpn.cmd'), '@echo off\r\necho fake-openvpn %*\r\nexit /b 0\r\n');
    } else {
      writeFileSync(join(binDir, 'sudo'), '#!/bin/sh\nexec "$@"\n');
      writeFileSync(join(binDir, 'openvpn'), '#!/bin/sh\necho fake-openvpn "$@"\nexit 0\n');
      chmodSync(join(binDir, 'sudo'), 0o755);
      chmodSync(join(binDir, 'openvpn'), 0o755);
    }
  });

  afterAll(() => {
    try {
      if (workdir && existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
    } catch (err) {
      // ignore
    }
  });

  it('runs the TypeScript script like ./openvpn.sh JP and exits cleanly', () => {
    // Ensure ts-node is available to run .ts directly
    let tsNodeAvailable = true;
    try {
      require.resolve('ts-node/register');
    } catch (e) {
      tsNodeAvailable = false;
    }
    if (!tsNodeAvailable) {
      console.warn('ts-node not installed; skipping legacyOpenVpn integration test. Install ts-node to run this test.');
      return;
    }

    const scriptPath = join(process.cwd(), 'electron-app', 'src', 'api', 'legacyOpenVpn.ts');

    // Build env with PATH modified to include our fakebin first and cwd set to workdir
    const env = { ...process.env } as NodeJS.ProcessEnv;
    env.PATH = join(workdir, 'fakebin') + (env.PATH ? (process.platform === 'win32' ? ';' : ':') + env.PATH : '');

    // Run node with ts-node/register to execute the TypeScript file
    const args = ['-r', 'ts-node/register', scriptPath, 'JP'];
    const res = spawnSync(process.execPath, args, { cwd: workdir, env, timeout: 20000, encoding: 'utf8' });

    // Debug output on failure
    if (res.stdout) console.log('STDOUT:', res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);

    // Expect exit status 0
    expect(res.status).toBe(0);
  });
});
