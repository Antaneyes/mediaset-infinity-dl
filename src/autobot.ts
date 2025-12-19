import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as readline from 'readline';
import { CONFIG } from './config';
import { retry } from './utils/retry';
import { validateKey, detectDuplicateKeys } from './utils/keyValidator';
import { logger } from './utils/logger';
import { openFirefoxForKey } from './utils/keyHelper';

// Configuration
const DOWNLOAD_DIR = CONFIG.paths.downloads;
const FINAL_DIR_PLEX = CONFIG.plex.directory;
const TEMP_DIR = CONFIG.paths.temp;
const BINARY_PATH = CONFIG.paths.binary;
const MONITOR_FILE = path.join(__dirname, '..', 'monitor_results.json');

// Ensure dirs
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Helper to run command
function runCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        logger.debug(`[EXEC] ${command}`);
        const child = child_process.exec(command, { maxBuffer: 1024 * 1024 * 10 });
        child.stdout?.pipe(process.stdout);
        child.stderr?.pipe(process.stderr);
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
}

function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

(async () => {
    logger.info('--- MEDIASET AUTOBOT STARTED ---');

    logger.info('1. Updating Episode List (Running Monitor)...');
    try {
        await retry(() => runCommand('npx ts-node src/monitor.ts'), 2);
    } catch (e) {
        logger.warn('Monitor run failed after retries. Proceeding with cached results if any.');
    }

    logger.info('2. Reading Monitor Results...');
    if (!fs.existsSync(MONITOR_FILE)) {
        logger.error('No monitor results found. Run monitor.ts first.');
        process.exit(1);
    }
    const episodes = JSON.parse(fs.readFileSync(MONITOR_FILE, 'utf-8'));
    logger.info(`Found ${episodes.length} episodes to process.`);

    for (const ep of episodes) {
        logger.info(`\n------------------------------------------------`);
        logger.info(`Processing: ${ep.fullTitle}`);
        logger.info(`URL: ${ep.url}`);

        // Check if already exists in Plex
        const safeTitleCheck = ep.fullTitle.replace(/[^a-zA-Z0-9_\-\. \[\]]/g, '_');
        const destCheck = path.join(FINAL_DIR_PLEX, safeTitleCheck + '.mp4');
        if (fs.existsSync(destCheck)) {
            logger.info(`[SKIP] Already exists in Plex: ${destCheck}`);
            continue;
        }

        // 1. CHECK KEYS.TXT
        let staticKey = '';
        const keysPath = CONFIG.paths.keys;
        if (fs.existsSync(keysPath)) {
            // Detect duplicate keys on first episode
            if (ep.episode === episodes[0].episode) {
                detectDuplicateKeys(keysPath);
            }

            // DO NOT FILTER empty lines, so line number matches episode number (1-based)
            const lines = fs.readFileSync(keysPath, 'utf8').split('\n'); // .filter removed
            if (ep.episode >= 1 && ep.episode <= lines.length) {
                const candidate = lines[ep.episode - 1].trim();
                if (candidate.length > 10 && candidate.includes(':')) {
                    staticKey = candidate;
                    logger.info(`[STATIC-KEY] Found key in keys.txt for Episode ${ep.episode}`);
                }
            }
        }

        logger.info(`2. Launching Extractor (Browser)... Please wait for video to start.`);

        // Create args for spawn
        const extractorCmdArgs = ['ts-node', 'src/extractor.ts', ep.url];
        if (staticKey) extractorCmdArgs.push('--skip-key');

        try {
            const extractionData = await new Promise<any>((resolve, reject) => {
                const child = child_process.spawn('npx.cmd', extractorCmdArgs, { shell: true });
                let stdoutData = '';
                child.stdout.on('data', d => stdoutData += d.toString());
                child.stderr.on('data', d => process.stderr.write(d)); // Show logs

                child.on('close', (code) => {
                    if (code !== 0) reject(new Error('Extractor failed'));
                    else {
                        try {
                            // Find JSON in stdout using Regex because sometimes logs leak
                            const jsonMatch = stdoutData.match(/\{"manifestUrl":.*\}/);
                            if (jsonMatch) {
                                const json = JSON.parse(jsonMatch[0]);
                                resolve(json);
                            } else {
                                // Fallback try full parse
                                const json = JSON.parse(stdoutData.trim());
                                resolve(json);
                            }
                        } catch (e) {
                            reject(new Error(`Failed to parse JSON: ${stdoutData}`));
                        }
                    }
                });
            });

            const { manifestUrl, cookies, userAgent, referer, pageTitle } = extractionData;
            logger.info(`\nManifest Found: ${manifestUrl}`);

            // CORRECT TITLE FROM PAGE
            if (pageTitle) {
                logger.info(`Page Title: "${pageTitle}"`);
                // Match "P18", "Programa 18", "Capítulo 18"
                const match = pageTitle.match(/(?:Parte|Programa|Capítulo|Episodio|P)(?:\s+|:|-)*(\d+)/i);
                if (match) {
                    const realEpNum = parseInt(match[1]);
                    // Update full title
                    ep.episode = realEpNum;
                    ep.fullTitle = `La isla de las tentaciones S09E${realEpNum.toString().padStart(2, '0')} [WEB-DL 1080p ES]`;
                    logger.info(`Updated Metadata -> ${ep.fullTitle}`);
                }
            }

            // 3. RESOLVE KEY
            let key = '';
            if (staticKey) {
                key = staticKey;
                logger.info(`[AUTO] Using Static Key from file.`);
            } else {
                // Usar helper de Firefox para captura manual
                await openFirefoxForKey(ep.url, ep.episode);

                // Leer la clave que el usuario debería haber guardado
                const lines = fs.readFileSync(keysPath, 'utf8').split('\n');
                if (ep.episode >= 1 && ep.episode <= lines.length) {
                    key = lines[ep.episode - 1].trim();
                }

                if (!key || !key.includes(':')) {
                    logger.error('❌ No key found in keys.txt after manual extraction.');
                    logger.error(`   Expected key at line ${ep.episode}`);
                    logger.warn('   Skipping this episode...');
                    continue;
                }
            }

            if (!key || !key.includes(':')) {
                logger.error('❌ Invalid key format. Skipped.');
                continue;
            }

            // Validate key format
            if (!validateKey(key)) {
                logger.warn('⚠️  WARNING: Key format may be invalid (expected: 32 hex chars:32 hex chars)');
                logger.warn('   Attempting to use it anyway...');
            }

            logger.info(`4. Downloading Encrypted Streams...`);

            const safeTitle = ep.fullTitle.replace(/[^a-zA-Z0-9_\-\. \[\]]/g, '_');
            const saveName = safeTitle;

            // Download NOT Decrypting (removed --key)
            const batchFile = path.join(TEMP_DIR, `dl_${Date.now()}.bat`);
            const dlArgs = [
                `"${BINARY_PATH}"`,
                `"${manifestUrl}"`,
                `--save-name "${saveName}"`,
                `--save-dir "${DOWNLOAD_DIR}"`,
                `--header "User-Agent: ${userAgent}"`,
                `--header "Referer: ${referer}"`,
                `--header "Cookie: ${cookies.replace(/(\r\n|\n|\r)/gm, "").replace(/{/g, '%7B').replace(/}/g, '%7D')}"`,
                `--auto-select`
            ];

            fs.writeFileSync(batchFile, dlArgs.join(' '));
            await runCommand(batchFile);
            fs.unlinkSync(batchFile);

            // 5. DECRYPTING WITH FFMPEG
            logger.info('5. Decrypting & Merging...');
            // Guess filenames (N_m3u8DL-RE usually names video as SaveName.mp4 and audio as SaveName.[lang].m4a)
            // But sometimes it's SaveName.mp4 if only one stream.
            // We search dir for files starting with SaveName

            const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(saveName) && (f.endsWith('.mp4') || f.endsWith('.m4a')));
            const videoFile = files.find(f => f.includes('.mp4')); // Assume first mp4 is video
            const audioFile = files.find(f => f.includes('.m4a')); // Assume first m4a is audio

            if (videoFile && audioFile) {
                const vidPath = path.join(DOWNLOAD_DIR, videoFile);
                const audPath = path.join(DOWNLOAD_DIR, audioFile);

                const decVid = path.join(DOWNLOAD_DIR, `${saveName}_dec_video.mp4`);
                const decAud = path.join(DOWNLOAD_DIR, `${saveName}_dec_audio.m4a`);
                const finalMerge = path.join(DOWNLOAD_DIR, `${saveName}_FINAL.mp4`);

                // Decrypt Video
                await runCommand(`ffmpeg -decryption_key ${key.split(':')[1]} -i "${vidPath}" -c copy "${decVid}" -y`);
                // Decrypt Audio
                await runCommand(`ffmpeg -decryption_key ${key.split(':')[1]} -i "${audPath}" -c copy "${decAud}" -y`);

                // Merge
                logger.info('Merging...');
                await runCommand(`ffmpeg -i "${decVid}" -i "${decAud}" -c copy "${finalMerge}" -y`);

                logger.info('Merge Complete!');

                // Clean temp decrypted
                if (fs.existsSync(decVid)) fs.unlinkSync(decVid);
                if (fs.existsSync(decAud)) fs.unlinkSync(decAud);

                // Clean encrypted originals to save space
                if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
                if (fs.existsSync(audPath)) fs.unlinkSync(audPath);

                // 6. Move to Plex
                try {
                    const dest = path.join(FINAL_DIR_PLEX, saveName + '.mp4');

                    if (fs.existsSync(finalMerge)) {
                        logger.info(`Moving to Plex: ${dest}`);
                        await runCommand(`if not exist "${FINAL_DIR_PLEX}" mkdir "${FINAL_DIR_PLEX}"`);
                        await runCommand(`move /Y "${finalMerge}" "${dest}"`);
                        logger.info('Moved successfully!');
                    }
                } catch (e) {
                    logger.error('Failed to move to Plex:', e);
                }

            } else {
                logger.error('Could not find downloaded video/audio files to decrypt.');
                logger.info('Files found:', files);
            }

        } catch (e) {
            logger.error(`Failed to process episode ${ep.fullTitle}:`, e);
        }
    }

})();
