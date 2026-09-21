/* Backfill CONTROLADO — Fase 5 (grupos-resumo) da Construção da Aposta.

   Escreve SOMENTE grupos-resumo/<grupoId> = { nome, qtdMembros } para os
   grupos que hoje existem dentro de uma execução ATUAL (apostas/<turma>/
   atual) e ainda não têm resumo. Nunca toca no registro original do
   grupo (nome/membros/etapa/dados/ciclos) — só cria o nó espelho que a
   Fase 5 passou a exigir para a tela de escolha de grupo funcionar sem
   a leitura ampla que este mesmo projeto removeu.

   Não mexe em execuções HISTÓRICAS (as que não são mais "atual"): essas
   continuam servidas pela leitura própria já existente (S5 — SOU_MEMBRO
   por grupo), que não depende de grupos-resumo.

   A auditoria de leitura (.github/scripts/audit-facilitadores-turmas.js,
   seção "Grupos nas execuções ATUAIS") já confirmou, em produção, que
   hoje existe UM único caso: turma -P0j9L8n_caXj462-Abg, execução
   -P1zX8b4UP1pBG5r4x1B, grupo -P1zXEHageKoQE7rVfW1 ("ggg", 1 membro).
   Mesmo assim este script NUNCA confia num número fixo: ele relê a
   produção na hora de rodar e só grava o que encontrar de verdade — se
   o estado mudou desde a auditoria, o script mostra a lista nova e para
   ANTES de escrever, do mesmo jeito que a auditoria original exigiu.

   Dry-run por padrão: só GRAVA de verdade se BACKFILL_CONFIRMAR=sim no
   ambiente. Sem essa variável, lista o que faria e para — nunca escreve
   "sem querer" por causa de um clique em Run workflow. */

const https = require('https');

const API_KEY = 'AIzaSyAmnQTedd2eqL0d-3kMD2oWNeg0rwP6Lx0';
const DB_URL = 'https://kyber-agil-default-rtdb.firebaseio.com';

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        const parsed = JSON.parse(chunks);
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ': ' + chunks));
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ': ' + chunks));
        resolve(chunks ? JSON.parse(chunks) : null);
      });
    }).on('error', reject);
  });
}

/* PATCH em vez de PUT: grava só os nós grupos-resumo/<id> listados,
   nunca reescreve (nem apaga) o resto de apostas/ — equivalente ao
   update() multi-caminho que o cliente usa, só que via REST. */
function patchJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ': ' + chunks));
        resolve(chunks ? JSON.parse(chunks) : null);
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const email = process.env.FA_TEST_ADMIN_EMAIL;
  const password = process.env.FA_TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Faltam FA_TEST_ADMIN_EMAIL/FA_TEST_ADMIN_PASSWORD no ambiente.');
    process.exit(1);
  }
  const confirmar = process.env.BACKFILL_CONFIRMAR === 'sim';

  const auth = await postJson(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY,
    { email, password, returnSecureToken: true }
  );
  const idToken = auth.idToken;

  /* apostas/ NÃO é legível de uma vez, nem por admin: a Rule é
     deliberadamente estreita, path por path (é o mesmo princípio que
     motivou grupos-resumo) — não existe ".read" nem em apostas/ (raiz)
     nem em apostas/<turma> (o nó da turma) inteiros, só nos campos
     específicos mais fundo (atual, execucoes/$execKey, etc). Confirmado
     ao vivo: GET /apostas.json voltou 401 "Permission denied", mesmo
     autenticado como admin. Por isso a leitura aqui é sempre por turma:
     lista as turmas (turmas/ é legível por qualquer @previ.com.br) e,
     para cada uma, lê só apostas/<turma>/atual e, se houver,
     apostas/<turma>/execucoes/<execId> — os dois caminhos que a Rule
     realmente autoriza para admin. */
  const turmas = (await getJson(DB_URL + '/turmas.json?auth=' + idToken)) || {};
  const turmaKeys = Object.keys(turmas);

  const pendentes = [];
  for (const turmaKey of turmaKeys) {
    const atualId = await getJson(DB_URL + '/apostas/' + turmaKey + '/atual.json?auth=' + idToken);
    if (!atualId) continue;
    const exec = (await getJson(DB_URL + '/apostas/' + turmaKey + '/execucoes/' + atualId + '.json?auth=' + idToken)) || {};
    const grupos = exec.grupos || {};
    const resumoExistente = exec['grupos-resumo'] || {};
    Object.keys(grupos).forEach((grupoId) => {
      if (resumoExistente[grupoId]) return; /* já tem resumo -- nada a fazer */
      const grp = grupos[grupoId] || {};
      const qtd = Object.keys(grp.membros || {}).length;
      pendentes.push({
        turmaKey: turmaKey, execId: atualId, grupoId: grupoId,
        nome: grp.nome || null, qtdMembros: qtd
      });
    });
  }

  if (!pendentes.length) {
    console.log('Nada pendente: toda execução ATUAL já tem grupos-resumo para os grupos que existem hoje. Nenhuma escrita necessária.');
    return;
  }

  console.log('Grupos SEM grupos-resumo em execuções ATUAIS, encontrados agora em produção:\n');
  pendentes.forEach((p) => {
    console.log('- turma `' + p.turmaKey + '`, execução `' + p.execId + '`, grupo `' + p.grupoId +
      '`: nome=' + JSON.stringify(p.nome) + ', qtdMembros=' + p.qtdMembros);
  });

  if (!confirmar) {
    console.log('\nDRY-RUN (padrão): nada foi gravado. Rode de novo com BACKFILL_CONFIRMAR=sim para gravar exatamente a lista acima.');
    return;
  }

  console.log('\nBACKFILL_CONFIRMAR=sim — gravando grupos-resumo para os ' + pendentes.length + ' grupo(s) acima...');
  for (const p of pendentes) {
    const path = DB_URL + '/apostas/' + p.turmaKey + '/execucoes/' + p.execId + '/grupos-resumo.json?auth=' + idToken;
    await patchJson(path, { [p.grupoId]: { nome: p.nome, qtdMembros: p.qtdMembros } });
    console.log('  gravado: ' + p.turmaKey + '/' + p.execId + '/' + p.grupoId);
  }
  console.log('\nBackfill concluído — ' + pendentes.length + ' grupo(s) de resumo gravados. Nenhum registro original de grupo foi tocado.');
})().catch((err) => {
  console.error('Falha no backfill:', err.message);
  process.exit(1);
});
