# WhatsApp Downloader

Descarga automática de archivos y texto desde grupos de WhatsApp. Solo recepción — el programa nunca envía mensajes.

## ⚠️ Advertencia importante

> **Se recomienda fuertemente usar una línea de WhatsApp DEDICADA exclusivamente para este programa.**
> No uses tu número personal ni el número principal de tu empresa.
> Un chip prepago o una línea secundaria es suficiente.
>
> El programa opera en **modo solo lectura**: escucha y descarga, nunca envía.

## Requisitos

- [Node.js 18+](https://nodejs.org) — descargar la versión LTS
- Un celular con WhatsApp para escanear el QR inicial

## Instalación

```bash
git clone https://github.com/TU_USUARIO/whatsapp-downloader.git
cd whatsapp-downloader
npm install
```

## Uso

### 1. Configuración inicial (una sola vez)

```bash
npm run setup
```

El asistente va a:
- Conectarse a WhatsApp (mostrará un QR para escanear)
- Mostrar la lista de tus grupos
- Pedirte que elijas qué grupos monitorear y en qué carpeta guardar los archivos
- Guardar la configuración en `config.json`

### 2. Iniciar el receptor

```bash
npm start
```

Queda escuchando en background. Cada archivo (imagen, PDF, video) o mensaje de texto que llegue a los grupos configurados se descarga automáticamente.

### 3. Consultar la bitácora

```bash
npm run bitacora
```

Con filtros:
```bash
npm run bitacora -- --grupo "Cobranzas" --desde 2026-06-18 --tipo archivo --ultimos 20
```

## Estructura de archivos generados

```
config.json              ← configuración (grupos y carpetas)
bitacora.jsonl           ← registro de todo lo descargado
downloads/
  cobranzas-local/
    2026-06-18_09-30-00_Juan Perez.jpg
    2026-06-18_09-31-00_Maria Garcia.pdf
    mensajes.txt         ← si habilitaste texto para este grupo
  cobranzas-transporte/
    ...
```

## Opciones de `config.json`

```json
{
  "groups": [
    {
      "name": "Nombre exacto del grupo",
      "folder": "./downloads/carpeta",
      "descargarTexto": true
    }
  ],
  "bitacora": "./bitacora.jsonl"
}
```

## Mantenerlo activo (opcional)

Para que corra en background sin ventana abierta, instalar PM2:

```bash
npm install -g pm2
pm2 start index.mjs --name whatsapp-dl
pm2 save
pm2 startup   # para que arranque automáticamente con Windows
```

## Riesgo de ban

Este programa usa WhatsApp Web (no la API oficial de Meta). Opera en modo lectura únicamente, lo que reduce el riesgo. Para un uso en producción de alto volumen, evaluar la [API oficial de WhatsApp Business](https://business.whatsapp.com/products/business-platform).

## Licencia

MIT
