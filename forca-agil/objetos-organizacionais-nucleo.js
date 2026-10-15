/* ============================================================
   Força Ágil — OBJETOS ORGANIZACIONAIS (Porta 2 do Posicionamento Organizacional) — domínio puro
   (window.faObjetosOrganizacionaisNucleo; em Node, module.exports)

   A Porta 2 posiciona uma ATUAÇÃO, RESPONSABILIDADE ou CAPACIDADE organizacional sem passar antes pela Avaliação de
   Produto/Serviço (P1–P16). O objeto organizacional é a identidade própria dela: o Posicionamento O1–O9 usa o
   identificador do objeto como itemId, com origem 'objeto-organizacional' — o MESMO motor, a mesma decisão, o mesmo
   vínculo com a estrutura responsável. A Porta 1 (P1–P16 → O1–O9) continua exatamente como era.

   Ciclo de vida: criado (ativo) → alterado (cada gravação = revisão anterior + 1, com antes → depois) → encerrado
   (motivo obrigatório; final). Nada se apaga. Encerrado não aceita nova avaliação nem novo vínculo; o que já existe
   (Posicionamento, decisão, vínculo) fica como está. Encerrar exige que não haja rascunho de Posicionamento aberto
   nem estrutura responsável ativa para o objeto (o banco confere as duas coisas).

   Referência a uma Avaliação de Produto/Serviço (referenciaItemId): OPCIONAL e só INFORMATIVA — nunca entra no
   cálculo. Fixada na criação. Enquanto o objeto está ativo, o índice objetos-organizacionais-por-referencia/<item>
   impede outro objeto com a mesma referência e impede iniciar, pela Porta 1, um novo Posicionamento desse item; o
   objeto também não nasce se o item tiver Posicionamento vigente ou rascunho aberto (sem duplicidade). Encerrar o
   objeto libera o índice na mesma gravação.

   Hipótese inicial (CODIGOS_HIPOTESE): o que a pessoa acredita ser o posicionamento ANTES de responder — um dos 8
   posicionamentos firmes ou NAO_SEI. Fica no registro de Posicionamento (hipoteseInicial), nunca no motor: o motor
   não a recebe (a assinatura dele não tem esse parâmetro) e o banco confere que o resultado gravado é exatamente o do
   motor, calculado só das respostas. compararHipotese() só COMPARA, depois, a hipótese com a recomendação.

   PURO: sem Firebase, sem DOM, sem relógio, sem gerador de identificadores. Identificadores, usuário e o marcador de
   horário do servidor (agora) vêm de quem chama. Os payloads são gravações multipath (tudo ou nada); as regras do
   banco (database.rules.json, montadas por .github/scripts/montar-regras-objetos-organizacionais.js) são a garantia
   de verdade — este módulo só monta o que elas aceitam e explica o que falta.
   ============================================================ */
