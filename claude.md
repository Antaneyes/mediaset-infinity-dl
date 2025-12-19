# Mediaset Infinity Downloader - Contexto del Proyecto

## 📝 Descripción General

Sistema automatizado para descargar episodios de Mediaset Infinity con desencriptación Widevine L3. El proyecto consta de tres componentes principales que trabajan en conjunto para automatizar el proceso de descarga.

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

#### 1. **Monitor** (`src/monitor.ts`)
- **Función**: Scraping de la página de episodios
- **Tecnología**: Puppeteer en modo headless
- **Salida**: `monitor_results.json` con lista de episodios
- **Características**:
  - Auto-scroll para cargar todos los episodios
  - Parsing de títulos y números de episodio
  - Detección automática de temporada desde CONFIG

#### 2. **Extractor** (`src/extractor.ts`)
- **Función**: Captura de URL del manifiesto MPD
- **Tecnología**: Puppeteer con técnicas anti-detección
- **Salida**: JSON con manifest URL, cookies, user agent, referer
- **Características**:
  - Stealth mode (oculta webdriver, mock de plugins)
  - Interceptación de peticiones de red
  - Parsing de respuestas SMIL
  - Filtrado de manifiestos de anuncios

#### 3. **Autobot** (`src/autobot.ts`)
- **Función**: Orquestador principal del flujo completo
- **Tecnología**: Node.js + child_process
- **Características**:
  - Ejecuta monitor para obtener lista de episodios
  - Verifica si episodios ya existen en Plex
  - Gestión de claves (archivo `keys.txt` o captura manual)
  - Lanza extractor para obtener manifest
  - Descarga streams con `N_m3u8DL-RE.exe`
  - Desencripta con FFmpeg
  - Fusiona audio/vídeo
  - Mueve resultado a Plex
  - Limpia archivos temporales automáticamente

---

## 🔑 Sistema de Claves Widevine L3

### Problema Original
Mediaset Infinity usa DRM Widevine L3 para proteger el contenido. Las claves de desencriptación deben obtenerse para cada episodio.

### Solución Implementada: Helper de Firefox

**¿Por qué no Puppeteer?**
- Mediaset detecta navegadores controlados por Puppeteer
- Error: `PLAYBACK-DRM-6001` al intentar reproducir
- Bloqueo de DRM incluso con técnicas anti-detección

**Solución Actual:**
- Helper automático que abre Firefox (navegador real)
- Extensión Widevine L3 Decrypter en Firefox
- Captura manual guiada por instrucciones automáticas
- Lectura automática de `keys.txt`

**Flujo:**
```
Usuario ejecuta npm start
  ↓
Autobot detecta episodio sin clave
  ↓
Helper abre Firefox automáticamente
  ↓
Muestra instrucciones en consola
  ↓
Usuario captura clave con extensión
  ↓
Usuario guarda en keys.txt línea N
  ↓
Usuario presiona ENTER
  ↓
Script lee clave y continúa descarga
```

---

## 📁 Estructura de Archivos

### Archivos de Configuración

#### `.env`
```env
PLEX_DIR=G:\Plex\Series\La isla de las tentaciones (2020)
SERIES_NAME=La isla de las tentaciones
SERIES_SEASON=9
SERIES_URL=https://www.mediasetinfinity.es/.../temporada-9/episodios/
EXTRACTOR_TIMEOUT=600000
MONITOR_TIMEOUT=60000
```

#### `keys.txt`
```
KID1:KEY1  # Episodio 1
KID2:KEY2  # Episodio 2
           # Episodio 3 (vacío)
KID4:KEY4  # Episodio 4
```
**Importante**: Línea N = Episodio N

### Archivos Temporales

- `monitor_results.json` - Lista de episodios encontrados
- `downloads/` - Archivos encriptados y desencriptados temporales
- `temp/*.bat` - Scripts de descarga generados dinámicamente
- `browser_profile/` - Perfil de Chrome para extractor (cookies, sesiones)

---

## 🔧 Utilidades Implementadas

### 1. **Sistema de Configuración** (`src/config.ts`)
- Carga variables de `.env`
- Valores por defecto si no existen
- Centralización de toda la configuración

### 2. **Sistema de Reintentos** (`src/utils/retry.ts`)
- Reintentos automáticos con backoff exponencial
- Configurable (número de intentos, delay)
- Usado en monitor y descarga

### 3. **Validación de Claves** (`src/utils/keyValidator.ts`)
- Valida formato KID:KEY (32 hex:32 hex)
- Detecta claves duplicadas
- Avisa antes de intentar descargar

### 4. **Logging Estructurado** (`src/utils/logger.ts`)
- Niveles: DEBUG, INFO, WARN, ERROR
- Mensajes consistentes y claros
- Preparado para logging a archivo

