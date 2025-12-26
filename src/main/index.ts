// src/main/index.ts
// Electron main process

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { orchestrator } from '../core/orchestrator';
import { detectProject } from '../detector/index';
import { getOfflineEnvironment, verifyEnvironment } from '../core/environment';
import { DEFAULT_BUILD_OPTIONS } from '../core/types';
import type { BuildOptions, ProjectInfo, BuildProgress } from '../core/types';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    const preloadPath = join(__dirname, '../preload/index.mjs');
    console.log('Preload path:', preloadPath);

    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 600,
        minHeight: 500,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#1a1a2e',
        show: false
    });

    // Em desenvolvimento, carrega do dev server
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers

// Verifica ambiente (SDKs instalados)
ipcMain.handle('verify-environment', async () => {
    const env = getOfflineEnvironment();
    return verifyEnvironment(env);
});

// Detecta tipo de projeto
ipcMain.handle('detect-project', async (_, projectPath: string) => {
    const { statSync, copyFileSync, mkdirSync, mkdtempSync } = await import('fs');
    const { dirname, join, extname, basename } = await import('path');
    const { tmpdir } = await import('os');

    try {
        const stats = statSync(projectPath);

        // Se for arquivo, tratamento especial
        if (stats.isFile()) {
            const ext = extname(projectPath).toLowerCase();

            // Se for arquivo HTML, cria projeto temporário isolado
            if (ext === '.html' || ext === '.htm') {
                const tempDir = mkdtempSync(join(tmpdir(), 'apk-builder-quick-'));
                const targetIndex = join(tempDir, 'index.html');

                // Copia o arquivo original para index.html na pasta temp
                copyFileSync(projectPath, targetIndex);

                console.log(`Projeto rápido criado em: ${tempDir} a partir de ${projectPath}`);

                // Retorna detecção direta
                return detectProject(tempDir);
            }

            // Para outros arquivos, usa o diretório pai (com risco de ser Desktop, mas menos crítico pra não-HTML geralmente)
            // Mas idealmente deveríamos limitar. Por enquanto, mantemos comportamento anterior para não-HTML.
            return detectProject(dirname(projectPath));
        }

        return detectProject(projectPath);
    } catch (error) {
        console.error('Erro ao verificar caminho:', error);
        return null;
    }
});

// Abre diálogo para selecionar pasta
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory'],
        title: 'Selecione a pasta do projeto'
    });

    return result.canceled ? null : result.filePaths[0];
});

// Abre diálogo para selecionar arquivo de ícone
ipcMain.handle('select-icon', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        title: 'Selecione o ícone do app',
        filters: [
            { name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'svg'] }
        ]
    });

    return result.canceled ? null : result.filePaths[0];
});

// Abre diálogo para selecionar keystore
ipcMain.handle('select-keystore', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        title: 'Selecione o arquivo keystore',
        filters: [
            { name: 'Keystore', extensions: ['jks', 'keystore'] }
        ]
    });

    return result.canceled ? null : result.filePaths[0];
});

// Inicia build
ipcMain.handle('start-build', async (_, projectPath: string, options: Partial<BuildOptions>) => {
    const fullOptions: BuildOptions = {
        ...DEFAULT_BUILD_OPTIONS,
        ...options
    } as BuildOptions;

    // Registra listener de progresso
    const progressHandler = (progress: BuildProgress) => {
        mainWindow?.webContents.send('build-progress', progress);
    };

    orchestrator.on('progress', progressHandler);

    try {
        const result = await orchestrator.build(projectPath, fullOptions);
        return result;
    } finally {
        orchestrator.off('progress', progressHandler);
    }
});

// Abre pasta do APK gerado
ipcMain.handle('open-output-folder', async (_, apkPath: string) => {
    const { shell } = await import('electron');
    shell.showItemInFolder(apkPath);
});
