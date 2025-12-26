// src/preload/index.ts
// Electron preload script - expõe APIs seguras para o renderer

import { contextBridge, ipcRenderer } from 'electron';
import type { BuildOptions, BuildResult, ProjectInfo, BuildProgress } from '../core/types';

// API exposta para o renderer
const electronAPI = {
    // Verifica ambiente
    verifyEnvironment: (): Promise<{ valid: boolean; missing: string[] }> =>
        ipcRenderer.invoke('verify-environment'),

    // Detecta projeto
    detectProject: (projectPath: string): Promise<ProjectInfo> =>
        ipcRenderer.invoke('detect-project', projectPath),

    // Seletores de arquivo
    selectFolder: (): Promise<string | null> =>
        ipcRenderer.invoke('select-folder'),

    selectIcon: (): Promise<string | null> =>
        ipcRenderer.invoke('select-icon'),

    selectKeystore: (): Promise<string | null> =>
        ipcRenderer.invoke('select-keystore'),

    // Build
    startBuild: (projectPath: string, options: Partial<BuildOptions>): Promise<BuildResult> =>
        ipcRenderer.invoke('start-build', projectPath, options),

    // Listener de progresso
    onBuildProgress: (callback: (progress: BuildProgress) => void): void => {
        ipcRenderer.on('build-progress', (_, progress) => callback(progress));
    },

    // Remove listener
    offBuildProgress: (): void => {
        ipcRenderer.removeAllListeners('build-progress');
    },

    // Abre pasta do output
    openOutputFolder: (apkPath: string): Promise<void> =>
        ipcRenderer.invoke('open-output-folder', apkPath)
};

// Expõe API para o renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Tipos para TypeScript
declare global {
    interface Window {
        electronAPI: typeof electronAPI;
    }
}
