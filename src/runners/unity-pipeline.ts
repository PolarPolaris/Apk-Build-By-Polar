// src/runners/unity-pipeline.ts
// Pipeline de build para projetos Unity

import { existsSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { join } from 'path';
import type { BuildOptions, BuildResult, OfflineEnvironment } from '../core/types';
import { BasePipeline } from './base-pipeline';
import { generateLocalProperties } from '../generators/gradle';
import { getDebugKeystore, signApk } from '../generators/signing';
import { createLogger } from '../core/logger';

const logger = createLogger('unity-pipeline');

export class UnityPipeline extends BasePipeline {
    private unityProjectPath: string = '';

    async prepare(projectPath: string): Promise<void> {
        this.projectPath = projectPath;
        this.unityProjectPath = projectPath;
        this.createBuildDir('unity');

        logger.info(`Preparando projeto Unity: ${projectPath}`);

        // Verifica estrutura do projeto Unity
        const requiredDirs = ['Assets', 'ProjectSettings'];
        for (const dir of requiredDirs) {
            if (!existsSync(join(projectPath, dir))) {
                throw new Error(`Diretório ${dir} não encontrado. Não parece ser um projeto Unity válido.`);
            }
        }

        logger.info('Projeto Unity validado');
    }

    async configure(options: BuildOptions): Promise<void> {
        this.options = options;
        logger.info('Configuração do projeto Unity concluída');
    }

    async build(env: OfflineEnvironment): Promise<BuildResult> {
        logger.info('Iniciando build Unity...');

        const unityPath = join(env.UNITY_PATH, 'Unity.exe');

        if (!existsSync(unityPath)) {
            return {
                success: false,
                errors: ['Unity Editor não encontrado em ' + unityPath],
                warnings: ['Certifique-se de que o Unity está instalado em bundled/unity'],
                buildTime: 0
            };
        }

        const exportDir = join(this.buildDir, 'android-export');
        mkdirSync(exportDir, { recursive: true });

        // Build script para Unity (exporta para Android)
        const buildScript = `
using UnityEditor;
using UnityEditor.Build.Reporting;
using System.IO;

public class AndroidBuilder
{
    public static void Build()
    {
        string[] scenes = GetScenes();
        string outputPath = "${exportDir.replace(/\\/g, '/')}";
        
        BuildPlayerOptions buildOptions = new BuildPlayerOptions
        {
            scenes = scenes,
            locationPathName = Path.Combine(outputPath, "game.apk"),
            target = BuildTarget.Android,
            options = BuildOptions.None
        };
        
        PlayerSettings.Android.keystoreName = "";
        PlayerSettings.Android.keystorePass = "";
        PlayerSettings.Android.keyaliasName = "";
        PlayerSettings.Android.keyaliasPass = "";
        
        BuildReport report = BuildPipeline.BuildPlayer(buildOptions);
        
        if (report.summary.result != BuildResult.Succeeded)
        {
            EditorApplication.Exit(1);
        }
        
        EditorApplication.Exit(0);
    }
    
    private static string[] GetScenes()
    {
        var scenes = new System.Collections.Generic.List<string>();
        foreach (var scene in EditorBuildSettings.scenes)
        {
            if (scene.enabled)
            {
                scenes.Add(scene.path);
            }
        }
        return scenes.ToArray();
    }
}
`;

        // Salva o build script
        const editorDir = join(this.unityProjectPath, 'Assets', 'Editor');
        mkdirSync(editorDir, { recursive: true });
        require('fs').writeFileSync(join(editorDir, 'AndroidBuilder.cs'), buildScript);

        // Executa Unity em modo batch
        const unityArgs = [
            '-quit',
            '-batchmode',
            '-nographics',
            '-projectPath', this.unityProjectPath,
            '-executeMethod', 'AndroidBuilder.Build',
            '-logFile', join(this.buildDir, 'unity-build.log')
        ];

        const result = await this.runCommand(
            unityPath,
            unityArgs,
            this.unityProjectPath,
            {
                ANDROID_HOME: env.ANDROID_HOME,
                ANDROID_NDK_HOME: env.ANDROID_NDK_HOME,
                JAVA_HOME: env.JAVA_HOME
            }
        );

        if (result.code !== 0) {
            return {
                success: false,
                errors: ['Unity build falhou', result.stderr],
                warnings: [],
                buildTime: 0
            };
        }

        // Encontra APK gerado
        const apkPath = join(exportDir, 'game.apk');

        if (!existsSync(apkPath)) {
            // Tenta encontrar em outras localizações
            const files = readdirSync(exportDir);
            const apk = files.find(f => f.endsWith('.apk'));

            if (!apk) {
                return {
                    success: false,
                    errors: ['APK Unity não encontrado após build'],
                    warnings: [],
                    buildTime: 0
                };
            }

            return {
                success: true,
                apkPath: join(exportDir, apk),
                errors: [],
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
