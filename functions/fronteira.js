/* B4 — FRONTEIRA CONFIÁVEL do motor de Posicionamento: o núcleo, independente de Cloud Functions.
 *
 * Recebe um adaptador de banco (io) e os módulos do site (modulos-site.js) e decide no SERVIDOR — nada vem da tela
 * além do que identifica a operação (versão, proposta). index.js só liga estas operações a Cloud Functions; no
 * futuro portal corporativo, troca-se o adaptador, não as regras.
 *
 *   validarRedacaoPublicada(auth, {versaoMotor, versaoRedacao})  Avaliação + Arquitetura ou admin geral.
 *        Relê a redação PUBLICADA, recalcula o digest, confere o vínculo com o motor e o contrato do questionário;
 *        válida → registra em posicionamento-motor-redacao-validada (uma vez; repetir não grava de novo). Auditoria
 *        `validacao_redacao` com o resultado.
 *   conferirEntradaEmVigor(auth, {propostaId})                    admin geral.
 *        Recalcula tudo (redação, definição, simulação, impacto, prontidão, aprovação dupla e os perfis ATUAIS de
 *        quem aprovou) e devolve o veredito com os motivos. Registra SÓ o veredito na auditoria (`conferencia`):
 *        nunca altera a vigência, as avaliações nem a proposta — não é uma operação de ativação.
 *   ativarEntradaEmVigor(auth, {propostaId}, {habilitada})        admin geral. DESABILITADA no servidor (index.js:
 *        ATIVACAO_HABILITADA = false); destravar é do H3-b. Habilitada (só nos testes do emulador): a mesma conferência
 *        e, se apta, uma transação na vigência (compare-and-set da versão em vigor e da sequência; cada proposta é
 *        consumida uma vez), depois o registro da ativação e a auditoria; repetir devolve o resultado anterior.
 *
 * io: { ler(caminho) → Promise<valor|null>, gravar(atualizacoes) → Promise (multipath atômico),
 *       transacao(caminho, f) → Promise<{ confirmada, valor }>, novaChave(caminho) → string, agora() → ms do servidor } */
'use strict';
const CODIGO = 'POSICIONAMENTO_ORGANIZACIONAL';
/* os mesmos dois e-mails fixos de admin geral das regras do banco (teste-fronteira-estrutura.js confere) */
const ADMINS_FIXOS = Object.freeze(['tatianefdirene@previ.com.br', 'danielfrazao@previ.com.br']);
const NOS_FRONTEIRA = Object.freeze({ redacaoValidada: 'posicionamento-motor-redacao-validada', ativacoes: 'posicionamento-motor-ativacoes' });

