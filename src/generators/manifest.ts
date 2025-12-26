// src/generators/manifest.ts
// Gerador de AndroidManifest.xml

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { BuildOptions } from '../core/types';
import { createLogger } from '../core/logger';

const logger = createLogger('manifest-generator');

// Mapeamento de APIs Web para permissões Android
const WEB_API_PERMISSIONS: Record<string, string[]> = {
    'navigator.geolocation': ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
    'navigator.mediaDevices.getUserMedia': ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
    'navigator.mediaDevices.getDisplayMedia': ['android.permission.RECORD_AUDIO'],
    'Notification': ['android.permission.POST_NOTIFICATIONS'],
    'navigator.vibrate': ['android.permission.VIBRATE'],
    'navigator.bluetooth': ['android.permission.BLUETOOTH', 'android.permission.BLUETOOTH_ADMIN'],
    'navigator.usb': ['android.permission.USB_PERMISSION'],
    'navigator.nfc': ['android.permission.NFC'],
    'navigator.contacts': ['android.permission.READ_CONTACTS'],
    'fetch': ['android.permission.INTERNET'],
    'XMLHttpRequest': ['android.permission.INTERNET'],
    'WebSocket': ['android.permission.INTERNET']
};

/**
 * Detecta permissões necessárias analisando código JS/HTML
 */
export function detectPermissions(projectPath: string): string[] {
    const permissions = new Set<string>();

    // Sempre adiciona INTERNET por padrão
    permissions.add('android.permission.INTERNET');
    permissions.add('android.permission.ACCESS_NETWORK_STATE');

    try {
        const files = readdirSync(projectPath, { recursive: true }) as string[];
        const codeFiles = files.filter(f =>
            f.endsWith('.js') ||
            f.endsWith('.ts') ||
            f.endsWith('.html') ||
            f.endsWith('.jsx') ||
            f.endsWith('.tsx')
        );

        for (const file of codeFiles.slice(0, 50)) { // Limita análise
            try {
                const content = readFileSync(join(projectPath, file), 'utf-8');

                for (const [api, perms] of Object.entries(WEB_API_PERMISSIONS)) {
                    if (content.includes(api)) {
                        perms.forEach(p => permissions.add(p));
                    }
                }
            } catch {
                // Ignora arquivos que não podem ser lidos
            }
        }
    } catch (error) {
        logger.warn('Erro ao detectar permissões:', error);
    }

    return Array.from(permissions);
}

/**
 * Gera AndroidManifest.xml
 */
export function generateManifest(options: BuildOptions, outputPath: string): void {
    const permissions = [...new Set([...options.permissions, 'android.permission.INTERNET'])];

    const permissionsXml = permissions
        .map(p => `    <uses-permission android:name="${p}" />`)
        .join('\n');

    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${options.packageName}"
    android:versionCode="${options.versionCode}"
    android:versionName="${options.version}">

${permissionsXml}

    <uses-feature android:glEsVersion="0x00020000" android:required="true" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${options.appName}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.App"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>

</manifest>
`;

    writeFileSync(outputPath, manifest, 'utf-8');
    logger.info(`Manifest gerado: ${outputPath}`);
}

/**
 * Atualiza manifest existente com novas permissões
 */
export function updateManifestPermissions(manifestPath: string, permissions: string[]): void {
    if (!existsSync(manifestPath)) {
        throw new Error(`Manifest não encontrado: ${manifestPath}`);
    }

    let content = readFileSync(manifestPath, 'utf-8');

    for (const permission of permissions) {
        const permTag = `<uses-permission android:name="${permission}" />`;
        if (!content.includes(permission)) {
            // Insere antes de </manifest>
            content = content.replace(
                '</manifest>',
                `    ${permTag}\n</manifest>`
            );
        }
    }

    writeFileSync(manifestPath, content, 'utf-8');
}
