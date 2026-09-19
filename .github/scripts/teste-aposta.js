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
 *    para o efeito acabar, e ninguém percebe lendo o código: são dez
 *    telas de texto. Aqui a conferência é mecânica, tela por tela.
 *
 * 2. AS ETAPAS SEGUINTES NÃO PODEM ABRIR SOZINHAS — NEM PELO NOME. O
 *    valor está em percorrer o raciocínio — sintoma, depois problema,
 *    depois hipótese. Se o formulário inteiro aparecer de uma vez, o
 *    grupo pula direto para a solução, que é o hábito que a oficina
 *    existe para interromper. E o nome sozinho já induz: quem lê
 *    "Hipótese" na trilha escreve o sintoma pensando na explicação.
 *    A trilha mostra os NÚMEROS das dez etapas; os nomes só quando
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
 *   3. a trilha lista as dez etapas, mas as ainda não alcançadas estão
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
        await novo.fill('#apostaNovoGrupo', 'Grupo 1');
        await novo.click('#apostaCriarGrupo');
        await novo.waitForTimeout(500);
        const criou = await novo.evaluate(() => /Grupo 1/.test(document.body.textContent || ''));
        anota('a facilitadora abre a dinâmica do zero e cria um grupo', criou);

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
        await novo.fill('[data-mis="verbo"]', 'Reduzir');
        await novo.click('#apostaSalvarMissao');
        await novo.waitForTimeout(400);
        const gravouMissao = await novo.evaluate(() => (window.__ESCRITAS || [])
          .filter((x) => /\/missao$/.test(x.path)).slice(-1)[0] || null);
        const salvo = gravouMissao && (gravouMissao.valor !== undefined ? gravouMissao.valor : gravouMissao.value);
        anota('salvar a missão grava as lacunas, não um texto solto',
          !!salvo && typeof salvo === 'object' && salvo.verbo === 'Reduzir',
          JSON.stringify(gravouMissao));
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
          evidencia: { esperado: 'menos contatos', observado: '25% menos' },
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
         Dois defeitos vistos na tela: "e medir" sozinho numa linha entre
         dois campos largos, sem nada dizendo a que campo pertencia; e o
         custo "10.0000", gravado antes da máscara existir, aparecendo cru
         como se máscara nenhuma houvesse. */
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
            .find((p) => /e medir/.test((p.querySelector('.aposta-molde-fixo') || {}).textContent || ''));
          return !!(par && par.querySelector('[data-campo="medida"]'));
        });
        anota('"e medir" vem no mesmo bloco do campo que ele apresenta', juntos);

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
        await ctxM.close();
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

      /* Trilha: dez nomes, e as etapas à frente fechadas. */
      const trilha = await page.evaluate(() => {
        const itens = Array.from(document.querySelectorAll('.aposta-trilha-item'));
        return {
          total: itens.length,
          bloqueadas: itens.filter((i) => i.disabled).length,
          nomes: itens.map((i) => (i.textContent || '').trim()).join(' | '),
        };
      });
      anota('a trilha mostra as dez etapas desde o começo', trilha.total === 10, 'vieram ' + trilha.total);
      anota('as etapas ainda não alcançadas estão fechadas', trilha.bloqueadas >= 8, trilha.bloqueadas + ' fechadas');
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
        lacunas: document.querySelectorAll('.aposta-molde .aposta-campo-input').length,
        previa: (document.querySelector('.aposta-frase') || {}).textContent || '',
        semQuadroAntigo: !document.querySelector('.aposta-template'),
      }));
      anota('a etapa mostra o texto FIXO da frase na própria tela',
        molde.fixos.indexOf('em') !== -1, molde.fixos.join(' | '));
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

      /* Percorre as dez etapas preenchendo um campo em cada. */
      const vazados = [];
      for (let i = 0; i < 10; i++) {
        const txt = await textoDaTela(page);
        if (SEGREDO.test(txt)) vazados.push((txt.match(SEGREDO) || [''])[0] + ' na etapa ' + (i + 1));

        if (i === 1) {
          /* Etapa do sintoma: escreve uma causa de propósito e confere que
             o aviso aparece — e que ainda assim dá para seguir. */
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
             no primeiro campo — foi o que aconteceu no primeiro uso real. */
          await page.locator('[data-campo="quem"]').fill('Os participantes');
          await page.locator('[data-campo="naoConsegue"]').fill('acompanhar o andamento');
          await page.waitForTimeout(300);
          const previa = await page.evaluate(() => {
            const el = document.getElementById('apostaFrase');
            return el && !el.hidden ? (el.textContent || '').replace(/\s+/g, ' ') : '';
          });
          anota('a etapa monta a frase ao vivo, como vai sair no mapa',
            /Fica assim no mapa/i.test(previa) &&
            /Os participantes não consegue acompanhar o andamento/i.test(previa),
            previa.slice(0, 120));

          /* "Os participantes não consegue" é o plural errado que o molde
             fixo produzia. A forma do verbo é de quem escreve — um clique
             no chip preenche rápido com uma das formas prontas. */
          await page.locator('.aposta-variante:has([data-campo="verbo"]) .aposta-variante-chip', { hasText: 'não conseguem' }).click();
          await page.waitForTimeout(300);
          const comPlural = await page.evaluate(() =>
            ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
          anota('a concordância do verbo é escolhida por quem escreve',
            /Os participantes não conseguem acompanhar/i.test(comPlural), comPlural.slice(0, 120));

          /* "restringir demais" — nem toda concordância cabe nas duas formas
             prontas ("não tem conseguido" não é nenhuma delas). Relatado no
             uso real: precisa dar para escrever por cima, não só escolher. */
          await page.fill('[data-campo="verbo"]', 'não tem conseguido');
          await page.waitForTimeout(300);
          const livre = await page.evaluate(() =>
            ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
          anota('o campo aceita uma variante que não é nenhuma das prontas',
            /Os participantes não tem conseguido acompanhar/i.test(livre), livre.slice(0, 120));
          const chipsSemAtivo = await page.evaluate(() =>
            !document.querySelector('.aposta-variante:has([data-campo="verbo"]) .aposta-variante-chip.is-ativa'));
          anota('nenhum chip fica marcado quando o texto não bate com nenhum deles', chipsSemAtivo);
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
          await page.fill('[data-m="prazo"]', '90');
          await page.selectOption('[data-m="prazoUnidade"]', 'dias');
          await page.waitForTimeout(300);
          const frase = await page.evaluate(() =>
            (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
          anota('a frase consolidada é montada sozinha',
            /de 1000/.test(frase) && /para 700/.test(frase) && /90 dias/.test(frase), frase);

          /* "Queremos" também não pode travar em só duas direções. */
          await page.fill('[data-m="direcao"]', 'Manter estável');
          await page.waitForTimeout(300);
          const fraseLivre = await page.evaluate(() =>
            (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
          anota('"Queremos" aceita uma direção que não é Aumentar nem Reduzir',
            /Manter estável/.test(fraseLivre), fraseLivre);

          /* Unidade: também virou chips + texto livre, mas é OPCIONAL — não
             pode nascer com "por mês" já escrito como se alguém tivesse
             respondido, só a dica. */
          const unidadeInicial = await page.evaluate(() => (document.querySelector('[data-m="unidade"]') || {}).value || '');
          anota('a Unidade nasce vazia de verdade (não força a primeira opção)', unidadeInicial === '', 'ficou "' + unidadeInicial + '"');
          await page.locator('.aposta-variante:has([data-m="unidade"]) .aposta-variante-chip', { hasText: 'por semana' }).click();
          await page.waitForTimeout(200);
          const unidadeChip = await page.evaluate(() => (document.querySelector('[data-m="unidade"]') || {}).value || '');
          anota('um clique no chip preenche a Unidade', unidadeChip === 'por semana', 'ficou "' + unidadeChip + '"');
        } else {
          if (i === 7) {
            /* EXPERIMENTO: custo com máscara de moeda. */
            await page.fill('[data-campo="custo"]', '250000');
            await page.waitForTimeout(250);
            const custo = await page.evaluate(() => (document.querySelector('[data-campo="custo"]') || {}).value || '');
            anota('o custo estimado sai formatado como moeda', /^R\$\s?2\.500,00$/.test(custo), 'ficou "' + custo + '"');
          }
          if (i === 9) {
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

            const grupo = await page.evaluate(() => {
              const g = document.querySelector('.aposta-grupo');
              return {
                rotulo: g ? (g.querySelector('.aposta-grupo-rot') || {}).textContent || '' : '',
                fixo: g ? Array.from(g.querySelectorAll('.aposta-molde-fixo')).map((e) => e.textContent.trim()).join(' | ') : '',
                lacunas: g ? g.querySelectorAll('.aposta-campo-input').length : 0,
              };
            });
            anota('a próxima hipótese tem o mesmo apoio de preenchimento da hipótese',
              /Próxima hipótese/i.test(grupo.rotulo) && /Acreditamos que isso acontece porque/.test(grupo.fixo) &&
              /pois/.test(grupo.fixo) && grupo.lacunas === 2,
              JSON.stringify(grupo));

            /* "Quando aplicável" não dizia qual é o critério — e o
               critério é a decisão que acabou de ser tomada, então a
               escolha vem antes da conferência. */
            await page.locator('.aposta-opcao').first().click();
            await page.waitForTimeout(300);
            const criterio = await page.evaluate(() => ({
              dica: (document.querySelector('.aposta-grupo-dica') || {}).textContent || '',
              agora: (document.querySelector('.aposta-grupo-agora') || {}).textContent || '',
            }));
            anota('o bloco diz que as duas lacunas são uma frase só, e quando preencher',
              /uma frase só/i.test(criterio.dica) && /formular nova hipótese/i.test(criterio.dica) &&
              /deixe em branco/i.test(criterio.dica), criterio.dica.slice(0, 120));
            anota('a decisão escolhida já diz se este bloco se aplica',
              /pede uma próxima hipótese|pode ficar em branco/i.test(criterio.agora), criterio.agora);

            const fraseDec = await page.evaluate(() =>
              ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
            anota('a frase da decisão não tem traço solto no meio',
              /Próxima ação:/.test(fraseDec) && !/—/.test(fraseDec), fraseDec.slice(0, 140));
          }
          const campo = page.locator('.aposta-campo-input').first();
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
      anota('o mapa final tem um card por etapa', mapa.cards === 10, 'vieram ' + mapa.cards);
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
      anota('o texto exportado traz as dez etapas, com a pergunta de cada uma',
        (exporta.texto.match(/^## /gm) || []).length === 10 &&
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
      /* Grupo com as dez etapas preenchidas: é assim que a turma chega ao
         fim da dinâmica, e é o estado em que a revelação faz sentido. */
      semeado[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
        missao:   { texto: 'Melhorar a experiência do participante em 90 dias' },
        sintoma:  { texto: 'muita gente liga para saber o status' },
        problema: { quem: 'Os participantes', naoConsegue: 'acompanhar o andamento', evidenciadoPor: 'contatos frequentes' },
        mudancas: { itens: [{ direcao: 'Reduzir', indicador: 'contatos sobre andamento', atual: '1000', meta: '700', unidade: 'por mês', prazo: '90 dias' }] },
        hipotese: { causa: 'as informações não são claras', indicio: 'muitas perguntas de status' },
        ideia:    { texto: 'dar visibilidade do andamento' },
        versao:   { semConstruir: 'o portal', podemos: 'enviar mensagem manual' },
        experimento: { oQue: 'enviar a mensagem', comQuem: 'participantes', quantidade: '50', duracao: '3 semanas', medida: 'nº de contatos' },
        evidencia: { esperado: 'menos contatos', observado: '25% menos contatos', classificacao: 'Parcialmente sustentada' },
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

      /* ── 9: "Sem construir" e "Esperávamos" nascem com um ponto de
            partida, em vez de pedir de novo o que já foi escrito noutra
            etapa — "não deveria vir preenchido?", perguntado no uso real
            olhando a etapa em branco logo depois de nomear a mesma
            solução em Ideia de solução. Os dois continuam editáveis: é
            só o valor inicial que muda, o que fica salvo é sempre o que
            está na tela quando o grupo segue em frente. ── */
      {
        const semeadoPre = apostasSemeadas();
        semeadoPre[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoPre[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          ideia: { acao: 'dar mais visibilidade sobre o andamento', mudanca: 'para reduzir contatos' },
          mudancas: { itens: [{ direcao: 'Reduzir', indicador: 'contatos sobre andamento', atual: '1000', meta: '700', unidade: 'por mês', prazo: '90', prazoUnidade: 'dias' }] },
        };
        const { ctx: ctxP, page: pgP } = await novaPagina(browser, formato, DIRETORA, erros, semeadoPre);
        await pgP.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgP.click('#apostaAbrirBtn');
        await pgP.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgP.click('.aposta-grupo-btn');
        await pgP.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });

        /* "Esperávamos" é literalmente a mudança que se queria ver — vem
           da mudança mensurável já registrada, números incluídos. A
           direção ("Reduzir") começa a mudança com maiúscula de início
           de frase própria — mas aqui ela entra DEPOIS de "Esperávamos",
           então a primeira letra vem minúscula, para continuar a frase
           em vez de começar outra no meio dela. */
        const esperado = await pgP.evaluate(() => (document.getElementById('ap-esperado') || {}).value || '');
        anota('"Esperávamos" nasce com a mudança mensurável já nomeada, não em branco',
          /^reduzir/.test(esperado) && /contatos sobre andamento/.test(esperado) &&
          /1000/.test(esperado) && /700/.test(esperado),
          'ficou "' + esperado.slice(0, 100) + '"');

        await pgP.evaluate(() => {
          const t = Array.from(document.querySelectorAll('.aposta-trilha-item'))
            .find((i) => /Vers[ãa]o test[áa]vel/.test(i.textContent));
          if (t && !t.disabled) t.click();
        });
        await pgP.waitForFunction(() =>
          /VERS[ÃA]O TEST[ÁA]VEL/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const semConstruir = await pgP.evaluate(() => (document.getElementById('ap-semConstruir') || {}).value || '');
        anota('"Sem construir" nasce com a ação já escrita em Ideia de solução, não em branco',
          semConstruir === 'dar mais visibilidade sobre o andamento', 'ficou "' + semConstruir + '"');

        /* A ação de Ideia de solução é um VERBO ("dar…"), e o texto fixo
           antes da lacuna não pode emendar outro ("Sem construir dar…") —
           relatado no uso real. Só "Sem" fica antes, sem "construir". */
        const fraseSemConstruir = await pgP.evaluate(() =>
          ((document.querySelector('.aposta-molde-fixo') || {}).textContent || '').trim());
        anota('o texto fixo antes da lacuna é só "Sem", sem grudar outro verbo',
          fraseSemConstruir === 'Sem', 'ficou "' + fraseSemConstruir + '"');

        /* Continua editável: é só um ponto de partida, não um valor travado. */
        await pgP.fill('#ap-semConstruir', 'outra coisa que o grupo decidiu escrever');
        await pgP.waitForTimeout(300);
        const editado = await pgP.evaluate(() => (document.getElementById('ap-semConstruir') || {}).value || '');
        anota('o valor inicial pode ser editado normalmente',
          editado === 'outra coisa que o grupo decidiu escrever', 'ficou "' + editado + '"');

        /* "por meio de" + "do envio…" lia "por meio de do envio…" — duas
           preposições coladas. Relatado no uso real. */
        await pgP.fill('#ap-podemos', 'do envio de mensagem manual sobre o andamento');
        await pgP.waitForTimeout(300);
        const fraseSemDeDuplo = await pgP.evaluate(() =>
          ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
        anota('"de" + "do" não vira "de do" quando a resposta já começa com a preposição',
          /por meio do envio de mensagem/.test(fraseSemDeDuplo) && !/por meio de do/.test(fraseSemDeDuplo),
          fraseSemDeDuplo.slice(0, 160));

        /* E quando a resposta NÃO começa com "de"/"do", o "de" fixo continua
           — não é para sumir sempre, só quando bateria de frente. */
        await pgP.fill('#ap-podemos', 'uma mensagem manual com a etapa atual');
        await pgP.waitForTimeout(300);
        const fraseComDe = await pgP.evaluate(() =>
          ((document.getElementById('apostaFrase') || {}).textContent || '').replace(/\s+/g, ' '));
        anota('o "de" continua quando a resposta não começa com preposição',
          /por meio de uma mensagem manual/.test(fraseComDe), fraseComDe.slice(0, 160));

        await ctxP.close();
      }

      /* ── 9b: sobra do próprio exemplo não trava o prefill para sempre —
            relatado no uso real: "Sem construir" continuava mostrando "o
            acompanhamento no portal" (a dica do campo, escrita ali antes de
            o prefill existir) mesmo depois de a Ideia ganhar uma resposta
            de verdade. Um valor de verdade, diferente do exemplo, continua
            preservado — não é para sobrescrever o que o grupo escolheu. ── */
      {
        const semeadoSobra = apostasSemeadas();
        semeadoSobra[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'versao';
        semeadoSobra[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          ideia: { acao: 'disponibilizar no portal os status da concessão', mudanca: 'para reduzir contatos' },
          versao: { semConstruir: 'o acompanhamento no portal' },
        };
        const { ctx: ctxS, page: pgS } = await novaPagina(browser, formato, DIRETORA, erros, semeadoSobra);
        await pgS.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgS.click('#apostaAbrirBtn');
        await pgS.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgS.click('.aposta-grupo-btn');
        await pgS.waitForFunction(() =>
          /VERS[ÃA]O TEST[ÁA]VEL/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const semConstruirSobra = await pgS.evaluate(() => (document.getElementById('ap-semConstruir') || {}).value || '');
        anota('a sobra do exemplo é substituída pela resposta de verdade da Ideia',
          semConstruirSobra === 'disponibilizar no portal os status da concessão',
          'ficou "' + semConstruirSobra + '"');
        await ctxS.close();
      }

      /* ── 9c: uma resposta de verdade em "Sem construir", diferente da
            Ideia, NÃO é sobrescrita — o prefill só entra quando o campo
            está vazio ou com a própria dica, nunca por cima do que o
            grupo escolheu escrever. ── */
      {
        const semeadoReal = apostasSemeadas();
        semeadoReal[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'versao';
        semeadoReal[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          ideia: { acao: 'disponibilizar no portal os status da concessão', mudanca: 'para reduzir contatos' },
          versao: { semConstruir: 'um painel completo de acompanhamento' },
        };
        const { ctx: ctxR, page: pgR } = await novaPagina(browser, formato, DIRETORA, erros, semeadoReal);
        await pgR.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgR.click('#apostaAbrirBtn');
        await pgR.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgR.click('.aposta-grupo-btn');
        await pgR.waitForFunction(() =>
          /VERS[ÃA]O TEST[ÁA]VEL/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const semConstruirReal = await pgR.evaluate(() => (document.getElementById('ap-semConstruir') || {}).value || '');
        anota('uma resposta de verdade, diferente da Ideia, não é sobrescrita',
          semConstruirReal === 'um painel completo de acompanhamento',
          'ficou "' + semConstruirReal + '"');
        await ctxR.close();
      }

      /* ── 9d: mesma checagem de sobra do exemplo, agora em "Esperávamos"
            (Evidência), que nasce da mudança mensurável já registrada. ── */
      {
        const semeadoSobraEv = apostasSemeadas();
        semeadoSobraEv[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoSobraEv[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ direcao: 'Reduzir', indicador: 'reclamações sobre prazo', atual: '200', meta: '50', unidade: 'por mês', prazo: '60', prazoUnidade: 'dias' }] },
          evidencia: { esperado: 'redução dos contatos sobre andamento' },
        };
        const { ctx: ctxSE, page: pgSE } = await novaPagina(browser, formato, DIRETORA, erros, semeadoSobraEv);
        await pgSE.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgSE.click('#apostaAbrirBtn');
        await pgSE.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgSE.click('.aposta-grupo-btn');
        await pgSE.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const esperadoSobra = await pgSE.evaluate(() => (document.getElementById('ap-esperado') || {}).value || '');
        anota('a sobra do exemplo em "Esperávamos" é substituída pela mudança mensurável de verdade',
          /^reduzir/.test(esperadoSobra) && /reclamações sobre prazo/.test(esperadoSobra) &&
          /200/.test(esperadoSobra) && /50/.test(esperadoSobra),
          'ficou "' + esperadoSobra + '"');
        await ctxSE.close();
      }

      /* ── 9e: uma resposta de verdade em "Esperávamos", diferente da
            mudança mensurável, não é sobrescrita. ── */
      {
        const semeadoRealEv = apostasSemeadas();
        semeadoRealEv[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoRealEv[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ direcao: 'Reduzir', indicador: 'reclamações sobre prazo', atual: '200', meta: '50', unidade: 'por mês', prazo: '60', prazoUnidade: 'dias' }] },
          evidencia: { esperado: 'uma resposta que o grupo escreveu com outras palavras' },
        };
        const { ctx: ctxRE, page: pgRE } = await novaPagina(browser, formato, DIRETORA, erros, semeadoRealEv);
        await pgRE.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgRE.click('#apostaAbrirBtn');
        await pgRE.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgRE.click('.aposta-grupo-btn');
        await pgRE.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const esperadoReal = await pgRE.evaluate(() => (document.getElementById('ap-esperado') || {}).value || '');
        anota('uma resposta de verdade em "Esperávamos" não é sobrescrita',
          esperadoReal === 'uma resposta que o grupo escreveu com outras palavras',
          'ficou "' + esperadoReal + '"');
        await ctxRE.close();
      }

      /* ── 9f: uma mudança incompleta (prazo em aberto) não pode deixar um
            "—" solto dentro de "Esperávamos" — relatado no uso real, com
            print mostrando "...para 700 por mês em —.". O "—" marca lacuna
            no MAPA (onde é só leitura); virando texto de verdade dentro de
            um campo editável, ficava quebrado. ── */
      {
        const semeadoIncompleta = apostasSemeadas();
        semeadoIncompleta[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].etapa = 'evidencia';
        semeadoIncompleta[TURMA_LIB].execucoes[EXEC].grupos[GRUPO].dados = {
          mudancas: { itens: [{ direcao: 'Reduzir', indicador: 'contatos sobre andamento', atual: '1000', meta: '700', unidade: 'por mês' }] },
        };
        const { ctx: ctxI, page: pgI } = await novaPagina(browser, formato, DIRETORA, erros, semeadoIncompleta);
        await pgI.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
        await pgI.click('#apostaAbrirBtn');
        await pgI.waitForSelector('.aposta-grupo-btn', { timeout: 15000 });
        await pgI.click('.aposta-grupo-btn');
        await pgI.waitForFunction(() =>
          /EVID[ÊE]NCIA/.test((document.querySelector('.aposta-etapa-titulo') || {}).textContent || ''),
          { timeout: 15000 });
        const esperadoIncompleto = await pgI.evaluate(() => (document.getElementById('ap-esperado') || {}).value || '');
        anota('mudança com prazo em aberto não deixa "—" solto em "Esperávamos"', !/—/.test(esperadoIncompleto),
          'ficou "' + esperadoIncompleto + '"');
        await ctxI.close();
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
