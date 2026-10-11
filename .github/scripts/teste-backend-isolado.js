/* O backend local (backend/, NestJS + PostgreSQL) é INDEPENDENTE do site publicado. Sem rede, sem Docker:
 *   A. o Hosting não publica backend/ e o deploy da main continua só hosting + database;
 *   B. o site não chama a API nova nem depende dela (nenhum arquivo do site cita backend/ ou a porta local);
 *   C. o núcleo é fonte única: o backend carrega forca-agil/estruturas-nucleo.js e não tem cópia dele;
 *   D. nada de segredo versionado: só .env.example (senha de exemplo), .env e override local ignorados pelo Git;
 *   E. o CI do backend é isolado (só roda quando backend/ ou o núcleo mudam, sem segredos, sem publicar nada). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..', '..');
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }

console.log('A. publicação');
const fj = JSON.parse(ler('firebase.json'));
afirma((fj.hosting.ignore || []).includes('backend/**'), 'o Hosting não publica backend/');
const dep = ler('.github/workflows/firebase-deploy.yml');
afirma(/--only hosting,database/.test(dep) && !/backend/.test(dep), 'o deploy da main continua só hosting + database e não usa o backend');

console.log('B. o site não depende do backend');
const doSite = ['index.html'].concat(fs.readdirSync(path.join(RAIZ, 'forca-agil')).map((f) => 'forca-agil/' + f)).filter((f) => /\.(html|js|css)$/.test(f));
const citam = doSite.filter((f) => /backend\/|localhost:3000|127\.0\.0\.1:3000|\/api\/saude/.test(ler(f)));
afirma(citam.length === 0, 'nenhum arquivo do site cita o backend ou a API local', citam.join(', '));
const csp = (fj.hosting.headers || []).map((h) => (h.headers || []).find((x) => x.key === 'Content-Security-Policy')).filter(Boolean);
afirma(csp.every((h) => !/localhost|127\.0\.0\.1/.test(h.value)), 'a CSP do site não libera a API local');

console.log('C. núcleo como fonte única');
const ponte = ler('backend/src/nucleo/estruturas.ts');
afirma(/forca-agil\/estruturas-nucleo\.js/.test(ponte) && /require\(CAMINHO_NUCLEO_ESTRUTURAS\)/.test(ponte), 'o backend carrega forca-agil/estruturas-nucleo.js');
const copias = execFileSync('git', ['ls-files', 'backend'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter((f) => /\.(js|ts)$/.test(f) && /function criarEstrutura\s*\(|CODIGOS_FIRMES\s*=\s*\[/.test(ler(f)));
afirma(copias.length === 0, 'nenhuma cópia do núcleo nem da lista de códigos firmes do motor versionada em backend/', copias.join(', '));
afirma(/require\(CAMINHO_NUCLEO_POSICIONAMENTO\)/.test(ler('backend/src/nucleo/posicionamento.ts')), 'os códigos firmes vêm do motor do site (forca-agil/motor-posicionamento-nucleo.js)');
afirma(/COPY forca-agil\/estruturas-nucleo\.js forca-agil\/motor-posicionamento-nucleo\.js/.test(ler('backend/Dockerfile')), 'a imagem leva os MESMOS arquivos do site');

console.log('D. segredos');
const versionados = execFileSync('git', ['ls-files', 'backend'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean);
afirma(!versionados.some((f) => /(^|\/)\.env$|compose\.override\.ya?ml$/.test(f)), '.env e compose.override.yaml não são versionados');
afirma(/POSTGRES_PASSWORD=troque-por-uma-senha-local/.test(ler('backend/.env.example')), '.env.example só tem senha de exemplo');
const comp = ler('backend/compose.yaml');
afirma(/POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:\?/.test(comp) && !/^\s*POSTGRES_PASSWORD:\s*[^$\s]/m.test(comp), 'compose.yaml exige a senha do .env (sem valor fixo)');
afirma(!/^\s*ports:[\s\S]*?5432/m.test(comp.split('api:')[0]), 'o PostgreSQL não publica porta fora do Docker');
afirma(/"127\.0\.0\.1:\$\{API_PORTA:-3000\}:3000"/.test(comp), 'a API só escuta na própria máquina');

console.log('E. CI isolado');
const ci = ler('.github/workflows/backend.yml');
afirma(/paths:[\s\S]*'backend\/\*\*'/.test(ci) && !/secrets\./.test(ci) && !/firebase/i.test(ci.replace(/^#.*$/gm, '')), 'o CI do backend só roda para backend/ e o núcleo, sem segredos e sem Firebase');

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
