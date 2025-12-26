// scripts/download-sdks.ts
// Script para baixar e configurar todos os SDKs necessários

import { existsSync, mkdirSync, createWriteStream, rmSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import http from 'http';

const execAsync = promisify(exec);

const BUNDLED_DIR = join(process.cwd(), 'bundled');

// URLs dos SDKs (versões atuais)
const SDK_DOWNLOADS = {
    // OpenJDK 17 (Adoptium/Temurin)
    jdk: {
        url: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.9%2B9/OpenJDK17U-jdk_x64_windows_hotspot_17.0.9_9.zip',
        dir: 'jdk',
        extractedName: 'jdk-17.0.9+9'
    },

    // Android Command Line Tools
    cmdlineTools: {
        url: 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip',
        dir: 'android-sdk/cmdline-tools',
        extractedName: 'cmdline-tools'
    },

    // Gradle
    gradle: {
        url: 'https://services.gradle.org/distributions/gradle-8.5-bin.zip',
        dir: 'gradle',
        extractedName: 'gradle-8.5'
    },

    // Node.js
    node: {
        url: 'https://nodejs.org/dist/v20.10.0/node-v20.10.0-win-x64.zip',
        dir: 'node',
        extractedName: 'node-v20.10.0-win-x64'
    }
};

async function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;

        const request = protocol.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 302 || response.statusCode === 301) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    downloadFile(redirectUrl, dest).then(resolve).catch(reject);
                    return;
                }
            }

            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (totalSize > 0) {
                    const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
                    process.stdout.write(`\r  Baixando: ${percent}%`);
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(' ✓');
                resolve();
            });
        });

        request.on('error', (err) => {
            file.close();
            reject(err);
        });
    });
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
    console.log(`  Extraindo para ${destDir}...`);

    // Usa PowerShell para extrair (disponível no Windows)
    await execAsync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`);

    console.log('  Extração concluída ✓');
}

async function setupAndroidSdk(): Promise<void> {
    console.log('\n📱 Configurando Android SDK...');

    const sdkDir = join(BUNDLED_DIR, 'android-sdk');
    const cmdlineToolsDir = join(sdkDir, 'cmdline-tools', 'latest');
    const sdkmanager = join(cmdlineToolsDir, 'bin', 'sdkmanager.bat');

    if (!existsSync(sdkmanager)) {
        console.log('  ⚠️  sdkmanager não encontrado. SDK precisa ser configurado manualmente.');
        return;
    }

    // Define JAVA_HOME
    const javaHome = join(BUNDLED_DIR, 'jdk');
    process.env.JAVA_HOME = javaHome;
    process.env.PATH = `${join(javaHome, 'bin')};${process.env.PATH}`;

    // Aceita licenças
    console.log('  Aceitando licenças...');
    try {
        await execAsync(`echo y | "${sdkmanager}" --licenses`, { env: process.env });
    } catch {
        // Ignora erros de licença
    }

    // Instala componentes necessários
    const packages = [
        'platform-tools',
        'build-tools;34.0.0',
        'platforms;android-34',
        'ndk;26.1.10909125'
    ];

    for (const pkg of packages) {
        console.log(`  Instalando ${pkg}...`);
        try {
            await execAsync(`"${sdkmanager}" "${pkg}"`, { env: process.env });
            console.log(`  ${pkg} ✓`);
        } catch (error) {
            console.log(`  ⚠️  Falha ao instalar ${pkg}`);
        }
    }
}

async function main(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        Universal APK Builder - Download de SDKs            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log();

    // Cria diretório bundled
    mkdirSync(BUNDLED_DIR, { recursive: true });

    // Download de cada SDK
    for (const [name, config] of Object.entries(SDK_DOWNLOADS)) {
        const destDir = join(BUNDLED_DIR, config.dir);

        if (existsSync(destDir) && existsSync(join(destDir, '..', config.extractedName || ''))) {
            console.log(`✓ ${name} já instalado`);
            continue;
        }

        console.log(`\n📥 Baixando ${name}...`);

        const zipPath = join(BUNDLED_DIR, `${name}.zip`);

        try {
            await downloadFile(config.url, zipPath);

            mkdirSync(destDir, { recursive: true });
            await extractZip(zipPath, destDir);

            // Remove zip após extração
            rmSync(zipPath, { force: true });

            console.log(`✓ ${name} instalado`);
        } catch (error) {
            console.error(`✗ Erro ao baixar ${name}:`, error);
        }
    }

    // Configura Android SDK
    await setupAndroidSdk();

    // Cria diretórios de cache
    mkdirSync(join(BUNDLED_DIR, 'gradle-cache'), { recursive: true });
    mkdirSync(join(BUNDLED_DIR, 'npm-cache'), { recursive: true });

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✅ Setup concluído!');
    console.log('');
    console.log('Próximos passos:');
    console.log('  1. Execute: npm run dev');
    console.log('  2. Arraste um projeto para a interface');
    console.log('  3. Clique em "Gerar APK"');
    console.log('════════════════════════════════════════════════════════════');
}

main().catch(console.error);
