/* ============================================================
   Força Ágil — DADOS DEMONSTRATIVOS do Mapa da Floresta (window.faMapaFlorestaDemo)

   SÓ PARA A VERSÃO VISUAL DEMONSTRATIVA DO MAPA. Exemplos FICTÍCIOS, em memória: nenhuma estrutura aqui é oficial,
   nenhum objeto é um item avaliado de verdade, e nada disto é gravado no Firebase nem no PostgreSQL. A tela mostra uma
   faixa fixa dizendo isso.

   Três níveis do Mapa:
     1. BLOCOS (layout do Mapa: título visual, cor, posição e os códigos firmes do motor que cada um reúne) — ficam em
        mapa-floresta.js, não aqui;
     2. SUBAGRUPADORES — divisões internas de um bloco (hoje: Linhas de Negócios). Não são estruturas, Linhas,
        produtos nem especializações. Têm nome, ordem, situação e um ícone de apresentação; a ligação com as Linhas é
        uma ASSOCIAÇÃO separada (associacoesSubagrupador), para o cadastro futuro (criar, renomear, ordenar, associar,
        encerrar) entrar sem refazer a tela;
     3. ESTRUTURAS CONCRETAS — cada caixa pequena: uma Linha, Área Especializada ou CoE. Formato: o MESMO estado que o
        núcleo de Estruturas Concretas (estruturas-nucleo.js) recebe — { estruturas, relacoes, vinculos } —, lido pelas
        consultas puras do núcleo (estruturasDoTipo, objetosDaEstrutura), na ORDEM em que foram cadastradas. O tipo é
        um código firme do motor de Posicionamento (o conceito oficial de MESMO código); nomes e definições oficiais vêm
        da Taxonomia.
   Os produtos/serviços de exemplo ficam ligados por vínculo de responsável principal e só aparecem no DETALHE.

   CENÁRIOS (a quantidade de estruturas é variável; o Mapa tem de ficar organizado com poucas e com muitas):
     habitual  — a demonstração de sempre;
     populoso  — teste de layout: grupos com 0, 1, 3 e 10+ estruturas, nomes curtos e longos, um subagrupador vazio e
                 um subagrupador a mais, quantidades diferentes de CoEs e Áreas Especializadas.
   cenario(nome) devolve o cenário (congelado); um nome desconhecido devolve o habitual.
   ============================================================ */
