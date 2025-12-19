import puppeteer from 'puppeteer';
import * as path from 'path';
import { CONFIG } from './config';

(async () => {
    console.error('Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        userDataDir: path.resolve(__dirname, '../browser_profile'),
        args: [
            '--start-maximized',
            '--autoplay-policy=no-user-gesture-required'
        ]
    });
    const page = await browser.newPage();

    // Set a consistent User Agent
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);

    // STEALTH MODE: Verify these bypasses
    await page.evaluateOnNewDocument(() => {
        // 1. Hide WebDriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });

        // 2. Mock Plugins (simple)
        // @ts-ignore
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3],
        });

        // 3. Mock Languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['es-ES', 'es'],
        });

        // 4. Mock Chrome (Runtime) - basic
        // @ts-ignore
        if (!window.chrome) {
            // @ts-ignore
            window.chrome = { runtime: {} };
        }
    });

    let manifestUrl: string | null = null;
    let mainHeaders: Record<string, string> = {};

    await page.setRequestInterception(true);

    page.on('request', (request) => {
        const url = request.url();

        // Capture headers from the main request if possible, or any request to mediaset
        if (url.includes('mediaset') && Object.keys(mainHeaders).length === 0) {
            mainHeaders = request.headers();
        }

        // Capture MPD request directly
        if (url.includes('.mpd') && !manifestUrl) {
            console.error('!!! FOUND MPD REQUEST !!!', url);
            manifestUrl = url;
        }

        request.continue();
    });

    let downloadStarted = false;

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('theplatform') || url.includes('mediaset')) {
            try {
                // Check content type to avoid parsing images/video chunks
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('json') || contentType.includes('xml') || contentType.includes('text')) {
                    const buffer = await response.buffer();
                    const text = buffer.toString('utf-8');

                    // Look for MPD in the text (SMIL response)
                    if (text.includes('.mpd') && !manifestUrl && !downloadStarted) {
                        console.error('!!! FOUND MPD IN RESPONSE BODY (SMIL) !!!');
                        // Regex to grab the URL inside src="..." or similar
                        // Example: <video src="https://..."
                        const match = text.match(/src=["'](https:[^"']+\.mpd[^"']*)["']/);
                        if (match) {
                            const candidate = match[1];
                            if (!candidate.includes('googlevideo') && !candidate.includes('doubleclick') && !candidate.includes('springserve')) {
                                manifestUrl = candidate;
                                console.error('Parsed SMIL Manifest URL:', manifestUrl);
                                downloadStarted = true;
                            } else {
                                console.error('Ignored Ad Manifest:', candidate.substring(0, 50) + '...');
                            }
                        } else {
                            const match2 = text.match(/(https?:\/\/[^\s"']+\.mpd)/);
                            if (match2) {
                                const candidate = match2[1];
                                if (!candidate.includes('googlevideo') && !candidate.includes('doubleclick') && !candidate.includes('springserve') && candidate.includes('mediaset')) {
                                    manifestUrl = candidate;
                                    console.error('Parsed Simple Manifest URL:', manifestUrl);
                                    downloadStarted = true;
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                // ignore
            }
        }
    });

    // Get URL from Args
    const targetUrl = process.argv[2];
    if (!targetUrl) {
        console.error('Usage: npx ts-node src/extractor.ts <url>');
        process.exit(1);
    }

    console.error(`Navigating to ${targetUrl}`); // Use stderr for logs so stdout remains clean for JSON

    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // TRY TO ACCEPT COOKIES (Didomi)
        try {
            console.error('Checking for Cookie Consent...');
            const cookieBtn = await page.waitForSelector('#didomi-notice-agree-button', { timeout: 5000 });
            if (cookieBtn) {
                console.error('Clicking Cookie Consent...');
                await cookieBtn.click();
                await new Promise(r => setTimeout(r, 1000)); // wait for fade out
            }
        } catch (e) {
            console.error('No cookie banner found or already accepted.');
        }

        // Monitor loop
        console.error('Waiting for video to start (max 10 mins)...');
        console.error('Once the video starts and the script detects it, the browser will close AUTOMATICALLY.');

        const startTime = Date.now();
        while (Date.now() - startTime < CONFIG.timeouts.extractor) {

            // If we found the URL, we can stop waiting!
            if (manifestUrl) {
                console.error('Manifest URL found! Closing browser...');

                let pageTitle = '';
                try {
                    pageTitle = await page.title();
                } catch (e) {
                    console.error('WARNING: Could not retrieve page title (Detached Frame?).');
                }

                await new Promise(r => setTimeout(r, 2000));

                // OUTPUT RESULT AS JSON
                const result = {
                    manifestUrl: manifestUrl,
                    cookies: mainHeaders['cookie'] || '',
                    userAgent: userAgent,
                    referer: 'https://www.mediasetinfinity.es/',
                    pageTitle: pageTitle
                };

                // Write purely JSON to stdout
                process.stdout.write(JSON.stringify(result));

                break;
            }

            if (!browser.isConnected()) {
                console.error('Browser closed by user.');
                break;
            }
            try {
                if (page.isClosed()) {
                    console.error('Page closed.');
                    break;
                }
            } catch (e) {
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }

    } catch (e) {
        console.error('Navigation error:', e);
    }

    await browser.close();
    process.exit(0);

})();
