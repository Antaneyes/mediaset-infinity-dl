import * as child_process from 'child_process';
import * as readline from 'readline';
import { logger } from './logger';

/**
 * Helper para abrir Firefox automáticamente y esperar captura manual de clave
 * @param episodeUrl URL del episodio
 * @param episodeNumber Número del episodio
 * @returns Promise que se resuelve cuando el usuario presiona ENTER
 */
export async function openFirefoxForKey(episodeUrl: string, episodeNumber: number): Promise<void> {
    logger.warn(`\n${'='.repeat(60)}`);
    logger.warn(`🔑 MANUAL KEY EXTRACTION REQUIRED`);
    logger.warn(`${'='.repeat(60)}`);
    logger.info(`\nEpisode ${episodeNumber}`);
    logger.info(`URL: ${episodeUrl}`);
    logger.info(`\n📋 INSTRUCTIONS:`);
    logger.info(`1. Firefox will open automatically in 3 seconds...`);
    logger.info(`2. Wait for ads to finish playing`);
    logger.info(`3. Once the episode starts, activate Widevine L3 Decrypter extension`);
    logger.info(`4. Copy the captured key`);
    logger.info(`5. Paste it in keys.txt at line ${episodeNumber}`);
    logger.info(`6. Save keys.txt`);
    logger.info(`7. Press ENTER here to continue\n`);

    // Esperar 3 segundos para que el usuario lea las instrucciones
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Abrir Firefox automáticamente
    logger.info(`🌐 Opening Firefox...`);
    try {
        child_process.exec(`start firefox "${episodeUrl}"`);
        logger.info(`✅ Firefox opened successfully\n`);
    } catch (error) {
        logger.error(`❌ Failed to open Firefox automatically`);
        logger.info(`Please open Firefox manually and navigate to:`);
        logger.info(`${episodeUrl}\n`);
    }

    // Esperar confirmación del usuario
    logger.warn(`⏳ Waiting for your confirmation...`);
    logger.warn(`   Press ENTER when you have saved the key to keys.txt\n`);

    return new Promise<void>((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('', () => {
            rl.close();
            logger.info(`✅ Continuing with download...\n`);
            resolve();
        });
    });
}
