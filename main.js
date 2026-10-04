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

ipcMain.handle('start-installation', async (event) => {
    const sendProgress = (step, progress, details) => {
        mainWindow.webContents.send('install-progress', { step, progress, details });
    };

    const targetDir = path.join(os.homedir(), 'Music', 'Baladio');

    try {
        // Step 1: Check dependencies
        sendProgress('checking', 5, 'Checking for Git and Node.js...');
        const hasGit = await checkCommandExists('git');
        const hasNode = await checkCommandExists('node');

        // Step 2: Install Git if needed
        if (!hasGit) {
            sendProgress('installing-git', 15, 'Installing Git via winget (this may take a few minutes)...');
            await runCommand('winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements', (data) => {
                sendProgress('installing-git', 15, `Installing Git... \n${data.substring(0, 80)}...`);
            });
        }

        // Step 3: Install Node.js if needed
        if (!hasNode) {
            sendProgress('installing-node', 30, 'Installing Node.js via winget...');
            await runCommand('winget install --id OpenJS.NodeJS -e --source winget --accept-package-agreements --accept-source-agreements', (data) => {
                sendProgress('installing-node', 30, `Installing Node.js... \n${data.substring(0, 80)}...`);
            });
        }

        // Step 4: Clone Repository
        sendProgress('cloning', 50, 'Cloning Baladio repository to Music folder...');
        if (!fs.existsSync(targetDir)) {
            let gitCmd = hasGit ? 'git' : '"C:\\Program Files\\Git\\cmd\\git.exe"';
            await runCommand(`${gitCmd} clone https://github.com/rxdwan/Baladio.git "${targetDir}"`, (data) => {
                sendProgress('cloning', 50, `Cloning... \n${data}`);
            });
        } else {
            sendProgress('cloning', 60, 'Baladio folder already exists, pulling latest...');
            let gitCmd = hasGit ? 'git' : '"C:\\Program Files\\Git\\cmd\\git.exe"';
            await runCommand(`cd /d "${targetDir}" && ${gitCmd} pull`, (data) => {});
        }

        // Step 5: Install npm packages
        sendProgress('npm-install', 70, 'Installing npm dependencies...');
        let npmCmd = hasNode ? 'npm' : '"C:\\Program Files\\nodejs\\npm.cmd"';
        await runCommand(`cd /d "${targetDir}" && ${npmCmd} install`, (data) => {
            sendProgress('npm-install', 75, `Installing dependencies... \n${data.substring(0, 100)}`);
        });

        // Step 6: Create Startup Script
        sendProgress('startup', 90, 'Configuring auto-start on Windows login...');
        const startupFolder = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        const vbsPath = path.join(startupFolder, 'BaladioStartup.vbs');
        
        // Read the robust template
        const templatePath = path.join(__dirname, 'scripts', 'startup.vbs');
        let vbsContent = fs.readFileSync(templatePath, 'utf-8');
        
        // Inject the absolute target directory into the script
        // Replacing the line: appDir = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\Music\music_player"
        vbsContent = vbsContent.replace(/appDir\s*=\s*.*/, `appDir = "${targetDir}"`);
        
        fs.writeFileSync(vbsPath, vbsContent, 'utf-8');

        sendProgress('done', 100, 'Installation complete! You can now start Baladio.');
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
});