(function () {
  'use strict';

  var MOT = (typeof window !== 'undefined' && window.faMotorPosicionamentoNucleo) ||
    (typeof require === 'function' ? require('./motor-posicionamento-nucleo.js') : null);
  if (!MOT) throw new Error('objetos organizacionais: o núcleo do motor de posicionamento precisa carregar antes');

  var NODE = 'objetos-organizacionais';
  var AUD = 'objetos-organizacionais-auditoria';
  var IDX_REF = 'objetos-organizacionais-por-referencia';
  var ORIGEM = 'objeto-organizacional';
  var NAO_SEI = 'NAO_SEI';
  var CODIGOS_HIPOTESE = MOT.CODIGOS_FIRMES.concat([NAO_SEI]);
  var LIMITES = { nome: 200, descricao: 2000, finalidade: 2000, contexto: 2000, motivo: 500 };
  var OBRIGATORIOS = ['nome', 'descricao', 'finalidade'];
  var CAMPOS = ['nome', 'descricao', 'finalidade', 'contexto'];
  var ID = /^[A-Za-z0-9_-]{1,60}$/;

  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }
  function emBranco(v) { return !texto(v); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* dados do formulário → só os campos conhecidos, aparados; contexto vazio não é gravado */
  function normalizar(d) {
    d = d || {};
    var out = {};
    CAMPOS.forEach(function (c) { var t = texto(d[c]); if (t) out[c] = t; });
    return out;
  }
  /* [{ campo, codigo: 'OBRIGATORIO' | 'TAMANHO', limite? }] — vazio = válido */
  function validarDados(d) {
    var n = normalizar(d), erros = [];
    OBRIGATORIOS.forEach(function (c) { if (!n[c]) erros.push({ campo: c, codigo: 'OBRIGATORIO' }); });
    CAMPOS.forEach(function (c) { if (n[c] && n[c].length > LIMITES[c]) erros.push({ campo: c, codigo: 'TAMANHO', limite: LIMITES[c] }); });
    return erros;
  }
  function validarReferencia(ref) {
    if (ref === undefined || ref === null || ref === '') return null;
    return typeof ref === 'string' && ID.test(ref) ? null : { campo: 'referenciaItemId', codigo: 'INVALIDA' };
  }
  function pessoa(u) {
    if (!u || !u.uid || !u.email) throw new Error('objetos organizacionais: usuário sem uid ou e-mail');
    var p = { uid: u.uid, email: u.email };
    if (u.name) p.name = String(u.name).slice(0, 200);
    return p;
  }
  function falhar(erros) { var e = new Error('objeto organizacional inválido'); e.erros = erros; throw e; }
  function exigirId(x, nome) { if (typeof x !== 'string' || !ID.test(x)) throw new Error('objetos organizacionais: ' + nome + ' inválido'); }
  function ativo(obj) { return !!obj && obj.situacao === 'ativo'; }

  /* o: { id, audId, dados, referenciaItemId?, usuario: { uid, email, name? }, agora } */
  function payloadCriacao(o) {
    exigirId(o.id, 'id'); exigirId(o.audId, 'audId');
    var erros = validarDados(o.dados), er = validarReferencia(o.referenciaItemId);
    if (er) erros.push(er);
    if (erros.length) falhar(erros);
    var por = pessoa(o.usuario), dados = normalizar(o.dados);
    var reg = Object.assign({}, dados, { situacao: 'ativo', revisao: 1, criadoPor: por, criadoEm: o.agora, atualizadoPor: por, atualizadoEm: o.agora, auditoriaId: o.audId });
    var depois = clone(dados);
    if (o.referenciaItemId) { reg.referenciaItemId = o.referenciaItemId; depois.referenciaItemId = o.referenciaItemId; }
    var p = {};
    p[NODE + '/' + o.id] = reg;
    p[AUD + '/' + o.id + '/' + o.audId] = { tipo: 'criacao', revisao: 1, por: por, em: o.agora, depois: depois };
    if (o.referenciaItemId) p[IDX_REF + '/' + o.referenciaItemId] = o.id;
    return p;
  }
  function campos(obj) { var out = {}; CAMPOS.forEach(function (c) { if (typeof obj[c] === 'string' && obj[c]) out[c] = obj[c]; }); return out; }
  function iguais(a, b) { return CAMPOS.every(function (c) { return (a[c] || '') === (b[c] || ''); }); }
  /* o: { id, atual, audId, dados, usuario, agora } — só os quatro campos de texto mudam; referência, criação e
     situação ficam. Sem mudança → erro SEM_ALTERACAO (não grava revisão vazia). */
  function payloadAlteracao(o) {
    exigirId(o.id, 'id'); exigirId(o.audId, 'audId');
    if (!ativo(o.atual)) falhar([{ codigo: 'OBJETO_ENCERRADO' }]);
    var erros = validarDados(o.dados);
    if (erros.length) falhar(erros);
    var dados = normalizar(o.dados), antes = campos(o.atual);
    if (iguais(antes, dados)) falhar([{ codigo: 'SEM_ALTERACAO' }]);
    var por = pessoa(o.usuario), reg = clone(o.atual);
    CAMPOS.forEach(function (c) { if (dados[c]) reg[c] = dados[c]; else delete reg[c]; });
    reg.revisao = (o.atual.revisao || 0) + 1; reg.atualizadoPor = por; reg.atualizadoEm = o.agora; reg.auditoriaId = o.audId;
    var p = {};
    p[NODE + '/' + o.id] = reg;
    p[AUD + '/' + o.id + '/' + o.audId] = { tipo: 'alteracao', revisao: reg.revisao, por: por, em: o.agora, antes: antes, depois: dados };
    return p;
  }
  /* o: { id, atual, audId, motivo, usuario, agora } — final; libera o índice da referência na mesma gravação */
  function payloadEncerramento(o) {
    exigirId(o.id, 'id'); exigirId(o.audId, 'audId');
    if (!ativo(o.atual)) falhar([{ codigo: 'OBJETO_ENCERRADO' }]);
    var motivo = texto(o.motivo);
    if (!motivo) falhar([{ campo: 'motivo', codigo: 'OBRIGATORIO' }]);
    if (motivo.length > LIMITES.motivo) falhar([{ campo: 'motivo', codigo: 'TAMANHO', limite: LIMITES.motivo }]);
    var por = pessoa(o.usuario), reg = clone(o.atual);
    reg.situacao = 'encerrado'; reg.revisao = (o.atual.revisao || 0) + 1; reg.atualizadoPor = por; reg.atualizadoEm = o.agora; reg.auditoriaId = o.audId;
    reg.encerramento = { motivo: motivo, em: o.agora, por: por };
    var p = {};
    p[NODE + '/' + o.id] = reg;
    p[AUD + '/' + o.id + '/' + o.audId] = { tipo: 'encerramento', revisao: reg.revisao, por: por, em: o.agora, motivo: motivo };
    if (o.atual.referenciaItemId) p[IDX_REF + '/' + o.atual.referenciaItemId] = null;
    return p;
  }

  /* Hipótese × recomendação AUTOMÁTICA (nunca a decisão humana): 'nao-registrada' (registro sem hipótese — os
     anteriores à Porta 2), 'sem-hipotese' (Não sei), 'a-validar' (o motor não firmou: nunca força a hipótese),
     'confirmada' ou 'nao-confirmada'. Puro; não recebe respostas — só compara dois códigos já existentes. */
  function compararHipotese(hipotese, codigoResultado) {
    if (hipotese === undefined || hipotese === null || hipotese === '') return 'nao-registrada';
    if (hipotese === NAO_SEI) return 'sem-hipotese';
    if (!codigoResultado || codigoResultado === 'A_VALIDAR') return 'a-validar';
    return codigoResultado === hipotese ? 'confirmada' : 'nao-confirmada';
  }
  function hipoteseValida(h) { return CODIGOS_HIPOTESE.indexOf(h) !== -1; }

  /* cadastro simplificado da Porta 2: a pessoa informa UMA descrição (pode ser o texto literal de uma atribuição) e o
     cadastro, que exige nome, descrição e finalidade, recebe esse mesmo texto — sem reescrever nem inferir nada. O nome só
     é pedido à parte quando a descrição passa do limite do nome; a finalidade só é diferente se a pessoa a declarar. O
     contexto diz, com todas as letras, quais campos repetem a descrição */
  function dadosSimplificados(o) {
    o = o || {};
    var texto = String(o.texto || '').trim(), curto = String(o.nomeCurto || '').trim(), fin = String(o.finalidade || '').trim();
    var nome = texto.length <= LIMITES.nome ? texto : curto, repete = [];
    if (nome && nome === texto) repete.push('o nome');
    if (!fin) repete.push('a finalidade');
    var nota = repete.length ? 'Cadastro simplificado: ' + repete.join(' e ') + (repete.length > 1 ? ' repetem' : ' repete') + ' a descrição informada pela pessoa; nada foi inferido.' : '';
    var ctx = String(o.contexto || '').trim();
    return { nome: nome, descricao: texto, finalidade: fin || texto, contexto: [ctx, nota].filter(Boolean).join(' ') };
  }
  /* o registro do cadastro simplificado se reconhece pela própria nota que ele grava (texto fixo, escrito pelo sistema
     na criação, nunca pela pessoa) e pela finalidade igual à descrição: assim a edição e a leitura ficam simples sem
     mudar o contrato do nó. Registros com campos declarados um a um seguem com os quatro campos */
  var NOTA_SIMPLIFICADO = /\s*Cadastro simplificado: [^.]*?nada foi inferido\.\s*/;
  function registroSimplificado(ob) { return !!ob && NOTA_SIMPLIFICADO.test(String(ob.contexto || '')) && ob.finalidade === ob.descricao; }
  /* o contexto de negócio, sem a nota técnica (que continua gravada, para auditoria e compatibilidade) */
  function contextoVisivel(ctx) { return String(ctx || '').replace(NOTA_SIMPLIFICADO, ' ').trim(); }
  /* edição de um registro simplificado: a pessoa altera UMA descrição; o cadastro recebe o mesmo texto nos campos
     exigidos (como na criação) e o contexto fica como estava. Nome à parte só quando a descrição passa do limite */
  function dadosEdicaoSimplificada(atual, texto, nomeCurto) {
    var t = String(texto || '').trim(), curto = String(nomeCurto || '').trim();
    return { nome: t.length <= LIMITES.nome ? t : curto, descricao: t, finalidade: t, contexto: (atual && atual.contexto) || '' };
  }
  var api = {
    NODE: NODE, AUD: AUD, IDX_REF: IDX_REF, ORIGEM: ORIGEM, NAO_SEI: NAO_SEI, CODIGOS_HIPOTESE: CODIGOS_HIPOTESE.slice(),
    LIMITES: LIMITES, CAMPOS: CAMPOS.slice(), OBRIGATORIOS: OBRIGATORIOS.slice(),
    normalizar: normalizar, validarDados: validarDados, payloadCriacao: payloadCriacao, payloadAlteracao: payloadAlteracao,
    payloadEncerramento: payloadEncerramento, dadosSimplificados: dadosSimplificados, registroSimplificado: registroSimplificado, contextoVisivel: contextoVisivel, dadosEdicaoSimplificada: dadosEdicaoSimplificada, podeReceberAvaliacao: ativo, compararHipotese: compararHipotese, hipoteseValida: hipoteseValida
  };
  Object.freeze(api.CODIGOS_HIPOTESE); Object.freeze(api.CAMPOS); Object.freeze(api.OBRIGATORIOS); Object.freeze(api.LIMITES);
  Object.freeze(api);
  if (typeof window !== 'undefined') window.faObjetosOrganizacionaisNucleo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
