// src/detector/heuristics/maui.ts
// Detector de projetos MAUI/Xamarin (C#)

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ProjectType } from '../../core/types';

interface DetectionResult {
    type: ProjectType;
    confidence: number;
    detectedFiles: string[];
}

/**
 * Detecta projetos MAUI/Xamarin (C#)
 * 
 * Indicadores:
 * - Arquivos .csproj
 * - MAUIProgram.cs / MauiProgram.cs
 * - Referências a Microsoft.Maui
 * - Diretório Platforms/Android
 */
export async function detectMauiProject(projectPath: string): Promise<DetectionResult | null> {
    let confidence = 0;
    const detectedFiles: string[] = [];

    // Procura arquivos .csproj
    let csprojFiles: string[] = [];
    try {
        const files = readdirSync(projectPath, { recursive: true }) as string[];
        csprojFiles = files.filter(f => f.endsWith('.csproj'));
    } catch {
        return null;
    }

    if (csprojFiles.length === 0) return null;

    // Analisa cada .csproj
    for (const csprojFile of csprojFiles) {
        const csprojPath = join(projectPath, csprojFile);
        detectedFiles.push(csprojPath);

        try {
            const content = readFileSync(csprojPath, 'utf-8');

            // Verifica se é projeto MAUI
            if (content.includes('Microsoft.Maui') || content.includes('UseMaui')) {
                confidence += 50;
            }

            // Verifica se é Xamarin.Forms
            if (content.includes('Xamarin.Forms')) {
                confidence += 40;
            }

            // Verifica target Android
            if (content.includes('net8.0-android') || content.includes('net7.0-android') || content.includes('monoandroid')) {
                confidence += 20;
            }

        } catch {
            // Ignora erro de leitura
        }
    }

    // Verifica MauiProgram.cs
    const mauiProgramPaths = [
        join(projectPath, 'MauiProgram.cs'),
        join(projectPath, 'MAUIProgram.cs')
    ];

    for (const mp of mauiProgramPaths) {
        if (existsSync(mp)) {
            confidence += 30;
            detectedFiles.push(mp);
            break;
        }
    }

    // Verifica diretório Platforms/Android
    const platformsAndroid = join(projectPath, 'Platforms', 'Android');
    if (existsSync(platformsAndroid)) {
        confidence += 15;
    }

    // Verifica arquivos .cs
    try {
        const files = readdirSync(projectPath, { recursive: true }) as string[];
        const csFiles = files.filter(f => f.endsWith('.cs'));

        if (csFiles.length > 0) {
            confidence += Math.min(csFiles.length, 10);
        }
    } catch {
        // Ignora
    }

    if (confidence === 0) return null;

    return {
        type: 'maui',
        confidence: Math.min(confidence, 100),
        detectedFiles
    };
}
