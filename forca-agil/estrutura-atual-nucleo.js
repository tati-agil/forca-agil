/* ═════════════════════════════════════════════════════════════════
   ESTRUTURA ORGANIZACIONAL ATUAL — núcleo puro (window.faEstruturaAtualNucleo / module.exports).
   O cadastro das unidades como elas existem HOJE na organização (diretoria, gerência, núcleo…), com a unidade
   superior, situação, fonte e vigência. É um domínio SEPARADO das Estruturas Organizacionais do Mapa (estruturas
   concretas tipadas pela Taxonomia): aqui não há tipo arquitetural, e nada daqui vira estrutura do Mapa, vínculo
   formal, proposta ou aprovação. A Porta 2 só o usa para escolher a área analisada e quem executa hoje.
   Recebe o estado, os dados e o contexto (ids, usuário, horário) e devolve a unidade nova + o evento de histórico
   e o payload multipath — sem Firebase, sem DOM, sem relógio, sem gerador de ids.
   Regras (também conferidas pelo banco, montar-regras-estrutura-atual.js):
   - nome obrigatório; nível da lista do domínio (Diretoria, Gerência, Núcleo, Outro + texto);
   - unidade superior ativa, nunca ela mesma nem uma subordinada dela (sem ciclo), profundidade até PROFUNDIDADE_MAX;
   - revisão + 1 a cada gravação (gravação velha é recusada); encerrar exige motivo e nenhuma subordinada ativa;
   - encerrada é final; nada se apaga; todo evento vai para o histórico (só acréscimo).
   ═════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';
  var NOS = { unidades: 'estrutura-atual-unidades', filhos: 'estrutura-atual-filhos', auditoria: 'estrutura-atual-auditoria',
    config: 'estrutura-atual-config', configAuditoria: 'estrutura-atual-config-auditoria' };
  var NIVEIS = { diretoria: 'Diretoria', gerencia: 'Gerência', nucleo: 'Núcleo', outro: 'Outro' };
  var HABILITACOES = ['DESLIGADO', 'LIBERADO'];
  var MAX = { nome: 200, sigla: 30, nivelOutro: 100, fonte: 500, motivo: 500 };
  var PROFUNDIDADE_MAX = 10;
  var ID = /^[A-Za-z0-9_-]{1,60}$/;
  var DATA = /^\d{4}-\d{2}-\d{2}$/;

  function erro(codigo, det) { var e = { codigo: codigo }; if (det) Object.keys(det).forEach(function (k) { e[k] = det[k]; }); return { ok: false, erro: e }; }
  function texto(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max; }
  function opcional(v, max) { return v === undefined || v === null || v === '' || (typeof v === 'string' && v.trim().length <= max); }
  function limpo(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }
  function unidadesDe(estado) { return (estado && estado.unidades) || {}; }
  function autor(ctx) { return { uid: ctx.usuario.uid, email: ctx.usuario.email }; }
  function validarCtx(ctx, novo) {
    if (!ctx || !ctx.usuario || !ctx.usuario.uid || !ctx.usuario.email || ctx.agora === undefined) return 'CTX_INVALIDO';
    if (novo && !(typeof ctx.novoId === 'string' && ID.test(ctx.novoId))) return 'CTX_ID_AUSENTE';
    if (!(typeof ctx.auditoriaId === 'string' && ID.test(ctx.auditoriaId))) return 'CTX_AUDITORIA_AUSENTE';
    return null;
  }
  function validarDados(d) {
    d = d || {};
    if (!texto(d.nome, MAX.nome)) return 'NOME_OBRIGATORIO';
    if (!opcional(d.sigla, MAX.sigla)) return 'SIGLA_INVALIDA';
    if (!NIVEIS[d.nivel]) return 'NIVEL_INVALIDO';
    if (d.nivel === 'outro' && !texto(d.nivelOutro, MAX.nivelOutro)) return 'NIVEL_OUTRO_OBRIGATORIO';
    if (!opcional(d.fonte, MAX.fonte)) return 'FONTE_INVALIDA';
    if (d.vigenciaInicio && !(typeof d.vigenciaInicio === 'string' && DATA.test(d.vigenciaInicio))) return 'VIGENCIA_INVALIDA';
    return null;
  }
  /* cadeia de superiores (do mais próximo ao topo); para ao repetir — o banco nunca deixa um ciclo entrar */
  function ancestrais(estado, id) {
    var u = unidadesDe(estado), out = [], vistos = {}, atual = u[id] ? u[id].superiorId : null;
    while (atual && !vistos[atual]) { vistos[atual] = true; out.push(atual); atual = u[atual] ? u[atual].superiorId : null; }
    return out;
  }
  function subordinadasAtivas(estado, id) {
    var u = unidadesDe(estado);
    return Object.keys(u).filter(function (k) { return u[k].superiorId === id && u[k].situacao === 'ativa'; }).sort(function (a, b) { return String(u[a].nome).localeCompare(String(u[b].nome), 'pt-BR'); });
  }
  /* superior válido para `id` (null = sem superior): existe, ativo, não é ela mesma nem uma descendente; profundidade limitada */
  function conferirSuperior(estado, id, superiorId) {
    if (superiorId === null || superiorId === undefined || superiorId === '') return null;
    var u = unidadesDe(estado), s = u[superiorId];
    if (!s) return 'SUPERIOR_INEXISTENTE';
    if (s.situacao !== 'ativa') return 'SUPERIOR_ENCERRADA';
    if (id && superiorId === id) return 'SUPERIOR_E_ELA_MESMA';
    var cadeia = [superiorId].concat(ancestrais(estado, superiorId));
    if (id && cadeia.indexOf(id) !== -1) return 'CICLO_NA_HIERARQUIA';
    if (cadeia.length > PROFUNDIDADE_MAX) return 'HIERARQUIA_PROFUNDA_DEMAIS';
    return null;
  }
  function camposDe(d) {
    return { nome: d.nome.trim(), sigla: limpo(d.sigla), nivel: d.nivel, nivelOutro: d.nivel === 'outro' ? d.nivelOutro.trim() : null, fonte: limpo(d.fonte), vigenciaInicio: d.vigenciaInicio || null };
  }
  function resumo(x) { return x ? { nome: x.nome, sigla: x.sigla || null, nivel: x.nivel, nivelOutro: x.nivelOutro || null, superiorId: x.superiorId || null, situacao: x.situacao, fonte: x.fonte || null, vigenciaInicio: x.vigenciaInicio || null } : null; }
  function resultado(antes, depois, tipo, ctx, motivo) {
    var ev = { tipo: tipo, unidadeId: depois.id, antes: resumo(antes), depois: resumo(depois), em: ctx.agora, por: autor(ctx) };
    if (motivo) ev.motivo = motivo;
    return { ok: true, unidade: depois, antes: antes || null, evento: ev, auditoriaId: ctx.auditoriaId };
  }

  function criarUnidade(estado, dados, ctx) {
    var c = validarCtx(ctx, true); if (c) return erro(c);
    var v = validarDados(dados); if (v) return erro(v);
    if (unidadesDe(estado)[ctx.novoId]) return erro('ID_JA_USADO');
    var sup = limpo(dados.superiorId), s = conferirSuperior(estado, null, sup); if (s) return erro(s);
    var u = camposDe(dados);
    u.id = ctx.novoId; u.superiorId = sup; u.situacao = 'ativa'; u.revisao = 1;
    u.criadaEm = ctx.agora; u.criadaPor = autor(ctx); u.atualizadaEm = ctx.agora; u.atualizadaPor = autor(ctx); u.auditoriaId = ctx.auditoriaId;
    return resultado(null, u, 'criacao', ctx);
  }
  function abrir(estado, id) {
    var x = unidadesDe(estado)[id];
    if (!x) return { erro: erro('UNIDADE_INEXISTENTE') };
    if (x.situacao !== 'ativa') return { erro: erro('UNIDADE_ENCERRADA') };
    return { atual: x, nova: JSON.parse(JSON.stringify(x)) };
  }
  function carimbar(u, ctx) { u.revisao = (u.revisao || 1) + 1; u.atualizadaEm = ctx.agora; u.atualizadaPor = autor(ctx); u.auditoriaId = ctx.auditoriaId; }
  /* nome, sigla, nível, fonte e vigência (a unidade superior muda só por mudarSuperior) */
  function alterarUnidade(estado, id, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    var v = validarDados(dados); if (v) return erro(v);
    var al = abrir(estado, id); if (al.erro) return al.erro;
    var f = camposDe(dados), mudou = Object.keys(f).some(function (k) { return (al.atual[k] || null) !== f[k]; });
    if (!mudou) return erro('SEM_ALTERACAO');
    Object.keys(f).forEach(function (k) { al.nova[k] = f[k]; });
    carimbar(al.nova, ctx);
    return resultado(al.atual, al.nova, 'alteracao', ctx);
  }
  function mudarSuperior(estado, id, superiorId, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    var al = abrir(estado, id); if (al.erro) return al.erro;
    var sup = limpo(superiorId);
    if ((al.atual.superiorId || null) === sup) return erro('SEM_ALTERACAO');
    var s = conferirSuperior(estado, id, sup); if (s) return erro(s);
    var motivo = dados && limpo(dados.motivo);
    if (motivo && motivo.length > MAX.motivo) return erro('MOTIVO_INVALIDO');
    al.nova.superiorId = sup; carimbar(al.nova, ctx);
    return resultado(al.atual, al.nova, 'superior', ctx, motivo);
  }
  function encerrarUnidade(estado, id, dados, ctx) {
    var c = validarCtx(ctx); if (c) return erro(c);
    var motivo = dados && limpo(dados.motivo);
    if (!motivo || motivo.length > MAX.motivo) return erro('MOTIVO_OBRIGATORIO');
    var al = abrir(estado, id); if (al.erro) return al.erro;
    var subs = subordinadasAtivas(estado, id);
    if (subs.length) return erro('TEM_SUBORDINADAS_ATIVAS', { subordinadas: subs });
    al.nova.situacao = 'encerrada'; al.nova.encerramento = { motivo: motivo, em: ctx.agora, por: autor(ctx) };
    carimbar(al.nova, ctx);
    return resultado(al.atual, al.nova, 'encerramento', ctx, motivo);
  }
  /* uma gravação atômica: a unidade inteira + o índice de subordinadas ativas + o evento novo do histórico.
     `agora` é o marcador do horário do servidor (o mesmo valor vale para todos os horários desta gravação) */
  function payload(r, agora) {
    var w = {}, u = JSON.parse(JSON.stringify(r.unidade)), a = r.antes;
    u.atualizadaEm = agora; if (!a) u.criadaEm = agora; if (u.encerramento && (!a || !a.encerramento)) u.encerramento.em = agora;
    ['sigla', 'nivelOutro', 'fonte', 'vigenciaInicio', 'superiorId'].forEach(function (k) { if (u[k] === null) delete u[k]; });
    w[NOS.unidades + '/' + u.id] = u;
    var supAntes = a && a.situacao === 'ativa' ? a.superiorId || null : null, supDepois = u.situacao === 'ativa' ? u.superiorId || null : null;
    if (supAntes && supAntes !== supDepois) w[NOS.filhos + '/' + supAntes + '/' + u.id] = null;
    if (supDepois && supDepois !== supAntes) w[NOS.filhos + '/' + supDepois + '/' + u.id] = true;
    var ev = JSON.parse(JSON.stringify(r.evento)); ev.em = agora;
    w[NOS.auditoria + '/' + u.id + '/' + r.auditoriaId] = ev;
    return w;
  }
  /* o marcador do domínio: só o admin geral muda, com motivo e auditoria (o banco confere o perfil) */
  function payloadHabilitacao(atual, nova, motivo, ctx, agora) {
    if (HABILITACOES.indexOf(nova) === -1) return erro('HABILITACAO_INVALIDA');
    if (!texto(motivo, MAX.motivo)) return erro('MOTIVO_OBRIGATORIO');
    if (!ctx || !ctx.usuario || !(typeof ctx.auditoriaId === 'string' && ID.test(ctx.auditoriaId))) return erro('CTX_INVALIDO');
    var w = {}, por = autor(ctx);
    w[NOS.config] = { habilitacao: nova, motivo: motivo.trim(), alteradoEm: agora, alteradoPor: por, auditoriaId: ctx.auditoriaId };
    w[NOS.configAuditoria + '/' + ctx.auditoriaId] = { habilitacao: nova, anterior: atual || 'DESLIGADO', motivo: motivo.trim(), usuario: por, dataHora: agora };
    return { ok: true, payload: w };
  }
  /* leitura: árvore em ordem (superior antes das subordinadas; irmãs por nome) */
  function arvore(estado, incluirEncerradas) {
    var u = unidadesDe(estado), out = [];
    var visiveis = Object.keys(u).filter(function (k) { return incluirEncerradas || u[k].situacao === 'ativa'; });
    var filhosDe = function (sup) { return visiveis.filter(function (k) { return (u[k].superiorId || null) === sup || (sup === null && u[k].superiorId && visiveis.indexOf(u[k].superiorId) === -1); })
      .sort(function (a, b) { return String(u[a].nome).localeCompare(String(u[b].nome), 'pt-BR'); }); };
    var vistos = {};
    (function desce(sup, nivel) { filhosDe(sup).forEach(function (k) { if (vistos[k]) return; vistos[k] = true; out.push({ id: k, profundidade: nivel, unidade: u[k] }); desce(k, nivel + 1); }); })(null, 0);
    return out;
  }
  function rotuloNivel(x) { return x ? (x.nivel === 'outro' ? (x.nivelOutro || 'Outro') : NIVEIS[x.nivel] || x.nivel) : ''; }
  function rotulo(x) { return x ? (x.sigla ? x.sigla + ' — ' : '') + x.nome : ''; }

  var api = { NOS: NOS, NIVEIS: NIVEIS, HABILITACOES: HABILITACOES.slice(), MAX: MAX, PROFUNDIDADE_MAX: PROFUNDIDADE_MAX,
    validarDados: validarDados, conferirSuperior: conferirSuperior, ancestrais: ancestrais, subordinadasAtivas: subordinadasAtivas,
    criarUnidade: criarUnidade, alterarUnidade: alterarUnidade, mudarSuperior: mudarSuperior, encerrarUnidade: encerrarUnidade,
    payload: payload, payloadHabilitacao: payloadHabilitacao, arvore: arvore, rotuloNivel: rotuloNivel, rotulo: rotulo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faEstruturaAtualNucleo = Object.freeze(api);
})(typeof window !== 'undefined' ? window : null);
