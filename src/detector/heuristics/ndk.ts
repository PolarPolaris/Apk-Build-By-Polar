// src/detector/heuristics/ndk.ts
// Detector de projetos NDK (C/C++)

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ProjectType } from '../../core/types';

interface DetectionResult {
    type: ProjectType;
    confidence: number;
    detectedFiles: string[];
}

/**
 * Detecta projetos NDK (C/C++ nativo)
 * 
 * Indicadores:
 * - Arquivos .c, .cpp, .h, .hpp
 * - CMakeLists.txt
 * - Android.mk / Application.mk
 * - Diretório jni/
 */
export async function detectNdkProject(projectPath: string): Promise<DetectionResult | null> {
    let confidence = 0;
    const detectedFiles: string[] = [];

    // Verifica CMakeLists.txt (indicador forte)
    const cmakePath = join(projectPath, 'CMakeLists.txt');
    if (existsSync(cmakePath)) {
        confidence += 35;
        detectedFiles.push(cmakePath);
    }

    // Verifica Android.mk (indicador forte - sistema de build antigo)
    const androidMkPaths = [
        join(projectPath, 'Android.mk'),
        join(projectPath, 'jni', 'Android.mk')
    ];

    for (const mkPath of androidMkPaths) {
        if (existsSync(mkPath)) {
            confidence += 30;
            detectedFiles.push(mkPath);
            break;
        }
    }

    // Verifica Application.mk
    const appMkPaths = [
        join(projectPath, 'Application.mk'),
        join(projectPath, 'jni', 'Application.mk')
    ];

    for (const mkPath of appMkPaths) {
        if (existsSync(mkPath)) {
            confidence += 15;
            detectedFiles.push(mkPath);
            break;
        }
    }

    // Verifica diretório jni/
    if (existsSync(join(projectPath, 'jni'))) {
        confidence += 15;
    }

    // Verifica arquivos C/C++
    try {
        const files = readdirSync(projectPath, { recursive: true }) as string[];

        const cFiles = files.filter(f =>
            f.endsWith('.c') ||
            f.endsWith('.cpp') ||
            f.endsWith('.cc') ||
            f.endsWith('.cxx')
        );

        const headerFiles = files.filter(f =>
            f.endsWith('.h') ||
            f.endsWith('.hpp') ||
            f.endsWith('.hxx')
        );

        if (cFiles.length > 0) {
            confidence += Math.min(cFiles.length * 5, 25);
            detectedFiles.push(...cFiles.slice(0, 5).map(f => join(projectPath, f)));
        }

        if (headerFiles.length > 0) {
            confidence += Math.min(headerFiles.length * 2, 10);
        }

    } catch {
        // Ignora erro
    }

    if (confidence === 0) return null;

    return {
        type: 'ndk',
        confidence: Math.min(confidence, 100),
        detectedFiles
    };
}
