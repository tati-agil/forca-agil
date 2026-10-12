/* AMBIENTE DE TESTES — servidor local do site ligado ao Firebase Emulator.
 * Serve a pasta do site e, SÓ no index.html, declara window.FA_AMBIENTE_TESTES antes de qualquer script: é isso que
 * faz forca-agil/firebase.js usar o emulador (projeto "demo-", banco 127.0.0.1:9000, login 127.0.0.1:9099) em vez
 * do Firebase de verdade. Escuta só em 127.0.0.1. Não grava nada.
 *
 *   node .github/scripts/ambiente-local/servidor.js <pasta do site> <porta> [endereço inicial]
 *   SEM_NAVEGADOR=1 → não abre o navegador. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { exec } = require('child_process');
const S = require('./semente');
const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..'));
const PORTA = +process.argv[3] || 8814;
const INICIO = process.argv[4] || '#avaliacoes?mf=mapa';
const ENDERECO = 'http://127.0.0.1:' + PORTA + '/index.html' + INICIO;
const DECLARACAO = '<script>window.FA_AMBIENTE_TESTES = ' + JSON.stringify({ projeto: S.PROJETO, banco: { host: S.BANCO.host, porta: S.BANCO.porta }, login: { host: S.LOGIN.host, porta: S.LOGIN.porta } }) + ';</script>';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
if (!fs.existsSync(path.join(RAIZ, 'index.html'))) { console.error('Não encontrei o site em ' + RAIZ); process.exit(1); }

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('não encontrado'); }
    if (path.basename(f) === 'index.html') d = Buffer.from(String(d).replace('<head>', '<head>\n' + DECLARACAO), 'utf8');
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d);
  });
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log('O ambiente de testes já está aberto em outra janela. Abrindo o navegador...'); if (!process.env.SEM_NAVEGADOR) exec('start "" "' + ENDERECO + '"'); setTimeout(() => process.exit(0), 1500); }
  else { console.error(e); process.exit(1); }
}).listen(PORTA, '127.0.0.1', () => {
  console.log('Site em AMBIENTE DE TESTES (Firebase Emulator): ' + ENDERECO);
  if (!process.env.SEM_NAVEGADOR) exec('start "" "' + ENDERECO + '"');
});
