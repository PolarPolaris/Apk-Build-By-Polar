// src/generators/icons.ts
// Gerador de ícones para todas as densidades Android

import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import sharp from 'sharp';
import { createLogger } from '../core/logger';

const logger = createLogger('icon-generator');

// Densidades Android e seus tamanhos de ícone
const ICON_SIZES: Record<string, number> = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
};

// Tamanhos para ícones adaptativos (foreground/background)
const ADAPTIVE_ICON_SIZES: Record<string, number> = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432
};

/**
 * Gera ícones em todas as densidades a partir de uma imagem fonte
 */
export async function generateIcons(
    sourcePath: string,
    outputResDir: string,
    generateAdaptive: boolean = true
): Promise<void> {
    if (!existsSync(sourcePath)) {
        throw new Error(`Imagem de ícone não encontrada: ${sourcePath}`);
    }

    logger.info(`Gerando ícones a partir de: ${sourcePath}`);

    const image = sharp(sourcePath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
        throw new Error('Não foi possível ler dimensões da imagem');
    }

    // Gera ícones padrão (ic_launcher.png)
    for (const [density, size] of Object.entries(ICON_SIZES)) {
        const outputDir = join(outputResDir, density);
        mkdirSync(outputDir, { recursive: true });

        // Ícone quadrado
        await sharp(sourcePath)
            .resize(size, size, { fit: 'cover' })
            .png()
            .toFile(join(outputDir, 'ic_launcher.png'));

        // Ícone redondo
        const roundBuffer = await sharp(sourcePath)
            .resize(size, size, { fit: 'cover' })
            .png()
            .toBuffer();

        // Cria máscara circular
        const mask = Buffer.from(
            `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
        );

        await sharp(roundBuffer)
            .composite([{ input: mask, blend: 'dest-in' }])
            .png()
            .toFile(join(outputDir, 'ic_launcher_round.png'));

        logger.info(`Ícone gerado: ${density} (${size}x${size})`);
    }

    // Gera ícones adaptativos (Android 8.0+)
    if (generateAdaptive) {
        await generateAdaptiveIcons(sourcePath, outputResDir);
    }
}

/**
 * Gera ícones adaptativos (foreground + background)
 */
async function generateAdaptiveIcons(sourcePath: string, outputResDir: string): Promise<void> {
    for (const [density, size] of Object.entries(ADAPTIVE_ICON_SIZES)) {
        const outputDir = join(outputResDir, density);
        mkdirSync(outputDir, { recursive: true });

        // Foreground (com padding interno)
        const innerSize = Math.floor(size * 0.66); // 66% do tamanho para safe zone
        const padding = Math.floor((size - innerSize) / 2);

        const foreground = await sharp(sourcePath)
            .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .extend({
                top: padding,
                bottom: padding,
                left: padding,
                right: padding,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toFile(join(outputDir, 'ic_launcher_foreground.png'));
    }

    // Gera XML do ícone adaptativo
    const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

    const mipmapAnydpiDir = join(outputResDir, 'mipmap-anydpi-v26');
    mkdirSync(mipmapAnydpiDir, { recursive: true });

    writeFileSync(join(mipmapAnydpiDir, 'ic_launcher.xml'), adaptiveXml);
    writeFileSync(join(mipmapAnydpiDir, 'ic_launcher_round.xml'), adaptiveXml);

    // Gera cor de background
    const valuesDir = join(outputResDir, 'values');
    mkdirSync(valuesDir, { recursive: true });

    const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
`;

    writeFileSync(join(valuesDir, 'ic_launcher_background.xml'), colorsXml);

    logger.info('Ícones adaptativos gerados');
}

/**
 * Gera ícone padrão se nenhum for fornecido
 */
export async function generateDefaultIcon(outputResDir: string): Promise<void> {
    // Cria um ícone padrão simples (quadrado colorido com texto)
    const size = 512;

    const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="100" fill="url(#grad)"/>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="200" font-weight="bold" 
            fill="white" text-anchor="middle" dominant-baseline="middle">A</text>
    </svg>
  `;

    const tempIcon = join(outputResDir, '..', 'temp_icon.png');
    mkdirSync(dirname(tempIcon), { recursive: true });

    await sharp(Buffer.from(svg))
        .png()
        .toFile(tempIcon);

    await generateIcons(tempIcon, outputResDir);

    logger.info('Ícone padrão gerado');
}
