/**
 * whatsapp-downloader — setup interactivo
 * Conecta a WhatsApp, muestra tus grupos y genera config.json
 * Uso: npm run setup
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import { exec } from 'child_process';
import readline from 'readline/promises';
import fs from 'fs';

// ─── ⚠️ ADVERTENCIA ──────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  ⚠️   RECOMENDACIÓN IMPORTANTE                                   ║
║                                                                  ║
║  Este programa se conecta a WhatsApp usando un número real.      ║
║  Se recomienda fuertemente usar una LÍNEA DEDICADA               ║
║  exclusivamente para este fin, NO el número principal            ║
║  de tu empresa o uso personal.                                   ║
║                                                                  ║
║  El programa es de SOLO LECTURA — nunca envía mensajes.          ║
╚══════════════════════════════════════════════════════════════════╝
`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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

const QR_PATH = './qr-setup.png';

let qrAbierto = false;
client.on('qr', async (qr) => {
  await QRCode.toFile(QR_PATH, qr, { width: 400, margin: 2 });
  if (!qrAbierto) { exec(`start "" "${QR_PATH}"`); qrAbierto = true; }
  else { console.log('  🔄 QR renovado — la imagen se actualizó automáticamente.\n'); return; }
  console.log('\n─'.repeat(60));
  console.log('  PASO 1 — Escaneá el código QR');
  console.log('─'.repeat(60));
  console.log('  Se abrió una imagen con un código QR en tu pantalla.');
  console.log('  Seguí estos pasos en tu celular:\n');
  console.log('    1. Abrí WhatsApp en el celular');
  console.log('    2. Tocá los tres puntos (...) arriba a la derecha');
  console.log('    3. Tocá "Dispositivos vinculados"');
  console.log('    4. Tocá "Vincular dispositivo"');
  console.log('    5. Apuntá la cámara al código QR de la imagen\n');
  console.log('  ⏳ Esperando que escanees el QR... (volvé a esta ventana después)\n');
});

client.on('authenticated', () => {
  if (fs.existsSync(QR_PATH)) fs.unlinkSync(QR_PATH);
  console.log('─'.repeat(60));
  console.log('  ✅ ¡Listo! WhatsApp conectado correctamente.');
  console.log('     Ya podés cerrar la imagen del QR si sigue abierta.');
  console.log('─'.repeat(60) + '\n');
});

client.on('ready', async () => {
  console.log('🟢 Conectado correctamente a WhatsApp.\n');

  const chats = await client.getChats();
  const grupos = chats.filter(c => c.isGroup).map(c => c.name).sort();

  console.log('─'.repeat(60));
  console.log('  PASO 2 — Elegí qué grupos monitorear');
  console.log('─'.repeat(60));
  console.log(`  Encontramos ${grupos.length} grupos en tu WhatsApp.`);
  console.log('  Vamos a buscarlos de a uno por nombre.\n');
  console.log('  ► Escribí una o varias palabras del nombre del grupo y presioná Enter.');
  console.log('  ► Cuando terminés de agregar grupos, presioná Enter sin escribir nada.\n');

  const selectedGroups = [];

  while (true) {
    const busqueda = await rl.question('🔍 Buscar grupo (o Enter para terminar): ');
    if (!busqueda.trim()) break;

    const matches = grupos.filter(g => g.toLowerCase().includes(busqueda.toLowerCase()));
    if (!matches.length) {
      console.log('  Sin resultados. Probá con otra palabra del nombre.\n');
      continue;
    }

    console.log('\n  Grupos encontrados:');
    matches.forEach((g, i) => console.log(`    ${String(i + 1).padStart(2)}. ${g}`));

    const seleccion = await rl.question('\n  ► Escribí el número del grupo que querés agregar (ej: 1): ');
    const indices = seleccion.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < matches.length);

    for (const idx of indices) {
      const nombre = matches[idx];
      if (selectedGroups.find(g => g.name === nombre)) {
        console.log(`  ⚠️  "${nombre}" ya está en la lista.\n`);
        continue;
      }

      const slugDefault = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      console.log(`\n  PASO 3 — Carpeta de descarga para "${nombre}"`);
      console.log(`  Los archivos se guardarán ahí. Podés dejar la sugerida (Enter) o escribir otra.`);
      const carpeta = await rl.question(`  ► Carpeta [./downloads/${slugDefault}]: `);
      const folder = carpeta.trim() || `./downloads/${slugDefault}`;

      console.log(`\n  PASO 4 — ¿Guardar también los mensajes de texto de "${nombre}"?`);
      console.log('  (además de imágenes y archivos)');
      const texto = await rl.question('  ► ¿Sí o No? (s/N): ');
      selectedGroups.push({ name: nombre, folder, descargarTexto: texto.trim().toLowerCase() === 's' });
      console.log(`\n  ✅ Listo. "${nombre}" → ${folder}\n`);
    }

    const continuar = await rl.question('¿Querés agregar otro grupo? (s/N): ');
    if (continuar.trim().toLowerCase() !== 's') break;
    console.log('');
  }

  if (!selectedGroups.length) {
    console.log('\n⚠️  No seleccionaste ningún grupo. Volvé a correr npm run setup.\n');
    rl.close(); await client.destroy(); process.exit(0);
  }

  const config = { groups: selectedGroups, bitacora: './bitacora.jsonl' };
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

  console.log('\n✅ config.json guardado:\n');
  selectedGroups.forEach(g => console.log(`   • "${g.name}" → ${g.folder}${g.descargarTexto ? ' (texto incluido)' : ''}`));
  console.log('\n   Iniciá el programa con: npm start\n');

  rl.close();
  await client.destroy();
  process.exit(0);
});

console.log('══════════════════════════════════════════════════════════════════');
console.log('  Todo el proceso se hace ACÁ, en esta ventana negra.');
console.log('  Solo vas a necesitar mirar otra ventana cuando salga el QR.');
console.log('  Después de escanearlo, volvé acá y seguí las instrucciones.');
console.log('══════════════════════════════════════════════════════════════════\n');
console.log('🔄 Iniciando... (puede tardar 20 segundos)\n');
client.initialize();
