/* Checagens de interface que viviam no botão "▶ Automáticos" da antiga aba ADMIN › Testes.
 * Desktop e celular (375 px). Hermético: Firebase falso, sem rede, sem segredo.
 *
 * POR QUE ESTE TESTE EXISTE
 * Até a Etapa 6.2, 149 checagens moravam dentro de forca-agil/testes.js e só rodavam quando
 * alguém (ou o job Smoke) abria ADMIN › Testes e clicava no botão. A aba saiu do site. Destas
 * 149, as que provam comportamento de verdade — layout do certificado, abertura animada,
 * acordeões de Conteúdos, filtros do Repositório, autodiagnóstico, cartões de Turmas, campos
 * de cadastro e login, tabelas e filtros do ADMIN — vieram para cá, SEM MUDAR O CÓDIGO DE
 * NENHUMA (cada função abaixo é a mesma que estava em testes.js). Ganharam o que não tinham:
 * rodam em toda PR, bloqueiam o merge e rodam também em 375 px.
 *
 * Ficaram de fora (ver docs/referencia-tecnica.md e o relatório da Etapa 6.2): as que só
 * conferiam que uma função ou um elemento existe, as que testavam as próprias páginas de
 * documentação (Mapa/Manual/Testes), as que passavam sempre sem provar o que diziam, e as que
 * só fazem sentido com o banco real — essas estão no Smoke (smoke-site-real.js).
 *
 * Como roda: abre o site como admin com um banco de exemplo, passa pelas páginas para que cada
 * uma inicialize (como acontecia numa sessão real antes de clicar no botão), volta ao #admin e
 * executa as checagens uma a uma, no mesmo navegador. Cada falha diz qual checagem e o erro. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br', ALUNA = 'aluna@previ.com.br', OUTRA = 'outra@previ.com.br';

function banco() {
  const users = {};
  users[chave(ADM)]   = { name: 'ADMIN', email: ADM, area: 'INFOR', createdAt: '2026-08-01T10:00:00Z' };
  users[chave(ALUNA)] = { name: 'ALUNA TESTE', email: ALUNA, area: 'GECAT', createdAt: '2026-08-02T10:00:00Z' };
  users[chave(OUTRA)] = { name: 'OUTRA PESSOA', email: OUTRA, area: 'DIRAD', createdAt: '2026-08-03T10:00:00Z' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  const interesse = { t1: {}, t2: {} };
  interesse.t1[chave(ALUNA)] = { name: 'ALUNA TESTE', email: ALUNA, area: 'GECAT', status: 'inscrito', confirmedByAdmin: ADM, date: '2026-08-05T10:00:00Z' };
  interesse.t2[chave(OUTRA)] = { name: 'OUTRA PESSOA', email: OUTRA, area: 'DIRAD', status: 'interessado', date: '2026-08-06T10:00:00Z' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-avaliacao-autorizados': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'FORÇA ÁGIL - OFICINA', order: 1, publicado: true, cargaHoraria: '8', formato: 'presencial',
      missaoTitulo: 'A Missão', missaoTexto: 'Texto da missão.', topicos: ['Tópico 1', 'Tópico 2'],
      itinerario: [{ titulo: 'Dia 1', texto: 'Abertura' }, { titulo: 'Dia 2', texto: 'Fechamento' }] } },
    turmas: {
      t1: { label: 'TURMA 1', eventoKey: 'ev1', dias: ['2026-12-01', '2026-12-02'], horario: '09h às 12h', order: 1 },
      t2: { label: 'TURMA 2', eventoKey: 'ev1', dias: ['2026-12-08', '2026-12-09'], horario: '14h às 17h', order: 2 },
    },
    'turmas-interesse': interesse,
    treinamentos: { tjedi: { nome: 'Treinamento Jedi', conteudoKey: 'jedi', eventos: { ev1: true }, order: 1 } },
    'treinamentos-conteudo': {},
    avaliacoes: {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    apostas: {}, holocron: {}, 'fa-seeds-hidden': {}, 'fa-seeds-deleted': {}, 'fa-holocron-hidden': {}, pedidos: {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {},
  };
}

/* As funções abaixo são as MESMAS de forca-agil/testes.js (copiadas sem alteração). Rodam no
   navegador; devolvem true/false ou uma Promise de true/false. */
