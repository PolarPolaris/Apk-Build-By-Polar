// src/core/types.ts
// Tipos principais do Universal APK Builder

export type ProjectType = 'web' | 'ndk' | 'maui' | 'reactnative' | 'unity' | 'unknown';

export interface ProjectInfo {
    path: string;
    type: ProjectType;
    confidence: number; // 0-100
    detectedFiles: string[];
    suggestedName: string;
}

export interface BuildOptions {
    appName: string;
    packageName: string;
    version: string;
    versionCode: number;
    minSdk: number;
    targetSdk: number;
    compileSdk: number;
    abis: string[]; // arm64-v8a, armeabi-v7a, x86_64
    signMode: 'debug' | 'release';
    keystorePath?: string;
    keystorePassword?: string;
    keyAlias?: string;
    keyPassword?: string;
    iconPath?: string;
    permissions: string[];
    proguardEnabled: boolean;
}

export interface BuildResult {
    success: boolean;
    apkPath?: string;
    aabPath?: string;
    errors: string[];
    warnings: string[];
    buildTime: number; // ms
}

export interface BuildProgress {
    stage: string;
    percent: number;
    message: string;
}

export interface OfflineEnvironment {
    JAVA_HOME: string;
    ANDROID_HOME: string;
    ANDROID_NDK_HOME: string;
    GRADLE_USER_HOME: string;
    GRADLE_HOME: string;
    DOTNET_ROOT: string;
    NODE_PATH: string;
    NPM_CONFIG_CACHE: string;
    UNITY_PATH: string;
}

export interface BuildPipeline {
    prepare(projectPath: string): Promise<void>;
    configure(options: BuildOptions): Promise<void>;
    build(env: OfflineEnvironment): Promise<BuildResult>;
    sign(apkPath: string, options: BuildOptions): Promise<string>;
}

export interface DetectorHeuristic {
    type: ProjectType;
    detect(projectPath: string): Promise<ProjectInfo | null>;
}

export const DEFAULT_BUILD_OPTIONS: Partial<BuildOptions> = {
    minSdk: 21,
    targetSdk: 34,
    compileSdk: 34,
    abis: ['arm64-v8a', 'armeabi-v7a'],
    signMode: 'debug',
    proguardEnabled: false,
    permissions: ['android.permission.INTERNET']
};
