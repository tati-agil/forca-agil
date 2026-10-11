/* B4 — copia para functions/site/ os MESMOS arquivos do site que a fronteira confiável executa no servidor
 * (nenhuma regra reescrita). Roda no predeploy das funções (firebase.json) e antes dos testes do emulador.
 *   node .github/scripts/copiar-modulos-fronteira.js            copia
 *   node .github/scripts/copiar-modulos-fronteira.js --conferir  só confere que a cópia é idêntica (sai 1 se não) */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const ARQUIVOS = ['motor-posicionamento-nucleo.js', 'governanca-posicionamento.js', 'questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js',
  'motor-posicionamento.js', 'posicionamentos.js', 'avaliacao-posicionamento.js'];
const DESTINO = path.join(RAIZ, 'functions', 'site');
if (require.main === module) {
  const conferir = process.argv.includes('--conferir');
  let divergentes = 0;
  if (!conferir) fs.mkdirSync(DESTINO, { recursive: true });
  ARQUIVOS.forEach((f) => {
    const origem = fs.readFileSync(path.join(RAIZ, 'forca-agil', f));
    const alvo = path.join(DESTINO, f);
    if (conferir) {
      const igual = fs.existsSync(alvo) && Buffer.compare(fs.readFileSync(alvo), origem) === 0;
      if (!igual) { divergentes++; console.log('DIVERGENTE ' + f); }
    } else fs.writeFileSync(alvo, origem);
  });
  console.log(conferir ? (divergentes ? divergentes + ' arquivo(s) divergente(s).' : 'cópia idêntica (' + ARQUIVOS.length + ' arquivos).') : 'copiados ' + ARQUIVOS.length + ' arquivos para functions/site/.');
  process.exit(divergentes ? 1 : 0);
}
module.exports = { ARQUIVOS, DESTINO };
