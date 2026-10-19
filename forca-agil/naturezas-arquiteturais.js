/* ============================================================
   NATUREZAS ARQUITETURAIS — o modelo ÚNICO da Taxonomia Arquitetural (puro: sem DOM, sem banco, sem relógio).
   window.faNaturezasArquiteturais / module.exports. Usado pela Taxonomia (taxonomia.js: catálogo agrupado e conferência),
   pela E4 (relacoes-objetos-nucleo.js deriva daqui as naturezas que registra), pelo diagnóstico só de leitura
   (.github/scripts/diagnosticar-taxonomia-arquitetural.js) e pelos testes (teste-naturezas-arquiteturais.js).

   Decisões (18/10/2026, unificação da Taxonomia):
   - Uma Taxonomia Arquitetural só, com 15 NATUREZAS distintas; Produto/Serviço é a ÚNICA conjunta.
   - Cada natureza tem UMA identidade: o conceito da Taxonomia de código `conceito`. As que já existiam são reaproveitadas
     (produto-principal, componente, canal, capacidade-organizacional, unidade-valor-associada); as individuais têm o
     próprio código (funcionalidade, operacao, …). Nada aqui cria conceito: o cadastro é da administração, com a
     definição aprovada.
   - Os 11 códigos do motor P1–P16 são CLASSIFICAÇÕES DO MOTOR (mecanismo de compatibilidade), não naturezas. Os seis
     agrupamentos históricos (funcionalidade-operacao, processo-etapa, regra-condicao, modalidade-subproduto,
     documento-informacao, a-validar) continuam INTEGRALMENTE preservados — código, ligação em avaliacao-classificacoes,
     definição, fontes e auditoria —, mas são CLASSIFICAÇÕES TÉCNICAS, nunca naturezas adicionais.
   - Correspondência (centralizada aqui e só aqui): cada classificação do motor → as naturezas que ela admite.
     Opção corresponde SÓ a modalidade-subproduto (decisão aprovada). Um objeto antigo classificado em Regra/Opção
     (regra-condicao) que seja de fato uma Opção exige REAVALIAÇÃO explícita de P1–P16 (nova versão, histórico
     preservado); nada é reclassificado sozinho e o motor não muda.
   - E5: Modalidade e Subproduto são naturezas INDIVIDUAIS e distintas (não formam conceito conjunto), registráveis nos
     objetos da classificação modalidade-subproduto ao lado de Opção — mas só depois que o conceito oficial de cada uma
     existir na Taxonomia, com a definição aprovada pela dona (aprovadas em 19/10/2026; o cadastro é da administração geral).
   ============================================================ */
