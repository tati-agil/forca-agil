/* ═════════════════════════════════════════════════════════════════
   DIAGNÓSTICO (SÓ LEITURA) dos conceitos arquiteturais REALMENTE existentes × o modelo aprovado de naturezas
   (forca-agil/naturezas-arquiteturais.js: 15 naturezas, Produto/Serviço a única conjunta, 6 classificações técnicas do
   motor preservadas).

   Lê taxonomia/arquitetural/conceitos e avaliacao-classificacoes e mostra, por natureza: cadastrada · a cadastrar
   (definição aprovada) · pendente (E5) · ausente · requer revisão (inativa, sem definição, ligada a outra classificação,
   cadastrada antes da definição aprovada); as classificações técnicas (preservadas, ligadas à Avaliação?); conceitos fora
   do modelo e possíveis duplicidades. É a MESMA função (diagnosticar) que a tela usa em Verificações do sistema.

   Este script NÃO grava, NÃO cadastra e NÃO migra nada: não há caminho de gravação no código, só .once('value').
   Disparo manual: workflow "Taxonomia — diagnóstico das naturezas (só leitura)". Teste: teste-naturezas-arquiteturais.js.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const NA = require(path.join(__dirname, '..', '..', 'forca-agil', 'naturezas-arquiteturais.js'));

const SIT = { cadastrada: 'cadastrada', 'a-cadastrar': 'a cadastrar (definição aprovada)', pendente: 'definição pendente (E5)', ausente: 'CONCEITO AUSENTE', inconsistente: 'REQUER REVISÃO' };

function relatorio(dg) {
  const l = [];
  l.push('Naturezas previstas: ' + dg.naturezas.length + ' · problemas: ' + dg.problemas + (dg.ok ? ' · modelo coerente' : ''));
  dg.naturezas.forEach((x) => l.push('  ' + (x.problemas.length ? '!' : '-') + ' ' + x.rotulo + ' [' + x.conceito + ']: ' + (x.aguardaDefinicao && x.situacao === 'a-cadastrar' ? 'a cadastrar (definição aguardando aprovação)' : SIT[x.situacao]) + (x.nome ? ' — nome atual "' + x.nome + '"' : '') + (x.problemas.length ? ' (' + x.problemas.join(', ') + ')' : '')));
  l.push('Classificações técnicas do motor (não são naturezas):');
  dg.classificacoesTecnicas.forEach((x) => l.push('  ' + (x.problemas.length || !x.existe ? '!' : '-') + ' ' + x.codigo + ': ' + (x.existe ? 'preservada' + (x.nome ? ' ("' + x.nome + '")' : '') : 'SEM CONCEITO') + (x.ligada === true ? ', ligada à Avaliação' : x.ligada === false ? ', sem ligação' : '') + ' → ' + (x.naturezas.join(', ') || 'nenhuma natureza') + (x.problemas.length ? ' (' + x.problemas.join(', ') + ')' : '')));
  if (dg.foraDoModelo.length) { l.push('Fora do modelo:'); dg.foraDoModelo.forEach((x) => l.push('  ? ' + x.codigo + (x.nome ? ' ("' + x.nome + '")' : '') + (x.naturezaDe ? ' naturezaDe=' + x.naturezaDe : ''))); }
  if (dg.duplicados.length) { l.push('Possíveis duplicidades:'); dg.duplicados.forEach((x) => l.push('  ! ' + x.motivo + ': ' + x.codigos.join(' = '))); }
  return l.join('\n');
}

async function ler(db) {
  const [c, lig] = await Promise.all([db.ref('taxonomia/arquitetural/conceitos').once('value'), db.ref('avaliacao-classificacoes').once('value')]);
  return NA.diagnosticar(c.val() || {}, lig.val() || {});
}

module.exports = { relatorio, ler };

if (require.main === module) {
  (async () => {
    const admin = require('firebase-admin');
    admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: process.env.FA_DATABASE_URL || 'https://kyber-agil-default-rtdb.firebaseio.com' });
    const dg = await ler(admin.database());
    console.log('Modo: SÓ LEITURA (nada é gravado)');
    console.log(relatorio(dg));
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
