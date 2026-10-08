/* ═════════════════════════════════════════════════════════════════
   Taxonomia — CONSTRUÇÃO ÚNICA do índice reverso de conceitos filhos.

   Por que existe: as regras do banco precisam provar que um conceito organizacional NÃO tem filhos antes de
   deixá-lo trocar de camada ("Tipo organizacional" ⇄ "Organização do trabalho"). O Realtime Database não sabe
   procurar "quem aponta para mim"; por isso há o índice taxonomia/organizacional/filhos/<pai>/<filho> = true,
   coerente com conceito.pai, e a marca taxonomia/meta/indiceFilhos dizendo que ele está COMPLETO.

   Num banco novo, a carga inicial já grava índice + marca (cada conceito com pai é novo e as regras só o aceitam
   com a sua entrada — completo por construção). Em produção a carga é anterior ao índice: nenhum cliente pode
   criar a marca (as regras recusam), e ela só vem DAQUI — a conta de serviço lê TODOS os conceitos e grava, numa
   ÚNICA gravação atômica, as entradas que faltam + a marca + uma linha no histórico geral. Até isso rodar, a troca
   de camada fica recusada pelo banco (falha fechada).

   Só disparo manual (workflow "Taxonomia — índice de filhos"). Padrão: simulação (lista o que faria, não grava).
   Grava só com BACKFILL_CONFIRMAR=sim. Recusa rodar de novo se a marca já existe. Não toca em conceitos,
   fontes, relações nem em nenhum outro nó.

   As funções planejar/aplicar recebem um banco "parecido com o SDK" (ref(caminho).once('value'), ref().update,
   ref(caminho).push().key) — o mesmo código roda contra produção (firebase-admin) e contra o emulador nos testes
   (teste-rules-taxonomia-governanca.js, seção E).
   ═════════════════════════════════════════════════════════════════ */
'use strict';

const RAIZ = 'taxonomia';
const AUTOR = 'workflow:taxonomia-indice-filhos';

/* Pura: dado o que está no banco, o que precisa ser gravado. */
function planejar(conceitos, filhosExistentes, marca) {
  conceitos = conceitos || {}; filhosExistentes = filhosExistentes || {};
  const desejadas = {}, avisos = [], estranhas = [];
  Object.keys(conceitos).sort().forEach((cod) => {
    const c = conceitos[cod];
    if (!c || !c.pai) return;
    desejadas[c.pai + '/' + cod] = true;
    if (!conceitos[c.pai]) avisos.push(cod + ' aponta para o pai "' + c.pai + '", que não existe na Taxonomia.');
  });
  Object.keys(filhosExistentes).forEach((pai) => Object.keys(filhosExistentes[pai] || {}).forEach((filho) => {
    if (!desejadas[pai + '/' + filho]) estranhas.push(pai + '/' + filho);
  }));
  const faltam = Object.keys(desejadas).filter((k) => {
    const [pai, filho] = k.split('/');
    return !(filhosExistentes[pai] && filhosExistentes[pai][filho] === true);
  }).sort();
  return {
    jaConstruido: !!marca,
    total: Object.keys(desejadas).length,
    faltam,
    estranhas: estranhas.sort(),
    avisos,
    /* só constrói se: a marca não existe e nenhuma entrada existente contradiz conceito.pai */
    pode: !marca && estranhas.length === 0
  };
}

async function ler(db, caminho) { return (await db.ref(caminho).once('value')).val(); }

/* Lê, planeja e (se confirmar) grava tudo numa gravação só. Devolve o plano e se gravou. */
async function aplicar(db, opcoes) {
  opcoes = opcoes || {};
  const agora = opcoes.agora || new Date().toISOString();
  const [conceitos, filhos, marca] = await Promise.all([
    ler(db, RAIZ + '/organizacional/conceitos'), ler(db, RAIZ + '/organizacional/filhos'), ler(db, RAIZ + '/meta/indiceFilhos')
  ]);
  const plano = planejar(conceitos, filhos, marca);
  if (!plano.pode || !opcoes.confirmar) return { plano, gravou: false };
  const caminhos = {};
  plano.faltam.forEach((k) => { caminhos[RAIZ + '/organizacional/filhos/' + k] = true; });
  caminhos[RAIZ + '/meta/indiceFilhos'] = { criadoEm: agora, criadoPor: AUTOR };
  const chave = db.ref(RAIZ + '/organizacional/auditoria/_catalogo').push().key;
  caminhos[RAIZ + '/organizacional/auditoria/_catalogo/' + chave] = {
    tipo: 'indice_filhos', conceito: null, campo: 'filhos', valorAnterior: null,
    valorNovo: 'Índice de conceitos filhos construído: ' + plano.total + ' entrada(s)',
    total: plano.total, gravadas: plano.faltam.length, usuario: { email: AUTOR }, dataHora: agora
  };
  await db.ref().update(caminhos);
  return { plano, gravou: true };
}

module.exports = { planejar, aplicar, AUTOR };

if (require.main === module) {
  (async () => {
    const admin = require('firebase-admin');
    const confirmar = process.env.BACKFILL_CONFIRMAR === 'sim';
    admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: process.env.FA_DATABASE_URL || 'https://kyber-agil-default-rtdb.firebaseio.com' });
    const { plano, gravou } = await aplicar(admin.database(), { confirmar });
    console.log('Modo: ' + (confirmar ? 'GRAVAÇÃO' : 'simulação (nada é gravado)'));
    console.log('Conceitos com pai: ' + plano.total + ' · entradas a gravar: ' + plano.faltam.length);
    plano.faltam.forEach((k) => console.log('  + filhos/' + k));
    plano.avisos.forEach((a) => console.log('  aviso: ' + a));
    if (plano.jaConstruido) { console.log('A marca taxonomia/meta/indiceFilhos JÁ existe: o índice foi construído antes. Nada a fazer.'); process.exit(0); }
    if (plano.estranhas.length) {
      console.log('RECUSADO: há entradas no índice que não batem com conceito.pai — investigar antes de construir:');
      plano.estranhas.forEach((k) => console.log('  ! filhos/' + k));
      process.exit(1);
    }
    console.log(gravou ? 'Gravado: índice + marca + linha no histórico geral, numa gravação só.' : 'Simulação concluída. Para gravar, dispare de novo com "Confirmar gravação" marcado.');
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
