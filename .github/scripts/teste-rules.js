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
      const casos = [
        { rotulo: '0 pontos', email: 'semponto@previ.com.br' },
        { rotulo: '1 ponto', email: 'um.ponto@previ.com.br' },
        { rotulo: '2 pontos', email: 'dois.pontos.aqui@previ.com.br' },
        { rotulo: '4 pontos (vários)', email: 'a.b.c.d.varios@previ.com.br' },
      ];
      await semear(async (adminDb) => {
        await adminDb.ref('apostas/' + TURMA_ID + '/atual').set(EXEC_ID);
        await adminDb.ref('apostas/' + TURMA_ID + '/execucoes/' + EXEC_ID).set({ status: 'ativa', criadoEm: '2026-09-01T10:00:00.000Z', numero: 1, grupos: { g1: { nome: 'G1', criadoEm: '2026-09-01T10:00:00.000Z', etapa: 'missao' } } });
        for (const c of casos) {
          await adminDb.ref('fa-facilitadores/' + emailKey(c.email)).set({ email: c.email, name: c.rotulo });
          await adminDb.ref('turmas-equipe/' + TURMA_ID + '/' + emailKey(c.email)).set({ email: c.email, name: c.rotulo, papel: 'facilitador' });
        }
      });

      for (const c of casos) {
        await assertSucceeds(db(c.email).ref('apostas/' + TURMA_ID + '/execucoes/' + EXEC_ID + '/revelado').set(true));
        anota('emailKey (' + c.rotulo + ' no local-part, ' + c.email + '): vínculo de facilitação reconhecido pela Rule',
          true);

        await assertSucceeds(db(c.email).ref('apostas/' + TURMA_ID + '/execucoes/' + EXEC_ID + '/grupos/g1/membros/' + emailKey(c.email))
          .set({ name: c.rotulo, email: c.email, entrouEm: new Date().toISOString() }));
        anota('emailKey (' + c.rotulo + '): autoingresso (chave própria) também reconhecido pela Rule', true);

        const outraChave = emailKey('outra.pessoa.' + casos.indexOf(c) + '@previ.com.br');
        await assertFails(db(c.email).ref('apostas/' + TURMA_ID + '/execucoes/' + EXEC_ID + '/grupos/g1/membros/' + outraChave)
          .set({ name: 'x', email: 'outra@previ.com.br', entrouEm: new Date().toISOString() }));
        anota('emailKey (' + c.rotulo + '): NÃO consegue se passar por uma chave que não é a própria', true);
      }
    }

    await testEnv.clearDatabase();
    await semearBase();

    /* ══════════════ 32/S1 — PARTICIPANTE LEGÍTIMO ══════════════ */
    {
      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/atual').once('value'));
      anota('participante confirmada lê apostas/<turma>/atual', true);

      await assertSucceeds(db(PART_A_EMAIL).ref('apostas/' + TURMA_A + '/execucoes/' + EXEC_A).once('value'));
      anota('participante confirmada lê a execução ATUAL inteira (precisa pra escolher grupo)', true);

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
