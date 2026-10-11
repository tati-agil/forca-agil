#!/usr/bin/env node
/* Verifica o ambiente local REAL (Docker Compose): rode depois de `docker compose up --build -d`, dentro de backend/.
     npm run verificar:ambiente
   Funciona igual no Windows, macOS e Linux (só Node ≥ 22 e Docker). Não usa dados reais: cria e apaga uma tabela
   sintética para provar a persistência do volume. Confere:
     1. os dois contêineres no ar e saudáveis;           2. API responde /api/saude;
     3. API alcança o banco pela rede interna;          4. o banco NÃO é publicado fora do Docker;
     5. banco parado → /api/saude/banco = 503 e a API continua no ar; banco de volta → 200;
     6. dados sobrevivem a `docker compose down` + `up` (volume persistente);
     7. a senha do banco não aparece nos logs. */
'use strict';
const { execFileSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const DIR = join(__dirname, '..');
const PORTA = lerEnv().API_PORTA || '3000';
const BASE = `http://127.0.0.1:${PORTA}/api`;
let falhas = 0;

function lerEnv() {
  const arq = join(DIR, '.env');
  if (!existsSync(arq)) return {};
  return Object.fromEntries(readFileSync(arq, 'utf8').split(/\r?\n/).filter((l) => /^\s*[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}
function compose(...args) { return execFileSync('docker', ['compose', ...args], { cwd: DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function afirma(ok, msg, det) { console.log((ok ? '  ok    ' : '  FALHA ') + msg + (!ok && det ? ' → ' + det : '')); if (!ok) falhas++; }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function http(caminho) {
  try { const r = await fetch(BASE + caminho, { signal: AbortSignal.timeout(5000) }); return { status: r.status, corpo: await r.json().catch(() => null) }; }
  catch (e) { return { status: 0, corpo: null }; }
}
function saude(servico) {
  try { const id = compose('ps', '-q', servico).trim(); return id ? execFileSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', id], { encoding: 'utf8' }).trim() : 'ausente'; }
  catch (e) { return 'ausente'; }
}
async function aguardar(teste, limiteMs) { const fim = Date.now() + limiteMs; while (Date.now() < fim) { if (await teste()) return true; await esperar(1000); } return false; }
function psql(sql) {
  return compose('exec', '-T', 'postgres', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "${sql}"`).trim();
}

(async () => {
  console.log('Verificação do ambiente local (Docker Compose)');
  afirma(await aguardar(async () => saude('postgres') === 'healthy' && saude('api') === 'healthy', 90000), '1. postgres e api no ar e saudáveis', `postgres=${saude('postgres')} api=${saude('api')}`);
  const a = await http('/saude');
  afirma(a.status === 200 && a.corpo && a.corpo.status === 'ok', '2. GET /api/saude → 200', JSON.stringify(a));
  const b = await http('/saude/banco');
  afirma(b.status === 200 && b.corpo && b.corpo.banco === 'disponivel', '3. GET /api/saude/banco → 200 (API alcança o PostgreSQL pela rede interna)', JSON.stringify(b));
  let publicado = '';
  try { publicado = compose('port', 'postgres', '5432').trim(); } catch (e) { publicado = ''; }
  afirma(!publicado || /:0$/.test(publicado), '4. a porta do PostgreSQL não é publicada fora do Docker', publicado);

  compose('stop', 'postgres');
  const c = await http('/saude/banco'), c2 = await http('/saude');
  afirma(c.status === 503 && c.corpo && c.corpo.banco === 'indisponivel', '5a. banco parado → /api/saude/banco = 503 (indisponível identificado)', JSON.stringify(c));
  afirma(c2.status === 200, '5b. … e a API continua respondendo /api/saude', JSON.stringify(c2));
  compose('start', 'postgres');
  afirma(await aguardar(async () => (await http('/saude/banco')).status === 200, 60000), '5c. banco de volta → 200');

  psql("DROP TABLE IF EXISTS verificacao_volume; CREATE TABLE verificacao_volume (marca text); INSERT INTO verificacao_volume VALUES ('sintetico')");
  compose('down');
  compose('up', '-d');
  const voltou = await aguardar(async () => saude('postgres') === 'healthy' && saude('api') === 'healthy', 90000);
  let marca = '';
  try { marca = psql('SELECT marca FROM verificacao_volume'); psql('DROP TABLE verificacao_volume'); } catch (e) { marca = ''; }
  afirma(voltou && marca === 'sintetico', '6. o dado sobrevive a docker compose down + up (volume persistente)', `voltou=${voltou} marca=${marca}`);

  const senha = lerEnv().POSTGRES_PASSWORD;
  const logs = compose('logs', '--no-color');
  afirma(!!senha && logs.indexOf(senha) === -1, '7. a senha do banco não aparece nos logs');

  console.log(falhas ? `\n${falhas} falha(s).` : '\nAmbiente verificado: tudo certo.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('Erro na verificação: ' + e.message); process.exit(1); });
