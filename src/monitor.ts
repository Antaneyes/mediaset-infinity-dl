import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config';
import { logger } from './utils/logger';

const TARGET_URL = CONFIG.series.url;

interface Episode {
    title: string;
    url: string;
    season: number;
    episode: number;
    fullTitle: string;
}

(async () => {
    logger.info('Starting Monitor...');
    const browser = await puppeteer.launch({
        headless: true, // Headless for monitoring is fine usually, unless they block it hard
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        logger.info(`Navigating to ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for connection/Grid to load
        // Try to find episode cards. Usually valid selectors differ, so we'll grab all links and filter.
        await page.waitForSelector('a', { timeout: 10000 }).catch(() => console.log('Timeout waiting for links'));

        // Auto-Scroll from Node side to avoid __awaiter issues in browser context
        const distance = 100;
        let totalHeight = 0;
        const maxScrolls = 50; // 5 seconds approx

        for (let i = 0; i < maxScrolls; i++) {
            await page.evaluate((dist) => {
                window.scrollBy(0, dist);
            }, distance);
            await new Promise(r => setTimeout(r, 100));
        }

        // Wait a bit after scroll
        await new Promise(r => setTimeout(r, 2000));

        // Scrape data
        const episodes = await page.evaluate(() => {
            const items: any[] = [];
            // Strategy: Look for links that look like episode links
            // Usually they contain "/episodios/programa-X"
            const links = Array.from(document.querySelectorAll('a'));

            links.forEach(link => {
                const href = link.href;
                const title = link.textContent?.trim() || '';

                // Filter for episode links
                if (href.includes('/episodios/ programa-') || href.includes('/episodios/programa-')) {
                    // Verify it's inside a video card structure if possible, but URL check is strong
                    items.push({
                        url: href,
                        rawTitle: title,
                    });
                }
            });
            return items;
        });

        // Deduplicate
        const uniqueEpisodes = new Map();
        episodes.forEach(ep => uniqueEpisodes.set(ep.url, ep));

        logger.info(`Found ${uniqueEpisodes.size} potential episodes.`);

        const parsedEpisodes: Episode[] = [];

        for (const [url, data] of uniqueEpisodes) {
            // Logic to parse Season/Episode from URL or Title
            // URL example: .../programa-1-40_017409884/player/
            // Title example: "Programa 1" or "P1 - ..." or "P10 - ..."

            // Regex to find "P10", "P1", "Programa 1"
            let epNum = 0;
            const titleMatch = data.rawTitle.match(/(?:^|\s|P)0*(\d+)(?:\s+|-|$)/i);

            // Refined Regex for "P10 - " pattern specifically seen in screenshot
            const pMatch = data.rawTitle.match(/P(\d+)\s*-/);

            if (pMatch) {
                epNum = parseInt(pMatch[1]);
            } else {
                const genericMatch = data.rawTitle.match(/(?:Programa|Capítulo) (\d+)/i) || url.match(/programa-(\d+)/i);
                if (genericMatch) epNum = parseInt(genericMatch[1]);
            }

            // Get season from configuration
            const season = CONFIG.series.season;

            if (epNum > 0) {
                // Construct normalized title
                const cleanEpNum = epNum.toString().padStart(2, '0');
                // Use captured title but prepend clean S09EXX
                parsedEpisodes.push({
                    title: CONFIG.series.name,
                    url: url,
                    season: season,
                    episode: epNum,
                    fullTitle: `${CONFIG.series.name} S${season.toString().padStart(2, '0')}E${cleanEpNum} [WEB-DL 1080p ES]`
                });
            }
        }

        // Sort by episode number desc
        parsedEpisodes.sort((a, b) => b.episode - a.episode);

        logger.info('--- Parsed Episodes ---');
        parsedEpisodes.forEach(ep => {
            logger.info(`[${ep.fullTitle}] -> ${ep.url}`);
        });

        // Save to cache/history (mock for now)
        fs.writeFileSync('monitor_results.json', JSON.stringify(parsedEpisodes, null, 2));

    } catch (e) {
        logger.error('Monitoring failed:', e);
    } finally {
        await browser.close();
    }
})();
