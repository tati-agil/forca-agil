/* Construção da Aposta — a dinâmica guiada dos diretores.
 *
 * POR QUE ESTE TESTE EXISTE
 * Duas exigências desta funcionalidade são invisíveis para quem a
 * constrói e catastróficas se quebrarem em sala:
 *
 * 1. A PALAVRA "OKR" NÃO PODE VAZAR. A dinâmica inteira depende de o
 *    grupo NÃO saber que está montando um OKR enquanto preenche — a
 *    revelação no fim é o ponto alto da oficina. Basta um rótulo, uma
 *    dica ou um texto de ajuda escaparem "Objective" ou "Key Result"
 *    para o efeito acabar, e ninguém percebe lendo o código: são nove
 *    telas de texto. Aqui a conferência é mecânica, tela por tela.
 *
 * 2. AS ETAPAS SEGUINTES NÃO PODEM ABRIR SOZINHAS — NEM PELO NOME. O
 *    valor está em percorrer o raciocínio — sintoma, depois problema,
 *    depois hipótese. Se o formulário inteiro aparecer de uma vez, o
 *    grupo pula direto para a solução, que é o hábito que a oficina
 *    existe para interromper. E o nome sozinho já induz: quem lê
 *    "Hipótese" na trilha escreve o sintoma pensando na explicação.
 *    A trilha mostra os NÚMEROS das nove etapas; os nomes só quando
 *    chega a vez de cada uma (ou depois de preenchida).
 *
 * 3. QUEM PREENCHE PRECISA VER O QUE É FIXO E COMO ESTÁ FICANDO. Os
 *    campos de uma etapa são pedaços de uma frase. Sem ver a frase se
 *    montar, a pessoa escreve o molde inteiro dentro de um campo só —
 *    aconteceu no primeiro uso real.
 *
 * Roda com o Firebase SUBSTITUÍDO pelo falso (.github/scripts/firebase-falso.js):
 * sem rede, sem segredo, sem banco real.
 *
 * O QUE ELE EXIGE, nos dois formatos de tela:
 *   1. o convite só aparece para quem está CONFIRMADA numa turma que o
 *      admin liberou — turma não liberada não mostra nada;
 *   2. nenhuma variação de OKR/Objective/Key Result aparece em etapa
 *      nenhuma antes da revelação;
 *   3. a trilha lista as nove etapas, mas as ainda não alcançadas estão
 *      desabilitadas;
 *   4. o que o grupo escreve é gravado no caminho certo (salvamento
 *      automático), e a etapa seguinte enxerga a anterior no card de
 *      conexão;
 *   5. a validação didática avisa sem bloquear: com "porque" no
 *      sintoma, aparece o aviso E ainda dá para seguir;
 *   6. só depois do clique do facilitador em "Revelar conexões" os
 *      termos aparecem — e aí sim, Missão→Objective e Mudanças→Key Results;
 *   7. nenhum erro de JavaScript não tratado.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM      = 'adm@previ.com.br';
const DIRETORA = 'diretora@previ.com.br';
const DE_FORA  = 'defora@previ.com.br';
const FACILITADORA_TURMA = 'facilitadora.turma@previ.com.br'; /* flag global + vínculo real em TURMA_LIB — nunca admin */

const EV = 'evDir';
const TURMA_LIB = 'tLiberada';
const TURMA_NAO = 'tNaoLiberada';

/* Toda forma de o segredo vazar antes da hora. Inclui o plural e o
   hífen porque o que importa é a pessoa LER a palavra, não a grafia. */
const SEGREDO = /\bOKRs?\b|\bObjective\b|\bKey[\s-]?Results?\b/i;

/* O Firebase falso vive na memória de CADA aba: o que uma grava não
   chega na outra. Então a execução e o grupo já nascem no banco (como
   se a facilitadora os tivesse criado antes da oficina), e a criação
   pela facilitadora é conferida à parte, numa aba com apostas vazio. */
const EXEC = 'exec1';
const GRUPO = 'grupo1';
function apostasSemeadas() {
  return {
    [TURMA_LIB]: {
      atual: EXEC,
      execucoes: {
        [EXEC]: {
          criadaEm: '2026-09-18T12:00:00.000Z', criadaPor: ADM, criadaPorNome: 'ADMIN',
          turmaKey: TURMA_LIB, turmaLabel: 'TURMA LIBERADA', eventoKey: EV,
          missao: '', revelado: false, encerrada: false,
          grupos: { [GRUPO]: { nome: 'Grupo 1', criadoEm: '2026-09-18T12:00:00.000Z', etapa: 'missao' } }
        }
      }
    }
  };
}

/* Fase 2 (Histórico de Execuções): a mesma turma, mas com DUAS
   execuções anteriores a EXEC (que continua sendo "atual") — uma
   LEGADA de verdade (sem status nem numero, do jeito que a Fase 0
   encontrou execuções reais) e uma já no formato da Fase 1 (com
   status/numero/encerradaEm/encerradaPor). Isso é o que prova que a
   Fase 2 lê os dois formatos sem migrar nada. */
const EXEC_LEGADO = 'execLegado';
const GRUPO_LEGADO = 'grupoLegado';
const EXEC_F1 = 'execF1Encerrada';
function apostasSemeadasComHistorico() {
  const base = apostasSemeadas();
  base[TURMA_LIB].execucoes[EXEC_LEGADO] = {
    criadaEm: '2026-08-01T09:00:00.000Z', criadaPor: DIRETORA, criadaPorNome: 'DIRETORA TESTE',
    turmaKey: TURMA_LIB, turmaLabel: 'TURMA LIBERADA', eventoKey: EV,
    missao: '', revelado: false, encerrada: true,
    grupos: {
      [GRUPO_LEGADO]: {
        nome: 'Grupo Antigo', criadoEm: '2026-08-01T09:05:00.000Z', etapa: 'decisao',
        dados: { missao: { verbo: 'reduzir', oQue: 'o tempo de espera', contexto: 'na fila', prazo: '60', prazoUnidade: 'dias' } },
      },
    },
  };
  base[TURMA_LIB].execucoes[EXEC_F1] = {
    numero: 1, status: 'encerrada', criadaEm: '2026-09-01T09:00:00.000Z', criadaPor: ADM, criadaPorNome: 'ADMIN',
    encerradaEm: '2026-09-10T09:00:00.000Z', encerradaPor: ADM, encerradaPorNome: 'ADMIN',
    turmaKey: TURMA_LIB, turmaLabel: 'TURMA LIBERADA', eventoKey: EV,
    missao: '', revelado: false, encerrada: true,
    grupos: {},
  };
  return base;
}

/* Fase 4 — Ciclos de Aprendizagem: um grupo com as etapas Missão até
   Evidência já completas (dados reais, coerentes entre si), faltando
   só responder a Decisão — ponto de partida comum para os cenários de
   criação de ciclo, que testam justamente o que acontece quando essa
   resposta é dada. */
