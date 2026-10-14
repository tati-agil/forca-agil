/* ============================================================
   Força Ágil — Porta 2 · ANÁLISE ORGANIZACIONAL — tela (window.faAnalisesOrganizacionais)

   Dentro de #avaliacoes, com endereço próprio: #avaliacoes?an=lista | an=nova | an=<id> (F5, link direto,
   Voltar/Avançar). A jornada ajuda a pessoa a entender um escopo amplo, descobrir as responsabilidades que existem ali,
   delimitá-las, avaliar cada uma com o O1–O9 EXISTENTE (a atuação criada a partir de um recorte segue o fluxo de hoje
   da Porta 2), aprofundar os "A validar", diagnosticar a composição e registrar a proposta — com a aprovação do desenho
   como REFERÊNCIA A UM ATO EXTERNO, lançada pelo admin geral.

   Fronteiras: quem decide é o núcleo (analises-organizacionais-nucleo.js); quem traduz para o banco é o adaptador
   (analises-organizacionais-firebase.js); quem grava é a porta faServicosPosicionamento; quem GARANTE é
   database.rules.json. Esta tela nunca classifica (o O1–O9 é o do Posicionamento), nunca grava estrutura, vínculo,
   Taxonomia nem Mapa, e não executa a v2.

   MARCADOR DE HOMOLOGAÇÃO (analises-organizacionais-config/habilitacao; ausente = DESLIGADO): com DESLIGADO nada desta
   jornada aparece e a Porta 2 de hoje continua igual; SOMENTE_ADMIN_GERAL: só o admin geral vê e grava;
   LIBERADO_PARA_PERFIS_AUTORIZADOS: os três perfis leem, Avaliação + Configuração e admin geral gravam. As regras do
   banco aplicam o mesmo mapa nas operações de dados — esconder botão nunca é a proteção.
   ============================================================ */
