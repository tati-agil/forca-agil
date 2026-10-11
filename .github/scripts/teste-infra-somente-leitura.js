/* B0 (H2-b) — o diagnóstico de infraestrutura é SÓ LEITURA e não expõe credencial (sem rede, sem segredo).
 *   A. Workflow: só disparo manual; credencial só pela ação oficial de autenticação (nunca dentro de um `run:`);
 *      gcloud pela ação oficial; permissões mínimas; checkout sem guardar credencial.
 *   B. Script: só comandos de leitura (lista fechada); nenhum verbo que altere nada; não recebe nem imprime a
 *      credencial.
 *   C. Execução simulada com gcloud/npx falsos: o e-mail da conta de serviço e o número da conta de
 *      faturamento NÃO aparecem na saída; falta de permissão vira "NÃO FOI POSSÍVEL VERIFICAR", nunca "não tem";
 *      Blaze/Spark e APIs são lidos corretamente; os comandos chamados são exatamente os de leitura. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..', '..');
let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det ? ' → ' + det : '')); if (!c) falhas++; }
const wf = fs.readFileSync(path.join(RAIZ, '.github/workflows/verificar-infra-functions.yml'), 'utf8');
const sh = fs.readFileSync(path.join(RAIZ, '.github/scripts/verificar-infra-functions.sh'), 'utf8');

console.log('A. workflow');
const semComentarios = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
afirma(/^on:\s*\n\s*workflow_dispatch:\s*\{\}\s*$/m.test(semComentarios) && !/^\s*(push|pull_request|schedule|workflow_run):/m.test(semComentarios), 'só disparo manual');
const runs = semComentarios.split(/\n(?=\s*-\s)/).filter((b) => /\brun:/.test(b));
afirma(runs.length >= 1 && runs.every((b) => !/secrets\./.test(b)), 'nenhum segredo dentro de um comando run:');
afirma((semComentarios.match(/secrets\./g) || []).length === 1 && /credentials_json:\s*\$\{\{\s*secrets\.FIREBASE_SERVICE_ACCOUNT_KYBER_AGIL\s*\}\}/.test(semComentarios), 'a credencial entra só em credentials_json da ação oficial');
afirma(/uses:\s*google-github-actions\/auth@v2/.test(wf) && /uses:\s*google-github-actions\/setup-gcloud@v2/.test(wf), 'autenticação e gcloud pelas ações oficiais');
afirma(/permissions:\s*\n\s*contents:\s*read/.test(wf) && !/write/.test(semComentarios.replace(/credentials_json[^\n]*/g, '')), 'permissões mínimas (contents: read)');
afirma(/persist-credentials:\s*false/.test(wf), 'checkout sem guardar credencial');

