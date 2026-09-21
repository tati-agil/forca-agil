/* Diagnóstico SOMENTE LEITURA — bug relatado: depois de "Iniciar nova
   execução" (ENCERRAR E INICIAR NOVA EXECUÇÃO), a execução nova aparece
   no Histórico com 1 grupo herdado da execução anterior (ex.: "ggg"),
   violando a invariante "nova execução = execução vazia".

   Não escreve nada no banco. Não cria execução nenhuma. Não apaga nada.
   Objetivo único: trazer para fora os dados reais de TODAS as execuções
   de TODAS as turmas (via apostas/<turma>/execucoes, legível de uma vez
   por quem conduz a turma — ver database.rules.json) para responder, com
   dados em mãos em vez de suposição:

     1) existe, em alguma execução ATIVA (status !== 'encerrada'), um nó
        grupos/<id> ou grupos-resumo/<id> populado logo após a criação
        dessa execução (criadaEm), sem que #apostaCriarGrupo tenha sido
        clicado de novo?
     2) esse grupo tem o mesmo nome/id de um grupo de uma execução
        ANTERIOR da mesma turma (evidência de vazamento real, não de
        exibição)?
     3) o timestamp desse grupo (criadoEm/atualizadoEm) é anterior ou
        posterior ao criadaEm da execução nova — indício de escrita
        atrasada (debounce/callback tardio) caindo no execId errado?

   Usa as mesmas credenciais (FA_TEST_ADMIN_EMAIL/PASSWORD) já usadas por
   audit-facilitadores-turmas.js — nenhum segredo novo, nenhuma dependência
   de npm além de https/crypto do Node, já embutidos.

   Rodar via: node .github/scripts/diagnostico-execucao-vazamento-grupo.js
   (workflow_dispatch — ver .github/workflows/diagnostico-execucao-vazamento-grupo.yml) */

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

  const turmas = (await getJson(DB_URL + '/turmas.json?auth=' + idToken)) || {};

  const md = [];
  md.push('# Diagnóstico — vazamento de grupo entre execuções (somente leitura)\n');
  md.push('Nenhuma escrita foi feita. Nenhuma execução foi criada ou apagada.\n');

  let turmaComAchado = false;

  for (const turmaKey of Object.keys(turmas)) {
    const atualId = await getJson(DB_URL + '/apostas/' + turmaKey + '/atual.json?auth=' + idToken);
    /* execucoes/ inteiro é legível de uma vez só por quem conduz a
       turma (admin ou facilitador com vínculo em turmas-equipe) — ver
       database.rules.json, nó apostas/$turmaKey/execucoes/.read. Uma
       turma sem nenhuma execução aberta (nem "atual" nem "execucoes")
       devolve null aqui e é pulada sem gerar ruído no relatório. */
    const execucoes = (await getJson(DB_URL + '/apostas/' + turmaKey + '/execucoes.json?auth=' + idToken)) || {};
    const execIds = Object.keys(execucoes);
    if (!execIds.length) continue;

    const label = (turmas[turmaKey] || {}).label || turmaKey;
    md.push('\n## Turma `' + turmaKey + '` — ' + label + '\n');
    md.push('`atual` = `' + (atualId || '(nenhuma)') + '`\n');

    /* Ordena por criadaEm para poder comparar cada execução com as que
       vieram ANTES dela na mesma turma — é isso que permite responder
       "esse grupo já existia numa execução anterior?". */
    const idsOrdenados = execIds.slice().sort((a, b) =>
      String(execucoes[a].criadaEm || '').localeCompare(String(execucoes[b].criadaEm || '')));

    /* Mapa de nome+id de todo grupo já visto em qualquer execução
       ANTERIOR desta turma, para detectar reaparecimento. */
    const gruposVistosAntes = {}; /* grupoId -> { execId, numero, nome } */

    idsOrdenados.forEach((execId) => {
      const exec = execucoes[execId] || {};
      const grupos = exec.grupos || {};
      const gruposResumo = exec['grupos-resumo'] || {};
      const gids = Object.keys(grupos);
      const gridsResumo = Object.keys(gruposResumo);

      md.push('### Execução nº ' + (exec.numero != null ? exec.numero : '(sem número)') +
        ' — `' + execId + '`' + (execId === atualId ? ' **(atual)**' : ''));
      md.push('- status: `' + (exec.status || '(sem status)') + '`' +
        (exec.encerrada ? ' — encerrada=true' : ''));
      md.push('- criadaEm: ' + (exec.criadaEm || '(sem data)') + ' — criadaPor: ' + (exec.criadaPorNome || exec.criadaPor || '(não registrado)'));
      if (exec.encerradaEm) md.push('- encerradaEm: ' + exec.encerradaEm + ' — encerradaPor: ' + (exec.encerradaPorNome || exec.encerradaPor || '(não registrado)'));
      md.push('- grupos/: ' + gids.length + (gids.length ? '' : ' (vazio, como esperado para execução nova)'));
      md.push('- grupos-resumo/: ' + gridsResumo.length);

      gids.forEach((gid) => {
        const g = grupos[gid] || {};
        const membros = Object.keys(g.membros || {});
        const jaExistiaAntes = gruposVistosAntes[gid];
        md.push('  - grupo `' + gid + '`: nome="' + (g.nome || '(sem nome)') + '", criadoEm=' +
          (g.criadoEm || '(sem data)') + ', atualizadoEm=' + (g.atualizadoEm || '(nunca)') +
          ', membros=' + membros.length + ', etapa=' + (g.etapa || '(sem etapa)') +
          (g.ciclos ? ', TEM ciclos/' : ''));
        if (jaExistiaAntes) {
          turmaComAchado = true;
          md.push('    **⚠ ACHADO: este mesmo grupoId já apareceu antes, na Execução nº ' +
            jaExistiaAntes.numero + ' (`' + jaExistiaAntes.execId + '`), nome="' + jaExistiaAntes.nome +
            '" — mesma chave reaparecendo em duas execuções da mesma turma.**');
        } else if (exec.criadaEm && g.criadoEm && g.criadoEm < exec.criadaEm) {
          turmaComAchado = true;
          md.push('    **⚠ ACHADO: grupo.criadoEm (' + g.criadoEm + ') é ANTERIOR ao criadaEm da própria execução (' +
            exec.criadaEm + ') — este grupo não pode ter nascido depois que esta execução foi criada.**');
        }
      });
      gridsResumo.forEach((gid) => {
        if (!grupos[gid]) {
          turmaComAchado = true;
          md.push('  - **⚠ ACHADO: grupos-resumo/' + gid + '` existe sem grupo correspondente em grupos/' + gid + '` — resumo órfão.**');
        }
      });

      gids.forEach((gid) => {
        gruposVistosAntes[gid] = { execId: execId, numero: exec.numero, nome: (grupos[gid] || {}).nome || '(sem nome)' };
      });
    });
  }

  if (!turmaComAchado) {
    md.push('\n## Conclusão\n');
    md.push('Nenhuma turma apresentou grupo reaparecendo em execução diferente, grupo com criadoEm anterior à própria execução, ou grupos-resumo órfão. Se o bug relatado ainda está visível na tela, os IDs reais de execução/turma precisam ser localizados manualmente nesta mesma saída (acima) pelo número exibido no Histórico.');
  } else {
    md.push('\n## Conclusão\n');
    md.push('Um ou mais ACHADOS acima indicam vazamento real de dado entre execuções (não é bug de exibição/cache — os dados vêm de uma leitura direta e fresca de apostas/<turma>/execucoes). Ver cada ⚠ para o grupoId, execIds envolvidos e timestamps.');
  }

  const relatorio = md.join('\n');
  console.log(relatorio);
  if (process.env.GITHUB_STEP_SUMMARY) {
    require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, relatorio + '\n');
  }
})().catch((err) => {
  console.error('Falha no diagnóstico:', err.message);
  process.exit(1);
});
