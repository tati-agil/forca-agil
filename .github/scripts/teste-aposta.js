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

async function novaPagina(browser, formato, email, erros, apostas, cfgExtra) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({
    db: banco(apostas), user: { email: email, emailVerified: true, uid: 'u1' }, delayDefault: 20,
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
        await novo.waitForSelector('#apostaPainelBtn', { timeout: 15000 });
        await novo.click('#apostaPainelBtn');
        await novo.waitForSelector('#apostaCriarGrupo', { timeout: 10000 });
        const notaGrupo = await novo.evaluate(() => document.body.textContent || '');
        anota('o painel avisa que um grupo pode ser uma pessoa sozinha ou várias',
          /Cada grupo pode ser formado por uma ou mais pessoas/i.test(notaGrupo));
        await novo.fill('#apostaNovoGrupo', 'Grupo 1');
        await novo.click('#apostaCriarGrupo');
        await novo.waitForTimeout(500);
        const criou = await novo.evaluate(() => /Grupo 1/.test(document.body.textContent || ''));
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

        /* Remover missão-base: pede confirmação e volta ao estado sem missão-base. */
        novo.once('dialog', (d) => d.accept());
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
          const tituloAntesBloqueio = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
          await clicarSemRolagem(page, '#apostaSeguir');
          await page.waitForTimeout(300);
          const bloqueio1 = await page.evaluate(() => (document.getElementById('apostaAvisos') || {}).textContent || '');
          anota('"Reduzir" com meta maior que a situação atual BLOQUEIA Continuar, apontando para o card errado',
            /Corrija a mudança mensurável destacada/.test(bloqueio1), bloqueio1);
          await clicarSemRolagem(page, '#apostaSeguir');   /* diferente do aviso didático: o 2º clique NÃO libera */
          await page.waitForTimeout(300);
          const aindaBloqueado = await page.evaluate(() => ({
            titulo: (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '',
            aviso: (document.getElementById('apostaAvisos') || {}).textContent || '',
          }));
          anota('o bloqueio de coerência NÃO tem escape por segundo clique, ao contrário do aviso didático',
            aindaBloqueado.titulo === tituloAntesBloqueio && /Corrija a mudança mensurável destacada/.test(aindaBloqueado.aviso), JSON.stringify(aindaBloqueado));

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

            /* Sem classificação global da hipótese: uma etapa que produz
               várias evidências diferentes não pode ser reduzida a um
               veredito único aqui — isso é da Decisão. */
            const semClassificacao = await page.evaluate(() =>
              !/Nossa hip[óo]tese foi/i.test(document.body.textContent || '') && !document.querySelector('.aposta-escolha'));
            anota('não existe mais "Nossa hipótese foi" nem classificação de sustentada/não sustentada na Evidência', semClassificacao);

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

            const tituloAntesEvVazia = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            await clicarSemRolagem(page, '#apostaSeguir');
            await page.waitForTimeout(300);
            const tituloDepoisEvVazia = await page.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
            anota('Continuar bloqueia de verdade até o Plano de Evidência estar completo',
              tituloDepoisEvVazia === tituloAntesEvVazia);
            const avisoPlanoIncompleto = await page.evaluate(() => (document.getElementById('apostaAvisos') || {}).textContent || '');
            anota('o bloqueio em planejamento orienta a completar o Plano de Evidência, não a preencher resultado observado',
              /Plano de Evid[êe]ncia/i.test(avisoPlanoIncompleto) && !/Resultado observado/i.test(avisoPlanoIncompleto),
              avisoPlanoIncompleto);

            await page.selectOption('[data-e="fontePrevista"]', 'Dados do sistema');
            await page.waitForTimeout(300);
            const botaoPronto = await page.evaluate(() => (document.getElementById('apostaSeguir') || {}).textContent || '');
            anota('plano completo: o botão principal muda para "Registrar resultados do experimento"',
              /Registrar resultados do experimento/i.test(botaoPronto), botaoPronto);
            const prontoBloco = await page.evaluate(() => (document.body.textContent || '').includes('PLANO DE EVIDÊNCIA PRONTO'));
            anota('com o plano completo, aparece o bloco "PLANO DE EVIDÊNCIA PRONTO" com a opção de encerrar por agora', prontoBloco);

            await clicarSemRolagem(page, '#apostaSeguir');
            await page.waitForTimeout(300);
            const modoRegistro = await page.evaluate(() => ({
              banner: (document.querySelector('.aposta-campos .aposta-herdada') || {}).textContent || '',
              pergunta: (document.querySelector('.aposta-pergunta') || {}).textContent || '',
              fontePreenchida: (document.querySelector('[data-e="fonte"]') || {}).value || '',
              titulo: (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '',
            }));
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

            await page.fill('[data-campo="proxHipCausa"]', 'a mensagem não chega a quem está em análise');
            await page.fill('[data-campo="proxHipIndicio"]', 'os contatos caíram só no grupo que recebeu a mensagem');
            /* Decisão é frase estrita (ver ETAPAS_FRASE_ESTRITA): sem a
               próxima ação, a prévia mostra só a orientação do que
               falta, não a frase com "Próxima ação:" em branco. */
            await page.fill('[data-campo="proximaAcao"]', 'testar a nova hipótese com um novo experimento');
            await page.waitForTimeout(300);
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

      /* ── 3b: digitar e seguir DENTRO dos 600ms não pode apagar a etapa ──
         O salvamento automático espera 600ms. Enquanto ele relia a tela na
         hora de gravar, quem clicava em Continuar antes disso via a etapa
         recém-preenchida ser sobrescrita pelos campos vazios da etapa
         seguinte — e o mapa a mostrava como "ainda não preenchido".
         Relatado no primeiro uso real. */
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll('.aposta-trilha-item'))
          .find((i) => /Ideia de solução/.test(i.textContent));
        if (t && !t.disabled) t.click();
      });
      await page.waitForFunction(() =>
        /IDEIA DE SOLU/i.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
        { timeout: 15000 });
      await page.locator('.aposta-campo-input').first().fill('texto que não pode sumir');
      /* Sem esperar o debounce: é essa pressa que reproduzia o defeito. */
      await page.click('#apostaSeguir');
      await page.waitForTimeout(1400);   /* tempo de o temporizador antigo disparar */
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll('.aposta-trilha-item'))
          .find((i) => /Ideia de solução/.test(i.textContent));
        if (t) t.click();
      });
      await page.waitForTimeout(500);
      const sobreviveu = await page.evaluate(() =>
        (document.querySelector('.aposta-campo-input') || {}).value || '');
      anota('seguir antes do salvamento automático NÃO apaga a etapa',
        /texto que não pode sumir/.test(sobreviveu), 'campo voltou como "' + sobreviveu + '"');

      /* Volta ao mapa clicando Continuar até chegar lá — não importa em que
         etapa o desvio acima deixou a tela. */
      for (let n = 0; n < 14; n++) {
        if (await page.evaluate(() => !!document.querySelector('.aposta-mapa'))) break;
        await page.click('#apostaSeguir');
        await page.waitForTimeout(350);
        const segurou = await page.evaluate(() => {
          const el = document.querySelector('#apostaAvisos');
          return !!el && !!el.textContent.trim();
        });
        if (segurou) { await page.click('#apostaSeguir'); await page.waitForTimeout(350); }
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
        decisao:  { decisao: 'Ajustar e testar novamente', proximaAcao: 'novo teste com grupo maior' }
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
           testes de frase.) Não há classificação global da hipótese para
           checar aqui — só o próprio card precisa estar completo. */
        await pgEv.selectOption('[data-e="fonte"]', '');
        await pgEv.waitForTimeout(200);
        const tituloAntesEv = await pgEv.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        await pgEv.$eval('#apostaSeguir', (el) => el.click());
        await pgEv.waitForTimeout(300);
        const bloqueioSemFonte = await pgEv.evaluate(() => (document.getElementById('apostaAvisos') || {}).textContent || '');
        anota('CONTINUAR bloqueia sem Fonte utilizada, mesmo com Resultado observado preenchido',
          /preencha .Resultado observado.,? .Fonte utilizada./i.test(bloqueioSemFonte), bloqueioSemFonte);
        await pgEv.$eval('#apostaSeguir', (el) => el.click());
        await pgEv.waitForTimeout(300);
        const tituloDepoisSemFonte = await pgEv.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('o bloqueio de Evidência incompleta NÃO tem escape por segundo clique', tituloDepoisSemFonte === tituloAntesEv);

        /* Aprendizado é obrigatório quando o resultado foi medido de
           verdade — um número sozinho não é aprendizado. Observado +
           Fonte preenchidos, mas sem aprendizado, continua bloqueado. */
        await pgEv.selectOption('[data-e="fonte"]', 'Registros de atendimento');
        await pgEv.waitForTimeout(200);
        const notaFaltaAprendizadoAntes = await pgEv.evaluate(() => (document.querySelector('[data-falta-aprendizado]') || {}).textContent || '');
        anota('o card mostra "Ainda falta: o aprendizado" quando observado+fonte já existem mas o aprendizado ainda não',
          /Ainda falta: o aprendizado/i.test(notaFaltaAprendizadoAntes), notaFaltaAprendizadoAntes);
        await pgEv.$eval('#apostaSeguir', (el) => el.click());
        await pgEv.waitForTimeout(300);
        const bloqueioSemAprendizado = await pgEv.evaluate(() => (document.getElementById('apostaAvisos') || {}).textContent || '');
        const tituloDepoisSemAprendizado = await pgEv.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('CONTINUAR bloqueia sem o aprendizado, mesmo com Resultado observado e Fonte preenchidos',
          /aprendemos com esta evid[êe]ncia/i.test(bloqueioSemAprendizado) && tituloDepoisSemAprendizado === tituloAntesEv,
          bloqueioSemAprendizado);

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
        await pgEv.$eval('#apostaSeguir', (el) => el.click());
        await pgEv.waitForTimeout(300);
        const bloqueioSemMotivo = await pgEv.evaluate(() => (document.getElementById('apostaAvisos') || {}).textContent || '');
        anota('marcado "Não foi possível medir" mas sem Motivo, CONTINUAR continua bloqueado',
          /preencha .Resultado observado.,? .Fonte utilizada./i.test(bloqueioSemMotivo), bloqueioSemMotivo);

        await pgEv.fill('[data-e="motivo"]', 'a pesquisa não foi concluída dentro do período do experimento');
        await pgEv.waitForTimeout(200);
        await pgEv.$eval('#apostaSeguir', (el) => el.click());
        await pgEv.waitForTimeout(300);
        const tituloDepoisCompleto = await pgEv.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('"Não foi possível medir" + Motivo: CONTINUAR libera (não precisa de número nem de classificação)',
          tituloDepoisCompleto !== tituloAntesEv, tituloDepoisCompleto);

        await ctxEv.close();
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
        const tituloAntesNM = await pgNM.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        await pgNM.$eval('#apostaSeguir', (el) => el.click());
        await pgNM.waitForTimeout(300);
        const tituloDepoisNM = await pgNM.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('"não foi possível medir" + motivo também libera Continuar (é a outra forma válida de completar)',
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
            contexto da Evidência (fonte + aprendizado, por resultado —
            não existe classificação nem conclusão únicas da etapa) e os
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
        anota('a Decisão mostra a fonte e o aprendizado registrados na Evidência, sem classificação única da hipótese',
          /Fonte: Relat[óo]rio/i.test(contexto) &&
          /a redução ainda não foi suficiente/i.test(contexto) &&
          !/Nossa hip[óo]tese foi/i.test(contexto),
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
        anota('com a decisão escolhida mas sem próxima ação, a orientação pede só o que falta',
          soFaltaAcao === 'Fica assim no mapaDefina a próxima ação para completar a decisão.', soFaltaAcao);
        await pgDec.$eval('#apostaSeguir', (el) => el.click());
        await pgDec.waitForTimeout(300);
        const tituloDepoisSemAcao = await pgDec.evaluate(() => (document.querySelector('.aposta-etapa-titulo') || {}).textContent || '');
        anota('Decisão com decisão escolhida mas sem próxima ação continua bloqueando', tituloDepoisSemAcao === tituloAntesDec);

        /* "Ampliar" com uma meta que não foi batida: alerta não-bloqueante,
           com os dois botões — nunca muda a decisão sozinho. */
        await pgDec.locator('.aposta-opcao', { hasText: 'Ampliar' }).click();
        await pgDec.waitForTimeout(200);
        const alertaAmpliar = await pgDec.evaluate(() => {
          const el = document.getElementById('apostaDecisaoAlerta');
          return el ? { texto: el.textContent.replace(/\s+/g, ' '), botoes: Array.from(el.querySelectorAll('button')).map((b) => b.textContent.trim()) } : null;
        });
        anota('escolher "Ampliar" sem a meta batida mostra o alerta de coerência, com os dois botões',
          !!alertaAmpliar && /Ampliar/.test(alertaAmpliar.texto) &&
          alertaAmpliar.botoes.includes('MANTER DECISÃO') && alertaAmpliar.botoes.includes('REVER DECISÃO'),
          JSON.stringify(alertaAmpliar));

        await pgDec.locator('#apostaDecisaoAlerta button', { hasText: 'MANTER DECISÃO' }).click();
        await pgDec.waitForTimeout(150);
        const decisaoContinuaAmpliar = await pgDec.evaluate(() => {
          const ativa = document.querySelector('.aposta-opcao.is-ativa');
          const alerta = document.getElementById('apostaDecisaoAlerta');
          return { valor: ativa ? ativa.dataset.valor : '', alertaVazio: !alerta || !alerta.textContent.trim() };
        });
        anota('"MANTER DECISÃO" só dispensa o alerta — não muda a decisão escolhida',
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