console.log('B. script');
const cmds = sh.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const gcloud = [...cmds.matchAll(/gcloud\s+([a-z-]+(?:\s+[a-z-]+){0,2})/g)].map((m) => m[1]);
const PERMITIDOS = ['billing projects describe', 'services list', 'projects get-iam-policy'];
afirma(gcloud.length === 3 && gcloud.every((c) => PERMITIDOS.some((p) => c.startsWith(p))), 'gcloud só com leitura: ' + gcloud.join(' | '));
afirma([...cmds.matchAll(/firebase-tools@13\s+([a-z:-]+)/g)].map((m) => m[1]).join() === 'database:instances:list', 'firebase-tools só lista instâncias');
afirma(!/\b(enable|disable|create|delete|update|deploy|link|unlink|set-iam-policy|add-iam-policy-binding|remove-iam-policy-binding|projects set|config set)\b/.test(cmds.replace(/NÃO foi habilitada/g, '')), 'nenhum verbo que altere a infraestrutura');
afirma(!/cat\s+"?\$CRED|echo\s+"?\$CRED|--key-file|CHAVE=|private_key/.test(cmds) && !/^[^#]*=\s*"?\$1"?\s*$/m.test(cmds.replace(/^\s*nao\(\)[^\n]*$/m, '')), 'não recebe credencial por argumento nem a imprime');

console.log('C. execução simulada');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'infra-'));
const SA = 'ci-deploy@kyber-agil.iam.gserviceaccount.com';
fs.writeFileSync(path.join(dir, 'cred.json'), JSON.stringify({ client_email: SA, private_key: '-----BEGIN PRIVATE KEY-----SEGREDO' }));
const log = path.join(dir, 'chamadas.log');
function falso(nome, corpo) { const f = path.join(dir, nome); fs.writeFileSync(f, '#!/usr/bin/env bash\necho "' + nome + ' $*" >> "' + log + '"\n' + corpo + '\n'); fs.chmodSync(f, 0o755); }
function rodar(cenario) {
  fs.writeFileSync(log, '');
  falso('gcloud', cenario.gcloud);
  falso('npx', cenario.npx);
  return execFileSync('bash', [path.join(RAIZ, '.github/scripts/verificar-infra-functions.sh')], { env: Object.assign({}, process.env, { PATH: dir + ':' + process.env.PATH, GOOGLE_APPLICATION_CREDENTIALS: path.join(dir, 'cred.json'), PROJETO: 'kyber-agil' }), encoding: 'utf8' });
}
const visivel = (saida) => saida.split('\n').filter((l) => !l.startsWith('::add-mask::')).join('\n'); /* o GitHub não mostra a linha de comando ::add-mask:: */
const blaze0 = rodar({
  gcloud: 'case "$1 $2" in "billing projects") echo True;; "services list") printf "cloudfunctions.googleapis.com\\nrun.googleapis.com\\n";; "projects get-iam-policy") printf "roles/firebase.admin\\nroles/iam.serviceAccountUser\\n";; esac',
  npx: 'echo "kyber-agil-default-rtdb  us-central1  billingAccounts/0A1B2C-3D4E5F-6A7B8C"'
}), blaze = visivel(blaze0);
afirma(/projeto está no Blaze/.test(blaze) && /✓ cloudfunctions\.googleapis\.com/.test(blaze) && /✗ cloudbuild\.googleapis\.com \(não habilitada — e NÃO foi habilitada/.test(blaze), 'Blaze e APIs lidos corretamente');
afirma(/roles\/firebase\.admin/.test(blaze) && /us-central1/.test(blaze), 'papéis e região aparecem');
afirma(!blaze.includes(SA) && !/0A1B2C-3D4E5F-6A7B8C/.test(blaze) && !/SEGREDO|PRIVATE KEY/.test(blaze), 'e-mail da conta, conta de faturamento e chave não aparecem na saída');
afirma(blaze0.split('\n')[0] === '::add-mask::' + SA, 'o e-mail é registrado como segredo mascarado no GitHub (::add-mask::)');
const chamadas = fs.readFileSync(log, 'utf8').trim().split('\n');
afirma(chamadas.length === 4 && /^gcloud billing projects describe kyber-agil/.test(chamadas[0]) && /^gcloud services list --enabled/.test(chamadas[1]) && /^gcloud projects get-iam-policy kyber-agil/.test(chamadas[2]) && /^npx --yes firebase-tools@13 database:instances:list/.test(chamadas[3]),
  'chamou exatamente as 4 leituras', chamadas.join(' / '));
const negado = visivel(rodar({ gcloud: 'echo "PERMISSION_DENIED: ' + SA + ' does not have billing.resourceAssociations.list" >&2; exit 1', npx: 'echo "Error: 403 ' + SA + '" >&2; exit 1' }));
afirma((negado.match(/NÃO FOI POSSÍVEL VERIFICAR/g) || []).length === 4 && !/não tem|Spark/.test(negado), 'sem permissão: "NÃO FOI POSSÍVEL VERIFICAR" nas 4, nunca "não tem"');
afirma(!negado.includes(SA) && /<conta-de-servico>/.test(negado), 'mensagem de erro com o e-mail da conta sai mascarada');
const spark = rodar({ gcloud: 'case "$1 $2" in "billing projects") echo False;; *) echo;; esac', npx: 'echo' });
afirma(/plano Spark/.test(spark), 'sem faturamento: Spark');
fs.rmSync(dir, { recursive: true, force: true });
console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
