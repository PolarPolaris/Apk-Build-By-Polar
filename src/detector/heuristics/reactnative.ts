// src/detector/heuristics/reactnative.ts
// Detector de projetos React Native / Expo

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ProjectType } from '../../core/types';

interface DetectionResult {
    type: ProjectType;
    confidence: number;
    detectedFiles: string[];
}

/**
 * Detecta projetos React Native / Expo
 * 
 * Indicadores:
 * - package.json com react-native ou expo
 * - Diretório android/
 * - app.json / app.config.js (Expo)
 * - metro.config.js
 */
export async function detectReactNativeProject(projectPath: string): Promise<DetectionResult | null> {
    let confidence = 0;
    const detectedFiles: string[] = [];

    // Verifica package.json
    const packageJsonPath = join(projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) return null;

    try {
        const content = readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Verifica react-native
        if (pkg.dependencies?.['react-native'] || pkg.devDependencies?.['react-native']) {
            confidence += 50;
            detectedFiles.push(packageJsonPath);
        }

        // Verifica expo
        if (pkg.dependencies?.['expo'] || pkg.devDependencies?.['expo']) {
            confidence += 40;
            detectedFiles.push(packageJsonPath);
        }

        // Verifica @react-native-community packages
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const rnPackages = Object.keys(deps).filter(k =>
            k.startsWith('@react-native-community/') ||
            k.startsWith('react-native-')
        );

        if (rnPackages.length > 0) {
            confidence += Math.min(rnPackages.length * 5, 20);
        }

    } catch {
        return null;
    }

    if (confidence === 0) return null;

    // Verifica diretório android/
    const androidDir = join(projectPath, 'android');
    if (existsSync(androidDir)) {
        confidence += 15;

        // Verifica build.gradle
        if (existsSync(join(androidDir, 'build.gradle')) || existsSync(join(androidDir, 'build.gradle.kts'))) {
            confidence += 10;
        }
    }

    // Verifica app.json (Expo)
    const appJsonPath = join(projectPath, 'app.json');
    if (existsSync(appJsonPath)) {
        confidence += 10;
        detectedFiles.push(appJsonPath);
    }

    // Verifica app.config.js (Expo)
    const appConfigPath = join(projectPath, 'app.config.js');
    if (existsSync(appConfigPath)) {
        confidence += 10;
        detectedFiles.push(appConfigPath);
    }

    // Verifica metro.config.js
    const metroConfigPath = join(projectPath, 'metro.config.js');
    if (existsSync(metroConfigPath)) {
        confidence += 5;
        detectedFiles.push(metroConfigPath);
    }

    // Verifica eas.json (Expo Application Services)
    const easJsonPath = join(projectPath, 'eas.json');
    if (existsSync(easJsonPath)) {
        confidence += 10;
        detectedFiles.push(easJsonPath);
    }

    return {
        type: 'reactnative',
        confidence: Math.min(confidence, 100),
        detectedFiles
    };
}
