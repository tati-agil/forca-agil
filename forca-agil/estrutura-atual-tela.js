/* ═════════════════════════════════════════════════════════════════
   ESTRUTURA ORGANIZACIONAL ATUAL — tela do ADMIN › Avaliação e Mapa (#admin?arq=estrutura-atual) e a leitura que a
   Porta 2 usa para escolher a área e quem executa hoje (window.faEstruturaAtualAdmin).
   Só cadastro do que existe hoje: árvore, ficha com histórico, criar (também subordinada, pela ficha da superior),
   editar, mudar a unidade superior e encerrar (com motivo). Nada se apaga; nada daqui vira estrutura do Mapa, vínculo
   formal, proposta ou aprovação. Toda regra é do núcleo (estrutura-atual-nucleo.js) e o banco confere de novo.
   Acesso: consultam os três perfis da Avaliação; mantêm admin geral e Avaliação + Configuração, e só com o marcador
   próprio (estrutura-atual-config/habilitacao) em LIBERADO — ausente = DESLIGADO. Só o admin geral muda o marcador.
   Tela de edição só aparece para quem consegue gravar (sem edição que não salva).
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function N() { return window.faEstruturaAtualNucleo; }
  function S() { return window.faServicosPosicionamento; }
  function A() { return window.faAuth; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtData(v) { if (!v || typeof v !== 'number') return '—'; var d = new Date(v); return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function fmtDia(v) { return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : '—'; }
  var PRAZO = 15000;
  var D = { hab: undefined, unidades: undefined, erro: null };
  var ouvintes = { cfg: null, un: null }, aoMudarFns = [];
  function sessao() { return A() && A().getSession ? A().getSession() : null; }
  function adminGeral() { var se = sessao(); return !!(se && A().isAdmin && A().isAdmin(se.email)); }
  /* manter: admin geral ou avaliacao-arquitetura; consultar: também avaliacao (os três perfis da Avaliação) */
  function perfilManter() { return !!(A() && A().podeArquitetura && A().podeArquitetura()); }
  function perfilConsultar() { return !!(A() && A().podeAvaliacao && A().podeAvaliacao()); }
  function habilitacao() { return D.hab === undefined ? undefined : D.hab || 'DESLIGADO'; }
  function podeManter() { return perfilManter() && habilitacao() === 'LIBERADO'; }
  function avisar() { aoMudarFns.forEach(function (f) { try { f(); } catch (e) { /* uma tela não derruba a outra */ } }); }
  function ligar() {
    if (!S() || !N() || !sessao()) return;
    if (!ouvintes.cfg) ouvintes.cfg = S().ouvir(N().NOS.config, function (v) { D.hab = v && v.habilitacao ? v.habilitacao : null; avisar(); }, function () { D.hab = null; avisar(); });
    if (!ouvintes.un && perfilConsultar()) ouvintes.un = S().ouvir(N().NOS.unidades, function (v) { D.unidades = v || {}; D.erro = null; avisar(); }, function () { D.unidades = null; D.erro = 'RECUSADA'; avisar(); });
  }
  function desligar() { if (ouvintes.cfg) ouvintes.cfg(); if (ouvintes.un) ouvintes.un(); ouvintes.cfg = ouvintes.un = null; D.hab = undefined; D.unidades = undefined; D.erro = null; }
  ['fa-auth-ready', 'fa-avaliacao-ready', 'fa-admin-ready'].forEach(function (ev) { window.addEventListener(ev, function () { ligar(); avisar(); }); });
  window.addEventListener('fa-auth-change', function () { desligar(); ligar(); avisar(); });
  function estado() { return { unidades: D.unidades || {} }; }
  /* para a Porta 2: unidades ativas em árvore (undefined = ainda lendo; null = indisponível para o perfil) */
  function unidadesAtivas() { ligar(); if (D.unidades === undefined) return undefined; if (D.unidades === null) return null; return N().arvore(estado()); }
  function unidade(id) { return (D.unidades || {})[id] || null; }

  var wrap = null, origem = null, st = { view: 'lista', id: null, form: null, erro: null, flash: null, gravando: false, encerradas: false, historico: null, sujo: false };
  var MENSAGENS = { NOME_OBRIGATORIO: 'Informe o nome da unidade.', NIVEL_INVALIDO: 'Escolha o nível organizacional.', NIVEL_OUTRO_OBRIGATORIO: 'Descreva o nível (em "Outro").',
    SIGLA_INVALIDA: 'A sigla tem até 30 caracteres.', FONTE_INVALIDA: 'A fonte tem até 500 caracteres.', VIGENCIA_INVALIDA: 'Informe a data de início da vigência.',
    SUPERIOR_INEXISTENTE: 'A unidade superior escolhida não existe mais.', SUPERIOR_ENCERRADA: 'A unidade superior escolhida está encerrada.', SUPERIOR_E_ELA_MESMA: 'Uma unidade não pode ser superior dela mesma.',
    CICLO_NA_HIERARQUIA: 'Essa unidade superior é subordinada a esta unidade: a hierarquia ficaria em ciclo.', HIERARQUIA_PROFUNDA_DEMAIS: 'A hierarquia passaria do limite de níveis.',
    SEM_ALTERACAO: 'Nada mudou.', MOTIVO_OBRIGATORIO: 'Informe o motivo.', TEM_SUBORDINADAS_ATIVAS: 'Esta unidade tem subordinadas ativas: encerre-as ou mude a superior delas antes.',
    UNIDADE_ENCERRADA: 'Esta unidade está encerrada: não pode ser alterada.', UNIDADE_INEXISTENTE: 'Unidade não encontrada.' };
  function msg(e) { return (e && MENSAGENS[e.codigo]) || 'Não foi possível gravar (' + (e && e.codigo) + ').'; }

  function montar() {
    wrap = document.getElementById('adminEstruturaAtual');
    if (!wrap) return false;
    aoMudarFns.push(function () { if (!wrap.hidden) render(); });
    wrap.addEventListener('click', aoClicar);
    wrap.addEventListener('submit', aoEnviar);
    wrap.addEventListener('change', function (ev) {
      st.sujo = !!(ev.target && ev.target.closest('form'));
      if (ev.target && ev.target.id === 'eaNivel') { var o = document.getElementById('eaNivelOutroCampo'); if (o) o.hidden = ev.target.value !== 'outro'; }
      if (ev.target && ev.target.id === 'eaMostrarEncerradas') { st.encerradas = ev.target.checked; render(); }
    });
    wrap.addEventListener('input', function (ev) { if (ev.target && ev.target.closest('form')) st.sujo = true; });
    wrap.addEventListener('toggle', function (ev) { if (ev.target && ev.target.id === 'eaHistorico' && ev.target.open) carregarHistorico(); }, true);
    return true;
  }
  function vizinhos(esconder) {
    ['adminAvaliacaoProduto', 'adminAvaliacaoSquad', 'adminEstruturas'].forEach(function (id) { var el = document.getElementById(id); if (el && esconder) el.hidden = true; });
    if (!esconder) { var p = document.getElementById('adminAvaliacaoProduto'); if (p) p.hidden = false; }
  }
  function abrir(o) {
    if (!wrap && !montar()) return;
    origem = o || null; st.view = 'lista'; st.id = null; st.form = null; st.erro = null; st.flash = null; st.sujo = false;
    vizinhos(true); wrap.hidden = false; ligar(); render();
    var t = document.getElementById('eaTitulo'); if (t) t.focus({ preventScroll: true });
  }
  function fechar() { if (!wrap) return; wrap.hidden = true; st.sujo = false; vizinhos(false); }
  function sair() { fechar(); if (origem && origem.voltar) origem.voltar(); }
  function confirmarDescarte() { return !st.sujo || window.confirm('Há alterações não gravadas. Sair mesmo assim?'); }
  function ir(view, id, form) { st.view = view; st.id = id || null; st.form = form || null; st.erro = null; st.sujo = false; st.historico = null; render(); var t = document.getElementById('eaTitulo'); if (t) { t.focus({ preventScroll: true }); t.scrollIntoView({ block: 'start' }); } }

  function cabecalho(titulo, voltarRotulo, voltarAcao) {
    return '<button type="button" class="avp-voltar-link" data-ea="' + voltarAcao + '" id="eaVoltar">← ' + esc(voltarRotulo) + '</button>' +
      '<h4 class="est-titulo" id="eaTitulo" tabindex="-1">' + esc(titulo) + '</h4>';
  }
  function avisos() {
    return (st.flash ? '<p class="avp-flash-success" id="eaFlash" role="status">' + esc(st.flash) + '</p>' : '') + (st.erro ? '<p class="avp-error-msg" id="eaErro" role="alert">' + esc(st.erro) + '</p>' : '');
  }
  function marcadorHtml() {
    var h = habilitacao(), lib = h === 'LIBERADO';
    var t = '<div class="ea-marcador" id="eaMarcador"><p><strong>Gravação:</strong> <span class="an-chip an-chip--' + (lib ? 'ok' : 'pend') + '" id="eaMarcadorValor">' + (lib ? 'Liberada' : 'Desligada') + '</span> ' +
      (lib ? (perfilManter() ? '' : '<span class="an-det">Manter o cadastro é do admin geral e do perfil Avaliação + Configuração.</span>') : '<span class="an-det">Cadastro só para consulta até a liberação pelo admin geral.</span>') + '</p>';
    if (adminGeral()) t += '<details class="an-conceitos" id="eaMarcadorDet"><summary>' + (lib ? 'Desligar a gravação' : 'Liberar a gravação') + '</summary><form class="an-form" id="eaFormMarcador" data-nova="' + (lib ? 'DESLIGADO' : 'LIBERADO') + '">' +
      '<div class="avp-field"><label for="eaMarcadorMotivo">Motivo</label><input id="eaMarcadorMotivo" maxlength="500"></div><p class="an-nota">Fica no histórico do marcador. Independe da habilitação da Análise Organizacional.</p>' +
      '<div class="avp-actions-footer"><button type="submit" class="btn btn--sm btn--primary" id="eaMarcadorGravar">' + (lib ? 'Desligar' : 'Liberar') + '</button></div></form></details>';
    return t + '</div>';
  }
  function linhaUnidade(x) {
    var u = x.unidade;
    return '<li class="ea-no' + (u.situacao === 'encerrada' ? ' ea-no--encerrada' : '') + '" style="--ea-nivel:' + Math.min(x.profundidade, 6) + '" data-unidade="' + esc(x.id) + '">' +
      '<button type="button" class="ea-no-botao" data-ea="ficha" data-id="' + esc(x.id) + '" id="eaAbrir_' + esc(x.id) + '"><span class="ea-no-nome">' + esc(N().rotulo(u)) + '</span>' +
      '<span class="an-chip an-chip--neu">' + esc(N().rotuloNivel(u)) + '</span>' + (u.situacao === 'encerrada' ? '<span class="an-chip an-chip--pend">Encerrada</span>' : '') + '</button></li>';
  }
  function renderLista() {
    var h = cabecalho('Estrutura Organizacional Atual', 'Voltar para ' + ((origem && origem.rotulo) || 'Avaliação e Mapa'), 'sair') +
      '<p class="an-intro">As unidades como existem hoje — diretorias, gerências, núcleos — com a unidade superior. Serve para escolher a área analisada e quem executa cada responsabilidade na Porta 2. <strong>Não é a Estrutura Organizacional do Mapa</strong>: não tem tipo arquitetural nem vínculo formal.</p>' +
      marcadorHtml() + avisos();
    if (D.unidades === undefined) return h + '<p class="loading-msg" id="eaCarregando">Carregando…</p>';
    if (D.unidades === null) return h + '<p class="avp-error-msg" id="eaIndisponivel">Não foi possível ler o cadastro agora.</p>';
    if (podeManter()) h += '<div class="avp-actions-bar"><button type="button" class="btn btn--primary" data-ea="nova" id="eaNovaBtn">Nova unidade</button></div>';
    var lista = N().arvore(estado(), st.encerradas), total = Object.keys(D.unidades).length;
    h += '<label class="an-opcao an-opcao--linha"><input type="checkbox" id="eaMostrarEncerradas"' + (st.encerradas ? ' checked' : '') + '><span>Mostrar encerradas</span></label>';
    if (!total) return h + '<p class="admin-empty" id="eaVazio">Nenhuma unidade cadastrada.' + (podeManter() ? ' Comece pela unidade mais alta (por exemplo, a gerência) e crie as subordinadas pela ficha dela.' : '') + '</p>';
    return h + '<ul class="ea-arvore" id="eaArvore" aria-label="Unidades em ordem hierárquica">' + lista.map(linhaUnidade).join('') + '</ul>';
  }
  function renderFicha() {
    var u = unidade(st.id);
    if (D.unidades === undefined) return cabecalho('Unidade', 'Voltar para a Estrutura Atual', 'lista') + '<p class="loading-msg">Carregando…</p>';
    if (!u) return cabecalho('Unidade', 'Voltar para a Estrutura Atual', 'lista') + '<p class="admin-empty" id="eaNaoEncontrada">Unidade não encontrada.</p>';
    var sup = u.superiorId ? unidade(u.superiorId) : null, subs = N().subordinadasAtivas(estado(), u.id), ativa = u.situacao === 'ativa';
    var h = cabecalho(N().rotulo(u), 'Voltar para a Estrutura Atual', 'lista') + avisos() +
      '<dl class="an-objeto-dl ea-ficha" id="eaFicha">' +
      '<div><dt>Nome</dt><dd id="eaFichaNome">' + esc(u.nome) + '</dd></div>' +
      '<div><dt>Sigla</dt><dd>' + esc(u.sigla || '—') + '</dd></div>' +
      '<div><dt>Nível organizacional</dt><dd id="eaFichaNivel">' + esc(N().rotuloNivel(u)) + '</dd></div>' +
      '<div><dt>Unidade superior</dt><dd id="eaFichaSuperior">' + (sup ? '<button type="button" class="btn btn--sm an-link" data-ea="ficha" data-id="' + esc(u.superiorId) + '">' + esc(N().rotulo(sup)) + '</button>' : 'Nenhuma (topo)') + '</dd></div>' +
      '<div><dt>Situação</dt><dd id="eaFichaSituacao">' + (ativa ? 'Ativa' : 'Encerrada em ' + esc(fmtData(u.encerramento && u.encerramento.em)) + ' — ' + esc(u.encerramento && u.encerramento.motivo)) + '</dd></div>' +
      '<div><dt>Fonte</dt><dd>' + esc(u.fonte || '—') + '</dd></div>' +
      '<div><dt>Início da vigência</dt><dd>' + esc(fmtDia(u.vigenciaInicio)) + '</dd></div>' +
      '<div><dt>Subordinadas ativas</dt><dd id="eaFichaSubordinadas">' + (subs.length ? subs.map(function (k) { return '<button type="button" class="btn btn--sm an-link" data-ea="ficha" data-id="' + esc(k) + '">' + esc(N().rotulo(unidade(k))) + '</button>'; }).join(' ') : 'Nenhuma') + '</dd></div></dl>';
    if (podeManter() && ativa) h += '<div class="avp-actions-footer ea-acoes" id="eaAcoes"><button type="button" class="btn btn--sm btn--primary" data-ea="nova" data-sup="' + esc(u.id) + '" id="eaCriarSubordinada">Criar subordinada</button>' +
      '<button type="button" class="btn btn--sm" data-ea="editar" data-id="' + esc(u.id) + '" id="eaEditarBtn">Editar</button>' +
      '<button type="button" class="btn btn--sm" data-ea="superior" data-id="' + esc(u.id) + '" id="eaSuperiorBtn">Alterar unidade superior</button>' +
      '<button type="button" class="btn btn--sm btn--danger" data-ea="encerrar" data-id="' + esc(u.id) + '" id="eaEncerrarBtn">Encerrar</button></div>';
    var hs = st.historico && st.historico.id === u.id ? st.historico.eventos : null;
    h += '<details class="avp-form-card an-secao an-comp-secao" id="eaHistorico"' + (st.historico && st.historico.id === u.id && st.historico.aberto ? ' open' : '') + '><summary>Histórico</summary>' +
      (hs === null ? '<p class="loading-msg">Carregando…</p>' : hs === false ? '<p class="avp-error-msg">Não foi possível ler o histórico agora.</p>' :
        '<ol class="an-eventos" id="eaEventos">' + hs.map(function (e) { return '<li>' + esc(fmtData(e.em)) + ' — ' + esc(textoEvento(e)) + ' <span class="an-det">' + esc(e.por && e.por.email) + '</span></li>'; }).join('') + '</ol>') + '</details>';
    return h;
  }
  function textoEvento(e) {
    var a = e.antes || {}, d = e.depois || {};
    if (e.tipo === 'criacao') return 'Criada' + (d.superiorId ? ' subordinada a ' + nomeDe(d.superiorId) : '') + '.';
    if (e.tipo === 'superior') return 'Unidade superior: ' + (a.superiorId ? nomeDe(a.superiorId) : 'nenhuma') + ' → ' + (d.superiorId ? nomeDe(d.superiorId) : 'nenhuma') + (e.motivo ? ' (motivo: ' + e.motivo + ')' : '') + '.';
    if (e.tipo === 'encerramento') return 'Encerrada. Motivo: ' + (e.motivo || '—') + '.';
    var mud = ['nome', 'sigla', 'nivel', 'nivelOutro', 'fonte', 'vigenciaInicio'].filter(function (k) { return (a[k] || null) !== (d[k] || null); })
      .map(function (k) { return { nome: 'nome', sigla: 'sigla', nivel: 'nível', nivelOutro: 'nível (outro)', fonte: 'fonte', vigenciaInicio: 'vigência' }[k] + ': "' + (a[k] || '—') + '" → "' + (d[k] || '—') + '"'; });
    return 'Alterada — ' + (mud.join('; ') || 'sem diferença registrada') + '.';
  }
  function nomeDe(id) { var u = unidade(id); return u ? N().rotulo(u) : id; }
  function carregarHistorico() {
    var id = st.id; if (!id) return;
    st.historico = { id: id, eventos: null, aberto: true }; render();
    S().lerUmaVez(N().NOS.auditoria + '/' + id, 12000).then(function (v) {
      if (st.id !== id) return;
      st.historico = { id: id, aberto: true, eventos: Object.keys(v || {}).map(function (k) { return v[k]; }).sort(function (x, y) { return (x.em || 0) - (y.em || 0); }) }; render();
    }, function () { if (st.id === id) { st.historico = { id: id, aberto: true, eventos: false }; render(); } });
  }
  function camposUnidade(u) {
    u = u || {};
    return '<div class="avp-field"><label for="eaNome">Nome *</label><input id="eaNome" maxlength="200" value="' + esc(u.nome || '') + '"></div>' +
      '<div class="avp-field"><label for="eaSigla">Sigla <span class="an-opc">(opcional)</span></label><input id="eaSigla" maxlength="30" value="' + esc(u.sigla || '') + '"></div>' +
      '<div class="avp-field"><label for="eaNivel">Nível organizacional *</label><select id="eaNivel"><option value="">—</option>' + Object.keys(N().NIVEIS).map(function (k) { return '<option value="' + k + '"' + (u.nivel === k ? ' selected' : '') + '>' + esc(N().NIVEIS[k]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="avp-field" id="eaNivelOutroCampo"' + (u.nivel === 'outro' ? '' : ' hidden') + '><label for="eaNivelOutro">Qual nível? *</label><input id="eaNivelOutro" maxlength="100" value="' + esc(u.nivelOutro || '') + '"></div>' +
      '<div class="avp-field"><label for="eaFonte">Fonte <span class="an-opc">(opcional — ex.: regimento, organograma)</span></label><input id="eaFonte" maxlength="500" value="' + esc(u.fonte || '') + '"></div>' +
      '<div class="avp-field"><label for="eaVigencia">Início da vigência <span class="an-opc">(opcional)</span></label><input type="date" id="eaVigencia" value="' + esc(u.vigenciaInicio || '') + '"></div>';
  }
  /* superiores possíveis: ativas, fora da própria unidade e das subordinadas dela (o núcleo e o banco conferem de novo) */
  function opcoesSuperior(id, atual) {
    return N().arvore(estado()).filter(function (x) { return !id || (x.id !== id && N().ancestrais(estado(), x.id).indexOf(id) === -1); })
      .map(function (x) { return '<option value="' + esc(x.id) + '"' + (atual === x.id ? ' selected' : '') + '>' + '— '.repeat(x.profundidade) + esc(N().rotulo(x.unidade)) + '</option>'; }).join('');
  }
  function renderForm() {
    var v = st.view, u = st.id ? unidade(st.id) : null, f = st.form || {};
    if (!podeManter()) return cabecalho('Estrutura Organizacional Atual', 'Voltar', 'lista') + '<p class="admin-empty" id="eaSemPermissao">Manter o cadastro é do admin geral e do perfil Avaliação + Configuração, com a gravação liberada.</p>';
    if (v === 'nova') {
      var sup = f.superiorId ? unidade(f.superiorId) : null;
      return cabecalho(sup ? 'Nova subordinada de ' + N().rotulo(sup) : 'Nova unidade', sup ? 'Voltar para a ficha' : 'Voltar para a Estrutura Atual', sup ? 'voltar-ficha' : 'lista') + avisos() +
        '<form class="avp-form-card an-form" id="eaFormUnidade" data-modo="nova">' + camposUnidade(f.dados) +
        '<div class="avp-field"><label for="eaSuperior">Unidade superior <span class="an-opc">(opcional)</span></label><select id="eaSuperior"><option value="">Nenhuma (topo)</option>' + opcoesSuperior(null, f.superiorId) + '</select></div>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="eaGravar"' + (st.gravando ? ' disabled' : '') + '>' + (st.gravando ? 'Gravando…' : 'Gravar') + '</button><button type="button" class="btn btn--sm" data-ea="' + (sup ? 'voltar-ficha' : 'lista') + '">Cancelar</button></div></form>';
    }
    if (!u || u.situacao !== 'ativa') return cabecalho('Unidade', 'Voltar para a Estrutura Atual', 'lista') + '<p class="admin-empty" id="eaNaoEncontrada">Unidade não encontrada ou encerrada.</p>';
    var volta = cabecalho(N().rotulo(u), 'Voltar para a ficha', 'voltar-ficha') + avisos(), canc = '<button type="button" class="btn btn--sm" data-ea="voltar-ficha">Cancelar</button>';
    if (v === 'editar') return volta + '<form class="avp-form-card an-form" id="eaFormUnidade" data-modo="editar"><h5>Editar</h5>' + camposUnidade(f.dados || u) + '<p class="an-nota">A versão anterior fica no histórico. A unidade superior muda em "Alterar unidade superior".</p>' +
      '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="eaGravar"' + (st.gravando ? ' disabled' : '') + '>' + (st.gravando ? 'Gravando…' : 'Gravar') + '</button>' + canc + '</div></form>';
    if (v === 'superior') return volta + '<form class="avp-form-card an-form" id="eaFormSuperior"><h5>Alterar unidade superior</h5>' +
      '<div class="avp-field"><label for="eaNovaSuperior">Nova unidade superior</label><select id="eaNovaSuperior"><option value="">Nenhuma (topo)</option>' + opcoesSuperior(u.id, f.superiorId !== undefined ? f.superiorId : u.superiorId) + '</select></div>' +
      '<p class="an-nota">A própria unidade e as subordinadas dela não aparecem: a hierarquia nunca fica em ciclo (o banco confere de novo, no momento da gravação).</p>' +
      '<div class="avp-field"><label for="eaMotivoSuperior">Motivo <span class="an-opc">(opcional)</span></label><input id="eaMotivoSuperior" maxlength="500"></div>' +
      '<div class="avp-actions-footer"><button type="submit" class="btn btn--primary" id="eaGravarSuperior"' + (st.gravando ? ' disabled' : '') + '>' + (st.gravando ? 'Gravando…' : 'Gravar') + '</button>' + canc + '</div></form>';
    if (v === 'encerrar') {
      var subs = N().subordinadasAtivas(estado(), u.id);
      if (subs.length) return volta + '<div class="avp-form-card" id="eaEncerrarBloqueado"><p>Esta unidade tem ' + subs.length + ' subordinada' + (subs.length === 1 ? '' : 's') + ' ativa' + (subs.length === 1 ? '' : 's') + ': ' + subs.map(function (k) { return esc(N().rotulo(unidade(k))); }).join(', ') + '.</p><p class="an-nota">Encerre-as ou mude a unidade superior delas antes de encerrar esta.</p>' + canc + '</div>';
      return volta + '<form class="avp-form-card an-form" id="eaFormEncerrar"><h5>Encerrar a unidade</h5><div class="avp-field"><label for="eaMotivoEncerrar">Motivo *</label><textarea id="eaMotivoEncerrar" rows="2" maxlength="500"></textarea></div>' +
        '<p class="an-nota">Nada é apagado: a unidade fica no cadastro como encerrada, com o motivo e a data. Encerrada não volta a ativa.</p>' +
        '<div class="avp-actions-footer"><button type="submit" class="btn btn--danger" id="eaConfirmarEncerrar"' + (st.gravando ? ' disabled' : '') + '>' + (st.gravando ? 'Gravando…' : 'Encerrar') + '</button>' + canc + '</div></form>';
    }
    return '';
  }
  function render() {
    if (!wrap || wrap.hidden) return;
    var h;
    if (!sessao() || !perfilConsultar()) h = cabecalho('Estrutura Organizacional Atual', 'Voltar', 'sair') + '<p class="admin-empty" id="eaSemAcesso">Consultar a Estrutura Organizacional Atual é dos perfis da Avaliação.</p>';
    else if (habilitacao() === undefined) h = cabecalho('Estrutura Organizacional Atual', 'Voltar', 'sair') + '<p class="loading-msg" id="eaCarregando">Carregando…</p>';
    else if (st.view === 'lista') h = renderLista();
    else if (st.view === 'ficha') h = renderFicha();
    else h = renderForm();
    var foco = document.activeElement && wrap.contains(document.activeElement) ? document.activeElement.id : null;
    wrap.innerHTML = '<div class="ea-tela">' + h + '</div>';
    if (foco) { var el = document.getElementById(foco); if (el && el.focus) el.focus({ preventScroll: true }); }
  }
  function aoClicar(ev) {
    var b = ev.target.closest('[data-ea]'); if (!b || !wrap.contains(b)) return;
    var a = b.getAttribute('data-ea');
    if (a === 'sair') { if (confirmarDescarte()) sair(); return; }
    if ((a === 'lista' || a === 'voltar-ficha') && !confirmarDescarte()) return;
    st.flash = null;
    if (a === 'lista') ir('lista');
    else if (a === 'voltar-ficha') { var alvo = st.view === 'nova' ? (st.form && st.form.superiorId) : st.id; if (alvo) ir('ficha', alvo); else ir('lista'); }
    else if (a === 'ficha') ir('ficha', b.getAttribute('data-id'));
    else if (a === 'nova') ir('nova', null, { superiorId: b.getAttribute('data-sup') || null });
    else if (a === 'editar' || a === 'superior' || a === 'encerrar') ir(a, b.getAttribute('data-id'), {});
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function dadosDoForm() { return { nome: val('eaNome'), sigla: val('eaSigla'), nivel: val('eaNivel'), nivelOutro: val('eaNivelOutro'), fonte: val('eaFonte'), vigenciaInicio: val('eaVigencia') || null }; }
  function contexto(novoId, unidadeId) { var i = S().identidade(); return i ? { novoId: novoId, auditoriaId: S().novaChave(N().NOS.auditoria + '/' + (unidadeId || novoId)), usuario: { uid: i.uid, email: i.email }, agora: Date.now() } : null; }
  function gravarResultado(r, flash, depois) {
    if (!r.ok) { st.erro = msg(r.erro); render(); return; }
    st.gravando = true; st.erro = null; render();
    S().gravar(N().payload(r, S().agoraServidor()), PRAZO, function (err) {
      st.gravando = false;
      if (err) { st.erro = err === 'sem-resposta' ? 'O banco não respondeu. Confira a lista antes de tentar de novo.' : 'O banco recusou a gravação. Outra pessoa pode ter alterado o cadastro ao mesmo tempo (a hierarquia é conferida de novo na gravação): confira e tente de novo.'; render(); return; }
      st.sujo = false; st.flash = flash; depois();
    });
  }
  function aoEnviar(ev) {
    var f = ev.target; ev.preventDefault();
    if (st.gravando) return;
    if (f.id === 'eaFormMarcador') {
      if (!adminGeral()) return;
      var i = S().identidade(); if (!i) return;
      var hp = N().payloadHabilitacao(habilitacao(), f.getAttribute('data-nova'), val('eaMarcadorMotivo'), { usuario: { uid: i.uid, email: i.email }, auditoriaId: S().novaChave(N().NOS.configAuditoria) }, S().agoraServidor());
      if (!hp.ok) { st.erro = msg(hp.erro); render(); return; }
      S().gravar(hp.payload, PRAZO, function (err) { st.erro = err ? 'Não foi possível mudar o marcador.' : null; st.flash = err ? null : 'Marcador gravado (com motivo, no histórico).'; render(); });
      return;
    }
    if (!podeManter()) return;
    if (f.id === 'eaFormUnidade' && f.getAttribute('data-modo') === 'nova') {
      var d = dadosDoForm(); d.superiorId = val('eaSuperior') || null; st.form = { superiorId: d.superiorId, dados: d };
      var novoId = S().novaChave(N().NOS.unidades);
      gravarResultado(N().criarUnidade(estado(), d, contexto(novoId, novoId)), 'Unidade criada: ' + d.nome.trim() + '.', function () { ir('ficha', novoId); });
    } else if (f.id === 'eaFormUnidade') {
      var de = dadosDoForm(); st.form = { dados: de };
      gravarResultado(N().alterarUnidade(estado(), st.id, de, contexto(null, st.id)), 'Alteração gravada (a versão anterior fica no histórico).', function () { ir('ficha', st.id); });
    } else if (f.id === 'eaFormSuperior') {
      var ns = val('eaNovaSuperior') || null; st.form = { superiorId: ns };
      gravarResultado(N().mudarSuperior(estado(), st.id, ns, { motivo: val('eaMotivoSuperior') }, contexto(null, st.id)), 'Unidade superior alterada.', function () { ir('ficha', st.id); });
    } else if (f.id === 'eaFormEncerrar') {
      gravarResultado(N().encerrarUnidade(estado(), st.id, { motivo: val('eaMotivoEncerrar') }, contexto(null, st.id)), 'Unidade encerrada (fica no cadastro, com o motivo).', function () { ir('ficha', st.id); });
    }
  }
  window.addEventListener('beforeunload', function (e) { if (wrap && !wrap.hidden && st.sujo) { e.preventDefault(); e.returnValue = ''; } });

  window.faEstruturaAtualAdmin = {
    disponivel: function () { return !!(N() && S()) && perfilConsultar(); },
    abrir: abrir, fechar: fechar,
    temAlteracaoNaoSalva: function () { return !!(wrap && !wrap.hidden && st.sujo); },
    habilitacao: function () { ligar(); return habilitacao(); },
    unidadesAtivas: unidadesAtivas, unidade: unidade,
    rotulo: function (id) { var u = unidade(id); return u && N() ? N().rotulo(u) : null; },
    aoMudar: function (fn) { aoMudarFns.push(fn); }
  };
})();
