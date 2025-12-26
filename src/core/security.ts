// src/core/security.ts
// Módulo de segurança e criptografia

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
// Nota: node-machine-id removido para evitar dependências nativas complexas.
// Usamos hostname + userInfo username para identificação básica
import { hostname, userInfo } from 'os';

// Configurações de algorítimo
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

interface EncryptedData {
    iv: string;
    tag: string;
    content: string;
    salt: string;
}

/**
 * Deriva uma chave criptográfica baseada em uma senha mestra e um salt
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
    return pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Obtém uma chave mestra padrão baseada no ambiente (para criptografia transparente)
 * Em um cenário real de alta segurança, o usuário digitaria isso a cada sessão.
 */
function getDefaultMasterKey(): string {
    try {
        const user = userInfo();
        return `${hostname()}-${user.username}-universal-apk-builder-secure-key`;
    } catch {
        return 'fallback-secure-master-key-generic';
    }
}

/**
 * Criptografa uma string (ex: senha do keystore)
 */
export function encrypt(text: string, customMasterKey?: string): EncryptedData {
    const masterKey = customMasterKey || getDefaultMasterKey();
    const salt = randomBytes(SALT_LENGTH);
    const key = deriveKey(masterKey, salt);
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        tag: tag.toString('hex'),
        content: encrypted
    };
}

/**
 * Decriptografa dados protegidos
 */
export function decrypt(data: EncryptedData, customMasterKey?: string): string {
    const masterKey = customMasterKey || getDefaultMasterKey();
    const salt = Buffer.from(data.salt, 'hex');
    const iv = Buffer.from(data.iv, 'hex');
    const tag = Buffer.from(data.tag, 'hex');
    const key = deriveKey(masterKey, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(data.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Verifica integridade de arquivos (Hash SHA-256)
 */
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

export async function verifyFileIntegrity(filePath: string, expectedHash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);

        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => {
            const fileHash = hash.digest('hex');
            resolve(fileHash === expectedHash);
        });
    });
}