class ErroFronteira extends Error {
  constructor(codigo, mensagem) { super(mensagem || codigo); this.codigo = codigo; }
}
const chaveEmail = (e) => String(e).replace(/[@.]/g, '_');
const unicos = (a) => a.filter((x, i) => a.indexOf(x) === i);

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
    return { uid: auth.uid, email: auth.token.email, adminGeral: p.adminGeral };
  }
  function versaoValida(v, min) { return typeof v === 'number' && v % 1 === 0 && v >= min && v <= 99; }
  function conteudoPublicado(v, n, ver) { return { publicado: true, versao: n, codigo: CODIGO, motorCompativel: ver.motorCompativel, perguntas: ver.perguntas || [] }; }

  /* ---- redação publicada: recalculada, vinculada ao motor e compatível com o contrato ---- */
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
    if (!versaoValida(v, 2) || !versaoValida(n, 1)) throw new ErroFronteira('invalid-argument', 'Versão do motor (2–99) e da redação (≥ 1) são obrigatórias.');
    const [ver, existente] = await Promise.all([io.ler(caminhoRedacao(v, n)), io.ler(NOS_FRONTEIRA.redacaoValidada + '/' + v + '/' + n)]);
    const ex = examinarRedacao(v, n, ver), valida = !ex.motivos.length;
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
    const vig = await io.ler(NOS.vigencia), emVigor = G.versaoEmVigorRegistrada(vig), motivos = [];
    if (prop.situacao !== 'aprovada') motivos.push('PROPOSTA_NAO_APROVADA');
    if (vig && vig.consumidas && vig.consumidas[propostaId]) motivos.push('PROPOSTA_JA_CONSUMIDA');
    const v = prop.versaoMotor, alvo = prop.alvo || {};
    if (v === emVigor) motivos.push('VERSAO_JA_EM_VIGOR');
    if (N.versoes().indexOf(v) === -1) { motivos.push('MOTOR_DESCONHECIDO'); return { apta: false, motivos: unicos(motivos), detalhes: { versaoMotor: v, versaoEmVigor: emVigor }, prop, vig }; }
    const defA = N.definicao(v), defV = N.definicao(emVigor), n = alvo.versaoRedacao;
    const [ver, ponteiro, validada, cfg, regs, vigItem, dec] = await Promise.all([io.ler(caminhoRedacao(v, n)), io.ler(caminhoRedacao(v) + '/versaoPublicada'),
      io.ler(NOS_FRONTEIRA.redacaoValidada + '/' + v + '/' + n), io.ler('questionarios-config/' + CODIGO),
      io.ler('avaliacoes-posicionamento'), io.ler('posicionamento-vigente-por-item'), io.ler('posicionamento-decisoes')]);
    /* redação */
    const ex = examinarRedacao(v, n, ver);
    ex.motivos.forEach((m) => motivos.push(m));
    if (ver && ex.digest !== alvo.digestRedacao) motivos.push('REDACAO_DIFERENTE_DA_PROPOSTA');
    if (ver && ponteiro !== n) motivos.push('REDACAO_NAO_E_A_PUBLICADA_ATUAL');
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

  async function conferirEntradaEmVigor(auth, dados) {
    const u = await quem(auth, 'admin');
    const id = dados && dados.propostaId;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(id)) throw new ErroFronteira('invalid-argument', 'propostaId inválido.');
    const r = await avaliarProposta(id);
    const audId = io.novaChave(NOS.auditoria);
    /* só o veredito: a vigência, as avaliações e a proposta não são tocadas */
    await io.gravar({ [NOS.auditoria + '/' + audId]: { tipo: 'conferencia', propostaId: id, versaoMotor: r.detalhes.versaoMotor || null, apta: r.apta, motivos: r.motivos.length ? r.motivos : null,
      digestImpacto: r.detalhes.digestImpacto || null, usuario: { uid: u.uid, email: u.email }, dataHora: io.agora(), origem: 'fronteira' } });
    return { apta: r.apta, motivos: r.motivos, detalhes: r.detalhes, ativacaoHabilitada: false };
  }

  async function registrarAtivacao(id, vig, u) {
    const audId = io.novaChave(NOS.auditoria), seq = vig.consumidas[id];
    await io.gravar({
      [NOS_FRONTEIRA.ativacoes + '/' + id]: { seq, versaoMotor: vig.versaoEmVigor, versaoAnterior: vig.versaoAnterior, versaoRedacao: vig.versaoRedacao, digestRedacao: vig.digestRedacao,
        digestDefinicao: vig.digestDefinicao, digestImpacto: vig.digestImpacto, ativadoEm: vig.ativadoEm, ativadoPor: vig.ativadoPor, auditoriaId: audId },
      [NOS.auditoria + '/' + audId]: { tipo: 'ativacao', propostaId: id, versaoMotor: vig.versaoEmVigor, versaoAnterior: vig.versaoAnterior, seq, usuario: { uid: u.uid, email: u.email }, dataHora: io.agora(), origem: 'fronteira' }
    });
  }
  async function ativarEntradaEmVigor(auth, dados, opcoes) {
    const u = await quem(auth, 'admin');
    if (!opcoes || opcoes.habilitada !== true) return { ativada: false, motivos: ['ATIVACAO_DESABILITADA'] };
    const id = dados && dados.propostaId;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(id)) throw new ErroFronteira('invalid-argument', 'propostaId inválido.');
    /* repetição: a proposta já consumida devolve o resultado anterior (e completa o registro, se faltou) */
    const vig0 = await io.ler(NOS.vigencia);
    if (vig0 && vig0.consumidas && vig0.consumidas[id] && vig0.consumidas[id] === vig0.seq && vig0.propostaId === id) {
      if (!(await io.ler(NOS_FRONTEIRA.ativacoes + '/' + id))) await registrarAtivacao(id, vig0, u);
      return { ativada: true, jaAtivada: true, versaoEmVigor: vig0.versaoEmVigor, seq: vig0.seq };
    }
    const r = await avaliarProposta(id);
    if (!r.apta) return { ativada: false, motivos: r.motivos };
    const emVigorInicio = G.versaoEmVigorRegistrada(r.vig), seqInicio = (r.vig && r.vig.seq) || 0, agora = io.agora(), d = r.detalhes;
    const tx = await io.transacao(NOS.vigencia, (atual) => {
      if (G.versaoEmVigorRegistrada(atual) !== emVigorInicio || ((atual && atual.seq) || 0) !== seqInicio) return undefined;
      if (atual && atual.consumidas && atual.consumidas[id]) return undefined;
      const seq = seqInicio + 1;
      return Object.assign({}, atual || {}, { versaoEmVigor: d.versaoMotor, versaoAnterior: emVigorInicio, seq, propostaId: id, versaoRedacao: d.versaoRedacao,
        digestRedacao: d.digestRedacao, digestDefinicao: d.digestDefinicao, digestImpacto: d.digestImpacto, ativadoEm: agora, ativadoPor: { uid: u.uid, email: u.email },
        consumidas: Object.assign({}, (atual && atual.consumidas) || {}, { [id]: seq }) });
    });
    if (!tx.confirmada) return { ativada: false, motivos: [tx.valor && tx.valor.consumidas && tx.valor.consumidas[id] ? 'PROPOSTA_JA_CONSUMIDA' : 'VIGENCIA_MUDOU'] };
    await registrarAtivacao(id, tx.valor, u);
    return { ativada: true, jaAtivada: false, versaoEmVigor: tx.valor.versaoEmVigor, seq: tx.valor.seq };
  }

  return Object.freeze({ validarRedacaoPublicada, conferirEntradaEmVigor, ativarEntradaEmVigor });
}

/* adaptador do Admin SDK do Realtime Database */
function ioDoAdmin(database) {
  return {
    ler: (c) => database.ref(c).once('value').then((s) => { const v = s.val(); return v === undefined ? null : v; }),
    gravar: (w) => database.ref().update(w),
    transacao: (c, f) => database.ref(c).transaction(f, undefined, false).then((r) => ({ confirmada: r.committed, valor: r.snapshot.val() })),
    novaChave: (c) => database.ref(c).push().key,
    agora: () => Date.now()
  };
}
module.exports = { criarFronteira, ioDoAdmin, ErroFronteira, ADMINS_FIXOS, NOS_FRONTEIRA, CODIGO };
