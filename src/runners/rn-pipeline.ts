// src/runners/rn-pipeline.ts
// Pipeline de build para projetos React Native / Expo

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BuildOptions, BuildResult, OfflineEnvironment } from '../core/types';
import { BasePipeline } from './base-pipeline';
import {
    generateLocalProperties
} from '../generators/gradle';
import { getDebugKeystore, signApk } from '../generators/signing';
import { createLogger } from '../core/logger';

const logger = createLogger('rn-pipeline');

export class ReactNativePipeline extends BasePipeline {
    private hasAndroidDir: boolean = false;
    private isExpo: boolean = false;

    async prepare(projectPath: string): Promise<void> {
        this.projectPath = projectPath;
        this.createBuildDir('reactnative');

        logger.info(`Preparando projeto React Native: ${projectPath}`);

        // Copia projeto inteiro
        cpSync(projectPath, this.buildDir, { recursive: true });

        // Verifica se tem diretório android/
        this.hasAndroidDir = existsSync(join(this.buildDir, 'android'));

        // Verifica se é Expo
        const packageJson = join(this.buildDir, 'package.json');
        if (existsSync(packageJson)) {
            const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'));
            this.isExpo = !!(pkg.dependencies?.expo || pkg.devDependencies?.expo);
        }

        if (!this.hasAndroidDir) {
            logger.info('Diretório android/ não encontrado, será necessário eject ou prebuild');
        }

        logger.info('Projeto React Native preparado');
    }

    async configure(options: BuildOptions): Promise<void> {
        this.options = options;

        const androidDir = join(this.buildDir, 'android');

        if (!this.hasAndroidDir && this.isExpo) {
            // Para Expo, tenta fazer prebuild
            logger.info('Projeto Expo detectado, executando prebuild...');
            // Nota: prebuild requer npx expo prebuild, que será executado no build
        }

        // Atualiza configurações do Android se existir
        if (this.hasAndroidDir) {
            // Atualiza app/build.gradle
            const buildGradlePath = join(androidDir, 'app', 'build.gradle');
            if (existsSync(buildGradlePath)) {
                let content = readFileSync(buildGradlePath, 'utf-8');

                // Atualiza applicationId
                content = content.replace(
                    /applicationId\s+"[^"]+"/,
                    `applicationId "${options.packageName}"`
                );

                // Atualiza versionCode
                content = content.replace(
                    /versionCode\s+\d+/,
                    `versionCode ${options.versionCode}`
                );

                // Atualiza versionName
                content = content.replace(
                    /versionName\s+"[^"]+"/,
                    `versionName "${options.version}"`
                );

                writeFileSync(buildGradlePath, content);
            }

            // Atualiza strings.xml
            const stringsPath = join(androidDir, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
            if (existsSync(stringsPath)) {
                let content = readFileSync(stringsPath, 'utf-8');
                content = content.replace(
                    /<string name="app_name">[^<]+<\/string>/,
                    `<string name="app_name">${options.appName}</string>`
                );
                writeFileSync(stringsPath, content);
            }
        }

        logger.info('Configuração do projeto React Native concluída');
    }

    async build(env: OfflineEnvironment): Promise<BuildResult> {
        logger.info('Iniciando build React Native...');

        const androidDir = join(this.buildDir, 'android');

        // Se não tem android/, tenta fazer prebuild para Expo
        if (!this.hasAndroidDir && this.isExpo) {
            const npxPath = join(env.NODE_PATH, 'npx');

            const prebuildResult = await this.runCommand(
                npxPath,
                ['expo', 'prebuild', '--platform', 'android', '--clean'],
                this.buildDir,
                {
                    PATH: `${env.NODE_PATH};${process.env.PATH}`,
                    npm_config_cache: env.NPM_CONFIG_CACHE
                }
            );

            if (prebuildResult.code !== 0) {
                return {
                    success: false,
                    errors: ['Expo prebuild falhou', prebuildResult.stderr],
                    warnings: [],
                    buildTime: 0
                };
            }

            this.hasAndroidDir = true;
        }

        if (!existsSync(androidDir)) {
            return {
                success: false,
                errors: ['Diretório android/ não encontrado. Execute "npx react-native eject" ou "npx expo prebuild" primeiro.'],
                warnings: [],
                buildTime: 0
            };
        }

        // Primeiro, faz bundle do JS com Metro
        const npmPath = join(env.NODE_PATH, 'npm');

        // Instala dependências (offline via cache)
        await this.runCommand(
            npmPath,
            ['install', '--offline', '--prefer-offline'],
            this.buildDir,
            {
                PATH: `${env.NODE_PATH};${process.env.PATH}`,
                npm_config_cache: env.NPM_CONFIG_CACHE
            }
        );

        // Gera local.properties
        generateLocalProperties(env.ANDROID_HOME, env.ANDROID_NDK_HOME, join(androidDir, 'local.properties'));

        // Executa Gradle build
        const task = this.options?.signMode === 'release' ? 'assembleRelease' : 'assembleDebug';
        const result = await this.runGradle(task, androidDir, env);

        if (!result.success) {
            return {
                success: false,
                errors: ['Gradle build React Native falhou', result.output],
                warnings: [],
                buildTime: 0
            };
        }

        // Encontra APK gerado
        const buildType = this.options?.signMode === 'release' ? 'release' : 'debug';
        const apkPath = join(androidDir, 'app', 'build', 'outputs', 'apk', buildType, `app-${buildType}.apk`);

        if (!existsSync(apkPath)) {
            return {
                success: false,
                errors: ['APK React Native não encontrado após build'],
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