(function (raiz) {
  'use strict';

  /* As 15 naturezas, na ordem de apresentação. rotulo = rótulo de FÁBRICA (contingência): o nome oficial é o do conceito.
     modelo: 'direta' (a classificação do motor já é a natureza), 'individual' (registrada por objeto na E4, dentro de uma
     classificação técnica), 'pendente' (prevista, definição pendente — E5). */
  var NATUREZAS = [
    { codigo: 'produto', conceito: 'produto-principal', rotulo: 'Produto/Serviço', classificacao: 'produto-principal', modelo: 'direta', conjunta: true },
    { codigo: 'funcionalidade', conceito: 'funcionalidade', rotulo: 'Funcionalidade', classificacao: 'funcionalidade-operacao', modelo: 'individual' },
    { codigo: 'operacao', conceito: 'operacao', rotulo: 'Operação', classificacao: 'funcionalidade-operacao', modelo: 'individual' },
    { codigo: 'processo', conceito: 'processo', rotulo: 'Processo', classificacao: 'processo-etapa', modelo: 'individual' },
    { codigo: 'etapa', conceito: 'etapa', rotulo: 'Etapa', classificacao: 'processo-etapa', modelo: 'individual' },
    { codigo: 'regra', conceito: 'regra', rotulo: 'Regra', classificacao: 'regra-condicao', modelo: 'individual' },
    { codigo: 'opcao', conceito: 'opcao', rotulo: 'Opção', classificacao: 'modalidade-subproduto', modelo: 'individual' },
    { codigo: 'modalidade', conceito: 'modalidade', rotulo: 'Modalidade', classificacao: 'modalidade-subproduto', modelo: 'individual' },
    { codigo: 'subproduto', conceito: 'subproduto', rotulo: 'Subproduto', classificacao: 'modalidade-subproduto', modelo: 'individual' },
    { codigo: 'informacao', conceito: 'informacao', rotulo: 'Informação', classificacao: 'documento-informacao', modelo: 'individual' },
    { codigo: 'documento', conceito: 'documento', rotulo: 'Documento', classificacao: 'documento-informacao', modelo: 'individual' },
    { codigo: 'componente', conceito: 'componente', rotulo: 'Componente', classificacao: 'componente', modelo: 'direta' },
    { codigo: 'canal', conceito: 'canal', rotulo: 'Canal', classificacao: 'canal', modelo: 'direta' },
    { codigo: 'capacidade', conceito: 'capacidade-organizacional', rotulo: 'Capacidade Organizacional', classificacao: 'capacidade-organizacional', modelo: 'direta' },
    { codigo: 'unidade-valor', conceito: 'unidade-valor-associada', rotulo: 'Unidade de Valor Associada', classificacao: 'unidade-valor-associada', modelo: 'direta' }
  ].map(function (n) { return Object.freeze(n); });

  /* Os 11 códigos do motor P1–P16 (os mesmos de CAMADAS em avaliacao-produto.js — conferido em teste). tecnica = agrupamento
     histórico preservado, que NÃO é natureza; os demais coincidem com uma natureza direta (mesma identidade). */
  var CLASSIFICACOES = [
    { codigo: 'produto-principal', tecnica: false },
    { codigo: 'unidade-valor-associada', tecnica: false },
    { codigo: 'modalidade-subproduto', tecnica: true },
    { codigo: 'funcionalidade-operacao', tecnica: true },
    { codigo: 'componente', tecnica: false },
    { codigo: 'regra-condicao', tecnica: true },
    { codigo: 'processo-etapa', tecnica: true },
    { codigo: 'capacidade-organizacional', tecnica: false },
    { codigo: 'canal', tecnica: false },
    { codigo: 'documento-informacao', tecnica: true },
    { codigo: 'a-validar', tecnica: true }
  ].map(function (c) {
    return Object.freeze({ codigo: c.codigo, tecnica: c.tecnica, naturezas: Object.freeze(NATUREZAS.filter(function (n) { return n.classificacao === c.codigo; }).map(function (n) { return n.codigo; })) });
  });

  /* Orientação de uma classificação antiga que não admite uma natureza que o objeto pode de fato ter (Conflito 2: Opção). */
  var ORIENTACOES = Object.freeze({
    'regra-condicao': Object.freeze({ natureza: 'opcao', texto: 'Este objeto foi classificado em Regra/Opção, que na Taxonomia corresponde só à natureza Regra. Se ele é, de fato, uma Opção, a classificação precisa ser revista: reavalie P1–P16 deste item (a Opção corresponde a Modalidade/Subproduto, P13). A reavaliação cria uma nova versão e mantém a atual no histórico; nada muda sozinho.' })
  });

  var POR_CODIGO = {}, POR_CONCEITO = {}, CLASS_POR_CODIGO = {};
  NATUREZAS.forEach(function (n) { POR_CODIGO[n.codigo] = n; POR_CONCEITO[n.conceito] = n; });
  CLASSIFICACOES.forEach(function (c) { CLASS_POR_CODIGO[c.codigo] = c; });

  function natureza(codigo) { return POR_CODIGO[codigo] || null; }
  function naturezaDoConceito(conceito) { return POR_CONCEITO[conceito] || null; }
  function classificacao(codigo) { return CLASS_POR_CODIGO[codigo] || null; }
  function ehClassificacaoTecnica(codigo) { var c = CLASS_POR_CODIGO[codigo]; return !!(c && c.tecnica); }
  /* naturezas que uma classificação do motor ADMITE (inclui as pendentes); registraveis = só as que já podem ser registradas */
  function naturezasDaClassificacao(codigo, opcoes) {
    var c = CLASS_POR_CODIGO[codigo];
    if (!c) return [];
    return c.naturezas.filter(function (n) { return !(opcoes && opcoes.registraveis) || POR_CODIGO[n].modelo !== 'pendente'; });
  }
  function admite(classificacaoCodigo, naturezaCodigo) { return naturezasDaClassificacao(classificacaoCodigo).indexOf(naturezaCodigo) !== -1; }
  function orientacao(classificacaoCodigo) { return ORIENTACOES[classificacaoCodigo] || null; }
  /* o papel de um código de conceito da Taxonomia Arquitetural no modelo */
  function papelDoConceito(codigo) {
    if (POR_CONCEITO[codigo]) return { papel: 'natureza', natureza: POR_CONCEITO[codigo].codigo };
    if (ehClassificacaoTecnica(codigo)) return { papel: 'classificacao-tecnica' };
    return { papel: 'fora-do-modelo' };
  }

  /* ---------- DIAGNÓSTICO (só leitura): os conceitos REALMENTE existentes × o modelo aprovado ----------
     entrada: conceitos = taxonomia/arquitetural/conceitos (como estão no banco); ligacoes = avaliacao-classificacoes
     (opcional; null = não lido). Devolve o que existe, o que falta e o que diverge — nunca o que gravar. Determinístico:
     a mesma entrada dá sempre a mesma saída (rodar de novo não muda nada, porque não grava nada). */
  function temDefinicao(c) { return !!(c && ((c.definicao && typeof c.definicao.texto === 'string' && c.definicao.texto.trim()) || c.definicaoVigenteFonteId)); }
  function normNome(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function diagnosticar(conceitos, ligacoes) {
    conceitos = conceitos || {};
    var lig = ligacoes === undefined ? null : (ligacoes || {});
    var r = { naturezas: [], classificacoesTecnicas: [], foraDoModelo: [], duplicados: [], problemas: 0 };
    NATUREZAS.forEach(function (n) {
      var c = conceitos[n.conceito], x = { natureza: n.codigo, conceito: n.conceito, modelo: n.modelo, rotulo: n.rotulo, problemas: [] };
      if (!c) {
        x.situacao = n.modelo === 'pendente' ? 'pendente' : n.modelo === 'individual' ? 'a-cadastrar' : 'ausente';
        if (x.situacao === 'ausente') x.problemas.push('conceito-ausente');
      } else {
        x.nome = c.nome || null;
        if (n.modelo === 'pendente') { x.situacao = 'inconsistente'; x.problemas.push('cadastrado-antes-da-definicao-aprovada'); }
        else {
          x.situacao = 'cadastrada';
          if (c.ativo !== true) x.problemas.push('inativo');
          if (!temDefinicao(c)) x.problemas.push('sem-definicao');
          if (n.modelo === 'individual' && c.naturezaDe !== n.classificacao) x.problemas.push('naturezaDe-divergente');
          if (n.modelo === 'direta' && c.naturezaDe) x.problemas.push('naturezaDe-indevido');
          if (x.problemas.length) x.situacao = 'inconsistente';
        }
      }
      r.problemas += x.problemas.length;
      r.naturezas.push(x);
    });
    CLASSIFICACOES.filter(function (k) { return k.tecnica; }).forEach(function (k) {
      var c = conceitos[k.codigo], x = { codigo: k.codigo, existe: !!c, nome: c ? c.nome || null : null, ligada: lig ? !!lig[k.codigo] : null, naturezas: k.naturezas.slice(), problemas: [] };
      if (c && c.naturezaDe) x.problemas.push('naturezaDe-indevido');
      r.problemas += x.problemas.length;
      r.classificacoesTecnicas.push(x);
    });
    Object.keys(conceitos).sort().forEach(function (cod) {
      if (papelDoConceito(cod).papel === 'fora-do-modelo') { r.foraDoModelo.push({ codigo: cod, nome: (conceitos[cod] || {}).nome || null, naturezaDe: (conceitos[cod] || {}).naturezaDe || null }); }
    });
    /* duplicidade: dois conceitos com o mesmo nome (sem acento/caixa), ou conceito fora do modelo que se apresenta como natureza individual */
    var porNome = {};
    Object.keys(conceitos).sort().forEach(function (cod) { var k = normNome((conceitos[cod] || {}).nome); if (k) (porNome[k] = porNome[k] || []).push(cod); });
    Object.keys(porNome).sort().forEach(function (k) { if (porNome[k].length > 1) r.duplicados.push({ motivo: 'mesmo-nome', codigos: porNome[k] }); });
    r.foraDoModelo.forEach(function (f) { if (f.naturezaDe) r.duplicados.push({ motivo: 'natureza-fora-do-modelo', codigos: [f.codigo] }); });
    r.problemas += r.duplicados.length + r.foraDoModelo.length; /* fora do modelo é sempre ponto a revisar (nunca some sozinho) */
    r.ok = r.problemas === 0;
    return r;
  }

  var api = {
    NATUREZAS: NATUREZAS, CLASSIFICACOES: CLASSIFICACOES, ORIENTACOES: ORIENTACOES,
    natureza: natureza, naturezaDoConceito: naturezaDoConceito, classificacao: classificacao, ehClassificacaoTecnica: ehClassificacaoTecnica,
    naturezasDaClassificacao: naturezasDaClassificacao, admite: admite, orientacao: orientacao, papelDoConceito: papelDoConceito,
    diagnosticar: diagnosticar, temDefinicao: temDefinicao
  };
  Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faNaturezasArquiteturais = api;
})(typeof window !== 'undefined' ? window : null);
