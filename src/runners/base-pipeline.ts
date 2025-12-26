// src/runners/base-pipeline.ts
// Base class para pipelines de build

import { EventEmitter } from 'events';
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import { isOnline } from '../core/network';
import { spawn } from 'child_process';
import type { BuildOptions, BuildResult, BuildPipeline, OfflineEnvironment } from '../core/types';
import { createLogger } from '../core/logger';

const logger = createLogger('base-pipeline');

export abstract class BasePipeline extends EventEmitter implements BuildPipeline {
    protected buildDir: string = '';
    protected projectPath: string = '';
    protected options: BuildOptions | null = null;

    /**
     * Cria diretório temporário de build
     */
    protected createBuildDir(baseName: string): string {
        const tempDir = join(process.env.TEMP || '/tmp', 'apk-builder', baseName, Date.now().toString());
        mkdirSync(tempDir, { recursive: true });
        this.buildDir = tempDir;
        return tempDir;
    }

    /**
     * Limpa diretório de build
     */
    protected cleanBuildDir(): void {
        if (this.buildDir && existsSync(this.buildDir)) {
            try {
                rmSync(this.buildDir, { recursive: true, force: true });
            } catch {
                // Ignora erros de limpeza
            }
        }
    }

    /**
     * Executa comando e retorna saída
     */
    protected async runCommand(
        command: string,
        args: string[],
        cwd: string,
        env: Record<string, string>
    ): Promise<{ stdout: string; stderr: string; code: number }> {
        return new Promise((resolve) => {
            const proc = spawn(command, args, {
                cwd,
                env: { ...process.env, ...env },
                shell: true
            });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                this.emit('log', text);
            });

            proc.stderr?.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                this.emit('log', text);
            });

            proc.on('close', (code) => {
                resolve({ stdout, stderr, code: code || 0 });
            });

            proc.on('error', (err) => {
                stderr += err.message;
                resolve({ stdout, stderr, code: 1 });
            });
        });
    }

    /**
     * Executa Gradle wrapper
     */
    protected async runGradle(
        task: string,
        buildDir: string,
        env: OfflineEnvironment
    ): Promise<{ success: boolean; output: string }> {
        // Usa o binário do Gradle direto da instalação embutida
        // em vez de depender do wrapper que pode estar faltando
        const gradleBin = process.platform === 'win32' ? 'gradle.bat' : 'gradle';
        const gradleExec = join(env.GRADLE_HOME, 'bin', gradleBin);
        const gradleHome = join(env.GRADLE_USER_HOME);

        const online = await isOnline();
        const args = [task, '--no-daemon', '--stacktrace'];

        // Se estiver offline, força o modo offline
        if (!online) {
            args.push('--offline');
        }

        try {
            const result = await this.runCommand(
                gradleExec,
                args,
                buildDir,
                {
                    JAVA_HOME: env.JAVA_HOME,
                    ANDROID_HOME: env.ANDROID_HOME,
                    ANDROID_SDK_ROOT: env.ANDROID_HOME,
                    GRADLE_USER_HOME: gradleHome
                }
            );
            return {
                success: result.code === 0,
                output: result.stdout + result.stderr
            };
        } catch (error) {
            // Se falhou e estavamos online (tentando baixar), 
            // tenta novamente em modo offline caso seja apenas uma falha de conexão temporária
            // ou erro no repo, mas temos cache local.
            if (online) {
                console.log('Build online falhou, tentando fallback para modo offline...');
                // Ensure --offline is added only once if it wasn't already present
                if (!args.includes('--offline')) {
                    args.push('--offline');
                }
                const result = await this.runCommand(
                    gradleExec,
                    args,
                    buildDir,
                    {
                        JAVA_HOME: env.JAVA_HOME,
                        ANDROID_HOME: env.ANDROID_HOME,
                        ANDROID_SDK_ROOT: env.ANDROID_HOME,
                        GRADLE_USER_HOME: gradleHome
                    }
                );
                return {
                    success: result.code === 0,
                    output: result.stdout + result.stderr
                };
            }
            throw error;
        }
    }

    /**
     * Copia Gradle wrapper para o projeto
     */
    protected copyGradleWrapper(targetDir: string, env: OfflineEnvironment): void {
        const gradleDir = join(env.GRADLE_USER_HOME, '..', 'gradle', '8.5');
        const wrapperSrc = join(gradleDir, 'wrapper');

        if (existsSync(wrapperSrc)) {
            const targetWrapper = join(targetDir, 'gradle', 'wrapper');
            mkdirSync(targetWrapper, { recursive: true });
            cpSync(wrapperSrc, targetWrapper, { recursive: true });
        }

        // Copia scripts gradlew
        const gradlewBat = join(gradleDir, 'gradlew.bat');
        const gradlewSh = join(gradleDir, 'gradlew');

        if (existsSync(gradlewBat)) {
            cpSync(gradlewBat, join(targetDir, 'gradlew.bat'));
        }
        if (existsSync(gradlewSh)) {
            cpSync(gradlewSh, join(targetDir, 'gradlew'));
        }
    }

    // Métodos abstratos a serem implementados
    abstract prepare(projectPath: string): Promise<void>;
    abstract configure(options: BuildOptions): Promise<void>;
    abstract build(env: OfflineEnvironment): Promise<BuildResult>;
    abstract sign(apkPath: string, options: BuildOptions): Promise<string>;
}
