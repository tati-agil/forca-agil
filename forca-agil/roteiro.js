/* ============================================================
   Força Ágil — Roteiro de Facilitação

   Dados e telas do roteiro de cada evento (roteiro-base, por dia) e da
   personalização de cada turma sobre esse roteiro-base. Carregado antes
   de admin.js e de facilitador.js — os dois usam window.faRoteiro, o
   primeiro para editar o roteiro-base e o roteiro de qualquer turma, o
   segundo para o facilitador ver (e, sendo responsável, editar) o
   roteiro das turmas em que atua. A mesma função de desenho serve os
   dois lugares (renderRoteiroTurma), só muda o `editable` que cada um
   passa — nenhuma tela reimplementa a mesclagem base+customização.

   ── Modelo de dados (Firebase Realtime Database) ──────────────────

     roteiros-evento/<eventoKey>/dias/<diaKey>       = { ordem, titulo, createdAt }
     roteiros-evento/<eventoKey>/atividades/<atvKey> = {
       diaKey, ordem, titulo, tipo, paiKey?, sessao?,
       horaInicio, horaFim, duracaoMinutos,
       objetivo, resultadoEsperado?, passoAPasso, dicasFacilitador, promptIA?,
       conexaoAgilidade, materiais: [..], preparacaoPrevia, observacoes,
       createdAt, updatedAt
     }
     ("descricao" e "perguntasDebrief" existiram antes e podem sobreviver
     em atividades antigas — nenhuma tela mais lê/grava esses dois campos
     desde que Descrição e Perguntas para o debrief saíram do formulário;
     dado órfão inofensivo, não precisa migração.)

     "sessao" é um texto livre (ex: "Manhã", "Tarde") que agrupa as
     atividades de nível principal de um mesmo dia em janelas
     independentes — cada uma com sua própria janela/programado/pausas/
     lacunas calculados só entre as atividades daquele grupo (ver
     agruparPorSessao). Isso é o que evita chamar o intervalo ENTRE duas
     sessões (ex: o almoço, entre o fim da manhã e o início da tarde) de
     "lacuna no planejamento": lacuna só existe DENTRO de uma sessão.
     Quando NINGUÉM preenche "sessao" nesse dia, o sistema tenta detectar
     sozinho onde as sessões começam e terminam: um vão cronológico de
     LIMIAR_SESSAO_AUTO_MIN minutos ou mais entre duas atividades vizinhas
     vira um corte automático de sessão (nomeada "Manhã"/"Tarde"/"Noite"
     pelo horário de início), em vez de um buraco de planejamento — assim
     um roteiro real com um vão grande e intencional entre dois turnos do
     dia não precisa que cada atividade seja marcada manualmente pra parar
     de aparecer como "lacuna". Um vão MENOR que o limiar continua sendo
     lacuna de verdade. Preencher "sessao" manualmente sempre tem
     prioridade sobre essa detecção automática.

     "paiKey" é o que faz uma atividade virar sub-etapa de outra — mesma
     ficha completa de qualquer atividade (não uma versão reduzida): uma
     seção nada mais é do que uma atividade que tem outras apontando pra
     ela como pai. A duração de quem tem filhas é sempre a soma das
     filhas (duracaoEfetiva), nunca o duracaoMinutos próprio — que fica
     ignorado (mas não apagado) assim que a primeira filha aparece.

     turmas-equipe/<turmaKey>/<facKey>  = { email, name, papel: 'responsavel'|'facilitador', addedAt, addedBy }
     turmas/<turmaKey>/responsavelFacilitadorKey  = <facKey> — único responsável, por construção
       (campo já existe no mesmo node de "turmas"; ver admin.js openTurmaFormModal)

     turmas-roteiro/<turmaKey>/customizacoes/<atvKey> = { <só os campos alterados>, removida?:true, updatedAt }
     turmas-roteiro/<turmaKey>/exclusivas/<atvKey>    = mesma forma de uma atividade base, + diaKey
     turmas-roteiro/<turmaKey>/facilitacao/<atvKey>   = { principal: facKey|'', apoio: [facKey,...] }

   ── Por que "ordem" no roteiro-base e horário na turma ─────────────
   O roteiro-base usa um campo "ordem" com ▲▼ (like o itinerário do
   evento): faz sentido enquanto o roteiro ainda está em rascunho, sem
   horários definidos. Já a visão da turma (mistura base + customização
   + atividades exclusivas, cada uma podendo ter mudado de horário)
   ordena sempre pelo horário de início. Isso evita ter que decidir "que
   posição ocupa uma atividade exclusiva no meio de atividades base" —
   pergunta que o próprio pedido reconhece como possivelmente complexa
   demais para uma granularidade por posição; pelo relógio, a pergunta
   nem precisa existir: quem decide a ordem é o horário escolhido.
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Menu "⋮" (mesmo padrão visual de .taa-more-btn/.taa-dropdown já usado
     nos cards de turma do admin) só pra "+ Etapa" numa atividade simples
     (sem etapas ainda) — reduz a quantidade de botões na linha até a
     atividade realmente virar seção. Um único listener de documento fecha
     qualquer menu deste tipo aberto; registrado uma vez só (a flag evita
     empilhar um listener novo a cada redesenho da lista). */
  var _dropdownEtapaListenerAtivo = false;
  function fecharDropdownsEtapaAoClicarFora() {
    if (_dropdownEtapaListenerAtivo) return;
    _dropdownEtapaListenerAtivo = true;
    document.addEventListener('click', function () {
      document.querySelectorAll('.rt-etapa-dropdown.open').forEach(function (el) { el.classList.remove('open'); });
    });
  }
  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }
  function db() { return firebase.database(); }

  /* ---- Formatação básica nas caixas de texto do formulário de atividade
     (negrito, itálico, sublinhado, listas, alinhar) — ver campoRico() mais
     abaixo. Guardamos HTML de verdade no banco a partir de agora, mas o
     sanitizador abaixo garante que só as tags/estilos desta lista sobrevivem
     (nunca script, atributo de evento, src etc.), tanto no que sai do
     editor quanto no que é lido de volta — inclusive dados antigos, que
     eram texto puro e passam pela mesma peneira (heurística: só tratamos
     como HTML de verdade quando o valor já contém alguma dessas tags). ---- */
  var RICO_TAGS_PERMITIDAS = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, UL: 1, OL: 1, LI: 1, BR: 1, DIV: 1, P: 1, SPAN: 1, BLOCKQUOTE: 1 };
  var RICO_ALINHAMENTOS = ['left', 'center', 'right', 'justify'];
  function sanitizarHtmlRico(html) {
    var raiz = document.createElement('div');
    raiz.innerHTML = html || '';
    (function limpar(no) {
      var filho = no.firstChild;
      while (filho) {
        if (filho.nodeType === 8 /* comentário */) {
          var rem = filho; filho = filho.nextSibling; no.removeChild(rem); continue;
        }
        if (filho.nodeType !== 1 /* elemento */) { filho = filho.nextSibling; continue; }
        if (!RICO_TAGS_PERMITIDAS[filho.tagName]) {
          var proxDepois = filho.nextSibling;
          var primeiroPromovido = filho.firstChild;
          while (filho.firstChild) no.insertBefore(filho.firstChild, filho);
          no.removeChild(filho);
          filho = primeiroPromovido || proxDepois;
          continue;
        }
        /* Lidos ANTES de apagar os atributos: como vêm do getter já
           interpretado da CSSOM (filho.style.*), só podem conter um valor
           de cor/alinhamento/tamanho/recuo válido de verdade — nunca algo
           executável (url(), expression() etc.) — então é seguro reaplicar
           só esses valores depois de zerar o atributo style inteiro.
           marginLeft é o que sobra de um BLOCKQUOTE criado pelo botão de
           recuo (execCommand('indent') sempre envolve o bloco num
           <blockquote>, mesmo fora de uma lista) — sem preservar essa
           margem o recuo desaparecia ao salvar/reabrir. */
        var alinhamento = filho.style && filho.style.textAlign;
        var cor = filho.style && filho.style.color;
        var corFundo = filho.style && filho.style.backgroundColor;
        var tamanho = filho.style && filho.style.fontSize;
        var recuo = filho.style && filho.style.marginLeft;
        Array.prototype.slice.call(filho.attributes).forEach(function (attr) { filho.removeAttribute(attr.name); });
        if (RICO_ALINHAMENTOS.indexOf(alinhamento) !== -1) filho.style.textAlign = alinhamento;
        if (cor) filho.style.color = cor;
        if (corFundo) filho.style.backgroundColor = corFundo;
        if (tamanho) filho.style.fontSize = tamanho;
        if (recuo) filho.style.marginLeft = recuo;
        limpar(filho);
        filho = filho.nextSibling;
      }
    })(raiz);
    return raiz.innerHTML;
  }
  function ricoVazio(html) {
    var t = String(html || '').replace(/<br\s*\/?>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
    return !t;
  }
  /* Valor salvo antes desta funcionalidade era texto puro (pode ter "\n",
     "<", "&" literais); valor salvo depois já é HTML de verdade produzido
     pelo próprio sanitizador. Decide qual dos dois casos é, pela presença
     de alguma tag da lista permitida, e trata cada um do jeito certo. */
  function htmlRicoSeguro(valor) {
    if (!valor) return '';
    var pareceHtml = /<\s*(b|strong|i|em|u|ul|ol|li|div|br|p|span)[\s>/]/i.test(valor);
    var html = pareceHtml ? valor : esc(valor).replace(/\n/g, '<br>');
    return sanitizarHtmlRico(html);
  }
  /* Mesma ideia, para um item de uma lista (ex: materiais) — sem a
     conversão de quebra de linha, que não faz sentido dentro de um
     único item. */
  function htmlRicoItemLista(valor) {
    if (!valor) return '';
    var pareceHtml = /<\s*(b|strong|i|em|u|div|br|span)[\s>/]/i.test(valor);
    var html = pareceHtml ? valor : esc(valor);
    return sanitizarHtmlRico(html);
  }
  function listaParaHtmlEditor(arr) {
    if (!arr || !arr.length) return '';
    return '<ul>' + arr.map(function (item) { return '<li>' + htmlRicoItemLista(item) + '</li>'; }).join('') + '</ul>';
  }
  function extrairTextoRico(el) {
    var html = sanitizarHtmlRico(el.innerHTML);
    return ricoVazio(html) ? '' : html;
  }
  function extrairListaRico(el) {
    var lis = el.querySelectorAll('li');
    var itens = lis.length
      ? Array.prototype.map.call(lis, function (li) { return sanitizarHtmlRico(li.innerHTML).trim(); })
      : sanitizarHtmlRico(el.innerHTML).split(/<div[^>]*>|<\/div>|<br\s*\/?>|<p[^>]*>|<\/p>/i).map(function (s) { return s.trim(); });
    return itens.filter(function (s) { return !ricoVazio(s); });
  }
  /* Texto da linha ATUAL, do inicio dela ate o cursor -- nao do inicio da
     caixa inteira. Precisa ser assim porque conteudo antigo (migrado de
     texto puro por htmlRicoSeguro) vira uma sequencia plana de <br> direto
     dentro da area, sem nenhum <div> por linha -- entao um bloco/Range
     baseado so no ancestral mais proximo nao dava conta: "linha ate o
     cursor" virava "toda a caixa ate o cursor", grudando o texto de
     todas as linhas anteriores sem separador nenhum (Range.toString()
     ignora <br>) e o regex de marcador nunca batia a partir da 2a linha.
     Aqui em vez disso pega o HTML inteiro ate o cursor, tira so a tag de
     fechamento do bloco que contem o cursor (ela aparece sempre que o
     cursor esta no meio de um <div>/<p>/<li>, por causa de como
     cloneContents fecha os elementos parciais) e separa por <br> ou por
     abertura de bloco -- o que sobra depois do ultimo desses e exatamente
     a linha atual, <br> solto ou <div> por linha, tanto faz. */
  function textoLinhaAtual(area, range) {
    var pre = document.createRange();
    pre.selectNodeContents(area);
    pre.setEnd(range.startContainer, range.startOffset);
    var tmp = document.createElement('div');
    tmp.appendChild(pre.cloneContents());
    var htmlAntes = tmp.innerHTML.replace(/<\/(?:div|p|li)>$/i, '');
    var partes = htmlAntes.split(/<br\s*\/?>|<(?:div|p|li)[^>]*>/i);
    var tmp2 = document.createElement('div');
    tmp2.innerHTML = partes[partes.length - 1];
    return tmp2.textContent || '';
  }
  /* Continua sozinha uma numeracao/marcador DIGITADO a mao (ex: "1. " ou
     "- ") ao apertar Enter -- sem isso, quem nao usa os botoes "Lista" e
     simplesmente digita "1. texto" precisa lembrar de digitar "2. " na
     linha seguinte tambem. Nao interfere numa lista de verdade (criada
     pelos botoes "• Lista"/"1. Lista"): dentro de um <li> de verdade o
     "1." e um marcador gerado pelo navegador, nao faz parte do texto, e
     por isso o regex abaixo nunca casa -- o Enter nesse caso segue o
     comportamento nativo do navegador (que ja sabe continuar a lista). */
  function continuarMarcadorDigitado(e, area) {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    var sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;
    var range = sel.getRangeAt(0);
    if (!area.contains(range.startContainer)) return;
    var textoAntes = textoLinhaAtual(area, range);
    /* SEPARADOR inclui \u00A0 (espaco nao separavel): contenteditable
       costuma trocar o espaco digitado no fim de uma linha por um espaco
       nao separavel, pra nao ser colapsado -- sem aceitar esse caractere
       aqui, "1. " recem-digitado nunca batia com o regex e a numeracao
       nunca continuava. */
    var SEPARADOR = '[ \\t\\u00A0]+';
    var mNum = textoAntes.match(new RegExp('^(\\s*)(\\d+)([.)])' + SEPARADOR + '(.*)$'));
    var mMarcador = !mNum && textoAntes.match(new RegExp('^(\\s*)([•\\-])' + SEPARADOR + '(.*)$'));
    if (!mNum && !mMarcador) return; /* deixa o Enter padrao do navegador acontecer */
    e.preventDefault();
    var resto = mNum ? mNum[4] : mMarcador[3];
    if (!resto.trim()) {
      /* linha so tinha o marcador, sem texto: Enter tira o marcador em
         vez de repeti-lo de novo (senao nunca dava pra "sair" da lista).
         Apaga por contagem de caracteres (Selection.modify) em vez de um
         Range construido a mao -- mais simples e funciona igual nao
         importa se a linha e um <div> proprio ou um trecho solto entre
         dois <br>. */
      for (var i = 0; i < textoAntes.length; i++) sel.modify('extend', 'backward', 'character');
      document.execCommand('delete');
      document.execCommand('insertParagraph');
      return;
    }
    var prefixo = mNum
      ? (mNum[1] + (Number(mNum[2]) + 1) + mNum[3] + ' ')
      : (mMarcador[1] + mMarcador[2] + ' ');
    document.execCommand('insertParagraph');
    document.execCommand('insertText', false, prefixo);
  }

  /* Tab dentro da caixa de texto rica — sem isso, Tab pula o foco pro
     próximo campo do formulário (comportamento padrão do navegador em
     qualquer elemento focável), o que atrapalha quem quer indentar uma
     lista. Dentro de um <li> de verdade, Tab/Shift+Tab indenta/recua o
     item (padrão de qualquer editor de lista); fora de uma lista, Tab
     insere um recuo visual na posição do cursor. */
  function tabNaCaixaRica(e, area) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var node = sel.anchorNode;
    var dentroDeLi = false;
    while (node && node !== area) {
      if (node.nodeType === 1 && node.tagName === 'LI') { dentroDeLi = true; break; }
      node = node.parentNode;
    }
    if (dentroDeLi) {
      document.execCommand(e.shiftKey ? 'outdent' : 'indent');
    } else if (!e.shiftKey) {
      document.execCommand('insertText', false, '        ');
    }
  }

  /* Colar sempre como texto puro -- nunca o HTML de origem. Colar de uma
     planilha (Excel, Google Sheets, uma tabela do Word) traz um <table>
     de verdade no clipboard; como TABLE/TR/TD nao estao na lista de tags
     permitidas, o sanitizador desembrulhava tudo e as celulas ficavam
     coladas uma na outra sem separador nenhum -- exatamente o texto
     emaranhado relatado. Interceptando o paste e inserindo so o texto
     (via clipboardData, nao o HTML), cada linha da origem vira uma linha
     aqui (quebra vira <br>) e cada coluna fica separada por um espaco bem
     largo (tab vira um bloco de espacos nao separaveis, porque um tab de
     verdade colapsa visualmente num <div> normal) -- sem tabela de
     verdade (fora do que a barra de formatacao sabe fazer), mas legivel
     e sem perder nenhuma linha. */
  function colarComoTexto(e) {
    var dados = e.clipboardData || window.clipboardData;
    var texto = dados ? dados.getData('text/plain') : '';
    if (!texto) return;
    e.preventDefault();
    var html = esc(texto)
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0')
      .replace(/\n/g, '<br>');
    document.execCommand('insertHTML', false, html);
  }

  /* ---- Diálogos (mesmo visual do admin, duplicado aqui: roteiro.js é
     carregado antes de admin.js e usado também por facilitador.js, então
     não pode depender das funções internas do módulo admin) ---- */
  function alertDialog(mensagem) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn--primary roteiro-dlg-ok">OK</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    box.querySelector('.roteiro-dlg-ok').addEventListener('click', close);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) close(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  }
  function confirmDialog(mensagem, onYes) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn roteiro-dlg-cancel">Cancelar</button>' +
        '<button class="btn btn--primary roteiro-dlg-confirm">Confirmar</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    box.querySelector('.roteiro-dlg-cancel').addEventListener('click', close);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) close(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    box.querySelector('.roteiro-dlg-confirm').addEventListener('click', function () { close(); onYes(); });
  }

  /* Diálogo de duas escolhas reais (não "confirmar/cancelar"): as duas
     opções seguem em frente, cada uma do seu jeito — diferente do
     confirmDialog, cujo Cancelar simplesmente não chama nada. Usado no
     recálculo de horários: "Manter horários" não é desistir, é uma
     decisão válida que também precisa liberar o chamador. */
  function escolhaDialog(mensagem, opcaoA, onA, opcaoB, onB) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:440px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">' +
        '<button class="btn roteiro-dlg-b">' + esc(opcaoB) + '</button>' +
        '<button class="btn btn--primary roteiro-dlg-a">' + esc(opcaoA) + '</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); }
    box.querySelector('.roteiro-dlg-a').addEventListener('click', function () { close(); onA(); });
    box.querySelector('.roteiro-dlg-b').addEventListener('click', function () { close(); onB(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); onB(); } });
  }

  /* ══════════════════════════════════════════════════════════════
     DADOS — roteiro-base do evento
     ══════════════════════════════════════════════════════════════ */

  function carregarRoteiroEvento(eventoKey, cb) {
    garantirListenerTipos();
    db().ref('roteiros-evento/' + eventoKey).once('value', function (snap) {
      var val = snap.val() || {};
      var dias = Object.keys(val.dias || {}).map(function (k) {
        return Object.assign({ key: k }, val.dias[k]);
      }).sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
      var atividades = Object.keys(val.atividades || {}).map(function (k) {
        return Object.assign({ key: k }, val.atividades[k]);
      });
      cb(null, { dias: dias, atividades: atividades });
    }, function (err) { cb(err); });
  }

  function atividadesDoDia(atividades, diaKey) {
    return atividades.filter(function (a) { return a.diaKey === diaKey; })
      .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  }
  /* Só as de nível principal (sem paiKey) — o que a lista mostra e numera. */
  function atividadesTopoDoDia(atividades, diaKey) {
    return atividadesDoDia(atividades, diaKey).filter(function (a) { return !a.paiKey; });
  }
  /* Sub-etapas de uma atividade específica, na MESMA coleção (base ou
     exclusivas de uma turma) — quem chama decide qual coleção passar. */
  function filhosDe(atividades, paiKey) {
    return atividades.filter(function (a) { return a.paiKey === paiKey; })
      .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  }

  function proximaOrdem(lista) {
    return lista.length ? Math.max.apply(null, lista.map(function (x) { return x.ordem || 0; })) + 10 : 10;
  }

  function criarDia(eventoKey, dias, cb) {
    var ref = db().ref('roteiros-evento/' + eventoKey + '/dias').push();
    ref.set({ ordem: proximaOrdem(dias), titulo: '', createdAt: new Date().toISOString() }, function (err) {
      cb(err, ref.key);
    });
  }
  function renomearDia(eventoKey, diaKey, titulo, cb) {
    db().ref('roteiros-evento/' + eventoKey + '/dias/' + diaKey + '/titulo').set(titulo || '', cb);
  }
  function excluirDia(eventoKey, diaKey, atividadesDesteDia, cb) {
    var updates = {};
    updates['roteiros-evento/' + eventoKey + '/dias/' + diaKey] = null;
    atividadesDesteDia.forEach(function (a) { updates['roteiros-evento/' + eventoKey + '/atividades/' + a.key] = null; });
    db().ref().update(updates, function (err) {
      if (err) return cb(err);
      limparReferenciasOrfas(atividadesDesteDia.map(function (a) { return a.key; }), function () { cb(null); });
    });
  }

  function criarAtividade(eventoKey, diaKey, dados, atividadesDoMesmoDia, cb) {
    var ref = db().ref('roteiros-evento/' + eventoKey + '/atividades').push();
    var payload = Object.assign({}, dados, {
      diaKey: diaKey, ordem: proximaOrdem(atividadesDoMesmoDia),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    ref.set(payload, function (err) { cb(err, ref.key); });
  }
  function editarAtividade(eventoKey, atividadeKey, dados, cb) {
    var payload = Object.assign({}, dados, { updatedAt: new Date().toISOString() });
    db().ref('roteiros-evento/' + eventoKey + '/atividades/' + atividadeKey).update(payload, cb);
  }
  /* Exclui a atividade e, em cascata, suas sub-etapas (que são atividades
     de verdade, com sua própria chave) — senão elas ficariam órfãs,
     apontando pra um paiKey que não existe mais. */
  function excluirAtividade(eventoKey, atividadeKey, todasAtividadesDoEvento, cb) {
    var filhos = filhosDe(todasAtividadesDoEvento || [], atividadeKey);
    var chaves = [atividadeKey].concat(filhos.map(function (f) { return f.key; }));
    var updates = {};
    chaves.forEach(function (k) { updates['roteiros-evento/' + eventoKey + '/atividades/' + k] = null; });
    db().ref().update(updates, function (err) {
      if (err) return cb(err);
      limparReferenciasOrfas(chaves, function () { cb(null); });
    });
  }
  function moverAtividade(eventoKey, atividadeKey, direcao, atividadesDoMesmoDia, cb) {
    var idx = atividadesDoMesmoDia.findIndex(function (a) { return a.key === atividadeKey; });
    var vizinho = direcao === 'up' ? atividadesDoMesmoDia[idx - 1] : atividadesDoMesmoDia[idx + 1];
    if (idx === -1 || !vizinho) return cb(null);
    var atual = atividadesDoMesmoDia[idx];
    var updates = {};
    updates['roteiros-evento/' + eventoKey + '/atividades/' + atual.key + '/ordem'] = vizinho.ordem;
    updates['roteiros-evento/' + eventoKey + '/atividades/' + vizinho.key + '/ordem'] = atual.ordem;
    db().ref().update(updates, cb);
  }
  /* Duplica a atividade e, se ela for uma seção, suas sub-etapas junto
     (recriadas com paiKey apontando pra cópia nova) — senão "Duplicar"
     numa seção viraria uma seção vazia, perdendo justamente o que ela
     tem de diferente de uma atividade comum. */
  function duplicarAtividade(eventoKey, atividade, atividadesDoMesmoDia, todasAtividadesDoEvento, cb) {
    var ref = db().ref('roteiros-evento/' + eventoKey + '/atividades').push();
    var copia = Object.assign({}, atividade);
    delete copia.key;
    copia.titulo = (copia.titulo || '') + ' (cópia)';
    copia.ordem = proximaOrdem(atividadesDoMesmoDia);
    copia.createdAt = new Date().toISOString();
    copia.updatedAt = copia.createdAt;
    ref.set(copia, function (err) {
      if (err) return cb(err);
      var filhos = filhosDe(todasAtividadesDoEvento || [], atividade.key);
      if (!filhos.length) return cb(null, ref.key);
      var pend = filhos.length;
      filhos.forEach(function (f) {
        var fRef = db().ref('roteiros-evento/' + eventoKey + '/atividades').push();
        var fCopia = Object.assign({}, f, { paiKey: ref.key, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        delete fCopia.key;
        fRef.set(fCopia, function () { if (!--pend) cb(null, ref.key); });
      });
    });
  }

  /* Turma-roteiro guarda referências a atividadeKey (base). Ao excluir a
     atividade base, ou o dia inteiro, os apontamentos de customização,
     remoção e facilitação que sobrariam órfãos em QUALQUER turma são
     limpos junto — sem isso, a atividade excluída "renasceria" como um
     objeto vazio assim que uma turma tivesse uma customização apontando
     para uma chave que não existe mais. */
  function limparReferenciasOrfas(atividadeKeys, cb) {
    if (!atividadeKeys.length) return cb();
    db().ref('turmas-roteiro').once('value', function (snap) {
      var val = snap.val() || {};
      var updates = {};
      Object.keys(val).forEach(function (turmaKey) {
        var t = val[turmaKey] || {};
        atividadeKeys.forEach(function (ak) {
          if (t.customizacoes && t.customizacoes[ak] !== undefined) updates['turmas-roteiro/' + turmaKey + '/customizacoes/' + ak] = null;
          if (t.facilitacao && t.facilitacao[ak] !== undefined) updates['turmas-roteiro/' + turmaKey + '/facilitacao/' + ak] = null;
        });
      });
      if (!Object.keys(updates).length) return cb();
      db().ref().update(updates, function () { cb(); });
    }, function () { cb(); });
  }

  /* ══════════════════════════════════════════════════════════════
     DADOS — personalização por turma
     ══════════════════════════════════════════════════════════════ */

  function carregarRoteiroTurma(turmaKey, cb) {
    db().ref('turmas-roteiro/' + turmaKey).once('value', function (snap) {
      var val = snap.val() || {};
      cb(null, {
        customizacoes: val.customizacoes || {},
        exclusivas: Object.keys(val.exclusivas || {}).map(function (k) { return Object.assign({ key: k }, val.exclusivas[k]); }),
        facilitacao: val.facilitacao || {}
      });
    }, function (err) { cb(err); });
  }

  /* Só grava os campos que de fato mudaram em relação ao valor atual do
     roteiro-base — é o que faz uma atualização futura do roteiro-base
     continuar aparecendo nos campos que esta turma nunca tocou. */
  function customizarAtividade(turmaKey, atividadeBase, valoresForm, cb) {
    var diff = {};
    Object.keys(valoresForm).forEach(function (campo) {
      var novo = valoresForm[campo];
      var base = atividadeBase[campo];
      var mudou = Array.isArray(novo) ? JSON.stringify(novo) !== JSON.stringify(base || []) : novo !== (base || (typeof novo === 'number' ? 0 : ''));
      if (mudou) diff[campo] = novo;
    });
    if (!Object.keys(diff).length) {
      return db().ref('turmas-roteiro/' + turmaKey + '/customizacoes/' + atividadeBase.key).remove(cb);
    }
    diff.updatedAt = new Date().toISOString();
    db().ref('turmas-roteiro/' + turmaKey + '/customizacoes/' + atividadeBase.key).set(diff, cb);
  }
  function restaurarAtividade(turmaKey, atividadeKey, cb) {
    db().ref('turmas-roteiro/' + turmaKey + '/customizacoes/' + atividadeKey).remove(cb);
  }
  function removerAtividadeDaTurma(turmaKey, atividadeKey, cb) {
    db().ref('turmas-roteiro/' + turmaKey + '/customizacoes/' + atividadeKey).update(
      { removida: true, updatedAt: new Date().toISOString() }, cb);
  }

  function criarAtividadeExclusiva(turmaKey, diaKey, dados, cb) {
    var ref = db().ref('turmas-roteiro/' + turmaKey + '/exclusivas').push();
    var payload = Object.assign({}, dados, { diaKey: diaKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    ref.set(payload, function (err) { cb(err, ref.key); });
  }
  function editarAtividadeExclusiva(turmaKey, atividadeKey, dados, cb) {
    db().ref('turmas-roteiro/' + turmaKey + '/exclusivas/' + atividadeKey).update(
      Object.assign({}, dados, { updatedAt: new Date().toISOString() }), cb);
  }
  function excluirAtividadeExclusiva(turmaKey, atividadeKey, todasExclusivas, cb) {
    var filhos = filhosDe(todasExclusivas || [], atividadeKey);
    var chaves = [atividadeKey].concat(filhos.map(function (f) { return f.key; }));
    var updates = {};
    chaves.forEach(function (k) {
      updates['turmas-roteiro/' + turmaKey + '/exclusivas/' + k] = null;
      updates['turmas-roteiro/' + turmaKey + '/facilitacao/' + k] = null;
    });
    db().ref().update(updates, cb);
  }
  function salvarFacilitacaoAtividade(turmaKey, atividadeKey, principal, apoio, cb) {
    db().ref('turmas-roteiro/' + turmaKey + '/facilitacao/' + atividadeKey).set(
      { principal: principal || '', apoio: apoio || [] }, cb);
  }

  /* ══════════════════════════════════════════════════════════════
     DADOS — equipe de facilitação da turma
     ══════════════════════════════════════════════════════════════ */

  function carregarEquipeTurma(turmaKey, cb) {
    db().ref('turmas-equipe/' + turmaKey).once('value', function (snap) {
      var val = snap.val() || {};
      var lista = Object.keys(val).map(function (k) { return Object.assign({ key: k }, val[k]); });
      lista.sort(function (a, b) {
        if ((a.papel === 'responsavel') !== (b.papel === 'responsavel')) return a.papel === 'responsavel' ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
      });
      cb(null, lista);
    }, function (err) { cb(err); });
  }

  /* Ler turmas-equipe inteiro de uma vez (usado pela ficha "Ver" de um
     facilitador no admin e pela Área do Facilitador) — o nó é pequeno
     (uma linha por pessoa por turma), então ler tudo e filtrar no
     cliente é mais simples que indexar por facilitador no banco. */
  function carregarEquipeGlobal(cb) {
    db().ref('turmas-equipe').once('value', function (snap) { cb(null, snap.val() || {}); }, function (err) { cb(err); });
  }

  function definirResponsavel(turmaKey, facilitador, responsavelAnteriorKey, cb) {
    var updates = {};
    updates['turmas/' + turmaKey + '/responsavelFacilitadorKey'] = facilitador.key;
    updates['turmas-equipe/' + turmaKey + '/' + facilitador.key] = {
      email: facilitador.email, name: facilitador.name, papel: 'responsavel', addedAt: new Date().toISOString()
    };
    if (responsavelAnteriorKey && responsavelAnteriorKey !== facilitador.key) {
      updates['turmas-equipe/' + turmaKey + '/' + responsavelAnteriorKey + '/papel'] = 'facilitador';
    }
    db().ref().update(updates, cb);
  }
  function adicionarFacilitadorApoio(turmaKey, facilitador, cb) {
    db().ref('turmas-equipe/' + turmaKey + '/' + facilitador.key).set(
      { email: facilitador.email, name: facilitador.name, papel: 'facilitador', addedAt: new Date().toISOString() }, cb);
  }
  function removerDaEquipe(turmaKey, facilitadorKey, eraResponsavel, cb) {
    var updates = {};
    updates['turmas-equipe/' + turmaKey + '/' + facilitadorKey] = null;
    if (eraResponsavel) updates['turmas/' + turmaKey + '/responsavelFacilitadorKey'] = null;
    db().ref().update(updates, cb);
  }

  /* ══════════════════════════════════════════════════════════════
     MESCLAGEM — roteiro efetivo de uma turma (base + customização)
     ══════════════════════════════════════════════════════════════ */

  /* dia N do roteiro-base -> data real da turma, reaproveitando o array
     turma.dias (já existe, já é o que qualquer outra tela usa pra saber
     as datas de encontro) em vez de guardar uma data por dia do roteiro. */
  function dataDoDia(turma, indice) {
    var dias = (turma.dias || []).slice().sort();
    return dias[indice] || '';
  }

  function carregarRoteiroEfetivoTurma(turma, cb) {
    carregarRoteiroEvento(turma.eventoKey, function (err, base) {
      if (err) return cb(err);
      carregarRoteiroTurma(turma.key, function (err2, custom) {
        if (err2) return cb(err2);
        var out = base.dias.map(function (dia, i) {
          var atividadesBase = atividadesDoDia(base.atividades, dia.key);
          var porKey = {};
          var removidas = [];
          atividadesBase.forEach(function (a) {
            var c = custom.customizacoes[a.key];
            if (c && c.removida) { removidas.push(a); return; }
            var efetiva = c ? Object.assign({}, a, c) : a;
            porKey[a.key] = Object.assign({}, efetiva, { key: a.key, _status: c ? 'alterada' : 'padrao', _facilitacao: custom.facilitacao[a.key] || null, _base: a });
          });
          custom.exclusivas.filter(function (x) { return x.diaKey === dia.key; }).forEach(function (x) {
            porKey[x.key] = Object.assign({}, x, { _status: 'exclusiva', _facilitacao: custom.facilitacao[x.key] || null });
          });
          /* Sub-etapas são atividades de verdade, com sua própria chave —
             base ou exclusiva, tanto faz: entram na mesma mescla acima e
             só precisam ser agrupadas sob quem tem paiKey apontando pra
             elas, e tiradas da lista de nível principal. Se o pai foi
             removido da turma, a filha simplesmente não aparece em lugar
             nenhum (nem foi ela que virou órfã, foi o pai que sumiu). */
          var todas = Object.keys(porKey).map(function (k) { return porKey[k]; });
          var topo = todas.filter(function (a) { return !a.paiKey; });
          topo.forEach(function (a) {
            a._filhos = todas.filter(function (x) { return x.paiKey === a.key; })
              .sort(function (x, y) { return (x.ordem || 0) - (y.ordem || 0); });
          });
          topo.sort(function (a, b) {
            if (a.horaInicio && b.horaInicio && a.horaInicio !== b.horaInicio) return a.horaInicio < b.horaInicio ? -1 : 1;
            if (a.horaInicio && !b.horaInicio) return -1;
            if (!a.horaInicio && b.horaInicio) return 1;
            return (a.ordem || 0) - (b.ordem || 0);
          });
          return { key: dia.key, ordem: dia.ordem, titulo: dia.titulo, numero: i + 1, data: dataDoDia(turma, i), atividades: topo, todasEfetivas: todas, removidas: removidas };
        });
        cb(null, out);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     UI — form de atividade (compartilhado: base, customização, exclusiva)
     ══════════════════════════════════════════════════════════════ */

  /* "Intervalo" é o único tipo com efeito no cálculo (conta em Pausas —
     ver somaPausas) e no destaque visual da linha (badge laranja) — os
     demais são só rótulos livres. Uma atividade antiga com um tipo que
     saiu desta lista (ex: "Debrief", "Outro") não quebra: o <select>
     simplesmente não pré-seleciona nada até a pessoa escolher um tipo
     novo e salvar. Esse efeito compara o texto salvo em "tipo" direto
     com a string 'Intervalo' (ver somaPausas e o badge em admin.js) —
     independe desta lista; renomear/remover a entrada "Intervalo" na
     tela "Tipos de atividade" (admin) só tira a opção do formulário
     pra atividades NOVAS, sem afetar quem já está salvo como tal.

     A lista em si é administrável (aba "Tipos de atividade" do painel
     admin, ver loadTiposAtividade em admin.js), gravada em
     roteiro-tipos-atividade/<chave> = { nome, createdAt }. TIPOS_PADRAO
     abaixo é só a semente: usada como fallback ENQUANTO esse nó nunca
     foi criado (banco vazio, comportamento igual ao de antes desta
     funcionalidade) e como base pra popular o nó a primeira vez que a
     aba é aberta — dali em diante o banco manda, esta constante nunca
     mais é lida por quem já tem o nó preenchido. */
  var TIPOS_PADRAO = ['Abertura', 'Ambientação', 'Aplicação à Liderança', 'Autodiagnóstico', 'Briefing', 'Compromisso', 'Compromisso Individual', 'Conceituação', 'Dinâmica', 'Discussão', 'Experimentação com IA', 'Fechamento', 'Integração', 'Intervalo', 'Provocação', 'Quiz', 'Reflexão', 'Sinal/Evidência', 'Transição'];
  var TIPOS = TIPOS_PADRAO.slice();
  var _tiposListenerAtivo = false;
  /* Só liga o listener quando alguém de fato entra numa tela de roteiro
     (chamado no início de carregarRoteiroEvento/carregarRoteiroEfetivoTurma,
     os dois pontos de entrada usados por admin.js/facilitador.js, ambos já
     atrás do próprio controle de acesso de cada tela) — nunca no carregamento
     do site inteiro, pra não gerar uma leitura (e um possível erro de
     permissão, pra quem nem está autenticado) em toda página do site à toa. */
  function garantirListenerTipos() {
    if (_tiposListenerAtivo) return;
    _tiposListenerAtivo = true;
    db().ref('roteiro-tipos-atividade').on('value', function (snap) {
      var val = snap.val();
      var nomes = val
        ? Object.keys(val).map(function (k) { return (val[k] && val[k].nome) || ''; }).filter(Boolean)
        : TIPOS_PADRAO.slice();
      TIPOS = nomes.sort(function (a, b) { return a.localeCompare(b, 'pt'); });
    }, function (err) { console.error('[roteiro] erro ao carregar roteiro-tipos-atividade', err); });
  }

  function bloco(titulo, innerHtml) {
    return '<div class="roteiro-form-bloco">' +
      '<h5 style="margin:18px 0 10px;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-family:var(--font-head)">' + esc(titulo) + '</h5>' +
      innerHtml + '</div>';
  }
  function campoTexto(id, label, valor, placeholder) {
    return '<label class="auth-label">' + esc(label) +
      '<input type="text" id="' + id + '" placeholder="' + esc(placeholder || '') + '" value="' + esc(valor || '') + '" autocomplete="off" /></label>';
  }
  /* Caixa de texto com formatação básica (negrito, itálico, sublinhado,
     lista com marcadores, lista numerada, centralizar, justificar) — um
     <div contenteditable> com uma barra de botões que aciona
     document.execCommand, sem depender de nenhuma biblioteca externa.
     valorHtmlInicial já deve vir pronto para exibição (ver htmlRicoSeguro
     e listaParaHtmlEditor) — esta função só monta o HTML do campo. */
  function campoRico(id, label, valorHtmlInicial, placeholder, linhasMin) {
    var minH = ((linhasMin || 3) * 22) + 14;
    return '<label class="auth-label">' + esc(label) +
      '<div class="roteiro-rico">' +
        '<div class="roteiro-rico-barra">' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="bold" title="Negrito"><b>N</b></button>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="italic" title="Itálico"><i>I</i></button>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="underline" title="Sublinhado"><u>S</u></button>' +
          '<span class="roteiro-rico-sep"></span>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="insertUnorderedList" title="Lista com marcadores">&#8226; Lista</button>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="insertOrderedList" title="Lista numerada">1. Lista</button>' +
          '<span class="roteiro-rico-sep"></span>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="justifyCenter" title="Centralizar">Centralizar</button>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="justifyFull" title="Justificar">Justificar</button>' +
          '<span class="roteiro-rico-sep"></span>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="outdent" title="Diminuir recuo">&#8592; Recuo</button>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="indent" title="Aumentar recuo">&#8594; Recuo</button>' +
          '<span class="roteiro-rico-sep"></span>' +
          '<select class="roteiro-rico-tamanho" title="Tamanho da fonte">' +
            '<option value="">Tamanho</option>' +
            '<option value="0.8em">Pequena</option>' +
            '<option value="1em">Normal</option>' +
            '<option value="1.3em">Grande</option>' +
            '<option value="1.6em">Enorme</option>' +
          '</select>' +
          '<span class="roteiro-rico-sep"></span>' +
          '<button type="button" class="roteiro-rico-btn" data-cmd="insertHTML" data-arg="<br><br>" title="Adicionar uma linha em branco">↵ Espaço</button>' +
          '<span class="roteiro-rico-sep"></span>' +
          '<label class="roteiro-rico-cor-wrap" title="Cor do texto">A<input type="color" class="roteiro-rico-cor" data-cmd="foreColor" value="#e8ecf5" /></label>' +
          '<label class="roteiro-rico-cor-wrap" title="Cor de fundo (destacar)">🖊<input type="color" class="roteiro-rico-cor" data-cmd="hiliteColor" value="#f5c518" /></label>' +
        '</div>' +
        '<div id="' + id + '" class="roteiro-rico-area" contenteditable="true" data-placeholder="' + esc(placeholder || '') + '" style="min-height:' + minH + 'px">' +
          (valorHtmlInicial || '') +
        '</div>' +
      '</div></label>';
  }
  /* execCommand('fontSize', ...) só aceita os 7 tamanhos legados do HTML
     (<font size="1">..<font size="7">), mesmo com styleWithCSS ligado —
     não dá pra mandar um px/em direto. O truque padrão: pedir o tamanho
     7 (o maior, mais fácil de achar sozinho depois) e trocar cada <font
     size="7"> resultante por um <span style="font-size:..."> de verdade,
     preservando o conteúdo — assim o tamanho vira CSS real, sobrevive ao
     sanitizador (que já reaplica fontSize, ver sanitizarHtmlRico) e nunca
     deixa a tag <font> (fora da lista de tags permitidas) no meio. */
  function aplicarTamanhoFonte(area, tamanho) {
    document.execCommand('fontSize', false, '7');
    Array.prototype.forEach.call(area.querySelectorAll('font[size="7"]'), function (font) {
      var span = document.createElement('span');
      span.style.fontSize = tamanho;
      while (font.firstChild) span.appendChild(font.firstChild);
      font.parentNode.replaceChild(span, font);
    });
  }

  function abrirFormAtividade(opts) {
    /* opts: { titulo, existente, onSalvar(dados), onExcluir?,
       filhosCount?, duracaoSomaFilhos? — quando a atividade editada já
       tem sub-etapas, o campo Duração mostra a soma delas e fica
       travado (sem editar aqui à toa: quem manda na duração são as
       sub-etapas). Início/Fim continuam editáveis e, com a duração fixa
       conhecida, o outro se completa sozinho igual antes. */
    var a = opts.existente || {};
    var duracaoFixa = opts.duracaoSomaFilhos != null;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:640px;width:92%;padding:28px;display:flex;flex-direction:column;gap:4px;max-height:88vh;overflow:auto';

    var tipoOpts = TIPOS.map(function (t) { return '<option value="' + esc(t) + '"' + (a.tipo === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
    var avisoFilhos = opts.filhosCount
      ? '<p style="font-size:.72rem;color:var(--ink-3);margin-top:4px">Esta atividade tem ' + opts.filhosCount + ' sub-etapa' + (opts.filhosCount !== 1 ? 's' : '') + ' — o campo Duração acima mostra a soma delas e fica travado (edite a duração em cada sub-etapa; some todas as sub-etapas pra poder digitar um valor aqui de novo).</p>'
      : '';

    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + esc(opts.titulo) + '</h3>' +
      bloco('Identificação',
        campoTexto('rfTitulo', 'Título', a.titulo, 'Ex: Dinâmica VUCA/BANI') +
        '<label class="auth-label">Tipo de atividade<select id="rfTipo" style="width:100%;padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)"><option value="">—</option>' + tipoOpts + '</select></label>') +
      bloco('Tempo',
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<label class="auth-label" style="flex:1;min-width:110px">Início<input type="time" id="rfInicio" value="' + esc(a.horaInicio || '') + '" /></label>' +
          '<label class="auth-label" style="flex:1;min-width:110px">Fim<input type="time" id="rfFim" value="' + esc(a.horaFim || '') + '" /></label>' +
          '<label class="auth-label" style="flex:1;min-width:110px">Duração (min)<input type="number" min="0" id="rfDuracao"' + (duracaoFixa ? ' disabled title="Soma das sub-etapas — travado"' : '') + ' value="' + esc(duracaoFixa ? opts.duracaoSomaFilhos : (a.duracaoMinutos || '')) + '" /></label>' +
        '</div>' +
        '<p style="font-size:.72rem;color:var(--ink-3);margin-top:4px">Preencha início + duração, início + fim, ou fim + duração — o terceiro campo se completa sozinho.</p>' +
        avisoFilhos +
        campoTexto('rfSessao', 'Sessão / janela (opcional)', a.sessao, 'Ex: Manhã, Tarde') +
        '<p style="font-size:.72rem;color:var(--ink-3);margin-top:4px">Agrupa as atividades do dia em janelas separadas (ex: "Manhã" e "Tarde") — cada uma com sua própria janela/lacunas calculadas, sem contar o intervalo entre elas (ex: almoço) como lacuna de planejamento. Deixe em branco se o dia é uma janela só.</p>') +
      bloco('Propósito',
        campoRico('rfObjetivo', 'Objetivo', htmlRicoSeguro(a.objetivo), 'O que queremos que os participantes percebam, aprendam ou experimentem?', 3) +
        campoRico('rfResultado', 'Resultado esperado', htmlRicoSeguro(a.resultadoEsperado), 'O que deve existir ao término desta atividade? Ex: "8 iniciativas priorizadas pelo Conselho."', 3) +
        campoRico('rfConexao', 'Conexão com a mentalidade ágil', htmlRicoSeguro(a.conexaoAgilidade), 'Por que esta atividade existe', 3)) +
      bloco('Como conduzir',
        campoRico('rfPasso', 'Passo a passo (uma linha por passo)', htmlRicoSeguro(a.passoAPasso), '1. Explique a missão...', 5) +
        campoRico('rfDicas', 'Dicas para o facilitador', htmlRicoSeguro(a.dicasFacilitador), 'O que evitar, o que reforçar', 3)) +
      bloco('IA',
        campoRico('rfPromptIA', 'Prompt para IA', htmlRicoSeguro(a.promptIA), 'Prompt a ser usado nesta atividade (ex: experimentação com IA) — não confundir com Passo a passo, Dicas, Observações ou Preparação prévia', 5)) +
      bloco('Recursos',
        campoRico('rfMateriais', 'Materiais necessários (um por linha)', listaParaHtmlEditor(a.materiais), '30 cartões, post-its', 3) +
        campoRico('rfPreparacao', 'Preparação prévia', htmlRicoSeguro(a.preparacaoPrevia), 'O que preparar antes de começar', 3)) +
      bloco('Observações', campoRico('rfObs', 'Observações', htmlRicoSeguro(a.observacoes), '', 3)) +
      '<p id="rfErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none;margin-top:10px"></p>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:16px">' +
        (opts.onExcluir ? '<button class="btn roteiro-form-excluir" style="border-color:rgba(255,80,80,.5);color:#ff8080">Excluir</button>' : '<span></span>') +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn roteiro-form-cancelar">Cancelar</button>' +
          '<button class="btn btn--primary roteiro-form-salvar">Salvar</button>' +
        '</div>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var $ = function (sel) { return box.querySelector(sel); };
    var inicioEl = $('#rfInicio'), fimEl = $('#rfFim'), duracaoEl = $('#rfDuracao');

    Array.prototype.forEach.call(box.querySelectorAll('.roteiro-rico-btn'), function (btn) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); }); /* mantém a seleção de texto ao clicar */
      btn.addEventListener('click', function () {
        var area = btn.closest('.roteiro-rico').querySelector('.roteiro-rico-area');
        area.focus();
        document.execCommand(btn.getAttribute('data-cmd'), false, btn.getAttribute('data-arg'));
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.roteiro-rico-area'), function (area) {
      area.addEventListener('keydown', function (e) { continuarMarcadorDigitado(e, area); tabNaCaixaRica(e, area); });
      area.addEventListener('paste', colarComoTexto);
    });
    /* Cor do texto / cor de fundo: <input type="color"> abre o seletor
       nativo do navegador (sem biblioteca nenhuma). Não dá pra prevenir o
       mousedown aqui como nos outros botões — isso bloquearia o próprio
       seletor de abrir — então a seleção de texto é guardada assim que o
       clique começa e restaurada só na hora de aplicar a cor, depois que
       o foco já passou pelo diálogo nativo e voltou. */
    Array.prototype.forEach.call(box.querySelectorAll('.roteiro-rico-cor'), function (input) {
      input.addEventListener('mousedown', function () {
        var area = input.closest('.roteiro-rico').querySelector('.roteiro-rico-area');
        var sel = window.getSelection();
        input._area = area;
        input._selecaoSalva = (sel.rangeCount && area.contains(sel.anchorNode)) ? sel.getRangeAt(0).cloneRange() : null;
      });
      input.addEventListener('input', function () {
        if (!input._area || !input._selecaoSalva) return;
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(input._selecaoSalva);
        input._area.focus();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand(input.getAttribute('data-cmd'), false, input.value);
      });
    });
    /* Tamanho da fonte: mesmo padrão do seletor de cor acima — guarda a
       seleção no mousedown (antes do <select> abrir a listinha de opções
       e tirar o foco da caixa) e restaura na hora de aplicar. Volta pro
       placeholder "Tamanho" depois de aplicar porque o valor escolhido
       não reflete o tamanho do próximo trecho selecionado. */
    Array.prototype.forEach.call(box.querySelectorAll('.roteiro-rico-tamanho'), function (select) {
      select.addEventListener('mousedown', function () {
        var area = select.closest('.roteiro-rico').querySelector('.roteiro-rico-area');
        var sel = window.getSelection();
        select._area = area;
        select._selecaoSalva = (sel.rangeCount && area.contains(sel.anchorNode)) ? sel.getRangeAt(0).cloneRange() : null;
      });
      select.addEventListener('change', function () {
        var tamanho = select.value;
        select.value = '';
        if (!tamanho || !select._area || !select._selecaoSalva) return;
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(select._selecaoSalva);
        select._area.focus();
        aplicarTamanhoFonte(select._area, tamanho);
      });
    });

    [inicioEl, fimEl, duracaoEl].forEach(function (el) {
      el.addEventListener('change', function () {
        var i = hhmmParaMin(inicioEl.value), f = hhmmParaMin(fimEl.value);
        var d = duracaoFixa ? opts.duracaoSomaFilhos : (duracaoEl.value ? Number(duracaoEl.value) : null);
        if (el === duracaoEl && i !== null && d !== null) fimEl.value = minParaHhmm(i + d);
        else if (el === duracaoEl && f !== null && d !== null) inicioEl.value = minParaHhmm(f - d);
        else if (el === inicioEl && d !== null) fimEl.value = minParaHhmm(i + d);
        else if (el === inicioEl && f !== null && !duracaoFixa) duracaoEl.value = Math.max(0, f - i);
        else if (el === fimEl && i !== null && !duracaoFixa) duracaoEl.value = Math.max(0, f - i);
        else if (el === fimEl && d !== null) inicioEl.value = minParaHhmm(f - d);
      });
    });

    function closeModal() { document.body.removeChild(overlay); }
    $('.roteiro-form-cancelar').addEventListener('click', closeModal);
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) closeModal(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } });
    if (opts.onExcluir) {
      $('.roteiro-form-excluir').addEventListener('click', function () {
        var msgExcluir = opts.filhosCount
          ? 'Excluir esta atividade e suas ' + opts.filhosCount + ' sub-etapa(s)? Não é possível desfazer.'
          : 'Excluir esta atividade? Não é possível desfazer.';
        confirmDialog(msgExcluir, function () { opts.onExcluir(); closeModal(); });
      });
    }
    $('.roteiro-form-salvar').addEventListener('click', function () {
      var titulo = $('#rfTitulo').value.trim();
      var errEl = $('#rfErr');
      errEl.style.display = 'none';
      if (!titulo) { errEl.textContent = 'Dê um título à atividade.'; errEl.style.display = ''; return; }
      var i = hhmmParaMin(inicioEl.value), f = hhmmParaMin(fimEl.value);
      if (i !== null && f !== null && f < i) { errEl.textContent = 'O horário final não pode ser antes do inicial.'; errEl.style.display = ''; return; }
      var dados = {
        titulo: titulo, tipo: $('#rfTipo').value,
        horaInicio: inicioEl.value || '', horaFim: fimEl.value || '',
        duracaoMinutos: duracaoEl.value ? Math.max(0, Number(duracaoEl.value)) : 0,
        sessao: $('#rfSessao').value.trim(),
        objetivo: extrairTextoRico($('#rfObjetivo')),
        resultadoEsperado: extrairTextoRico($('#rfResultado')),
        passoAPasso: extrairTextoRico($('#rfPasso')), dicasFacilitador: extrairTextoRico($('#rfDicas')),
        promptIA: extrairTextoRico($('#rfPromptIA')),
        conexaoAgilidade: extrairTextoRico($('#rfConexao')),
        materiais: extrairListaRico($('#rfMateriais')),
        preparacaoPrevia: extrairTextoRico($('#rfPreparacao')), observacoes: extrairTextoRico($('#rfObs'))
      };
      opts.onSalvar(dados);
      closeModal();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     MÉTRICAS DO DIA — janela, tempo programado, facilitação líquida,
     pausas, lacunas. Usado pelo roteiro-base (admin) e pelo roteiro
     efetivo da turma — mesma conta nos dois lugares.

     INTERVALO x LACUNA (não confundir): intervalo é uma atividade do
     tipo "Intervalo", cadastrada de propósito — conta como tempo
     programado e como pausa, mas não como facilitação líquida. Lacuna
     é o buraco entre duas atividades vizinhas sem nada cadastrado no
     meio — não é atividade, não conta como programado nem como pausa,
     só soma na janela do dia. Por isso sempre vale:
       janela = programado + lacunas
       programado = facilitação líquida + pausas
     ══════════════════════════════════════════════════════════════ */

  function hhmmParaMin(hhmm) {
    if (!hhmm) return null;
    var p = String(hhmm).split(':');
    return (+p[0]) * 60 + (+p[1]);
  }
  function minParaHhmm(min) {
    min = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  }
  function fmtDuracao(min) {
    min = Math.round(min || 0);
    if (min <= 0) return '0 min';
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + ' min';
    return h + 'h' + (m ? String(m).padStart(2, '0') : '');
  }
  /* Quem tem sub-etapas (filhas, via paiKey) tem sua duração calculada
     como a soma delas — o duracaoMinutos próprio fica ignorado (mas não
     apagado) enquanto existir ao menos uma filha. `todasAtividades` é a
     lista completa do dia (nível principal + filhas), de onde as filhas
     de `a` são encontradas; sem esse parâmetro, cai no valor próprio. */
  function duracaoEfetiva(a, todasAtividades) {
    if (!a) return 0;
    var filhos = (todasAtividades || []).filter(function (x) { return x.paiKey === a.key; });
    if (filhos.length) return filhos.reduce(function (s, f) { return s + duracaoEfetiva(f, todasAtividades); }, 0);
    return Number(a.duracaoMinutos) || 0;
  }

  /* Soma as pausas (tipo "Intervalo") por FOLHA, não pelo nível principal
     — uma seção só é "Intervalo" de verdade se pelo menos uma sub-etapa
     dela for; olhar só o tipo do pai perdia a pausa sempre que ela virava
     uma sub-etapa dentro de uma seção maior (o pai geralmente é de outro
     tipo, ou sem tipo nenhum), e "Pausas" saía como 0 mesmo com um
     intervalo de verdade cadastrado. */
  function somaPausas(atividades, todasAtividades) {
    return atividades.reduce(function (s, a) {
      var filhos = (todasAtividades || []).filter(function (x) { return x.paiKey === a.key; });
      if (filhos.length) return s + somaPausas(filhos, todasAtividades);
      return s + (a.tipo === 'Intervalo' ? (Number(a.duracaoMinutos) || 0) : 0);
    }, 0);
  }

  function calcularResumoDia(atividadesTopo, todasAtividades) {
    todasAtividades = todasAtividades || atividadesTopo;
    var comHorario = atividadesTopo.filter(function (a) { return a.horaInicio; })
      .slice().sort(function (a, b) { return hhmmParaMin(a.horaInicio) - hhmmParaMin(b.horaInicio); });
    var programadoMin = atividadesTopo.reduce(function (s, a) { return s + duracaoEfetiva(a, todasAtividades); }, 0);
    var pausasMin = somaPausas(atividadesTopo, todasAtividades);
    var gaps = [];
    var sobreposicoes = [];
    for (var i = 1; i < comHorario.length; i++) {
      var fimAnterior = hhmmParaMin(comHorario[i - 1].horaFim) != null ? hhmmParaMin(comHorario[i - 1].horaFim) : hhmmParaMin(comHorario[i - 1].horaInicio) + duracaoEfetiva(comHorario[i - 1], todasAtividades);
      var inicioAtual = hhmmParaMin(comHorario[i].horaInicio);
      if (inicioAtual > fimAnterior) gaps.push({ inicioMin: fimAnterior, fimMin: inicioAtual, min: inicioAtual - fimAnterior });
      else if (inicioAtual < fimAnterior) sobreposicoes.push({
        anterior: comHorario[i - 1], atual: comHorario[i],
        inicioMin: inicioAtual, fimMin: fimAnterior, min: fimAnterior - inicioAtual
      });
    }
    var lacunasMin = gaps.reduce(function (s, g) { return s + g.min; }, 0);
    var janelaInicioMin = comHorario.length ? hhmmParaMin(comHorario[0].horaInicio) : null;
    var ultimo = comHorario[comHorario.length - 1];
    var janelaFimMin = ultimo ? (hhmmParaMin(ultimo.horaFim) != null ? hhmmParaMin(ultimo.horaFim) : hhmmParaMin(ultimo.horaInicio) + duracaoEfetiva(ultimo, todasAtividades)) : null;
    return {
      janelaInicioMin: janelaInicioMin, janelaFimMin: janelaFimMin,
      janelaMin: (janelaInicioMin != null && janelaFimMin != null) ? (janelaFimMin - janelaInicioMin) : null,
      programadoMin: programadoMin, pausasMin: pausasMin, facilitacaoMin: programadoMin - pausasMin,
      sobreposicoes: sobreposicoes,
      gaps: gaps, lacunasMin: lacunasMin, atividadesCount: atividadesTopo.length
    };
  }

  /* Vão cronológico (minutos) a partir do qual, quando NINGUÉM preencheu
     "Sessão/janela" à mão naquele dia, o sistema passa a tratar o vão
     como um corte automático de sessão (ex: o almoço entre a manhã e a
     tarde) em vez de lacuna. Escolhido acima de qualquer pausa curta
     real (café, alongamento) e bem abaixo de um vão de virada de turno —
     um vão MENOR que isso continua sendo lacuna de verdade. */
  var LIMIAR_SESSAO_AUTO_MIN = 90;

  function nomeSessaoAuto(inicioMin, usados) {
    var nome = inicioMin == null ? 'Sessão' : inicioMin < 12 * 60 ? 'Manhã' : inicioMin < 18 * 60 ? 'Tarde' : 'Noite';
    usados[nome] = (usados[nome] || 0) + 1;
    return usados[nome] > 1 ? nome + ' ' + usados[nome] : nome;
  }

  /* Agrupa as atividades de nível principal do dia por sessão/janela —
     cada grupo ganha seu próprio resumo (janela, lacunas, pausas etc.),
     calculado só com as atividades daquele grupo. Isso é o que faz o
     intervalo ENTRE sessões (ex: o almoço, entre o fim da manhã e o
     início da tarde) nunca aparecer como "lacuna no planejamento":
     lacuna só é calculada DENTRO de uma sessão, nunca no vão entre uma
     sessão e outra, porque cada grupo nem enxerga as atividades do outro
     grupo. Duas fontes possíveis pro agrupamento, nesta ordem:
       1) o campo "sessao" preenchido à mão em pelo menos uma atividade —
          agrupa por esse texto exatamente como digitado;
       2) se ninguém preencheu nada, detecta sozinho onde os vãos
          cronológicos (>= LIMIAR_SESSAO_AUTO_MIN) separam blocos de
          atividades, e nomeia cada bloco pelo horário de início (ver
          nomeSessaoAuto). Cada grupo detectado assim carrega
          `automatica:true`, usado só pra exibir uma dica explicando de
          onde veio o nome — nada é gravado no banco por causa disso.
     Um dia sem sessão nenhuma (nem manual, nem vão grande o bastante)
     cai num único grupo sem nome — idêntico ao comportamento de antes
     desta funcionalidade existir. */
  function agruparPorSessao(atividadesTopo, todasAtividades) {
    todasAtividades = todasAtividades || atividadesTopo;
    var algumMarcado = atividadesTopo.some(function (a) { return (a.sessao || '').trim(); });
    if (algumMarcado) {
      var grupos = [];
      var porNome = {};
      atividadesTopo.forEach(function (a) {
        var nome = (a.sessao || '').trim();
        if (!porNome[nome]) { porNome[nome] = { nome: nome, atividades: [] }; grupos.push(porNome[nome]); }
        porNome[nome].atividades.push(a);
      });
      return grupos;
    }

    var comHorario = atividadesTopo.filter(function (a) { return a.horaInicio; })
      .slice().sort(function (a, b) { return hhmmParaMin(a.horaInicio) - hhmmParaMin(b.horaInicio); });
    var cortesApos = {};
    for (var i = 1; i < comHorario.length; i++) {
      var fimAnterior = hhmmParaMin(comHorario[i - 1].horaFim) != null ? hhmmParaMin(comHorario[i - 1].horaFim) : hhmmParaMin(comHorario[i - 1].horaInicio) + duracaoEfetiva(comHorario[i - 1], todasAtividades);
      var inicioAtual = hhmmParaMin(comHorario[i].horaInicio);
      if (inicioAtual - fimAnterior >= LIMIAR_SESSAO_AUTO_MIN) cortesApos[comHorario[i - 1].key] = true;
    }
    if (!Object.keys(cortesApos).length) return [{ nome: '', atividades: atividadesTopo.slice() }];

    var autoGrupos = [{ nome: '', atividades: [], automatica: true }];
    atividadesTopo.forEach(function (a) {
      autoGrupos[autoGrupos.length - 1].atividades.push(a);
      if (cortesApos[a.key]) autoGrupos.push({ nome: '', atividades: [], automatica: true });
    });
    var usados = {};
    autoGrupos.forEach(function (g) {
      var primeiro = g.atividades.filter(function (a) { return a.horaInicio; })[0];
      g.nome = nomeSessaoAuto(primeiro ? hhmmParaMin(primeiro.horaInicio) : null, usados);
    });
    return autoGrupos;
  }

  /* Compara a ordem de exibição atual (por "ordem", que é o que o
     roteiro-base usa) com a ordem cronológica (por horaInicio) —
     só entre quem tem horário definido. Diverge = a pessoa mexeu no
     horário sem reordenar, ou vice-versa. */
  function ordemDivergeDoHorario(atividadesEmOrdem) {
    var comHorario = atividadesEmOrdem.filter(function (a) { return a.horaInicio; });
    var porHorario = comHorario.slice().sort(function (a, b) { return hhmmParaMin(a.horaInicio) - hhmmParaMin(b.horaInicio); });
    for (var i = 0; i < comHorario.length; i++) if (comHorario[i].key !== porHorario[i].key) return true;
    return false;
  }

  function resumoDiaHtml(resumo, idPrefix, ehSessao) {
    function item(label, valor, cor, tooltip, extra) {
      return '<div style="flex:1;min-width:110px" title="' + esc(tooltip || '') + '">' +
        '<div style="font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)">' + esc(label) + '</div>' +
        '<div style="font-size:1.05rem;font-weight:700;color:' + cor + '">' + esc(valor) + '</div>' +
        (extra ? '<div style="font-size:.68rem;color:var(--ink-3)">' + esc(extra) + '</div>' : '') + '</div>';
    }
    var janelaTxt = resumo.janelaMin != null ? minParaHhmm(resumo.janelaInicioMin) + ' → ' + minParaHhmm(resumo.janelaFimMin) : '—';
    /* §113/§114: quando o dia tem mais de uma sessão, o rótulo deixa claro
       que essa janela é só desta sessão — nunca "janela do dia" abrangendo
       o dia inteiro, o que sugeriria (errado) um evento contínuo. */
    return '<div id="' + idPrefix + '" style="display:flex;flex-wrap:wrap;gap:16px;padding:14px 16px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:12px;margin-bottom:14px">' +
      item(ehSessao ? 'Janela da sessão' : 'Janela do dia', janelaTxt, 'var(--gold)', 'Do início da primeira à conclusão da última atividade com horário definido' + (ehSessao ? ' nesta sessão.' : '.'), resumo.janelaMin != null ? fmtDuracao(resumo.janelaMin) : '') +
      item('Tempo programado', fmtDuracao(resumo.programadoMin), 'var(--blue-glow)', 'Soma das durações de todas as atividades planejadas (inclui pausas).') +
      item('Tempo de facilitação', fmtDuracao(resumo.facilitacaoMin), '#4caf7d', 'Tempo programado descontando pausas e intervalos.', resumo.pausasMin ? '' : 'sem pausas') +
      item('Pausas / intervalos', fmtDuracao(resumo.pausasMin), '#ffb347', 'Soma das atividades do tipo Intervalo.') +
      item('Lacunas reais', fmtDuracao(resumo.lacunasMin), resumo.lacunasMin ? '#ff8a5c' : 'var(--ink-3)', 'Períodos entre atividades sem nada programado — não conta como tempo programado.') +
      item('Atividades principais', String(resumo.atividadesCount), 'var(--blue-glow)', 'Quantidade de atividades principais do dia (sub-etapas não contam à parte).') +
      (resumo.sobreposicoes && resumo.sobreposicoes.length
        ? item('Sobreposições', fmtDuracao(resumo.sobreposicoes.reduce(function (s, o) { return s + o.min; }, 0)), '#ff6b60', 'Minutos de conflito de horário entre atividades.', resumo.sobreposicoes.length + ' conflito' + (resumo.sobreposicoes.length !== 1 ? 's' : ''))
        : '') +
      '</div>';
  }

  /* Resumo AGREGADO do dia, mostrado uma vez no topo quando o dia tem mais
     de uma sessão — antes das barras "Janela da sessão" de cada sessão
     (que continuam existindo, sem mudança). Em vez de emprestar destaque
     a um "janela do dia" que soma o vão entre sessões (o que faria um dia
     com Manhã 1h30 + Tarde 1h23 aparecer como um falso "7h23" contínuo),
     soma o tempo de cada sessão separadamente — sempre aditivo, nunca o
     período entre a primeira e a última atividade do dia inteiro. */
  function resumoSessoesHtml(grupos, resumos, idPrefix) {
    function item(label, valor, cor, tooltip, extra) {
      return '<div style="flex:1;min-width:110px" title="' + esc(tooltip || '') + '">' +
        '<div style="font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)">' + esc(label) + '</div>' +
        '<div style="font-size:1.05rem;font-weight:700;color:' + cor + '">' + esc(valor) + '</div>' +
        (extra ? '<div style="font-size:.68rem;color:var(--ink-3)">' + esc(extra) + '</div>' : '') + '</div>';
    }
    var disponivelMin = 0, programadoMin = 0, facilitacaoMin = 0, pausasMin = 0, lacunasMin = 0, atividadesCount = 0;
    var sobreposicoesMin = 0, sobreposicoesCount = 0;
    var extremoInicio = null, extremoFim = null;
    var listaSessoes = grupos.map(function (g, i) {
      var r = resumos[i];
      disponivelMin += (r.janelaMin || 0);
      programadoMin += r.programadoMin; facilitacaoMin += r.facilitacaoMin;
      pausasMin += r.pausasMin; lacunasMin += r.lacunasMin; atividadesCount += r.atividadesCount;
      (r.sobreposicoes || []).forEach(function (s) { sobreposicoesMin += s.min; sobreposicoesCount++; });
      if (r.janelaInicioMin != null && (extremoInicio == null || r.janelaInicioMin < extremoInicio)) extremoInicio = r.janelaInicioMin;
      if (r.janelaFimMin != null && (extremoFim == null || r.janelaFimMin > extremoFim)) extremoFim = r.janelaFimMin;
      var horarioTxt = r.janelaMin != null ? minParaHhmm(r.janelaInicioMin) + '–' + minParaHhmm(r.janelaFimMin) : 'sem horário';
      return '<div style="flex:1;min-width:130px">' +
        '<div style="font-size:.72rem;font-weight:700;color:var(--gold)">' + esc(g.nome || 'Sem sessão definida') + '</div>' +
        '<div style="font-size:.72rem;color:var(--ink-2)">' + esc(horarioTxt) + (r.janelaMin != null ? ' · ' + esc(fmtDuracao(r.janelaMin)) : '') + '</div>' +
        '</div>';
    }).join('');
    var algumaAutomatica = grupos.some(function (g) { return g.automatica; });
    return '<div id="' + idPrefix + '" style="padding:14px 16px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:12px;margin-bottom:14px">' +
      '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:12px">' +
        item('Sessões', String(grupos.length), 'var(--gold)') +
        listaSessoes +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:16px;padding-top:12px;border-top:1px solid var(--line-strong)">' +
        item('Tempo disponível', fmtDuracao(disponivelMin), 'var(--gold)', 'Soma do tempo de cada sessão — nunca o período entre a primeira e a última atividade do dia inteiro.') +
        item('Tempo programado', fmtDuracao(programadoMin), 'var(--blue-glow)', 'Soma das durações de todas as atividades planejadas, em todas as sessões.') +
        item('Tempo de facilitação', fmtDuracao(facilitacaoMin), '#4caf7d', 'Tempo programado descontando pausas e intervalos, em todas as sessões.') +
        item('Pausas', fmtDuracao(pausasMin), '#ffb347', 'Soma das atividades do tipo Intervalo, em todas as sessões.') +
        item('Lacunas reais', fmtDuracao(lacunasMin), lacunasMin ? '#ff8a5c' : 'var(--ink-3)', 'Só buracos DENTRO de uma sessão — o vão entre uma sessão e outra nunca conta aqui.') +
        item('Atividades principais', String(atividadesCount), 'var(--blue-glow)') +
        (sobreposicoesCount ? item('Sobreposições', fmtDuracao(sobreposicoesMin), '#ff6b60', 'Minutos de conflito de horário entre atividades.', sobreposicoesCount + ' conflito' + (sobreposicoesCount !== 1 ? 's' : '')) : '') +
      '</div>' +
      (extremoInicio != null ? '<div style="font-size:.68rem;color:var(--ink-3);margin-top:10px">Período entre a primeira e a última atividade do dia: ' + esc(minParaHhmm(extremoInicio) + '–' + minParaHhmm(extremoFim)) + ' — não é tempo disponível para facilitação, só o intervalo geral.</div>' : '') +
      (algumaAutomatica ? '<div style="font-size:.68rem;color:var(--ink-3);margin-top:4px">Sessões detectadas automaticamente por um vão grande entre atividades. Pra nomear ou ajustar, preencha "Sessão / janela" em cada atividade.</div>' : '') +
      '</div>';
  }

  function gapRowHtml(gap) {
    return '<div style="border:1px dashed rgba(255,138,92,.5);background:rgba(255,138,92,.08);border-radius:8px;padding:8px 14px;font-size:.8rem;color:#ff8a5c;margin:2px 0">' +
      '⚠ Lacuna no planejamento: ' + esc(minParaHhmm(gap.inicioMin)) + '–' + esc(minParaHhmm(gap.fimMin)) +
      ' <span style="color:var(--ink-3)">(' + esc(fmtDuracao(gap.min)) + ' sem atividade programada)</span></div>';
  }

  /* Banner de sobreposição de horário — quando uma atividade começa antes
     da anterior terminar (o oposto da lacuna). Ao contrário da lacuna
     (que vira uma faixa entre as duas linhas), a sobreposição fica num
     banner só, no topo da lista, porque as duas atividades continuam
     aparecendo cada uma na sua linha normal — não daria pra "inserir uma
     faixa" entre elas sem sugerir uma ordem errada. */
  function bannerSobreposicoesHtml(sobreposicoes) {
    if (!sobreposicoes || !sobreposicoes.length) return '';
    var linhas = sobreposicoes.map(function (s) {
      return '<div>⚠ "' + esc(s.anterior.titulo) + '" (até ' + esc(minParaHhmm(s.fimMin)) + ') se sobrepõe a "' + esc(s.atual.titulo) + '" (desde ' + esc(minParaHhmm(s.inicioMin)) + ') — ' + esc(fmtDuracao(s.min)) + ' de sobreposição.</div>';
    }).join('');
    return '<div style="display:flex;flex-direction:column;gap:4px;padding:10px 14px;background:rgba(255,59,48,.08);border:1px solid rgba(255,59,48,.35);border-radius:8px;margin-bottom:12px;font-size:.82rem;color:#ff6b60">' + linhas + '</div>';
  }

  /* Exportar = imprimir/salvar como PDF pelo diálogo nativo do navegador,
     mesmo padrão já usado em admin.js (imprimirListaPresenca): abre uma
     janela nova com um documento HTML/CSS de impressão montado só em
     memória (window.open + document.write), sem depender de nenhuma
     biblioteca de PDF/DOCX. */
  /* Bloco de resumo (janela/programado/facilitação/pausas/lacunas) e
     banner de sobreposição, no HTML de impressão — compartilhado pelas
     duas impressões, uma vez por sessão (ou uma vez só, se o dia não usa
     sessões). */
  function resumoImpressaoHtml(resumo, ehSessao) {
    var html = '<div class="rp-resumo">' +
      '<div>' + (ehSessao ? 'Janela da sessão' : 'Janela') + '<b>' + (resumo.janelaMin != null ? esc(minParaHhmm(resumo.janelaInicioMin) + ' → ' + minParaHhmm(resumo.janelaFimMin)) : '—') + '</b></div>' +
      '<div>Programado<b>' + esc(fmtDuracao(resumo.programadoMin)) + '</b></div>' +
      '<div>Facilitação<b>' + esc(fmtDuracao(resumo.facilitacaoMin)) + '</b></div>' +
      '<div>Pausas<b>' + esc(fmtDuracao(resumo.pausasMin)) + '</b></div>' +
      '<div>Lacunas reais<b>' + esc(fmtDuracao(resumo.lacunasMin)) + '</b></div>' +
      '<div>Atividades principais<b>' + resumo.atividadesCount + '</b></div>' +
      (resumo.sobreposicoes && resumo.sobreposicoes.length
        ? '<div>Sobreposições<b>' + esc(fmtDuracao(resumo.sobreposicoes.reduce(function (s, o) { return s + o.min; }, 0))) + ' · ' + resumo.sobreposicoes.length + ' conflito' + (resumo.sobreposicoes.length !== 1 ? 's' : '') + '</b></div>'
        : '') +
      '</div>';
    if (resumo.sobreposicoes && resumo.sobreposicoes.length) {
      html += '<div class="rp-sobreposicao">' + resumo.sobreposicoes.map(function (s) {
        return '⚠ "' + esc(s.anterior.titulo) + '" se sobrepõe a "' + esc(s.atual.titulo) + '" (' + esc(fmtDuracao(s.min)) + ')';
      }).join('<br>') + '</div>';
    }
    return html;
  }

  /* Resumo agregado (equivalente de resumoSessoesHtml, mas pro documento de
     impressão) — só aparece quando o dia tem mais de uma sessão, antes das
     seções "Janela da sessão" de cada uma (que continuam impressas, sem
     mudança). */
  function resumoSessoesImpressaoHtml(grupos, resumos) {
    var disponivelMin = 0, programadoMin = 0, facilitacaoMin = 0, pausasMin = 0, lacunasMin = 0, atividadesCount = 0;
    var listaSessoes = grupos.map(function (g, i) {
      var r = resumos[i];
      disponivelMin += (r.janelaMin || 0);
      programadoMin += r.programadoMin; facilitacaoMin += r.facilitacaoMin;
      pausasMin += r.pausasMin; lacunasMin += r.lacunasMin; atividadesCount += r.atividadesCount;
      var horarioTxt = r.janelaMin != null ? minParaHhmm(r.janelaInicioMin) + '–' + minParaHhmm(r.janelaFimMin) : 'sem horário';
      return '<div>' + esc(g.nome || 'Sem sessão definida') + ' — ' + esc(horarioTxt) + (r.janelaMin != null ? ' (' + esc(fmtDuracao(r.janelaMin)) + ')' : '') + '</div>';
    }).join('');
    return '<div class="rp-resumo-sessoes">' +
      '<div class="rp-resumo-sessoes-lista"><b>Sessões (' + grupos.length + ')</b>' + listaSessoes + '</div>' +
      '<div class="rp-resumo">' +
        '<div>Tempo disponível<b>' + esc(fmtDuracao(disponivelMin)) + '</b></div>' +
        '<div>Programado<b>' + esc(fmtDuracao(programadoMin)) + '</b></div>' +
        '<div>Facilitação<b>' + esc(fmtDuracao(facilitacaoMin)) + '</b></div>' +
        '<div>Pausas<b>' + esc(fmtDuracao(pausasMin)) + '</b></div>' +
        '<div>Lacunas reais<b>' + esc(fmtDuracao(lacunasMin)) + '</b></div>' +
        '<div>Atividades principais<b>' + atividadesCount + '</b></div>' +
      '</div></div>';
  }

  /* Cabeçalho de marca do documento impresso — reproduz a logo do site
     (o ícone "i-mark" do sprite SVG do index.html + "FORÇA ÁGIL" + "Previ")
     como HTML/SVG 100% autocontido: a janela de impressão é um documento
     novo (window.open('','_blank') + document.write), sem acesso ao
     sprite de ícones nem ao CSS do site, então o ícone vai copiado
     inline (é só um círculo + triângulo, sem gradiente) em vez de um
     <use href="#i-mark">. Isso é o que faz o PDF exportado carregar a
     identidade visual da Força Ágil, em vez de parecer um documento
     genérico do navegador sem nada do site. */
  function logoImpressaoHtml() {
    return '<div class="rp-brand">' +
      '<svg class="rp-brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 7 L22 22 L16 18 L10 22 Z" fill="currentColor"/></svg>' +
      '<div class="rp-brand-text"><span class="rp-brand-name">FORÇA <b>ÁGIL</b></span><span class="rp-brand-sub">PREVI · OFICINA DE AGILIDADE ORGANIZACIONAL</span></div>' +
      '</div>';
  }

  /* Janela de impressão compartilhada pelas duas impressões (simples e
     completa): monta o HTML, abre a janela e resolve os quatro problemas
     que não dependem do conteúdo em si —
     (1) about:blank no cabeçalho/rodapé que o navegador imprime: como a
         janela nasce com window.open('', ...), a URL fica "about:blank";
         history.replaceState troca só a URL exibida (mesma origem, sem
         navegar de verdade) por um nome de arquivo de verdade;
     (2) o cabeçalho/rodapé NATIVO do navegador (título da aba+URL+data+
         "1/2") não tem como ser desligado por código — só a pessoa
         desmarcando "Cabeçalhos e rodapés" nas opções de impressão; por
         isso a dica fica bem visível na tela (nunca impressa, graças a
         .rp-actions ir embora em @media print). O que DÁ pra controlar
         por código é o rodapé de PÁGINA (numeração "Página X de Y" +
         a marca) via @page{ @bottom-left/@bottom-right } logo abaixo —
         testado e funcional no Chromium (tanto no diálogo de impressão
         quanto no "Salvar como PDF") — assim o documento carrega sua
         própria numeração e identidade mesmo se a pessoa esquecer de
         desmarcar o rodapé nativo;
     (3) nunca deixa `page-break-inside:avoid` num bloco que pode crescer
         sem limite (uma atividade inteira com texto longo, por exemplo)
         — só em elementos curtos e de tamanho previsível (título, meta,
         resumo), que nunca vão precisar ser cortados no meio; um bloco
         maior que uma página com esse "avoid" simplesmente SOME da
         página no Chrome em vez de continuar na seguinte — daí o PDF
         truncado relatado;
     (4) o documento parecia um PDF genérico do navegador, sem nada do
         site — logoImpressaoHtml() (acima) e as fontes Anton/Oswald do
         site (carregadas do Google Fonts, mesma família do index.html)
         dão identidade visual de verdade ao PDF exportado. */
  function abrirJanelaImpressao(tituloDoc, estiloExtra, corpoHtml) {
    /* Paleta e tipografia copiadas de :root em styles.css — reproduzidas
       aqui como valores fixos (não var(--...) do site) porque este
       documento não carrega styles.css nenhum. O documento assume o
       tema espacial escuro do site de propósito (não um "documento de
       trabalho" claro): quem salva como PDF normalmente vai reler na
       tela, não numa impressora física, e a pessoa pediu explicitamente
       que a exportação parecesse o site, não um PDF genérico de
       navegador — por isso a dica abaixo insiste tanto em "Gráficos de
       fundo": sem essa opção marcada, o navegador substitui todo fundo
       escuro por branco na hora de imprimir/salvar. */
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(tituloDoc) + '</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@400;500;600;700&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">' +
      '<style>' +
      ':root{--pspace:#03050d;--ppanel:#0c1528;--ppanel2:#101c34;--pline:rgba(120,160,220,.28);--plines:rgba(120,160,220,.5);--pgold:#f5c518;--pcyan:#18c2ba;--pink:#eaf1ff;--pink2:#b8c6e4;--pink3:#8fa0c4;}' +
      /* "Modo econômico" (checkbox em .rp-actions, nunca impresso) troca só
         estas variáveis por tons claros — como o resto da folha de estilo
         inteira já é montada em cima de var(--p...), a troca se propaga
         sozinha pra cada cartão/rótulo/tabela sem duplicar regra nenhuma.
         Existem só 3 exceções que usam cor fixa (não var()) porque são
         avisos com opacidade sobre o fundo, não texto de rótulo — essas
         precisam de um valor de texto mais escuro à parte pra continuar
         legíveis num fundo claro. */
      'html.rp-eco,body.rp-eco{--pspace:#fdfdfb;--ppanel:#f0f0ec;--ppanel2:#ffffff;--pline:rgba(0,0,0,.12);--plines:rgba(0,0,0,.25);--pgold:#8a6d00;--pcyan:#0e7f78;--pink:#181818;--pink2:#333333;--pink3:#555555;}' +
      'body.rp-eco .rp-sobreposicao{color:#a33;}' +
      'body.rp-eco .rp-gap td{color:#a35a2a;}' +
      'body.rp-eco .rp-gap-bloco{color:#a35a2a;}' +
      '*{box-sizing:border-box;}' +
      'html,body{background:var(--pspace);}' +
      /* Sem max-width, o corpo esticava até a borda da janela — numa tela
         larga isso deixava a tabela/os cartões com colunas desproporcionais
         (muito espaço sobrando entre "Tipo" e "Duração", por exemplo) e o
         documento parecia "desalinhado" comparado a como uma página A4
         de verdade fica. Largura travada em ~900px e centralizada imita
         a largura de uma folha, tanto pra "Agenda resumida" (tabela)
         quanto pros formatos em cartão; @media print destrava de novo,
         já que na impressão física quem manda no tamanho da página é o
         @page logo abaixo, não esse max-width. */
      'body{font-family:"Barlow",Arial,Helvetica,sans-serif;color:var(--pink);margin:0 auto;max-width:900px;padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
      /* A faixa de marca usa cor FIXA (não var(--p...)) de propósito: é a
         logo de verdade do site, não um elemento de conteúdo — continua
         com as cores originais (navy escuro, dourado, ciano) mesmo no
         "modo econômico", igual ao cabeçalho do site nunca ter versão
         clara. É uma faixa só, gasta pouquíssima tinta. */
      '.rp-brand{display:flex;align-items:center;gap:10px;background:#101c34;border:1px solid rgba(245,197,24,.4);color:#eaf1ff;padding:12px 18px;border-radius:10px;margin-bottom:20px;page-break-after:avoid;break-after:avoid-page;page-break-inside:avoid;break-inside:avoid-page;}' +
      '.rp-brand-mark{width:26px;height:26px;flex:none;color:#f5c518;}' +
      '.rp-brand-text{display:flex;flex-direction:column;line-height:1.2;}' +
      '.rp-brand-name{font-family:"Anton","Oswald",Arial,sans-serif;font-size:1.05rem;letter-spacing:.1em;text-transform:uppercase;}' +
      '.rp-brand-name b{color:#f5c518;font-weight:inherit;}' +
      '.rp-brand-sub{font-family:"Oswald",Arial,sans-serif;font-size:.6rem;letter-spacing:.14em;color:#18c2ba;margin-top:2px;}' +
      'h1{font-family:"Oswald",Arial,sans-serif;font-weight:600;font-size:1.3rem;margin:0 0 4px;color:var(--pgold);letter-spacing:.02em;}' +
      '.rp-meta{font-size:.85rem;color:var(--pink3);margin-bottom:18px;}' +
      '.rp-sessao-hdr{font-family:"Oswald",Arial,sans-serif;font-size:1.02rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--pgold);margin:20px 0 8px;padding-top:16px;border-top:1px solid var(--plines);page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-sessao-hdr:first-of-type{border-top:none;padding-top:0;margin-top:0;}' +
      '.rp-resumo,.rp-resumo-sessoes,.rp-atv{background:var(--ppanel2);border:1px solid var(--plines);border-radius:10px;}' +
      '.rp-resumo{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:14px;font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;color:var(--pink3);padding:14px 16px;page-break-inside:avoid;break-inside:avoid-page;}' +
      '.rp-resumo b{display:block;font-size:1.05rem;color:var(--pink);text-transform:none;letter-spacing:0;margin-top:3px;font-family:"Oswald",Arial,sans-serif;}' +
      '.rp-resumo-sessoes{margin-bottom:14px;padding:14px 16px;page-break-inside:avoid;break-inside:avoid-page;}' +
      '.rp-resumo-sessoes-lista{font-size:.82rem;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--pline);}' +
      '.rp-resumo-sessoes-lista>b{display:block;color:var(--pgold);font-family:"Oswald",Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;font-size:.72rem;margin-bottom:4px;}' +
      '.rp-resumo-sessoes-lista>div{margin:2px 0;color:var(--pink2);}' +
      '.rp-sobreposicao{background:rgba(255,59,48,.14);color:#ff9c92;border:1px solid rgba(255,59,48,.4);border-radius:8px;padding:10px 14px;font-size:.8rem;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid-page;}' +
      '.rp-actions{margin-bottom:20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;}' +
      '#rp-print-btn{font-family:"Oswald",Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase;font-size:.76rem;padding:9px 18px;border-radius:8px;border:1px solid var(--pgold);background:var(--ppanel2);color:var(--pgold);cursor:pointer;}' +
      '.rp-dica{font-size:.74rem;color:var(--pink3);}' +
      '.rp-eco-toggle{display:flex;align-items:center;gap:6px;font-size:.76rem;color:var(--pink2);cursor:pointer;}' +
      /* Aviso de "Cabeçalhos e rodapés" — bloco próprio, destacado, ANTES
         do botão de imprimir: o navegador não deixa nenhum código
         desligar o cabeçalho/rodapé nativo dele (data/hora, título da
         aba, URL, "1/2"); a única forma de tirar isso do PDF é a pessoa
         desmarcar essa opção no diálogo de impressão. Um <span> discreto
         dentro da mesma linha do botão passava despercebido — por isso
         virou um cartão de aviso com cor de alerta, sempre a primeira
         coisa visível na janela (nunca impresso, graças a .rp-actions
         ir embora em @media print). */
      '.rp-aviso-cabecalho{background:rgba(255,179,71,.1);border:1px solid rgba(255,179,71,.45);border-radius:8px;padding:10px 14px;font-size:.78rem;color:#ffcf8a;margin-bottom:14px;line-height:1.5;}' +
      '.rp-aviso-cabecalho b{color:#ffb347;}' +
      estiloExtra +
      '@media print{.rp-actions{display:none;} body{padding:10px;max-width:none;}}' +
      /* Rodapé de página PRÓPRIO do documento — não depende da pessoa
         mexer em nada no diálogo de impressão. counter(page)/counter(pages)
         é CSS Paged Media puro (sem JS), testado no Chromium via
         page.pdf() e via impressão normal (mesmo motor): a numeração
         some, some ao remover "Cabeçalhos e rodapés" do navegador, e
         continua exata. A caixa de margem sempre pinta fundo branco
         (não segue --pspace nem o "Modo econômico"), então a cor do
         texto é fixa e escura pra ficar legível nos dois modos. */
      '@page{size:A4 portrait;margin:14mm 14mm 20mm 14mm;' +
        '@bottom-left{content:"FORÇA ÁGIL · PREVI | Roteiro de Facilitação";font-family:Arial,Helvetica,sans-serif;font-size:7.5px;color:#556080;}' +
        '@bottom-right{content:"Página " counter(page) " de " counter(pages);font-family:Arial,Helvetica,sans-serif;font-size:7.5px;color:#556080;}' +
      '}' +
      '</style></head><body>' +
      '<div class="rp-actions" style="flex-direction:column;align-items:stretch">' +
        '<div class="rp-aviso-cabecalho"><b>IMPORTANTE antes de imprimir/salvar:</b> desmarque "Cabeçalhos e rodapés" nas opções de impressão do navegador. A numeração de página e a identificação do documento já vêm no rodapé próprio deste PDF — o cabeçalho/rodapé nativo do navegador (com data/hora, título da aba e URL) não faz parte do layout oficial e o navegador não permite desligá-lo por código, só a pessoa desmarcando essa opção.</div>' +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><button id="rp-print-btn">Imprimir / salvar como PDF</button>' +
        '<label class="rp-eco-toggle"><input type="checkbox" id="rp-eco-toggle"> Modo econômico (fundo claro, menos tinta)</label>' +
        '<span class="rp-dica">Vai imprimir em papel de verdade? Marque "Modo econômico" aqui ao lado antes — senão marque "Gráficos de fundo" (ou "Imprimir cores e imagens de fundo") pra sair igual à tela.</span></div>' +
      '</div>' +
      logoImpressaoHtml() +
      corpoHtml +
      '</body></html>';

    var win = window.open('', '_blank');
    if (!win) { alertDialog('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.'); return null; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    try { win.history.replaceState(null, '', 'roteiro-impressao.html'); } catch (err) { /* mesma origem devia deixar; sem isso só fica about:blank mesmo */ }
    var printBtn = win.document.getElementById('rp-print-btn');
    if (printBtn) printBtn.addEventListener('click', function () { win.print(); });
    /* "Modo econômico" troca as variáveis de cor pra tons claros (ver
       comentário acima, no :root) — pensado pra quem vai imprimir em
       papel de verdade e não quer gastar tinta com o fundo escuro do
       tema do site; sem marcar, a exportação sai fiel ao site (o padrão,
       pensado pra quem vai reler o PDF numa tela). Aplica em <html> e
       <body> porque a variável CSS só herda pra baixo na árvore — só no
       body, o fundo do <html> (visível se a página for mais curta que a
       janela) continuaria escuro. */
    var ecoToggle = win.document.getElementById('rp-eco-toggle');
    if (ecoToggle) ecoToggle.addEventListener('change', function () {
      win.document.documentElement.classList.toggle('rp-eco', ecoToggle.checked);
      win.document.body.classList.toggle('rp-eco', ecoToggle.checked);
    });
    return win;
  }

  function imprimirRoteiroDia(tituloContexto, dia, atividadesTopo, todasAtividades, resultadoEsperadoTurma) {
    todasAtividades = todasAtividades || atividadesTopo;
    var geradoEm = new Date().toLocaleString('pt-BR');
    var grupos = agruparPorSessao(atividadesTopo, todasAtividades);
    if (!grupos.length) grupos.push({ nome: '', atividades: [] });
    var corpo = '<h1>' + esc(tituloContexto) + (dia.titulo ? ' — ' + esc(dia.titulo) : '') + '</h1>' +
      '<div class="rp-meta">Gerado em ' + esc(geradoEm) + '</div>';
    /* Só aparece quando impresso a partir do Roteiro DA TURMA — o
       Roteiro-base (evento inteiro) não chama esta função com esse
       parâmetro, porque "Resultado esperado" é um campo da turma
       (⋯ → Editar Turma), não do evento. */
    var resultadoTurmaHtml = blocoTextoImpressaoHtml(resultadoEsperadoTurma);
    if (resultadoTurmaHtml) corpo += '<div class="rp-campo rp-campo-turma"><strong>Resultado esperado da turma</strong><div class="rp-campo-txt">' + resultadoTurmaHtml + '</div></div>';

    var resumosPorGrupo = grupos.map(function (g) { return calcularResumoDia(g.atividades, todasAtividades); });
    if (grupos.length > 1) corpo += resumoSessoesImpressaoHtml(grupos, resumosPorGrupo);

    grupos.forEach(function (grupo, gi) {
      var resumo = resumosPorGrupo[gi];
      if (grupos.length > 1) corpo += '<div class="rp-sessao-hdr">' + esc(grupo.nome || 'Sem sessão definida') + '</div>';
      corpo += resumoImpressaoHtml(resumo, grupos.length > 1);
      var linhasHtml = '';
      grupo.atividades.forEach(function (a, i) {
        var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
        /* Alterna sombreado por ATIVIDADE (ela + todas as suas sub-etapas
           compartilham a mesma faixa) — deixa visualmente óbvio onde um
           bloco de atividade termina e o próximo começa, sem precisar
           abrir/fechar uma caixa por grupo dentro de uma tabela. */
        var classeGrupo = 'rp-grupo-' + (i % 2 === 0 ? 'a' : 'b');
        if (gapAntes) linhasHtml += '<tr class="rp-gap"><td colspan="5">⚠ Lacuna: ' + esc(minParaHhmm(gapAntes.inicioMin)) + '–' + esc(minParaHhmm(gapAntes.fimMin)) + ' (' + esc(fmtDuracao(gapAntes.min)) + ')</td></tr>';
        var horario = (a.horaInicio || '—') + (a.horaFim ? '–' + a.horaFim : '');
        linhasHtml += '<tr class="rp-grupo-inicio ' + classeGrupo + '"><td>' + (i + 1) + '</td><td>' + esc(horario) + '</td><td>' + esc(a.titulo) + '</td><td>' + esc(a.tipo || '') + '</td><td>' + esc(fmtDuracao(duracaoEfetiva(a, todasAtividades))) + '</td></tr>';
        filhosDe(todasAtividades, a.key).forEach(function (sub, j) {
          var horarioSub = sub.horaInicio ? ((sub.horaInicio || '—') + (sub.horaFim ? '–' + sub.horaFim : '')) : '';
          linhasHtml += '<tr class="rp-sub ' + classeGrupo + '"><td>' + (i + 1) + '.' + (j + 1) + '</td><td>' + esc(horarioSub) + '</td><td>↳ ' + esc(sub.titulo) + '</td><td>' + esc(sub.tipo || '') + '</td><td>' + esc(fmtDuracao(duracaoEfetiva(sub, todasAtividades))) + '</td></tr>';
        });
      });
      corpo += '<table><thead><tr><th class="rp-col-num">#</th><th class="rp-col-horario">Horário</th><th>Atividade</th><th class="rp-col-tipo">Tipo</th><th class="rp-col-duracao">Duração</th></tr></thead>' +
        '<tbody>' + linhasHtml + '</tbody></table>';
    });

    abrirJanelaImpressao(
      tituloContexto + (dia.titulo ? ' — ' + dia.titulo : ''),
      'table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:.82rem;margin-bottom:20px;background:var(--ppanel2);border:1px solid var(--plines);color:var(--pink2);}' +
      'th,td{border-bottom:1px solid var(--pline);padding:8px 10px;text-align:left;overflow-wrap:break-word;}' +
      '.rp-col-num{width:42px;}.rp-col-horario{width:96px;}.rp-col-tipo{width:140px;}.rp-col-duracao{width:84px;}' +
      'tr:last-child td{border-bottom:none;}' +
      'th{background:var(--ppanel);color:var(--pink3);font-family:"Oswald",Arial,sans-serif;text-transform:uppercase;font-size:.66rem;letter-spacing:.06em;font-weight:600;}' +
      '.rp-grupo-b td{background:rgba(255,255,255,.065);}' +
      '.rp-grupo-inicio td{border-top:2px solid rgba(245,197,24,.4);}' +
      'tbody tr.rp-grupo-inicio:first-child td{border-top:none;}' +
      '.rp-gap td{background:rgba(255,138,92,.14);color:#ffb37e;font-style:italic;}' +
      '.rp-sub td:first-child{color:var(--pink3);}' +
      '.rp-sub td:nth-child(3){padding-left:22px;color:var(--pink2);}' +
      'tr{page-break-inside:avoid;break-inside:avoid-page;}' +
      '.rp-campo-turma{background:var(--ppanel2);border:1px solid var(--plines);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:.85rem;color:var(--pink2);}' +
      '.rp-campo-turma > strong{display:block;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--pgold);margin-bottom:4px;font-family:"Oswald",Arial,sans-serif;}' +
      '.rp-campo-turma .rp-campo-txt{margin:0;}' +
      '.rp-campo-turma .rp-campo-txt div, .rp-campo-turma .rp-campo-txt p{margin:0 0 4px;}' +
      '.rp-campo-turma .rp-campo-txt div:last-child, .rp-campo-turma .rp-campo-txt p:last-child{margin-bottom:0;}' +
      '.rp-campo-turma .rp-campo-txt ul, .rp-campo-turma .rp-campo-txt ol{margin:2px 0 4px 20px;padding:0;}' +
      '.rp-campo-turma .rp-campo-txt li{margin:0 0 2px;}',
      corpo
    );
  }

  /* "Agenda + Objetivos": mesma tabela enxuta da Agenda resumida (uma
     linha por atividade/sub-etapa, sem o restante dos campos internos
     do Roteiro completo), mas com uma linha extra logo abaixo de cada
     atividade trazendo só Objetivo e Resultado esperado — pensada pra
     quem precisa entender O QUE cada etapa entrega, sem abrir o
     Roteiro completo (todos os campos) nem ficar só na tabela crua.
     Atividade sem os dois campos vazios não ganha linha extra nenhuma
     (mesma regra de "nunca mostra rótulo vazio" das outras exportações);
     usa o mesmo intérprete de Markdown do Roteiro completo (campos
     migrados em Markdown puro saem formatados aqui também). */
  function detalheObjetivoResultadoHtml(a, classeGrupo) {
    var objetivo = blocoTextoImpressaoHtml(a.objetivo);
    var resultado = blocoTextoImpressaoHtml(a.resultadoEsperado);
    if (!objetivo && !resultado) return '';
    var campos = '';
    if (objetivo) campos += '<div class="rp-campo"><strong>Objetivo</strong><div class="rp-campo-txt">' + objetivo + '</div></div>';
    if (resultado) campos += '<div class="rp-campo"><strong>Resultado esperado</strong><div class="rp-campo-txt">' + resultado + '</div></div>';
    return '<tr class="rp-detalhe ' + classeGrupo + '"><td colspan="5">' + campos + '</td></tr>';
  }

  function imprimirRoteiroAgendaObjetivos(tituloContexto, dia, atividadesTopo, todasAtividades) {
    todasAtividades = todasAtividades || atividadesTopo;
    var geradoEm = new Date().toLocaleString('pt-BR');
    var grupos = agruparPorSessao(atividadesTopo, todasAtividades);
    if (!grupos.length) grupos.push({ nome: '', atividades: [] });
    var corpo = '<h1>' + esc(tituloContexto) + (dia.titulo ? ' — ' + esc(dia.titulo) : '') + '</h1>' +
      '<div class="rp-meta">Agenda com objetivo e resultado esperado de cada etapa · Gerado em ' + esc(geradoEm) + '</div>';

    var resumosPorGrupo = grupos.map(function (g) { return calcularResumoDia(g.atividades, todasAtividades); });
    if (grupos.length > 1) corpo += resumoSessoesImpressaoHtml(grupos, resumosPorGrupo);

    grupos.forEach(function (grupo, gi) {
      var resumo = resumosPorGrupo[gi];
      if (grupos.length > 1) corpo += '<div class="rp-sessao-hdr">' + esc(grupo.nome || 'Sem sessão definida') + '</div>';
      corpo += resumoImpressaoHtml(resumo, grupos.length > 1);
      var linhasHtml = '';
      grupo.atividades.forEach(function (a, i) {
        var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
        /* Mesma faixa alternada por atividade (ela + sub-etapas) da
           Agenda resumida — deixa óbvio onde um bloco de atividade
           termina e o próximo começa. */
        var classeGrupo = 'rp-grupo-' + (i % 2 === 0 ? 'a' : 'b');
        if (gapAntes) linhasHtml += '<tr class="rp-gap"><td colspan="5">⚠ Lacuna: ' + esc(minParaHhmm(gapAntes.inicioMin)) + '–' + esc(minParaHhmm(gapAntes.fimMin)) + ' (' + esc(fmtDuracao(gapAntes.min)) + ')</td></tr>';
        var horario = (a.horaInicio || '—') + (a.horaFim ? '–' + a.horaFim : '');
        linhasHtml += '<tr class="rp-grupo-inicio ' + classeGrupo + '"><td>' + (i + 1) + '</td><td>' + esc(horario) + '</td><td>' + esc(a.titulo) + '</td><td>' + esc(a.tipo || '') + '</td><td>' + esc(fmtDuracao(duracaoEfetiva(a, todasAtividades))) + '</td></tr>';
        linhasHtml += detalheObjetivoResultadoHtml(a, classeGrupo);
        filhosDe(todasAtividades, a.key).forEach(function (sub, j) {
          var horarioSub = sub.horaInicio ? ((sub.horaInicio || '—') + (sub.horaFim ? '–' + sub.horaFim : '')) : '';
          linhasHtml += '<tr class="rp-sub ' + classeGrupo + '"><td>' + (i + 1) + '.' + (j + 1) + '</td><td>' + esc(horarioSub) + '</td><td>↳ ' + esc(sub.titulo) + '</td><td>' + esc(sub.tipo || '') + '</td><td>' + esc(fmtDuracao(duracaoEfetiva(sub, todasAtividades))) + '</td></tr>';
          linhasHtml += detalheObjetivoResultadoHtml(sub, classeGrupo);
        });
      });
      corpo += '<table><thead><tr><th class="rp-col-num">#</th><th class="rp-col-horario">Horário</th><th>Atividade</th><th class="rp-col-tipo">Tipo</th><th class="rp-col-duracao">Duração</th></tr></thead>' +
        '<tbody>' + linhasHtml + '</tbody></table>';
    });

    abrirJanelaImpressao(
      tituloContexto + (dia.titulo ? ' — ' + dia.titulo : ''),
      'table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:.82rem;margin-bottom:20px;background:var(--ppanel2);border:1px solid var(--plines);color:var(--pink2);}' +
      'th,td{border-bottom:1px solid var(--pline);padding:8px 10px;text-align:left;overflow-wrap:break-word;}' +
      '.rp-col-num{width:42px;}.rp-col-horario{width:96px;}.rp-col-tipo{width:140px;}.rp-col-duracao{width:84px;}' +
      'tr:last-child td{border-bottom:none;}' +
      'th{background:var(--ppanel);color:var(--pink3);font-family:"Oswald",Arial,sans-serif;text-transform:uppercase;font-size:.66rem;letter-spacing:.06em;font-weight:600;}' +
      '.rp-grupo-b td{background:rgba(255,255,255,.065);}' +
      '.rp-grupo-inicio td{border-top:2px solid rgba(245,197,24,.4);}' +
      'tbody tr.rp-grupo-inicio:first-child td{border-top:none;}' +
      '.rp-gap td{background:rgba(255,138,92,.14);color:#ffb37e;font-style:italic;}' +
      '.rp-sub td:first-child{color:var(--pink3);}' +
      '.rp-sub td:nth-child(3){padding-left:22px;color:var(--pink2);}' +
      'tr{page-break-inside:avoid;break-inside:avoid-page;}' +
      /* Sem esse "auto" aqui, a linha de detalhe herdaria o avoid-break
         geral acima — inofensivo pras linhas curtas da tabela, mas um
         Objetivo/Resultado esperado mais longo é um bloco que PODE
         crescer, e travar a quebra nele é exatamente o padrão que já
         causou página quase vazia noutra exportação (ver correção em
         .rp-contexto, mais acima neste arquivo). */
      '.rp-detalhe{page-break-inside:auto;break-inside:auto;}' +
      '.rp-detalhe td{background:rgba(255,255,255,.03);}' +
      '.rp-detalhe .rp-campo{margin:4px 0;font-size:.8rem;color:var(--pink2);}' +
      '.rp-detalhe .rp-campo:last-child{margin-bottom:0;}' +
      '.rp-detalhe .rp-campo > strong{display:block;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--pgold);margin-bottom:2px;font-family:"Oswald",Arial,sans-serif;}' +
      '.rp-detalhe .rp-campo-txt{margin:0;}' +
      '.rp-detalhe .rp-campo-txt div, .rp-detalhe .rp-campo-txt p{margin:0 0 3px;}' +
      '.rp-detalhe .rp-campo-txt div:last-child, .rp-detalhe .rp-campo-txt p:last-child{margin-bottom:0;}' +
      '.rp-detalhe .rp-campo-txt ul, .rp-detalhe .rp-campo-txt ol{margin:2px 0 4px 18px;padding:0;}' +
      '.rp-detalhe .rp-campo-txt li{margin:0 0 2px;}',
      corpo
    );
  }

  /* ---- Renderização de Markdown literal SÓ no PDF ------------------
     Alguns campos de texto vieram de migração/importação em massa (ver
     RESULTADOS_ESPERADOS_DIRETORES e MIGRACAO_ANTES_DEPOIS acima) e
     guardam sintaxe de Markdown puro como texto normal — "1\. Explique",
     "\*\*palavra\*\*", "\* pergunta" — porque nunca passaram pelo editor
     rico (que gravaria HTML de verdade: <ol>/<strong>/etc). htmlRicoSeguro
     não reconhece essa sintaxe como tag nenhuma, então só escapa e quebra
     linha — e a impressão saía com a sintaxe à mostra. As funções abaixo
     interpretam esse texto exclusivamente para a IMPRESSÃO (nunca leem
     nem gravam nada no banco, nunca tocam htmlRicoSeguro/campoDetalhe —
     o editor e a tela de detalhes continuam mostrando o texto como
     sempre mostraram).

     Um campo pode ser MISTO: parte HTML de verdade (ex: alguém abriu o
     campo no editor rico uma vez, deu um Enter, e isso já basta pra
     gravar um <div>/<br> de verdade ali) e parte ainda Markdown puro
     (o resto do texto migrado, nunca tocado depois) — nesse caso a
     versão anterior via a tag real, concluía "já é HTML" e desistia de
     interpretar Markdown NO CAMPO INTEIRO, deixando a parte migrada
     à mostra. Por isso a análise abaixo roda sempre, em cima do HTML já
     sanitizado por htmlRicoSeguro/htmlRicoItemLista (preserva qualquer
     tag de verdade que já exista) — só o agrupamento em <ol>/<ul> por
     linha é pulado quando o campo já tem uma lista de verdade (produzida
     pelo botão "Lista" do editor), pra não reprocessar por cima dela. */
  function pareceListaRicoImpressao(html) {
    return /<\s*(ul|ol)[\s>]/i.test(html);
  }
  function desfazerEscapesMarkdown(html) {
    /* Quem escreve/exporta Markdown escapa "1\." e "\*" pra EVITAR virar
       lista/negrito sem querer — aqui é o oposto: a pessoa quer mesmo o
       item de lista/o negrito, só a barra invertida não pode aparecer.
       Some com ela antes de qualquer pontuação de marcação, sem checar
       contexto (é só o que os exemplos do pedido cobrem). Seguro rodar
       sobre HTML já sanitizado: nenhuma tag permitida usa barra invertida. */
    return html.replace(/\\([.*_\-#+()[\]`~>])/g, '$1');
  }
  function inlineMarkdownImpressao(html) {
    /* `html` já é seguro (escapado/sanitizado) — por isso o negrito é
       aplicado direto na string, sem re-escapar. O grupo exclui "<"/">"
       pra nunca cruzar a borda de uma tag que já exista ali (ex: um
       <b> que o editor rico já tenha colocado no meio do texto). */
    return html.replace(/\*\*([^*<>]+)\*\*/g, '<strong>$1</strong>');
  }
  /* Item de lista avulso (ex: cada material de "Materiais necessários")
     — só precisa de negrito/desescape, nunca vira sublista. */
  function itemImpressaoHtml(valor) {
    if (!valor) return '';
    return inlineMarkdownImpressao(desfazerEscapesMarkdown(htmlRicoItemLista(valor)));
  }
  /* Converte um bloco de HTML (já sanitizado, com negrito/escapes de
     Markdown já resolvidos) em listas numeradas, bullets, parágrafos e
     sublistas — tanto por indentação de verdade quanto pelo caso comum
     de texto colado sem recuo, onde só a TROCA de marcador (linha
     numerada seguida de linhas com "-"/"*") já indica que aquelas
     linhas pertencem ao item anterior, não à lista principal (ver
     pedido: perguntas do item 9 não podem virar itens 10, 11, 12).
     Cada "linha" vem de dividir o HTML nas bordas de <div>/<p>/<br> —
     mesma técnica já usada em extrairListaRico — então uma formatação
     inline que já exista (<strong>/<i>/<u>...) no meio de uma linha
     sobrevive intacta dentro do texto daquele item/parágrafo. */
  function markdownBlocoImpressaoHtml(html) {
    /* Divide também por "\n" cru (não só tag) — conteúdo migrado em
       massa pode ter ficado com uma quebra de linha de verdade sentada
       ao lado de uma tag real (ex: alguém abriu o campo no editor uma
       vez e formatou só um trecho em negrito, sem tocar no resto), e
       nesse caso o texto puro que sobra fora da tag não vira <br>
       (isso só acontece no ramo "texto puro" de htmlRicoSeguro) — sem
       dividir por "\n" também, aquelas linhas nunca seriam reconhecidas
       como itens de lista. */
    var tokens = html.split(/<div[^>]*>|<\/div>|<br\s*\/?>|<p[^>]*>|<\/p>|\n/i).map(function (frag) {
      if (!frag.replace(/&nbsp;/gi, ' ').trim()) return { blank: true };
      var indentTxt = frag.match(/^[ \t]*/)[0];
      var indent = indentTxt.replace(/\t/g, '    ').length;
      var resto = frag.slice(indentTxt.length);
      var mOl = resto.match(/^(\d+)[.)]\s+([\s\S]*)$/);
      if (mOl) return { indent: indent, tipo: 'ol', num: mOl[1], texto: mOl[2] };
      var mUl = resto.match(/^[-*•]\s+([\s\S]*)$/);
      if (mUl) return { indent: indent, tipo: 'ul', texto: mUl[1] };
      return { indent: indent, tipo: 'p', texto: resto };
    });
    var pos = 0;
    function consumirFluxo(indentMinimo) {
      var partes = [];
      while (pos < tokens.length) {
        var t = tokens[pos];
        if (t.blank) { pos++; continue; }
        if (t.indent < indentMinimo) break;
        if (t.tipo === 'ol' || t.tipo === 'ul') {
          var tipoLista = t.tipo, indentLista = t.indent, primeiroNum = t.num;
          var itens = [];
          while (pos < tokens.length && !tokens[pos].blank && tokens[pos].indent === indentLista && tokens[pos].tipo === tipoLista) {
            var item = tokens[pos]; pos++;
            var htmlItem = item.texto;
            /* sublista por indentação de verdade */
            while (pos < tokens.length && !tokens[pos].blank && tokens[pos].indent > indentLista) {
              htmlItem += consumirFluxo(tokens[pos].indent);
            }
            /* sublista "achatada" (sem recuo, só troca de marcador) */
            while (pos < tokens.length && !tokens[pos].blank && tokens[pos].indent === indentLista &&
                   (tokens[pos].tipo === 'ol' || tokens[pos].tipo === 'ul') && tokens[pos].tipo !== tipoLista) {
              htmlItem += consumirFluxo(indentLista);
            }
            itens.push(tipoLista === 'ol' ? ('<li value="' + esc(item.num) + '">' + htmlItem + '</li>') : ('<li>' + htmlItem + '</li>'));
          }
          partes.push(tipoLista === 'ol'
            ? '<ol start="' + esc(primeiroNum) + '">' + itens.join('') + '</ol>'
            : '<ul>' + itens.join('') + '</ul>');
        } else {
          var linhasPar = [];
          while (pos < tokens.length && !tokens[pos].blank && tokens[pos].tipo === 'p' && tokens[pos].indent >= indentMinimo) {
            linhasPar.push(tokens[pos].texto); pos++;
          }
          partes.push('<p>' + linhasPar.join('<br>') + '</p>');
        }
      }
      return partes.join('');
    }
    return consumirFluxo(0);
  }
  function blocoTextoImpressaoHtml(valor) {
    if (!valor) return '';
    var html = inlineMarkdownImpressao(desfazerEscapesMarkdown(htmlRicoSeguro(valor)));
    return pareceListaRicoImpressao(html) ? html : markdownBlocoImpressaoHtml(html);
  }

  /* Impressão "completa": um bloco por atividade/sub-etapa com todo o
     conteúdo de facilitação preenchido (objetivo, passo a passo etc.) —
     só os campos que de fato têm valor, igual ao corpo expandido do
     roteiro da turma na tela (nunca mostra rótulo de campo vazio). */
  function campoImpressao(label, valor) {
    if (!valor || (Array.isArray(valor) && !valor.length)) return '';
    var conteudo = Array.isArray(valor)
      ? '<ul>' + valor.map(function (l) { return '<li>' + itemImpressaoHtml(l) + '</li>'; }).join('') + '</ul>'
      : '<div class="rp-campo-txt">' + blocoTextoImpressaoHtml(valor) + '</div>';
    return '<div class="rp-campo"><strong>' + esc(label) + '</strong>' + conteudo + '</div>';
  }

  function blocoAtividadeImpressao(a, numeroTxt, todasAtividades, paiTitulo, apenasPassoAPasso) {
    var ehSub = numeroTxt.indexOf('.') !== -1;
    var horario = a.horaInicio ? (a.horaInicio + (a.horaFim ? '–' + a.horaFim : '')) : (ehSub ? '' : '—');
    /* apenasPassoAPasso (usado por imprimirRoteiroPassoAPasso) esconde os
       campos de preparação/reflexão do facilitador (Objetivo, Dicas,
       Conexão com a agilidade, Materiais, Preparação prévia, Observações)
       — pensado pra uma versão mais enxuta pra distribuir/levar impressa
       com só a instrução do que fazer, sem as notas internas. */
    var camposHtml = apenasPassoAPasso
      ? campoImpressao('Passo a passo', a.passoAPasso)
      : campoImpressao('Objetivo', a.objetivo) +
        campoImpressao('Resultado esperado', a.resultadoEsperado) +
        campoImpressao('Passo a passo', a.passoAPasso) +
        campoImpressao('Dicas para o facilitador', a.dicasFacilitador) +
        campoImpressao('Prompt para IA', a.promptIA) +
        campoImpressao('Conexão com a agilidade', a.conexaoAgilidade) +
        campoImpressao('Materiais necessários', a.materiais) +
        campoImpressao('Preparação prévia', a.preparacaoPrevia) +
        campoImpressao('Observações', a.observacoes);
    /* §121: campo sem valor simplesmente não aparece — nunca um aviso de
       "nenhum campo preenchido"; se só título+duração existem, o bloco
       para por aí mesmo. §122: repete o título da seção-mãe em cada
       etapa filha (rp-contexto, com quebra evitada como o h3) pra manter
       o contexto se a impressão cortar a página no meio da seção. */
    return '<div class="rp-atv' + (numeroTxt.indexOf('.') !== -1 ? ' rp-atv-sub' : '') + '">' +
      (paiTitulo ? '<div class="rp-contexto">' + esc(paiTitulo) + ' — continuação</div>' : '') +
      '<h3>' + esc(numeroTxt) + '. ' + esc(a.titulo) + (a.tipo ? ' <span class="rp-tipo">· ' + esc(a.tipo) + '</span>' : '') + '</h3>' +
      '<div class="rp-atv-meta">' + (horario ? esc(horario) + ' · ' : '') + esc(fmtDuracao(duracaoEfetiva(a, todasAtividades))) + '</div>' +
      camposHtml +
      '</div>';
  }

  function imprimirRoteiroCompleto(tituloContexto, dia, atividadesTopo, todasAtividades) {
    todasAtividades = todasAtividades || atividadesTopo;
    var geradoEm = new Date().toLocaleString('pt-BR');
    var grupos = agruparPorSessao(atividadesTopo, todasAtividades);
    if (!grupos.length) grupos.push({ nome: '', atividades: [] });
    var corpo = '<h1>' + esc(tituloContexto) + (dia.titulo ? ' — ' + esc(dia.titulo) : '') + '</h1>' +
      '<div class="rp-meta">Roteiro completo (com os campos preenchidos de cada etapa) · Gerado em ' + esc(geradoEm) + '</div>';

    var resumosPorGrupo = grupos.map(function (g) { return calcularResumoDia(g.atividades, todasAtividades); });
    if (grupos.length > 1) corpo += resumoSessoesImpressaoHtml(grupos, resumosPorGrupo);

    grupos.forEach(function (grupo, gi) {
      var resumo = resumosPorGrupo[gi];
      if (grupos.length > 1) corpo += '<div class="rp-sessao-hdr">' + esc(grupo.nome || 'Sem sessão definida') + '</div>';
      corpo += resumoImpressaoHtml(resumo, grupos.length > 1);
      grupo.atividades.forEach(function (a, i) {
        var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
        if (gapAntes) corpo += '<div class="rp-gap-bloco">⚠ Lacuna: ' + esc(minParaHhmm(gapAntes.inicioMin)) + '–' + esc(minParaHhmm(gapAntes.fimMin)) + ' (' + esc(fmtDuracao(gapAntes.min)) + ' sem atividade programada)</div>';
        corpo += blocoAtividadeImpressao(a, String(i + 1), todasAtividades);
        filhosDe(todasAtividades, a.key).forEach(function (sub, j) {
          corpo += blocoAtividadeImpressao(sub, (i + 1) + '.' + (j + 1), todasAtividades, a.titulo);
        });
      });
    });

    abrirJanelaImpressao(
      tituloContexto + (dia.titulo ? ' — ' + dia.titulo : ''),
      '.rp-atv{padding:14px 18px;margin-bottom:12px;}' +
      '.rp-atv h3{margin:0;font-family:"Oswald",Arial,sans-serif;font-weight:600;font-size:1.05rem;color:var(--pink);page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-atv-sub{margin-left:28px;background:var(--ppanel);border-color:var(--pline);}' +
      '.rp-tipo{font-weight:400;color:var(--pink3);font-size:.82rem;}' +
      '.rp-atv-meta{font-size:.78rem;color:var(--pcyan);margin:4px 0 10px;font-family:"Oswald",Arial,sans-serif;letter-spacing:.02em;page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-campo{margin-bottom:10px;font-size:.85rem;color:var(--pink2);}' +
      /* Seletor de FILHO direto (não descendente qualquer): o rótulo do
         campo ("OBJETIVO" etc.) é o único <strong> filho direto de
         .rp-campo — um **negrito** no meio do texto (agora um <strong>
         de verdade, gerado pela análise de Markdown abaixo) fica dentro
         de .rp-campo-txt, então nunca deveria herdar esse estilo de
         rótulo (maiúsculo, dourado, em bloco); um seletor descendente
         pegaria os dois por igual e quebraria o negrito inline. */
      '.rp-campo > strong{display:block;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--pgold);margin-bottom:3px;font-family:"Oswald",Arial,sans-serif;page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-campo-txt{margin:0;}' +
      '.rp-campo-txt div, .rp-campo-txt p{margin:0 0 4px;}' +
      '.rp-campo-txt div:last-child, .rp-campo-txt p:last-child{margin-bottom:0;}' +
      '.rp-campo-txt blockquote{margin:0 0 4px;}' +
      '.rp-campo-txt ul, .rp-campo-txt ol{margin:2px 0 6px 20px;padding:0;}' +
      '.rp-campo-txt li{margin:0 0 3px;}' +
      '.rp-campo-txt li:last-child{margin-bottom:0;}' +
      '.rp-campo-txt li > ul, .rp-campo-txt li > ol{margin-top:4px;margin-bottom:2px;}' +
      '.rp-campo-txt ul:last-child, .rp-campo-txt ol:last-child{margin-bottom:0;}' +
      '.rp-campo > ul{margin:2px 0 0 18px;padding:0;}' +
      /* SEM page-break-after aqui de propósito: encadeado com o
         page-break-after:avoid de h3+meta logo abaixo, formava um grupo
         "inquebrável" de 3 elementos (contexto+h3+meta) que, quando não
         cabia no espaço restante da página, empurrava o card inteiro
         pra página seguinte — desperdiçando uma área grande da página
         atual mesmo havendo espaço de sobra (bug real, reproduzido e
         medido: cortar só esta trava reduziu o maior vão vazio de ~186px
         pra ~85px num caso de teste com várias sub-etapas curtas em
         sequência). O título da atividade continua sempre colado ao
         horário (h3+meta preservam o avoid-after deles) — só esta linha
         de contexto (sozinha, sem título nem conteúdo) pode ocasionalmente
         ficar separada do próprio h3 quando a quebra é inevitável, o que
         é um efeito colateral bem mais barato que uma página quase vazia. */
      '.rp-contexto{font-size:.72rem;color:var(--pink3);font-style:italic;margin-bottom:4px;}' +
      '.rp-gap-bloco{border:1px dashed rgba(255,138,92,.5);background:rgba(255,138,92,.12);color:#ffb37e;font-style:italic;font-size:.82rem;padding:8px 14px;border-radius:8px;margin-bottom:12px;}',
      corpo
    );
  }

  /* Impressão "passo a passo": igual ao Roteiro completo (mesmo cartão
     por atividade/etapa, mesmo resumo do dia), mas cada bloco mostra só
     o campo "Passo a passo" — sem Objetivo, Dicas para o facilitador,
     Conexão com a agilidade, Materiais, Preparação prévia ou Observações.
     Pensada pra uma versão mais enxuta pra levar impressa ou distribuir
     com um co-facilitador, sem as notas internas de preparo/reflexão. */
  function imprimirRoteiroPassoAPasso(tituloContexto, dia, atividadesTopo, todasAtividades) {
    todasAtividades = todasAtividades || atividadesTopo;
    var geradoEm = new Date().toLocaleString('pt-BR');
    var grupos = agruparPorSessao(atividadesTopo, todasAtividades);
    if (!grupos.length) grupos.push({ nome: '', atividades: [] });
    var corpo = '<h1>' + esc(tituloContexto) + (dia.titulo ? ' — ' + esc(dia.titulo) : '') + '</h1>' +
      '<div class="rp-meta">Roteiro — passo a passo (sem os demais campos internos) · Gerado em ' + esc(geradoEm) + '</div>';

    var resumosPorGrupo = grupos.map(function (g) { return calcularResumoDia(g.atividades, todasAtividades); });
    if (grupos.length > 1) corpo += resumoSessoesImpressaoHtml(grupos, resumosPorGrupo);

    grupos.forEach(function (grupo, gi) {
      var resumo = resumosPorGrupo[gi];
      if (grupos.length > 1) corpo += '<div class="rp-sessao-hdr">' + esc(grupo.nome || 'Sem sessão definida') + '</div>';
      corpo += resumoImpressaoHtml(resumo, grupos.length > 1);
      grupo.atividades.forEach(function (a, i) {
        var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
        if (gapAntes) corpo += '<div class="rp-gap-bloco">⚠ Lacuna: ' + esc(minParaHhmm(gapAntes.inicioMin)) + '–' + esc(minParaHhmm(gapAntes.fimMin)) + ' (' + esc(fmtDuracao(gapAntes.min)) + ' sem atividade programada)</div>';
        corpo += blocoAtividadeImpressao(a, String(i + 1), todasAtividades, null, true);
        filhosDe(todasAtividades, a.key).forEach(function (sub, j) {
          corpo += blocoAtividadeImpressao(sub, (i + 1) + '.' + (j + 1), todasAtividades, a.titulo, true);
        });
      });
    });

    abrirJanelaImpressao(
      tituloContexto + (dia.titulo ? ' — ' + dia.titulo : ''),
      '.rp-atv{padding:14px 18px;margin-bottom:12px;}' +
      '.rp-atv h3{margin:0;font-family:"Oswald",Arial,sans-serif;font-weight:600;font-size:1.05rem;color:var(--pink);page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-atv-sub{margin-left:28px;background:var(--ppanel);border-color:var(--pline);}' +
      '.rp-tipo{font-weight:400;color:var(--pink3);font-size:.82rem;}' +
      '.rp-atv-meta{font-size:.78rem;color:var(--pcyan);margin:4px 0 10px;font-family:"Oswald",Arial,sans-serif;letter-spacing:.02em;page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-campo{margin-bottom:10px;font-size:.85rem;color:var(--pink2);}' +
      /* Seletor de FILHO direto (não descendente qualquer): o rótulo do
         campo ("OBJETIVO" etc.) é o único <strong> filho direto de
         .rp-campo — um **negrito** no meio do texto (agora um <strong>
         de verdade, gerado pela análise de Markdown abaixo) fica dentro
         de .rp-campo-txt, então nunca deveria herdar esse estilo de
         rótulo (maiúsculo, dourado, em bloco); um seletor descendente
         pegaria os dois por igual e quebraria o negrito inline. */
      '.rp-campo > strong{display:block;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--pgold);margin-bottom:3px;font-family:"Oswald",Arial,sans-serif;page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-campo-txt{margin:0;}' +
      '.rp-campo-txt div, .rp-campo-txt p{margin:0 0 4px;}' +
      '.rp-campo-txt div:last-child, .rp-campo-txt p:last-child{margin-bottom:0;}' +
      '.rp-campo-txt blockquote{margin:0 0 4px;}' +
      '.rp-campo-txt ul, .rp-campo-txt ol{margin:2px 0 6px 20px;padding:0;}' +
      '.rp-campo-txt li{margin:0 0 3px;}' +
      '.rp-campo-txt li:last-child{margin-bottom:0;}' +
      '.rp-campo-txt li > ul, .rp-campo-txt li > ol{margin-top:4px;margin-bottom:2px;}' +
      '.rp-campo-txt ul:last-child, .rp-campo-txt ol:last-child{margin-bottom:0;}' +
      '.rp-campo > ul{margin:2px 0 0 18px;padding:0;}' +
      /* SEM page-break-after aqui de propósito: encadeado com o
         page-break-after:avoid de h3+meta logo abaixo, formava um grupo
         "inquebrável" de 3 elementos (contexto+h3+meta) que, quando não
         cabia no espaço restante da página, empurrava o card inteiro
         pra página seguinte — desperdiçando uma área grande da página
         atual mesmo havendo espaço de sobra (bug real, reproduzido e
         medido: cortar só esta trava reduziu o maior vão vazio de ~186px
         pra ~85px num caso de teste com várias sub-etapas curtas em
         sequência). O título da atividade continua sempre colado ao
         horário (h3+meta preservam o avoid-after deles) — só esta linha
         de contexto (sozinha, sem título nem conteúdo) pode ocasionalmente
         ficar separada do próprio h3 quando a quebra é inevitável, o que
         é um efeito colateral bem mais barato que uma página quase vazia. */
      '.rp-contexto{font-size:.72rem;color:var(--pink3);font-style:italic;margin-bottom:4px;}' +
      '.rp-gap-bloco{border:1px dashed rgba(255,138,92,.5);background:rgba(255,138,92,.12);color:#ffb37e;font-style:italic;font-size:.82rem;padding:8px 14px;border-radius:8px;margin-bottom:12px;}',
      corpo
    );
  }

  /* ══════════════════════════════════════════════════════════════
     UI — roteiro-base do evento (editor completo, só admin)
     ══════════════════════════════════════════════════════════════ */

  var _secoesRecolhidas = {}; /* { [atividadeKey]: true } — estado de UI, sobrevive a redesenhos */

  function colunasHeaderHtml() {
    return '<div style="display:flex;align-items:center;gap:10px;padding:4px 14px;font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)">' +
      '<span style="width:26px">#</span><span style="min-width:96px">Horário</span><span style="flex:1">Atividade</span>' +
      '<span style="width:120px">Tipo</span><span style="width:64px">Duração</span><span style="margin-left:auto">Ações</span></div>';
  }

  /* Importação pontual dos "Resultado esperado" do roteiro-base "FORÇA
     ÁGIL - DIRETORES" (pedido único, 31 atividades incluindo
     sub-etapas — Manhã + Tarde). Casamento por título exato: nunca
     sobrescreve nada além do campo resultadoEsperado, nunca adivinha
     quando o título não bate com nenhuma atividade ou bate com mais de
     uma. O botão que aciona isso (em renderRoteiroBaseEditor) só
     aparece nos roteiros que já têm a atividade-âncora abaixo — não
     polui o editor de nenhum outro evento. */
  var RESULTADOS_ESPERADOS_DIRETORES_ANCORA = 'EPISÓDIO FINAL — O COMPROMISSO DA LIDERANÇA';
  var RESULTADOS_ESPERADOS_DIRETORES = [
    { titulo: 'ABERTURA', resultado: 'Participantes imersos na missão, conscientes de seu papel como Conselho e preparados para tomar decisões ao longo da experiência.' },
    { titulo: 'Imersão no Storytelling', resultado: 'Participantes entram na narrativa da missão e compreendem, de forma implícita, que existe um propósito claro sem que todo o caminho seja conhecido antecipadamente.' },
    { titulo: 'Entrando no modo Missão', resultado: 'Participantes deixam as distrações de lado, direcionam a atenção para a experiência e entram na missão mais disponíveis para observar sinais antes de reagir.' },
    { titulo: 'Instruções Iniciais', resultado: 'Participantes compreendem a missão, as regras, as restrições e sua autonomia para decidir, sem receber antecipadamente a explicação dos conceitos que serão vivenciados.' },
    { titulo: 'DESAFIO 1: ESCOLHAM', resultado: '8 iniciativas priorizadas pelo Conselho, cada uma ocupando 1 Cristal de Capacidade.' },
    { titulo: 'CONGELAR O PLANO', resultado: 'Plano inicial registrado em FAREMOS/NÃO FAREMOS e nível de confiança declarado pelo Conselho.' },
    { titulo: 'DESAFIO 2: O MUNDO MUDA', resultado: 'Plano final consolidado após os sinais da realidade, com as mudanças realizadas visíveis e comparáveis ao plano inicial.' },
    { titulo: 'Apresentação do desafio', resultado: 'Conselho preparado para receber novas informações e decidir com base no que sabe naquele momento, sem antecipar o propósito das transmissões.' },
    { titulo: 'Transmissão da Missão 1 — Sinal da Realidade', resultado: 'Decisão do Conselho após o primeiro sinal registrada: manter as escolhas ou trocar de 0 a 2 iniciativas, com justificativa baseada na nova informação.' },
    { titulo: 'Transmissão da Missão 2 — Sinal da Realidade', resultado: 'Decisão do Conselho após o segundo sinal registrada, evidenciando se a nova informação foi suficiente para manter ou rever alguma aposta.' },
    { titulo: 'Transmissão da Missão 3 — Sinal da Realidade', resultado: 'Decisão do Conselho após o terceiro sinal registrada, tornando visível o impacto de prazo, dependências e risco sobre as apostas escolhidas.' },
    { titulo: 'Transmissão da Missão 4 — Sinal da Realidade', resultado: 'Conselho decide o que vale testar em pequena escala diante da nova possibilidade, sem receber uma solução pronta.' },
    { titulo: 'Consolidação das escolhas e transição para a reflexão', resultado: 'Plano final do Conselho registrado e visualmente comparável ao plano inicial, com o histórico das principais mudanças preservado para a reflexão.' },
    { titulo: 'A PRIMEIRA REFLEXÃO', resultado: 'Grupo identifica como as informações disponíveis influenciaram suas decisões e reconhece o que sustentou a manutenção ou revisão das apostas.' },
    { titulo: 'A BOMBA', resultado: 'Grupo diferencia o resultado que deseja produzir das iniciativas escolhidas e percebe que soluções são apostas, não o compromisso final.' },
    { titulo: 'DESAFIO 3: PAREM DE PENSAR EM PROJETOS', resultado: 'Uma aposta pequena e testável estruturada em Problema, Hipótese, Experimento e Evidência.' },
    { titulo: 'O MOMENTO DE IMPACTO', resultado: 'Participantes explicitam o que gerou segurança durante a experiência e reconhecem o valor de aprender e reduzir incerteza antes de aumentar o investimento.' },
    { titulo: 'AGORA DÊ NOME AO QUE ELES FIZERAM', resultado: 'Participantes reconhecem e nomeiam, a partir da própria experiência, os elementos de mentalidade ágil que utilizaram: foco, priorização, feedback, adaptação, experimentação, evidência, redução de risco e orientação a resultado.' },
    { titulo: 'CONVERSA EXECUTIVA', resultado: 'Pelo menos uma conexão concreta entre a experiência vivida e uma situação real da organização em que seja possível aprender antes de ampliar uma aposta.' },
    { titulo: 'ENCERRAMENTO DO EPISÓDIO I', resultado: 'Grupo encerra a manhã com uma síntese da mentalidade ágil vivenciada e curiosidade sobre como um copiloto de IA pode ampliar a análise sem assumir a decisão.' },
    { titulo: 'RETOMADA', resultado: 'Grupo retoma os aprendizados da manhã, reconecta-se ao ciclo Problema → Hipótese → Experimento → Evidência → Decisão e compreende a IA como copiloto, não piloto.' },
    { titulo: 'DECISÃO SEM IA', resultado: 'Decisões individuais registradas e uma única APOSTA-BASE DO CONSELHO definida antes de qualquer influência da IA.' },
    { titulo: 'FORMAR 3 DUPLAS', resultado: 'Três duplas formadas, todas alinhadas sobre a mesma aposta-base e conscientes da lente específica que utilizarão na análise.' },
    { titulo: 'PRIMEIRO USO DA IA', resultado: 'Três análises complementares da mesma aposta-base produzidas com IA: uma para defender, uma para desafiar e uma para investigar o que ainda não sabemos.' },
    { titulo: 'AGORA VAMOS DESCONFIAR DA IA', resultado: 'Pelo menos três afirmações, conclusões, riscos ou hipóteses da IA classificados criticamente como VERDE, AMARELO ou VERMELHO com justificativa.' },
    { titulo: 'REUNIÃO DO CONSELHO', resultado: 'Uma APOSTA FINAL DO CONSELHO registrada após considerar argumentos favoráveis, riscos, desconhecidos e limites das análises produzidas com IA.' },
    { titulo: 'O TESTE DA APOSTA', resultado: 'A aposta final é testada pelo Conselho contra problema, evidências, suposições, menor forma de testar e critérios que indicariam manter, ajustar ou abandonar a decisão.' },
    { titulo: 'FAÇA A COMPARAÇÃO', resultado: 'Grupo compara a aposta-base sem IA com a aposta final e identifica claramente o que mudou, o que permaneceu, o que a IA ajudou a enxergar e o que ainda precisa ser verificado.' },
    { titulo: 'A VIRADA PARA A LIDERANÇA', resultado: 'Diretores conectam o aprendizado da dinâmica às próprias decisões de liderança e identificam perguntas adicionais sobre problema, evidência, aprendizado, risco e resultado.' },
    { titulo: 'FECHAMENTO INDIVIDUAL', resultado: 'Cada diretor registra uma mudança concreta de comportamento: algo que fará menos, algo que passará a fazer e uma ação que pode começar imediatamente.' },
    { titulo: RESULTADOS_ESPERADOS_DIRETORES_ANCORA, resultado: 'Declaração coletiva do Conselho registrada sobre como a liderança pretende lidar com incerteza, evidências, aprendizado, adaptação e responsabilidade pelas decisões.' }
  ];
  function importarResultadosEsperadosDiretores(eventoKey, atividades, cb) {
    var porTitulo = {};
    atividades.forEach(function (a) {
      var t = (a.titulo || '').trim();
      (porTitulo[t] = porTitulo[t] || []).push(a);
    });
    var atualizados = 0, naoEncontrados = [], duplicados = [];
    var pendentes = RESULTADOS_ESPERADOS_DIRETORES.length;
    function fim() { cb({ atualizados: atualizados, naoEncontrados: naoEncontrados, duplicados: duplicados }); }
    RESULTADOS_ESPERADOS_DIRETORES.forEach(function (item) {
      var lista = porTitulo[item.titulo] || [];
      if (!lista.length) { naoEncontrados.push(item.titulo); if (!--pendentes) fim(); return; }
      if (lista.length > 1) { duplicados.push(item.titulo); if (!--pendentes) fim(); return; }
      editarAtividade(eventoKey, lista[0].key, { resultadoEsperado: item.resultado }, function (err) {
        if (!err) atualizados++;
        if (!--pendentes) fim();
      });
    });
  }

  /* ── Migração de conteúdo "Antes x Depois" (planilha ver5.pdf) — 2ª
     leva de ajustes na DIRETORES: textos revisados de Passo a passo,
     Dicas, Observações e Conexão com a mentalidade ágil, o Prompt para
     IA da "Primeiro uso da IA" e duas mudanças de Tipo. Mesmo botão-
     âncora das outras migrações pontuais (só aparece na DIRETORES).

     Nunca escreve sem antes comparar o valor ATUAL de cada campo com o
     "de" esperado: só grava quando bate; se já bater com o "para",
     conta como já feito; se for outra coisa, ou a atividade não for
     encontrada (ou for encontrada mais de uma vez), a linha fica de
     fora e aparece no relatório — nunca "parecido o suficiente". Um
     DRY RUN roda sempre primeiro (só leitura); "Aplicar" grava só as
     linhas com status OK e guarda o valor anterior de cada campo
     tocado num nó de backup, pra dar pra desfazer depois. */
  var MIGRACAO_ANTES_DEPOIS = [
    { titulo: 'DESAFIO 1: ESCOLHAM', campo: 'passoAPasso', acao: 'substituir',
      de: 'Diga: “Vocês têm 8 minutos. Precisam sair daqui com oito escolhas.”',
      para: 'Diga: “Vocês têm 6 minutos. Precisam sair daqui com oito escolhas.”\n\nUse aproximadamente 2 minutos do bloco para explicar as regras, distribuir/organizar os materiais e iniciar a contagem.' },
    { titulo: 'DESAFIO 1: ESCOLHAM', campo: 'dicasFacilitador', acao: 'acrescentar_fim',
      para: 'REGRA DOS CRISTAIS DE CAPACIDADE\n\nCada iniciativa em FAREMOS deve permanecer com 1 Cristal de Capacidade. Existem somente 8 Cristais; portanto, só podem existir 8 iniciativas simultaneamente em FAREMOS. Quando uma iniciativa sair, seu Cristal volta a ficar disponível e deve ser transferido para a iniciativa que entrar. Não crie Cristais adicionais durante a dinâmica.' },
    { titulo: 'DESAFIO 2: O MUNDO MUDA', campo: 'observacoes', acao: 'acrescentar_fim',
      para: 'DADOS DA SIMULAÇÃO\n\nOs números apresentados nas Transmissões da Missão são dados FICTÍCIOS criados exclusivamente para a dinâmica e não representam indicadores reais da organização, salvo se forem posteriormente substituídos por dados oficialmente validados.' },
    { titulo: 'Transmissão da Missão 3 — Sinal da Realidade', campo: 'dicasFacilitador', acao: 'acrescentar_fim',
      para: 'Antes da oficina, identifique nos 24 cartões quais iniciativas possuem maior dependência tecnológica. Se houver mais de uma entre as escolhidas, utilize aquela cuja dependência seja mais evidente para o grupo. Caso nenhuma das iniciativas escolhidas tenha dependência tecnológica relevante, aplique o sinal à iniciativa escolhida que possua maior dependência externa.' },
    { titulo: 'Consolidação das escolhas e transição para a reflexão', campo: 'passoAPasso', acao: 'substituir',
      de: 'Se houver alteração final permitida pela dinâmica, dê alguns segundos para fazê-la. Se não houver, apenas confirme o plano.',
      para: 'A partir daqui não há nova rodada de troca. Apenas confirme e registre o plano final do Conselho. Deixe fisicamente visíveis o plano inicial e o plano final para a reflexão seguinte.' },
    { titulo: 'A PRIMEIRA REFLEXÃO', campo: 'passoAPasso', acao: 'substituir',
      de: 'Agora pergunte: “O primeiro plano estava errado?”\n\nDeixe-os falar.\n\nDepois faça uma segunda pergunta: “Ou era a melhor decisão possível diante das informações que tínhamos naquele momento?”',
      para: 'Pergunte: “Com o que vocês sabiam naquele momento, o que sustentava o primeiro plano?”\n\nDepois pergunte: “O que ainda não sabíamos?”\n\nE finalize: “O que fez vocês manterem ou reverem escolhas?”\n\nNão conclua por eles.' },
    { titulo: 'A BOMBA', campo: 'passoAPasso', acao: 'substituir',
      de: 'Mostre um cartão grande: “Vocês não precisam entregar nenhuma das 24 iniciativas.”\n\nDepois complete: “O compromisso era melhorar a experiência do participante.”',
      para: 'Mostre um cartão grande:\n\n“Nenhuma das 24 iniciativas é o compromisso.”\n\nDepois complete:\n\n“O compromisso é melhorar a experiência do participante. As iniciativas são apostas sobre como produzir esse resultado.”\n\nPergunte: “Em que momento transformamos o objetivo em uma lista de projetos?”' },
    { titulo: 'DESAFIO 3: PAREM DE PENSAR EM PROJETOS', campo: 'passoAPasso', acao: 'substituir',
      de: 'Explique cada item rapidamente.\n• Problema: O que está acontecendo com o participante?\n• Hipótese: O que acreditamos que poderia melhorar esse problema?\n• Experimento: Qual é o menor coisa que podemos testar sem construir uma grande solução?\n• Evidência: O que precisamos medir ou observar para decidir se continuamos?\n\nPegue aos seis: “Vocês têm 15 minutos para montar uma única aposta de 30 dias.” Eles precisam preencher um exemplo já muito próximo do caso.',
      para: 'Use aproximadamente 3 minutos para explicar a estrutura:\n• PROBLEMA — o que está acontecendo e para quem?\n• HIPÓTESE — o que acreditamos que pode melhorar esse problema?\n• EXPERIMENTO — qual é o menor teste que pode reduzir nossa incerteza?\n• EVIDÊNCIA — o que vamos observar ou medir para decidir o próximo passo?\n\nDiga: “Vocês terão 10 minutos para construir uma única aposta testável de curto prazo usando os quatro campos. Não copiem uma solução anterior: decidam o que vale testar.”\n\nReserve os 2 minutos finais para consolidar a aposta do grupo.' },
    { titulo: 'O MOMENTO DE IMPACTO', campo: 'passoAPasso', acao: 'substituir',
      de: 'Pergunte: “Em qual momento vocês se sentiram mais seguros: quando terminaram o primeiro plano ou quando perceberam que poderiam aprender antes de investir tudo?”\n\nDepois diga:\n“Talvez a verdadeira segurança não esteja em nunca mudar o plano.”\n“Talvez esteja em construir condições para perceber cedo quando ele precisa mudar.”',
      para: 'Pergunte: “Em qual momento vocês se sentiram mais seguros durante a missão?”\n\nDepois: “O que produziu essa sensação de segurança?”\n\nEscute antes de fazer a conexão.\n\nFeche: “Segurança não precisa vir de conhecer todo o plano. Também pode vir da capacidade de aprender antes de investir demais.”' },
    { titulo: 'AGORA DÊ NOME AO QUE ELES FIZERAM', campo: 'conexaoAgilidade', acao: 'substituir_trecho',
      de: 'Saíram das iniciativas para o problema × Outcome × Output',
      para: 'Separaram o que entregamos do resultado que queremos produzir → Output × Outcome' },
    { titulo: 'CONVERSA EXECUTIVA', campo: 'passoAPasso', acao: 'substituir',
      de: 'Faça apenas estas perguntas:\n1. Em nossa organização, onde fazemos apostas grandes demais antes de aprender?\n2. Onde executamos projetos porque estavam planejados, mesmo quando novas informações sugerem outra direção?\n3. Onde medimos entrega quando deveríamos medir resultado?',
      para: 'PERGUNTA PRINCIPAL\n“Em nossa organização, onde ainda fazemos apostas grandes demais antes de aprender?”\n\nPERGUNTAS DE RESERVA — use apenas se houver tempo:\n• “Onde executamos projetos porque estavam planejados, mesmo quando novas informações sugerem outra direção?”\n• “Onde medimos entrega quando deveríamos medir resultado?”' },
    { titulo: 'DECISÃO SEM IA', campo: 'passoAPasso', acao: 'substituir',
      de: 'Antes de ligarem os notebooks, entregue a cada diretor individualmente uma ficha.\n\nCada um responde sozinho: Considerando o caso da manhã:\n1. Qual problema você atacaria primeiro?\n2. Qual seria sua primeira aposta?\n3. O que você não faria agora?',
      para: 'Antes de ligarem os notebooks, entregue uma ficha a cada diretor.\n\nCada um responde individualmente:\n1. Qual problema devemos atacar primeiro?\n2. Qual seria nossa melhor aposta?\n3. Qual é o maior risco dessa aposta?\n4. O que faríamos agora?\n\nDepois, reúna o Conselho e diga:\n“Antes de usar IA, precisamos registrar uma decisão comum. Qual proposta representa melhor a aposta do Conselho neste momento?”\n\nRegistre em um cartão grande:\nAPOSTA-BASE DO CONSELHO — SEM IA.' },
    { titulo: 'FORMAR 3 DUPLAS', campo: 'passoAPasso', acao: 'substituir',
      de: 'Agora formem:\n• Dupla 1 Diretores A + B\n• Dupla 2 Diretores C + D\n• Dupla 3 Diretores E + F\n\nCada dupla recebe um notebook.',
      para: 'Agora formem:\n• Dupla 1 — Diretores A + B\n• Dupla 2 — Diretores C + D\n• Dupla 3 — Diretores E + F\n\nCada dupla recebe um notebook.\n\nDiga explicitamente:\n“As três duplas trabalharão sobre EXATAMENTE A MESMA APOSTA-BASE definida pelo Conselho sem IA. O que muda é apenas a lente de análise de cada dupla.”' },
    { titulo: 'PRIMEIRO USO DA IA', campo: 'promptIA', acao: 'substituir_vazio',
      para: [
        'CONTEXTO\n\nSomos um Conselho de uma entidade de Previdência Complementar tentando melhorar a experiência do participante durante a concessão de um benefício. Precisamos preservar segurança, conformidade e qualidade.\n\nNossa aposta inicial, definida SEM IA, é:\n\n[APOSTA-BASE DO CONSELHO]\n\nTrabalhe somente com as informações fornecidas. Não invente fatos, números ou evidências. Quando não houver informação suficiente, diga claramente: “NÃO SABEMOS”.\n\nSepare fatos de hipóteses.\n\nNão tome a decisão por nós. Seu papel é melhorar a qualidade da nossa análise.\n\nAgora cumpra exclusivamente a missão específica da sua dupla.',
        'MISSÃO — DUPLA 1: A VOZ QUE DEFENDE\n\nConstrua o melhor argumento possível a favor da aposta-base. Mostre:\n• por que ela pode gerar valor;\n• quais hipóteses precisam ser verdadeiras;\n• quais evidências aumentariam nossa confiança nela.',
        'MISSÃO — DUPLA 2: A VOZ QUE DESAFIA\n\nAtue como crítico da aposta-base. Identifique:\n• riscos;\n• premissas frágeis;\n• consequências indesejadas;\n• pontos cegos;\n• razões pelas quais essa aposta poderia falhar.\n\nNão proponha outra solução ainda.',
        'MISSÃO — DUPLA 3: A VOZ QUE INVESTIGA\n\nInvestigue o que ainda não sabemos sobre a aposta-base. Liste:\n• perguntas críticas;\n• informações que faltam;\n• evidências que deveríamos buscar;\n• pequenos testes que poderiam reduzir a incerteza.'
      ].join('\n\n---\n\n') },
    { titulo: 'PRIMEIRO USO DA IA', campo: 'dicasFacilitador', acao: 'acrescentar_fim',
      para: 'USO SEGURO DA IA\nUtilizem somente o cenário fornecido na dinâmica. Não insiram dados pessoais, informações sigilosas, informações reais de participantes, documentos internos não previstos ou dados corporativos sensíveis.' },
    { titulo: 'AGORA VAMOS DESCONFIAR DA IA', campo: 'passoAPasso', acao: 'substituir',
      de: 'Peça: “Revisem as recomendações da IA.”\n\nVocês precisam classificar pelo menos três delas.\n\nPara cada classificação precisam explicar:\n• VERDE Por que acreditamos?\n• AMARELO Que evidência ainda precisamos?\n• VERMELHO Por que não concordamos?',
      para: 'Peça:\n“Revisem as principais afirmações, conclusões, riscos, hipóteses e perguntas geradas pela IA.”\n\nClassifiquem pelo menos três:\n• VERDE — temos fundamento/evidência suficiente para aceitar provisoriamente.\n• AMARELO — precisamos verificar ou buscar evidência.\n• VERMELHO — não temos fundamento suficiente ou existe razão para rejeitar.\n\nPara cada marcação, expliquem o porquê.' },
    { titulo: 'REUNIÃO DO CONSELHO', campo: 'passoAPasso', acao: 'substituir',
      de: 'Cada dupla tem 3 minutos:\n• Dupla 1 “O melhor argumento a favor é...”\n• Dupla 2 “O maior risco que encontramos é...”\n• Dupla 3 “O principal ponto que ainda não sabemos é...”\n\nDepois pergunte: “Com tudo isso, qual decisão tomaremos?”\n\nEles precisam chegar a uma única aposta.',
      para: 'Agora os notebooks são fechados e as seis pessoas voltam a formar um único Conselho.\n\nCada dupla tem 2 minutos:\n• Dupla 1 — principal argumento a favor;\n• Dupla 2 — principal risco;\n• Dupla 3 — principal desconhecido.\n\nUse os 6 minutos restantes para o Conselho discutir.\n\nPergunte:\n“Com tudo isso, mantemos, ajustamos ou abandonamos nossa aposta?”\n\nRegistre fisicamente:\nAPOSTA FINAL DO CONSELHO.' },
    { titulo: 'O TESTE DA APOSTA', campo: 'passoAPasso', acao: 'acrescentar_inicio',
      para: 'Antes das cinco perguntas, diga:\n“Agora a IA sai de cena. Os notebooks permanecem fechados. Quem responde às próximas perguntas é o Conselho.”' },
    { titulo: 'FAÇA A COMPARAÇÃO', campo: 'passoAPasso', acao: 'substituir',
      de: 'Monte dois caminhos.\n\nMODELO A: IDEIA ↓ PROJETO ↓ ESCOPO ↓ PLANO ↓ EXECUÇÃO ↓ ENTREGA\n\nMODELO B: PROBLEMA ↓ HIPÓTESE ↓ EXPERIMENTO ↓ EVIDÊNCIA ↓ APRENDIZADO ↓ NOVA\n\nPergunte qual modelo funciona melhor em baixa ou alta incerteza.',
      para: 'Primeiro, coloque lado a lado:\nAPOSTA-BASE DO CONSELHO — SEM IA\n×\nAPOSTA FINAL DO CONSELHO — APÓS A ANÁLISE COM IA\n\nPergunte:\n1. O que mudou?\n2. O que permaneceu?\n3. O que a IA nos fez enxergar que não havíamos percebido?\n4. O que a IA afirmou que ainda precisamos verificar?\n5. Nossa decisão ficou melhor ou apenas mais bem argumentada?\n\nFeche mostrando dois caminhos:\nMODELO A: IDEIA → PROJETO → ESCOPO → PLANO → EXECUÇÃO → ENTREGA\nMODELO B: PROBLEMA → HIPÓTESE → EXPERIMENTO → EVIDÊNCIA → APRENDIZADO → NOVA DECISÃO\n\nDiga: “Nenhum dos modelos é universalmente certo ou errado. Quanto maior a incerteza, mais valioso se torna aprender em ciclos menores antes de aumentar o investimento.”' },
    { titulo: 'A VIRADA PARA A LIDERANÇA', campo: 'passoAPasso', acao: 'acrescentar_inicio',
      para: 'Antes de mostrar as duas listas, diga:\n“As perguntas de execução continuam importantes. A liderança ágil não elimina gestão, prazo ou entrega. Ela acrescenta perguntas sobre problema, evidência, aprendizado, risco e resultado — especialmente quando a incerteza é alta.”' },
    { titulo: 'A VIRADA PARA A LIDERANÇA', campo: 'tipo', acao: 'tipo', de: 'Conceituação', para: 'Aplicação à Liderança' },
    { titulo: 'FECHAMENTO INDIVIDUAL', campo: 'tipo', acao: 'tipo', de: 'Reflexão', para: 'Compromisso Individual' }
  ];

  /* ── 3ª leva: "Limpeza final de consistência" da DIRETORES — elimina
     duplicidade do Primeiro uso da IA (o prompt fica só em "Prompt para
     IA", nunca repetido no Passo a passo/Preparação prévia), corrige o
     resto de Output x Outcome que ficou só na Conexão com a mentalidade
     ágil na leva anterior, ajusta a duração insuficiente de "Decisão sem
     IA" (com recálculo em cadeia dos horários seguintes do mesmo dia,
     sem mexer na duração de mais nada), simplifica "Faça a comparação"
     e revê os três conceitos do fechamento final. Mesmo motor de
     dry run/revisão/aplicação/backup da migração acima — só muda a
     LISTA de itens (ver `lista` em dryRunMigracaoAntesDepois/
     abrirModalMigracaoAntesDepois). Três ações novas por causa disso:

     'substituir_campo' — troca o CAMPO INTEIRO (não busca um trecho
     dentro dele) por um valor final definido aqui. Como não existe um
     "de" confiável pra comparar, o item NUNCA vira "OK PARA ALTERAR"
     sozinho: ou já bate com o "para" (JÁ ATUALIZADO), ou cai sempre em
     revisão manual ("VALOR ATUAL DIVERGENTE") — a pessoa decide olhando
     o valor atual de verdade, nunca é sobrescrito às cegas.

     'duracao' — muda `duracaoMinutos` de uma atividade de nível
     principal e recalcula o horário final dela e o horário de INÍCIO
     (e fim) das atividades seguintes do mesmo dia que tiverem horário
     próprio, deslocando todas pela mesma diferença — nunca mexe na
     DURAÇÃO de nenhuma outra atividade. O recálculo já aparece no dry
     run antes de aplicar qualquer coisa.

     tituloQualquer:true — pra itens de fechamento cujo título exato/
     campo não foi informado: procura o trecho "de" em QUALQUER
     atividade, dentro de um conjunto fixo de campos de texto (nunca no
     Prompt para IA, que é preservado à parte). Só uma atividade/campo
     bate com exatamente 1 ocorrência → "OK PARA ALTERAR" automático;
     nenhum lugar bate → "TRECHO NÃO LOCALIZADO" (ou "JÁ ATUALIZADO" se
     o "para" já aparece em algum lugar); mais de um lugar bate → fica
     como pendência pra resolver manualmente, o sistema nunca escolhe
     sozinho entre vários lugares possíveis. */
  var CAMPOS_BUSCA_AMPLA_MIGRACAO = ['passoAPasso', 'dicasFacilitador', 'observacoes', 'conexaoAgilidade', 'preparacaoPrevia'];
  var MIGRACAO_LIMPEZA_FINAL = [
    { titulo: 'PRIMEIRO USO DA IA', campo: 'passoAPasso', acao: 'substituir_campo',
      para: 'Todas as duplas recebem o mesmo contexto e trabalham sobre a mesma APOSTA-BASE DO CONSELHO.\n\nCada dupla recebe uma lente diferente:\n\n• Dupla 1 — DEFENDER: construir o melhor argumento a favor da aposta-base.\n\n• Dupla 2 — DESAFIAR: identificar riscos, premissas frágeis, consequências indesejadas e pontos cegos.\n\n• Dupla 3 — INVESTIGAR: identificar o que ainda não sabemos, quais evidências precisamos buscar e quais pequenos testes podem reduzir a incerteza.\n\nCada dupla utiliza o PROMPT PARA IA definido nesta atividade.' },
    { titulo: 'PRIMEIRO USO DA IA', campo: 'preparacaoPrevia', acao: 'substituir_campo',
      para: 'Imprimir ou deixar previamente disponíveis:\n\n• o Prompt-base da atividade;\n• a missão da Dupla 1 — Defender;\n• a missão da Dupla 2 — Desafiar;\n• a missão da Dupla 3 — Investigar.\n\nLevar também uma resposta pré-gerada para cada missão como plano de contingência caso haja indisponibilidade de internet ou da ferramenta de IA.' },
    { titulo: 'PRIMEIRO USO DA IA', campo: 'dicasFacilitador', acao: 'substituir',
      de: 'Isso torna a atividade muito melhor do que três duplas simplesmente perguntarem a mesma coisa.',
      para: 'POR QUE ESTA ATIVIDADE EXISTE\n\nAs três lentes permitem analisar a mesma aposta sob perspectivas complementares: valor potencial, risco e desconhecidos.\n\nA IA amplia a análise, mas não toma a decisão pelo Conselho.' },
    { titulo: 'AGORA DÊ NOME AO QUE ELES FIZERAM', campo: 'passoAPasso', acao: 'substituir',
      de: 'Saíram das iniciativas para o problema × Outcome × Output',
      para: 'Separaram o que entregamos do resultado que queremos produzir → Output × Outcome' },
    { titulo: 'Apresentação do desafio', campo: 'dicasFacilitador', acao: 'substituir_campo',
      para: 'EVITE DIZER:\n\n“Agora o mundo vai mudar e vocês precisarão adaptar o plano.”\n\nNão antecipe a conclusão da experiência.\n\nA intenção é permitir que o grupo perceba a necessidade de adaptação a partir dos sinais recebidos.' },
    { titulo: 'DECISÃO SEM IA', campo: 'duracaoMinutos', acao: 'duracao', deMinutos: 5, paraMinutos: 8 },
    { titulo: 'DECISÃO SEM IA', campo: 'dicasFacilitador', acao: 'acrescentar_fim',
      para: 'DISTRIBUIÇÃO SUGERIDA DO TEMPO (8 min)\n\n3 min — respostas individuais\n4 min — Conselho escolhe uma aposta-base\n1 min — registro da aposta-base' },
    /* "substituir_campo" (não "substituir" com "de"): pedido explícito é
       "substituir o conteúdo inteiro" — funciona igual esteja o campo
       ainda na versão de 5 perguntas de uma leva anterior (nesse caso
       vira revisão manual, igual sempre) ou já na versão de 3
       perguntas aplicada antes (aí já bate com o "para" = "JÁ
       ATUALIZADO", sem re-perguntar nada). */
    { titulo: 'FAÇA A COMPARAÇÃO', campo: 'passoAPasso', acao: 'substituir_campo',
      para: 'Primeiro, coloque lado a lado:\nAPOSTA-BASE DO CONSELHO — SEM IA\n×\nAPOSTA FINAL DO CONSELHO — APÓS A ANÁLISE COM IA\n\nPergunte:\n1. O que mudou entre a aposta sem IA e a aposta final?\n2. O que a IA nos fez enxergar que não havíamos percebido?\n3. O que ainda precisamos verificar antes de aumentar o investimento?\n\nDepois mostre:\n\nMODELO A\nIDEIA → PROJETO → ESCOPO → PLANO → EXECUÇÃO → ENTREGA\n\nMODELO B\nPROBLEMA → HIPÓTESE → EXPERIMENTO → EVIDÊNCIA → APRENDIZADO → NOVA DECISÃO\n\nPergunte: “Em qual situação o Modelo A pode funcionar bem?”\n\nDepois: “E quando existe grande incerteza sobre problema, solução, comportamento ou resultado, o que muda?”\n\nFeche: “Nenhum dos modelos é universalmente certo ou errado. Quando a incerteza é baixa e sabemos bem o que precisa ser feito, planejar mais antecipadamente pode ser eficiente. Quanto maior a incerteza, mais valioso se torna aprender em ciclos menores antes de aumentar o investimento.”' },
    /* Removida integralmente do "Observações" — o prompt oficial já
       vive só em "Prompt para IA" (ver CONTEXTO/MISSÃO das duplas mais
       acima) e nunca deve ficar duplicado aqui. Sem "de" confiável (o
       bloco antigo tinha placeholders tipo "[dupla escreve]" que podem
       ou não ter sido preenchidos) — por isso troca o campo inteiro,
       sempre com revisão manual, nunca reescreve às cegas; se já
       estiver vazio, "JÁ ATUALIZADO". */
    { titulo: 'PRIMEIRO USO DA IA', campo: 'observacoes', acao: 'substituir_campo', para: '' },
    /* Quatro trechos dentro do mesmo campo "Observações" de UMA
       atividade com título exato conhecido — cada um troca só o seu
       próprio trecho, preservando os demais itens da lista (Priorização,
       Foco, Incerteza, Adaptação, Fail small, IA, Pensamento crítico,
       Liderança ágil) e os outros três conceitos revisados entre si. */
    { titulo: 'EPISÓDIO FINAL — O COMPROMISSO DA LIDERANÇA', campo: 'observacoes', acao: 'substituir',
      de: 'Feedback: Novas informações entram no sistema.',
      para: 'Feedback: Sinais da realidade retornam ao processo e ajudam a orientar a próxima decisão.' },
    { titulo: 'EPISÓDIO FINAL — O COMPROMISSO DA LIDERANÇA', campo: 'observacoes', acao: 'substituir',
      de: 'Empirismo: Evidências são mais fortes que opiniões.',
      para: 'Empirismo: Tornamos o que acontece visível, observamos resultados e usamos o aprendizado para orientar a próxima decisão.' },
    { titulo: 'EPISÓDIO FINAL — O COMPROMISSO DA LIDERANÇA', campo: 'observacoes', acao: 'substituir',
      de: 'MVP / experimento: Podemos aprender sem construir tudo.',
      para: 'Experimentação: Experimentos pequenos permitem reduzir incerteza antes de construir ou investir em escala.' },
    { titulo: 'EPISÓDIO FINAL — O COMPROMISSO DA LIDERANÇA', campo: 'observacoes', acao: 'substituir',
      de: 'Outcome x Output: Resolver problema é diferente de entregar projeto.',
      para: 'Outcome × Output: Entregar algo é diferente de produzir o resultado que queremos alcançar.' },
    /* Só o rótulo antes da lista dos 24 cartões — troca de um trecho
       curto e específico, nunca a lista em si (que fica de fora do
       "de", então continua intacta depois do rótulo trocado). */
    { titulo: 'DESAFIO 1: ESCOLHAM', campo: 'passoAPasso', acao: 'substituir',
      de: 'Exemplos:',
      para: 'Os 24 cartões são:' }
  ];

  var CAMPOS_MIGRACAO_LABEL = { passoAPasso: 'Passo a passo', dicasFacilitador: 'Dicas para o facilitador', observacoes: 'Observações', conexaoAgilidade: 'Conexão com a mentalidade ágil', promptIA: 'Prompt para IA', preparacaoPrevia: 'Preparação prévia', duracaoMinutos: 'Duração (minutos)', tipo: 'Tipo' };

  /* Texto legível de um campo rico, pra comparar (nunca pra gravar): tags
     de bloco/quebra viram \n, o resto do HTML é descartado. */
  function textoPlanoMigracao(valor) {
    if (!valor) return '';
    var div = document.createElement('div');
    div.innerHTML = htmlRicoSeguro(valor);
    Array.prototype.forEach.call(div.querySelectorAll('br'), function (br) { br.replaceWith('\n'); });
    Array.prototype.forEach.call(div.querySelectorAll('div,p,li'), function (el) { el.appendChild(document.createTextNode('\n')); });
    return div.textContent || '';
  }
  function espacoNormal(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  /* Converte um bloco de texto puro (com \n reais) no mesmo HTML seguro
     que o campo já teria se tivesse sido digitado e salvo pela tela —
     usado só ao GRAVAR (nunca ao comparar), pra um "Acrescentar" nunca
     depender da conversão automática de \n→<br> que só acontece quando
     o campo inteiro ainda não tem nenhuma tag. */
  function paraHtmlMigracao(textoPlanoNovo) {
    return htmlRicoSeguro(esc(textoPlanoNovo).replace(/\n/g, '<br>').replace(/&amp;/g, '&'));
  }

  /* Busca de trecho TOLERANTE a diferença invisível de formatação —
     aspas tipográficas “ ” vs retas " ", &nbsp; vs espaço normal,
     \r\n vs \n, espaços duplicados, linha em branco a mais/a menos,
     tag HTML no meio de duas palavras (quando o campo é rich text).
     A tolerância nunca muda PALAVRA, NÚMERO ou PONTUAÇÃO relevante —
     só o que separa um token do outro. A busca (e a contagem de
     ocorrências) sempre roda sobre o valor ORIGINAL, nunca sobre uma
     cópia "achatada" — e a troca, quando acontece, também grava só o
     trecho encontrado dentro do valor ORIGINAL (ver substituirTolerante
     abaixo), nunca reescreve o campo inteiro com texto normalizado. */
  function escapeRegexMigracao(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function regexToleranteTrecho(trecho) {
    if (!trecho) return null;
    var partes = String(trecho).split(/\s+/).filter(Boolean).map(function (tok) {
      return escapeRegexMigracao(tok).replace(/["“”]/g, '["“”]').replace(/['‘’]/g, "['‘’]");
    });
    if (!partes.length) return null;
    /* \s já cobre o caractere real de espaço sem quebra (U+00A0); só
       falta a entidade escrita por extenso ("&nbsp;") e uma tag HTML
       qualquer no meio, quando o campo é rich text. */
    return new RegExp(partes.join('(?:\\s|&nbsp;|<[^>]*>)+'), 'g');
  }
  function contarOcorrenciasTolerante(conteudo, trecho) {
    var re = regexToleranteTrecho(trecho);
    if (!re) return 0;
    var m = String(conteudo || '').match(re);
    return m ? m.length : 0;
  }
  function contemTolerante(conteudo, trecho) {
    return contarOcorrenciasTolerante(conteudo, trecho) > 0;
  }
  /* Substitui TODAS as ocorrências toleradas pelo texto novo, dentro
     do valor original — usado tanto no caso de 1 ocorrência (o único
     caso que "OK PARA ALTERAR" aplica sozinho) quanto na decisão
     manual "Substituir pelo PARA" sobre um "TRECHO AMBÍGUO" (aí sim,
     de propósito, troca todas de uma vez). */
  function substituirTolerante(conteudo, trecho, novo) {
    var re = regexToleranteTrecho(trecho);
    if (!re) return conteudo;
    return String(conteudo || '').replace(re, function () { return novo; });
  }

  /* ── Proposta automática de mesclagem para "VALOR ATUAL DIVERGENTE" —
     merge de 3 vias por linha (base = DE, um lado = ATUAL, outro lado
     = PARA), no mesmo espírito de um "diff3": uma linha do DE mantida
     igual nos dois lados fica; removida só no PARA some (é o que o
     PARA claramente substitui); removida só no ATUAL não volta (a
     pessoa já tinha mexido ali, por outro motivo — não desfaz); linha
     nova só no ATUAL é preservada (o que a pessoa acrescentou depois
     do DE); linha nova só no PARA é incorporada (a mudança pretendida
     pela planilha). Quando os dois lados acrescentam algo DIFERENTE no
     mesmo ponto, isso é um conflito de verdade — a proposta marca esse
     trecho em vez de escolher um dos dois sozinha (nunca inventa,
     nunca decide na dúvida). Não é IA: é comparação estrutural de
     texto — por isso "Editar mescla" continua sempre disponível pra
     corrigir o que o algoritmo não entender direito. */
  function linhasParaMesclagem(texto) {
    return String(texto || '').replace(/\r\n?/g, '\n').split('\n');
  }
  function diff3LinhasBase(base, alvo) {
    var n = base.length, m = alvo.length, i, j;
    var dp = [];
    for (i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    var igual = function (x, y) { return x.trim() === y.trim(); };
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        dp[i][j] = igual(base[i], alvo[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var estado = new Array(n).fill('removido');
    var insercoesAntes = {};
    i = 0; j = 0;
    while (i < n && j < m) {
      if (igual(base[i], alvo[j])) { estado[i] = 'igual'; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { i++; }
      else { (insercoesAntes[i] = insercoesAntes[i] || []).push(alvo[j]); j++; }
    }
    while (j < m) { (insercoesAntes[n] = insercoesAntes[n] || []).push(alvo[j]); j++; }
    return { estado: estado, insercoesAntes: insercoesAntes };
  }
  function gerarPropostaMescla(atualPlano, de, para) {
    var baseLinhas = linhasParaMesclagem(de);
    var atualLinhas = linhasParaMesclagem(atualPlano);
    var paraLinhas = linhasParaMesclagem(para);
    var diffAtual = diff3LinhasBase(baseLinhas, atualLinhas);
    var diffPara = diff3LinhasBase(baseLinhas, paraLinhas);
    var saida = [], temConflito = false;
    function emitirInsercoes(idx) {
      var deAtual = (diffAtual.insercoesAntes[idx] || []).join('\n').trim();
      var dePara = (diffPara.insercoesAntes[idx] || []).join('\n').trim();
      if (!deAtual && !dePara) return;
      if (deAtual && dePara && deAtual !== dePara) {
        temConflito = true;
        saida.push('⚠️ CONFLITO — o valor atual e a planilha acrescentam coisas diferentes aqui; escolha manualmente:');
        saida.push('— Trecho já existente no atual: ' + deAtual);
        saida.push('— Trecho novo da planilha: ' + dePara);
        saida.push('⚠️ FIM DO CONFLITO');
      } else {
        saida.push(deAtual || dePara);
      }
    }
    for (var idx = 0; idx <= baseLinhas.length; idx++) {
      emitirInsercoes(idx);
      if (idx === baseLinhas.length) break;
      if (diffAtual.estado[idx] === 'igual' && diffPara.estado[idx] === 'igual') saida.push(baseLinhas[idx]);
      /* "igual" no atual + "removido" no para: o PARA tira essa linha
         de propósito — some. "removido" no atual (a pessoa já tinha
         mudado essa parte por conta própria) — não volta, o que ela
         colocou no lugar já está capturado como inserção. As duas
         "removido" ao mesmo tempo: nada a fazer. */
    }
    var textoFinal = saida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    var mesmoQueAtual = espacoNormal(textoFinal) === espacoNormal(atualPlano);
    return { texto: textoFinal, temConflito: temConflito, sugestao: temConflito ? 'editar' : (mesmoQueAtual ? 'manter' : 'mesclar') };
  }

  /* Casamento por título tolera diferença de pontuação/espaço no final
     (ex: atividade cadastrada como "...para a reflexão." com ponto,
     enquanto a planilha tem "...para a reflexão" sem ponto) — nunca
     tolera diferença de PALAVRAS, só o que sobra depois de tirar
     espaço e pontuação final (. , ; :) das duas pontas. */
  function normalizarTituloMigracao(s) {
    return String(s || '').trim().replace(/[.,;:]+$/, '').trim();
  }
  /* Item sem título fixo (tituloQualquer:true): procura o trecho "de"
     em QUALQUER atividade, dentro dos campos de CAMPOS_BUSCA_AMPLA_
     MIGRACAO (nunca no Prompt para IA). Só decide sozinho quando bate
     em exatamente 1 atividade/campo com exatamente 1 ocorrência. */
  function avaliarItemBuscaAmpla(item, atividades) {
    var candidatos = [];
    atividades.forEach(function (a) {
      CAMPOS_BUSCA_AMPLA_MIGRACAO.forEach(function (campo) {
        var oc = contarOcorrenciasTolerante(a[campo] || '', item.de);
        if (oc > 0) candidatos.push({ atividade: a, campo: campo, ocorrencias: oc });
      });
    });
    if (!candidatos.length) {
      var achouPara = atividades.some(function (a) {
        return CAMPOS_BUSCA_AMPLA_MIGRACAO.some(function (campo) { return contemTolerante(a[campo] || '', item.para); });
      });
      return { item: item, status: achouPara ? 'JÁ ATUALIZADO' : 'TRECHO NÃO LOCALIZADO' };
    }
    if (candidatos.length > 1 || candidatos[0].ocorrencias > 1) {
      return { item: item, status: 'TRECHO ENCONTRADO EM MAIS DE UM LUGAR', candidatos: candidatos };
    }
    var c = candidatos[0];
    var itemResolvido = Object.assign({}, item, { titulo: c.atividade.titulo, campo: c.campo });
    return { item: itemResolvido, atividade: c.atividade, status: 'OK PARA ALTERAR', valorAtual: c.atividade[c.campo] || '', ocorrencias: 1 };
  }

  /* Busca SEMÂNTICA (aproximada, por palavras-chave) — só usada como
     DICA visual quando um item de busca ampla vira "TRECHO NÃO
     LOCALIZADO", pra ajudar a pessoa a achar manualmente um lugar onde
     o texto pode ter sido reescrito demais pra bater nem tolerando
     formatação. Nunca decide sozinha, nunca aplica nada — só lista
     candidatos por sobreposição de palavras significativas do "DE". */
  var PALAVRAS_IRRELEVANTES_BUSCA = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, a: 1, o: 1, as: 1, os: 1, que: 1, para: 1, um: 1, uma: 1, no: 1, na: 1, nos: 1, nas: 1, ao: 1, aos: 1, em: 1, por: 1, com: 1, se: 1, ou: 1, mais: 1, sem: 1, ainda: 1, entrou: 1, entraram: 1 };
  function palavrasSignificativasBusca(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 2 && !PALAVRAS_IRRELEVANTES_BUSCA[w]; });
  }
  function buscaSemanticaCandidatos(item, atividades) {
    var palavrasDe = palavrasSignificativasBusca(item.de);
    if (!palavrasDe.length) return [];
    var candidatos = [];
    atividades.forEach(function (a) {
      CAMPOS_BUSCA_AMPLA_MIGRACAO.forEach(function (campo) {
        var palavrasCampo = {};
        palavrasSignificativasBusca(a[campo] || '').forEach(function (w) { palavrasCampo[w] = true; });
        if (!Object.keys(palavrasCampo).length) return;
        var bateram = palavrasDe.filter(function (w) { return palavrasCampo[w]; }).length;
        var score = bateram / palavrasDe.length;
        if (bateram >= 2 && score >= 0.4) candidatos.push({ atividade: a, campo: campo, score: score });
      });
    });
    candidatos.sort(function (x, y) { return y.score - x.score; });
    return candidatos.slice(0, 5);
  }

  /* Clona a lista de atividades de UM DIA (nível principal + filhas) e
     aplica, na cópia, o efeito de uma decisão sobre um item "duracao" —
     nunca escreve no banco, serve só pra CALCULAR/MOSTRAR o impacto no
     horário antes de aplicar de verdade. Sem `compensarKey`: a
     atividade principal muda de duração e TODAS as seguintes do dia
     deslizam a mesma diferença (cenário A — aceitar o atraso). Com
     `compensarKey`: as atividades ANTES do alvo escolhido deslizam
     normalmente, o próprio alvo entra deslocado mas encolhe pela mesma
     diferença (saindo no MESMO horário de fim de antes) e tudo DEPOIS
     dele volta a ficar idêntico ao original (cenário B — retirar o
     tempo de outra atividade em vez de atrasar o resto do dia). */
  function projetarAtividadesDoDia(todasAtividadesDoDia, l, compensarKey) {
    var porKey = {};
    var clone = todasAtividadesDoDia.map(function (a) { var c = Object.assign({}, a); porKey[c.key] = c; return c; });
    var principal = porKey[l.atividade.key];
    if (principal) {
      principal.duracaoMinutos = l.item.paraMinutos;
      if (l.horaFimNovo !== l.horaFimAtual) principal.horaFim = l.horaFimNovo;
    }
    var passouCompensar = false;
    (l.seguintes || []).forEach(function (s) {
      var alvo = porKey[s.atividade.key];
      if (!alvo) return;
      if (compensarKey && passouCompensar) return;
      if (compensarKey && s.atividade.key === compensarKey) {
        alvo.duracaoMinutos = (Number(s.atividade.duracaoMinutos) || 0) - l.delta;
        alvo.horaInicio = s.horaInicioNovo;
        passouCompensar = true;
        return;
      }
      alvo.horaInicio = s.horaInicioNovo;
      if (s.horaFimNovo !== s.horaFimAtual) alvo.horaFim = s.horaFimNovo;
    });
    return clone;
  }
  /* Só oferece compensar em atividades que sobrevivem ao corte (duração
     maior que a diferença) — nunca deixa a pessoa escolher uma que
     zeraria ou ficaria negativa. */
  function candidatosCompensarDuracao(l) {
    return (l.seguintes || []).filter(function (s) { return (Number(s.atividade.duracaoMinutos) || 0) > l.delta; });
  }
  /* Tabela antes/depois + resumo de sessão/dia pra UM cenário (A ou B,
     conforme `compensarKey`) — reaproveita agruparPorSessao/
     calcularResumoDia, as MESMAS funções que o editor usa pra mostrar
     "Programado/Facilitação/Pausas/Lacunas" na tela normal, em vez de
     recalcular isso tudo na mão de novo (evita duas lógicas divergentes
     pro mesmo número). */
  function resumoImpactoDuracaoHtml(atividadesGlobais, l, compensarKey) {
    var diaKey = l.atividade.diaKey;
    var todasAntes = atividadesDoDia(atividadesGlobais, diaKey);
    var topoAntes = todasAntes.filter(function (a) { return !a.paiKey; });
    var gruposAntes = agruparPorSessao(topoAntes, todasAntes);
    var grupoAtividade = gruposAntes.filter(function (g) { return g.atividades.some(function (a) { return a.key === l.atividade.key; }); })[0];
    var resumoDiaAntes = calcularResumoDia(topoAntes, todasAntes);
    var resumoSessaoAntes = grupoAtividade ? calcularResumoDia(grupoAtividade.atividades, todasAntes) : null;

    var todasDepois = projetarAtividadesDoDia(todasAntes, l, compensarKey);
    var topoDepois = todasDepois.filter(function (a) { return !a.paiKey; });
    var gruposDepois = agruparPorSessao(topoDepois, todasDepois);
    var grupoAtividadeDepois = gruposDepois.filter(function (g) { return g.atividades.some(function (a) { return a.key === l.atividade.key; }); })[0];
    var resumoDiaDepois = calcularResumoDia(topoDepois, todasDepois);
    var resumoSessaoDepois = grupoAtividadeDepois ? calcularResumoDia(grupoAtividadeDepois.atividades, todasDepois) : null;

    var linhasAfetadas = [l.atividade].concat((l.seguintes || []).map(function (s) { return s.atividade; }));
    var linhasTabela = linhasAfetadas.map(function (aOriginal) {
      var aDepois = todasDepois.filter(function (x) { return x.key === aOriginal.key; })[0] || aOriginal;
      var mudou = aOriginal.horaInicio !== aDepois.horaInicio || aOriginal.horaFim !== aDepois.horaFim || Number(aOriginal.duracaoMinutos) !== Number(aDepois.duracaoMinutos);
      if (!mudou) return '';
      return '<tr><td style="padding:3px 6px">' + esc(aOriginal.titulo) + '</td>' +
        '<td style="padding:3px 6px;color:var(--ink-3)">' + esc(aOriginal.horaInicio || '—') + '–' + esc(aOriginal.horaFim || '—') + ' (' + (Number(aOriginal.duracaoMinutos) || 0) + ' min)</td>' +
        '<td style="padding:3px 6px">' + esc(aDepois.horaInicio || '—') + '–' + esc(aDepois.horaFim || '—') + ' (' + (Number(aDepois.duracaoMinutos) || 0) + ' min)</td></tr>';
    }).join('');

    function fimTxt(r) { return r && r.janelaFimMin != null ? minParaHhmm(r.janelaFimMin) : '—'; }
    function duracaoTxt(r) { return r && r.janelaMin != null ? fmtDuracao(r.janelaMin) : '—'; }

    return (linhasTabela
      ? '<table style="width:100%;border-collapse:collapse;font-size:.72rem;margin-bottom:6px"><thead><tr style="color:var(--ink-3);text-transform:uppercase;font-size:.62rem"><th style="text-align:left;padding:3px 6px">Atividade</th><th style="text-align:left;padding:3px 6px">Antes</th><th style="text-align:left;padding:3px 6px">Depois</th></tr></thead><tbody>' + linhasTabela + '</tbody></table>'
      : '<p style="font-size:.72rem;color:var(--ink-3);margin:0 0 6px">Nenhuma atividade tem horário afetado neste cenário.</p>') +
      '<div style="font-size:.72rem;color:var(--ink-2)">Horário final da sessão' + (grupoAtividade && grupoAtividade.nome ? ' "' + esc(grupoAtividade.nome) + '"' : '') + ': ' + fimTxt(resumoSessaoAntes) + ' → ' + fimTxt(resumoSessaoDepois) + ' · Duração da sessão: ' + duracaoTxt(resumoSessaoAntes) + ' → ' + duracaoTxt(resumoSessaoDepois) + '</div>' +
      '<div style="font-size:.72rem;color:var(--ink-2)">Horário final do dia: ' + fimTxt(resumoDiaAntes) + ' → ' + fimTxt(resumoDiaDepois) + ' · Duração total do dia: ' + duracaoTxt(resumoDiaAntes) + ' → ' + duracaoTxt(resumoDiaDepois) + '</div>';
  }
  function dryRunMigracaoAntesDepois(atividades, lista) {
    lista = lista || MIGRACAO_ANTES_DEPOIS;
    var porTitulo = {};
    atividades.forEach(function (a) {
      var t = normalizarTituloMigracao(a.titulo);
      (porTitulo[t] = porTitulo[t] || []).push(a);
    });
    return lista.map(function (item) {
      if (item.tituloQualquer) return avaliarItemBuscaAmpla(item, atividades);
      var lista2 = porTitulo[normalizarTituloMigracao(item.titulo)] || [];
      if (!lista2.length) return { item: item, status: 'ATIVIDADE NÃO ENCONTRADA' };
      if (lista2.length > 1) return { item: item, status: 'REGISTRO AMBÍGUO' };
      var a = lista2[0];
      if (item.acao === 'tipo') {
        var tipoAtual = (a.tipo || '').trim();
        if (tipoAtual === item.para) return { item: item, atividade: a, status: 'JÁ ATUALIZADO', valorAtual: tipoAtual };
        if (tipoAtual === item.de) return { item: item, atividade: a, status: 'OK PARA ALTERAR', valorAtual: tipoAtual };
        return { item: item, atividade: a, status: 'VALOR ATUAL DIVERGENTE', valorAtual: tipoAtual };
      }
      /* "duracao": muda duracaoMinutos e recalcula o horário final da
         própria atividade + o início/fim das atividades seguintes do
         mesmo dia (nível principal, com horário próprio) pela mesma
         diferença — sempre calculado aqui, mesmo quando a duração atual
         diverge do "de" esperado, pra já aparecer no dry run/revisão
         qual seria o efeito de aplicar "para" mesmo assim. */
      if (item.acao === 'duracao') {
        var duracaoAtual = Number(a.duracaoMinutos) || 0;
        var delta = item.paraMinutos - duracaoAtual;
        var horaFimAtual = a.horaFim;
        var horaFimNovo = (horaFimAtual && delta) ? minParaHhmm(hhmmParaMin(horaFimAtual) + delta) : horaFimAtual;
        var seguintes = [];
        if (a.horaInicio && !a.paiKey && delta) {
          var topoMesmoDia = atividadesTopoDoDia(atividades, a.diaKey);
          var idxTopo = topoMesmoDia.findIndex(function (x) { return x.key === a.key; });
          seguintes = topoMesmoDia.slice(idxTopo + 1).filter(function (x) { return x.horaInicio; }).map(function (s) {
            return {
              atividade: s,
              horaInicioAtual: s.horaInicio, horaInicioNovo: minParaHhmm(hhmmParaMin(s.horaInicio) + delta),
              horaFimAtual: s.horaFim, horaFimNovo: s.horaFim ? minParaHhmm(hhmmParaMin(s.horaFim) + delta) : s.horaFim
            };
          });
        }
        var statusDuracao = duracaoAtual === item.paraMinutos ? 'JÁ ATUALIZADO' : (duracaoAtual === item.deMinutos ? 'OK PARA ALTERAR' : 'VALOR ATUAL DIVERGENTE');
        return { item: item, atividade: a, status: statusDuracao, valorAtual: duracaoAtual, delta: delta, horaFimAtual: horaFimAtual, horaFimNovo: horaFimNovo, seguintes: seguintes };
      }
      var rawAtual = a[item.campo] || '';
      /* "substituir" e "substituir_trecho" usam a MESMA lógica: o "DE"
         é um TRECHO que existe dentro de um campo maior, não o campo
         inteiro — comparar o campo inteiro com o "DE" gerava falsa
         divergência sempre que o campo tinha mais conteúdo em volta
         daquele trecho (o caso normal aqui: o roteiro real tem linhas
         adicionais que a planilha nunca listou por inteiro). Conta
         quantas vezes o trecho aparece no valor BRUTO (não no texto
         "achatado" — a troca precisa acontecer exatamente onde o
         trecho está, preservando tudo em volta, então a busca é no
         mesmo valor que será gravado). */
      if (item.acao === 'substituir' || item.acao === 'substituir_trecho') {
        var ocorrencias = contarOcorrenciasTolerante(rawAtual, item.de);
        if (ocorrencias === 1) return { item: item, atividade: a, status: 'OK PARA ALTERAR', valorAtual: rawAtual, ocorrencias: 1 };
        if (ocorrencias > 1) return { item: item, atividade: a, status: 'TRECHO AMBÍGUO', valorAtual: rawAtual, ocorrencias: ocorrencias };
        /* ocorrencias === 0: ou já foi trocado (o "PARA" já está lá,
           igual ou já mesclado/reformulado o bastante pra não bater
           mais com o "DE"), ou o campo realmente diverge de tudo. */
        if (contemTolerante(rawAtual, item.para)) return { item: item, atividade: a, status: 'JÁ ATUALIZADO', valorAtual: rawAtual, ocorrencias: 0 };
        return { item: item, atividade: a, status: 'VALOR ATUAL DIVERGENTE', valorAtual: rawAtual, ocorrencias: 0 };
      }
      if (item.acao === 'substituir_vazio') {
        var plano2 = espacoNormal(textoPlanoMigracao(rawAtual));
        if (!plano2) return { item: item, atividade: a, status: 'OK PARA ALTERAR', valorAtual: rawAtual };
        if (contemTolerante(rawAtual, item.para) || plano2 === espacoNormal(item.para)) return { item: item, atividade: a, status: 'JÁ ATUALIZADO', valorAtual: rawAtual };
        return { item: item, atividade: a, status: 'VALOR ATUAL DIVERGENTE', valorAtual: rawAtual };
      }
      /* "substituir_campo": troca o CAMPO INTEIRO — não há "de" pra
         comparar/localizar, então nunca vira "OK PARA ALTERAR" sozinho:
         só "JÁ ATUALIZADO" (já bate com o "para") ou sempre revisão
         manual, pra nunca sobrescrever o que já estiver lá sem alguém
         conferir de verdade. */
      if (item.acao === 'substituir_campo') {
        var planoAtualCampo = espacoNormal(textoPlanoMigracao(rawAtual));
        var planoParaCampo = espacoNormal(textoPlanoMigracao(paraHtmlMigracao(item.para)));
        if (planoAtualCampo === planoParaCampo) return { item: item, atividade: a, status: 'JÁ ATUALIZADO', valorAtual: rawAtual };
        return { item: item, atividade: a, status: 'VALOR ATUAL DIVERGENTE', valorAtual: rawAtual };
      }
      if (item.acao === 'acrescentar_fim' || item.acao === 'acrescentar_inicio') {
        var contem = contemTolerante(rawAtual, item.para);
        return { item: item, atividade: a, status: contem ? 'JÁ ATUALIZADO' : 'OK PARA ALTERAR', valorAtual: rawAtual };
      }
      return { item: item, atividade: a, status: 'VALOR ATUAL DIVERGENTE', valorAtual: rawAtual };
    });
  }

  /* Monta as escritas de UMA linha aplicada + os itens de backup
     correspondentes. Normalmente é uma escrita só (uma atividade, um
     campo) — "duracao" é a exceção: mexe na atividade principal
     (duracaoMinutos + horaFim) e em cascata no horaInicio/horaFim de
     cada atividade seguinte do mesmo dia, então vira uma escrita por
     atividade tocada, todas no mesmo backup (uma única leva pra
     desfazer tudo de uma vez). */
  function montarEscritasLinhaDuracao(l) {
    var escritasDuracao = [];
    var backupDuracao = [{ atividadeKey: l.atividade.key, campo: 'duracaoMinutos', valorAnterior: l.valorAtual }];
    var patchPrincipal = { duracaoMinutos: l.item.paraMinutos };
    if (l.horaFimNovo !== l.horaFimAtual) {
      backupDuracao.push({ atividadeKey: l.atividade.key, campo: 'horaFim', valorAnterior: l.horaFimAtual });
      patchPrincipal.horaFim = l.horaFimNovo;
    }
    escritasDuracao.push({ atividadeKey: l.atividade.key, patch: patchPrincipal });

    var compensarKey = l.decisaoTipo === 'compensar' ? l.atividadeCompensarKey : null;
    var passouCompensar = false;
    (l.seguintes || []).forEach(function (s) {
      /* Cenário B ("compensar"): tudo DEPOIS da atividade escolhida
         pra encolher fica exatamente como estava — nenhuma escrita.
         Cenário A (sem compensarKey) sempre desloca todo mundo, como
         antes. */
      if (compensarKey && passouCompensar) return;
      if (compensarKey && s.atividade.key === compensarKey) {
        var novaDuracao = (Number(s.atividade.duracaoMinutos) || 0) - l.delta;
        backupDuracao.push({ atividadeKey: s.atividade.key, campo: 'duracaoMinutos', valorAnterior: s.atividade.duracaoMinutos });
        backupDuracao.push({ atividadeKey: s.atividade.key, campo: 'horaInicio', valorAnterior: s.horaInicioAtual });
        escritasDuracao.push({ atividadeKey: s.atividade.key, patch: { duracaoMinutos: novaDuracao, horaInicio: s.horaInicioNovo } });
        passouCompensar = true;
        return;
      }
      var patchSeguinte = { horaInicio: s.horaInicioNovo };
      backupDuracao.push({ atividadeKey: s.atividade.key, campo: 'horaInicio', valorAnterior: s.horaInicioAtual });
      if (s.horaFimNovo !== s.horaFimAtual) {
        patchSeguinte.horaFim = s.horaFimNovo;
        backupDuracao.push({ atividadeKey: s.atividade.key, campo: 'horaFim', valorAnterior: s.horaFimAtual });
      }
      escritasDuracao.push({ atividadeKey: s.atividade.key, patch: patchSeguinte });
    });
    return { escritas: escritasDuracao, backup: backupDuracao };
  }

  /* Calcula o valor NOVO de um campo de texto/tipo a partir de um valor
     "corrente" — que pode já vir alterado por OUTRA linha do mesmo lote
     que mexe no mesmo campo da mesma atividade (ver agrupamento em
     aplicarMigracaoAntesDepois logo abaixo). Nunca lê l.valorAtual
     diretamente: se ler, duas linhas tocando o mesmo campo (ex: dois
     "substituir" trocando trechos DIFERENTES nas mesmas Observações)
     partiriam cada uma do valor ORIGINAL e a segunda escrita apagaria
     o que a primeira tinha acabado de trocar. */
  function novoValorCampoMigracao(l, valorAtualCorrente) {
    if (l.valorMesclado != null) return paraHtmlMigracao(l.valorMesclado);
    if (l.item.acao === 'tipo') return l.item.para;
    if (l.item.acao === 'substituir_vazio' || l.item.acao === 'substituir_campo') return paraHtmlMigracao(l.item.para);
    if (l.item.acao === 'acrescentar_fim') {
      var existenteFim = valorAtualCorrente ? htmlRicoSeguro(valorAtualCorrente) + '<br><br>' : '';
      return existenteFim + paraHtmlMigracao(l.item.para);
    }
    if (l.item.acao === 'acrescentar_inicio') {
      var existenteInicio = valorAtualCorrente ? '<br><br>' + htmlRicoSeguro(valorAtualCorrente) : '';
      return paraHtmlMigracao(l.item.para) + existenteInicio;
    }
    if (l.item.acao === 'substituir' || l.item.acao === 'substituir_trecho') {
      /* Só troca o TRECHO "de" pelo "para" dentro do valor atual —
         preserva todo o resto do campo, nunca substitui o campo
         inteiro (ver dryRunMigracaoAntesDepois acima). */
      return substituirTolerante(valorAtualCorrente, l.item.de, l.item.para);
    }
    return valorAtualCorrente;
  }

  function aplicarMigracaoAntesDepois(eventoKey, linhasOk, cb) {
    var backupItens = [];
    var unidades = []; /* { escritas: [...], linhasCount: N } — uma unidade = uma escrita física (ou o grupo de escritas de uma linha "duracao"); linhasCount é quantas linhas do DRY RUN ela representa, pra "X de Y aplicadas" continuar contando por linha, não por escrita física. */

    linhasOk.filter(function (l) { return l.item.acao === 'duracao'; }).forEach(function (l) {
      var r = montarEscritasLinhaDuracao(l);
      backupItens = backupItens.concat(r.backup);
      unidades.push({ escritas: r.escritas, linhasCount: 1 });
    });

    /* Linhas que escrevem um único campo de uma atividade (todas as
       ações exceto "duracao") são agrupadas por atividade+campo ANTES
       de gerar a escrita: mais de uma linha mexendo no MESMO campo da
       MESMA atividade (ex: quatro "substituir" trocando trechos
       diferentes nas mesmas Observações) vira UMA escrita só, com cada
       transformação aplicada em cadeia sobre o resultado da anterior —
       nunca escritas paralelas independentes, que fariam a última
       vencer e apagar as outras. O backup guarda o valor de ANTES de
       qualquer uma das transformações do lote, não um valor
       intermediário. */
    var grupos = {}, ordemGrupos = [];
    linhasOk.filter(function (l) { return l.item.acao !== 'duracao'; }).forEach(function (l) {
      var campo = l.item.acao === 'tipo' ? 'tipo' : l.item.campo;
      var chave = l.atividade.key + '::' + campo;
      if (!grupos[chave]) {
        grupos[chave] = {
          atividadeKey: l.atividade.key, campo: campo,
          valorInicial: l.item.acao === 'tipo' ? (l.atividade.tipo || '') : (l.atividade[l.item.campo] || ''),
          linhas: []
        };
        ordemGrupos.push(chave);
      }
      grupos[chave].linhas.push(l);
    });
    ordemGrupos.forEach(function (chave) {
      var g = grupos[chave];
      var valorCorrente = g.valorInicial;
      g.linhas.forEach(function (l) { valorCorrente = novoValorCampoMigracao(l, valorCorrente); });
      backupItens.push({ atividadeKey: g.atividadeKey, campo: g.campo, valorAnterior: g.valorInicial });
      var patch = {}; patch[g.campo] = valorCorrente;
      unidades.push({ escritas: [{ atividadeKey: g.atividadeKey, patch: patch }], linhasCount: g.linhas.length });
    });

    var backupRef = db().ref('roteiros-evento/' + eventoKey + '/_migracoesBackup').push();
    backupRef.set({ criadoEm: new Date().toISOString(), itens: backupItens }, function (errBackup) {
      if (errBackup) return cb(errBackup);
      var pendentesUnidades = unidades.length, atualizados = 0;
      if (!pendentesUnidades) return cb(null, 0);
      unidades.forEach(function (u) {
        var pendentesEscritas = u.escritas.length, algumErro = false;
        if (!pendentesEscritas) { if (!--pendentesUnidades) cb(null, atualizados); return; }
        u.escritas.forEach(function (e) {
          editarAtividade(eventoKey, e.atividadeKey, e.patch, function (err) {
            if (err) algumErro = true;
            if (!--pendentesEscritas) {
              if (!algumErro) atualizados += u.linhasCount;
              if (!--pendentesUnidades) cb(null, atualizados);
            }
          });
        });
      });
    });
  }

  function carregarUltimoBackupMigracao(eventoKey, cb) {
    db().ref('roteiros-evento/' + eventoKey + '/_migracoesBackup').once('value', function (snap) {
      var val = snap.val() || {};
      var chaves = Object.keys(val).sort();
      if (!chaves.length) return cb(null, null);
      var ultimaChave = chaves[chaves.length - 1];
      cb(null, { key: ultimaChave, val: val[ultimaChave] });
    }, function (err) { cb(err); });
  }

  function desfazerMigracao(eventoKey, backup, cb) {
    var itens = backup.itens || [];
    var pendentes = itens.length;
    if (!pendentes) return cb(null, 0);
    var restaurados = 0;
    itens.forEach(function (it) {
      var patch = {};
      patch[it.campo] = it.valorAnterior;
      editarAtividade(eventoKey, it.atividadeKey, patch, function (err) {
        if (!err) restaurados++;
        if (!--pendentes) {
          db().ref('roteiros-evento/' + eventoKey + '/_migracoesBackup/' + backup.key).remove(function () { cb(null, restaurados); });
        }
      });
    });
  }

  function abrirModalMigracaoAntesDepois(eventoKey, atividades, reload, lista, tituloModal) {
    lista = lista || MIGRACAO_ANTES_DEPOIS;
    tituloModal = tituloModal || 'Migração de conteúdo — Antes x Depois';
    var linhas = dryRunMigracaoAntesDepois(atividades, lista);

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:960px;width:95%;padding:24px;display:flex;flex-direction:column;gap:12px;max-height:90vh;overflow:auto';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var corPorStatus = {
      'OK PARA ALTERAR': 'var(--blue-glow,#4aa3ff)',
      'JÁ ATUALIZADO': '#4caf7d',
      'VALOR ATUAL DIVERGENTE': '#ff8a5c',
      'TRECHO AMBÍGUO': '#ff8a5c',
      'TRECHO NÃO LOCALIZADO': '#ff8a5c',
      'TRECHO ENCONTRADO EM MAIS DE UM LUGAR': '#ff8a5c',
      'ATIVIDADE NÃO ENCONTRADA': '#ff6b60',
      'REGISTRO AMBÍGUO': '#ff6b60',
      'DIVERGÊNCIA RESOLVIDA': '#c9a94a'
    };
    var labelDecisao = { manter: 'MANTER ATUAL', usar_para: 'USAR PARA', mesclar: 'MESCLA APROVADA', visto: 'CONFIRMADO (SEM AÇÃO)', compensar: 'COMPENSADO EM OUTRA ATIVIDADE' };
    /* "VALOR ATUAL DIVERGENTE" (trecho não achado) e "TRECHO AMBÍGUO"
       (trecho achado mais de uma vez) são dois dos casos que precisam
       de revisão humana. Os outros três: "TRECHO NÃO LOCALIZADO" e
       "TRECHO ENCONTRADO EM MAIS DE UM LUGAR" (busca sem título fixo)
       nunca têm nada pra aplicar sozinhos, mas mesmo assim exigem uma
       decisão explícita ("Marquei como visto") antes de liberar
       "Aplicar" — não é pra passar batido por um item que ninguém
       conferiu; e "duracao" (muda horário de outras atividades em
       cadeia) NUNCA entra em "OK PARA ALTERAR" automático, mesmo
       quando a duração atual bate exatamente com o "de" esperado —
       sempre precisa de uma decisão explícita sobre o impacto no
       horário (aceitar o atraso ou compensar tirando de outra
       atividade), só "JÁ ATUALIZADO" (já está no valor novo) dispensa
       revisão. "REGISTRO AMBÍGUO"/"ATIVIDADE NÃO ENCONTRADA" são outra
       coisa: não existe UMA atividade pra mostrar "valor atual", então
       ficam só como pendência, sem revisão aqui dentro. */
    function precisaRevisao(l) {
      if (l.item.acao === 'duracao') return l.status !== 'JÁ ATUALIZADO';
      return l.status === 'VALOR ATUAL DIVERGENTE' || l.status === 'TRECHO AMBÍGUO' ||
        l.status === 'TRECHO NÃO LOCALIZADO' || l.status === 'TRECHO ENCONTRADO EM MAIS DE UM LUGAR';
    }

    function totalDivergentes() { return linhas.filter(precisaRevisao).length; }
    function divergentesResolvidas() { return linhas.filter(function (l) { return precisaRevisao(l) && l.decisaoTipo; }).length; }
    function pendenteAlgumaDivergencia() { return linhas.some(function (l) { return precisaRevisao(l) && !l.decisaoTipo; }); }
    function linhasParaAplicar() {
      return linhas.filter(function (l) {
        if (l.item.acao === 'duracao') return l.decisaoTipo === 'usar_para' || l.decisaoTipo === 'compensar';
        if (l.status === 'OK PARA ALTERAR') return true;
        if (precisaRevisao(l) && (l.decisaoTipo === 'usar_para' || l.decisaoTipo === 'mesclar')) return true;
        return false;
      });
    }
    /* Depois de decidir uma divergência, pula pra próxima ainda sem
       decisão — nunca fica parado na mesma nem pula nenhuma sem
       decisão registrada. */
    function proximaDivergentePendente(depoisDe) {
      var i;
      for (i = depoisDe + 1; i < linhas.length; i++) {
        if (precisaRevisao(linhas[i]) && !linhas[i].decisaoTipo) return i;
      }
      for (i = 0; i <= depoisDe; i++) {
        if (precisaRevisao(linhas[i]) && !linhas[i].decisaoTipo) return i;
      }
      return null;
    }
    var revisandoIdx = proximaDivergentePendente(-1);

    /* "duracao" tem seu próprio painel — valorAtual é um NÚMERO de
       minutos, não texto rico, então não passa pelo cabeçalho ATUAL/
       DE/PARA genérico abaixo (nem faz sentido "mesclar" dois
       números). NUNCA aplica sozinho, mesmo com status "OK PARA
       ALTERAR" — a mudança de duração desloca o horário de outras
       atividades, então sempre exige uma escolha explícita entre dois
       cenários: A) aceitar terminar mais tarde (desloca as atividades
       seguintes do dia) ou B) retirar a diferença de outra atividade
       escolhida à mão (mantém os horários finais, mas encolhe aquela
       atividade). As duas tabelas de impacto reaproveitam a mesma
       lógica de resumo de dia/sessão da tela normal do roteiro —
       nunca inventam um cálculo paralelo. */
    function painelRevisaoDuracaoHtml(l) {
      var divergente = l.status === 'VALOR ATUAL DIVERGENTE';
      var candidatosB = candidatosCompensarDuracao(l);
      var opcoesSelectB = '<option value="">— escolha uma atividade —</option>' +
        candidatosB.map(function (s) { return '<option value="' + esc(s.atividade.key) + '">' + esc(s.atividade.titulo) + ' (' + (Number(s.atividade.duracaoMinutos) || 0) + ' min)</option>'; }).join('');
      return '<div class="mig-painel" style="background:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;padding:14px;margin:6px 0;font-size:.8rem">' +
        '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px">' +
          '<div><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Duração atual</strong><div style="margin-top:4px;color:var(--ink)">' + l.valorAtual + ' min' + (l.horaFimAtual ? ' (fim ' + esc(l.horaFimAtual) + ')' : '') + '</div></div>' +
          '<div><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Duração esperada (DE)</strong><div style="margin-top:4px;color:var(--ink-2)">' + l.item.deMinutos + ' min</div></div>' +
          '<div><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Duração nova (PARA)</strong><div style="margin-top:4px;color:var(--ink-2)">' + l.item.paraMinutos + ' min</div></div>' +
        '</div>' +
        (divergente ? '<p style="color:#ff8a5c;font-size:.72rem;margin:0 0 10px">A duração atual não bate com o valor esperado (' + l.item.deMinutos + ' min) nem já está em ' + l.item.paraMinutos + ' min — confira antes de decidir.</p>' : '') +
        '<div style="margin-bottom:12px"><strong style="color:var(--gold);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Cenário A — aceitar terminar ' + l.delta + ' min mais tarde</strong>' +
          '<div style="margin-top:6px">' + resumoImpactoDuracaoHtml(atividades, l, null) + '</div>' +
          '<button class="btn btn--primary mig-dec" data-dec="usar_para" style="margin-top:6px">Aceitar cenário A — desloca ' + l.delta + ' min</button>' +
        '</div>' +
        '<div style="margin-bottom:12px;padding-top:10px;border-top:1px solid var(--line-strong)"><strong style="color:var(--gold);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Cenário B — retirar ' + l.delta + ' min de outra atividade (mantém os horários finais)</strong>' +
          (candidatosB.length
            ? '<div style="margin-top:6px"><select class="mig-duracao-compensar-select" style="padding:6px 8px;background:var(--panel);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)">' + opcoesSelectB + '</select></div>' +
              '<div class="mig-duracao-preview-b" style="margin-top:6px;font-size:.72rem;color:var(--ink-3)">Escolha uma atividade acima para ver o impacto.</div>' +
              '<button class="btn mig-duracao-compensar-confirmar" style="margin-top:6px" disabled>Confirmar cenário B</button>'
            : '<p style="font-size:.72rem;color:var(--ink-3);margin:6px 0 0">Nenhuma atividade seguinte do dia tem duração suficiente pra absorver ' + l.delta + ' min sem zerar.</p>') +
        '</div>' +
        '<div class="mig-decisao-botoes" style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn mig-dec" data-dec="manter">Manter atual (não mudar a duração)</button>' +
        '</div>' +
      '</div>';
    }
    /* Painel dos itens de busca sem título fixo que não deram pra
       resolver sozinhos — nunca tem "atual/de/para" de UM campo certo
       (por definição, não sabemos ainda onde está), então mostra o
       contexto do pedido original, o texto DE/PARA esperado, o motivo
       técnico de não ter achado (ou de ter achado em mais de um
       lugar) e, só quando não achou em lugar nenhum, uma busca
       aproximada por palavras-chave como DICA (nunca decide sozinha).
       Não existe nada pra aplicar aqui — só um "Marquei como visto"
       que libera a pendência sem gravar nada. */
    function painelRevisaoBuscaAmplaHtml(l) {
      var origem = l.item.origemPedido || '(sem contexto adicional registrado para este item)';
      var camposBuscados = CAMPOS_BUSCA_AMPLA_MIGRACAO.map(function (c) { return CAMPOS_MIGRACAO_LABEL[c] || c; }).join(', ');
      var motivoTxt, extraHtml;
      if (l.status === 'TRECHO ENCONTRADO EM MAIS DE UM LUGAR') {
        motivoTxt = 'O texto "DE" foi encontrado em mais de um lugar (listados abaixo) — o sistema não escolhe sozinho qual é o certo.';
        extraHtml = '<div style="margin-bottom:8px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Encontrado em</strong><div style="margin-top:4px;color:var(--ink-2)">' +
          l.candidatos.map(function (c) { return esc(c.atividade.titulo) + ' — ' + esc(CAMPOS_MIGRACAO_LABEL[c.campo] || c.campo) + (c.ocorrencias > 1 ? ' (' + c.ocorrencias + 'x)' : ''); }).join('<br>') + '</div></div>';
      } else {
        motivoTxt = 'O texto "DE" não foi encontrado — nem exatamente, nem tolerando diferença de formatação — em nenhuma atividade, dentro dos campos varridos (' + camposBuscados + '; nunca no Prompt para IA).';
        var semanticos = buscaSemanticaCandidatos(l.item, atividades);
        extraHtml = semanticos.length
          ? '<div style="margin-bottom:8px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Lugares parecidos (busca aproximada por palavras-chave — sem certeza, confira manualmente)</strong><div style="margin-top:4px;color:var(--ink-2)">' +
            semanticos.map(function (c) { return esc(c.atividade.titulo) + ' — ' + esc(CAMPOS_MIGRACAO_LABEL[c.campo] || c.campo) + ' (' + Math.round(c.score * 100) + '% das palavras do "DE" aparecem lá)'; }).join('<br>') + '</div></div>'
          : '<p style="font-size:.72rem;color:var(--ink-3);margin:0 0 8px">Nenhum lugar parecido encontrado, nem por busca aproximada de palavras-chave.</p>';
      }
      return '<div class="mig-painel" style="background:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;padding:14px;margin:6px 0;font-size:.8rem">' +
        '<div style="margin-bottom:8px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Atividade esperada (origem do pedido)</strong><div style="white-space:pre-wrap;margin-top:4px;color:var(--ink)">' + esc(origem) + '</div></div>' +
        '<div style="margin-bottom:8px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Campo esperado</strong><div style="margin-top:4px;color:var(--ink-2)">Qualquer um entre: ' + esc(camposBuscados) + '</div></div>' +
        '<div style="margin-bottom:8px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Texto DE</strong><div style="white-space:pre-wrap;margin-top:4px;color:var(--ink-2)">' + esc(l.item.de) + '</div></div>' +
        '<div style="margin-bottom:10px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Texto PARA</strong><div style="white-space:pre-wrap;margin-top:4px;color:var(--ink-2)">' + esc(l.item.para) + '</div></div>' +
        '<p style="font-size:.72rem;color:#ff8a5c;margin:0 0 8px">' + esc(motivoTxt) + '</p>' +
        extraHtml +
        '<div class="mig-decisao-botoes" style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn--primary mig-dec" data-dec="visto">Marquei como visto (nada a gravar aqui)</button>' +
        '</div>' +
      '</div>';
    }
    function painelRevisaoHtml(l) {
      if (l.item.acao === 'duracao') return painelRevisaoDuracaoHtml(l);
      if (l.status === 'TRECHO NÃO LOCALIZADO' || l.status === 'TRECHO ENCONTRADO EM MAIS DE UM LUGAR') return painelRevisaoBuscaAmplaHtml(l);
      var atualPlano = textoPlanoMigracao(l.valorAtual).trim() || '(vazio)';
      var deTxt = l.item.acao === 'substituir_campo'
        ? '(sem "DE" — este item substitui o CAMPO INTEIRO, não é busca de trecho)'
        : (l.item.de || '(sem "DE" — este item é uma inclusão nova, o campo estava vazio)');
      var paraTxt = l.item.para;
      var ehTrecho = l.item.acao === 'substituir' || l.item.acao === 'substituir_trecho';
      var trechoRepetido = l.status === 'TRECHO AMBÍGUO';
      /* Exibição do "PARA" vazio (item que pede remover o campo por
         inteiro, ex: Observações do Primeiro uso da IA) — só cosmético,
         nunca troca o valor de verdade usado pra gravar (paraTxt em
         si continua '' pra "Mesclar manualmente" abrir uma caixa
         realmente vazia, não um texto fictício). */
      var paraTxtExibicao = paraTxt ? paraTxt : '(campo deve ficar vazio)';
      var cabecalho =
        '<div style="margin-bottom:8px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Atual no sistema</strong><div style="white-space:pre-wrap;margin-top:4px;color:var(--ink)">' + esc(atualPlano) + '</div></div>' +
        '<div style="margin-bottom:8px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">DE do Excel' + (ehTrecho ? ' (trecho procurado dentro do campo acima)' : '') + '</strong><div style="white-space:pre-wrap;margin-top:4px;color:var(--ink-2)">' + esc(deTxt) + '</div></div>' +
        '<div style="margin-bottom:10px"><strong style="color:var(--ink-3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">PARA do Excel</strong><div style="white-space:pre-wrap;margin-top:4px;color:var(--ink-2)">' + esc(paraTxtExibicao) + '</div></div>';

      /* "VALOR ATUAL DIVERGENTE" num campo de texto (nunca em Tipo, que
         não tem o que mesclar) ganha uma PROPOSTA DE MESCLA gerada
         sozinha — comparação de 3 vias, não precisa montar nada do
         zero. TRECHO AMBÍGUO (trecho repetido) e divergência de Tipo
         continuam com o fluxo mais simples de antes (o valor "de" ali
         é curto/discreto, não precisa de merge). */
      if (l.status === 'VALOR ATUAL DIVERGENTE' && l.item.acao !== 'tipo' && l.item.de) {
        var proposta = gerarPropostaMescla(atualPlano, l.item.de, paraTxt);
        var corProposta = proposta.temConflito ? '#ff8a5c' : 'var(--ink)';
        return '<div class="mig-painel" style="background:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;padding:14px;margin:6px 0;font-size:.8rem">' +
          cabecalho +
          '<div style="margin-bottom:10px"><strong style="color:var(--gold);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">Proposta de mesclagem (gerada automaticamente)</strong><div class="mig-proposta-texto" style="white-space:pre-wrap;margin-top:4px;color:' + corProposta + ';background:var(--panel);border:1px solid var(--line-strong);border-radius:6px;padding:8px">' + esc(proposta.texto || '(vazio)') + '</div></div>' +
          (proposta.temConflito ? '<p style="color:#ff8a5c;font-size:.72rem;margin:0 0 8px">O valor atual e a planilha acrescentam coisas diferentes no mesmo ponto — marcado acima como CONFLITO. "Aprovar mesclagem" fica bloqueado até você resolver isso em "Editar mescla".</p>' : '<p style="font-size:.72rem;color:var(--ink-3);margin:0 0 8px">Confira a proposta acima antes de aprovar — ela preserva o que já existia e incorpora a mudança da planilha, mas pode não ter entendido tudo perfeitamente.</p>') +
          '<div class="mig-mescla-area" style="display:none;margin-bottom:10px">' +
            '<label class="auth-label">Editar proposta livremente (nada é gravado até "Confirmar mesclagem")<textarea class="mig-mescla-texto" rows="8" style="width:100%;padding:8px;background:var(--panel);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:inherit">' + esc(proposta.texto) + '</textarea></label>' +
            '<button class="btn btn--primary mig-mescla-confirmar" style="margin-top:6px">Confirmar mesclagem</button>' +
          '</div>' +
          '<div class="mig-decisao-botoes" style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn--primary mig-dec" data-dec="mesclar-auto"' + (proposta.temConflito ? ' disabled title="Resolva o conflito marcado acima em \'Editar mescla\' antes de aprovar"' : '') + '>Aprovar mesclagem</button>' +
            '<button class="btn mig-editar-btn">Editar mescla</button>' +
            '<button class="btn mig-dec" data-dec="manter">Manter atual</button>' +
          '</div>' +
        '</div>';
      }

      var trechoNaoAchado = ehTrecho && l.status === 'VALOR ATUAL DIVERGENTE';
      return '<div class="mig-painel" style="background:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;padding:14px;margin:6px 0;font-size:.8rem">' +
        cabecalho +
        (trechoNaoAchado ? '<p style="color:#ff8a5c;font-size:.72rem;margin:0 0 8px">O texto "DE" não aparece no valor atual — nem exatamente, nem tolerando aspas/espaços/quebras de linha diferentes — "Substituir pelo PARA" não vai achar onde trocar. Use "Mesclar manualmente" pra decidir onde o texto novo entra.</p>' : '') +
        (trechoRepetido ? '<p style="color:#ff8a5c;font-size:.72rem;margin:0 0 8px">O texto "DE" aparece ' + l.ocorrencias + ' vezes no valor atual — "Substituir pelo PARA" trocaria TODAS as ocorrências de uma vez. Confira se é isso mesmo antes de escolher, ou use "Mesclar manualmente" pra decidir caso a caso.</p>' : '') +
        '<div class="mig-mescla-area" style="display:none;margin-bottom:10px">' +
          '<label class="auth-label">Proposta de texto final — edite livremente (nada é gravado até "Confirmar mesclagem")<textarea class="mig-mescla-texto" rows="6" style="width:100%;padding:8px;background:var(--panel);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:inherit">' + esc(paraTxt) + '</textarea></label>' +
          '<button class="btn btn--primary mig-mescla-confirmar" style="margin-top:6px">Confirmar mesclagem</button>' +
        '</div>' +
        '<div class="mig-decisao-botoes" style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn mig-dec" data-dec="manter">Manter atual</button>' +
          '<button class="btn mig-dec" data-dec="usar_para">Substituir pelo PARA</button>' +
          (l.item.acao !== 'tipo' ? '<button class="btn mig-dec" data-dec="mesclar">Mesclar manualmente</button>' : '') +
        '</div>' +
      '</div>';
    }

    function render() {
      var okCount = linhas.filter(function (l) { return l.status === 'OK PARA ALTERAR'; }).length;
      var jaCount = linhas.filter(function (l) { return l.status === 'JÁ ATUALIZADO'; }).length;
      var manterCount = linhas.filter(function (l) { return l.decisaoTipo === 'manter'; }).length;
      var usarParaCount = linhas.filter(function (l) { return l.decisaoTipo === 'usar_para'; }).length;
      var mesclaCount = linhas.filter(function (l) { return l.decisaoTipo === 'mesclar'; }).length;
      var pendenciasCount = linhas.filter(function (l) {
        return l.status === 'ATIVIDADE NÃO ENCONTRADA' || l.status === 'REGISTRO AMBÍGUO' || (precisaRevisao(l) && !l.decisaoTipo);
      }).length;
      var totalDiv = totalDivergentes();
      var resolvidasDiv = divergentesResolvidas();
      var podeAplicar = !pendenteAlgumaDivergencia();
      var aplicarLista = linhasParaAplicar();

      var linhasHtml = linhas.map(function (l, i) {
        var statusTxt = l.status, cor = corPorStatus[l.status] || 'var(--ink-2)', acaoCol = '';
        if (precisaRevisao(l)) {
          if (l.decisaoTipo) {
            statusTxt = 'DIVERGÊNCIA RESOLVIDA → ' + labelDecisao[l.decisaoTipo];
            cor = corPorStatus['DIVERGÊNCIA RESOLVIDA'];
            acaoCol = '<button class="btn mig-revisar-btn" data-idx="' + i + '" style="font-size:.7rem;padding:4px 8px">Revisar de novo</button>';
          } else {
            acaoCol = '<button class="btn btn--primary mig-revisar-btn" data-idx="' + i + '" style="font-size:.7rem;padding:4px 8px">REVISAR</button>';
          }
        }
        /* Item "tituloQualquer" (busca ampla, sem título fixo): a coluna
           Atividade mostra onde foi achado (ou por que não), já que
           l.item.titulo só existe quando resolveu pra um lugar único. */
        var tituloCol = l.item.tituloQualquer
          ? (l.atividade ? l.atividade.titulo + ' (localizado automaticamente)' :
             (l.status === 'TRECHO ENCONTRADO EM MAIS DE UM LUGAR' ? l.candidatos.length + ' lugares diferentes' : '(trecho não encontrado em nenhuma atividade)'))
          : l.item.titulo;
        var campoCol = l.item.campo ? (CAMPOS_MIGRACAO_LABEL[l.item.campo] || l.item.campo) : '—';
        var linhaTr = '<tr' + (revisandoIdx === i ? ' style="background:rgba(255,255,255,.05)"' : '') + '>' +
          '<td>' + esc(tituloCol) + '</td>' +
          '<td>' + esc(campoCol) + '</td>' +
          '<td style="color:' + cor + '">' + esc(statusTxt) + '</td>' +
          '<td>' + acaoCol + '</td>' +
          '</tr>';
        var linhaDetalhe = '';
        if (l.item.acao === 'duracao' && l.status !== 'JÁ ATUALIZADO') {
          linhaDetalhe = '<tr><td colspan="4" style="font-size:.72rem;color:var(--ink-3);padding:2px 10px 10px">' +
            'Duração: ' + l.valorAtual + ' min → ' + l.item.paraMinutos + ' min' +
            (l.horaFimAtual ? ' · Fim: ' + esc(l.horaFimAtual) + ' → ' + esc(l.horaFimNovo) : '') +
            (l.seguintes && l.seguintes.length ? ' · Ajusta o início de ' + l.seguintes.length + ' atividade(s) seguinte(s) do dia: ' + l.seguintes.map(function (s) { return esc(s.atividade.titulo) + ' (' + esc(s.horaInicioAtual) + '→' + esc(s.horaInicioNovo) + ')'; }).join(', ') : '') +
            '</td></tr>';
        } else if (l.status === 'TRECHO ENCONTRADO EM MAIS DE UM LUGAR') {
          linhaDetalhe = '<tr><td colspan="4" style="font-size:.72rem;color:var(--ink-3);padding:2px 10px 10px">Encontrado em: ' +
            l.candidatos.map(function (c) { return esc(c.atividade.titulo) + ' — ' + esc(CAMPOS_MIGRACAO_LABEL[c.campo] || c.campo) + (c.ocorrencias > 1 ? ' (' + c.ocorrencias + 'x)' : ''); }).join('; ') +
            ' — resolva manualmente qual é o lugar certo, o sistema não decide sozinho quando há mais de uma opção.</td></tr>';
        }
        return linhaTr + linhaDetalhe + (revisandoIdx === i ? ('<tr><td colspan="4">' + painelRevisaoHtml(l) + '</td></tr>') : '');
      }).join('');

      box.innerHTML =
        '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + esc(tituloModal) + '</h3>' +
        '<p style="font-size:.82rem;color:var(--ink-3)">DRY RUN — nada foi gravado ainda.' + (totalDiv ? ' Revisadas ' + resolvidasDiv + ' de ' + totalDiv + ' divergências.' : '') + '</p>' +
        '<div style="overflow:auto;max-height:48vh;border:1px solid var(--line-strong);border-radius:8px">' +
          '<table style="width:100%;border-collapse:collapse;font-size:.78rem">' +
          '<thead><tr style="background:var(--panel-2);position:sticky;top:0"><th style="text-align:left;padding:8px 10px">Atividade</th><th style="text-align:left;padding:8px 10px">Campo</th><th style="text-align:left;padding:8px 10px">Status</th><th style="text-align:left;padding:8px 10px"></th></tr></thead>' +
          '<tbody>' + linhasHtml + '</tbody></table>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:14px;font-size:.72rem;color:var(--ink-3);padding:10px 14px;background:var(--panel-2);border-radius:8px">' +
          '<span>OK PARA ALTERAR: <b style="color:var(--ink)">' + okCount + '</b></span>' +
          '<span>JÁ ATUALIZADO: <b style="color:var(--ink)">' + jaCount + '</b></span>' +
          '<span>MANTER ATUAL: <b style="color:var(--ink)">' + manterCount + '</b></span>' +
          '<span>USAR PARA: <b style="color:var(--ink)">' + usarParaCount + '</b></span>' +
          '<span>MESCLA APROVADA: <b style="color:var(--ink)">' + mesclaCount + '</b></span>' +
          '<span>PENDÊNCIAS: <b style="color:var(--ink)">' + pendenciasCount + '</b></span>' +
        '</div>' +
        (!podeAplicar ? '<p style="font-size:.72rem;color:var(--ink-3)">"Aplicar" libera assim que todas as divergências tiverem uma decisão (as pendências de atividade não encontrada/ambígua não bloqueiam — elas simplesmente nunca entram na aplicação).</p>' : '') +
        '<p id="migErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none"></p>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="btn mig-fechar">Fechar</button>' +
          (podeAplicar && aplicarLista.length ? '<button class="btn btn--primary mig-aplicar">Aplicar alterações confirmadas (' + aplicarLista.length + ')</button>' : '') +
        '</div>';

      box.querySelector('.mig-fechar').addEventListener('click', close);
      Array.prototype.forEach.call(box.querySelectorAll('.mig-revisar-btn'), function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-idx'));
          revisandoIdx = (revisandoIdx === idx) ? null : idx;
          render();
        });
      });
      var painel = box.querySelector('.mig-painel');
      if (painel) {
        var l = linhas[revisandoIdx];
        Array.prototype.forEach.call(painel.querySelectorAll('.mig-dec'), function (btn) {
          btn.addEventListener('click', function () {
            var dec = btn.getAttribute('data-dec');
            if (dec === 'mesclar') { painel.querySelector('.mig-mescla-area').style.display = ''; return; }
            if (dec === 'mesclar-auto') {
              /* "Aprovar mesclagem" recalcula a mesma proposta mostrada
                 na tela (determinística — mesmos ATUAL/DE/PARA sempre
                 geram o mesmo resultado) e grava direto, sem precisar
                 abrir a caixa de edição. */
              var propostaAprovada = gerarPropostaMescla(textoPlanoMigracao(l.valorAtual).trim(), l.item.de, l.item.para);
              l.decisaoTipo = 'mesclar';
              l.valorMesclado = propostaAprovada.texto;
              revisandoIdx = proximaDivergentePendente(revisandoIdx);
              render();
              return;
            }
            l.decisaoTipo = dec;
            revisandoIdx = proximaDivergentePendente(revisandoIdx);
            render();
          });
        });
        var editarBtn = painel.querySelector('.mig-editar-btn');
        if (editarBtn) {
          editarBtn.addEventListener('click', function () { painel.querySelector('.mig-mescla-area').style.display = ''; });
        }
        var confirmarMescla = painel.querySelector('.mig-mescla-confirmar');
        if (confirmarMescla) {
          confirmarMescla.addEventListener('click', function () {
            l.decisaoTipo = 'mesclar';
            l.valorMesclado = painel.querySelector('.mig-mescla-texto').value;
            revisandoIdx = proximaDivergentePendente(revisandoIdx);
            render();
          });
        }
        /* Cenário B da "duracao": o <select> atualiza só a prévia (sem
           re-renderizar o modal inteiro, pra não perder a seleção) —
           só "Confirmar cenário B" de fato registra a decisão e avança. */
        var selectCompensar = painel.querySelector('.mig-duracao-compensar-select');
        if (selectCompensar) {
          var previewB = painel.querySelector('.mig-duracao-preview-b');
          var confirmarCompensarBtn = painel.querySelector('.mig-duracao-compensar-confirmar');
          selectCompensar.addEventListener('change', function () {
            var key = selectCompensar.value;
            if (!key) {
              previewB.innerHTML = 'Escolha uma atividade acima para ver o impacto.';
              confirmarCompensarBtn.disabled = true;
              return;
            }
            previewB.innerHTML = resumoImpactoDuracaoHtml(atividades, l, key);
            confirmarCompensarBtn.disabled = false;
          });
          confirmarCompensarBtn.addEventListener('click', function () {
            var key = selectCompensar.value;
            if (!key) return;
            l.decisaoTipo = 'compensar';
            l.atividadeCompensarKey = key;
            revisandoIdx = proximaDivergentePendente(revisandoIdx);
            render();
          });
        }
      }
      var aplicarBtn = box.querySelector('.mig-aplicar');
      if (aplicarBtn) {
        aplicarBtn.addEventListener('click', function () {
          var lista = linhasParaAplicar();
          confirmDialog('Isso vai gravar ' + lista.length + ' alteração(ões) no roteiro-base (inclui as decisões tomadas nesta revisão). O valor anterior de cada campo tocado fica guardado — dá pra desfazer depois pelo botão "↩ Desfazer última migração". Continuar?', function () {
            aplicarMigracaoAntesDepois(eventoKey, lista, function (err, atualizados) {
              close();
              if (err) { alertDialog('Erro ao aplicar a migração: ' + err); return; }
              alertDialog('Aplicado: ' + atualizados + ' de ' + lista.length + ' alteração(ões).\n\nUse "↩ Desfazer última migração" se precisar reverter.');
              reload();
            });
          });
        });
      }
    }

    function close() { document.body.removeChild(overlay); }
    var overlayMousedownFora = false;
    overlay.addEventListener('mousedown', function (e) { overlayMousedownFora = !box.contains(e.target); });
    overlay.addEventListener('click', function (e) { if (overlayMousedownFora && !box.contains(e.target)) close(); });

    render();
  }

  function renderRoteiroBaseEditor(container, eventoKey) {
    var diaAtivoKey = null;

    function reload() { carregarRoteiroEvento(eventoKey, function (err, roteiro) { desenhar(roteiro); }); }

    /* Duração mudou numa atividade de NÍVEL PRINCIPAL com horário definido
       — oferece deslocar em cadeia as atividades seguintes do mesmo dia
       (também de nível principal, também com horário) na mesma diferença,
       sem fazer isso silenciosamente. Sub-etapas nunca entram nessa
       cadeia: quem tem horário próprio e posição no dia é só o pai. */
    function ofereceRecalculo(atividadeKey, delta, horaInicioNovo, atividadesTopoDoDia, cb) {
      if (!delta || !horaInicioNovo) return cb();
      var idx = atividadesTopoDoDia.findIndex(function (x) { return x.key === atividadeKey; });
      var seguintes = atividadesTopoDoDia.slice(idx + 1).filter(function (x) { return x.horaInicio; });
      if (!seguintes.length) return cb();
      escolhaDialog(
        'A duração desta atividade foi alterada em ' + (delta > 0 ? '+' : '') + delta + ' min.\n\n' +
        'Deseja recalcular automaticamente o horário das ' + seguintes.length + ' atividade(s) seguinte(s) deste dia?',
        'Recalcular', function () {
          var updates = {};
          seguintes.forEach(function (s) {
            var novoInicio = hhmmParaMin(s.horaInicio) + delta;
            updates[s.key] = { horaInicio: minParaHhmm(novoInicio), horaFim: s.horaFim ? minParaHhmm(hhmmParaMin(s.horaFim) + delta) : s.horaFim };
          });
          var chamadas = Object.keys(updates).length;
          Object.keys(updates).forEach(function (k) {
            editarAtividade(eventoKey, k, updates[k], function () { if (!--chamadas) cb(); });
          });
        },
        'Manter horários', cb
      );
    }

    function desenhar(roteiro) {
      container.innerHTML = '';
      if (!diaAtivoKey || !roteiro.dias.some(function (d) { return d.key === diaAtivoKey; })) {
        diaAtivoKey = roteiro.dias.length ? roteiro.dias[0].key : null;
      }

      var tabsWrap = document.createElement('div');
      tabsWrap.style.cssText = 'position:sticky;top:0;background:var(--panel,#0c1528);z-index:2;padding-bottom:8px';
      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
      roteiro.dias.forEach(function (dia, i) {
        var b = document.createElement('button');
        b.className = 'btn btn--sm' + (dia.key === diaAtivoKey ? ' btn--primary' : '');
        b.style.cssText = 'padding:6px 12px;font-size:.75rem';
        b.textContent = 'DIA ' + (i + 1) + (dia.titulo ? ' — ' + dia.titulo : '');
        b.addEventListener('click', function () { diaAtivoKey = dia.key; desenhar(roteiro); });
        tabs.appendChild(b);
      });
      var addDiaBtn = document.createElement('button');
      addDiaBtn.className = 'btn btn--sm';
      addDiaBtn.style.cssText = 'padding:6px 12px;font-size:.75rem';
      addDiaBtn.textContent = '+ Dia';
      addDiaBtn.addEventListener('click', function () {
        criarDia(eventoKey, roteiro.dias, function (err, key) { if (!err) { diaAtivoKey = key; reload(); } });
      });
      tabs.appendChild(addDiaBtn);
      tabsWrap.appendChild(tabs);
      container.appendChild(tabsWrap);

      if (!roteiro.dias.length) {
        var vazio = document.createElement('p');
        vazio.className = 'admin-empty';
        vazio.textContent = 'Nenhum dia cadastrado neste roteiro. Clique em "+ Dia" para começar.';
        container.appendChild(vazio);
        return;
      }

      var dia = roteiro.dias.filter(function (d) { return d.key === diaAtivoKey; })[0];
      var atividadesDia = atividadesDoDia(roteiro.atividades, dia.key); /* topo + filhas */
      var atividadesTopo = atividadesDia.filter(function (a) { return !a.paiKey; });
      var grupos = agruparPorSessao(atividadesTopo, atividadesDia);
      if (!grupos.length) grupos.push({ nome: '', atividades: [] });

      var diaHdr = document.createElement('div');
      diaHdr.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap';
      var renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.placeholder = 'Título do dia (opcional)';
      renameInput.value = dia.titulo || '';
      renameInput.style.cssText = 'flex:1;min-width:180px;padding:6px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)';
      renameInput.addEventListener('change', function () { renomearDia(eventoKey, dia.key, renameInput.value.trim(), function () { reload(); }); });
      var imprimirBtn = document.createElement('button');
      imprimirBtn.className = 'btn btn--sm';
      imprimirBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
      imprimirBtn.innerHTML = '&#x1F5A8; Agenda resumida';
      imprimirBtn.title = 'Abre uma janela de impressão só com o resumo do dia e a lista de atividades (sem os campos de facilitação) — pode salvar como PDF.';
      imprimirBtn.addEventListener('click', function () { imprimirRoteiroDia('Roteiro-base', dia, atividadesTopo, atividadesDia); });
      var imprimirCompletoBtn = document.createElement('button');
      imprimirCompletoBtn.className = 'btn btn--sm';
      imprimirCompletoBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
      imprimirCompletoBtn.innerHTML = '&#x1F5A8; Roteiro completo';
      imprimirCompletoBtn.title = 'Abre uma janela de impressão com um bloco por atividade e etapa, trazendo todo o conteúdo de facilitação preenchido — pode salvar como PDF.';
      imprimirCompletoBtn.addEventListener('click', function () { imprimirRoteiroCompleto('Roteiro-base', dia, atividadesTopo, atividadesDia); });
      var imprimirPassoAPassoBtn = document.createElement('button');
      imprimirPassoAPassoBtn.className = 'btn btn--sm';
      imprimirPassoAPassoBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
      imprimirPassoAPassoBtn.innerHTML = '&#x1F5A8; Passo a passo';
      imprimirPassoAPassoBtn.title = 'Abre uma janela de impressão com um bloco por atividade e etapa, só com o campo "Passo a passo" — sem objetivo, dicas, conexão com a agilidade e demais campos internos — pode salvar como PDF.';
      imprimirPassoAPassoBtn.addEventListener('click', function () { imprimirRoteiroPassoAPasso('Roteiro-base', dia, atividadesTopo, atividadesDia); });
      var imprimirObjetivosBtn = document.createElement('button');
      imprimirObjetivosBtn.className = 'btn btn--sm';
      imprimirObjetivosBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
      imprimirObjetivosBtn.innerHTML = '&#x1F5A8; Agenda + Objetivos';
      imprimirObjetivosBtn.title = 'Abre uma janela de impressão com a mesma tabela da Agenda resumida, mais Objetivo e Resultado esperado de cada atividade — pode salvar como PDF.';
      imprimirObjetivosBtn.addEventListener('click', function () { imprimirRoteiroAgendaObjetivos('Roteiro-base', dia, atividadesTopo, atividadesDia); });
      var delDiaBtn = document.createElement('button');
      delDiaBtn.className = 'btn btn--sm';
      delDiaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080';
      delDiaBtn.textContent = '🗑 Excluir dia';
      delDiaBtn.addEventListener('click', function () {
        var msg = atividadesDia.length
          ? 'Excluir este dia e suas ' + atividadesDia.length + ' atividade(s)? Personalizações feitas por turmas nessas atividades também serão apagadas. Não é possível desfazer.'
          : 'Excluir este dia?';
        confirmDialog(msg, function () { excluirDia(eventoKey, dia.key, atividadesDia, function () { diaAtivoKey = null; reload(); }); });
      });
      diaHdr.appendChild(renameInput);
      diaHdr.appendChild(imprimirBtn);
      diaHdr.appendChild(imprimirCompletoBtn);
      diaHdr.appendChild(imprimirPassoAPassoBtn);
      diaHdr.appendChild(imprimirObjetivosBtn);
      diaHdr.appendChild(delDiaBtn);
      container.appendChild(diaHdr);

      var resumosPorGrupo = grupos.map(function (g) { return calcularResumoDia(g.atividades, atividadesDia); });
      if (grupos.length > 1) container.insertAdjacentHTML('beforeend', resumoSessoesHtml(grupos, resumosPorGrupo, 'rbResumoSessoes'));

      grupos.forEach(function (grupo, gi) {
        var resumo = resumosPorGrupo[gi];

        if (grupos.length > 1) {
          var sessaoHdr = document.createElement('h4');
          sessaoHdr.style.cssText = 'font-family:var(--font-head);letter-spacing:.06em;font-size:.8rem;color:var(--gold);margin:' + (gi ? '20px' : '4px') + ' 0 8px;padding-top:' + (gi ? '16px' : '0') + ';border-top:' + (gi ? '1px solid var(--line-strong)' : 'none');
          sessaoHdr.textContent = (grupo.nome || 'Sem sessão definida') + ' · ' + grupo.atividades.length + ' atividade' + (grupo.atividades.length !== 1 ? 's' : '');
          container.appendChild(sessaoHdr);
        }

        container.insertAdjacentHTML('beforeend', resumoDiaHtml(resumo, 'rbResumoTopo_' + gi, grupos.length > 1));

        if (ordemDivergeDoHorario(grupo.atividades)) {
          var bannerOrdem = document.createElement('div');
          bannerOrdem.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:rgba(255,179,71,.08);border:1px solid rgba(255,179,71,.35);border-radius:8px;margin-bottom:12px;font-size:.82rem;color:#ffb347';
          bannerOrdem.innerHTML = '<span>⚠ Existem atividades fora da ordem cronológica' + (grupo.nome ? ' em "' + esc(grupo.nome) + '"' : '') + '.</span>';
          var ordenarBtn = document.createElement('button');
          ordenarBtn.className = 'btn btn--sm';
          ordenarBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;margin-left:auto';
          ordenarBtn.textContent = 'Ordenar por horário';
          ordenarBtn.addEventListener('click', function () {
            var comHorario = grupo.atividades.filter(function (a) { return a.horaInicio; }).slice()
              .sort(function (a, b) { return hhmmParaMin(a.horaInicio) - hhmmParaMin(b.horaInicio); });
            var updates = {};
            comHorario.forEach(function (a, i) { updates[a.key] = (i + 1) * 10; });
            var pend = comHorario.length;
            if (!pend) return;
            comHorario.forEach(function (a) {
              db().ref('roteiros-evento/' + eventoKey + '/atividades/' + a.key + '/ordem').set(updates[a.key], function () { if (!--pend) reload(); });
            });
          });
          bannerOrdem.appendChild(ordenarBtn);
          container.appendChild(bannerOrdem);
        }

        container.insertAdjacentHTML('beforeend', bannerSobreposicoesHtml(resumo.sobreposicoes));

        var lista = document.createElement('div');
        lista.style.cssText = 'display:flex;flex-direction:column;gap:6px';
        lista.insertAdjacentHTML('beforeend', colunasHeaderHtml());
        if (!grupo.atividades.length) {
          lista.insertAdjacentHTML('beforeend', '<p class="admin-empty">Nenhuma atividade nesta sessão.</p>');
        }

        grupo.atividades.forEach(function (a, i) {
          /* Lacuna antes desta atividade, se ela é a próxima na ordem
             cronológica logo depois de um "buraco" detectado no resumo
             desta sessão (nunca no vão entre uma sessão e a seguinte). */
          var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
          if (gapAntes) lista.insertAdjacentHTML('beforeend', gapRowHtml(gapAntes));

          lista.appendChild(linhaAtividade(a, i + 1, grupo.atividades, null));

          var filhos = filhosDe(atividadesDia, a.key);
          var recolhida = !!_secoesRecolhidas[a.key];
          if (filhos.length && !recolhida) {
            filhos.forEach(function (f, j) {
              lista.appendChild(linhaAtividade(f, j + 1, filhos, i + 1, { atividade: a, irmaos: grupo.atividades }));
            });
          }
        });
        container.appendChild(lista);

        container.insertAdjacentHTML('beforeend', resumoDiaHtml(resumo, 'rbResumoRodape_' + gi, grupos.length > 1));
      });

      var addAtvBtn = document.createElement('button');
      addAtvBtn.className = 'btn btn--sm btn--primary';
      addAtvBtn.style.cssText = 'margin-top:4px;padding:6px 14px;font-size:.75rem';
      addAtvBtn.textContent = '+ Adicionar atividade';
      addAtvBtn.addEventListener('click', function () {
        abrirFormAtividade({
          titulo: 'Nova atividade',
          onSalvar: function (dados) { criarAtividade(eventoKey, dia.key, dados, atividadesTopo, function () { reload(); }); }
        });
      });
      container.appendChild(addAtvBtn);

      /* Uma única função de linha serve nível principal e sub-etapa —
         a diferença é só visual (recuo) e o que "+ Sub-etapa" faz (só
         aparece no nível principal, pra não abrir um terceiro nível na
         tela). numeroPai null = linha de nível principal. */
      function linhaAtividade(a, numero, irmaos, numeroPai, paiInfo) {
        var ehFilho = numeroPai != null;
        var row = document.createElement('div');
        row.style.cssText = ehFilho
          ? 'display:flex;align-items:center;gap:10px;padding:6px 14px 6px 40px;margin-left:28px;border-left:2px solid var(--line-strong);background:rgba(255,255,255,.015);border-radius:0 8px 8px 0;flex-wrap:wrap'
          : 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;flex-wrap:wrap';
        /* Sub-etapa sem horário próprio não mostra "—" (dá impressão de
           dado ausente) — simplesmente não exibe coluna de horário. */
        var horario = a.horaInicio ? (a.horaInicio + (a.horaFim ? '–' + a.horaFim : '')) : (ehFilho ? '' : '—');
        var filhosDesta = ehFilho ? [] : filhosDe(atividadesDia, a.key);
        var ehSecao = filhosDesta.length > 0;
        var recolhida = !!_secoesRecolhidas[a.key];
        var numeroTxt = ehFilho ? (numeroPai + '.' + numero) : String(numero);
        /* Numa seção, tipo + duração + contagem de etapas viram uma única
           linha auxiliar sob o título (ex: "Dinâmica · 15 min · 6 etapas")
           em vez de espalhados em colunas — mais perto do protótipo. */
        var metaSecao = ehSecao
          ? [a.tipo, fmtDuracao(duracaoEfetiva(a, atividadesDia)), filhosDesta.length + ' etapa' + (filhosDesta.length !== 1 ? 's' : '')].filter(Boolean).join(' · ')
          : '';
        row.innerHTML =
          '<span style="width:30px;text-align:center;font-family:var(--font-mono);font-size:.7rem;color:var(--ink-3);' + (ehFilho ? '' : 'background:var(--panel);border-radius:4px;padding:2px 0;') + '">' + numeroTxt + '</span>' +
          (horario ? '<span style="font-family:var(--font-mono);font-size:' + (ehFilho ? '.72rem' : '.78rem') + ';color:' + (ehFilho ? 'var(--ink-3)' : 'var(--gold)') + ';min-width:96px">' + esc(horario) + '</span>' : '<span style="min-width:96px"></span>') +
          '<div style="flex:1;min-width:140px;display:flex;flex-direction:column;gap:1px">' +
            '<span style="color:' + (ehFilho ? 'var(--ink-2)' : 'var(--ink)') + ';font-size:' + (ehFilho ? '.85rem' : '1rem') + '">' + esc(a.titulo) + '</span>' +
            (metaSecao ? '<span style="font-size:.7rem;color:var(--ink-3)">' + esc(metaSecao) + '</span>' : '') +
          '</div>' +
          (!ehSecao && a.tipo ? '<span class="turma-status-badge" style="background:var(--panel);color:' + (a.tipo === 'Intervalo' ? '#ffb347' : 'var(--ink-3)') + ';border:1px solid var(--line-strong)">' + esc(a.tipo) + '</span>' : '') +
          (!ehSecao ? '<span style="font-size:.75rem;color:var(--ink-3);width:64px">' + fmtDuracao(duracaoEfetiva(a, atividadesDia)) + '</span>' : '');
        var acoes = document.createElement('div');
        acoes.style.cssText = 'display:flex;gap:4px;margin-left:auto;flex-wrap:wrap';
        var estiloBtnAcao = ehFilho ? 'padding:3px 7px;font-size:.68rem' : 'padding:4px 8px';
        var estiloBtnAcaoTxt = ehFilho ? 'padding:3px 7px;font-size:.68rem' : 'padding:4px 8px;font-size:.72rem';
        if (ehSecao) {
          var toggleBtn = document.createElement('button');
          toggleBtn.className = 'btn btn--sm'; toggleBtn.style.cssText = 'padding:4px 8px;font-size:.72rem';
          toggleBtn.textContent = recolhida ? '▼ Ver etapas' : '▲ Recolher';
          toggleBtn.addEventListener('click', function () { _secoesRecolhidas[a.key] = !recolhida; desenhar(roteiro); });
          acoes.appendChild(toggleBtn);
        }
        var upBtn = document.createElement('button'); upBtn.className = 'btn btn--sm'; upBtn.style.cssText = estiloBtnAcao; upBtn.textContent = '▲'; upBtn.disabled = numero === 1;
        upBtn.addEventListener('click', function () { moverAtividade(eventoKey, a.key, 'up', irmaos, function () { reload(); }); });
        var downBtn = document.createElement('button'); downBtn.className = 'btn btn--sm'; downBtn.style.cssText = estiloBtnAcao; downBtn.textContent = '▼'; downBtn.disabled = numero === irmaos.length;
        downBtn.addEventListener('click', function () { moverAtividade(eventoKey, a.key, 'down', irmaos, function () { reload(); }); });
        var dupBtn = document.createElement('button'); dupBtn.className = 'btn btn--sm'; dupBtn.style.cssText = estiloBtnAcaoTxt; dupBtn.textContent = 'Duplicar';
        dupBtn.addEventListener('click', function () { duplicarAtividade(eventoKey, a, irmaos, atividadesDia, function () { reload(); }); });
        var editBtn = document.createElement('button'); editBtn.className = 'btn btn--sm'; editBtn.style.cssText = estiloBtnAcaoTxt; editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: ehFilho ? 'Editar etapa' : 'Editar atividade', existente: a, filhosCount: filhosDesta.length,
            duracaoSomaFilhos: filhosDesta.length ? duracaoEfetiva(a, atividadesDia) : undefined,
            onSalvar: function (dados) {
              var duracaoAntes = duracaoEfetiva(a, atividadesDia);
              editarAtividade(eventoKey, a.key, dados, function () {
                var duracaoDepois = filhosDesta.length ? duracaoAntes : (Number(dados.duracaoMinutos) || 0);
                if (!ehFilho) {
                  /* "irmãos" já é a lista da mesma sessão (não o dia inteiro) —
                     a cadeia de recálculo nunca deve mexer noutra sessão. */
                  return ofereceRecalculo(a.key, duracaoDepois - duracaoAntes, dados.horaInicio, irmaos, function () { reload(); });
                }
                /* Etapa: a duração do pai é sempre a soma das etapas — muda
                   sozinha aqui (nunca peça pra editar o pai à toa), e se o
                   pai tiver horário próprio, o Fim dele desloca junto e a
                   cadeia de recálculo dos IRMÃOS DO PAI (não da etapa) é
                   oferecida, exatamente como se a duração tivesse mudado
                   editando o pai diretamente. */
                if (!paiInfo) return reload();
                var deltaPai = duracaoDepois - duracaoAntes;
                if (!deltaPai || !paiInfo.atividade.horaInicio) return reload();
                var novoFimPai = minParaHhmm(hhmmParaMin(paiInfo.atividade.horaInicio) + duracaoEfetiva(paiInfo.atividade, atividadesDia) + deltaPai);
                editarAtividade(eventoKey, paiInfo.atividade.key, { horaFim: novoFimPai }, function () {
                  ofereceRecalculo(paiInfo.atividade.key, deltaPai, paiInfo.atividade.horaInicio, paiInfo.irmaos, function () { reload(); });
                });
              });
            },
            onExcluir: function () { excluirAtividade(eventoKey, a.key, atividadesDia, function () { reload(); }); }
          });
        });
        acoes.appendChild(upBtn); acoes.appendChild(downBtn); acoes.appendChild(dupBtn); acoes.appendChild(editBtn);
        if (!ehFilho) {
          var abrirNovaEtapa = function () {
            abrirFormAtividade({
              titulo: 'Nova etapa de "' + a.titulo + '"',
              onSalvar: function (dados) {
                criarAtividade(eventoKey, dia.key, Object.assign({ paiKey: a.key }, dados), filhosDesta, function () {
                  _secoesRecolhidas[a.key] = false;
                  reload();
                });
              }
            });
          };
          if (ehSecao) {
            var addSubBtn = document.createElement('button');
            addSubBtn.className = 'btn btn--sm'; addSubBtn.style.cssText = 'padding:4px 8px;font-size:.72rem'; addSubBtn.textContent = '+ Etapa';
            addSubBtn.addEventListener('click', abrirNovaEtapa);
            acoes.appendChild(addSubBtn);
          } else {
            /* Atividade ainda simples (sem etapas): "+ Etapa" fica atrás
               do "⋮" pra não poluir a linha com uma ação pouco usada
               aqui — assim que a primeira etapa é criada, a atividade
               vira seção e o botão passa a aparecer direto (ramo acima). */
            var moreWrap = document.createElement('div');
            moreWrap.style.cssText = 'position:relative';
            var moreBtn = document.createElement('button');
            moreBtn.className = 'btn btn--sm'; moreBtn.style.cssText = estiloBtnAcao;
            moreBtn.innerHTML = '&#x22EF;';
            moreBtn.setAttribute('aria-label', 'Mais ações');
            var moreMenu = document.createElement('div');
            moreMenu.className = 'taa-dropdown rt-etapa-dropdown';
            var addSubBtn2 = document.createElement('button');
            addSubBtn2.className = 'btn btn--sm'; addSubBtn2.style.cssText = 'padding:4px 8px;font-size:.72rem'; addSubBtn2.textContent = '+ Etapa';
            addSubBtn2.addEventListener('click', function () { moreMenu.classList.remove('open'); abrirNovaEtapa(); });
            moreMenu.appendChild(addSubBtn2);
            moreBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              fecharDropdownsEtapaAoClicarFora();
              var willOpen = !moreMenu.classList.contains('open');
              document.querySelectorAll('.rt-etapa-dropdown.open').forEach(function (el) { el.classList.remove('open'); });
              if (willOpen) {
                moreMenu.classList.add('open');
                moreMenu.classList.remove('taa-dropdown--up');
                var rect = moreMenu.getBoundingClientRect();
                if (window.innerHeight - rect.bottom < 0) moreMenu.classList.add('taa-dropdown--up');
              }
            });
            moreWrap.appendChild(moreBtn); moreWrap.appendChild(moreMenu);
            acoes.appendChild(moreWrap);
          }
        }
        row.appendChild(acoes);
        return row;
      }
    }

    reload();
  }

  /* ══════════════════════════════════════════════════════════════
     UI — roteiro da turma (leitura para todos; edição se opts.editable)
     ══════════════════════════════════════════════════════════════ */

  function nomeFacilitador(equipe, key) {
    var f = (equipe || []).filter(function (x) { return x.key === key; })[0];
    return f ? f.name : '';
  }

  function renderRoteiroTurma(container, turma, opts) {
    opts = opts || {};
    var editable = !!opts.editable;
    var equipe = opts.equipe || [];
    var diaAtivoIdx = 0;

    function reload() { carregarRoteiroEfetivoTurma(turma, function (err, dias) { desenhar(dias); }); }

    function badgeDe(status) {
      if (status === 'alterada') return '<span class="turma-status-badge badge-roteiro-alterada">Alterado nesta turma</span>';
      if (status === 'exclusiva') return '<span class="turma-status-badge badge-roteiro-exclusiva">Exclusivo desta turma</span>';
      return '';
    }

    function desenhar(dias) {
      container.innerHTML = '';
      if (!dias.length) {
        container.innerHTML = '<p class="admin-empty">Esta turma ainda não tem um roteiro — o evento não tem roteiro-base cadastrado.</p>';
        return;
      }
      if (diaAtivoIdx >= dias.length) diaAtivoIdx = 0;

      var tabsWrap = document.createElement('div');
      tabsWrap.style.cssText = 'position:sticky;top:0;background:var(--panel,#0c1528);z-index:2;padding-bottom:8px';
      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
      dias.forEach(function (dia, i) {
        var b = document.createElement('button');
        b.className = 'btn btn--sm' + (i === diaAtivoIdx ? ' btn--primary' : '');
        b.style.cssText = 'padding:6px 12px;font-size:.75rem';
        b.textContent = 'DIA ' + dia.numero + (dia.data ? ' (' + dia.data.split('-').reverse().slice(0, 2).join('/') + ')' : '');
        b.addEventListener('click', function () { diaAtivoIdx = i; desenhar(dias); });
        tabs.appendChild(b);
      });
      tabsWrap.appendChild(tabs);
      container.appendChild(tabsWrap);

      var dia = dias[diaAtivoIdx];
      var grupos = agruparPorSessao(dia.atividades, dia.todasEfetivas);
      if (!grupos.length) grupos.push({ nome: '', atividades: [] });

      var imprimirBtn = document.createElement('button');
      imprimirBtn.className = 'btn btn--sm';
      imprimirBtn.style.cssText = 'padding:5px 10px;font-size:.72rem;margin-bottom:12px';
      imprimirBtn.innerHTML = '&#x1F5A8; Agenda resumida';
      imprimirBtn.title = 'Abre uma janela de impressão só com o resumo do dia e a lista de atividades (sem os campos de facilitação) — pode salvar como PDF.';
      imprimirBtn.addEventListener('click', function () { imprimirRoteiroDia('Roteiro — ' + (turma.label || ''), { titulo: 'Dia ' + dia.numero }, dia.atividades, dia.todasEfetivas, turma.resultadoEsperado); });
      container.appendChild(imprimirBtn);

      var imprimirCompletoBtn = document.createElement('button');
      imprimirCompletoBtn.className = 'btn btn--sm';
      imprimirCompletoBtn.style.cssText = 'padding:5px 10px;font-size:.72rem;margin-bottom:12px;margin-left:8px';
      imprimirCompletoBtn.innerHTML = '&#x1F5A8; Roteiro completo';
      imprimirCompletoBtn.title = 'Abre uma janela de impressão com um bloco por atividade e etapa, trazendo todo o conteúdo de facilitação preenchido — pode salvar como PDF.';
      imprimirCompletoBtn.addEventListener('click', function () { imprimirRoteiroCompleto('Roteiro — ' + (turma.label || ''), { titulo: 'Dia ' + dia.numero }, dia.atividades, dia.todasEfetivas); });
      container.appendChild(imprimirCompletoBtn);

      var imprimirPassoAPassoBtn = document.createElement('button');
      imprimirPassoAPassoBtn.className = 'btn btn--sm';
      imprimirPassoAPassoBtn.style.cssText = 'padding:5px 10px;font-size:.72rem;margin-bottom:12px;margin-left:8px';
      imprimirPassoAPassoBtn.innerHTML = '&#x1F5A8; Passo a passo';
      imprimirPassoAPassoBtn.title = 'Abre uma janela de impressão com um bloco por atividade e etapa, só com o campo "Passo a passo" — sem objetivo, dicas, conexão com a agilidade e demais campos internos — pode salvar como PDF.';
      imprimirPassoAPassoBtn.addEventListener('click', function () { imprimirRoteiroPassoAPasso('Roteiro — ' + (turma.label || ''), { titulo: 'Dia ' + dia.numero }, dia.atividades, dia.todasEfetivas); });
      container.appendChild(imprimirPassoAPassoBtn);

      var imprimirObjetivosBtn = document.createElement('button');
      imprimirObjetivosBtn.className = 'btn btn--sm';
      imprimirObjetivosBtn.style.cssText = 'padding:5px 10px;font-size:.72rem;margin-bottom:12px;margin-left:8px';
      imprimirObjetivosBtn.innerHTML = '&#x1F5A8; Agenda + Objetivos';
      imprimirObjetivosBtn.title = 'Abre uma janela de impressão com a mesma tabela da Agenda resumida, mais Objetivo e Resultado esperado de cada atividade — pode salvar como PDF.';
      imprimirObjetivosBtn.addEventListener('click', function () { imprimirRoteiroAgendaObjetivos('Roteiro — ' + (turma.label || ''), { titulo: 'Dia ' + dia.numero }, dia.atividades, dia.todasEfetivas); });
      container.appendChild(imprimirObjetivosBtn);

      var resumosPorGrupo = grupos.map(function (g) { return calcularResumoDia(g.atividades, dia.todasEfetivas); });
      if (grupos.length > 1) container.insertAdjacentHTML('beforeend', resumoSessoesHtml(grupos, resumosPorGrupo, 'rtResumoSessoes'));

      grupos.forEach(function (grupo, gi) {
        var resumo = resumosPorGrupo[gi];

        if (grupos.length > 1) {
          var sessaoHdr = document.createElement('h4');
          sessaoHdr.style.cssText = 'font-family:var(--font-head);letter-spacing:.06em;font-size:.8rem;color:var(--gold);margin:' + (gi ? '20px' : '4px') + ' 0 8px;padding-top:' + (gi ? '16px' : '0') + ';border-top:' + (gi ? '1px solid var(--line-strong)' : 'none');
          sessaoHdr.textContent = (grupo.nome || 'Sem sessão definida') + ' · ' + grupo.atividades.length + ' atividade' + (grupo.atividades.length !== 1 ? 's' : '');
          container.appendChild(sessaoHdr);
        }

        container.insertAdjacentHTML('beforeend', resumoDiaHtml(resumo, 'rtResumoTopo_' + gi, grupos.length > 1));
        container.insertAdjacentHTML('beforeend', bannerSobreposicoesHtml(resumo.sobreposicoes));

        var lista = document.createElement('div');
        lista.style.cssText = 'display:flex;flex-direction:column;gap:8px';
        lista.insertAdjacentHTML('beforeend', colunasHeaderHtml());

        if (!grupo.atividades.length) {
          lista.insertAdjacentHTML('beforeend', '<p class="admin-empty">Nenhuma atividade nesta sessão.</p>');
        }

        grupo.atividades.forEach(function (a, i) {
          var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
          if (gapAntes) lista.insertAdjacentHTML('beforeend', gapRowHtml(gapAntes));
          lista.appendChild(renderAtividadeAcc(a, dia, i + 1, null));

          var recolhida = !!_secoesRecolhidas[a.key];
          if (a._filhos.length && !recolhida) {
            a._filhos.forEach(function (f, j) {
              lista.appendChild(renderAtividadeAcc(f, dia, j + 1, i + 1));
            });
          }
        });
        container.appendChild(lista);

        container.insertAdjacentHTML('beforeend', resumoDiaHtml(resumo, 'rtResumoRodape_' + gi, grupos.length > 1));
      });

      if (editable) {
        var addExclusivaBtn = document.createElement('button');
        addExclusivaBtn.className = 'btn btn--sm';
        addExclusivaBtn.style.cssText = 'margin-top:12px;padding:6px 14px;font-size:.75rem';
        addExclusivaBtn.textContent = '+ Adicionar atividade somente nesta turma';
        addExclusivaBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Nova atividade exclusiva desta turma',
            onSalvar: function (dados) { criarAtividadeExclusiva(turma.key, dia.key, dados, function () { reload(); }); }
          });
        });
        container.appendChild(addExclusivaBtn);

        if (dia.removidas.length) {
          var det = document.createElement('details');
          det.style.cssText = 'margin-top:16px';
          det.innerHTML = '<summary style="cursor:pointer;color:var(--ink-2);font-size:.8rem">Atividades removidas desta turma (' + dia.removidas.length + ')</summary>';
          var remWrap = document.createElement('div');
          remWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px';
          dia.removidas.forEach(function (a) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--panel-2);border:1px solid rgba(255,59,48,.25);border-radius:8px';
            row.innerHTML = '<span class="turma-status-badge badge-roteiro-removida">Removida desta turma</span><span style="flex:1;color:var(--ink-2)">' + esc(a.titulo) + '</span>';
            var restBtn = document.createElement('button');
            restBtn.className = 'btn btn--sm'; restBtn.style.cssText = 'padding:4px 10px;font-size:.72rem'; restBtn.textContent = 'Restaurar';
            restBtn.addEventListener('click', function () { restaurarAtividade(turma.key, a.key, function () { reload(); }); });
            row.appendChild(restBtn);
            remWrap.appendChild(row);
          });
          det.appendChild(remWrap);
          container.appendChild(det);
        }
      }
    }

    /* numeroPai null = atividade de nível principal; caso contrário é
       uma sub-etapa (numeração N.M, recuada, sem o próprio toggle de
       seção — só um nível de aninhamento é mostrado na tela). */
    function renderAtividadeAcc(a, dia, numero, numeroPai) {
      var ehFilho = numeroPai != null;
      var acc = document.createElement('div');
      acc.className = 'aval-acc';
      if (ehFilho) acc.style.cssText = 'margin-left:28px;border-left:2px solid var(--line-strong);border-radius:0 8px 8px 0;background:rgba(255,255,255,.015)';
      var hdr = document.createElement('div');
      hdr.className = 'aval-acc-hdr';
      /* Etapa sem horário próprio não mostra "—" (dá impressão de dado
         ausente) — simplesmente não exibe coluna de horário. */
      var horario = a.horaInicio ? (a.horaInicio + (a.horaFim ? '–' + a.horaFim : '')) : (ehFilho ? '' : '—');
      var ehSecao = !ehFilho && a._filhos && a._filhos.length;
      var recolhida = !!_secoesRecolhidas[a.key];
      var numeroTxt = ehFilho ? (numeroPai + '.' + numero) : String(numero);
      /* Numa seção, tipo + duração + contagem de etapas viram uma única
         linha auxiliar (ex: "Dinâmica · 15 min · 6 etapas"), igual ao
         roteiro-base. */
      var metaTxt = ehSecao
        ? [a.tipo, fmtDuracao(duracaoEfetiva(a, dia.todasEfetivas)), a._filhos.length + ' etapa' + (a._filhos.length !== 1 ? 's' : '')].filter(Boolean).join(' · ')
        : fmtDuracao(duracaoEfetiva(a, dia.todasEfetivas)) + (a.tipo ? ' · ' + a.tipo : '');
      hdr.innerHTML =
        '<span style="width:26px;text-align:center;font-family:var(--font-mono);font-size:.7rem;color:var(--ink-3)">' + numeroTxt + '</span>' +
        (horario ? '<span style="font-family:var(--font-mono);font-size:.78rem;color:var(--gold);min-width:96px">' + esc(horario) + '</span>' : '<span style="min-width:96px"></span>') +
        '<div class="aval-acc-hdr-text"><strong style="color:var(--ink)">' + esc(a.titulo) + '</strong>' +
        '<span style="font-size:.72rem;color:var(--ink-3)">' + esc(metaTxt) + '</span>' +
        (a._facilitacao && a._facilitacao.principal ? '<span style="font-size:.72rem;color:var(--ink-3)">Condução: ' + esc(nomeFacilitador(equipe, a._facilitacao.principal)) + '</span>' : '') +
        '</div><div class="aval-acc-hdr-right">' + badgeDe(a._status) +
          (ehSecao ? '<button type="button" class="btn btn--sm rt-toggle-sec" style="padding:2px 8px;font-size:.68rem">' + (recolhida ? '▼' : '▲') + '</button>' : '') +
          '<span class="aval-acc-arrow">▾</span></div>';
      var body = document.createElement('div');
      body.className = 'aval-acc-body';
      body.style.cssText = 'display:none;padding:14px 16px;background:var(--panel)';
      if (ehSecao) {
        hdr.querySelector('.rt-toggle-sec').addEventListener('click', function (e) {
          e.stopPropagation();
          _secoesRecolhidas[a.key] = !recolhida;
          reload();
        });
      }
      hdr.addEventListener('click', function () {
        var abrir = body.style.display === 'none';
        body.style.display = abrir ? '' : 'none';
        acc.classList.toggle('aval-acc--open', abrir);
        if (abrir && !body.dataset.montado) { montarCorpo(body, a, dia, ehFilho); body.dataset.montado = '1'; }
      });
      acc.appendChild(hdr);
      acc.appendChild(body);
      return acc;
    }

    function campoDetalhe(label, valor) {
      if (!valor || (Array.isArray(valor) && !valor.length)) return '';
      var conteudo = Array.isArray(valor)
        ? '<ul style="margin:4px 0 0 18px;padding:0">' + valor.map(function (l) { return '<li>' + htmlRicoItemLista(l) + '</li>'; }).join('') + '</ul>'
        : '<div style="margin:4px 0 0" class="rico-html-view">' + htmlRicoSeguro(valor) + '</div>';
      return '<div style="margin-bottom:12px"><strong style="font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)">' + esc(label) + '</strong>' + conteudo + '</div>';
    }

    function montarCorpo(body, a, dia, ehFilho) {
      var detalhes = document.createElement('div');
      detalhes.innerHTML =
        campoDetalhe('Objetivo', a.objetivo) +
        campoDetalhe('Resultado esperado', a.resultadoEsperado) +
        campoDetalhe('Passo a passo', a.passoAPasso) +
        campoDetalhe('Dicas para o facilitador', a.dicasFacilitador) +
        campoDetalhe('Prompt para IA', a.promptIA) +
        campoDetalhe('Conexão com a agilidade', a.conexaoAgilidade) +
        campoDetalhe('Materiais necessários', a.materiais) +
        campoDetalhe('Preparação prévia', a.preparacaoPrevia) +
        campoDetalhe('Observações', a.observacoes);
      body.appendChild(detalhes);

      /* Facilitação — leitura sempre; seleção só quando editable e há
         gente na equipe da turma (só quem está na equipe pode conduzir). */
      var facWrap = document.createElement('div');
      facWrap.style.cssText = 'margin-top:8px;padding-top:12px;border-top:1px solid var(--line-strong)';
      if (editable && equipe.length) {
        var principalAtual = (a._facilitacao && a._facilitacao.principal) || '';
        var apoioAtual = (a._facilitacao && a._facilitacao.apoio) || [];
        var opts1 = '<option value="">— ninguém definido —</option>' + equipe.map(function (f) {
          return '<option value="' + esc(f.key) + '"' + (f.key === principalAtual ? ' selected' : '') + '>' + esc(f.name) + '</option>';
        }).join('');
        var checks = equipe.map(function (f) {
          return '<label style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--ink-2)"><input type="checkbox" class="rt-apoio-chk" value="' + esc(f.key) + '"' + (apoioAtual.indexOf(f.key) !== -1 ? ' checked' : '') + ' />' + esc(f.name) + '</label>';
        }).join('');
        facWrap.innerHTML =
          '<label class="auth-label">Condução principal<select class="rt-principal-sel" style="width:100%;padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink)">' + opts1 + '</select></label>' +
          '<div style="margin-top:8px"><span class="auth-label" style="display:block;margin-bottom:6px">Apoio</span><div style="display:flex;flex-direction:column;gap:4px">' + checks + '</div></div>';
        body.appendChild(facWrap);
        var salvarFacBtn = document.createElement('button');
        salvarFacBtn.className = 'btn btn--sm'; salvarFacBtn.style.cssText = 'margin-top:10px;padding:5px 12px;font-size:.72rem'; salvarFacBtn.textContent = 'Salvar condução';
        salvarFacBtn.addEventListener('click', function () {
          var principal = body.querySelector('.rt-principal-sel').value;
          var apoio = Array.prototype.map.call(body.querySelectorAll('.rt-apoio-chk:checked'), function (c) { return c.value; });
          if (principal && apoio.indexOf(principal) !== -1) { alertDialog('A mesma pessoa não pode ser condução principal e apoio na mesma atividade.'); return; }
          salvarFacilitacaoAtividade(turma.key, a.key, principal, apoio, function () { reload(); });
        });
        body.appendChild(salvarFacBtn);
      } else if (a._facilitacao && (a._facilitacao.principal || (a._facilitacao.apoio || []).length)) {
        var linhasHtml = '';
        if (a._facilitacao.principal) linhasHtml += '<p style="margin:0"><strong>Condução:</strong> ' + esc(nomeFacilitador(equipe, a._facilitacao.principal)) + '</p>';
        if ((a._facilitacao.apoio || []).length) linhasHtml += '<p style="margin:4px 0 0"><strong>Apoio:</strong> ' + a._facilitacao.apoio.map(function (k) { return esc(nomeFacilitador(equipe, k)); }).join(', ') + '</p>';
        facWrap.innerHTML = linhasHtml;
        body.appendChild(facWrap);
      }

      if (!editable) return;

      var acoes = document.createElement('div');
      acoes.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap';
      var filhosDesta = filhosDe(dia.todasEfetivas, a.key);
      if (a._status === 'exclusiva') {
        var editExclBtn = document.createElement('button');
        editExclBtn.className = 'btn btn--sm'; editExclBtn.style.cssText = 'padding:5px 12px;font-size:.72rem'; editExclBtn.textContent = 'Editar';
        editExclBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Editar atividade exclusiva', existente: a, filhosCount: filhosDesta.length,
            duracaoSomaFilhos: filhosDesta.length ? duracaoEfetiva(a, dia.todasEfetivas) : undefined,
            onSalvar: function (dados) { editarAtividadeExclusiva(turma.key, a.key, dados, function () { reload(); }); },
            onExcluir: function () { excluirAtividadeExclusiva(turma.key, a.key, dia.todasEfetivas, function () { reload(); }); }
          });
        });
        acoes.appendChild(editExclBtn);
      } else {
        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn--sm'; editBtn.style.cssText = 'padding:5px 12px;font-size:.72rem'; editBtn.textContent = 'Editar apenas nesta turma';
        editBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Personalizar atividade nesta turma', existente: a, filhosCount: filhosDesta.length,
            duracaoSomaFilhos: filhosDesta.length ? duracaoEfetiva(a, dia.todasEfetivas) : undefined,
            onSalvar: function (dados) { customizarAtividade(turma.key, a._base, dados, function () { reload(); }); }
          });
        });
        acoes.appendChild(editBtn);

        if (a._status === 'alterada') {
          var restBtn = document.createElement('button');
          restBtn.className = 'btn btn--sm'; restBtn.style.cssText = 'padding:5px 12px;font-size:.72rem'; restBtn.textContent = 'Restaurar padrão do evento';
          restBtn.addEventListener('click', function () {
            confirmDialog('Esta ação descartará as personalizações desta atividade para esta turma e restaurará os dados definidos no roteiro-base do evento. Deseja continuar?',
              function () { restaurarAtividade(turma.key, a.key, function () { reload(); }); });
          });
          acoes.appendChild(restBtn);
        }
        var remBtn = document.createElement('button');
        remBtn.className = 'btn btn--sm'; remBtn.style.cssText = 'padding:5px 12px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080'; remBtn.textContent = 'Remover desta turma';
        remBtn.addEventListener('click', function () {
          confirmDialog('Remover "' + a.titulo + '" apenas desta turma? A atividade continua no roteiro-base do evento e nas demais turmas.',
            function () { removerAtividadeDaTurma(turma.key, a.key, function () { reload(); }); });
        });
        acoes.appendChild(remBtn);
      }
      /* Sub-etapa adicionada por uma turma é sempre exclusiva dela, mesmo
         quando a atividade-mãe é do roteiro-base — não existe "sub-etapa
         de personalização", só exclusiva de verdade ou base (esta última
         só se cria no roteiro-base do evento). Um só nível: não aparece
         em quem já é sub-etapa. */
      if (!ehFilho) {
        var addSubBtn = document.createElement('button');
        addSubBtn.className = 'btn btn--sm'; addSubBtn.style.cssText = 'padding:5px 12px;font-size:.72rem'; addSubBtn.textContent = '+ Etapa (só nesta turma)';
        addSubBtn.addEventListener('click', function () {
          abrirFormAtividade({
            titulo: 'Nova etapa de "' + a.titulo + '" (só nesta turma)',
            onSalvar: function (dados) { criarAtividadeExclusiva(turma.key, dia.key, Object.assign({ paiKey: a.key }, dados), function () { _secoesRecolhidas[a.key] = false; reload(); }); }
          });
        });
        acoes.appendChild(addSubBtn);
      }
      body.appendChild(acoes);
    }

    reload();
  }

  window.faRoteiro = {
    carregarRoteiroEvento: carregarRoteiroEvento,
    carregarRoteiroEfetivoTurma: carregarRoteiroEfetivoTurma,
    carregarEquipeTurma: carregarEquipeTurma,
    carregarEquipeGlobal: carregarEquipeGlobal,
    definirResponsavel: definirResponsavel,
    adicionarFacilitadorApoio: adicionarFacilitadorApoio,
    removerDaEquipe: removerDaEquipe,
    renderRoteiroBaseEditor: renderRoteiroBaseEditor,
    renderRoteiroTurma: renderRoteiroTurma,
    alertDialog: alertDialog,
    confirmDialog: confirmDialog,
    /* Lista padrão de "Tipo de atividade" (ver comentário perto de
       TIPOS_PADRAO acima) — exposta só pra admin.js semear
       roteiro-tipos-atividade da primeira vez que a aba "Tipos de
       atividade" é aberta com o nó ainda vazio; fonte única, pra não
       duplicar a lista em dois arquivos. */
    TIPOS_ATIVIDADE_PADRAO: TIPOS_PADRAO.slice()
  };
})();