const DADOS_ATE_EVIDENCIA = {
  missao: { verbo: 'reduzir', oQue: 'o tempo de espera', contexto: 'na fila do atendimento', prazo: '60', prazoUnidade: 'dias' },
  sintoma: { texto: 'muita gente reclama da demora na fila' },
  problema: { quem: 'O participante', situacaoIndesejada: 'espera demais na fila do atendimento' },
  mudancas: { itens: [{ id: 'r1', direcao: 'Reduzir', indicador: 'tempo de espera', atual: '30', meta: '15', unidade: 'minutos', periodo: 'não se aplica', prazo: '60', prazoUnidade: 'dias' }] },
  hipotese: { causa: 'faltam atendentes no horário de pico', indicio: 'a fila cresce sempre às sextas de manhã' },
  ideia: { acao: 'reforçar a equipe no horário de pico', mudanca: 'a fila andar mais rápido nesse horário' },
  experimento: { duracao: '2', duracaoUnidade: 'semanas', quantidade: '20', comQuem: 'participantes do horário de pico', oQue: 'escalar mais um atendente', resultadoIds: ['r1'] },
  evidencia: { itens: [{ resultadoId: 'r1', observado: '20', fonte: 'Registros de atendimento', aprendizado: 'a fila melhorou, mas não o suficiente' }], classificacao: 'Parcialmente sustentada' }
};
function apostasProntaParaDecisao() {
  const base = apostasSemeadas();
  base[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = JSON.parse(JSON.stringify(DADOS_ATE_EVIDENCIA));
  base[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'decisao';
  return base;
}

function banco(apostas) {
  const users = {};
  const interesse = {};
  [[ADM, 'ADMIN'], [DIRETORA, 'DIRETORA TESTE'], [DE_FORA, 'PESSOA DE FORA']].forEach(([e, n]) => {
    users[chave(e)] = { name: n, email: e, area: 'DIRAD' };
  });
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };

  /* A diretora está confirmada NAS DUAS turmas — a diferença entre elas
     é só a liberação do admin, que é o que o teste quer isolar. */
  const confirmada = {
    name: 'DIRETORA TESTE', email: DIRETORA, area: 'DIRAD',
    status: 'inscrito', confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN',
    confirmedDate: '2026-09-01T10:00:00.000Z', date: '2026-09-01T10:00:00.000Z',
  };
  interesse[TURMA_LIB] = {}; interesse[TURMA_LIB][chave(DIRETORA)] = confirmada;
  interesse[TURMA_NAO] = {}; interesse[TURMA_NAO][chave(DIRETORA)] = confirmada;

  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { [EV]: { nome: 'FORÇA ÁGIL - DIRETORES', order: 1, publicado: true, cargaHoraria: '3.5' } },
    turmas: {
      [TURMA_LIB]: { label: 'TURMA LIBERADA', eventoKey: EV, order: 1, dias: ['2027-09-16'], apostaHabilitada: true },
      [TURMA_NAO]: { label: 'TURMA SEM APOSTA', eventoKey: EV, order: 2, dias: ['2027-10-16'] },
    },
    'turmas-interesse': interesse,
    'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {},
    'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, apostas: apostas || {},
    treinamentos: {}, 'treinamentos-conteudo': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

const FORMATOS = [
  { nome: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
  { nome: 'celular', opts: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
];

async function novaPagina(browser, formato, email, erros, apostas, cfgExtra, dbOverrides) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  /* Sem isso, o Playwright descarta (Cancelar) qualquer confirm()/alert()
     por padrão — e a confirmação "o experimento já foi executado?" antes
     de entrar no modo de registro da Evidência (ajuste de usabilidade
     #4) travaria a suíte inteira esperando um diálogo que nunca fecha. */
  page.on('dialog', (d) => d.accept());
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({
    db: Object.assign(banco(apostas), dbOverrides || {}), user: { email: email, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }, cfgExtra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  return { ctx, page };
}

const textoDaTela = (page) => page.evaluate(() => {
  const t = document.querySelector('.aposta-tela');
  return t ? (t.textContent || '').replace(/\s+/g, ' ') : '';
});

/* `html { scroll-behavior: smooth }` (styles.css) faz o clique comum do
   Playwright (que rola o elemento pra tela antes de clicar) mirar numa
   posição que já mudou quando o clique de verdade dispara — some sem
   erro nenhum, e sem esse recurso o clique só falha logo depois de uma
   troca de conteúdo que desloca a página (como a frase de Mudanças
   mensuráveis virando "corrija a inconsistência" bem antes do clique em
   CONTINUAR). Clique nativo via DOM não depende de rolagem nenhuma. */
const clicarSemRolagem = (page, seletor) => page.$eval(seletor, (el) => el.click());

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) console.log('  ok    ' + linha);
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };

  for (const formato of FORMATOS) {
    console.log('\n===== ' + formato.nome.toUpperCase() + ' =====');
    const erros = [];

    try {
      /* ── 1: quem não está confirmada em turma liberada não vê nada ── */
      {
        const { ctx, page } = await novaPagina(browser, formato, DE_FORA, erros);
        await page.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#apostaEntrada', { state: 'attached', timeout: 15000 });
        await page.waitForTimeout(900);
        const visivel = await page.evaluate(() => {
          const el = document.getElementById('apostaEntrada');
          return !!el && !el.hidden && el.getBoundingClientRect().height > 0;
        });
        anota('quem não está confirmada em turma liberada não vê o convite', !visivel);
        await ctx.close();
      }

      /* ── 1b: quem conduz consegue ENSAIAR antes de liberar ──
         Liberar é um ato público: a dinâmica passa a aparecer para toda a
         turma. Se a única forma de ver a tela fosse liberando, o ensaio da
         facilitadora estrearia na frente do grupo. */
      {
        const { ctx, page } = await novaPagina(browser, formato, ADM, erros);
        await page.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#apostaAbrirBtn', { timeout: 15000 });
        const visaoAdmin = await page.evaluate(() => {
          const el = document.getElementById('apostaEntrada');
          const t = el.textContent || '';
          const sel = document.getElementById('apostaTurmaSel');
          return {
            temNaoLiberada: /TURMA SEM APOSTA/.test(t),
            marcaEnsaio: sel ? /ensaio/i.test(sel.textContent || '') : false,
            opcoes: sel ? sel.options.length : 1,
            primeiraEhLiberada: sel ? /TURMA LIBERADA/.test(sel.options[0].textContent) : true,
          };
        });
        anota('quem conduz vê também a turma ainda não liberada, para ensaiar',
          visaoAdmin.temNaoLiberada, JSON.stringify(visaoAdmin));
        anota('a turma não liberada vem marcada como ensaio', visaoAdmin.marcaEnsaio);
        anota('as turmas já liberadas vêm primeiro na lista', visaoAdmin.primeiraEhLiberada);

        /* Escolhendo a não liberada, o aviso diz que só a facilitação vê. */
        if (visaoAdmin.opcoes > 1) {
          await page.selectOption('#apostaTurmaSel', TURMA_NAO);
          await page.waitForTimeout(200);
          const aviso = await page.evaluate(() =>
            (document.getElementById('apostaConviteAviso').textContent || ''));
          anota('o convite avisa que a turma não liberada é só ensaio',
            /ainda não foi liberada/i.test(aviso) && /só você e a facilitação/i.test(aviso),
            aviso.slice(0, 90));
        }
        await ctx.close();
      }

      /* ── 2: a facilitadora abre a dinâmica do zero e cria um grupo ── */
      {
        const { ctx: ctxNovo, page: novo } = await novaPagina(browser, formato, ADM, erros);
        await novo.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await novo.waitForSelector('#apostaAbrirBtn', { timeout: 15000 });
        await novo.click('#apostaAbrirBtn');
        await novo.waitForSelector('#apostaNovaExecBtn', { timeout: 15000 });
        await novo.click('#apostaNovaExecBtn');
        /* #apostaPainelBtn faz parte do cabeçalho comum a TODAS as telas —
           inclusive "A dinâmica ainda não começou", que já aparece antes
           de criarExecucao() terminar. Esperar só por ele é uma corrida
           real: clicar cedo demais abre o painel com a execução ainda não
           carregada (_execId ainda null), e criar um grupo nesse instante
           grava no caminho errado (execucoes/null/...) em vez da execução
           nova. Esperar o aviso "Nenhum grupo criado ainda" — que só
           aparece depois que a execução nova de fato carregou — é o sinal
           correto de que dá para abrir o painel com segurança. */
        await novo.waitForSelector('text=Nenhum grupo criado ainda', { timeout: 15000 });
        await novo.waitForSelector('#apostaPainelBtn', { timeout: 15000 });
        await novo.click('#apostaPainelBtn');
        await novo.waitForSelector('#apostaCriarGrupo', { timeout: 10000 });
        const notaGrupo = await novo.evaluate(() => document.body.textContent || '');
        anota('o painel avisa que um grupo pode ser uma pessoa sozinha ou várias',
          /Cada grupo pode ser formado por uma ou mais pessoas/i.test(notaGrupo));
        await novo.fill('#apostaNovoGrupo', 'Grupo 1');
        await novo.click('#apostaCriarGrupo');
        /* waitForTimeout(500) fixo era frágil: numa CI mais lenta/carregada,
           a gravação (setTimeout no Firebase falso) + redesenho do painel
           podem legitimamente levar mais que isso. waitForFunction espera
           o texto aparecer de verdade, com folga, em vez de um tempo fixo
           que pode não ser suficiente. */
        const criou = await novo.waitForFunction(
          () => /Grupo 1/.test(document.body.textContent || ''),
          null, { timeout: 8000 }
        ).then(() => true).catch(() => false);
        anota('a facilitadora abre a dinâmica do zero e cria um grupo', criou);

        /* "X/9 etapas" sozinho não dizia se o grupo tinha acabado de abrir
           ou estava parado no meio — o status (não iniciado/em andamento/
           concluído) responde isso sem precisar comparar X com 9. */
        const statusGrupoNovo = await novo.evaluate(() =>
          ((Array.from(document.querySelectorAll('.aposta-fac-grupo')).find((g) => /Grupo 1/.test(g.textContent)) || {}).textContent || ''));
        anota('grupo recém-criado, sem nenhuma etapa, aparece como "0/9 etapas · não iniciado"',
          /0\/9 etapas · n[ãa]o iniciado/.test(statusGrupoNovo), statusGrupoNovo.replace(/\s+/g, ' '));
        /* "ninguém ainda" ficava colado ao status de etapas e lia como se
           fosse sobre progresso — a lista de participantes é outra
           informação (quem está no grupo, não quantas etapas fez). */
        anota('grupo sem participante nenhum mostra "sem participantes ainda", nunca "ninguém ainda"',
          /sem participantes ainda/i.test(statusGrupoNovo) && !/ningu[ée]m ainda/i.test(statusGrupoNovo),
          statusGrupoNovo.replace(/\s+/g, ' '));

        /* O painel pede a missão nas MESMAS lacunas da etapa 1: se as duas
           telas pedem a mesma frase, pedem do mesmo jeito. */
        const painelMissao = await novo.evaluate(() => ({
          lacunas: Array.from(document.querySelectorAll('[data-mis]')).map((e) => e.dataset.mis).join(','),
          fixo: Array.from(document.querySelectorAll('.aposta-molde--fac .aposta-molde-fixo'))
            .map((e) => e.textContent.trim()).join(' '),
        }));
        anota('o painel pede a missão nas mesmas lacunas da etapa 1',
          /verbo/.test(painelMissao.lacunas) && /oQue/.test(painelMissao.lacunas) &&
          /prazo/.test(painelMissao.lacunas) && /prazoUnidade/.test(painelMissao.lacunas),
          painelMissao.lacunas);
        anota('o painel não deixa o "em" solto na área de edição — só na frase automática',
          !/(^|\s)em(\s|$)/.test(painelMissao.fixo), '"' + painelMissao.fixo + '"');
        const rotuloPrazoFac = await novo.evaluate(() =>
          ((document.querySelector('.aposta-molde--fac .aposta-campo-rot') || {}).textContent || '').trim());
        anota('o painel mostra o rótulo "Prazo", igual à etapa 1',
          /^prazo$/i.test(rotuloPrazoFac), 'rótulo: "' + rotuloPrazoFac + '"');
        await novo.fill('[data-mis="verbo"]', 'Reduzir');
        await novo.click('#apostaSalvarMissao');
        await novo.waitForTimeout(400);
        const gravouMissao = await novo.evaluate(() => (window.__ESCRITAS || [])
          .filter((x) => /\/missao$/.test(x.path)).slice(-1)[0] || null);
        const salvo = gravouMissao && (gravouMissao.valor !== undefined ? gravouMissao.valor : gravouMissao.value);
        anota('salvar a missão grava as lacunas, não um texto solto',
          !!salvo && typeof salvo === 'object' && salvo.verbo === 'Reduzir',
          JSON.stringify(gravouMissao));

        /* Missão-base: título, textos de apoio e o estado depois de salva —
           o painel espera o redesenho (desenhar() roda de novo ~1,2s depois
           do "salvo" para atualizar botão/selo). */
        await novo.waitForTimeout(1200);
        const missaoBaseUi = await novo.evaluate(() => {
          /* .modal-box é classe genérica (admin.js, game.js, facilitador.js
             também usam) — escopar pelo h4 já localizado, não pegar o
             primeiro ".modal-box" da página, que pode ser de outro módulo. */
          var h4 = Array.from(document.querySelectorAll('h4')).find(function (h) { return /Miss[ãa]o-base/i.test(h.textContent); });
          var box = h4 ? h4.closest('.modal-box') : null;
          return {
            titulo: h4 ? h4.textContent : '',
            textos: box ? box.textContent : '',
            status: (document.getElementById('apostaMissaoFacStatus') || {}).textContent || '',
            botao: (document.getElementById('apostaSalvarMissao') || {}).textContent || '',
            temRemover: !!document.getElementById('apostaRemoverMissaoFac'),
          };
        });
        anota('o título da seção virou "Missão-base da dinâmica"', /Miss[ãa]o-base da din[âa]mica/i.test(missaoBaseUi.titulo));
        anota('o texto explica que vale só para quem ainda não preencheu, e que não afeta quem já começou',
          /ponto de partida apenas para grupos que ainda não preencheram/i.test(missaoBaseUi.textos) &&
          /não modificam grupos que já iniciaram/i.test(missaoBaseUi.textos));
        anota('depois de salvar, o botão vira "Atualizar missão-base" e aparece "✓ Missão-base salva"',
          /Atualizar miss[ãa]o-base/i.test(missaoBaseUi.botao) && /Miss[ãa]o-base salva/i.test(missaoBaseUi.status));
        anota('depois de salva, aparece a ação discreta "Remover missão-base"', missaoBaseUi.temRemover);

        /* Prévia compacta ao vivo — a mesma frase que a etapa 1 vai montar,
           reagindo ao que está sendo digitado, antes de salvar. */
        await novo.fill('[data-mis="oQue"]', 'os contatos sobre andamento');
        await novo.waitForTimeout(200);
        const previaMissaoBase = await novo.evaluate(() =>
          ((document.getElementById('apostaPreviaMissaoFac') || {}).textContent || '').replace(/\s+/g, ' '));
        anota('a prévia "Missão-base" reage ao que está sendo digitado, antes de salvar',
          /Miss[ãa]o-base/.test(previaMissaoBase) && /os contatos sobre andamento/.test(previaMissaoBase),
          previaMissaoBase.slice(0, 140));

        /* Remover missão-base: pede confirmação (aceita globalmente, ver
           novaPagina) e volta ao estado sem missão-base. */
        await novo.click('#apostaRemoverMissaoFac');
        await novo.waitForTimeout(400);
        const depoisRemover = await novo.evaluate(() => ({
          botao: ((document.getElementById('apostaSalvarMissao') || {}).textContent || '').trim(),
          temStatus: !!document.getElementById('apostaMissaoFacStatus'),
          temRemover: !!document.getElementById('apostaRemoverMissaoFac'),
        }));
        anota('remover a missão-base pede confirmação e volta o botão para "Salvar missão-base", sem selo nem ação de remover',
          /^Salvar miss[ãa]o-base$/i.test(depoisRemover.botao) && !depoisRemover.temStatus && !depoisRemover.temRemover,
          JSON.stringify(depoisRemover));

        /* Bug relatado no uso real: preencher a missão-base (sem salvar)
           e clicar em "Criar grupo" apagava tudo o que tinha sido
           digitado em cima — desenhar() redesenha o painel inteiro a
           partir do que já está gravado (nada, aqui), e o rascunho ainda
           não salvo ia junto. */
        await novo.fill('[data-mis="verbo"]', 'Melhorar');
        await novo.fill('[data-mis="oQue"]', 'a experiência do participante');
        await novo.fill('#apostaNovoGrupo', 'Grupo 2');
        await novo.click('#apostaCriarGrupo');
        await novo.waitForTimeout(500);
        const rascunhoSobreviveu = await novo.evaluate(() => ({
          verbo: (document.querySelector('[data-mis="verbo"]') || {}).value || '',
          oQue: (document.querySelector('[data-mis="oQue"]') || {}).value || '',
        }));
        anota('criar um grupo não apaga o que já estava digitado (e ainda não salvo) na missão-base',
          rascunhoSobreviveu.verbo === 'Melhorar' && /experiência do participante/.test(rascunhoSobreviveu.oQue),
          JSON.stringify(rascunhoSobreviveu));

        await ctxNovo.close();
      }

      /* ── 2b: a trilha revelada NÃO pode ter buracos ──
         Relatado no uso real: "apareceu até Hipótese, depois só 6, 7 e 8
         como números, e Evidência e Decisão como nomes". Era um grupo
         retomado — as etapas do fim tinham conteúdo de uma passagem
         anterior e o nome vinha junto, sem explicação possível para quem
         olha. O que vale é até onde o grupo chegou, sem pular. */
      {
        const semeado = apostasSemeadas();
        const g = semeado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO];
        g.etapa = 'sintoma';
        g.dados = {
          missao:    { verbo: 'Melhorar', oQue: 'a experiência', prazo: '90', prazoUnidade: 'dias' },
          evidencia: { itens: [{ resultadoId: 'r1', observado: '25% menos' }] },
          decisao:   { decisao: 'Ampliar', proximaAcao: 'novo teste' },
        };
        const { ctx: ctxT, page: pg } = await novaPagina(browser, formato, DIRETORA, erros, semeado);
        await pg.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('#apostaAbrirBtn', { timeout: 15000 });
        await pg.click('#apostaAbrirBtn');
        await pg.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg.click('.aposta-grupo-btn');
        await pg.waitForSelector('.aposta-trilha-item', { timeout: 15000 });
        const nomeados = await pg.evaluate(() => Array.from(document.querySelectorAll('.aposta-trilha-item'))
          .map((i) => !i.classList.contains('is-oculta')));
        const primeiraOculta = nomeados.indexOf(false);
        const buraco = primeiraOculta !== -1 && nomeados.slice(primeiraOculta).some(Boolean);
        anota('a trilha revelada não tem buracos (nome depois de etapa escondida)',
          !buraco, nomeados.map((n, i) => (i + 1) + (n ? ':nome' : ':—')).join(' '));
        await ctxT.close();
      }

      /* ── 2c: texto fixo colado na lacuna, e valor antigo fora de formato ──
         Dois defeitos vistos na tela: um texto fixo sozinho numa linha
         entre dois campos largos, sem nada dizendo a que campo pertencia
         (o caso original era "e medir", removido do molde nesta etapa);
         e o custo "10.0000", gravado antes da máscara existir,
         aparecendo cru como se máscara nenhuma houvesse. */
      {
        const semeado = apostasSemeadas();
        const g = semeado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO];
        g.etapa = 'experimento';
        g.dados = { experimento: { custo: '10.0000', duracao: '3', duracaoUnidade: 'semanas' } };
        const { ctx: ctxE, page: pg } = await novaPagina(browser, formato, DIRETORA, erros, semeado);
        await pg.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('#apostaAbrirBtn', { timeout: 15000 });
        await pg.click('#apostaAbrirBtn');
        await pg.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg.click('.aposta-grupo-btn');
        await pg.waitForSelector('.aposta-molde', { timeout: 15000 });

        const soltos = await pg.evaluate(() => Array.from(document.querySelectorAll('.aposta-molde-fixo'))
          .filter((f) => !f.parentElement.classList.contains('aposta-par'))
          .map((f) => f.textContent.trim()));
        anota('nenhum pedaço de texto fixo fica solto, longe da lacuna dele',
          soltos.length === 0, soltos.join(' | '));
        const juntos = await pg.evaluate(() => {
          const par = Array.from(document.querySelectorAll('.aposta-par'))
            .find((p) => /vamos/.test((p.querySelector('.aposta-molde-fixo') || {}).textContent || ''));
          return !!(par && par.querySelector('[data-campo="oQue"]'));
        });
        anota('"vamos" vem no mesmo bloco do campo que ele apresenta', juntos);

        /* Em coluna, flex-basis vira altura: a lacuna do prazo já herdou
           230px de ALTURA e abriu um buraco no meio da frase. */
        const alturas = await pg.evaluate(() => Array.from(document.querySelectorAll('.aposta-par'))
          .map((p) => Math.round(p.getBoundingClientRect().height)));
        anota('nenhum bloco da frase estica a linha (buraco no meio)',
          alturas.every((h) => h < 160), alturas.join(', '));

        const custo = await pg.evaluate(() => {
          const el = document.querySelector('[data-campo="custo"]');
          const nota = el ? el.parentElement.querySelector('.aposta-legado-inline') : null;
          return { valor: el ? el.value : '(sem campo)', nota: nota ? nota.textContent : '' };
        });
        anota('valor antigo fora do formato não aparece cru no campo de moeda',
          custo.valor === '' && /10\.0000/.test(custo.nota), JSON.stringify(custo));
        await ctxE.close();
      }

      /* ── 2c2: Direção da mudança — Manter e Atingir, além de Aumentar/
            Reduzir. "Manter" pede Tipo de limite (Pelo menos/No máximo/
            Entre); "Entre" troca Meta desejada por dois campos (Limite
            mínimo/máximo). Nada disso redesenha a tela: só o 4º campo
            da linha muda, o resto do card fica como estava. ── */
      {
        const semeadoDir = apostasSemeadas();
        semeadoDir[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'mudancas';
        const { ctx: ctxDir, page: pgDir } = await novaPagina(browser, formato, DIRETORA, erros, semeadoDir);
        await pgDir.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgDir.click('#apostaAbrirBtn');
        await pgDir.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgDir.click('.aposta-grupo-btn');
        await pgDir.waitForFunction(() => /MUDAN/i.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''), { timeout: 15000 });

        const rotulo = await pgDir.evaluate(() => {
          const rot = Array.from(document.querySelectorAll('.aposta-campo-rot')).find((r) => /Dire[çc][ãa]o da mudan[çc]a/.test(r.textContent));
          return rot ? rot.textContent : '';
        });
        anota('o campo "Queremos" virou "Direção da mudança"', /Direção da mudança/.test(rotulo), rotulo);

        await pgDir.fill('[data-m="indicador"]', 'tempo de resposta');
        await pgDir.fill('[data-m="atual"]', '3');
        await pgDir.selectOption('[data-m="formaMedicao"]', 'Tempo');
        await pgDir.waitForTimeout(200);
        await pgDir.locator('.aposta-variante:has([data-m="unidade"]) .aposta-variante-chip', { hasText: 'dias' }).click();
        await pgDir.waitForTimeout(200);

        /* Manter + Entre: some o campo Meta, aparecem os dois limites. */
        await pgDir.locator('.aposta-variante:has([data-m="direcao"]) .aposta-variante-chip', { hasText: 'Manter' }).click();
        await pgDir.waitForTimeout(250);
        await pgDir.locator('.aposta-variante:has([data-m="tipoLimite"]) .aposta-variante-chip', { hasText: 'Entre' }).click();
        await pgDir.waitForTimeout(250);
        const camposEntre = await pgDir.evaluate(() => ({
          temMeta: !!document.querySelector('[data-m="meta"]'),
          temLimites: !!document.querySelector('[data-m="limiteMinimo"]') && !!document.querySelector('[data-m="limiteMaximo"]'),
        }));
        anota('"Manter" + "Entre" troca Meta desejada pelos dois limites', !camposEntre.temMeta && camposEntre.temLimites, JSON.stringify(camposEntre));
        await pgDir.fill('[data-m="limiteMinimo"]', '2');
        await pgDir.fill('[data-m="limiteMaximo"]', '5');
        await pgDir.fill('[data-m="prazo"]', '90');
        await pgDir.waitForTimeout(300);
        const fraseManter = await pgDir.evaluate(() => (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
        anota('a frase de "Manter" + "Entre" usa os dois limites, com "durante" no lugar de "em"',
          /Manter tempo de resposta entre 2 e 5 dias durante 90 dias/.test(fraseManter), fraseManter);

        /* "Manter" não tem uma meta única — a coerência é contra o
           LIMITE escolhido, não contra "atual == meta". Situação atual
           fora do intervalo [2, 5]: esconde a frase e sugere DUAS
           direções (Aumentar/Atingir ou Reduzir/Atingir, conforme o
           lado), sem trocar nada sozinho. */
        await pgDir.fill('[data-m="atual"]', '9');
        await pgDir.waitForTimeout(600);
        const manterAcima = await pgDir.evaluate(() => ({
          frase: (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '',
          alerta: (document.querySelector('.aposta-mudanca-alerta') || {}).textContent || '',
          botoes: Array.from(document.querySelectorAll('.aposta-mudanca-alerta button')).map((b) => b.textContent),
        }));
        anota('"Manter" com situação atual acima do limite "Entre" esconde a frase e sugere Reduzir/Atingir',
          /Corrija a inconsistência acima/.test(manterAcima.frase) &&
          /acima do intervalo/.test(manterAcima.alerta) &&
          manterAcima.botoes.some((b) => /Reduzir/.test(b)) && manterAcima.botoes.some((b) => /Atingir/.test(b)),
          JSON.stringify(manterAcima));

        const tituloAntesManter = await pgDir.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        await clicarSemRolagem(pgDir, '#apostaSeguir');
        await pgDir.waitForTimeout(300);
        const tituloDepoisManter = await pgDir.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('"Manter" incoerente com o limite também bloqueia CONTINUAR', tituloDepoisManter === tituloAntesManter);

        await pgDir.locator('.aposta-mudanca-alerta button', { hasText: 'Atingir' }).click();
        await pgDir.waitForTimeout(200);
        const corrigidoManter = await pgDir.evaluate(() => ({
          direcao: (document.querySelector('[data-m="direcao"]') || {}).value || '',
          alertaSumiu: !document.querySelector('.aposta-mudanca-alerta'),
        }));
        anota('clicar "Usar Atingir" no alerta de "Manter" muda a direção (nunca sozinho) e o alerta some',
          corrigidoManter.direcao === 'Atingir' && corrigidoManter.alertaSumiu, JSON.stringify(corrigidoManter));

        /* Limite mínimo > máximo: inconsistente por si só, sem sugerir
           direção nenhuma (o problema é a ordem dos limites, não a
           direção escolhida). */
        await pgDir.locator('.aposta-variante:has([data-m="direcao"]) .aposta-variante-chip', { hasText: 'Manter' }).click();
        await pgDir.waitForTimeout(200);
        await pgDir.locator('.aposta-variante:has([data-m="tipoLimite"]) .aposta-variante-chip', { hasText: 'Entre' }).click();
        await pgDir.waitForTimeout(200);
        await pgDir.fill('[data-m="limiteMinimo"]', '10');
        await pgDir.fill('[data-m="limiteMaximo"]', '4');
        await pgDir.waitForTimeout(600);
        const limitesInvertidos = await pgDir.evaluate(() => ({
          frase: (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '',
          alerta: (document.querySelector('.aposta-mudanca-alerta') || {}).textContent || '',
          temBotao: !!document.querySelector('.aposta-mudanca-alerta button'),
        }));
        anota('limite mínimo maior que o máximo esconde a frase, avisa e não sugere direção nenhuma',
          /Corrija a inconsistência acima/.test(limitesInvertidos.frase) &&
          /não pode ser maior/.test(limitesInvertidos.alerta) && !limitesInvertidos.temBotao,
          JSON.stringify(limitesInvertidos));
        /* Devolve ao estado consistente para o resto do teste. */
        await pgDir.fill('[data-m="limiteMinimo"]', '2');
        await pgDir.fill('[data-m="limiteMaximo"]', '5');
        await pgDir.fill('[data-m="atual"]', '3');
        await pgDir.waitForTimeout(300);

        /* Atingir: mesmos campos de Aumentar/Reduzir (Meta desejada
           volta), mas a frase não fala em "situação atual" nem "para". */
        await pgDir.locator('.aposta-variante:has([data-m="direcao"]) .aposta-variante-chip', { hasText: 'Atingir' }).click();
        await pgDir.waitForTimeout(250);
        const camposAtingir = await pgDir.evaluate(() => ({
          temMeta: !!document.querySelector('[data-m="meta"]'),
          temTipoLimite: !!document.querySelector('[data-m="tipoLimite"]'),
        }));
        anota('"Atingir" volta a mostrar Meta desejada, sem Tipo de limite', camposAtingir.temMeta && !camposAtingir.temTipoLimite, JSON.stringify(camposAtingir));
        await pgDir.fill('[data-m="meta"]', '80');
        await pgDir.waitForTimeout(300);
        const fraseAtingir = await pgDir.evaluate(() => (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
        anota('a frase de "Atingir" não repete "situação atual" nem usa "para"',
          /Atingir 80 dias de tempo de resposta em 90 dias/.test(fraseAtingir) && !/situação atual|3 para/.test(fraseAtingir), fraseAtingir);

        /* NPS: quando o indicador já começa pelo nome da própria unidade
           (Forma de medição = Índice, Unidade = NPS), a frase não repete
           a unidade duas vezes — "Atingir NPS 60", não "Atingir 60 NPS
           de NPS da experiência…". */
        await pgDir.fill('[data-m="indicador"]', 'NPS da experiência do participante');
        await pgDir.selectOption('[data-m="formaMedicao"]', 'Índice');
        await pgDir.waitForTimeout(200);
        await pgDir.locator('.aposta-variante:has([data-m="unidade"]) .aposta-variante-chip', { hasText: 'NPS' }).click();
        await pgDir.fill('[data-m="meta"]', '60');
        await pgDir.waitForTimeout(300);
        const fraseNps = await pgDir.evaluate(() => (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
        anota('"Atingir" com indicador que já começa pela unidade (NPS) não repete a unidade',
          /Atingir NPS 60 em 90 dias/.test(fraseNps) && !/NPS.*NPS/.test(fraseNps), fraseNps);

        /* NPS não usa período temporal — Forma de medição "Índice" com
           Unidade "NPS" trava o campo Período em "não se aplica",
           travado (não dá para escolher "por dia"/"por mês" etc.). */
        const periodoNps = await pgDir.evaluate(() => {
          const campo = document.querySelector('[data-m="periodo"]');
          return campo ? { valor: campo.value, desabilitado: campo.disabled } : null;
        });
        anota('Índice + NPS trava o Período em "não se aplica", desabilitado',
          !!periodoNps && periodoNps.valor === 'não se aplica' && periodoNps.desabilitado === true,
          JSON.stringify(periodoNps));

        /* Aumentar/Reduzir com NPS: a frase não repete a unidade depois
           de cada número nem anexa um período incompatível — "Aumentar
           NPS... de 5 para 7 em 90 dias.", nunca "5 NPS por dia". */
        await pgDir.locator('.aposta-variante:has([data-m="direcao"]) .aposta-variante-chip', { hasText: 'Aumentar' }).click();
        await pgDir.waitForTimeout(200);
        await pgDir.fill('[data-m="atual"]', '5');
        await pgDir.fill('[data-m="meta"]', '7');
        await pgDir.waitForTimeout(300);
        const fraseNpsAumentar = await pgDir.evaluate(() => (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
        anota('"Aumentar" com NPS não gera "NPS por dia" nem repete a unidade nos números',
          /de 5 para 7 em 90 dias\./.test(fraseNpsAumentar) && !/por (dia|semana|m[êe]s|trimestre|semestre|ano)/i.test(fraseNpsAumentar) && !/5 NPS|7 NPS/.test(fraseNpsAumentar),
          fraseNpsAumentar);

        /* Trocar Forma de medição para outra coisa destrava o Período de
           novo — a trava é só enquanto Índice + NPS estiver selecionado. */
        await pgDir.selectOption('[data-m="formaMedicao"]', 'Quantidade');
        await pgDir.waitForTimeout(200);
        const periodoDepois = await pgDir.evaluate(() => (document.querySelector('[data-m="periodo"]') || {}).disabled);
        anota('trocar a Forma de medição para outra coisa destrava o Período', periodoDepois === false);

        await ctxDir.close();
      }

      /* ── 2d: a missão cadastrada no painel chega na etapa 1 ──
         Ela era gravada e não chegava a lugar nenhum: o grupo abria a
         etapa 1 pedindo a missão do zero, e quem tinha acabado de
         cadastrar uma via a pergunta de novo. */
      {
        const semeado = apostasSemeadas();
        semeado[TURMA_LIB].execucoes[EXEC].missao = {
          verbo: 'Melhorar', oQue: 'a experiência do participante',
          contexto: 'na concessão', prazo: '90', prazoUnidade: 'dias',
        };
        const { ctx: ctxM, page: pg } = await novaPagina(browser, formato, DIRETORA, erros, semeado);
        await pg.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('#apostaAbrirBtn', { timeout: 15000 });
        await pg.click('#apostaAbrirBtn');
        await pg.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg.click('.aposta-grupo-btn');
        await pg.waitForSelector('.aposta-molde', { timeout: 15000 });
        const etapa1 = await pg.evaluate(() => ({
          verbo: (document.getElementById('ap-verbo') || {}).value || '',
          oQue: (document.getElementById('ap-oQue') || {}).value || '',
          prazo: (document.getElementById('ap-prazo') || {}).value || '',
          aviso: (document.querySelector('.aposta-herdada') || {}).textContent || '',
          feita: !!document.querySelector('.aposta-trilha-item.is-feita'),
        }));
        anota('a missão cadastrada pela facilitação abre preenchida na etapa 1',
          etapa1.verbo === 'Melhorar' && /experiência do participante/.test(etapa1.oQue) && etapa1.prazo === '90',
          JSON.stringify(etapa1));
        anota('a etapa 1 diz de onde veio a missão e que dá para ajustar',
          /cadastrada pela facilitação/i.test(etapa1.aviso) && /ajustar/i.test(etapa1.aviso));
        anota('a missão herdada ainda não conta como escrita pelo grupo', !etapa1.feita);

        /* Missão-base só pré-preenche; CONTINUAR é quem confirma. Depois
           do clique, a missão do GRUPO (não mais a missão-base) é quem
           conta como etapa concluída — exatamente com o que estava na
           tela no momento do clique. */
        await pg.click('#apostaSeguir');
        await pg.waitForFunction(() =>
          /SINTOMA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const gravouMissaoGrupo = await pg.evaluate(() => (window.__ESCRITAS || [])
          .filter((x) => /\/dados\/missao$/.test(x.path)).slice(-1)[0] || null);
        const salvoGrupo = gravouMissaoGrupo && (gravouMissaoGrupo.valor !== undefined ? gravouMissaoGrupo.valor : gravouMissaoGrupo.value);
        anota('CONTINUAR confirma a missão do grupo com exatamente o que estava na tela (a missão-base herdada)',
          !!salvoGrupo && salvoGrupo.verbo === 'Melhorar' && /experiência do participante/.test(salvoGrupo.oQue) && salvoGrupo.prazo === '90',
          JSON.stringify(gravouMissaoGrupo));
        const trilhaDepois = await pg.evaluate(() => Array.from(document.querySelectorAll('.aposta-trilha-item'))
          .find((i) => /Miss[ãa]o/.test(i.textContent) && i.classList.contains('is-feita')) ? true : false);
        anota('depois de confirmar, a Missão conta como etapa concluída na trilha do grupo', trilhaDepois);

        await ctxM.close();
      }

      /* ── 2e: missão-base não sobrescreve o grupo que já escreveu a própria ──
         Mesmo que a facilitação cadastre ou troque a missão-base depois, um
         grupo que já tem conteúdo próprio na Etapa 1 continua vendo o que
         ele escreveu — nunca a missão-base por cima. */
      {
        const semeado = apostasSemeadas();
        semeado[TURMA_LIB].execucoes[EXEC].missao = {
          verbo: 'Reduzir', oQue: 'os contatos sobre status', contexto: 'na concessão', prazo: '60', prazoUnidade: 'dias',
        };
        semeado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          missao: { verbo: 'Aumentar', oQue: 'a satisfação', contexto: 'no atendimento', prazo: '120', prazoUnidade: 'dias' },
        };
        semeado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'sintoma';
        const { ctx: ctxP, page: pgP } = await novaPagina(browser, formato, DIRETORA, erros, semeado);
        await pgP.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgP.waitForSelector('#apostaAbrirBtn', { timeout: 15000 });
        await pgP.click('#apostaAbrirBtn');
        await pgP.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgP.click('.aposta-grupo-btn');
        await pgP.waitForSelector('.aposta-trilha-item', { timeout: 15000 });
        await pgP.evaluate(() => {
          const t = Array.from(document.querySelectorAll('.aposta-trilha-item')).find((i) => /Miss[ãa]o/.test(i.textContent));
          if (t) t.click();
        });
        await pgP.waitForFunction(() =>
          /^MISS[ÃA]O$/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const etapa1Grupo = await pgP.evaluate(() => ({
          verbo: (document.getElementById('ap-verbo') || {}).value || '',
          oQue: (document.getElementById('ap-oQue') || {}).value || '',
          prazo: (document.getElementById('ap-prazo') || {}).value || '',
          temHerdada: !!document.querySelector('.aposta-herdada'),
        }));
        anota('um grupo que já escreveu a própria missão continua vendo a SUA, mesmo com uma missão-base diferente cadastrada',
          etapa1Grupo.verbo === 'Aumentar' && /satisfação/.test(etapa1Grupo.oQue) && etapa1Grupo.prazo === '120' && !etapa1Grupo.temHerdada,
          JSON.stringify(etapa1Grupo));
        await ctxP.close();
      }

      /* ── 3: a diretora entra, escolhe o grupo e percorre as etapas ── */
      const { ctx, page } = await novaPagina(browser, formato, DIRETORA, erros, apostasSemeadas());
      await page.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#apostaAbrirBtn', { timeout: 15000 });

      const soLiberada = await page.evaluate(() => {
        const t = (document.getElementById('apostaEntrada').textContent || '');
        return { temLiberada: /TURMA LIBERADA/.test(t), temNaoLiberada: /TURMA SEM APOSTA/.test(t) };
      });
      anota('o convite aparece para a turma liberada', soLiberada.temLiberada);
      anota('a turma não liberada NÃO é oferecida a quem participa', !soLiberada.temNaoLiberada);

      await page.click('#apostaAbrirBtn');
      await page.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
      await page.click('.aposta-grupo-btn');
      await page.waitForSelector('.aposta-etapa-titulo', { timeout: 15000 });

      /* Trilha: nove nomes, e as etapas à frente fechadas. */
      const trilha = await page.evaluate(() => {
        const itens = Array.from(document.querySelectorAll('.aposta-trilha-item'));
        return {
          total: itens.length,
          bloqueadas: itens.filter((i) => i.disabled).length,
          nomes: itens.map((i) => (i.textContent || '').trim()).join(' | '),
        };
      });
      anota('a trilha mostra as nove etapas desde o começo', trilha.total === 9, 'vieram ' + trilha.total);
      anota('as etapas ainda não alcançadas estão fechadas', trilha.bloqueadas >= 7, trilha.bloqueadas + ' fechadas');
      /* O nome da etapa seguinte é resposta adiantada: ler "Hipótese" ou
         "Evidência" antes da hora muda o que se escreve agora. */
      anota('a trilha NÃO entrega os nomes das etapas seguintes',
        !/Sintoma|Problema|Hip[óo]tese|Experimento|Evid[êe]ncia|Decis[ãa]o/.test(trilha.nomes),
        trilha.nomes.slice(0, 90));
      anota('a etapa da vez aparece nomeada na trilha', /Miss[ãa]o/.test(trilha.nomes), trilha.nomes.slice(0, 40));

      /* ── A etapa 1 preenchida em lacunas: o fixo à vista, o que falta
            marcado no lugar exato e clicável. É a tela da queixa: "preciso
            ser guiado para ir preenchendo o que falta". ── */
      const molde = await page.evaluate(() => ({
        fixos: Array.from(document.querySelectorAll('.aposta-molde-fixo')).map((e) => e.textContent.trim()),
        /* "em" continua na FRASE ("…em 90 dias."), mas o rótulo colado à
           lacuna do prazo virou "Prazo" — "em" sozinho não dizia o que
           preencher ali. */
        rotuloPrazo: (() => {
          const campo = document.querySelector('[data-campo="prazo"]');
          const par = campo ? campo.closest('.aposta-par') : null;
          const rot = par ? par.querySelector('.aposta-campo-rot') : null;
          return rot ? rot.textContent.trim() : '';
        })(),
        lacunas: document.querySelectorAll('.aposta-molde .aposta-campo-input').length,
        previa: (document.querySelector('.aposta-frase') || {}).textContent || '',
        semQuadroAntigo: !document.querySelector('.aposta-template'),
      }));
      anota('o rótulo colado ao prazo diz "Prazo", não a palavra "em"',
        /^prazo$/i.test(molde.rotuloPrazo), 'rótulo: "' + molde.rotuloPrazo + '"');
      anota('a frase é preenchida em lacunas, não num campo único', molde.lacunas >= 4, molde.lacunas + ' lacunas');
      anota('o quadro com a frase-modelo abstrata saiu de cena', molde.semQuadroAntigo);
      anota('a prévia diz o que ainda falta, desde o início',
        /Ainda falta/.test(molde.previa) && /prazo/i.test(molde.previa), molde.previa.replace(/\s+/g, ' ').slice(0, 120));

      /* Clicar na lacuna leva ao campo dela — no celular, procurar o campo
         que falta é o que faz a pessoa desistir de completar. */
      await page.evaluate(() => {
        const l = Array.from(document.querySelectorAll('.aposta-frase-vazio'))
          .find((e) => /prazo/i.test(e.textContent));
        if (l) l.click();
      });
      await page.waitForTimeout(250);
      const focou = await page.evaluate(() => (document.activeElement || {}).id || '');
      anota('clicar na lacuna leva ao campo que falta', focou === 'ap-prazo', 'foco em "' + focou + '"');

      await page.fill('#ap-verbo', 'Melhorar');
      await page.fill('#ap-oQue', 'a experiência do participante');
      await page.fill('#ap-contexto', 'durante a concessão');

      /* PRAZO: a pessoa escreve só o número e escolhe a unidade. Digitar
         "90 dias" no campo do número não pode virar dado — o mapa saía
         com "90 dias dias", e cada grupo escrevia a unidade de um jeito. */
      await page.fill('#ap-prazo', '90 dias');
      await page.waitForTimeout(250);
      const soNumero = await page.evaluate(() => (document.getElementById('ap-prazo') || {}).value || '');
      anota('no prazo, o campo do número aceita só número', soNumero === '90', 'ficou "' + soNumero + '"');
      const temUnidades = await page.evaluate(() => {
        const sel = document.querySelector('[data-campo="prazoUnidade"]');
        return sel ? Array.from(sel.options).map((o) => o.value).join(',') : '';
      });
      anota('a unidade do prazo é escolhida numa lista (de segundos a anos)',
        /segundos/.test(temUnidades) && /meses/.test(temUnidades) && /trimestres/.test(temUnidades) && /anos/.test(temUnidades),
        temUnidades);
      await page.selectOption('[data-campo="prazoUnidade"]', 'meses');
      await page.fill('#ap-prazo', '1');
      await page.waitForTimeout(300);
      const singular = await page.evaluate(() =>
        ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
      anota('a unidade concorda com o número (1 vira singular)',
        /em 1 mês/.test(singular) && !/1 meses/.test(singular), singular.slice(0, 140));
      await page.fill('#ap-prazo', '90');
      await page.selectOption('[data-campo="prazoUnidade"]', 'dias');
      await page.waitForTimeout(300);
      const completa = await page.evaluate(() =>
        ((document.querySelector('.aposta-frase') || {}).textContent || '').replace(/\s+/g, ' '));
      anota('com tudo preenchido, a prévia mostra a frase inteira e diz que está completa',
        /Melhorar a experiência do participante durante a concessão em 90 dias/.test(completa) &&
        /completa/i.test(completa) && !/Ainda falta/.test(completa), completa.slice(0, 140));

      /* Percorre as nove etapas preenchendo um campo em cada. */
      const vazados = [];
      for (let i = 0; i < 9; i++) {
        const txt = await textoDaTela(page);
        if (SEGREDO.test(txt)) vazados.push((txt.match(SEGREDO) || [''])[0] + ' na etapa ' + (i + 1));

        if (i === 1) {
          /* Sintoma: texto de apoio, dica do "?" (com exemplos) e a
             orientação curta abaixo do card — só texto, sem mudar
             estrutura nem permitir mais de um sintoma. */
          const textosSintoma = await page.evaluate(() => ({
            auxiliar: (document.querySelector('.aposta-auxiliar') || {}).textContent || '',
            dica: (document.querySelector('.aposta-ajuda') || {}).title || '',
            rodape: (document.querySelector('.aposta-rodape') || {}).textContent || '',
            umSoCampo: document.querySelectorAll('.aposta-campos .aposta-campo-input').length === 1,
            semOutroSintoma: !Array.from(document.querySelectorAll('button')).some((b) => /outro sintoma/i.test(b.textContent)),
          }));
          anota('o texto de apoio do Sintoma fala em fato/sinal/comportamento observável, sem causa nem solução',
            /fato, sinal ou comportamento/i.test(textosSintoma.auxiliar) && /Ainda não tente explicar a causa/i.test(textosSintoma.auxiliar),
            textosSintoma.auxiliar);
          anota('a dica do "?" explica sintoma com bom e mau exemplo',
            /sinal observ[áa]vel/i.test(textosSintoma.dica) && /Bom exemplo/i.test(textosSintoma.dica) && /não é um bom sintoma/i.test(textosSintoma.dica),
            textosSintoma.dica.slice(0, 160));
          anota('a orientação curta abaixo do card diferencia sintoma de problema',
            /Sintoma mostra o que vemos/i.test(textosSintoma.rodape), textosSintoma.rodape);
          anota('continua um único sintoma principal, sem botão "Outro sintoma"',
            textosSintoma.umSoCampo && textosSintoma.semOutroSintoma);

          /* Escreve uma causa de propósito e confere que o aviso aparece —
             e que ainda assim dá para seguir. */
          await page.locator('.aposta-campo-input').first().fill('muita gente liga porque não sabe o status');
          await page.click('#apostaSeguir');
          await page.waitForTimeout(400);
          const avisou = await page.evaluate(() =>
            /apenas o que é observado/i.test((document.querySelector('#apostaAvisos') || {}).textContent || ''));
          anota('o sintoma com explicação de causa recebe aviso didático', avisou);
          await page.click('#apostaSeguir');   /* não bloqueia: segue no 2º clique */
          await page.waitForFunction(() =>
            /PROBLEMA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
            { timeout: 15000 });
          anota('o aviso não bloqueia: dá para seguir assim mesmo', true);
          const conexao = await page.evaluate(() => {
            const c = document.querySelector('.aposta-conexao');
            return c ? c.textContent : '';
          });
          anota('a etapa seguinte mostra a anterior no card de conexão',
            /não sabe o status/.test(conexao), conexao.slice(0, 80));

          const nomesAgora = await page.evaluate(() => Array.from(
            document.querySelectorAll('.aposta-trilha-item')).map((i) => i.textContent.trim()).join(' | '));
          anota('o nome da etapa aparece na trilha quando chega a vez dela',
            /Sintoma/.test(nomesAgora) && /Problema/.test(nomesAgora), nomesAgora.slice(0, 80));
          anota('a trilha continua sem entregar as etapas mais à frente',
            !/Hip[óo]tese|Evid[êe]ncia|Decis[ãa]o/.test(nomesAgora), nomesAgora.slice(0, 90));

          /* A frase montada ao vivo, na etapa do Problema: os campos são
             pedaços, e sem ver o resultado a pessoa escreve a frase inteira
             no primeiro campo — foi o que aconteceu no primeiro uso real.
             O template agora é só [quem é afetado] + [situação
             indesejada]: sem "evidenciado por" e sem pedir concordância de
             verbo à parte, porque o texto livre já inclui o verbo. */
          await page.locator('[data-campo="quem"]').fill('O participante');
          await page.locator('[data-campo="situacaoIndesejada"]').fill('não consegue acompanhar com clareza o andamento');
          await page.waitForTimeout(300);
          const previa = await page.evaluate(() => {
            const el = document.getElementById('apostaFrase');
            return el && !el.hidden ? (el.textContent || '').replace(/\s+/g, ' ') : '';
          });
          anota('a etapa monta a frase ao vivo, como vai sair no mapa',
            /Fica assim no mapa/i.test(previa) &&
            /O participante não consegue acompanhar com clareza o andamento/i.test(previa),
            previa.slice(0, 120));

          const semCamposAntigos = await page.evaluate(() =>
            !document.querySelector('[data-campo="evidenciadoPor"]') && !document.querySelector('[data-campo="naoConsegue"]') &&
            !document.querySelector('[data-campo="verbo"]'));
          anota('"evidenciado por" e a concordância do verbo saíram da tela do Problema', semCamposAntigos);

          /* Tooltip por campo: a dica de "quem é afetado" e "situação
             indesejada" fica num title, além do "?" geral da etapa. */
          const dicasProblema = await page.evaluate(() => ({
            quem: ((document.querySelector('[data-campo="quem"]').closest('.aposta-campo') || {}).querySelector('.aposta-campo-rot') || {}).title || '',
            situacao: ((document.querySelector('[data-campo="situacaoIndesejada"]').closest('.aposta-campo') || {}).querySelector('.aposta-campo-rot') || {}).title || '',
          }));
          anota('"quem é afetado" e "situação indesejada" têm tooltip próprio',
            /vive diretamente/i.test(dicasProblema.quem) && /não explique ainda a causa/i.test(dicasProblema.situacao),
            JSON.stringify(dicasProblema));
          continue;
        }

        if (i === 3) {
          /* Mudanças mensuráveis: a primeira já aparece em branco. Antes,
             uma etapa sem nenhuma mudança mostrava só "+ OUTRA mudança
             mensurável" — outra que quê? — e era preciso descobrir o
             botão para começar. */
          const inicio = await page.evaluate(() => ({
            blocos: document.querySelectorAll('.aposta-mudanca').length,
            temRemover: !!document.querySelector('.aposta-mudanca-del'),
            feita: !!document.querySelector('.aposta-trilha-item.is-atual.is-feita'),
          }));
          anota('a primeira mudança mensurável já está na tela, sem precisar de botão',
            inicio.blocos === 1, inicio.blocos + ' blocos');
          anota('a mudança em branco não conta como etapa preenchida', !inicio.feita);
          anota('com uma só, não aparece "Remover"', !inicio.temRemover);
          await page.locator('.aposta-variante:has([data-m="direcao"]) .aposta-variante-chip', { hasText: 'Reduzir' }).click();
          await page.fill('[data-m="indicador"]', 'contatos sobre andamento');
          await page.fill('[data-m="atual"]', '1000');
          await page.fill('[data-m="meta"]', '700');
          /* "Prazo" sozinho não dizia se era o prazo da meta, do
             experimento ou da próxima ação — os quatro tempos da
             dinâmica nunca podem se confundir. */
          const rotuloPrazoMudanca = await page.evaluate(() => {
            const campo = document.querySelector('[data-m="prazo"]');
            const rot = campo ? campo.closest('.aposta-campo').querySelector('.aposta-campo-rot') : null;
            return { texto: rot ? rot.textContent.trim() : '', title: rot ? rot.title : '' };
          });
          anota('o prazo de Mudanças mensuráveis diz "Prazo para atingir o resultado", não só "Prazo"',
            rotuloPrazoMudanca.texto === 'Prazo para atingir o resultado' && /Até quando queremos alcançar esta mudança/i.test(rotuloPrazoMudanca.title),
            JSON.stringify(rotuloPrazoMudanca));
          await page.fill('[data-m="prazo"]', '90');
          await page.selectOption('[data-m="prazoUnidade"]', 'dias');
          await page.waitForTimeout(300);

          /* Unidade nasce vazia de verdade (nenhuma Forma de medição
             escolhida ainda) — não força a primeira opção. */
          const unidadeInicial = await page.evaluate(() => (document.querySelector('[data-m="unidade"]') || {}).value || '');
          anota('a Unidade nasce vazia de verdade (não força a primeira opção)', unidadeInicial === '', 'ficou "' + unidadeInicial + '"');

          /* Forma de medição decide as sugestões de Unidade — Quantidade
             sugere substantivos de contagem, não os "por X" de Período. */
          await page.selectOption('[data-m="formaMedicao"]', 'Quantidade');
          await page.waitForTimeout(200);
          await page.locator('.aposta-variante:has([data-m="unidade"]) .aposta-variante-chip', { hasText: 'contatos' }).click();
          await page.waitForTimeout(200);
          const unidadeChip = await page.evaluate(() => (document.querySelector('[data-m="unidade"]') || {}).value || '');
          anota('um clique no chip preenche a Unidade com a sugestão de Quantidade', unidadeChip === 'contatos', 'ficou "' + unidadeChip + '"');

          /* Período é campo separado — "por mês" não mora mais dentro de
             Unidade (relatado no uso real: os dois se confundiam). */
          await page.locator('.aposta-variante:has([data-m="periodo"]) .aposta-variante-chip', { hasText: 'por mês' }).click();
          await page.waitForTimeout(200);
          const periodoChip = await page.evaluate(() => (document.querySelector('[data-m="periodo"]') || {}).value || '');
          anota('um clique no chip preenche o Período, separado da Unidade', periodoChip === 'por mês', 'ficou "' + periodoChip + '"');

          const frase = await page.evaluate(() =>
            (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
          anota('a frase consolidada repete unidade e período na situação atual E na meta, para não parecer que são só da meta',
            /de 1000 contatos por mês para 700 contatos por mês em 90 dias/.test(frase), frase);

          /* Alerta de consistência: Reduzir pede meta MENOR que a situação
             atual — 1500 > 1000 é o caso contrário, e o alerta aparece
             perto do campo, com um jeito de corrigir num clique só. */
          await page.fill('[data-m="meta"]', '1500');
          await page.waitForTimeout(300);
          const comInconsistencia = await page.evaluate(() => ({
            visivel: !!document.querySelector('.aposta-mudanca-alerta'),
            texto: (document.querySelector('.aposta-mudanca-alerta') || {}).textContent || '',
          }));
          anota('a meta menor esperada mas maior digitada mostra um alerta perto do campo',
            comInconsistencia.visivel && /maior que a situação atual/.test(comInconsistencia.texto) &&
            /Aumentar/.test(comInconsistencia.texto), comInconsistencia.texto);

          /* A frase reage na hora enquanto a pessoa ainda está digitando
             (não trava a experimentação), mas depois de uma pausa sem
             digitar (>500ms) troca pela mensagem de "corrija" — nunca
             mostra uma frase com direção e números se contradizendo. */
          await page.waitForTimeout(600);
          const fraseInconsistente = await page.evaluate(() => (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
          anota('depois de uma pausa, a inconsistência esconde a frase e mostra o convite a corrigir, em vez de "Reduzir... de 1000 para 1500"',
            /Corrija a inconsistência acima para visualizar a mudança mensurável/.test(fraseInconsistente), fraseInconsistente);

          /* Diferente do alerta acima (um convite, com botão de corrigir):
             clicar CONTINUAR com a direção contradizendo os números é
             bloqueado de verdade, sem escape por segundo clique — "Reduzir"
             exige meta MENOR que a situação atual. */
          /* Ajuste de usabilidade (item 6): um bloqueio de verdade agora
             deixa o botão genuinely disabled — clicar nele (ou tentar)
             não faz nada, porque o navegador nem dispara o evento. A
             orientação já está visível ao vivo na própria frase (teste
             acima), sem precisar do clique para aparecer. */
          const tituloAntesBloqueio = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
          const desabilitadoAntes = await page.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
          anota('"Reduzir" com meta maior que a situação atual desabilita CONTINUAR de verdade',
            desabilitadoAntes === true, String(desabilitadoAntes));
          await page.evaluate(() => document.getElementById('apostaSeguir').click());
          await page.waitForTimeout(300);
          const aindaBloqueado = await page.evaluate(() => ({
            titulo: (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '',
            desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
          }));
          anota('o bloqueio de coerência não tem escape nenhum — clicar no botão desabilitado não muda nada',
            aindaBloqueado.titulo === tituloAntesBloqueio && aindaBloqueado.desabilitado === true, JSON.stringify(aindaBloqueado));

          await page.click('.aposta-mudanca-alerta [data-corrigir]');
          await page.waitForTimeout(300);
          const corrigido = await page.evaluate(() => ({
            direcao: (document.querySelector('[data-m="direcao"]') || {}).value || '',
            alertaSumiu: !document.querySelector('.aposta-mudanca-alerta'),
            frase: (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '',
          }));
          anota('um clique no alerta corrige a direção e o alerta some', corrigido.direcao === 'Aumentar' && corrigido.alertaSumiu,
            JSON.stringify(corrigido));
          anota('corrigida a inconsistência, a frase volta na hora, sem esperar a pausa',
            /Aumentar/.test(corrigido.frase) && /1500/.test(corrigido.frase), corrigido.frase);
          /* Devolve ao estado consistente para o resto do teste. */
          await page.locator('.aposta-variante:has([data-m="direcao"]) .aposta-variante-chip', { hasText: 'Reduzir' }).click();
          await page.fill('[data-m="meta"]', '700');
          await page.waitForTimeout(300);

          /* Percentual não pede escolha de unidade: preenche "%" sozinho,
             e ele gruda nos dois números da frase ("de 1000% para 700%"),
             diferente de contatos/dias, que só aparecem uma vez. Um
             indicador percentual normalmente não tem período de medição
             (ver seção 10 do pedido) — "não se aplica" limpa o "por mês"
             deixado pelo passo anterior, senão ele grudaria nos dois "%"
             também (unidade e período qualificam os dois números por
             igual, percentual incluído). */
          await page.selectOption('[data-m="formaMedicao"]', 'Percentual');
          await page.waitForTimeout(300);
          await page.locator('.aposta-variante:has([data-m="periodo"]) .aposta-variante-chip', { hasText: 'não se aplica' }).click();
          await page.waitForTimeout(200);
          const unidadePercentual = await page.evaluate(() => (document.querySelector('[data-m="unidade"]') || {}).value || '');
          anota('Percentual preenche a Unidade com "%" sozinho, sem exigir escolha', unidadePercentual === '%', 'ficou "' + unidadePercentual + '"');
          const frasePercentual = await page.evaluate(() =>
            (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
          anota('em Percentual, o "%" gruda nos dois números, sem espaço',
            /de 1000% para 700%/.test(frasePercentual), frasePercentual);

          /* "Queremos" também não pode travar em só duas direções. */
          await page.fill('[data-m="direcao"]', 'Manter estável');
          await page.waitForTimeout(300);
          const fraseLivre = await page.evaluate(() =>
            (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
          anota('"Queremos" aceita uma direção que não é Aumentar nem Reduzir',
            /Manter estável/.test(fraseLivre), fraseLivre);
        } else {
          if (i === 4) {
            /* HIPÓTESE: o Problema aparece só leitura acima; o molde virou
               duas frases separadas — a explicação de um lado, o sinal
               que motivou ela do outro. "pois" saiu porque o sinal NÃO é
               prova da hipótese, só o motivo de cogitá-la. */
            const hipoteseUi = await page.evaluate(() => {
              const conexao = document.querySelector('.aposta-conexao');
              const fixos = Array.from(document.querySelectorAll('.aposta-molde-fixo')).map((e) => e.textContent.trim());
              return {
                conexaoRot: conexao ? (conexao.querySelector('.aposta-conexao-rot') || {}).textContent || '' : '',
                conexaoTxt: conexao ? conexao.textContent || '' : '',
                temPois: fixos.some((t) => /^pois$/i.test(t)),
                temNovaFrase: fixos.some((t) => /Essa hip[óo]tese surgiu porque observamos que/i.test(t)),
              };
            });
            anota('o Problema aparece só leitura acima da Hipótese',
              /Problema/i.test(hipoteseUi.conexaoRot) && /n[ãa]o consegue/i.test(hipoteseUi.conexaoTxt),
              hipoteseUi.conexaoTxt.slice(0, 120));
            anota('"pois" saiu do molde — o sinal vira uma frase própria, não é prova da hipótese',
              !hipoteseUi.temPois && hipoteseUi.temNovaFrase, JSON.stringify(hipoteseUi));

            const dicasHipotese = await page.evaluate(() => {
              const fixos = Array.from(document.querySelectorAll('.aposta-molde-fixo'));
              const porque = fixos.find((e) => /Acreditamos que isso acontece porque/i.test(e.textContent));
              const surgiu = fixos.find((e) => /Essa hip[óo]tese surgiu porque observamos que/i.test(e.textContent));
              return { causa: porque ? porque.title : '', indicio: surgiu ? surgiu.title : '' };
            });
            anota('os campos "hipótese causal" e "sinal que motivou a hipótese" têm tooltip próprio',
              /ainda precisa ser testada/i.test(dicasHipotese.causa) && /n[ãa]o significa que a hip[óo]tese esteja comprovada/i.test(dicasHipotese.indicio),
              JSON.stringify(dicasHipotese));

            /* Sem os dois campos preenchidos, "Fica assim no mapa" não
               mostra a frase com lacunas por dentro (nada de "a causa
               percebida" como se fosse texto de verdade) — só a
               orientação do que falta, e CONTINUAR fica bloqueado. */
            const hipoteseVazia = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('Hipótese incompleta não mostra a frase com lacunas — só a orientação do que falta',
              /Preencha a causa percebida e o que foi observado/i.test(hipoteseVazia) &&
              !/Acreditamos que isso acontece porque/i.test(hipoteseVazia),
              hipoteseVazia.slice(0, 160));
            const tituloAntesHipotese = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            await clicarSemRolagem(page, '#apostaSeguir');
            await page.waitForTimeout(300);
            const tituloDepoisHipoteseVazia = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            anota('Hipótese incompleta bloqueia CONTINUAR', tituloDepoisHipoteseVazia === tituloAntesHipotese);

            await page.fill('[data-campo="causa"]', 'as informações não são claras');
            await page.waitForTimeout(250);
            const hipoteseParcial = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('com só um dos dois campos, ainda pede o que falta (não mostra a frase pela metade)',
              /Preencha a causa percebida e o que foi observado/i.test(hipoteseParcial), hipoteseParcial.slice(0, 160));

            await page.fill('[data-campo="indicio"]', 'muitos participantes entram em contato para saber do andamento do processo de concessão do benefício');
            await page.waitForTimeout(250);
            const hipoteseCompleta = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('com os dois campos preenchidos, mostra a frase completa e "está completa"',
              /Acreditamos que isso acontece porque as informações não são claras\. Essa hip[óo]tese surgiu porque observamos que muitos participantes/i.test(hipoteseCompleta) &&
              /A frase desta etapa está completa/i.test(hipoteseCompleta),
              hipoteseCompleta.slice(0, 260));
          }
          if (i === 5) {
            /* IDEIA DE SOLUÇÃO: "Resultados que queremos produzir" lembra
               qual mudança mensurável a ideia deve produzir, antes de
               pensar na solução — lista somente-leitura, entre a
               Hipótese e o título da etapa. */
            const resultados = await page.evaluate(() => {
              const bloco = document.querySelector('.aposta-resultados-observar');
              if (!bloco) return null;
              return {
                rot: (bloco.querySelector('.aposta-frase-rot') || {}).textContent || '',
                itens: Array.from(bloco.querySelectorAll('li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
              };
            });
            anota('"Resultados que queremos produzir" aparece com a mudança mensurável já cadastrada',
              !!resultados && /Resultados que queremos produzir/i.test(resultados.rot) &&
              resultados.itens.some((t) => /contatos sobre andamento/.test(t)),
              JSON.stringify(resultados));

            /* Tooltip em "Poderíamos" e "para" — a dica fica no texto
               fixo da frase, que é quem serve de rótulo visível aqui. */
            const dicasIdeia = await page.evaluate(() => {
              const fixos = Array.from(document.querySelectorAll('.aposta-molde-fixo'));
              const poderiamos = fixos.find((e) => /poder[íi]amos/i.test(e.textContent));
              const para = fixos.find((e) => e.textContent.trim().toLowerCase() === 'para');
              return { poderiamos: poderiamos ? poderiamos.title : '', para: para ? para.title : '' };
            });
            anota('os campos "Poderíamos" e "para" têm tooltip próprio',
              /poss[íi]vel interven[çc][ãa]o/i.test(dicasIdeia.poderiamos) && /efeito esperamos/i.test(dicasIdeia.para),
              JSON.stringify(dicasIdeia));

            /* Mesma regra da Hipótese: sem os dois campos, nada de
               "Poderíamos [a ação] para que [o efeito]" com lacunas —
               só a orientação, e CONTINUAR bloqueado. */
            const ideiaVazia = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('Ideia de solução incompleta não mostra a frase com lacunas — só a orientação do que falta',
              ideiaVazia === 'Fica assim no mapaPreencha o que poderíamos fazer e para quê, para visualizar a ideia de solução.',
              ideiaVazia.slice(0, 160));
            const tituloAntesIdeia = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            await clicarSemRolagem(page, '#apostaSeguir');
            await page.waitForTimeout(300);
            const tituloDepoisIdeiaVazia = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            anota('Ideia de solução incompleta bloqueia CONTINUAR', tituloDepoisIdeiaVazia === tituloAntesIdeia);

            await page.fill('[data-campo="acao"]', 'dar ao participante visibilidade sobre o andamento do processo de concessão do benefício');
            await page.fill('[data-campo="mudanca"]', 'o participante consiga ter autonomia');
            await page.waitForTimeout(250);
            const ideiaCompleta = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('com os dois campos preenchidos, mostra a frase completa e "está completa"',
              /Poder[íi]amos dar ao participante visibilidade sobre o andamento do processo de concessão do benef[íi]cio para o participante consiga ter autonomia/i.test(ideiaCompleta) &&
              /A frase desta etapa está completa/i.test(ideiaCompleta),
              ideiaCompleta.slice(0, 260));

            /* "para" já é fixo no molde ("Poderíamos [ação] para [efeito]")
               — se a pessoa também começar o campo por "para" ou "para
               que", a frase não pode sair "...para para que...". */
            await page.fill('[data-campo="mudanca"]', 'para que o participante consiga ter autonomia');
            await page.waitForTimeout(250);
            const semParaPara = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('digitar "para que..." no efeito pretendido não duplica "para" na frase montada',
              /para que o participante consiga ter autonomia/i.test(semParaPara) && !/para para/i.test(semParaPara),
              semParaPara.slice(0, 260));

            await page.fill('[data-campo="mudanca"]', 'o participante consiga ter autonomia');
            await page.waitForTimeout(250);

            /* ── digitar e seguir DENTRO dos 600ms não pode apagar a etapa ──
               O salvamento automático espera 600ms. Enquanto ele relia a tela
               na hora de gravar, quem clicava em Continuar antes disso via a
               etapa recém-preenchida ser sobrescrita pelos campos vazios da
               etapa seguinte — e o mapa a mostrava como "ainda não
               preenchido". Relatado no primeiro uso real.

               Fase 4 — relocado para ANTES da Decisão de propósito: depois
               dela o ciclo fica concluído, e voltar a editar uma etapa já
               respondida passa a pedir confirmação para abrir um ciclo novo
               (ver PROTEÇÃO CONTRA EDITAR CICLO FINALIZADO) — o cenário
               original ("voltar pela trilha para uma etapa já respondida e
               editar de novo, no MESMO ciclo") só existe de verdade antes da
               Decisão. A corrida testada é a mesma, só o ponto de execução
               mudou. */
            await page.fill('[data-campo="acao"]', 'texto que não pode sumir');
            /* Sem esperar o debounce: é essa pressa que reproduzia o defeito. */
            await clicarSemRolagem(page, '#apostaSeguir');
            await page.waitForTimeout(1400);   /* tempo de o temporizador antigo disparar */
            await page.evaluate(() => {
              const t = Array.from(document.querySelectorAll('.aposta-trilha-item'))
                .find((i) => /Ideia de solução/.test(i.textContent));
              if (t && !t.disabled) t.click();
            });
            await page.waitForFunction(() =>
              /IDEIA DE SOLU/i.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
              { timeout: 15000 });
            const sobreviveu = await page.evaluate(() => (document.querySelector('[data-campo="acao"]') || {}).value || '');
            anota('seguir antes do salvamento automático NÃO apaga a etapa',
              /texto que não pode sumir/.test(sobreviveu), 'campo voltou como "' + sobreviveu + '"');
            /* Deixa a etapa completa de novo, exatamente como estava antes
               deste desvio — o resto do percurso (Experimento em diante)
               não pode herdar "texto que não pode sumir" no lugar da ação
               de verdade. */
            await page.fill('[data-campo="acao"]', 'dar ao participante visibilidade sobre o andamento do processo de concessão do benefício');
            await page.waitForTimeout(250);
          }
          if (i === 6) {
            /* EXPERIMENTO: sem duração, quantidade, com quem e o que
               será feito, nada de "Durante [quanto tempo], com
               [quantas pessoas] [com quem], vamos [o que será feito]."
               com lacunas por dentro — só a orientação do que falta
               (dinâmica: lista só o que realmente falta), e CONTINUAR
               bloqueado. */
            const experimentoVazio = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('Experimento incompleto não mostra a frase com lacunas — só a orientação do que falta',
              /^Complete quanto tempo, quantas pessoas, com quem, o que será feito/i.test(experimentoVazio.replace('Fica assim no mapa', '').trim()) &&
              !/Durante/i.test(experimentoVazio),
              experimentoVazio.slice(0, 200));

            /* "com" continua na FRASE ("…com 50 pessoas…"), mas o rótulo
               colado à lacuna da quantidade virou "Quantas pessoas" —
               mesmo caso do "em"/"Prazo" da Missão: "com" sozinho não
               dizia o que preencher ali. */
            const rotuloQuantidade = await page.evaluate(() => {
              const campo = document.querySelector('[data-campo="quantidade"]');
              const par = campo ? campo.closest('.aposta-par') : null;
              const rot = par ? par.querySelector('.aposta-campo-rot') : null;
              return rot ? rot.textContent.trim() : '';
            });
            anota('o rótulo colado à quantidade diz "Quantas pessoas", não a palavra "com"',
              /^quantas pessoas$/i.test(rotuloQuantidade), 'rótulo: "' + rotuloQuantidade + '"');

            /* Mesma ideia para "Durante" — o rótulo colado deixa explícito
               que esse prazo é só desta execução do teste, não o prazo da
               meta (Mudanças mensuráveis) nem o da próxima ação (Decisão). */
            const rotuloDuracao = await page.evaluate(() => {
              const campo = document.querySelector('[data-campo="duracao"]');
              const par = campo ? campo.closest('.aposta-par') : null;
              const rot = par ? par.querySelector('.aposta-campo-rot') : null;
              return { texto: rot ? rot.textContent.trim() : '', title: rot ? rot.title : '' };
            });
            anota('o rótulo colado à duração diz "Duração do experimento", com dica de "por quanto tempo"',
              rotuloDuracao.texto === 'Duração do experimento' && /Por quanto tempo este teste será executado/i.test(rotuloDuracao.title),
              JSON.stringify(rotuloDuracao));

            const tituloAntesExperimento = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            await clicarSemRolagem(page, '#apostaSeguir');
            await page.waitForTimeout(300);
            const tituloDepoisExperimentoVazio = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            anota('Experimento incompleto bloqueia CONTINUAR', tituloDepoisExperimentoVazio === tituloAntesExperimento);

            await page.fill('[data-campo="duracao"]', '3');
            await page.selectOption('[data-campo="duracaoUnidade"]', 'semanas');
            await page.fill('[data-campo="quantidade"]', '50');
            await page.fill('[data-campo="comQuem"]', 'participantes em concessão');
            await page.fill('[data-campo="oQue"]', 'enviar manualmente mensagens de status');
            await page.waitForTimeout(300);
            const experimentoCompleto = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('com os campos obrigatórios preenchidos, mostra a frase completa e "está completa"',
              /Durante 3 semanas, com 50 participantes em concess[ãa]o, vamos enviar manualmente mensagens de status\./i.test(experimentoCompleto) &&
              /A frase desta etapa está completa/i.test(experimentoCompleto),
              experimentoCompleto.slice(0, 300));
            /* O clique em CONTINUAR (linha 1158) deixou o aviso amarelo
               "Complete o que será feito..." na tela — preencher os
               campos, sem clicar de novo, precisa apagar esse aviso
               sozinho: senão "a frase está completa" e "complete o que
               será feito" ficam lado a lado, o estado contraditório
               relatado no pedido de ajuste. */
            const avisoDepoisDeCompletar = await page.evaluate(() =>
              ((document.getElementById('apostaAvisos') || {}).textContent || '').trim());
            anota('preencher os campos apaga sozinho o aviso "Complete o que será feito" (sem precisar clicar de novo)',
              avisoDepoisDeCompletar === '', 'aviso ficou: "' + avisoDepoisDeCompletar + '"');

            /* EXPERIMENTO: custo com máscara de moeda. */
            await page.fill('[data-campo="custo"]', '250000');
            await page.waitForTimeout(250);
            const custo = await page.evaluate(() => (document.querySelector('[data-campo="custo"]') || {}).value || '');
            anota('o custo estimado sai formatado como moeda', /^R\$\s?2\.500,00$/.test(custo), 'ficou "' + custo + '"');

            /* "O que vamos observar?" — só existe UMA mudança mensurável
               até aqui no percurso, então ela já vem marcada e travada
               (não é uma escolha real quando só há uma opção). */
            const observar = await page.evaluate(() => {
              const caixa = document.querySelector('.aposta-resultado-item input[type="checkbox"]');
              return caixa ? { marcada: caixa.checked, travada: caixa.disabled } : null;
            });
            anota('com uma só mudança mensurável, "o que vamos observar" já vem marcado e travado',
              !!observar && observar.marcada && observar.travada, JSON.stringify(observar));

            /* A frase "Fica assim no mapa" descreve só o desenho do
               teste; os resultados escolhidos vêm numa lista à parte,
               não emendados na frase. */
            const listaResultados = await page.evaluate(() => {
              const bloco = document.querySelector('.aposta-resultados-observar');
              return {
                existe: !!bloco,
                naoEstaNaFrase: !/e observar/i.test((document.querySelector('#apostaFrase p') || {}).textContent || ''),
                itens: bloco ? bloco.querySelectorAll('li').length : 0,
              };
            });
            anota('"Resultados que vamos observar" aparece como lista à parte, fora da frase principal',
              listaResultados.existe && listaResultados.naoEstaNaFrase && listaResultados.itens === 1,
              JSON.stringify(listaResultados));
          }
          if (i === 7) {
            /* EVIDÊNCIA: o card vem pronto com o que a única mudança
               mensurável do grupo já tinha — nada disso é digitável aqui,
               só o resultado observado e a fonte (o resto da cobertura,
               com números de verdade e o "% do caminho até a meta", está
               nos blocos dedicados mais abaixo). */
            const card = await page.evaluate(() => {
              const bloco = document.querySelector('.aposta-mudanca[data-resultado]');
              if (!bloco) return null;
              const campos = Array.from(bloco.querySelectorAll('.aposta-campo-input[disabled]')).map((e) => e.value);
              return { titulo: (bloco.querySelector('strong') || {}).textContent || '', campos: campos };
            });
            anota('o card de evidência já chega com indicador, situação inicial e meta — nada redigitado',
              !!card && /andamento/.test(card.titulo) && card.campos.some((v) => /1000/.test(v)) && card.campos.some((v) => /700/.test(v)),
              JSON.stringify(card));

            /* Em planejamento (antes de registrar qualquer resultado), a
               classificação da hipótese ainda não faz sentido — só
               aparece depois, no modo de registro (ver mais abaixo). */
            const semClassificacaoAinda = await page.evaluate(() =>
              !document.querySelector('#apostaClassificacaoHipotese'));
            anota('em planejamento, "Nossa hipótese foi" ainda não aparece — só depois de registrar resultados',
              semClassificacaoAinda);

            /* Melhoria de usabilidade: a etapa Evidência inteira alterna
               entre dois modos (Planejamento e Registro dos Resultados)
               — nunca card a card. Sem fonte prevista ainda, o card não
               mostra nenhum campo de resultado observado, e o botão
               principal diz "Salvar plano para execução". */
            const antesDePreencher = await page.evaluate(() => {
              const bloco = document.querySelector('.aposta-mudanca[data-resultado]');
              const banner = document.querySelector('.aposta-campos .aposta-herdada');
              return {
                temCampoObservado: !!(bloco && bloco.querySelector('[data-e="observado"]')),
                aguardandoTxt: bloco ? bloco.textContent : '',
                bannerTxt: banner ? banner.textContent : '',
                botaoTxt: (document.getElementById('apostaSeguir') || {}).textContent || '',
              };
            });
            anota('em planejamento, o card não tem campo de resultado observado — só o texto "aguardando execução"',
              !antesDePreencher.temCampoObservado && /aguardando execu[çc][ãa]o/i.test(antesDePreencher.aguardandoTxt),
              JSON.stringify(antesDePreencher));
            anota('o banner da etapa diz "PLANEJAMENTO DA EVIDÊNCIA" e o botão principal diz "Salvar plano para execução"',
              /PLANEJAMENTO DA EVID[ÊE]NCIA/.test(antesDePreencher.bannerTxt) && /Salvar plano para execu[çc][ãa]o/i.test(antesDePreencher.botaoTxt),
              JSON.stringify(antesDePreencher));

            /* Item 6 do ajuste de usabilidade: sem Fonte prevista, o
               botão nasce genuinely disabled — nem chega a haver clique
               que dispare aviso, porque o navegador suprime o evento. A
               orientação já mora no texto "aguardando execução" de cada
               card, sempre visível. */
            const tituloAntesEvVazia = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            const desabilitadoPlanoIncompleto = await page.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
            anota('sem Fonte prevista, "Salvar plano para execução" nasce desabilitado de verdade',
              desabilitadoPlanoIncompleto === true, String(desabilitadoPlanoIncompleto));
            await clicarSemRolagem(page, '#apostaSeguir');
            await page.waitForTimeout(300);
            const tituloDepoisEvVazia = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            anota('Continuar bloqueia de verdade até o Plano de Evidência estar completo',
              tituloDepoisEvVazia === tituloAntesEvVazia);

            await page.selectOption('[data-e="fontePrevista"]', 'Dados do sistema');
            await page.waitForTimeout(300);
            const botaoPronto = await page.evaluate(() => ({
              texto: (document.getElementById('apostaSeguir') || {}).textContent || '',
              desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
            }));
            anota('plano completo: o botão principal muda para "Registrar resultados do experimento" e fica habilitado',
              /Registrar resultados do experimento/i.test(botaoPronto.texto) && botaoPronto.desabilitado === false,
              JSON.stringify(botaoPronto));
            const prontoBloco = await page.evaluate(() => (document.body.textContent || '').includes('Plano de evidência salvo'));
            anota('com o plano completo, aparece o bloco de confirmação com a opção de encerrar por agora', prontoBloco);

            await clicarSemRolagem(page, '#apostaSeguir');
            await page.waitForSelector('.aposta-confirmar-overlay .modal-box', { timeout: 5000 });
            /* Item 4 do ajuste de fluxo: a confirmação não é mais o
               window.confirm() nativo (aceito globalmente via
               page.on('dialog',...) no topo do arquivo), e sim um modal
               próprio do site — precisa do clique explícito no botão
               "SIM, REGISTRAR RESULTADOS". .modal-box é classe genérica
               (também usada pelo #authModal escondido em index.html), por
               isso o seletor é escopado por .aposta-confirmar-overlay. */
            const modalTxt = await page.evaluate(() => (document.querySelector('.aposta-confirmar-overlay .modal-box') || {}).textContent || '');
            anota('o clique com o plano completo abre o modal próprio perguntando se o experimento já foi executado',
              /experimento já foi executado/i.test(modalTxt), modalTxt);
            await clicarSemRolagem(page, '.aposta-modal-sim-btn');
            await page.waitForTimeout(300);
            const modoRegistro = await page.evaluate(() => ({
              banner: (document.querySelector('.aposta-campos .aposta-herdada') || {}).textContent || '',
              pergunta: (document.querySelector('.aposta-pergunta') || {}).textContent || '',
              fontePreenchida: (document.querySelector('[data-e="fonte"]') || {}).value || '',
              titulo: (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '',
              toastAparente: (document.querySelector('.aposta-toast') || {}).textContent || '',
            }));
            anota('sem toast "Agora registre..." — o modo de registro já mostra o banner permanente',
              !/Agora registre/i.test(modoRegistro.toastAparente), modoRegistro.toastAparente);
            anota('um único clique muda a etapa inteira para o modo de registro, sem avançar para a Decisão',
              /REGISTRO DOS RESULTADOS/.test(modoRegistro.banner) && /O que aconteceu de fato/i.test(modoRegistro.pergunta) &&
              modoRegistro.titulo === tituloAntesEvVazia,
              JSON.stringify(modoRegistro));
            anota('a Fonte utilizada nasce pré-selecionada com a fonte planejada, sem precisar de um clique à parte',
              modoRegistro.fontePreenchida === 'Dados do sistema', modoRegistro.fontePreenchida);

            await page.fill('[data-e="observado"]', '850');
            await page.selectOption('[data-e="fonte"]', 'Registros de atendimento');
            await page.waitForTimeout(300);

            /* Aprendizado é por card, com tooltip próprio — não é a mesma
               coisa que classificar a hipótese inteira. */
            const aprendizadoUi = await page.evaluate(() => {
              const rot = Array.from(document.querySelectorAll('.aposta-campo-rot'))
                .find((r) => /O que aprendemos com esta evid[êe]ncia/i.test(r.textContent));
              return { rotulo: rot ? rot.textContent : '', dica: rot ? rot.title : '' };
            });
            anota('o card pergunta "O que aprendemos com esta evidência?", com tooltip evitando prova definitiva',
              /O que aprendemos com esta evid[êe]ncia/i.test(aprendizadoUi.rotulo) && /prova definitiva/i.test(aprendizadoUi.dica),
              JSON.stringify(aprendizadoUi));
            await page.fill('[data-e="aprendizado"]',
              'A redução dos contatos sugere que a maior visibilidade pode estar ajudando, mas precisamos observar numa amostra maior.');

            /* Linguagem de prova ("comprovou", "sucesso"...) recebe aviso
               didático — sem tocar no formulário ao vivo, via o mesmo
               validar() exposto para a suíte "▶ Automáticos". */
            const avisoProva = await page.evaluate(() => window.faAposta._validar('evidencia', {
              itens: [{ resultadoId: 'r1', observado: '850', fonte: 'Registros de atendimento', aprendizado: 'Isso comprovou que a hipótese está certa' }],
            }));
            anota('linguagem de prova ("comprovou") no aprendizado recebe aviso didático (não bloqueia)',
              avisoProva.some((a) => /conclus[ãa]o fechada/i.test(a)), JSON.stringify(avisoProva));

            /* Fonte prevista "Outro" sem detalhamento recebe aviso
               didático (não bloqueia) — mesma checagem isolada. */
            const avisoOutroSemDetalhe = await page.evaluate(() => window.faAposta._validar('evidencia', {
              itens: [{ resultadoId: 'r1', observado: '850', fonte: 'Registros de atendimento', aprendizado: 'texto', fontePrevista: 'Outro', comoSeraMedido: '' }],
            }));
            anota('Fonte prevista "Outro" sem detalhar como será medido recebe aviso didático',
              avisoOutroSemDetalhe.some((a) => /detalhar como esse resultado será medido/i.test(a)), JSON.stringify(avisoOutroSemDetalhe));

            /* "Nossa hipótese foi" reaparece agora, no modo de registro —
               a leitura do CONJUNTO das evidências, obrigatória para
               seguir para a Decisão (sem ela, o clique genérico do fim
               do laço em '#apostaSeguir' desabilitado não levaria a
               etapa nenhuma adiante). */
            await page.waitForSelector('#apostaClassificacaoHipotese', { timeout: 5000 });
            await page.locator('#apostaClassificacaoHipotese .aposta-opcao', { hasText: 'Parcialmente sustentada' }).click();
            await page.waitForTimeout(200);

            /* Mapa/resumo antes da execução: por resultado selecionado no
               Experimento, "aguardando execução" em vez de ficar em
               branco — mesmo sem nada ter sido digitado na Evidência. */
            const resumoAntesExecucao = await page.evaluate(() => window.faAposta._resumo('evidencia', {
              mudancas: { itens: [{ id: 'rx', indicador: 'NPS do atendimento', direcao: 'Aumentar', atual: '6', meta: '7', formaMedicao: 'Índice', unidade: 'NPS' }] },
              experimento: { resultadoIds: ['rx'] },
              evidencia: {},
            }));
            anota('o resumo da Evidência mostra "aguardando execução" por resultado, antes de qualquer dado observado',
              resumoAntesExecucao === 'NPS do atendimento: aguardando execução.', JSON.stringify(resumoAntesExecucao));
          }
          if (i === 8) {
            /* O bloco "Evidência" no topo da Decisão mostra só os dados
               observados (indicador, situação inicial, meta, observado) —
               sem "Portanto, nossa hipótese foi…" nem qualquer veredito
               automático de certo/errado. */
            const evidenciaTopo = await page.evaluate(() => {
              const c = document.querySelector('.aposta-conexao');
              return c ? c.textContent.replace(/\s+/g, ' ') : '';
            });
            anota('a Decisão mostra a Evidência sem classificar automaticamente a hipótese',
              /contatos sobre andamento/i.test(evidenciaTopo) && /Situa[çc][ãa]o inicial/i.test(evidenciaTopo) &&
              /Meta/.test(evidenciaTopo) && /Observado/.test(evidenciaTopo) && !/Portanto, nossa hip[óo]tese foi/i.test(evidenciaTopo),
              evidenciaTopo.slice(0, 200));
            anota('a Decisão também recebe a fonte da evidência e o aprendizado registrado, herdados por id',
              /Fonte: Registros de atendimento/i.test(evidenciaTopo) && /Aprendizado:/i.test(evidenciaTopo),
              evidenciaTopo.slice(0, 300));

            /* DECISÃO: a data de reavaliação é um DIA marcado no calendário
               (sai com ano); "Prazo" é DURAÇÃO ("em quanto tempo"), não uma
               data — as execuções antigas guardavam "10 dias", não uma data
               absoluta. */
            await page.fill('[data-campo="reavaliacao"]', '31122026');
            await page.waitForTimeout(250);
            const data = await page.evaluate(() => (document.querySelector('[data-campo="reavaliacao"]') || {}).value || '');
            anota('a data de reavaliação sai com dia, mês e ano', data === '31/12/2026', 'ficou "' + data + '"');

            await page.fill('[data-campo="prazo"]', '10');
            await page.selectOption('[data-campo="prazoUnidade"]', 'dias');
            await page.waitForTimeout(250);
            const prazoDecisao = await page.evaluate(() => (document.querySelector('[data-campo="prazo"]') || {}).value || '');
            anota('o prazo da decisão é número + unidade, não uma data', prazoDecisao === '10', 'ficou "' + prazoDecisao + '"');

            /* "Responsável" e "Prazo" sozinhos, na Decisão, eram os mesmos
               nomes genéricos usados noutras etapas — os quatro tempos e
               os dois "responsável" (o da Decisão é sempre da PRÓXIMA
               AÇÃO) não podem se confundir. */
            const rotulosDecisao = await page.evaluate(() => {
              function rotuloDe(campo) {
                const el = document.querySelector('[data-campo="' + campo + '"]');
                const rot = el ? el.closest('.aposta-campo').querySelector('.aposta-campo-rot') : null;
                return { texto: rot ? rot.textContent.trim() : '', title: rot ? rot.title : '' };
              }
              return { responsavel: rotuloDe('responsavel'), prazo: rotuloDe('prazo'), reavaliacao: rotuloDe('reavaliacao') };
            });
            anota('o rótulo do responsável na Decisão diz "Responsável pela próxima ação"',
              rotulosDecisao.responsavel.texto === 'Responsável pela próxima ação', JSON.stringify(rotulosDecisao.responsavel));
            anota('o rótulo do prazo na Decisão diz "Prazo da próxima ação", com dica própria',
              rotulosDecisao.prazo.texto === 'Prazo da próxima ação' && /pr[óo]ximo passo decidido/i.test(rotulosDecisao.prazo.title),
              JSON.stringify(rotulosDecisao.prazo));
            anota('a Data de reavaliação explica quando o grupo volta a olhar a aposta e os aprendizados',
              /novos aprendizados/i.test(rotulosDecisao.reavaliacao.title), JSON.stringify(rotulosDecisao.reavaliacao));

            /* Opções renomeadas: "Abandonar essa ideia" → "Interromper
               esta ideia", "Formular nova hipótese" → "Reformular a
               hipótese" — e cada opção tem sua própria dica/tooltip. */
            const opcoes = await page.evaluate(() =>
              Array.from(document.querySelectorAll('.aposta-opcao')).map((b) => ({ texto: b.textContent.trim(), dica: b.title || '' })));
            anota('as cinco opções de decisão têm os nomes novos',
              opcoes.some((o) => o.texto === 'Interromper esta ideia') &&
              opcoes.some((o) => o.texto === 'Reformular a hipótese') &&
              !opcoes.some((o) => /Abandonar essa ideia|Formular nova hip[óo]tese/.test(o.texto)),
              opcoes.map((o) => o.texto).join(' | '));
            anota('cada opção de decisão tem uma dica própria (ajuda, não decide pelo grupo)',
              opcoes.every((o) => !!o.dica), JSON.stringify(opcoes));

            /* Nova hipótese: some para "Ampliar", recolhida (mas visível)
               para "Ajustar e testar novamente", aberta sozinha só para
               "Reformular a hipótese" — nunca aparece do mesmo jeito para
               toda decisão. */
            async function estadoNovaHipotese() {
              return page.evaluate(() => {
                const el = document.getElementById('apostaGrupoNovaHipotese');
                return el ? { hidden: el.hidden, open: el.open, resumo: (el.querySelector('summary') || {}).textContent || '' } : null;
              });
            }
            await page.locator('.aposta-opcao', { hasText: 'Ampliar' }).click();
            await page.waitForTimeout(200);
            let estado = await estadoNovaHipotese();
            anota('decisão "Ampliar" não mostra a Nova hipótese', !!estado && estado.hidden, JSON.stringify(estado));

            await page.locator('.aposta-opcao', { hasText: 'Ajustar e testar novamente' }).click();
            await page.waitForTimeout(200);
            estado = await estadoNovaHipotese();
            anota('decisão "Ajustar e testar novamente" mostra a Nova hipótese recolhida, com o convite "Reformular hipótese também"',
              !!estado && !estado.hidden && !estado.open && /Reformular hip[óo]tese também/i.test(estado.resumo), JSON.stringify(estado));

            await page.locator('.aposta-opcao', { hasText: 'Reformular a hipótese' }).click();
            await page.waitForTimeout(200);
            estado = await estadoNovaHipotese();
            anota('decisão "Reformular a hipótese" abre a Nova hipótese sozinha',
              !!estado && !estado.hidden && estado.open, JSON.stringify(estado));

            const grupo = await page.evaluate(() => {
              const g = document.getElementById('apostaGrupoNovaHipotese');
              return {
                fixo: g ? Array.from(g.querySelectorAll('.aposta-molde-fixo')).map((e) => e.textContent.trim()).join(' | ') : '',
                lacunas: g ? g.querySelectorAll('.aposta-campo-input').length : 0,
                dicaObrigatoria: g ? (g.querySelector('.aposta-grupo-dica') || {}).textContent || '' : '',
              };
            });
            anota('a nova hipótese reusa o mesmo molde da etapa Hipótese (duas frases: "Acreditamos que isso acontece porque…" e "Essa hipótese surgiu porque observamos que…")',
              /Acreditamos que isso acontece porque/.test(grupo.fixo) && /Essa hip[óo]tese surgiu porque observamos que/.test(grupo.fixo) && grupo.lacunas === 2,
              JSON.stringify(grupo));
            anota('quando obrigatória (Reformular a hipótese), a tela diz por quê', /pede uma explica[çc][ãa]o nova/i.test(grupo.dicaObrigatoria));

            /* Decisão é frase estrita (ver ETAPAS_FRASE_ESTRITA): sem a
               próxima ação, a prévia mostra só a orientação do que
               falta, não a frase com "Próxima ação:" em branco. */
            await page.fill('[data-campo="proximaAcao"]', 'testar a nova hipótese com um novo experimento');
            await page.waitForTimeout(300);
            /* Ajuste de usabilidade (item 14): "Reformular a hipótese"
               com Próxima ação já preenchida, mas SEM a Nova Hipótese,
               continua bloqueando CONTINUAR de verdade — não bastava
               mais só a orientação, a decisão inteira dependia dela. */
            const desabilitadoSemNovaHip = await page.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
            anota('"Reformular a hipótese" sem a Nova Hipótese completa mantém CONTINUAR desabilitado',
              desabilitadoSemNovaHip === true, String(desabilitadoSemNovaHip));

            await page.fill('[data-campo="proxHipCausa"]', 'a mensagem não chega a quem está em análise');
            await page.fill('[data-campo="proxHipIndicio"]', 'os contatos caíram só no grupo que recebeu a mensagem');
            await page.waitForTimeout(300);
            const habilitadoComNovaHip = await page.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
            anota('completar a Nova Hipótese libera CONTINUAR de verdade', habilitadoComNovaHip === false, String(habilitadoComNovaHip));
            const fraseDec = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('a frase da decisão não tem traço solto no meio',
              /Próxima ação:/.test(fraseDec) && !/—/.test(fraseDec), fraseDec.slice(0, 140));
            anota('a nova hipótese entra na "Fica assim no mapa" quando a decisão for "Reformular a hipótese"',
              /Nova hip[óo]tese:/.test(fraseDec) && /a mensagem não chega a quem está em análise/.test(fraseDec),
              fraseDec.slice(0, 220));
          }
          /* :not([disabled]) — a Evidência mostra Situação inicial/Meta
             como campos desabilitados (herdados de Mudanças mensuráveis,
             não editáveis ali); preencher o primeiro campo "genérico"
             sem esse filtro tentaria digitar num campo que a tela
             correta e propositalmente não deixa editar. :not(select) —
             desde a Fonte prevista da evidência (Plano de Evidência),
             o primeiro campo habilitado da Evidência pode ser um
             <select>, que não aceita .fill(); um <select> preenchido
             de propósito já é responsabilidade do bloco específico de
             cada etapa (ver "if (i === 7)"), não deste genérico. */
          const campo = page.locator('.aposta-campo-input:not([disabled]):not(select)').first();
          if (await campo.count()) await campo.fill('conteúdo da etapa ' + (i + 1));
          const opcao = page.locator('.aposta-opcao').first();
          if (await opcao.count()) await opcao.click();
        }

        const tituloAntes = await page.evaluate(() =>
          (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        await page.click('#apostaSeguir');
        /* Um aviso didático segura o primeiro clique de propósito (é um
           convite a reler, não um bloqueio): quando ele aparece, o
           segundo clique segue. */
        await page.waitForTimeout(400);
        const segurou = await page.evaluate(() => {
          const el = document.querySelector('#apostaAvisos');
          return !!el && !!el.textContent.trim();
        });
        if (segurou) await page.click('#apostaSeguir');
        await page.waitForFunction((antes) => {
          if (document.querySelector('.aposta-mapa')) return true;
          var t = document.querySelector('.aposta-etapa-titulo');
          return !!t && t.textContent !== antes;
        }, tituloAntes, { timeout: 15000 });
      }

      anota('nenhuma etapa vazou os termos do final da dinâmica',
        vazados.length === 0, vazados.join('; '));

      /* ── 3b: FASE 4 — tentar editar uma etapa do ciclo já concluído ──
         A Decisão da 3a já foi respondida ("Ampliar" — ver o clique
         genérico ao fim do laço de 3a), o que finaliza o ciclo (implícito
         — ver CICLO 1 IMPLÍCITO em aposta.js). Clicar num card do Mapa ou
         na trilha agora tem de pedir confirmação antes de editar — nunca
         reabrir e sobrescrever silenciosamente o que já foi decidido (item
         9 do pedido). CANCELAR tem de ser um não-operação completo: nem
         cicloAtual muda, nem nasce ciclo nenhum, e a tela volta exatamente
         como estava. (O teste de que CONFIRMAR de fato cria um Ciclo 2 —
         com herança, cascata e ponto de reinício corretos — mora nos
         cenários dedicados de Ciclos mais abaixo.) */
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll('.aposta-trilha-item'))
          .find((i) => /Ideia de solução/.test(i.textContent));
        if (t && !t.disabled) t.click();
      });
      await page.waitForSelector('.aposta-confirmar-overlay .modal-box', { timeout: 5000 });
      const modalCicloTxt = await page.evaluate(() =>
        (document.querySelector('.aposta-confirmar-overlay .modal-box') || {}).textContent || '');
      anota('tentar editar uma etapa do ciclo já concluído (Ampliar) pede confirmação antes de reabrir',
        /ciclo já foi conclu[íi]do/i.test(modalCicloTxt) && /iniciar um novo ciclo/i.test(modalCicloTxt), modalCicloTxt);
      await clicarSemRolagem(page, '.aposta-modal-nao-btn');
      await page.waitForTimeout(300);
      const depoisDeCancelar = await page.evaluate(() => ({
        temModal: !!document.querySelector('.aposta-confirmar-overlay'),
        temMapa: !!document.querySelector('.aposta-mapa'),
        temCiclos: !!window.faAposta,
      }));
      anota('CANCELAR fecha o modal sem sair do Mapa e sem criar ciclo nenhum',
        !depoisDeCancelar.temModal && depoisDeCancelar.temMapa, JSON.stringify(depoisDeCancelar));

      /* Volta ao mapa clicando Continuar até chegar lá — não importa em que
         etapa o desvio acima deixou a tela (aqui, CANCELAR já deixou no
         Mapa; o laço abaixo é só uma rede de segurança, sempre existiu). */
      for (let n = 0; n < 14; n++) {
        if (await page.evaluate(() => !!document.querySelector('.aposta-mapa'))) break;
        /* $eval (não page.click): um botão genuinely disabled (ajuste de
           usabilidade #6) nunca dispara o clique — usar a ação normal do
           Playwright aqui travaria 30s esperando ele "ficar habilitado"
           sozinho, o que nunca vai acontecer sem preencher o que falta. */
        await clicarSemRolagem(page, '#apostaSeguir');
        await page.waitForTimeout(350);
        const segurou = await page.evaluate(() => {
          const el = document.querySelector('#apostaAvisos');
          return !!el && !!el.textContent.trim();
        });
        if (segurou) { await clicarSemRolagem(page, '#apostaSeguir'); await page.waitForTimeout(350); }
      }

      /* ── 4: o mapa final, antes da revelação ── */
      await page.waitForSelector('.aposta-mapa', { timeout: 15000 });
      const mapa = await page.evaluate(() => ({
        cards: document.querySelectorAll('.aposta-mapa-card').length,
        texto: (document.querySelector('.aposta-mapa').textContent || '').replace(/\s+/g, ' '),
        temRevelacao: !!document.querySelector('.aposta-revelacao'),
      }));
      anota('o mapa final tem um card por etapa', mapa.cards === 9, 'vieram ' + mapa.cards);
      anota('o mapa mostra o que o grupo escreveu', /não sabe o status/.test(mapa.texto), mapa.texto.slice(0, 90));
      anota('a revelação NÃO aparece sozinha ao chegar no mapa', !mapa.temRevelacao);
      const txtMapa = await textoDaTela(page);
      anota('nem o mapa final vaza os termos antes do facilitador revelar',
        !SEGREDO.test(txtMapa), (txtMapa.match(SEGREDO) || [''])[0]);

      /* ── 4b: levar a aposta embora ── */
      const exporta = await page.evaluate(() => ({
        temCopiar: !!document.getElementById('apostaCopiarBtn'),
        temPdf: !!document.getElementById('apostaPdfBtn'),
        texto: window.faAposta._texto(),
      }));
      anota('o mapa oferece copiar em texto e salvar em PDF', exporta.temCopiar && exporta.temPdf);
      anota('o texto exportado traz as nove etapas, com a pergunta de cada uma',
        (exporta.texto.match(/^## /gm) || []).length === 9 &&
        /O que queremos melhorar\?/.test(exporta.texto) &&
        /não sabe o status/.test(exporta.texto),
        exporta.texto.slice(0, 120).replace(/\n/g, ' | '));
      anota('o texto exportado também não vaza os termos do final',
        !SEGREDO.test(exporta.texto), (exporta.texto.match(SEGREDO) || [''])[0]);

      /* ── 5: a diretora NÃO pode revelar; só quem conduz ── */
      const temBotaoRevelar = await page.evaluate(() => !!document.querySelector('#apostaRevelarBtn'));
      anota('a revelação não fica na mão do grupo', !temBotaoRevelar);

      /* ── 6: quem conduz revela, e aí sim os termos aparecem ──
         Noutra aba, porque o botão só existe para quem conduz. O conteúdo
         que o grupo escreveu é semeado igual ao que a diretora acabou de
         preencher, para a revelação ter o que mostrar. */
      const semeado = apostasSemeadas();
      /* Grupo com as nove etapas preenchidas: é assim que a turma chega ao
         fim da dinâmica, e é o estado em que a revelação faz sentido. */
      semeado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
        missao:   { texto: 'Melhorar a experiência do participante em 90 dias' },
        sintoma:  { texto: 'muita gente liga para saber o status' },
        problema: { quem: 'O participante', situacaoIndesejada: 'não consegue acompanhar o andamento' },
        mudancas: { itens: [{ id: 'r1', direcao: 'Reduzir', indicador: 'contatos sobre andamento', atual: '1000', meta: '700', unidade: 'por mês', prazo: '90 dias' }] },
        hipotese: { causa: 'as informações não são claras', indicio: 'muitas perguntas de status' },
        ideia:    { texto: 'dar visibilidade do andamento' },
        experimento: { oQue: 'enviar a mensagem', comQuem: 'participantes', quantidade: '50', duracao: '3 semanas', resultadoIds: ['r1'] },
        evidencia: { itens: [{ resultadoId: 'r1', observado: '750', fonte: 'Registros de atendimento', aprendizado: 'Os contatos caíram, sugerindo que a visibilidade ajuda.' }] },
        /* "Ampliar" (não "Ajustar e testar novamente"): esta cena só quer
           chegar ao Mapa para testar a revelação — não importa qual
           decisão. Fase 4: "Ajustar e testar novamente" abriria um Ciclo
           novo em vez de mostrar o Mapa (e pediria pontoDeReinicioEscolhido,
           que este seed nem tinha) — "Ampliar" finaliza sem complicação. */
        decisao:  { decisao: 'Ampliar', proximaAcao: 'novo teste com grupo maior' }
      };
      semeado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'decisao';
      const { ctx: ctxAdm, page: adm } = await novaPagina(browser, formato, ADM, erros, semeado);
      await adm.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
      await adm.waitForSelector('#apostaAbrirBtn', { timeout: 15000 });
      await adm.click('#apostaAbrirBtn');
      await adm.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
      await adm.click('.aposta-grupo-btn');
      await adm.waitForSelector('.aposta-trilha-item', { timeout: 15000 });

      const antesDeRevelar = await textoDaTela(adm);
      anota('nem para quem conduz os termos aparecem antes do clique',
        !SEGREDO.test(antesDeRevelar), (antesDeRevelar.match(SEGREDO) || [''])[0]);

      /* Vai ao mapa pela trilha e revela dali. */
      await adm.evaluate(() => {
        const itens = Array.from(document.querySelectorAll('.aposta-trilha-item')).filter((i) => !i.disabled);
        itens[itens.length - 1].click();
      });
      await adm.waitForTimeout(400);
      await adm.evaluate(() => {
        const b = document.querySelector('#apostaSeguir');
        if (b) b.click();
      });
      await adm.waitForSelector('#apostaRevelarBtn', { timeout: 15000 });
      anota('quem conduz tem o botão de revelar', true);
      await adm.click('#apostaRevelarBtn');
      await adm.waitForFunction(() => !!document.querySelector('.aposta-revelacao'), { timeout: 15000 });
      const rev = await adm.evaluate(() => (document.querySelector('.aposta-revelacao').textContent || '').replace(/\s+/g, ' '));
      anota('depois de revelado, Missão aparece ligada a Objective',
        /MISS[ÃA]O DA DIN[ÂA]MICA/i.test(rev) && /Objective/.test(rev), rev.slice(0, 120));
      anota('depois de revelado, Mudanças mensuráveis aparecem ligadas a Key Results',
        /MUDAN[ÇC]AS MENSUR[ÁA]VEIS/i.test(rev) && /Key Results/.test(rev), rev.slice(0, 120));
      anota('a revelação traz o ciclo PHEED', /PHEED/.test(rev));
      anota('a revelação não afirma que Missão e Objective são sinônimos universais',
        /exerceu o papel de Objective/i.test(rev), rev.slice(-160));

      /* Execução gravada antes das lacunas (a missão era um campo de texto
         só): o que o grupo escreveu continua aparecendo. */
      anota('o que foi escrito numa execução antiga continua no mapa',
        /Melhorar a experiência do participante em 90 dias/.test(rev), rev.slice(0, 160));

      /* ── 6b: o painel do facilitador precisa dizer, com a própria revelação
            já feita, que ela vale pros grupos todos e onde ver o resultado —
            relatado no uso real: "isso só faz sentido dentro de cada grupo e
            não nesta tela. eu não entendi". Sem aviso nenhum, o botão do
            painel parecia não fazer nada (o efeito só aparece no Mapa). ── */
      await adm.click('#apostaPainelBtn');
      await adm.waitForSelector('#apostaToggleRevelar', { timeout: 15000 });
      const painelRevelado = await adm.evaluate(() => ({
        rotuloBotao: (document.getElementById('apostaToggleRevelar') || {}).textContent || '',
        aviso: (document.getElementById('apostaToggleRevelar') || { previousElementSibling: {} }).previousElementSibling.textContent || '',
      }));
      anota('o painel, já revelado, diz que vale para os grupos todos e onde ver',
        /Esconder de novo/.test(painelRevelado.rotuloBotao) &&
        /vale para os 3 grupos/.test(painelRevelado.aviso) && /Mapa da Aposta/.test(painelRevelado.aviso),
        JSON.stringify(painelRevelado));
      await adm.click('#apostaFecharPainel');

      /* ── 7: o que foi escrito ficou gravado no caminho certo ── */
      const gravou = await page.evaluate(() => {
        const e = (window.__ESCRITAS || []).filter((x) => /^apostas\//.test(x.path));
        return {
          total: e.length,
          temDados: e.some((x) => /\/grupos\/[^/]+\/dados\/sintoma$/.test(x.path)),
        };
      });
      anota('o salvamento automático grava no caminho da execução e do grupo',
        gravou.temDados, gravou.total + ' escritas em apostas/');

      /* ── 8: a gravação da Missão é recusada pelo banco — relatado no uso
            real: a pessoa digitava a Missão, clicava Continuar, seguia a
            dinâmica normalmente por várias etapas, e só ao voltar na
            trilha via a Missão em branco de novo. A escrita disparava e a
            tela já tinha ido embora ANTES de saber se ela tinha dado
            certo — no wi-fi da sala isso nunca aparecia (a resposta chega
            rápido demais para reparar), mas no 4G da oficina de verdade
            a demora é o suficiente para o grupo já ter clicado e saído.
            Se a escrita falhava de vez, o aviso de erro (quando aparecia)
            já estava na etapa ERRADA, e ninguém relacionava um ao outro. */
      {
        const caminhoMissao = 'apostas/' + TURMA_LIB + '/execucoes/' + EXEC + '/grupos/' + GRUPO + '/dados/missao';
        const { ctx: ctxF, page: pgF } = await novaPagina(
          browser, formato, DIRETORA, erros, apostasSemeadas(), { fail: [caminhoMissao] });
        await pgF.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgF.click('#apostaAbrirBtn');
        await pgF.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgF.click('.aposta-grupo-btn');
        await pgF.waitForSelector('.aposta-etapa-titulo', { timeout: 15000 });

        await pgF.fill('#ap-verbo', 'Melhorar');
        await pgF.fill('#ap-oQue', 'a experiência do participante');
        await pgF.fill('#ap-contexto', 'durante a concessão');
        await pgF.fill('#ap-prazo', '90');
        await pgF.click('#apostaSeguir');
        await pgF.waitForTimeout(600);

        const comFalha = await pgF.evaluate(() => ({
          titulo: (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '',
          verbo: (document.getElementById('ap-verbo') || {}).value || '',
          botaoTravado: !!(document.getElementById('apostaSeguir') || {}).disabled,
          toast: (document.querySelector('.aposta-toast') || {}).textContent || '',
        }));
        anota('gravação recusada NÃO avança a tela — sem isso, a Missão sumia sem ninguém perceber',
          /MISS[ÃA]O/.test(comFalha.titulo), 'título ficou "' + comFalha.titulo + '"');
        anota('o que foi digitado continua na tela — nada foi perdido',
          comFalha.verbo === 'Melhorar', 'campo voltou "' + comFalha.verbo + '"');
        anota('o botão Continuar volta a ficar utilizável, para tentar de novo', !comFalha.botaoTravado);
        anota('o erro de gravação aparece — silêncio sobre um dado que não foi salvo é pior que o erro',
          /Não consegui salvar/.test(comFalha.toast) && /MISS[ÃA]O|Missão/i.test(comFalha.toast),
          comFalha.toast.slice(0, 140));

        /* A "rede volta a funcionar": mesmo clique, mesmos dados — agora vai. */
        await pgF.evaluate(() => { window.__CFG.fail = []; });
        await pgF.click('#apostaSeguir');
        await pgF.waitForFunction(() =>
          /SINTOMA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        /* window.__ESCRITAS registra toda TENTATIVA de gravação, inclusive a
           que falhou — não prova que o dado ficou no banco. Ler o banco
           falso direto é o que confirma que desta vez a escrita pegou. */
        const noBanco = await pgF.evaluate(({ turma, exec, grupo }) => {
          var g = ((((window.__CFG.db.apostas || {})[turma] || {}).execucoes || {})[exec] || {}).grupos || {};
          return ((g[grupo] || {}).dados || {}).missao || null;
        }, { turma: TURMA_LIB, exec: EXEC, grupo: GRUPO });
        anota('assim que a gravação passa a funcionar, o mesmo clique salva de verdade e avança',
          !!noBanco && noBanco.verbo === 'Melhorar', JSON.stringify(noBanco));

        await ctxF.close();
      }

      /* ── 9: o card de Evidência herda indicador, situação inicial, meta
            e unidade de Mudanças mensuráveis — nada disso é redigitado.
            Só o resultado observado e a fonte são novos, e a frase e o
            "% do caminho até a meta" se montam sozinhos a partir do que
            já existia mais o que a pessoa acabou de preencher. ── */
      {
        const semeadoEv = apostasSemeadas();
        semeadoEv[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoEv[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ id: 'r1', direcao: 'Reduzir', indicador: 'contatos sobre o andamento da concessão', atual: '1000', meta: '500', formaMedicao: 'Quantidade', unidade: 'contatos', periodo: 'por mês', prazo: '90', prazoUnidade: 'dias' }] },
          experimento: { resultadoIds: ['r1'] },
        };
        const { ctx: ctxEv, page: pgEv } = await novaPagina(browser, formato, DIRETORA, erros, semeadoEv);
        await pgEv.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgEv.click('#apostaAbrirBtn');
        await pgEv.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgEv.click('.aposta-grupo-btn');
        await pgEv.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });

        const herdado = await pgEv.evaluate(() => {
          const bloco = document.querySelector('.aposta-mudanca[data-resultado]');
          const disabled = bloco ? Array.from(bloco.querySelectorAll('.aposta-campo-input[disabled]')).map((e) => e.value) : [];
          return { um: document.querySelectorAll('.aposta-mudanca[data-resultado]').length, disabled: disabled };
        });
        anota('a evidência tem um card, e situação inicial/meta chegam prontas, não editáveis',
          herdado.um === 1 && /1000 contatos por mês/.test(herdado.disabled[0]) && /500 contatos por mês/.test(herdado.disabled[1]),
          JSON.stringify(herdado));

        /* Plano de Evidência — preenchido ANTES da execução: Fonte
           prevista e Detalhe/como será medido ficam sempre editáveis
           (não dependem de "não foi possível medir", porque são
           definidos antes de existir qualquer resultado para medir). */
        const planoRotulos = await pgEv.evaluate(() => ({
          fontePrevista: !!document.querySelector('[data-e="fontePrevista"]'),
          comoSeraMedido: !!document.querySelector('[data-e="comoSeraMedido"]'),
        }));
        anota('o Plano de Evidência tem Fonte prevista e Detalhe/como será medido',
          planoRotulos.fontePrevista && planoRotulos.comoSeraMedido,
          JSON.stringify(planoRotulos));

        /* Melhoria de usabilidade: a etapa inteira alterna de modo com
           um único clique no botão principal — não existe mais um botão
           por card. Antes de escolher a fonte prevista, o Plano de
           Evidência está incompleto e o botão não libera o modo de
           registro. */
        await pgEv.selectOption('[data-e="fontePrevista"]', 'Dados do sistema');
        await pgEv.waitForTimeout(300);
        await pgEv.$eval('#apostaSeguir', (el) => el.click());
        /* Item 4 do ajuste de fluxo: modal próprio (não window.confirm)
           perguntando se o experimento já foi executado. */
        await pgEv.waitForSelector('.aposta-modal-sim-btn', { timeout: 5000 });
        await pgEv.$eval('.aposta-modal-sim-btn', (el) => el.click());
        await pgEv.waitForTimeout(300);
        const fonteEfetivaRot = await pgEv.evaluate(() =>
          Array.from(document.querySelectorAll('.aposta-campo-rot')).some((r) => /Fonte utilizada/i.test(r.textContent)));
        anota('depois de "Registrar resultados do experimento", a fonte pós-execução aparece como "Fonte utilizada"', fonteEfetivaRot);

        const fontePreSelecionada = await pgEv.evaluate(() => (document.querySelector('[data-e="fonte"]') || {}).value || '');
        anota('a Fonte utilizada nasce pré-selecionada com a fonte planejada, sem precisar de um clique à parte',
          fontePreSelecionada === 'Dados do sistema', fontePreSelecionada);

        await pgEv.fill('[data-e="observado"]', '650');
        await pgEv.selectOption('[data-e="fonte"]', 'Registros de atendimento');
        await pgEv.waitForTimeout(300);
        const card = await pgEv.evaluate(() => ({
          frase: (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '',
          progresso: (document.querySelector('.aposta-frase-pronta') || {}).textContent || '',
        }));
        anota('a frase da evidência junta o que já existia com o que foi observado, sem redigitar nada',
          /Esperávamos reduzir contatos sobre o andamento da concessão de 1000 contatos por mês para 500 contatos por mês/.test(card.frase) &&
          /observamos 650 contatos por mês/.test(card.frase),
          card.frase);
        anota('a frase da evidência não repete o prazo da mudança mensurável ("em 90 dias" fica só lá)',
          !/em 90 dias/.test(card.frase), card.frase);
        anota('o avanço até a meta é calculado sozinho, respeitando a direção (Reduzir)',
          /70% da mudança esperada foi alcançada/.test(card.progresso), card.progresso);

        /* O quadro "Resultados do experimento" nunca troca a Meta pelo
           Resultado observado — os dois ficam sempre visíveis e
           diferentes um do outro. */
        const resumoQuadro = await pgEv.evaluate(() => (document.querySelector('.aposta-resultados-resumo') || {}).textContent.replace(/\s+/g, ' ') || '');
        anota('"Resultados do experimento" mostra início → observado, e a Meta original, sem substituir uma pela outra',
          /1000 contatos por m[êe]s.*650 contatos por m[êe]s.*Meta: 500 contatos por m[êe]s/.test(resumoQuadro), resumoQuadro);

        /* Meta atingida exatamente: mensagem própria, sem percentual. */
        await pgEv.fill('[data-e="observado"]', '500');
        await pgEv.waitForTimeout(300);
        const metaAtingida = await pgEv.evaluate(() => (document.querySelector('.aposta-frase-pronta') || {}).textContent || '');
        anota('resultado observado igual à meta mostra "a mudança esperada foi alcançada", sem percentual',
          metaAtingida === 'A mudança esperada foi alcançada.', metaAtingida);

        /* Meta superada: nunca um percentual acima de 100% como
           mensagem principal — a diferença, na mesma unidade/período. */
        await pgEv.fill('[data-e="observado"]', '400');
        await pgEv.waitForTimeout(300);
        const metaSuperada = await pgEv.evaluate(() => (document.querySelector('.aposta-frase-pronta') || {}).textContent || '');
        anota('meta superada mostra a diferença, nunca um percentual acima de 100%',
          metaSuperada === 'A mudança esperada foi superada em 100 contatos por mês.', metaSuperada);

        /* Piora do indicador (foi na direção contrária): nunca um
           percentual negativo como mensagem principal. */
        await pgEv.fill('[data-e="observado"]', '1200');
        await pgEv.waitForTimeout(300);
        const semMelhora = await pgEv.evaluate(() => (document.querySelector('.aposta-frase-falta') || {}).textContent || '');
        anota('piora do indicador não mostra percentual negativo — mostra o que foi observado x a situação inicial',
          semMelhora === 'O resultado observado não avançou na direção esperada. Foram observados 1200 contatos por mês, acima da situação inicial de 1000 contatos por mês.',
          semMelhora);

        /* Devolve ao estado consistente para o resto do teste. */
        await pgEv.fill('[data-e="observado"]', '650');
        await pgEv.waitForTimeout(300);

        /* CONTINUAR: sem fonte, mesmo com observado preenchido, fica
           bloqueado de verdade — sem escape por segundo clique. (Volta a
           fonte para vazio: já tinha sido escolhida lá em cima, para os
           testes de frase.) */
        await pgEv.selectOption('[data-e="fonte"]', '');
        await pgEv.waitForTimeout(200);
        const tituloAntesEv = await pgEv.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        /* Ajuste de usabilidade (item 6/7): o botão fica genuinely
           disabled — clicar nele (mesmo via $eval) não dispara nada, e a
           pendência já está listada ao vivo (item 8), sem precisar do
           clique para aparecer. */
        const semFonte = await pgEv.evaluate(() => ({
          desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
          pendencias: (document.querySelector('[data-evidencia-pendencias]') || {}).textContent || '',
        }));
        anota('CONTINUAR bloqueia sem Fonte utilizada, mesmo com Resultado observado preenchido',
          semFonte.desabilitado === true && /Fonte utilizada/i.test(semFonte.pendencias), JSON.stringify(semFonte));
        await pgEv.$eval('#apostaSeguir', (el) => el.click());
        await pgEv.waitForTimeout(300);
        const tituloDepoisSemFonte = await pgEv.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('o bloqueio de Evidência incompleta NÃO tem escape nenhum — nem clicando no botão desabilitado',
          tituloDepoisSemFonte === tituloAntesEv);

        /* Aprendizado é obrigatório quando o resultado foi medido de
           verdade — um número sozinho não é aprendizado. Observado +
           Fonte preenchidos, mas sem aprendizado, continua bloqueado. */
        await pgEv.selectOption('[data-e="fonte"]', 'Registros de atendimento');
        await pgEv.waitForTimeout(200);
        const notaFaltaAprendizadoAntes = await pgEv.evaluate(() => (document.querySelector('[data-falta-aprendizado]') || {}).textContent || '');
        anota('o card mostra "Ainda falta: o aprendizado" quando observado+fonte já existem mas o aprendizado ainda não',
          /Ainda falta: o aprendizado/i.test(notaFaltaAprendizadoAntes), notaFaltaAprendizadoAntes);
        const semAprendizado = await pgEv.evaluate(() => ({
          desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
          pendencias: (document.querySelector('[data-evidencia-pendencias]') || {}).textContent || '',
        }));
        anota('CONTINUAR bloqueia sem o aprendizado, mesmo com Resultado observado e Fonte preenchidos',
          semAprendizado.desabilitado === true && /Aprendizado/i.test(semAprendizado.pendencias), JSON.stringify(semAprendizado));

        /* "Nossa hipótese foi:" — a leitura do CONJUNTO das evidências,
           obrigatória uma única vez, nunca por resultado. O texto de
           apoio deixa explícito que a pergunta é sobre a hipótese
           ORIGINAL (a mesma da etapa H — Hipótese), não sobre uma
           hipótese nova (essa só existe depois, na Decisão). */
        const auxiliarHipotese = await pgEv.evaluate(() =>
          (document.querySelector('#apostaClassificacaoHipotese .aposta-auxiliar') || {}).textContent || '');
        anota('"Nossa hipótese foi:" explica que a pergunta é sobre a hipótese testada',
          auxiliarHipotese === 'O que as evidências nos dizem sobre a hipótese que testamos?', auxiliarHipotese);

        await pgEv.fill('[data-e="aprendizado"]', 'Os contatos caíram, mas ainda não bateram a meta.');
        await pgEv.waitForTimeout(300);
        const soFaltaClassificacao = await pgEv.evaluate(() => ({
          desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
          pendencias: (document.querySelector('[data-evidencia-pendencias]') || {}).textContent || '',
        }));
        anota('com o card completo, CONTINUAR ainda bloqueia só por faltar "Nossa hipótese foi"',
          soFaltaClassificacao.desabilitado === true &&
          /Nossa hip[óo]tese foi/i.test(soFaltaClassificacao.pendencias) &&
          !/Aprendizado/i.test(soFaltaClassificacao.pendencias),
          JSON.stringify(soFaltaClassificacao));

        await pgEv.locator('#apostaClassificacaoHipotese .aposta-opcao', { hasText: /^Sustentada$/ }).click();
        await pgEv.waitForTimeout(200);
        const comClassificacao = await pgEv.evaluate(() => ({
          desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
          pendencias: (document.querySelector('[data-evidencia-pendencias]') || {}).textContent || '',
        }));
        anota('escolher "Nossa hipótese foi" habilita CONTINUAR na hora, reativo (sem clicar em CONTINUAR)',
          comClassificacao.desabilitado === false && /Evidências completas/i.test(comClassificacao.pendencias),
          JSON.stringify(comClassificacao));

        /* Classificação é um controle à parte (não fica dentro de
           .aposta-resultados-resumo, reconstruído a cada tecla) — segue
           preservada daqui em diante, mesmo quando o aprendizado for
           reescrito abaixo. */
        await pgEv.fill('[data-e="aprendizado"]', 'Os contatos caíram, mas ainda não bateram a meta — a maior visibilidade pode estar ajudando.');
        await pgEv.waitForTimeout(300);
        const notaSumiuAprendizado = await pgEv.evaluate(() => !document.querySelector('[data-falta-aprendizado]'));
        anota('escrever o aprendizado apaga sozinha a nota "Ainda falta", sem precisar clicar em Continuar de novo', notaSumiuAprendizado);

        /* Devolve fonte a vazio de novo: o teste de "sem fonte" acima já
           passou; este bloco só precisava confirmar o aprendizado, e o
           que vem a seguir (naoMedido) parte de observado preenchido,
           fonte indiferente. */
        await pgEv.fill('[data-e="aprendizado"]', '');
        await pgEv.waitForTimeout(200);

        /* "Não foi possível medir" desliga Resultado observado/Fonte e
           passa a exigir Motivo em vez deles — nunca os dois ao mesmo
           tempo. */
        await pgEv.click('[data-e="naoMedido"]');
        await pgEv.waitForTimeout(200);
        const motivoRot = await pgEv.evaluate(() => {
          const input = document.querySelector('[data-e="motivo"]');
          const label = input ? input.closest('.aposta-campo').querySelector('.aposta-campo-rot') : null;
          return label ? label.textContent : '';
        });
        anota('marcar "Não foi possível medir" tira o "(opcional)" de Motivo — passa a ser obrigatório',
          motivoRot === 'Motivo', motivoRot);
        const semMotivo = await pgEv.evaluate(() => ({
          desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
          pendencias: (document.querySelector('[data-evidencia-pendencias]') || {}).textContent || '',
        }));
        anota('marcado "Não foi possível medir" mas sem Motivo, CONTINUAR continua bloqueado',
          semMotivo.desabilitado === true && /Motivo/i.test(semMotivo.pendencias), JSON.stringify(semMotivo));

        await pgEv.fill('[data-e="motivo"]', 'a pesquisa não foi concluída dentro do período do experimento');
        await pgEv.waitForTimeout(200);
        /* "Nossa hipótese foi" já tinha sido escolhida mais acima (para
           testar a habilitação reativa) — é um controle à parte, que não
           reseta ao marcar "Não foi possível medir" nem ao trocar
           observado/fonte por motivo. CONTINUAR já nasce habilitado só
           com "Não foi possível medir" + Motivo, sem precisar de número. */
        const jaTemClassificacao = await pgEv.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
        anota('a classificação escolhida antes continua valendo — não reseta ao marcar "Não foi possível medir"',
          jaTemClassificacao === false, String(jaTemClassificacao));
        await pgEv.locator('#apostaClassificacaoHipotese .aposta-opcao', { hasText: 'Parcialmente sustentada' }).click();
        await pgEv.waitForTimeout(200);
        await pgEv.$eval('#apostaSeguir', (el) => el.click());
        await pgEv.waitForTimeout(300);
        const tituloDepoisCompleto = await pgEv.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('"Não foi possível medir" + Motivo + "Nossa hipótese foi": CONTINUAR libera (não precisa de número)',
          tituloDepoisCompleto !== tituloAntesEv, tituloDepoisCompleto);

        await ctxEv.close();
      }

      /* ── 9a-bis: item 4 do ajuste de fluxo — "AINDA NÃO" no modal
            próprio (não mais window.confirm) mantém a etapa em modo de
            planejamento, sem trocar de estado. ── */
      {
        const semeadoConfirma = apostasSemeadas();
        semeadoConfirma[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoConfirma[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ id: 'r1', direcao: 'Reduzir', indicador: 'contatos sobre o andamento', atual: '1000', meta: '500', unidade: 'contatos', periodo: 'por mês', prazo: '90', prazoUnidade: 'dias' }] },
          experimento: { resultadoIds: ['r1'] },
          evidencia: { itens: [{ resultadoId: 'r1', fontePrevista: 'Dados do sistema' }] },
        };
        const { ctx: ctxConf, page: pgConf } = await novaPagina(browser, formato, DIRETORA, erros, semeadoConfirma);
        await pgConf.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgConf.click('#apostaAbrirBtn');
        await pgConf.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgConf.click('.aposta-grupo-btn');
        await pgConf.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        await pgConf.$eval('#apostaSeguir', (el) => el.click());
        await pgConf.waitForSelector('.aposta-modal-nao-btn', { timeout: 5000 });
        await pgConf.$eval('.aposta-modal-nao-btn', (el) => el.click());
        await pgConf.waitForTimeout(300);
        const aindaNao = await pgConf.evaluate(() => ({
          temCampoObservado: !!document.querySelector('[data-e="observado"]'),
          banner: (document.querySelector('.aposta-campos .aposta-herdada') || {}).textContent || '',
          /* .modal-overlay sozinho pegaria o #authModal escondido de
             index.html, sempre presente no DOM — precisa escopar pela
             classe própria deste modal. */
          modalFechado: !document.querySelector('.aposta-confirmar-overlay'),
        }));
        anota('"AINDA NÃO" no modal fecha o modal e mantém a etapa em planejamento, sem mudar de modo',
          aindaNao.modalFechado && !aindaNao.temCampoObservado && /PLANEJAMENTO DA EVID[ÊE]NCIA/.test(aindaNao.banner), JSON.stringify(aindaNao));
        await ctxConf.close();
      }

      /* ── 9a-ter: item 2 do ajuste de fluxo — "Encerrar por agora"
            fecha a tela cheia da dinâmica e o aviso de sucesso sobrevive
            ao fechamento, aparecendo já na página de Treinamento por
            trás (não é mais preso a _tela, que é removida). ── */
      {
        const semeadoSair = apostasSemeadas();
        semeadoSair[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoSair[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ id: 'r1', direcao: 'Reduzir', indicador: 'contatos sobre o andamento', atual: '1000', meta: '500', unidade: 'contatos', periodo: 'por mês', prazo: '90', prazoUnidade: 'dias' }] },
          experimento: { resultadoIds: ['r1'] },
        };
        const { ctx: ctxSair, page: pgSair } = await novaPagina(browser, formato, DIRETORA, erros, semeadoSair);
        await pgSair.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgSair.click('#apostaAbrirBtn');
        await pgSair.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgSair.click('.aposta-grupo-btn');
        await pgSair.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        /* O bloco "Encerrar por agora" só aparece na transição AO VIVO
           para "pronta" (ver blocoPlanoProntoHtml) — dados semeados já
           completos entram direto no modo "retomando", sem o botão
           (item 3 do ajuste de fluxo, já coberto por outro teste). Por
           isso completa a Fonte prevista aqui em vez de semear pronta. */
        await pgSair.selectOption('[data-e="fontePrevista"]', 'Dados do sistema');
        await pgSair.waitForSelector('#apostaSairEvidencia', { timeout: 15000 });
        await pgSair.click('#apostaSairEvidencia');
        await pgSair.waitForTimeout(300);
        const posSaida = await pgSair.evaluate(() => ({
          telaFechada: !document.querySelector('.aposta-tela'),
          toastTxt: (document.querySelector('.aposta-toast--persistente') || {}).textContent || '',
          toastForaDaTela: !!document.querySelector('body > .aposta-toast--persistente'),
        }));
        anota('"Encerrar por agora" fecha a dinâmica e mostra o aviso de sucesso já na página de trás (Treinamento)',
          posSaida.telaFechada && /Planejamento salvo/i.test(posSaida.toastTxt) && posSaida.toastForaDaTela, JSON.stringify(posSaida));
        await pgSair.click('.aposta-toast-fechar');
        await pgSair.waitForTimeout(100);
        const toastFechado = await pgSair.evaluate(() => !document.querySelector('.aposta-toast--persistente'));
        anota('o aviso persistente pode ser fechado pelo botão ✕', toastFechado);
        await ctxSair.close();
      }

      /* ── 9c: "Manter" na Evidência usa mensagem própria por tipo de
            limite — nunca percentual de progresso. ── */
      for (const cenario of [
        { tipoLimite: 'Pelo menos', meta: '90', observado: '95', esperado: 'O resultado permaneceu dentro da condição que queríamos manter.' },
        { tipoLimite: 'Pelo menos', meta: '90', observado: '85', esperado: 'O resultado ficou abaixo da condição que queríamos manter.' },
        { tipoLimite: 'No máximo', meta: '670', observado: '600', esperado: 'O resultado permaneceu dentro da condição que queríamos manter.' },
        { tipoLimite: 'No máximo', meta: '670', observado: '700', esperado: 'O resultado ficou acima da condição que queríamos manter.' },
        { tipoLimite: 'Entre', limiteMinimo: '8', limiteMaximo: '12', observado: '10', esperado: 'O resultado permaneceu dentro da condição que queríamos manter.' },
        { tipoLimite: 'Entre', limiteMinimo: '8', limiteMaximo: '12', observado: '15', esperado: 'O resultado ficou fora da condição que queríamos manter.' },
      ]) {
        const semeadoManter = apostasSemeadas();
        semeadoManter[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoManter[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{
            id: 'rm', direcao: 'Manter', tipoLimite: cenario.tipoLimite,
            indicador: 'índice de satisfação', atual: '10',
            meta: cenario.meta, limiteMinimo: cenario.limiteMinimo, limiteMaximo: cenario.limiteMaximo,
            prazo: '90', prazoUnidade: 'dias',
          }] },
          experimento: { resultadoIds: ['rm'] },
        };
        const { ctx: ctxM, page: pgM } = await novaPagina(browser, formato, DIRETORA, erros, semeadoManter);
        await pgM.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgM.click('#apostaAbrirBtn');
        await pgM.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgM.click('.aposta-grupo-btn');
        await pgM.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        await pgM.selectOption('[data-e="fontePrevista"]', 'Dados do sistema');
        await pgM.waitForTimeout(200);
        await pgM.$eval('#apostaSeguir', (el) => el.click());
        await pgM.waitForSelector('.aposta-modal-sim-btn', { timeout: 5000 });
        await pgM.$eval('.aposta-modal-sim-btn', (el) => el.click());
        await pgM.waitForTimeout(300);
        await pgM.fill('[data-e="observado"]', cenario.observado);
        await pgM.waitForTimeout(300);
        const msgManter = await pgM.evaluate(() =>
          ((document.querySelector('.aposta-frase-pronta, .aposta-frase-falta') || {}).textContent || ''));
        anota('"Manter" (' + cenario.tipoLimite + ', observado ' + cenario.observado + ') mostra a mensagem certa, sem percentual',
          msgManter === cenario.esperado, msgManter);
        await ctxM.close();
      }

      /* ── 9b: o Experimento pode observar vários resultados esperados de
            uma vez — cada um vira o seu próprio card na Evidência, com
            dados independentes. ── */
      {
        const semeadoVarios = apostasSemeadas();
        semeadoVarios[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoVarios[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [
            { id: 'r1', direcao: 'Reduzir', indicador: 'contatos sobre o andamento', atual: '1000', meta: '500', unidade: 'contatos', periodo: 'por mês', prazo: '90', prazoUnidade: 'dias' },
            { id: 'r2', direcao: 'Aumentar', indicador: 'participantes que sabem a etapa', atual: '40', meta: '80', unidade: '%', prazo: '90', prazoUnidade: 'dias' },
          ] },
          experimento: { resultadoIds: ['r1', 'r2'] },
          evidencia: { itens: [{ resultadoId: 'r1', observado: '650' }] },
        };
        const { ctx: ctxV, page: pgV } = await novaPagina(browser, formato, DIRETORA, erros, semeadoVarios);
        await pgV.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgV.click('#apostaAbrirBtn');
        await pgV.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgV.click('.aposta-grupo-btn');
        await pgV.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const cards = await pgV.evaluate(() => Array.from(document.querySelectorAll('.aposta-mudanca[data-resultado]')).map((b) => ({
          resultado: b.dataset.resultado,
          observado: (b.querySelector('[data-e="observado"]') || {}).value || '',
        })));
        anota('dois resultados selecionados no Experimento viram dois cards na Evidência',
          cards.length === 2 && cards[0].resultado === 'r1' && cards[0].observado === '650' &&
          cards[1].resultado === 'r2' && cards[1].observado === '',
          JSON.stringify(cards));
        /* r1 já tinha resultado observado — a etapa inteira (não só o
           card de r1) já nasce no modo de registro, então o campo de r2
           já existe também, sem precisar de nenhum clique extra. */
        await pgV.fill('[data-resultado="r2"] [data-e="observado"]', '76');
        await pgV.waitForTimeout(300);
        const r1Intacto = await pgV.evaluate(() => (document.querySelector('[data-resultado="r1"] [data-e="observado"]') || {}).value || '');
        anota('preencher o segundo card não mexe no primeiro — cada card guarda o seu', r1Intacto === '650', 'ficou "' + r1Intacto + '"');
        await ctxV.close();
      }

      /* ── 9b2: NPS (Forma de medição "Índice", Unidade "NPS") não leva
            sufixo nenhum em "O que vamos observar?" nem na Evidência —
            nem unidade, nem período — porque o indicador já aparece
            como título em todo lugar que mostraria esse sufixo. ── */
      {
        const semeadoNps = apostasSemeadas();
        semeadoNps[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'experimento';
        semeadoNps[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ id: 'rnps', direcao: 'Aumentar', indicador: 'NPS', formaMedicao: 'Índice', unidade: 'NPS', atual: '5', meta: '7', periodo: 'por mês', prazo: '90', prazoUnidade: 'dias' }] },
        };
        const { ctx: ctxNpsExp, page: pgNpsExp } = await novaPagina(browser, formato, DIRETORA, erros, semeadoNps);
        await pgNpsExp.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgNpsExp.click('#apostaAbrirBtn');
        await pgNpsExp.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgNpsExp.click('.aposta-grupo-btn');
        await pgNpsExp.waitForFunction(() =>
          /EXPERIMENTO/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const itemNps = await pgNpsExp.evaluate(() => {
          const item = document.querySelector('.aposta-resultado-item');
          return item ? { titulo: (item.querySelector('strong') || {}).textContent || '', resumo: (item.querySelector('.aposta-resultado-txt span:last-child') || {}).textContent || '' } : null;
        });
        anota('"O que vamos observar?" mostra NPS sem sufixo — "5 → 7", nunca "5 → 7 NPS por mês"',
          !!itemNps && itemNps.titulo === 'NPS' && itemNps.resumo.trim() === '5 → 7',
          JSON.stringify(itemNps));
        await ctxNpsExp.close();

        const semeadoNpsEv = apostasSemeadas();
        semeadoNpsEv[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoNpsEv[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ id: 'rnps', direcao: 'Aumentar', indicador: 'NPS', formaMedicao: 'Índice', unidade: 'NPS', atual: '5', meta: '7', periodo: 'por mês', prazo: '90', prazoUnidade: 'dias' }] },
          experimento: { resultadoIds: ['rnps'] },
          evidencia: { itens: [{ resultadoId: 'rnps', observado: '6', fonte: 'Pesquisa com participantes' }] },
        };
        const { ctx: ctxNpsEv, page: pgNpsEv } = await novaPagina(browser, formato, DIRETORA, erros, semeadoNpsEv);
        await pgNpsEv.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgNpsEv.click('#apostaAbrirBtn');
        await pgNpsEv.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgNpsEv.click('.aposta-grupo-btn');
        await pgNpsEv.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const cardNps = await pgNpsEv.evaluate(() => {
          const bloco = document.querySelector('.aposta-mudanca[data-resultado]');
          if (!bloco) return null;
          const campos = Array.from(bloco.querySelectorAll('.aposta-campo-input[disabled]')).map((e) => e.value);
          return { inicial: campos[0] || '', meta: campos[1] || '', frase: (bloco.querySelector('.aposta-mudanca-frase') || {}).textContent || '' };
        });
        anota('a Evidência mostra Inicial/Meta do NPS sem sufixo ("5", "7", não "5 NPS", "7 NPS")',
          !!cardNps && cardNps.inicial === '5' && cardNps.meta === '7', JSON.stringify(cardNps));
        anota('a frase da evidência não anexa período incompatível nem repete a unidade ao NPS',
          !!cardNps && /Esperávamos aumentar NPS de 5 para 7\./.test(cardNps.frase) &&
            /observamos 6\./.test(cardNps.frase) &&
            !/por (dia|semana|m[êe]s|trimestre|semestre|ano)/i.test(cardNps.frase) &&
            !/6 NPS/.test(cardNps.frase),
          cardNps ? cardNps.frase : '');
        await ctxNpsEv.close();
      }

      /* ── 9c: "Não foi possível medir" desliga os campos que ele torna
            irrelevantes (observado, fonte, detalhe) e a frase passa a
            dizer isso, sem exigir um número que não existe — ausência de
            evidência também é uma informação. ── */
      {
        const semeadoNM = apostasSemeadas();
        semeadoNM[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoNM[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ id: 'r1', direcao: 'Aumentar', indicador: 'satisfação com a comunicação', atual: '6,2', meta: '8', unidade: 'pontos', prazo: '90', prazoUnidade: 'dias' }] },
          experimento: { resultadoIds: ['r1'] },
        };
        const { ctx: ctxNM, page: pgNM } = await novaPagina(browser, formato, DIRETORA, erros, semeadoNM);
        await pgNM.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgNM.click('#apostaAbrirBtn');
        await pgNM.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgNM.click('.aposta-grupo-btn');
        await pgNM.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        await pgNM.selectOption('[data-e="fontePrevista"]', 'Dados do sistema');
        await pgNM.waitForTimeout(200);
        await pgNM.$eval('#apostaSeguir', (el) => el.click());
        await pgNM.waitForSelector('.aposta-modal-sim-btn', { timeout: 5000 });
        await pgNM.$eval('.aposta-modal-sim-btn', (el) => el.click());
        await pgNM.waitForTimeout(300);
        await pgNM.fill('[data-e="motivo"]', 'Pesquisa de satisfação não foi concluída dentro do período.');
        await pgNM.click('[data-e="naoMedido"]');
        await pgNM.waitForTimeout(300);
        const desligado = await pgNM.evaluate(() => ({
          observado: (document.querySelector('[data-e="observado"]') || {}).disabled,
          fonte: (document.querySelector('[data-e="fonte"]') || {}).disabled,
          frase: (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '',
        }));
        anota('"Não foi possível medir" desliga o resultado observado e a fonte',
          desligado.observado && desligado.fonte, JSON.stringify(desligado));
        anota('a frase da evidência diz que não foi possível medir, com o motivo',
          /Não foi possível medir neste experimento \(Pesquisa de satisfação/.test(desligado.frase), desligado.frase);
        await pgNM.locator('#apostaClassificacaoHipotese .aposta-opcao', { hasText: 'Não sustentada' }).click();
        await pgNM.waitForTimeout(200);
        const tituloAntesNM = await pgNM.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        await pgNM.$eval('#apostaSeguir', (el) => el.click());
        await pgNM.waitForTimeout(300);
        const tituloDepoisNM = await pgNM.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('"não foi possível medir" + motivo + "Nossa hipótese foi" também libera Continuar (é a outra forma válida de completar)',
          tituloDepoisNM !== tituloAntesNM, tituloDepoisNM);
        await ctxNM.close();
      }

      /* ── 9e: uma mudança gravada antes de existir o campo Período — a
            cadência ("por mês") morava dentro de Unidade (PR #165/#171).
            Reabrir essa mudança precisa mostrar "por mês" no campo
            Período, não em Unidade, senão os dois campos saem trocados
            para quem só está reabrindo o que já tinha escrito. ── */
      {
        const semeadoLegado = apostasSemeadas();
        semeadoLegado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'mudancas';
        semeadoLegado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ direcao: 'Reduzir', indicador: 'contatos sobre andamento', atual: '1000', meta: '700', unidade: 'por mês', prazo: '90', prazoUnidade: 'dias' }] },
        };
        const { ctx: ctxL, page: pgL } = await novaPagina(browser, formato, DIRETORA, erros, semeadoLegado);
        await pgL.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgL.click('#apostaAbrirBtn');
        await pgL.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgL.click('.aposta-grupo-btn');
        await pgL.waitForFunction(() =>
          /MUDAN[ÇC]AS MENSUR[ÁA]VEIS/i.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const legado = await pgL.evaluate(() => ({
          unidade: (document.querySelector('[data-m="unidade"]') || {}).value || '',
          periodo: (document.querySelector('[data-m="periodo"]') || {}).value || '',
        }));
        anota('mudança antiga com "por mês" em Unidade reabre com isso em Período, não em Unidade',
          legado.unidade === '' && legado.periodo === 'por mês', JSON.stringify(legado));
        await ctxL.close();
      }

      /* ── 9f: DECISÃO — frase estrita, bloqueio, placeholder dinâmico,
            contexto da Evidência (fonte + aprendizado por resultado, e a
            classificação ÚNICA "Nossa hipótese foi" do conjunto) e os
            dois alertas de coerência não-bloqueantes (Ampliar sem meta
            batida, Prazo × Data de reavaliação). Semeado com um
            resultado que NÃO bateu a meta (Reduzir 1000→500, observado
            800 = 40%), para exercitar exatamente a contradição que o
            alerta cobre. ── */
      {
        const semeadoDec = apostasSemeadas();
        semeadoDec[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'decisao';
        semeadoDec[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ id: 'r1', direcao: 'Reduzir', indicador: 'contatos sobre andamento', atual: '1000', meta: '500', unidade: 'contatos', periodo: 'por mês' }] },
          experimento: { resultadoIds: ['r1'] },
          evidencia: {
            itens: [{ resultadoId: 'r1', observado: '800', fonte: 'Relatório', aprendizado: 'a redução ainda não foi suficiente para confirmar a hipótese' }],
            classificacao: 'Parcialmente sustentada',
          },
        };
        const { ctx: ctxDec, page: pgDec } = await novaPagina(browser, formato, DIRETORA, erros, semeadoDec);
        await pgDec.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgDec.click('#apostaAbrirBtn');
        await pgDec.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgDec.click('.aposta-grupo-btn');
        await pgDec.waitForFunction(() =>
          /DECIS[ÃA]O/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });

        const contexto = await pgDec.evaluate(() =>
          ((document.querySelector('.aposta-conexao') || {}).textContent || '').replace(/\s+/g, ' '));
        anota('a Decisão mostra a fonte e o aprendizado registrados na Evidência, mais a classificação única do conjunto',
          /Fonte: Relat[óo]rio/i.test(contexto) &&
          /a redução ainda não foi suficiente/i.test(contexto) &&
          /Nossa hip[óo]tese foi:\s*Parcialmente sustentada/i.test(contexto),
          contexto.slice(0, 260));

        const semNada = await pgDec.evaluate(() =>
          ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
        anota('Decisão sem nada escolhido não mostra a frase com lacunas — só a orientação do que falta',
          semNada === 'Fica assim no mapaEscolha o que faremos com base no que aprendemos.', semNada);

        const tituloAntesDec = await pgDec.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        await pgDec.$eval('#apostaSeguir', (el) => el.click());
        await pgDec.waitForTimeout(300);
        const tituloDepoisSemEscolha = await pgDec.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('Decisão sem decisão escolhida bloqueia CONTINUAR/VER O MAPA, sem escape por segundo clique', tituloDepoisSemEscolha === tituloAntesDec);

        await pgDec.locator('.aposta-opcao', { hasText: 'Ajustar e testar novamente' }).click();
        await pgDec.waitForTimeout(200);
        const placeholderAjustar = await pgDec.evaluate(() => (document.getElementById('ap-proximaAcao') || {}).placeholder || '');
        anota('o exemplo de "Próxima ação" muda com a decisão escolhida',
          placeholderAjustar === 'ajustar a comunicação e repetir o teste com um grupo maior', placeholderAjustar);
        const soFaltaAcao = await pgDec.evaluate(() =>
          ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
        /* Fase 4: "Ajustar e testar novamente" também pede o ponto de
           reinício (item 20 do pedido) — com os dois faltando, a
           orientação lista os dois, não só a próxima ação. */
        anota('com a decisão escolhida mas sem próxima ação nem ponto de reinício, a orientação pede os dois',
          soFaltaAcao === 'Fica assim no mapaEscolha o que precisa ser revisto e defina a próxima ação para completar a decisão.', soFaltaAcao);
        await pgDec.$eval('#apostaSeguir', (el) => el.click());
        await pgDec.waitForTimeout(300);
        const tituloDepoisSemAcao = await pgDec.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('Decisão com decisão escolhida mas sem próxima ação continua bloqueando', tituloDepoisSemAcao === tituloAntesDec);

        /* "Ampliar" com uma meta que não foi batida: alerta não-bloqueante,
           com os dois botões — nunca muda a decisão sozinho. */
        await pgDec.locator('.aposta-opcao', { hasText: 'Ampliar' }).click();
        await pgDec.waitForTimeout(200);
        /* Item 3 do ajuste de Decisão: microexplicação sempre visível
           embaixo dos botões, com o texto exato pedido — não é a mesma
           coisa que a dica em title (hover). */
        const explicacaoAmpliar = await pgDec.evaluate(() =>
          (document.querySelector('[data-escolha-explicacao]') || {}).textContent || '');
        anota('escolher "Ampliar" mostra a microexplicação exata embaixo dos botões',
          explicacaoAmpliar === 'As evidências são suficientes para aumentar a escala da aposta.', explicacaoAmpliar);
        const alertaAmpliar = await pgDec.evaluate(() => {
          const el = document.getElementById('apostaDecisaoAlerta');
          return el ? { texto: el.textContent.replace(/\s+/g, ' '), botoes: Array.from(el.querySelectorAll('button')).map((b) => b.textContent.trim()) } : null;
        });
        anota('escolher "Ampliar" sem a meta batida mostra o alerta de coerência, com os dois botões',
          !!alertaAmpliar && /Ampliar/.test(alertaAmpliar.texto) &&
          alertaAmpliar.botoes.includes('MANTER AMPLIAR') && alertaAmpliar.botoes.includes('REVER DECISÃO'),
          JSON.stringify(alertaAmpliar));

        await pgDec.locator('#apostaDecisaoAlerta button', { hasText: 'MANTER AMPLIAR' }).click();
        await pgDec.waitForTimeout(150);
        const decisaoContinuaAmpliar = await pgDec.evaluate(() => {
          const ativa = document.querySelector('.aposta-opcao.is-ativa');
          const alerta = document.getElementById('apostaDecisaoAlerta');
          return { valor: ativa ? ativa.dataset.valor : '', alertaVazio: !alerta || !alerta.textContent.trim() };
        });
        anota('"MANTER AMPLIAR" só dispensa o alerta — não muda a decisão escolhida',
          decisaoContinuaAmpliar.valor === 'Ampliar' && decisaoContinuaAmpliar.alertaVazio, JSON.stringify(decisaoContinuaAmpliar));

        await pgDec.locator('.aposta-opcao', { hasText: 'Ampliar' }).click();
        await pgDec.waitForTimeout(200);
        await pgDec.locator('#apostaDecisaoAlerta button', { hasText: 'REVER DECISÃO' }).click();
        await pgDec.waitForTimeout(150);
        const depoisDeRever = await pgDec.evaluate(() => ({
          ativa: !!document.querySelector('.aposta-opcao.is-ativa'),
          frase: ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '),
          alertaVazio: !(document.getElementById('apostaDecisaoAlerta') || {}).textContent.trim(),
        }));
        anota('"REVER DECISÃO" limpa a decisão escolhida, para o grupo escolher de novo',
          !depoisDeRever.ativa && depoisDeRever.frase === 'Fica assim no mapaEscolha o que faremos com base no que aprendemos.' && depoisDeRever.alertaVazio,
          JSON.stringify(depoisDeRever));

        /* Prazo × Data de reavaliação: sugestão quando só o Prazo está
           preenchido, alerta (sem trocar nada sozinho) quando os dois
           não combinam. */
        await pgDec.fill('[data-campo="prazo"]', '10');
        await pgDec.selectOption('[data-campo="prazoUnidade"]', 'dias');
        await pgDec.waitForTimeout(250);
        const sugestaoPrazo = await pgDec.evaluate(() => {
          const el = document.getElementById('apostaPrazoAlerta');
          return el ? { texto: el.textContent.replace(/\s+/g, ' '), temBotaoUsar: !!el.querySelector('[data-prazo-usar]') } : null;
        });
        anota('só com o Prazo preenchido, sugere a Data de reavaliação (sem preencher sozinho)',
          !!sugestaoPrazo && /reavalia[çc][ãa]o/i.test(sugestaoPrazo.texto) && sugestaoPrazo.temBotaoUsar &&
          !(await pgDec.evaluate(() => (document.getElementById('ap-reavaliacao') || {}).value || '')),
          JSON.stringify(sugestaoPrazo));

        await pgDec.$eval('#apostaPrazoAlerta [data-prazo-usar]', (el) => el.click());
        await pgDec.waitForTimeout(250);
        const depoisDeUsar = await pgDec.evaluate(() => ({
          reavaliacao: (document.getElementById('ap-reavaliacao') || {}).value || '',
          alertaVazio: !(document.getElementById('apostaPrazoAlerta') || {}).textContent.trim(),
        }));
        anota('"Usar" a sugestão preenche a Data de reavaliação e o alerta some',
          /^\d{2}\/\d{2}\/\d{4}$/.test(depoisDeUsar.reavaliacao) && depoisDeUsar.alertaVazio, JSON.stringify(depoisDeUsar));

        await pgDec.fill('[data-campo="reavaliacao"]', '01012099');
        await pgDec.waitForTimeout(250);
        const conflito = await pgDec.evaluate(() => {
          const el = document.getElementById('apostaPrazoAlerta');
          return el ? { texto: el.textContent.replace(/\s+/g, ' '), botoes: Array.from(el.querySelectorAll('button')).map((b) => b.textContent.trim()) } : null;
        });
        anota('Prazo e Data de reavaliação incompatíveis avisam sem trocar nada sozinho',
          !!conflito && /n[ãa]o bate com o prazo/i.test(conflito.texto) && conflito.botoes.some((b) => /^Manter/.test(b)),
          JSON.stringify(conflito));
        await pgDec.locator('#apostaPrazoAlerta button', { hasText: /^Manter/ }).click();
        await pgDec.waitForTimeout(150);
        const dataMantida = await pgDec.evaluate(() => (document.getElementById('ap-reavaliacao') || {}).value || '');
        anota('"Manter" a data informada não a substitui pela sugestão', dataMantida === '01/01/2099', dataMantida);

        /* Data da Decisão: auditoria automática de quando a decisão foi
           registrada — nunca digitada, e diferente da Data de
           reavaliação (quando o grupo PRETENDE voltar a olhar). */
        await pgDec.locator('.aposta-opcao', { hasText: 'Ajustar e testar novamente' }).click();
        await pgDec.fill('[data-campo="proximaAcao"]', 'revisar a comunicação e repetir o teste');
        /* Fase 4: "Ajustar e testar novamente" só libera CONTINUAR com um
           ponto de reinício escolhido. */
        await pgDec.locator('.aposta-opcao', { hasText: 'Experimento' }).click();
        await pgDec.waitForTimeout(250);
        await pgDec.$eval('#apostaSeguir', (el) => el.click());
        await pgDec.waitForTimeout(400);
        const dataDecisaoGravada = await pgDec.evaluate(() => {
          var escritas = (window.__ESCRITAS || []).filter((x) => /\/dados\/decisao$/.test(x.path));
          var ultima = escritas[escritas.length - 1];
          return ultima ? (ultima.valor || {}).dataDecisao || null : null;
        });
        anota('a Data da Decisão é gravada sozinha quando a Decisão avança, sem o grupo digitar nada',
          !!dataDecisaoGravada && !isNaN(Date.parse(dataDecisaoGravada)), JSON.stringify(dataDecisaoGravada));

        await ctxDec.close();
      }

      /* ── 9g: DECISÃO — "Reformular a hipótese" (item 5 do ajuste):
            bloco auto-aberto, pendências combinadas (nova hipótese +
            próxima ação), botão reage a cada tecla e a cada troca de
            decisão — nunca só ao clicar em CONTINUAR. ── */
      {
        const semeadoRef = apostasSemeadas();
        semeadoRef[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'decisao';
        semeadoRef[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ id: 'r1', direcao: 'Reduzir', indicador: 'contatos sobre andamento', atual: '1000', meta: '500', unidade: 'contatos', periodo: 'por mês' }] },
          experimento: { resultadoIds: ['r1'] },
          evidencia: { itens: [{ resultadoId: 'r1', observado: '800', fonte: 'Relatório', aprendizado: 'ainda não confirma a hipótese' }] },
        };
        const { ctx: ctxRef, page: pgRef } = await novaPagina(browser, formato, DIRETORA, erros, semeadoRef);
        await pgRef.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgRef.click('#apostaAbrirBtn');
        await pgRef.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgRef.click('.aposta-grupo-btn');
        await pgRef.waitForFunction(() =>
          /DECIS[ÃA]O/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });

        await pgRef.locator('.aposta-opcao', { hasText: 'Reformular a hipótese' }).click();
        await pgRef.waitForTimeout(200);
        const explicacaoRef = await pgRef.evaluate(() =>
          (document.querySelector('[data-escolha-explicacao]') || {}).textContent || '');
        anota('escolher "Reformular a hipótese" mostra a microexplicação exata embaixo dos botões',
          explicacaoRef === 'A evidência sugere que nossa explicação para o problema precisa mudar.', explicacaoRef);

        const semNadaRef = await pgRef.evaluate(() =>
          ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
        anota('"Reformular a hipótese" sem nova hipótese nem próxima ação mostra as duas pendências juntas',
          semNadaRef === 'Fica assim no mapaDefina a nova hipótese e a próxima ação para completar a decisão.', semNadaRef);
        const desabilitadoSemNada = await pgRef.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
        anota('"Reformular a hipótese" sem nada preenchido: CONTINUAR nasce desabilitado de verdade', desabilitadoSemNada === true);

        await pgRef.fill('[data-campo="proximaAcao"]', 'testar a nova hipótese com um novo experimento');
        await pgRef.waitForTimeout(250);
        const soFaltaNovaHip = await pgRef.evaluate(() => ({
          frase: ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '),
          desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
        }));
        anota('preencher só a próxima ação: pendência passa a pedir só a nova hipótese, e CONTINUAR continua bloqueado (reativo, sem clicar em CONTINUAR)',
          soFaltaNovaHip.frase === 'Fica assim no mapaDefina a nova hipótese para completar a decisão.' && soFaltaNovaHip.desabilitado === true,
          JSON.stringify(soFaltaNovaHip));

        await pgRef.fill('[data-campo="proxHipCausa"]', 'a mensagem não chega a quem está em análise');
        await pgRef.fill('[data-campo="proxHipIndicio"]', 'os contatos caíram só no grupo que recebeu a mensagem');
        await pgRef.waitForTimeout(250);
        const comTudo = await pgRef.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
        anota('preencher também a nova hipótese habilita CONTINUAR de verdade, reativo (sem clicar em CONTINUAR nem recarregar)',
          comTudo === false, String(comTudo));

        /* Apagar a nova hipótese depois de já ter preenchido: o botão
           tem de voltar a desabilitar na hora — mesma exigência já
           cobrada da Evidência (item 9 do ajuste de fluxo anterior),
           agora também na Decisão. */
        await pgRef.fill('[data-campo="proxHipCausa"]', '');
        await pgRef.waitForTimeout(250);
        const apagouCausa = await pgRef.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
        anota('apagar a nova hipótese depois de preenchida volta a desabilitar CONTINUAR imediatamente', apagouCausa === true);
        await pgRef.fill('[data-campo="proxHipCausa"]', 'a mensagem não chega a quem está em análise');
        await pgRef.waitForTimeout(250);

        /* Item 6/9: trocar para outra decisão (com a próxima ação já
           preenchida) tem de reavaliar CONTINUAR na hora do clique — não
           só a Nova Hipótese recolher visualmente. Antes deste ajuste, o
           clique só atualizava a frase/os grupos, nunca o disabled. */
        await pgRef.locator('.aposta-opcao', { hasText: 'Ampliar' }).click();
        await pgRef.waitForTimeout(200);
        const trocouParaAmpliar = await pgRef.evaluate(() => ({
          desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
          novaHipVisivel: !(document.getElementById('apostaGrupoNovaHipotese') || {}).hidden,
          causaPreservada: (document.getElementById('ap-proxHipCausa') || {}).value || '',
        }));
        anota('trocar para "Ampliar" com a próxima ação já preenchida habilita CONTINUAR na hora do clique (sem precisar digitar de novo)',
          trocouParaAmpliar.desabilitado === false, JSON.stringify(trocouParaAmpliar));
        anota('trocar para "Ampliar" esconde de novo o bloco da Nova Hipótese', !trocouParaAmpliar.novaHipVisivel);

        await pgRef.locator('.aposta-opcao', { hasText: 'Reformular a hipótese' }).click();
        await pgRef.waitForTimeout(200);
        const voltouPraReformular = await pgRef.evaluate(() => ({
          causaPreservada: (document.getElementById('ap-proxHipCausa') || {}).value || '',
          desabilitado: (document.getElementById('apostaSeguir') || {}).disabled,
        }));
        anota('voltar para "Reformular a hipótese" preserva o texto já digitado da nova hipótese e reabilita CONTINUAR na hora',
          voltouPraReformular.causaPreservada === 'a mensagem não chega a quem está em análise' && voltouPraReformular.desabilitado === false,
          JSON.stringify(voltouPraReformular));

        await ctxRef.close();
      }

      /* ── 9h: concordância singular/plural nas frases automáticas
            (item 1 do ajuste) — via window.faAposta._resumo, sem precisar
            de UI: "1 contato" e "2 contatos", nunca "1 contatos". ── */
      {
        const semeadoSingular = apostasSemeadas();
        const { ctx: ctxSing, page: pgSing } = await novaPagina(browser, formato, DIRETORA, erros, semeadoSingular);
        await pgSing.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgSing.waitForFunction(() => !!(window.faAposta && window.faAposta._resumo), { timeout: 15000 });
        const singularTxt = await pgSing.evaluate(() => window.faAposta._resumo('evidencia', {
          mudancas: { itens: [{ id: 'r1', direcao: 'Aumentar', indicador: 'contatos sobre andamento', atual: '0', meta: '2', unidade: 'contatos', periodo: 'por dia' }] },
          experimento: { resultadoIds: ['r1'] },
          evidencia: { itens: [{ resultadoId: 'r1', observado: '1', fonte: 'Relatório' }] },
        }));
        anota('concordância: "observamos 1 contato por dia" (singular quando o valor é 1, nunca "1 contatos")',
          /observamos 1 contato por dia\b/.test(singularTxt) && !/1 contatos\b/.test(singularTxt), singularTxt);
        const pluralTxt = await pgSing.evaluate(() => window.faAposta._resumo('evidencia', {
          mudancas: { itens: [{ id: 'r1', direcao: 'Aumentar', indicador: 'contatos sobre andamento', atual: '0', meta: '2', unidade: 'contatos', periodo: 'por dia' }] },
          experimento: { resultadoIds: ['r1'] },
          evidencia: { itens: [{ resultadoId: 'r1', observado: '2', fonte: 'Relatório' }] },
        }));
        anota('concordância: valores maiores que 1 continuam no plural ("2 contatos por dia")',
          /observamos 2 contatos por dia\b/.test(pluralTxt), pluralTxt);
        /* partesMudanca()/numeroComUnidade() concordam a situação atual e
           a meta CADA UMA com seu próprio valor (a frase repete a
           unidade nos dois números, de propósito — ver comentário em
           partesMudanca) — testa o outro ponto do fix, independente do
           "observamos X" acima. */
        const situacaoSingular = await pgSing.evaluate(() => window.faAposta._resumo('evidencia', {
          mudancas: { itens: [{ id: 'r1', direcao: 'Aumentar', indicador: 'contatos sobre andamento', atual: '1', meta: '2', unidade: 'contatos', periodo: 'por dia' }] },
          experimento: { resultadoIds: ['r1'] },
          /* resumoEtapa('evidencia',...) cai em "aguardando execução" sem
             observado — precisa de um valor (qualquer um) só para
             alcançar a frase "Esperávamos..." que este teste quer ler. */
          evidencia: { itens: [{ resultadoId: 'r1', observado: '3', fonte: 'Relatório' }] },
        }));
        anota('concordância na situação inicial da frase "Esperávamos...": "de 1 contato por dia para 2 contatos por dia" (cada número concorda com o próprio valor)',
          /de 1 contato por dia para 2 contatos por dia\b/.test(situacaoSingular), situacaoSingular);
        await ctxSing.close();
      }

      /* ── 9i: FASE 1 da evolução de execuções — "Reiniciar dinâmica"
            virou "Iniciar nova execução", com confirmação em modal
            próprio (não mais window.confirm) e ciclo de vida real:
            encerra formalmente a execução anterior (status/encerradaEm/
            encerradaPor) e cria a nova já com status "ativa" e número —
            tudo preservado, nada apagado. ── */
      {
        const semeadoExec = apostasSemeadas();
        semeadoExec[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'sintoma';
        semeadoExec[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          missao: { verbo: 'melhorar', oQue: 'o atendimento', contexto: 'na oficina', prazo: '90', prazoUnidade: 'dias' },
        };
        const { ctx: ctxExec, page: pgExec } = await novaPagina(browser, formato, ADM, erros, semeadoExec);
        await pgExec.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgExec.click('#apostaAbrirBtn');
        await pgExec.waitForSelector('#apostaPainelBtn', { timeout: 15000 });
        await pgExec.click('#apostaPainelBtn');
        await pgExec.waitForSelector('#apostaReiniciar', { timeout: 15000 });

        const botaoRenomeado = await pgExec.evaluate(() => {
          const btn = document.getElementById('apostaReiniciar');
          const aviso = btn ? btn.closest('div').previousElementSibling : null;
          return { texto: btn ? btn.textContent : '', aviso: aviso ? aviso.textContent : '' };
        });
        anota('"Reiniciar dinâmica" virou "Iniciar nova execução", com o aviso atualizado',
          botaoRenomeado.texto === 'Iniciar nova execução' && /encerra a atual/i.test(botaoRenomeado.aviso),
          JSON.stringify(botaoRenomeado));

        await pgExec.click('#apostaReiniciar');
        await pgExec.waitForSelector('.aposta-confirmar-overlay .modal-box', { timeout: 5000 });
        const modalTxt = await pgExec.evaluate(() => (document.querySelector('.aposta-confirmar-overlay .modal-box') || {}).textContent || '');
        anota('clicar em "Iniciar nova execução" abre um modal próprio (não window.confirm), com o texto da confirmação',
          /Deseja iniciar uma nova execução/.test(modalTxt) && /ser[áa] encerrada/i.test(modalTxt) &&
          /ENCERRAR E INICIAR NOVA EXECU[ÇC][ÃA]O/.test(modalTxt),
          modalTxt);

        await pgExec.$eval('.aposta-confirmar-overlay .aposta-modal-nao-btn', (el) => el.click());
        await pgExec.waitForTimeout(250);
        const atualAposCancelar = await pgExec.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/atual').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        anota('"CANCELAR" não cria execução nenhuma nem muda "atual"', atualAposCancelar === EXEC, atualAposCancelar);

        await pgExec.click('#apostaReiniciar');
        await pgExec.waitForSelector('.aposta-confirmar-overlay .modal-box', { timeout: 5000 });
        await pgExec.$eval('.aposta-confirmar-overlay .aposta-modal-sim-btn', (el) => el.click());
        await pgExec.waitForTimeout(600);

        const estadoDepois = await pgExec.evaluate(({ turmaKey, execAntigo }) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey).once('value', (s) => {
            const v = s.val() || {};
            const antiga = (v.execucoes || {})[execAntigo] || {};
            const novoId = v.atual;
            const nova = (v.execucoes || {})[novoId] || {};
            res({
              atualMudou: novoId !== execAntigo,
              antiga: {
                status: antiga.status, encerrada: antiga.encerrada,
                temEncerradaEm: !!antiga.encerradaEm, temEncerradaPor: !!antiga.encerradaPor,
                grupos: Object.keys(antiga.grupos || {}).length,
              },
              nova: { status: nova.status, numero: nova.numero, grupos: Object.keys(nova.grupos || {}).length },
            });
          });
        }), { turmaKey: TURMA_LIB, execAntigo: EXEC });
        anota('confirmar cria a execução nova (status "ativa", com número) e "atual" passa a apontar para ela',
          estadoDepois.atualMudou && estadoDepois.nova.status === 'ativa' &&
          typeof estadoDepois.nova.numero === 'number' && estadoDepois.nova.grupos === 0,
          JSON.stringify(estadoDepois));
        anota('a execução anterior é encerrada de verdade (status, encerradaEm, encerradaPor) e preserva os grupos',
          estadoDepois.antiga.status === 'encerrada' && estadoDepois.antiga.encerrada === true &&
          estadoDepois.antiga.temEncerradaEm && estadoDepois.antiga.temEncerradaPor && estadoDepois.antiga.grupos === 1,
          JSON.stringify(estadoDepois));

        await ctxExec.close();
      }

      /* ── 9j: FASE 1 — proteção de concorrência real: duas chamadas de
            "iniciar nova execução" quase simultâneas, partindo da MESMA
            execução atual (mesma pessoa em duas abas, ou clique duplo
            bem no meio da rede lenta), NUNCA podem resultar em duas
            execuções com status "ativa" ao mesmo tempo — nem em uma
            delas ficando órfã (ativa, mas fora do "atual"). Só uma pode
            vencer a disputa pelo LOCK; a outra é abortada sem criar
            execução nenhuma, e avisa a pessoa em vez de travar ou
            quebrar a tela. ── */
      {
        const semeadoConc = apostasSemeadas();
        const { ctx: ctxConc, page: pgConc } = await novaPagina(browser, formato, ADM, erros, semeadoConc);
        await pgConc.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgConc.click('#apostaAbrirBtn');
        await pgConc.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });

        await pgConc.evaluate(() => {
          /* Disparadas de propósito sem esperar a primeira terminar —
             é exatamente a corrida que o teste quer provocar: as duas
             partem do mesmo "atual". */
          window.faAposta._criarExecucao();
          window.faAposta._criarExecucao();
        });
        await pgConc.waitForTimeout(600);

        const resultadoConc = await pgConc.evaluate(({ turmaKey, execOriginal }) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey).once('value', (s) => {
            const v = s.val() || {};
            const execucoes = v.execucoes || {};
            const todasIds = Object.keys(execucoes);
            const novasIds = todasIds.filter((id) => id !== execOriginal);
            const ativasIds = todasIds.filter((id) => execucoes[id].status === 'ativa');
            res({
              atual: v.atual,
              atualExiste: !!execucoes[v.atual],
              qtdNovas: novasIds.length,
              qtdAtivas: ativasIds.length,
              ativasSaoSoAtual: ativasIds.length === 1 && ativasIds[0] === v.atual,
              originalEncerrada: (execucoes[execOriginal] || {}).status === 'encerrada',
              temLock: !!v.criacaoExecucaoEmAndamento,
            });
          });
        }), { turmaKey: TURMA_LIB, execOriginal: EXEC });

        anota('duas chamadas partindo do mesmo "atual" criam SÓ UMA execução nova — a perdedora não cria uma segunda (Z)',
          resultadoConc.qtdNovas === 1, JSON.stringify(resultadoConc));
        anota('existe EXATAMENTE uma execução com status "ativa" depois da disputa, nunca duas',
          resultadoConc.qtdAtivas === 1, JSON.stringify(resultadoConc));
        anota('"atual" aponta para a única execução ativa — nenhuma execução ativa fica órfã, fora de "atual"',
          resultadoConc.ativasSaoSoAtual && resultadoConc.atualExiste, JSON.stringify(resultadoConc));
        anota('a execução original é encerrada mesmo com a corrida entre as duas chamadas',
          resultadoConc.originalEncerrada, JSON.stringify(resultadoConc));
        anota('o lock não fica preso depois que o ciclo vencedor termina', !resultadoConc.temLock, JSON.stringify(resultadoConc));

        const avisoPerdedora = await pgConc.evaluate(() => {
          const t = document.querySelector('.aposta-toast--persistente');
          return t ? t.textContent : '';
        });
        anota('a chamada que perde a disputa pelo lock mostra um aviso controlado que sobrevive ao redesenho da vencedora (não trava nem quebra a tela)',
          /outra execu[çc][ãa]o est[áa] sendo iniciada/i.test(avisoPerdedora), avisoPerdedora);

        await ctxConc.close();
      }

      /* ── 9k: FASE 1 — falha logo depois de adquirir o direito de
            criação (o lock), mas antes de conseguir reler "atual": a
            leitura de "atual" falha (rede caiu bem ali). "atual" não
            pode ter sido tocado nesse ponto — a execução antiga
            continua íntegra e ativa, e nenhuma execução parcial pode
            aparecer. Como quem tentou continua vivo para reagir ao
            erro, o lock é liberado na hora, sem precisar esperar
            expirar — e o mesmo clique de novo, sem a falha, tem de
            completar a transição normalmente. ── */
      {
        const semeadoFalha1 = apostasSemeadas();
        const { ctx: ctxFalha1, page: pgFalha1 } = await novaPagina(browser, formato, ADM, erros, semeadoFalha1);
        await pgFalha1.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgFalha1.click('#apostaAbrirBtn');
        await pgFalha1.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });

        await pgFalha1.evaluate((turmaKey) => {
          window.__CFG.fail = ['apostas/' + turmaKey + '/atual'];
        }, TURMA_LIB);
        await pgFalha1.evaluate(() => { window.faAposta._criarExecucao(); });
        await pgFalha1.waitForTimeout(400);

        const estadoAposFalha1 = await pgFalha1.evaluate(({ turmaKey, execOriginal }) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey).once('value', (s) => {
            const v = s.val() || {};
            const execucoes = v.execucoes || {};
            /* Execução seed é antiga (sem `status`) — compatibilidade
               sem migração: ativa é `status === 'ativa'` OU, na
               ausência de `status`, `encerrada` não ser true. */
            const orig = execucoes[execOriginal] || {};
            res({
              atual: v.atual,
              originalAtiva: orig.status ? orig.status === 'ativa' : !orig.encerrada,
              qtdExecucoes: Object.keys(execucoes).length,
              temLock: !!v.criacaoExecucaoEmAndamento,
            });
          });
        }), { turmaKey: TURMA_LIB, execOriginal: EXEC });
        anota('falha ao reler "atual" logo após o lock: "atual" não muda, a execução antiga continua ativa, nenhuma execução parcial aparece',
          estadoAposFalha1.atual === EXEC && estadoAposFalha1.originalAtiva && estadoAposFalha1.qtdExecucoes === 1,
          JSON.stringify(estadoAposFalha1));
        anota('essa falha libera o lock na hora — quem tentou continua vivo para reagir, não precisa esperar expirar',
          !estadoAposFalha1.temLock, JSON.stringify(estadoAposFalha1));

        await pgFalha1.evaluate(() => { window.__CFG.fail = []; });
        await pgFalha1.evaluate(() => { window.faAposta._criarExecucao(); });
        await pgFalha1.waitForTimeout(600);

        const estadoAposRetry1 = await pgFalha1.evaluate(({ turmaKey, execOriginal }) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey).once('value', (s) => {
            const v = s.val() || {};
            const execucoes = v.execucoes || {};
            const ativasIds = Object.keys(execucoes).filter((id) => execucoes[id].status === 'ativa');
            res({
              atualExiste: !!execucoes[v.atual],
              qtdAtivas: ativasIds.length,
              ativaEhAtual: ativasIds.length === 1 && ativasIds[0] === v.atual,
              originalEncerrada: (execucoes[execOriginal] || {}).status === 'encerrada',
            });
          });
        }), { turmaKey: TURMA_LIB, execOriginal: EXEC });
        anota('sem a falha, repetir a mesma chamada completa a transição normalmente (retry recupera sozinho)',
          estadoAposRetry1.atualExiste && estadoAposRetry1.qtdAtivas === 1 && estadoAposRetry1.ativaEhAtual && estadoAposRetry1.originalEncerrada,
          JSON.stringify(estadoAposRetry1));

        await ctxFalha1.close();
      }

      /* ── 9l: FASE 1 — falha depois de obter o número da execução, mas
            antes do update() atômico final: o update() inteiro falha
            (rede caiu bem ali). Como o update() é atômico, nada dele
            grava — nem a execução nova, nem o encerramento da antiga,
            nem a troca de "atual". O número já consumido fica pulado
            (aceito de propósito: número perdido é melhor que ponteiro
            quebrado), mas "atual" continua íntegro. O lock, de novo,
            é liberado na hora — e o retry completa normalmente. ── */
      {
        const semeadoFalha2 = apostasSemeadas();
        const { ctx: ctxFalha2, page: pgFalha2 } = await novaPagina(browser, formato, ADM, erros, semeadoFalha2);
        await pgFalha2.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgFalha2.click('#apostaAbrirBtn');
        await pgFalha2.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });

        await pgFalha2.evaluate((turmaKey) => {
          window.__CFG.fail = ['apostas/' + turmaKey + '/execucoes'];
        }, TURMA_LIB);
        await pgFalha2.evaluate(() => { window.faAposta._criarExecucao(); });
        await pgFalha2.waitForTimeout(400);

        const estadoAposFalha2 = await pgFalha2.evaluate(({ turmaKey, execOriginal }) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey).once('value', (s) => {
            const v = s.val() || {};
            const execucoes = v.execucoes || {};
            /* Execução seed é antiga (sem `status`) — compatibilidade
               sem migração: ativa é `status === 'ativa'` OU, na
               ausência de `status`, `encerrada` não ser true. */
            const orig = execucoes[execOriginal] || {};
            res({
              atual: v.atual,
              originalAtiva: orig.status ? orig.status === 'ativa' : !orig.encerrada,
              originalEncerrada: orig.status === 'encerrada' || orig.encerrada === true,
              qtdExecucoes: Object.keys(execucoes).length,
              temLock: !!v.criacaoExecucaoEmAndamento,
              temContador: v.contadorExecucoes,
            });
          });
        }), { turmaKey: TURMA_LIB, execOriginal: EXEC });
        anota('falha no update() final: "atual" não muda e a execução antiga NUNCA é encerrada sem a nova ter sido criada de fato',
          estadoAposFalha2.atual === EXEC && estadoAposFalha2.originalAtiva && !estadoAposFalha2.originalEncerrada && estadoAposFalha2.qtdExecucoes === 1,
          JSON.stringify(estadoAposFalha2));
        anota('essa falha também libera o lock na hora, mesmo já tendo consumido um número (número pulado é aceito; ponteiro quebrado não)',
          !estadoAposFalha2.temLock && estadoAposFalha2.temContador === 1, JSON.stringify(estadoAposFalha2));

        await pgFalha2.evaluate(() => { window.__CFG.fail = []; });
        await pgFalha2.evaluate(() => { window.faAposta._criarExecucao(); });
        await pgFalha2.waitForTimeout(600);

        const estadoAposRetry2 = await pgFalha2.evaluate(({ turmaKey, execOriginal }) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey).once('value', (s) => {
            const v = s.val() || {};
            const execucoes = v.execucoes || {};
            const ativasIds = Object.keys(execucoes).filter((id) => execucoes[id].status === 'ativa');
            const novaId = ativasIds[0];
            res({
              atualExiste: !!execucoes[v.atual],
              qtdAtivas: ativasIds.length,
              ativaEhAtual: ativasIds.length === 1 && ativasIds[0] === v.atual,
              originalEncerrada: (execucoes[execOriginal] || {}).status === 'encerrada',
              numeroDaNova: novaId ? execucoes[novaId].numero : null,
            });
          });
        }), { turmaKey: TURMA_LIB, execOriginal: EXEC });
        anota('sem a falha, repetir a mesma chamada completa a transição normalmente (retry recupera sozinho)',
          estadoAposRetry2.atualExiste && estadoAposRetry2.qtdAtivas === 1 && estadoAposRetry2.ativaEhAtual && estadoAposRetry2.originalEncerrada,
          JSON.stringify(estadoAposRetry2));
        anota('o número pulado na falha aparece como lacuna aceita (a execução criada de fato tem número 2, não 1) — nunca um ponteiro quebrado no lugar',
          estadoAposRetry2.numeroDaNova === 2, JSON.stringify(estadoAposRetry2));

        await ctxFalha2.close();
      }

      /* ── 9m: FASE 1 — um lock já preso, deixado por uma queda
            anterior (simulada aqui semeando o nó direto no banco, com
            um timestamp bem antigo — o mesmo estado em que uma queda
            de verdade, sem chance nenhuma de limpar depois de si,
            deixaria o banco), precisa destravar sozinho quando
            expira, sem exigir conserto manual: a próxima tentativa
            consegue prosseguir normalmente. ── */
      {
        const semeadoFalha3 = apostasSemeadas();
        semeadoFalha3[TURMA_LIB].criacaoExecucaoEmAndamento = { em: '2020-01-01T00:00:00.000Z', por: 'alguem@previ.com.br' };
        const { ctx: ctxFalha3, page: pgFalha3 } = await novaPagina(browser, formato, ADM, erros, semeadoFalha3);
        await pgFalha3.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgFalha3.click('#apostaAbrirBtn');
        await pgFalha3.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });

        await pgFalha3.evaluate(() => { window.faAposta._criarExecucao(); });
        await pgFalha3.waitForTimeout(600);

        const estadoAposExpirar = await pgFalha3.evaluate(({ turmaKey, execOriginal }) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey).once('value', (s) => {
            const v = s.val() || {};
            const execucoes = v.execucoes || {};
            const ativasIds = Object.keys(execucoes).filter((id) => execucoes[id].status === 'ativa');
            res({
              atualExiste: !!execucoes[v.atual],
              qtdAtivas: ativasIds.length,
              ativaEhAtual: ativasIds.length === 1 && ativasIds[0] === v.atual,
              originalEncerrada: (execucoes[execOriginal] || {}).status === 'encerrada',
            });
          });
        }), { turmaKey: TURMA_LIB, execOriginal: EXEC });
        anota('um lock preso por uma queda anterior (já expirado) destrava sozinho — a próxima tentativa não precisa de conserto manual no banco',
          estadoAposExpirar.atualExiste && estadoAposExpirar.qtdAtivas === 1 && estadoAposExpirar.ativaEhAtual && estadoAposExpirar.originalEncerrada,
          JSON.stringify(estadoAposExpirar));

        await ctxFalha3.close();
      }

      /* ── 9n: FASE 1 — o lock tem identidade própria por tentativa
            (token): uma tentativa antiga que só descobre que falhou
            depois de o lock já ter sido assumido por uma tentativa
            mais nova NÃO PODE remover o lock dessa tentativa mais
            nova. Sem isso, uma terceira chamada poderia entrar bem no
            meio da tentativa mais nova, recriando a corrida que o
            lock existe para impedir. ── */
      {
        const semeadoFalha4 = apostasSemeadas();
        semeadoFalha4[TURMA_LIB].criacaoExecucaoEmAndamento = { em: new Date().toISOString(), por: ADM, token: 'token-da-tentativa-nova' };
        const { ctx: ctxFalha4, page: pgFalha4 } = await novaPagina(browser, formato, ADM, erros, semeadoFalha4);
        await pgFalha4.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgFalha4.click('#apostaAbrirBtn');
        await pgFalha4.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });

        await pgFalha4.evaluate((turmaKey) => {
          window.faAposta._liberarLock('token-de-uma-tentativa-antiga-que-ja-nao-existe-mais');
        }, TURMA_LIB);
        await pgFalha4.waitForTimeout(300);

        const lockAposTentativaAntiga = await pgFalha4.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/criacaoExecucaoEmAndamento').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        anota('liberarLock() com o token de uma tentativa antiga NÃO remove o lock de uma tentativa mais nova',
          lockAposTentativaAntiga && lockAposTentativaAntiga.token === 'token-da-tentativa-nova',
          JSON.stringify(lockAposTentativaAntiga));

        await pgFalha4.evaluate((turmaKey) => {
          window.faAposta._liberarLock('token-da-tentativa-nova');
        }, TURMA_LIB);
        await pgFalha4.waitForTimeout(300);

        const lockAposTentativaCerta = await pgFalha4.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/criacaoExecucaoEmAndamento').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        anota('liberarLock() com o token certo (o dono de verdade do lock) remove normalmente',
          lockAposTentativaCerta === null, JSON.stringify(lockAposTentativaCerta));

        await ctxFalha4.close();
      }

      /* ── 10a-10f: FASE 2 — Histórico de Execuções (somente leitura).
            Turma com histórico real: uma execução LEGADA (sem status
            nem numero, do jeito que a Fase 0 encontrou execuções
            reais), uma já no formato da Fase 1 (status/numero/
            encerradaEm/encerradaPor) e a execução ATUAL (EXEC — que
            também não tem status/numero, provando que a compatibilidade
            por leitura vale para os dois lados: "ativa" não depende de
            `status` existir, depende só de ser apontada por "atual"). ── */
      {
        const semeadoHist = apostasSemeadasComHistorico();
        const { ctx: ctxHist, page: pgHist } = await novaPagina(browser, formato, ADM, erros, semeadoHist);
        await pgHist.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgHist.click('#apostaAbrirBtn');
        await pgHist.waitForSelector('#apostaPainelBtn', { timeout: 15000 });

        const atualNoFirebase = () => pgHist.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/atual').once('value', (s) => res(s.val()));
        }), TURMA_LIB);

        const atualAntes = await atualNoFirebase();
        anota('antes de abrir o histórico, "atual" é a execução em andamento', atualAntes === EXEC, atualAntes);

        await pgHist.click('#apostaPainelBtn');
        await pgHist.waitForSelector('#apostaVerHistorico', { timeout: 15000 });
        await pgHist.click('#apostaVerHistorico');
        await pgHist.waitForSelector('.aposta-hist-item', { timeout: 15000 });

        /* 10a — Listagem */
        const listagem = await pgHist.evaluate(() =>
          Array.from(document.querySelectorAll('.aposta-hist-item')).map((el) => ({ exec: el.dataset.exec, texto: el.textContent }))
        );
        const itemAtual  = listagem.find((i) => i.exec === EXEC);
        const itemLegado = listagem.find((i) => i.exec === EXEC_LEGADO);
        const itemF1     = listagem.find((i) => i.exec === EXEC_F1);
        anota('a execução atual aparece na listagem, marcada como Ativa (mesmo sem `status` gravado)',
          !!itemAtual && /Ativa/.test(itemAtual.texto), JSON.stringify(itemAtual));
        anota('as duas execuções anteriores aparecem na listagem',
          !!itemLegado && !!itemF1, JSON.stringify(listagem.map((i) => i.exec)));
        anota('a execução legada (sem `status`) aparece como Encerrada — compatibilidade por leitura, sem migração',
          !!itemLegado && /Encerrada/.test(itemLegado.texto), JSON.stringify(itemLegado));
        anota('a execução legada (sem `numero`) recebe um número derivado pela ordem de criação, marcado como estimativa',
          !!itemLegado && /estimado pela ordem/.test(itemLegado.texto), JSON.stringify(itemLegado));
        const numeroF1 = itemF1 ? (itemF1.texto.match(/nº (\d+)/) || [])[1] : null;
        anota('a execução já no formato da Fase 1 mostra o número REAL (nº 1), sem marca de estimativa',
          numeroF1 === '1' && !/estimado/.test(itemF1.texto), JSON.stringify(itemF1));

        anota('abrir a lista do histórico não altera "atual"', (await atualNoFirebase()) === EXEC, '');

        /* 10b/10c — abrir a execução legada, ver seus grupos, abrir o mapa histórico */
        await pgHist.click('.aposta-hist-item[data-exec="' + EXEC_LEGADO + '"] .aposta-hist-abrir');
        await pgHist.waitForSelector('.aposta-hist-ver-grupo', { timeout: 15000 });
        const tituloDetalhe = await pgHist.evaluate(() => (document.querySelector('.aposta-historico-overlay .modal-box h3') || {}).textContent || '');
        anota('abrir uma execução histórica mostra um título "SOMENTE LEITURA" explícito',
          /SOMENTE LEITURA/.test(tituloDetalhe), tituloDetalhe);
        anota('abrir o detalhe da execução histórica não altera "atual"', (await atualNoFirebase()) === EXEC, '');

        await pgHist.click('.aposta-hist-ver-grupo[data-grupo="' + GRUPO_LEGADO + '"]');
        await pgHist.waitForSelector('.aposta-mapa-card', { timeout: 15000 });
        const mapaHist = await pgHist.evaluate(() => ({
          titulo: (document.querySelector('.aposta-historico-overlay .modal-box h3') || {}).textContent || '',
          texto: (document.querySelector('.aposta-historico-overlay .modal-box') || {}).textContent || '',
          temBotaoEditar: !!document.querySelector('.aposta-historico-overlay .modal-box button.aposta-mapa-card'),
          cardsSaoDiv: Array.from(document.querySelectorAll('.aposta-historico-overlay .aposta-mapa-card')).every((el) => el.tagName === 'DIV'),
        }));
        anota('o mapa histórico mostra "SOMENTE LEITURA" no título',
          /SOMENTE LEITURA/.test(mapaHist.titulo), mapaHist.titulo);
        anota('o mapa histórico mostra os dados DAQUELA execução (o que o Grupo Antigo escreveu — "fila")',
          /fila/.test(mapaHist.texto), mapaHist.texto);
        anota('o mapa histórico NÃO mostra dados da execução atual (nenhum resquício de "atendimento", da missão da EXEC)',
          !/atendimento/.test(mapaHist.texto), mapaHist.texto);
        anota('os cards do mapa histórico são <div>, nunca <button> — nada ali é clicável para editar',
          mapaHist.cardsSaoDiv && !mapaHist.temBotaoEditar, JSON.stringify(mapaHist));
        anota('abrir o mapa histórico não altera "atual"', (await atualNoFirebase()) === EXEC, '');

        /* 10d — Escrita: nenhuma ação de edição existe no histórico */
        const semEscrita = await pgHist.evaluate(() => {
          const box = document.querySelector('.aposta-historico-overlay .modal-box');
          const textoBox = box ? box.textContent : '';
          return {
            semBotaoSalvar: !/Salvar|Continuar|Revelar|Criar grupo|Iniciar nova execução/.test(textoBox),
            semCampoEditavel: box ? box.querySelectorAll('input, textarea, select').length === 0 : true,
          };
        });
        anota('a tela do mapa histórico não tem nenhum campo editável nem botão de escrita (Salvar/Continuar/Revelar/Criar grupo/Iniciar nova execução)',
          semEscrita.semBotaoSalvar && semEscrita.semCampoEditavel, JSON.stringify(semEscrita));

        /* 10e — Exportação: volta ao detalhe e exporta o CSV da execução antiga */
        await pgHist.click('#apostaHistVoltarDetalhe');
        await pgHist.waitForSelector('#apostaHistExportar', { timeout: 15000 });
        const [downloadHist] = await Promise.all([
          pgHist.waitForEvent('download'),
          pgHist.click('#apostaHistExportar'),
        ]);
        const caminhoHist = await downloadHist.path();
        const csvHist = caminhoHist ? fs.readFileSync(caminhoHist, 'utf8') : '';
        anota('o CSV exportado da execução antiga contém os dados DELA (Grupo Antigo)', /Grupo Antigo/.test(csvHist), csvHist.slice(0, 200));
        anota('o CSV exportado da execução antiga NÃO contém dados da execução atual (nenhum "Grupo 1")', !/Grupo 1[^0-9]/.test(csvHist), csvHist.slice(0, 200));
        anota('o nome do arquivo do CSV histórico identifica a execução exportada (não é o mesmo nome do CSV da atual)',
          /aposta-.*-exec/.test(downloadHist.suggestedFilename()), downloadHist.suggestedFilename());
        anota('exportar a execução histórica não altera "atual"', (await atualNoFirebase()) === EXEC, '');

        /* 10f — Retorno: fechar tudo e confirmar que a execução atual continua intacta */
        await pgHist.click('#apostaHistFechar');
        await pgHist.waitForTimeout(200);
        const semModalHistorico = await pgHist.evaluate(() => !document.querySelector('.aposta-historico-overlay'));
        anota('fechar o histórico não deixa modal nenhum aberto, e não altera "atual"',
          semModalHistorico, '');
        anota('fechar o histórico não altera "atual"', (await atualNoFirebase()) === EXEC, '');

        /* A dinâmica atual continua funcionando normalmente por baixo:
           nenhum _execId/_grupoId histórico vazou para a tela ao vivo. */
        await pgHist.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgHist.click('.aposta-grupo-btn');
        await pgHist.waitForSelector('.aposta-frase', { timeout: 15000 });
        const telaAtualOk = await pgHist.evaluate(() => (document.querySelector('.aposta-tela') || {}).textContent || '');
        anota('depois do histórico, entrar no grupo da execução ATUAL mostra a etapa da EXEC, não da execução legada',
          !/Grupo Antigo/.test(telaAtualOk), telaAtualOk.slice(0, 200));

        /* CSV da execução atual continua funcionando exatamente como antes */
        await pgHist.click('#apostaFecharBtn');
        await pgHist.click('#apostaAbrirBtn');
        await pgHist.waitForSelector('#apostaPainelBtn', { timeout: 15000 });
        await pgHist.click('#apostaPainelBtn');
        await pgHist.waitForSelector('#apostaExportar', { timeout: 15000 });
        const [downloadAtual] = await Promise.all([
          pgHist.waitForEvent('download'),
          pgHist.click('#apostaExportar'),
        ]);
        const caminhoAtual = await downloadAtual.path();
        const csvAtual = caminhoAtual ? fs.readFileSync(caminhoAtual, 'utf8') : '';
        anota('a exportação da execução ATUAL continua funcionando normalmente (CSV com o Grupo 1)', /Grupo 1/.test(csvAtual), csvAtual.slice(0, 200));

        await ctxHist.close();
      }

      /* ── 12a-12c: FASE 3 — proteção contra clique duplo em "Criar
            grupo", a única ação estrutural sem proteção encontrada no
            mapeamento (criação de execução já é protegida desde a
            Fase 1 por lock próprio; entrar em grupo, avançar etapa,
            revelar e salvar/remover missão-base são todos gravações
            idempotentes de um caminho fixo, não criações de registro
            novo — nenhuma delas precisou de proteção nova). ── */
      {
        const semeadoGrupo = apostasSemeadas();
        const { ctx: ctxGrupo, page: pgGrupo } = await novaPagina(browser, formato, ADM, erros, semeadoGrupo);
        await pgGrupo.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgGrupo.click('#apostaAbrirBtn');
        await pgGrupo.waitForSelector('#apostaPainelBtn', { timeout: 15000 });
        await pgGrupo.click('#apostaPainelBtn');
        await pgGrupo.waitForSelector('#apostaCriarGrupo', { timeout: 15000 });

        const qtdGruposNoBanco = () => pgGrupo.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey).once('value', (s) => {
            const v = s.val() || {};
            res(Object.keys(((v.execucoes || {})[Object.keys(v.execucoes || {})[0]] || {}).grupos || {}).length);
          });
        }), TURMA_LIB);

        /* 12a — clique duplo rápido (os dois disparados no mesmo
           evaluate(), sem esperar o primeiro terminar — é exatamente a
           corrida que um duplo-clique físico ou dois cliques nervosos
           provocam) cria só UM grupo. */
        await pgGrupo.fill('#apostaNovoGrupo', 'Grupo Duplo');
        await pgGrupo.evaluate(() => {
          document.getElementById('apostaCriarGrupo').click();
          document.getElementById('apostaCriarGrupo').click();
        });
        const desabilitouNaHora = await pgGrupo.evaluate(() => (document.getElementById('apostaCriarGrupo') || {}).disabled);
        anota('clicar em "Criar grupo" desabilita o botão na hora, antes da gravação terminar',
          desabilitouNaHora === true, String(desabilitouNaHora));
        await pgGrupo.waitForTimeout(500);
        const qtdApos12a = await qtdGruposNoBanco();
        anota('clique duplo rápido em "Criar grupo" cria só UM grupo (não dois)',
          qtdApos12a === 2 /* GRUPO (seed) + 1 novo */, 'grupos no banco: ' + qtdApos12a);

        /* A contagem no banco já garante um único ID novo (cada grupo é
           uma chave push() distinta), mas isso sozinho não prova que a
           TELA não ficou com dois cards do mesmo grupo (ex.: se o
           redesenho rodasse duas vezes por engano). Conta os cards
           renderizados com esse nome para confirmar que o contexto da
           tela também ficou correto, não só o banco. */
        const qtdCardsGrupoDuplo = await pgGrupo.evaluate(() =>
          Array.from(document.querySelectorAll('.aposta-fac-grupo')).filter((g) => /Grupo Duplo/.test(g.textContent || '')).length);
        anota('depois do clique duplo, a tela mostra "Grupo Duplo" em um único card (sem duplicar a exibição)',
          qtdCardsGrupoDuplo === 1, 'cards na tela: ' + qtdCardsGrupoDuplo);

        /* 12b — três cliques em sequência, ainda com a operação
           pendente, continuam criando só um grupo — o botão continua
           desabilitado enquanto a gravação não confirma. */
        await pgGrupo.waitForSelector('#apostaCriarGrupo:not([disabled])', { timeout: 15000 });
        await pgGrupo.fill('#apostaNovoGrupo', 'Grupo Triplo');
        await pgGrupo.evaluate(() => {
          document.getElementById('apostaCriarGrupo').click();
          document.getElementById('apostaCriarGrupo').click();
          document.getElementById('apostaCriarGrupo').click();
        });
        await pgGrupo.waitForTimeout(500);
        const qtdApos12b = await qtdGruposNoBanco();
        anota('múltiplos cliques (3x) enquanto a criação está pendente também criam só UM grupo',
          qtdApos12b === qtdApos12a + 1, 'grupos no banco: ' + qtdApos12b + ' (antes: ' + qtdApos12a + ')');

        const qtdCardsGrupoTriplo = await pgGrupo.evaluate(() =>
          Array.from(document.querySelectorAll('.aposta-fac-grupo')).filter((g) => /Grupo Triplo/.test(g.textContent || '')).length);
        anota('depois dos 3 cliques, a tela mostra "Grupo Triplo" em um único card (sem duplicar a exibição)',
          qtdCardsGrupoTriplo === 1, 'cards na tela: ' + qtdCardsGrupoTriplo);

        await ctxGrupo.close();
      }

      /* ── 12c: falha ao criar o grupo mostra o erro, reabilita o
            botão (nunca fica preso) e permite uma nova tentativa
            controlada — que cria o grupo normalmente. ── */
      {
        const semeadoFalhaGrupo = apostasSemeadas();
        const { ctx: ctxFalhaGrupo, page: pgFalhaGrupo } = await novaPagina(browser, formato, ADM, erros, semeadoFalhaGrupo);
        await pgFalhaGrupo.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgFalhaGrupo.click('#apostaAbrirBtn');
        await pgFalhaGrupo.waitForSelector('#apostaPainelBtn', { timeout: 15000 });
        await pgFalhaGrupo.click('#apostaPainelBtn');
        await pgFalhaGrupo.waitForSelector('#apostaCriarGrupo', { timeout: 15000 });

        await pgFalhaGrupo.evaluate((turmaKey) => {
          window.__CFG.fail = ['apostas/' + turmaKey + '/execucoes/' + 'exec1' + '/grupos'];
        }, TURMA_LIB);
        await pgFalhaGrupo.fill('#apostaNovoGrupo', 'Grupo Que Falha');
        await pgFalhaGrupo.click('#apostaCriarGrupo');
        await pgFalhaGrupo.waitForSelector('.aposta-toast.is-erro', { timeout: 8000 });
        const botaoAposErro = await pgFalhaGrupo.evaluate(() => (document.getElementById('apostaCriarGrupo') || {}).disabled);
        anota('falha ao criar o grupo mostra o erro e reabilita o botão — nunca fica preso',
          botaoAposErro === false, String(botaoAposErro));

        /* Limpa a falha ANTES de reler o banco: o próprio caminho que
           acabamos de checar (execucoes/exec1/grupos) ainda estava na
           lista de falhas, e o once('value', ok) desta leitura não
           passa callback de erro — com a falha ainda ativa, a Promise
           deste evaluate() nunca resolveria. O que já foi persistido
           (ou não) não muda por limpar a falha agora: a escrita que
           falhou já falhou. */
        await pgFalhaGrupo.evaluate(() => { window.__CFG.fail = []; });
        const qtdAposFalha = await pgFalhaGrupo.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos').once('value', (s) => res(Object.keys(s.val() || {}).length));
        }), TURMA_LIB);
        anota('a falha não cria nenhum grupo (nem parcial, nem vazio)', qtdAposFalha === 1 /* só o GRUPO do seed */, String(qtdAposFalha));
        await pgFalhaGrupo.click('#apostaCriarGrupo');
        await pgFalhaGrupo.waitForFunction(() => /Grupo Que Falha/.test(document.body.textContent || ''), null, { timeout: 8000 });
        const qtdAposRetry = await pgFalhaGrupo.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos').once('value', (s) => res(Object.keys(s.val() || {}).length));
        }), TURMA_LIB);
        anota('depois do erro, a nova tentativa cria o grupo normalmente', qtdAposRetry === 2, String(qtdAposRetry));

        await ctxFalhaGrupo.close();
      }

      /* ══════════════════════════════════════════════════════════════
         FASE 4 — CICLOS DE APRENDIZAGEM
         ══════════════════════════════════════════════════════════════ */

      /* ── 13a: compatibilidade — grupo antigo (sem ciclos/) continua
            funcionando como Ciclo 1 implícito, sem nenhuma escrita
            automática só por ser aberto. ── */
      {
        const semeado13a = apostasSemeadas();
        const { ctx: ctx13a, page: pg13a } = await novaPagina(browser, formato, ADM, erros, semeado13a);
        await pg13a.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13a.click('#apostaAbrirBtn');
        await pg13a.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13a.click('.aposta-grupo-btn');
        await pg13a.waitForSelector('.aposta-trilha-item', { timeout: 15000 });
        await pg13a.waitForTimeout(300);
        const ciclosAposAbrir = await pg13a.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        anota('grupo antigo sem ciclos/ não ganha a estrutura só por ser aberto (Ciclo 1 implícito)',
          ciclosAposAbrir === null, JSON.stringify(ciclosAposAbrir));
        await ctx13a.close();
      }

      /* ── 13b: "Reformular a hipótese" — materializa Ciclo 1, cria
            Ciclo 2 na Hipótese, com herança/cascata e a Hipótese
            ORIGINAL preservada (Invariantes 1, 4, 5, 6). ── */
      {
        const semeado13b = apostasProntaParaDecisao();
        const { ctx: ctx13b, page: pg13b } = await novaPagina(browser, formato, ADM, erros, semeado13b);
        await pg13b.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13b.click('#apostaAbrirBtn');
        await pg13b.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13b.click('.aposta-grupo-btn');
        await pg13b.waitForSelector('.aposta-opcao', { timeout: 15000 });
        await pg13b.locator('.aposta-opcao', { hasText: 'Reformular a hipótese' }).click();
        await pg13b.fill('[data-campo="proximaAcao"]', 'testar uma nova hipótese sobre o atendimento');
        await pg13b.fill('[data-campo="proxHipCausa"]', 'o sistema de senhas está desorganizando a fila');
        await pg13b.fill('[data-campo="proxHipIndicio"]', 'muitas senhas fora de ordem no horário de pico');
        await pg13b.waitForTimeout(250);
        await pg13b.click('#apostaSeguir');
        await pg13b.waitForFunction(() =>
          /^H\s*—\s*HIP[ÓO]TESE/i.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 8000 });
        anota('"Reformular a hipótese" leva direto ao ponto de reinício (Hipótese) do ciclo novo', true);

        const grupoBanco = await pg13b.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        const ciclosNode = grupoBanco.ciclos || {};
        const porId = ciclosNode.porId || {};
        const idsPorNumero = Object.keys(porId).sort((a, b) => (porId[a].numero || 0) - (porId[b].numero || 0));
        const c1 = porId[idsPorNumero[0]] || {};
        const c2 = porId[idsPorNumero[1]] || {};
        anota('nasce exatamente um ciclo sucessor para esta decisão (Invariante 3)',
          idsPorNumero.length === 2, JSON.stringify(idsPorNumero));
        anota('ciclos/atual aponta para o Ciclo 2 recém-criado (Invariante 5)',
          ciclosNode.atual === idsPorNumero[1], JSON.stringify(ciclosNode.atual));
        anota('o grupo legado (grupos/<id>/dados) continua intocado, como registro redundante',
          grupoBanco.dados && grupoBanco.dados.hipotese.causa === DADOS_ATE_EVIDENCIA.hipotese.causa,
          JSON.stringify(grupoBanco.dados && grupoBanco.dados.hipotese));
        anota('Ciclo 1 fica FINALIZADO, com a decisão que o fechou (Invariante 1: nunca sobrescrito depois)',
          c1.status === 'FINALIZADO' && c1.dados.decisao.decisao === 'Reformular a hipótese',
          JSON.stringify({ status: c1.status, decisao: c1.dados && c1.dados.decisao }));
        anota('Ciclo 1 preserva a Hipótese ORIGINAL, nunca reescrita pela nova (Invariante 4)',
          c1.dados.hipotese.causa === DADOS_ATE_EVIDENCIA.hipotese.causa &&
          c1.dados.hipotese.indicio === DADOS_ATE_EVIDENCIA.hipotese.indicio,
          JSON.stringify(c1.dados.hipotese));
        anota('Ciclo 2 nasce EM_CONSTRUCAO, com pontoDeReinicio=hipotese e cicloAnteriorId apontando pro Ciclo 1',
          c2.status === 'EM_CONSTRUCAO' && c2.pontoDeReinicio === 'hipotese' && c2.cicloAnteriorId === idsPorNumero[0],
          JSON.stringify({ status: c2.status, ponto: c2.pontoDeReinicio, anterior: c2.cicloAnteriorId }));
        anota('Ciclo 2 herda Missão/Sintoma/Problema/Mudanças do Ciclo 1, intocados (herança antes do ponto de reinício)',
          c2.dados.missao.oQue === DADOS_ATE_EVIDENCIA.missao.oQue &&
          c2.dados.sintoma.texto === DADOS_ATE_EVIDENCIA.sintoma.texto &&
          c2.dados.problema.situacaoIndesejada === DADOS_ATE_EVIDENCIA.problema.situacaoIndesejada &&
          c2.dados.mudancas.itens[0].indicador === DADOS_ATE_EVIDENCIA.mudancas.itens[0].indicador,
          JSON.stringify({ missao: c2.dados.missao, problema: c2.dados.problema }));
        anota('Ciclo 2 já nasce com a NOVA hipótese (a que a Decisão coletou) — não fica em branco (item 19)',
          c2.dados.hipotese.causa === 'o sistema de senhas está desorganizando a fila' &&
          c2.dados.hipotese.indicio === 'muitas senhas fora de ordem no horário de pico',
          JSON.stringify(c2.dados.hipotese));
        anota('Ciclo 2 nasce com Ideia/Experimento/Evidência/Decisão vazios (efeito cascata, item 24)',
          Object.keys(c2.dados.ideia || {}).length === 0 &&
          Object.keys(c2.dados.experimento || {}).length === 0 &&
          Object.keys(c2.dados.evidencia || {}).length === 0 &&
          Object.keys(c2.dados.decisao || {}).length === 0,
          JSON.stringify({ ideia: c2.dados.ideia, experimento: c2.dados.experimento }));

        await ctx13b.close();
      }

      /* ── 13c: "Investigar mais" — pede um ponto de reinício ESCOLHIDO;
            sem escolher, bloqueia; escolhendo, o ciclo novo nasce
            exatamente nesse ponto (não num fixo). ── */
      {
        const semeado13c = apostasProntaParaDecisao();
        const { ctx: ctx13c, page: pg13c } = await novaPagina(browser, formato, ADM, erros, semeado13c);
        await pg13c.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13c.click('#apostaAbrirBtn');
        await pg13c.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13c.click('.aposta-grupo-btn');
        await pg13c.waitForSelector('.aposta-opcao', { timeout: 15000 });
        await pg13c.locator('.aposta-opcao', { hasText: 'Investigar mais' }).click();
        await pg13c.fill('[data-campo="proximaAcao"]', 'reunir o grupo para revisar as mudanças mensuráveis');
        await pg13c.waitForTimeout(200);
        const desabilitadoSemPonto = await pg13c.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
        anota('"Investigar mais" sem ponto de reinício escolhido mantém CONTINUAR desabilitado',
          desabilitadoSemPonto === true, String(desabilitadoSemPonto));
        await pg13c.locator('.aposta-opcao[data-escolha="pontoDeReinicioEscolhido"]', { hasText: 'Mudanças Mensuráveis' }).click();
        await pg13c.waitForTimeout(200);
        const habilitadoComPonto = await pg13c.evaluate(() => (document.getElementById('apostaSeguir') || {}).disabled);
        anota('escolher o ponto de reinício libera CONTINUAR', habilitadoComPonto === false, String(habilitadoComPonto));
        await pg13c.click('#apostaSeguir');
        await pg13c.waitForFunction(() =>
          /MUDAN[ÇC]AS MENSUR[ÁA]VEIS/i.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 8000 });
        const c2Ponto = await pg13c.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos').once('value', (s) => {
            const v = s.val() || {};
            const c = (v.porId || {})[v.atual] || {};
            res({ pontoDeReinicio: c.pontoDeReinicio, decisaoOrigem: c.decisaoOrigem, mudancasVazias: Object.keys(c.dados.mudancas || {}).length === 0 });
          });
        }), TURMA_LIB);
        anota('o ciclo nasce no ponto de reinício ESCOLHIDO pela dupla, não num fixo',
          c2Ponto.pontoDeReinicio === 'mudancas' && c2Ponto.decisaoOrigem === 'Investigar mais' && c2Ponto.mudancasVazias,
          JSON.stringify(c2Ponto));
        await ctx13c.close();
      }

      /* ── 13d: "Ampliar" e "Interromper esta ideia" só finalizam — nunca
            criam ciclo sozinhas (itens 12/13). ── */
      {
        const semeado13d = apostasProntaParaDecisao();
        const { ctx: ctx13d, page: pg13d } = await novaPagina(browser, formato, ADM, erros, semeado13d);
        await pg13d.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13d.click('#apostaAbrirBtn');
        await pg13d.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13d.click('.aposta-grupo-btn');
        await pg13d.waitForSelector('.aposta-opcao', { timeout: 15000 });
        await pg13d.locator('.aposta-opcao', { hasText: 'Interromper esta ideia' }).click();
        await pg13d.fill('[data-campo="proximaAcao"]', 'encerrar e registrar o aprendizado');
        await pg13d.waitForTimeout(200);
        await pg13d.click('#apostaSeguir');
        await pg13d.waitForSelector('.aposta-mapa', { timeout: 8000 });
        const semCiclos = await pg13d.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        anota('"Interromper esta ideia" finaliza sem criar ciclo nenhum — vai direto ao Mapa',
          semCiclos === null, JSON.stringify(semCiclos));
        await ctx13d.close();
      }

      /* ── 13d-bis: "Ampliar" também só finaliza — nunca cria sucessor
            (item 12) — seeded já num Ciclo 2 EXPLÍCITO (não o implícito)
            para que "cicloAtual não aponta pra ciclo inexistente" seja
            uma prova de verdade, não trivial por ausência de `ciclos`. ── */
      {
        const semeado13dbis = apostasProntaParaDecisao();
        semeado13dbis[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados.decisao = { decisao: 'Reformular a hipótese', proximaAcao: 'testar de novo', dataDecisao: '2026-09-19T09:00:00.000Z', proxHipCausa: 'causa', proxHipIndicio: 'indicio' };
        semeado13dbis[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].ciclos = {
          atual: 'c2',
          porId: {
            c1: { numero: 1, status: 'FINALIZADO', pontoDeReinicio: null, cicloAnteriorId: null, etapa: 'decisao', dados: semeado13dbis[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados },
            c2: { numero: 2, status: 'EM_CONSTRUCAO', pontoDeReinicio: 'hipotese', decisaoOrigem: 'Reformular a hipótese', cicloAnteriorId: 'c1', etapa: 'decisao', dados: Object.assign({}, DADOS_ATE_EVIDENCIA, { hipotese: { causa: 'causa', indicio: 'indicio' }, decisao: {} }) }
          }
        };
        const { ctx: ctx13dbis, page: pg13dbis } = await novaPagina(browser, formato, ADM, erros, semeado13dbis);
        await pg13dbis.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13dbis.click('#apostaAbrirBtn');
        await pg13dbis.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13dbis.click('.aposta-grupo-btn');
        await pg13dbis.waitForSelector('.aposta-opcao', { timeout: 15000 });
        await pg13dbis.locator('.aposta-opcao', { hasText: 'Ampliar' }).click();
        await pg13dbis.fill('[data-campo="proximaAcao"]', 'ampliar para outras filas');
        await pg13dbis.waitForTimeout(200);
        await pg13dbis.click('#apostaSeguir');
        await pg13dbis.waitForSelector('.aposta-mapa', { timeout: 8000 });
        const estadoAposAmpliar = await pg13dbis.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos').once('value', (s) => {
            const v = s.val() || {};
            const porId = v.porId || {};
            res({ atual: v.atual, statusC2: (porId.c2 || {}).status, qtdCiclos: Object.keys(porId).length, atualAponta: !!porId[v.atual] });
          });
        }), TURMA_LIB);
        anota('"Ampliar" finaliza o ciclo atual (status vira FINALIZADO)',
          estadoAposAmpliar.statusC2 === 'FINALIZADO', JSON.stringify(estadoAposAmpliar));
        anota('"Ampliar" não cria nenhum sucessor — continua exatamente com os 2 ciclos que já existiam',
          estadoAposAmpliar.qtdCiclos === 2, JSON.stringify(estadoAposAmpliar));
        anota('cicloAtual continua apontando para um ciclo que existe de verdade (o mesmo Ciclo 2, agora finalizado) — nunca para um ciclo inexistente',
          estadoAposAmpliar.atual === 'c2' && estadoAposAmpliar.atualAponta, JSON.stringify(estadoAposAmpliar));
        await ctx13dbis.close();
      }

      /* ── 13e: editar uma etapa de um ciclo já concluído — confirmar
            cria um ciclo novo a partir EXATAMENTE da etapa clicada
            (edição manual, decisaoOrigem='edicao-manual'), nunca
            sobrescreve o histórico (item 9). ── */
      {
        const semeado13e = apostasProntaParaDecisao();
        semeado13e[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados.decisao = { decisao: 'Ampliar', proximaAcao: 'ampliar para outros horários', dataDecisao: '2026-09-19T10:00:00.000Z' };
        const { ctx: ctx13e, page: pg13e } = await novaPagina(browser, formato, ADM, erros, semeado13e);
        await pg13e.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13e.click('#apostaAbrirBtn');
        await pg13e.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13e.click('.aposta-grupo-btn');
        /* O seed retoma direto na etapa Decisão (já respondida) — como
           qualquer outra etapa, chegar ao Mapa exige o clique explícito
           em CONTINUAR/"Ver o mapa da aposta →" (etapa não navega
           sozinha para lá). */
        await pg13e.waitForSelector('#apostaSeguir:not([disabled])', { timeout: 15000 });
        await pg13e.click('#apostaSeguir');
        await pg13e.waitForSelector('.aposta-mapa', { timeout: 15000 });
        await pg13e.locator('.aposta-mapa-card', { hasText: 'PROBLEMA' }).click();
        await pg13e.waitForSelector('.aposta-confirmar-overlay .modal-box', { timeout: 5000 });
        await pg13e.click('.aposta-modal-sim-btn');
        await pg13e.waitForFunction(() =>
          /^P\s*—\s*PROBLEMA/i.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 8000 });
        const c2Manual = await pg13e.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos').once('value', (s) => {
            const v = s.val() || {};
            const c = (v.porId || {})[v.atual] || {};
            res({ pontoDeReinicio: c.pontoDeReinicio, decisaoOrigem: c.decisaoOrigem, missaoHerdada: (c.dados.missao || {}).oQue });
          });
        }), TURMA_LIB);
        anota('confirmar "iniciar novo ciclo" a partir de um card cria o ciclo exatamente nesse ponto',
          c2Manual.pontoDeReinicio === 'problema' && c2Manual.decisaoOrigem === 'edicao-manual',
          JSON.stringify(c2Manual));
        anota('o ciclo criado por edição manual também herda o que vem antes do ponto clicado',
          c2Manual.missaoHerdada === DADOS_ATE_EVIDENCIA.missao.oQue, JSON.stringify(c2Manual));
        await ctx13e.close();
      }

      /* ── 13f: clique duplo/repetido na criação de ciclo nunca cria
            dois ciclos sucessores para a mesma decisão (item 33). ── */
      {
        const semeado13f = apostasProntaParaDecisao();
        const { ctx: ctx13f, page: pg13f } = await novaPagina(browser, formato, ADM, erros, semeado13f);
        await pg13f.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13f.click('#apostaAbrirBtn');
        await pg13f.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13f.click('.aposta-grupo-btn');
        await pg13f.waitForSelector('.aposta-opcao', { timeout: 15000 });
        await pg13f.locator('.aposta-opcao', { hasText: 'Rever o problema' }).click();
        await pg13f.fill('[data-campo="proximaAcao"]', 'reunir o grupo para redefinir o problema');
        await pg13f.waitForTimeout(200);
        /* Duas chamadas quase simultâneas de criarCiclo() direto — prova
           a proteção real de concorrência (lock+token), não só o
           disabled=true do clique único (esse já é coberto acima, pelo
           fluxo normal da UI). Mesmo padrão dos testes de concorrência
           da execução (Fase 1). */
        const resultado = await pg13f.evaluate(() => Promise.all([
          new Promise((res) => window.faAposta._criarCiclo('problema', 'Rever o problema', (err, id) => res({ err: err || null, id }))),
          new Promise((res) => window.faAposta._criarCiclo('problema', 'Rever o problema', (err, id) => res({ err: err || null, id }))),
        ]));
        const vitoriosos = resultado.filter((r) => !r.err);
        anota('duas chamadas quase simultâneas de criarCiclo(): só uma vence, a outra é abortada sem criar nada',
          vitoriosos.length === 1, JSON.stringify(resultado));
        const totalCiclos = await pg13f.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos/porId').once('value', (s) => res(Object.keys(s.val() || {}).length));
        }), TURMA_LIB);
        anota('nasce exatamente UM ciclo sucessor no banco, nunca dois',
          totalCiclos === 2 /* Ciclo 1 materializado + o único Ciclo 2 */, String(totalCiclos));
        await ctx13f.close();
      }

      /* ── 13g: liberarLockCiclo com um token velho não remove o lock de
            uma tentativa mais nova (mesma prova da Fase 1, agora para o
            lock de ciclo). ── */
      {
        const semeado13g = apostasProntaParaDecisao();
        const { ctx: ctx13g, page: pg13g } = await novaPagina(browser, formato, ADM, erros, semeado13g);
        await pg13g.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13g.click('#apostaAbrirBtn');
        await pg13g.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13g.click('.aposta-grupo-btn');
        await pg13g.waitForSelector('.aposta-trilha-item', { timeout: 15000 });
        const provaToken = await pg13g.evaluate((turmaKey) => new Promise((res) => {
          const caminhoLock = 'apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos/criacaoCicloEmAndamento';
          firebase.database().ref(caminhoLock).set({ em: new Date().toISOString(), por: 'outra@previ.com.br', token: 'token-novo' }, () => {
            window.faAposta._liberarLockCiclo('token-velho');
            setTimeout(() => {
              firebase.database().ref(caminhoLock).once('value', (s) => res(s.val()));
            }, 50);
          });
        }), TURMA_LIB);
        anota('liberarLockCiclo() com token velho não remove o lock de uma tentativa mais nova',
          !!provaToken && provaToken.token === 'token-novo', JSON.stringify(provaToken));
        await ctx13g.close();
      }

      /* ── 13h: Mapa multiciclo — Ciclo 1 continua legível depois do
            Ciclo 2 nascer; só o atual é clicável; CSV distingue os
            ciclos, sem achatar um no outro (itens 26, 36). Semeado
            direto com os dois ciclos já prontos — a mecânica de
            CRIAR um ciclo pela UI já foi provada passo a passo em
            13b/13c; aqui o que se examina é a LEITURA multiciclo. ── */
      {
        const semeado13h = apostasProntaParaDecisao();
        semeado13h[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados.decisao = { decisao: 'Reformular a hipótese', proximaAcao: 'testar de novo', dataDecisao: '2026-09-19T10:00:00.000Z', proxHipCausa: 'a fila não tem sinalização clara', proxHipIndicio: 'gente perguntando onde é o fim da fila' };
        semeado13h[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].ciclos = {
          atual: 'c2',
          porId: {
            c1: {
              numero: 1, status: 'FINALIZADO', pontoDeReinicio: null, cicloAnteriorId: null, etapa: 'decisao',
              dados: semeado13h[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados
            },
            c2: {
              numero: 2, status: 'EM_CONSTRUCAO', pontoDeReinicio: 'hipotese', decisaoOrigem: 'Reformular a hipótese', cicloAnteriorId: 'c1', etapa: 'decisao',
              /* Mantém experimento/evidência preenchidos (herdados do
                 seed base) de propósito: a Decisão exige evidência
                 registrada para não segurar CONTINUAR no aviso didático
                 "a decisão precisa se apoiar na evidência" — este cenário
                 quer chegar ao Mapa sem esse desvio, que já é coberto
                 noutro teste. */
              dados: Object.assign({}, DADOS_ATE_EVIDENCIA, {
                hipotese: { causa: 'a fila não tem sinalização clara', indicio: 'gente perguntando onde é o fim da fila' },
                decisao: { decisao: 'Ampliar', proximaAcao: 'ampliar a sinalização nova', dataDecisao: '2026-09-19T11:00:00.000Z' }
              })
            }
          }
        };
        const { ctx: ctx13h, page: pg13h } = await novaPagina(browser, formato, ADM, erros, semeado13h);
        await pg13h.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13h.click('#apostaAbrirBtn');
        await pg13h.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13h.click('.aposta-grupo-btn');
        await pg13h.waitForSelector('#apostaSeguir:not([disabled])', { timeout: 15000 });
        await pg13h.click('#apostaSeguir');
        await pg13h.waitForSelector('.aposta-mapa', { timeout: 8000 });

        const mapaInfo = await pg13h.evaluate(() => {
          const titulos = Array.from(document.querySelectorAll('.aposta-ciclo-titulo')).map((e) => e.textContent);
          const cardsBotao = document.querySelectorAll('button.aposta-mapa-card').length;
          const cardsDiv = document.querySelectorAll('div.aposta-mapa-card').length;
          const texto = document.querySelector('.aposta-mapa').textContent || '';
          return { titulos, cardsBotao, cardsDiv, temHipoteseOriginal: /faltam atendentes no hor[áa]rio de pico/.test(texto), temHipoteseNova: /sinaliza[çc][ãa]o clara/.test(texto) };
        });
        anota('o Mapa mostra uma seção por ciclo quando há mais de um',
          mapaInfo.titulos.length === 2 && /CICLO 1/.test(mapaInfo.titulos[0]) && /CICLO 2/.test(mapaInfo.titulos[1]),
          JSON.stringify(mapaInfo.titulos));
        anota('só os cards do ciclo ATUAL são clicáveis (<button>) — os do Ciclo 1 são <div>, somente leitura',
          mapaInfo.cardsDiv > 0 && mapaInfo.cardsBotao > 0, JSON.stringify({ botao: mapaInfo.cardsBotao, div: mapaInfo.cardsDiv }));
        anota('o Ciclo 1 continua completamente legível no Mapa — a Hipótese ORIGINAL aparece',
          mapaInfo.temHipoteseOriginal, JSON.stringify(mapaInfo));
        anota('o Ciclo 2 mostra a hipótese NOVA, sem misturar com a do Ciclo 1',
          mapaInfo.temHipoteseNova, JSON.stringify(mapaInfo));

        /* Clicar num card do Ciclo 1 (não-atual) não faz nada — nunca
           navega, nunca abre confirmação, porque nem é <button>. */
        const cicloAtualAntes = await pg13h.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos/atual').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        await pg13h.evaluate(() => {
          const cardAntigo = document.querySelector('div.aposta-mapa-card');
          if (cardAntigo) cardAntigo.click();
        });
        await pg13h.waitForTimeout(300);
        const depoisDoCliqueNoAntigo = await pg13h.evaluate(() => ({
          aindaNoMapa: !!document.querySelector('.aposta-mapa'),
          temModal: !!document.querySelector('.aposta-confirmar-overlay'),
        }));
        const cicloAtualDepois = await pg13h.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos/atual').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        anota('clicar num card do Ciclo 1 (não-atual) não navega, não abre modal e não muda cicloAtual (Invariante 7)',
          depoisDoCliqueNoAntigo.aindaNoMapa && !depoisDoCliqueNoAntigo.temModal && cicloAtualDepois === cicloAtualAntes,
          JSON.stringify({ depoisDoCliqueNoAntigo, cicloAtualAntes, cicloAtualDepois }));

        /* CSV: Ciclo 1 e Ciclo 2 aparecem como linhas distintas, cada
           uma com os dados do SEU ciclo — nunca achatados juntos. O
           clique de propósito no card antigo (acima) não abre nem fecha
           o painel — só o botão do cabeçalho faz isso. */
        await pg13h.click('#apostaPainelBtn');
        await pg13h.waitForSelector('#apostaExportar', { timeout: 8000 });
        const [download] = await Promise.all([
          pg13h.waitForEvent('download'),
          pg13h.click('#apostaExportar'),
        ]);
        const caminho = await download.path();
        const conteudoCsv = fs.readFileSync(caminho, 'utf8');
        anota('o CSV tem colunas de Ciclo/Ponto de reinício, distinguindo as duas rodadas de Hipótese',
          /Ciclo/.test(conteudoCsv) && /Ponto de rein[íi]cio/.test(conteudoCsv) &&
          /faltam atendentes/.test(conteudoCsv) && /sinaliza[çc][ãa]o clara/.test(conteudoCsv),
          conteudoCsv.slice(0, 200));

        await ctx13h.close();
      }

      /* ── 13i: retomada — fechar e reabrir no meio do Ciclo 2 volta
            para o ciclo/etapa corretos, nunca de volta ao Ciclo 1. ── */
      {
        const semeado13i = apostasProntaParaDecisao();
        semeado13i[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].ciclos = {
          atual: 'c2',
          porId: {
            c1: { numero: 1, status: 'FINALIZADO', pontoDeReinicio: null, cicloAnteriorId: null, etapa: 'decisao', dados: Object.assign({}, DADOS_ATE_EVIDENCIA, { decisao: { decisao: 'Investigar mais', proximaAcao: 'investigar mais', dataDecisao: '2026-09-19T10:00:00.000Z', pontoDeReinicioEscolhido: 'ideia' } }) },
            c2: {
              numero: 2, status: 'EM_CONSTRUCAO', pontoDeReinicio: 'ideia', decisaoOrigem: 'Investigar mais', cicloAnteriorId: 'c1', etapa: 'experimento',
              dados: Object.assign({}, DADOS_ATE_EVIDENCIA, {
                ideia: { acao: 'testar sinalização nova', mudanca: 'a fila ficar mais organizada' },
                experimento: {}, evidencia: {}, decisao: {}
              })
            }
          }
        };
        const { ctx: ctx13i, page: pg13i } = await novaPagina(browser, formato, ADM, erros, semeado13i);
        await pg13i.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13i.click('#apostaAbrirBtn');
        await pg13i.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13i.click('.aposta-grupo-btn');
        await pg13i.waitForSelector('.aposta-etapa-titulo', { timeout: 15000 });
        const tituloAoAbrir = await pg13i.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('reabrir um grupo em Ciclo 2 retoma na etapa certa do CICLO ATUAL, nunca no Ciclo 1',
          /E\s*—\s*EXPERIMENTO/i.test(tituloAoAbrir), tituloAoAbrir);
        const acaoNaTela = await pg13i.evaluate(() => (document.querySelector('[data-campo="oQue"]') || {}).value || '');
        anota('os dados mostrados são os do Ciclo 2 (Experimento ainda vazio), não os do Ciclo 1',
          acaoNaTela === '', 'campo veio com "' + acaoNaTela + '"');
        await ctx13i.close();
      }

      /* ── 13j: FASE 4 — atomicidade da materialização do Ciclo 1
            implícito → Ciclo 1 explícito + Ciclo 2. O update() final de
            concluirCriacaoCiclo() falha (rede caiu bem ali, depois do
            lock e da leitura do ciclo anterior, mas ANTES da gravação).
            Como é um único update() multi-caminho, nada dele pode
            aparecer: nem o Ciclo 1 congelado, nem o Ciclo 2 novo, nem
            ciclos/atual apontando para qualquer lugar. O grupo continua
            exatamente como um Ciclo 1 implícito (grupos/<id>/dados
            intocado), pronto para a MESMA tentativa ser refeita — sem
            falha, o retry tem de completar sozinho, sem duplicar nada
            (nunca dois Ciclo 2/Ciclo 3 para a mesma Decisão) e SEM
            pular número (INVARIANTE 8 — ver 13m para a bateria
            dedicada à numeração). Mesmo padrão dos testes de falha da
            Fase 1 (9k/9l), agora no ponto exato do pedido do usuário:
            "confirme exatamente como ocorre a transformação". ── */
      {
        const semeado13j = apostasProntaParaDecisao();
        semeado13j[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados.decisao = { decisao: 'Rever o problema', proximaAcao: 'reunir o grupo para redefinir o problema', dataDecisao: '2026-09-19T10:00:00.000Z' };
        const { ctx: ctx13j, page: pg13j } = await novaPagina(browser, formato, ADM, erros, semeado13j);
        await pg13j.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13j.click('#apostaAbrirBtn');
        await pg13j.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13j.click('.aposta-grupo-btn');
        await pg13j.waitForSelector('.aposta-etapa-titulo', { timeout: 15000 });

        await pg13j.evaluate((turmaKey) => {
          window.__CFG.fail = ['apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos/porId'];
        }, TURMA_LIB);
        const tentativaFalha = await pg13j.evaluate(() => new Promise((res) => {
          window.faAposta._criarCiclo('problema', 'Rever o problema', (err) => res(err || null));
        }));
        anota('a tentativa de materializar falha visivelmente (não engole o erro em silêncio)',
          !!tentativaFalha, String(tentativaFalha));

        const estadoAposFalha = await pg13j.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1').once('value', (s) => {
            const v = s.val() || {};
            const ciclos = v.ciclos || {};
            res({
              temAtual: !!ciclos.atual,
              qtdCiclosPorId: Object.keys(ciclos.porId || {}).length,
              dadosProblemaIntacto: (v.dados || {}).problema && v.dados.problema.situacaoIndesejada,
              decisaoIntacta: (v.dados || {}).decisao && v.dados.decisao.dataDecisao,
            });
          });
        }), TURMA_LIB);
        /* Sem contador global (ver INVARIANTE 8), a única escrita antes
           do update() final é o lock (criacaoCicloEmAndamento, liberado
           logo abaixo) — nenhum número, nem ciclo nenhum, é gravado
           antes do update() atômico que pode falhar. */
        anota('falha no update() final: nenhum ciclo aparece em `ciclos/porId` — nem Ciclo 1 parcial, nem Ciclo 2',
          estadoAposFalha.qtdCiclosPorId === 0, JSON.stringify(estadoAposFalha));
        anota('falha no update() final: `ciclos/atual` continua sem apontar para nada (nunca aponta para um ciclo inexistente)',
          !estadoAposFalha.temAtual, JSON.stringify(estadoAposFalha));
        anota('o grupo continua um Ciclo 1 implícito íntegro — dados e a Decisão já salva não foram tocados pela falha',
          !!estadoAposFalha.dadosProblemaIntacto && !!estadoAposFalha.decisaoIntacta, JSON.stringify(estadoAposFalha));

        const temLockAposFalha = await pg13j.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos/criacaoCicloEmAndamento').once('value', (s) => res(!!s.val()));
        }), TURMA_LIB);
        anota('o lock é liberado mesmo quando o update() final falha — a mesma tentativa pode ser refeita na hora',
          !temLockAposFalha, String(temLockAposFalha));

        await pg13j.evaluate(() => { window.__CFG.fail = []; });
        const retrySucesso = await pg13j.evaluate(() => new Promise((res) => {
          window.faAposta._criarCiclo('problema', 'Rever o problema', (err, id) => res({ err: err || null, id }));
        }));
        const estadoAposRetry = await pg13j.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos').once('value', (s) => {
            const v = s.val() || {};
            const porId = v.porId || {};
            const numeros = Object.keys(porId).map((k) => porId[k].numero).sort();
            res({ atualExiste: !!porId[v.atual], qtdCiclos: Object.keys(porId).length, numeros });
          });
        }), TURMA_LIB);
        /* Sem contador global, a tentativa que falhou não consumiu
           nenhum número — o retry tem de nascer com o número CERTO
           (nº 2), nunca um nº 3 "pulando" um Ciclo 2 que nunca existiu
           (INVARIANTE 8). */
        anota('sem a falha, o retry completa sozinho: nascem exatamente Ciclo 1 (nº 1) e Ciclo 2 (nº 2), nunca um nº 3 nem um terceiro ciclo',
          !retrySucesso.err && estadoAposRetry.atualExiste && estadoAposRetry.qtdCiclos === 2 &&
          JSON.stringify(estadoAposRetry.numeros) === JSON.stringify([1, 2]),
          JSON.stringify({ retrySucesso, estadoAposRetry }));

        await ctx13j.close();
      }

      /* ── 13k: FASE 4 — dataDecisao sobrevive a um re-salvamento da
            Decisão. Bug pré-existente (invisível antes da Fase 4, que
            passou a depender de dataDecisao para saber se um ciclo está
            finalizado): re-salvar a etapa Decisão sem alterar nada
            perdia a data já gravada, porque coletar() nunca a
            carregava de volta para o objeto salvo. Prova pelo caminho
            REAL (reabre a Decisão já respondida, edita só a Próxima
            Ação e clica CONTINUAR de novo — o mesmo coletar()+
            salvarEtapa que qualquer clique repetido em CONTINUAR
            dispara) que a data continua a MESMA, não vira uma nova nem
            some. ── */
      {
        const semeado13k = apostasProntaParaDecisao();
        semeado13k[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados.decisao = { decisao: 'Ampliar', proximaAcao: 'ampliar para outros horários', dataDecisao: '2026-09-19T10:00:00.000Z' };
        const { ctx: ctx13k, page: pg13k } = await novaPagina(browser, formato, ADM, erros, semeado13k);
        await pg13k.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13k.click('#apostaAbrirBtn');
        await pg13k.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13k.click('.aposta-grupo-btn');
        await pg13k.waitForSelector('.aposta-opcao', { timeout: 15000 });
        await pg13k.fill('[data-campo="proximaAcao"]', 'ampliar para mais horários ainda');
        await pg13k.waitForTimeout(250);
        await pg13k.click('#apostaSeguir');
        await pg13k.waitForSelector('.aposta-mapa', { timeout: 8000 });

        const decisaoAposResave = await pg13k.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/dados/decisao').once('value', (s) => res(s.val()));
        }), TURMA_LIB);
        anota('re-salvar a Decisão (clicar CONTINUAR de novo) preserva a dataDecisao já gravada — não some, não vira outra',
          decisaoAposResave && decisaoAposResave.dataDecisao === '2026-09-19T10:00:00.000Z', JSON.stringify(decisaoAposResave));
        anota('o resto da Decisão (o que de fato mudou) é atualizado normalmente',
          decisaoAposResave && decisaoAposResave.proximaAcao === 'ampliar para mais horários ainda', JSON.stringify(decisaoAposResave));

        await ctx13k.close();
      }

      /* ── 13l: FASE 4 — cascata ao editar um campo HERDADO (exemplo
            exato do pedido: Ciclo 2 nasce na Hipótese, com Problema e
            Mudanças Mensuráveis herdados do Ciclo 1; a dupla volta e
            edita o Problema herdado). O que vem depois dele NO MESMO
            CICLO (Mudanças, Hipótese, Ideia, Experimento, Evidência,
            Decisão) não pode continuar contando como "confirmado" —
            some, vira "ainda não preenchida" de novo, e o ponto de
            reinício efetivo do ciclo passa a ser o Problema. O Ciclo 1
            (congelado) nunca é tocado — só existe update() no caminho
            do ciclo ATUAL. ── */
      {
        const semeado13l = apostasProntaParaDecisao();
        semeado13l[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados.decisao = { decisao: 'Reformular a hipótese', proximaAcao: 'testar de novo', dataDecisao: '2026-09-19T10:00:00.000Z', proxHipCausa: 'a fila não tem sinalização clara', proxHipIndicio: 'gente perguntando onde é o fim da fila' };
        semeado13l[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].ciclos = {
          atual: 'c2',
          porId: {
            c1: {
              numero: 1, status: 'FINALIZADO', pontoDeReinicio: null, cicloAnteriorId: null, etapa: 'decisao',
              dados: semeado13l[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados
            },
            c2: {
              numero: 2, status: 'EM_CONSTRUCAO', pontoDeReinicio: 'hipotese', decisaoOrigem: 'Reformular a hipótese', cicloAnteriorId: 'c1', etapa: 'hipotese',
              herdadas: ['missao', 'sintoma', 'problema', 'mudancas'],
              dados: {
                missao: DADOS_ATE_EVIDENCIA.missao,
                sintoma: DADOS_ATE_EVIDENCIA.sintoma,
                problema: DADOS_ATE_EVIDENCIA.problema,
                mudancas: DADOS_ATE_EVIDENCIA.mudancas,
                hipotese: { causa: 'a fila não tem sinalização clara', indicio: 'gente perguntando onde é o fim da fila' },
                ideia: {}, experimento: {}, evidencia: {}, decisao: {}
              }
            }
          }
        };
        const c1DadosAntesJson = JSON.stringify(semeado13l[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].ciclos.porId.c1.dados);
        const { ctx: ctx13l, page: pg13l } = await novaPagina(browser, formato, ADM, erros, semeado13l);
        await pg13l.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13l.click('#apostaAbrirBtn');
        await pg13l.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13l.click('.aposta-grupo-btn');
        await pg13l.waitForSelector('.aposta-etapa-titulo', { timeout: 15000 });

        /* Preenche a Hipótese (não-herdada, ponto de reinício atual) e
           segue até a Ideia só para ela também ficar preenchida ANTES
           da edição — assim dá para provar que a cascata realmente
           LIMPA algo que já estava lá, não que só "continuava vazio". */
        await pg13l.evaluate(() => new Promise((res) => {
          window.faAposta._salvarEtapa('ideia', { acao: 'testar sinalização nova', mudanca: 'a fila ficar mais organizada' }, false, () => res());
        }));

        /* Edita o Problema — que é HERDADO neste ciclo. */
        await pg13l.evaluate(() => new Promise((res) => {
          window.faAposta._salvarEtapa('problema', { quem: 'O participante', situacaoIndesejada: 'espera demais e sem noção de quanto falta' }, false, () => res());
        }));

        const cicloAposEdicao = await pg13l.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos').once('value', (s) => {
            const v = s.val() || {};
            res({ c1: v.porId.c1, c2: v.porId.c2 });
          });
        }), TURMA_LIB);

        anota('editar o Problema herdado atualiza o Problema do Ciclo 2 (o dado em si muda, é o que se pediu)',
          cicloAposEdicao.c2.dados.problema.situacaoIndesejada === 'espera demais e sem noção de quanto falta',
          JSON.stringify(cicloAposEdicao.c2.dados.problema));
        anota('Mudanças Mensuráveis (herdada, vinha DEPOIS do Problema) é limpa — não fica implicitamente válida',
          Object.keys(cicloAposEdicao.c2.dados.mudancas || {}).length === 0, JSON.stringify(cicloAposEdicao.c2.dados.mudancas));
        anota('Hipótese (a NOVA deste ciclo, não herdada) também é limpa — nasceu depois do Problema na ordem das etapas',
          Object.keys(cicloAposEdicao.c2.dados.hipotese || {}).length === 0, JSON.stringify(cicloAposEdicao.c2.dados.hipotese));
        anota('Ideia — que a própria dupla acabara de preencher NESTE ciclo — também é limpa pela cascata, sem exceção',
          Object.keys(cicloAposEdicao.c2.dados.ideia || {}).length === 0, JSON.stringify(cicloAposEdicao.c2.dados.ideia));
        anota('Experimento, Evidência e Decisão continuam vazios (já estavam) — cascata não inventa dado, só invalida o que havia',
          Object.keys(cicloAposEdicao.c2.dados.experimento || {}).length === 0 &&
          Object.keys(cicloAposEdicao.c2.dados.evidencia || {}).length === 0 &&
          Object.keys(cicloAposEdicao.c2.dados.decisao || {}).length === 0,
          JSON.stringify(cicloAposEdicao.c2.dados));
        anota('Missão e Sintoma — herdados e ANTES do Problema — continuam intocados, nunca fazem parte da cascata',
          cicloAposEdicao.c2.dados.missao.oQue === DADOS_ATE_EVIDENCIA.missao.oQue &&
          cicloAposEdicao.c2.dados.sintoma.texto === DADOS_ATE_EVIDENCIA.sintoma.texto,
          JSON.stringify({ missao: cicloAposEdicao.c2.dados.missao, sintoma: cicloAposEdicao.c2.dados.sintoma }));
        anota('`herdadas` do Ciclo 2 encolhe para só o que continua genuinamente intocado (Missão, Sintoma) — Problema saiu da lista',
          JSON.stringify((cicloAposEdicao.c2.herdadas || []).slice().sort()) === JSON.stringify(['missao', 'sintoma']),
          JSON.stringify(cicloAposEdicao.c2.herdadas));
        anota('`pontoDeReinicio` efetivo do Ciclo 2 passa a ser o Problema — é daqui que o ciclo precisa ser revisado de novo',
          cicloAposEdicao.c2.pontoDeReinicio === 'problema', cicloAposEdicao.c2.pontoDeReinicio);
        anota('o Ciclo 1 (congelado) não é tocado pela cascata — dados byte-a-byte iguais a antes da edição',
          JSON.stringify(cicloAposEdicao.c1.dados) === c1DadosAntesJson, 'diff detectado no Ciclo 1');

        await ctx13l.close();
      }

      /* ── 13m: FASE 4 — INVARIANTE 8: numeração sequencial de ciclos,
            sem lacunas. Sem contador global, o número do novo ciclo
            vem sempre do ciclo que está fechando (+1) — uma tentativa
            que falha ANTES do update() final nunca "gasta" um número
            que nenhum ciclo chegou a usar de verdade. Chama
            _criarCiclo() direto e em sequência (mesmo padrão de
            13f/13g/13j) para percorrer vários ciclos sem depender da
            UI passo a passo — essa mecânica em si já foi provada via
            UI em 13b/13c/13e. Uma pausa entre chamadas deixa o
            listener .on('value') da execução sincronizar `_grupo` (é
            dele que cicloAtualId() lê o ciclo atual) antes da PRÓXIMA
            chamada precisar saber qual ciclo está fechando. ── */
      {
        const semeado13m = apostasProntaParaDecisao();
        const { ctx: ctx13m, page: pg13m } = await novaPagina(browser, formato, ADM, erros, semeado13m);
        await pg13m.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13m.click('#apostaAbrirBtn');
        await pg13m.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pg13m.click('.aposta-grupo-btn');
        await pg13m.waitForSelector('.aposta-etapa-titulo', { timeout: 15000 });

        /* (1) Ciclo 1 (implícito) → criação bem-sucedida → Ciclo 2 */
        const r1 = await pg13m.evaluate(() => new Promise((res) => {
          window.faAposta._criarCiclo('problema', 'Rever o problema', (err, id, ciclo) => res({ err: err || null, numero: ciclo && ciclo.numero }));
        }));
        await pg13m.waitForTimeout(300);
        anota('(1) Ciclo 1 → criação bem-sucedida → nasce Ciclo 2 (número 2)',
          !r1.err && r1.numero === 2, JSON.stringify(r1));

        /* (2) Ciclo 2 → criação bem-sucedida → Ciclo 3 */
        const r2 = await pg13m.evaluate(() => new Promise((res) => {
          window.faAposta._criarCiclo('mudancas', 'Rever a mudança mensurável', (err, id, ciclo) => res({ err: err || null, numero: ciclo && ciclo.numero }));
        }));
        await pg13m.waitForTimeout(300);
        anota('(2) Ciclo 2 → criação bem-sucedida → nasce Ciclo 3 (número 3)',
          !r2.err && r2.numero === 3, JSON.stringify(r2));

        /* (3)/(4) Falha ao tentar criar o sucessor do Ciclo 3 → retry →
              continua nascendo o CICLO 4 (o sucessor de verdade do
              Ciclo 3) — nunca um número 5, que "pularia" um Ciclo 4 que
              a falha não chegou a criar. */
        await pg13m.evaluate((turmaKey) => {
          window.__CFG.fail = ['apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos/porId'];
        }, TURMA_LIB);
        const falhaC4 = await pg13m.evaluate(() => new Promise((res) => {
          window.faAposta._criarCiclo('hipotese', 'Reformular a hipótese', (err) => res(err || null));
        }));
        anota('a tentativa que cria o sucessor do Ciclo 3 falha visivelmente',
          !!falhaC4, String(falhaC4));
        await pg13m.evaluate(() => { window.__CFG.fail = []; });
        await pg13m.waitForTimeout(200);
        const r3 = await pg13m.evaluate(() => new Promise((res) => {
          window.faAposta._criarCiclo('hipotese', 'Reformular a hipótese', (err, id, ciclo) => res({ err: err || null, numero: ciclo && ciclo.numero }));
        }));
        await pg13m.waitForTimeout(300);
        anota('(3)/(4) falha ao criar o sucessor do Ciclo 3 e retry: nasce o Ciclo 4 (número 4) — nunca um número 5 pulando o Ciclo 4 que a falha não criou',
          !!falhaC4 && !r3.err && r3.numero === 4, JSON.stringify({ falhaC4, r3 }));

        /* (5) Concorrência na criação do sucessor do Ciclo 4: duas
              chamadas quase simultâneas — só uma vence, nasce só UM
              ciclo novo, com o número CERTO. */
        const concorrencia = await pg13m.evaluate(() => Promise.all([
          new Promise((res) => window.faAposta._criarCiclo('problema', 'Rever o problema', (err, id, ciclo) => res({ err: err || null, numero: ciclo && ciclo.numero }))),
          new Promise((res) => window.faAposta._criarCiclo('problema', 'Rever o problema', (err, id, ciclo) => res({ err: err || null, numero: ciclo && ciclo.numero }))),
        ]));
        const vitoriosos5 = concorrencia.filter((r) => !r.err);
        anota('(5) concorrência na criação do sucessor do Ciclo 4: só uma chamada vence, a outra é abortada sem criar nada',
          vitoriosos5.length === 1, JSON.stringify(concorrencia));
        anota('(5) o único ciclo que nasce da concorrência tem o número CERTO (5) — não pulado, não duplicado',
          vitoriosos5.length === 1 && vitoriosos5[0].numero === 5, JSON.stringify(concorrencia));

        const numerosFinais = await pg13m.evaluate((turmaKey) => new Promise((res) => {
          firebase.database().ref('apostas/' + turmaKey + '/execucoes/exec1/grupos/grupo1/ciclos/porId').once('value', (s) => {
            const v = s.val() || {};
            res(Object.keys(v).map((k) => v[k].numero).sort(function (a, b) { return a - b; }));
          });
        }), TURMA_LIB);
        /* (6) Os IDs internos (as chaves de porId) continuam sendo o
              push() key aleatório de sempre — nunca precisaram ser
              sequenciais. A INVARIANTE 8 exige só isto: a sequência de
              NÚMEROS é 1..5, sem lacuna e sem repetição. */
        anota('(6) a sequência final de números dos ciclos é exatamente 1,2,3,4,5 — sem lacunas, sem repetição; IDs internos continuam aleatórios',
          JSON.stringify(numerosFinais) === JSON.stringify([1, 2, 3, 4, 5]), JSON.stringify(numerosFinais));

        await ctx13m.close();
      }

      /* ── 13n: FASE 5 — souFacilitadoraDaTurma() FALHA FECHADA.
            Uma facilitadora GLOBAL (fa-facilitadores) com vínculo REAL
            em turmas-equipe para TURMA_LIB precisa ver o painel; mas se
            a leitura de turmas-equipe falhar, atrasar, ou o módulo que
            a fornece não existir, o resultado tem de ser "não
            autorizado" — nunca cair de volta para "a flag global já
            basta" (era exatamente essa brecha que a Fase 5 fechou). ── */
      {
        const dbComVinculo = {
          'fa-facilitadores': { [chave(FACILITADORA_TURMA)]: { email: FACILITADORA_TURMA, name: 'FACILITADORA TURMA' } },
          'turmas-equipe': { [TURMA_LIB]: { [chave(FACILITADORA_TURMA)]: { email: FACILITADORA_TURMA, name: 'FACILITADORA TURMA', papel: 'facilitador' } } },
          /* Facilitador não-admin só chega em #treinamento (onde vive o
             convite da Aposta) se TAMBÉM tiver nível 'enrolled' — a
             flag de facilitador sozinha não basta pra rota, e não é
             isso que este teste quer examinar (ver router.js). Confirmada
             na própria TURMA_LIB, papel duplo (facilitadora E participante),
             cenário realista. */
          'turmas-interesse': { [TURMA_LIB]: { [chave(FACILITADORA_TURMA)]: {
            name: 'FACILITADORA TURMA', email: FACILITADORA_TURMA, area: 'DIRAD', status: 'inscrito',
            confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN', confirmedDate: '2026-09-01T10:00:00.000Z', date: '2026-09-01T10:00:00.000Z',
          } } },
        };

        /* (a) caminho feliz: flag global + vínculo real -> vê o painel. */
        const semeado13n = apostasProntaParaDecisao();
        const { ctx: ctx13n, page: pg13n } = await novaPagina(browser, formato, FACILITADORA_TURMA, erros, semeado13n, {}, dbComVinculo);
        await pg13n.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13n.click('#apostaAbrirBtn');
        await pg13n.waitForSelector('.aposta-topo', { timeout: 15000 });
        await pg13n.waitForTimeout(300);
        const temPainelFeliz = await pg13n.evaluate(() => !!document.getElementById('apostaPainelBtn'));
        anota('(a) facilitadora global COM vínculo real em turmas-equipe vê o painel do facilitador',
          temPainelFeliz, String(temPainelFeliz));
        await ctx13n.close();
      }

      {
        const dbComVinculo = {
          'fa-facilitadores': { [chave(FACILITADORA_TURMA)]: { email: FACILITADORA_TURMA, name: 'FACILITADORA TURMA' } },
          'turmas-equipe': { [TURMA_LIB]: { [chave(FACILITADORA_TURMA)]: { email: FACILITADORA_TURMA, name: 'FACILITADORA TURMA', papel: 'facilitador' } } },
          /* Facilitador não-admin só chega em #treinamento (onde vive o
             convite da Aposta) se TAMBÉM tiver nível 'enrolled' — a
             flag de facilitador sozinha não basta pra rota, e não é
             isso que este teste quer examinar (ver router.js). Confirmada
             na própria TURMA_LIB, papel duplo (facilitadora E participante),
             cenário realista. */
          'turmas-interesse': { [TURMA_LIB]: { [chave(FACILITADORA_TURMA)]: {
            name: 'FACILITADORA TURMA', email: FACILITADORA_TURMA, area: 'DIRAD', status: 'inscrito',
            confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN', confirmedDate: '2026-09-01T10:00:00.000Z', date: '2026-09-01T10:00:00.000Z',
          } } },
        };

        /* (b) a MESMA pessoa, com o MESMO vínculo real gravado — mas a
              leitura de turmas-equipe falha (rede caiu, regra recusou,
              tanto faz o motivo). turmasElegiveis() já decide isso
              antes de qualquer convite aparecer: como esta pessoa só é
              elegível pelo caminho de facilitadora (nunca também
              confirmada como participante neste cenário), o convite
              inteiro fica ausente — nunca cai para "a flag global já
              basta" nem mostra um convite quebrado. */
        const semeado13nb = apostasProntaParaDecisao();
        const { ctx: ctx13nb, page: pg13nb } = await novaPagina(browser, formato, FACILITADORA_TURMA, erros, semeado13nb, { fail: ['turmas-equipe'] }, dbComVinculo);
        await pg13nb.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13nb.waitForTimeout(600);
        const conviteComFalha = await pg13nb.evaluate(() => {
          const host = document.getElementById('apostaEntrada');
          return { escondido: !host || host.hidden, temBotao: !!document.getElementById('apostaAbrirBtn') };
        });
        anota('(b) FALHA FECHADA: leitura de turmas-equipe falhando nunca concede convite algum, mesmo com vínculo real gravado no banco',
          conviteComFalha.escondido && !conviteComFalha.temBotao, JSON.stringify(conviteComFalha));
        await ctx13nb.close();
      }

      {
        const dbComVinculo = {
          'fa-facilitadores': { [chave(FACILITADORA_TURMA)]: { email: FACILITADORA_TURMA, name: 'FACILITADORA TURMA' } },
          'turmas-equipe': { [TURMA_LIB]: { [chave(FACILITADORA_TURMA)]: { email: FACILITADORA_TURMA, name: 'FACILITADORA TURMA', papel: 'facilitador' } } },
          /* Facilitador não-admin só chega em #treinamento (onde vive o
             convite da Aposta) se TAMBÉM tiver nível 'enrolled' — a
             flag de facilitador sozinha não basta pra rota, e não é
             isso que este teste quer examinar (ver router.js). Confirmada
             na própria TURMA_LIB, papel duplo (facilitadora E participante),
             cenário realista. */
          'turmas-interesse': { [TURMA_LIB]: { [chave(FACILITADORA_TURMA)]: {
            name: 'FACILITADORA TURMA', email: FACILITADORA_TURMA, area: 'DIRAD', status: 'inscrito',
            confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN', confirmedDate: '2026-09-01T10:00:00.000Z', date: '2026-09-01T10:00:00.000Z',
          } } },
        };

        /* (c) a leitura de turmas-equipe é LENTA (4G ruim, mesma
              condição que este projeto trata como normal em sala, não
              exceção — ver CLAUDE.md). Enquanto ela não responde, o
              convite NÃO pode aparecer (começa fechado); assim que
              responde, aparece sozinho, sem precisar recarregar — e só
              então dá para abrir a dinâmica e ver o painel. */
        const semeado13nc = apostasProntaParaDecisao();
        const { ctx: ctx13nc, page: pg13nc } = await novaPagina(browser, formato, FACILITADORA_TURMA, erros, semeado13nc, { delays: { 'turmas-equipe': 2500 } }, dbComVinculo);
        await pg13nc.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pg13nc.waitForTimeout(600);
        const anteDeResponder = await pg13nc.evaluate(() => {
          const host = document.getElementById('apostaEntrada');
          return !host || host.hidden;
        });
        anota('(c) enquanto turmas-equipe não respondeu (rede lenta), o convite começa AUSENTE — nunca aparece "otimista"',
          anteDeResponder, String(anteDeResponder));
        await pg13nc.waitForSelector('#apostaAbrirBtn', { timeout: 5000 });
        await pg13nc.click('#apostaAbrirBtn');
        await pg13nc.waitForSelector('.aposta-topo', { timeout: 15000 });
        await pg13nc.waitForTimeout(300);
        const temPainelDepois = await pg13nc.evaluate(() => !!document.getElementById('apostaPainelBtn'));
        anota('(c) assim que a leitura lenta responde, o convite aparece sozinho e o painel também, sem precisar recarregar',
          temPainelDepois, String(temPainelDepois));
        await ctx13nc.close();
      }

      anota('nenhum erro de JavaScript', erros.length === 0, erros[0]);

      await ctx.close();
      await ctxAdm.close();
    } catch (e) {
      falhas++;
      console.error('  FALHA inesperada (' + formato.nome + '): ' + e.message);
    }
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTudo certo: a dinâmica guarda o segredo até o facilitador revelar, e as etapas abrem uma por vez.');
})();
