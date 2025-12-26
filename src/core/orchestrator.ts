// src/core/orchestrator.ts
// Orquestrador principal de builds

import { EventEmitter } from 'events';
import type {
    ProjectInfo,
    BuildOptions,
    BuildResult,
    BuildProgress,
    OfflineEnvironment,
    BuildPipeline
} from './types';
import { getOfflineEnvironment, applyEnvironment, verifyEnvironment } from './environment';
import { detectProject } from '../detector/index';
import { WebPipeline } from '../runners/web-pipeline';
import { NdkPipeline } from '../runners/ndk-pipeline';
import { MauiPipeline } from '../runners/maui-pipeline';
import { ReactNativePipeline } from '../runners/rn-pipeline';
import { UnityPipeline } from '../runners/unity-pipeline';
import { createLogger } from './logger';

const logger = createLogger('orchestrator');

export class BuildOrchestrator extends EventEmitter {
    private env: OfflineEnvironment;
    private pipelines: Map<string, BuildPipeline>;

    constructor() {
        super();
        this.env = getOfflineEnvironment();
        this.pipelines = new Map();

        // Registra pipelines para cada tipo de projeto
        this.pipelines.set('web', new WebPipeline());
        this.pipelines.set('ndk', new NdkPipeline());
        this.pipelines.set('maui', new MauiPipeline());
        this.pipelines.set('reactnative', new ReactNativePipeline());
        this.pipelines.set('unity', new UnityPipeline());
    }

    /**
     * Emite progresso de build
     */
    private emitProgress(stage: string, percent: number, message: string): void {
        const progress: BuildProgress = { stage, percent, message };
        this.emit('progress', progress);
        logger.info(`[${percent}%] ${stage}: ${message}`);
    }

    /**
     * Detecta o tipo de projeto
     */
    async detectProject(projectPath: string): Promise<ProjectInfo> {
        this.emitProgress('Detecção', 0, 'Analisando estrutura do projeto...');
        const info = await detectProject(projectPath);
        this.emitProgress('Detecção', 10, `Tipo detectado: ${info.type} (${info.confidence}% confiança)`);
        return info;
    }

    /**
     * Verifica ambiente antes do build
     */
    verifyEnvironment(): { valid: boolean; missing: string[] } {
        return verifyEnvironment(this.env);
    }

    /**
     * Executa o build completo
     */
    async build(projectPath: string, options: BuildOptions): Promise<BuildResult> {
        const startTime = Date.now();

        try {
            // Verifica ambiente
            this.emitProgress('Verificação', 5, 'Verificando SDKs embutidos...');
            const envCheck = this.verifyEnvironment();
            if (!envCheck.valid) {
                return {
                    success: false,
                    errors: [`SDKs faltando: ${envCheck.missing.join(', ')}`],
                    warnings: [],
                    buildTime: Date.now() - startTime
                };
            }

            // Aplica ambiente offline
            applyEnvironment(this.env);

            // Detecta projeto
            const projectInfo = await this.detectProject(projectPath);

            if (projectInfo.type === 'unknown') {
                return {
                    success: false,
                    errors: ['Tipo de projeto não reconhecido'],
                    warnings: [],
                    buildTime: Date.now() - startTime
                };
            }

            // Obtém pipeline apropriado
            const pipeline = this.pipelines.get(projectInfo.type);
            if (!pipeline) {
                return {
                    success: false,
                    errors: [`Pipeline não disponível para tipo: ${projectInfo.type}`],
                    warnings: [],
                    buildTime: Date.now() - startTime
                };
            }

            // Prepara projeto
            this.emitProgress('Preparação', 20, 'Preparando arquivos do projeto...');
            await pipeline.prepare(projectPath);

            // Configura build
            this.emitProgress('Configuração', 30, 'Gerando configurações (Manifest, Gradle, ícones)...');
            await pipeline.configure(options);

            // Executa build
            this.emitProgress('Compilação', 50, 'Compilando projeto...');
            const result = await pipeline.build(this.env);

            if (!result.success) {
                return result;
            }

            // Assina APK
            this.emitProgress('Assinatura', 90, 'Assinando APK...');
            const signedApk = await pipeline.sign(result.apkPath!, options);

            // Organiza saída: Cria pasta com nome do App e coloca o APK dentro
            const { mkdirSync, copyFileSync, existsSync } = require('fs');
            const { dirname, join } = require('path');

            // Define pasta de destino (ex: .../outputs/apk/debug/NomeDoApp/)
            const outputDir = join(dirname(signedApk), options.appName);
            if (!existsSync(outputDir)) {
                mkdirSync(outputDir, { recursive: true });
            }

            // Define caminho final (ex: .../NomeDoApp/NomeDoApp.apk)
            const finalApkName = `${options.appName}.apk`;
            const finalApkPath = join(outputDir, finalApkName);

            copyFileSync(signedApk, finalApkPath);

            this.emitProgress('Concluído', 100, 'Build finalizado com sucesso!');

            return {
                ...result,
                apkPath: finalApkPath,
                buildTime: Date.now() - startTime
            };

        } catch (error) {
            logger.error('Erro durante build:', error);
            return {
                success: false,
                errors: [error instanceof Error ? error.message : String(error)],
                warnings: [],
                buildTime: Date.now() - startTime
            };
        }
    }
}

// Instância singleton
export const orchestrator = new BuildOrchestrator();