(function () {
  'use strict';
  var EM = '2026-10-12T00:00:00.000Z', POR = { id: 'demonstracao' };
  function congelar(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { congelar(o[k]); }); } return o; }
  /* monta um cenário no formato do núcleo: estruturas na ordem dada; vínculos de responsável principal para os objetos */
  function montar(def) {
    var estado = { estruturas: {}, relacoes: {}, vinculos: {} };
    def.estruturas.forEach(function (e) {
      estado.estruturas[e[0]] = { id: e[0], tipo: e[1], nome: e[2], sigla: null, descricao: 'Estrutura fictícia, só para demonstrar o Mapa.', situacao: 'ativa', criadaEm: EM, criadaPor: POR, revisao: 1 };
    });
    Object.keys(def.responsavel || {}).forEach(function (objetoId, i) {
      var est = estado.estruturas[def.responsavel[objetoId]], id = 'demo-vinculo-' + (i + 1);
      estado.vinculos[id] = { id: id, objetoId: objetoId, estruturaId: est.id, papel: 'responsavel-principal',
        base: { avaliacaoId: 'demonstracao', codigo: est.tipo, origem: 'decisao' }, justificativa: null, situacao: 'ativa', criadoEm: EM, criadoPor: POR, revisao: 1 };
    });
    return congelar({ nome: def.nome, AVISO: 'Dados demonstrativos: exemplos fictícios, não são estruturas oficiais. Nada é gravado.',
      estado: estado, objetos: def.objetos || {}, subagrupadores: def.subagrupadores, associacoesSubagrupador: def.associacoes });
  }
  /* subagrupadores de Linhas de Negócios: nomes de REFERÊNCIA demonstrativa (não é lista definitiva) */
  function sub(id, nome, ordem, icone) { return { id: id, bloco: 'NEGOCIOS', nome: nome, ordem: ordem, situacao: 'ativo', icone: icone }; }
  var SUBS = {
    'demo-sub-prev': sub('demo-sub-prev', 'Previdência', 1, 'guarda-chuva'),
    'demo-sub-prot': sub('demo-sub-prot', 'Proteção', 2, 'escudo'),
    'demo-sub-cred': sub('demo-sub-cred', 'Crédito', 3, 'moedas')
  };
  function assoc(subId, ids) { return ids.map(function (id) { return { subagrupadorId: subId, estruturaId: id }; }); }
  function serie(prefixo, tipo, rotulo, n) { var r = []; for (var i = 1; i <= n; i++) r.push([prefixo + i, tipo, rotulo + ' ' + i]); return r; }

  /* ---------- cenário HABITUAL ---------- */
  var habitual = montar({
    nome: 'habitual',
    estruturas: [
      ['demo-ec-1', 'ESTRATEGIA_CLIENTES', 'Clientes — Exemplo A'], ['demo-ec-2', 'ESTRATEGIA_CLIENTES', 'Clientes — Exemplo B'],
      ['demo-ec-3', 'ESTRATEGIA_CLIENTES', 'Clientes — Exemplo C'], ['demo-ec-4', 'ESTRATEGIA_CLIENTES', 'Clientes — Exemplo D'],
      ['demo-can-1', 'PLATAFORMA_CANAIS', 'Canais digitais — Exemplo'], ['demo-can-2', 'PLATAFORMA_CANAIS', 'Canais presenciais — Exemplo'],
      ['demo-can-3', 'PLATAFORMA_CANAIS', 'Comunicação — Exemplo'],
      ['demo-neg-1', 'NEGOCIOS', 'Negócios — Exemplo 1'], ['demo-neg-2', 'NEGOCIOS', 'Negócios — Exemplo 2'], ['demo-neg-3', 'NEGOCIOS', 'Negócios — Exemplo 3'],
      ['demo-neg-4', 'NEGOCIOS', 'Negócios — Exemplo 4'], ['demo-neg-5', 'NEGOCIOS', 'Negócios — Exemplo 5'], ['demo-neg-6', 'NEGOCIOS', 'Negócios — Exemplo 6'],
      ['demo-hn-1', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'Habilitadora de Negócios — Exemplo 1'], ['demo-hn-2', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'Habilitadora de Negócios — Exemplo 2'],
      ['demo-hn-3', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'Habilitadora de Negócios — Exemplo 3'],
      ['demo-ht-1', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'Habilitadora de Tecnologia — Exemplo 1'], ['demo-ht-2', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'Habilitadora de Tecnologia — Exemplo 2'],
      ['demo-corp-1', 'PLATAFORMA_CORPORATIVA', 'Gestão Corporativa — Exemplo 1'], ['demo-corp-2', 'PLATAFORMA_CORPORATIVA', 'Gestão Corporativa — Exemplo 2'],
      ['demo-ae-1', 'AREA_ESPECIALIZADA', 'Área Especializada — Exemplo 1'], ['demo-ae-2', 'AREA_ESPECIALIZADA', 'Área Especializada — Exemplo 2'],
      ['demo-ae-3', 'AREA_ESPECIALIZADA', 'Área Especializada — Exemplo 3'],
      ['demo-coe-1', 'COE', 'CoE — Exemplo 1'], ['demo-coe-2', 'COE', 'CoE — Exemplo 2'], ['demo-coe-3', 'COE', 'CoE — Exemplo 3']
    ],
    subagrupadores: SUBS,
    associacoes: assoc('demo-sub-prev', ['demo-neg-1', 'demo-neg-2', 'demo-neg-3']).concat(assoc('demo-sub-prot', ['demo-neg-4']), assoc('demo-sub-cred', ['demo-neg-5', 'demo-neg-6'])),
    objetos: {
      'demo-obj-1': { nome: 'Produto Exemplo Alfa', descricao: 'Produto fictício oferecido a um segmento de clientes.' },
      'demo-obj-2': { nome: 'Serviço Exemplo Beta', descricao: 'Serviço fictício de relacionamento com clientes.' },
      'demo-obj-3': { nome: 'Serviço Exemplo Gama', descricao: 'Serviço fictício de atendimento digital.' },
      'demo-obj-4': { nome: 'Produto Exemplo Delta', descricao: 'Produto fictício de uma Linha de Negócios.' },
      'demo-obj-5': { nome: 'Produto Exemplo Épsilon', descricao: 'Produto fictício de uma Linha de Negócios.' },
      'demo-obj-6': { nome: 'Serviço Exemplo Zeta', descricao: 'Serviço fictício de uma Linha de Negócios.' },
      'demo-obj-7': { nome: 'Produto Exemplo Eta', descricao: 'Produto fictício de crédito.' },
      'demo-obj-8': { nome: 'Capacidade Exemplo Teta', descricao: 'Capacidade fictícia compartilhada entre Linhas.' },
      'demo-obj-9': { nome: 'Serviço Exemplo Iota', descricao: 'Serviço fictício de infraestrutura tecnológica.' },
      'demo-obj-10': { nome: 'Processo Exemplo Kapa', descricao: 'Processo fictício de gestão interna.' },
      'demo-obj-11': { nome: 'Serviço Exemplo Lambda', descricao: 'Serviço fictício especializado.' },
      'demo-obj-12': { nome: 'Serviço Exemplo Mi', descricao: 'Serviço fictício sustentado por um Centro de Excelência.' }
    },
    responsavel: {
      'demo-obj-1': 'demo-ec-1', 'demo-obj-2': 'demo-ec-1', 'demo-obj-3': 'demo-can-1', 'demo-obj-4': 'demo-neg-1', 'demo-obj-5': 'demo-neg-1',
      'demo-obj-6': 'demo-neg-2', 'demo-obj-7': 'demo-neg-5', 'demo-obj-8': 'demo-hn-1', 'demo-obj-9': 'demo-ht-1', 'demo-obj-10': 'demo-corp-1',
      'demo-obj-11': 'demo-ae-1', 'demo-obj-12': 'demo-coe-1'
    }
  });

  /* ---------- cenário POPULOSO (teste de layout) ---------- */
  var LONGO = ' — Exemplo com Nome Bem Mais Longo para Testar a Quebra de Linha';
  var popSubs = Object.assign({}, SUBS, { 'demo-sub-outro': sub('demo-sub-outro', 'Outro subagrupador (exemplo)', 4, 'caixa') });
  var negPrev = serie('pop-neg-p', 'NEGOCIOS', 'Previdência — Exemplo', 11);
  var negCred = serie('pop-neg-c', 'NEGOCIOS', 'Crédito — Exemplo', 3);
  var negOutro = [['pop-neg-o1', 'NEGOCIOS', 'Linha de Negócios' + LONGO]];
  var populoso = montar({
    nome: 'populoso',
    estruturas: [].concat(
      serie('pop-ec-', 'ESTRATEGIA_CLIENTES', 'Clientes — Exemplo', 12),               /* 10+ */
      [['pop-can-1', 'PLATAFORMA_CANAIS', 'Canal']],                                    /* 1, nome curto */
      negPrev, negCred, negOutro,                                                       /* Proteção fica vazia (0) */
      serie('pop-hn-', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'Habilitadora de Negócios — Exemplo', 10),
      [['pop-ht-1', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'Habilitadora de Tecnologia' + LONGO]], /* 1, nome longo */
      /* Gestão Corporativa fica vazia (0) */
      serie('pop-ae-', 'AREA_ESPECIALIZADA', 'Área Especializada — Exemplo', 6),
      [['pop-ae-longo', 'AREA_ESPECIALIZADA', 'Área Especializada' + LONGO]],
      serie('pop-coe-', 'COE', 'CoE — Exemplo', 8),
      [['pop-coe-longo', 'COE', 'Centro de Excelência' + LONGO]]
    ),
    subagrupadores: popSubs,
    associacoes: assoc('demo-sub-prev', negPrev.map(function (e) { return e[0]; })).concat(
      assoc('demo-sub-cred', negCred.map(function (e) { return e[0]; })), assoc('demo-sub-outro', ['pop-neg-o1'])),
    objetos: { 'pop-obj-1': { nome: 'Produto Exemplo Alfa', descricao: 'Produto fictício do cenário populoso.' } },
    responsavel: { 'pop-obj-1': 'pop-ec-1' }
  });

  var CENARIOS = { habitual: habitual, populoso: populoso };
  window.faMapaFlorestaDemo = congelar({
    CENARIOS: ['habitual', 'populoso'],
    cenario: function (nome) { return CENARIOS[nome] || habitual; },
    /* compatibilidade: as propriedades do cenário habitual também no topo */
    AVISO: habitual.AVISO, estado: habitual.estado, objetos: habitual.objetos, subagrupadores: habitual.subagrupadores, associacoesSubagrupador: habitual.associacoesSubagrupador
  });
})();
