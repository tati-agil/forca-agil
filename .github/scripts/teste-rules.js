/* ══════════════════════════════════════════════════════════════════
   FASE 5 — testes das Firebase Security Rules da Construção da Aposta

   Roda contra o EMULADOR real do Realtime Database (via
   `firebase emulators:exec`), usando @firebase/rules-unit-testing —
   nunca contra o Firebase de produção, nunca contra uma reimplementação
   em JS das rules. As rules em si (database.rules.json) são as MESMAS
   que seriam publicadas; se o texto delas mudar sem que o
   comportamento mude, ou vice-versa, é aqui que aparece.

   Este ambiente de coding não consegue baixar o emulador do RTDB (a
   política de rede bloqueia firebase-public.firebaseio.com — mesma
   classe de restrição que já impede a suíte Playwright de bater no
   Firebase real fora do CI). Por isso este arquivo só é validado de
   verdade no workflow `.github/workflows/teste-rules.yml`.

   Cobertura: Invariantes S1-S6 do pedido de Fase 5, mais os cenários
   específicos pedidos (32-39 do pedido original + a bateria extra de
   facilitador-por-turma pedida depois). Não testa TODO write path do
   arquivo (seria uma suíte enorme); prioriza o que decide segurança —
   isolamento entre turmas/grupos, imutabilidade de execução encerrada
   e ciclo finalizado, autoingresso restrito à própria identidade, e o
   vínculo real de facilitação por turma. ══════════════════════════ */

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

let total = 0, falhas = 0;
function anota(linha, ok, detalhe) {
  total++;
  if (ok) { console.log('  ok    ' + linha); return; }
  falhas++;
  console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : ''));
}

