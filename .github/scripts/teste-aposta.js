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
 * 2. AS ETAPAS SEGUINTES NÃO PODEM ABRIR SOZINHAS. O valor está em
 *    percorrer o raciocínio — sintoma, depois problema, depois
 *    hipótese. Se o formulário inteiro aparecer de uma vez, o grupo
 *    pula direto para a solução, que é o hábito que a oficina existe
 *    para interromper. A trilha mostra os NOMES das dez etapas; o
 *    conteúdo, não.
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

async function novaPagina(browser, formato, email, erros, apostas) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(apostas), user: { email: email, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
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
        await ctxNovo.close();
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
      anota('a trilha nomeia as etapas (o grupo vê onde vai chegar)',
        /Sintoma/.test(trilha.nomes) && /Decisão/.test(trilha.nomes), trilha.nomes.slice(0, 90));

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
          continue;
        }

        if (i === 3) {
          /* Mudanças mensuráveis: lista, com frase consolidada automática. */
          await page.click('#apostaAddMudanca');
          await page.waitForTimeout(300);
          await page.fill('[data-m="indicador"]', 'contatos sobre andamento');
          await page.fill('[data-m="atual"]', '1000');
          await page.fill('[data-m="meta"]', '700');
          await page.fill('[data-m="prazo"]', '90 dias');
          await page.waitForTimeout(300);
          const frase = await page.evaluate(() =>
            (document.querySelector('.aposta-mudanca-frase') || {}).textContent || '');
          anota('a frase consolidada é montada sozinha',
            /de 1000/.test(frase) && /para 700/.test(frase) && /90 dias/.test(frase), frase);
        } else {
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
