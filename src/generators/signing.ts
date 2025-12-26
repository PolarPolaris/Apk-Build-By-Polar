// src/generators/signing.ts
// Gerenciamento de keystores e assinatura de APK

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { execSync, spawn } from 'child_process';
import type { BuildOptions, OfflineEnvironment } from '../core/types';
import { createLogger } from '../core/logger';

const logger = createLogger('signing');

interface KeystoreInfo {
    path: string;
    password: string;
    alias: string;
    keyPassword: string;
}

/**
 * Obtém ou cria keystore de debug
 */
export function getDebugKeystore(env: OfflineEnvironment): KeystoreInfo {
    const debugDir = join(process.env.USERPROFILE || process.env.HOME || '.', '.android');
    const keystorePath = join(debugDir, 'debug.keystore');

    mkdirSync(debugDir, { recursive: true });

    if (!existsSync(keystorePath)) {
        logger.info('Criando keystore de debug...');
        createDebugKeystore(keystorePath, env);
    }

    return {
        path: keystorePath,
        password: 'android',
        alias: 'androiddebugkey',
        keyPassword: 'android'
    };
}

/**
 * Cria keystore de debug
 */
function createDebugKeystore(path: string, env: OfflineEnvironment): void {
    const keytoolPath = join(env.JAVA_HOME, 'bin', 'keytool');

    const args = [
        '-genkeypair',
        '-v',
        '-keystore', path,
        '-storepass', 'android',
        '-alias', 'androiddebugkey',
        '-keypass', 'android',
        '-keyalg', 'RSA',
        '-keysize', '2048',
        '-validity', '10000',
        '-dname', 'CN=Android Debug,O=Android,C=US'
    ];

    try {
        execSync(`"${keytoolPath}" ${args.join(' ')}`, { stdio: 'pipe' });
        logger.info(`Keystore de debug criado: ${path}`);
    } catch (error) {
        logger.error('Erro ao criar keystore de debug:', error);
        throw error;
    }
}

/**
 * Cria keystore de release
 */
export async function createReleaseKeystore(
    outputPath: string,
    password: string,
    alias: string,
    keyPassword: string,
    dname: string,
    env: OfflineEnvironment
): Promise<KeystoreInfo> {
    mkdirSync(dirname(outputPath), { recursive: true });

    const keytoolPath = join(env.JAVA_HOME, 'bin', 'keytool');

    const args = [
        '-genkeypair',
        '-v',
        '-keystore', outputPath,
        '-storepass', password,
        '-alias', alias,
        '-keypass', keyPassword,
        '-keyalg', 'RSA',
        '-keysize', '2048',
        '-validity', '10000',
        '-dname', dname
    ];

    return new Promise((resolve, reject) => {
        const proc = spawn(keytoolPath, args, { shell: true });

        proc.on('close', (code) => {
            if (code === 0) {
                logger.info(`Keystore de release criado: ${outputPath}`);
                resolve({
                    path: outputPath,
                    password,
                    alias,
                    keyPassword
                });
            } else {
                reject(new Error(`keytool falhou com código ${code}`));
            }
        });

        proc.on('error', reject);
    });
}

/**
 * Assina APK usando apksigner
 */
export async function signApk(
    apkPath: string,
    keystore: KeystoreInfo,
    outputPath: string,
    env: OfflineEnvironment
): Promise<string> {
    const apksignerPath = join(
        env.ANDROID_HOME,
        'build-tools',
        '34.0.0',
        'apksigner'
    );

    // Primeiro, alinha o APK com zipalign
    const zipalignPath = join(
        env.ANDROID_HOME,
        'build-tools',
        '34.0.0',
        'zipalign'
    );

    const alignedPath = apkPath.replace('.apk', '-aligned.apk');

    try {
        execSync(`"${zipalignPath}" -f -p 4 "${apkPath}" "${alignedPath}"`, { stdio: 'pipe' });
        logger.info('APK alinhado com zipalign');
    } catch (error) {
        logger.warn('zipalign falhou, continuando sem alinhamento');
    }

    const inputApk = existsSync(alignedPath) ? alignedPath : apkPath;

    // Assina o APK
    const signArgs = [
        'sign',
        '--ks', keystore.path,
        '--ks-pass', `pass:${keystore.password}`,
        '--ks-key-alias', keystore.alias,
        '--key-pass', `pass:${keystore.keyPassword}`,
        '--v2-signing-enabled', 'true',
        '--v3-signing-enabled', 'true',
        '--out', outputPath,
        inputApk
    ];

    return new Promise((resolve, reject) => {
        const proc = spawn(apksignerPath, signArgs, { shell: true });

        let stderr = '';
        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                logger.info(`APK assinado: ${outputPath}`);
                resolve(outputPath);
            } else {
                reject(new Error(`apksigner falhou: ${stderr}`));
            }
        });

        proc.on('error', reject);
    });
}

/**
 * Verifica assinatura de um APK
 */
export async function verifyApkSignature(
    apkPath: string,
    env: OfflineEnvironment
): Promise<boolean> {
    const apksignerPath = join(
        env.ANDROID_HOME,
        'build-tools',
        '34.0.0',
        'apksigner'
    );

    try {
        execSync(`"${apksignerPath}" verify --verbose "${apkPath}"`, { stdio: 'pipe' });
        logger.info('Assinatura do APK verificada com sucesso');
        return true;
    } catch {
        logger.error('Falha na verificação da assinatura do APK');
        return false;
    }
}
