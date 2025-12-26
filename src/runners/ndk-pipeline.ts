// src/runners/ndk-pipeline.ts
// Pipeline de build para projetos NDK (C/C++)

import { existsSync, mkdirSync, cpSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import type { BuildOptions, BuildResult, OfflineEnvironment } from '../core/types';
import { BasePipeline } from './base-pipeline';
import { generateManifest } from '../generators/manifest';
import {
    generateAppBuildGradle,
    generateRootBuildGradle,
    generateSettingsGradle,
    generateGradleProperties,
    generateLocalProperties,
    generateProguardRules
} from '../generators/gradle';
import { generateIcons, generateDefaultIcon } from '../generators/icons';
import { getDebugKeystore, signApk } from '../generators/signing';
import { createLogger } from '../core/logger';

const logger = createLogger('ndk-pipeline');

export class NdkPipeline extends BasePipeline {
    private sourceFiles: string[] = [];

    async prepare(projectPath: string): Promise<void> {
        this.projectPath = projectPath;
        this.createBuildDir('ndk');

        logger.info(`Preparando projeto NDK: ${projectPath}`);

        // Cria estrutura do projeto Android
        const appDir = join(this.buildDir, 'app');
        const mainDir = join(appDir, 'src', 'main');
        const cppDir = join(mainDir, 'cpp');
        const javaDir = join(mainDir, 'java', 'com', 'ndk', 'app');
        const resDir = join(mainDir, 'res');

        mkdirSync(cppDir, { recursive: true });
        mkdirSync(javaDir, { recursive: true });
        mkdirSync(resDir, { recursive: true });

        // Copia arquivos C/C++
        this.copyCppFiles(projectPath, cppDir);

        // Cria ou copia CMakeLists.txt
        this.setupCMake(projectPath, cppDir);

        // Cria MainActivity.kt (wrapper JNI)
        this.createMainActivity(javaDir);

        // Cria layout
        this.createLayout(resDir);

        // Cria themes
        this.createThemes(resDir);

        logger.info('Projeto NDK preparado');
    }

    private copyCppFiles(srcDir: string, destDir: string): void {
        const extensions = ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx'];

        const copyRecursive = (src: string, dest: string) => {
            const items = readdirSync(src, { withFileTypes: true });

            for (const item of items) {
                const srcPath = join(src, item.name);
                const destPath = join(dest, item.name);

                if (item.isDirectory()) {
                    // Ignora diretórios comuns que não devem ser copiados
                    if (['build', 'bin', 'obj', '.git', 'node_modules'].includes(item.name)) continue;

                    mkdirSync(destPath, { recursive: true });
                    copyRecursive(srcPath, destPath);
                } else if (extensions.some(ext => item.name.endsWith(ext))) {
                    cpSync(srcPath, destPath);
                    this.sourceFiles.push(item.name);
                }
            }
        };

        copyRecursive(srcDir, destDir);
        logger.info(`Copiados ${this.sourceFiles.length} arquivos C/C++`);
    }

    private setupCMake(srcDir: string, cppDir: string): void {
        const existingCMake = join(srcDir, 'CMakeLists.txt');

        if (existsSync(existingCMake)) {
            cpSync(existingCMake, join(cppDir, 'CMakeLists.txt'));
            logger.info('CMakeLists.txt existente copiado');
        } else {
            // Gera CMakeLists.txt básico
            const sourceFilesStr = this.sourceFiles
                .filter(f => f.endsWith('.c') || f.endsWith('.cpp') || f.endsWith('.cc'))
                .join('\n        ');

            const cmake = `cmake_minimum_required(VERSION 3.22.1)
project("nativeapp")

add_library(\${CMAKE_PROJECT_NAME} SHARED
        native-lib.cpp
        ${sourceFilesStr})

find_library(log-lib log)

target_link_libraries(\${CMAKE_PROJECT_NAME}
        android
        \${log-lib})
`;
            writeFileSync(join(cppDir, 'CMakeLists.txt'), cmake);

            // Cria native-lib.cpp se não existir
            if (!existsSync(join(cppDir, 'native-lib.cpp'))) {
                const nativeLib = `#include <jni.h>
#include <string>

extern "C" JNIEXPORT jstring JNICALL
Java_com_ndk_app_MainActivity_stringFromJNI(
        JNIEnv* env,
        jobject /* this */) {
    std::string hello = "Hello from C++";
    return env->NewStringUTF(hello.c_str());
}
`;
                writeFileSync(join(cppDir, 'native-lib.cpp'), nativeLib);
            }

            logger.info('CMakeLists.txt gerado automaticamente');
        }
    }

    private createMainActivity(javaDir: string): void {
        const code = `package com.ndk.app

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        val textView: TextView = findViewById(R.id.textView)
        textView.text = stringFromJNI()
    }

    /**
     * Native method implemented in native-lib.cpp
     */
    external fun stringFromJNI(): String

    companion object {
        init {
            System.loadLibrary("nativeapp")
        }
    }
}
`;
        writeFileSync(join(javaDir, 'MainActivity.kt'), code);
    }

    private createLayout(resDir: string): void {
        const layoutDir = join(resDir, 'layout');
        mkdirSync(layoutDir, { recursive: true });

        const layout = `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <TextView
        android:id="@+id/textView"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Loading..."
        android:textSize="24sp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
`;
        writeFileSync(join(layoutDir, 'activity_main.xml'), layout);
    }

    private createThemes(resDir: string): void {
        const valuesDir = join(resDir, 'values');
        mkdirSync(valuesDir, { recursive: true });

        const themes = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.App" parent="Theme.MaterialComponents.DayNight.DarkActionBar">
        <item name="colorPrimary">@color/purple_500</item>
        <item name="colorPrimaryVariant">@color/purple_700</item>
        <item name="colorOnPrimary">@android:color/white</item>
    </style>
</resources>
`;
        writeFileSync(join(valuesDir, 'themes.xml'), themes);

        const colors = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="purple_500">#FF6200EE</color>
    <color name="purple_700">#FF3700B3</color>
</resources>
`;
        writeFileSync(join(valuesDir, 'colors.xml'), colors);

        const strings = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">NDK App</string>
</resources>
`;
        writeFileSync(join(valuesDir, 'strings.xml'), strings);
    }

    async configure(options: BuildOptions): Promise<void> {
        this.options = options;

        const appDir = join(this.buildDir, 'app');
        const mainDir = join(appDir, 'src', 'main');
        const resDir = join(mainDir, 'res');

        // Atualiza package name
        const javaDir = join(mainDir, 'java');
        const packagePath = options.packageName.replace(/\./g, '/');
        const newJavaDir = join(javaDir, packagePath);

        if (existsSync(join(javaDir, 'com', 'ndk', 'app'))) {
            mkdirSync(newJavaDir, { recursive: true });
            cpSync(join(javaDir, 'com', 'ndk', 'app'), newJavaDir, { recursive: true });

            // Atualiza package e JNI method name
            const mainActivityPath = join(newJavaDir, 'MainActivity.kt');
            if (existsSync(mainActivityPath)) {
                let content = require('fs').readFileSync(mainActivityPath, 'utf-8');
                content = content.replace('package com.ndk.app', `package ${options.packageName}`);
                writeFileSync(mainActivityPath, content);
            }
        }

        // Gera AndroidManifest.xml
        generateManifest(options, join(mainDir, 'AndroidManifest.xml'));

        // Gera ícones
        if (options.iconPath && existsSync(options.iconPath)) {
            await generateIcons(options.iconPath, resDir);
        } else {
            await generateDefaultIcon(resDir);
        }

        // Gera build.gradle com suporte NDK
        this.generateNdkBuildGradle(options, join(appDir, 'build.gradle'));
        generateRootBuildGradle(join(this.buildDir, 'build.gradle'));
        generateSettingsGradle(options.appName, join(this.buildDir, 'settings.gradle'));
        generateGradleProperties(join(this.buildDir, 'gradle.properties'));
        generateProguardRules(join(appDir, 'proguard-rules.pro'));

        // Atualiza strings.xml
        const stringsPath = join(resDir, 'values', 'strings.xml');
        const strings = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${options.appName}</string>
</resources>
`;
        writeFileSync(stringsPath, strings);

        logger.info('Configuração do projeto NDK concluída');
    }

    private generateNdkBuildGradle(options: BuildOptions, outputPath: string): void {
        const abisFilter = options.abis.map(a => `"${a}"`).join(', ');

        const content = `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace '${options.packageName}'
    compileSdk ${options.compileSdk}

    defaultConfig {
        applicationId "${options.packageName}"
        minSdk ${options.minSdk}
        targetSdk ${options.targetSdk}
        versionCode ${options.versionCode}
        versionName "${options.version}"

        externalNativeBuild {
            cmake {
                cppFlags ''
                abiFilters ${abisFilter}
            }
        }
        
        ndk {
            abiFilters ${abisFilter}
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    externalNativeBuild {
        cmake {
            path file("src/main/cpp/CMakeLists.txt")
            version "3.22.1"
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}
`;
        writeFileSync(outputPath, content);
    }

    async build(env: OfflineEnvironment): Promise<BuildResult> {
        logger.info('Iniciando build NDK com Gradle...');

        // Gera local.properties
        generateLocalProperties(env.ANDROID_HOME, env.ANDROID_NDK_HOME, join(this.buildDir, 'local.properties'));

        // Copia Gradle wrapper
        this.copyGradleWrapper(this.buildDir, env);

        // Executa Gradle build
        const task = this.options?.signMode === 'release' ? 'assembleRelease' : 'assembleDebug';
        const result = await this.runGradle(task, this.buildDir, env);

        if (!result.success) {
            return {
                success: false,
                errors: ['Gradle NDK build falhou', result.output],
                warnings: [],
                buildTime: 0
            };
        }

        // Encontra APK gerado
        const buildType = this.options?.signMode === 'release' ? 'release' : 'debug';
        const apkPath = join(this.buildDir, 'app', 'build', 'outputs', 'apk', buildType, `app-${buildType}.apk`);

        if (!existsSync(apkPath)) {
            return {
                success: false,
                errors: ['APK não encontrado após build NDK'],
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