### 5. **Helper de Firefox** (`src/utils/keyHelper.ts`)
- Abre Firefox automáticamente
- Muestra instrucciones paso a paso
- Espera confirmación del usuario
- Lee clave de `keys.txt` automáticamente

---

## 🔄 Flujo de Trabajo Completo

```
1. npm start
   ↓
2. Monitor scrapes episodios → monitor_results.json
   ↓
3. Para cada episodio:
   ├─ Verifica si existe en Plex → Skip si existe
   ├─ Busca clave en keys.txt
   │  ├─ Si existe → Usa clave
   │  └─ Si no existe → Helper Firefox
   ├─ Lanza Extractor → Obtiene manifest URL
   ├─ Descarga streams con N_m3u8DL-RE
   ├─ Desencripta con FFmpeg
   ├─ Fusiona audio + vídeo
   ├─ Mueve a Plex
   └─ Limpia archivos temporales
```

---

## 🛠️ Herramientas Externas

### N_m3u8DL-RE.exe
- **Función**: Descarga de streams DASH/HLS
- **Ubicación**: `src/executables/N_m3u8DL-RE.exe`
- **Uso**: Descarga vídeo y audio encriptados

### FFmpeg
- **Función**: Desencriptación y fusión de streams
- **Requisito**: Debe estar en PATH del sistema
- **Uso**:
  ```bash
  ffmpeg -decryption_key <KEY> -i input.mp4 -c copy output.mp4
  ffmpeg -i video.mp4 -i audio.m4a -c copy merged.mp4
  ```

---

## 🎯 Mejoras Implementadas en Esta Sesión

### 1. Limpieza del Proyecto
- Eliminados archivos temporales (30 MB)
- Eliminada extensión incompatible
- Activada eliminación automática de archivos encriptados

### 2. Sistema de Configuración
- Creado `.env` para valores configurables
- Eliminado hardcoding (5 valores)
- CONFIG centralizado en todos los archivos

### 3. Robustez
- Reintentos automáticos en fallos de red
- Validación de claves Widevine
- Detección de claves duplicadas

### 4. Logging Estructurado
- Reemplazado console.log por logger
- Mensajes claros y consistentes
- Niveles configurables

### 5. Automatización Mejorada
- Helper de Firefox (60% automático)
- Apertura automática de navegador
- Instrucciones guiadas
- Lectura automática de claves

### 6. Documentación
- README completo
- Guías de troubleshooting
- Investigación de alternativas documentada

---

## 🚨 Limitaciones Conocidas

### 1. Detección de Bots
- Mediaset detecta Puppeteer → No se puede automatizar 100%
- Solución: Helper de Firefox con navegador real

### 2. Dependencia de Windows
- `N_m3u8DL-RE.exe` es Windows-only
- `npx.cmd` en código (Windows-específico)
- Rutas con backslash

### 3. Claves Widevine
- Deben obtenerse manualmente para cada episodio
- No hay API pública para obtenerlas
- Extensión requiere navegador real

### 4. Hardcoding Residual
- Nombre de serie en parsing de títulos (línea 143 autobot.ts)
- Formato de título final (puede variar por serie)

---

## 🔮 Mejoras Futuras Sugeridas

### Corto Plazo
1. Detectar automáticamente cuando Firefox se cierra
2. Validar clave antes de continuar descarga
3. Añadir timeout configurable para espera de usuario
4. Logging a archivo con rotación

### Medio Plazo
1. Soporte para múltiples series simultáneas
2. Interfaz web para gestión de claves
3. Notificaciones cuando hay nuevos episodios
4. Base de datos para tracking de episodios

### Largo Plazo
1. Portabilidad a Linux/Mac
2. Dockerización del proyecto
3. API REST para control remoto
4. Integración con otros servicios de streaming

---

## 📊 Estadísticas del Proyecto

- **Archivos TypeScript**: 8
- **Utilidades**: 4
- **Líneas de código**: ~1200
- **Dependencias**: 5 (puppeteer, dotenv, tslib, typescript, ts-node)
- **Herramientas externas**: 2 (N_m3u8DL-RE, FFmpeg)
- **Tiempo de descarga**: ~5-10 min por episodio (depende de conexión)
- **Espacio temporal**: ~2-3 GB por episodio (se limpia automáticamente)

---

## 🤝 Contribuciones

Este proyecto es para uso personal y educativo. Respeta los derechos de autor y términos de servicio de Mediaset Infinity.

---

## 📜 Licencia

Apache-2.0

---

**Última actualización**: 2025-12-19  
**Versión**: 1.0.0  
**Estado**: ✅ Producción
