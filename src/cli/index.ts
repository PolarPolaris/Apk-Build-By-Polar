#!/usr/bin/env node
// src/cli/index.ts
// Interface de linha de comando do Universal APK Builder

import { Command } from 'commander';
import { existsSync } from 'fs';
import { resolve } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { orchestrator } from '../core/orchestrator';
import { detectProject } from '../detector/index';
import { getOfflineEnvironment, verifyEnvironment } from '../core/environment';
import { DEFAULT_BUILD_OPTIONS } from '../core/types';
import type { BuildOptions, ProjectType } from '../core/types';

const program = new Command();

program
    .name('builder')
    .description('Universal APK Builder - Gere APKs a partir de qualquer projeto')
    .version('1.0.0');

// Comando: detect
program
    .command('detect <path>')
    .description('Detecta o tipo de projeto')
    .action(async (projectPath: string) => {
        const fullPath = resolve(projectPath);

        if (!existsSync(fullPath)) {
            console.error(chalk.red(`Caminho não encontrado: ${fullPath}`));
            process.exit(1);
        }

        const spinner = ora('Detectando tipo de projeto...').start();

        try {
            const info = await detectProject(fullPath);
            spinner.succeed('Projeto detectado!');

            console.log();
            console.log(chalk.bold('Tipo:'), getTypeLabel(info.type));
            console.log(chalk.bold('Confiança:'), `${info.confidence}%`);
            console.log(chalk.bold('Nome sugerido:'), info.suggestedName);

            if (info.detectedFiles.length > 0) {
                console.log(chalk.bold('Arquivos detectados:'));
                info.detectedFiles.slice(0, 5).forEach(f => console.log(`  - ${f}`));
            }
        } catch (error) {
            spinner.fail('Erro ao detectar projeto');
            console.error(chalk.red(error));
            process.exit(1);
        }
    });

// Comando: build
program
    .command('build <path>')
    .description('Compila o projeto e gera APK')
    .option('-n, --name <name>', 'Nome do aplicativo')
    .option('-p, --package <package>', 'Package name (ex: com.exemplo.app)')
    .option('-v, --version <version>', 'Versão do app (ex: 1.0.0)', '1.0.0')
    .option('--min-sdk <level>', 'SDK mínimo', '21')
    .option('--target-sdk <level>', 'SDK alvo', '34')
    .option('-s, --sign <mode>', 'Modo de assinatura: debug ou release', 'debug')
    .option('-k, --keystore <path>', 'Caminho do keystore (para release)')
    .option('--keystore-pass <password>', 'Senha do keystore')
    .option('--key-alias <alias>', 'Alias da chave')
    .option('--key-pass <password>', 'Senha da chave')
    .option('--abi <abis>', 'ABIs alvo separados por vírgula', 'arm64-v8a,armeabi-v7a')
    .option('-o, --output <path>', 'Caminho de saída do APK')
    .action(async (projectPath: string, opts: any) => {
        const fullPath = resolve(projectPath);

        if (!existsSync(fullPath)) {
            console.error(chalk.red(`Caminho não encontrado: ${fullPath}`));
            process.exit(1);
        }

        // Verifica ambiente
        console.log(chalk.cyan('🔍 Verificando ambiente...'));
        const env = getOfflineEnvironment();
        const envCheck = verifyEnvironment(env);

        if (!envCheck.valid) {
            console.error(chalk.yellow('⚠️  SDKs não encontrados:'), envCheck.missing.join(', '));
            console.error(chalk.dim('Certifique-se de que os SDKs estão instalados em bundled/'));
        }

        // Detecta projeto
        const detectSpinner = ora('Detectando projeto...').start();
        const projectInfo = await detectProject(fullPath);
        detectSpinner.succeed(`Tipo detectado: ${getTypeLabel(projectInfo.type)} (${projectInfo.confidence}%)`);

        if (projectInfo.type === 'unknown') {
            console.error(chalk.red('❌ Tipo de projeto não reconhecido'));
            process.exit(1);
        }

        // Monta opções de build
        const options: BuildOptions = {
            ...DEFAULT_BUILD_OPTIONS,
            appName: opts.name || projectInfo.suggestedName,
            packageName: opts.package || `com.${projectInfo.suggestedName.toLowerCase()}.app`,
            version: opts.version,
            versionCode: 1,
            minSdk: parseInt(opts.minSdk),
            targetSdk: parseInt(opts.targetSdk),
            compileSdk: parseInt(opts.targetSdk),
            signMode: opts.sign,
            keystorePath: opts.keystore,
            keystorePassword: opts.keystorePass,
            keyAlias: opts.keyAlias,
            keyPassword: opts.keyPass,
            abis: opts.abi.split(','),
            permissions: ['android.permission.INTERNET'],
            proguardEnabled: false
        } as BuildOptions;

        console.log();
        console.log(chalk.bold('📋 Configuração:'));
        console.log(`   Nome: ${options.appName}`);
        console.log(`   Package: ${options.packageName}`);
        console.log(`   Versão: ${options.version}`);
        console.log(`   SDK: ${options.minSdk} - ${options.targetSdk}`);
        console.log(`   Assinatura: ${options.signMode}`);
        console.log(`   ABIs: ${options.abis.join(', ')}`);
        console.log();

        // Registra listener de progresso
        orchestrator.on('progress', (progress) => {
            console.log(chalk.dim(`[${progress.percent}%] ${progress.stage}: ${progress.message}`));
        });

        // Executa build
        const buildSpinner = ora('Iniciando build...').start();

        try {
            const result = await orchestrator.build(fullPath, options);

            if (result.success) {
                buildSpinner.succeed(chalk.green('✅ Build concluído com sucesso!'));
                console.log();
                console.log(chalk.bold('📱 APK gerado:'), result.apkPath);
                console.log(chalk.dim(`   Tempo: ${(result.buildTime / 1000).toFixed(1)}s`));

                if (result.warnings.length > 0) {
                    console.log();
                    console.log(chalk.yellow('⚠️  Avisos:'));
                    result.warnings.forEach(w => console.log(`   - ${w}`));
                }
            } else {
                buildSpinner.fail(chalk.red('❌ Build falhou'));
                console.log();
                console.log(chalk.red('Erros:'));
                result.errors.forEach(e => console.log(`   - ${e}`));
                process.exit(1);
            }
        } catch (error) {
            buildSpinner.fail('Erro durante build');
            console.error(chalk.red(error));
            process.exit(1);
        }
    });

