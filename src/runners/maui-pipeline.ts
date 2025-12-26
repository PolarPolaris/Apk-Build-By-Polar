// src/runners/maui-pipeline.ts
// Pipeline de build para projetos MAUI/Xamarin (C#)

import { existsSync, mkdirSync, cpSync, readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import type { BuildOptions, BuildResult, OfflineEnvironment } from '../core/types';
import { BasePipeline } from './base-pipeline';
import { getDebugKeystore, signApk } from '../generators/signing';
import { createLogger } from '../core/logger';

const logger = createLogger('maui-pipeline');

export class MauiPipeline extends BasePipeline {
    private csprojPath: string = '';

    async prepare(projectPath: string): Promise<void> {
        this.projectPath = projectPath;
        this.createBuildDir('maui');

        logger.info(`Preparando projeto MAUI: ${projectPath}`);

        // Copia projeto inteiro para build dir
        cpSync(projectPath, this.buildDir, { recursive: true });

        // Encontra arquivo .csproj
        this.findCsproj();

        logger.info('Projeto MAUI preparado');
    }

    private findCsproj(): void {
        const files = readdirSync(this.buildDir, { recursive: true }) as string[];
        const csprojFiles = files.filter(f => f.endsWith('.csproj'));

        if (csprojFiles.length === 0) {
            throw new Error('Nenhum arquivo .csproj encontrado');
        }

        // Prioriza projetos MAUI
        for (const csproj of csprojFiles) {
            const content = readFileSync(join(this.buildDir, csproj), 'utf-8');
            if (content.includes('Microsoft.Maui') || content.includes('UseMaui')) {
                this.csprojPath = join(this.buildDir, csproj);
                return;
            }
        }

        // Fallback para primeiro .csproj
        this.csprojPath = join(this.buildDir, csprojFiles[0]);
    }

    async configure(options: BuildOptions): Promise<void> {
        this.options = options;

        // MAUI usa sua própria configuração, apenas armazena opções
        logger.info('Configuração do projeto MAUI concluída');
    }

    async build(env: OfflineEnvironment): Promise<BuildResult> {
        logger.info('Iniciando build MAUI com dotnet...');

        const dotnetPath = join(env.DOTNET_ROOT, 'dotnet');
        const configuration = this.options?.signMode === 'release' ? 'Release' : 'Debug';

        // Restaura packages (offline)
        const restoreResult = await this.runCommand(
            dotnetPath,
            ['restore', '--source', join(env.DOTNET_ROOT, 'nuget-cache')],
            this.buildDir,
            { DOTNET_ROOT: env.DOTNET_ROOT }
        );

        if (restoreResult.code !== 0) {
            logger.warn('dotnet restore falhou, tentando sem cache...');
        }

        // Build para Android
        const buildArgs = [
            'build',
            this.csprojPath,
            '-c', configuration,
            '-f', 'net8.0-android',
            '-p:AndroidPackageFormat=apk',
            `-p:ApplicationId=${this.options?.packageName || 'com.maui.app'}`,
            `-p:ApplicationDisplayVersion=${this.options?.version || '1.0.0'}`,
            `-p:ApplicationVersion=${this.options?.versionCode || 1}`
        ];

        const buildResult = await this.runCommand(
            dotnetPath,
            buildArgs,
            this.buildDir,
            { DOTNET_ROOT: env.DOTNET_ROOT }
        );

        if (buildResult.code !== 0) {
            return {
                success: false,
                errors: ['dotnet build falhou', buildResult.stderr],
                warnings: [],
                buildTime: 0
            };
        }

        // Encontra APK gerado
        const apkPath = this.findGeneratedApk(configuration);

        if (!apkPath) {
            return {
                success: false,
                errors: ['APK MAUI não encontrado após build'],
                warnings: [],
                buildTime: 0
            };
        }

        return {
            success: true,
            apkPath,
            errors: [],
            warnings: [],
            buildTime: 0
        };
    }

    private findGeneratedApk(configuration: string): string | null {
        const searchDirs = [
            join(this.buildDir, 'bin', configuration, 'net8.0-android'),
            join(this.buildDir, 'bin', configuration, 'net7.0-android')
        ];

        for (const dir of searchDirs) {
            if (!existsSync(dir)) continue;

            const files = readdirSync(dir);
            const apk = files.find(f => f.endsWith('.apk') && !f.includes('Signed'));

            if (apk) {
                return join(dir, apk);
            }
        }

        return null;
    }

    async sign(apkPath: string, options: BuildOptions): Promise<string> {
        const env = require('../core/environment.js').getOfflineEnvironment();

        let keystore;
        if (options.signMode === 'debug') {
            keystore = getDebugKeystore(env);
        } else {
            keystore = {
                path: options.keystorePath!,
                password: options.keystorePassword!,
                alias: options.keyAlias!,
                keyPassword: options.keyPassword!
            };
        }

        const outputPath = apkPath.replace('.apk', '-signed.apk');
        return signApk(apkPath, keystore, outputPath, env);
    }
}