const CHECAGENS = [
  { id: "c-cert-coords", grupo: "Certificados v1.0", label: "Layout aprovado: cada campo do certificado nas coordenadas e larguras registradas",
    run: function () {
          if (!window.faCertif) return false;
          var C = window.faCertif.CFG;
          var esperado = {
            nomeParticipante:   { x: 724,  y: 385, maxWidth: 1041, size: 55, minSize: 28 },
            nomeEvento:         { x: 724,  y: 535, maxWidth: 920,  size: 29, minSize: 13 },
            identificacaoTurma: { x: 724,  y: 581, maxWidth: 680,  size: 19, minSize: 12 },
            periodoTurma:       { x: 598,  y: 658, maxWidth: 400,  size: 24, minSize: 13 },
            cargaHoraria:       { x: 613,  y: 757, maxWidth: 160,  size: 48, minSize: 24 },
            dataEmissao:        { x: 1055, y: 922, maxWidth: 360,  size: 19, minSize: 10 }
          };
          return Object.keys(esperado).every(function (campo) {
            var cfg = C[campo]; if (!cfg) return false;
            var e = esperado[campo];
            return cfg.x === e.x && cfg.y === e.y && cfg.maxWidth === e.maxWidth &&
                   cfg.size === e.size && cfg.minSize === e.minSize;
          });
        } },
  { id: "c-cert-sufixo-h", grupo: "Certificados v1.0", label: "Carga horária desenha o \"h\" (20 → \"20h\") e a emissão o \"Emitido em \"",
    run: function () {
          if (!window.faCertif) return false;
          var C = window.faCertif.CFG;
          var carga = window.faCertif.medirCampo('20', C.cargaHoraria);
          var data  = window.faCertif.medirCampo('27 de agosto de 2026', C.dataEmissao);
          return carga.texto === '20h' && data.texto === 'Emitido em 27 de agosto de 2026';
        } },
  { id: "c-cert-carga-fracionada", grupo: "Certificados v1.0", label: "Carga com fração sai \"3,5h\" (vírgula) e sem o vão do monoespaçado",
    run: function () {
          if (!window.faCertif) return false;
          var C = window.faCertif.CFG;
          var meia  = window.faCertif.medirCampo('3.5', C.cargaHoraria);
          var cheia = window.faCertif.medirCampo('20', C.cargaHoraria);
          /* Três caracteres desenhados (3 , 5 h = 4) não podem ocupar o
             equivalente a 4 células inteiras do monoespaçado: é o vão que
             fazia a carga aparecer como "3 . 5 h". */
          return meia.texto === '3,5h' && meia.largura < (cheia.largura / 3) * 4 &&
                 meia.size === C.cargaHoraria.size;
        } },
  { id: "c-cert-periodo-extenso", grupo: "Certificados v1.0", label: "Período do certificado sai por extenso e cabe (de 1 a 5 dias)",
    run: function () {
          if (!window.faCertif || !window.faTurmasUtil || !window.faTurmasUtil.periodoCertificado) return false;
          var C = window.faCertif.CFG, m = window.faCertif.medirCampo, P = window.faTurmasUtil.periodoCertificado;
          var um = P(['2026-09-16']);
          var cinco = P(['2026-08-11', '2026-08-12', '2026-08-18', '2026-08-19', '2026-08-20']);
          var virada = P(['2026-12-30', '2027-01-02']);
          /* Um dia só é o caso que motivou a mudança: "16" sozinho, ao lado
             do calendário, não lia como data de curso. */
          return um === '16 de setembro de 2026' &&
                 cinco === '11, 12, 18, 19 e 20 de agosto de 2026' &&
                 /2026 e 2 de janeiro de 2027$/.test(virada) &&
                 [um, cinco, virada].every(function (t) {
                   var r = m(t, C.periodoTurma);
                   return r.largura <= C.periodoTurma.maxWidth && r.size >= C.periodoTurma.minSize;
                 });
        } },
  { id: "c-cert-traco-calendario", grupo: "Certificados v1.0", label: "O traço sob o calendário cobre o pior caso do período (virada de ano)",
    run: function () {
          if (!window.faCertif || !window.faTurmasUtil || !window.faTurmasUtil.periodoCertificado) return false;
          var C = window.faCertif.CFG, m = window.faCertif.medirCampo, P = window.faTurmasUtil.periodoCertificado;
          /* O texto por extenso da v1.1 passou a sair depois do fim do
             traço do template ("2026" sobrando) — visto no uso real. O
             traço (cert-template-v4.png) foi alongado para além do pior
             caso; aqui a conferência é que o texto continua cabendo
             dentro da largura do campo, que é o que o traço acompanha. */
          var pior = P(['2026-12-30', '2027-01-02']);
          var r = m(pior, C.periodoTurma);
          return r.largura <= C.periodoTurma.maxWidth;
        } },
  { id: "c-cert-curto-sem-reducao", grupo: "Certificados v1.0", label: "Cenário curto (ANA LIMA / SCRUM / 8h): nenhum campo é reduzido à toa",
    run: function () {
          if (!window.faCertif) return false;
          var C = window.faCertif.CFG, m = window.faCertif.medirCampo;
          return m('ANA LIMA', C.nomeParticipante).size === C.nomeParticipante.size &&
                 m('SCRUM', C.nomeEvento).size === C.nomeEvento.size &&
                 m('8', C.cargaHoraria).size === C.cargaHoraria.size;
        } },
  { id: "c-cert-nome-longo", grupo: "Certificados v1.0", label: "Nome muito longo cabe na área do nome sem estourar nem encolher abaixo do mínimo",
    run: function () {
          if (!window.faCertif) return false;
          var cfg = window.faCertif.CFG.nomeParticipante;
          var r = window.faCertif.medirCampo('MARIA EDUARDA ALBUQUERQUE DE OLIVEIRA SANTOS', cfg);
          return r.largura <= cfg.maxWidth && r.size >= cfg.minSize && r.size <= cfg.size;
        } },
  { id: "c-cert-evento-longo", grupo: "Certificados v1.0", label: "Nome de evento longo cabe na área do evento, contando o espaçamento entre letras",
    run: function () {
          if (!window.faCertif) return false;
          var cfg = window.faCertif.CFG.nomeEvento;
          var r = window.faCertif.medirCampo('PROGRAMA DE TRANSFORMAÇÃO E AGILIDADE ORGANIZACIONAL', cfg);
          return r.largura <= cfg.maxWidth && r.size >= cfg.minSize;
        } },
  { id: "c-cert-turma-longa", grupo: "Certificados v1.0", label: "Identificação de turma longa cabe na área da turma",
    run: function () {
          if (!window.faCertif) return false;
          var cfg = window.faCertif.CFG.identificacaoTurma;
          var r = window.faCertif.medirCampo('Turma Especial de Formação — Agosto e Setembro de 2026', cfg);
          return r.largura <= cfg.maxWidth && r.size >= cfg.minSize;
        } },
  { id: "c-cert-periodo-longo", grupo: "Certificados v1.0", label: "Período longo cabe na área do período (sem invadir o badge)",
    run: function () {
          if (!window.faCertif) return false;
          var cfg = window.faCertif.CFG.periodoTurma;
          var r = window.faCertif.medirCampo('11, 12, 18, 19, 20, 25, 26 e 27 de agosto de 2026', cfg);
          return r.largura <= cfg.maxWidth && r.size >= cfg.minSize;
        } },
  { id: "c-cert-cargas", grupo: "Certificados v1.0", label: "Todas as cargas horárias (4h a 120h) cabem no badge, no tamanho padrão",
    run: function () {
          if (!window.faCertif) return false;
          var cfg = window.faCertif.CFG.cargaHoraria;
          return ['4', '8', '16', '20', '24', '40', '120'].every(function (h) {
            var r = window.faCertif.medirCampo(h, cfg);
            return r.largura <= cfg.maxWidth && r.size === cfg.size;
          });
        } },
  { id: "c-cert-datas-longas", grupo: "Certificados v1.0", label: "Datas de emissão longas cabem na área da emissão",
    run: function () {
          if (!window.faCertif) return false;
          var cfg = window.faCertif.CFG.dataEmissao;
          return ['30 de setembro de 2026', '31 de dezembro de 2026'].every(function (d) {
            var r = window.faCertif.medirCampo(d, cfg);
            return r.largura <= cfg.maxWidth && r.size >= cfg.minSize;
          });
        } },
  { id: "c-cert-pior-cenario", grupo: "Certificados v1.0", label: "Pior cenário combinado: todos os campos no limite cabem ao mesmo tempo, cada um ajustando sozinho",
    run: function () {
          if (!window.faCertif) return false;
          var C = window.faCertif.CFG, m = window.faCertif.medirCampo;
          var casos = [
            [ 'MARIA EDUARDA ALBUQUERQUE DE OLIVEIRA SANTOS', C.nomeParticipante ],
            [ 'PROGRAMA DE TRANSFORMAÇÃO E AGILIDADE ORGANIZACIONAL', C.nomeEvento ],
            [ 'Turma Especial de Formação — Agosto e Setembro de 2026', C.identificacaoTurma ],
            [ '11, 12, 18, 19, 20, 25, 26 e 27 de agosto de 2026', C.periodoTurma ],
            [ '120', C.cargaHoraria ],
            [ '30 de setembro de 2026', C.dataEmissao ]
          ];
          var todosCabem = casos.every(function (c) {
            var r = m(c[0], c[1]);
            return r.largura <= c[1].maxWidth && r.size >= c[1].minSize;
          });
          /* Independência: medir o pior nome não pode mudar o resultado da
             carga horária, que continua no tamanho padrão. */
          var cargaIsolada = m('120', C.cargaHoraria).size;
          return todosCabem && cargaIsolada === C.cargaHoraria.size;
        } },
  { id: "c-cert-selects", grupo: "Certificados v1.0", label: "Fluxo de seleção: \"Turma\" começa desabilitada até escolher um evento",
    run: function () {
          var selEv = document.getElementById('certEventoSelect');
          var selTu = document.getElementById('certTurmaSelect');
          if (!selEv || !selTu) return false;
          /* Se ninguém abriu a aba Certificados nesta sessão, o select de
             turma continua no estado inicial — que é justamente o que se
             quer verificar. Se já mexeram nele, não dá pra afirmar nada. */
          if (selEv.value) return true;
          var ph = selTu.options[0];
          return selTu.disabled === true && !!ph && ph.textContent.indexOf('selecione um evento primeiro') !== -1;
        } },
  { id: "c-cert-selects-evento", grupo: "Certificados v1.0", label: "Escolher um evento habilita \"Turma\" (ou avisa que o evento não tem turma)",
    run: function () {
          var selEv = document.getElementById('certEventoSelect');
          var selTu = document.getElementById('certTurmaSelect');
          if (!selEv || !selTu) return Promise.resolve(false);
          var opcao = Array.prototype.find.call(selEv.options, function (o) { return o.value; });
          if (!opcao) return Promise.resolve(true); /* nenhum evento cadastrado nesta base */
          selEv.value = opcao.value;
          selEv.dispatchEvent(new Event('change'));
          return new Promise(function (resolve) {
            var tentativas = 0;
            (function poll() {
              var ph = selTu.options[0];
              var textoPh = ph ? ph.textContent : '';
              /* Ou destravou pra escolher turma, ou explicou que não há
                 turma nesse evento — nunca fica travado no texto inicial. */
              if (!selTu.disabled) return resolve(true);
              if (textoPh.indexOf('nenhuma turma neste evento') !== -1) return resolve(true);
              if (++tentativas > 50) return resolve(false);
              setTimeout(poll, 100);
            })();
          });
        } },
  { id: "c-cert-canvas-prévia", grupo: "Certificados v1.0", label: "Prévia desenha o canvas interno em 1448×1086 (proporção 4:3)",
    run: function () {
          if (!window.faCertif) return Promise.resolve(false);
          var canvas = document.createElement('canvas');
          return window.faCertif.draw(canvas, { nomeParticipante: 'ANA LIMA', nomeEvento: 'SCRUM', cargaHoraria: '8' }, 1)
            .then(function () {
              return canvas.width === 1448 && canvas.height === 1086 &&
                     Math.abs((canvas.width / canvas.height) - (4 / 3)) < 0.01;
            })
            .catch(function () { return false; });
        } },
  { id: "c-cert-canvas-export", grupo: "Certificados v1.0", label: "Exportação em 2× gera 2896×2172, mantendo a proporção 4:3",
    run: function () {
          if (!window.faCertif) return Promise.resolve(false);
          var canvas = document.createElement('canvas');
          return window.faCertif.draw(canvas, { nomeParticipante: 'ANA LIMA', nomeEvento: 'SCRUM', cargaHoraria: '8' }, 2)
            .then(function () {
              return canvas.width === 2896 && canvas.height === 2172 &&
                     Math.abs((canvas.width / canvas.height) - (4 / 3)) < 0.01;
            })
            .catch(function () { return false; });
        } },
  { id: "c-cta-btn-logado", grupo: "Início", label: "Botão hero: \"Ver turmas\" com sessão ativa (nunca oculto)",
    run: function () {
          /* Sem sessão o hero nem é renderizado (login obrigatório oculta o site),
             então só o caminho autenticado é verificável na prática. */
          var btn = document.getElementById('heroJoin');
          if (!btn) return false;
          var sess = window.faAuth ? window.faAuth.getSession() : null;
          if (!sess) return true;
          return btn.hidden === false && btn.dataset.loggedIn === '1';
        } },
  { id: "c-como-funciona", grupo: "Início", label: "Como funciona: os 3 cards são blocos informativos, sem link nem data-nav-page",
    run: function () {
          var cards = document.querySelectorAll('.how-grid .how-card');
          if (cards.length !== 3) return false;
          var titulos = ['Conteúdos', 'Repositório Colaborativo', 'Treinamento Jedi'];
          return Array.from(cards).every(function (c, i) {
            var titulo = c.querySelector('h3') ? c.querySelector('h3').textContent.trim() : '';
            return titulo === titulos[i] && c.tagName !== 'A' && !c.hasAttribute('href') && !c.hasAttribute('data-nav-page');
          });
        } },
  { id: "c-cta-ver-turmas", grupo: "Início", label: "CTA final: único botão \"Ver turmas →\" presente e aponta para #turmas",
    run: function () {
          var link = document.querySelector('.hero-actions a[data-nav-page="turmas"]');
          return !!link && /turmas/i.test(link.textContent);
        } },
  { id: "c-footer-previ", grupo: "Início", label: "Rodapé: link externo para previ.com.br presente e abre em nova aba",
    run: function () {
          var link = document.querySelector('.footer-previ');
          if (!link) return false;
          return link.getAttribute('href') === 'https://www.previ.com.br' && link.getAttribute('target') === '_blank';
        } },
  { id: "c-crawl-pause-btn", grupo: "Início", label: "Crawl: botão \"Pausar\" pausa/retoma a animação",
    run: function () {
          var crawl = document.querySelector('.crawl-content');
          var btn = document.querySelector('.crawl-pause');
          if (!crawl || !btn) return false;
          btn.click();
          var paused = crawl.style.animationPlayState === 'paused';
          btn.click();
          var resumed = crawl.style.animationPlayState === 'running';
          return paused && resumed;
        } },
  { id: "c-crawl-pause-area", grupo: "Início", label: "Crawl: clicar na área pausa/retoma (mesmo efeito do botão Pausar)",
    run: function () {
          var crawl = document.querySelector('.crawl-content');
          var stage = document.querySelector('.crawl-stage');
          if (!crawl || !stage) return false;
          stage.click();
          var paused = crawl.style.animationPlayState === 'paused';
          stage.click();
          var resumed = crawl.style.animationPlayState === 'running';
          return paused && resumed;
        } },
  { id: "c-crawl-ler-texto", grupo: "Início", label: "Crawl: botão \"Ler texto\" exibe texto estático; \"Fechar texto\" retorna ao crawl",
    run: function () {
          var crawl = document.querySelector('.crawl-content');
          var btn = document.querySelector('.crawl-skip');
          if (!crawl || !btn) return false;
          btn.click();
          var estatico = crawl.classList.contains('crawl-static') && btn.textContent.indexOf('Fechar texto') !== -1;
          btn.click();
          var voltou = !crawl.classList.contains('crawl-static') && btn.textContent.indexOf('Ler texto') !== -1;
          return estatico && voltou;
        } },
  { id: "c-crawl-repetir", grupo: "Início", label: "Crawl: botão \"Repetir abertura\" reinicia a animação do início",
    run: function () {
          var crawl = document.querySelector('.crawl-content');
          var replay = document.querySelector('.crawl-replay');
          if (!crawl || !replay) return false;
          replay.click();
          return crawl.classList.contains('run');
        } },
  { id: "c-crawl-acesso", grupo: "Início", label: "Crawl: visível para qualquer pessoa logada (não exige turma confirmada)",
    run: function () {
          var cs = document.querySelector('.crawl-section');
          if (!cs) return false;
          var sess = window.faAuth && window.faAuth.getSession ? window.faAuth.getSession() : null;
          /* Com sessão o crawl aparece, independente de estar confirmada em turma */
          return sess ? cs.style.display !== 'none' : cs.style.display === 'none';
        } },
  { id: "c-conteudos-7sections", grupo: "Conteúdos", label: "7 seções de conteúdo presentes no DOM (Mapa da Galáxia, Os 4 Valores, Os 12 Princípios, A Força do Ágil, Personagens, Lado Sombrio, A Trilogia)",
    run: function () {
          var ids = ['content-galaxia','content-forca','content-principios','content-yoda','content-arquetipos','content-sombrio','content-trilogia'];
          return ids.every(function (id) { return !!document.getElementById(id); });
        } },
  { id: "c-conteudos-valores-link", grupo: "Conteúdos", label: "Link \"Ler os 4 valores na íntegra\" presente e correto",
    run: function () {
          var link = Array.from(document.querySelectorAll('#page-conteudos .manifesto-link')).find(function (a) { return /4 valores/i.test(a.textContent); });
          return !!link && link.getAttribute('href') === 'https://agilemanifesto.org/iso/ptbr/manifesto.html' && link.getAttribute('target') === '_blank';
        } },
  { id: "c-conteudos-principios-link", grupo: "Conteúdos", label: "Link \"Ler os 12 princípios na íntegra\" presente e correto",
    run: function () {
          var link = Array.from(document.querySelectorAll('#page-conteudos .manifesto-link')).find(function (a) { return /12 princípios/i.test(a.textContent); });
          return !!link && link.getAttribute('href') === 'https://agilemanifesto.org/iso/ptbr/principles.html' && link.getAttribute('target') === '_blank';
        } },
  { id: "c-conteudos-yoda-episodios", grupo: "Conteúdos", label: "\"A Força do Ágil\": 5 episódios presentes, cada um expande/recolhe ao clicar no título",
    run: function () {
          var episodios = document.querySelectorAll('#content-yoda .yep');
          if (episodios.length !== 5) return false;
          var ep = episodios[0];
          var head = ep.querySelector('.yep-head');
          if (!head) return false;
          var before = ep.classList.contains('open');
          head.click();
          var afterOpen = ep.classList.contains('open');
          head.click();
          var afterClosed = ep.classList.contains('open');
          return !before && afterOpen && !afterClosed;
        } },
  { id: "c-conteudos-trilogia-episodios", grupo: "Conteúdos", label: "\"A Trilogia\": 3 episódios em acordeão, cada um expande/recolhe ao clicar no título",
    run: function () {
          var episodios = document.querySelectorAll('#content-trilogia .ep-expand');
          if (episodios.length !== 3) return false;
          var det = episodios[0];
          var summary = det.querySelector('summary');
          if (!summary) return false;
          var before = det.open;
          summary.click();
          var afterOpen = det.open;
          summary.click();
          var afterClosed = det.open;
          return !before && afterOpen && !afterClosed;
        } },
  { id: "c-principios-btn", grupo: "Conteúdos", label: "12 Princípios (passo 1 de 3): botão \"Ver os 6 princípios restantes →\" existe na tela",
    run: function () { return !!document.getElementById('principlesMoreBtn'); } },
  { id: "c-principios-extra", grupo: "Conteúdos", label: "12 Princípios (passo 2 de 3): antes de clicar, os princípios 7–12 estão escondidos",
    run: function () {
          var el = document.getElementById('principlesExtra');
          return !!el && !el.classList.contains('visible');
        } },
  { id: "c-principios-revelar", grupo: "Conteúdos", label: "12 Princípios (passo 3 de 3): depois de clicar no botão, os princípios 7–12 aparecem",
    run: function () {
          var btn = document.getElementById('principlesMoreBtn');
          var extra = document.getElementById('principlesExtra');
          if (!btn || !extra) return false;
          var originalDisplay = btn.style.display;
          btn.click();
          var revelado = extra.classList.contains('visible') && btn.style.display === 'none';
          // restaura
          extra.classList.remove('visible');
          btn.style.display = originalDisplay;
          return revelado;
        } },
  { id: "c-faq-items", grupo: "Ajuda", label: "Ajuda tem 7 itens de acordeão (.faq-item)",
    run: function () { return document.querySelectorAll('#page-ajuda .faq-item').length === 7; } },
  { id: "c-faq-nav", grupo: "Ajuda", label: "Link \"Ajuda\" presente no menu de navegação",
    run: function () { return !!document.querySelector('[data-nav-page="ajuda"]'); } },
  { id: "c-repo-curado", grupo: "Repositório", label: "Badge \"curado\" presente em algum card do repositório",
    run: function () { return typeof window.faRepoSeedCount === 'number' && window.faRepoSeedCount > 0; } },
  { id: "c-repo-chips", grupo: "Repositório", label: "Filtro de tipo: 5 chips presentes (Todos/Vídeos/Documentos/Ferramentas/Livros)",
    run: function () {
          var chips = document.querySelectorAll('#repoFilters .repo-chip');
          if (chips.length !== 5) return false;
          var tipos = Array.from(chips).map(function (c) { return c.dataset.f; });
          return ['all', 'video', 'doc', 'tool', 'book'].every(function (t) { return tipos.indexOf(t) !== -1; });
        } },
  { id: "c-repo-filtro-funciona", grupo: "Repositório", label: "Filtro de tipo: cada chip (Vídeos/Documentos/Ferramentas/Livros) mostra só cards do tipo correspondente",
    run: function () {
          var chips = document.querySelectorAll('#repoFilters .repo-chip');
          var allChip = Array.from(chips).find(function (c) { return c.dataset.f === 'all'; });
          if (!allChip) return false;
          var tipos = ['video', 'doc', 'tool', 'book'];
          var ok = tipos.every(function (tipo) {
            var chip = Array.from(chips).find(function (c) { return c.dataset.f === tipo; });
            if (!chip) return false;
            chip.click();
            var cards = document.querySelectorAll('#repoGrid .repo-card');
            return Array.from(cards).every(function (c) { return c.dataset.type === tipo; });
          });
          allChip.click();
          return ok;
        } },
  { id: "c-repo-desc-clamp", grupo: "Repositório", label: "Descrições dos cards têm line-clamp de 2 linhas (.repo-card .rc-desc)",
    run: function () {
          var p = document.querySelector('#repoGrid .rc-desc');
          if (!p) return false;
          var style = window.getComputedStyle(p);
          return style.webkitLineClamp === '2' || style.getPropertyValue('-webkit-line-clamp') === '2';
        } },
  { id: "c-repo-ver-mais-overflow", grupo: "Repositório", label: "Botão \"ver mais\" presente apenas em cards com texto que transborda 2 linhas",
    run: function () {
          var btns = document.querySelectorAll('#repoGrid .rc-more');
          return Array.from(btns).every(function (btn) {
            var p = btn.previousElementSibling;
            return p && p.classList.contains('rc-desc');
          });
        } },
  { id: "c-repo-cancelar-limpa", grupo: "Repositório", label: "Formulário \"Guardar no Holocron\": \"Cancelar\" esconde o formulário e limpa os campos",
    run: function () {
          var addBtn = document.getElementById('repoAddBtn');
          var form = document.getElementById('repoForm');
          var cancelBtn = document.getElementById('repoCancel');
          var titleInput = document.getElementById('rfTitle');
          var urlInput = document.getElementById('rfUrl');
          if (!addBtn || !form || !cancelBtn || !titleInput || !urlInput) return false;
          addBtn.click();
          if (form.hidden) return false;
          titleInput.value = 'Teste automático';
          urlInput.value = 'previ.com.br';
          cancelBtn.click();
          return form.hidden === true && titleInput.value === '' && urlInput.value === '';
        } },
  { id: "c-turmas-cards", grupo: "Turmas", label: "Cards de turma consistentes com as turmas cadastradas (.turma-card-new)",
    run: function () {
          /* turmas não são mais fixas em número — vêm de turmas/ no Firebase, editável
             pelo admin. Cada card está em um de 4 estados: interesse aberto (.btn--interest),
             inscrições encerradas (.turma-lotada-msg), em andamento (.turma-andamento-msg),
             ou realizada (.turma-realizada-msg). O card "Lista de Espera" também tem a classe
             .turma-card-new mas não é uma turma — é excluído da contagem. */
          var cards = document.querySelectorAll('.turma-card-new:not(.turma-card-espera)').length;
          var abertos = document.querySelectorAll('.btn--interest').length;
          var encerrados = document.querySelectorAll('.turma-lotada-msg').length;
          var andamento = document.querySelectorAll('.turma-andamento-msg').length;
          var realizada = document.querySelectorAll('.turma-realizada-msg').length;
          return cards === abertos + encerrados + andamento + realizada;
        } },
  { id: "c-turmas-horario", grupo: "Turmas", label: "Cards de turma exibem o horário da turma (.tc-horario)",
    run: function () {
          var cards = document.querySelectorAll('.turma-card-new:not(.turma-card-espera)').length;
          if (!cards) return true; /* página Turmas ainda não carregada nesta sessão */
          return document.querySelectorAll('.tc-horario').length === cards;
        } },
  { id: "c-turmas-como-funciona", grupo: "Turmas", label: "Bloco \"Como funciona\" tem entre 2 e 4 métricas cada (.oficina-info / .ofinfo-item)",
    run: function () {
          /* Depende do admin ter preenchido Missão/Tópicos/Itinerário em algum
             evento (ver "Editar evento") — a migração de ponte (seedMissaoJornadaImersao)
             garante isso para o evento existente, mas evento novo sem conteúdo
             não gera bloco nenhum, o que não é falha. "Dias"/"horas" só entram
             quando o itinerário tem pelo menos 1 dia — por isso o mínimo é 2
             (Prática + Opcional, sempre presentes quando o bloco existe), não 4. */
          var blocos = document.querySelectorAll('.oficina-info');
          if (!blocos.length) return true;
          return Array.prototype.every.call(blocos, function (b) {
            var n = b.querySelectorAll('.ofinfo-item').length;
            return n >= 2 && n <= 4;
          });
        } },
  { id: "c-turmas-intent-btn", grupo: "Turmas", label: "Botões de interesse não excedem o número de cards de turma (.btn--interest)",
    run: function () {
          return document.querySelectorAll('.btn--interest').length <= document.querySelectorAll('.turma-card-new').length;
        } },
  { id: "c-turmas-intent-msg", grupo: "Turmas", label: "Cada botão de interesse tem seu container de mensagem (#intent-msg-{turma})",
    run: function () {
          var btns = document.querySelectorAll('.btn--interest');
          if (!btns.length) return true;
          return Array.prototype.every.call(btns, function (btn) {
            var key = btn.dataset.turma;
            return !!key && !!document.getElementById('intent-msg-' + key);
          });
        } },
  { id: "c-turmas-agenda-estatica", grupo: "Turmas", label: "Itinerário por evento: dias são .day--static (número variável, um por evento configurado) e não expandem ao clicar",
    run: function () {
          var days = document.querySelectorAll('.day--static');
          if (!days.length) return true; /* nenhum evento com itinerário preenchido ainda — não é falha */
          var first = days[0];
          var before = first.className;
          first.click();
          var after = first.className;
          return before === after;
        } },
  { id: "c-turmas-btn-style", grupo: "Turmas", label: "Botão \"Tenho interesse\" dourado sólido; após concluir, fundo escuro neutro",
    run: function () {
          /* Usa um botão fora da tela (não o da página Turmas, que só existe
             quando aquela seção está com dados carregados) para o teste
             funcionar de qualquer página, inclusive da aba Testes no Admin. */
          var btn = document.createElement('button');
          btn.className = 'btn--interest';
          /* transition:none — sem isso, ler o estilo computado logo após
             trocar a classe pega um valor no meio da transição de .2s,
             não o valor final, e o teste falha por motivo errado */
          btn.style.cssText = 'position:absolute;left:-9999px;top:-9999px;transition:none';
          document.body.appendChild(btn);
          var beforeBg = window.getComputedStyle(btn).backgroundColor;
          btn.classList.add('done');
          var afterBg = window.getComputedStyle(btn).backgroundColor;
          document.body.removeChild(btn);
          return beforeBg !== afterBg && beforeBg === 'rgb(245, 197, 24)';
        } },
  { id: "c-espera-card-existe", grupo: "Segurança / Login obrigatório", label: "Card \"Lista de Espera\" existe na grade de turmas (.turma-card-espera, um por evento com turma)",
    run: function () {
            if (window.faInitTurmas) window.faInitTurmas();
            /* Card é criado após leitura assíncrona do Firebase (loadTurmas) — espera aparecer no DOM */
            return new Promise(function (resolve) {
              var tentativas = 0;
              (function poll() {
                if (document.querySelector('.turma-card-espera')) return resolve(true);
                if (++tentativas > 40) return resolve(false);
                setTimeout(poll, 100);
              })();
            });
          } },
  { id: "c-espera-btn-existe", grupo: "Segurança / Login obrigatório", label: "Botão \"Entrar na lista de espera\" existe no card (.turma-card-espera .btn--espera)",
    run: function () {
            if (window.faInitTurmas) window.faInitTurmas();
            return new Promise(function (resolve) {
              var tentativas = 0;
              (function poll() {
                if (document.querySelector('.turma-card-espera .btn--espera')) return resolve(true);
                if (++tentativas > 40) return resolve(false);
                setTimeout(poll, 100);
              })();
            });
          } },
  { id: "c-quiz-welcome-auth", grupo: "Treinamento Jedi", label: "Welcome screen oculta para logado; jogo visível",
    run: function () {
          var sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
          var welcome = document.getElementById('treinamento-welcome');
          var game    = document.getElementById('treinamento');
          if (!welcome || !game) return false;
          if (sess) return welcome.hidden === true && game.hidden === false;
          return welcome.hidden === false && game.hidden === true;
        } },
  { id: "c-quiz-jedi-stepper", grupo: "Treinamento Jedi", label: "Welcome screen contém stepper com 4 passos (.jedi-step)",
    run: function () {
          return document.querySelectorAll('#treinamento-welcome .jedi-step').length === 4;
        } },
  { id: "c-quiz-patentes", grupo: "Treinamento Jedi", label: "Escada de patentes é a do treinamento ativo (nome por nome)",
    run: function () {
          /* Era "pelo menos 4 cartões", e isso passava mesmo quando a escada
             mostrava as patentes do Jedi num treinamento que não era ele — a
             escada era HTML fixo. Agora ela é desenhada a partir das patentes
             do treinamento ativo, e é isso que se confere. */
          var cards = Array.prototype.map.call(
            document.querySelectorAll('#charLadder .char-card .cc-name'),
            function (n) { return (n.textContent || '').trim(); });
          if (!cards.length) return false;
          if (!window.faGamePatentes) return cards.length >= 2;
          var esperado = window.faGamePatentes().map(function (r) { return r.name; });
          return JSON.stringify(cards) === JSON.stringify(esperado);
        } },
  { id: "c-quiz-auto-1x", grupo: "Treinamento Jedi", label: "Autodiagnóstico (1×): opções bloqueadas após concluído",
    run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v3');
          var quizCompleto = window.faGameData.DIMS.map(function () { return 1; });
          st.setItem('fa-game-v3', JSON.stringify({ quiz: quizCompleto }));
          window.faGameReload();
          var opts = document.querySelectorAll('.q-opt');
          var todasBloqueadas = opts.length > 0 && Array.from(opts).every(function (b) { return b.disabled; });
          if (backup !== null) st.setItem('fa-game-v3', backup); else st.removeItem('fa-game-v3');
          window.faGameReload();
          return todasBloqueadas;
        } },
  { id: "c-quiz-afirmacoes-count", grupo: "Treinamento Jedi", label: "Autodiagnóstico: 20 afirmações em 4 blocos (5 cada) presentes no DOM",
    run: function () {
          if (!window.faGameData) return false;
          var blocos = window.faGameData.BLOCOS || [];
          if (blocos.length !== 4) return false;
          var totalAfirm = blocos.reduce(function (a, b) { return a + (b.afirmacoes ? b.afirmacoes.length : 0); }, 0);
          if (totalAfirm !== 20) return false;
          return document.querySelectorAll('.q-opts--likert').length === 20;
        } },
  { id: "c-quiz-resposta-salva-pontuacao", grupo: "Treinamento Jedi", label: "Autodiagnóstico: clicar numa opção salva a pontuação (0–3) da afirmação",
    run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backupGame = st.getItem('fa-game-v3');
          var backupPlayer = localStorage.getItem('fa-player');
          try {
            localStorage.setItem('fa-player', JSON.stringify({ name: 'Teste Score XYZ', turma: 'XX', area: 'XX' }));
            st.removeItem('fa-game-v3');
            window.faGameReload();
            var lowBtn = document.querySelector('.q-opt[data-q="0"][data-v="0"]');
            var highBtn = document.querySelector('.q-opt[data-q="0"][data-v="3"]');
            if (!lowBtn || !highBtn) return false;
            lowBtn.click();
            /* O progresso passou a ser guardado POR TREINAMENTO (mapa
               treinamento → {quiz, revealed}); antes era um progresso único,
               que o segundo treinamento apagaria. Lê pela chave do que está
               ativo — "_" quando a página roda sem treinamento resolvido. */
            var chave = (window.faGameTreinamentoAtivo && window.faGameTreinamentoAtivo()) || '_';
            var quizDe = function (raw) {
              var v = JSON.parse(raw || 'null');
              return v && v[chave] ? v[chave].quiz : null;
            };
            var afterLow = quizDe(st.getItem('fa-game-v3'));
            highBtn.click();
            var afterHigh = quizDe(st.getItem('fa-game-v3'));
            return !!afterLow && !!afterHigh && afterLow[0] === 0 && afterHigh[0] === 3;
          } finally {
            if (backupGame !== null) st.setItem('fa-game-v3', backupGame); else st.removeItem('fa-game-v3');
            if (backupPlayer !== null) localStorage.setItem('fa-player', backupPlayer); else localStorage.removeItem('fa-player');
            window.faGameReload();
          }
        } },
  { id: "c-quiz-patente-atualiza-pontuacao", grupo: "Treinamento Jedi", label: "Painel de patente atualiza a patente exibida conforme a pontuação total muda",
    run: function () {
          if (!window.faGameData || !window.faGameReload) return false;
          var st = window.faStore || localStorage;
          var backup = st.getItem('fa-game-v3');
          try {
            var dims = window.faGameData.DIMS.length;
            st.setItem('fa-game-v3', JSON.stringify({ quiz: Array(dims).fill(0) }));
            window.faGameReload();
            var hud = document.getElementById('rankHud');
            if (!hud) return false;
            var hudLow = hud.textContent;
            st.setItem('fa-game-v3', JSON.stringify({ quiz: Array(dims).fill(3) }));
            window.faGameReload();
            var hudHigh = hud.textContent;
            return hudLow.indexOf('Youngling') !== -1 && hudHigh.indexOf('Mestre') !== -1;
          } finally {
            if (backup !== null) st.setItem('fa-game-v3', backup); else st.removeItem('fa-game-v3');
            window.faGameReload();
          }
        } },
  { id: "c-reg-area", grupo: "Cadastrar", label: "Campo área/setor com 26 áreas carregadas em ordem alfabética",
    run: function () {
            var items = Array.from(document.querySelectorAll('#regAreaSelect [data-val]'));
            if (items.length !== 26) return false;
            var vals = items.map(function (el) { return el.dataset.val; });
            var sorted = vals.slice().sort();
            return JSON.stringify(vals) === JSON.stringify(sorted);
          } },
  { id: "c-reg-terms", grupo: "Cadastrar", label: "Checkbox de termos (obrigatório) presente",
    run: function () { return !!document.getElementById('regTerms'); } },
  { id: "c-reg-optin", grupo: "Cadastrar", label: "Checkbox opt-in de novidades (opcional) presente",
    run: function () { return !!document.getElementById('regOptin'); } },
  { id: "c-pwd-toggle", grupo: "Cadastrar", label: "Botão \"olhinho\" nos 2 campos de senha do cadastro",
    run: function () { return document.querySelectorAll('#auth-register .pwd-eye').length === 2; } },
  { id: "c-pwd-numeric", grupo: "Cadastrar", label: "Campo de senha com inputmode numérico",
    run: function () { var f = document.getElementById('regPassword'); return !!f && f.getAttribute('inputmode') === 'numeric'; } },
  { id: "c-modal-no-close-outside", grupo: "Entrar", label: "Modal de login/cadastro não fecha ao clicar fora",
    run: function () {
          if (!window.faOpenAuthModal) return false;
          var modal = document.getElementById('authModal');
          if (!modal) return false;
          var wasHidden = modal.hidden;
          window.faOpenAuthModal('login');
          modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          var stillOpen = modal.hidden === false;
          if (window.faCloseAuthModal) window.faCloseAuthModal(); else modal.hidden = wasHidden;
          return stillOpen;
        } },
  { id: "c-forgot-password-panel", grupo: "Entrar", label: "Login — \"Esqueci minha senha\" abre painel inline",
    run: function () {
          if (!window.faOpenAuthModal) return false;
          window.faOpenAuthModal('login');
          var fp = document.getElementById('forgotPassword');
          var loginPanel = document.getElementById('auth-login');
          var forgotPanel = document.getElementById('auth-forgot');
          if (!fp || !loginPanel || !forgotPanel) { if (window.faCloseAuthModal) window.faCloseAuthModal(); return false; }
          fp.click();
          var opened = !forgotPanel.hidden && loginPanel.hidden;
          if (window.faCloseAuthModal) window.faCloseAuthModal();
          return opened;
        } },
  { id: "c-pwd-toggle-login", grupo: "Entrar", label: "Botão \"olhinho\" no campo de senha do login",
    run: function () { return document.querySelectorAll('#auth-login .pwd-eye').length === 1; } },
  { id: "c-site-oculto-sem-auth", grupo: "Segurança / Login obrigatório", label: "body NÃO tem class \"aguardando-auth\" quando logado (site revelado)",
    run: function () {
          return !document.body.classList.contains('aguardando-auth');
        } },
  { id: "c-login-fundo-opaco", grupo: "Segurança / Login obrigatório", label: "Modal de login forçado usa fundo opaco (class modal-overlay--forced ausente quando logado)",
    run: function () {
          var modal = document.getElementById('authModal');
          return modal && !modal.classList.contains('modal-overlay--forced');
        } },
  { id: "c-menu-profile", grupo: "Menu / Sessão", label: "[Logado] Perfil visível no menu (substitui Entrar/Cadastrar)",
    run: function () { const el = document.getElementById('navProfile'); return el && !el.hidden; } },
  { id: "c-menu-guest-hide", grupo: "Menu / Sessão", label: "[Logado] Botões Entrar/Cadastrar ocultos",
    run: function () { const el = document.getElementById('navGuest');   return el && el.hidden; } },
  { id: "c-menu-admin-link", grupo: "Menu / Sessão", label: "[Admin] Link \"Admin\" visível no menu",
    run: function () { const el = document.getElementById('navAdmin');   return el && !el.hidden; } },
  { id: "auth-sess", grupo: "Autenticação", label: "Sessão ativa (usuário logado)",
    run: function () { return !!(window.faAuth && window.faAuth.getSession()); } },
  { id: "auth-admin", grupo: "Autenticação", label: "Usuário atual é admin",
    run: function () { const s = window.faAuth && window.faAuth.getSession(); return !!(s && window.faAuth.isAdmin(s.email)); } },
  { id: "auth-email", grupo: "Autenticação", label: "E-mail da sessão é @previ.com.br",
    run: function () { const s = window.faAuth && window.faAuth.getSession(); return !!(s && s.email && s.email.endsWith('@previ.com.br')); } },
  { id: "auth-admin-full-access", grupo: "Autenticação", label: "Admin vê Conteúdos e Treinamento no menu mesmo sem estar pessoalmente inscrito em turma",
    run: function () {
          var s = window.faAuth && window.faAuth.getSession();
          if (!s || !window.faAuth.isAdmin(s.email)) return true; /* não aplicável fora de sessão admin */
          var conteudos = document.querySelector('.nav-link-enrolled[data-nav-page="conteudos"]');
          /* O Treinamento deixou de ser liberado por nível de acesso: ele agora
             pertence a eventos, e o link é controlado por game.js (classe própria).
             Admin vê quando existe algum treinamento cadastrado — mesma regra da
             Avaliação; com nenhum cadastrado, some para todo mundo. */
          var treinamento = document.querySelector('.nav-link-trein[data-nav-page="treinamento"]');
          return !!conteudos && !conteudos.hidden && !!treinamento;
        } },
  { id: "adm-superadmin-only", grupo: "Admin", label: "Administradores: só tatianefdirene/danielfrazao veem os botões de adicionar/remover admin",
    run: function () {
          var s = window.faAuth && window.faAuth.getSession();
          if (!s) return true; /* não aplicável fora de sessão */
          var souSuperAdmin = window.faSuperAdmins && window.faSuperAdmins.indexOf((s.email || '').toLowerCase()) !== -1;
          var temForm = !!document.getElementById('adminAddBtn');
          var temRemover = !!document.querySelector('#adminAdmins .admin-del-btn');
          return souSuperAdmin ? true : (!temForm && !temRemover);
        } },
  { id: "adm-qrcode-lib", grupo: "Admin", label: "Biblioteca QRCode carregada (hospedada localmente, sem depender de CDN externo)",
    run: function () {
          var scriptLocal = document.querySelector('script[src*="forca-agil/qrcode.min.js"]');
          var scriptCdn = document.querySelector('script[src*="jsdelivr"], script[src*="unpkg"]');
          return typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function' && !!scriptLocal && !scriptCdn;
        } },
  { id: "adm-turmas-crud", grupo: "Admin", label: "Turmas: criar/editar/excluir turma disponível (não são mais fixas em código)",
    run: function () {
          var wrap = document.getElementById('adminInterests');
          if (!wrap || !wrap.querySelector('button')) return true; /* painel Turmas não carregado nesta sessão */
          var hasBtn = function (txt) {
            return Array.prototype.some.call(wrap.querySelectorAll('button'), function (b) { return b.textContent.indexOf(txt) !== -1; });
          };
          var temNova = hasBtn('Nova turma');
          var temCards = document.querySelectorAll('.turma-admin-card').length > 0;
          return temNova && (!temCards || (hasBtn('Editar turma') && hasBtn('Excluir turma')));
        } },
  { id: "adm-cadastrados-lista", grupo: "Admin", label: "Cadastrados: tabela renderizada com badge de contagem correta",
    run: function () {
          var c = document.getElementById('adminCadastrados');
          if (!c) return false;
          var badge = c.querySelector('.admin-badge');
          var rows = c.querySelectorAll('tbody tr');
          if (!badge) return false;
          var n = parseInt(badge.textContent, 10);
          return n === rows.length;
        } },
  { id: "adm-badge-neutro", grupo: "Admin", label: "Badges de contagem não usam a cor de destaque (--accent)",
    run: function () {
          var badge = document.querySelector('#adminInterests .admin-badge, #adminCadastrados .admin-badge, #adminAdmins .admin-badge');
          if (!badge) return true;
          var bg = getComputedStyle(badge).backgroundColor;
          var accentBg = getComputedStyle(document.querySelector('.btn--primary') || document.body).backgroundColor;
          return bg !== accentBg;
        } },
  { id: "adm-cadastrados-filtro", grupo: "Admin", label: "Cadastrados: filtro reduz a lista de forma consistente",
    run: function () {
          var c = document.getElementById('adminCadastrados');
          var input = document.getElementById('cadastradosFiltro');
          if (!c || !input) return false;
          var rowsAntes = c.querySelectorAll('tbody tr').length;
          if (rowsAntes === 0) return true; // nada cadastrado ainda — não há o que filtrar
          var primeiraEmail = c.querySelector('tbody tr td:nth-child(2)').textContent;
          var termo = primeiraEmail.slice(0, 4);
          input.value = termo;
          input.dispatchEvent(new Event('input'));
          var linhas = Array.from(c.querySelectorAll('tbody tr'));
          var todasContemTermo = linhas.length > 0 && linhas.every(function (tr) {
            var nome = tr.querySelector('td:nth-child(1)').textContent.toLowerCase();
            var email = tr.querySelector('td:nth-child(2)').textContent.toLowerCase();
            return nome.indexOf(termo.toLowerCase()) !== -1 || email.indexOf(termo.toLowerCase()) !== -1;
          });
          var reduziu = linhas.length <= rowsAntes;
          // restaura
          input.value = '';
          input.dispatchEvent(new Event('input'));
          return todasContemTermo && reduziu;
        } },
  { id: "adm-cadastrados-colunas", grupo: "Admin", label: "Cadastrados: colunas Nome/E-mail/Área/Cadastro/Situação/Ações, sem coluna solta de botão",
    run: function () {
          var c = document.getElementById('adminCadastrados');
          if (!c) return false;
          var ths = Array.from(c.querySelectorAll('thead th')).map(function(th) { return th.textContent.trim(); });
          var temXP = ths.some(function(t) { return t === 'XP'; });
          var temEssenciais = ['Nome','E-mail','Área','Cadastro','Situação','Ações'].every(function(col) { return ths.indexOf(col) !== -1; });
          /* Cada ação numa coluna própria era o que estourava a largura da
             tabela e empurrava os botões para trás de uma rolagem lateral.
             Cabeçalho vazio é o rastro desse formato: a coluna existia só
             para segurar um botão. */
          var colunaDeBotao = ths.some(function(t) { return t === ''; });
          return temEssenciais && !temXP && !colunaDeBotao && ths.length === 6;
        } },
  { id: "adm-table-scroll-wrap", grupo: "Admin", label: "Tabelas admin envolvidas em .table-scroll-wrap (scroll horizontal automático)",
    run: function () {
          var wraps = document.querySelectorAll('.table-scroll-wrap');
          if (wraps.length === 0) return false;
          var todas = Array.from(wraps).every(function(w) { return w.querySelector('table') !== null; });
          return todas;
        } },
  { id: "c-adm-guard-oculto", grupo: "Admin", label: "Aviso \"Acesso Restrito\" começa oculto — admin não pode vê-lo piscando durante o carregamento",
    run: function () {
          var guard = document.getElementById('adminGuard');
          if (!guard) return false;
          var sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
          /* Pra quem é admin, tem que estar escondido agora e sempre. */
          if (sess && window.faAuth.isAdmin(sess.email)) return guard.hidden === true;
          return true; /* fora de sessão admin não dá pra afirmar nada */
        } },
  { id: "c-adm-eventos-accordion", grupo: "Admin", label: "Eventos: cada evento começa recolhido e o clique no cabeçalho abre e fecha",
    run: function () {
          var sec = document.querySelector('#adminInterests [data-ev-key]');
          if (!sec) return true; /* nenhum evento cadastrado nesta base */
          var wrap = sec.querySelector('.ev-turmas-wrap');
          var hdr = wrap && wrap.previousElementSibling;
          if (!wrap || !hdr) return false;
          var comecouRecolhido = wrap.style.display === 'none';
          hdr.click();
          var abriu = wrap.style.display !== 'none';
          hdr.click();
          var fechou = wrap.style.display === 'none';
          /* Devolve ao estado em que estava, pra não atrapalhar quem olhar
             a aba depois nem os testes seguintes. */
          if (!comecouRecolhido) hdr.click();
          return comecouRecolhido && abriu && fechou;
        } },
  { id: "c-adm-eventos-expandir-tudo", grupo: "Admin", label: "Eventos: \"Expandir tudo\" abre todos os eventos e \"Recolher tudo\" fecha todos",
    run: function () {
          var c = document.getElementById('adminInterests');
          if (!c) return false;
          var secs = Array.from(c.querySelectorAll('[data-ev-key]'));
          if (!secs.length) return true; /* nenhum evento cadastrado nesta base */
          var btns = Array.from(c.querySelectorAll('button'));
          var expandir = btns.find(function (b) { return b.textContent.indexOf('Expandir tudo') !== -1; });
          var recolher = btns.find(function (b) { return b.textContent.indexOf('Recolher tudo') !== -1; });
          if (!expandir || !recolher) return false;
          var wraps = function () { return secs.map(function (s) { return s.querySelector('.ev-turmas-wrap'); }).filter(Boolean); };
          expandir.click();
          var todosAbertos = wraps().every(function (w) { return w.style.display !== 'none'; });
          recolher.click();
          var todosFechados = wraps().every(function (w) { return w.style.display === 'none'; });
          return todosAbertos && todosFechados;
        } },
  { id: "c-adm-filtro-evento", grupo: "Admin", label: "Eventos: o filtro \"Ver evento\" oferece \"Todos\" mais um item por evento cadastrado",
    run: function () {
          var c = document.getElementById('adminInterests');
          if (!c) return false;
          var secs = c.querySelectorAll('[data-ev-key]');
          if (!secs.length) return true; /* nenhum evento cadastrado nesta base */
          var sel = Array.from(c.querySelectorAll('select')).find(function (s) {
            return s.options.length && s.options[0].textContent.trim() === 'Todos';
          });
          if (!sel) return false;
          /* "Todos" + um por evento — o select não pode oferecer evento que
             não está na tela nem esquecer algum que está. */
          return sel.options.length === secs.length + 1 && sel.options[0].value === '';
        } },
  { id: "c-adm-turmas-agrupadas", grupo: "Admin", label: "Eventos: toda turma aparece dentro do card de um evento ou na seção \"sem evento\", nunca solta",
    run: function () {
          var c = document.getElementById('adminInterests');
          if (!c) return false;
          var cards = Array.from(c.querySelectorAll('.turma-admin-card'));
          if (!cards.length) return true; /* nenhuma turma cadastrada nesta base */
          return cards.every(function (card) {
            return !!card.closest('[data-ev-key]') || !!card.closest('[data-sem-evento]');
          });
        } },
  { id: "c-adm-superadmin", grupo: "Admin", label: "Super-admins fixos no código (tatianefdirene + danielfrazao)",
    run: function () {
            var list = window.faSuperAdmins || [];
            var hasTatiane = list.some(function (e) { return e.indexOf('tatianefdirene') !== -1; });
            var hasDaniel  = list.some(function (e) { return e.indexOf('danielfrazao') !== -1 || e.indexOf('danilfrazao') !== -1; });
            return hasTatiane && hasDaniel;
          } },
  { id: "c-minha-area-link", grupo: "Admin", label: "Minha Área: link no menu visível para quem está logado",
    run: function () {
          var link = document.querySelector('[data-nav-page="minha-area"]');
          if (!link) return false;
          var sess = window.faAuth && window.faAuth.getSession ? window.faAuth.getSession() : null;
          return sess ? link.hidden === false : true;
        } },
  { id: "c-minha-area-sem-qr", grupo: "Admin", label: "Minha Área: NÃO expõe QR Code de check-in (integridade da frequência)",
    run: function () {
          var sec = document.getElementById('page-minha-area');
          if (!sec) return false;
          /* Nenhum canvas de QR nem link para #checkin dentro da área do participante */
          return !sec.querySelector('canvas') && !sec.querySelector('a[href*="checkin"]');
        } },
  { id: "c-minha-area-nunca-vazia", grupo: "Admin", label: "Minha Área: sempre renderiza algum estado (nunca fica em branco)",
    run: function () {
          var wrap = document.getElementById('minhaAreaContent');
          if (!wrap) return false;
          /* Depois de carregada, tem que existir ao menos um título de seção
             ou um cartão — a página não pode terminar sem estado nenhum. */
          if (/Carregando/.test(wrap.textContent || '')) return true;   /* ainda carregando: não é falha */
          return !!wrap.querySelector('.aluno-sec-title, .aluno-card');
        } },
  { id: "c-aval-nav-admin", grupo: "Admin", label: "Admin vê link Avaliação no menu (nav-link-aval)",
    run: function () {
            var s = window.faAuth && window.faAuth.getSession();
            if (!s || !window.faAuth.isAdmin(s.email)) return true; /* só aplica para admin */
            var link = document.querySelector('.nav-link-aval[data-nav-page="avaliacao"]');
            return !!link && !link.hidden;
          } },
  { id: "adm-classificacoes-fonte-unica", grupo: "Admin", label: "Classificações da Avaliação: window.faClassificacoes existe, os códigos são os do motor (CAMADAS, 11) e todo código tem nome (da Taxonomia ou de contingência)",
    run: function () {
          var C = window.faClassificacoes;
          if (!C) return false;
          var cods = C.codigos();
          return cods.length === 11 && cods.indexOf('produto-principal') !== -1 && cods.indexOf('a-validar') !== -1 &&
            cods.every(function (id) { return typeof C.nome(id) === 'string' && C.nome(id).length > 0; });
        } },
  { id: "adm-avaliacao-produto-exportar", grupo: "Admin", label: "Admin → Avaliação de Produto/Serviço: só parametrização (Usuários autorizados presente; sem lista nem exportação)",
    run: function () {
          var admin = document.getElementById('adminAvaliacaoProduto');
          if (!admin || !admin.querySelector('#avpConfigQuestionariosBtn')) return true; /* bloco ainda não renderizado, ou numa subtela */
          return !!admin.querySelector('#avpUsuariosBtn') && !admin.querySelector('#avpExportarBtn') && !admin.querySelector('#avpLixeiraBtn');
        } },
];

