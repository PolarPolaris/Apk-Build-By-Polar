import { promises as dns } from 'dns';

/**
 * Verifica se há conexão com a internet
 */
export async function isOnline(): Promise<boolean> {
    try {
        await dns.lookup('google.com');
        return true;
    } catch (error) {
        return false;
    }
}
