/* B4 — guarda estrutural da fronteira confiável (sem emulador, sem rede). A prova de comportamento é
 * teste-fronteira-posicionamento.js (emulador de banco + auth + functions). Aqui:
 *   A. a ativação está DESLIGADA no código publicado (ATIVACAO_HABILITADA = false); região única (funções = site);
 *   B. o servidor reutiliza os arquivos do site: copiar-modulos-fronteira.js cobre tudo o que modulos-site.js carrega,
 *      e functions/site/ não vai para o repositório (é gerado no predeploy e antes dos testes);
 *   C. o núcleo (fronteira.js) não depende de Cloud Functions nem do SDK: só do adaptador; os admins fixos são os
 *      mesmos das regras do banco;
 *   D. implantação: o deploy da main continua só hosting + database; as funções só pelo workflow manual (confirmação
 *      IMPLANTAR, só da main, credencial só pela ação oficial, --only functions); o site não publica functions/;
 *      a CSP permite as funções; dependências travadas;
 *   E. regras: validação da redação, ativações e vigência fechadas para todo cliente. */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n'); /* checkout no Windows (core.autocrlf) traz CRLF; o conteúdo do repositório é LF */
let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('A. ativação desligada e região');
const idx = ler('functions/index.js');
afirma(/const ATIVACAO_HABILITADA = false;/.test(idx) && !/ATIVACAO_HABILITADA\s*=\s*true/.test(idx) && !/process\.env/.test(semComentarios(idx)), 'ATIVACAO_HABILITADA = false no código (sem variável de ambiente que a ligue)');
afirma((idx.match(/habilitada: ATIVACAO_HABILITADA/g) || []).length === 2 && (idx.match(/onCall\(/g) || []).length === 4, 'quatro funções chamáveis; conferência e ativação recebem a trava');
/* H3-b: a identidade restrita é EFETIVA — as gravações passam pelas regras (databaseAuthVariableOverride), as leituras pelo admin */
const { UID_FRONTEIRA } = require(path.join(RAIZ, 'functions', 'fronteira.js'));
afirma(UID_FRONTEIRA === 'fronteira-confiavel' && /databaseAuthVariableOverride: \{ uid: UID_FRONTEIRA \}/.test(idx) && /ioDoAdmin\(admin\.database\(\), restrito\.database\(\)/.test(idx),
  'as gravações do servidor usam a instância restrita (uid fronteira-confiavel), não o admin que ignora as regras');
const regFun = (idx.match(/const REGIAO = '([a-z0-9-]+)'/) || [])[1], regSite = (ler('forca-agil/posicionamento-servicos.js').match(/REGIAO_FRONTEIRA = '([a-z0-9-]+)'/) || [])[1];
afirma(regFun && regFun === regSite, 'a mesma região nas funções e no site (' + regFun + ')');
afirma(/kyber-agil-default-rtdb\.firebaseio\.com/.test(ler('forca-agil/firebase.js')) && regFun === 'us-central1', 'a região das funções é a do Realtime Database (default-rtdb = us-central1)');
afirma(!/minInstances/.test(semComentarios(idx)), 'sem instância sempre ligada (minInstances não é configurado)');

console.log('B. os mesmos arquivos do site no servidor');
const { ARQUIVOS } = require('./copiar-modulos-fronteira.js');
const mod = ler('functions/modulos-site.js');
const usados = [...mod.matchAll(/'([a-z0-9-]+\.js)'/g)].map((m) => m[1]);
afirma(usados.length >= 5 && usados.every((f) => ARQUIVOS.includes(f)), 'tudo o que modulos-site.js carrega é copiado de forca-agil/', usados.join());
afirma(ARQUIVOS.every((f) => fs.existsSync(path.join(RAIZ, 'forca-agil', f))), 'os arquivos copiados existem no site');
afirma(/^functions\/site\/$/m.test(ler('.gitignore')) && /^functions\/node_modules\/$/m.test(ler('.gitignore')), 'functions/site e functions/node_modules fora do repositório');
const fj = JSON.parse(ler('firebase.json'));
afirma(fj.functions && fj.functions.source === 'functions' && (fj.functions.predeploy || []).some((c) => /copiar-modulos-fronteira\.js/.test(c)), 'predeploy das funções copia os módulos do site');
afirma(fs.existsSync(path.join(RAIZ, 'functions', 'site')) ? require('child_process').spawnSync('node', [path.join(__dirname, 'copiar-modulos-fronteira.js'), '--conferir']).status === 0 : true,
  'se a cópia existe aqui, é idêntica byte a byte');

console.log('C. núcleo independente');
const fr = semComentarios(ler('functions/fronteira.js'));
afirma(!/require\(['"]firebase/.test(fr) && !/HttpsError|onCall/.test(fr), 'fronteira.js não depende de Cloud Functions nem do SDK (só do adaptador io)');
afirma(!/document\.|window\./.test(fr), 'sem DOM');
const { ADMINS_FIXOS } = require(path.join(RAIZ, 'functions', 'fronteira.js'));
const regras = ler('database.rules.json');
const fixosRegras = [...new Set([...regras.matchAll(/auth\.token\.email === '([^']+)'/g)].map((m) => m[1]))].sort();
afirma(JSON.stringify([...ADMINS_FIXOS].sort()) === JSON.stringify(fixosRegras), 'admins fixos do servidor = os das regras', fixosRegras.join());

console.log('D. implantação');
const dep = ler('.github/workflows/firebase-deploy.yml');
afirma(/--only hosting,database/.test(dep) && !/functions/.test(dep), 'o deploy da main continua só hosting + database (sem funções)');
const df = ler('.github/workflows/deploy-functions.yml');
afirma(/on:\s*\n\s*workflow_dispatch:/.test(df) && !/\n\s*(push|pull_request|schedule):/.test(df), 'funções: só disparo manual');
afirma(/confirmar == 'IMPLANTAR'/.test(df) && /github\.ref == 'refs\/heads\/main'/.test(df), 'exige digitar IMPLANTAR e só da main');
afirma(/--only functions/.test(df) && !/--only [a-z,]*(hosting|database)/.test(df), 'implanta só as funções');
const comSegredo = df.split('\n').filter((l) => /secrets\./.test(l));
afirma(/google-github-actions\/auth@v2/.test(df) && comSegredo.length === 1 && /^\s*credentials_json: \$\{\{ secrets\.FIREBASE_SERVICE_ACCOUNT_KYBER_AGIL \}\}$/.test(comSegredo[0]),
  'credencial só pela ação oficial (credentials_json), nunca num comando');
afirma(/npm ci --prefix functions/.test(df), 'dependências instaladas pelo lock (npm ci)');
const pkg = JSON.parse(ler('functions/package.json'));
afirma(Object.values(pkg.dependencies).every((v) => /^\d+\.\d+\.\d+$/.test(v)) && fs.existsSync(path.join(RAIZ, 'functions', 'package-lock.json')) && pkg.engines.node === '20', 'versões exatas, package-lock e Node 20');
afirma((fj.hosting.ignore || []).includes('functions/**'), 'o site não publica functions/ (código do servidor)');
const csp = fj.hosting.headers.map((h) => h.headers.find((x) => x.key === 'Content-Security-Policy')).filter(Boolean);
afirma(csp.length >= 1 && csp.every((h) => /connect-src[^;]*https:\/\/\*\.cloudfunctions\.net/.test(h.value)), 'a CSP permite chamar as funções');
const tr = ler('.github/workflows/teste-rules.yml');
afirma(/--only database,auth,functions/.test(tr) && /teste-fronteira-posicionamento\.js/.test(tr) && /copiar-modulos-fronteira\.js/.test(tr), 'o CI roda a fronteira nos emuladores');

console.log('E. regras: nós do servidor gravados só pela identidade restrita');
const R = JSON.parse(regras).rules;
const FRONT = "(auth != null && auth.uid === 'fronteira-confiavel')";
/* toda .write dentro do nó começa exigindo a identidade restrita — nenhum cliente (nem admin geral) grava ali */
function writes(no, acc) { Object.keys(no || {}).forEach((k) => { if (k === '.write') acc.push(no[k]); else if (k[0] !== '.' && typeof no[k] === 'object') writes(no[k], acc); }); return acc; }
['posicionamento-motor-redacao-validada', 'posicionamento-motor-ativacoes', 'posicionamento-motor-vigencia'].forEach((n) => {
  const w = writes(R[n], []);
  afirma(R[n] && w.length >= 1 && w.every((x) => x.indexOf(FRONT + ' && ') === 0), n + ': toda gravação exige a identidade restrita', w.join(' | ').slice(0, 200));
});
afirma(writes(R['posicionamento-motor-ativacoes'], []).every((x) => /!data\.exists\(\)/.test(x)) && writes(R['posicionamento-motor-redacao-validada'], []).every((x) => /!data\.exists\(\)/.test(x)),
  'ativações e redação validada: só criação (nunca reescritas nem apagadas)');
afirma(/newData\.exists\(\)/.test(R['posicionamento-motor-vigencia']['.write']), 'vigência: nunca apagada');

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
