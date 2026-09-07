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
       objetivo, passoAPasso, dicasFacilitador, conexaoAgilidade,
       materiais: [..], preparacaoPrevia, observacoes,
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
  var RICO_TAGS_PERMITIDAS = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, UL: 1, OL: 1, LI: 1, BR: 1, DIV: 1, P: 1, SPAN: 1 };
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
           de cor/alinhamento válido de verdade — nunca algo executável
           (url(), expression() etc.) — então é seguro reaplicar só esses
           3 valores depois de zerar o atributo style inteiro. */
        var alinhamento = filho.style && filho.style.textAlign;
        var cor = filho.style && filho.style.color;
        var corFundo = filho.style && filho.style.backgroundColor;
        Array.prototype.slice.call(filho.attributes).forEach(function (attr) { filho.removeAttribute(attr.name); });
        if (RICO_ALINHAMENTOS.indexOf(alinhamento) !== -1) filho.style.textAlign = alinhamento;
        if (cor) filho.style.color = cor;
        if (corFundo) filho.style.backgroundColor = corFundo;
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
     novo e salvar. */
  var TIPOS = ['Abertura', 'Ambientação', 'Briefing', 'Compromisso', 'Conceituação', 'Dinâmica', 'Discussão', 'Experimentação com IA', 'Fechamento', 'Intervalo', 'Provocação', 'Reflexão', 'Sinal/Evidência', 'Transição'];

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
        campoRico('rfConexao', 'Conexão com a mentalidade ágil', htmlRicoSeguro(a.conexaoAgilidade), 'Por que esta atividade existe', 3)) +
      bloco('Como conduzir',
        campoRico('rfPasso', 'Passo a passo (uma linha por passo)', htmlRicoSeguro(a.passoAPasso), '1. Explique a missão...', 5) +
        campoRico('rfDicas', 'Dicas para o facilitador', htmlRicoSeguro(a.dicasFacilitador), 'O que evitar, o que reforçar', 3)) +
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
        passoAPasso: extrairTextoRico($('#rfPasso')), dicasFacilitador: extrairTextoRico($('#rfDicas')),
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
      item('Lacunas', fmtDuracao(resumo.lacunasMin), resumo.lacunasMin ? '#ff8a5c' : 'var(--ink-3)', 'Períodos entre atividades sem nada programado — não conta como tempo programado.') +
      item('Atividades', String(resumo.atividadesCount), 'var(--blue-glow)', 'Quantidade de atividades principais do dia (sub-etapas não contam à parte).') +
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
        item('Atividades', String(atividadesCount), 'var(--blue-glow)') +
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
      '<div>Lacunas<b>' + esc(fmtDuracao(resumo.lacunasMin)) + '</b></div>' +
      '<div>Atividades<b>' + resumo.atividadesCount + '</b></div>' +
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
        '<div>Atividades<b>' + atividadesCount + '</b></div>' +
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
     (2) o cabeçalho/rodapé do navegador em si (título+URL+data+página)
         não tem como ser desligado por código — só a pessoa desmarcando
         "Cabeçalhos e rodapés" nas opções de impressão; por isso a dica
         fica visível na tela (nunca impressa, graças a .rp-actions ir
         embora em @media print);
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
      'body{font-family:"Barlow",Arial,Helvetica,sans-serif;color:var(--pink);margin:0;padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
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
      estiloExtra +
      '@media print{.rp-actions{display:none;} body{padding:10px;}}' +
      '@page{size:A4 portrait;margin:14mm;}' +
      '</style></head><body>' +
      '<div class="rp-actions"><button id="rp-print-btn">Imprimir / salvar como PDF</button>' +
        '<label class="rp-eco-toggle"><input type="checkbox" id="rp-eco-toggle"> Modo econômico (fundo claro, menos tinta)</label>' +
        '<span class="rp-dica">Dica: nas opções de impressão do navegador, desmarque "Cabeçalhos e rodapés"; se for imprimir em papel de verdade, marque "Modo econômico" aqui em cima antes — senão marque "Gráficos de fundo" (ou "Imprimir cores e imagens de fundo") pra sair igual à tela.</span></div>' +
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

  function imprimirRoteiroDia(tituloContexto, dia, atividadesTopo, todasAtividades) {
    todasAtividades = todasAtividades || atividadesTopo;
    var geradoEm = new Date().toLocaleString('pt-BR');
    var grupos = agruparPorSessao(atividadesTopo, todasAtividades);
    if (!grupos.length) grupos.push({ nome: '', atividades: [] });
    var corpo = '<h1>' + esc(tituloContexto) + (dia.titulo ? ' — ' + esc(dia.titulo) : '') + '</h1>' +
      '<div class="rp-meta">Gerado em ' + esc(geradoEm) + '</div>';

    var resumosPorGrupo = grupos.map(function (g) { return calcularResumoDia(g.atividades, todasAtividades); });
    if (grupos.length > 1) corpo += resumoSessoesImpressaoHtml(grupos, resumosPorGrupo);

    grupos.forEach(function (grupo, gi) {
      var resumo = resumosPorGrupo[gi];
      if (grupos.length > 1) corpo += '<div class="rp-sessao-hdr">' + esc(grupo.nome || 'Sem sessão definida') + '</div>';
      corpo += resumoImpressaoHtml(resumo, grupos.length > 1);
      var linhasHtml = '';
      grupo.atividades.forEach(function (a, i) {
        var gapAntes = resumo.gaps.filter(function (g) { return g.fimMin === hhmmParaMin(a.horaInicio); })[0];
        if (gapAntes) linhasHtml += '<tr class="rp-gap"><td colspan="5">⚠ Lacuna: ' + esc(minParaHhmm(gapAntes.inicioMin)) + '–' + esc(minParaHhmm(gapAntes.fimMin)) + ' (' + esc(fmtDuracao(gapAntes.min)) + ')</td></tr>';
        var horario = (a.horaInicio || '—') + (a.horaFim ? '–' + a.horaFim : '');
        linhasHtml += '<tr><td>' + (i + 1) + '</td><td>' + esc(horario) + '</td><td>' + esc(a.titulo) + '</td><td>' + esc(a.tipo || '') + '</td><td>' + esc(fmtDuracao(duracaoEfetiva(a, todasAtividades))) + '</td></tr>';
        filhosDe(todasAtividades, a.key).forEach(function (sub, j) {
          var horarioSub = sub.horaInicio ? ((sub.horaInicio || '—') + (sub.horaFim ? '–' + sub.horaFim : '')) : '';
          linhasHtml += '<tr class="rp-sub"><td>' + (i + 1) + '.' + (j + 1) + '</td><td>' + esc(horarioSub) + '</td><td>' + esc(sub.titulo) + '</td><td>' + esc(sub.tipo || '') + '</td><td>' + esc(fmtDuracao(duracaoEfetiva(sub, todasAtividades))) + '</td></tr>';
        });
      });
      corpo += '<table><thead><tr><th>#</th><th>Horário</th><th>Atividade</th><th>Tipo</th><th>Duração</th></tr></thead>' +
        '<tbody>' + linhasHtml + '</tbody></table>';
    });

    abrirJanelaImpressao(
      tituloContexto + (dia.titulo ? ' — ' + dia.titulo : ''),
      'table{border-collapse:collapse;width:100%;font-size:.82rem;margin-bottom:20px;background:var(--ppanel2);border:1px solid var(--plines);color:var(--pink2);}' +
      'th,td{border-bottom:1px solid var(--pline);padding:8px 10px;text-align:left;}' +
      'tr:last-child td{border-bottom:none;}' +
      'th{background:var(--ppanel);color:var(--pink3);font-family:"Oswald",Arial,sans-serif;text-transform:uppercase;font-size:.66rem;letter-spacing:.06em;font-weight:600;}' +
      '.rp-gap td{background:rgba(255,138,92,.14);color:#ffb37e;font-style:italic;}' +
      '.rp-sub td:first-child{color:var(--pink3);}' +
      '.rp-sub td:nth-child(3){padding-left:26px;color:var(--pink2);}' +
      'tr{page-break-inside:avoid;break-inside:avoid-page;}',
      corpo
    );
  }

  /* Impressão "completa": um bloco por atividade/sub-etapa com todo o
     conteúdo de facilitação preenchido (objetivo, passo a passo etc.) —
     só os campos que de fato têm valor, igual ao corpo expandido do
     roteiro da turma na tela (nunca mostra rótulo de campo vazio). */
  function campoImpressao(label, valor) {
    if (!valor || (Array.isArray(valor) && !valor.length)) return '';
    var conteudo = Array.isArray(valor)
      ? '<ul>' + valor.map(function (l) { return '<li>' + htmlRicoItemLista(l) + '</li>'; }).join('') + '</ul>'
      : '<div class="rp-campo-txt">' + htmlRicoSeguro(valor) + '</div>';
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
        campoImpressao('Passo a passo', a.passoAPasso) +
        campoImpressao('Dicas para o facilitador', a.dicasFacilitador) +
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
      '.rp-campo strong{display:block;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--pgold);margin-bottom:3px;font-family:"Oswald",Arial,sans-serif;page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-campo-txt{margin:0;}' +
      '.rp-campo-txt div, .rp-campo-txt p{margin:0 0 4px;}' +
      '.rp-campo-txt div:last-child, .rp-campo-txt p:last-child{margin-bottom:0;}' +
      '.rp-campo ul{margin:2px 0 0 18px;padding:0;}' +
      '.rp-contexto{font-size:.72rem;color:var(--pink3);font-style:italic;margin-bottom:4px;page-break-after:avoid;break-after:avoid-page;}' +
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
      '.rp-campo strong{display:block;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--pgold);margin-bottom:3px;font-family:"Oswald",Arial,sans-serif;page-break-after:avoid;break-after:avoid-page;}' +
      '.rp-campo-txt{margin:0;}' +
      '.rp-campo-txt div, .rp-campo-txt p{margin:0 0 4px;}' +
      '.rp-campo-txt div:last-child, .rp-campo-txt p:last-child{margin-bottom:0;}' +
      '.rp-campo ul{margin:2px 0 0 18px;padding:0;}' +
      '.rp-contexto{font-size:.72rem;color:var(--pink3);font-style:italic;margin-bottom:4px;page-break-after:avoid;break-after:avoid-page;}' +
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
      imprimirBtn.addEventListener('click', function () { imprimirRoteiroDia('Roteiro — ' + (turma.label || ''), { titulo: 'Dia ' + dia.numero }, dia.atividades, dia.todasEfetivas); });
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
        campoDetalhe('Passo a passo', a.passoAPasso) +
        campoDetalhe('Dicas para o facilitador', a.dicasFacilitador) +
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
    confirmDialog: confirmDialog
  };
})();
