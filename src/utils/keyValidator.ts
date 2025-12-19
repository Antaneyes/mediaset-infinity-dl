import * as fs from 'fs';

/**
 * Validate Widevine key format (KID:KEY)
 * @param key Key to validate
 * @returns true if valid, false otherwise
 */
export function validateKey(key: string): boolean {
    // Format: KID:KEY (32 hex chars : 32 hex chars)
    const regex = /^[a-f0-9]{32}:[a-f0-9]{32}$/i;
    return regex.test(key);
}

/**
 * Detect duplicate keys in keys file
 * @param keysFile Path to keys.txt file
 */
export function detectDuplicateKeys(keysFile: string): void {
    if (!fs.existsSync(keysFile)) {
        return;
    }

    const lines = fs.readFileSync(keysFile, 'utf8').split('\n');
    const seen = new Set<string>();
    const duplicates: number[] = [];

    lines.forEach((line, index) => {
        const key = line.trim();
        if (key && key.includes(':')) {
            if (seen.has(key)) {
                duplicates.push(index + 1);
            }
            seen.add(key);
        }
    });

    if (duplicates.length > 0) {
        console.warn(`⚠️  WARNING: Duplicate keys found at lines: ${duplicates.join(', ')}`);
        console.warn(`   This may cause issues with decryption. Please verify your keys.txt file.`);
    }
}