(function () {
  'use strict';
  function N() { return window.faAnalisesOrganizacionaisNucleo; }
  function F() { return window.faAnalisesFirebase; }
  function S() { return window.faServicosPosicionamento; }
  function P() { return window.faPosicionamentos; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtData(v) { if (!v || typeof v !== 'number' || v < 1000000000000) return '—'; var d = new Date(v); return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  function sessao() { return window.faAuth && window.faAuth.getSession ? window.faAuth.getSession() : null; }
  function perfil() {
    var A = window.faAuth, s = sessao();
    var geral = !!(s && A && A.isAdmin && A.isAdmin(s.email));
    return { adminGeral: geral, arquitetura: geral || !!(A && A.podeArquitetura && A.podeArquitetura()), avaliacao: !!(A && A.podeAvaliacao && A.podeAvaliacao()) };
  }
  function autorizacaoResolvida() { return !!(window.faAuth && (!window.faAuth.isAvaliacaoReady || window.faAuth.isAvaliacaoReady()) && (!window.faAuth.isAdminReady || window.faAuth.isAdminReady())); }

  /* ---------- textos (linguagem da pessoa; nenhum tipo organizacional antes do O1–O9) ---------- */
  var ESCOPO = {
    'responsabilidade': ['Uma responsabilidade específica', 'Ex.: emitir pareceres de arquitetura sobre as soluções propostas.'],
    'estrutura': ['Uma estrutura que já existe (núcleo, gerência, equipe)', 'Ex.: o Núcleo de Arquitetura de TI, com as pessoas que trabalham nele.'],
    'grande-area': ['Uma grande área', 'Ex.: Tecnologia da Informação, com todos os seus núcleos.'],
    'conjunto': ['Um conjunto de responsabilidades', 'Ex.: governança, contratos e políticas de TI, que hoje ficam juntos.'],
    'capacidade': ['Uma capacidade da organização', 'Ex.: proteger informações e ambientes. Uma capacidade não vira estrutura: a análise procura as responsabilidades que a sustentam.'],
    'atuacao-informal': ['Uma atuação ainda não organizada formalmente', 'Ex.: apoio a projetos diversos, feito por quem estiver disponível.']
  };
  var ROT = {
    F2a: { sim: 'Sim, um resultado e um destinatário', nao: 'Não, há mais de um', 'nao-sei': 'Não sei' },
    F2b: { cadastrada: 'Está cadastrada', 'nao-cadastrada': 'Existe, mas não está cadastrada', informal: 'É informal' },
    F2c: { listadas: 'Vou listar as entregas de cada uma', 'nao-sei': 'Ainda não sei' },
    F3: { listadas: 'Há entregas', nenhuma: 'Não consigo identificar nenhuma entrega' },
    F4: { 'julgamento-tecnico': 'Julgamento técnico (parecer, validação, análise)', 'padrao-capacitacao': 'Padrão, método ou capacitação para outras equipes', 'servico-operado': 'Serviço operado continuamente', 'solucao-construida': 'Solução ou sistema construído', 'politica-norma': 'Política, norma ou diretriz', 'decisao-estrategica': 'Decisão estratégica ou de portfólio', outra: 'Outra forma' },
    F5: { 'diversas-linhas': 'Diversas Linhas ou equipes', 'cliente-externo': 'Cliente externo (participante, público)', 'cliente-interno': 'Cliente interno (empregados, gestores)', 'linha-especifica': 'Uma Linha ou um produto específico', 'toda-organizacao': 'Toda a organização (como regra ou padrão)', outro: 'Outro destinatário' },
    F6: { 'esta-estrutura': 'Quem está sendo analisado', 'outra-estrutura': 'Outra estrutura', ninguem: 'Ninguém formalmente', 'nao-sei': 'Não sei' },
    F7: { sim: 'Sim, executa para quem responde', nao: 'Não', 'em-parte': 'Em parte' },
    F8: { evidencia: 'Há evidência (descreva)', 'sem-evidencia': 'Não tenho evidência: registrar como hipótese' },
    F11: { 'exigencia-normativa': 'Sim, por exigência normativa (cite)', 'boa-pratica': 'Sim, como boa prática', nao: 'Não' },
    F12: { 'outras-equipes': 'Desenvolver a competência das outras equipes', 'proprios-casos': 'Aplicar padrões nos próprios casos', ambos: 'Os dois' },
    F13: { 'desta-estrutura': 'De quem está sendo analisado', 'de-uma-linha': 'De uma Linha', 'de-outra-estrutura': 'De outra estrutura', 'administracao-interna': 'Da administração interna', 'tecnicas-compartilhadas': 'São regras técnicas compartilhadas' }
  };
  var CERTEZA = { conhecido: 'conhecido', provavel: 'provável', 'nao-definido': 'ainda não definido' };
  var CARATER = { confirmado: 'confirmado', declarado: 'declarado', hipotese: 'hipótese' };
  var CRITERIO = {
    finalidade: ['Finalidade', 'Para que cada entrega existe.'], resultado: ['Resultado esperado', 'O que muda quando a entrega acontece.'],
    objeto: ['Objeto', 'Sobre o que recai (informação, contrato, sistema, pessoas…).'], limitesAutonomia: ['Limites e autonomia', 'Até onde cada uma decide sozinha.'],
    riscos: ['Riscos', 'O que pode dar errado e com que efeito.'], obrigacaoResponder: ['Obrigação de responder', 'Quem presta contas se falhar.'],
    governancaEspecializacao: ['Governança ou especialização', 'Se cada uma exige governança ou conhecimento próprios.']
  };
  var CONCLUSAO = { mesma: 'São a mesma responsabilidade', integradas: 'São distintas, mas precisam acontecer juntas', distintas: 'São responsabilidades distintas', 'nao-sei': 'Ainda não sei' };
  var INDICACAO = { 'indicios-de-identidade': 'Os critérios indicam a mesma responsabilidade.', 'indicios-de-distincao': 'Os critérios indicam responsabilidades distintas.', 'indicios-parciais': 'Os critérios são em parte iguais.', inconclusivo: 'Os critérios ainda não permitem concluir.' };
  var ALTERNATIVA = { 'manter-consciente': 'Manter como está, de forma consciente', 'rever-delimitacao': 'Rever a delimitação (com evidência nova)', 'integrar-recortes': 'Integrar responsabilidades já comparadas', 'distribuir-existentes': 'Distribuir entre estruturas que já existem', 'propor-estrutura': 'Propor uma estrutura (depende de aprovação institucional e de cadastro)', pendente: 'Deixar pendente, com o que falta' };
  var SITUACAO_FORMAL = {
    compativel: ['Vínculo formal compatível', 'ok'], 'vinculo-a-revisar': ['Vínculo a revisar no Posicionamento', 'pend'],
    'executada-sem-vinculo-formal': ['Executada por estrutura do tipo, sem vínculo registrado', 'pend'],
    'exercida-sem-responsavel-formal-compativel': ['Exercida sem responsável formal compatível', 'pend'],
    'sem-estrutura': ['Sem estrutura do tipo recomendado', 'pend'], 'classificacao-a-validar': ['Classificação a validar', 'av'], 'sem-classificacao': ['Ainda sem classificação', 'neu']
  };
  var A_VALIDAR = {
    RECORTE: ['Esta responsabilidade reúne naturezas diferentes.', 'Volte à delimitação: compare as entregas e defina recortes menores. Se uma natureza predominar com evidência, registre a decisão humana no Posicionamento.'],
    CONFLITO: ['Os papéis identificados descrevem a mesma responsabilidade.', 'Registre abaixo, como evidência qualitativa, em que situações cada papel aparece. A decisão humana no Posicionamento usa essa evidência; a recomendação automática não muda.'],
    EVIDENCIA_INSUFICIENTE: ['Faltam respostas ou nenhum papel foi identificado.', 'Complete as respostas no Posicionamento ou registre a pendência com o que falta.'],
    INCOERENCIA: ['Uma resposta SIM ficou fora do caminho do questionário.', 'Confira as respostas no Posicionamento (reavaliação) ou volte à delimitação, se elas refletem responsabilidades diferentes.']
  };
  var HAB = { DESLIGADO: 'Desligado', SOMENTE_ADMIN_GERAL: 'Somente admin geral (homologação)', LIBERADO_PARA_PERFIS_AUTORIZADOS: 'Liberado para os perfis autorizados' };
  /* textos de tela de algumas perguntas (a matriz F1–F17 do núcleo continua a fonte da pergunta e do porquê) */
  var TEXTO_PERGUNTA = {
    F2a: { curta: 'Um só resultado e um só destinatário?' },
    F2b: { curta: 'No cadastro de Estruturas Organizacionais (ADMIN)',
      pergunta: 'Essa estrutura já está cadastrada no ADMIN para representação no Mapa da Floresta?',
      ajuda: 'Consulte em ADMIN → Avaliação e Mapa → Estruturas Organizacionais. Esse cadastro registra estruturas concretas da organização e não deve ser confundido com o cadastro de Atuações Organizacionais da Porta 2. Não é necessário cadastrar uma estrutura para continuar esta análise.',
      valores: { cadastrada: 'Existe no cadastro de Estruturas Organizacionais do ADMIN.', 'nao-cadastrada': 'É uma estrutura formal que ainda não consta naquele cadastro.', informal: 'É um agrupamento ou atuação sem formalização como estrutura organizacional.' } },
    F2c: { curta: 'Entregas da capacidade' }
  };
  var PRAZO = 15000;

  /* ===================== estado compartilhado (lido ao vivo) ===================== */
  var D = { hab: undefined, habErro: null, analises: undefined, propostas: undefined, aprovacoes: undefined, porObjeto: undefined, objetos: undefined,
    vigentes: undefined, avaliacoes: undefined, decisoes: undefined, rascunhos: undefined, estruturas: undefined, vinculos: undefined, ligacoes: undefined, offset: 0, erro: null };
  var ouvintes = { cfg: null, dados: [], estr: null };
  var aoMudarFns = [];
  function avisar() { aoMudarFns.forEach(function (f) { try { f(); } catch (e) { /* uma tela não derruba a outra */ } }); }
  function acesso() { return N() ? N().acessoPelaHabilitacao(D.hab, perfil()) : { ler: false, gravar: false, registrarAprovacao: false, habilitacao: 'DESLIGADO' }; }
  function ligarConfig() {
    if (ouvintes.cfg || !S() || !sessao()) return;
    ouvintes.cfg = S().ouvir(F().NOS.config, function (v) { D.hab = v && v.habilitacao ? v.habilitacao : 'DESLIGADO'; D.habRegistro = v || null; D.habErro = null; ligarDados(); avisar(); },
      function () { D.hab = 'DESLIGADO'; D.habErro = 'RECUSADA'; avisar(); });
  }
  function desligarDados() { ouvintes.dados.forEach(function (c) { c(); }); ouvintes.dados = []; if (ouvintes.estr) { ouvintes.estr(); ouvintes.estr = null; }
    ['analises', 'propostas', 'aprovacoes', 'porObjeto', 'objetos', 'vigentes', 'avaliacoes', 'decisoes', 'rascunhos', 'estruturas', 'vinculos', 'ligacoes'].forEach(function (k) { D[k] = undefined; }); }
  function ligarDados() {
    if (!acesso().ler) { if (ouvintes.dados.length) { desligarDados(); } return; }
    if (ouvintes.dados.length) return;
    var NOS = F().NOS;
    var ouvir = function (caminho, chave) { ouvintes.dados.push(S().ouvir(caminho, function (v) { D[chave] = v || {}; avisar(); }, function () { D[chave] = undefined; D.erro = chave; avisar(); })); };
    ouvir(NOS.analises, 'analises'); ouvir(NOS.propostas, 'propostas'); ouvir(NOS.aprovacoes, 'aprovacoes'); ouvir(NOS.porObjeto, 'porObjeto');
    ouvir('objetos-organizacionais', 'objetos'); ouvir('posicionamento-vigente-por-item', 'vigentes'); ouvir('avaliacoes-posicionamento', 'avaliacoes');
    ouvir('posicionamento-decisoes', 'decisoes'); ouvir('posicionamento-rascunho-por-item', 'rascunhos');
    ouvintes.dados.push(S().ouvir('.info/serverTimeOffset', function (v) { D.offset = typeof v === 'number' ? v : 0; }, function () {}));
    /* estruturas e vínculos (só leitura, para a situação formal): "ainda não sei" ≠ "não tem" */
    var E = window.faEstruturasFirebase, EA = window.faEstruturasAdmin;
    if (E && EA && EA.disponivel && EA.disponivel()) {
      ouvintes.estr = E.ouvir(null, ['registros', 'vinculos'], function (m) { if (m.estruturas) D.estruturas = m.estruturas; if (m.vinculos) D.vinculos = m.vinculos; avisar(); }, function () { D.estruturas = null; avisar(); });
      var M = window.faMotorPosicionamentoNucleo;
      E.lerLigacoes(null, M ? M.CODIGOS_FIRMES : []).then(function (l) { D.ligacoes = l; avisar(); });
    } else { D.estruturas = null; }
  }
  function aoMudarSessao() { desligarDados(); if (ouvintes.cfg) { ouvintes.cfg(); ouvintes.cfg = null; } D.hab = undefined; ligarConfig(); avisar(); }
  ['fa-auth-ready', 'fa-auth-change', 'fa-avaliacao-ready', 'fa-admin-ready'].forEach(function (ev) { window.addEventListener(ev, function () { if (ev === 'fa-auth-change') aoMudarSessao(); else { ligarConfig(); ligarDados(); avisar(); } }); });
  window.addEventListener('fa-estruturas-habilitacao', function () { if (!ouvintes.estr && acesso().ler && ouvintes.dados.length) { desligarDados(); ligarDados(); } });

  /* ---------- leitura derivada ---------- */
  function estado() { return F().estadoDoBanco({ analises: D.analises, propostas: D.propostas, aprovacoes: D.aprovacoes }); }
  function dadosProntos() { return ['analises', 'propostas', 'aprovacoes', 'porObjeto', 'objetos', 'vigentes', 'avaliacoes', 'decisoes', 'rascunhos'].every(function (k) { return D[k] !== undefined; }); }
  /* Posicionamento da atuação: { estado: 'sem-atuacao'|'nao-iniciado'|'em-andamento'|'concluido', codigoEfetivo, aValidar, motivo, tipo, decisao } */
  function posicionamentoDa(objetoId) {
    if (!objetoId) return { estado: 'sem-atuacao' };
    var vig = (D.vigentes || {})[objetoId], rasc = (D.rascunhos || {})[objetoId];
    if (!vig) return { estado: rasc ? 'em-andamento' : 'nao-iniciado', avaliacaoId: rasc || null };
    var reg = (D.avaliacoes || {})[vig] || {}, ra = reg.resultadoAutomatico || {}, dec = (D.decisoes || {})[vig] || null;
    var firme = ra.codigoResultado && ra.codigoResultado !== 'A_VALIDAR' && ra.codigoResultado !== 'LINHA' && ra.codigoResultado !== 'PLATAFORMA';
    var cod = dec && dec.codigoFinal ? dec.codigoFinal : (firme ? ra.codigoResultado : null);
    return { estado: 'concluido', avaliacaoId: vig, codigoEfetivo: cod, aValidar: !cod, tipo: ra.tipoAValidar || null, recomendacao: ra.codigoResultado || null, decisao: dec, reavaliando: !!rasc };
  }
  function vinculoAtivoDe(objetoId) {
    var vs = D.vinculos || {};
    for (var k in vs) if (Object.prototype.hasOwnProperty.call(vs, k) && vs[k].objetoId === objetoId && vs[k].situacao === 'ativa' && vs[k].papel === 'responsavel-principal') return { estruturaId: vs[k].estruturaId, situacao: 'ativo' };
    return null;
  }
  /* situação formal: null = "não sei calcular agora" (cadastro de estruturas indisponível ou ainda lendo) */
  function situacaoFormalDe(rec) {
    var p = posicionamentoDa(rec.objetoId);
    if (p.estado !== 'concluido') return { s: 'sem-classificacao', p: p };
    if (!p.codigoEfetivo) return { s: 'classificacao-a-validar', p: p };
    if (D.estruturas === undefined || D.ligacoes === undefined) return { s: null, p: p, lendo: true };
    if (D.estruturas === null || D.ligacoes === null) return { s: null, p: p, indisponivel: true };
    return { s: N().situacaoFormal({ codigoEfetivo: p.codigoEfetivo, vinculoPrincipal: vinculoAtivoDe(rec.objetoId), fatos: rec.fatos, estruturas: D.estruturas, ref: { ligacoes: D.ligacoes } }), p: p };
  }
  function nomeCodigo(c) { return c ? (P() ? P().nome(c) : c) : '—'; }
  function nomeEstrutura(id) { var e = (D.estruturas || {})[id]; return e ? e.nome : id; }

  /* ===================== gravação ===================== */
  function gravarOperacao(fn, aoTerminar, extra) {
    var ident = S().identidade();
    if (!ident) { aoTerminar({ erro: 'Sessão não identificada. Entre de novo.' }); return; }
    var NOS = F().NOS;
    var ctx = { operacaoId: S().novaChave(NOS.auditoria), novoId: S().novaChave(NOS.analises), usuario: { id: ident.uid, email: ident.email }, agora: Date.now() + (D.offset || 0) };
    var r = fn(estado(), ctx);
    if (!r.ok) { aoTerminar({ erro: mensagemErro(r.erros[0]) }); return; }
    var payload;
    try { payload = extra ? extra(r, ctx, ident) : F().payloadOperacao(r, { audId: S().novaChave(NOS.auditoria), usuario: ident, agora: S().agoraServidor() }); }
    catch (e) { aoTerminar({ erro: (e && e.message) || 'Não foi possível montar a gravação.' }); return; }
    S().gravar(payload, PRAZO, function (err) {
      if (!err) { aoTerminar({ ok: true, novoId: ctx.novoId }); return; }
      if (err === 'sem-resposta') { aoTerminar({ erro: 'O servidor não respondeu a tempo. A tela se atualiza sozinha quando a resposta chegar; confira antes de repetir.' }); return; }
      aoTerminar({ erro: 'O banco recusou a gravação. Outra pessoa pode ter gravado antes, ou a habilitação mudou. A tela já mostra o estado atual.' });
    });
  }
  var ERROS = {
    AGRUPAMENTO_SEM_COMPARACAO: 'Estas entregas só podem ficar na mesma responsabilidade depois de comparadas e concluídas como "a mesma" ou "precisam acontecer juntas".',
    ENTREGA_E_EXECUCAO_PARA_OUTRA: 'Esta entrega é executada para a responsabilidade de outra estrutura; ela não forma responsabilidade própria aqui.',
    ENTREGA_JA_EM_OUTRO_RECORTE: 'Uma das entregas já está em outra responsabilidade.',
    CONCLUSAO_CONTRA_OS_INDICIOS_SEM_JUSTIFICATIVA: 'Os critérios indicam responsabilidades distintas. Para concluir o contrário, escreva a justificativa.',
    CRITERIO_SEM_RESPOSTA: 'Responda os sete critérios (use "Não sei" quando for o caso).',
    RECORTE_NAO_PRONTO: 'A responsabilidade ainda não está delimitada o suficiente: faltam forma, destinatário ou evidência (ou a marca de hipótese) de alguma entrega.',
    RECORTE_JA_AVALIADO_DEFINA_OUTRO: 'Esta responsabilidade já foi avaliada. Para rever a delimitação, defina outra responsabilidade.',
    ALTERNATIVA_RECUSADA_NAO_RECLASSIFICA: 'Nenhuma alternativa de desenho troca a classificação recomendada.',
    PENDENCIA_INCOMPLETA: 'Para deixar pendente, diga o que falta, a próxima ação e quem decide.',
    PROPOSTA_DESATUALIZADA: 'Outra proposta foi registrada antes. Confira a vigente.', REVISAO_DESATUALIZADA: 'A análise mudou enquanto você editava. Confira o estado atual.',
    PROPOSTA_PENDENTE_NAO_SE_APROVA: 'Uma proposta pendente não recebe aprovação.', PROPOSTA_NAO_VIGENTE: 'Só a proposta vigente recebe aprovação.',
    RESPONSAVEL_NAO_DEFINIDO_COM_ESTRUTURA: '"Ainda não definido" não aponta estrutura.', RESPONSAVEL_FORMAL_INVALIDO: 'Diga qual estrutura responde (ou marque "ainda não definido"), com caráter e fonte.',
    EXECUCAO_INVALIDA: 'Cada informação de execução precisa da estrutura (ou descrição), do caráter e da fonte.', OUTRA_ESTRUTURA_SEM_IDENTIFICACAO: 'Diga qual estrutura responde.',
    EVIDENCIA_SEM_DESCRICAO: 'Descreva a evidência ou registre como hipótese.', NORMA_NAO_CITADA: 'Cite a norma.', ESTRUTURA_NAO_INFORMADA: 'Escolha qual estrutura cadastrada (a resposta "Está cadastrada" pede a estrutura).',
    ESTRUTURA_INCOMPATIVEL_COM_RESPOSTA: 'Só a resposta "Está cadastrada" aponta uma estrutura do cadastro.', ENTREGA_EM_RESPONSABILIDADE: 'Esta entrega está numa responsabilidade delimitada: tire-a de lá antes (descarte ou reveja a responsabilidade).',
    ENTREGA_EM_RESPONSABILIDADE_AVALIADA: 'Esta entrega está numa responsabilidade já avaliada pelo O1–O9: o texto não muda. Para rever, descarte a responsabilidade e delimite de novo.', ENTREGA_DESCARTADA: 'Esta entrega já foi excluída.', ENTREGA_INEXISTENTE: 'Entrega não encontrada.',
    CERTEZA_RESPONSAVEL_INVALIDA: 'Diga se o responsável é conhecido, provável ou ainda não definido.', NOME_OBRIGATORIO: 'O nome é obrigatório.', RESULTADO_OBRIGATORIO: 'O resultado é obrigatório.',
    JUSTIFICATIVA_DO_RECORTE_OBRIGATORIA: 'Explique por que esta responsabilidade é distinta das outras.', JUSTIFICATIVA_OBRIGATORIA: 'A justificativa é obrigatória.', MOTIVO_OBRIGATORIO: 'O motivo é obrigatório.',
    RECORTE_SEM_ENTREGA: 'Escolha ao menos uma entrega.', ENTREGA_SEM_DESCRICAO: 'Descreva a entrega.', EVIDENCIA_SEM_TEXTO: 'Escreva a evidência.', TIPO_ESCOPO_INVALIDO: 'Escolha o que você vai analisar.',
    AUTORIDADE_OBRIGATORIA: 'Informe a autoridade que aprovou.', REFERENCIA_DO_ATO_OBRIGATORIA: 'Informe a referência do ato (ata, documento).', DATA_DO_ATO_INVALIDA: 'Informe a data do ato.', OBJETO_APROVADO_OBRIGATORIO: 'Diga o que foi aprovado.',
    ATUACAO_JA_TEM_ORIGEM: 'Esta atuação já nasceu de outra análise.', ATUACAO_INVALIDA: 'Escolha a responsabilidade.', REFERENCIA_REPETIDA: 'Esta responsabilidade já está referenciada aqui.', REFERENCIA_A_PROPRIA_ORIGEM: 'Esta responsabilidade nasceu nesta análise.', RESPOSTA_INVALIDA: 'Escolha uma das respostas.', PROPOSTA_SEM_RECORTE: 'Escolha ao menos uma responsabilidade.'
  };
  function mensagemErro(e) { return (e && ERROS[e.codigo]) || ('Não foi possível gravar (' + (e && e.codigo) + ').'); }

  /* ===================== tela ===================== */
  function montar() {
    var wrap = document.getElementById('avaliacoesAnalise');
    if (!wrap || wrap._anBound) return null;
    wrap._anBound = true;
    var st = { tela: 'lista', id: null, flash: null, erro: null, gravando: false, form: null, abertos: {} };

    /* painel e identidade da página */
    var ident0 = null;
    function hero() { var s = wrap.closest('.page-section'); return s && s.querySelector('.page-hero'); }
    function identidade(meu) {
      var h = hero(); if (!h) return;
      var e = h.querySelector('.eyebrow'), h1 = h.querySelector('h1'), p = h.querySelector('p');
      if (meu && !ident0) ident0 = { e: e ? e.textContent : '', h1: h1 ? h1.textContent : '', p: p ? p.textContent : '' };
      if (!meu && !ident0) return;
      var t = meu ? { e: 'Porta 2 · Posicionamento Organizacional', h1: 'Análise Organizacional', p: 'Entender um escopo amplo, descobrir as responsabilidades que existem nele e decidir como organizá-las — sem transformar capacidade em estrutura.' } : { e: ident0.e, h1: ident0.h1, p: ident0.p };
      if (e) e.textContent = t.e; if (h1) h1.textContent = t.h1; if (p) p.textContent = t.p;
      if (!meu) ident0 = null;
    }
    function mostrar() {
      ['avaliacoesPainel', 'avaliacoesSquad', 'avaliacoesPosicionamento', 'avaliacoesMapa'].forEach(function (id) { var el = document.getElementById(id); if (el) el.hidden = true; });
      wrap.hidden = false; identidade(true);
    }
    function fechar() {
      if (wrap.hidden) return;
      wrap.hidden = true;
      var v = document.getElementById('avaliacoesPainel'); if (v) v.hidden = false;
      identidade(false);
    }
    function doEndereco() {
      var h = location.hash || '';
      if (h.split('?')[0] !== '#avaliacoes') return null;
      var m = /[?&]an=([^&]*)/.exec(h);
      return m ? decodeURIComponent(m[1]) : null;
    }
    function ir(an) { var alvo = '#avaliacoes?an=' + encodeURIComponent(an); if (location.hash !== alvo) location.hash = alvo; else aplicar(); }
    function aplicar() {
      var an = doEndereco();
      if (!an) { fechar(); return; }
      if (an === 'lista' || an === 'nova') { st.tela = an; st.id = null; } else { if (st.id !== an) { st.form = null; st.abertos = {}; } st.tela = 'analise'; st.id = an; }
      st.erro = null;
      mostrar(); ligarConfig(); ligarDados(); render();
    }

    /* ---------- desenho ---------- */
    function render() {
      if (wrap.hidden) return;
      var a = acesso(), h;
      if (!autorizacaoResolvida() || D.hab === undefined) h = '<p class="loading-msg" id="anCarregando">Carregando…</p>';
      else if (!a.ler) h = '<div class="avp-form-card" id="anIndisponivel"><p>A Análise Organizacional não está disponível para você agora.</p><p class="an-nota">A Porta 2 continua disponível como sempre: <a href="#avaliacoes?po=atuacoes">Atuações organizacionais</a>.</p></div>';
      else if (!dadosProntos()) h = '<p class="loading-msg" id="anCarregando">Carregando as análises…</p>';
      else if (st.tela === 'lista') h = renderLista(a);
      else if (st.tela === 'nova') h = a.gravar ? renderNova() : '<p class="admin-empty" id="anSemPermissao">Abrir uma análise é do perfil Avaliação + Configuração.</p>';
      else h = renderAnalise(a);
      var foco = document.activeElement && wrap.contains(document.activeElement) ? document.activeElement.id : null;
      wrap.innerHTML = '<div class="an-tela">' + (D.hab === 'SOMENTE_ADMIN_GERAL' ? '<p class="an-homologacao" id="anHomologacao">Em homologação: visível só para o admin geral.</p>' : '') + h + '</div>';
      if (foco) { var f = document.getElementById(foco); if (f && f.focus) f.focus({ preventScroll: true }); }
    }
    function voltar(href, texto, id) { return '<a class="avp-voltar-link" id="' + id + '" href="' + href + '">← ' + esc(texto) + '</a>'; }
    function situacaoTexto(s) { return { 'em-descoberta': 'Em descoberta', 'em-avaliacao': 'Em avaliação', classificada: 'Classificada · desenho a decidir', 'com-pendencia': 'Com pendência', proposta: 'Proposta registrada', aprovada: 'Aprovação registrada', descartada: 'Descartada' }[s] || s; }
    function infoPos() { var m = {}; Object.keys(D.vigentes || {}).forEach(function (o) { var p = posicionamentoDa(o); if (p.estado === 'concluido') m[o] = { codigoEfetivo: p.codigoEfetivo }; }); return m; }
    function renderLista(a) {
      var est = estado(), ids = Object.keys(est.analises).sort(function (x, y) { return (est.analises[y].criadaEm || 0) - (est.analises[x].criadaEm || 0); });
      var h = voltar('#avaliacoes?po=atuacoes', 'Voltar para as atuações organizacionais (Porta 2)', 'anVoltarAtuacoes') + '<h2 class="an-titulo">Análises organizacionais</h2>' +
        '<p class="an-intro">Use uma análise quando o que você quer entender é amplo — uma estrutura, uma grande área, um conjunto ou uma capacidade. Ela ajuda a descobrir as responsabilidades que existem ali; cada uma é avaliada pelo O1–O9 como uma atuação da Porta 2. <strong>Separar para avaliar não cria estrutura</strong>, e nada aqui muda o Mapa da Floresta.</p>';
      if (a.gravar) h += '<a class="btn btn--primary" id="anNovaBtn" href="#avaliacoes?an=nova">Abrir uma análise</a>';
      var ativas = ids.filter(function (id) { return est.analises[id].situacao !== 'descartada'; }), desc = ids.length - ativas.length;
      if (!ativas.length) h += '<p class="admin-empty" id="anListaVazia">Nenhuma análise aberta ainda.</p>';
      else h += '<ul class="an-lista" id="anLista">' + ativas.map(function (id) {
        var x = est.analises[id], n = Object.keys(x.recortes).filter(function (r) { return x.recortes[r].situacao === 'ativo'; }).length;
        return '<li><a class="an-item" data-analise="' + esc(id) + '" href="#avaliacoes?an=' + encodeURIComponent(id) + '"><span class="an-item-nome">' + esc(x.nome) + '</span>' +
          '<span class="an-item-det">' + esc(ESCOPO[x.tipoEscopo] ? ESCOPO[x.tipoEscopo][0] : x.tipoEscopo) + ' · ' + n + ' responsabilidade' + (n === 1 ? '' : 's') + '</span>' +
          '<span class="an-chip an-chip--neu">' + esc(situacaoTexto(N().situacaoDaAnalise(est, id, { posicionamentos: infoPos() }))) + '</span></a></li>';
      }).join('') + '</ul>';
      if (desc) h += '<p class="an-nota">' + desc + ' análise' + (desc === 1 ? '' : 's') + ' descartada' + (desc === 1 ? '' : 's') + ' (mantidas no histórico).</p>';
      return h;
    }
    function renderNova() {
      var f = st.form && st.form.tipo === 'nova' ? st.form : { tipo: 'nova' };
      var atuacoes = Object.keys(D.objetos || {}).filter(function (k) { return D.objetos[k].situacao === 'ativo'; }).sort(function (x, y) { return String(D.objetos[x].nome).localeCompare(D.objetos[y].nome); });
      return voltar('#avaliacoes?an=lista', 'Voltar para as análises', 'anVoltarLista') + '<h2 class="an-titulo">Abrir uma análise</h2>' +
        '<form class="avp-form-card an-form" id="anFormNova" novalidate>' +
        '<fieldset class="an-opcoes" id="anEscopo"><legend>1. O que você vai analisar?</legend>' + Object.keys(ESCOPO).map(function (k) {
          return '<label class="an-opcao"><input type="radio" name="anEscopo" value="' + k + '"' + (f.tipoEscopo === k ? ' checked' : '') + '><span><strong>' + esc(ESCOPO[k][0]) + '</strong><span class="an-exemplo">' + esc(ESCOPO[k][1]) + '</span></span></label>';
        }).join('') + '</fieldset>' +
        '<p class="an-porque">Por que perguntamos: um escopo amplo costuma reunir mais de uma responsabilidade. A análise não classifica nada — isso é papel do O1–O9, em cada responsabilidade.</p>' +
        '<div class="avp-field"><label for="anNome">Nome</label><input id="anNome" maxlength="200" value="' + esc(f.nome || '') + '"></div>' +
        '<div class="avp-field"><label for="anDescricao">Descrição <span class="an-opc">(opcional)</span></label><textarea id="anDescricao" rows="2" maxlength="2000">' + esc(f.descricao || '') + '</textarea></div>' +
        '<div class="avp-field"><label for="anCapacidades">Capacidades relacionadas <span class="an-opc">(opcional, separadas por ponto e vírgula; só referência)</span></label><input id="anCapacidades" value="' + esc(f.capacidades || '') + '"></div>' +
        '<fieldset class="an-opcoes" id="anAprofunda" aria-describedby="anAprofundaAjuda"><legend>Você quer aprofundar uma atuação organizacional já registrada na Porta 2?</legend>' +
          '<p class="an-ajuda" id="anAprofundaAjuda">Não é necessário cadastrar uma atuação antes de começar. Se você está investigando uma estrutura ou conjunto de atividades, pode iniciar diretamente por esta análise. As responsabilidades identificadas poderão originar atuações para avaliação posterior.</p>' +
          '<label class="an-opcao"><input type="radio" name="anTemAtuacao" value="nao"' + (f.objetoAmploId ? '' : ' checked') + '><span><strong>Não — começar uma análise nova</strong><span class="an-exemplo">O caso mais comum. As atuações nascem depois, das responsabilidades que a análise delimitar.</span></span></label>' +
          '<label class="an-opcao"><input type="radio" name="anTemAtuacao" value="sim"' + (f.objetoAmploId ? ' checked' : '') + (atuacoes.length ? '' : ' disabled') + '><span><strong>Sim — aprofundar uma atuação já registrada</strong><span class="an-exemplo">' + (atuacoes.length ? 'Para uma atuação ampla demais: ela continua como está e passa a aparecer como "delimitada em N responsabilidades".' : 'Ainda não há atuação registrada na Porta 2.') + '</span></span></label>' +
          (atuacoes.length ? '<div class="avp-field an-dependente"><label for="anObjetoAmplo">Qual atuação? <span class="an-opc" id="anObjetoAmploDica">' + (f.objetoAmploId ? '(obrigatória)' : '(só para "Sim")') + '</span></label><select id="anObjetoAmplo" aria-describedby="anObjetoAmploDica"' + (f.objetoAmploId ? '' : ' disabled') + '><option value="">—</option>' +
            atuacoes.map(function (k) { return '<option value="' + esc(k) + '"' + (f.objetoAmploId === k ? ' selected' : '') + '>' + esc(D.objetos[k].nome) + '</option>'; }).join('') + '</select></div>' : '') +
          '<p class="an-nota">Isto se refere às Atuações Organizacionais da Porta 2 (área Avaliação), e não às Estruturas Organizacionais cadastradas no ADMIN.</p></fieldset>' +
        (st.erro ? '<p class="avp-error-msg" id="anErro" role="alert">' + esc(st.erro) + '</p>' : '') +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anCriarBtn"' + (st.gravando ? ' disabled' : '') + '>' + (st.gravando ? 'Gravando…' : 'Abrir a análise') + '</button></div></form>';
    }

    /* ---------- jornada progressiva: quatro passos que não travam ---------- */
    var GRUPO = { F2a: 0, F2b: 0, F2c: 0, F3: 1, F4: 1, F5: 1, F6: 1, F7: 1, F8: 1, F12: 1, F13: 1, F10: 2, F11: 2 };
    function entregasAtivas(a) { return Object.keys(a.entregas).filter(function (k) { return a.entregas[k].situacao === 'ativa'; }).sort(function (x, y) { return (a.entregas[x].criadaEm || 0) - (a.entregas[y].criadaEm || 0); }); }
    function descrita(e) { var r = e.respostas; return !!(r.F4 && r.F5 && r.F6 && r.F8); }
    function recorteDaEntrega(a, ativos, e) { for (var i = 0; i < ativos.length; i++) if (a.recortes[ativos[i]].entregas.indexOf(e) !== -1) return a.recortes[ativos[i]]; return null; }
    function execOutra(e) { return !!(e.respostas.F7 && e.respostas.F7.valor === 'sim'); }
    function passos(a, pend, ativos, sfs) {
      var ents = entregasAtivas(a), g = [[], [], []];
      /* F3 (a primeira entrega) é o próprio formulário de entregas: não conta como pergunta pendente */
      pend.forEach(function (q) { if (q.pergunta !== 'F3') g[GRUPO[q.pergunta] || 0].push(q); });
      var semEntregas = !!(a.respostas.F3 && a.respostas.F3.valor === 'nenhuma');
      var livres = ents.filter(function (e) { return !execOutra(a.entregas[e]) && !recorteDaEntrega(a, ativos, e); });
      var descritas = ents.filter(function (e) { return descrita(a.entregas[e]); }).length;
      var avaliadas = sfs.filter(function (x) { return x.p.estado === 'concluido'; }).length;
      var semDescricao = !ents.length && semEntregas;
      var p = [
        { n: 1, titulo: 'Descobrir as entregas', pend: g[0].concat(g[1]), disponivel: true, concluido: !g[0].length && !g[1].length && (ents.length > 0 || semEntregas) },
        { n: 2, titulo: 'Delimitar as responsabilidades', pend: g[2], disponivel: descritas > 0 || ativos.length > 0,
          motivo: semDescricao ? 'Você registrou que não consegue identificar entregas — isso fica como lacuna da análise.' : 'Ainda não há nenhuma entrega descrita por completo.',
          condicao: semDescricao ? 'Quando identificar uma entrega, registre-a no Passo 1.' : 'No Passo 1, registre uma entrega e responda as perguntas sobre ela (forma, destinatário, quem responde e evidência).',
          concluido: ativos.length > 0 && !g[2].length && !livres.length },
        { n: 3, titulo: 'Avaliar cada responsabilidade com o O1–O9', pend: [], disponivel: ativos.length > 0, motivo: 'Ainda não há responsabilidade delimitada.', condicao: 'Delimite ao menos uma responsabilidade no Passo 2.',
          concluido: ativos.length > 0 && avaliadas === ativos.length },
        { n: 4, titulo: 'Composição organizacional', pend: [], disponivel: avaliadas > 0 || !!a.propostaVigente, motivo: 'Nenhuma responsabilidade tem o O1–O9 concluído.', condicao: 'Conclua o O1–O9 de ao menos uma responsabilidade (Passo 3).',
          concluido: !!a.propostaVigente }
      ];
      var atual = 4;
      for (var i = 0; i < p.length; i++) if (!p[i].concluido && p[i].disponivel) { atual = p[i].n; break; }
      return { lista: p, atual: atual, livres: livres, ents: ents, semEntregas: semEntregas };
    }
    function trilha(ps) {
      return '<ol class="an-trilha" id="anTrilha" aria-label="Passos da análise">' + ps.lista.map(function (p) {
        var s = p.concluido ? 'concluído' : !p.disponivel ? 'ainda não disponível' : p.n === ps.atual ? 'passo atual' : 'disponível';
        return '<li class="' + (p.concluido ? 'feita' : p.n === ps.atual ? 'atual' : !p.disponivel ? 'bloqueada' : '') + '"' + (p.n === ps.atual ? ' aria-current="step"' : '') + '>' +
          '<span class="an-trilha-n">' + p.n + '</span> ' + esc(p.titulo) + ' <span class="an-trilha-s">· ' + s + '</span></li>';
      }).join('') + '</ol>';
    }
    function rotuloPendencia(a, q) {
      var ent = q.entregaId && a.entregas[q.entregaId] ? ' — entrega "' + a.entregas[q.entregaId].descricao + '"' : '';
      var t = { F2a: 'Se a responsabilidade tem um só resultado e destinatário', F2b: 'Se a estrutura está no cadastro do ADMIN', F2c: 'Se você vai listar as entregas da capacidade', F3: 'Registrar a primeira entrega',
        F4: 'Forma da entrega', F5: 'Para quem é a entrega', F6: 'Quem responde pela entrega', F7: 'Se a execução é para outra estrutura', F8: 'Evidência da entrega', F12: 'Para quem é o padrão ou a capacitação', F13: 'De quem são as regras do serviço ou solução',
        F10: 'Comparar duas entregas parecidas', F11: 'Se política e operação precisam ficar separadas' }[q.pergunta] || q.pergunta;
      if (q.pergunta === 'F10') { var x = a.entregas[q.par[0]], y = a.entregas[q.par[1]]; ent = x && y ? ': "' + x.descricao + '" × "' + y.descricao + '"' : ''; }
      return t + ent;
    }
    function pendenciasHtml(a, p, idCard) {
      if (!p.pend.length) return '';
      var n = p.pend.length, aqui = idCard === p.n;
      return '<details class="an-pendencias" id="anPendencias' + p.n + '"><summary>' + n + ' pergunta' + (n === 1 ? '' : 's') + ' pendente' + (n === 1 ? '' : 's') + ' neste passo' +
        (aqui ? '' : ' — aparece' + (n === 1 ? '' : 'm') + ' uma por vez, depois da pergunta atual') + '</summary><ul>' +
        p.pend.map(function (q) { return '<li>' + esc(rotuloPendencia(a, q)) + '</li>'; }).join('') + '</ul></details>';
    }
    function secaoPasso(p, ps, corpo, sempre) {
      var s = p.concluido ? ['concluido', 'Concluído', 'ok'] : !p.disponivel ? ['indisponivel', 'Ainda não disponível', 'neu'] : p.n === ps.atual ? ['atual', 'Passo atual', 'atual'] : ['disponivel', 'Disponível', 'neu'];
      var h = '<section class="avp-form-card an-passo an-passo--' + s[0] + '" id="anPasso' + p.n + '" aria-labelledby="anPasso' + p.n + 'Titulo"><header class="an-passo-cab"><h3 id="anPasso' + p.n + 'Titulo"><span class="an-passo-num">Passo ' + p.n + '</span> ' + esc(p.titulo) + '</h3>' +
        '<span class="an-chip an-chip--' + s[2] + '" id="anPasso' + p.n + 'Estado">' + s[1] + '</span></header>';
      if (!p.disponivel && !p.concluido) return h + '<p class="an-indisponivel" id="anPasso' + p.n + 'Motivo"><strong>Por quê:</strong> ' + esc(p.motivo) + '</p><p class="an-nota" id="anPasso' + p.n + 'Condicao"><strong>Para avançar:</strong> ' + esc(p.condicao) + '</p>' + (sempre || '') + '</section>';
      return h + corpo + (sempre || '') + '</section>';
    }
    /* a próxima ação: uma frase e um botão que leva até ela (sem trocar de endereço) */
    function proximaAcao(a, pend, ps, ativos, sfs, gravar) {
      if (a.situacao === 'descartada') return { t: 'Análise descartada: só consulta. Nada foi apagado.' };
      if (!gravar) return { t: 'Você está consultando: pode ler tudo, mas gravar é do perfil Avaliação + Configuração.' };
      var q = pend[0];
      if (q && q.pergunta === 'F3') return { t: 'Registre a primeira entrega — ou diga que não consegue identificar nenhuma.', alvo: 'anEntregaDesc' };
      if (q) {
        var ent = q.entregaId && a.entregas[q.entregaId] ? ' sobre a entrega "' + a.entregas[q.entregaId].descricao + '"' : '';
        return { t: (GRUPO[q.pergunta] === 0 ? 'Responda a pergunta sobre o objeto da análise.' : q.pergunta === 'F10' ? 'Compare duas entregas parecidas (Passo 2).' : 'Responda a pergunta' + ent + ' (Passo ' + (GRUPO[q.pergunta] === 2 ? 2 : 1) + ').'), alvo: 'anPergunta' };
      }
      if (!ps.ents.length && !ps.semEntregas) return { t: 'Registre a primeira entrega.', alvo: 'anEntregaDesc' };
      if (ps.livres.length && ps.lista[1].disponivel) return { t: 'Delimite uma responsabilidade com as entregas que ainda estão fora de qualquer uma (' + ps.livres.length + ').', alvo: 'anFormRecorte' };
      for (var i = 0; i < ativos.length; i++) {
        var r = a.recortes[ativos[i]], p = sfs[i].p;
        if (!r.objetoId) return N().prontaParaO1O9(a, ativos[i]).pronta ? { t: 'Avalie "' + r.nome + '" com o O1–O9.', alvo: 'anCriarAtuacao_' + ativos[i] } : { t: 'Complete as informações de "' + r.nome + '" para poder avaliá-la.', alvo: 'anNaoPronta_' + ativos[i] };
        if (p.estado !== 'concluido') return { t: 'Responda o O1–O9 de "' + r.nome + '" no Posicionamento.', alvo: 'anAbrirPos_' + ativos[i] };
      }
      if (!ativos.length) return ps.semEntregas ? { t: 'Você registrou que não consegue identificar entregas. Quando identificar uma, registre-a no Passo 1.', alvo: 'anEntregaDesc' } : { t: 'Delimite a primeira responsabilidade.', alvo: 'anFormRecorte' };
      if (!a.propostaVigente) return { t: 'Registre a proposta de composição (Passo 4).', alvo: 'anAbrirProposta' };
      return { t: 'Proposta registrada. A aprovação do desenho é de uma instância institucional; o admin geral registra a referência ao ato.' };
    }
    function renderAnalise(acc) {
      var est = estado(), a = est.analises[st.id];
      if (!a) return voltar('#avaliacoes?an=lista', 'Voltar para as análises', 'anVoltarLista') + '<p class="admin-empty" id="anNaoEncontrada">Análise não encontrada.</p>';
      var pend = N().proximasPerguntas(a), lac = N().lacunas(a), gravar = acc.gravar && a.situacao === 'aberta';
      var ativos = Object.keys(a.recortes).filter(function (k) { return a.recortes[k].situacao === 'ativo'; }).sort(function (x, y) { return (a.recortes[x].criadoEm || 0) - (a.recortes[y].criadoEm || 0); });
      var sfs = ativos.map(function (k) { return situacaoFormalDe(a.recortes[k]); });
      var classificadas = sfs.filter(function (x) { return x.p.estado === 'concluido'; }).length;
      var pendForm = sfs.filter(function (x) { return x.s && x.s !== 'compativel'; }).length;
      var vig = N().propostaVigente(est, st.id), aprov = vig ? est.aprovacoes[vig.id] : null;
      var decisao = !vig ? 'Sem proposta' : vig.situacao === 'pendente' ? 'Pendente (proposta v' + vig.versao + ')' : aprov ? 'Aprovação registrada (referência a ato externo)' : 'Proposta v' + vig.versao + ', sem aprovação registrada';
      var ps = passos(a, pend, ativos, sfs);
      /* a pergunta da vez: uma só, no passo a que pertence (ou a resposta que a pessoa pediu para alterar) */
      var alterando = gravar && st.form && st.form.tipo === 'alterar-objeto' ? st.form.q : null;
      var card = !gravar ? null : alterando ? { grupo: 0, html: renderPergunta(a, [{ pergunta: alterando }], true) } : pend.length && pend[0].pergunta !== 'F3' ? { grupo: GRUPO[pend[0].pergunta] || 0, html: renderPergunta(a, pend) } : null;
      var cardEm = card ? (card.grupo === 0 ? 0 : card.grupo === 1 ? 1 : 2) : -1;
      var px = proximaAcao(a, alterando ? [] : pend, ps, ativos, sfs, gravar);
      var h = voltar('#avaliacoes?an=lista', 'Voltar para as análises', 'anVoltarLista') +
        '<h2 class="an-titulo" id="anTitulo">' + esc(a.nome) + '</h2>' +
        (a.situacao === 'descartada' ? '<p class="avp-error-msg" id="anDescartada">Análise descartada: ' + esc(a.descarte && a.descarte.motivo) + '. Nada foi apagado.</p>' : '') +
        trilha(ps) +
        '<div class="an-proxima" id="anProximaAcao" role="status"><p><strong>Próxima ação:</strong> ' + esc(px.t) + '</p>' +
        (px.alvo ? '<button type="button" class="btn btn--primary btn--sm" data-an="ir-para" data-alvo="' + esc(px.alvo) + '" id="anIrProxima">Ir para lá</button>' : '') + '</div>' +
        (st.flash ? '<p class="avp-flash-success" id="anFlash" role="status">' + esc(st.flash) + '</p>' : '') +
        (st.erro ? '<p class="avp-error-msg" id="anErro" role="alert">' + esc(st.erro) + '</p>' : '');
      h += renderObjeto(a, gravar, cardEm === 0 ? card.html : '');
      h += secaoPasso(ps.lista[0], ps, pendenciasHtml(a, ps.lista[0], cardEm === 1 ? 1 : -1) + (cardEm === 1 ? card.html : '') + renderEntregas(a, ativos, ps, gravar));
      h += secaoPasso(ps.lista[1], ps, pendenciasHtml(a, ps.lista[1], cardEm === 2 ? 2 : -1) + (cardEm === 2 ? card.html : '') + renderDelimitacao(a, ativos, gravar), renderReferencias(a, gravar));
      h += secaoPasso(ps.lista[2], ps, renderRecortes(a, ativos, sfs, gravar));
      h += secaoPasso(ps.lista[3], ps, renderComposicao(est, a, ativos, sfs, acc));
      h += '<dl class="an-estados" id="anEstados">' +
        '<div><dt>Classificação (O1–O9)</dt><dd id="anEstadoClassificacao">' + classificadas + ' de ' + ativos.length + ' responsabilidade' + (ativos.length === 1 ? '' : 's') + '</dd></div>' +
        '<div><dt>Diagnóstico de vínculo</dt><dd id="anEstadoDiagnostico">' + (ativos.length ? (pendForm ? pendForm + ' com pendência' : 'sem pendência conhecida') : '—') + '</dd></div>' +
        '<div><dt>Decisão organizacional</dt><dd id="anEstadoDecisao">' + esc(decisao) + '</dd></div></dl>';
      if (lac.length) h += '<section class="avp-form-card an-secao" id="anLacunas"><h3>Lacunas (não impedem continuar)</h3><ul>' + lac.map(function (l) { return '<li>' + esc(textoLacuna(a, l)) + '</li>'; }).join('') + '</ul></section>';
      h += renderHistorico(a);
      h += '<div class="avp-actions-footer an-rodape"><button type="button" class="btn btn--sm" id="anExportarBtn" data-an="exportar">📊 Exportar Excel</button>' +
        (gravar ? '<button type="button" class="btn btn--sm btn--danger" data-an="abrir-form" data-form="descartar" id="anDescartarBtn">Descartar a análise</button>' : '') + '</div>';
      if (st.form && st.form.tipo === 'descartar') h += '<form class="avp-form-card an-form" id="anFormDescartar"><div class="avp-field"><label for="anMotivoDescarte">Motivo do descarte</label><textarea id="anMotivoDescarte" maxlength="500" rows="2"></textarea></div><p class="an-nota">Nada é apagado: a análise fica no histórico como descartada.</p><div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="anConfirmarDescarte">Descartar</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      return h;
    }
    /* o objeto da análise: o que foi escolhido ao abrir e as respostas sobre ele, que podem ser alteradas */
    function renderObjeto(a, gravar, card) {
      var amplo = a.objetoAmploId ? (D.objetos || {})[a.objetoAmploId] : null, h = '<section class="avp-form-card an-objeto" id="anObjeto" aria-labelledby="anObjetoTitulo"><h3 id="anObjetoTitulo">O que está sendo analisado</h3><dl class="an-objeto-dl">' +
        '<div><dt>Escopo</dt><dd id="anObjetoEscopo">' + esc(ESCOPO[a.tipoEscopo] ? ESCOPO[a.tipoEscopo][0] : a.tipoEscopo) + '</dd></div>' +
        (a.descricao ? '<div><dt>Descrição</dt><dd>' + esc(a.descricao) + '</dd></div>' : '') +
        (a.capacidades.length ? '<div><dt>Capacidades (só referência)</dt><dd>' + a.capacidades.map(function (c) { return esc(c.rotulo); }).join(', ') + '</dd></div>' : '') +
        (a.objetoAmploId ? '<div><dt>Aprofunda a atuação da Porta 2</dt><dd>' + esc(amplo ? amplo.nome : a.objetoAmploId) + '</dd></div>' : '');
      ['F2a', 'F2b', 'F2c'].forEach(function (q) {
        var r = a.respostas[q]; if (!r) return;
        var ref = q === 'F2b' ? N().cadastroReferido(a) : null;
        h += '<div><dt>' + esc(TEXTO_PERGUNTA[q] ? TEXTO_PERGUNTA[q].curta : q) + '</dt><dd id="anObjeto' + q + '">' + esc((ROT[q] || {})[r.valor] || r.valor) + (ref ? ': ' + esc(nomeEstrutura(ref)) : '') +
          (gravar && !card ? ' <button type="button" class="btn btn--sm an-alterar" data-an="abrir-form" data-form="alterar-objeto" data-q="' + q + '" id="anAlterar' + q + '">Alterar</button>' : '') + '</dd></div>';
      });
      return h + '</dl>' + card + '</section>';
    }
    function nomeEntrega(a, id) { var e = a.entregas[id]; return e ? e.descricao : id; }
    function textoLacuna(a, l) {
      if (l.tipo === 'sem-entrega-identificada') return 'Nenhuma entrega identificada.';
      if (l.tipo === 'responsabilidades-da-capacidade-desconhecidas') return 'Ainda não se sabe quais responsabilidades sustentam a capacidade.';
      if (l.tipo === 'responsavel-desconhecido') return 'Não se sabe quem responde por: ' + nomeEntrega(a, l.entregaId) + '.';
      if (l.tipo === 'hipotese-sem-evidencia') return 'Hipótese sem evidência: ' + nomeEntrega(a, l.entregaId) + '.';
      if (l.tipo === 'identidade-nao-concluida') { var p = l.par.split('|'); return 'Ainda não se sabe se são a mesma responsabilidade: ' + nomeEntrega(a, p[0]) + ' × ' + nomeEntrega(a, p[1]) + '.'; }
      if (l.tipo === 'entrega-sem-recorte') return 'Entrega ainda fora de qualquer responsabilidade: ' + nomeEntrega(a, l.entregaId) + '.';
      return l.tipo;
    }
    /* a pergunta da vez — uma só, com o porquê; "alterando" reabre uma resposta já dada sobre o objeto */
    function renderPergunta(a, pend, alterando) {
      var q = pend[0], M = {}; N().MATRIZ.forEach(function (x) { M[x.id] = x; });
      var def = M[q.pergunta], tx = TEXTO_PERGUNTA[q.pergunta] || {}, atual = alterando ? a.respostas[q.pergunta] : null;
      var h = '<div class="an-pergunta" id="anPergunta" aria-labelledby="anPerguntaTitulo">' + (alterando ? '<p class="an-contador">Alterando uma resposta já dada</p>' : '<p class="an-contador">Pergunta atual</p>');
      if (q.pergunta === 'F10') {
        var x = a.entregas[q.par[0]], y = a.entregas[q.par[1]];
        h += '<h4 id="anPerguntaTitulo">Estas duas entregas são a mesma responsabilidade?</h4><p class="an-par"><strong>' + esc(x.descricao) + '</strong> × <strong>' + esc(y.descricao) + '</strong></p>' +
          '<p class="an-porque">Por que perguntamos: elas se parecem (' + esc(q.sinais.map(function (s) { return { 'mesma-forma': 'mesma forma', 'mesmo-destinatario': 'mesmo destinatário', 'mesmo-responsavel': 'mesmo responsável', 'padrao-aplicado-nos-proprios-casos': 'padrão aplicado nos próprios casos' }[s] || s; }).join(', ')) + '). Parecer não basta: a identidade depende dos critérios abaixo, e nada é juntado sem a sua conclusão. Uma responsabilidade pode reunir várias entregas; uma entrega não é, sozinha, uma responsabilidade.</p>' +
          '<form id="anFormComparar" data-a="' + esc(q.par[0]) + '" data-b="' + esc(q.par[1]) + '">' + Object.keys(CRITERIO).map(function (k) {
            return '<fieldset class="an-criterio"><legend>' + esc(CRITERIO[k][0]) + ' <span class="an-exemplo">' + esc(CRITERIO[k][1]) + '</span></legend>' + ['igual', 'diferente', 'nao-sei'].map(function (v) {
              return '<label class="an-opcao an-opcao--linha"><input type="radio" name="anCrit_' + k + '" value="' + v + '"><span>' + { igual: 'Igual', diferente: 'Diferente', 'nao-sei': 'Não sei' }[v] + '</span></label>'; }).join('') + '</fieldset>';
          }).join('') +
          '<fieldset class="an-opcoes"><legend>Sua conclusão</legend>' + Object.keys(CONCLUSAO).map(function (k) { return '<label class="an-opcao"><input type="radio" name="anConclusao" value="' + k + '"><span>' + esc(CONCLUSAO[k]) + '</span></label>'; }).join('') + '</fieldset>' +
          '<div class="avp-field"><label for="anJustComp">Justificativa <span class="an-opc">(obrigatória se contrariar os critérios)</span></label><textarea id="anJustComp" rows="2" maxlength="2000"></textarea></div>' +
          '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anResponderBtn"' + (st.gravando ? ' disabled' : '') + '>Registrar a comparação</button></div></form></div>';
        return h;
      }
      var ent = q.entregaId ? a.entregas[q.entregaId] : null;
      h += (ent ? '<p class="an-sobre">Sobre a entrega: <strong>' + esc(ent.descricao) + '</strong></p>' : '') + '<h4 id="anPerguntaTitulo">' + esc(tx.pergunta || def.pergunta) + '</h4>' +
        (tx.ajuda ? '<p class="an-ajuda" id="anPerguntaAjuda">' + esc(tx.ajuda) + '</p>' : '<p class="an-porque">Por que perguntamos: ' + esc(def.porque) + '</p>') +
        '<form id="anFormResponder" data-q="' + q.pergunta + '" data-entrega="' + esc(q.entregaId || '') + '"' + (alterando ? ' data-alterando="1"' : '') + '>' +
        '<fieldset class="an-opcoes"><legend class="sr-only">Respostas</legend>' + def.valores.map(function (v) {
          var d = tx.valores && tx.valores[v];
          return '<label class="an-opcao"><input type="radio" name="anResposta" value="' + v + '"' + (atual && atual.valor === v ? ' checked' : '') + '><span>' + (d ? '<strong>' + esc((ROT[q.pergunta] || {})[v] || v) + '</strong><span class="an-exemplo">' + esc(d) + '</span>' : esc((ROT[q.pergunta] || {})[v] || v)) + '</span></label>'; }).join('') + '</fieldset>';
      if (q.pergunta === 'F6') h += '<div class="avp-field"><label for="anCerteza">Isso é</label><select id="anCerteza">' + Object.keys(CERTEZA).map(function (k) { return '<option value="' + k + '">' + esc(CERTEZA[k]) + '</option>'; }).join('') + '</select></div>' + campoEstrutura('anOutraEstrutura', 'Qual estrutura (se for outra)?', true);
      if (q.pergunta === 'F8' || q.pergunta === 'F11') h += '<div class="avp-field"><label for="anTextoResp">' + (q.pergunta === 'F8' ? 'Evidência (documento, indicador, ata, exemplo de caso)' : 'Norma (se for exigência normativa)') + '</label><textarea id="anTextoResp" rows="2" maxlength="2000"></textarea></div>';
      if (q.pergunta === 'F2b') h += campoEstruturaCadastrada(atual);
      h += '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anResponderBtn"' + (st.gravando ? ' disabled' : '') + '>' + (alterando ? 'Gravar a alteração' : 'Responder') + '</button>' +
        (alterando ? '<button type="button" class="btn btn--sm" data-an="cancelar" id="anCancelarAlteracao">Cancelar</button>' : '') + '</div></form></div>';
      return h;
    }
    /* F2b: a estrutura cadastrada só existe (e só é exigida) com "Está cadastrada"; nas outras respostas o campo fica
       desabilitado e vazio. O núcleo recusa a combinação incoerente — a tela só evita oferecê-la */
    function campoEstruturaCadastrada(atual) {
      var ests = D.estruturas ? Object.keys(D.estruturas).filter(function (k) { return D.estruturas[k].situacao === 'ativa'; }).sort(function (x, y) { return String(D.estruturas[x].nome).localeCompare(D.estruturas[y].nome); }) : [];
      var ligado = !!(atual && atual.valor === 'cadastrada'), sel = ligado ? atual.estruturaId : '';
      if (!ests.length) return '<p class="an-nota" id="anEstruturaCadastradaAviso">' + (D.estruturas === undefined ? 'Lendo o cadastro de Estruturas Organizacionais…' : 'O cadastro de Estruturas Organizacionais não está disponível agora (ou ainda não tem estruturas ativas). Se a estrutura está cadastrada, volte a esta pergunta depois; se não está, escolha outra resposta.') + '</p>';
      return '<div class="avp-field an-dependente" id="anEstruturaCadastradaCampo"><label for="anEstruturaCadastrada">Qual estrutura cadastrada? <span class="an-opc" id="anEstruturaCadastradaDica">' + (ligado ? '(obrigatória)' : '(só para "Está cadastrada")') + '</span></label>' +
        '<select id="anEstruturaCadastrada" aria-describedby="anEstruturaCadastradaDica"' + (ligado ? ' required' : ' disabled') + '><option value="">—</option>' + ests.map(function (k) { return '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(D.estruturas[k].nome) + '</option>'; }).join('') + '</select></div>';
    }
    function campoEstrutura(id, rotulo, comTexto) {
      var ests = D.estruturas ? Object.keys(D.estruturas).filter(function (k) { return D.estruturas[k].situacao === 'ativa'; }).sort(function (x, y) { return String(D.estruturas[x].nome).localeCompare(D.estruturas[y].nome); }) : [];
      return '<div class="avp-field"><label for="' + id + '">' + esc(rotulo) + '</label>' + (ests.length ? '<select id="' + id + '"><option value="">—</option>' + ests.map(function (k) { return '<option value="' + esc(k) + '">' + esc(D.estruturas[k].nome) + '</option>'; }).join('') + '</select>' : '') +
        (comTexto || !ests.length ? '<input id="' + id + 'Texto" placeholder="' + (ests.length ? 'ou descreva' : 'descreva a estrutura') + '" maxlength="2000">' : '') + '</div>';
    }
    function resumoResposta(r, q) { if (!r) return '—'; var t = (ROT[q] || {})[r.valor] || r.valor; if (q === 'F6') t += ' (' + (CERTEZA[r.certeza] || r.certeza) + ')' + (r.estruturaId ? ': ' + nomeEstrutura(r.estruturaId) : r.texto ? ': ' + r.texto : ''); if (r.texto && q !== 'F6') t += ': ' + r.texto; return t; }
    function conceitosHtml(aberto) {
      return '<details class="an-conceitos" id="anConceitos"' + (aberto ? ' open' : '') + '><summary>Campo de atuação, responsabilidade, entrega e evidência — o que é cada um</summary>' +
        '<p class="an-nota">Exemplos <strong>hipotéticos</strong>, só para ilustrar:</p><dl class="an-conceitos-dl">' +
        '<div><dt>Campo de atuação</dt><dd>O assunto amplo em que se trabalha. <span class="an-exemplo">Ex.: Governança de TI.</span></dd></div>' +
        '<div><dt>Responsabilidade</dt><dd>Aquilo por que alguém responde, com um resultado. <span class="an-exemplo">Ex.: avaliar a aderência dos processos de TI às diretrizes de governança.</span></dd></div>' +
        '<div><dt>Entrega</dt><dd>O resultado que sai daqui e alguém usa. <span class="an-exemplo">Ex.: diagnóstico de aderência com recomendações.</span></dd></div>' +
        '<div><dt>Exemplo concreto (evidência)</dt><dd>Um caso real daquela entrega. <span class="an-exemplo">Ex.: relatório de avaliação de controles de um processo de TI.</span></dd></div></dl>' +
        '<p class="an-nota">Uma responsabilidade pode reunir várias entregas: nunca presuma que cada entrega é uma responsabilidade — isso se decide no Passo 2, comparando. Um documento sozinho não prova a natureza organizacional; ele ilustra a entrega. Quem classifica é o O1–O9, no Passo 3.</p></details>';
    }
    function renderEntregas(a, ativos, ps, gravar) {
      var ids = ps.ents, h = conceitosHtml(st.abertos.conceitos !== undefined ? st.abertos.conceitos : !ids.length) + '<div class="an-secao-entregas" id="anEntregas"><h4>Entregas registradas (' + ids.length + ')</h4>';
      if (!ids.length) h += ps.semEntregas ? '<p class="an-nota" id="anSemEntregasRegistrado">Você registrou que não consegue identificar entregas. Isso fica como lacuna e não impede continuar; se identificar uma depois, registre aqui.</p>'
        : '<p class="admin-empty" id="anEntregasVazio">Nenhuma entrega registrada ainda. Comece pela primeira: o que se produz aqui para alguém?</p>';
      else h += '<ul class="an-entregas">' + ids.map(function (k) {
        var e = a.entregas[k], r = e.respostas, rec = recorteDaEntrega(a, ativos, k);
        var faltam = ['F4', 'F5', 'F6', 'F8'].filter(function (q) { return !r[q]; }).map(function (q) { return { F4: 'forma', F5: 'destinatário', F6: 'quem responde', F8: 'evidência' }[q]; });
        var li = '<li class="an-entrega" data-entrega="' + esc(k) + '"><div class="an-entrega-cab"><strong>' + esc(e.descricao) + '</strong>' +
          (faltam.length ? ' <span class="an-chip an-chip--pend">falta: ' + esc(faltam.join(', ')) + '</span>' : ' <span class="an-chip an-chip--ok">descrita</span>') +
          (execOutra(e) ? ' <span class="an-chip an-chip--neu">execução para outra estrutura</span>' : '') + (r.F8 && r.F8.valor === 'sem-evidencia' ? ' <span class="an-chip an-chip--pend">hipótese</span>' : '') + '</div>' +
          (e.exemplo ? '<span class="an-det">Exemplo: ' + esc(e.exemplo) + '</span>' : '') +
          '<span class="an-det">' + ['F4', 'F5', 'F6', 'F8'].map(function (q) { return r[q] ? esc(resumoResposta(r[q], q)) : ''; }).filter(Boolean).join(' · ') + '</span>' +
          (rec ? '<span class="an-det">Na responsabilidade "' + esc(rec.nome) + '"</span>' : '');
        if (gravar) {
          var editavel = !(rec && rec.objetoId), removivel = !rec;
          li += '<div class="an-acoes">' + (editavel ? '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="editar-entrega" data-entrega="' + esc(k) + '" id="anEditarEntrega_' + esc(k) + '">Editar</button>' : '') +
            (removivel ? '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="descartar-entrega" data-entrega="' + esc(k) + '" id="anExcluirEntrega_' + esc(k) + '">Excluir</button>' : '') +
            (!editavel ? '<span class="an-nota">Já avaliada pelo O1–O9: o texto não muda.</span>' : !removivel ? '<span class="an-nota">Para excluir, tire-a antes da responsabilidade.</span>' : '') + '</div>';
          if (st.form && st.form.entrega === k && st.form.tipo === 'editar-entrega') li += '<form class="an-form" id="anFormEditarEntrega" data-entrega="' + esc(k) + '"><div class="avp-field"><label for="anEditDesc">Entrega</label><input id="anEditDesc" maxlength="2000" value="' + esc(e.descricao) + '"></div>' +
            '<div class="avp-field"><label for="anEditEx">Exemplo concreto <span class="an-opc">(opcional)</span></label><input id="anEditEx" maxlength="2000" value="' + esc(e.exemplo || '') + '"></div>' +
            '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anSalvarEntrega">Gravar</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
          if (st.form && st.form.entrega === k && st.form.tipo === 'descartar-entrega') li += '<form class="an-form" id="anFormDescartarEntrega" data-entrega="' + esc(k) + '"><p class="an-nota">A entrega sai da análise e fica no histórico (nada é apagado).</p><div class="avp-field"><label for="anMotivoEntrega">Motivo <span class="an-opc">(opcional)</span></label><input id="anMotivoEntrega" maxlength="500"></div>' +
            '<div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="anConfirmarExcluirEntrega">Excluir a entrega</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
        }
        return li + '</li>';
      }).join('') + '</ul>';
      h += '</div>';
      if (gravar) {
        /* o total vem do que o banco já devolveu (a escuta pode chegar um instante depois da confirmação da gravação) */
        var fe = st.flashEntrega && ids.some(function (k) { return a.entregas[k].descricao === st.flashEntrega.descricao; }) ? st.flashEntrega : null;
        h += (fe ? '<p class="avp-flash-success" id="anEntregaFeedback" role="status">Entrega registrada: "' + esc(fe.descricao) + '". Total: ' + ids.length + ' entrega' + (ids.length === 1 ? '' : 's') + '. Adicione outra, se houver, ou responda as perguntas sobre ela (veja a próxima ação). Quando todas estiverem descritas, siga para o Passo 2 — Delimitar as responsabilidades.</p>' : '') +
          '<form class="an-form" id="anFormEntrega" aria-labelledby="anFormEntregaTitulo"><h4 id="anFormEntregaTitulo">' + (ids.length ? 'Adicionar outra entrega' : 'Adicionar a primeira entrega') + '</h4>' +
          '<p class="an-ajuda" id="anEntregaInstrucao">Registre uma entrega por vez. Pense no resultado que o núcleo produz para alguém, e não no nome da área ou no cargo das pessoas. Você poderá adicionar várias entregas e depois analisar quais pertencem à mesma responsabilidade.</p>' +
          '<div class="avp-field"><label for="anEntregaDesc">Entrega</label><input id="anEntregaDesc" maxlength="2000" aria-describedby="anEntregaInstrucao" placeholder="Ex.: diagnóstico de aderência dos processos de TI, com recomendações"></div>' +
          '<div class="avp-field"><label for="anEntregaEx">Exemplo concreto <span class="an-opc">(opcional)</span></label><input id="anEntregaEx" maxlength="2000" placeholder="Ex.: relatório de avaliação de controles de um processo de TI"></div>' +
          '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anAddEntregaBtn"' + (st.gravando ? ' disabled' : '') + '>Adicionar entrega</button>' +
          (!ids.length && !ps.semEntregas ? '<button type="button" class="btn btn--sm" data-an="responder" data-q="F3" data-v="nenhuma" id="anSemEntregas">Não consigo identificar entregas</button>' : '') + '</div></form>';
      }
      return h;
    }
    function textoPos(p) {
      if (p.estado === 'sem-atuacao') return 'Ainda não avaliada';
      if (p.estado === 'nao-iniciado') return 'Atuação criada; O1–O9 não iniciado';
      if (p.estado === 'em-andamento') return 'O1–O9 em andamento';
      if (p.codigoEfetivo) return (p.decisao ? 'Decisão final: ' : 'Recomendação: ') + nomeCodigo(p.codigoEfetivo) + (p.reavaliando ? ' (reavaliação em andamento)' : '');
      return 'A validar' + (p.tipo ? ' — ' + { RECORTE: 'recorte', CONFLITO: 'conflito', EVIDENCIA_INSUFICIENTE: 'evidência insuficiente', INCOERENCIA: 'incoerência' }[p.tipo] : '');
    }
    function renderFatos(r) {
      if (!r.fatos) return '<p class="an-nota">Quem executa e quem responde: ainda não informado.</p>';
      var fx = function (f) { return (f.estruturaId ? esc(nomeEstrutura(f.estruturaId)) : esc(f.texto || '—')) + ' <span class="an-chip an-chip--' + (f.carater === 'hipotese' ? 'pend' : 'neu') + '">' + esc(CARATER[f.carater] || f.carater) + '</span> <span class="an-det">fonte: ' + esc(f.fonte) + ' · ' + esc(fmtData(f.informadoEm)) + '</span>'; };
      var rf = r.fatos.responsavelFormal;
      return '<p class="an-fato"><strong>Quem executa hoje:</strong> ' + (r.fatos.execucao.length ? r.fatos.execucao.map(fx).join('; ') : 'não informado') + '</p>' +
        '<p class="an-fato"><strong>Quem responde formalmente:</strong> ' + esc(CERTEZA[rf.certeza] || rf.certeza) + (rf.certeza !== 'nao-definido' ? ' — ' + fx(rf) : ' <span class="an-det">fonte: ' + esc(rf.fonte) + ' · ' + esc(fmtData(rf.informadoEm)) + '</span>') + '</p>' +
        '<p class="an-nota">Estas são informações descritivas da análise: não são vínculo formal (o vínculo é registrado na ficha do Posicionamento).</p>';
    }
    /* Passo 2: comparar e delimitar (as responsabilidades delimitadas são avaliadas no Passo 3) */
    function renderDelimitacao(a, ativos, gravar) {
      var h = '<p class="an-nota">Compare as entregas parecidas e diga quais pertencem à mesma responsabilidade. Uma responsabilidade pode reunir várias entregas. <strong>Separar para avaliar não cria estrutura.</strong></p>';
      if (ativos.length) h += '<p class="an-det" id="anDelimitadas">Já delimitadas (' + ativos.length + '): ' + ativos.map(function (k) { return esc(a.recortes[k].nome); }).join('; ') + ' — avaliadas no Passo 3.</p>';
      if (!gravar) return h;
      var livres = Object.keys(a.entregas).filter(function (e) { var x = a.entregas[e]; return x.situacao === 'ativa' && !execOutra(x) && !recorteDaEntrega(a, ativos, e); });
      if (livres.length) h += '<form class="an-form" id="anFormRecorte"><h4>Delimitar uma responsabilidade</h4><fieldset class="an-opcoes"><legend>Entregas que ela reúne</legend>' + livres.map(function (e) { return '<label class="an-opcao"><input type="checkbox" name="anRecEntrega" value="' + esc(e) + '"><span>' + esc(a.entregas[e].descricao) + '</span>' + (descrita(a.entregas[e]) ? '' : ' <span class="an-chip an-chip--pend">descrição incompleta</span>') + '</label>'; }).join('') + '</fieldset>' +
        '<p class="an-nota">Duas entregas só ficam juntas depois de comparadas (pergunta "São a mesma responsabilidade?").</p>' +
        '<div class="avp-field"><label for="anRecNome">Nome da responsabilidade</label><input id="anRecNome" maxlength="200" placeholder="Ex.: avaliar a aderência dos processos de TI às diretrizes de governança"></div>' +
        '<div class="avp-field"><label for="anRecResultado">Resultado pelo qual ela responde</label><input id="anRecResultado" maxlength="2000" placeholder="Ex.: processos de TI aderentes, com desvios conhecidos e tratados"></div>' +
        '<div class="avp-field"><label for="anRecJust">Por que é distinta das outras</label><textarea id="anRecJust" rows="2" maxlength="2000"></textarea></div>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anDefinirRecorteBtn"' + (st.gravando ? ' disabled' : '') + '>Delimitar</button></div></form>';
      else if (Object.keys(a.entregas).some(function (e) { return a.entregas[e].situacao === 'ativa'; })) h += '<p class="an-nota" id="anSemLivres">Todas as entregas já estão em alguma responsabilidade (ou são execução para outra estrutura).</p>';
      return h;
    }
    /* N:N — responsabilidades já delimitadas em OUTRAS análises: referenciadas, nunca duplicadas nem com a origem trocada.
       Fica no Passo 2 mesmo antes de haver entregas: referenciar não depende delas */
    function renderReferencias(a, gravar) {
      var h = '', refs = Object.keys(a.referencias || {});
      if (refs.length) h += '<div class="an-referencias" id="anReferencias"><h4>Responsabilidades de outras análises referenciadas aqui</h4><ul>' + refs.map(function (o) {
        var ob = (D.objetos || {})[o], orig = (D.porObjeto || {})[o], an = orig ? (D.analises || {})[orig.analiseId] : null;
        return '<li data-referencia="' + esc(o) + '"><strong>' + esc(ob ? ob.nome : o) + '</strong> <span class="an-det">' + esc(textoPos(posicionamentoDa(o))) + (an ? ' · origem: análise "' + esc(an.nome) + '"' : '') + '</span></li>';
      }).join('') + '</ul></div>';
      if (!gravar) return h;
      var candidatas = Object.keys(D.porObjeto || {}).filter(function (o) { return D.porObjeto[o].analiseId !== a.id && !(a.referencias || {})[o] && (D.objetos || {})[o]; });
      if (candidatas.length) h += '<form class="an-form an-form--inline" id="anFormReferencia"><div class="avp-field"><label for="anReferenciaSel">Referenciar uma responsabilidade já delimitada em outra análise</label><select id="anReferenciaSel"><option value="">—</option>' +
        candidatas.map(function (o) { return '<option value="' + esc(o) + '">' + esc(D.objetos[o].nome) + '</option>'; }).join('') + '</select></div>' +
        '<p class="an-nota">Ela continua pertencendo à análise de origem; aqui só é citada (não é contada duas vezes).</p><div class="avp-actions-footer"><button type="submit" class="btn btn--sm" id="anReferenciarBtn">Referenciar</button></div></form>';
      return h;
    }
    /* Passo 3: cada responsabilidade delimitada vira uma atuação da Porta 2 e é avaliada pelo O1–O9 de sempre */
    function renderRecortes(a, ativos, sfs, gravar) {
      var h = '<div id="anRecortes"><p class="an-nota">Cada responsabilidade é avaliada pelo O1–O9 como uma atuação da Porta 2 — o mesmo questionário do Caminho A. Separar para avaliar não cria estrutura.</p>';
      ativos.forEach(function (k, i) {
        var r = a.recortes[k], sf = sfs[i], pr = N().prontaParaO1O9(a, k), s = sf.s ? SITUACAO_FORMAL[sf.s] : null;
        h += '<article class="an-recorte" data-recorte="' + esc(k) + '"><h4>' + esc(r.nome) + '</h4><p class="an-det">Resultado: ' + esc(r.resultado) + ' · Por que é distinta: ' + esc(r.justificativa) + '</p>' +
          '<p class="an-det">Entregas: ' + r.entregas.map(function (e) { return esc(nomeEntrega(a, e)); }).join('; ') + '</p>' + renderFatos(r) +
          '<p class="an-classificacao"><strong>O1–O9:</strong> <span id="anPos_' + esc(k) + '">' + esc(textoPos(sf.p)) + '</span>' +
          (s ? ' <span class="an-chip an-chip--' + s[1] + '" id="anSit_' + esc(k) + '">' + esc(s[0]) + '</span>' : sf.indisponivel ? ' <span class="an-chip an-chip--neu">Situação formal não calculada: cadastro de estruturas indisponível</span>' : sf.lendo ? ' <span class="an-chip an-chip--neu">Verificando o cadastro…</span>' : '') + '</p>';
        if (sf.p.estado === 'concluido' && sf.p.aValidar && sf.p.tipo && A_VALIDAR[sf.p.tipo]) h += renderAprofundar(r, k, sf.p, gravar);
        if (sf.s && sf.s !== 'compativel') h += '<details class="an-alternativas"><summary>Alternativas para esta situação</summary><ul>' + N().alternativasPara(sf.s).map(function (x) { return '<li><strong>' + esc(ALTERNATIVA[x.alternativa]) + ':</strong> ' + esc(x.consequencia) + '</li>'; }).join('') + '</ul></details>';
        h += '<div class="an-acoes">';
        if (r.objetoId) h += '<a class="btn btn--sm" href="#avaliacoes?po=atuacoes&item=' + encodeURIComponent(r.objetoId) + '" id="anAbrirPos_' + esc(k) + '">Abrir no Posicionamento</a>';
        if (gravar) {
          h += '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="fatos" data-recorte="' + esc(k) + '">Quem executa e quem responde</button>';
          if (!r.objetoId) h += pr.pronta ? '<button type="button" class="btn btn--sm btn--primary" data-an="abrir-form" data-form="atuacao" data-recorte="' + esc(k) + '" id="anCriarAtuacao_' + esc(k) + '">Avaliar com O1–O9</button>' : '<span class="an-nota" id="anNaoPronta_' + esc(k) + '" tabindex="-1">Para avaliar, falta: ' + esc(pr.faltas.map(function (f) { return { NOME: 'nome', RESULTADO: 'resultado' }[f] || ({ FORMA: 'forma', DESTINATARIO: 'destinatário', EVIDENCIA_OU_HIPOTESE: 'evidência ou hipótese' }[f.split(':')[0]] + ' de ' + nomeEntrega(a, f.split(':')[1])); }).join(', ')) + ' (Passo 1)</span>';
          if (!r.objetoId) h += '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="descartar-recorte" data-recorte="' + esc(k) + '">Descartar</button>';
        }
        h += '</div>' + renderFormRecorte(a, r, k) + '</article>';
      });
      return h + '</div>';
    }
    function renderAprofundar(r, k, p, gravar) {
      var t = A_VALIDAR[p.tipo], ev = Array.isArray(r.evidenciasQualitativas) ? r.evidenciasQualitativas : [];
      return '<div class="an-aprofundar" id="anAprofundar_' + esc(k) + '"><p><strong>Por que ficou "A validar":</strong> ' + esc(t[0]) + '</p><p>' + esc(t[1]) + '</p>' +
        (ev.length ? '<ul class="an-evidencias">' + ev.map(function (x) { return '<li>' + esc(x.texto) + (x.exemplo ? ' <span class="an-det">exemplo: ' + esc(x.exemplo) + '</span>' : '') + ' <span class="an-det">' + esc(fmtData(x.em)) + '</span></li>'; }).join('') + '</ul>' : '') +
        (gravar ? '<form class="an-form an-form--inline" data-form="evidencia" data-recorte="' + esc(k) + '"><div class="avp-field"><label for="anEv_' + esc(k) + '">Evidência qualitativa (em que situações cada papel aparece)</label><textarea id="anEv_' + esc(k) + '" rows="2" maxlength="2000"></textarea></div><div class="avp-field"><label for="anEvEx_' + esc(k) + '">Exemplo <span class="an-opc">(opcional)</span></label><input id="anEvEx_' + esc(k) + '" maxlength="2000"></div><div class="avp-actions-footer"><button type="submit" class="btn btn--sm">Registrar evidência</button></div></form>' : '') +
        '<p class="an-nota">A evidência não muda a recomendação automática; ela fundamenta a decisão humana, que é registrada no Posicionamento.</p></div>';
    }
    function renderFormRecorte(a, r, k) {
      if (!st.form || st.form.recorte !== k) return '';
      if (st.form.tipo === 'fatos') {
        return '<form class="an-form" data-form="fatos" data-recorte="' + esc(k) + '" id="anFormFatos"><h4>Quem executa e quem responde</h4>' +
          campoEstrutura('anExecEstr', 'Quem executa hoje', true) + seletor('anExecCarater', 'Caráter desta informação', CARATER) + '<div class="avp-field"><label for="anExecFonte">Fonte</label><input id="anExecFonte" maxlength="2000" placeholder="Ex.: regimento interno, entrevista com a coordenação"></div>' +
          seletor('anRespCerteza', 'Quem responde formalmente é', CERTEZA) + campoEstrutura('anRespEstr', 'Qual estrutura (se conhecida ou provável)', true) + seletor('anRespCarater', 'Caráter desta informação', CARATER) + '<div class="avp-field"><label for="anRespFonte">Fonte</label><input id="anRespFonte" maxlength="2000"></div>' +
          '<p class="an-nota">Informação descritiva, com data: não cria vínculo formal.</p><div class="avp-actions-footer"><button type="submit" class="btn btn--primary">Registrar</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      }
      if (st.form.tipo === 'atuacao') {
        var desc = r.resultado + ' — entregas: ' + r.entregas.map(function (e) { return nomeEntrega(a, e); }).join('; ');
        return '<form class="an-form" data-form="atuacao" data-recorte="' + esc(k) + '" id="anFormAtuacao"><h4>Criar a atuação para avaliar com O1–O9</h4><p class="an-nota">A responsabilidade vira uma atuação da Porta 2 (com origem nesta análise). Depois você responde o O1–O9 no fluxo de sempre, com a hipótese inicial.</p>' +
          '<div class="avp-field"><label for="anAtNome">Nome</label><input id="anAtNome" maxlength="200" value="' + esc(r.nome) + '"></div>' +
          '<div class="avp-field"><label for="anAtDesc">Descrição</label><textarea id="anAtDesc" rows="2" maxlength="2000">' + esc(desc.slice(0, 2000)) + '</textarea></div>' +
          '<div class="avp-field"><label for="anAtFin">Finalidade</label><textarea id="anAtFin" rows="2" maxlength="2000">' + esc(r.justificativa) + '</textarea></div>' +
          '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anConfirmarAtuacao">Criar e ir para o O1–O9</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      }
      if (st.form.tipo === 'descartar-recorte') return '<form class="an-form" data-form="descartar-recorte" data-recorte="' + esc(k) + '"><div class="avp-field"><label for="anMotivoRec">Motivo</label><input id="anMotivoRec" maxlength="500"></div><div class="avp-actions-footer"><button type="submit" class="btn btn--danger">Descartar a responsabilidade</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      return '';
    }
    function seletor(id, rotulo, mapa) { return '<div class="avp-field"><label for="' + id + '">' + esc(rotulo) + '</label><select id="' + id + '">' + Object.keys(mapa).map(function (k) { return '<option value="' + k + '">' + esc(mapa[k]) + '</option>'; }).join('') + '</select></div>'; }
    function renderComposicao(est, a, ativos, sfs, acc) { /* Passo 4 */
      var props = Object.keys(est.propostas).map(function (k) { return est.propostas[k]; }).filter(function (p) { return p.analiseId === a.id; }).sort(function (x, y) { return y.versao - x.versao; });
      var vig = props[0] || null, gravar = acc.gravar && a.situacao === 'aberta';
      var h = '<div id="anComposicao">' +
        '<p class="an-nota">A proposta diz como as responsabilidades devem ficar organizadas. Ela <strong>nunca</strong> cadastra nem muda estrutura, vínculo ou Mapa, e nenhuma alternativa troca a classificação.</p>';
      if (vig) {
        var ap = est.aprovacoes[vig.id];
        h += '<div class="an-proposta" id="anPropostaVigente"><p><strong>Proposta vigente (v' + vig.versao + '):</strong> ' + esc(ALTERNATIVA[vig.alternativa] || vig.alternativa) + ' <span class="an-chip an-chip--' + (vig.situacao === 'pendente' ? 'pend' : 'neu') + '">' + (vig.situacao === 'pendente' ? 'pendente' : 'proposta') + '</span></p>' +
          '<p class="an-det">' + esc(vig.justificativa) + ' · registrada por ' + esc((vig.registradaPor || {}).email || '') + ' em ' + esc(fmtData(vig.registradaEm)) + '</p>' +
          (vig.pendencia ? '<p class="an-det">Falta: ' + esc(vig.pendencia.falta) + ' · Próxima ação: ' + esc(vig.pendencia.proximaAcao) + ' · Quem decide: ' + esc(vig.pendencia.quemDecide) + '</p>' : '') +
          (ap ? '<p class="an-aprovacao" id="anAprovacao"><strong>Aprovação registrada — referência a ato externo:</strong> ' + esc(ap.autoridade) + ', ' + esc(ap.referencia) + ', ' + esc(fmtData(ap.dataDoAto)) + '. Objeto aprovado: ' + esc(ap.objetoAprovado) + '. <span class="an-det">Registrado por ' + esc((ap.registradoPor || {}).email || '') + ' em ' + esc(fmtData(ap.registradoEm)) + ' (o registro não é a aprovação).</span></p>'
            : vig.situacao === 'proposta' ? '<p class="an-det" id="anSemAprovacao">Sem aprovação registrada. A aprovação do desenho é de uma instância institucional; o admin geral registra a referência ao ato.</p>' : '') + '</div>';
        if (props.length > 1) h += '<details class="an-historico-prop"><summary>Propostas anteriores (' + (props.length - 1) + ')</summary><ul>' + props.slice(1).map(function (p) { return '<li>v' + p.versao + ': ' + esc(ALTERNATIVA[p.alternativa] || p.alternativa) + ' — ' + esc(p.justificativa) + '</li>'; }).join('') + '</ul></details>';
        if (acc.registrarAprovacao && a.situacao === 'aberta' && vig.situacao === 'proposta' && !ap) {
          h += st.form && st.form.tipo === 'aprovacao' ? '<form class="an-form" id="anFormAprovacao" data-versao="' + vig.versao + '"><h4>Registrar a referência ao ato de aprovação</h4><p class="an-nota">Isto registra um ato externo de aprovação. Registrar não significa que você aprovou.</p>' +
            '<div class="avp-field"><label for="anApAutoridade">Autoridade que aprovou</label><input id="anApAutoridade" maxlength="200" placeholder="Ex.: Diretoria Executiva"></div>' +
            '<div class="avp-field"><label for="anApReferencia">Referência do ato</label><input id="anApReferencia" maxlength="2000" placeholder="Ex.: Ata 12/2026, item 3"></div>' +
            '<div class="avp-field"><label for="anApData">Data do ato</label><input id="anApData" type="date"></div>' +
            '<div class="avp-field"><label for="anApObjeto">O que foi aprovado</label><input id="anApObjeto" maxlength="2000" value="Proposta v' + vig.versao + ' da análise ' + esc(a.nome) + '"></div>' +
            '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anRegistrarAprovacao">Registrar a referência</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>'
            : '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="aprovacao" id="anAbrirAprovacao">Registrar aprovação (referência ao ato)</button>';
        }
      } else h += '<p class="admin-empty" id="anSemProposta">Nenhuma proposta registrada.</p>';
      if (gravar && ativos.length) {
        if (st.form && st.form.tipo === 'proposta') {
          var sits = {}; sfs.forEach(function (x) { if (x.s) sits[x.s] = true; });
          var cons = {}; Object.keys(sits).forEach(function (s) { N().alternativasPara(s).forEach(function (x) { (cons[x.alternativa] = cons[x.alternativa] || []).push(x.consequencia); }); });
          h += '<form class="an-form" id="anFormProposta"><h4>Registrar uma proposta</h4><fieldset class="an-opcoes"><legend>Alternativa</legend>' + N().ALTERNATIVAS.map(function (k) {
            return '<label class="an-opcao"><input type="radio" name="anAlternativa" value="' + k + '"><span><strong>' + esc(ALTERNATIVA[k]) + '</strong>' + (cons[k] ? '<span class="an-exemplo">' + esc(cons[k].filter(function (v, i, l) { return l.indexOf(v) === i; }).join(' ')) + '</span>' : '') + '</span></label>'; }).join('') + '</fieldset>' +
            '<fieldset class="an-opcoes"><legend>Responsabilidades consideradas</legend>' + ativos.map(function (k) { return '<label class="an-opcao"><input type="checkbox" name="anPropRecorte" value="' + esc(k) + '" checked><span>' + esc(a.recortes[k].nome) + '</span></label>'; }).join('') + '</fieldset>' +
            '<div class="avp-field"><label for="anPropJust">Justificativa (critérios: resultado, integração, especialização, segregação, riscos, sustentação, estruturas existentes)</label><textarea id="anPropJust" rows="3" maxlength="2000"></textarea></div>' +
            '<div class="avp-field"><label for="anPendFalta">Se pendente — o que falta</label><input id="anPendFalta" maxlength="2000"></div><div class="avp-field"><label for="anPendAcao">Próxima ação</label><input id="anPendAcao" maxlength="2000"></div><div class="avp-field"><label for="anPendQuem">Quem decide</label><input id="anPendQuem" maxlength="200"></div>' +
            '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anRegistrarProposta">Registrar a proposta</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
        } else h += '<button type="button" class="btn btn--sm btn--primary" data-an="abrir-form" data-form="proposta" id="anAbrirProposta">' + (vig ? 'Registrar nova proposta' : 'Registrar uma proposta') + '</button>';
      }
      return h + '</div>';
    }
    function renderHistorico(a) {
      var ev = st.historico && st.historico.id === a.id ? st.historico.eventos : null;
      return '<details class="avp-form-card an-secao" id="anHistorico"' + (st.abertos.historico ? ' open' : '') + '><summary>Histórico</summary>' +
        (ev === null ? '<p class="loading-msg">Carregando…</p>' : ev === false ? '<p class="avp-error-msg">Histórico indisponível agora.</p>' :
          '<ol class="an-eventos">' + ev.map(function (e) { return '<li><strong>' + esc(TIPO_EVENTO[e.tipo] || e.tipo) + '</strong> <span class="an-det">' + esc(fmtData(e.em)) + ' · ' + esc((e.por || {}).email || '') + '</span></li>'; }).join('') + '</ol>') + '</details>';
    }
    var TIPO_EVENTO = { 'analise.criada': 'Análise aberta', 'resposta.registrada': 'Resposta registrada', 'entrega.adicionada': 'Entrega adicionada', 'entrega.editada': 'Entrega alterada', 'entrega.descartada': 'Entrega excluída', 'comparacao.registrada': 'Comparação registrada', 'recorte.definido': 'Responsabilidade delimitada', 'recorte.ajustado': 'Delimitação revista', 'recorte.descartado': 'Responsabilidade descartada', 'fatos.registrados': 'Quem executa / responde informado', 'recorte.atuacao-associada': 'Atuação criada para o O1–O9', 'responsabilidade.referenciada': 'Responsabilidade referenciada', 'evidencia.registrada': 'Evidência qualitativa registrada', 'proposta.registrada': 'Proposta registrada', 'aprovacao.registrada': 'Referência à aprovação registrada', 'analise.descartada': 'Análise descartada' };
    function carregarHistorico() {
      var id = st.id; st.historico = { id: id, eventos: null };
      S().lerUmaVez(F().NOS.auditoria + '/' + id, 12000).then(function (v) {
        if (st.id !== id) return;
        st.historico = { id: id, eventos: Object.keys(v || {}).map(function (k) { return v[k]; }).sort(function (x, y) { return (x.em || 0) - (y.em || 0); }) }; render();
      }, function () { if (st.id === id) { st.historico = { id: id, eventos: false }; render(); } });
    }

    /* ---------- ações ---------- */
    function terminar(r, flash, depois) {
      st.gravando = false; st.flashEntrega = null;
      if (r.erro) { st.erro = r.erro; st.flash = null; render(); return; }
      st.erro = null; st.flash = flash || null; st.form = null;
      if (depois) depois(r); else render();
    }
    function executar(fn, flash, depois, extra) { if (st.gravando) return; st.gravando = true; st.erro = null; render(); gravarOperacao(fn, function (r) { terminar(r, flash, depois); }, extra); }
    function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function marcado(nome) { var e = wrap.querySelector('input[name="' + nome + '"]:checked'); return e ? e.value : null; }
    function marcados(nome) { return Array.prototype.map.call(wrap.querySelectorAll('input[name="' + nome + '"]:checked'), function (e) { return e.value; }); }
    function slug(t, i) { return (t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'capacidade') + '-' + i; }
    wrap.addEventListener('submit', function (ev) {
      var form = ev.target; ev.preventDefault();
      var id = st.id;
      if (form.id === 'anFormNova') {
        var caps = val('anCapacidades').split(';').map(function (x) { return x.trim(); }).filter(Boolean).map(function (r, i) { return { tipo: 'texto', chave: slug(r, i + 1), rotulo: r }; });
        var amplo = marcado('anTemAtuacao') === 'sim' ? val('anObjetoAmplo') : '';
        st.form = { tipo: 'nova', tipoEscopo: marcado('anEscopo'), nome: val('anNome'), descricao: val('anDescricao'), capacidades: val('anCapacidades'), objetoAmploId: amplo };
        if (marcado('anTemAtuacao') === 'sim' && !amplo) { st.erro = 'Escolha a atuação que esta análise aprofunda (ou responda "Não").'; render(); return; }
        var dados = { nome: val('anNome'), tipoEscopo: marcado('anEscopo'), descricao: val('anDescricao') || undefined, capacidades: caps, objetoAmploId: amplo || undefined };
        executar(function (est, c) { return N().criarAnalise(est, dados, c); }, 'Análise aberta.', function (r) { st.form = null; ir(r.novoId); });
      } else if (form.id === 'anFormResponder') {
        var q = form.getAttribute('data-q'), ent = form.getAttribute('data-entrega') || undefined, v = marcado('anResposta');
        var valor = v;
        if (q === 'F6') { var oe = val('anOutraEstrutura'), ot = val('anOutraEstruturaTexto'); valor = { valor: v, certeza: val('anCerteza') }; if (oe) valor.estruturaId = oe; else if (ot) valor.texto = ot; }
        else if (q === 'F8' || q === 'F11') { valor = { valor: v }; if (val('anTextoResp')) valor.texto = val('anTextoResp'); }
        else if (q === 'F2b') { valor = { valor: v }; var ec = val('anEstruturaCadastrada'); if (v === 'cadastrada' && ec) valor.estruturaId = ec; }
        executar(function (est, c) { return N().responder(est, id, { pergunta: q, entregaId: ent, valor: valor }, c); }, form.getAttribute('data-alterando') ? 'Resposta alterada (a anterior fica no histórico).' : 'Resposta registrada.');
      } else if (form.id === 'anFormComparar') {
        var crit = {}; Object.keys(CRITERIO).forEach(function (k) { crit[k] = marcado('anCrit_' + k); });
        var dc = { a: form.getAttribute('data-a'), b: form.getAttribute('data-b'), criterios: crit, conclusao: marcado('anConclusao') };
        if (val('anJustComp')) dc.justificativa = val('anJustComp');
        executar(function (est, c) { return N().compararEntregas(est, id, dc, c); }, 'Comparação registrada. Nada foi juntado automaticamente.');
      } else if (form.id === 'anFormReferencia') {
        var oref = val('anReferenciaSel');
        executar(function (est, c) { return N().referenciarResponsabilidade(est, id, oref, c); }, 'Responsabilidade referenciada (a origem dela não muda).');
      } else if (form.id === 'anFormEntrega') {
        var de = { descricao: val('anEntregaDesc') }; if (val('anEntregaEx')) de.exemplo = val('anEntregaEx');
        executar(function (est, c) { return N().adicionarEntrega(est, id, de, c); }, null, function () {
          st.flashEntrega = { descricao: de.descricao.trim() };
          render(); var c = document.getElementById('anEntregaDesc'); if (c) c.focus({ preventScroll: true });
        });
      } else if (form.id === 'anFormEditarEntrega') {
        var ke = form.getAttribute('data-entrega'), dee = { descricao: val('anEditDesc'), exemplo: val('anEditEx') || null };
        executar(function (est, c) { return N().editarEntrega(est, id, ke, dee, c); }, 'Entrega alterada (o texto anterior fica no histórico).');
      } else if (form.id === 'anFormDescartarEntrega') {
        var kd = form.getAttribute('data-entrega'), mde = val('anMotivoEntrega');
        executar(function (est, c) { return N().descartarEntrega(est, id, kd, mde ? { motivo: mde } : {}, c); }, 'Entrega excluída da análise (fica no histórico).');
      } else if (form.id === 'anFormRecorte') {
        var dr = { nome: val('anRecNome'), resultado: val('anRecResultado'), justificativa: val('anRecJust'), entregas: marcados('anRecEntrega') };
        executar(function (est, c) { return N().definirRecorte(est, id, dr, c); }, 'Responsabilidade delimitada. Separar para avaliar não cria estrutura.');
      } else if (form.getAttribute('data-form') === 'fatos') {
        var rk = form.getAttribute('data-recorte'), ee = val('anExecEstr'), et = val('anExecEstrTexto'), exec = [];
        if (ee || et) { var fx = { carater: val('anExecCarater'), fonte: val('anExecFonte') }; if (ee) fx.estruturaId = ee; else fx.texto = et; exec.push(fx); }
        var rf = { certeza: val('anRespCerteza'), carater: val('anRespCarater'), fonte: val('anRespFonte') };
        if (rf.certeza !== 'nao-definido') { if (val('anRespEstr')) rf.estruturaId = val('anRespEstr'); else if (val('anRespEstrTexto')) rf.texto = val('anRespEstrTexto'); }
        executar(function (est, c) { return N().registrarFatos(est, id, rk, { execucao: exec, responsavelFormal: rf }, c); }, 'Informação registrada (descritiva, não é vínculo).');
      } else if (form.getAttribute('data-form') === 'atuacao') {
        var rk2 = form.getAttribute('data-recorte'), dados2 = { nome: val('anAtNome'), descricao: val('anAtDesc'), finalidade: val('anAtFin'), contexto: 'Delimitada na análise organizacional "' + (estado().analises[id] || {}).nome + '".' };
        var objetoId = S().novaChave('objetos-organizacionais');
        executar(function (est, c) { return N().associarAtuacao(est, id, rk2, objetoId, c); }, 'Atuação criada. Responda o O1–O9.', function () { location.hash = '#avaliacoes?po=atuacoes&item=' + encodeURIComponent(objetoId); },
          function (r, c, ident) {
            var O = window.faObjetosOrganizacionaisNucleo;
            var objetoPayload = O.payloadCriacao({ id: objetoId, audId: S().novaChave('objetos-organizacionais-auditoria/' + objetoId), dados: dados2, usuario: { uid: ident.uid, email: ident.email, name: (sessao() || {}).name }, agora: S().agoraServidor() });
            return F().payloadCriarAtuacao({ objetoPayload: objetoPayload, associacao: r, analiseId: id, recorteId: rk2, objetoId: objetoId, audId: S().novaChave(F().NOS.auditoria), usuario: ident, agora: S().agoraServidor() });
          });
      } else if (form.getAttribute('data-form') === 'evidencia') {
        var rk3 = form.getAttribute('data-recorte'), dv = { texto: val('anEv_' + rk3) }; if (val('anEvEx_' + rk3)) dv.exemplo = val('anEvEx_' + rk3);
        executar(function (est, c) { return N().registrarEvidenciaQualitativa(est, id, rk3, dv, c); }, 'Evidência registrada. A recomendação automática não muda.');
      } else if (form.getAttribute('data-form') === 'descartar-recorte') {
        var rk4 = form.getAttribute('data-recorte'), mot = val('anMotivoRec');
        executar(function (est, c) { return N().descartarRecorte(est, id, rk4, { motivo: mot }, c); }, 'Responsabilidade descartada (fica no histórico).');
      } else if (form.id === 'anFormProposta') {
        var alt = marcado('anAlternativa'), dp = { alternativa: alt, recortes: marcados('anPropRecorte'), justificativa: val('anPropJust') };
        if (alt === 'pendente') dp.pendencia = { falta: val('anPendFalta'), proximaAcao: val('anPendAcao'), quemDecide: val('anPendQuem') };
        executar(function (est, c) { return N().registrarProposta(est, id, dp, c); }, 'Proposta registrada. Nada foi cadastrado nem alterado no Mapa.');
      } else if (form.id === 'anFormAprovacao') {
        var versao = Number(form.getAttribute('data-versao')), data = val('anApData'), ms = data ? Date.parse(data + 'T12:00:00Z') : NaN;
        var da = { autoridade: val('anApAutoridade'), referencia: val('anApReferencia'), dataDoAto: isNaN(ms) ? null : ms, objetoAprovado: val('anApObjeto') };
        executar(function (est, c) { return N().registrarAprovacao(est, id, versao, da, c); }, 'Referência ao ato de aprovação registrada.');
      } else if (form.id === 'anFormDescartar') {
        var md = val('anMotivoDescarte');
        executar(function (est, c) { return N().descartarAnalise(est, id, { motivo: md }, c); }, 'Análise descartada. Nada foi apagado.');
      }
    });
    wrap.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-an]'); if (!b || !wrap.contains(b)) return;
      var acao = b.getAttribute('data-an');
      if (acao === 'abrir-form') {
        st.form = { tipo: b.getAttribute('data-form'), recorte: b.getAttribute('data-recorte') || null, entrega: b.getAttribute('data-entrega') || null, q: b.getAttribute('data-q') || null }; st.erro = null; st.flashEntrega = null; render();
        var f = st.form.tipo === 'alterar-objeto' ? wrap.querySelector('#anFormResponder input:checked, #anFormResponder input') : wrap.querySelector('form.an-form input, form.an-form textarea, form.an-form select'); if (f) f.focus();
      }
      else if (acao === 'ir-para') {
        var alvo = document.getElementById(b.getAttribute('data-alvo')); if (!alvo) return;
        alvo.scrollIntoView({ block: 'center' });
        var foco = /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(alvo.tagName) ? alvo : alvo.querySelector('input:not([disabled]), textarea, select:not([disabled]), button');
        if (!foco) { alvo.setAttribute('tabindex', '-1'); foco = alvo; }
        foco.focus({ preventScroll: true });
      }
      else if (acao === 'cancelar') { st.form = null; st.erro = null; render(); }
      else if (acao === 'responder') { var q = b.getAttribute('data-q'), v = b.getAttribute('data-v'), id = st.id; executar(function (est, c) { return N().responder(est, id, { pergunta: q, valor: v }, c); }, 'Resposta registrada.'); }
      else if (acao === 'exportar') exportar();
    });
    /* campos dependentes: só ficam habilitados (e obrigatórios) com a resposta que os pede; trocar a resposta limpa o campo */
    wrap.addEventListener('change', function (ev) {
      var t = ev.target, dep = null, liga = false, dica = null;
      if (t.name === 'anResposta' && t.closest('#anFormResponder[data-q="F2b"]')) { dep = document.getElementById('anEstruturaCadastrada'); dica = document.getElementById('anEstruturaCadastradaDica'); liga = t.value === 'cadastrada'; }
      else if (t.name === 'anTemAtuacao') { dep = document.getElementById('anObjetoAmplo'); dica = document.getElementById('anObjetoAmploDica'); liga = t.value === 'sim'; }
      if (!dep) return;
      dep.disabled = !liga; dep.required = liga; if (!liga) dep.value = '';
      if (dica) dica.textContent = liga ? '(obrigatória)' : (t.name === 'anTemAtuacao' ? '(só para "Sim")' : '(só para "Está cadastrada")');
    });
    wrap.addEventListener('toggle', function (ev) { if (ev.target && ev.target.id === 'anConceitos') st.abertos.conceitos = ev.target.open; }, true);
    wrap.addEventListener('toggle', function (ev) { if (ev.target && ev.target.id === 'anHistorico') { st.abertos.historico = ev.target.open; if (ev.target.open && (!st.historico || st.historico.id !== st.id)) carregarHistorico(); } }, true);

    /* ---------- exportação (fotografia do que está gravado) ---------- */
    function carregarScript(src, pronto, cb) {
      if (pronto()) { cb(); return; }
      var s = document.createElement('script'); s.src = src; s.onload = function () { cb(); }; s.onerror = function () { cb(new Error('falha')); }; document.head.appendChild(s);
    }
    function exportar() {
      var est = estado(), a = est.analises[st.id]; if (!a) return;
      carregarScript('forca-agil/xlsx.mini.min.js', function () { return !!window.XLSX; }, function (erro) {
        if (erro) { st.erro = 'Não foi possível carregar o gerador de Excel.'; render(); return; }
        var X = window.XLSX, wb = X.utils.book_new();
        var add = function (nome, linhas) { X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(linhas), nome); };
        var vig = N().propostaVigente(est, a.id);
        add('Resumo', [['Análise', a.nome], ['Escopo', ESCOPO[a.tipoEscopo] ? ESCOPO[a.tipoEscopo][0] : a.tipoEscopo], ['Situação', situacaoTexto(N().situacaoDaAnalise(est, a.id, { posicionamentos: infoPos() }))],
          ['Capacidades (referência)', a.capacidades.map(function (c) { return c.rotulo; }).join('; ')], ['Proposta vigente', vig ? 'v' + vig.versao + ' — ' + (ALTERNATIVA[vig.alternativa] || vig.alternativa) + ' (' + vig.situacao + ')' : '—'],
          ['Observação', 'Separar para avaliar não cria estrutura. A proposta não cadastra nem muda estrutura, vínculo ou Mapa.']]);
        add('Entregas', [['Entrega', 'Forma', 'Destinatário', 'Quem responde', 'Evidência', 'Execução para outra']].concat(Object.keys(a.entregas).map(function (k) { var e = a.entregas[k], r = e.respostas; return [e.descricao, resumoResposta(r.F4, 'F4'), resumoResposta(r.F5, 'F5'), resumoResposta(r.F6, 'F6'), resumoResposta(r.F8, 'F8'), r.F7 && r.F7.valor === 'sim' ? 'sim' : 'não']; })));
        add('Comparacoes', [['Entrega A', 'Entrega B'].concat(Object.keys(CRITERIO).map(function (k) { return CRITERIO[k][0]; })).concat(['Conclusão', 'Indícios', 'Justificativa'])].concat(Object.keys(a.comparacoes).map(function (k) { var c = a.comparacoes[k]; return [nomeEntrega(a, c.a), nomeEntrega(a, c.b)].concat(Object.keys(CRITERIO).map(function (x) { return c.criterios[x]; })).concat([CONCLUSAO[c.conclusao], INDICACAO[c.indicacao] || c.indicacao, c.justificativa || '']); })));
        add('Responsabilidades', [['Responsabilidade', 'Resultado', 'Justificativa do recorte', 'Entregas', 'Quem executa', 'Quem responde formalmente', 'O1–O9', 'Situação formal', 'Evidências qualitativas', 'Situação']].concat(Object.keys(a.recortes).map(function (k) {
          var r = a.recortes[k], sf = situacaoFormalDe(r), f = r.fatos;
          var fx = function (x) { return (x.estruturaId ? nomeEstrutura(x.estruturaId) : x.texto || '') + ' [' + (CARATER[x.carater] || x.carater) + '; ' + x.fonte + '; ' + fmtData(x.informadoEm) + ']'; };
          return [r.nome, r.resultado, r.justificativa, r.entregas.map(function (e) { return nomeEntrega(a, e); }).join('; '), f ? f.execucao.map(fx).join('; ') : '', f ? (CERTEZA[f.responsavelFormal.certeza] + (f.responsavelFormal.certeza !== 'nao-definido' ? ' — ' + fx(f.responsavelFormal) : '')) : '',
            textoPos(sf.p), sf.s ? SITUACAO_FORMAL[sf.s][0] : 'não calculada', (r.evidenciasQualitativas || []).map(function (x) { return x.texto; }).join(' | '), r.situacao];
        })));
        add('Propostas', [['Versão', 'Alternativa', 'Situação', 'Justificativa', 'Pendência', 'Aprovação (referência a ato externo)']].concat(Object.keys(est.propostas).map(function (k) { return est.propostas[k]; }).filter(function (p) { return p.analiseId === a.id; }).sort(function (x, y) { return x.versao - y.versao; }).map(function (p) {
          var ap = est.aprovacoes[p.id];
          return ['v' + p.versao, ALTERNATIVA[p.alternativa] || p.alternativa, p.situacao, p.justificativa, p.pendencia ? p.pendencia.falta + ' / ' + p.pendencia.proximaAcao + ' / ' + p.pendencia.quemDecide : '', ap ? ap.autoridade + ' — ' + ap.referencia + ' — ' + fmtData(ap.dataDoAto) + ' (registrado por ' + ((ap.registradoPor || {}).email || '') + ')' : ''];
        })));
        X.writeFile(wb, 'analise-organizacional-' + slug(a.nome, 1) + '.xlsx');
      });
    }

    aoMudarFns.push(function () { if (!wrap.hidden) render(); });
    window.addEventListener('hashchange', function () { if (doEndereco()) aplicar(); else fechar(); });
    var api = { aplicarEndereco: aplicar, fechar: fechar, aberto: function () { return !wrap.hidden; } };
    if (doEndereco()) aplicar();
    return api;
  }

  /* ===================== integrações (só quando o marcador libera a leitura) ===================== */
  function pronto() { return acesso().ler && dadosProntos(); }
  /* lista de atuações da Porta 2: os dois caminhos de início, que convergem para o O1–O9. Vazio com o marcador
     desligado — aí a Porta 2 continua exatamente como antes. botaoDireto: o botão de sempre de "nova atuação" */
  function entradaAtuacoesHtml(botaoDireto) {
    ligarConfig();
    var a = acesso(); if (!a.ler) return '';
    return '<section class="an-entrada" id="anEntradaAtuacoes" aria-labelledby="anEntradaTitulo"><h4 id="anEntradaTitulo">Dois jeitos de começar — os dois terminam na mesma avaliação O1–O9</h4><div class="an-caminhos">' +
      '<div class="an-caminho" id="anCaminhoDireto"><p class="an-caminho-rotulo">Caminho A · Direto</p><p><strong>Já sei qual responsabilidade quero avaliar.</strong></p>' +
      '<p class="an-nota">Cadastre a atuação (ou abra uma da lista abaixo) e responda o O1–O9.</p>' + (botaoDireto || '') + '</div>' +
      '<div class="an-caminho" id="anCaminhoAssistido"><p class="an-caminho-rotulo">Caminho B · Assistido</p><p><strong>Quero investigar uma estrutura, uma área ou um conjunto de atividades para descobrir quais responsabilidades existem ali.</strong></p>' +
      '<p class="an-nota">A Análise Organizacional ajuda a descobrir as entregas e delimitar as responsabilidades; cada uma vira uma atuação avaliada pelo mesmo O1–O9. Ela não classifica nada.</p>' +
      '<div class="an-acoes">' + (a.gravar ? '<a class="btn btn--sm btn--primary" id="anEntradaNova" href="#avaliacoes?an=nova">Abrir uma análise</a>' : '') + '<a class="btn btn--sm" id="anEntradaLista" href="#avaliacoes?an=lista">Análises organizacionais</a></div></div></div>' +
      '<p class="an-nota" id="anEntradaNotas">A Porta 1 (Produto/Serviço, P1–P16) é opcional e independente. A Adequação à Squad vem depois, só quando o resultado for Linha. O Mapa da Floresta mostra o que foi registrado — não é uma entrada de avaliação.</p></section>';
  }
  /* Início de Avaliações, no cartão da Porta 2: o atalho para o Caminho B (só quando o marcador libera a leitura) */
  function caminhoAssistidoInicioHtml() {
    ligarConfig();
    var a = acesso(); if (!a.ler) return '';
    return '<p class="avp-inicio-exemplo" id="avpInicioCaminhoB">Ainda não sabe qual responsabilidade avaliar? <a href="#avaliacoes?an=' + (a.gravar ? 'nova' : 'lista') + '" id="avpInicioAnalise">' + (a.gravar ? 'Comece por uma Análise Organizacional' : 'Veja as análises organizacionais') + '</a> (Caminho B, assistido).</p>';
  }
  /* ficha do Posicionamento de uma atuação nascida de uma análise */
  function origemDe(objetoId) {
    if (!pronto()) return null;
    var o = (D.porObjeto || {})[objetoId]; if (!o) return null;
    var a = (D.analises || {})[o.analiseId]; return a ? { analiseId: o.analiseId, nome: a.nome } : null;
  }
  function origemHtml(objetoId) { var o = origemDe(objetoId); return o ? '<p class="an-origem" id="anOrigem">Responsabilidade delimitada na análise <a href="#avaliacoes?an=' + encodeURIComponent(o.analiseId) + '" id="anVoltarAnalise">' + esc(o.nome) + '</a>.</p>' : ''; }
  /* Jornada: a atuação ampla delimitada vira agrupador (D6) */
  function delimitacaoDe(objetoId) { if (!pronto()) return null; var r = N().objetoAmploDelimitado(estado(), objetoId); return r.delimitado ? r : null; }
  /* ficha da estrutura (N4): o que ela exerce segundo as análises — fonte, caráter e data; nunca vínculo */
  function exercidasHtml(estruturaId) {
    if (!pronto()) return '';
    var l = N().exercidasPelaEstrutura(estado(), estruturaId);
    if (!l.length) return '';
    return '<section class="est-secao an-exercidas" id="anExercidas"><h5 class="est-secao-titulo">Exerce, segundo as análises organizacionais</h5><ul>' + l.map(function (x) {
      return '<li><a href="#avaliacoes?an=' + encodeURIComponent(x.analiseId) + '">' + esc(x.responsabilidade) + '</a> <span class="an-chip an-chip--' + (x.carater === 'hipotese' ? 'pend' : 'neu') + '">' + esc(CARATER[x.carater] || x.carater) + '</span> <span class="an-det">análise "' + esc(x.analiseNome) + '" · fonte: ' + esc(x.fonte) + ' · ' + esc(fmtData(x.informadoEm)) + '</span></li>';
    }).join('') + '</ul><p class="an-nota">Informação descritiva das análises: não é vínculo formal e não muda o Mapa.</p></section>';
  }
  /* ADMIN › Avaliação e Mapa (só admin geral): o marcador de homologação, com motivo e histórico */
  function montarHabilitacao(el) {
    if (!el) return;
    ligarConfig();
    var formAberto = false, gravando = false, erro = null, ok = null;
    function desenhar() {
      var p = perfil();
      if (!p.adminGeral) { el.innerHTML = ''; return; }
      var atual = D.hab === undefined ? null : D.hab, reg = D.habRegistro;
      el.innerHTML = '<div class="an-habilitacao" id="anHabilitacao"><p><strong>Habilitação:</strong> <span id="anHabAtual">' + (atual ? esc(HAB[atual] || atual) : 'Carregando…') + '</span>' +
        (reg ? ' <span class="an-det">(' + esc(fmtData(reg.alteradoEm)) + ' · ' + esc((reg.alteradoPor || {}).email || '') + ' · ' + esc(reg.motivo) + ')</span>' : '') + '</p>' +
        '<p class="an-nota">Desligado: nada da Análise Organizacional aparece e a Porta 2 continua igual. Somente admin geral: para homologar. Liberado: os perfis autorizados leem; Avaliação + Configuração e admin geral gravam. O banco aplica a mesma regra; desligar não apaga nada.</p>' +
        (ok ? '<p class="avp-flash-success" role="status">' + esc(ok) + '</p>' : '') + (erro ? '<p class="avp-error-msg" role="alert">' + esc(erro) + '</p>' : '') +
        (formAberto ? '<form class="an-form" id="anFormHabilitacao"><fieldset class="an-opcoes"><legend>Novo estado</legend>' + Object.keys(HAB).map(function (k) { return '<label class="an-opcao"><input type="radio" name="anHab" value="' + k + '"' + (k === atual ? ' checked' : '') + '><span>' + esc(HAB[k]) + '</span></label>'; }).join('') + '</fieldset>' +
          '<div class="avp-field"><label for="anHabMotivo">Motivo</label><input id="anHabMotivo" maxlength="500"></div><div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anHabSalvar"' + (gravando ? ' disabled' : '') + '>Salvar</button><button type="button" class="btn btn--sm" id="anHabCancelar">Cancelar</button></div></form>'
          : '<button type="button" class="btn btn--sm" id="anHabAlterar">Alterar habilitação</button>') + '</div>';
    }
    el.addEventListener('click', function (ev) {
      if (ev.target.id === 'anHabAlterar') { formAberto = true; ok = null; erro = null; desenhar(); }
      else if (ev.target.id === 'anHabCancelar') { formAberto = false; erro = null; desenhar(); }
    });
    el.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nova = (el.querySelector('input[name="anHab"]:checked') || {}).value, motivo = (document.getElementById('anHabMotivo') || {}).value || '';
      var ident = S().identidade();
      if (!nova || !motivo.trim() || !ident) { erro = 'Escolha o novo estado e escreva o motivo.'; desenhar(); return; }
      var payload;
      try { payload = F().payloadHabilitacao({ anterior: D.hab, nova: nova, motivo: motivo, audId: S().novaChave(F().NOS.configAuditoria), usuario: ident, agora: S().agoraServidor() }); }
      catch (e) { erro = e.message; desenhar(); return; }
      gravando = true; desenhar();
      S().gravar(payload, PRAZO, function (err) {
        gravando = false;
        if (err) { erro = err === 'sem-resposta' ? 'O servidor não respondeu a tempo; confira antes de repetir.' : 'O banco recusou a alteração.'; desenhar(); return; }
        formAberto = false; erro = null; ok = 'Habilitação alterada para: ' + (HAB[nova] || nova) + '.'; desenhar();
      });
    });
    aoMudarFns.push(function () { if (document.body.contains(el) && !formAberto) desenhar(); });
    desenhar();
  }

  window.faInitAnalisesOrganizacionais = function () {
    if (window.faAnalisesOrganizacionais && window.faAnalisesOrganizacionais.aplicarEndereco) return;
    var api = montar();
    if (api) Object.keys(api).forEach(function (k) { window.faAnalisesOrganizacionais[k] = api[k]; });
  };
  window.faAnalisesOrganizacionais = { entradaAtuacoesHtml: entradaAtuacoesHtml, caminhoAssistidoInicioHtml: caminhoAssistidoInicioHtml, origemHtml: origemHtml, origemDe: origemDe, delimitacaoDe: delimitacaoDe,
    exercidasHtml: exercidasHtml, montarHabilitacao: montarHabilitacao, acesso: acesso, aoMudar: function (f) { aoMudarFns.push(f); }, ligar: function () { ligarConfig(); ligarDados(); } };
  if (/^#avaliacoes\?(.*&)?an=/.test(location.hash || '')) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.faInitAnalisesOrganizacionais); else window.faInitAnalisesOrganizacionais(); }
})();
