/* Auditoria SOMENTE LEITURA — Fase 5 (Security Rules) da Construção da
   Aposta. Não escreve nada no banco. Objetivo: descobrir, nos dados reais
   de produção, se algum facilitador GLOBAL (fa-facilitadores) opera hoje
   uma turma sem ter vínculo em turmas-equipe — o caso que a nova regra
   "admin OU (facilitador global + vínculo na turma)" passaria a recusar.

   Usa as mesmas credenciais (FA_TEST_ADMIN_EMAIL/PASSWORD) já usadas por
   run-testes-automaticos.js — nenhum segredo novo. Autentica via REST do
   Firebase Auth e lê via REST do Realtime Database (só GET, nunca
   PUT/PATCH/DELETE). Zero dependências de npm: só https/crypto do Node.

   Rodar via: node .github/scripts/audit-facilitadores-turmas.js
   (workflow_dispatch — ver .github/workflows/audit-facilitadores-turmas.yml) */

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

/* Mesma convenção usada em toda a aplicação (aposta.js, facilitador.js,
   admin.js, auth.js): lowercase, @ e . viram _, o resto some, até 64
   chars. Reproduzida aqui em JS puro (não nas Rules) só para comparar
   chaves ao montar o relatório — nada disto é gravado no banco. */
function emailKey(email) {
  return String(email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
}

function caracteresForaDoComum(email) {
  /* Sinaliza qualquer e-mail cujo formato pode complicar a derivação da
     chave DENTRO das Firebase Rules (que não têm replace global nem
     regex-replace-all — ver checkpoint). Não bloqueia nada aqui, só
     registra para eu decidir a estratégia de identidade nas rules com
     dados reais em mãos, em vez de suposição. */
  const local = String(email || '').split('@')[0] || '';
  const pontos = (local.match(/\./g) || []).length;
  const temHifen = /-/.test(local);
  const temMaiuscula = /[A-Z]/.test(email || '');
  const motivos = [];
  if (pontos > 0) motivos.push(pontos + ' ponto(s) no local-part');
  if (temHifen) motivos.push('hífen no local-part');
  if (temMaiuscula) motivos.push('maiúscula no e-mail');
  return motivos;
}

(async () => {
  const email = process.env.FA_TEST_ADMIN_EMAIL;
  const password = process.env.FA_TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Faltam FA_TEST_ADMIN_EMAIL/FA_TEST_ADMIN_PASSWORD no ambiente.');
    process.exit(1);
  }

  const auth = await postJson(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY,
    { email, password, returnSecureToken: true }
  );
  const idToken = auth.idToken;

  const [facilitadores, equipe, turmas] = await Promise.all([
    getJson(DB_URL + '/fa-facilitadores.json?auth=' + idToken),
    getJson(DB_URL + '/turmas-equipe.json?auth=' + idToken),
    getJson(DB_URL + '/turmas.json?auth=' + idToken)
  ]).then((r) => r.map((v) => v || {}));

  const linhas = [];
  const md = [];
  md.push('# Auditoria — fa-facilitadores × turmas-equipe (Fase 5, somente leitura)\n');

  /* 1) fa-facilitadores */
  const facKeys = Object.keys(facilitadores).filter((k) => facilitadores[k].ativo !== false);
  md.push('## 1) fa-facilitadores ativos: ' + facKeys.length + '\n');
  facKeys.forEach((k) => {
    const f = facilitadores[k];
    md.push('- `' + k + '` — ' + (f.email || '(sem email)') + ' (' + (f.name || '(sem nome)') + ')');
  });

  /* 2)/3) vínculos por turma, papel */
  md.push('\n## 2)/3) Vínculos em turmas-equipe por facilitador\n');
  const vinculoPorFac = {};
  Object.keys(equipe).forEach((turmaKey) => {
    Object.keys(equipe[turmaKey] || {}).forEach((facKey) => {
      vinculoPorFac[facKey] = vinculoPorFac[facKey] || [];
      vinculoPorFac[facKey].push({ turma: turmaKey, papel: (equipe[turmaKey][facKey] || {}).papel || '(sem papel)' });
    });
  });
  const papeisEncontrados = new Set();
  Object.values(vinculoPorFac).forEach((lista) => lista.forEach((v) => papeisEncontrados.add(v.papel)));
  md.push('Papéis encontrados em turmas-equipe (todos os nós, não só facilitadores globais): ' +
    (papeisEncontrados.size ? Array.from(papeisEncontrados).join(', ') : '(nenhum vínculo cadastrado)'));
  facKeys.forEach((k) => {
    const vs = vinculoPorFac[k] || [];
    md.push('- `' + k + '`: ' + (vs.length ? vs.map((v) => v.turma + ' (' + v.papel + ')').join(', ') : '(nenhum vínculo em turmas-equipe)'));
  });

  /* 4) turmas com apostaHabilitada */
  const turmasComAposta = Object.keys(turmas).filter((k) => turmas[k] && turmas[k].apostaHabilitada);
  md.push('\n## 4) Turmas com apostaHabilitada: ' + turmasComAposta.length + '\n');
  turmasComAposta.forEach((k) => md.push('- `' + k + '` — ' + (turmas[k].label || k)));

  /* 5)/6) quem hoje abriria Aposta sem vínculo na turma */
  md.push('\n## 5)/6) Facilitadores globais que HOJE conseguem abrir a Aposta de uma turma sem vínculo lá\n');
  let algumCaso = false;
  facKeys.forEach((k) => {
    const f = facilitadores[k];
    const minhasTurmas = new Set((vinculoPorFac[k] || []).map((v) => v.turma));
    const semVinculo = turmasComAposta.filter((t) => !minhasTurmas.has(t));
    if (semVinculo.length) {
      algumCaso = true;
      md.push('- **' + (f.email || k) + '** (' + (f.name || '') + ') hoje abre a Aposta de: ' + semVinculo.map((t) => turmas[t].label || t).join(', ') +
        ' — sem vínculo em turmas-equipe para ' + (semVinculo.length > 1 ? 'nenhuma dessas turmas' : 'essa turma') + '.');
    }
  });
  if (!algumCaso) md.push('Nenhum caso encontrado — todo facilitador global com aposta habilitada já tem vínculo em turmas-equipe na(s) turma(s) correspondente(s).');

  /* Dados de formato de e-mail, para a derivação de identidade nas Rules
     (não é possível fazer replace global/regex nas Firebase Rules —
     preciso saber se e-mails reais fogem do padrão "sem ponto/hífen no
     local-part" antes de decidir como comparar identidade nas rules). */
  md.push('\n## Formato de e-mail (para a estratégia de identidade nas Security Rules)\n');
  const todosEmails = new Set();
  facKeys.forEach((k) => facilitadores[k].email && todosEmails.add(facilitadores[k].email));
  Object.keys(equipe).forEach((t) => Object.keys(equipe[t] || {}).forEach((fk) => {
    const e = (equipe[t][fk] || {}).email;
    if (e) todosEmails.add(e);
  }));
  let algumForaDoComum = false;
  todosEmails.forEach((e) => {
    const motivos = caracteresForaDoComum(e);
    if (motivos.length) {
      algumForaDoComum = true;
      md.push('- ' + e + ' — ' + motivos.join('; '));
    }
  });
  if (!algumForaDoComum) md.push('Nenhum e-mail de facilitador/equipe foge do padrão simples (sem ponto, hífen ou maiúscula no local-part).');

  const relatorio = md.join('\n');
  console.log(relatorio);
  if (process.env.GITHUB_STEP_SUMMARY) {
    require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, relatorio + '\n');
  }
})().catch((err) => {
  console.error('Falha na auditoria:', err.message);
  process.exit(1);
});
