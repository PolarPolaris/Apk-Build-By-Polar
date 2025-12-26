// src/core/environment.ts
// Configura variáveis de ambiente para usar SDKs embutidos

import { join } from 'path';
import { existsSync } from 'fs';
import type { OfflineEnvironment } from './types';

/**
 * Retorna o diretório raiz do aplicativo
 */
export function getAppRoot(): string {
    // Em produção (packaged), extraResources estão em process.resourcesPath
    // Em desenvolvimento, usa o diretório atual
    if (process.env.NODE_ENV === 'development') {
        return process.cwd();
    }
    // No Electron packaged, process.resourcesPath aponta para a pasta resources onde
    // 'bundled' e 'templates' foram colocados via extraResources
    return process.resourcesPath;
}

/**
 * Retorna o caminho para os SDKs embutidos
 */
export function getBundledPath(): string {
    return join(getAppRoot(), 'bundled');
}

/**
 * Configura o ambiente offline com todos os SDKs embutidos
 */
export function getOfflineEnvironment(): OfflineEnvironment {
    const bundled = getBundledPath();

    return {
        JAVA_HOME: join(bundled, 'jdk'),
        ANDROID_HOME: join(bundled, 'android-sdk'),
        ANDROID_NDK_HOME: join(bundled, 'ndk', 'r26'),
        GRADLE_USER_HOME: join(bundled, 'gradle-cache'),
        GRADLE_HOME: join(bundled, 'gradle', '8.5'),
        DOTNET_ROOT: join(bundled, 'dotnet'),
        NODE_PATH: join(bundled, 'node'),
        NPM_CONFIG_CACHE: join(bundled, 'npm-cache'),
        UNITY_PATH: join(bundled, 'unity')
    };
}

/**
 * Aplica as variáveis de ambiente para o processo
 */
export function applyEnvironment(env: OfflineEnvironment): void {
    process.env.JAVA_HOME = env.JAVA_HOME;
    process.env.ANDROID_HOME = env.ANDROID_HOME;
    process.env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
    process.env.ANDROID_NDK_HOME = env.ANDROID_NDK_HOME;
    process.env.GRADLE_USER_HOME = env.GRADLE_USER_HOME;
    process.env.DOTNET_ROOT = env.DOTNET_ROOT;
    process.env.npm_config_cache = env.NPM_CONFIG_CACHE;

    // Adiciona binários ao PATH
    const paths = [
        join(env.JAVA_HOME, 'bin'),
        join(env.ANDROID_HOME, 'platform-tools'),
        join(env.ANDROID_HOME, 'cmdline-tools', 'latest', 'bin'),
        join(env.ANDROID_HOME, 'build-tools', '34.0.0'),
        join(env.NODE_PATH),
        join(env.DOTNET_ROOT)
    ];

    const separator = process.platform === 'win32' ? ';' : ':';
    process.env.PATH = paths.join(separator) + separator + (process.env.PATH || '');
}

/**
 * Verifica se todos os SDKs estão instalados
 */
export function verifyEnvironment(env: OfflineEnvironment): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    const checks = [
        { name: 'JDK', path: env.JAVA_HOME },
        { name: 'Android SDK', path: env.ANDROID_HOME },
        { name: 'Android NDK', path: env.ANDROID_NDK_HOME },
        { name: 'Gradle Cache', path: env.GRADLE_USER_HOME },
        { name: 'Node.js', path: env.NODE_PATH },
        { name: 'dotnet SDK', path: env.DOTNET_ROOT }
    ];

    for (const check of checks) {
        if (!existsSync(check.path)) {
            missing.push(check.name);
        }
    }

    return { valid: missing.length === 0, missing };
}
