import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

export const CONFIG = {
    plex: {
        directory: process.env.PLEX_DIR || path.join(__dirname, '..', 'output'),
    },
    series: {
        name: process.env.SERIES_NAME || 'La isla de las tentaciones',
        season: parseInt(process.env.SERIES_SEASON || '9'),
        url: process.env.SERIES_URL || 'https://www.mediasetinfinity.es/programas-tv/la-isla-de-las-tentaciones/temporada-9/episodios/',
    },
    timeouts: {
        extractor: parseInt(process.env.EXTRACTOR_TIMEOUT || '600000'),
        monitor: parseInt(process.env.MONITOR_TIMEOUT || '60000'),
    },
    paths: {
        downloads: process.env.DOWNLOAD_DIR || path.join(__dirname, '..', 'downloads'),
        temp: process.env.TEMP_DIR || path.join(__dirname, '..', 'temp'),
        keys: process.env.KEYS_FILE || path.join(__dirname, '..', 'keys.txt'),
        binary: path.join(__dirname, 'executables', 'N_m3u8DL-RE.exe'),
    },
};
