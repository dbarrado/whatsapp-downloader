/**
 * whatsapp-downloader — receptor principal
 * Descarga archivos y texto de los grupos configurados en config.json
 * Uso: npm start
 *
 * ══ POLÍTICA DE SOLO LECTURA ══════════════════════════════════════════════
 *
 * Este programa escucha ÚNICAMENTE el evento 'message' (mensajes entrantes
 * de otros contactos). Intencionalmente NO implementa:
 *
 *   ✗  client.sendMessage()     — envío de mensajes
 *   ✗  evento 'message_create'  — captura de mensajes propios/enviados
 *   ✗  respuestas automáticas   — cualquier forma de reply automático
 *
 * Si necesitás agregar envío de mensajes:
 *   → Usá un número DEDICADO exclusivamente para este fin.
 *   → WhatsApp detecta patrones de envío automatizado y puede banear la línea.
 *   → El riesgo de ban aumenta significativamente con el volumen de envíos,
 *     los destinatarios desconocidos, y los patrones no humanos (velocidad,
 *     horario, repetición). Lectura pura tiene riesgo mínimo.
 *   → Para envío en producción, evaluá la API oficial de WhatsApp Business:
 *     https://business.whatsapp.com/products/business-platform
 *
 * ══════════════════════════════════════════════════════════════════════════
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
let config;
try {
  config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch {
  console.error('\n❌ No encontré config.json.\n   Primero ejecutá: npm run setup\n');
  process.exit(1);
}

const BITACORA = config.bitacora || './bitacora.jsonl';
const groupMap = new Map(config.groups.map(g => [g.name, g]));

// Crear carpetas de descarga
for (const g of config.groups) {
  fs.mkdirSync(g.folder, { recursive: true });
}

// ─── BITÁCORA ────────────────────────────────────────────────────────────────
function registrar(entry) {
  const linea = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  fs.appendFileSync(BITACORA, linea + '\n');
}

// ─── CLIENTE ─────────────────────────────────────────────────────────────────
const CHROME_CACHE = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wwebjs/wwebjs-cdn/main/cache.json',
  },
  puppeteer: {
    headless: true,
    ...(CHROME_CACHE ? { executablePath: CHROME_CACHE } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
           '--no-first-run', '--no-default-browser-check', '--disable-extensions']
  }
});

const QR_PATH = './qr.png';

let qrAbierto = false;
client.on('qr', async (qr) => {
  await QRCode.toFile(QR_PATH, qr, { width: 400, margin: 2 });
  if (!qrAbierto) {
    exec(`start "" "${QR_PATH}"`);
    qrAbierto = true;
    console.log('\n📱 Escaneá el QR que se abrió en pantalla.');
    console.log('   WhatsApp → ··· → Dispositivos vinculados → Vincular dispositivo\n');
  } else {
    console.log('🔄 QR renovado automáticamente — la imagen se actualizó.\n');
  }
});

client.on('authenticated', () => {
  if (fs.existsSync(QR_PATH)) {
    fs.unlinkSync(QR_PATH);
    exec('taskkill /F /IM Microsoft.Photos.exe 2>nul', () => {});
  }
  console.log('✅ Autenticado. Sesión guardada.\n');
});

client.on('ready', () => {
  console.log('🟢 Conectado. Monitoreando grupos:\n');
  config.groups.forEach(g => console.log(`   • "${g.name}" → ${path.resolve(g.folder)}`));
  console.log('\n   (Dejá esta ventana abierta para seguir recibiendo archivos.)\n');
});

// ─── RECEPCIÓN ───────────────────────────────────────────────────────────────
client.on('message', async (msg) => {
  const chat = await msg.getChat();
  if (!chat.isGroup) return;

  const grupoConfig = groupMap.get(chat.name);
  if (!grupoConfig) return;

  const contact = await msg.getContact();
  const sender = (contact.pushname || contact.number || 'desconocido')
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '').trim();
  const ts = new Date().toISOString().replace('T', '_').replace(/:/g, '-').split('.')[0];

  // Archivo (imagen, PDF, video, etc.)
  if (msg.hasMedia) {
    const media = await msg.downloadMedia();
    if (!media) return;

    const extMap = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/gif': 'gif', 'application/pdf': 'pdf',
      'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3'
    };
    const ext = extMap[media.mimetype] || media.mimetype.split('/')[1]?.split(';')[0] || 'bin';
    const filename = `${ts}_${sender}.${ext}`;
    const filepath = path.join(grupoConfig.folder, filename);

    fs.writeFileSync(filepath, Buffer.from(media.data, 'base64'));

    console.log(`📥 ${filename}`);
    console.log(`   Grupo: ${chat.name} | De: ${sender} | Tipo: ${media.mimetype}\n`);

    registrar({ grupo: chat.name, de: sender, tipo: 'archivo', mimetype: media.mimetype, archivo: filepath, texto: null });
    return;
  }

  // Texto
  if (grupoConfig.descargarTexto && msg.body) {
    const logPath = path.join(grupoConfig.folder, 'mensajes.txt');
    const linea = `[${ts}] ${sender}: ${msg.body}\n`;
    fs.appendFileSync(logPath, linea);

    console.log(`💬 Texto guardado — Grupo: ${chat.name} | De: ${sender}`);
    console.log(`   "${msg.body.slice(0, 80)}${msg.body.length > 80 ? '...' : ''}"\n`);

    registrar({ grupo: chat.name, de: sender, tipo: 'texto', archivo: logPath, texto: msg.body });
  }
});

client.on('disconnected', (reason) => {
  console.log(`\n⚠️  Desconectado: ${reason}`);
  console.log('   Volvé a correr npm start para reconectar.\n');
});

// ─── INICIO ──────────────────────────────────────────────────────────────────
console.log('\n⚠️  Este programa es de SOLO LECTURA — no envía mensajes.\n');
console.log('🔄 Iniciando WhatsApp...\n');
client.initialize();
