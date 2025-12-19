# Mediaset Infinity Downloader

Descargador automático de episodios de Mediaset Infinity con desencriptación Widevine L3.

## 🚀 Características

- ✅ Scraping automático de nuevos episodios
- ✅ Captura de manifiestos MPD (.mpd)
- ✅ Descarga y desencriptación automática (Widevine L3)
- ✅ Fusión de vídeo y audio
- ✅ Integración con Plex
- ✅ Reintentos automáticos en fallos
- ✅ Validación de claves de desencriptación
- ✅ Configuración centralizada con `.env`

## 📋 Requisitos

- **Node.js** 18.12.x (especificado en `package.json`)
- **FFmpeg** (debe estar en PATH del sistema)
- **Windows** (para `N_m3u8DL-RE.exe`)

## 🔧 Instalación

1. **Clonar repositorio**
   ```bash
   git clone <repository-url>
   cd mediaset-infinity-downloader
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   copy .env.example .env
   ```
   Editar `.env` con tus valores:
   - `PLEX_DIR`: Ruta a tu biblioteca de Plex
   - `SERIES_NAME`: Nombre de la serie
   - `SERIES_SEASON`: Número de temporada
   - `SERIES_URL`: URL de la página de episodios

4. **Añadir claves de desencriptación**
   
   Editar `keys.txt` con las claves Widevine (una por línea):
   ```
   KID1:KEY1
   KID2:KEY2
   KID3:KEY3
   ```
   > ⚠️ **Importante**: La línea N corresponde al episodio N. Dejar líneas vacías para episodios sin clave.

## 🎬 Uso

### Proceso Completo Automático
```bash
npm start
```
Ejecuta todo el flujo: scraping → captura → descarga → desencriptación → Plex

### Solo Buscar Nuevos Episodios
```bash
npm run monitor
```
Genera `monitor_results.json` con la lista de episodios disponibles.

### Limpiar Logs del Descargador
```bash
npm run clean-logs
```
Elimina logs acumulados en `src/executables/Logs/`.

## 📁 Estructura del Proyecto

```
mediaset-infinity-downloader/
├── src/
│   ├── autobot.ts          # Orquestador principal
│   ├── extractor.ts        # Captura de manifiestos MPD
│   ├── monitor.ts          # Scraping de episodios
│   ├── config.ts           # Configuración centralizada
│   ├── utils/
│   │   ├── retry.ts        # Sistema de reintentos
│   │   ├── keyValidator.ts # Validación de claves
│   │   └── logger.ts       # Logging estructurado
│   └── executables/
│       └── N_m3u8DL-RE.exe # Descargador de streams
├── .env                    # Configuración (no versionado)
├── .env.example            # Plantilla de configuración
├── keys.txt                # Claves de desencriptación
├── downloads/              # Descargas temporales
├── temp/                   # Archivos .bat temporales
└── browser_profile/        # Perfil de Chrome (cookies, sesiones)
```

## 🔑 Obtener Claves de Desencriptación

### Método Automático: Helper de Firefox

El script incluye un **helper automático** que facilita la captura de claves:

**Flujo automático cuando falta una clave:**
1. El script detecta que falta la clave para un episodio
2. **Abre Firefox automáticamente** en el episodio correcto
3. Muestra instrucciones claras en la consola
4. Espera a que captures la clave con la extensión
5. Lees la clave automáticamente de `keys.txt`
6. Continúa con la descarga

**Proceso manual (dentro del helper):**
1. Espera a que pasen los anuncios
2. Activa la extensión **Widevine L3 Decrypter** en Firefox
3. Copia la clave capturada
4. Pégala en `keys.txt` en la línea correspondiente al número de episodio
5. Guarda el archivo
6. Presiona ENTER en la consola

### Extensión Requerida

Necesitas tener instalada en Firefox:
- **Widevine L3 Decrypter** (disponible en Firefox Add-ons)

