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
  var ETAPAS = ['Objeto', 'Descoberta', 'Delimitação', 'Avaliação O1–O9', 'Aprofundamento', 'Composição', 'Decisão'];
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
    EVIDENCIA_SEM_DESCRICAO: 'Descreva a evidência ou registre como hipótese.', NORMA_NAO_CITADA: 'Cite a norma.', ESTRUTURA_NAO_INFORMADA: 'Escolha a estrutura cadastrada.',
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
        (atuacoes.length ? '<div class="avp-field"><label for="anObjetoAmplo">Esta análise detalha uma atuação já cadastrada? <span class="an-opc">(opcional)</span></label><select id="anObjetoAmplo"><option value="">Não</option>' +
          atuacoes.map(function (k) { return '<option value="' + esc(k) + '"' + (f.objetoAmploId === k ? ' selected' : '') + '>' + esc(D.objetos[k].nome) + '</option>'; }).join('') + '</select>' +
          '<p class="an-nota">A atuação ampla continua como está e passa a aparecer como "delimitada em N responsabilidades".</p></div>' : '') +
        (st.erro ? '<p class="avp-error-msg" id="anErro" role="alert">' + esc(st.erro) + '</p>' : '') +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anCriarBtn"' + (st.gravando ? ' disabled' : '') + '>' + (st.gravando ? 'Gravando…' : 'Abrir a análise') + '</button></div></form>';
    }

    function trilha(atual) { return '<ol class="an-trilha" id="anTrilha" aria-label="Etapas">' + ETAPAS.map(function (t, i) { var n = i + 1; return '<li class="' + (n < atual ? 'feita' : n === atual ? 'atual' : '') + '"' + (n === atual ? ' aria-current="step"' : '') + '>' + n + ' ' + esc(t) + '</li>'; }).join('') + '</ol>'; }
    function etapaAtual(a, pend, ativos) {
      if (pend.length) return 2;
      if (!ativos.length) return 3;
      var sf = ativos.map(function (k) { return situacaoFormalDe(a.recortes[k]); });
      if (sf.some(function (x) { return x.s === 'sem-classificacao'; })) return 4;
      if (sf.some(function (x) { return x.s === 'classificacao-a-validar'; })) return 5;
      return a.propostaVigente ? 7 : 6;
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
      var h = voltar('#avaliacoes?an=lista', 'Voltar para as análises', 'anVoltarLista') +
        '<h2 class="an-titulo" id="anTitulo">' + esc(a.nome) + '</h2>' +
        '<p class="an-meta">' + esc(ESCOPO[a.tipoEscopo] ? ESCOPO[a.tipoEscopo][0] : a.tipoEscopo) +
        (a.estruturaReferidaId ? ' · estrutura: ' + esc(nomeEstrutura(a.estruturaReferidaId)) : '') +
        (a.capacidades.length ? ' · capacidades: ' + a.capacidades.map(function (c) { return esc(c.rotulo); }).join(', ') : '') + '</p>' +
        (a.situacao === 'descartada' ? '<p class="avp-error-msg" id="anDescartada">Análise descartada: ' + esc(a.descarte && a.descarte.motivo) + '. Nada foi apagado.</p>' : '') +
        trilha(etapaAtual(a, pend, ativos)) +
        '<dl class="an-estados" id="anEstados">' +
        '<div><dt>Classificação (O1–O9)</dt><dd id="anEstadoClassificacao">' + classificadas + ' de ' + ativos.length + ' responsabilidade' + (ativos.length === 1 ? '' : 's') + '</dd></div>' +
        '<div><dt>Diagnóstico de vínculo</dt><dd id="anEstadoDiagnostico">' + (ativos.length ? (pendForm ? pendForm + ' com pendência' : 'sem pendência conhecida') : '—') + '</dd></div>' +
        '<div><dt>Decisão organizacional</dt><dd id="anEstadoDecisao">' + esc(decisao) + '</dd></div></dl>' +
        (st.flash ? '<p class="avp-flash-success" id="anFlash" role="status">' + esc(st.flash) + '</p>' : '') +
        (st.erro ? '<p class="avp-error-msg" id="anErro" role="alert">' + esc(st.erro) + '</p>' : '');
      if (gravar && pend.length) h += renderPergunta(a, pend);
      h += renderEntregas(a, gravar);
      h += renderRecortes(a, ativos, sfs, gravar);
      if (lac.length) h += '<section class="avp-form-card an-secao" id="anLacunas"><h3>Lacunas (não impedem continuar)</h3><ul>' + lac.map(function (l) { return '<li>' + esc(textoLacuna(a, l)) + '</li>'; }).join('') + '</ul></section>';
      h += renderComposicao(est, a, ativos, sfs, acc);
      h += renderHistorico(a);
      h += '<div class="avp-actions-footer an-rodape"><button type="button" class="btn btn--sm" id="anExportarBtn" data-an="exportar">📊 Exportar Excel</button>' +
        (gravar ? '<button type="button" class="btn btn--sm btn--danger" data-an="abrir-form" data-form="descartar" id="anDescartarBtn">Descartar a análise</button>' : '') + '</div>';
      if (st.form && st.form.tipo === 'descartar') h += '<form class="avp-form-card an-form" id="anFormDescartar"><div class="avp-field"><label for="anMotivoDescarte">Motivo do descarte</label><textarea id="anMotivoDescarte" maxlength="500" rows="2"></textarea></div><p class="an-nota">Nada é apagado: a análise fica no histórico como descartada.</p><div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="anConfirmarDescarte">Descartar</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      return h;
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
    /* a pergunta da vez — uma só, com o porquê */
    function renderPergunta(a, pend) {
      var q = pend[0], M = {}; N().MATRIZ.forEach(function (x) { M[x.id] = x; });
      var def = M[q.pergunta], h = '<section class="avp-form-card an-pergunta" id="anPergunta" aria-labelledby="anPerguntaTitulo"><p class="an-contador">' + pend.length + ' pergunta' + (pend.length === 1 ? '' : 's') + ' pendente' + (pend.length === 1 ? '' : 's') + '</p>';
      if (q.pergunta === 'F10') {
        var x = a.entregas[q.par[0]], y = a.entregas[q.par[1]];
        h += '<h3 id="anPerguntaTitulo">Estas duas entregas são a mesma responsabilidade?</h3><p class="an-par"><strong>' + esc(x.descricao) + '</strong> × <strong>' + esc(y.descricao) + '</strong></p>' +
          '<p class="an-porque">Por que perguntamos: elas se parecem (' + esc(q.sinais.map(function (s) { return { 'mesma-forma': 'mesma forma', 'mesmo-destinatario': 'mesmo destinatário', 'mesmo-responsavel': 'mesmo responsável', 'padrao-aplicado-nos-proprios-casos': 'padrão aplicado nos próprios casos' }[s] || s; }).join(', ')) + '). Parecer não basta: a identidade depende dos critérios abaixo, e nada é juntado sem a sua conclusão.</p>' +
          '<form id="anFormComparar" data-a="' + esc(q.par[0]) + '" data-b="' + esc(q.par[1]) + '">' + Object.keys(CRITERIO).map(function (k) {
            return '<fieldset class="an-criterio"><legend>' + esc(CRITERIO[k][0]) + ' <span class="an-exemplo">' + esc(CRITERIO[k][1]) + '</span></legend>' + ['igual', 'diferente', 'nao-sei'].map(function (v) {
              return '<label class="an-opcao an-opcao--linha"><input type="radio" name="anCrit_' + k + '" value="' + v + '"><span>' + { igual: 'Igual', diferente: 'Diferente', 'nao-sei': 'Não sei' }[v] + '</span></label>'; }).join('') + '</fieldset>';
          }).join('') +
          '<fieldset class="an-opcoes"><legend>Sua conclusão</legend>' + Object.keys(CONCLUSAO).map(function (k) { return '<label class="an-opcao"><input type="radio" name="anConclusao" value="' + k + '"><span>' + esc(CONCLUSAO[k]) + '</span></label>'; }).join('') + '</fieldset>' +
          '<div class="avp-field"><label for="anJustComp">Justificativa <span class="an-opc">(obrigatória se contrariar os critérios)</span></label><textarea id="anJustComp" rows="2" maxlength="2000"></textarea></div>' +
          '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anResponderBtn"' + (st.gravando ? ' disabled' : '') + '>Registrar a comparação</button></div></form></section>';
        return h;
      }
      if (q.pergunta === 'F3') {
        h += '<h3 id="anPerguntaTitulo">' + esc(def.pergunta) + '</h3><p class="an-porque">Por que perguntamos: ' + esc(def.porque) + ' Uma entrega é algo que sai daqui e alguém usa — um parecer, um serviço, uma política, um sistema.</p>' +
          '<p class="an-nota">Use o formulário "Adicionar entrega" logo abaixo. Se não há nenhuma: <button type="button" class="btn btn--sm" data-an="responder" data-q="F3" data-v="nenhuma" id="anSemEntregas">Não consigo identificar entregas</button></p></section>';
        return h;
      }
      var ent = q.entregaId ? a.entregas[q.entregaId] : null;
      h += (ent ? '<p class="an-sobre">Sobre a entrega: <strong>' + esc(ent.descricao) + '</strong></p>' : '') + '<h3 id="anPerguntaTitulo">' + esc(def.pergunta) + '</h3>' +
        '<p class="an-porque">Por que perguntamos: ' + esc(def.porque) + '</p><form id="anFormResponder" data-q="' + q.pergunta + '" data-entrega="' + esc(q.entregaId || '') + '">' +
        '<fieldset class="an-opcoes"><legend class="sr-only">Respostas</legend>' + def.valores.map(function (v) {
          return '<label class="an-opcao"><input type="radio" name="anResposta" value="' + v + '"><span>' + esc((ROT[q.pergunta] || {})[v] || v) + '</span></label>'; }).join('') + '</fieldset>';
      if (q.pergunta === 'F6') h += '<div class="avp-field"><label for="anCerteza">Isso é</label><select id="anCerteza">' + Object.keys(CERTEZA).map(function (k) { return '<option value="' + k + '">' + esc(CERTEZA[k]) + '</option>'; }).join('') + '</select></div>' + campoEstrutura('anOutraEstrutura', 'Qual estrutura (se for outra)?', true);
      if (q.pergunta === 'F8' || q.pergunta === 'F11') h += '<div class="avp-field"><label for="anTextoResp">' + (q.pergunta === 'F8' ? 'Evidência (documento, indicador, ata, exemplo de caso)' : 'Norma (se for exigência normativa)') + '</label><textarea id="anTextoResp" rows="2" maxlength="2000"></textarea></div>';
      if (q.pergunta === 'F2b') h += campoEstrutura('anEstruturaCadastrada', 'Qual estrutura cadastrada?', false);
      h += '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anResponderBtn"' + (st.gravando ? ' disabled' : '') + '>Responder</button></div></form></section>';
      return h;
    }
    function campoEstrutura(id, rotulo, comTexto) {
      var ests = D.estruturas ? Object.keys(D.estruturas).filter(function (k) { return D.estruturas[k].situacao === 'ativa'; }).sort(function (x, y) { return String(D.estruturas[x].nome).localeCompare(D.estruturas[y].nome); }) : [];
      return '<div class="avp-field"><label for="' + id + '">' + esc(rotulo) + '</label>' + (ests.length ? '<select id="' + id + '"><option value="">—</option>' + ests.map(function (k) { return '<option value="' + esc(k) + '">' + esc(D.estruturas[k].nome) + '</option>'; }).join('') + '</select>' : '') +
        (comTexto || !ests.length ? '<input id="' + id + 'Texto" placeholder="' + (ests.length ? 'ou descreva' : 'descreva a estrutura') + '" maxlength="2000">' : '') + '</div>';
    }
    function resumoResposta(r, q) { if (!r) return '—'; var t = (ROT[q] || {})[r.valor] || r.valor; if (q === 'F6') t += ' (' + (CERTEZA[r.certeza] || r.certeza) + ')' + (r.estruturaId ? ': ' + nomeEstrutura(r.estruturaId) : r.texto ? ': ' + r.texto : ''); if (r.texto && q !== 'F6') t += ': ' + r.texto; return t; }
    function renderEntregas(a, gravar) {
      var ids = Object.keys(a.entregas).filter(function (k) { return a.entregas[k].situacao === 'ativa'; }).sort(function (x, y) { return (a.entregas[x].criadaEm || 0) - (a.entregas[y].criadaEm || 0); });
      var h = '<section class="avp-form-card an-secao" id="anEntregas"><h3>Entregas (' + ids.length + ')</h3>';
      if (!ids.length) h += '<p class="admin-empty">Nenhuma entrega ainda.</p>';
      else h += '<ul class="an-entregas">' + ids.map(function (k) {
        var e = a.entregas[k], r = e.respostas;
        var exec = r.F7 && r.F7.valor === 'sim';
        return '<li class="an-entrega" data-entrega="' + esc(k) + '"><strong>' + esc(e.descricao) + '</strong>' + (exec ? ' <span class="an-chip an-chip--neu">execução para outra estrutura</span>' : '') +
          '<span class="an-det">' + ['F4', 'F5', 'F6', 'F8'].map(function (q) { return r[q] ? esc(resumoResposta(r[q], q)) : ''; }).filter(Boolean).join(' · ') + '</span>' +
          (r.F8 && r.F8.valor === 'sem-evidencia' ? '<span class="an-chip an-chip--pend">hipótese</span>' : '') + '</li>';
      }).join('') + '</ul>';
      if (gravar) h += '<form class="an-form an-form--inline" id="anFormEntrega"><div class="avp-field"><label for="anEntregaDesc">Adicionar entrega</label><input id="anEntregaDesc" maxlength="2000" placeholder="Ex.: pareceres sobre as soluções propostas"></div>' +
        '<div class="avp-field"><label for="anEntregaEx">Exemplo concreto <span class="an-opc">(opcional)</span></label><input id="anEntregaEx" maxlength="2000"></div>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--sm" id="anAddEntregaBtn"' + (st.gravando ? ' disabled' : '') + '>Adicionar</button></div></form>';
      return h + '</section>';
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
    function renderRecortes(a, ativos, sfs, gravar) {
      var h = '<section class="avp-form-card an-secao" id="anRecortes"><h3>Responsabilidades delimitadas (' + ativos.length + ')</h3>' +
        '<p class="an-nota">Separar para avaliar não cria estrutura. Cada responsabilidade é avaliada pelo O1–O9 como uma atuação da Porta 2.</p>';
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
          if (!r.objetoId) h += pr.pronta ? '<button type="button" class="btn btn--sm btn--primary" data-an="abrir-form" data-form="atuacao" data-recorte="' + esc(k) + '" id="anCriarAtuacao_' + esc(k) + '">Avaliar com O1–O9</button>' : '<span class="an-nota" id="anNaoPronta_' + esc(k) + '">Para avaliar, falta: ' + esc(pr.faltas.map(function (f) { return { NOME: 'nome', RESULTADO: 'resultado' }[f] || ({ FORMA: 'forma', DESTINATARIO: 'destinatário', EVIDENCIA_OU_HIPOTESE: 'evidência ou hipótese' }[f.split(':')[0]] + ' de ' + nomeEntrega(a, f.split(':')[1])); }).join(', ')) + '</span>';
          if (!r.objetoId) h += '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="descartar-recorte" data-recorte="' + esc(k) + '">Descartar</button>';
        }
        h += '</div>' + renderFormRecorte(a, r, k) + '</article>';
      });
      /* N:N — responsabilidades já delimitadas em OUTRAS análises: referenciadas, nunca duplicadas nem com a origem trocada */
      var refs = Object.keys(a.referencias || {});
      if (refs.length) h += '<div class="an-referencias" id="anReferencias"><h4>Responsabilidades de outras análises referenciadas aqui</h4><ul>' + refs.map(function (o) {
        var ob = (D.objetos || {})[o], orig = (D.porObjeto || {})[o], an = orig ? (D.analises || {})[orig.analiseId] : null;
        return '<li data-referencia="' + esc(o) + '"><strong>' + esc(ob ? ob.nome : o) + '</strong> <span class="an-det">' + esc(textoPos(posicionamentoDa(o))) + (an ? ' · origem: análise "' + esc(an.nome) + '"' : '') + '</span></li>';
      }).join('') + '</ul></div>';
      if (gravar) {
        var candidatas = Object.keys(D.porObjeto || {}).filter(function (o) { return D.porObjeto[o].analiseId !== a.id && !(a.referencias || {})[o] && (D.objetos || {})[o]; });
        if (candidatas.length) h += '<form class="an-form an-form--inline" id="anFormReferencia"><div class="avp-field"><label for="anReferenciaSel">Referenciar uma responsabilidade já delimitada em outra análise</label><select id="anReferenciaSel"><option value="">—</option>' +
          candidatas.map(function (o) { return '<option value="' + esc(o) + '">' + esc(D.objetos[o].nome) + '</option>'; }).join('') + '</select></div>' +
          '<p class="an-nota">Ela continua pertencendo à análise de origem; aqui só é citada (não é contada duas vezes).</p><div class="avp-actions-footer"><button type="submit" class="btn btn--sm" id="anReferenciarBtn">Referenciar</button></div></form>';
      }
      if (gravar) {
        var livres = Object.keys(a.entregas).filter(function (e) { var x = a.entregas[e]; return x.situacao === 'ativa' && !(x.respostas.F7 && x.respostas.F7.valor === 'sim') && !ativos.some(function (k) { return a.recortes[k].entregas.indexOf(e) !== -1; }); });
        if (livres.length) h += '<form class="an-form" id="anFormRecorte"><h4>Delimitar uma responsabilidade</h4><fieldset class="an-opcoes"><legend>Entregas que ela reúne</legend>' + livres.map(function (e) { return '<label class="an-opcao"><input type="checkbox" name="anRecEntrega" value="' + esc(e) + '"><span>' + esc(a.entregas[e].descricao) + '</span></label>'; }).join('') + '</fieldset>' +
          '<p class="an-nota">Duas entregas só ficam juntas depois de comparadas (pergunta "São a mesma responsabilidade?").</p>' +
          '<div class="avp-field"><label for="anRecNome">Nome da responsabilidade</label><input id="anRecNome" maxlength="200"></div>' +
          '<div class="avp-field"><label for="anRecResultado">Resultado pelo qual ela responde</label><input id="anRecResultado" maxlength="2000"></div>' +
          '<div class="avp-field"><label for="anRecJust">Por que é distinta das outras</label><textarea id="anRecJust" rows="2" maxlength="2000"></textarea></div>' +
          '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anDefinirRecorteBtn"' + (st.gravando ? ' disabled' : '') + '>Delimitar</button></div></form>';
      }
      return h + '</section>';
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
    function renderComposicao(est, a, ativos, sfs, acc) {
      var props = Object.keys(est.propostas).map(function (k) { return est.propostas[k]; }).filter(function (p) { return p.analiseId === a.id; }).sort(function (x, y) { return y.versao - x.versao; });
      var vig = props[0] || null, gravar = acc.gravar && a.situacao === 'aberta';
      var h = '<section class="avp-form-card an-secao" id="anComposicao"><h3>Composição organizacional</h3>' +
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
      return h + '</section>';
    }
    function renderHistorico(a) {
      var ev = st.historico && st.historico.id === a.id ? st.historico.eventos : null;
      return '<details class="avp-form-card an-secao" id="anHistorico"' + (st.abertos.historico ? ' open' : '') + '><summary>Histórico</summary>' +
        (ev === null ? '<p class="loading-msg">Carregando…</p>' : ev === false ? '<p class="avp-error-msg">Histórico indisponível agora.</p>' :
          '<ol class="an-eventos">' + ev.map(function (e) { return '<li><strong>' + esc(TIPO_EVENTO[e.tipo] || e.tipo) + '</strong> <span class="an-det">' + esc(fmtData(e.em)) + ' · ' + esc((e.por || {}).email || '') + '</span></li>'; }).join('') + '</ol>') + '</details>';
    }
    var TIPO_EVENTO = { 'analise.criada': 'Análise aberta', 'resposta.registrada': 'Resposta registrada', 'entrega.adicionada': 'Entrega adicionada', 'comparacao.registrada': 'Comparação registrada', 'recorte.definido': 'Responsabilidade delimitada', 'recorte.ajustado': 'Delimitação revista', 'recorte.descartado': 'Responsabilidade descartada', 'fatos.registrados': 'Quem executa / responde informado', 'recorte.atuacao-associada': 'Atuação criada para o O1–O9', 'responsabilidade.referenciada': 'Responsabilidade referenciada', 'evidencia.registrada': 'Evidência qualitativa registrada', 'proposta.registrada': 'Proposta registrada', 'aprovacao.registrada': 'Referência à aprovação registrada', 'analise.descartada': 'Análise descartada' };
    function carregarHistorico() {
      var id = st.id; st.historico = { id: id, eventos: null };
      S().lerUmaVez(F().NOS.auditoria + '/' + id, 12000).then(function (v) {
        if (st.id !== id) return;
        st.historico = { id: id, eventos: Object.keys(v || {}).map(function (k) { return v[k]; }).sort(function (x, y) { return (x.em || 0) - (y.em || 0); }) }; render();
      }, function () { if (st.id === id) { st.historico = { id: id, eventos: false }; render(); } });
    }

    /* ---------- ações ---------- */
    function terminar(r, flash, depois) {
      st.gravando = false;
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
        st.form = { tipo: 'nova', tipoEscopo: marcado('anEscopo'), nome: val('anNome'), descricao: val('anDescricao'), capacidades: val('anCapacidades'), objetoAmploId: val('anObjetoAmplo') };
        var dados = { nome: val('anNome'), tipoEscopo: marcado('anEscopo'), descricao: val('anDescricao') || undefined, capacidades: caps, objetoAmploId: val('anObjetoAmplo') || undefined };
        executar(function (est, c) { return N().criarAnalise(est, dados, c); }, 'Análise aberta.', function (r) { st.form = null; ir(r.novoId); });
      } else if (form.id === 'anFormResponder') {
        var q = form.getAttribute('data-q'), ent = form.getAttribute('data-entrega') || undefined, v = marcado('anResposta');
        var valor = v;
        if (q === 'F6') { var oe = val('anOutraEstrutura'), ot = val('anOutraEstruturaTexto'); valor = { valor: v, certeza: val('anCerteza') }; if (oe) valor.estruturaId = oe; else if (ot) valor.texto = ot; }
        else if (q === 'F8' || q === 'F11') { valor = { valor: v }; if (val('anTextoResp')) valor.texto = val('anTextoResp'); }
        else if (q === 'F2b') { valor = { valor: v }; var ec = val('anEstruturaCadastrada'); if (ec) valor.estruturaId = ec; }
        executar(function (est, c) { return N().responder(est, id, { pergunta: q, entregaId: ent, valor: valor }, c); }, 'Resposta registrada.');
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
        executar(function (est, c) { return N().adicionarEntrega(est, id, de, c); }, 'Entrega adicionada.');
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
      if (acao === 'abrir-form') { st.form = { tipo: b.getAttribute('data-form'), recorte: b.getAttribute('data-recorte') || null }; st.erro = null; render(); var f = wrap.querySelector('form.an-form input, form.an-form textarea, form.an-form select'); if (f) f.focus(); }
      else if (acao === 'cancelar') { st.form = null; st.erro = null; render(); }
      else if (acao === 'responder') { var q = b.getAttribute('data-q'), v = b.getAttribute('data-v'), id = st.id; executar(function (est, c) { return N().responder(est, id, { pergunta: q, valor: v }, c); }, 'Resposta registrada.'); }
      else if (acao === 'exportar') exportar();
    });
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
  /* lista de atuações da Porta 2: entrada para a análise */
  function entradaAtuacoesHtml() {
    ligarConfig();
    var a = acesso(); if (!a.ler) return '';
    return '<div class="an-entrada" id="anEntradaAtuacoes"><p><strong>O que você quer entender é amplo?</strong> Uma estrutura, uma grande área, um conjunto ou uma capacidade: a Análise Organizacional ajuda a descobrir as responsabilidades que existem ali antes de avaliar cada uma.</p>' +
      '<div class="an-acoes">' + (a.gravar ? '<a class="btn btn--sm" id="anEntradaNova" href="#avaliacoes?an=nova">Abrir uma análise</a>' : '') + '<a class="btn btn--sm" id="anEntradaLista" href="#avaliacoes?an=lista">Análises organizacionais</a></div></div>';
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
  window.faAnalisesOrganizacionais = { entradaAtuacoesHtml: entradaAtuacoesHtml, origemHtml: origemHtml, origemDe: origemDe, delimitacaoDe: delimitacaoDe,
    exercidasHtml: exercidasHtml, montarHabilitacao: montarHabilitacao, acesso: acesso, aoMudar: function (f) { aoMudarFns.push(f); }, ligar: function () { ligarConfig(); ligarDados(); } };
  if (/^#avaliacoes\?(.*&)?an=/.test(location.hash || '')) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.faInitAnalisesOrganizacionais); else window.faInitAnalisesOrganizacionais(); }
})();
