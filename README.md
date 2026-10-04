# Baladio Installer

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-32.x-47848F?logo=electron&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

</div>

This is the official Windows GUI installer for [Baladio](https://github.com/rxdwan/Baladio), built with Electron.

It provides a seamless, one-click installation experience that handles all dependencies automatically in the background.

## Features

- **Automated Dependency Resolution:** Checks for Git and Node.js. If missing, it silently installs them via `winget`.
- **Background Cloning:** Automatically clones the latest Baladio repository directly into your `C:\Users\{Username}\Music\Baladio` folder.
- **Dependency Installation:** Runs `npm install` automatically in the cloned repository.
- **Auto-Start Configuration:** Creates a silent VBScript in the Windows Startup folder so the Baladio server automatically runs in the background every time you boot your PC.
- **Sleek UI:** Built with a clean, light-themed glassmorphism interface with real-time progress reporting.

## How to Build the Installer Binary

You can build a standalone Windows executable (`.exe`) using `electron-builder`.

> Or just download the latest installer from [Releases](/releases)

### Prerequisites

Make sure you have Node.js installed on your machine.

### 1. Install Dependencies

Navigate to this installer directory and install the required npm packages:

```bash
cd path/to/.installer
npm install
npm install electron-builder --save-dev
```

### 2. Build the Executable

Run the build script:

```bash
npm run build
```

This will generate a `dist` folder. Inside, you will find `Baladio Installer Setup 1.0.0.exe` — this is your final, distributable installer!

## How to Run in Development Mode

If you want to test or modify the installer UI without building the `.exe`:

```bash
npm install
npm start
```

---

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

