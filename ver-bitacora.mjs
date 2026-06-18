/**
 * whatsapp-downloader — visor de bitácora
 * Uso: npm run bitacora [-- --grupo "Nombre" --desde 2026-06-18 --tipo imagen]
 */

import fs from 'fs';

const BITACORA = './bitacora.jsonl';

// Parsear argumentos
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const filtroGrupo = get('--grupo');
const filtroDesde = get('--desde');
const filtroTipo  = get('--tipo');   // 'archivo' | 'texto'
const limite      = parseInt(get('--ultimos') || '0');

if (!fs.existsSync(BITACORA)) {
  console.log('\n📋 La bitácora todavía está vacía. Iniciá el programa con npm start.\n');
  process.exit(0);
}

const lineas = fs.readFileSync(BITACORA, 'utf8').trim().split('\n').filter(Boolean);
let entradas = lineas.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Filtros
if (filtroGrupo) entradas = entradas.filter(e => e.grupo?.toLowerCase().includes(filtroGrupo.toLowerCase()));
if (filtroDesde) entradas = entradas.filter(e => e.ts >= filtroDesde);
if (filtroTipo)  entradas = entradas.filter(e => e.tipo === filtroTipo);
if (limite > 0)  entradas = entradas.slice(-limite);

// Resumen por grupo
const resumen = {};
for (const e of lineas.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)) {
  if (!resumen[e.grupo]) resumen[e.grupo] = { archivos: 0, textos: 0 };
  if (e.tipo === 'archivo') resumen[e.grupo].archivos++;
  if (e.tipo === 'texto')   resumen[e.grupo].textos++;
}

console.log('\n📋 BITÁCORA — WhatsApp Downloader');
console.log('─'.repeat(60));

if (filtroGrupo || filtroDesde || filtroTipo) {
  console.log(`   Filtros: ${[
    filtroGrupo ? `grupo="${filtroGrupo}"` : '',
    filtroDesde ? `desde=${filtroDesde}` : '',
    filtroTipo  ? `tipo=${filtroTipo}` : ''
  ].filter(Boolean).join(' · ')}`);
}

console.log(`   Total registros: ${lineas.length} | Mostrando: ${entradas.length}\n`);

// Resumen por grupo
console.log('📊 Resumen por grupo:');
for (const [grupo, data] of Object.entries(resumen)) {
  console.log(`   • ${grupo}: ${data.archivos} archivos, ${data.textos} mensajes de texto`);
}
console.log('');

if (!entradas.length) { console.log('   Sin registros con los filtros aplicados.\n'); process.exit(0); }

// Detalle
console.log('─'.repeat(60));
for (const e of entradas) {
  const fecha = e.ts?.replace('T', ' ').slice(0, 19) || '—';
  const icono = e.tipo === 'archivo' ? '📥' : '💬';
  const nombre = e.archivo ? e.archivo.split(/[\\/]/).pop() : '';
  console.log(`${icono}  ${fecha}`);
  console.log(`   Grupo: ${e.grupo} | De: ${e.de}`);
  if (e.tipo === 'archivo') {
    console.log(`   Archivo: ${nombre} (${e.mimetype || ''})`);
  } else {
    const texto = e.texto || '';
    console.log(`   Texto: "${texto.slice(0, 100)}${texto.length > 100 ? '...' : ''}"`);
  }
  console.log('');
}

console.log('─'.repeat(60));
console.log(`\n   Filtros disponibles:`);
console.log(`   npm run bitacora -- --grupo "Nombre" --desde 2026-06-18 --tipo archivo --ultimos 20\n`);
