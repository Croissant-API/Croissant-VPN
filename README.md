> [!CAUTION]
> After realizing how the free configs might be log dangerous, and because of me who though that academics VPN were exempted of logs, this project is now archived. You can still use or download it for free if you don't mind about your data and just want to spoof your IP. Thanks y'all.

# Croissant-VPN

<img width="1798" height="761" alt="image" src="https://github.com/user-attachments/assets/1781f072-40fb-4f95-af65-3915173919b9" />

Croissant-VPN is a cross-platform VPN client that automates the process of finding, selecting, and connecting to free VPN servers (such as those from VPNGate) using OpenVPN. It features a modern Electron-based desktop app and a React-based frontend.

## Features

- **VPN Server Scraping:** Automatically scrapes public VPN server lists (e.g., VPNGate) to provide up-to-date options.
- **Server Picking:** Allows users to filter and select VPN servers based on country, speed, and other criteria.
- **Config Overriding:** Modifies downloaded OpenVPN configuration files on the fly to ensure compatibility and security.
- **OpenVPN Integration:** Launches and manages OpenVPN connections directly from the app, including process control and status monitoring.
- **Windows Support:** Bundles required OpenVPN binaries and drivers for seamless setup on Windows.

## How It Works

1. **Scraping:**  
   The backend (Electron main process) fetches and parses VPN server lists from sources like VPNGate, extracting server details and OpenVPN config links.

2. **Overriding:**  
   When a user selects a server, the app downloads the corresponding `.ovpn` file and applies necessary overrides (e.g., DNS, routes, security options) to ensure a reliable connection.

3. **Picking:**  
   The frontend displays available servers with filtering and sorting options. Users can pick a server based on their preferences.

4. **OpenVPN Control:**  
   The app launches the OpenVPN process with the selected configuration, monitors its output, and provides connection status and logs to the user. On Windows, all required binaries and drivers are included.

## Project Structure

- src — React frontend (UI)
- electron-app — Electron main process, backend logic, and API integrations
- windows-exec — Bundled OpenVPN binaries and dependencies for Windows
- installer — Windows installer for OpenVPN (if needed)
- build — Production build output

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   cd electron-app && npm install
   ```

2. **Run the app:**
   ```sh
   npm run electron-start
   ```
You can also use the Setup and the precompiled apps in [Releases](https://github.com/Croissant-API/Croissant-VPN/releases) Section

## What Changed

- Migrated to Electron for a native desktop experience.
- Automated scraping and parsing of VPN server lists.
- Added config override logic for better compatibility.
- Integrated OpenVPN process management (including Windows support).
- Improved UI for picking and connecting to servers.

## License

MIT

---

Let me know if you want to add more technical details, usage instructions, or screenshots!
