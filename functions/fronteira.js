/* FRONTEIRA CONFIÁVEL do motor de Posicionamento (B4; ativação atômica, retorno à v1 e conclusão v2 no H3-b): o núcleo,
 * independente de Cloud Functions.
 *
 * Recebe um adaptador de banco (io) e os módulos do site (modulos-site.js) e decide no SERVIDOR — nada vem da tela
 * além do que identifica a operação (versão, proposta, avaliação). index.js só liga estas operações a Cloud Functions;
 * no futuro portal corporativo, troca-se o adaptador, não as regras.
 *
 * H3-b — TODA gravação passa pelas REGRAS do banco: o adaptador grava com a identidade restrita 'fronteira-confiavel'
 * (Admin SDK com databaseAuthVariableOverride), e as regras só deixam essa identidade gravar o que é dela — validação
 * da redação, auditoria da governança, a ativação (vigência + registro + auditoria numa gravação só, com
 * compare-and-set da sequência) e a conclusão de avaliação de motor ≥ 2. A leitura (recalcular) usa o Admin SDK pleno.
 *
 *   validarRedacaoPublicada(auth, {versaoMotor, versaoRedacao})  Avaliação + Arquitetura ou admin geral.
 *        v ≥ 2: a redação PUBLICADA da trilha do motor (digest recalculado = o gravado). v = 1 (retorno): a redação da
 *        trilha principal, a versão publicada atual (digest recalculado). Contrato do motor conferido. Válida → registro
 *        único (repetir não grava); auditoria `validacao_redacao` com o resultado.
 *   conferirEntradaEmVigor(auth, {propostaId}, {habilitada})      admin geral. Recalcula redação, definição, simulação,
 *        impacto, prontidão e a aprovação dupla com os perfis ATUAIS; registra SÓ o veredito na auditoria.
 *   ativarEntradaEmVigor(auth, {propostaId}, {habilitada})        admin geral. DESABILITADA no código (index.js) até a
 *        dona decidir. Habilitada: a mesma conferência e UMA gravação atômica — as regras recusam se outra ativação
 *        entrou antes (sequência), se a proposta já foi consumida ou se faltar o registro ou a auditoria.
 *   concluirAvaliacaoPosicionamento(auth, {avaliacaoId, revisao})  Avaliação + Arquitetura ou admin geral. Só motor ≥ 2
 *        (a v1 continua concluída pela tela): o MESMO payloadConclusao da tela, com o resultado do núcleo do motor.
 *
 * io: { ler(caminho) → Promise<valor|null>, gravar(atualizacoes) → Promise (multipath atômico, PELAS REGRAS),
 *       novaChave(caminho) → string, agora() → marca do horário do servidor } */
'use strict';
const CODIGO = 'POSICIONAMENTO_ORGANIZACIONAL';
/* os mesmos dois e-mails fixos de admin geral das regras do banco (teste-fronteira-estrutura.js confere) */
const ADMINS_FIXOS = Object.freeze(['tatianefdirene@previ.com.br', 'danielfrazao@previ.com.br']);
const NOS_FRONTEIRA = Object.freeze({ redacaoValidada: 'posicionamento-motor-redacao-validada', ativacoes: 'posicionamento-motor-ativacoes' });
/* a identidade restrita com que o servidor grava (as regras a reconhecem; só existe com a credencial de servidor) */
const UID_FRONTEIRA = 'fronteira-confiavel';

class ErroFronteira extends Error {
  constructor(codigo, mensagem) { super(mensagem || codigo); this.codigo = codigo; }
}
const chaveEmail = (e) => String(e).replace(/[@.]/g, '_');
const unicos = (a) => a.filter((x, i) => a.indexOf(x) === i);
const ID_VALIDO = /^[A-Za-z0-9_-]{1,60}$/;