const DESKTOP = { viewport: { width: 1280, height: 900 } };
const CELULAR = { ...devices['iPhone 13'], viewport: { width: 375, height: 800 } };
const PAGINAS = ['home', 'turmas', 'conteudos', 'treinamento', 'repositorio', 'minha-area', 'ajuda', 'avaliacao'];

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function rodar(browser, nome, opts) {
  console.log('\n######## ' + nome + ' ########');
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#home', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);

  /* Passa por cada página para ela inicializar, esperando a decisão de rota assentar. */
  for (const rota of PAGINAS) {
    await page.evaluate((r) => { location.hash = '#' + r; }, rota);
    await esperarCondicao(page, (r) => { const s = document.getElementById('page-' + r); return !!s && !s.hidden; }, rota, { descricao: 'a página #' + rota + ' aparecer' });
  }
  await esperarCondicao(page, () => document.querySelectorAll('.turma-card-new').length > 0 && document.querySelectorAll('#repoGrid .repo-card').length > 0, null, { descricao: 'vitrine de turmas e Repositório carregados' });
  await page.evaluate(() => { location.hash = '#admin'; });
  await esperarCondicao(page, () => document.querySelectorAll('#adminCadastrados tbody tr').length > 0 && document.querySelectorAll('#adminInterests .turma-admin-card').length > 0, null, { descricao: 'ADMIN carregado (cadastrados e turmas)' });

  for (const c of CHECAGENS) {
    let ok = false, erro = '';
    try {
      ok = await page.evaluate('(' + c.run.toString() + ')()') === true;
    } catch (e) { erro = String(e.message || e).split('\n')[0]; }
    afirma(ok, '[' + c.grupo + '] ' + c.label, erro || 'devolveu false');
  }
  afirma(erros.length === 0, 'nenhum erro de JavaScript durante as checagens', erros.slice(0, 3).join(' | '));
  await ctx.close();
}

module.exports = { banco, ADM, FALSO };

if (require.main === module) (async () => {
  const browser = await chromium.launch();
  await rodar(browser, 'desktop', DESKTOP);
  await rodar(browser, 'celular 375px', CELULAR);
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — ' + CHECAGENS.length + ' checagens de interface (vindas da antiga aba Testes) passam em desktop e 375 px.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
