const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 620,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        resizable: false,
        title: "Baladio Installer"
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

ipcMain.handle('get-install-path', () => {
    return path.join(os.homedir(), 'Music', 'Baladio');
});

function runCommand(command, onData) {
    return new Promise((resolve, reject) => {
        const proc = exec(command, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer
        
        proc.stdout.on('data', (data) => {
            if (onData) onData(data.toString());
        });
        
        proc.stderr.on('data', (data) => {
            if (onData) onData(data.toString());
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });
    });
}

async function checkCommandExists(command) {
    try {
        await runCommand(`where ${command}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Returns the best usable path to a command.
 * - First checks if it is already on PATH (works for pre-installed tools).
 * - If not, probes each fallback path in order.
 * - Throws a clear error if nothing works, so the user gets a meaningful message.
 */
async function resolveCommand(command, fallbackPaths = []) {
    // 1. Is it already on PATH in the current session?
    if (await checkCommandExists(command)) return command;

    // 2. Probe known fallback locations (e.g. just installed by winget this session)
    for (const candidate of fallbackPaths) {
        if (fs.existsSync(candidate)) return `"${candidate}"`;
    }

    // 3. Nothing worked — tell the user exactly what failed
    throw new Error(
        `Could not find "${command}" on PATH or in any known install location.\n` +
        `Tried: ${fallbackPaths.join(', ')}\n\n` +
        `Please restart your PC after installation to refresh the PATH, then re-run Baladio manually.`
    );
}


ipcMain.handle('start-installation', async (event) => {
    const sendProgress = (step, progress, details) => {
        mainWindow.webContents.send('install-progress', { step, progress, details });
    };

    const targetDir = path.join(os.homedir(), 'Music', 'Baladio');

    try {
        // Step 1: Check all dependencies
        sendProgress('checking', 5, 'Checking for Git, Node.js, and yt-dlp...');
        const hasGit = await checkCommandExists('git');
        const hasNode = await checkCommandExists('node');
        const hasYtDlp = await checkCommandExists('yt-dlp');

        // Step 2: Install Git if needed
        if (!hasGit) {
            sendProgress('installing-git', 12, 'Installing Git via winget (this may take a few minutes)...');
            await runCommand('winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements', (data) => {
                sendProgress('installing-git', 12, `Installing Git...\n${data.substring(0, 120)}`);
            });
        }

        // Step 3: Install Node.js if needed
        if (!hasNode) {
            sendProgress('installing-node', 25, 'Installing Node.js via winget...');
            await runCommand('winget install --id OpenJS.NodeJS -e --source winget --accept-package-agreements --accept-source-agreements', (data) => {
                sendProgress('installing-node', 25, `Installing Node.js...\n${data.substring(0, 120)}`);
            });
        }

        // Step 4: Install yt-dlp (standalone .exe — no pip required)
        if (!hasYtDlp) {
            sendProgress('installing-ytdlp', 38, 'Downloading yt-dlp standalone binary from GitHub...');
            // Install to a user-writable location (no admin rights needed)
            const ytdlpDir = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'yt-dlp');
            const ytdlpExe = path.join(ytdlpDir, 'yt-dlp.exe');
            if (!fs.existsSync(ytdlpDir)) fs.mkdirSync(ytdlpDir, { recursive: true });

            // Download the official standalone Windows exe from GitHub Releases
            await runCommand(
                `powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '${ytdlpExe}'"`,
                (data) => sendProgress('installing-ytdlp', 44, `Downloading yt-dlp.exe...\n${data}`)
            );

            // Add yt-dlp directory to the user PATH permanently (no admin needed)
            sendProgress('installing-ytdlp', 48, 'Adding yt-dlp to user PATH...');
            await runCommand(
                `powershell -Command "$p = [Environment]::GetEnvironmentVariable('PATH','User'); if ($p -notlike '*yt-dlp*') { [Environment]::SetEnvironmentVariable('PATH', $p + ';${ytdlpDir}', 'User') }"`,
                () => {}
            );
        } else {
            // Already installed — update it silently
            sendProgress('installing-ytdlp', 38, 'yt-dlp already installed — updating to latest version...');
            await runCommand('yt-dlp -U', () => {}).catch(() => {}); // non-fatal if it fails
        }

        // Step 5: Clone Repository — resolve git from PATH or known install locations
        sendProgress('cloning', 55, 'Cloning Baladio repository to Music folder...');
        const gitCmd = await resolveCommand('git', [
            'C:\\Program Files\\Git\\cmd\\git.exe',
            'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
        ]);

        if (!fs.existsSync(targetDir)) {
            await runCommand(`${gitCmd} clone https://github.com/rxdwan/Baladio.git "${targetDir}"`, (data) => {
                sendProgress('cloning', 62, `Cloning...\n${data}`);
            });
        } else {
            sendProgress('cloning', 62, 'Baladio folder already exists — pulling latest changes...');
            await runCommand(`${gitCmd} -C "${targetDir}" pull`, () => {});
        }

        // Step 6: Install npm packages — resolve npm from PATH or known install locations
        // ffmpeg-static is bundled as an npm package — no separate ffmpeg install needed
        sendProgress('npm-install', 75, 'Installing npm dependencies (includes bundled ffmpeg)...');
        const npmCmd = await resolveCommand('npm', [
            'C:\\Program Files\\nodejs\\npm.cmd',
            'C:\\Program Files (x86)\\nodejs\\npm.cmd',
            path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'npm.cmd'),
        ]);
        await runCommand(`${npmCmd} install --prefix "${targetDir}"`, (data) => {
            sendProgress('npm-install', 82, `Installing dependencies...\n${data.substring(0, 120)}`);
        });

        // Step 7: Create Windows Startup Script
        sendProgress('startup', 92, 'Configuring auto-start on Windows login...');
        const startupFolder = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        const vbsPath = path.join(startupFolder, 'BaladioStartup.vbs');

        const templatePath = path.join(__dirname, 'scripts', 'startup.vbs');
        let vbsContent = fs.readFileSync(templatePath, 'utf-8');
        vbsContent = vbsContent.replace(/appDir\s*=\s*.*/, `appDir = "${targetDir}"`);
        fs.writeFileSync(vbsPath, vbsContent, 'utf-8');

        sendProgress('done', 100, 'Installation complete! Baladio will auto-start next time you log in.');
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
});

