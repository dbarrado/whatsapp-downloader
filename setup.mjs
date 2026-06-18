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

client.on('qr', async (qr) => {
  await QRCode.toFile(QR_PATH, qr, { width: 400, margin: 2 });
  console.log('\n📱 Escaneá el QR que se abrió en pantalla.');
  console.log('   WhatsApp → ··· → Dispositivos vinculados → Vincular dispositivo\n');
  exec(`start "" "${QR_PATH}"`);
});

client.on('authenticated', () => {
  if (fs.existsSync(QR_PATH)) fs.unlinkSync(QR_PATH);
  console.log('✅ Autenticado.\n');
});

client.on('ready', async () => {
  console.log('🟢 Conectado. Cargando lista de grupos...\n');

  const chats = await client.getChats();
  const grupos = chats.filter(c => c.isGroup).map(c => c.name).sort();

  console.log(`Tenés ${grupos.length} grupos disponibles.\n`);

  const selectedGroups = [];

  while (true) {
    const busqueda = await rl.question('Buscá un grupo por nombre (o Enter para terminar): ');
    if (!busqueda.trim()) break;

    const matches = grupos.filter(g => g.toLowerCase().includes(busqueda.toLowerCase()));
    if (!matches.length) { console.log('  Sin resultados. Probá con otra palabra.\n'); continue; }

    matches.forEach((g, i) => console.log(`  ${String(i + 1).padStart(2)}. ${g}`));

    const seleccion = await rl.question('\n¿Cuáles agregás? (números separados por coma, ej: 1,3): ');
    const indices = seleccion.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < matches.length);

    for (const idx of indices) {
      const nombre = matches[idx];
      if (selectedGroups.find(g => g.name === nombre)) { console.log(`  "${nombre}" ya está en la lista.`); continue; }

      const slugDefault = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const carpeta = await rl.question(`  Carpeta para "${nombre}" [./downloads/${slugDefault}]: `);
      const folder = carpeta.trim() || `./downloads/${slugDefault}`;

      const texto = await rl.question(`  ¿Guardar también mensajes de texto? (s/N): `);
      selectedGroups.push({ name: nombre, folder, descargarTexto: texto.trim().toLowerCase() === 's' });
      console.log(`  ✅ "${nombre}" → ${folder}\n`);
    }

    const continuar = await rl.question('¿Agregás otro grupo? (s/N): ');
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

console.log('🔄 Iniciando WhatsApp...\n');
client.initialize();