### Formato de la Clave

**Formato:** `KID:KEY`
- **KID**: 32 caracteres hexadecimales
- **KEY**: 32 caracteres hexadecimales

**Ejemplo válido:**
```
2ddeab4e324d42e99503a92e5449e843:9e01fb534f7833b74f330ffdbca7deb2
```

### Validación Automática

El script incluye validación automática de claves:
- ✅ Detecta claves duplicadas al inicio
- ✅ Verifica formato correcto (32 hex:32 hex)
- ✅ Avisa si hay problemas antes de descargar

> 💡 **Tip**: Las claves se guardan en `keys.txt` donde la línea N corresponde al episodio N. Puedes dejar líneas vacías para episodios sin clave.

### ¿Por qué no funciona con Puppeteer?

Mediaset Infinity detecta navegadores controlados por Puppeteer y bloquea la reproducción DRM (error PLAYBACK-DRM-6001). Por eso usamos Firefox real con el helper automático.

## ⚙️ Configuración Avanzada

### Variables de Entorno (`.env`)

| Variable | Descripción | Por Defecto |
|----------|-------------|-------------|
| `PLEX_DIR` | Directorio de destino en Plex | `./output` |
| `SERIES_NAME` | Nombre de la serie | `La isla de las tentaciones` |
| `SERIES_SEASON` | Número de temporada | `9` |
| `SERIES_URL` | URL de episodios de Mediaset | *(requerido)* |
| `EXTRACTOR_TIMEOUT` | Timeout del extractor (ms) | `600000` (10 min) |
| `MONITOR_TIMEOUT` | Timeout del monitor (ms) | `60000` (1 min) |
| `DOWNLOAD_DIR` | Carpeta de descargas | `./downloads` |
| `TEMP_DIR` | Carpeta temporal | `./temp` |
| `KEYS_FILE` | Archivo de claves | `./keys.txt` |

## 🐛 Troubleshooting

### Problema: "Failed to download asset"
**Solución:**
- Verificar conexión a internet
- Reintentar con `npm start` (tiene reintentos automáticos)
- Verificar que FFmpeg está en PATH

### Problema: "Invalid key format"
**Solución:**
- Verificar formato `KID:KEY` (32 hex:32 hex)
- Comprobar que no haya espacios extra
- Ejecutar el script para detectar duplicados automáticamente

### Problema: "Browser closed by user"
**Solución:**
- No cerrar el navegador manualmente
- Esperar a que el vídeo empiece a reproducirse
- El navegador se cierra automáticamente al capturar el manifest

### Problema: Mediaset detecta bot
**Solución:**
- El script usa técnicas anti-detección (stealth mode)
- Usar `browser_profile/` para mantener sesión
- Evitar ejecutar múltiples instancias simultáneas

## 📝 Flujo de Trabajo

1. **Monitor** escanea la página de episodios
2. **Autobot** lee la lista y procesa cada episodio:
   - Verifica si ya existe en Plex
   - Busca clave en `keys.txt` o pregunta manualmente
   - Lanza **Extractor** para capturar manifest
   - Descarga streams encriptados con `N_m3u8DL-RE`
   - Desencripta con FFmpeg
   - Fusiona vídeo + audio
   - Mueve a Plex

## 🔒 Seguridad

- ⚠️ **No subir** `.env` ni `keys.txt` al repositorio
- ⚠️ Las claves Widevine son **sensibles**
- ⚠️ Usar solo para **contenido que tienes derecho a descargar**

## 📜 Licencia

Apache-2.0

## 🙏 Créditos

- [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE) - Descargador de streams
- [Puppeteer](https://pptr.dev/) - Automatización de navegador
- [FFmpeg](https://ffmpeg.org/) - Procesamiento multimedia

---

**Nota**: Este proyecto es solo para fines educativos. Respeta los derechos de autor y términos de servicio de Mediaset Infinity.
