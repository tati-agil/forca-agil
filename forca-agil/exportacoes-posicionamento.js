/* ============================================================
   Força Ágil — EXPORTAÇÕES do Posicionamento Organizacional (window.faExportacoesPosicionamento) — PR G1

   Módulo PURO: monta o conteúdo do PDF individual e as abas do Excel a partir de objetos já carregados.
   Não acessa banco, não conhece autenticação, não lê nem escreve página, não navega e não grava nada —
   avaliacao-posicionamento.js lê os dados, carrega as bibliotecas e baixa os arquivos. É uma fronteira
   pequena para não criar acoplamento novo antes da futura extração do núcleo do Mapa da Floresta.

   FOTOGRAFIA DO QUE FOI GRAVADO — nunca recalcula: a recomendação, a regra, a versão do motor e o efeito
   sobre a Adequação à Squad vêm de resultadoAutomatico (gravado na conclusão); a decisão e o efeito dela,
   de posicionamento-decisoes (gravados na decisão). Este módulo não chama motor nenhum: um motor v2 nunca
   muda um PDF/Excel de uma avaliação feita com o v1 (teste-posicionamento-exportacao-nucleo.js prova).

   A Avaliação de Produto/Serviço mostrada é EXATAMENTE a de avaliacaoArquiteturalId — nunca a mais recente
   do item; ausente → o ID e "Dados da avaliação vinculada indisponíveis", sem inferir nada de outra.

   ctx = {
     registros:  { <avaliacaoId>: avaliação },          avaliacoes-posicionamento
     decisoes:   { <avaliacaoId>: decisão },             posicionamento-decisoes
     decisoesConhecidas: true,                           só com a leitura das decisões CONCLUÍDA (senão: erro)
     vigentes:   { <itemId>: <avaliacaoId> },            posicionamento-vigente-por-item
     produtos:   { <id>: avaliação de Produto/Serviço }, avaliacoes-produto
     nomesAtuais:{ <código>: { nome, contingencia } },   nome atual na Taxonomia (informação atual, nunca substitui o registrado)
     trilha:     { ok: bool, porAvaliacao: { <avaliacaoId>: { <id>: evento } } },  posicionamento-auditoria
     textoQuestionario: function (codigo, versao) → { titulo, texto }   só quando a resposta não guardou o texto
     geradoEm:   ISO
   }
   ============================================================ */
