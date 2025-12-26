// src/detector/heuristics/unity.ts
// Detector de projetos Unity

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ProjectType } from '../../core/types';

interface DetectionResult {
    type: ProjectType;
    confidence: number;
    detectedFiles: string[];
}

/**
 * Detecta projetos Unity
 * 
 * Indicadores:
 * - Diretório ProjectSettings/
 * - Diretório Assets/
 * - Packages/manifest.json
 * - Arquivos .unity, .meta
 */
export async function detectUnityProject(projectPath: string): Promise<DetectionResult | null> {
    let confidence = 0;
    const detectedFiles: string[] = [];

    // Verifica diretório ProjectSettings (indicador muito forte)
    const projectSettingsDir = join(projectPath, 'ProjectSettings');
    if (existsSync(projectSettingsDir)) {
        confidence += 40;

        // Verifica ProjectSettings.asset
        const projectSettingsAsset = join(projectSettingsDir, 'ProjectSettings.asset');
        if (existsSync(projectSettingsAsset)) {
            confidence += 20;
            detectedFiles.push(projectSettingsAsset);
        }
    }

    // Verifica diretório Assets (indicador forte)
    const assetsDir = join(projectPath, 'Assets');
    if (existsSync(assetsDir)) {
        confidence += 25;

        // Verifica se há arquivos .unity (cenas)
        try {
            const files = readdirSync(assetsDir, { recursive: true }) as string[];
            const unityScenes = files.filter(f => f.endsWith('.unity'));

            if (unityScenes.length > 0) {
                confidence += 15;
                detectedFiles.push(...unityScenes.slice(0, 3).map(f => join(assetsDir, f)));
            }
        } catch {
            // Ignora
        }
    }

    // Verifica Packages/manifest.json (Unity Package Manager)
    const packagesManifest = join(projectPath, 'Packages', 'manifest.json');
    if (existsSync(packagesManifest)) {
        confidence += 15;
        detectedFiles.push(packagesManifest);

        // Verifica conteúdo do manifest
        try {
            const content = readFileSync(packagesManifest, 'utf-8');
            const manifest = JSON.parse(content);

            // Verifica dependências Unity típicas
            if (manifest.dependencies?.['com.unity.modules.core']) {
                confidence += 10;
            }
        } catch {
            // Ignora
        }
    }

    // Verifica arquivos .meta (Unity metadata)
    try {
        const files = readdirSync(projectPath) as string[];
        const metaFiles = files.filter(f => f.endsWith('.meta'));

        if (metaFiles.length > 0) {
            confidence += 10;
        }
    } catch {
        // Ignora
    }

    // Verifica UserSettings/
    if (existsSync(join(projectPath, 'UserSettings'))) {
        confidence += 5;
    }

    if (confidence === 0) return null;

    return {
        type: 'unity',
        confidence: Math.min(confidence, 100),
        detectedFiles
    };
}
