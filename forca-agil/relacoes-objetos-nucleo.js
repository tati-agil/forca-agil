/* ============================================================
   E4 — RELAÇÕES ENTRE OBJETOS ARQUITETURAIS: núcleo PURO (sem DOM, sem banco, sem relógio, sem gerador de id).
   window.faRelacoesObjetosNucleo / module.exports. Usado pela tela (relacoes-objetos.js), pelas regras do banco
   (montar-regras-relacoes-objetos.js gera o trecho de database.rules.json DESTA matriz) e pelos testes.

   O que E4 acrescenta às três perguntas (o que é / onde deveria estar / onde de fato ficou): com quais outros objetos
   este se relaciona, e como. Uma relação NUNCA muda natureza, posicionamento, decisão ou alocação de nenhuma ponta, e
   não quer dizer que as duas pontas estão na mesma estrutura. O Mapa da Floresta não muda.

   NATUREZAS (decisão A1/A2, 18/10/2026): só Produto/Serviço é natureza conjunta. As outras são individuais:
     - camadas do motor que já são uma natureza só: Componente, Canal, Capacidade organizacional, Unidade de valor
       associada (e Produto/Serviço, pela decisão final);
     - camadas conjuntas do motor: a natureza individual é REGISTRADA uma vez por objeto, por quem mantém (objetos-natureza),
       nunca deduzida e nunca gravada na avaliação. Na E4: Funcionalidade · Operação (funcionalidade-operacao), Processo ·
       Etapa (processo-etapa), Regra (regra-condicao), Opção (modalidade-subproduto — A2: a alternativa que o participante
       escolhe entre as que uma regra permite), Documento · Informação (documento-informacao). Modalidade e Subproduto
       ficam para a E5: esses objetos não recebem natureza individual nem relações na E4.
     - Porta 2 (objeto organizacional): identidade própria, sem P1–P16; só "atua sobre" (A5).
   Cada natureza individual só pode ser registrada depois que o conceito oficial dela existir na Taxonomia arquitetural,
   ativo, com definição publicada e naturezaDe = a camada do motor que a contém: nenhum conceito nasce sem definição
   aprovada, e nada aqui cria conceito sozinho.

   MATRIZ (A3/A4): 8 tipos + "atua sobre"; 21 pares aprovados + "atua sobre" da Porta 2. Nada é herdado entre naturezas
   e o que não está na matriz é recusado (aqui e nas regras do banco). Versionada: cada relação guarda a versão.

   INTEGRIDADE (A6): autorrelação, duplicidade ativa e par recíproco do mesmo tipo são sempre recusados; ciclo é recusado
   em "compõe" em qualquer extensão, pelo GRAFO de relações (não pelas naturezas). Toda criação de "compõe" incrementa o
   contador de versão do grafo (as regras conferem: duas criações simultâneas não passam juntas). validarMatriz() confere
   que os pares de "compõe" não formam caminho cíclico entre naturezas (assim nem uma gravação direta cria um ciclo).
   ============================================================ */