// Comando: verify
program
    .command('verify')
    .description('Verifica integridade dos SDKs embutidos')
    .action(async () => {
        console.log(chalk.cyan('🔍 Verificando SDKs embutidos...'));
        console.log();

        const env = getOfflineEnvironment();
        const checks = [
            { name: 'OpenJDK', path: env.JAVA_HOME },
            { name: 'Android SDK', path: env.ANDROID_HOME },
            { name: 'Android NDK', path: env.ANDROID_NDK_HOME },
            { name: 'Gradle Cache', path: env.GRADLE_USER_HOME },
            { name: 'Node.js', path: env.NODE_PATH },
            { name: 'dotnet SDK', path: env.DOTNET_ROOT },
            { name: 'Unity', path: env.UNITY_PATH }
        ];

        let allOk = true;

        for (const check of checks) {
            const exists = existsSync(check.path);
            const status = exists ? chalk.green('✓') : chalk.red('✗');
            const pathInfo = exists ? chalk.dim(check.path) : chalk.red('Não encontrado');

            console.log(`${status} ${check.name.padEnd(15)} ${pathInfo}`);

            if (!exists) allOk = false;
        }

        console.log();
        if (allOk) {
            console.log(chalk.green('✅ Todos os SDKs estão instalados!'));
        } else {
            console.log(chalk.yellow('⚠️  Alguns SDKs estão faltando.'));
            console.log(chalk.dim('Execute o script de setup para instalar os SDKs.'));
        }
    });

// Comando: info
program
    .command('info')
    .description('Mostra informações sobre o builder')
    .action(() => {
        console.log(chalk.bold.cyan('Universal APK Builder v1.0.0'));
        console.log();
        console.log('Tipos de projeto suportados:');
        console.log('  🌐 Web (HTML/CSS/JS) → WebView com Bridge JS-Nativa');
        console.log('  ⚡ NDK (C/C++) → CMake/NDK com JNI Wrapper');
        console.log('  🔷 MAUI/Xamarin (C#) → dotnet Android Target');
        console.log('  ⚛️  React Native/Expo → Metro Bundler + Gradle');
        console.log('  🎮 Unity → Headless Export + Gradle');
        console.log();
        console.log('Uso:');
        console.log('  builder detect ./meu-projeto');
        console.log('  builder build ./meu-projeto --name "Meu App"');
        console.log('  builder verify');
    });

// Helper: label do tipo
function getTypeLabel(type: ProjectType): string {
    const labels: Record<ProjectType, string> = {
        web: '🌐 Web (HTML/CSS/JS)',
        ndk: '⚡ NDK (C/C++)',
        maui: '🔷 MAUI/Xamarin (C#)',
        reactnative: '⚛️  React Native/Expo',
        unity: '🎮 Unity',
        unknown: '❓ Desconhecido'
    };
    return labels[type] || type;
}

program.parse();
