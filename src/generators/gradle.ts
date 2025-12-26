// src/generators/gradle.ts
// Gerador de build.gradle

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { BuildOptions } from '../core/types';
import { createLogger } from '../core/logger';

const logger = createLogger('gradle-generator');

/**
 * Gera build.gradle para o módulo app
 */
export function generateAppBuildGradle(options: BuildOptions, outputPath: string): void {
    const abisFilter = options.abis.map(a => `"${a}"`).join(', ');

    const proguardConfig = options.proguardEnabled
        ? `
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`
        : `
        minifyEnabled false`;

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

        ndk {
            abiFilters ${abisFilter}
        }
    }

    buildTypes {
        release {${proguardConfig}
        }
        debug {
            debuggable true
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }

    buildFeatures {
        viewBinding true
    }

    packagingOptions {
        resources {
            excludes += '/META-INF/{AL2.0,LGPL2.1}'
        }
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.webkit:webkit:1.9.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}
`;

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, 'utf-8');
    logger.info(`App build.gradle gerado: ${outputPath}`);
}

/**
 * Gera build.gradle raiz do projeto
 */
export function generateRootBuildGradle(outputPath: string): void {
    const content = `// Top-level build file
plugins {
    id 'com.android.application' version '8.2.0' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.20' apply false
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`;

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, 'utf-8');
    logger.info(`Root build.gradle gerado: ${outputPath}`);
}

/**
 * Gera settings.gradle
 */
export function generateSettingsGradle(appName: string, outputPath: string): void {
    const content = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "${appName}"
include ':app'
`;

    writeFileSync(outputPath, content, 'utf-8');
    logger.info(`settings.gradle gerado: ${outputPath}`);
}

/**
 * Gera gradle.properties
 */
export function generateGradleProperties(outputPath: string): void {
    const content = `# Project-wide Gradle settings
org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configuration-cache=true

# Android settings
android.useAndroidX=true
android.nonTransitiveRClass=true

# Kotlin settings
kotlin.code.style=official

# Offline mode
org.gradle.offline=true
`;

    writeFileSync(outputPath, content, 'utf-8');
    logger.info(`gradle.properties gerado: ${outputPath}`);
}

/**
 * Gera local.properties com caminhos dos SDKs
 */
export function generateLocalProperties(sdkPath: string, ndkPath: string, outputPath: string): void {
    // Escapa backslashes para Windows
    const sdkEscaped = sdkPath.replace(/\\/g, '\\\\');
    const ndkEscaped = ndkPath.replace(/\\/g, '\\\\');

    const content = `sdk.dir=${sdkEscaped}
ndk.dir=${ndkEscaped}
`;

    writeFileSync(outputPath, content, 'utf-8');
    logger.info(`local.properties gerado: ${outputPath}`);
}

/**
 * Gera proguard-rules.pro
 */
export function generateProguardRules(outputPath: string): void {
    const content = `# ProGuard rules for Universal APK Builder

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep Parcelables
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep R classes
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Preserve line numbers for debugging
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
`;

    writeFileSync(outputPath, content, 'utf-8');
    logger.info(`proguard-rules.pro gerado: ${outputPath}`);
}
