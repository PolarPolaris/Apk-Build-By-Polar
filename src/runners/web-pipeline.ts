// src/runners/web-pipeline.ts
// Pipeline de build para projetos Web (WebView/Capacitor)

import { existsSync, mkdirSync, cpSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { BuildOptions, BuildResult, OfflineEnvironment } from '../core/types';
import { getOfflineEnvironment } from '../core/environment';
import { BasePipeline } from './base-pipeline';
import { generateManifest, detectPermissions } from '../generators/manifest';
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

const logger = createLogger('web-pipeline');

export class WebPipeline extends BasePipeline {
    async prepare(projectPath: string): Promise<void> {
        this.projectPath = projectPath;
        this.createBuildDir('web');

        logger.info(`Preparando projeto Web: ${projectPath}`);

        // Cria estrutura do projeto Android
        const appDir = join(this.buildDir, 'app');
        const mainDir = join(appDir, 'src', 'main');
        const javaDir = join(mainDir, 'java', 'com', 'webview', 'app');
        const resDir = join(mainDir, 'res');
        const assetsDir = join(mainDir, 'assets', 'www');

        mkdirSync(javaDir, { recursive: true });
        mkdirSync(resDir, { recursive: true });
        mkdirSync(assetsDir, { recursive: true });

        // Copia assets web para www/
        this.copyWebAssets(projectPath, assetsDir);

        // Cria MainActivity.kt
        this.createMainActivity(javaDir);

        // Cria WebViewBridge.kt
        this.createWebViewBridge(javaDir);

        // Cria layout
        this.createLayout(resDir);

        // Cria themes
        this.createThemes(resDir);

        logger.info('Projeto Web preparado');
    }

    private copyWebAssets(srcDir: string, destDir: string): void {
        // Lista de arquivos/pastas web para copiar
        const webFiles = ['index.html', 'index.htm', 'src', 'dist', 'public', 'assets', 'css', 'js', 'img', 'images'];

        for (const item of webFiles) {
            const srcPath = join(srcDir, item);
            if (existsSync(srcPath)) {
                const destPath = join(destDir, item);
                cpSync(srcPath, destPath, { recursive: true });
            }
        }

        // Se não encontrou index.html nos lugares padrão, copia tudo
        const indexHtml = join(destDir, 'index.html');
        if (!existsSync(indexHtml)) {
            // Procura em dist ou public
            const distIndex = join(destDir, 'dist', 'index.html');
            const publicIndex = join(destDir, 'public', 'index.html');

            if (existsSync(distIndex)) {
                cpSync(join(srcDir, 'dist'), destDir, { recursive: true });
            } else if (existsSync(publicIndex)) {
                cpSync(join(srcDir, 'public'), destDir, { recursive: true });
            } else {
                // Copia todos os arquivos HTML/CSS/JS
                const files = readdirSync(srcDir);
                for (const file of files) {
                    if (file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.js')) {
                        cpSync(join(srcDir, file), join(destDir, file));
                    }
                }
            }
        }
    }

    private createMainActivity(javaDir: string): void {
        const code = `package com.webview.app

import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.PermissionRequest
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: WebViewBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        bridge = WebViewBridge(this)
        
        setupWebView()
        loadContent()
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            
            // Performance
            setRenderPriority(WebSettings.RenderPriority.HIGH)
            setEnableSmoothTransition(true)
        }

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }
        }

        // Adiciona interface JavaScript
        webView.addJavascriptInterface(bridge, "AndroidBridge")
    }

    private fun loadContent() {
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }
}
`;
        writeFileSync(join(javaDir, 'MainActivity.kt'), code);
    }

    private createWebViewBridge(javaDir: string): void {
        const code = `package com.webview.app

import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast
import android.os.Vibrator
import android.os.VibrationEffect
import android.os.Build

class WebViewBridge(private val context: Context) {

    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun vibrate(duration: Long) {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(duration)
        }
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        return """
            {
                "manufacturer": "\${Build.MANUFACTURER}",
                "model": "\${Build.MODEL}",
                "version": "\${Build.VERSION.RELEASE}",
                "sdk": \${Build.VERSION.SDK_INT}
            }
        """.trimIndent()
    }

    @JavascriptInterface
    fun log(message: String) {
        android.util.Log.d("WebViewBridge", message)
    }
}
`;
        writeFileSync(join(javaDir, 'WebViewBridge.kt'), code);
    }

    private createLayout(resDir: string): void {
        const layoutDir = join(resDir, 'layout');
        mkdirSync(layoutDir, { recursive: true });

        const layout = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</FrameLayout>
`;
        writeFileSync(join(layoutDir, 'activity_main.xml'), layout);
    }

    private createThemes(resDir: string): void {
        const valuesDir = join(resDir, 'values');
        mkdirSync(valuesDir, { recursive: true });

        const themes = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.App" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowTranslucentStatus">true</item>
        <item name="android:windowTranslucentNavigation">true</item>
    </style>
</resources>
`;
        writeFileSync(join(valuesDir, 'themes.xml'), themes);

        const strings = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">WebView App</string>
</resources>
`;
        writeFileSync(join(valuesDir, 'strings.xml'), strings);
    }

    async configure(options: BuildOptions): Promise<void> {
        this.options = options;

        const appDir = join(this.buildDir, 'app');
        const mainDir = join(appDir, 'src', 'main');
        const resDir = join(mainDir, 'res');

        // Atualiza package name nos arquivos Kotlin
        const javaDir = join(mainDir, 'java');
        const packagePath = options.packageName.replace(/\./g, '/');
        const newJavaDir = join(javaDir, packagePath);

        if (existsSync(join(javaDir, 'com', 'webview', 'app'))) {
            mkdirSync(newJavaDir, { recursive: true });
            cpSync(join(javaDir, 'com', 'webview', 'app'), newJavaDir, { recursive: true });

            // Atualiza package nos arquivos
            const files = ['MainActivity.kt', 'WebViewBridge.kt'];
            for (const file of files) {
                const filePath = join(newJavaDir, file);
                if (existsSync(filePath)) {
                    const content = require('fs').readFileSync(filePath, 'utf-8');
                    const updated = content.replace('package com.webview.app', `package ${options.packageName}`);
                    writeFileSync(filePath, updated);
                }
            }

            // Remove diretório antigo para evitar conflito de compilação
            // Importante: requer 'rmSync' importado de 'fs' (vou adicionar ao import depois ou usar require)
            require('fs').rmSync(join(javaDir, 'com', 'webview'), { recursive: true, force: true });
        }

        // Detecta permissões do código web
        const detectedPerms = detectPermissions(this.projectPath);
        options.permissions = [...new Set([...options.permissions, ...detectedPerms])];

        // Gera AndroidManifest.xml
        generateManifest(options, join(mainDir, 'AndroidManifest.xml'));

        // Gera ícones
        if (options.iconPath && existsSync(options.iconPath)) {
            await generateIcons(options.iconPath, resDir);
        } else {
            await generateDefaultIcon(resDir);
        }

        // Gera arquivos Gradle
        generateRootBuildGradle(join(this.buildDir, 'build.gradle'));
        generateAppBuildGradle(options, join(appDir, 'build.gradle'));
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

        logger.info('Configuração do projeto Web concluída');
    }

    async build(env: OfflineEnvironment): Promise<BuildResult> {
        logger.info('Iniciando build Gradle...');

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
                errors: ['Gradle build falhou', result.output],
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
                errors: ['APK não encontrado após build'],
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
        const env = getOfflineEnvironment();

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
