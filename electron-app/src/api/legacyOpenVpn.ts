import { execSync, spawnSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

// Constants
const REPO_DIR = "auto-ovpn";
const REPO_URL = "https://github.com/9xN/auto-ovpn";

// Clone or update repo
if (!existsSync(REPO_DIR)) {
    execSync(`git clone --quiet --depth 1 ${REPO_URL} ${REPO_DIR}`, { stdio: "inherit" });
} else {
    process.chdir(REPO_DIR);
    execSync(`git fetch --quiet origin`, { stdio: "inherit" });
    const local = execSync(`git rev-parse @`).toString().trim();
    const remote = execSync(`git rev-parse @{u}`).toString().trim();
    if (local !== remote) {
        execSync(`git pull --quiet --rebase origin main`, { stdio: "inherit" });
    }
    process.chdir("..");
}

// Argument parsing
const args = process.argv.slice(2);
let AUTOCHOOSE = false;
let INPUT_ARG = "";

while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--autochoose") {
        AUTOCHOOSE = true;
    } else if (arg) {
        INPUT_ARG = arg;
    }
}

if (!INPUT_ARG || INPUT_ARG === "--help") {
    console.log("Usage: node legacyOpenVpn.js [--autochoose] <JP|KR|VN|RU|TH|US>");
    process.exit(1);
}

// File selection
let OVPN_FILE = "";
if (!INPUT_ARG.includes("/")) {
    const configDir = join(REPO_DIR, "configs");
    const matches = readdirSync(configDir)
        .filter(f => f.endsWith(`${INPUT_ARG}.ovpn`))
        .map(f => join(configDir, f));
    if (matches.length === 0 || !existsSync(matches[0])) {
        console.error(`No file found for pattern: ${INPUT_ARG}`);
        process.exit(1);
    } else if (matches.length === 1 || AUTOCHOOSE) {
        OVPN_FILE = matches[0];
        console.log(`File automatically selected: ${OVPN_FILE}`);
    } else {
        console.log("Multiple files found:");
        matches.forEach((f, i) => console.log(`${i + 1}: ${f}`));
        // For simplicity, auto-select the first if not AUTOCHOOSE
        OVPN_FILE = matches[0];
        console.log(`File selected: ${OVPN_FILE}`);
    }
} else {
    OVPN_FILE = INPUT_ARG;
}

if (!existsSync(OVPN_FILE)) {
    console.error(`File not found: ${OVPN_FILE}`);
    process.exit(1);
}

// Replace 'cipher' with 'data-ciphers'
const tmpDir = mkdtempSync(join(tmpdir(), "ovpn-"));
const TMP_OVPN = join(tmpDir, "modified.ovpn");
const content = readFileSync(OVPN_FILE, "utf-8")
    .replace(/^\s*cipher\s+/gim, "data-ciphers ");
writeFileSync(TMP_OVPN, content);

// Show what will be passed
console.log("Using modified OVPN config (cipher -> data-ciphers):");
content.split("\n").forEach(line => {
    if (/data-ciphers/i.test(line)) {
        console.log(line);
    }
});

// Launch OpenVPN
const result = spawnSync("sudo", ["openvpn", "--config", TMP_OVPN, "--verb", "0"], { stdio: "inherit" });

// Cleanup
unlinkSync(TMP_OVPN);

process.exit(result.status ?? 0);