(function (raiz) {
  'use strict';

  var VERSAO_MATRIZ = 1;
  var RAIZ = 'relacoes-objetos', NAT = 'objetos-natureza', NAT_AUD = 'objetos-natureza-auditoria';
  /* índice da versão VIGENTE de cada item P1–P16 (a ponta da cadeia de reavaliações), mantido por avaliacao-produto.js */
  var PONTA = 'avaliacoes-produto-ponta';
  var MARCADOR = 'relacoes-objetos-config/gravacaoHabilitada';
  var MAX = { observacao: 500, motivo: 500 };
  var ID = /^[A-Za-z0-9_-]{1,60}$/;

  /* ---------- naturezas ----------
     O MODELO é único e central: naturezas-arquiteturais.js (window.faNaturezasArquiteturais) — as 15 naturezas, a
     identidade de cada uma na Taxonomia e a correspondência classificação do motor → naturezas. A E4 deriva daqui só as
     que podem ter relações (E5: Modalidade e Subproduto entram como individuais da classificação modalidade-subproduto), na ordem histórica da matriz
     v1 (a ordem gera as regras do banco: mudá-la mudaria o texto das regras sem mudar nada de significado).
     rótulo de FÁBRICA (contingência): o nome oficial vem da Taxonomia arquitetural */
  var M = raiz && raiz.faNaturezasArquiteturais ? raiz.faNaturezasArquiteturais : (typeof require === 'function' ? require('./naturezas-arquiteturais.js') : null);
  if (!M) throw new Error('relacoes-objetos-nucleo: naturezas-arquiteturais.js precisa ser carregado antes');
  var ORDEM_E4 = ['produto', 'componente', 'canal', 'capacidade', 'unidade-valor', 'funcionalidade', 'operacao', 'processo', 'etapa', 'regra', 'opcao', 'documento', 'informacao',
    'modalidade', 'subproduto']; /* E5: no fim, para as regras existentes não mudarem de lugar */
  var NATUREZAS = {};
  ORDEM_E4.forEach(function (c) {
    var n = M.natureza(c);
    NATUREZAS[c] = n.modelo === 'individual' ? { camada: n.classificacao, conceito: n.conceito, rotulo: n.rotulo, individual: true } : { camada: n.classificacao, conceito: n.conceito, rotulo: n.rotulo };
  });
  NATUREZAS.responsabilidade = { camada: null, rotulo: 'Responsabilidade organizacional', porta2: true };
  /* classificação do motor que já é uma natureza só (não precisa de registro) — Produto/Serviço vem da decisão final */
  var NATUREZA_DA_CAMADA = {};
  ORDEM_E4.forEach(function (c) { var n = M.natureza(c); if (n.modelo === 'direta' && c !== 'produto') NATUREZA_DA_CAMADA[n.classificacao] = c; });
  /* naturezas individuais que a E4 registra, por classificação técnica do motor (Modalidade e Subproduto: E5) */
  var INDIVIDUAIS_DA_CAMADA = {};
  Object.keys(NATUREZAS).forEach(function (n) { var x = NATUREZAS[n]; if (x.individual) (INDIVIDUAIS_DA_CAMADA[x.camada] = INDIVIDUAIS_DA_CAMADA[x.camada] || []).push(n); });
  var CODIGOS_INDIVIDUAIS = Object.keys(NATUREZAS).filter(function (n) { return NATUREZAS[n].individual; });
  /* naturezas P1–P16 (tudo menos a Porta 2) */
  var NATUREZAS_P1P16 = Object.keys(NATUREZAS).filter(function (n) { return !NATUREZAS[n].porta2; });

  /* ---------- tipos ---------- */
  var TIPOS = {
    compoe: { direta: 'faz parte de', inversa: 'é composto por', hierarquico: true },
    usa: { direta: 'usa', inversa: 'é usado por' },
    governa: { direta: 'governa', inversa: 'é governado por' },
    expressa: { direta: 'expressa', inversa: 'está expressa em' },
    dispara: { direta: 'dispara', inversa: 'é disparado por' },
    produz: { direta: 'produz', inversa: 'é produzido por' },
    'exerce-por-meio-de': { direta: 'exerce-se por meio de', inversa: 'é meio de' },
    'da-acesso': { direta: 'dá acesso a', inversa: 'é acessado por meio de' },
    'atua-sobre': { direta: 'atua sobre', inversa: 'é objeto de atuação de' }
  };

  /* ---------- matriz v1: SÓ os pares aprovados (A4: 1–21) + "atua sobre" da Porta 2 (A5) ---------- */
  var PARES = [
    ['compoe', 'componente', 'produto'], ['usa', 'operacao', 'componente'], ['usa', 'operacao', 'capacidade'],
    ['governa', 'regra', 'operacao'], ['governa', 'regra', 'componente'], ['governa', 'regra', 'processo'],
    ['expressa', 'documento', 'regra'], ['dispara', 'operacao', 'processo'], ['produz', 'processo', 'documento'],
    ['produz', 'operacao', 'documento'], ['exerce-por-meio-de', 'capacidade', 'processo'], ['exerce-por-meio-de', 'capacidade', 'canal'],
    ['da-acesso', 'canal', 'funcionalidade'], ['da-acesso', 'canal', 'processo'], ['da-acesso', 'canal', 'documento'],
    ['compoe', 'etapa', 'processo'], ['usa', 'funcionalidade', 'operacao'],
    ['compoe', 'funcionalidade', 'produto'], ['da-acesso', 'canal', 'produto'], ['governa', 'regra', 'produto'], ['governa', 'regra', 'opcao']
  ].concat(NATUREZAS_P1P16.map(function (n) { return ['atua-sobre', 'responsabilidade', n]; }))
    .map(function (p) { return Object.freeze({ tipo: p[0], de: p[1], para: p[2] }); });
  function parAdmitido(tipo, de, para) { return PARES.some(function (p) { return p.tipo === tipo && p.de === de && p.para === para; }); }

  /* a matriz é coerente: tipos e naturezas conhecidos, sem par repetido, sem autorrelação de natureza em "compõe" e sem
     caminho cíclico entre naturezas em "compõe" (devolve a lista de problemas; vazia = ok) */
  function validarMatriz(pares) {
    pares = pares || PARES;
    var p = [], vistos = {};
    pares.forEach(function (x) {
      var k = x.tipo + '|' + x.de + '|' + x.para;
      if (!TIPOS[x.tipo]) p.push('tipo desconhecido: ' + x.tipo);
      if (!NATUREZAS[x.de] || !NATUREZAS[x.para]) p.push('natureza desconhecida: ' + k);
      if (vistos[k]) p.push('par repetido: ' + k);
      vistos[k] = true;
    });
    var arestas = {};
    pares.filter(function (x) { return TIPOS[x.tipo] && TIPOS[x.tipo].hierarquico; }).forEach(function (x) { (arestas[x.de] = arestas[x.de] || []).push(x.para); });
    if (temCiclo(arestas)) p.push('os pares de "compõe" formam caminho cíclico entre naturezas');
    return p;
  }
  /* DFS: há ciclo no grafo dirigido (mapa nó → lista de vizinhos)? */
  function temCiclo(arestas) {
    var cor = {};
    function visita(n) {
      cor[n] = 1;
      var viz = arestas[n] || [];
      for (var i = 0; i < viz.length; i++) {
        if (cor[viz[i]] === 1) return true;
        if (!cor[viz[i]] && visita(viz[i])) return true;
      }
      cor[n] = 2; return false;
    }
    return Object.keys(arestas).some(function (n) { return !cor[n] && visita(n); });
  }
  /* existe caminho de "de" até "para" pelas relações ATIVAS de "compõe"? (a nova aresta para→de fecharia um ciclo) */
  function alcanca(registros, tipo, de, para) {
    var viz = {};
    valores(registros).forEach(function (r) { if (r && r.situacao === 'ativa' && r.tipo === tipo) (viz[r.origem] = viz[r.origem] || []).push(r.destino); });
    var pilha = [de], visto = {};
    while (pilha.length) {
      var n = pilha.pop();
      if (n === para) return true;
      if (visto[n]) continue;
      visto[n] = true;
      (viz[n] || []).forEach(function (x) { pilha.push(x); });
    }
    return false;
  }

  /* ---------- utilitários ---------- */
  function valores(o) { return Object.keys(o || {}).map(function (k) { return o[k]; }); }
  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }
  function chaveAtiva(origem, tipo, destino) { return origem + '__' + tipo + '__' + destino; }
  function erro(codigo, extra) { var e = { codigo: codigo }; Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; }); return e; }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  /* ---------- conceito oficial de uma natureza individual (Taxonomia arquitetural) ----------
     c = { ativo, naturezaDe, temDefinicao } (o que as regras deixam os três perfis lerem). Só um conceito ativo, com
     definição publicada e ligado à camada certa permite registrar a natureza. */
  function conceitoValido(codigo, c) {
    var n = NATUREZAS[codigo];
    return !!(n && n.individual && c && c.ativo === true && c.temDefinicao === true && c.naturezaDe === n.camada);
  }

  /* ---------- a natureza que AUTORIZA uma relação (A4/D4) ----------
     entrada P1–P16: { gate: { situacao, libera, chave, avaliacao } (faAvaliacaoPosicionamentoNucleo.gateDoItem: a
       avaliação que vale — ponta da cadeia, concluída, não excluída, com Motor atual), registro: objetos-natureza/<id> }
     entrada Porta 2: { porta2: objetos-organizacionais/<id> }
     devolve { natureza, base } ou { natureza: null, motivo, base?, camada? } — nunca um palpite. */
  /* e.indice (opcional) = avaliacoes-produto-ponta/<item>: a versão VIGENTE registrada no banco (ponta da cadeia de
     reavaliações). Quando informado, a avaliação que vale tem de ser exatamente ela — é o que as regras do banco
     conferem; null = índice ainda não reconciliado (item antigo) → nenhuma natureza, com o motivo. undefined = não
     conferido aqui (uso puro, sem o índice). */
  function naturezaDoObjeto(e) {
    e = e || {};
    if (e.porta2) return e.porta2.situacao === 'ativo' ? { natureza: 'responsabilidade', base: null } : { natureza: null, motivo: 'OBJETO_ENCERRADO' };
    var g = e.gate;
    if (!g || g.situacao === 'verificando') return { natureza: null, motivo: 'VERIFICANDO', indisponivel: true };
    if (!g.libera || !g.avaliacao) return { natureza: null, motivo: 'SEM_AVALIACAO_VALIDA', gate: g.situacao };
    if (e.indice !== undefined && e.indice !== g.chave) return { natureza: null, motivo: 'VERSAO_VIGENTE_NAO_CONFIRMADA', base: g.chave, indice: e.indice };
    var av = g.avaliacao, d = av.decisaoFinal || av.resultadoAutomatico, camada = av.camadaSugerida && av.camadaSugerida.id;
    if (d === 'produto') return { natureza: 'produto', base: g.chave };
    if (d !== 'nao-produto') return { natureza: null, motivo: 'A_VALIDAR', base: g.chave };
    if (!camada || camada === 'a-validar') return { natureza: null, motivo: 'A_VALIDAR', base: g.chave };
    if (camada === 'produto-principal') return { natureza: null, motivo: 'DECISAO_INCOERENTE', base: g.chave };
    if (NATUREZA_DA_CAMADA[camada]) return { natureza: NATUREZA_DA_CAMADA[camada], base: g.chave };
    var possiveis = INDIVIDUAIS_DA_CAMADA[camada];
    if (!possiveis) return { natureza: null, motivo: 'CAMADA_FORA_DA_E4', base: g.chave, camada: camada };
    var reg = e.registro;
    var ori = M.orientacao(camada); /* ex.: Regra/Opção que seja de fato Opção → reavaliação explícita, nunca reclassificação */
    if (!reg) return { natureza: null, motivo: 'NATUREZA_NAO_REGISTRADA', base: g.chave, camada: camada, possiveis: possiveis.slice(), orientacao: ori };
    if (reg.camada !== camada || possiveis.indexOf(reg.natureza) === -1) return { natureza: null, motivo: 'NATUREZA_A_CONFIRMAR', base: g.chave, camada: camada, possiveis: possiveis.slice(), registrada: reg.natureza, orientacao: ori };
    return { natureza: reg.natureza, base: g.chave, camada: camada, registrada: reg.natureza };
  }

  /* ---------- situação CALCULADA de uma relação (A8) — nada é encerrado sozinho ----------
     atual = { origem: naturezaDoObjeto(...), destino: naturezaDoObjeto(...) } */
  function situacaoRelacao(rel, atual) {
    if (!rel) return null;
    if (rel.situacao === 'encerrada') return { situacao: 'encerrada', motivos: [] };
    var o = (atual && atual.origem) || {}, d = (atual && atual.destino) || {};
    if (o.indisponivel || d.indisponivel) return { situacao: 'nao-conferida', motivos: ['REFERENCIA_INDISPONIVEL'] };
    var m = [];
    [[o, rel.naturezaOrigem, 'ORIGEM'], [d, rel.naturezaDestino, 'DESTINO']].forEach(function (x) {
      if (!x[0].natureza) m.push(x[0].motivo === 'OBJETO_ENCERRADO' || x[0].gate === 'excluida' ? 'PONTA_ENCERRADA' : 'NATUREZA_INDISPONIVEL_' + x[2]);
      else if (x[0].natureza !== x[1]) m.push('NATUREZA_MUDOU_' + x[2]);
    });
    if (!m.length && !parAdmitido(rel.tipo, o.natureza, d.natureza)) m.push('PAR_NAO_ADMITIDO');
    return { situacao: m.length ? 'a-revisar' : 'ativa', motivos: m.filter(function (x, i) { return m.indexOf(x) === i; }) };
  }

  /* ---------- criar uma relação ----------
     estado = { registros } (relacoes-objetos/registros); dados = { origem, tipo, destino, observacao? };
     naturezas = { origem: naturezaDoObjeto(...), destino: naturezaDoObjeto(...) };
     ctx = { relacaoId, operacaoId, usuario: { id, email }, agora, versaoCompoe (o valor ATUAL do contador, 0 se ausente) }.
     Devolve { ok: false, erros } ou { ok: true, caminhos } (uma gravação multipath, tudo ou nada). */
  function criarRelacao(estado, dados, naturezas, ctx) {
    var reg = (estado && estado.registros) || {}, e = [];
    dados = dados || {}; naturezas = naturezas || {}; ctx = ctx || {};
    var o = texto(dados.origem), t = dados.tipo, d = texto(dados.destino), obs = texto(dados.observacao);
    var no = naturezas.origem || {}, nd = naturezas.destino || {};
    if (!TIPOS[t]) e.push(erro('TIPO_INVALIDO'));
    if (!ID.test(o) || !ID.test(d)) e.push(erro('PONTA_INVALIDA'));
    if (o && o === d) e.push(erro('AUTORRELACAO'));
    if (!no.natureza) e.push(erro('NATUREZA_ORIGEM_INDISPONIVEL', { motivo: no.motivo || null }));
    if (!nd.natureza) e.push(erro('NATUREZA_DESTINO_INDISPONIVEL', { motivo: nd.motivo || null }));
    if (TIPOS[t] && no.natureza && nd.natureza && !parAdmitido(t, no.natureza, nd.natureza)) e.push(erro('PAR_NAO_ADMITIDO'));
    if (obs.length > MAX.observacao) e.push(erro('OBSERVACAO_LONGA'));
    if (!e.length) {
      var ativas = valores(reg).filter(function (r) { return r && r.situacao === 'ativa'; });
      if (ativas.some(function (r) { return r.origem === o && r.tipo === t && r.destino === d; })) e.push(erro('RELACAO_DUPLICADA'));
      if (ativas.some(function (r) { return r.origem === d && r.tipo === t && r.destino === o; })) e.push(erro('RELACAO_RECIPROCA'));
      if (TIPOS[t].hierarquico && alcanca(reg, t, d, o)) e.push(erro('CICLO_NA_COMPOSICAO'));
    }
    if (!ctx.relacaoId || !ctx.operacaoId || !ctx.usuario || !ctx.usuario.id || !ctx.usuario.email) e.push(erro('CONTEXTO_INCOMPLETO'));
    if (e.length) return { ok: false, erros: e };
    var id = ctx.relacaoId, op = ctx.operacaoId, ev = op + ':1';
    var r = { id: id, origem: o, tipo: t, destino: d, naturezaOrigem: no.natureza, naturezaDestino: nd.natureza, versaoMatriz: VERSAO_MATRIZ,
      situacao: 'ativa', revisao: 1, criadaEm: ctx.agora, criadaPor: { id: ctx.usuario.id, email: ctx.usuario.email }, ultimaOperacao: op, ultimoEvento: ev };
    if (no.base) r.baseOrigem = no.base;
    if (nd.base) r.baseDestino = nd.base;
    if (obs) r.observacao = obs;
    var c = {};
    c[RAIZ + '/registros/' + id] = r;
    c[RAIZ + '/ativa-por-chave/' + chaveAtiva(o, t, d)] = id;
    c[RAIZ + '/eventos/' + ev] = { id: ev, operacaoId: op, tipo: 'relacao.criada', entidadeId: id, usuario: { id: ctx.usuario.id, email: ctx.usuario.email }, em: ctx.agora, depois: clone(r) };
    c[RAIZ + '/operacoes/' + op] = { tipo: 'criarRelacao', relacaoId: id, usuario: { id: ctx.usuario.id, email: ctx.usuario.email }, em: ctx.agora };
    if (TIPOS[t].hierarquico) c[RAIZ + '/versao-compoe'] = (Number(ctx.versaoCompoe) || 0) + 1;
    return { ok: true, caminhos: c, relacao: r };
  }

  /* ---------- encerrar uma relação (motivo obrigatório; final; nada se apaga) ---------- */
  function encerrarRelacao(estado, id, motivo, ctx) {
    var reg = (estado && estado.registros) || {}, r = reg[id], m = texto(motivo), e = [];
    ctx = ctx || {};
    if (!r) e.push(erro('RELACAO_INEXISTENTE'));
    else if (r.situacao !== 'ativa') e.push(erro('RELACAO_JA_ENCERRADA'));
    if (!m) e.push(erro('MOTIVO_OBRIGATORIO'));
    else if (m.length > MAX.motivo) e.push(erro('MOTIVO_LONGO'));
    if (!ctx.operacaoId || !ctx.usuario || !ctx.usuario.id || !ctx.usuario.email) e.push(erro('CONTEXTO_INCOMPLETO'));
    if (e.length) return { ok: false, erros: e };
    var op = ctx.operacaoId, ev = op + ':1', n = clone(r);
    n.situacao = 'encerrada'; n.revisao = (r.revisao || 1) + 1;
    n.encerramento = { motivo: m, em: ctx.agora, por: { id: ctx.usuario.id, email: ctx.usuario.email } };
    n.ultimaOperacao = op; n.ultimoEvento = ev;
    var c = {};
    c[RAIZ + '/registros/' + id] = n;
    c[RAIZ + '/ativa-por-chave/' + chaveAtiva(r.origem, r.tipo, r.destino)] = null;
    c[RAIZ + '/eventos/' + ev] = { id: ev, operacaoId: op, tipo: 'relacao.encerrada', entidadeId: id, usuario: { id: ctx.usuario.id, email: ctx.usuario.email }, em: ctx.agora, depois: clone(n) };
    c[RAIZ + '/operacoes/' + op] = { tipo: 'encerrarRelacao', relacaoId: id, usuario: { id: ctx.usuario.id, email: ctx.usuario.email }, em: ctx.agora };
    return { ok: true, caminhos: c, relacao: n };
  }

  /* ---------- registrar a natureza individual de um objeto (A1) ----------
     objetoId: o item P1–P16 (identidade, nunca a versão); natureza: código individual; gate: a avaliação que vale;
     atual: objetos-natureza/<objetoId> (ou null); conceito: o conceito oficial da natureza (conceitoValido);
     ctx = { auditoriaId, usuario: { id, email }, agora }. Uma gravação: o registro + a auditoria nova (só acréscimo). */
  function registrarNatureza(objetoId, natureza, gate, atual, conceito, ctx) {
    var e = [], n = NATUREZAS[natureza], av = gate && gate.libera ? gate.avaliacao : null;
    ctx = ctx || {};
    var camada = av && av.camadaSugerida && av.camadaSugerida.id, d = av && (av.decisaoFinal || av.resultadoAutomatico);
    if (!ID.test(String(objetoId || ''))) e.push(erro('OBJETO_INVALIDO'));
    if (!n || !n.individual) e.push(erro('NATUREZA_INVALIDA'));
    if (!av) e.push(erro('SEM_AVALIACAO_VALIDA'));
    else if (d !== 'nao-produto') e.push(erro('DECISAO_NAO_PERMITE'));
    else if (n && n.individual && camada !== n.camada) e.push(erro('NATUREZA_FORA_DA_CAMADA'));
    if (n && n.individual && !conceitoValido(natureza, conceito)) e.push(erro('CONCEITO_SEM_DEFINICAO_OFICIAL'));
    if (atual && atual.natureza === natureza && atual.camada === camada && atual.avaliacaoId === gate.chave) e.push(erro('NADA_MUDOU'));
    if (!ctx.auditoriaId || !ctx.usuario || !ctx.usuario.id || !ctx.usuario.email) e.push(erro('CONTEXTO_INCOMPLETO'));
    if (e.length) return { ok: false, erros: e };
    var rev = atual ? (atual.revisao || 1) + 1 : 1;
    var rec = { natureza: natureza, camada: camada, avaliacaoId: gate.chave, revisao: rev, registradaEm: ctx.agora, registradaPor: { id: ctx.usuario.id, email: ctx.usuario.email }, auditoriaId: ctx.auditoriaId };
    var aud = { tipo: atual ? 'alteracao' : 'registro', natureza: natureza, camada: camada, avaliacaoId: gate.chave, revisao: rev, em: ctx.agora, por: { id: ctx.usuario.id, email: ctx.usuario.email } };
    if (atual) aud.anterior = atual.natureza;
    var c = {};
    c[NAT + '/' + objetoId] = rec;
    c[NAT_AUD + '/' + objetoId + '/' + ctx.auditoriaId] = aud;
    return { ok: true, caminhos: c, registro: rec };
  }

  /* ---------- conceito oficial de uma natureza individual (Taxonomia arquitetural; só administração geral) ----------
     Só para os códigos individuais do catálogo, com o nome e a definição APROVADOS informados por quem cria.
     ctx = { email, agoraIso, auditoriaKey, ordem }. Uma gravação: conceito + definição v1 + histórico + auditoria. */
  function criarConceitoNatureza(codigo, nome, definicao, ctx) {
    var n = NATUREZAS[codigo], e = [], nm = texto(nome), df = texto(definicao);
    ctx = ctx || {};
    if (!n || !n.individual) e.push(erro('NATUREZA_INVALIDA'));
    if (!nm) e.push(erro('NOME_OBRIGATORIO'));
    else if (nm.length > 200) e.push(erro('NOME_LONGO'));
    if (!df) e.push(erro('DEFINICAO_OBRIGATORIA'));
    else if (df.length > 8000) e.push(erro('DEFINICAO_LONGA'));
    if (!ctx.email || !ctx.agoraIso || !ctx.auditoriaKey) e.push(erro('CONTEXTO_INCOMPLETO'));
    if (e.length) return { ok: false, erros: e };
    var base = 'taxonomia/arquitetural', c = {};
    var def = { texto: df, versao: 1, publicadaEm: ctx.agoraIso, publicadaPor: ctx.email };
    c[base + '/conceitos/' + codigo] = { nome: nm, ordem: Number(ctx.ordem) || 100, ativo: true, naturezaDe: n.camada, definicao: def, atualizadoEm: ctx.agoraIso, atualizadoPor: ctx.email };
    c[base + '/definicoes/' + codigo + '/v1'] = { texto: df, versao: 1, publicadaEm: ctx.agoraIso, publicadaPor: ctx.email, origem: 'publicacao' };
    c[base + '/auditoria/' + codigo + '/' + ctx.auditoriaKey] = { tipo: 'conceito_criado', conceito: codigo, campo: null, valorAnterior: null, valorNovo: nm, naturezaDe: n.camada, usuario: { email: ctx.email }, dataHora: ctx.agoraIso };
    return { ok: true, caminhos: c };
  }

  /* ---------- leituras para a tela ---------- */
  /* relações (ativas e encerradas) em que o objeto é uma das pontas, com a leitura a partir dele */
  function relacoesDoObjeto(registros, objetoId) {
    return valores(registros).filter(function (r) { return r && (r.origem === objetoId || r.destino === objetoId); }).map(function (r) {
      var saida = r.origem === objetoId, T = TIPOS[r.tipo] || {};
      return { relacao: r, outro: saida ? r.destino : r.origem, leitura: saida ? T.direta : T.inversa, sentido: saida ? 'saida' : 'entrada' };
    });
  }
  /* as leituras que um objeto de natureza "nat" pode iniciar, nos dois sentidos (para o menu da frase) */
  function leiturasPossiveis(nat) {
    var out = [];
    PARES.forEach(function (p) {
      if (p.de === nat && !out.some(function (x) { return x.tipo === p.tipo && x.sentido === 'saida'; })) out.push({ tipo: p.tipo, sentido: 'saida', leitura: TIPOS[p.tipo].direta });
      if (p.para === nat && !out.some(function (x) { return x.tipo === p.tipo && x.sentido === 'entrada'; })) out.push({ tipo: p.tipo, sentido: 'entrada', leitura: TIPOS[p.tipo].inversa });
    });
    return out;
  }
  /* naturezas aceitas na outra ponta, para uma leitura escolhida */
  function naturezasDaOutraPonta(nat, tipo, sentido) {
    return PARES.filter(function (p) { return p.tipo === tipo && (sentido === 'saida' ? p.de === nat : p.para === nat); }).map(function (p) { return sentido === 'saida' ? p.para : p.de; });
  }

  var api = Object.freeze({
    VERSAO_MATRIZ: VERSAO_MATRIZ, RAIZ: RAIZ, NAT: NAT, NAT_AUD: NAT_AUD, PONTA: PONTA, MARCADOR: MARCADOR, MAX: MAX,
    NATUREZAS: NATUREZAS, NATUREZA_DA_CAMADA: NATUREZA_DA_CAMADA, INDIVIDUAIS_DA_CAMADA: INDIVIDUAIS_DA_CAMADA,
    CODIGOS_INDIVIDUAIS: CODIGOS_INDIVIDUAIS, NATUREZAS_P1P16: NATUREZAS_P1P16, TIPOS: TIPOS, PARES: PARES,
    parAdmitido: parAdmitido, validarMatriz: validarMatriz, temCiclo: temCiclo, alcanca: alcanca, chaveAtiva: chaveAtiva,
    conceitoValido: conceitoValido, naturezaDoObjeto: naturezaDoObjeto, situacaoRelacao: situacaoRelacao,
    criarRelacao: criarRelacao, encerrarRelacao: encerrarRelacao, registrarNatureza: registrarNatureza, criarConceitoNatureza: criarConceitoNatureza,
    relacoesDoObjeto: relacoesDoObjeto, leiturasPossiveis: leiturasPossiveis, naturezasDaOutraPonta: naturezasDaOutraPonta
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faRelacoesObjetosNucleo = api;
})(typeof window !== 'undefined' ? window : null);