function emailKey(email) {
  return String(email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
}

const ADMIN_EMAIL = 'admin@previ.com.br';
const FAC_A_EMAIL = 'facilitadora.a@previ.com.br';      /* global + vínculo em turmaA */
const FAC_SEM_VINCULO_EMAIL = 'facilitador.solto@previ.com.br'; /* global, SEM vínculo em turma nenhuma */
const EQUIPE_SEM_FLAG_EMAIL = 'equipe.sem.flag@previ.com.br';   /* vínculo em turmaA, SEM flag global */
const PART_A_EMAIL = 'participante.a@previ.com.br';      /* confirmada em turmaA */
const PART_A2_EMAIL = 'participante.a2@previ.com.br';    /* confirmada em turmaA, outro grupo */
const PART_B_EMAIL = 'participante.b@previ.com.br';      /* confirmada em turmaB */
const FORA_EMAIL = 'de.fora@previ.com.br';               /* @previ.com.br, sem nenhum vínculo */

const TURMA_A = 'turmaA', TURMA_B = 'turmaB';
const EXEC_A = 'execA', EXEC_B = 'execB';
const GRUPO_A1 = 'grupoA1', GRUPO_A2 = 'grupoA2', GRUPO_B1 = 'grupoB1';

async function main() {
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-kyber-agil-rules-test',
    database: { rules }
  });

  function ctx(email) { return email ? testEnv.authenticatedContext(emailKey(email), { email }) : testEnv.unauthenticatedContext(); }
  function db(email) { return ctx(email).database(); }

  async function semear(fn) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await fn(context.database());
    });
  }

  async function semearBase() {
    await semear(async (adminDb) => {
      await adminDb.ref('fa-admins/' + emailKey(ADMIN_EMAIL)).set({ email: ADMIN_EMAIL, name: 'ADMIN' });
      await adminDb.ref('fa-facilitadores/' + emailKey(FAC_A_EMAIL)).set({ email: FAC_A_EMAIL, name: 'FACILITADORA A' });
      await adminDb.ref('fa-facilitadores/' + emailKey(FAC_SEM_VINCULO_EMAIL)).set({ email: FAC_SEM_VINCULO_EMAIL, name: 'FACILITADOR SOLTO' });
      await adminDb.ref('turmas-equipe/' + TURMA_A + '/' + emailKey(FAC_A_EMAIL)).set({ email: FAC_A_EMAIL, name: 'FACILITADORA A', papel: 'responsavel' });
      await adminDb.ref('turmas-equipe/' + TURMA_A + '/' + emailKey(EQUIPE_SEM_FLAG_EMAIL)).set({ email: EQUIPE_SEM_FLAG_EMAIL, name: 'EQUIPE SEM FLAG', papel: 'facilitador' });
      const confirmada = function (email) {
        return { name: email, email: email, status: 'inscrito', confirmedByAdmin: ADMIN_EMAIL, date: '2026-09-01T10:00:00.000Z' };
      };
      await adminDb.ref('turmas-interesse/' + TURMA_A + '/' + emailKey(PART_A_EMAIL)).set(confirmada(PART_A_EMAIL));
      await adminDb.ref('turmas-interesse/' + TURMA_A + '/' + emailKey(PART_A2_EMAIL)).set(confirmada(PART_A2_EMAIL));
      await adminDb.ref('turmas-interesse/' + TURMA_B + '/' + emailKey(PART_B_EMAIL)).set(confirmada(PART_B_EMAIL));
      await adminDb.ref('apostas/' + TURMA_A + '/atual').set(EXEC_A);
      await adminDb.ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A).set({ status: 'ativa', criadoEm: '2026-09-01T10:00:00.000Z', numero: 1, grupos: {} });
      await adminDb.ref('apostas/' + TURMA_B + '/atual').set(EXEC_B);
      await adminDb.ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B).set({ status: 'ativa', criadoEm: '2026-09-01T10:00:00.000Z', numero: 1, grupos: {} });
      await adminDb.ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1).set({
        nome: 'Grupo A1', criadoEm: '2026-09-01T10:00:00.000Z', etapa: 'problema',
        membros: { [emailKey(PART_A_EMAIL)]: { name: PART_A_EMAIL, email: PART_A_EMAIL, entrouEm: '2026-09-01T10:00:00.000Z' } },
        dados: { missao: { oQue: 'reduzir a espera' } }
      });
      await adminDb.ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A2).set({
        nome: 'Grupo A2', criadoEm: '2026-09-01T10:00:00.000Z', etapa: 'missao',
        membros: { [emailKey(PART_A2_EMAIL)]: { name: PART_A2_EMAIL, email: PART_A2_EMAIL, entrouEm: '2026-09-01T10:00:00.000Z' } }
      });
      await adminDb.ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/grupos/' + GRUPO_B1).set({
        nome: 'Grupo B1', criadoEm: '2026-09-01T10:00:00.000Z', etapa: 'missao',
        membros: { [emailKey(PART_B_EMAIL)]: { name: PART_B_EMAIL, email: PART_B_EMAIL, entrouEm: '2026-09-01T10:00:00.000Z' } }
      });
    });
  }

  try {
    /* ══════════════ IDENTIDADE NAS RULES — emailKey() com 0/1/2/4
          pontos no local-part. String.replace(substr, repl) nas
          Firebase Rules substitui TODAS as ocorrências (diferente do
          replace() comum do JS, que só troca a primeira) — então uma
          única .replace('.','_') já basta, sem cadeia repetida (ver
          database.rules.json). Prova direta, sem depender do perfil
          atual de e-mails auditado: para cada contagem de pontos,
          grava o vínculo de facilitação usando a chave REAL
          (emailKey() do cliente) e confirma que a Rule — que deriva a
          própria chave a partir de auth.token.email — concorda com
          ela em todos os casos, não só nos observados hoje. Cobre
          também o autoingresso (que compara $membroKey === chave
          derivada), a outra rota que depende da mesma derivação. ══ */
    {
      await testEnv.clearDatabase();
      const TURMA_ID = 'turmaIdentidade';
      const EXEC_ID = 'execIdentidade';
      /* Duas identidades por contagem de pontos, de propósito: uma
         SÓ facilitadora (testa a derivação no vínculo turmas-equipe),
         outra SÓ participante confirmada, nunca facilitadora (testa a
         derivação no autoingresso sem a permissão mais ampla da
         facilitadora mascarar um bug de identidade — facilitador pode
         gravar QUALQUER chave de membros por desenho, então usar a
         mesma pessoa pros dois papéis testaria a coisa errada). */
      const casos = [
        { rotulo: '0 pontos', fac: 'semponto.fac@previ.com.br', part: 'semponto.part@previ.com.br' },
        { rotulo: '1 ponto', fac: 'um.ponto.fac@previ.com.br', part: 'um.ponto.part@previ.com.br' },
        { rotulo: '2 pontos', fac: 'dois.pontos.aqui.fac@previ.com.br', part: 'dois.pontos.aqui.part@previ.com.br' },
        { rotulo: '4 pontos (vários)', fac: 'a.b.c.d.varios.fac@previ.com.br', part: 'a.b.c.d.varios.part@previ.com.br' },
      ];
      await semear(async (adminDb) => {
        await adminDb.ref('apostas/' + TURMA_ID + '/atual').set(EXEC_ID);
        await adminDb.ref('apostas/' + TURMA_ID + '/execucoes/' + EXEC_ID).set({ status: 'ativa', criadoEm: '2026-09-01T10:00:00.000Z', numero: 1, grupos: { g1: { nome: 'G1', criadoEm: '2026-09-01T10:00:00.000Z', etapa: 'missao' } } });
        for (const c of casos) {
          await adminDb.ref('fa-facilitadores/' + emailKey(c.fac)).set({ email: c.fac, name: c.rotulo + ' (facilitadora)' });
          await adminDb.ref('turmas-equipe/' + TURMA_ID + '/' + emailKey(c.fac)).set({ email: c.fac, name: c.rotulo + ' (facilitadora)', papel: 'facilitador' });
          await adminDb.ref('turmas-interesse/' + TURMA_ID + '/' + emailKey(c.part)).set({
            name: c.rotulo + ' (participante)', email: c.part, status: 'inscrito', confirmedByAdmin: ADMIN_EMAIL, date: '2026-09-01T10:00:00.000Z'
          });
        }
      });

      for (const c of casos) {
        await assertSucceeds(db(c.fac).ref('apostas/' + TURMA_ID + '/execucoes/' + EXEC_ID + '/revelado').set(true));
        anota('emailKey (' + c.rotulo + ' no local-part, ' + c.fac + '): vínculo de facilitação reconhecido pela Rule',
          true);

        await assertSucceeds(db(c.part).ref('apostas/' + TURMA_ID + '/execucoes/' + EXEC_ID + '/grupos/g1/membros/' + emailKey(c.part))
          .set({ name: c.rotulo, email: c.part, entrouEm: new Date().toISOString() }));
        anota('emailKey (' + c.rotulo + '): autoingresso (chave própria de uma PARTICIPANTE, nunca facilitadora) reconhecido pela Rule', true);

        const outraChave = emailKey('outra.pessoa.' + casos.indexOf(c) + '@previ.com.br');
        await assertFails(db(c.part).ref('apostas/' + TURMA_ID + '/execucoes/' + EXEC_ID + '/grupos/g1/membros/' + outraChave)
          .set({ name: 'x', email: 'outra@previ.com.br', entrouEm: new Date().toISOString() }));
        anota('emailKey (' + c.rotulo + '): participante (sem ser facilitadora) NÃO consegue se passar por uma chave que não é a própria', true);
      }
    }

    await testEnv.clearDatabase();
    await semearBase();

    /* ══════════════ 32/S1 — PARTICIPANTE LEGÍTIMO (FASE 5 —
          GRUPOS-RESUMO: a leitura deixou de ser a execução inteira; ver
          o cenário Alice/Bruno mais abaixo para a cobertura completa
          de isolamento entre grupos) ══════════════ */
    {
      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/atual').once('value'));
      anota('participante confirmada lê apostas/<turma>/atual', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A).once('value'));
      anota('FASE 5 — participante NÃO lê mais a execução inteira (o nó grupos/ cascatearia dados/ciclos de todos os grupos, não só do seu)', true);

      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/missao').once('value'));
      anota('FASE 5 — participante lê a missão-base isoladamente', true);
      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/revelado').once('value'));
      anota('FASE 5 — participante lê a revelação isoladamente', true);

      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/dados/problema')
        .set({ quem: 'O participante', situacaoIndesejada: 'espera demais' }));
      anota('participante escreve nos dados do PRÓPRIO grupo', true);

      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/etapa').set('mudancas'));
      anota('participante avança a trilha do próprio grupo (Ciclo 1 implícito)', true);
    }

    /* ══════════════ 33/S1 — PARTICIPANTE NÃO AUTORIZADO ══════════════ */
    {
      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/grupos/' + GRUPO_B1 + '/dados/problema').set({ x: 1 }));
      anota('participante de A NÃO escreve no grupo de outra turma (B)', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A2 + '/dados/problema').set({ x: 1 }));
      anota('participante de A NÃO escreve no grupo de OUTRA equipe (A2), mesma turma', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A2 + '/membros/' + emailKey(PART_A2_EMAIL))
        .set({ name: 'sequestrado', email: PART_A2_EMAIL }));
      anota('participante NÃO altera o membro de outra pessoa', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/criacaoExecucaoEmAndamento').set({ em: new Date().toISOString(), por: PART_A_EMAIL, token: 'x' }));
      anota('participante NÃO cria/mexe no lock de criação de execução', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/missao').set({ oQue: 'sequestrado' }));
      anota('participante NÃO altera a missão-base', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/revelado').set(true));
      anota('participante NÃO revela as conexões', true);
    }

    /* ══════════════ FACILITADOR — vínculo por turma (S4) ══════════════ */
    {
      await assertSucceeds(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/revelado').set(true));
      anota('facilitadora global COM vínculo em turmas-equipe opera a Turma A (revelar conexões)', true);

      await assertSucceeds(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/novociclo').set({
        numero: 2, status: 'EM_CONSTRUCAO', pontoDeReinicio: 'hipotese', cicloAnteriorId: null, etapa: 'hipotese', dados: {}
      }));
      anota('facilitadora com vínculo consegue criar um ciclo (edição manual) no grupo da Turma A', true);

      await assertSucceeds(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/missao').set({ oQue: 'reduzir a espera', verbo: 'reduzir' }));
      anota('facilitadora com vínculo edita a missão-base da Turma A', true);

      await assertFails(db(FAC_A_EMAIL).ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/revelado').set(true));
      anota('34/S4 — MESMA facilitadora global, SEM vínculo na Turma B, é recusada pelo Firebase na Turma B', true);

      await assertFails(db(FAC_A_EMAIL).ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/grupos/grupoNovo').set({ nome: 'x', criadoEm: '', etapa: 'missao' }));
      anota('facilitadora sem vínculo na Turma B também não cria grupo lá', true);

      await assertFails(db(FAC_SEM_VINCULO_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/revelado').set(true));
      anota('facilitador global SEM vínculo em turma nenhuma é recusado em qualquer turma (Turma A)', true);

      await assertFails(db(EQUIPE_SEM_FLAG_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/revelado').set(true));
      anota('pessoa com vínculo em turmas-equipe mas SEM a flag global fa-facilitadores é recusada (as duas condições são exigidas)', true);
    }

    /* ══════════════ 35/S4 — ADMIN ══════════════ */
    {
      await assertSucceeds(db(ADMIN_EMAIL).ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/revelado').set(true));
      anota('admin opera qualquer turma, com ou sem vínculo em turmas-equipe (Turma B)', true);
      await assertSucceeds(db(ADMIN_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A).once('value'));
      anota('admin lê qualquer execução de qualquer turma', true);
    }

    /* ══════════════ 38 — AUTOINGRESSO ══════════════ */
    {
      await assertSucceeds(db(PART_B_EMAIL).ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/grupos/' + GRUPO_B1 + '/membros/' + emailKey(PART_B_EMAIL))
        .set({ name: 'Participante B', email: PART_B_EMAIL, entrouEm: new Date().toISOString() }));
      anota('usuário A pode se auto-adicionar no próprio grupo (chave e e-mail = os seus)', true);

      const outroKey = emailKey(FORA_EMAIL);
      await assertFails(db(PART_B_EMAIL).ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/grupos/' + GRUPO_B1 + '/membros/' + outroKey)
        .set({ name: 'Fora', email: FORA_EMAIL, entrouEm: new Date().toISOString() }));
      anota('usuário A NÃO consegue adicionar outra pessoa (chave de outro e-mail)', true);

      await assertFails(db(PART_B_EMAIL).ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/grupos/' + GRUPO_B1 + '/membros/' + emailKey(PART_B_EMAIL))
        .set({ name: 'Participante B disfarçado', email: FORA_EMAIL, entrouEm: new Date().toISOString() }));
      anota('usuário A NÃO consegue gravar a própria chave com o e-mail de outra pessoa', true);
    }

    /* ══════════════ 39 — ACESSO CRUZADO ══════════════ */
    {
      await assertFails(db(PART_B_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/dados/problema').set({ x: 1 }));
      anota('Usuário B (Turma B) não escreve no contexto de A', true);
      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_B + '/execucoes/' + EXEC_B + '/grupos/' + GRUPO_B1 + '/dados/problema').set({ x: 1 }));
      anota('Usuário A (Turma A) não escreve no contexto de B', true);
      await assertFails(db(PART_B_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A).once('value'));
      anota('Usuário B não LÊ a execução da Turma A (não confirmado lá)', true);
    }

    /* ══════════════ FORA — auth válido, sem NENHUM vínculo ══════════════ */
    {
      await assertFails(db(FORA_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A).once('value'));
      anota('e-mail @previ.com.br sem nenhum vínculo NÃO lê a Turma A (domínio sozinho não basta — item 30)', true);
      await assertFails(db(null).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A).once('value'));
      anota('sem autenticação nenhuma, leitura é recusada', true);
    }

    /* ══════════════ 36/S2 — EXECUÇÃO ENCERRADA É IMUTÁVEL ══════════════ */
    {
      await semear(async (adminDb) => { await adminDb.ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/status').set('encerrada'); });

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/dados/problema').set({ x: 1 }));
      anota('execução encerrada: participante não escreve mais em dados do grupo', true);
      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/membros/' + emailKey(PART_A_EMAIL)).set({ name: 'x', email: PART_A_EMAIL }));
      anota('execução encerrada: nem o próprio autoingresso funciona mais', true);
      await assertFails(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/missao').set({ oQue: 'x' }));
      anota('execução encerrada: facilitadora não altera mais a missão-base', true);
      await assertFails(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/revelado').set(false));
      anota('execução encerrada: facilitadora não desfaz mais a revelação', true);
      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/criacaoCicloEmAndamento').set({ em: new Date().toISOString(), por: PART_A_EMAIL, token: 't' }));
      anota('execução encerrada: nem o lock de criação de ciclo pode ser tocado', true);
      await assertFails(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/status').set('ativa'));
      anota('execução encerrada: facilitadora não consegue reabri-la (não existe "reabrir")', true);
      await assertFails(db(ADMIN_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/status').set('ativa'));
      anota('execução encerrada: nem admin consegue reabri-la — a imutabilidade não tem exceção de papel', true);

      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1).once('value'));
      anota('execução encerrada: leitura continua permitida para quem já tinha acesso', true);
    }

    /* ══════════════ 37/S3 — CICLO FINALIZADO É IMUTÁVEL ══════════════ */
    await testEnv.clearDatabase();
    await semearBase();
    {
      const c1 = 'ciclo1', c2 = 'ciclo2';
      await semear(async (adminDb) => {
        await adminDb.ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos').set({
          atual: c2,
          porId: {
            [c1]: { numero: 1, status: 'FINALIZADO', pontoDeReinicio: null, cicloAnteriorId: null, etapa: 'decisao', dados: { decisao: { decisao: 'Ampliar' } } },
            [c2]: { numero: 2, status: 'EM_CONSTRUCAO', pontoDeReinicio: 'hipotese', cicloAnteriorId: c1, etapa: 'hipotese', dados: {} }
          }
        });
      });

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c1 + '/dados/decisao').set({ decisao: 'sequestrado' }));
      anota('ciclo FINALIZADO: escrita direta no conteúdo é recusada', true);
      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c1 + '/status').set('EM_CONSTRUCAO'));
      anota('ciclo FINALIZADO: não pode voltar a EM_CONSTRUCAO', true);
      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c1).once('value'));
      anota('ciclo FINALIZADO: leitura continua permitida', true);

      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c2 + '/dados/hipotese').set({ causa: 'x', indicio: 'y' }));
      anota('ciclo ATUAL (não finalizado): escrita normal continua funcionando', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c1 + '/dados/hipotese').set({ causa: 'x' }));
      anota('escrita no ciclo NÃO-atual (item 21: cicloId precisa ser ciclos/atual, não só "não estar FINALIZADO")', true);

      /* Transição legítima: fechar o ciclo2 e nascer o ciclo3, no mesmo "update()" multi-caminho que a Fase 4 usa. */
      const c3 = 'ciclo3';
      const updates = {};
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c2 + '/status'] = 'FINALIZADO';
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c2 + '/finalizadoEm'] = new Date().toISOString();
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c3] = {
        numero: 3, status: 'EM_CONSTRUCAO', pontoDeReinicio: 'problema', cicloAnteriorId: c2, etapa: 'problema', dados: {}
      };
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/atual'] = c3;
      await assertSucceeds(db(PART_A_EMAIL).ref().update(updates));
      anota('transição legítima (fechar ciclo atual + nascer o sucessor, no mesmo update atômico) continua funcionando', true);
    }

    /* ══════════════ Ciclo 1 implícito continua compatível (S6) ══════════════ */
    await testEnv.clearDatabase();
    await semearBase();
    {
      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/dados/decisao').set({ decisao: 'Ampliar', dataDecisao: new Date().toISOString() }));
      anota('grupo sem ciclos/ (Ciclo 1 implícito) continua gravando normalmente em dados/<etapa>', true);

      /* Materializa o Ciclo 1 (congela) + nasce o Ciclo 2 -- mesmo update() da Fase 4. */
      const c1 = 'ciclo1mat', c2 = 'ciclo2novo';
      const updates = {};
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c1] = {
        numero: 1, status: 'FINALIZADO', criadoEm: null, finalizadoEm: new Date().toISOString(),
        cicloAnteriorId: null, pontoDeReinicio: null, etapa: 'decisao', dados: { missao: { oQue: 'reduzir a espera' }, decisao: { decisao: 'Ampliar' } }
      };
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/porId/' + c2] = {
        numero: 2, status: 'EM_CONSTRUCAO', criadoEm: new Date().toISOString(), finalizadoEm: null,
        cicloAnteriorId: c1, pontoDeReinicio: 'problema', etapa: 'problema', dados: {}
      };
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/ciclos/atual'] = c2;
      await assertSucceeds(db(PART_A_EMAIL).ref().update(updates));
      anota('materialização do Ciclo 1 implícito -> Ciclo 1 congelado + Ciclo 2 continua permitida pelas rules', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/dados/problema').set({ x: 1 }));
      anota('depois que ciclos/ nasce, o caminho legado dados/<etapa> fica congelado (não é mais escrito por ninguém)', true);
    }

    /* ══════════════ S6 — execução LEGADA (sem status/numero, formato
          anterior à Fase 1) continua funcionando sem migração ══════════════ */
    await testEnv.clearDatabase();
    await semearBase();
    {
      const EXEC_LEGADO = 'execLegado';
      await semear(async (adminDb) => {
        /* Formato de antes da Fase 1: sem status, sem numero -- só o
           que a Fase 0 já gravava. EXEC_ATIVA precisa tratar "sem
           status nenhum" como "não encerrada", do mesmo jeito que o
           cliente sempre tratou (ver CLAUDE.md/aposta.js). */
        await adminDb.ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_LEGADO).set({
          criadaEm: '2026-01-10T09:00:00.000Z', turmaKey: TURMA_A,
          grupos: { grupoLegado: { nome: 'Grupo Legado', criadoEm: '2026-01-10T09:05:00.000Z', etapa: 'decisao',
            membros: { [emailKey(PART_A_EMAIL)]: { name: PART_A_EMAIL, email: PART_A_EMAIL, entrouEm: '2026-01-10T09:05:00.000Z' } },
            dados: { missao: { oQue: 'fila' } } } }
        });
        await adminDb.ref('apostas/' + TURMA_A + '/atual').set(EXEC_LEGADO);
      });

      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_LEGADO + '/grupos/grupoLegado/dados/decisao').set({ decisao: 'Ampliar' }));
      anota('S6 — execução legada (sem status/numero) aceita escrita normal do participante, sem migração nenhuma', true);
      await assertSucceeds(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_LEGADO + '/revelado').set(true));
      anota('S6 — facilitadora com vínculo opera normalmente uma execução no formato legado', true);
    }

    /* ══════════════ S5 — HISTÓRICO: legível por quem tinha acesso,
          nenhuma escrita, e só do(s) grupo(s) de que participou quando
          a execução NÃO é mais a atual (item 25) ══════════════ */
    await testEnv.clearDatabase();
    await semearBase();
    {
      const EXEC_NOVA = 'execNovaA';
      /* PART_A2_EMAIL nunca foi membro do GRUPO_A1 (só do GRUPO_A2) --
         é exatamente o caso que decide se a leitura de uma execução
         HISTÓRICA está restrita ao(s) grupo(s) da própria pessoa. */
      await semear(async (adminDb) => {
        await adminDb.ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_NOVA).set({ status: 'ativa', criadoEm: new Date().toISOString(), numero: 2, grupos: {} });
        await adminDb.ref('apostas/' + TURMA_A + '/atual').set(EXEC_NOVA);
        await adminDb.ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/status').set('encerrada');
      });

      /* Agora EXEC_A é HISTÓRICA (não é mais "atual"). */
      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1).once('value'));
      anota('S5 — participante lê o PRÓPRIO grupo numa execução histórica (não-atual) da turma dela', true);
      await assertFails(db(PART_A2_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1).once('value'));
      anota('S5/item 25 — participante confirmada na turma, mas que NÃO era membro DESTE grupo, não lê o histórico dele', true);
      await assertSucceeds(db(PART_A2_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A2).once('value'));
      anota('S5/item 25 — mas lê normalmente o histórico do PRÓPRIO grupo (A2) nessa mesma execução histórica', true);
      await assertSucceeds(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A).once('value'));
      anota('S5 — facilitadora com vínculo lê a execução histórica INTEIRA (todos os grupos), sem essa restrição', true);

      await assertFails(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/grupos/' + GRUPO_A1 + '/dados/problema').set({ x: 1 }));
      anota('S5 — nenhuma escrita é aceita na execução histórica, nem do próprio membro do grupo', true);
      await assertFails(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/revelado').set(false));
      anota('S5 — nem a facilitadora escreve na execução histórica', true);
    }

    /* ══════════════ FASE 5 — GRUPOS-RESUMO: Alice (Grupo Alice) e
          Bruno (Grupo Bruno) na mesma turma, execução atual. Cobertura
          completa do cenário pedido: descoberta pelo resumo, consulta
          da própria chave em qualquer grupo, leitura plena do próprio
          grupo, negação de leitura/escrita cruzada (inclusive
          Evidência/Decisão e a lista de membros do outro grupo),
          criação atômica grupo+resumo, duplo clique, ingresso coerente,
          impossibilidade de forjar qtdMembros, e a garantia de que a
          AUSÊNCIA de grupos-resumo nunca reabre o antigo caminho largo
          (fail-closed). ══════════════ */
    await testEnv.clearDatabase();
    await semearBase();
    {
      const TURMA_T = 'turmaResumo', EXEC_T = 'execResumo';
      const GRUPO_ALICE = 'grupoAlice', GRUPO_BRUNO = 'grupoBruno';
      const ALICE_EMAIL = 'alice.resumo@previ.com.br', BRUNO_EMAIL = 'bruno.resumo@previ.com.br';
      const FAC_T_EMAIL = 'facilitadora.t@previ.com.br';

      await semear(async (adminDb) => {
        await adminDb.ref('fa-facilitadores/' + emailKey(FAC_T_EMAIL)).set({ email: FAC_T_EMAIL, name: 'FACILITADORA T' });
        await adminDb.ref('turmas-equipe/' + TURMA_T + '/' + emailKey(FAC_T_EMAIL)).set({ email: FAC_T_EMAIL, name: 'FACILITADORA T', papel: 'responsavel' });
        const confirmada = (email) => ({ name: email, email: email, status: 'inscrito', confirmedByAdmin: ADMIN_EMAIL, date: '2026-09-01T10:00:00.000Z' });
        await adminDb.ref('turmas-interesse/' + TURMA_T + '/' + emailKey(ALICE_EMAIL)).set(confirmada(ALICE_EMAIL));
        await adminDb.ref('turmas-interesse/' + TURMA_T + '/' + emailKey(BRUNO_EMAIL)).set(confirmada(BRUNO_EMAIL));
        await adminDb.ref('apostas/' + TURMA_T + '/atual').set(EXEC_T);
        await adminDb.ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T).set({ status: 'ativa', criadoEm: '2026-09-01T10:00:00.000Z', numero: 1, grupos: {}, 'grupos-resumo': {} });
      });

      /* ── Criação: grupo real + resumo nascem juntos, mesma chave ── */
      {
        const updates = {};
        updates['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE] = { nome: 'Grupo Alice', criadoEm: '2026-09-01T10:00:00.000Z', etapa: 'missao' };
        updates['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo/' + GRUPO_ALICE] = { nome: 'Grupo Alice', qtdMembros: 0 };
        await assertSucceeds(db(FAC_T_EMAIL).ref().update(updates));
        anota('grupos-resumo — criar grupo grava o grupo real e o resumo (nome+qtdMembros:0) no mesmo update()', true);
      }
      {
        const updates = {};
        updates['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO] = { nome: 'Grupo Bruno', criadoEm: '2026-09-01T10:00:00.000Z', etapa: 'missao' };
        updates['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo/' + GRUPO_BRUNO] = { nome: 'Grupo Bruno', qtdMembros: 0 };
        await assertSucceeds(db(FAC_T_EMAIL).ref().update(updates));
        anota('grupos-resumo — segundo grupo (Bruno) criado da mesma forma', true);
      }

      /* Duplo clique: a mesma chave (já existe) não pode ser criada de novo, nem no grupo nem no resumo. */
      {
        const updatesRepetido = {};
        updatesRepetido['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE] = { nome: 'Grupo Alice (de novo)', criadoEm: new Date().toISOString(), etapa: 'missao' };
        updatesRepetido['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo/' + GRUPO_ALICE] = { nome: 'Grupo Alice (de novo)', qtdMembros: 0 };
        await assertFails(db(FAC_T_EMAIL).ref().update(updatesRepetido));
        anota('grupos-resumo — duplo clique (mesma chave já existe) é recusado, nunca sobrescreve nem cria um "grupo fantasma"', true);
      }

      /* Resumo cujo nome não bate com o grupo real gravado no mesmo update(): recusado. */
      {
        const chaveDivergente = 'grupoDivergente';
        const updatesDivergente = {};
        updatesDivergente['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + chaveDivergente] = { nome: 'Nome Real', criadoEm: new Date().toISOString(), etapa: 'missao' };
        updatesDivergente['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo/' + chaveDivergente] = { nome: 'Nome Falso', qtdMembros: 0 };
        await assertFails(db(FAC_T_EMAIL).ref().update(updatesDivergente));
        anota('grupos-resumo — nome do resumo tem que bater com o nome do grupo real gravado no MESMO update()', true);
      }

      /* ── Ingresso: Alice entra no Grupo Alice, Bruno no Grupo Bruno ── */
      {
        const updatesAlice = {};
        updatesAlice['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE + '/membros/' + emailKey(ALICE_EMAIL)] =
          { name: 'Alice', email: ALICE_EMAIL, entrouEm: new Date().toISOString() };
        updatesAlice['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo/' + GRUPO_ALICE + '/qtdMembros'] = 1;
        await assertSucceeds(db(ALICE_EMAIL).ref().update(updatesAlice));
        anota('grupos-resumo — Alice entra no Grupo Alice: membros e qtdMembros gravados juntos, no mesmo update()', true);
      }
      {
        const updatesBruno = {};
        updatesBruno['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/membros/' + emailKey(BRUNO_EMAIL)] =
          { name: 'Bruno', email: BRUNO_EMAIL, entrouEm: new Date().toISOString() };
        updatesBruno['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo/' + GRUPO_BRUNO + '/qtdMembros'] = 1;
        await assertSucceeds(db(BRUNO_EMAIL).ref().update(updatesBruno));
        anota('grupos-resumo — Bruno entra no Grupo Bruno', true);
      }

      /* qtdMembros não pode ser forjado — nem sozinho, nem bundlado com
         a própria entrada legítima no grupo, se o número não bater com
         a contagem real de membros DEPOIS da escrita. */
      {
        const updatesForjado = {};
        updatesForjado['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo/' + GRUPO_ALICE + '/qtdMembros'] = 99;
        await assertFails(db(ALICE_EMAIL).ref().update(updatesForjado));
        anota('grupos-resumo — qtdMembros sozinho NÃO pode ser gravado com um número que não bate com a contagem real', true);

        const updatesRegravar = {};
        updatesRegravar['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE + '/membros/' + emailKey(ALICE_EMAIL)] =
          { name: 'Alice', email: ALICE_EMAIL, entrouEm: new Date().toISOString() };
        updatesRegravar['apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo/' + GRUPO_ALICE + '/qtdMembros'] = 7;
        await assertFails(db(ALICE_EMAIL).ref().update(updatesRegravar));
        anota('grupos-resumo — mesmo combinado com a própria escrita legítima de membros, um número errado (7, o real é 1) derruba o update() inteiro', true);
      }

      /* ── Descoberta: resumo de TODOS os grupos, nunca a lista de membros do outro ── */
      await assertSucceeds(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo').once('value'));
      anota('grupos-resumo — Alice lê o resumo de TODOS os grupos da execução atual (descoberta)', true);

      /* Consulta só da própria chave, em QUALQUER grupo — nunca a lista inteira. */
      await assertSucceeds(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE + '/membros/' + emailKey(ALICE_EMAIL)).once('value'));
      anota('grupos-resumo — Alice consulta a PRÓPRIA chave no Grupo Alice (pertence)', true);
      await assertSucceeds(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/membros/' + emailKey(ALICE_EMAIL)).once('value'));
      anota('grupos-resumo — Alice também consulta a PRÓPRIA chave no Grupo Bruno mesmo sem pertencer (só essa chave, nunca a lista)', true);
      await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/membros/' + emailKey(BRUNO_EMAIL)).once('value'));
      anota('grupos-resumo — Alice NÃO lê a chave de Bruno no Grupo Bruno (chave alheia)', true);
      await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/membros').once('value'));
      anota('grupos-resumo — Alice NÃO lê a lista inteira de membros do Grupo Bruno', true);

      /* Leitura plena do PRÓPRIO grupo. */
      await assertSucceeds(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE).once('value'));
      anota('grupos-resumo — Alice lê o PRÓPRIO grupo inteiro (nome, membros, dados, ciclos)', true);

      /* Negações: grupo/dados/ciclos/Evidência/Decisão do OUTRO grupo. */
      await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO).once('value'));
      anota('grupos-resumo — Alice NÃO lê o Grupo Bruno inteiro', true);
      await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/dados').once('value'));
      anota('grupos-resumo — Alice NÃO lê dados do Grupo Bruno', true);
      await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/dados/evidencia').once('value'));
      anota('grupos-resumo — Alice NÃO lê a Evidência do Grupo Bruno', true);
      await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/dados/decisao').once('value'));
      anota('grupos-resumo — Alice NÃO lê a Decisão do Grupo Bruno', true);
      await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/ciclos').once('value'));
      anota('grupos-resumo — Alice NÃO lê ciclos do Grupo Bruno', true);
      await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO + '/dados/problema').set({ x: 1 }));
      anota('grupos-resumo — Alice NÃO escreve no Grupo Bruno', true);

      /* Simétrico para Bruno. */
      await assertSucceeds(db(BRUNO_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO).once('value'));
      anota('grupos-resumo — Bruno lê o PRÓPRIO grupo inteiro (simétrico)', true);
      await assertFails(db(BRUNO_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE).once('value'));
      anota('grupos-resumo — Bruno NÃO lê o Grupo Alice inteiro (simétrico)', true);
      await assertFails(db(BRUNO_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE + '/dados/evidencia').once('value'));
      anota('grupos-resumo — Bruno NÃO lê a Evidência do Grupo Alice (simétrico)', true);
      await assertFails(db(BRUNO_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE + '/membros').once('value'));
      anota('grupos-resumo — Bruno NÃO lê a lista de membros do Grupo Alice (simétrico)', true);
      await assertFails(db(BRUNO_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE + '/dados/problema').set({ x: 1 }));
      anota('grupos-resumo — Bruno NÃO escreve no Grupo Alice (simétrico)', true);

      /* Facilitadora autorizada lê os dois grupos inteiros (cascata da Rule ampla de execucoes/$execKey). */
      await assertSucceeds(db(FAC_T_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE).once('value'));
      anota('grupos-resumo — facilitadora autorizada lê o Grupo Alice inteiro', true);
      await assertSucceeds(db(FAC_T_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_BRUNO).once('value'));
      anota('grupos-resumo — facilitadora autorizada lê o Grupo Bruno inteiro', true);

      /* Facilitador global SEM vínculo NESTA turma continua recusado. */
      await assertFails(db(FAC_SEM_VINCULO_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos/' + GRUPO_ALICE).once('value'));
      anota('grupos-resumo — facilitador global SEM vínculo em turmaResumo continua recusado', true);
      await assertFails(db(FAC_SEM_VINCULO_EMAIL).ref('apostas/' + TURMA_T + '/execucoes/' + EXEC_T + '/grupos-resumo').once('value'));
      anota('grupos-resumo — facilitador sem vínculo também não lê o resumo (nem confirmado, nem autorizado)', true);

      /* Ausência de grupos-resumo NUNCA reabre o fallback amplo. */
      {
        const TURMA_SEM_RESUMO = 'turmaSemResumo', EXEC_SEM_RESUMO = 'execSemResumo';
        await semear(async (adminDb) => {
          await adminDb.ref('turmas-interesse/' + TURMA_SEM_RESUMO + '/' + emailKey(ALICE_EMAIL)).set({
            name: ALICE_EMAIL, email: ALICE_EMAIL, status: 'inscrito', confirmedByAdmin: ADMIN_EMAIL, date: '2026-09-01T10:00:00.000Z'
          });
          await adminDb.ref('apostas/' + TURMA_SEM_RESUMO + '/atual').set(EXEC_SEM_RESUMO);
          /* Propositalmente SEM grupos-resumo/ — simula uma execução
             criada antes desta fase, ou um backfill que ainda não rodou. */
          await adminDb.ref('apostas/' + TURMA_SEM_RESUMO + '/execucoes/' + EXEC_SEM_RESUMO).set({
            status: 'ativa', criadoEm: '2026-09-01T10:00:00.000Z', numero: 1,
            grupos: { grupoOrfa: { nome: 'Grupo Órfão', criadoEm: '2026-09-01T10:00:00.000Z', etapa: 'missao' } }
          });
        });
        await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_SEM_RESUMO + '/execucoes/' + EXEC_SEM_RESUMO).once('value'));
        anota('grupos-resumo AUSENTE — participante confirmada NÃO recupera a leitura ampla da execução como "fallback" (fail-closed)', true);
        await assertFails(db(ALICE_EMAIL).ref('apostas/' + TURMA_SEM_RESUMO + '/execucoes/' + EXEC_SEM_RESUMO + '/grupos').once('value'));
        anota('grupos-resumo AUSENTE — nem o nó grupos/ inteiro fica acessível por tabela (continua exigindo SOU_MEMBRO em cada grupo)', true);
        await assertSucceeds(db(ALICE_EMAIL).ref('apostas/' + TURMA_SEM_RESUMO + '/execucoes/' + EXEC_SEM_RESUMO + '/missao').once('value'));
        anota('grupos-resumo AUSENTE — missao/revelado continuam legíveis normalmente (Rules independentes de grupos-resumo existir)', true);
      }
    }

    /* ══════════════ Transição atômica legítima da FASE 1 (execução):
          encerrar a antiga + criar a nova + mudar "atual", tudo no
          MESMO update() multi-caminho ══════════════ */
    await testEnv.clearDatabase();
    await semearBase();
    {
      const EXEC_NOVA2 = 'execNova2';
      const updates = {};
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/status'] = 'encerrada';
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/encerradaEm'] = new Date().toISOString();
      updates['apostas/' + TURMA_A + '/execucoes/' + EXEC_NOVA2] = {
        status: 'ativa', criadoEm: new Date().toISOString(), numero: 2, grupos: {}
      };
      updates['apostas/' + TURMA_A + '/atual'] = EXEC_NOVA2;
      await assertSucceeds(db(FAC_A_EMAIL).ref().update(updates));
      anota('transição atômica da Fase 1 (encerrar antiga + criar nova + mudar atual, no mesmo update) continua permitida', true);

      await assertFails(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A + '/missao').set({ oQue: 'x' }));
      anota('depois da transição, a execução antiga já está imutável (mesma checagem de S2)', true);
      await assertSucceeds(db(FAC_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_NOVA2 + '/missao').set({ oQue: 'nova missão' }));
      anota('a execução nova, essa sim, aceita escrita normal', true);
    }

    console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  } finally {
    await testEnv.cleanup();
  }

  if (falhas) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
