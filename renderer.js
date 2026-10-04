document.addEventListener('DOMContentLoaded', async () => {
    const installPathDisplay = document.getElementById('install-path-display');
    installPathDisplay.textContent = await window.electronAPI.getInstallPath();

    const repoUrl = 'https://github.com/rxdwan/Baladio';

    document.getElementById('link-repo').addEventListener('click', (e) => {
        e.preventDefault();
        window.electronAPI.openExternal(repoUrl);
    });

    document.getElementById('btn-open-repo').addEventListener('click', () => {
        window.electronAPI.openExternal(repoUrl);
    });

    const stepWelcome = document.getElementById('step-welcome');
    const stepProgress = document.getElementById('step-progress');
    const stepDone = document.getElementById('step-done');
    const stepError = document.getElementById('step-error');

    function showStep(stepEl) {
        [stepWelcome, stepProgress, stepDone, stepError].forEach(el => el.classList.remove('active'));
        stepEl.classList.add('active');
    }

    document.getElementById('btn-start').addEventListener('click', async () => {
        showStep(stepProgress);
        
        const result = await window.electronAPI.startInstallation();
        
        if (result.success) {
            showStep(stepDone);
        } else {
            document.getElementById('error-message').textContent = result.error;
            showStep(stepError);
        }
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
        showStep(stepWelcome);
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('progress-percent').textContent = '0%';
        document.getElementById('progress-status').textContent = 'Preparing...';
        document.getElementById('progress-details').textContent = '';
    });

    document.getElementById('btn-finish').addEventListener('click', () => {
        window.close();
    });

    window.electronAPI.onInstallProgress((data) => {
        document.getElementById('progress-fill').style.width = `${data.progress}%`;
        document.getElementById('progress-percent').textContent = `${data.progress}%`;
        
        if (data.details) {
            const detailsEl = document.getElementById('progress-details');
            detailsEl.textContent = data.details;
            detailsEl.scrollTop = detailsEl.scrollHeight;
        }

        const stepsMap = {
            'checking': 'Checking dependencies...',
            'installing-git': 'Installing Git...',
            'installing-node': 'Installing Node.js...',
            'installing-ytdlp': 'Installing yt-dlp...',
            'cloning': 'Cloning Baladio repository...',
            'npm-install': 'Installing npm dependencies...',
            'startup': 'Configuring auto-start...',
            'done': 'Finishing up...'
        };

        if (stepsMap[data.step]) {
            document.getElementById('progress-status').textContent = stepsMap[data.step];
        }
    });
});
