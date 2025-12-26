// src/detector/index.ts
// Detector principal de projetos

import { join } from 'path';
import type { ProjectInfo, ProjectType } from '../core/types';
import { detectWebProject } from './heuristics/web';
import { detectNdkProject } from './heuristics/ndk';
import { detectMauiProject } from './heuristics/maui';
import { detectReactNativeProject } from './heuristics/reactnative';
import { detectUnityProject } from './heuristics/unity';
import { createLogger } from '../core/logger';

const logger = createLogger('detector');

interface DetectionResult {
    type: ProjectType;
    confidence: number;
    detectedFiles: string[];
}

/**
 * Detecta o tipo de projeto automaticamente
 */
export async function detectProject(projectPath: string): Promise<ProjectInfo> {
    logger.info(`Detectando projeto em: ${projectPath}`);

    const detectors = [
        detectWebProject,
        detectNdkProject,
        detectMauiProject,
        detectReactNativeProject,
        detectUnityProject
    ];

    const results: DetectionResult[] = [];

    for (const detector of detectors) {
        try {
            const result = await detector(projectPath);
            if (result && result.confidence > 0) {
                results.push(result);
            }
        } catch (error) {
            logger.warn(`Erro em detector:`, error);
        }
    }

    // Ordena por confiança (maior primeiro)
    results.sort((a, b) => b.confidence - a.confidence);

    if (results.length === 0) {
        return {
            path: projectPath,
            type: 'unknown',
            confidence: 0,
            detectedFiles: [],
            suggestedName: extractProjectName(projectPath)
        };
    }

    const best = results[0];

    return {
        path: projectPath,
        type: best.type,
        confidence: best.confidence,
        detectedFiles: best.detectedFiles,
        suggestedName: extractProjectName(projectPath)
    };
}

/**
 * Extrai nome sugerido do caminho do projeto
 */
function extractProjectName(projectPath: string): string {
    const parts = projectPath.split(/[/\\]/);
    const name = parts[parts.length - 1] || 'MeuApp';
    return name.replace(/[^a-zA-Z0-9]/g, '');
}
