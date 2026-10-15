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
    'atuacao-informal': ['Um trabalho ainda não organizado formalmente', 'Ex.: apoio a projetos diversos, feito por quem estiver disponível.']
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
      ajuda: 'Consulte em ADMIN → Avaliação e Mapa → Estruturas Organizacionais. Esse cadastro registra estruturas concretas da organização e não deve ser confundido com o cadastro de Responsabilidades Organizacionais da Porta 2. Não é necessário cadastrar uma estrutura para continuar esta análise.',
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
    ouvintes.dados.push(S().ouvir('objetos-organizacionais-excluidos', function (v) { D.objExcluidos = v || {}; avisar(); }, function () { D.objExcluidos = {}; }));
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
    ESTRUTURA_INCOMPATIVEL_COM_RESPOSTA: 'Só a resposta "Está cadastrada" aponta uma estrutura do cadastro.', SEPARACAO_INVALIDA: 'Responda se a descrição reúne trabalhos diferentes que precisam ser avaliados separadamente (Não, Sim ou Não sei).', LOTE_VAZIO: 'Marque ao menos um item com texto.', LOTE_GRANDE_DEMAIS: 'Registre no máximo 100 por vez.', NUCLEO_INVALIDO: 'Cada núcleo precisa de um nome (até 200 caracteres).', NUCLEO_REPETIDO: 'O mesmo núcleo foi informado duas vezes.', FONTE_INVALIDA: 'A fonte é longa demais.', DESCRICAO_OBRIGATORIA: 'Descreva a responsabilidade (pode copiar a atribuição como está).', PARTES_INSUFICIENTES: 'Informe ao menos duas partes.', SEPARAR_SO_COM_SIM: 'Só se separa uma responsabilidade marcada como "precisa separar".', NOME_CURTO_OBRIGATORIO: 'Informe um nome curto (até 200 caracteres).', JUSTIFICATIVA_INVALIDA: 'A justificativa é longa demais.', ENTREGA_EM_RESPONSABILIDADE: 'Esta entrega está numa responsabilidade delimitada: tire-a de lá antes (descarte ou reveja a responsabilidade).',
    ENTREGA_EM_RESPONSABILIDADE_AVALIADA: 'Esta entrega está numa responsabilidade já avaliada pelo O1–O9: o texto não muda. Para rever, descarte a responsabilidade e delimite de novo.', ENTREGA_DESCARTADA: 'Esta entrega já foi excluída.', ENTREGA_INEXISTENTE: 'Entrega não encontrada.',
    CERTEZA_RESPONSAVEL_INVALIDA: 'Diga se o responsável é conhecido, provável ou ainda não definido.', NOME_OBRIGATORIO: 'O nome é obrigatório.', RESULTADO_OBRIGATORIO: 'O resultado é obrigatório.',
    JUSTIFICATIVA_DO_RECORTE_OBRIGATORIA: 'Explique por que esta responsabilidade é distinta das outras.', JUSTIFICATIVA_OBRIGATORIA: 'A justificativa é obrigatória.',    MOTIVO_OBRIGATORIO: 'O motivo é obrigatório.',
    RECORTE_COM_CADASTRO: 'Esta responsabilidade já tem cadastro na Porta 2: exclua o cadastro pela ficha dele (a ligação com a análise é preservada).',
    RECORTE_EM_PROPOSTA: 'Esta responsabilidade está citada numa proposta de composição registrada (imutável): ela não pode ser excluída. Use Descartar.',
    ULTIMA_PARTE: 'É a última parte de uma responsabilidade separada: exclua a responsabilidade original (com as partes) em vez desta parte.',
    ANALISE_COM_APROVACAO: 'Esta análise tem aprovação registrada (referência a ato externo): ela não pode ser excluída.',
    RECORTE_SEM_ENTREGA: 'Escolha ao menos uma entrega.', ENTREGA_SEM_DESCRICAO: 'Descreva a entrega.', EVIDENCIA_SEM_TEXTO: 'Escreva a evidência.', TIPO_ESCOPO_INVALIDO: 'Escolha o que você vai analisar.',
    AUTORIDADE_OBRIGATORIA: 'Informe a autoridade que aprovou.', REFERENCIA_DO_ATO_OBRIGATORIA: 'Informe a referência do ato (ata, documento).', DATA_DO_ATO_INVALIDA: 'Informe a data do ato.', OBJETO_APROVADO_OBRIGATORIO: 'Diga o que foi aprovado.',
    ATUACAO_JA_TEM_ORIGEM: 'Esta responsabilidade já nasceu de outra análise.', ATUACAO_INVALIDA: 'Escolha a responsabilidade.', REFERENCIA_REPETIDA: 'Esta responsabilidade já está referenciada aqui.', REFERENCIA_A_PROPRIA_ORIGEM: 'Esta responsabilidade nasceu nesta análise.', RESPOSTA_INVALIDA: 'Escolha uma das respostas.', PROPOSTA_SEM_RECORTE: 'Escolha ao menos uma responsabilidade.'
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
    /* o que a pessoa digitou e ainda não gravou sobrevive a um redesenho (uma atualização do banco chega a qualquer
       momento); depois de uma gravação bem-sucedida os campos voltam limpos */
    function capturarCampos() {
      var c = { valores: {}, marcas: [] };
      Array.prototype.forEach.call(wrap.querySelectorAll('input, textarea, select'), function (el) {
        if (el.type === 'radio' || el.type === 'checkbox') { if (el.checked !== el.defaultChecked) c.marcas.push({ nome: el.name, valor: el.value, marcado: el.checked }); return; }
        if (!el.id || el.type === 'hidden') return;
        var padrao = el.tagName === 'SELECT' ? (Array.prototype.filter.call(el.options, function (o) { return o.defaultSelected; })[0] || el.options[0] || {}).value : el.defaultValue;
        if (el.value !== padrao) c.valores[el.id] = el.value;
      });
      return c;
    }
    function restaurarCampos(c) {
      c.marcas.forEach(function (m) {
        var el = wrap.querySelector('input[name="' + m.nome + '"][value="' + m.valor + '"]');
        if (el && el.checked !== m.marcado) { el.checked = m.marcado; el.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      Object.keys(c.valores).forEach(function (id) { var el = document.getElementById(id); if (el && wrap.contains(el) && !el.disabled) el.value = c.valores[id]; });
    }
    var ouvindoEA = false;
    function render() {
      if (wrap.hidden) return;
      /* a Estrutura Organizacional Atual pode chegar depois: redesenha quando ela mudar */
      if (!ouvindoEA && EA() && EA().aoMudar) { ouvindoEA = true; EA().aoMudar(function () { if (!wrap.hidden && !st.gravando) render(); }); }
      /* o que a pessoa abriu ou fechou continua assim depois de redesenhar (lido da página: o evento toggle pode chegar depois) */
      [['anDetalhar', 'detalhar'], ['anQuandoSeparar', 'quandoSeparar'], ['anConceitos', 'conceitos'], ['anComposicaoSecao', 'composicao'], ['anDetalhesResp', 'detalhesResp'], ['anObjeto', 'objeto'], ['anRefMais', 'refMais'], ['anNovaAvancado', 'novaAvancado'], ['anRegistrar', 'adicionar']].forEach(function (x) { var d = document.getElementById(x[0]); if (d && wrap.contains(d)) st.abertos[x[1]] = d.open; });
      var digitado = st.limparCampos ? { valores: {}, marcas: [] } : capturarCampos(); st.limparCampos = false;
      var a = acesso(), h;
      if (!autorizacaoResolvida() || D.hab === undefined) h = '<p class="loading-msg" id="anCarregando">Carregando…</p>';
      else if (!a.ler) h = '<div class="avp-form-card" id="anIndisponivel"><p>A Análise Organizacional não está disponível para você agora.</p><p class="an-nota">A Porta 2 continua disponível como sempre: <a href="#avaliacoes?po=atuacoes">Responsabilidades organizacionais</a>.</p></div>';
      else if (!dadosProntos()) h = '<p class="loading-msg" id="anCarregando">Carregando as análises…</p>';
      else if (st.tela === 'lista') h = renderLista(a);
      else if (st.tela === 'nova') h = a.gravar ? renderNova() : '<p class="admin-empty" id="anSemPermissao">Abrir uma análise é do perfil Avaliação + Configuração.</p>';
      else h = renderAnalise(a);
      var foco = document.activeElement && wrap.contains(document.activeElement) ? document.activeElement.id : null;
      wrap.innerHTML = '<div class="an-tela">' + (D.hab === 'SOMENTE_ADMIN_GERAL' ? '<p class="an-homologacao" id="anHomologacao">Em homologação: visível só para o admin geral.</p>' : '') + h + '</div>';
      restaurarCampos(digitado);
      if (foco) { var f = document.getElementById(foco); if (f && f.focus) f.focus({ preventScroll: true }); }
    }
    function voltar(href, texto, id) { return '<a class="avp-voltar-link" id="' + id + '" href="' + href + '">← ' + esc(texto) + '</a>'; }
    function situacaoTexto(s) { return { 'em-descoberta': 'Em descoberta', 'em-avaliacao': 'Em avaliação', classificada: 'Classificada · desenho a decidir', 'com-pendencia': 'Com pendência', proposta: 'Proposta registrada', aprovada: 'Aprovação registrada', descartada: 'Descartada' }[s] || s; }
    function infoPos() { var m = {}; Object.keys(D.vigentes || {}).forEach(function (o) { var p = posicionamentoDa(o); if (p.estado === 'concluido') m[o] = { codigoEfetivo: p.codigoEfetivo }; }); return m; }
    function renderLista(a) {
      var est = estado(), ids = Object.keys(est.analises).sort(function (x, y) { return (est.analises[y].criadaEm || 0) - (est.analises[x].criadaEm || 0); });
      var h = voltar('#avaliacoes?po=atuacoes', 'Voltar para Responsabilidades Organizacionais', 'anVoltarAtuacoes') + '<h2 class="an-titulo">Análises Organizacionais</h2>' +
        '<p class="an-intro">Acompanhe as responsabilidades de cada área.</p>';
      if (a.gravar) h += '<a class="btn btn--primary" id="anNovaBtn" href="#avaliacoes?an=nova">Nova análise</a>';
      var ativas = ids.filter(function (id) { return est.analises[id].situacao !== 'descartada'; }), desc = ids.length - ativas.length;
      /* nomes repetidos: data de abertura, situação e o código da análise distinguem uma da outra */
      var porNome = {}; ativas.forEach(function (id) { var nn = normalizado(est.analises[id].nome); porNome[nn] = (porNome[nn] || 0) + 1; });
      if (!ativas.length) h += '<p class="admin-empty" id="anListaVazia">Nenhuma análise aberta ainda.</p>';
      else h += '<ul class="an-lista" id="anLista">' + ativas.map(function (id) {
        var x = est.analises[id], ks = Object.keys(x.recortes).filter(function (r) { return x.recortes[r].situacao === 'ativo'; });
        var n = { pendente: 0, pronta: 0, andamento: 0, avaliada: 0, avalidar: 0 };
        ks.forEach(function (k) { n[situacaoResp(x, k, situacaoFormalDe(x.recortes[k])).c]++; });
        var cont = [[n.pronta, 'pronta', 'prontas'], [n.andamento, 'em andamento', 'em andamento'], [n.avaliada, 'avaliada', 'avaliadas'], [n.avalidar, 'a validar', 'a validar'], [n.pendente, 'pendente (registro anterior)', 'pendentes (registros anteriores)']]
          .filter(function (c) { return c[0]; }).map(function (c) { return c[0] + ' ' + (c[0] === 1 ? c[1] : c[2]); });
        var prox = !ks.length ? 'Adicionar responsabilidades' : (n.pronta || n.andamento || n.pendente) ? 'Continuar análise' : 'Ver resultados';
        var homonima = porNome[normalizado(x.nome)] > 1;
        return '<li><a class="an-item" data-analise="' + esc(id) + '" href="#avaliacoes?an=' + encodeURIComponent(id) + '"><span class="an-item-nome">' + esc(x.nome) + '</span>' +
          '<span class="an-item-det" id="anItemContagem_' + esc(id) + '">' + ks.length + ' responsabilidade' + (ks.length === 1 ? '' : 's') + (cont.length ? ' — ' + cont.join(' · ') : '') + '</span>' +
          (homonima ? '<span class="an-item-det an-item-homonima" id="anItemContexto_' + esc(id) + '">Aberta em ' + esc(fmtData(x.criadaEm)) + ' · ' + esc(situacaoTexto(N().situacaoDaAnalise(est, id, { posicionamentos: infoPos() }))) + ' · código ' + esc(String(id).slice(-6)) + '</span>' : '') +
          '<span class="btn btn--sm' + (prox === 'Ver resultados' ? '' : ' btn--primary') + ' an-item-acao" id="anItemAcao_' + esc(id) + '">' + prox + '</span></a></li>';
      }).join('') + '</ul>';
      if (desc) h += '<p class="an-nota">' + desc + ' análise' + (desc === 1 ? '' : 's') + ' descartada' + (desc === 1 ? '' : 's') + ' (mantidas no histórico).</p>';
      return h;
    }
    function unidadesListadas() { var us = unidadesAtuais(); return us && us.length ? us : null; }
    function campoUnidadeNova(f) {
      var us = unidadesListadas(); if (!us) return '';
      return '<div class="avp-field"><label for="anUnidadeAtual">Qual área você deseja analisar?</label><select id="anUnidadeAtual" aria-describedby="anUnidadeAtualAjuda"><option value="">— escolha na Estrutura Organizacional Atual —</option>' +
        us.map(function (x) { return '<option value="' + esc(x.id) + '"' + (f.unidadeAtualId === x.id ? ' selected' : '') + '>' + '— '.repeat(x.profundidade) + esc(EA().rotulo(x.id)) + '</option>'; }).join('') + '</select>' +
        '<p class="an-ajuda" id="anUnidadeAtualAjuda">Unidades cadastradas em ADMIN › Avaliação e Mapa › Estrutura Organizacional Atual. Não está lá? Digite o nome abaixo.</p></div>';
    }
    function renderNova() {
      var f = st.form && st.form.tipo === 'nova' ? st.form : { tipo: 'nova' };
      var atuacoes = Object.keys(D.objetos || {}).filter(function (k) { return D.objetos[k].situacao === 'ativo'; }).sort(function (x, y) { return String(D.objetos[x].nome).localeCompare(D.objetos[y].nome); });
      /* abrir uma análise pede só o nome da área; tipo, descrição, capacidades e responsabilidade prévia ficam em
         "Opções avançadas" (o tipo começa como "estrutura que já existe") */
      return voltar('#avaliacoes?an=lista', 'Voltar para as análises', 'anVoltarLista') + '<h2 class="an-titulo">' + (unidadesListadas() ? 'Analisar uma área' : 'Qual área você deseja analisar?') + '</h2>' +
        '<form class="avp-form-card an-form" id="anFormNova" novalidate>' +
        campoUnidadeNova(f) +
        '<div class="avp-field"><label for="anNome">' + (unidadesListadas() ? 'Nome da área <span class="an-opc">(preenchido pela unidade escolhida; ou digite, se ela não estiver no cadastro)</span>' : 'Nome da área') + '</label><input id="anNome" maxlength="200" value="' + esc(f.nome || '') + '" placeholder="Ex.: GECON — Gerência de Contabilidade e Controladoria"></div>' +
        (st.erro ? '<p class="avp-error-msg" id="anErro" role="alert">' + esc(st.erro) + '</p>' : '') +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anCriarBtn"' + (st.gravando ? ' disabled' : '') + '>' + (st.gravando ? 'Gravando…' : 'Continuar para as responsabilidades') + '</button></div>' +
        '<details class="an-conceitos" id="anNovaAvancado"' + (st.abertos.novaAvancado ? ' open' : '') + '><summary>Opções avançadas (opcional)</summary>' +
        '<fieldset class="an-opcoes" id="anEscopo"><legend>O que você vai analisar?</legend>' + Object.keys(ESCOPO).map(function (k) {
          return '<label class="an-opcao"><input type="radio" name="anEscopo" value="' + k + '"' + ((f.tipoEscopo || 'estrutura') === k ? ' checked' : '') + '><span><strong>' + esc(ESCOPO[k][0]) + '</strong><span class="an-exemplo">' + esc(ESCOPO[k][1]) + '</span></span></label>';
        }).join('') + '</fieldset>' +
        '<p class="an-porque">Por que perguntamos: um escopo amplo costuma reunir mais de uma responsabilidade. A análise não classifica nada — isso é papel do O1–O9, em cada responsabilidade.</p>' +
        '<div class="avp-field"><label for="anDescricao">Descrição <span class="an-opc">(opcional)</span></label><textarea id="anDescricao" rows="2" maxlength="2000">' + esc(f.descricao || '') + '</textarea></div>' +
        '<div class="avp-field"><label for="anCapacidades">Capacidades relacionadas <span class="an-opc">(opcional, separadas por ponto e vírgula; só referência)</span></label><input id="anCapacidades" value="' + esc(f.capacidades || '') + '"></div>' +
        '<fieldset class="an-opcoes" id="anAprofunda" aria-describedby="anAprofundaAjuda"><legend>Você quer aprofundar uma responsabilidade organizacional já registrada na Porta 2?</legend>' +
          '<p class="an-ajuda" id="anAprofundaAjuda">Não é necessário cadastrar uma responsabilidade antes de começar. Se você está investigando uma estrutura ou conjunto de atividades, pode iniciar diretamente por esta análise. As responsabilidades identificadas aqui são registradas na Porta 2 para avaliação.</p>' +
          '<label class="an-opcao"><input type="radio" name="anTemAtuacao" value="nao"' + (f.objetoAmploId ? '' : ' checked') + '><span><strong>Não — começar uma análise nova</strong><span class="an-exemplo">O caso mais comum. As responsabilidades são registradas ao longo da análise.</span></span></label>' +
          '<label class="an-opcao"><input type="radio" name="anTemAtuacao" value="sim"' + (f.objetoAmploId ? ' checked' : '') + (atuacoes.length ? '' : ' disabled') + '><span><strong>Sim — aprofundar uma responsabilidade já registrada</strong><span class="an-exemplo">' + (atuacoes.length ? 'Para uma responsabilidade ampla demais: ela continua como está e passa a aparecer como "delimitada em N responsabilidades".' : 'Ainda não há responsabilidade registrada na Porta 2.') + '</span></span></label>' +
          (atuacoes.length ? '<div class="avp-field an-dependente"><label for="anObjetoAmplo">Qual responsabilidade? <span class="an-opc" id="anObjetoAmploDica">' + (f.objetoAmploId ? '(obrigatória)' : '(só para "Sim")') + '</span></label><select id="anObjetoAmplo" aria-describedby="anObjetoAmploDica"' + (f.objetoAmploId ? '' : ' disabled') + '><option value="">—</option>' +
            atuacoes.map(function (k) { return '<option value="' + esc(k) + '"' + (f.objetoAmploId === k ? ' selected' : '') + '>' + esc(D.objetos[k].nome) + '</option>'; }).join('') + '</select></div>' : '') +
          '<p class="an-nota">Isto se refere às Responsabilidades Organizacionais da Porta 2 (área Avaliação), e não às Estruturas Organizacionais cadastradas no ADMIN.</p></fieldset></details></form>';
    }

    /* ---------- a área e as suas responsabilidades: registrar (uma ou várias) → lista única com o andamento de cada uma → O1–O9 ---------- */
    var GRUPO = { F2a: 0, F2b: 0, F2c: 0, F3: 1, F4: 1, F5: 1, F6: 1, F7: 1, F8: 1, F12: 1, F13: 1, F10: 2, F11: 2 };
    /* "Essa descrição reúne trabalhos diferentes que precisam ser avaliados separadamente?" — atenção: aqui "Não" é
       que NÃO precisa separar (pronta para o O1–O9) */
    var SEP = {
      nao: ['Não', 'Não, pode ser avaliada como está. Uma responsabilidade pode reunir várias atividades sem precisar ser separada.'],
      sim: ['Sim', 'Precisa separar: junta trabalhos diferentes. Você informa as partes; a descrição original fica guardada.'],
      'nao-sei': ['Não sei', 'Fica pendente para você voltar depois. Não vai para o O1–O9 e não impede as outras.']
    };
    var PERGUNTA_SEP = 'Essa descrição reúne trabalhos diferentes que precisam ser avaliados separadamente?';
    /* situação de cada responsabilidade na lista (a pendência de delimitação nunca se mistura com o "A validar" do O1–O9) */
    var SITUACAO = { pendente: ['Pendente de delimitação', 'pend'], pronta: ['Pronta para avaliar', 'neu'], andamento: ['Em avaliação', 'atual'], avaliada: ['Avaliada', 'ok'], avalidar: ['A validar', 'av'] };
    function entregasAtivas(a) { return Object.keys(a.entregas).filter(function (k) { return a.entregas[k].situacao === 'ativa'; }).sort(function (x, y) { return (a.entregas[x].criadaEm || 0) - (a.entregas[y].criadaEm || 0); }); }
    function descrita(e) { var r = e.respostas; return !!(r.F4 && r.F5 && r.F6 && r.F8); }
    function recorteDaEntrega(a, ativos, e) { for (var i = 0; i < ativos.length; i++) if (a.recortes[ativos[i]].entregas.indexOf(e) !== -1) return a.recortes[ativos[i]]; return null; }
    function execOutra(e) { return !!(e.respostas.F7 && e.respostas.F7.valor === 'sim'); }
    function textoResp(r) { return typeof r.descricao === 'string' ? r.descricao : r.nome; }
    function normalizado(t) { return String(t || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
    function emOrdem(a) { return function (x, y) { var rx = a.recortes[x], ry = a.recortes[y]; return (rx.criadoEm || 0) - (ry.criadoEm || 0) || (rx.ordem || 0) - (ry.ordem || 0); }; }
    function nucleosDe(r) { return r.fatos && Array.isArray(r.fatos.execucao) ? r.fatos.execucao : []; }
    function EA() { return window.faEstruturaAtualAdmin; }
    function rotuloUnidade(id) { var t = EA() && EA().rotulo(id); return t || 'Unidade ' + id; }
    function rotuloNucleo(f) { return f.unidadeAtualId ? rotuloUnidade(f.unidadeAtualId) : f.estruturaId ? nomeEstrutura(f.estruturaId) : f.texto; }
    function chaveNucleo(f) { return f.unidadeAtualId ? 'u:' + f.unidadeAtualId : f.estruturaId ? 'e:' + f.estruturaId : 't:' + normalizado(f.texto); }
    /* unidades ativas da Estrutura Atual (lista em árvore) — undefined = lendo; null = indisponível */
    function unidadesAtuais() { return EA() ? EA().unidadesAtivas() : null; }
    function unidadesMapa(lista) { var m = {}; (lista || []).forEach(function (x) { m[x.id] = x.unidade; }); return m; }
    /* sugestão (nunca aplicada sozinha) de qual unidade um texto antigo descreve: mesma sigla ou mesmo nome */
    function unidadeParecida(texto0, us) {
      var t = normalizado(texto0); if (!t || !us) return null;
      for (var i = 0; i < us.length; i++) { var u = us[i].unidade, s = normalizado(u.sigla), n = normalizado(u.nome);
        if (t === n || t === normalizado(EA().rotulo(us[i].id)) || (s && (t === s || t.indexOf(s + ' ') === 0 || t.indexOf(s + ' —') === 0 || t.indexOf(s + ' -') === 0))) return us[i].id; }
      return null;
    }
    /* o tipo arquitetural recomendado (resultado do O1–O9) — nunca "nova estrutura" */
    function tipoRecomendado(p) {
      if (p.estado !== 'concluido') return 'A determinar pelo O1–O9';
      if (p.codigoEfetivo) return nomeCodigo(p.codigoEfetivo) + (p.decisao ? ' (decisão final)' : ' (recomendação)');
      return 'A validar — sem tipo definido ainda';
    }
    /* proposta de composição de uma responsabilidade: a última proposta registrada que a inclui; aprovação SÓ com a
       referência ao ato registrada para aquela proposta (nunca deduzida de um vínculo nem de outra coisa) */
    function propostaDe(est, a, k) {
      var ps = Object.keys(est.propostas).map(function (x) { return est.propostas[x]; }).filter(function (p) { return p.analiseId === a.id && (p.recortes || []).indexOf(k) !== -1; }).sort(function (x, y) { return y.versao - x.versao; });
      if (!ps.length) return 'Nenhuma proposta registrada';
      var p = ps[0], ap = est.aprovacoes[p.id];
      return 'Proposta v' + p.versao + ': ' + (ALTERNATIVA[p.alternativa] || p.alternativa) + (p.situacao === 'pendente' ? ' (pendente)' : '') +
        (ap ? ' — aprovação registrada: ' + ap.autoridade + ', ' + ap.referencia + ', ' + fmtData(ap.dataDoAto) + ' (referência a ato externo)' : ' — sem aprovação registrada');
    }
    /* estrutura com vínculo formal registrado (ficha do Posicionamento): é o vínculo, não uma aprovação do desenho */
    function vinculoFormalDe(r) {
      var v = r.objetoId ? vinculoAtivoDe(r.objetoId) : null;
      return v ? nomeEstrutura(v.estruturaId) : 'Nenhum registrado';
    }
    function situacaoResp(a, k, sf) {
      var r = a.recortes[k], p = sf.p;
      if (r.objetoId) {
        if (p.estado === 'concluido') return { c: p.aValidar ? 'avalidar' : 'avaliada', acao: 'ver', avaliacaoId: p.avaliacaoId };
        if (p.estado === 'em-andamento') return { c: 'andamento', acao: 'continuar', avaliacaoId: p.avaliacaoId };
        return { c: 'pronta', acao: 'iniciar' };
      }
      if (N().prontaParaO1O9(a, k).pronta) return { c: 'pronta', acao: 'avaliar' };
      return { c: 'pendente', acao: r.separacao && r.separacao.valor === 'sim' ? 'separar' : 'revisar' };
    }
    function resumo(a, ativos, sfs) {
      var n = { pendente: 0, pronta: 0, andamento: 0, avaliada: 0, avalidar: 0 };
      var sits = ativos.map(function (k, i) { var s = situacaoResp(a, k, sfs[i]); n[s.c]++; return s; });
      return { n: n, sits: sits };
    }
    function textoResumo(total, n) {
      var partes = [['avaliada', 'avaliada', 'avaliadas'], ['avalidar', 'a validar', 'a validar'], ['andamento', 'em avaliação', 'em avaliação'], ['pronta', 'pronta para avaliar', 'prontas para avaliar'], ['pendente', 'pendente de delimitação', 'pendentes de delimitação']]
        .filter(function (x) { return n[x[0]]; }).map(function (x) { return n[x[0]] + ' ' + (n[x[0]] === 1 ? x[1] : x[2]); });
      return total + ' responsabilidade' + (total === 1 ? '' : 's') + (partes.length ? ' — ' + (partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0]) : '') + '.';
    }
    function rotuloPendencia(a, q) {
      var ent = q.entregaId && a.entregas[q.entregaId] ? ' — entrega "' + a.entregas[q.entregaId].descricao + '"' : '';
      var t = { F4: 'Forma da entrega', F5: 'Para quem é a entrega', F6: 'Quem responde pela entrega', F7: 'Se a execução é para outra estrutura', F8: 'Evidência da entrega', F12: 'Para quem é o padrão ou a capacitação', F13: 'De quem são as regras do serviço ou solução',
        F10: 'Comparar duas entregas parecidas', F11: 'Se política e operação precisam ficar separadas' }[q.pergunta] || q.pergunta;
      if (q.pergunta === 'F10') { var x = a.entregas[q.par[0]], y = a.entregas[q.par[1]]; ent = x && y ? ': "' + x.descricao + '" × "' + y.descricao + '"' : ''; }
      return t + ent;
    }
    function pendenciasHtml(a, lista, aqui) {
      if (!lista.length) return '';
      var n = lista.length;
      return '<details class="an-pendencias" id="anPendenciasDetalhe"><summary>' + n + ' pergunta' + (n === 1 ? '' : 's') + ' do detalhamento em aberto' + (aqui ? '' : ' — aparece' + (n === 1 ? '' : 'm') + ' uma por vez') + ' (não impedem avaliar)</summary><ul>' +
        lista.map(function (q) { return '<li>' + esc(rotuloPendencia(a, q)) + '</li>'; }).join('') + '</ul></details>';
    }
    /* a próxima ação: uma frase e um botão que leva até ela. Uma pendente nunca impede avaliar as outras */
    /* o próximo passo, sempre visível: Adicionar responsabilidades / Continuar avaliação / Avaliar próxima / (registros
       anteriores: Definir delimitação, Separar) / Consultar composição organizacional + Ver resultados */
    function proximaAcao(a, ativos, rs, gravar) {
      if (a.situacao === 'descartada') return { t: 'Análise descartada: só consulta. Nada foi apagado.' };
      if (!gravar) return { t: 'Você está consultando: pode ler tudo, mas gravar é do perfil Avaliação + Configuração.' };
      if (!ativos.length) return { t: 'Informe as responsabilidades da área: cole a lista, uma por linha (ou adicione uma por vez). Pode copiar as atribuições, sem reformular.', rotulo: 'Adicionar responsabilidades', alvo: 'anLoteTexto' };
      var achar = function (acao) { for (var i = 0; i < ativos.length; i++) if (rs.sits[i].acao === acao) return i; return -1; };
      var i = achar('continuar');
      if (i >= 0) return { t: 'Continue o O1–O9 de "' + textoResp(a.recortes[ativos[i]]) + '".', rotulo: 'Continuar avaliação', href: '#avaliacoes?po=' + encodeURIComponent(rs.sits[i].avaliacaoId) };
      i = achar('avaliar');
      if (i >= 0) return { t: 'Avalie "' + textoResp(a.recortes[ativos[i]]) + '" pelo O1–O9.', rotulo: 'Avaliar próxima', avaliar: ativos[i] };
      i = achar('iniciar');
      if (i >= 0) return { t: 'Inicie o O1–O9 de "' + textoResp(a.recortes[ativos[i]]) + '".', rotulo: 'Avaliar próxima', href: '#avaliacoes?po=atuacoes&item=' + encodeURIComponent(a.recortes[ativos[i]].objetoId) };
      i = achar('separar');
      if (i >= 0) return { t: 'Registro anterior: separe "' + textoResp(a.recortes[ativos[i]]) + '" nas partes que a compõem.', rotulo: 'Separar', alvo: 'anSeparar_' + ativos[i] };
      i = achar('revisar');
      if (i >= 0) {
        var r = a.recortes[ativos[i]];
        if (!N().modeloSimples(r)) return { t: 'Registro anterior: complete as informações de "' + textoResp(r) + '" no detalhamento para poder avaliá-la.', rotulo: 'Revisar', alvo: 'anRevisar_' + ativos[i] };
        return { t: 'Registro anterior: "' + textoResp(r) + '" ainda está pendente de delimitação.', rotulo: 'Definir delimitação', alvo: 'anDelimitar_' + ativos[i] };
      }
      return { t: 'Todas as responsabilidades informadas foram avaliadas.', rotulo: 'Consultar composição organizacional', alvo: 'anComposicaoSecao', extra: { rotulo: 'Ver resultados', alvo: 'anResponsabilidades' } };
    }
    function botaoProxima(px) {
      var b = '';
      if (px.href) b = '<a class="btn btn--primary btn--sm" id="anIrProxima" href="' + esc(px.href) + '">' + esc(px.rotulo) + '</a>';
      else if (px.avaliar) b = '<button type="button" class="btn btn--primary btn--sm" data-an="avaliar" data-recorte="' + esc(px.avaliar) + '" id="anIrProxima">' + esc(px.rotulo) + '</button>';
      else if (px.alvo) b = '<button type="button" class="btn btn--primary btn--sm" data-an="ir-para" data-alvo="' + esc(px.alvo) + '" id="anIrProxima">' + esc(px.rotulo) + '</button>';
      if (px.extra) b += '<button type="button" class="btn btn--sm" data-an="ir-para" data-alvo="' + esc(px.extra.alvo) + '" id="anIrProximaExtra">' + esc(px.extra.rotulo) + '</button>';
      return b ? '<div class="an-acoes">' + b + '</div>' : '';
    }
    function renderAnalise(acc) {
      var est = estado(), a = est.analises[st.id];
      if (!a) return voltar('#avaliacoes?an=lista', 'Voltar para as análises', 'anVoltarLista') + '<p class="admin-empty" id="anNaoEncontrada">Análise não encontrada.</p>';
      var pend = N().proximasPerguntas(a), lac = N().lacunas(a), gravar = acc.gravar && a.situacao === 'aberta';
      var ativos = Object.keys(a.recortes).filter(function (k) { return a.recortes[k].situacao === 'ativo'; }).sort(emOrdem(a));
      var sfs = ativos.map(function (k) { return situacaoFormalDe(a.recortes[k]); });
      var rs = resumo(a, ativos, sfs);
      var classificadas = sfs.filter(function (x) { return x.p.estado === 'concluido'; }).length;
      var pendForm = sfs.filter(function (x) { return x.s && x.s !== 'compativel' && x.s !== 'sem-classificacao'; }).length;
      var vig = N().propostaVigente(est, st.id), aprov = vig ? est.aprovacoes[vig.id] : null;
      var decisao = !vig ? 'Sem proposta' : vig.situacao === 'pendente' ? 'Pendente (proposta v' + vig.versao + ')' : aprov ? 'Aprovação registrada (referência a ato externo)' : 'Proposta v' + vig.versao + ', sem aprovação registrada';
      var ents = entregasAtivas(a);
      var ps = { ents: ents, semEntregas: !!(a.respostas.F3 && a.respostas.F3.valor === 'nenhuma'), avaliadas: classificadas, detalhe: pend.filter(function (q) { return GRUPO[q.pergunta] >= 1 && q.pergunta !== 'F3'; }) };
      /* "Detalhar com entregas" fica fora da jornada principal: só aparece quando a pessoa pede ajuda para separar ou
         quando a análise já usa entregas (registros anteriores) */
      var mostrarAjuda = !!st.ajudaSeparar || ents.length > 0;
      var detalharAberto = mostrarAjuda && (st.abertos.detalhar !== undefined ? st.abertos.detalhar : true);
      /* uma pergunta por vez: a do detalhamento (se aberto) ou a F2b, opcional; "Alterar" reabre uma resposta */
      var alterando = gravar && st.form && st.form.tipo === 'alterar-objeto' ? st.form.q : null;
      var f2b = pend.filter(function (q) { return q.pergunta === 'F2b'; });
      var card = null;
      if (gravar && alterando) card = { onde: 'objeto', html: renderPergunta(a, [{ pergunta: alterando }], true) };
      else if (gravar && detalharAberto && ps.detalhe.length) card = { onde: 'detalhe', html: renderPergunta(a, ps.detalhe) };
      else if (gravar && f2b.length) card = { onde: 'objeto', html: renderPergunta(a, f2b, false, true) };
      var px = proximaAcao(a, ativos, rs, gravar);
      var h = voltar('#avaliacoes?an=lista', 'Voltar para as análises', 'anVoltarLista') +
        '<h2 class="an-titulo" id="anTitulo">' + esc(a.nome) + '</h2>' +
        (a.unidadeAtualId ? '<p class="an-nota" id="anUnidadeAtualInfo">Área na Estrutura Organizacional Atual: <strong>' + esc(rotuloUnidade(a.unidadeAtualId)) + '</strong></p>' : '') +
        (a.situacao === 'descartada' ? '<p class="avp-error-msg" id="anDescartada">Análise descartada: ' + esc(a.descarte && a.descarte.motivo) + '. Nada foi apagado.</p>' : '') +
        '<div class="an-proxima" id="anProximaAcao" role="status"><p><strong>Próximo passo:</strong> ' + esc(px.t) + '</p>' + botaoProxima(px) + '</div>' +
        (st.flash ? '<p class="avp-flash-success" id="anFlash" role="status">' + esc(st.flash) + '</p>' : '') +
        (st.erro ? '<p class="avp-error-msg" id="anErro" role="alert">' + esc(st.erro) + '</p>' : '');
      if (!ativos.length) h += renderRegistrar(a, ativos, gravar) + renderListaResp(a, ativos, sfs, rs, gravar);
      else h += renderListaResp(a, ativos, sfs, rs, gravar) + renderRegistrar(a, ativos, gravar);
      h += renderObjeto(a, gravar, card && card.onde === 'objeto' ? card.html : '');
      var apoio = (mostrarAjuda ? renderDetalhar(a, ativos, ps, gravar, detalharAberto, card && card.onde === 'detalhe' ? card.html : '') : '') + renderReferencias(a, gravar);
      if (apoio) h += '<section class="avp-form-card an-secao" id="anApoio" aria-label="Ajuda para separar">' + apoio + '</section>';
      /* detalhes de cada responsabilidade (quem executa e quem responde, situação formal, alternativas, "A validar"):
         recolhidos por padrão para não repetir a lista; abrem sozinhos quando uma ação leva até eles */
      if (ativos.length) {
        var nAV = sfs.filter(function (x) { return x.p.estado === 'concluido' && x.p.aValidar; }).length;
        var abrirDet = st.abertos.detalhesResp || !!(st.form && st.form.tipo === 'fatos');
        h += '<details class="avp-form-card an-secao an-comp-secao" id="anDetalhesResp"' + (abrirDet ? ' open' : '') + '><summary><span id="anDetalhesRespTitulo">Detalhes e análise complementar (opcional)</span>' +
          (nAV ? ' <span class="an-chip an-chip--av" id="anDetalhesAValidar">' + nAV + ' a validar</span>' : '') + '</summary>' +
          '<p class="an-nota">Para cada responsabilidade: quem executa e quem responde formalmente, situação formal, alternativas e o aprofundamento dos casos "A validar".</p>' + renderRecortes(a, ativos, sfs, gravar) + '</details>';
      }
      h += renderComposicaoArea(est, a, ativos, sfs, acc, ps);
      h += '<dl class="an-estados" id="anEstados">' +
        '<div><dt>Avaliadas pelo O1–O9</dt><dd id="anEstadoClassificacao">' + classificadas + ' de ' + ativos.length + ' responsabilidade' + (ativos.length === 1 ? '' : 's') + '</dd></div>' +
        '<div><dt>Diagnóstico de vínculo</dt><dd id="anEstadoDiagnostico">' + (ativos.length ? (pendForm ? pendForm + ' com pendência' : 'sem pendência conhecida') : '—') + '</dd></div>' +
        '<div><dt>Decisão organizacional</dt><dd id="anEstadoDecisao">' + esc(decisao) + '</dd></div></dl>';
      if (lac.length) h += '<section class="avp-form-card an-secao" id="anLacunas"><h3>Lacunas (não impedem continuar)</h3><ul>' + lac.map(function (l) { return '<li>' + esc(textoLacuna(a, l)) + '</li>'; }).join('') + '</ul></section>';
      h += renderHistorico(a);
      h += '<div class="avp-actions-footer an-rodape"><button type="button" class="btn btn--sm" id="anExportarBtn" data-an="exportar">📊 Exportar Excel</button>' +
        (gravar ? '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="descartar" id="anDescartarBtn">Descartar a análise</button>' : '') +
        (acc.gravar ? '<button type="button" class="btn btn--sm btn--danger" data-an="abrir-form" data-form="excluir-analise" id="anExcluirBtn">Excluir a análise</button>' : '') + '</div>';
      if (st.form && st.form.tipo === 'excluir-analise') h += renderExcluirAnalise(est, a);
      if (st.form && st.form.tipo === 'descartar') h += '<form class="avp-form-card an-form" id="anFormDescartar"><div class="avp-field"><label for="anMotivoDescarte">Motivo do descarte</label><textarea id="anMotivoDescarte" maxlength="500" rows="2"></textarea></div><p class="an-nota">Nada é apagado: a análise fica no histórico como descartada.</p><div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="anConfirmarDescarte">Descartar</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      return h;
    }
    /* EXCLUSÃO da análise (contrato em dois níveis): comum = vazia; excepcional = com conteúdo, só admin geral, com
       confirmação explícita e as dependências à vista (nada sai em cascata); com aprovação registrada, nunca */
    function ehAdminGeral() { var A = window.faAuth, s = A && A.getSession && A.getSession(); return !!(A && A.isAdmin && s && A.isAdmin(s.email)); }
    function renderExcluirAnalise(est, a) {
      var n = N().nivelExclusaoAnalise(est, a.id), h = '<form class="avp-form-card an-form" id="anFormExcluir" data-nivel="' + n.nivel + '"><h3>' + (n.nivel === 'excepcional' ? 'Exclusão excepcional da análise' : 'Excluir a análise?') + '</h3>';
      if (n.nivel === 'bloqueada') return h + '<p class="avp-error-msg" id="anExcluirBloqueio">' + esc(mensagemErro({ codigo: n.motivos[0] })) + '</p><div class="avp-actions-footer"><button type="button" class="btn btn--sm" data-an="cancelar">Fechar</button></div></form>';
      if (n.nivel === 'excepcional' && !ehAdminGeral()) return h + '<p class="an-nota" id="anExcluirSoAdmin">Esta análise já tem conteúdo (responsabilidades, proposta ou referências). Excluí-la é uma exclusão excepcional, feita só pelo administrador geral. Se ela não serve mais, use "Descartar a análise".</p><div class="avp-actions-footer"><button type="button" class="btn btn--sm" data-an="cancelar">Fechar</button></div></form>';
      var rs = a.recortes || {}, ks = Object.keys(rs), comCad = ks.filter(function (k) { return rs[k].objetoId; });
      var props = Object.keys(est.propostas || {}).filter(function (k) { return est.propostas[k].analiseId === a.id; }).length;
      h += '<p class="an-nota">A análise sai de verdade (não fica como descartada). Fica um registro mínimo com o nome, o motivo, quem excluiu e quando.</p>';
      if (n.nivel === 'excepcional') h += '<p><strong>Dependências:</strong></p><ul class="an-exc-deps" id="anExcluirDeps">' +
        (ks.length ? '<li>' + ks.length + ' responsabilidade' + (ks.length === 1 ? '' : 's') + ' registrada' + (ks.length === 1 ? '' : 's') + ' nesta análise — saem com ela</li>' : '') +
        (comCad.length ? '<li>' + comCad.length + ' com cadastro na Porta 2 — os cadastros e as avaliações deles CONTINUAM (não são excluídos em cascata); a ligação com a análise passa a indicar "análise excluída"</li>' : '') +
        (props ? '<li>' + props + ' proposta' + (props === 1 ? '' : 's') + ' de composição — continua' + (props === 1 ? '' : 'm') + ' guardada' + (props === 1 ? '' : 's') + ' como histórico</li>' : '') +
        (Object.keys(a.referencias || {}).length ? '<li>Referências a responsabilidades de outras análises — as de origem não mudam</li>' : '') + '</ul>';
      h += '<div class="avp-field"><label for="anMotivoExcluir">Motivo da exclusão *</label><textarea id="anMotivoExcluir" maxlength="500" rows="2"></textarea></div>' +
        (n.nivel === 'excepcional' ? '<label class="avp-decisao-option"><input type="checkbox" id="anExcluirConfirmo"> Confirmo a exclusão excepcional desta análise, com as dependências acima.</label>' : '') +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="anConfirmarExcluir">' + (n.nivel === 'excepcional' ? 'Excluir (excepcional)' : 'Excluir a análise') + '</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      return h;
    }
    /* a área ou o trabalho analisado (contexto). O texto livre é só apoio: nada é interpretado */
    function renderObjeto(a, gravar, card) {
      var amplo = a.objetoAmploId ? (D.objetos || {})[a.objetoAmploId] : null, h = '<details class="avp-form-card an-secao an-comp-secao an-objeto" id="anObjeto"' + (st.abertos.objeto || (st.form && st.form.tipo === 'alterar-objeto') ? ' open' : '') + '><summary>Mais sobre a área (opcional)</summary><dl class="an-objeto-dl">' +
        '<div><dt>Área ou trabalho</dt><dd id="anObjetoEscopo">' + esc(ESCOPO[a.tipoEscopo] ? ESCOPO[a.tipoEscopo][0] : a.tipoEscopo) + '</dd></div>' +
        (a.descricao ? '<div><dt>Descrição</dt><dd id="anObjetoDescricao">' + esc(a.descricao) + '</dd></div>' : '') +
        (a.capacidades.length ? '<div><dt>Capacidades (só referência)</dt><dd>' + a.capacidades.map(function (c) { return esc(c.rotulo); }).join(', ') + '</dd></div>' : '') +
        (a.objetoAmploId ? '<div><dt>Aprofunda a responsabilidade da Porta 2</dt><dd>' + esc(amplo ? amplo.nome : a.objetoAmploId) + '</dd></div>' : '');
      ['F2a', 'F2b', 'F2c'].forEach(function (q) {
        var r = a.respostas[q]; if (!r) return;
        var ref = q === 'F2b' ? N().cadastroReferido(a) : null;
        h += '<div><dt>' + esc(TEXTO_PERGUNTA[q] ? TEXTO_PERGUNTA[q].curta : q) + '</dt><dd id="anObjeto' + q + '">' + esc((ROT[q] || {})[r.valor] || r.valor) + (ref ? ': ' + esc(nomeEstrutura(ref)) : '') +
          (gravar && !card && q === 'F2b' ? ' <button type="button" class="btn btn--sm an-alterar" data-an="abrir-form" data-form="alterar-objeto" data-q="' + q + '" id="anAlterar' + q + '">Alterar</button>' : '') + '</dd></div>';
      });
      return h + '</dl>' + (a.descricao ? '<p class="an-nota">A descrição é só apoio para você: o sistema não tira dela nenhuma responsabilidade nem classificação.</p>' : '') + card + '</details>';
    }
    function quandoSepararHtml() {
      return '<details class="an-conceitos" id="anQuandoSeparar"' + (st.abertos.quandoSeparar ? ' open' : '') + '><summary>Quando é preciso separar?</summary><ul class="an-fronteiras">' +
        '<li>Separe quando a descrição juntar trabalhos que poderiam existir de forma independente. Exemplo hipotético: "Gerir o orçamento e atender fornecedores".</li>' +
        '<li>Ter várias entregas ou atender públicos diferentes, sozinho, não é motivo para separar.</li>' +
        '<li>Uma área pode ter responsabilidades de naturezas diferentes; identificar várias não cria várias estruturas.</li>' +
        '<li>O O1–O9 avalia a responsabilidade informada, não a área inteira nem o núcleo onde ela é exercida. A sua resposta é uma confirmação, não uma prova: o O1–O9 ainda pode indicar algo a validar.</li></ul></details>';
    }
    function radiosSeparacao(nome, atual, opcional) {
      return '<fieldset class="an-opcoes" id="' + nome + 'Grupo"><legend>' + esc(PERGUNTA_SEP) + (opcional ? ' <span class="an-opc">(pode responder depois, na lista)</span>' : '') + '</legend>' +
        Object.keys(SEP).map(function (v) { return '<label class="an-opcao"><input type="radio" name="' + nome + '" value="' + v + '"' + (atual === v ? ' checked' : '') + '><span><strong>' + esc(SEP[v][0]) + '</strong><span class="an-exemplo">' + esc(SEP[v][1]) + '</span></span></label>'; }).join('') + '</fieldset>';
    }
    /* a lista única da área: o ponto de acompanhamento das avaliações */
    function renderListaResp(a, ativos, sfs, rs, gravar) {
      var desd = Object.keys(a.recortes).filter(function (k) { return a.recortes[k].situacao === 'desdobrado'; }).sort(emOrdem(a));
      var h = '<section class="avp-form-card an-secao" id="anResponsabilidades" aria-labelledby="anListaTitulo"><h3 id="anListaTitulo">' + esc(a.nome) + ' — Responsabilidades Organizacionais</h3>';
      if (!ativos.length && !desd.length) return h + '<p class="admin-empty" id="anRespVazio">Nenhuma responsabilidade informada ainda. Assim que registrar, cada uma aparece aqui pronta para avaliar.</p></section>';
      h += '<p class="an-resumo" id="anResumo">' + esc(textoResumo(ativos.length, rs.n)) + '</p>' +
        '<details class="an-conceitos" id="anLegendaLista"><summary>O que significa cada coluna?</summary><p class="an-nota"><strong>Quem executa hoje</strong> é a informação declarada de quem faz o trabalho — não é vínculo nem responsabilidade formal. <strong>Tipo recomendado</strong> é o tipo arquitetural que o O1–O9 recomenda para a responsabilidade — não é uma nova estrutura e não cria, renomeia nem muda unidade nenhuma. O vínculo formal registrado e a proposta de composição (com a eventual aprovação) ficam na composição organizacional.</p></details>' +
        '<div class="an-tabela" role="table" aria-label="Responsabilidades e andamento"><div class="an-tab-cab" role="row"><span role="columnheader">Responsabilidade</span><span role="columnheader">Quem executa hoje</span><span role="columnheader">Tipo recomendado</span><span role="columnheader">Situação</span><span role="columnheader">Ação</span></div>';
      ativos.forEach(function (k, i) {
        var r = a.recortes[k], s = rs.sits[i], p = sfs[i].p, origem = r.origemRecorteId ? a.recortes[r.origemRecorteId] : null, nucs = nucleosDe(r), sep = r.separacao ? r.separacao.valor : null;
        var acao = '';
        if (s.acao === 'avaliar') acao = gravar ? '<button type="button" class="btn btn--sm" data-an="avaliar" data-recorte="' + esc(k) + '" id="anCriarAtuacao_' + esc(k) + '">Avaliar</button>' : '';
        else if (s.acao === 'iniciar') acao = '<a class="btn btn--sm" href="#avaliacoes?po=atuacoes&item=' + encodeURIComponent(r.objetoId) + '" id="anAbrirPos_' + esc(k) + '">Avaliar</a>';
        else if (s.acao === 'continuar') acao = '<a class="btn btn--sm" href="#avaliacoes?po=' + encodeURIComponent(s.avaliacaoId) + '" id="anAbrirPos_' + esc(k) + '">Continuar</a>';
        else if (s.acao === 'ver') acao = '<a class="btn btn--sm" href="#avaliacoes?po=' + encodeURIComponent(s.avaliacaoId) + '" id="anAbrirPos_' + esc(k) + '">Ver resultado</a>';
        else if (gravar && s.acao === 'separar') acao = '<button type="button" class="btn btn--sm btn--primary" data-an="abrir-form" data-form="separar" data-recorte="' + esc(k) + '" id="anSeparar_' + esc(k) + '">Separar</button>';
        else if (gravar && N().modeloSimples(r)) acao = '<button type="button" class="btn btn--sm btn--primary" data-an="abrir-form" data-form="delimitar" data-recorte="' + esc(k) + '" id="anDelimitar_' + esc(k) + '">Definir delimitação</button>';
        else if (gravar) acao = '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="revisar" data-recorte="' + esc(k) + '" id="anRevisar_' + esc(k) + '">Revisar</button>';
        /* ações secundárias recolhidas em "Mais", para a linha mostrar só a principal */
        if (gravar) acao += '<details class="an-mais" id="anMais_' + esc(k) + '"' + (st.abertos.mais === k ? ' open' : '') + '><summary>Mais</summary><div class="an-mais-itens">' +
          '<button type="button" class="btn btn--sm an-link" data-an="abrir-form" data-form="nucleos" data-recorte="' + esc(k) + '" id="anNucleos_' + esc(k) + '">' + (nucs.length ? 'Alterar quem executa hoje' : 'Informar quem executa hoje') + '</button>' +
          (!r.objetoId && (s.acao !== 'revisar' || N().modeloSimples(r)) ? '<button type="button" class="btn btn--sm an-link" data-an="abrir-form" data-form="revisar" data-recorte="' + esc(k) + '" id="anRevisar_' + esc(k) + '">' + (N().registroDireto(r) ? 'Editar o texto' : 'Revisar o texto') + '</button>' : '') +
          (!r.objetoId ? '<button type="button" class="btn btn--sm an-link" data-an="abrir-form" data-form="descartar-recorte" data-recorte="' + esc(k) + '" id="anDescartarResp_' + esc(k) + '">Descartar</button>' +
            '<button type="button" class="btn btn--sm an-link an-link--perigo" data-an="abrir-form" data-form="excluir-recorte" data-recorte="' + esc(k) + '" id="anExcluirResp_' + esc(k) + '">Excluir</button>'
            : (D.objetos || {})[r.objetoId] ? '<a class="btn btn--sm an-link an-link--perigo" href="#avaliacoes?po=atuacoes&item=' + encodeURIComponent(r.objetoId) + '" id="anExcluirCadastro_' + esc(k) + '">Excluir o cadastro…</a>' : '') + '</div></details>';
        h += '<div class="an-linha an-resp" role="row" data-resp="' + esc(k) + '" data-situacao="' + s.c + '">' +
          '<div class="an-cel an-cel--resp" role="cell"><strong>' + esc(textoResp(r)) + '</strong>' + (origem ? '<span class="an-det">Parte de: "' + esc(textoResp(origem)) + '"</span>' : '') +
          (r.objetoId && !(D.objetos || {})[r.objetoId] && (D.objExcluidos || {})[r.objetoId] ? '<span class="an-det an-det--excluido" id="anCadastroExcluido_' + esc(k) + '">Cadastro excluído em ' + esc(fmtData(D.objExcluidos[r.objetoId].excluidoEm)) + ': ' + esc(D.objExcluidos[r.objetoId].motivo) + '. O que foi avaliado continua no histórico.</span>' : '') +
'</div>' +
          '<div class="an-cel" role="cell" data-rotulo="Quem executa hoje"><span id="anNucleosTexto_' + esc(k) + '">' + (nucs.length ? nucs.map(function (f) { return esc(rotuloNucleo(f)); }).join('; ') : 'Não informado') + '</span></div>' +
          '<div class="an-cel" role="cell" data-rotulo="Tipo recomendado"><span id="anTipo_' + esc(k) + '">' + esc(tipoRecomendado(p)) + '</span></div>' +
          '<div class="an-cel" role="cell" data-rotulo="Situação"><span class="an-chip an-chip--' + SITUACAO[s.c][1] + '" id="anSituacao_' + esc(k) + '">' + SITUACAO[s.c][0] + '</span>' +
            (s.c === 'pendente' ? '<span class="an-det">Registro anterior' + (sep === 'sim' ? ': precisa separar' : sep === 'nao-sei' ? ': respondido "não sei"' : '') + '</span>' : '') + '</div>' +
          '<div class="an-cel an-cel--acao" role="cell" data-rotulo="Ação">' + acao + '</div>';
        h += renderFormsLinha(a, r, k) + '</div>';
      });
      h += desd.map(function (k) {
        var r = a.recortes[k], partes = ((r.desdobramento || {}).partes || []).map(function (q) { return a.recortes[q] ? textoResp(a.recortes[q]) : q; });
        return '<div class="an-linha an-resp--desdobrada" role="row" data-desdobrada="' + esc(k) + '"><div class="an-cel an-cel--resp" role="cell"><strong>' + esc(textoResp(r)) + '</strong>' +
          '<span class="an-det">Descrição original, preservada. Separada em: ' + partes.map(function (q) { return '"' + esc(q) + '"'; }).join('; ') + '. Não é avaliada como um todo.</span></div>' +
          '<div class="an-cel" role="cell" data-rotulo="Quem executa hoje">—</div><div class="an-cel" role="cell" data-rotulo="Tipo recomendado">—</div><div class="an-cel" role="cell" data-rotulo="Situação"><span class="an-chip an-chip--neu">Separada em ' + partes.length + ' partes</span></div>' +
          '<div class="an-cel an-cel--acao" role="cell">' + (gravar ? '<button type="button" class="btn btn--sm an-link an-link--perigo" data-an="abrir-form" data-form="excluir-recorte" data-recorte="' + esc(k) + '" id="anExcluirResp_' + esc(k) + '">Excluir</button>' : '') + '</div>' + renderFormsLinha(a, r, k) + '</div>';
      }).join('');
      return h + '</div></section>';
    }
    function renderFormsLinha(a, r, k) {
      if (!st.form || st.form.recorte !== k) return '';
      var t = st.form.tipo, sep = r.separacao ? r.separacao.valor : null;
      var direto = N().registroDireto(r);
      if (t === 'revisar') return '<form class="an-form an-linha-form" id="anFormRevisar" data-recorte="' + esc(k) + '"><h4>' + (direto ? 'Editar o texto da responsabilidade' : 'Revisar a responsabilidade') + '</h4>' +
        '<div class="avp-field"><label for="anRevDesc">Descrição</label><textarea id="anRevDesc" rows="2" maxlength="2000">' + esc(textoResp(r)) + '</textarea></div>' +
        (direto ? '' : radiosSeparacao('anRevSep', sep) +
        '<div class="avp-field"><label for="anRevObs">Observação <span class="an-opc">(opcional)</span></label><input id="anRevObs" maxlength="2000" value="' + esc(r.separacao && r.separacao.observacao || '') + '"></div>') +
        '<p class="an-nota">A versão anterior fica no histórico.</p><div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anGravarRevisao">' + (direto ? 'Gravar o texto' : 'Gravar a revisão') + '</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      /* a pergunta de delimitação, só quando a pessoa pede ("Definir delimitação") */
      if (t === 'delimitar') return '<div class="an-form an-linha-form an-delim" id="anPainelDelim_' + esc(k) + '" role="group" aria-labelledby="anPerguntaDelim_' + esc(k) + '"><p id="anPerguntaDelim_' + esc(k) + '"><strong>' + esc(PERGUNTA_SEP) + '</strong></p>' +
        '<p class="an-nota">Uma responsabilidade pode reunir várias atividades sem precisar ser separada.</p><div class="an-acoes">' +
        '<button type="button" class="btn btn--sm btn--primary" data-an="responder-sep" data-v="nao" data-recorte="' + esc(k) + '" id="anSepNao_' + esc(k) + '">Não, pode ser avaliada como está</button>' +
        '<button type="button" class="btn btn--sm" data-an="responder-sep" data-v="sim" data-recorte="' + esc(k) + '" id="anSepSim_' + esc(k) + '">Sim, precisa separar</button>' +
        (sep !== 'nao-sei' ? '<button type="button" class="btn btn--sm" data-an="responder-sep" data-v="nao-sei" data-recorte="' + esc(k) + '" id="anSepNaoSei_' + esc(k) + '">Não sei</button>' : '') +
        '<button type="button" class="btn btn--sm an-link" data-an="ajuda-separar" id="anAjudaSeparar_' + esc(k) + '">Preciso de ajuda para separar</button>' +
        '<button type="button" class="btn btn--sm an-link" data-an="cancelar">Cancelar</button></div></div>';
      if (t === 'separar') return renderFormSeparar(r, k);
      if (t === 'nucleos') return renderFormNucleos(r, k);
      if (t === 'atuacao') return renderFormRecorte(a, r, k);
      if (t === 'excluir-recorte') {
        var bl = N().bloqueiosExclusaoRecorte(estado(), a, k);
        if (bl.length) return '<div class="an-form an-linha-form" id="anExcluirRespBloqueio"><p class="avp-error-msg">' + esc(mensagemErro(bl[0])) + '</p><div class="avp-actions-footer"><button type="button" class="btn btn--sm" data-an="cancelar">Fechar</button></div></div>';
        var partesX = r.situacao === 'desdobrado' && r.desdobramento ? (r.desdobramento.partes || []).filter(function (q) { return a.recortes[q]; }) : [];
        return '<form class="an-form an-linha-form" data-form="excluir-recorte" data-recorte="' + esc(k) + '" id="anFormExcluirResp"><h4>Excluir esta responsabilidade?</h4>' +
          '<p class="an-nota"><strong>Excluir</strong> é para o que foi registrado por engano: a responsabilidade sai da análise (não fica como descartada). O histórico da análise guarda o texto excluído, quem excluiu, quando e o motivo. <strong>Descartar</strong> a mantém na análise como descartada.</p>' +
          (partesX.length ? '<p class="an-nota" id="anExcluirPartes">Saem junto as partes: ' + partesX.map(function (q) { return '"' + esc(textoResp(a.recortes[q])) + '"'; }).join('; ') + '.</p>' : '') +
          '<div class="avp-field"><label for="anMotivoExcluirRec">Motivo da exclusão *</label><input id="anMotivoExcluirRec" maxlength="500"></div>' +
          '<div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="anConfirmarExcluirResp">Excluir a responsabilidade</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      }
      if (t === 'descartar-recorte') return '<form class="an-form an-linha-form" data-form="descartar-recorte" data-recorte="' + esc(k) + '"><div class="avp-field"><label for="anMotivoRec">Motivo</label><input id="anMotivoRec" maxlength="500"></div><p class="an-nota">Nada é apagado: a responsabilidade fica no histórico como descartada.</p><div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="anConfirmarDescarteResp">Descartar a responsabilidade</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      return '';
    }
    /* núcleos atuais: um ou vários, do cadastro do ADMIN ou só descritos — informação declarada, nunca vínculo */
    function renderFormNucleos(r, k) {
      var atuais = nucleosDe(r), ids = {}, uas = {}, textos = [];
      atuais.forEach(function (f) { if (f.unidadeAtualId) uas[f.unidadeAtualId] = true; else if (f.estruturaId) ids[f.estruturaId] = true; else textos.push(f.texto); });
      var a0 = estado().analises[st.id] || {}, todas = unidadesAtuais();
      /* com a área escolhida, as unidades dela (subordinadas em qualquer nível) aparecem primeiro; as outras ficam recolhidas */
      var daArea = todas && a0.unidadeAtualId ? todas.filter(function (x) { return x.id !== a0.unidadeAtualId && window.faEstruturaAtualNucleo.ancestrais({ unidades: unidadesMapa(todas) }, x.id).indexOf(a0.unidadeAtualId) !== -1; }) : todas;
      var outras = todas && daArea !== todas ? todas.filter(function (x) { return daArea.indexOf(x) === -1; }) : [];
      var caixa = function (x) { return '<label class="an-opcao"><input type="checkbox" name="anNucUA" value="' + esc(x.id) + '"' + (uas[x.id] ? ' checked' : '') + '><span>' + esc(EA().rotulo(x.id)) + '</span></label>'; };
      var blocoUA = todas === undefined ? '<p class="an-nota" id="anNucUALendo">Lendo a Estrutura Organizacional Atual…</p>' : !todas || !todas.length ? '' :
        '<fieldset class="an-opcoes" id="anNucUAGrupo"><legend>Unidades da Estrutura Organizacional Atual' + (a0.unidadeAtualId ? ' — ' + esc(rotuloUnidade(a0.unidadeAtualId)) : '') + '</legend>' + (daArea.length ? daArea.map(caixa).join('') : '<p class="an-nota">Nenhuma subordinada cadastrada.</p>') + '</fieldset>' +
        (outras.length ? '<details class="an-conceitos" id="anNucUAOutras"' + (outras.some(function (x) { return uas[x.id]; }) ? ' open' : '') + '><summary>Outras unidades</summary><div class="an-opcoes">' + outras.map(caixa).join('') + '</div></details>' : '');
      var sugeridas = textos.map(function (t, i) { var u = unidadeParecida(t, todas); return u && !uas[u] ? { i: i, t: t, u: u } : null; }).filter(Boolean);
      var blocoRel = sugeridas.length ? '<fieldset class="an-opcoes" id="anNucRelGrupo"><legend>Relacionar registros anteriores à Estrutura Atual <span class="an-opc">(só se você confirmar)</span></legend>' + sugeridas.map(function (s) {
        return '<label class="an-opcao"><input type="checkbox" name="anNucRel" value="' + esc(s.t) + '" data-unidade="' + esc(s.u) + '"><span>"' + esc(s.t) + '" é a unidade <strong>' + esc(EA().rotulo(s.u)) + '</strong></span></label>'; }).join('') +
        '<p class="an-nota">Nada é relacionado pelo nome sem a sua confirmação. Marcado, o texto passa a apontar a unidade (o anterior fica no histórico).</p></fieldset>' : '';
      var ests = D.estruturas ? Object.keys(D.estruturas).filter(function (x) { return D.estruturas[x].situacao === 'ativa'; }).sort(function (x, y) { return String(D.estruturas[x].nome).localeCompare(D.estruturas[y].nome); }) : [];
      return '<form class="an-form an-linha-form" id="anFormNucleos" data-recorte="' + esc(k) + '"><h4>Qual núcleo ou quais núcleos executam esta responsabilidade hoje?</h4>' +
        '<p class="an-nota">Opcional. Informe só o que se sabe — nada é associado pelo nome. É informação declarada: não cria estrutura, não cria vínculo formal e não muda o Mapa nem o O1–O9.</p>' +
        blocoUA + blocoRel +
        (ests.length ? '<fieldset class="an-opcoes"><legend>Cadastrados em ADMIN › Avaliação e Mapa › Estruturas Organizacionais</legend>' + ests.map(function (x) { return '<label class="an-opcao"><input type="checkbox" name="anNucEst" value="' + esc(x) + '"' + (ids[x] ? ' checked' : '') + '><span>' + esc(D.estruturas[x].nome) + '</span></label>'; }).join('') + '</fieldset>'
          : '') +
        '<div class="avp-field"><label for="anNucOutros">Núcleos que não estão em nenhum cadastro <span class="an-opc">(um por linha)</span></label><textarea id="anNucOutros" rows="3" maxlength="2000" placeholder="Ex.: CONTA — Núcleo de Contabilidade">' + esc(textos.join('\n')) + '</textarea></div>' +
        '<div class="avp-field"><label for="anNucFonte">Fonte <span class="an-opc">(opcional)</span></label><input id="anNucFonte" maxlength="2000" placeholder="Ex.: regimento da gerência"></div>' +
        '<p class="an-nota">Deixe tudo em branco para "Não informado". O histórico guarda o que havia antes.</p>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anGravarNucleos">Gravar</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
    }
    /* separar: a pessoa informa as partes (duas ou mais), cada uma com a sua resposta. Nada é sugerido nem inventado */
    function renderFormSeparar(r, k) {
      var n = Math.max(2, st.form.partes || 2), v = st.form.valores || [];
      var h = '<form class="an-form an-linha-form" id="anFormSeparar" data-recorte="' + esc(k) + '"><h4>Separar em responsabilidades</h4><p class="an-nota">Descrição original (fica guardada): "' + esc(textoResp(r)) + '". Informe cada parte com as suas palavras — pode copiar trechos do texto.</p>';
      for (var i = 0; i < n; i++) {
        var x = v[i] || {};
        h += '<fieldset class="an-parte" id="anParte' + i + '"><legend>Parte ' + (i + 1) + '</legend><div class="avp-field"><label for="anParteDesc' + i + '">Descreva a parte ' + (i + 1) + '</label><textarea id="anParteDesc' + i + '" rows="2" maxlength="2000">' + esc(x.descricao || '') + '</textarea></div></fieldset>';
      }
      return h + '<p class="an-nota">Cada parte fica pronta para avaliar pelo O1–O9.</p><div class="avp-actions-footer"><button type="button" class="btn btn--sm" data-an="mais-parte" id="anMaisParte">+ Outra parte</button>' + '<button type="button" class="btn btn--sm an-link" data-an="ajuda-separar" id="anAjudaSepararPartes">Preciso de ajuda para separar</button>' + '<button type="submit" class="btn btn--primary" id="anConfirmarSeparar">Separar</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
    }
    /* registrar: uma por vez (descrição + a pergunta, que pode ficar para depois) ou várias de uma vez (colar a lista) */
    function renderRegistrar(a, ativos, gravar) {
      if (!gravar) return '';
      var fr = st.flashResp && Object.keys(a.recortes).some(function (k) { return textoResp(a.recortes[k]) === st.flashResp.descricao; }) ? st.flashResp : null;
      var flash = (fr ? '<p class="avp-flash-success" id="anRespFeedback" role="status">Responsabilidade registrada: "' + esc(fr.descricao) + '". Pronta para avaliar: use "Avaliar" na lista.' +
          ' Total: ' + ativos.length + ' responsabilidade' + (ativos.length === 1 ? '' : 's') + '.</p>' : '') +
        (st.flashLote ? '<p class="avp-flash-success" id="anLoteFeedback" role="status">' + esc(st.flashLote) + '</p>' : '');
      /* Passo 2: a pessoa informa responsabilidades já individualizadas — colar a lista é a ação principal; uma por vez
         continua disponível. Com responsabilidades já registradas, o bloco fica recolhido ("Adicionar responsabilidades") */
      var uma = st.form && st.form.tipo === 'uma', lote = st.form && st.form.tipo === 'lote';
      var corpo = uma ? '<form class="an-form" id="anFormResponsabilidade"><h3 id="anFormRespTitulo">Adicionar uma responsabilidade</h3>' +
        '<div class="avp-field"><label for="anRespDesc">Descrição da responsabilidade</label><textarea id="anRespDesc" rows="2" maxlength="2000" aria-describedby="anRespAjuda" placeholder="Ex.: Gerir o planejamento e execução orçamentária."></textarea>' +
        '<p class="an-ajuda" id="anRespAjuda">Você pode copiar diretamente uma atribuição da área. Não precisa reformular o texto.</p></div>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anRegistrarRespBtn"' + (st.gravando ? ' disabled' : '') + '>Registrar responsabilidade</button>' +
        '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="lote" id="anAbrirLote">Colar várias de uma vez</button></div></form>'
        : renderLote(a, lote ? st.form : { tipo: 'lote' });
      var aberto = !ativos.length || uma || lote || (!!st.abertos.adicionar && !fr && !st.flashLote);
      /* ajuda opcional (nunca condição para avaliar): o detalhamento por entregas, para quem não sabe quais são as responsabilidades */
      var ajuda = st.ajudaSeparar || entregasAtivas(a).length ? '' : '<p class="an-nota"><button type="button" class="btn btn--sm an-link" data-an="ajuda-separar" id="anAjudaSeparar">Não sabe quais são as responsabilidades? Detalhar com entregas (opcional)</button></p>';
      return flash + '<details class="avp-form-card an-secao an-comp-secao" id="anRegistrar"' + (aberto ? ' open' : '') + '><summary id="anRegistrarTitulo">' + (ativos.length ? 'Adicionar responsabilidades' : 'Quais responsabilidades a área tem?') + '</summary>' + corpo + ajuda + '</details>';
    }
    /* lote: só separa por linha — nada de ponto e vírgula, numeração (a não ser que a pessoa peça), junção ou divisão */
    function linhasDoLote(texto, semNumeracao) {
      return String(texto || '').split(/\r?\n/).map(function (l) { var t = l.trim(); if (semNumeracao) t = t.replace(/^(\d{1,3}\s*[.)\-–]|[-–•*])\s+/, '').trim(); return t; }).filter(function (t) { return t.length > 0; });
    }
    function marcarDuplicadas(a, itens) {
      var existentes = {}, vistos = {};
      Object.keys(a.recortes).forEach(function (k) { if (a.recortes[k].situacao === 'ativo') existentes[normalizado(textoResp(a.recortes[k]))] = true; });
      return itens.map(function (t) { var n = normalizado(t), dup = existentes[n] ? 'ja-existe' : vistos[n] ? 'repetida' : null; vistos[n] = true; return { texto: t, duplicada: dup, incluir: !dup }; });
    }
    function rotuloLote(n) { return 'Registrar ' + n + ' responsabilidade' + (n === 1 ? '' : 's'); }
    /* o que foi editado ou desmarcado na prévia volta para o estado antes de redesenhar ou gravar */
    function sincronizarLote() {
      ((st.form && st.form.previa) || []).forEach(function (x, i) { var t = document.getElementById('anLoteItem_' + i), c = document.getElementById('anLoteInc_' + i); if (t) x.texto = t.value; if (c) x.incluir = c.checked; });
    }
    function renderLote(a, f) {
      if (!f.previa) return '<form class="an-form" id="anFormLote" aria-labelledby="anLoteTitulo"><h3 id="anLoteTitulo">Cole suas responsabilidades, uma por linha.</h3>' +
        '<p class="an-ajuda" id="anLoteAjuda">O texto de cada linha é registrado como está — nada é reescrito, dividido, juntado ou associado a núcleo. Ponto e vírgula não separa itens. Você confere tudo numa prévia antes de registrar.</p>' +
        '<div class="avp-field"><label for="anLoteTexto">Responsabilidades da área</label><textarea id="anLoteTexto" rows="8" maxlength="60000" aria-describedby="anLoteAjuda">' + esc(f.texto || '') + '</textarea></div>' +
        '<label class="an-opcao an-opcao--linha"><input type="checkbox" id="anLoteNumeracao"' + (f.semNumeracao ? ' checked' : '') + '><span>Tirar a numeração do início das linhas (ex.: "1. ", "2) ", "- ")</span></label>' +
        '<div class="avp-actions-footer"><button type="button" class="btn btn--primary" data-an="lote-previa" id="anLotePrevia">Ver a prévia</button><button type="button" class="btn btn--sm" data-an="abrir-form" data-form="uma" id="anAbrirUma">Adicionar uma por vez</button>' + (st.form && st.form.tipo === 'lote' ? '<button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button>' : '') + '</div></form>';
      var n = f.previa.filter(function (x) { return x.incluir; }).length;
      return '<form class="an-form" id="anFormLote" aria-labelledby="anLoteTitulo"><h3 id="anLoteTitulo">Prévia: ' + f.previa.length + ' linha' + (f.previa.length === 1 ? '' : 's') + '</h3>' +
        '<p class="an-ajuda">Desmarque o que não quer registrar; use "Editar" para corrigir um texto. Cada item registrado fica pronto para avaliar pelo O1–O9.</p><ol class="an-lote" id="anLoteLista">' +
        f.previa.map(function (x, i) {
          var ed = f.editando && f.editando[i];
          return '<li class="an-lote-item' + (x.duplicada ? ' an-lote-item--dup' : '') + '"><div class="an-lote-linha"><input type="checkbox" name="anLoteInc" value="' + i + '" id="anLoteInc_' + i + '"' + (x.incluir ? ' checked' : '') + ' aria-labelledby="anLoteTxt_' + i + '">' +
            (ed ? '<label class="sr-only" for="anLoteItem_' + i + '">Texto do item ' + (i + 1) + '</label><textarea id="anLoteItem_' + i + '" rows="2" maxlength="2000">' + esc(x.texto) + '</textarea><span class="sr-only" id="anLoteTxt_' + i + '">Item ' + (i + 1) + '</span>'
              : '<label for="anLoteInc_' + i + '" class="an-lote-texto" id="anLoteTxt_' + i + '">' + esc(x.texto) + '</label>') +
            '<button type="button" class="btn btn--sm an-link" data-an="lote-editar" data-i="' + i + '" id="anLoteEditar_' + i + '">' + (ed ? 'Pronto' : 'Editar') + '</button></div>' +
            (x.duplicada ? '<span class="an-det an-lote-dup" id="anLoteDup_' + i + '">' + (x.duplicada === 'ja-existe' ? 'Igual a uma responsabilidade já registrada' : 'Repetida nesta lista') + ' — marque para registrar mesmo assim</span>' : '') + '</li>';
        }).join('') + '</ol>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anLoteRegistrar"' + (st.gravando ? ' disabled' : '') + '>' + rotuloLote(n) + '</button>' +
        '<button type="button" class="btn btn--sm" data-an="lote-voltar" id="anLoteVoltar">Voltar ao texto</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
    }
    /* detalhamento opcional: o motor de entregas e comparações de antes, para quem precisa de ajuda para delimitar.
       Ele nunca muda a resposta de nenhuma responsabilidade — isso só acontece na pessoa responder ou em "Revisar" */
    function renderDetalhar(a, ativos, ps, gravar, aberto, card) {
      if (!gravar && !ps.ents.length) return '';
      return '<details class="an-detalhar" id="anDetalhar"' + (aberto ? ' open' : '') + '><summary>Ajuda para identificar responsabilidades: detalhar com entregas (opcional)</summary>' +
        '<p class="an-nota">Registre o que é produzido e compare o que se parece. O detalhamento não muda a resposta de nenhuma responsabilidade: quem decide é você.</p>' +
        pendenciasHtml(a, ps.detalhe, !!card) + card + renderEntregas(a, ativos, ps, gravar) + renderDelimitacao(a, ativos, gravar) + '</details>';
    }
    /* composição organizacional: a situação ATUAL declarada (quem exerce hoje, agrupado por núcleo — uma estrutura com
       várias responsabilidades, uma responsabilidade em vários núcleos), o resultado O1–O9 de cada responsabilidade (uma
       avaliação só, mesmo compartilhada), e — separadas — a proposta e a decisão formal. Nada muda o Mapa nem estruturas */
    function renderComposicaoArea(est, a, ativos, sfs, acc, ps) {
      var h = '<details class="avp-form-card an-secao an-comp-secao" id="anComposicaoSecao"' + (st.abertos.composicao ? ' open' : '') + '><summary><span id="anComposicaoTitulo">Composição organizacional</span> <span class="an-chip an-chip--neu">Opcional</span></summary>' +
        '<p class="an-nota">Quatro coisas diferentes, que não se confundem: <strong>núcleo(s) que executam hoje</strong> (informação declarada — não é vínculo nem responsabilidade formal; "Núcleo" e "Gerência" são níveis organizacionais, não tipos arquiteturais), <strong>tipo arquitetural recomendado</strong> (o resultado do O1–O9 de cada responsabilidade, como Área Especializada ou CoE — não da área nem do núcleo, e não é uma nova estrutura), <strong>estrutura com vínculo formal registrado</strong> (o vínculo da ficha do Posicionamento, quando existe — não é aprovação do desenho) e <strong>proposta de composição e aprovação</strong> (como as responsabilidades poderiam ser organizadas; aprovação só com a referência ao ato registrada). Nada aqui cria, renomeia, extingue ou transforma uma unidade, nem muda vínculos ou o Mapa da Floresta.</p>';
      if (!ativos.length) return h + '<p class="an-nota" id="anComposicaoVazia">Aparece quando houver responsabilidades na lista.</p></details>';
      var grupos = {}, ordemG = [], sem = [];
      ativos.forEach(function (k, i) {
        var nucs = nucleosDe(a.recortes[k]);
        if (!nucs.length) { sem.push(i); return; }
        nucs.forEach(function (f) {
          var g = chaveNucleo(f);
          if (!grupos[g]) { grupos[g] = { rotulo: rotuloNucleo(f), origem: f.unidadeAtualId ? 'Estrutura Organizacional Atual' : f.estruturaId ? 'cadastrado em Estruturas Organizacionais' : 'não cadastrado — informação descritiva', itens: [] }; ordemG.push(g); }
          grupos[g].itens.push(i);
        });
      });
      var item = function (i, g) {
        var k = ativos[i], r = a.recortes[k], p = sfs[i].p, outros = nucleosDe(r).filter(function (f) { return chaveNucleo(f) !== g; });
        return '<li data-comp-resp="' + esc(k) + '"><span class="an-comp-linha"><span>' + esc(textoResp(r)) + '</span> <span class="an-det">— ' + esc(tipoRecomendado(p)) + '</span>' + (outros.length ? ' <span class="an-chip an-chip--neu">compartilhada com ' + outros.map(function (f) { return esc(rotuloNucleo(f)); }).join(', ') + '</span>' : '') + '</span>' +
          '<details class="an-quatro-det"><summary>Detalhes</summary><dl class="an-quatro"><div><dt>Núcleo(s) que executam hoje (declarado)</dt><dd>' + (nucleosDe(r).length ? nucleosDe(r).map(function (f) { return esc(rotuloNucleo(f)); }).join('; ') : 'Não informado') + '</dd></div>' +
          '<div><dt>Tipo arquitetural recomendado</dt><dd>' + esc(tipoRecomendado(p)) + '</dd></div>' +
          '<div><dt>Estrutura com vínculo formal registrado</dt><dd>' + esc(vinculoFormalDe(r)) + '</dd></div>' +
          '<div><dt>Proposta de composição e aprovação</dt><dd>' + esc(propostaDe(est, a, k)) + '</dd></div></dl></details></li>';
      };
      h += '<h4>Por núcleo que executa hoje (declarado)</h4><div class="an-comp" id="anComposicaoAtual">' + ordemG.map(function (g) {
        var G = grupos[g], av = G.itens.filter(function (i) { return sfs[i].p.estado === 'concluido'; }).length;
        return '<div class="an-comp-grupo" data-nucleo="' + esc(G.rotulo) + '"><p><strong>' + esc(G.rotulo) + '</strong> <span class="an-det">' + esc(G.origem) + ' · ' + G.itens.length + ' responsabilidade' + (G.itens.length === 1 ? '' : 's') + ', ' + av + ' avaliada' + (av === 1 ? '' : 's') + '</span></p><ul>' + G.itens.map(function (i) { return item(i, g); }).join('') + '</ul></div>';
      }).join('') + (sem.length ? '<div class="an-comp-grupo" id="anComposicaoSemNucleo"><p><strong>Sem núcleo informado</strong> <span class="an-det">' + sem.length + ' responsabilidade' + (sem.length === 1 ? '' : 's') + '</span></p><ul>' + sem.map(function (i) { return item(i, null); }).join('') + '</ul></div>' : '') + '</div>' +
        '<p class="an-nota">Um núcleo pode executar várias responsabilidades com tipos recomendados diferentes. Isso não significa dividir o núcleo, criar estruturas nem mudar ninguém de lugar: é insumo para a análise, não decisão.</p>';
      h += '<h4>Proposta de composição e referência à aprovação</h4>' + (ps.avaliadas > 0 || a.propostaVigente ? renderComposicao(est, a, ativos, sfs, acc) : '<p class="an-nota" id="anComposicaoIndisponivel">A proposta fica disponível quando houver ao menos uma responsabilidade avaliada pelo O1–O9. Não é necessária para concluir as avaliações.</p>');
      return h + '</details>';
    }
    function nomeEntrega(a, id) { var e = a.entregas[id]; return e ? e.descricao : id; }
    function textoLacuna(a, l) {
      if (l.tipo === 'sem-entrega-identificada') return 'Nenhuma entrega identificada.';
      if (l.tipo === 'responsabilidades-da-capacidade-desconhecidas') return 'Ainda não se sabe quais responsabilidades sustentam a capacidade.';
      if (l.tipo === 'responsavel-desconhecido') return 'Não se sabe quem responde por: ' + nomeEntrega(a, l.entregaId) + '.';
      if (l.tipo === 'hipotese-sem-evidencia') return 'Hipótese sem evidência: ' + nomeEntrega(a, l.entregaId) + '.';
      if (l.tipo === 'identidade-nao-concluida') { var p = l.par.split('|'); return 'Ainda não se sabe se são a mesma responsabilidade: ' + nomeEntrega(a, p[0]) + ' × ' + nomeEntrega(a, p[1]) + '.'; }
      if (l.tipo === 'entrega-sem-recorte') return 'Entrega ainda fora de qualquer responsabilidade: ' + nomeEntrega(a, l.entregaId) + '.';
      if (l.tipo === 'separacao-pendente') return (l.valor === 'sim' ? 'Precisa separar: ' : l.valor === 'nao-sei' ? 'Pendente de delimitação (não sei se precisa separar): ' : 'Pendente de delimitação (ainda sem resposta): ') + (a.recortes[l.recorteId] ? textoResp(a.recortes[l.recorteId]) : l.recorteId) + '.';
      return l.tipo;
    }
    /* a pergunta da vez — uma só, com o porquê; "alterando" reabre uma resposta já dada sobre o objeto */
    function renderPergunta(a, pend, alterando, opcional) {
      var q = pend[0], M = {}; N().MATRIZ.forEach(function (x) { M[x.id] = x; });
      var def = M[q.pergunta], tx = TEXTO_PERGUNTA[q.pergunta] || {}, atual = alterando ? a.respostas[q.pergunta] : null;
      var h = '<div class="an-pergunta" id="anPergunta" aria-labelledby="anPerguntaTitulo">' + (alterando ? '<p class="an-contador">Alterando uma resposta já dada</p>' : opcional ? '<p class="an-contador">Pergunta opcional — não impede continuar</p>' : '<p class="an-contador">Pergunta atual</p>');
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
      return '<details class="an-conceitos" id="anConceitos"' + (aberto ? ' open' : '') + '><summary>Entrega e evidência — o que é cada uma</summary>' +
        '<p class="an-nota">Exemplos <strong>hipotéticos</strong>, só para ilustrar:</p><dl class="an-conceitos-dl">' +
        '<div><dt>Entrega</dt><dd>O resultado que sai daqui e alguém usa. <span class="an-exemplo">Ex.: diagnóstico de aderência com recomendações.</span></dd></div>' +
        '<div><dt>Exemplo concreto (evidência)</dt><dd>Um caso real daquela entrega. <span class="an-exemplo">Ex.: relatório de avaliação de controles de um processo de TI.</span></dd></div></dl>' +
        '<p class="an-nota">Uma responsabilidade pode reunir várias entregas: nunca presuma que cada entrega é uma responsabilidade — compare as que se parecem. Um documento sozinho não prova a natureza organizacional; ele ilustra a entrega. Quem classifica é o O1–O9, no Passo 3.</p></details>';
    }
    function renderEntregas(a, ativos, ps, gravar) {
      var ids = ps.ents, h = conceitosHtml(!!st.abertos.conceitos) + '<div class="an-secao-entregas" id="anEntregas"><h4>Entregas registradas (' + ids.length + ')</h4>';
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
        h += (fe ? '<p class="avp-flash-success" id="anEntregaFeedback" role="status">Entrega registrada: "' + esc(fe.descricao) + '". Total: ' + ids.length + ' entrega' + (ids.length === 1 ? '' : 's') + '. Adicione outra, se houver, ou responda as perguntas sobre ela. Quando quiser, delimite uma responsabilidade a partir delas, logo abaixo.</p>' : '') +
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
      if (p.estado === 'nao-iniciado') return 'Registrada na Porta 2; O1–O9 não iniciado';
      if (p.estado === 'em-andamento') return 'O1–O9 em andamento';
      if (p.codigoEfetivo) return (p.decisao ? 'Decisão final: ' : 'Recomendação: ') + nomeCodigo(p.codigoEfetivo) + (p.reavaliando ? ' (reavaliação em andamento)' : '');
      return 'A validar' + (p.tipo ? ' — ' + { RECORTE: 'recorte', CONFLITO: 'conflito', EVIDENCIA_INSUFICIENTE: 'evidência insuficiente', INCOERENCIA: 'incoerência' }[p.tipo] : '');
    }
    function renderFatos(r) {
      if (!r.fatos) return '<p class="an-nota">Quem executa e quem responde: ainda não informado.</p>';
      var fx = function (f) { return (f.estruturaId ? esc(nomeEstrutura(f.estruturaId)) : esc(f.texto || '—')) + ' <span class="an-chip an-chip--' + (f.carater === 'hipotese' ? 'pend' : 'neu') + '">' + esc(CARATER[f.carater] || f.carater) + '</span> <span class="an-det">fonte: ' + esc(f.fonte) + ' · ' + esc(fmtData(f.informadoEm)) + '</span>'; };
      var rf = r.fatos.responsavelFormal;
      return '<p class="an-fato"><strong>Quem executa hoje:</strong> ' + (r.fatos.execucao.length ? r.fatos.execucao.map(fx).join('; ') : 'não informado') + '</p>' +
        '<p class="an-fato"><strong>Quem responde formalmente:</strong> ' + (!rf ? 'não informado' : esc(CERTEZA[rf.certeza] || rf.certeza) + (rf.certeza !== 'nao-definido' ? ' — ' + fx(rf) : ' <span class="an-det">fonte: ' + esc(rf.fonte) + ' · ' + esc(fmtData(rf.informadoEm)) + '</span>')) + '</p>' +
        '<p class="an-nota">Estas são informações descritivas da análise: não são vínculo formal (o vínculo é registrado na ficha do Posicionamento).</p>';
    }
    /* Passo 2: comparar e delimitar (as responsabilidades delimitadas são avaliadas no Passo 3) */
    function renderDelimitacao(a, ativos, gravar) {
      var h = '';
      if (!gravar) return h;
      var livres = Object.keys(a.entregas).filter(function (e) { var x = a.entregas[e]; return x.situacao === 'ativa' && !execOutra(x) && !recorteDaEntrega(a, ativos, e); });
      if (livres.length) h += '<form class="an-form" id="anFormRecorte"><h4>Delimitar uma responsabilidade a partir das entregas</h4><fieldset class="an-opcoes"><legend>Entregas que ela reúne</legend>' + livres.map(function (e) { return '<label class="an-opcao"><input type="checkbox" name="anRecEntrega" value="' + esc(e) + '"><span>' + esc(a.entregas[e].descricao) + '</span>' + (descrita(a.entregas[e]) ? '' : ' <span class="an-chip an-chip--pend">descrição incompleta</span>') + '</label>'; }).join('') + '</fieldset>' +
        '<p class="an-nota">Duas entregas só ficam juntas depois de comparadas (pergunta "São a mesma responsabilidade?").</p>' +
        '<div class="avp-field"><label for="anRecDesc">Descreva a responsabilidade</label><textarea id="anRecDesc" rows="2" maxlength="2000"></textarea></div>' +
        '<p class="an-nota">Ela entra pronta para avaliar pelo O1–O9.</p>' +
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
      if (candidatas.length) h += '<details class="an-conceitos" id="anRefMais"' + (st.abertos.refMais ? ' open' : '') + '><summary>Referenciar uma responsabilidade de outra análise (opcional)</summary><form class="an-form an-form--inline" id="anFormReferencia"><div class="avp-field"><label for="anReferenciaSel">Referenciar uma responsabilidade já delimitada em outra análise</label><select id="anReferenciaSel"><option value="">—</option>' +
        candidatas.map(function (o) { return '<option value="' + esc(o) + '">' + esc(D.objetos[o].nome) + '</option>'; }).join('') + '</select></div>' +
        '<p class="an-nota">Ela continua pertencendo à análise de origem; aqui só é citada (não é contada duas vezes).</p><div class="avp-actions-footer"><button type="submit" class="btn btn--sm" id="anReferenciarBtn">Referenciar</button></div></form></details>';
      return h;
    }
    /* Passo 3: cada responsabilidade é registrada na Porta 2 (o objeto de sempre) e avaliada pelo O1–O9 de sempre */
    function renderRecortes(a, ativos, sfs, gravar) {
      var h = '<div id="anRecortes"><p class="an-nota">Cada responsabilidade é avaliada pelo O1–O9 — o mesmo questionário do Caminho A. Uma pendente não impede avaliar as outras. Separar para avaliar não cria estrutura.</p>';
      ativos.forEach(function (k, i) {
        var r = a.recortes[k], sf = sfs[i], pr = N().prontaParaO1O9(a, k), s = sf.s ? SITUACAO_FORMAL[sf.s] : null;
        h += '<article class="an-recorte" data-recorte="' + esc(k) + '"><h4>' + esc(textoResp(r)) + '</h4>' + (r.resultado ? '<p class="an-det">Resultado: ' + esc(r.resultado) + (r.justificativa ? ' · Por que é distinta: ' + esc(r.justificativa) : '') + '</p>' : '') +
          (r.entregas.length ? '<p class="an-det">Entregas: ' + r.entregas.map(function (e) { return esc(nomeEntrega(a, e)); }).join('; ') + '</p>' : '') + renderFatos(r) +
          '<p class="an-classificacao"><strong>O1–O9:</strong> <span id="anPos_' + esc(k) + '">' + esc(textoPos(sf.p)) + '</span>' +
          (s ? ' <span class="an-chip an-chip--' + s[1] + '" id="anSit_' + esc(k) + '">' + esc(s[0]) + '</span>' : sf.indisponivel ? ' <span class="an-chip an-chip--neu">Situação formal não calculada: cadastro de estruturas indisponível</span>' : sf.lendo ? ' <span class="an-chip an-chip--neu">Verificando o cadastro…</span>' : '') + '</p>';
        if (sf.p.estado === 'concluido' && sf.p.aValidar && sf.p.tipo && A_VALIDAR[sf.p.tipo]) h += renderAprofundar(r, k, sf.p, gravar);
        /* alternativas de desenho só fazem sentido depois da classificação (antes não há o que diagnosticar) */
        if (sf.s && sf.s !== 'compativel' && sf.s !== 'sem-classificacao') h += '<details class="an-alternativas"><summary>Alternativas para esta situação</summary><ul>' + N().alternativasPara(sf.s).map(function (x) { return '<li><strong>' + esc(ALTERNATIVA[x.alternativa]) + ':</strong> ' + esc(x.consequencia) + '</li>'; }).join('') + '</ul></details>';
        h += '<div class="an-acoes">';
        if (gravar) h += '<button type="button" class="btn btn--sm" data-an="abrir-form" data-form="fatos" data-recorte="' + esc(k) + '">Quem executa e quem responde</button>';
        h += '</div>' + (st.form && st.form.recorte === k && st.form.tipo === 'fatos' ? renderFormRecorte(a, r, k) : '') + '</article>';
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
        return '<form class="an-form" data-form="atuacao" data-recorte="' + esc(k) + '" id="anFormAtuacao"><h4>Um nome curto para o cadastro</h4><p class="an-nota">O cadastro da Porta 2 aceita nomes de até 200 caracteres, e esta descrição tem ' + textoResp(r).length + '. Informe um nome curto — pode ser um trecho do texto. A descrição completa é guardada como está.</p>' +
          '<div class="avp-field"><label for="anAtNome">Nome curto</label><input id="anAtNome" maxlength="200"></div>' +
          '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="anConfirmarAtuacao">Registrar e ir para o O1–O9</button><button type="button" class="btn btn--sm" data-an="cancelar">Cancelar</button></div></form>';
      }
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
    var TIPO_EVENTO = { 'analise.criada': 'Análise aberta', 'resposta.registrada': 'Resposta registrada', 'entrega.adicionada': 'Entrega adicionada', 'entrega.editada': 'Entrega alterada', 'entrega.descartada': 'Entrega excluída', 'comparacao.registrada': 'Comparação registrada', 'recorte.definido': 'Responsabilidade registrada', 'recorte.revisado': 'Responsabilidade revisada', 'recorte.desdobrado': 'Responsabilidade separada em partes', 'recortes.registrados-em-lote': 'Responsabilidades registradas de uma vez', 'nucleos.informados': 'Núcleos atuais informados', 'recorte.ajustado': 'Delimitação revista', 'recorte.descartado': 'Responsabilidade descartada', 'fatos.registrados': 'Quem executa / responde informado', 'recorte.atuacao-associada': 'Responsabilidade registrada na Porta 2 para o O1–O9', 'responsabilidade.referenciada': 'Responsabilidade referenciada', 'evidencia.registrada': 'Evidência qualitativa registrada', 'proposta.registrada': 'Proposta registrada', 'aprovacao.registrada': 'Referência à aprovação registrada', 'analise.descartada': 'Análise descartada' };
    function carregarHistorico() {
      var id = st.id; st.historico = { id: id, eventos: null };
      S().lerUmaVez(F().NOS.auditoria + '/' + id, 12000).then(function (v) {
        if (st.id !== id) return;
        st.historico = { id: id, eventos: Object.keys(v || {}).map(function (k) { return v[k]; }).sort(function (x, y) { return (x.em || 0) - (y.em || 0); }) }; render();
      }, function () { if (st.id === id) { st.historico = { id: id, eventos: false }; render(); } });
    }

    /* ---------- ações ---------- */
    function terminar(r, flash, depois) {
      st.gravando = false; st.flashEntrega = null; st.flashResp = null; st.flashLote = null;
      if (r.erro) { st.erro = r.erro; st.flash = null; render(); return; }
      st.erro = null; st.flash = flash || null; st.form = null; st.limparCampos = true;
      if (depois) depois(r); else render();
    }
    function executar(fn, flash, depois, extra) { if (st.gravando) return; st.gravando = true; st.erro = null; render(); gravarOperacao(fn, function (r) { terminar(r, flash, depois); }, extra); }
    function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function marcado(nome) { var e = wrap.querySelector('input[name="' + nome + '"]:checked'); return e ? e.value : null; }
    function marcados(nome) { return Array.prototype.map.call(wrap.querySelectorAll('input[name="' + nome + '"]:checked'), function (e) { return e.value; }); }
    function slug(t, i) { return (t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'capacidade') + '-' + i; }
    function lerPartes() { var out = [], n = Math.max(2, (st.form && st.form.partes) || 2); for (var i = 0; i < n; i++) out.push({ descricao: val('anParteDesc' + i) }); return out; }
    /* avaliar pelo O1–O9: a responsabilidade é registrada na Porta 2 (o objeto de sempre) com o texto que a pessoa
       informou — nada é inferido; o nome curto só é pedido quando a descrição passa do limite do cadastro */
    function avaliarRecorte(rk, nomeCurto) {
      var id = st.id, a = estado().analises[id], r = a && a.recortes[rk], O = window.faObjetosOrganizacionaisNucleo;
      if (!r || !O) return;
      var origem = 'Responsabilidade informada na análise organizacional "' + a.nome + '".', dados;
      if (N().modeloSimples(r)) {
        if (textoResp(r).length > O.LIMITES.nome && !(nomeCurto && nomeCurto.trim())) { st.form = { tipo: 'atuacao', recorte: rk }; st.erro = null; render(); var c = document.getElementById('anAtNome'); if (c) c.focus(); return; }
        dados = O.dadosSimplificados({ texto: textoResp(r), nomeCurto: nomeCurto, contexto: origem });
      } else {
        /* registros anteriores: nome, resultado e entregas que a pessoa declarou na delimitação */
        dados = { nome: r.nome, descricao: (r.resultado + (r.entregas.length ? ' — entregas: ' + r.entregas.map(function (e) { return nomeEntrega(a, e); }).join('; ') : '')).slice(0, 2000), finalidade: r.resultado, contexto: 'Delimitada na análise organizacional "' + a.nome + '".' };
      }
      var objetoId = S().novaChave('objetos-organizacionais');
      executar(function (est, c) { return N().associarAtuacao(est, id, rk, objetoId, c); }, 'Responsabilidade registrada na Porta 2. Responda o O1–O9.', function () { location.hash = '#avaliacoes?po=atuacoes&item=' + encodeURIComponent(objetoId); },
        function (res, c, ident) {
          var objetoPayload = O.payloadCriacao({ id: objetoId, audId: S().novaChave('objetos-organizacionais-auditoria/' + objetoId), dados: dados, usuario: { uid: ident.uid, email: ident.email, name: (sessao() || {}).name }, agora: S().agoraServidor() });
          return F().payloadCriarAtuacao({ objetoPayload: objetoPayload, associacao: res, analiseId: id, recorteId: rk, objetoId: objetoId, audId: S().novaChave(F().NOS.auditoria), usuario: ident, agora: S().agoraServidor() });
        });
    }
    wrap.addEventListener('submit', function (ev) {
      var form = ev.target; ev.preventDefault();
      var id = st.id;
      if (form.id === 'anFormNova') {
        var caps = val('anCapacidades').split(';').map(function (x) { return x.trim(); }).filter(Boolean).map(function (r, i) { return { tipo: 'texto', chave: slug(r, i + 1), rotulo: r }; });
        var amplo = marcado('anTemAtuacao') === 'sim' ? val('anObjetoAmplo') : '';
        var uaSel = val('anUnidadeAtual') || '', nomeN = val('anNome').trim() || (uaSel && EA() ? EA().rotulo(uaSel) || '' : '');
        st.form = { tipo: 'nova', tipoEscopo: marcado('anEscopo'), nome: nomeN, descricao: val('anDescricao'), capacidades: val('anCapacidades'), objetoAmploId: amplo, unidadeAtualId: uaSel };
        if (marcado('anTemAtuacao') === 'sim' && !amplo) { st.erro = 'Escolha a responsabilidade que esta análise aprofunda (ou responda "Não").'; render(); return; }
        var dados = { nome: nomeN, tipoEscopo: marcado('anEscopo'), descricao: val('anDescricao') || undefined, capacidades: caps, objetoAmploId: amplo || undefined, unidadeAtualId: uaSel || undefined };
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
      } else if (form.id === 'anFormResponsabilidade') {
        /* registro direto: só a descrição, sem pergunta sobre separar (o contrato fica gravado no registro) */
        var dresp = { descricao: val('anRespDesc') };
        executar(function (est, c) { return N().definirRecorte(est, id, dresp, c); }, null, function () {
          st.flashResp = { descricao: dresp.descricao.trim() }; st.form = { tipo: 'uma' };
          render(); var c = document.getElementById('anRespDesc'); if (c) c.focus({ preventScroll: true });
        });
      } else if (form.id === 'anFormRevisar') {
        var krv = form.getAttribute('data-recorte'), rrv = (estado().analises[id] || { recortes: {} }).recortes[krv], drv = { descricao: val('anRevDesc') };
        if (!(rrv && N().registroDireto(rrv))) { drv.separacao = { valor: marcado('anRevSep') }; if (val('anRevObs').trim()) drv.separacao.observacao = val('anRevObs'); }
        executar(function (est, c) { return N().revisarResponsabilidade(est, id, krv, drv, c); }, 'Responsabilidade revisada (a versão anterior fica no histórico).');
      } else if (form.id === 'anFormLote') {
        sincronizarLote();
        var itensL = (st.form && st.form.previa || []).map(function (x) { return { texto: String(x.texto || '').trim(), incluir: !!x.incluir }; });
        var selL = itensL.filter(function (x) { return x.incluir && x.texto; }).map(function (x) { return x.texto; });
        var idsL = selL.map(function () { return S().novaChave(F().NOS.analises); });
        executar(function (est, c) { return N().registrarResponsabilidadesEmLote(est, id, { descricoes: selL }, Object.assign(c, { novosIds: idsL })); }, null, function () {
          st.flashLote = selL.length + ' responsabilidade' + (selL.length === 1 ? ' registrada' : 's registradas') + ', na ordem da lista e com o texto como estava. ' + (selL.length === 1 ? 'Está pronta' : 'Todas estão prontas') + ' para avaliar: use "Avaliar" na lista.';
          render(); var l = document.getElementById('anResponsabilidades'); if (l) l.scrollIntoView({ block: 'start' });
        });
      } else if (form.id === 'anFormNucleos') {
        /* texto antigo relacionado a uma unidade (confirmado pela pessoa) sai da lista de textos e entra como unidade */
        var rel = Array.prototype.map.call(wrap.querySelectorAll('input[name="anNucRel"]:checked'), function (e) { return { t: normalizado(e.value), u: e.getAttribute('data-unidade') }; });
        var uaN = marcados('anNucUA'); rel.forEach(function (x) { if (uaN.indexOf(x.u) === -1) uaN.push(x.u); });
        var kn = form.getAttribute('data-recorte'), nucs = uaN.map(function (x) { return { unidadeAtualId: x }; }).concat(marcados('anNucEst').map(function (x) { return { estruturaId: x }; }))
          .concat(val('anNucOutros').split(/\r?\n/).map(function (t) { return t.trim(); }).filter(function (t) { return t && !rel.some(function (x) { return x.t === normalizado(t); }); }).map(function (t) { return { texto: t }; }));
        var dn = { nucleos: nucs }; if (val('anNucFonte').trim()) dn.fonte = val('anNucFonte');
        executar(function (est, c) { return N().informarNucleosAtuais(est, id, kn, dn, c); }, nucs.length ? 'Núcleos atuais registrados (informação declarada; não é vínculo formal).' : 'Núcleos atuais: não informado.');
      } else if (form.id === 'anFormSeparar') {
        var ksp = form.getAttribute('data-recorte'), partes = lerPartes().filter(function (p) { return p.descricao.trim(); });
        var novosIds = partes.map(function () { return S().novaChave(F().NOS.analises); });
        executar(function (est, c) { return N().desdobrarResponsabilidade(est, id, ksp, { partes: partes.map(function (p) { return { descricao: p.descricao }; }) }, Object.assign(c, { novosIds: novosIds })); },
          'Responsabilidade separada em ' + partes.length + ' partes. A descrição original fica guardada e não é avaliada como um todo.');
      } else if (form.id === 'anFormRecorte') {
        var dr = { descricao: val('anRecDesc'), entregas: marcados('anRecEntrega') };
        executar(function (est, c) { return N().definirRecorte(est, id, dr, c); }, 'Responsabilidade registrada a partir das entregas. Separar para avaliar não cria estrutura.');
      } else if (form.getAttribute('data-form') === 'fatos') {
        var rk = form.getAttribute('data-recorte'), ee = val('anExecEstr'), et = val('anExecEstrTexto'), exec = [];
        var rAtual = (estado().analises[id] || { recortes: {} }).recortes[rk];
        if (ee || et) { var fx = { carater: val('anExecCarater'), fonte: val('anExecFonte') }; if (ee) fx.estruturaId = ee; else fx.texto = et; exec.push(fx); }
        /* os outros núcleos atuais continuam (este formulário acrescenta ou atualiza um) */
        nucleosDe(rAtual || {}).forEach(function (f0) { var mesmo = exec.some(function (x) { return x.estruturaId ? x.estruturaId === f0.estruturaId : !f0.estruturaId && !f0.unidadeAtualId && normalizado(x.texto) === normalizado(f0.texto); }); if (!mesmo) exec.push({ unidadeAtualId: f0.unidadeAtualId, estruturaId: f0.estruturaId, texto: f0.texto, carater: f0.carater, fonte: f0.fonte }); });
        exec = exec.map(function (x) { var y = { carater: x.carater, fonte: x.fonte }; if (x.unidadeAtualId) y.unidadeAtualId = x.unidadeAtualId; else if (x.estruturaId) y.estruturaId = x.estruturaId; else y.texto = x.texto; return y; });
        var rf = { certeza: val('anRespCerteza'), carater: val('anRespCarater'), fonte: val('anRespFonte') };
        if (rf.certeza !== 'nao-definido') { if (val('anRespEstr')) rf.estruturaId = val('anRespEstr'); else if (val('anRespEstrTexto')) rf.texto = val('anRespEstrTexto'); }
        executar(function (est, c) { return N().registrarFatos(est, id, rk, { execucao: exec, responsavelFormal: rf }, c); }, 'Informação registrada (descritiva, não é vínculo).');
      } else if (form.getAttribute('data-form') === 'atuacao') {
        if (!val('anAtNome').trim()) { st.erro = ERROS.NOME_CURTO_OBRIGATORIO; render(); return; }
        avaliarRecorte(form.getAttribute('data-recorte'), val('anAtNome'));
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
      } else if (form.getAttribute('data-form') === 'excluir-recorte') {
        var rk5 = form.getAttribute('data-recorte'), mx = val('anMotivoExcluirRec');
        executar(function (est, c) { return N().excluirRecorte(est, id, rk5, { motivo: mx }, c); }, 'Responsabilidade excluída. O texto e o motivo ficaram no histórico da análise.');
      } else if (form.id === 'anFormExcluir') {
        var mxa = val('anMotivoExcluir'), rev = (estado().analises[id] || {}).revisao;
        if (form.getAttribute('data-nivel') === 'excepcional' && !(document.getElementById('anExcluirConfirmo') || {}).checked) { st.erro = 'Marque a confirmação da exclusão excepcional.'; render(); return; }
        executar(function (est, c) { return N().excluirAnalise(est, id, { motivo: mxa, revisaoEsperada: rev }, c); }, 'Análise excluída. O registro mínimo e o histórico foram preservados.', function () { location.hash = '#avaliacoes?an=lista'; });
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
      else if (acao === 'avaliar') avaliarRecorte(b.getAttribute('data-recorte'), null);
      else if (acao === 'ajuda-separar') {
        st.ajudaSeparar = true; st.abertos.detalhar = true; render();
        var dj = document.getElementById('anDetalhar'); if (dj) { dj.scrollIntoView({ block: 'start' }); var sj = dj.querySelector('summary'); if (sj) sj.focus({ preventScroll: true }); }
      }
      else if (acao === 'responder-sep') {
        var kr = b.getAttribute('data-recorte'), vr = b.getAttribute('data-v'), ar = estado().analises[st.id], rr = ar && ar.recortes[kr], idr = st.id;
        if (!rr) return;
        executar(function (est, c) { return N().revisarResponsabilidade(est, idr, kr, { descricao: textoResp(rr), separacao: { valor: vr } }, c); },
          vr === 'nao' ? 'Pronta para avaliar: "' + textoResp(rr) + '".' : vr === 'sim' ? 'Precisa separar: use "Separar" na lista.' : 'Registrado: não sei. Fica pendente, sem impedir as outras. Se precisar, use "Preciso de ajuda para separar".');
      }
      else if (acao === 'lote-previa') {
        var texL = val('anLoteTexto'), numL = !!(document.getElementById('anLoteNumeracao') || {}).checked, linhas = linhasDoLote(texL, numL);
        if (!st.form || st.form.tipo !== 'lote') st.form = { tipo: 'lote' };
        st.form.texto = texL; st.form.semNumeracao = numL;
        if (!linhas.length) { st.erro = 'Cole ao menos uma linha com texto.'; render(); return; }
        st.erro = null; st.form.previa = marcarDuplicadas(estado().analises[st.id], linhas); st.limparCampos = true; render();
        var p0 = document.getElementById('anLoteLista'); if (p0) p0.scrollIntoView({ block: 'start' });
      }
      else if (acao === 'lote-voltar') { sincronizarLote(); st.form.previa = null; st.limparCampos = true; render(); }
      else if (acao === 'lote-editar') {
        var ie = Number(b.getAttribute('data-i')); sincronizarLote(); st.form.editando = st.form.editando || {}; st.form.editando[ie] = !st.form.editando[ie]; st.limparCampos = true; render();
        var ce = document.getElementById(st.form.editando[ie] ? 'anLoteItem_' + ie : 'anLoteEditar_' + ie); if (ce) ce.focus();
      }
      else if (acao === 'mais-parte') { st.form.valores = lerPartes(); st.form.partes = Math.max(2, st.form.partes || 2) + 1; render(); var np = document.getElementById('anParteDesc' + (st.form.partes - 1)); if (np) np.focus(); }
      else if (acao === 'ir-para') {
        var alvo = document.getElementById(b.getAttribute('data-alvo')); if (!alvo) return;
        if (alvo.tagName === 'DETAILS') alvo.open = true;
        /* um alvo dentro de blocos recolhidos: abre os blocos (e lembra disso no próximo redesenho) */
        for (var dd = alvo.parentElement && alvo.parentElement.closest('details'); dd; dd = dd.parentElement && dd.parentElement.closest('details')) dd.open = true;
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
      else if (t.name === 'anLoteInc') { sincronizarLote(); var bl = document.getElementById('anLoteRegistrar'); if (bl) bl.textContent = rotuloLote(st.form.previa.filter(function (x) { return x.incluir; }).length); return; }
      else if (t.id === 'anUnidadeAtual') { var nm = document.getElementById('anNome'); if (nm && t.value && EA()) nm.value = EA().rotulo(t.value) || nm.value; return; }
      else if (t.name === 'anTemAtuacao') { dep = document.getElementById('anObjetoAmplo'); dica = document.getElementById('anObjetoAmploDica'); liga = t.value === 'sim'; }
      if (!dep) return;
      dep.disabled = !liga; dep.required = liga; if (!liga) dep.value = '';
      if (dica) dica.textContent = liga ? '(obrigatória)' : (t.name === 'anTemAtuacao' ? '(só para "Sim")' : '(só para "Está cadastrada")');
    });
    wrap.addEventListener('toggle', function (ev) { var t = ev.target; if (!t) return; if (t.id === 'anConceitos') st.abertos.conceitos = t.open; if (t.id === 'anQuandoSeparar') st.abertos.quandoSeparar = t.open; if (t.id === 'anDetalhar') st.abertos.detalhar = t.open; }, true);
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
          return [r.nome, r.resultado, r.justificativa, r.entregas.map(function (e) { return nomeEntrega(a, e); }).join('; '), f ? f.execucao.map(fx).join('; ') : '', f && f.responsavelFormal ? (CERTEZA[f.responsavelFormal.certeza] + (f.responsavelFormal.certeza !== 'nao-definido' ? ' — ' + fx(f.responsavelFormal) : '')) : '',
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
    /* as ações da tela de Responsabilidades Organizacionais: "Nova responsabilidade" e "Analisar uma área" (mesmo peso);
       "Análises Organizacionais" acompanha as áreas já abertas */
    return '<div class="an-entrada an-acoes" id="anEntradaAtuacoes">' + (botaoDireto || '') +
      (a.gravar ? '<a class="btn btn--primary" id="anEntradaNova" href="#avaliacoes?an=nova">Analisar uma área</a>' : '') +
      '<a class="btn btn--sm" id="anEntradaLista" href="#avaliacoes?an=lista">Análises Organizacionais</a></div>';
  }
  /* Caminho A (direto) com "Sim, precisa separar" ou "Não sei": a responsabilidade não vai direto para o O1–O9; ela é
     registrada numa Análise Organizacional nova (Caminho B), com a descrição como a pessoa escreveu, para separar as
     partes ou voltar depois. Duas gravações (abrir a análise; registrar a responsabilidade) — se a segunda falhar, a
     análise aberta fica na lista e a pessoa registra a responsabilidade nela */
  function podeRegistrarAvulsa() { return acesso().gravar && dadosProntos(); }
  function registrarResponsabilidadeAvulsa(d, cb) {
    if (!podeRegistrarAvulsa()) { cb({ erro: 'A Análise Organizacional não está disponível agora.' }); return; }
    gravarOperacao(function (est, c) { return N().criarAnalise(est, { nome: d.nomeAnalise, tipoEscopo: 'responsabilidade', descricao: 'Aberta pelo Caminho A (direto) para separar ou esclarecer uma responsabilidade.' }, c); }, function (r1) {
      if (r1.erro) { cb(r1); return; }
      var anId = r1.novoId, t0 = Date.now();
      (function esperar() {
        if ((D.analises || {})[anId]) {
          gravarOperacao(function (est, c) { return N().definirRecorte(est, anId, { descricao: d.descricao, separacao: { valor: d.separacao } }, c); }, function (r2) {
            cb(r2.erro ? { erro: 'A análise foi aberta, mas a responsabilidade não foi registrada: ' + r2.erro, analiseId: anId } : { ok: true, analiseId: anId });
          });
        } else if (Date.now() - t0 > PRAZO) cb({ erro: 'A análise foi aberta, mas ainda não chegou de volta do servidor. Abra-a pela lista e registre a responsabilidade.', analiseId: anId });
        else setTimeout(esperar, 150);
      })();
    });
  }
  /* Início de Avaliações, no cartão da Porta 2: o atalho para o Caminho B (só quando o marcador libera a leitura) */
  /* a ação do Caminho B segue a situação real do marcador e do perfil: nunca um botão que não funciona */
  function caminhoAssistidoInicioHtml() {
    ligarConfig();
    if (D.hab === undefined || !autorizacaoResolvida()) return '<p class="avp-inicio-perfil" id="avpInicioCaminhoBEstado">Verificando a disponibilidade…</p>';
    var a = acesso();
    if (a.gravar) return '<div id="avpInicioCaminhoB"><a class="btn avp-inicio-acao" href="#avaliacoes?an=nova" id="avpInicioAnalise">Analisar área</a></div>';
    if (a.ler) return '<div id="avpInicioCaminhoB"><a class="btn avp-inicio-acao" href="#avaliacoes?an=lista" id="avpInicioAnalise">Ver as análises de áreas</a><p class="avp-inicio-perfil">Abrir uma análise é do perfil Avaliação + Configuração.</p></div>';
    return '<p class="avp-inicio-perfil" id="avpInicioCaminhoBEstado">' + (D.hab === 'DESLIGADO' ? 'Em preparação: ainda não disponível.' : 'Ainda não disponível para o seu perfil.') + '</p>';
  }
  /* ficha do Posicionamento de uma atuação nascida de uma análise */
  /* a lista consolidada da Porta 2 (avaliacao-posicionamento.js, "Ver todas as responsabilidades"): as
     responsabilidades registradas nas análises, com a área de origem e quem executa hoje — só leitura, sem regra nova
     (a prontidão é a do núcleo). null quando a Análise Organizacional não está disponível para a pessoa */
  function responsabilidadesDasAnalises() {
    if (!pronto()) return null;
    var est = estado(), out = [], EAx = window.faEstruturaAtualAdmin;
    Object.keys(est.analises).forEach(function (aid) {
      var a = est.analises[aid]; if (a.situacao === 'descartada') return;
      Object.keys(a.recortes).forEach(function (k) {
        var r = a.recortes[k]; if (r.situacao !== 'ativo') return;
        var nucs = (r.fatos && Array.isArray(r.fatos.execucao) ? r.fatos.execucao : []).map(function (f) {
          return f.unidadeAtualId ? ((EAx && EAx.rotulo(f.unidadeAtualId)) || f.unidadeAtualId) : f.estruturaId ? (((D.estruturas || {})[f.estruturaId] || {}).nome || f.estruturaId) : f.texto;
        });
        out.push({ analiseId: aid, analiseNome: a.nome, recorteId: k, descricao: typeof r.descricao === 'string' ? r.descricao : r.nome, objetoId: r.objetoId || null,
          nucleos: nucs, pronta: !r.objetoId && N().prontaParaO1O9(a, k).pronta });
      });
    });
    return out;
  }
  function origemDe(objetoId) {
    if (!pronto()) return null;
    var o = (D.porObjeto || {})[objetoId]; if (!o) return null;
    var a = (D.analises || {})[o.analiseId]; return a ? { analiseId: o.analiseId, nome: a.nome } : null;
  }
  /* sigla da área quando o nome termina em " — SIGLA" (ex.: "... — GECON"); senão, o nome entre aspas */
  function nomeCurtoArea(o) {
    var an = pronto() ? estado().analises[o.analiseId] : null, EAx = window.faEstruturaAtualAdmin, u = an && an.unidadeAtualId && EAx ? EAx.unidade(an.unidadeAtualId) : null;
    if (u && u.sigla) return u.sigla;
    var nome = String(o.nome || ''), m = /^([A-ZÀ-Ú0-9]{2,12})\s*[—–-]\s/.exec(nome) || /\s[—–-]\s*([A-ZÀ-Ú0-9]{2,12})\s*$/.exec(nome);
    return m ? m[1] : 'área "' + nome + '"';
  }
  function origemHtml(objetoId) { var o = origemDe(objetoId); return o ? '<p class="an-origem" id="anOrigem">Responsabilidade registrada na análise <a href="#avaliacoes?an=' + encodeURIComponent(o.analiseId) + '" id="anVoltarAnalise">' + esc(o.nome) + '</a>.</p>' : ''; }
  /* depois do O1–O9: voltar à lista da área para avaliar a próxima */
  function voltarAreaHtml(objetoId) { var o = origemDe(objetoId); return o ? '<a class="btn btn--primary btn--sm" id="anVoltarResponsabilidades" href="#avaliacoes?an=' + encodeURIComponent(o.analiseId) + '">Voltar às responsabilidades da ' + esc(nomeCurtoArea(o)) + '</a>' : ''; }
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
  window.faAnalisesOrganizacionais = { entradaAtuacoesHtml: entradaAtuacoesHtml, caminhoAssistidoInicioHtml: caminhoAssistidoInicioHtml, podeRegistrarAvulsa: podeRegistrarAvulsa, registrarResponsabilidadeAvulsa: registrarResponsabilidadeAvulsa, origemHtml: origemHtml, voltarAreaHtml: voltarAreaHtml, responsabilidadesDasAnalises: responsabilidadesDasAnalises, origemDe: origemDe, delimitacaoDe: delimitacaoDe,
    exercidasHtml: exercidasHtml, montarHabilitacao: montarHabilitacao, acesso: acesso, aoMudar: function (f) { aoMudarFns.push(f); }, ligar: function () { ligarConfig(); ligarDados(); } };
  if (/^#avaliacoes\?(.*&)?an=/.test(location.hash || '')) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.faInitAnalisesOrganizacionais); else window.faInitAnalisesOrganizacionais(); }
})();