function criarFronteira(io, modulos) {
  const N = modulos.N, G = modulos.G, NOS = G.NOS;
  const caminhoRedacao = (v, n) => 'questionarios-config/' + CODIGO + '/motores/' + v + (n === undefined ? '' : '/versoes/' + n);

  async function perfilDoEmail(email) {
    if (!email) return { adminGeral: false, arquitetura: false };
    const k = chaveEmail(email);
    const [adm, tipo] = await Promise.all([io.ler('fa-admins/' + k), io.ler('fa-avaliacao-autorizados/' + k + '/tipo')]);
    const adminGeral = ADMINS_FIXOS.indexOf(email) !== -1 || (adm !== null && adm !== undefined);
    return { adminGeral, arquitetura: adminGeral || tipo === 'avaliacao-arquitetura' };
  }
  /* identidade = o token autenticado (UID + e-mail); perfil lido no banco agora */
  async function quem(auth, exige) {
    if (!auth || !auth.uid || !auth.token || !auth.token.email) throw new ErroFronteira('unauthenticated', 'É preciso estar autenticado.');
    const p = await perfilDoEmail(auth.token.email);
    if (exige === 'admin' ? !p.adminGeral : !p.arquitetura) throw new ErroFronteira('permission-denied', 'Sem permissão para esta operação.');
    return { uid: auth.uid, email: auth.token.email, name: String(auth.token.name || auth.token.email).slice(0, 200), adminGeral: p.adminGeral };
  }
  function versaoValida(v, min) { return typeof v === 'number' && v % 1 === 0 && v >= min && v <= 99; }
  function conteudoPublicado(v, n, ver) { return { publicado: true, versao: n, codigo: CODIGO, motorCompativel: ver.motorCompativel, perguntas: ver.perguntas || [] }; }

  /* a redação de destino e o seu exame. v ≥ 2: a versão publicada da trilha do motor (o digest gravado tem de ser o
     recalculado). v = 1: a trilha principal — só a versão publicada atual; sem digest gravado, vale o recalculado. */
  async function redacaoDe(v, n, cfg) {
    if (v !== 1) {
      const [ver, ponteiro] = await Promise.all([io.ler(caminhoRedacao(v, n)), io.ler(caminhoRedacao(v) + '/versaoPublicada')]);
      return { ver, ponteiro };
    }
    const Q = modulos.carregar({ 'questionarios-config': { [CODIGO]: cfg } }).Q;
    const ponteiro = Q.situacao(CODIGO).versaoPublicada;
    if (n !== ponteiro) return { ver: null, ponteiro };
    const r = G.redacaoDaTrilhaPrincipal(N, (c, vv) => Q.conteudoPergunta(CODIGO, c, vv), n);
    r.digestRedacao = G.digestRedacao(r.perguntas);
    return { ver: r, ponteiro };
  }
  function examinarRedacao(v, n, ver) {
    const motivos = [];
    if (!ver) return { motivos: ['REDACAO_NAO_PUBLICADA'], digest: null };
    const digest = G.digestRedacao(ver.perguntas || []);
    if (digest !== ver.digestRedacao) motivos.push('REDACAO_ADULTERADA');
    if (ver.motorCompativel !== v) motivos.push('MOTOR_INCOMPATIVEL');
    if (N.versoes().indexOf(v) === -1) motivos.push('MOTOR_DESCONHECIDO');
    else if (!N.podeEntrarEmVigor(N.definicao(v), [conteudoPublicado(v, n, ver)]).pode) motivos.push('CONTRATO_INCOMPATIVEL');
    return { motivos, digest };
  }

  async function validarRedacaoPublicada(auth, dados) {
    const u = await quem(auth, 'arquitetura');
    const v = dados && dados.versaoMotor, n = dados && dados.versaoRedacao;
    if (!versaoValida(v, 1) || !versaoValida(n, 1)) throw new ErroFronteira('invalid-argument', 'Versão do motor (1–99) e da redação (≥ 1) são obrigatórias.');
    const cfg = v === 1 ? await io.ler('questionarios-config/' + CODIGO) : null;
    const [rd, existente] = await Promise.all([redacaoDe(v, n, cfg), io.ler(NOS_FRONTEIRA.redacaoValidada + '/' + v + '/' + n)]);
    const ex = examinarRedacao(v, n, rd.ver), valida = !ex.motivos.length;
    if (valida && existente && existente.digestRedacao === ex.digest) return { valida: true, jaValidada: true, motivos: [], digestRedacao: ex.digest };
    const audId = io.novaChave(NOS.auditoria), agora = io.agora(), w = {};
    if (valida) w[NOS_FRONTEIRA.redacaoValidada + '/' + v + '/' + n] = { digestRedacao: ex.digest, validadoEm: agora, solicitadoPor: { uid: u.uid, email: u.email }, auditoriaId: audId };
    w[NOS.auditoria + '/' + audId] = { tipo: 'validacao_redacao', versaoMotor: v, versaoRedacao: n, digestRedacao: ex.digest, resultado: valida ? 'valida' : 'invalida',
      motivos: valida ? null : ex.motivos, usuario: { uid: u.uid, email: u.email }, dataHora: agora, origem: 'fronteira' };
    await io.gravar(w);
    return { valida, jaValidada: false, motivos: ex.motivos, digestRedacao: ex.digest };
  }

  /* ---- a conferência completa, sem gravar nada ---- */
  async function avaliarProposta(propostaId) {
    const prop = await io.ler(NOS.propostas + '/' + propostaId);
    if (!prop) return { apta: false, motivos: ['PROPOSTA_INEXISTENTE'], detalhes: {}, prop: null, vig: null };
    const [vig, consumida] = await Promise.all([io.ler(NOS.vigencia), io.ler(NOS_FRONTEIRA.ativacoes + '/' + propostaId)]);
    const emVigor = G.versaoEmVigorRegistrada(vig), motivos = [];
    if (prop.situacao !== 'aprovada') motivos.push('PROPOSTA_NAO_APROVADA');
    if (consumida) motivos.push('PROPOSTA_JA_CONSUMIDA');
    const v = prop.versaoMotor, alvo = prop.alvo || {};
    if (v === emVigor) motivos.push('VERSAO_JA_EM_VIGOR');
    if (N.versoes().indexOf(v) === -1) { motivos.push('MOTOR_DESCONHECIDO'); return { apta: false, motivos: unicos(motivos), detalhes: { versaoMotor: v, versaoEmVigor: emVigor }, prop, vig }; }
    const defA = N.definicao(v), defV = N.definicao(emVigor), n = alvo.versaoRedacao;
    const [cfg, regs, vigItem, dec] = await Promise.all([io.ler('questionarios-config/' + CODIGO), io.ler('avaliacoes-posicionamento'),
      io.ler('posicionamento-vigente-por-item'), io.ler('posicionamento-decisoes')]);
    const [rd, validada] = await Promise.all([redacaoDe(v, n, cfg), io.ler(NOS_FRONTEIRA.redacaoValidada + '/' + v + '/' + n)]);
    const ver = rd.ver;
    /* redação */
    const ex = examinarRedacao(v, n, ver);
    ex.motivos.forEach((m) => motivos.push(m));
    if (ver && ex.digest !== alvo.digestRedacao) motivos.push('REDACAO_DIFERENTE_DA_PROPOSTA');
    if (rd.ponteiro !== n) motivos.push('REDACAO_NAO_E_A_PUBLICADA_ATUAL');
    const redacaoValidada = !!validada && !!ver && validada.digestRedacao === ex.digest;
    /* definição do motor (a do código do servidor) */
    const digestDefinicao = G.digest(defA);
    if (digestDefinicao !== alvo.digestDefinicao) motivos.push('DEFINICAO_DIFERENTE');
    /* impacto, recalculado sobre as avaliações vigentes concluídas — o mesmo cálculo da tela */
    let imp = null;
    if (ver) {
      const site = modulos.carregar({ 'questionarios-config': { [CODIGO]: cfg } }), Q = site.Q;
      const porCodigo = {};
      (ver.perguntas || []).forEach((p) => { porCodigo[p.codigoEstavel] = p; });
      const R = regs || {}, VI = vigItem || {}, D = dec || {};
      const lista = Object.keys(VI).map((item) => { const id = VI[item]; return R[id] ? { id, reg: R[id], decisao: D[id] || null } : null; }).filter(Boolean);
      imp = G.classificarImpacto(N, { destino: defA, registros: lista,
        conteudoOrigem: (reg, c, vv) => { const vm = typeof reg.versaoMotor === 'number' ? reg.versaoMotor : 1; return vm === 1 ? Q.conteudoPergunta(CODIGO, c, vv) : Q.conteudoPerguntaMotor(CODIGO, vm, c, vv); },
        conteudoDestino: (c) => porCodigo[c] || null, mesmoConteudo: site.mesmoConteudo });
      if (imp.digest !== alvo.digestImpacto) motivos.push('IMPACTO_DESATUALIZADO');
    } else motivos.push('IMPACTO_NAO_CALCULADO');
    /* prontidão técnica, com a simulação feita aqui */
    const sim = N.simular(defV, defA);
    const pr = G.prontidao(N, defA, { emVigor: defV, redacoesPublicadas: ver ? [conteudoPublicado(v, n, ver)] : [], redacaoValidada, simulacao: sim, impacto: imp });
    pr.itens.filter((i) => !i.ok).forEach((i) => motivos.push('PRONTIDAO_' + i.codigo));
    /* aprovação dupla e perfis ATUAIS de quem aprovou */
    const st = G.situacaoProposta(prop, null);
    if (prop.situacao === 'aprovada' && !(st.autorizacao && st.autorizacao.autorizada)) motivos.push('APROVACAO_INVALIDA');
    const perfis = await Promise.all(st.aprovacoes.map((a) => perfilDoEmail(a.email)));
    if (perfis.some((p) => !p.arquitetura)) motivos.push('APROVADOR_SEM_PERFIL');
    if (st.aprovacoes.length && !st.aprovacoes.some((a, i) => a.adminGeral && perfis[i].adminGeral)) motivos.push('SEM_ADMIN_GERAL_ATUAL');
    const detalhes = { versaoMotor: v, versaoEmVigor: emVigor, versaoRedacao: n, digestRedacao: ex.digest, digestDefinicao, digestImpacto: imp ? imp.digest : null,
      impacto: imp ? { total: imp.total, iguais: imp.iguais.length, alterados: imp.alterados.length, incomparaveis: imp.incomparaveis.length, violacoes: imp.violacoes.length } : null,
      simulacao: { totalEstados: sim.totalEstados, violacoesLinhaSquad: sim.violacoesLinhaSquad } };
    const ms = unicos(motivos);
    return { apta: !ms.length, motivos: ms, detalhes, prop, vig };
  }

  function idDe(dados, campo) {
    const id = dados && dados[campo];
    if (typeof id !== 'string' || !ID_VALIDO.test(id)) throw new ErroFronteira('invalid-argument', campo + ' inválido.');
    return id;
  }
  async function conferirEntradaEmVigor(auth, dados, opcoes) {
    const u = await quem(auth, 'admin');
    const id = idDe(dados, 'propostaId');
    const r = await avaliarProposta(id);
    const audId = io.novaChave(NOS.auditoria);
    /* só o veredito: a vigência, as avaliações e a proposta não são tocadas */
    await io.gravar({ [NOS.auditoria + '/' + audId]: { tipo: 'conferencia', propostaId: id, versaoMotor: r.detalhes.versaoMotor || null, apta: r.apta, motivos: r.motivos.length ? r.motivos : null,
      digestImpacto: r.detalhes.digestImpacto || null, usuario: { uid: u.uid, email: u.email }, dataHora: io.agora(), origem: 'fronteira' } });
    return { apta: r.apta, motivos: r.motivos, detalhes: r.detalhes, ativacaoHabilitada: !!(opcoes && opcoes.habilitada === true) };
  }

  async function ativarEntradaEmVigor(auth, dados, opcoes) {
    const u = await quem(auth, 'admin');
    if (!opcoes || opcoes.habilitada !== true) return { ativada: false, motivos: ['ATIVACAO_DESABILITADA'] };
    const id = idDe(dados, 'propostaId');
    /* repetição: a proposta já consumida devolve o resultado anterior, sem gravar nada */
    const feita = await io.ler(NOS_FRONTEIRA.ativacoes + '/' + id);
    if (feita) return { ativada: true, jaAtivada: true, versaoEmVigor: feita.versaoMotor, seq: feita.seq };
    const r = await avaliarProposta(id);
    if (!r.apta) return { ativada: false, motivos: r.motivos };
    const d = r.detalhes, seq = ((r.vig && r.vig.seq) || 0) + 1, agora = io.agora(), audId = io.novaChave(NOS.auditoria), por = { uid: u.uid, email: u.email };
    const comum = { versaoRedacao: d.versaoRedacao, digestRedacao: d.digestRedacao, digestDefinicao: d.digestDefinicao, digestImpacto: d.digestImpacto, ativadoEm: agora, ativadoPor: por, auditoriaId: audId };
    /* UMA gravação: vigência + registro da ativação + auditoria. As regras conferem a sequência (compare-and-set), a
       proposta aprovada e ainda não consumida, e que nenhuma das três partes falte. */
    try {
      await io.gravar({
        [NOS.vigencia]: Object.assign({ versaoEmVigor: d.versaoMotor, versaoAnterior: d.versaoEmVigor, seq, propostaId: id }, comum),
        [NOS_FRONTEIRA.ativacoes + '/' + id]: Object.assign({ seq, versaoMotor: d.versaoMotor, versaoAnterior: d.versaoEmVigor }, comum),
        [NOS.auditoria + '/' + audId]: { tipo: 'ativacao', propostaId: id, versaoMotor: d.versaoMotor, versaoAnterior: d.versaoEmVigor, seq, usuario: por, dataHora: agora, origem: 'fronteira' }
      });
    } catch (e) {
      const depois = await io.ler(NOS_FRONTEIRA.ativacoes + '/' + id);
      return { ativada: false, motivos: [depois ? 'PROPOSTA_JA_CONSUMIDA' : 'VIGENCIA_MUDOU'] };
    }
    return { ativada: true, jaAtivada: false, versaoEmVigor: d.versaoMotor, seq };
  }

  /* ---- H3-b: conclusão de avaliação de motor ≥ 2 (a v1 continua sendo concluída pela tela) ---- */
  async function concluirAvaliacaoPosicionamento(auth, dados) {
    const u = await quem(auth, 'arquitetura');
    const id = idDe(dados, 'avaliacaoId');
    if (typeof (dados && dados.revisao) !== 'number') throw new ErroFronteira('invalid-argument', 'revisao é obrigatória.');
    const reg = await io.ler('avaliacoes-posicionamento/' + id);
    if (!reg) return { concluida: false, motivos: ['AVALIACAO_INEXISTENTE'] };
    if (reg.status !== 'rascunho') return { concluida: false, motivos: ['NAO_E_RASCUNHO'] };
    if (typeof reg.versaoMotor !== 'number' || reg.versaoMotor < 2) return { concluida: false, motivos: ['CONCLUSAO_PELA_TELA'] };
    if (reg.revisao !== dados.revisao) return { concluida: false, motivos: ['REVISAO_DESATUALIZADA'] };
    const [cfg, conceitos, fontes, produtos] = await Promise.all([io.ler('questionarios-config/' + CODIGO), io.ler('taxonomia/organizacional/conceitos'),
      io.ler('taxonomia/organizacional/fontes'), io.ler('avaliacoes-produto')]);
    const site = modulos.carregar({ 'questionarios-config': { [CODIGO]: cfg }, taxonomia: { organizacional: { conceitos: conceitos || {}, fontes: fontes || {} } } });
    const T = site.T;
    /* a base P1–P16 que VALE hoje para o item tem de ser a do rascunho (a "ponta" que as regras não conseguem ver) */
    const base = site.B && site.B.baseDoItem(reg.itemId, produtos || {});
    if (!base || base.situacao !== 'valida' || base.chave !== reg.avaliacaoArquiteturalId) return { concluida: false, motivos: ['BASE_MUDOU'] };
    const limpo = T.limparForaDoCaminho(reg).reg;
    if (T.falta(limpo)) return { concluida: false, motivos: ['FALTAM_RESPOSTAS'] };
    const montado = T.payloadConclusao(id, limpo, { name: u.name, email: u.email }, new Date().toISOString(), reg.revisao, io.novaChave('posicionamento-auditoria/' + id));
    try { await io.gravar(montado.payload); }
    catch (e) {
      const [rev, vig] = await Promise.all([io.ler('avaliacoes-posicionamento/' + id + '/revisao'), io.ler('posicionamento-vigente-por-item/' + reg.itemId)]);
      return { concluida: false, motivos: [rev !== reg.revisao ? 'REVISAO_DESATUALIZADA' : (vig && vig !== reg.avaliacaoAnteriorId && vig !== id ? 'JA_TEM_VIGENTE' : 'RECUSADA_PELAS_REGRAS')] };
    }
    const res = montado.resultado;
    return { concluida: true, resultado: { codigoResultado: res.codigoResultado, tipoAValidar: res.tipoAValidar || null, regra: res.regra, versaoMotor: res.versaoMotor, liberaSquad: res.liberaSquad } };
  }

  return Object.freeze({ validarRedacaoPublicada, conferirEntradaEmVigor, ativarEntradaEmVigor, concluirAvaliacaoPosicionamento });
}

/* adaptador do Admin SDK: LÊ com o acesso pleno (recalcular exige ver tudo) e GRAVA com a identidade restrita, que
   passa pelas regras do banco. `servidor` é a marca de horário do servidor (as regras exigem now). */
function ioDoAdmin(leitura, escrita, servidor) {
  if (!escrita) throw new Error('fronteira: sem o gravador restrito (identidade fronteira-confiavel)');
  return {
    ler: (c) => leitura.ref(c).once('value').then((s) => { const v = s.val(); return v === undefined ? null : v; }),
    gravar: (w) => escrita.ref().update(w),
    novaChave: (c) => leitura.ref(c).push().key,
    agora: () => servidor
  };
}
module.exports = { criarFronteira, ioDoAdmin, ErroFronteira, ADMINS_FIXOS, NOS_FRONTEIRA, CODIGO, UID_FRONTEIRA };
