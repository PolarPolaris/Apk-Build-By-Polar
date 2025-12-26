// src/detector/heuristics/web.ts
// Detector de projetos Web (HTML/CSS/JS)

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ProjectType } from '../../core/types';

interface DetectionResult {
    type: ProjectType;
    confidence: number;
    detectedFiles: string[];
}

/**
 * Detecta projetos Web (HTML/CSS/JS para WebView/Capacitor)
 * 
 * Indicadores:
 * - index.html presente
 * - package.json SEM react-native
 * - Arquivos .html, .css, .js
 * - Estrutura típica de SPA (src/, dist/, public/)
 */
export async function detectWebProject(projectPath: string): Promise<DetectionResult | null> {
    let confidence = 0;
    const detectedFiles: string[] = [];

    // Verifica index.html (indicador forte)
    const indexPaths = [
        join(projectPath, 'index.html'),
        join(projectPath, 'public', 'index.html'),
        join(projectPath, 'src', 'index.html'),
        join(projectPath, 'dist', 'index.html')
    ];

    for (const indexPath of indexPaths) {
        if (existsSync(indexPath)) {
            confidence += 40;
            detectedFiles.push(indexPath);
            break;
        }
    }

    // Verifica package.json
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
        try {
            const content = readFileSync(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content);

            // Se tem react-native, NÃO é um projeto web puro
            if (pkg.dependencies?.['react-native'] || pkg.devDependencies?.['react-native']) {
                return null; // Deixa o detector de RN lidar com isso
            }

            // Se tem expo, NÃO é um projeto web puro
            if (pkg.dependencies?.['expo'] || pkg.devDependencies?.['expo']) {
                return null;
            }

            confidence += 20;
            detectedFiles.push(packageJsonPath);

            // Frameworks web comuns aumentam confiança
            const webFrameworks = ['vue', 'react', 'angular', 'svelte', 'solid-js', 'preact'];
            for (const fw of webFrameworks) {
                if (pkg.dependencies?.[fw] || pkg.devDependencies?.[fw]) {
                    confidence += 15;
                    break;
                }
            }

        } catch {
            // Ignora erro de parse
        }
    }

    // Verifica arquivos web típicos
    try {
        const files = readdirSync(projectPath, { recursive: true }) as string[];

        const htmlFiles = files.filter(f => f.endsWith('.html'));
        const cssFiles = files.filter(f => f.endsWith('.css') || f.endsWith('.scss') || f.endsWith('.less'));
        const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx'));

        if (htmlFiles.length > 0) confidence += 10;
        if (cssFiles.length > 0) confidence += 5;
        if (jsFiles.length > 0) confidence += 5;

    } catch {
        // Ignora erro de leitura
    }

    // Verifica diretórios típicos de projetos web
    const webDirs = ['public', 'static', 'assets', 'src', 'dist', 'build'];
    for (const dir of webDirs) {
        if (existsSync(join(projectPath, dir))) {
            confidence += 2;
        }
    }

    if (confidence === 0) return null;

    return {
        type: 'web',
        confidence: Math.min(confidence, 100),
        detectedFiles
    };
}
