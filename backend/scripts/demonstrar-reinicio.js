#!/usr/bin/env node
/* Demonstração do item 8: os registros das Estruturas Concretas sobrevivem ao reinício REAL dos contêineres.
     npm run demonstrar:reinicio        (dentro de backend/, com o ambiente no ar e `npm ci` já feito)
   Funciona igual no Windows, macOS e Linux (Node ≥ 22 e Docker). Usa SÓ dados sintéticos, num schema próprio
   (demonstracao_reinicio) que é apagado no fim; não toca no .env, na senha nem no resto do volume.
     1. grava pela API (num contêiner na rede interna): estruturas, alteração, relação e responsável principal;
     2. `docker compose restart` e depois `docker compose down` + `up -d` (o volume é mantido);
     3. lê tudo de novo pela API, confere valores e históricos, e apaga o schema da demonstração. */
'use strict';
const { execFileSync, spawnSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const { join, resolve } = require('path');

const DIR = join(__dirname, '..');
const RAIZ = resolve(DIR, '..');
const env = existsSync(join(DIR, '.env'))
  ? Object.fromEntries(readFileSync(join(DIR, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\s*[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : null;
if (!env) { console.error('Falta backend/.env (copie de .env.example).'); process.exit(1); }
if (!existsSync(join(DIR, 'node_modules', 'jest'))) { console.error('Rode `npm ci` em backend/ antes (os testes rodam a partir dele).'); process.exit(1); }

const compose = (...args) => execFileSync('docker', ['compose', ...args], { cwd: DIR, stdio: 'inherit' });
const saude = (servico) => {
  try {
    const id = execFileSync('docker', ['compose', 'ps', '-q', servico], { cwd: DIR, encoding: 'utf8' }).trim();
    return id ? execFileSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', id], { encoding: 'utf8' }).trim() : 'ausente';
  } catch (e) { return 'ausente'; }
};
function aguardarSaudaveis() {
  const fim = Date.now() + 120000;
  while (Date.now() < fim) {
    if (saude('postgres') === 'healthy' && saude('api') === 'healthy') return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  console.error('Os contêineres não ficaram saudáveis a tempo.'); process.exit(1);
}
function fase(nome) {
  console.log(`\n== fase "${nome}" (contêiner de teste na rede interna) ==`);
  const r = spawnSync('docker', ['run', '--rm', '--network', 'forca-agil-local_interna', '-v', `${RAIZ}:/repo`, '-w', '/repo/backend',
    '--env-file', join(DIR, '.env'), '-e', 'POSTGRES_HOST=postgres', '-e', 'FASE_REINICIO=' + nome,
    env.NODE_IMAGE || 'node:22-alpine', 'npx', 'jest', '--config', 'jest.integracao.config.js', 'test/integracao/reinicio'], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`Fase "${nome}" falhou.`); process.exit(1); }
}

aguardarSaudaveis();
fase('gravar');
console.log('\n== reinício: docker compose restart ==');
compose('restart');
aguardarSaudaveis();
console.log('\n== reinício: docker compose down + up -d (o volume é mantido) ==');
compose('down');
compose('up', '-d');
aguardarSaudaveis();
fase('conferir');
console.log('\nDemonstração concluída: os registros sobreviveram ao reinício dos contêineres.');