(function (raiz) {
  'use strict';
  var NIVEIS = { N1: ['O1', 'O2', 'O3'], N2: ['O4', 'O5'], N3: ['O6', 'O7', 'O8', 'O9'] };
  var ORDEM_NIVEIS = ['N1', 'N2', 'N3'];
  var TITULO_NIVEL = { N1: 'Nível 1 — tipo de responsabilidade', N2: 'Nível 2 — Linha confirmada', N3: 'Nível 3 — ramo Plataforma' };
  var TIPO_A_VALIDAR = { INCOERENCIA: 'incoerência nas respostas', CONFLITO: 'conflito de posicionamento', RECORTE: 'recorte do objeto', EVIDENCIA_INSUFICIENTE: 'evidência insuficiente' };
  var ROTULO_TIPO_DECISAO = { CONFIRMACAO: 'Confirmação da recomendação automática', DIVERGENCIA: 'Divergência da recomendação automática', RESOLUCAO_A_VALIDAR: 'Resolução do "A validar"' };
  var ROTULO_SITUACAO = { vigente: 'Vigente', historica: 'Histórica', rascunho: 'Rascunho', reavaliacao: 'Reavaliação em andamento', descartado: 'Descartada' };
  var SEM_DECISAO = 'Sem decisão registrada';
  var VINCULADA_INDISPONIVEL = 'Dados da avaliação vinculada indisponíveis';
  var TRILHA_INDISPONIVEL = 'Trilha indisponível: não foi possível ler o registro de eventos agora. As demais informações vêm dos dados gravados e estão completas.';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtData(iso) { if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  function data(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d; }
  function pessoa(p) { return p ? (p.name || p.email || '') : ''; }
  function porEm(p, iso) { return [pessoa(p), iso ? fmtData(iso) : ''].filter(Boolean).join(' · '); }
  function exigirDecisoes(ctx) {
    /* não saber ≠ não ter: sem a leitura das decisões concluída, nenhum arquivo diz "Sem decisão registrada" */
    if (!ctx || ctx.decisoesConhecidas !== true) throw new Error('decisoes-desconhecidas');
  }

  /* ---- situação (calculada na hora da exportação: muda com o tempo) ---- */
  function situacao(id, reg, ctx) {
    if (!reg) return null;
    if (reg.status === 'rascunho') return reg.avaliacaoAnteriorId ? 'reavaliacao' : 'rascunho';
    if (reg.status === 'descartado') return 'descartado';
    return (ctx.vigentes || {})[reg.itemId] === id ? 'vigente' : 'historica';
  }
  function rotuloSituacao(id, reg, ctx) { return ROTULO_SITUACAO[situacao(id, reg, ctx)] || ''; }

  /* ---- nomes: o registrado (histórico) vem primeiro; o atual só como informação ---- */
  function nomeAtual(ctx, cod) { var n = (ctx.nomesAtuais || {})[cod]; return n && n.nome ? n.nome : cod; }
  function nomeRegistradoNaConclusao(reg, cod) { var n = (reg.nomesNaConclusao || {})[cod]; return n || null; }
  function nomeDoCodigoNaConclusao(reg, ctx, cod) {
    if (!cod) return '';
    if (cod === 'A_VALIDAR') return 'A validar';
    var r = nomeRegistradoNaConclusao(reg, cod);
    return r ? r.nome : nomeAtual(ctx, cod);
  }
  function rotuloRecomendacao(reg, ctx) {
    var ra = reg && reg.resultadoAutomatico;
    if (!ra || !ra.codigoResultado) return '';
    if (ra.codigoResultado === 'A_VALIDAR') return 'A validar — ' + (TIPO_A_VALIDAR[ra.tipoAValidar] || ra.tipoAValidar || '');
    return nomeDoCodigoNaConclusao(reg, ctx, ra.codigoResultado);
  }
  function rotuloDecisao(id, reg, ctx) {
    if (!reg || reg.status !== 'concluido') return '';
    var d = (ctx.decisoes || {})[id];
    if (!d) return SEM_DECISAO;
    return (d.nomeNaDecisao && d.nomeNaDecisao.nome) || nomeAtual(ctx, d.codigoFinal);
  }
  function textoLiberaAutomatico(ra) {
    return ra.liberaSquad === true ? 'Pela recomendação automática, a Adequação à Squad (S1–S8) pode ser realizada para este item. Isso não cria nem associa Squad.'
      : 'Pela recomendação automática, este resultado não libera a Adequação à Squad (S1–S8).';
  }
  function textoLiberaDecisao(d) {
    return d.liberaSquad === true ? 'Pela decisão final, a Adequação à Squad (S1–S8) pode ser realizada para este item. Isso não cria nem associa Squad.'
      : 'Pela decisão final, a Adequação à Squad (S1–S8) não é liberada para este item.';
  }
  function simNao(b) { return b === true ? 'Sim' : b === false ? 'Não' : ''; }

  /* ---- Avaliação de Produto/Serviço: EXATAMENTE a referenciada ---- */
  function produtoVinculado(reg, ctx) {
    var id = reg && reg.avaliacaoArquiteturalId;
    var p = id ? (ctx.produtos || {})[id] : null;
    return { id: id || '', registro: p || null };
  }
  function rotuloProduto(reg, ctx) {
    var v = produtoVinculado(reg, ctx);
    if (!v.registro) return (v.id ? v.id + ' — ' : '') + VINCULADA_INDISPONIVEL;
    var p = v.registro, cam = p.camadaSugerida && (p.camadaSugerida.label || p.camadaSugerida.id);
    return (p.nome || '') + ' · v' + (p.versao || 1) + (cam ? ' · ' + cam : '') + ' · ID ' + v.id;
  }

  /* ---- cadeia de versões do item (todas, inclusive descartadas) ---- */
  function cadeia(itemId, ctx) {
    var regs = ctx.registros || {};
    return Object.keys(regs).filter(function (k) { return regs[k] && regs[k].itemId === itemId; })
      .sort(function (a, b) { return ((regs[a].versao || 1) - (regs[b].versao || 1)) || String(regs[a].criadoEm || '').localeCompare(String(regs[b].criadoEm || '')); });
  }
  function versaoDe(ctx, id) { var r = (ctx.registros || {})[id]; return r ? 'v' + (r.versao || 1) : id; }

  /* ---- trilha (auditoria) ---- */
  function eventosDe(id, ctx) {
    var t = ctx.trilha;
    if (!t || t.ok !== true) return null; /* indisponível ≠ vazia */
    var evs = (t.porAvaliacao || {})[id] || {};
    return Object.keys(evs).map(function (k) { return Object.assign({ _id: k }, evs[k]); })
      .sort(function (a, b) { return String(a.dataHora || '').localeCompare(String(b.dataHora || '')); });
  }
  var ROTULO_EVENTO = { criacao: 'Criação', conclusao: 'Conclusão', descarte: 'Descarte', decisao: 'Decisão' };
  function descreverEvento(e, ctx) {
    if (e.tipo === 'criacao') return e.avaliacaoAnteriorId ? 'Iniciada como reavaliação da ' + versaoDe(ctx, e.avaliacaoAnteriorId) + (e.motivo ? ' — motivo: ' + e.motivo : '') : 'Iniciada';
    if (e.tipo === 'conclusao') return 'Concluída — recomendação automática: ' + (e.codigoResultado === 'A_VALIDAR' ? 'A validar' : nomeAtual(ctx, e.codigoResultado)) +
      (e.vigenteAnterior ? ' (passou a vigente no lugar da ' + versaoDe(ctx, e.vigenteAnterior) + ')' : '');
    if (e.tipo === 'descarte') return 'Descartada' + (e.motivo ? ' — motivo: ' + e.motivo : '');
    if (e.tipo === 'decisao') return 'Decisão registrada: ' + (ROTULO_TIPO_DECISAO[e.tipoDecisao] || e.tipoDecisao || '') + ' — ' + nomeAtual(ctx, e.codigoFinal) +
      (e.justificativa ? ' — justificativa: ' + e.justificativa : '');
    return e.tipo || '';
  }

  /* ---- texto das perguntas: o da época; sem ele, o da versão registrada; nunca o atual ---- */
  function textoDaPergunta(codigo, r, reg, ctx) {
    if (r && r.textoPerguntaNaEpoca) return { titulo: r.tituloNaEpoca || '', texto: r.textoPerguntaNaEpoca, origem: 'Registrado na resposta' };
    var v = (r && r.questionnaireContentVersion) || reg.questionnaireContentVersion;
    var c = v && typeof ctx.textoQuestionario === 'function' ? ctx.textoQuestionario(codigo, v) : null;
    if (c && c.texto) return { titulo: c.titulo || '', texto: c.texto, origem: 'Versão ' + v + ' do questionário' };
    return { titulo: '', texto: 'Texto da pergunta indisponível', origem: 'Indisponível' };
  }

  /* ===================== PDF ===================== */
  var CSS_PDF = '' +
    '.pdf-doc{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#ffffff;font-size:11px;line-height:1.5;padding:4px 6px}' +
    '.pdf-header{text-align:center;border-bottom:2px solid #16306a;padding-bottom:10px;margin-bottom:16px}' +
    '.pdf-header-marca{font-size:12px;letter-spacing:.08em;color:#16306a;text-transform:uppercase;margin:0}' +
    '.pdf-header-titulo{font-size:20px;margin:4px 0;color:#0e1f44}' +
    '.pdf-header-data{font-size:10px;color:#666;margin:0}' +
    '.pdf-bloco{page-break-inside:avoid;break-inside:avoid;margin:0 0 10px}' +
    '.pdf-secao-titulo{font-size:14px;color:#16306a;border-bottom:1px solid #c9d3e6;padding-bottom:3px;margin:14px 0 8px}' +
    '.pdf-subsecao{font-size:12px;color:#0e1f44;margin:10px 0 4px}' +
    '.pdf-tabela{width:100%;border-collapse:collapse;margin:4px 0}' +
    '.pdf-tabela th,.pdf-tabela td{border:1px solid #d5dbe8;padding:4px 6px;text-align:left;vertical-align:top;font-size:10.5px}' +
    '.pdf-tabela th{background:#f1f4fa;width:34%}' +
    '.pdf-tabela--versoes th{width:auto}' +
    '.pdf-destaque{font-size:13px;font-weight:bold;color:#0e1f44;margin:4px 0}' +
    '.pdf-meta{font-size:10px;color:#555;margin:2px 0}' +
    '.pdf-aviso{border-left:3px solid #c28a00;padding:3px 8px;background:#fff8e6;margin:4px 0}' +
    '.pdf-libera{border-left:3px solid #16306a;padding:3px 8px;margin:6px 0}' +
    '.pdf-pergunta{border:1px solid #e1e6f0;border-radius:4px;padding:6px 8px;margin:0 0 6px}' +
    '.pdf-pergunta-texto{margin:0 0 3px}' +
    '.pdf-evento{margin:0 0 5px}';
  function cabecalhoPdf(geradoEm) {
    return '<div class="pdf-header"><p class="pdf-header-marca">PREVI · Força Ágil</p>' +
      '<h1 class="pdf-header-titulo">Posicionamento Organizacional</h1>' +
      '<p class="pdf-header-data">Documento gerado em ' + esc(fmtData(geradoEm)) + ' — a situação (Vigente/Histórica) é a do momento da exportação</p></div>';
  }
  function documentoPdf(conteudo, comCabecalho, geradoEm) {
    return '<div class="pdf-doc"><style>' + CSS_PDF + '</style>' + (comCabecalho ? cabecalhoPdf(geradoEm) : '') + conteudo + '</div>';
  }
  function linhaTabela(rotulo, valor) { return '<tr><th>' + esc(rotulo) + '</th><td>' + esc(valor === '' || valor == null ? '—' : valor) + '</td></tr>'; }
  function blocoComTitulo(titulo, conteudo) { return '<div class="pdf-bloco"><h2 class="pdf-secao-titulo">' + esc(titulo) + '</h2>' + conteudo + '</div>'; }

  /* Átomos do PDF de UMA avaliação concluída: cada um é indivisível (título junto do primeiro conteúdo);
     o motor de blocos (faPdfEmBlocos) só agrupa átomos, nunca os corta. */
  function atomosPdf(id, ctx) {
    exigirDecisoes(ctx);
    var reg = (ctx.registros || {})[id];
    if (!reg || reg.status !== 'concluido') throw new Error('pdf-so-de-concluida');
    var ra = reg.resultadoAutomatico || {}, d = (ctx.decisoes || {})[id] || null, at = [];

    /* 1. Identificação */
    at.push(blocoComTitulo('Identificação', '<table class="pdf-tabela">' +
      linhaTabela('Item', reg.itemNome) + linhaTabela('ID do item', reg.itemId) + linhaTabela('ID da avaliação', id) +
      linhaTabela('Versão da avaliação', 'v' + (reg.versao || 1)) + linhaTabela('Situação na exportação', rotuloSituacao(id, reg, ctx)) +
      linhaTabela('Avaliação de Produto/Serviço usada', rotuloProduto(reg, ctx)) +
      linhaTabela('Versão do questionário', reg.questionnaireContentVersion) + linhaTabela('Versão do motor', ra.versaoMotor) +
      linhaTabela('Iniciada por / em', porEm(reg.criadoPor, reg.criadoEm)) +
      linhaTabela('Concluída por / em', porEm(reg.concluidoPor, reg.concluidoEm)) + '</table>'));

    /* 2. Recomendação automática (resultadoAutomatico gravado) */
    var h = '';
    if (ra.codigoResultado === 'A_VALIDAR') {
      h += '<p class="pdf-destaque">Posicionamento organizacional recomendado: A validar — ' + esc(TIPO_A_VALIDAR[ra.tipoAValidar] || ra.tipoAValidar || '') + '</p>';
      if ((ra.papeisDetectados || []).length) h += '<p>Papéis identificados: ' + esc(ra.papeisDetectados.map(function (c) { return nomeDoCodigoNaConclusao(reg, ctx, c); }).join(', ')) + '</p>';
      if (ra.nivelConfirmado) h += '<p>Nível confirmado: ' + esc(nomeDoCodigoNaConclusao(reg, ctx, ra.nivelConfirmado)) + '</p>';
    } else {
      h += '<p class="pdf-destaque">Posicionamento organizacional recomendado: ' + esc(nomeDoCodigoNaConclusao(reg, ctx, ra.codigoResultado)) + '</p>';
    }
    [ra.codigoResultado, ra.nivelConfirmado].concat(ra.papeisDetectados || []).filter(function (c, i, a) { return c && c !== 'A_VALIDAR' && a.indexOf(c) === i; }).forEach(function (c) {
      var r = nomeRegistradoNaConclusao(reg, c);
      if (!r) return;
      var atual = nomeAtual(ctx, c);
      h += '<p class="pdf-meta">' + esc(c) + ' — nome registrado na conclusão: ' + esc(r.nome) + (r.contingencia ? ' (rótulo de contingência: a Taxonomia não respondeu na hora)' : '') +
        (atual !== r.nome ? ' · nome atual na Taxonomia: ' + esc(atual) : '') + '</p>';
    });
    h += '<p class="pdf-libera">' + esc(textoLiberaAutomatico(ra)) + '</p>';
    h += '<p class="pdf-meta">Regra ' + esc(ra.regra || '—') + (ra.motivo ? ' · motivo ' + esc(ra.motivo) : '') + ' · motor v' + esc(ra.versaoMotor || '—') + '</p>';
    at.push(blocoComTitulo('Recomendação automática', h));

    /* 3. Decisão final (posicionamento-decisoes gravada) */
    if (!d) at.push(blocoComTitulo('Decisão final', '<p class="pdf-destaque">' + SEM_DECISAO + '.</p>'));
    else {
      var nd = d.nomeNaDecisao || {}, atualD = nomeAtual(ctx, d.codigoFinal);
      at.push(blocoComTitulo('Decisão final', '<table class="pdf-tabela">' +
        linhaTabela('Posicionamento final', nd.nome || atualD) +
        linhaTabela('Tipo da decisão', ROTULO_TIPO_DECISAO[d.tipoDecisao] || d.tipoDecisao) +
        linhaTabela('Justificativa', d.justificativa || '') +
        linhaTabela('Nome registrado na decisão', (nd.nome || '') + (nd.contingencia ? ' (rótulo de contingência)' : '')) +
        (atualD !== nd.nome ? linhaTabela('Nome atual na Taxonomia', atualD) : '') +
        linhaTabela('Decidido por / em', porEm(d.decididoPor, d.decididoEm)) + '</table>' +
        '<p class="pdf-libera">' + esc(textoLiberaDecisao(d)) + '</p>' +
        '<p class="pdf-meta">A decisão não muda; para corrigir, faz-se uma reavaliação.</p>'));
    }

    /* 4. Versão e reavaliação */
    at.push(blocoComTitulo('Versão e reavaliação', reg.avaliacaoAnteriorId
      ? '<p>Reavaliação da ' + esc(versaoDe(ctx, reg.avaliacaoAnteriorId)) + ' (ID ' + esc(reg.avaliacaoAnteriorId) + ') — motivo: ' + esc(reg.motivoReavaliacao || '—') + '</p>'
      : '<p>Primeira versão do Posicionamento deste item.</p>'));

    /* 5. Histórico de versões do item */
    var linhas = cadeia(reg.itemId, ctx).map(function (k) {
      var r = ctx.registros[k];
      var obs = r.motivoReavaliacao ? 'Motivo da reavaliação: ' + r.motivoReavaliacao : '';
      if (r.motivoDescarte) obs += (obs ? ' · ' : '') + 'Motivo do descarte: ' + r.motivoDescarte;
      return '<tr><td>v' + esc(r.versao || 1) + (k === id ? ' (esta)' : '') + '</td><td>' + esc(rotuloSituacao(k, r, ctx)) + '</td><td>' +
        esc(r.status === 'concluido' ? rotuloRecomendacao(r, ctx) : '—') + '</td><td>' + esc(rotuloDecisao(k, r, ctx) || '—') + '</td><td>' +
        esc(fmtData(r.concluidoEm || r.descartadoEm || r.atualizadoEm)) + '</td><td>' + esc(obs || '—') + '</td></tr>';
    }).join('');
    at.push(blocoComTitulo('Histórico de versões', '<table class="pdf-tabela pdf-tabela--versoes"><thead><tr><th>Versão</th><th>Situação na exportação</th><th>Recomendação automática</th><th>Decisão final</th><th>Data</th><th>Observação</th></tr></thead><tbody>' + linhas + '</tbody></table>'));

    /* 6. Trilha (posicionamento-auditoria) */
    var evs = eventosDe(id, ctx);
    if (evs === null) at.push(blocoComTitulo('Trilha', '<p class="pdf-aviso">' + esc(TRILHA_INDISPONIVEL) + '</p>'));
    else if (!evs.length) at.push(blocoComTitulo('Trilha', '<p>Nenhum evento registrado para esta avaliação.</p>'));
    else evs.forEach(function (e, i) {
      var linha = '<p class="pdf-evento"><strong>' + esc(fmtData(e.dataHora)) + '</strong> — ' + esc(descreverEvento(e, ctx)) + ' · ' + esc(pessoa(e.usuario)) + '</p>';
      at.push(i === 0 ? blocoComTitulo('Trilha', linha) : '<div class="pdf-bloco">' + linha + '</div>');
    });

    /* 7. Respostas O1–O9 e diagnósticos (textos da época) */
    var primeira = true;
    ORDEM_NIVEIS.forEach(function (n) {
      var blocos = [];
      NIVEIS[n].forEach(function (q) {
        var r = reg.respostas && reg.respostas[q];
        if (!r || !r.resposta) return;
        var t = textoDaPergunta(q, r, reg, ctx);
        blocos.push('<div class="pdf-pergunta"><p class="pdf-pergunta-texto"><strong>' + esc(q) + (t.titulo ? ' — ' + esc(t.titulo) : '') + '</strong><br>' + esc(t.texto) +
          ' — <strong>' + (r.resposta === 'SIM' ? 'SIM' : 'NÃO') + '</strong></p>' +
          (r.interpretacaoNaEpoca ? '<p class="pdf-meta">Interpretação: ' + esc(r.interpretacaoNaEpoca) + '</p>' : '') +
          (r.observacao ? '<p class="pdf-meta">Observação: ' + esc(r.observacao) + '</p>' : '') +
          (t.origem !== 'Registrado na resposta' ? '<p class="pdf-meta">Origem do texto: ' + esc(t.origem) + '</p>' : '') + '</div>');
      });
      var dg = reg.diagnosticos && reg.diagnosticos[n];
      if (dg && dg.resposta) {
        var td = textoDaPergunta('DIAG_CONFLITO_RECORTE', dg, reg, ctx);
        blocos.push('<div class="pdf-pergunta"><p class="pdf-pergunta-texto"><strong>Diagnóstico do ' + esc(TITULO_NIVEL[n].split(' — ')[0]) + (td.titulo ? ' — ' + esc(td.titulo) : '') + '</strong><br>' +
          esc(td.texto) + ' — <strong>' + esc(dg.rotuloNaEpoca || dg.resposta) + '</strong></p>' +
          '<p class="pdf-meta">Papéis: ' + esc((dg.papeis || []).map(function (c) { return nomeDoCodigoNaConclusao(reg, ctx, c); }).join(' e ')) + '</p>' +
          (dg.interpretacaoNaEpoca ? '<p class="pdf-meta">Interpretação: ' + esc(dg.interpretacaoNaEpoca) + '</p>' : '') +
          (dg.observacao ? '<p class="pdf-meta">Observação: ' + esc(dg.observacao) + '</p>' : '') + '</div>');
      }
      blocos.forEach(function (b, i) {
        var pre = (primeira && i === 0 ? '<h2 class="pdf-secao-titulo">Respostas O1–O9</h2>' : '') + (i === 0 ? '<h3 class="pdf-subsecao">' + esc(TITULO_NIVEL[n]) + '</h3>' : '');
        at.push('<div class="pdf-bloco">' + pre + b + '</div>');
      });
      if (blocos.length) primeira = false;
    });
    return at;
  }
  function nomeArquivoPdf(id, ctx, hojeIso) {
    var reg = (ctx.registros || {})[id] || {};
    return 'Posicionamento_Organizacional_' + nomeSeguro(reg.itemNome || reg.itemId) + '_v' + (reg.versao || 1) + '_' + String(hojeIso || ctx.geradoEm || '').slice(0, 10) + '.pdf';
  }
  function nomeArquivoExcel(escopo, hojeIso) { return 'Posicionamentos_Organizacionais_' + escopo + '_' + String(hojeIso || '').slice(0, 10) + '.xlsx'; }
  function nomeSeguro(t) {
    var s = String(t || 'item').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return (s || 'item').slice(0, 80);
  }

  /* ===================== EXCEL ===================== */
  var COLS_RESUMO = [
    ['ID do item', 18], ['Item', 30], ['ID da avaliação', 24], ['Versão', 8], ['Situação na exportação', 22], ['Status', 12],
    ['ID da Avaliação de Produto/Serviço usada', 26], ['Avaliação de Produto/Serviço usada', 44], ['Versão do questionário', 12],
    ['Recomendação automática (código)', 26], ['Recomendação automática', 34], ['Nome registrado na conclusão', 34], ['Contingência na conclusão', 14],
    ['Tipo de "A validar"', 22], ['Regra', 26], ['Motivo', 22], ['Versão do motor', 10], ['Libera S1–S8 (recomendação automática)', 16],
    ['Decisão final (código)', 26], ['Decisão final', 34], ['Nome atual da decisão na Taxonomia', 34], ['Tipo da decisão', 30], ['Justificativa', 50],
    ['Libera S1–S8 (decisão final)', 16], ['Decidido por', 22], ['Decidido em', 18],
    ['Avaliação anterior', 24], ['Motivo da reavaliação', 40], ['Criado por', 22], ['Criado em', 18], ['Concluído por', 22], ['Concluído em', 18],
    ['Motivo do descarte', 40], ['Descartado por', 22], ['Descartado em', 18]
  ];
  function linhaResumo(id, ctx) {
    var r = ctx.registros[id], ra = r.resultadoAutomatico || {}, conc = r.status === 'concluido', d = conc ? (ctx.decisoes || {})[id] : null;
    var cod = ra.codigoResultado, nc = cod && cod !== 'A_VALIDAR' ? nomeRegistradoNaConclusao(r, cod) : null, pv = produtoVinculado(r, ctx);
    return [
      r.itemId || '', r.itemNome || '', id, r.versao || 1, rotuloSituacao(id, r, ctx), { rascunho: 'Rascunho', concluido: 'Concluída', descartado: 'Descartada' }[r.status] || r.status || '',
      pv.id, rotuloProduto(r, ctx), r.questionnaireContentVersion || '',
      conc ? cod || '' : '', conc ? rotuloRecomendacao(r, ctx) : '', nc ? nc.nome : '', nc ? simNao(nc.contingencia) : '',
      conc && ra.tipoAValidar ? TIPO_A_VALIDAR[ra.tipoAValidar] || ra.tipoAValidar : '', conc ? ra.regra || '' : '', conc ? ra.motivo || '' : '',
      conc ? ra.versaoMotor || '' : '', conc ? simNao(ra.liberaSquad) : '',
      d ? d.codigoFinal : '', conc ? (d ? (d.nomeNaDecisao && d.nomeNaDecisao.nome) || d.codigoFinal : SEM_DECISAO) : '', d ? nomeAtual(ctx, d.codigoFinal) : '',
      d ? ROTULO_TIPO_DECISAO[d.tipoDecisao] || d.tipoDecisao : '', d ? d.justificativa || '' : '', d ? simNao(d.liberaSquad) : '',
      d ? pessoa(d.decididoPor) : '', d ? data(d.decididoEm) : '',
      r.avaliacaoAnteriorId || '', r.motivoReavaliacao || '', pessoa(r.criadoPor), data(r.criadoEm), pessoa(r.concluidoPor), data(r.concluidoEm),
      r.motivoDescarte || '', pessoa(r.descartadoPor), data(r.descartadoEm)
    ];
  }
  var COLS_RESPOSTAS = [
    ['ID do item', 18], ['Item', 30], ['ID da avaliação', 24], ['Versão', 8], ['Situação na exportação', 22], ['Nível', 8], ['Código', 14],
    ['Título (da época)', 30], ['Pergunta (texto da época)', 60], ['Resposta', 26], ['Papéis (diagnóstico)', 40], ['Interpretação (da época)', 50],
    ['Observação', 40], ['Versão do questionário', 12], ['Data da resposta', 18], ['Origem do texto', 24]
  ];
  function linhasRespostas(ids, ctx) {
    var out = [];
    ids.forEach(function (id) {
      var r = ctx.registros[id], sit = rotuloSituacao(id, r, ctx);
      ORDEM_NIVEIS.forEach(function (n) {
        NIVEIS[n].forEach(function (q) {
          var x = r.respostas && r.respostas[q];
          if (!x || !x.resposta) return;
          var t = textoDaPergunta(q, x, r, ctx);
          out.push([r.itemId || '', r.itemNome || '', id, r.versao || 1, sit, n, q, t.titulo, t.texto, x.resposta === 'SIM' ? 'SIM' : 'NÃO', '',
            x.interpretacaoNaEpoca || '', x.observacao || '', x.questionnaireContentVersion || '', data(x.dataResposta), t.origem]);
        });
        var dg = r.diagnosticos && r.diagnosticos[n];
        if (dg && dg.resposta) {
          var td = textoDaPergunta('DIAG_CONFLITO_RECORTE', dg, r, ctx);
          out.push([r.itemId || '', r.itemNome || '', id, r.versao || 1, sit, n, 'Diagnóstico ' + n, td.titulo, td.texto, dg.rotuloNaEpoca || dg.resposta,
            (dg.papeis || []).map(function (c) { return nomeDoCodigoNaConclusao(r, ctx, c); }).join(' e '),
            dg.interpretacaoNaEpoca || '', dg.observacao || '', dg.questionnaireContentVersion || '', data(dg.dataResposta), td.origem]);
        }
      });
    });
    return out;
  }
  /* versões de TODOS os itens do escopo, mesmo as fora do filtro (como Produto/Serviço) */
  function idsDoHistorico(ids, ctx) {
    var itens = {}, out = [];
    ids.forEach(function (id) { var r = ctx.registros[id]; if (r) itens[r.itemId] = true; });
    Object.keys(itens).sort().forEach(function (it) { out = out.concat(cadeia(it, ctx)); });
    return out;
  }
  var COLS_HISTORICO = [
    ['ID do item', 18], ['Item', 30], ['Versão', 8], ['ID da avaliação', 24], ['Situação na exportação', 22], ['Avaliação anterior', 24],
    ['Motivo da reavaliação', 40], ['Recomendação automática', 34], ['Decisão final', 34], ['Tipo da decisão', 30],
    ['Data (conclusão/descarte/atualização)', 18], ['Responsável', 22], ['Motivo do descarte', 40]
  ];
  function linhasHistorico(ids, ctx) {
    return idsDoHistorico(ids, ctx).map(function (id) {
      var r = ctx.registros[id], d = r.status === 'concluido' ? (ctx.decisoes || {})[id] : null;
      return [r.itemId || '', r.itemNome || '', r.versao || 1, id, rotuloSituacao(id, r, ctx), r.avaliacaoAnteriorId || '', r.motivoReavaliacao || '',
        r.status === 'concluido' ? rotuloRecomendacao(r, ctx) : '', rotuloDecisao(id, r, ctx), d ? ROTULO_TIPO_DECISAO[d.tipoDecisao] || d.tipoDecisao : '',
        data(r.concluidoEm || r.descartadoEm || r.atualizadoEm), pessoa(r.concluidoPor || r.descartadoPor || r.atualizadoPor), r.motivoDescarte || ''];
    });
  }
  var COLS_TRILHA = [
    ['ID do item', 18], ['ID da avaliação', 24], ['Versão', 8], ['Data e hora', 18], ['Evento', 14], ['Responsável', 22],
    ['Avaliação anterior / vigente anterior', 26], ['Código automático', 24], ['Código final', 24], ['Tipo da decisão', 30],
    ['Libera S1–S8', 12], ['Justificativa / motivo', 50], ['Descrição', 70]
  ];
  function linhasTrilha(ids, ctx) {
    var out = [];
    idsDoHistorico(ids, ctx).forEach(function (id) {
      var r = ctx.registros[id], evs = eventosDe(id, ctx);
      if (evs === null) { out.push([r.itemId || '', id, r.versao || 1, '', 'Trilha indisponível', '', '', '', '', '', '', '', TRILHA_INDISPONIVEL]); return; }
      evs.forEach(function (e) {
        out.push([r.itemId || '', id, r.versao || 1, data(e.dataHora), ROTULO_EVENTO[e.tipo] || e.tipo || '', pessoa(e.usuario),
          e.avaliacaoAnteriorId || e.vigenteAnterior || '', e.codigoAutomatico || e.codigoResultado || '', e.codigoFinal || '',
          e.tipoDecisao ? ROTULO_TIPO_DECISAO[e.tipoDecisao] || e.tipoDecisao : '', simNao(e.liberaSquad),
          e.justificativa || e.motivo || '', descreverEvento(e, ctx)]);
      });
    });
    return out;
  }
  function aba(nome, cols, linhas) { return { nome: nome, cabecalho: cols.map(function (c) { return c[0]; }), larguras: cols.map(function (c) { return c[1]; }), linhas: linhas }; }
  /* ids = avaliações do escopo (lista atual ou todas), na ordem desejada */
  function abasExcel(ids, ctx) {
    exigirDecisoes(ctx);
    ids = ids.filter(function (id) { return (ctx.registros || {})[id]; });
    return [
      aba('Resumo', COLS_RESUMO, ids.map(function (id) { return linhaResumo(id, ctx); })),
      aba('Respostas O1–O9', COLS_RESPOSTAS, linhasRespostas(ids, ctx)),
      aba('Histórico', COLS_HISTORICO, linhasHistorico(ids, ctx)),
      aba('Trilha', COLS_TRILHA, linhasTrilha(ids, ctx))
    ];
  }

  var api = Object.freeze({
    atomosPdf: atomosPdf, documentoPdf: documentoPdf, cabecalhoPdf: cabecalhoPdf, abasExcel: abasExcel,
    nomeArquivoPdf: nomeArquivoPdf, nomeArquivoExcel: nomeArquivoExcel, situacao: situacao,
    SEM_DECISAO: SEM_DECISAO, VINCULADA_INDISPONIVEL: VINCULADA_INDISPONIVEL, TRILHA_INDISPONIVEL: TRILHA_INDISPONIVEL, CSS_PDF: CSS_PDF
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faExportacoesPosicionamento = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
