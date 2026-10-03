/* ============================================================
   Força Ágil — Taxonomia (window.faTaxonomia)

   Dicionário conceitual, em DOIS domínios fisicamente separados no banco e na tela, sem nenhuma
   relação automática entre eles:
     arquitetural   — "O que é o item?"                               (as camadas da Avaliação)
     organizacional — "Que tipo de estrutura organizacional é esta?"  (Linha, Squad, CoE…)
   A Taxonomia DEFINE os conceitos; a Avaliação APLICA. Esta área não integra a Avaliação.

   Banco (database.rules.json, ramo `taxonomia`; só admin lê e escreve nesta 1ª versão):
     taxonomia/<dominio>/conceitos/<codigo>        nome, ordem, ativo, situacaoDefinicao,
                                                    definicaoVigenteFonteId, camada/pai (organizacional),
                                                    criterios, observacoes, perguntaDiscriminadora,
                                                    notaDeAplicacao, atualizadoEm/Por
     taxonomia/<dominio>/fontes/<codigo>/<fonteId> texto, contexto, situacao, tipoRedacao, rotulo
     taxonomia/organizacional/{atributos,perfis,relacoes}
     taxonomia/<dominio>/auditoria/<codigo|_catalogo>/<pushKey>   (só acréscimo)
     taxonomia/meta/cargaInicial                   gravada UMA vez (importação única)

   INTEGRIDADE DA DEFINIÇÃO VIGENTE — equivalência garantida pelo BANCO (regras, provadas no
   emulador em teste-rules-taxonomia.js):  fonte.situacao = "vigente"  ⇔  é a fonte apontada por
   conceito.definicaoVigenteFonteId. Consequência: uma fonte só vira vigente NA MESMA gravação
   multipath em que o conceito passa a apontar para ela; trocar a vigente rebaixa a anterior e
   promove a nova juntas; deixar o conceito sem definição limpa o ponteiro e rebaixa a fonte juntas.
   SEGUNDA BARREIRA, na aplicação (validarVigencia): antes de gravar, confere no estado PÓS-gravação
   que haverá no máximo UMA fonte vigente e que ela é a apontada. A aplicação não é a única
   proteção — o banco recusa o mesmo —, mas nunca depende só do banco.
   Limite conhecido: o Firebase não conta; um estado legado com duas vigentes, criado FORA das
   regras, não é detectado retroativamente (a aplicação o acusa ao abrir o conceito e recusa salvar).

   Ausência é ESTADO, nunca campo vazio: o perfil de cada atributo tem `estado`
   (registrado | não consta na fonte | não aplicável | ainda não definido | fonte não localizada);
   só `registrado` tem valor, papel e origem (fonte | inferência | decisão).

   Toda gravação (conceito + fonte + auditoria) é UM update multipath: ou entra tudo, ou nada. A
   leitura nunca trata "ainda não sei" como "vazio": carregando, erro de rede, sem acesso e vazio de
   verdade são quatro estados diferentes na tela. Sem conteúdo conceitual no código: a carga inicial
   é uma importação única de um arquivo (importador genérico). */
(function () {
  var RAIZ = 'taxonomia';
  /* Tempos (ms). Em produção ficam como estão; só o teste os encurta (via _interno.espera). */
  var ESPERA = { leitura: 12000, gravacao: 20000, reverificar: 5000, tentativas: 24 };

  var DOMINIOS = {
    arquitetural: { rotulo: 'Arquitetural', titulo: 'Taxonomia Arquitetural', pergunta: 'O que é o item?' },
    organizacional: { rotulo: 'Organizacional', titulo: 'Taxonomia Organizacional', pergunta: 'Que tipo de estrutura organizacional é esta?' }
  };
  var ORDEM_DOMINIOS = ['organizacional', 'arquitetural'];
  var CAMADA_ROTULO = { A: 'Tipo organizacional', B: 'Especialização', C: 'Subespecialização', auxiliar: 'Conceito auxiliar' };
  var SIT_DEFINICAO = ['registrada', 'em revisão', 'ainda não registrada'];
  var SIT_DEFINICAO_ROTULO = { 'registrada': 'Definição registrada', 'em revisão': 'Definição em revisão', 'ainda não registrada': 'Definição ainda não registrada' };
  var SIT_FONTE = ['vigente', 'em validação', 'histórica/contextual', 'placeholder', 'não localizado'];
  var SIT_FONTE_EDITAVEL = ['em validação', 'histórica/contextual', 'placeholder', 'não localizado'];
  var SIT_FONTE_PROMOVIVEL = ['em validação', 'histórica/contextual'];
  var CONTEXTOS = ['PREVI', 'BB', 'indefinido'];
  var TIPOS_REDACAO = ['Conceito', 'Significado v1', 'Significado v2', 'proposta'];
  var ESTADOS = ['registrado', 'não consta na fonte', 'não aplicável', 'ainda não definido', 'fonte não localizada'];
  var PAPEIS = ['definidor', 'típico', 'observado'];
  var ORIGENS = ['fonte', 'inferência', 'decisão'];
  var GRUPOS = ['quem-recebe', 'alcance', 'entrega', 'governanca', 'outros'];
  var GRUPO_ROTULO = { 'quem-recebe': 'Quem recebe', alcance: 'Alcance', entrega: 'O que entrega', governanca: 'Governança', outros: 'Outros' };
  var TIPOS_RELACAO = ['compoe', 'aloca-em', 'atende', 'desenvolve-disciplina', 'pertence-a-disciplina'];
  var RELACAO_ROTULO = { compoe: 'compõe', 'aloca-em': 'aloca em', atende: 'atende', 'desenvolve-disciplina': 'desenvolve a disciplina', 'pertence-a-disciplina': 'pertence à disciplina' };
  /* Significado de cada PAPEL (mostrado na tela e na documentação). "Observado" é o estado neutro inicial:
     registra o valor SEM julgamento classificatório — não representa uma inferência de força conceitual. */
  var PAPEL_SIGNIFICADO = {
    'definidor': 'ajuda a distinguir/classificar o conceito',
    'típico': 'característica frequente ou esperada',
    'observado': 'valor presente na fonte ou registrado no perfil, mas ainda não curado como característica definidora ou típica do conceito (registrado sem julgamento classificatório)'
  };
  var ORIGEM_CLASSE = { 'fonte': 'fonte', 'inferência': 'inferencia', 'decisão': 'decisao' };
  var RE_CODIGO = /^[A-Za-z][A-Za-z0-9_-]{1,59}$/;
  var RE_ID = /^[A-Za-z0-9_-]{1,60}$/;
  var FONTE_REBAIXADA = 'histórica/contextual';

  function db() { return firebase.database(); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function semUndefined(o) { return JSON.parse(JSON.stringify(o)); }
  function agora() { return new Date().toISOString(); }
  function fmtData(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function chaves(o) { return o ? Object.keys(o) : []; }
  function ordenaPor(lista, campo) {
    return lista.slice().sort(function (a, b) {
      var x = a[campo], y = b[campo];
      return (typeof x === 'number' && typeof y === 'number') ? x - y : String(x || '').localeCompare(String(y || ''));
    });
  }

  /* ---------- sessão ---------- */
  function sessao() { return window.faAuth && window.faAuth.getSession ? window.faAuth.getSession() : null; }
  /* O e-mail gravado nas linhas de autoria tem de ser IGUAL ao do token (as regras conferem). */
  function emailAutor() {
    var u = null;
    try { u = firebase.auth().currentUser; } catch (e) { u = null; }
    var s = sessao();
    return (u && u.email) || (s && s.email) || '';
  }
  function usuarioAtual() {
    var s = sessao();
    return { nome: (s && (s.name || s.email)) || emailAutor(), email: emailAutor() };
  }
  function adminPronto() { return !window.faAuth || !window.faAuth.isAdminReady || window.faAuth.isAdminReady(); }
  function ehAdmin() { var s = sessao(); return !!(s && window.faAuth && window.faAuth.isAdmin(s.email)); }

  /* ---------- estado ---------- */
  function novoDominio() { return { estado: 'ocioso', conceitos: {}, atributos: {}, selecionado: null, detalhe: null, edicao: null, confirmacao: null }; }
  var st = {
    dominio: 'organizacional', email: null, raiz: null, opcoes: { somenteLeitura: false },
    meta: { estado: 'ocioso', cargaFeita: false }, importacao: null, flash: null, salvando: false,
    vista: 'lista',
    d: { arquitetural: novoDominio(), organizacional: novoDominio() }
  };

  /* ---------- leitura (com limite de espera) ---------- */
  function lerNo(caminho, cb) {
    var feito = false;
    var t = setTimeout(function () { fim({ ok: false, erro: 'tempo esgotado' }); }, ESPERA.leitura);
    function fim(r) { if (feito) return; feito = true; clearTimeout(t); cb(r); }
    try {
      var prom = db().ref(caminho).once('value', function (snap) { fim({ ok: true, valor: snap.val() }); }, function (err) {
        console.error('[taxonomia] erro ao ler ' + caminho + ':', err);
        fim({ ok: false, negado: !!(err && err.code === 'PERMISSION_DENIED'), erro: err });
      });
      /* o once() também devolve uma promessa que rejeita no erro: já tratado acima, não deixa "não tratado" */
      if (prom && prom.catch) prom.catch(function () {});
    } catch (e) { console.error('[taxonomia] erro ao ler ' + caminho + ':', e); fim({ ok: false, erro: e }); }
  }

  function carregarMeta() {
    st.meta.estado = 'carregando';
    lerNo(RAIZ + '/meta/cargaInicial', function (r) {
      if (!r.ok) { st.meta = { estado: r.negado ? 'sem-acesso' : 'erro', cargaFeita: false }; }
      else st.meta = { estado: 'ok', cargaFeita: !!r.valor, carga: r.valor || null };
      render();
    });
  }

  function carregarDominio(dom) {
    var D = st.d[dom];
    var marca = D.leitura = {};
    D.estado = 'carregando';
    D.conceitos = {}; D.atributos = {};
    var org = dom === 'organizacional', pend = org ? 2 : 1, falha = null;
    function fim() {
      if (--pend > 0) return;
      if (D.leitura !== marca) return;
      if (falha) D.estado = falha.negado ? 'sem-acesso' : 'erro';
      else D.estado = 'ok';
      /* conceito selecionado que sumiu: volta à lista */
      if (D.selecionado && !D.conceitos[D.selecionado]) { D.selecionado = null; D.detalhe = null; st.vista = 'lista'; }
      render();
    }
    lerNo(RAIZ + '/' + dom + '/conceitos', function (r) { if (!r.ok) falha = falha || r; else D.conceitos = r.valor || {}; fim(); });
    if (org) lerNo(RAIZ + '/' + dom + '/atributos', function (r) { if (!r.ok) falha = falha || r; else D.atributos = r.valor || {}; fim(); });
    render();
  }

  function carregarDetalhe(dom, codigo) {
    var D = st.d[dom];
    var det = D.detalhe = { codigo: codigo, carregando: true, fontes: {}, perfis: {}, relacoes: {}, auditoria: {}, erros: {} };
    var org = dom === 'organizacional';
    var pend = org ? 4 : 2;
    function recebe(campo, r, transforma) {
      if (D.detalhe !== det) return;
      if (!r.ok) det.erros[campo] = r.negado ? 'sem-acesso' : 'erro';
      else det[campo] = transforma ? transforma(r.valor) : (r.valor || {});
      if (--pend === 0) { det.carregando = false; }
      render();
    }
    lerNo(RAIZ + '/' + dom + '/fontes/' + codigo, function (r) { recebe('fontes', r); });
    lerNo(RAIZ + '/' + dom + '/auditoria/' + codigo, function (r) { recebe('auditoria', r); });
    if (org) {
      lerNo(RAIZ + '/' + dom + '/perfis/' + codigo, function (r) { recebe('perfis', r); });
      lerNo(RAIZ + '/' + dom + '/relacoes', function (r) {
        recebe('relacoes', r, function (v) {
          var out = {};
          chaves(v).forEach(function (k) { if (v[k] && (v[k].de === codigo || v[k].para === codigo)) out[k] = v[k]; });
          return out;
        });
      });
    }
    render();
  }

  /* ---------- SEGUNDA BARREIRA: no máximo UMA fonte vigente, e só a apontada ----------
     Recebe o estado PÓS-gravação: `fontes` ({id: {situacao}}) e o ponteiro. Pura (sem banco). */
  function validarVigencia(fontes, ponteiro) {
    var vigentes = chaves(fontes).filter(function (id) { return fontes[id] && fontes[id].situacao === 'vigente'; });
    if (vigentes.length > 1) return { ok: false, erro: 'Há mais de uma fonte vigente neste conceito (' + vigentes.length + '). Só pode haver uma.' };
    if (ponteiro) {
      if (!fontes[ponteiro]) return { ok: false, erro: 'A definição vigente aponta para uma fonte que não existe.' };
      if (fontes[ponteiro].situacao !== 'vigente') return { ok: false, erro: 'A definição vigente aponta para uma fonte que não está vigente.' };
      if (vigentes.length !== 1 || vigentes[0] !== ponteiro) return { ok: false, erro: 'A fonte vigente tem de ser exatamente a apontada pelo conceito.' };
    } else if (vigentes.length) {
      return { ok: false, erro: 'Há uma fonte vigente que o conceito não referencia como definição.' };
    }
    return { ok: true };
  }

  /* ---------- auditoria e gravação atômica ---------- */
  function caminhoAud(dom, codigo) { return RAIZ + '/' + dom + '/auditoria/' + codigo; }
  function addAud(caminhos, dom, codigo, tipo, campo, anterior, novo, extra) {
    var chave = db().ref(caminhoAud(dom, codigo)).push().key;
    caminhos[caminhoAud(dom, codigo) + '/' + chave] = Object.assign({
      tipo: tipo, conceito: codigo === '_catalogo' ? null : codigo, campo: campo || null,
      valorAnterior: anterior === undefined ? null : anterior, valorNovo: novo === undefined ? null : novo,
      usuario: usuarioAtual(), dataHora: agora()
    }, extra || {});
  }
  /* ---------- gravação com resposta, SEM resposta e confirmação tardia ----------
     Uma gravação tem três desfechos: confirmada, recusada ou SEM RESPOSTA no prazo. Sem resposta NÃO é
     "falhou": a alteração pode já ter sido aplicada, ou ainda estar na fila do cliente e ser aplicada
     quando a conexão voltar. Por isso, passado o prazo a tela (1) confere o estado REAL no servidor,
     (2) bloqueia novas gravações — nunca incentiva repetir às cegas — e (3) reconcilia quando a
     confirmação chega, mesmo atrasada. Só uma gravação pode estar em andamento por vez. */
  var seqGravacao = 0;
  var TEXTO_BLOQUEIO = 'Aguarde: há uma gravação anterior ainda sem confirmação do servidor. Não repita a operação antes de a tela confirmar o que foi gravado.';
  function caminhoMarcador(caminhos) {
    /* o evento de auditoria vai na MESMA gravação atômica: se ele existe no servidor, a alteração foi aplicada */
    var k = chaves(caminhos).filter(function (c) { return /\/auditoria\/[^/]+\/[^/]+$/.test(c); })[0];
    return k || null;
  }
  function lerServidor(caminho, cb) {
    /* get() consulta o SERVIDOR; once() poderia devolver a própria gravação otimista ainda pendente
       (falso "foi aplicada"). Sem get(), não dá para confirmar — melhor admitir do que afirmar. */
    var feito = false;
    var t = setTimeout(function () { fim({ ok: false, erro: 'tempo esgotado' }); }, ESPERA.leitura);
    function fim(r) { if (feito) return; feito = true; clearTimeout(t); cb(r); }
    try {
      var ref = db().ref(caminho);
      if (!ref || typeof ref.get !== 'function') { fim({ ok: false, erro: 'sem get()' }); return; }
      ref.get().then(function (snap) { fim({ ok: true, valor: snap.val() }); }, function (err) { fim({ ok: false, erro: err }); });
    } catch (e) { fim({ ok: false, erro: e }); }
  }
  function resolverGravacao(p, r) {
    if (p.resolvido) return;
    p.resolvido = true; clearTimeout(p.timerEspera); clearTimeout(p.timerVerif);
    var tardia = p.semResposta;
    if (st.pendente === p) st.pendente = null;
    st.salvando = false;
    if (r.erro) {
      console.error('[taxonomia] erro ao gravar:', r.erro);
      var recusa = r.erro.code === 'PERMISSION_DENIED';
      st.flash = { erro: true, texto: (tardia ? 'A gravação foi recusada pelo servidor: NADA foi aplicado. ' : '') + 'Não foi possível salvar: ' + (recusa ? 'o banco recusou a gravação (sem permissão ou dado fora das regras).' : 'falha na gravação.') + ' Nada foi alterado. O que você digitou continua na tela.' };
      render();
      return;
    }
    p.depois();
    if (tardia && st.flash && !st.flash.erro) st.flash.texto = 'A alteração FOI aplicada' + (r.verificada ? ' (conferido no servidor)' : ' (a confirmação do servidor demorou)') + '. ' + st.flash.texto;
  }
  function verificarGravacao(p) {
    if (p.resolvido) return;
    p.verificando = true; render();
    p.tentativas++;
    if (!p.marcador) { p.verificando = false; p.estado = 'sem-leitura'; render(); return; }
    lerServidor(p.marcador, function (r) {
      if (p.resolvido) return;
      p.verificando = false;
      if (r.ok && r.valor) { resolverGravacao(p, { aplicada: true, verificada: true }); return; }
      p.estado = r.ok ? 'nao-consta' : 'sem-leitura';
      render();
      if (p.tentativas < ESPERA.tentativas) p.timerVerif = setTimeout(function () { verificarGravacao(p); }, ESPERA.reverificar);
    });
  }
  function gravar(caminhos, depois) {
    if (st.pendente && st.pendente.semResposta) { st.flash = { erro: true, texto: TEXTO_BLOQUEIO }; render(); return; }
    if (st.salvando) return;
    var p = { id: ++seqGravacao, marcador: caminhoMarcador(caminhos), depois: depois, resolvido: false, semResposta: false, verificando: false, estado: '', tentativas: 0, timerEspera: null, timerVerif: null };
    st.pendente = p; st.salvando = true; st.flash = null;
    render();
    p.timerEspera = setTimeout(function () {
      if (p.resolvido) return;
      p.semResposta = true; st.salvando = false;
      verificarGravacao(p);
    }, ESPERA.gravacao);
    function fim(err) { resolverGravacao(p, err ? { erro: err } : { aplicada: true }); }
    try {
      var prom = db().ref().update(semUndefined(caminhos), fim);
      if (prom && prom.catch) prom.catch(function () {});
    } catch (e) { fim(e); }
  }
  function aposSalvar(dom, codigo, mensagem) {
    var D = st.d[dom];
    D.edicao = null; D.confirmacao = null;
    st.flash = { erro: false, texto: mensagem };
    carregarDominio(dom);
    if (codigo) { D.selecionado = codigo; carregarDetalhe(dom, codigo); }
  }
  function marcaConceito(caminhos, dom, codigo) {
    var base = RAIZ + '/' + dom + '/conceitos/' + codigo;
    caminhos[base + '/atualizadoEm'] = agora();
    caminhos[base + '/atualizadoPor'] = emailAutor();
  }

  /* ---------- operações (cada uma = UM update com dado + auditoria) ---------- */
  function conceitoAtual(dom, codigo) { return st.d[dom].conceitos[codigo] || {}; }
  function fontesAtuais(dom) { var det = st.d[dom].detalhe; return (det && det.fontes) || {}; }
  /* "em revisão" quando há ao menos um texto utilizável; "ainda não registrada" quando não há nenhum. */
  function situacaoSemVigente(fontes) {
    var util = chaves(fontes).some(function (id) { return SIT_FONTE_PROMOVIVEL.indexOf(fontes[id].situacao) !== -1; });
    return util ? 'em revisão' : 'ainda não registrada';
  }
  function checaVigencia(fontesPos, ponteiro) {
    var v = validarVigencia(fontesPos, ponteiro);
    if (!v.ok) { st.flash = { erro: true, texto: 'Não foi salvo: ' + v.erro }; render(); return false; }
    return true;
  }

  function tornarVigente(dom, codigo, fonteId) {
    var c = conceitoAtual(dom, codigo), fontes = fontesAtuais(dom), fonte = fontes[fonteId];
    if (!fonte || SIT_FONTE_PROMOVIVEL.indexOf(fonte.situacao) === -1) {
      st.flash = { erro: true, texto: 'Só um texto "em validação" ou "histórico/contextual" pode ser tornado vigente. Placeholder e "não localizado" nunca viram definição.' }; render(); return;
    }
    var anterior = c.definicaoVigenteFonteId || null;
    var pos = JSON.parse(JSON.stringify(fontes));
    if (anterior && pos[anterior]) pos[anterior].situacao = FONTE_REBAIXADA;
    pos[fonteId].situacao = 'vigente';
    if (!checaVigencia(pos, fonteId)) return;
    var base = RAIZ + '/' + dom, caminhos = {};
    if (anterior && fontes[anterior]) caminhos[base + '/fontes/' + codigo + '/' + anterior + '/situacao'] = FONTE_REBAIXADA;
    caminhos[base + '/fontes/' + codigo + '/' + fonteId + '/situacao'] = 'vigente';
    caminhos[base + '/conceitos/' + codigo + '/definicaoVigenteFonteId'] = fonteId;
    caminhos[base + '/conceitos/' + codigo + '/situacaoDefinicao'] = 'registrada';
    marcaConceito(caminhos, dom, codigo);
    addAud(caminhos, dom, codigo, 'definicao_vigente', 'definição vigente', anterior ? rotuloFonte(fontes[anterior], anterior) : null, rotuloFonte(fonte, fonteId), { fonteAnteriorId: anterior, fonteNovaId: fonteId });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Definição vigente atualizada.'); });
  }
  function removerVigencia(dom, codigo) {
    var c = conceitoAtual(dom, codigo), fontes = fontesAtuais(dom), anterior = c.definicaoVigenteFonteId;
    if (!anterior) return;
    var pos = JSON.parse(JSON.stringify(fontes));
    if (pos[anterior]) pos[anterior].situacao = FONTE_REBAIXADA;
    if (!checaVigencia(pos, null)) return;
    var base = RAIZ + '/' + dom, caminhos = {};
    if (fontes[anterior]) caminhos[base + '/fontes/' + codigo + '/' + anterior + '/situacao'] = FONTE_REBAIXADA;
    caminhos[base + '/conceitos/' + codigo + '/definicaoVigenteFonteId'] = null;
    caminhos[base + '/conceitos/' + codigo + '/situacaoDefinicao'] = situacaoSemVigente(pos);
    marcaConceito(caminhos, dom, codigo);
    addAud(caminhos, dom, codigo, 'definicao_vigente', 'definição vigente', rotuloFonte(fontes[anterior], anterior), null, { fonteAnteriorId: anterior, fonteNovaId: null });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'O conceito ficou sem definição vigente.'); });
  }
  function rotuloFonte(f, id) { return f ? ((f.rotulo || f.tipoRedacao || id) + ' (' + f.contexto + ')') : id; }

  function salvarConceito(dom, codigo) {
    var D = st.d[dom], v = D.edicao.valores, c = conceitoAtual(dom, codigo);
    var nome = String(v.nome || '').trim();
    if (!nome) { D.edicao.erro = 'O nome do conceito é obrigatório.'; render(); return; }
    var base = RAIZ + '/' + dom + '/conceitos/' + codigo, caminhos = {}, antes = {}, depois = {};
    function campo(nomeCampo, novo, atual) {
      var n = novo === '' || novo === undefined ? null : novo;
      var a = atual === undefined || atual === '' ? null : atual;
      if (n === a) return;
      caminhos[base + '/' + nomeCampo] = n;
      antes[nomeCampo] = a; depois[nomeCampo] = n;
    }
    campo('nome', nome, c.nome);
    campo('observacoes', String(v.observacoes || '').trim(), c.observacoes);
    if (dom === 'organizacional') {
      campo('perguntaDiscriminadora', String(v.perguntaDiscriminadora || '').trim(), c.perguntaDiscriminadora);
      campo('notaDeAplicacao', String(v.notaDeAplicacao || '').trim(), c.notaDeAplicacao);
    }
    var crit = String(v.criterios || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var critAtual = listaCriterios(c);
    if (JSON.stringify(crit) !== JSON.stringify(critAtual)) {
      var mapa = {};
      crit.forEach(function (t, i) { mapa['k' + (i + 1)] = { texto: t, ordem: i + 1 }; });
      caminhos[base + '/criterios'] = crit.length ? mapa : null;
      antes.criterios = critAtual; depois.criterios = crit;
    }
    var ativo = !!v.ativo;
    if (ativo !== (c.ativo !== false)) { caminhos[base + '/ativo'] = ativo; antes.ativo = c.ativo !== false; depois.ativo = ativo; }
    if (!chaves(caminhos).length) { D.edicao.erro = 'Nada foi alterado.'; render(); return; }
    marcaConceito(caminhos, dom, codigo);
    chaves(depois).forEach(function (k) { addAud(caminhos, dom, codigo, 'alteracao_conceito', k, antes[k], depois[k]); });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Conceito salvo.'); });
  }

  function salvarFonte(dom, codigo) {
    var D = st.d[dom], e = D.edicao, v = e.valores, fontes = fontesAtuais(dom), c = conceitoAtual(dom, codigo);
    var texto = String(v.texto || '').trim();
    if (!texto) { e.erro = 'O texto da fonte é obrigatório.'; render(); return; }
    var nova = e.tipo === 'novaFonte';
    var id = nova ? db().ref(RAIZ + '/' + dom + '/fontes/' + codigo).push().key : e.chave;
    var atual = nova ? null : fontes[id];
    var ehVigente = !!(atual && atual.situacao === 'vigente');
    var situacao = ehVigente ? 'vigente' : v.situacao;
    if (!ehVigente && SIT_FONTE_EDITAVEL.indexOf(situacao) === -1) { e.erro = 'Escolha uma situação válida. Para tornar vigente use "Tornar vigente".'; render(); return; }
    var dado = { texto: texto, contexto: v.contexto, situacao: situacao, tipoRedacao: v.tipoRedacao };
    var rotulo = String(v.rotulo || '').trim();
    if (rotulo) dado.rotulo = rotulo;
    var pos = JSON.parse(JSON.stringify(fontes));
    pos[id] = dado;
    if (!checaVigencia(pos, c.definicaoVigenteFonteId || null)) return;
    var base = RAIZ + '/' + dom, caminhos = {};
    if (nova) { dado.criadoEm = agora(); dado.criadoPor = emailAutor(); caminhos[base + '/fontes/' + codigo + '/' + id] = dado; }
    else {
      ['texto', 'contexto', 'situacao', 'tipoRedacao'].forEach(function (k) { if (atual[k] !== dado[k]) caminhos[base + '/fontes/' + codigo + '/' + id + '/' + k] = dado[k]; });
      if ((atual.rotulo || null) !== (dado.rotulo || null)) caminhos[base + '/fontes/' + codigo + '/' + id + '/rotulo'] = dado.rotulo || null;
      if (!chaves(caminhos).length) { e.erro = 'Nada foi alterado.'; render(); return; }
    }
    /* uma fonte nova utilizável tira o conceito de "ainda não registrada" */
    if (!c.definicaoVigenteFonteId && SIT_DEFINICAO.indexOf(c.situacaoDefinicao) !== -1) {
      var sit = situacaoSemVigente(pos);
      if (sit !== c.situacaoDefinicao) caminhos[base + '/conceitos/' + codigo + '/situacaoDefinicao'] = sit;
    }
    marcaConceito(caminhos, dom, codigo);
    addAud(caminhos, dom, codigo, 'alteracao_fonte', nova ? 'nova fonte' : 'fonte', nova ? null : rotuloFonte(atual, id), rotuloFonte(dado, id), { fonteId: id });
    gravar(caminhos, function () { aposSalvar(dom, codigo, nova ? 'Texto-fonte adicionado.' : 'Fonte salva.'); });
  }

  function salvarPerfil(dom, codigo) {
    var D = st.d[dom], e = D.edicao, v = e.valores, atr = e.chave;
    var estado = v.estado;
    if (ESTADOS.indexOf(estado) === -1) { e.erro = 'Escolha o estado.'; render(); return; }
    var dado = { estado: estado };
    if (estado === 'registrado') {
      var valor = String(v.valor || '').trim();
      if (!valor) { e.erro = 'Estado "registrado" exige o valor.'; render(); return; }
      if (PAPEIS.indexOf(v.papel) === -1 || ORIGENS.indexOf(v.origem) === -1) { e.erro = 'Estado "registrado" exige papel e origem.'; render(); return; }
      dado.valor = valor; dado.papel = v.papel; dado.origem = v.origem;
    }
    var atual = (D.detalhe && D.detalhe.perfis && D.detalhe.perfis[atr]) || null;
    if (atual && JSON.stringify(rotuloPerfilCompleto(atual)) === JSON.stringify(rotuloPerfilCompleto(dado))) { e.erro = 'Nada foi alterado.'; render(); return; }
    dado.atualizadoEm = agora();
    var caminhos = {}, base = RAIZ + '/' + dom;
    caminhos[base + '/perfis/' + codigo + '/' + atr] = dado;
    marcaConceito(caminhos, dom, codigo);
    addAud(caminhos, dom, codigo, 'alteracao_perfil', (D.atributos[atr] && D.atributos[atr].nome) || atr, atual ? textoPerfil(atual) : null, textoPerfil(dado));
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Atributo salvo.'); });
  }
  function rotuloPerfilCompleto(p) { return { estado: p.estado, valor: p.valor || null, papel: p.papel || null, origem: p.origem || null }; }
  function textoPerfil(p) {
    if (p.estado === 'registrado') return p.valor + ' (' + p.papel + ' · origem: ' + p.origem + ')';
    return p.estado;
  }
  function listaCriterios(c) {
    var m = c.criterios || {};
    return ordenaPor(chaves(m).map(function (k) { return m[k]; }), 'ordem').map(function (x) { return x.texto; });
  }

  /* ---------- importação única ---------- */
  var DOM_IMPORT = ['arquitetural', 'organizacional'];
  /* Valida o arquivo e monta o update atômico. Genérico: nenhum conteúdo conceitual vive aqui. */
  function prepararImportacao(arq, conceitosExistentes) {
    var erros = [], avisos = [], caminhos = {}, resumo = { conceitos: 0, fontes: 0, atributos: 0, perfis: 0, relacoes: 0, vigentes: 0 };
    var agoraIso = agora(), email = emailAutor();
    if (!arq || typeof arq !== 'object' || !arq.dominios || typeof arq.dominios !== 'object') {
      return { erros: ['O arquivo não tem o formato esperado (objeto com "dominios").'], avisos: [], resumo: resumo, caminhos: {} };
    }
    chaves(arq.dominios).forEach(function (d) { if (DOM_IMPORT.indexOf(d) === -1) erros.push('Domínio desconhecido no arquivo: "' + d + '".'); });
    DOM_IMPORT.forEach(function (dom) {
      var bloco = arq.dominios[dom];
      if (!bloco) return;
      var org = dom === 'organizacional', base = RAIZ + '/' + dom;
      var cs = bloco.conceitos || {};
      if (!chaves(cs).length) { erros.push(dom + ': não há conceitos.'); return; }
      var existentes = (conceitosExistentes && conceitosExistentes[dom]) || {};
      chaves(cs).forEach(function (cod) {
        var c = cs[cod], onde = dom + ' › ' + cod;
        if (!RE_CODIGO.test(cod)) { erros.push(onde + ': código inválido (letras, números, _ e -; começa por letra).'); return; }
        if (existentes[cod]) { erros.push(onde + ': o conceito já existe — a importação nunca sobrescreve.'); return; }
        if (!c || typeof c.nome !== 'string' || !c.nome.trim()) { erros.push(onde + ': falta o nome.'); return; }
        if (org && CAMADA_ROTULO[c.camada] === undefined) erros.push(onde + ': camada inválida (A, B, C ou auxiliar).');
        if (!org && c.camada !== undefined) erros.push(onde + ': o domínio arquitetural não tem camada.');
        if (c.pai !== undefined && (!org || !cs[c.pai])) erros.push(onde + ': "pai" inexistente no arquivo.');
        if (c.situacaoDefinicao !== undefined && SIT_DEFINICAO.indexOf(c.situacaoDefinicao) === -1) erros.push(onde + ': situação da definição inválida.');
        var fontes = (bloco.fontes && bloco.fontes[cod]) || [];
        if (!Array.isArray(fontes)) { erros.push(onde + ': "fontes" deve ser uma lista.'); fontes = []; }
        var fontesPos = {}, ponteiro = null, ids = {};
        fontes.forEach(function (f, i) {
          var ond = onde + ' › fonte ' + (i + 1);
          if (!f || typeof f.texto !== 'string' || !f.texto.trim()) { erros.push(ond + ': falta o texto.'); return; }
          if (CONTEXTOS.indexOf(f.contexto) === -1) erros.push(ond + ': contexto inválido (PREVI, BB ou indefinido).');
          if (SIT_FONTE.indexOf(f.situacao) === -1) erros.push(ond + ': situação inválida.');
          if (TIPOS_REDACAO.indexOf(f.tipoRedacao) === -1) erros.push(ond + ': tipo de redação inválido.');
          var id = f.id !== undefined ? String(f.id) : db().ref(base + '/fontes/' + cod).push().key;
          if (!RE_ID.test(id) || ids[id]) { erros.push(ond + ': id inválido ou repetido.'); return; }
          ids[id] = true;
          fontesPos[id] = { situacao: f.situacao };
          if (f.situacao === 'vigente') ponteiro = ponteiro === null ? id : ponteiro;
          var dado = { texto: f.texto, contexto: f.contexto, situacao: f.situacao, tipoRedacao: f.tipoRedacao, criadoEm: agoraIso, criadoPor: email };
          if (f.rotulo) dado.rotulo = String(f.rotulo);
          caminhos[base + '/fontes/' + cod + '/' + id] = dado;
          resumo.fontes++;
        });
        /* A MESMA barreira da edição: no máximo uma vigente, e é a apontada */
        var v = validarVigencia(fontesPos, ponteiro);
        if (!v.ok) erros.push(onde + ': ' + v.erro);
        if (ponteiro) resumo.vigentes++;
        var dadoC = { nome: c.nome.trim(), ordem: typeof c.ordem === 'number' ? c.ordem : (chaves(cs).indexOf(cod) + 1), ativo: c.ativo !== false,
          situacaoDefinicao: ponteiro ? 'registrada' : (c.situacaoDefinicao && c.situacaoDefinicao !== 'registrada' ? c.situacaoDefinicao : situacaoSemVigente(fontesPos)),
          atualizadoEm: agoraIso, atualizadoPor: email };
        if (ponteiro) dadoC.definicaoVigenteFonteId = ponteiro;
        if (org) { dadoC.camada = c.camada; if (c.pai) dadoC.pai = c.pai; }
        ['observacoes', 'perguntaDiscriminadora', 'notaDeAplicacao'].forEach(function (k) { if (typeof c[k] === 'string' && c[k].trim() && (org || k === 'observacoes')) dadoC[k] = c[k]; });
        if (typeof c.ordemDaPergunta === 'number' && org) dadoC.ordemDaPergunta = c.ordemDaPergunta;
        if (Array.isArray(c.criterios) && c.criterios.length) {
          dadoC.criterios = {};
          c.criterios.forEach(function (t, i) { dadoC.criterios['k' + (i + 1)] = { texto: String(t), ordem: i + 1 }; });
        }
        caminhos[base + '/conceitos/' + cod] = dadoC;
        resumo.conceitos++;
      });
      chaves(bloco.fontes || {}).forEach(function (cod) { if (!cs[cod]) erros.push(dom + ' › ' + cod + ': há fontes para um conceito que não está no arquivo.'); });
      if (!org) {
        ['atributos', 'perfis', 'relacoes'].forEach(function (k) { if (bloco[k] !== undefined) erros.push('arquitetural: o domínio não tem "' + k + '".'); });
        return;
      }
      var atrs = bloco.atributos || {};
      chaves(atrs).forEach(function (cod) {
        var a = atrs[cod], onde = 'organizacional › atributo ' + cod;
        if (!RE_CODIGO.test(cod)) { erros.push(onde + ': código inválido.'); return; }
        if (!a || typeof a.nome !== 'string' || !a.nome.trim()) { erros.push(onde + ': falta o nome.'); return; }
        if (GRUPOS.indexOf(a.grupo) === -1) erros.push(onde + ': grupo inválido.');
        if (['lista', 'texto'].indexOf(a.tipoValor) === -1) erros.push(onde + ': tipoValor inválido (lista ou texto).');
        var dado = { nome: a.nome.trim(), grupo: a.grupo, tipoValor: a.tipoValor, ordem: typeof a.ordem === 'number' ? a.ordem : (chaves(atrs).indexOf(cod) + 1), ativo: a.ativo !== false };
        if (Array.isArray(a.valoresPermitidos) && a.valoresPermitidos.length) {
          dado.valoresPermitidos = {};
          a.valoresPermitidos.forEach(function (t, i) { dado.valoresPermitidos['v' + (i + 1)] = { texto: String(t), ordem: i + 1 }; });
        }
        caminhos[base + '/atributos/' + cod] = dado;
        resumo.atributos++;
      });
      var perfis = bloco.perfis || {};
      chaves(perfis).forEach(function (cod) {
        if (!cs[cod]) { erros.push('organizacional › perfil de ' + cod + ': conceito inexistente no arquivo.'); return; }
        chaves(perfis[cod]).forEach(function (atr) {
          var p = perfis[cod][atr], onde = 'organizacional › perfil ' + cod + ' › ' + atr;
          if (!atrs[atr]) { erros.push(onde + ': atributo fora do catálogo do arquivo.'); return; }
          if (!p || ESTADOS.indexOf(p.estado) === -1) { erros.push(onde + ': estado inválido.'); return; }
          var dado = { estado: p.estado };
          if (p.estado === 'registrado') {
            if (typeof p.valor !== 'string' || !p.valor.trim() || PAPEIS.indexOf(p.papel) === -1 || ORIGENS.indexOf(p.origem) === -1) { erros.push(onde + ': "registrado" exige valor, papel e origem.'); return; }
            dado.valor = p.valor; dado.papel = p.papel; dado.origem = p.origem;
          } else if (p.valor !== undefined || p.papel !== undefined || p.origem !== undefined) { erros.push(onde + ': estado "' + p.estado + '" não tem valor, papel nem origem (ausência é estado, nunca campo vazio).'); return; }
          caminhos[base + '/perfis/' + cod + '/' + atr] = dado;
          resumo.perfis++;
        });
      });
      (bloco.relacoes || []).forEach(function (r, i) {
        var onde = 'organizacional › relação ' + (i + 1);
        if (!r || !cs[r.de] || !cs[r.para]) { erros.push(onde + ': conceito inexistente no arquivo.'); return; }
        if (TIPOS_RELACAO.indexOf(r.tipo) === -1) { erros.push(onde + ': tipo inválido.'); return; }
        var dado = { de: r.de, tipo: r.tipo, para: r.para };
        if (typeof r.nota === 'string' && r.nota.trim()) dado.nota = r.nota;
        caminhos[base + '/relacoes/' + r.de + '__' + r.tipo + '__' + r.para] = dado;
        resumo.relacoes++;
      });
    });
    if (!resumo.conceitos && !erros.length) erros.push('O arquivo não traz nenhum conceito.');
    if (!erros.length) {
      caminhos[RAIZ + '/meta/cargaInicial'] = { feitaEm: agoraIso, feitaPor: email, resumo: resumo };
      DOM_IMPORT.forEach(function (dom) {
        if (!arq.dominios[dom]) return;
        addAud(caminhos, dom, '_catalogo', 'carga_inicial', 'carga inicial', null, 'Importação única: ' + resumo.conceitos + ' conceitos, ' + resumo.fontes + ' fontes');
      });
    }
    return { erros: erros, avisos: avisos, resumo: resumo, caminhos: caminhos };
  }

  function escolherArquivo(arquivo) {
    st.importacao = { estado: 'lendo', nome: arquivo.name };
    render();
    var leitor = new FileReader();
    leitor.onerror = function () { st.importacao = { estado: 'erro', nome: arquivo.name, erros: ['Não foi possível ler o arquivo.'] }; render(); };
    leitor.onload = function () {
      var obj;
      try { obj = JSON.parse(String(leitor.result)); } catch (e) { st.importacao = { estado: 'erro', nome: arquivo.name, erros: ['O arquivo não é um JSON válido.'] }; render(); return; }
      /* confere NO BANCO se já houve carga e quais conceitos existem (nunca sobrescreve) */
      lerNo(RAIZ + '/meta/cargaInicial', function (m) {
        if (!m.ok) { st.importacao = { estado: 'erro', nome: arquivo.name, erros: ['Não foi possível conferir se a carga inicial já foi feita. Tente novamente.'] }; render(); return; }
        if (m.valor) { st.importacao = { estado: 'erro', nome: arquivo.name, erros: ['A carga inicial já foi realizada. Uma nova carga é recusada.'] }; st.meta = { estado: 'ok', cargaFeita: true, carga: m.valor }; render(); return; }
        var existentes = {}, pend = DOM_IMPORT.length, falha = false;
        DOM_IMPORT.forEach(function (dom) {
          lerNo(RAIZ + '/' + dom + '/conceitos', function (r) {
            if (!r.ok) falha = true; else existentes[dom] = r.valor || {};
            if (--pend > 0) return;
            if (falha) { st.importacao = { estado: 'erro', nome: arquivo.name, erros: ['Não foi possível conferir os conceitos existentes. Tente novamente.'] }; render(); return; }
            var p = prepararImportacao(obj, existentes);
            st.importacao = { estado: p.erros.length ? 'invalido' : 'pronto', nome: arquivo.name, erros: p.erros, resumo: p.resumo, caminhos: p.caminhos };
            render();
          });
        });
      });
    };
    leitor.readAsText(arquivo);
  }
  function confirmarImportacao() {
    var imp = st.importacao;
    if (!imp || imp.estado !== 'pronto') return;
    gravar(imp.caminhos, function () {
      st.importacao = null;
      st.meta = { estado: 'ok', cargaFeita: true };
      st.flash = { erro: false, texto: 'Carga inicial concluída.' };
      carregarMeta();
      ORDEM_DOMINIOS.forEach(function (d) { st.d[d] = novoDominio(); });
      carregarDominio(st.dominio);
    });
  }

  /* ---------- apresentação ---------- */
  function podeEditar() { return !st.opcoes.somenteLeitura && ehAdmin() && adminPronto(); }
  function raiz() { return st.raiz || (st.raiz = document.getElementById('adminTaxonomia')); }

  function selo(texto, classe) { return '<span class="tax-selo' + (classe ? ' ' + classe : '') + '">' + esc(texto) + '</span>'; }
  function seloSituacaoDef(sit) { return selo(SIT_DEFINICAO_ROTULO[sit] || sit, 'tax-selo--def-' + String(sit).replace(/\s+/g, '-')); }
  function seloSituacaoFonte(sit) { return selo(sit, 'tax-selo--fonte-' + String(sit).replace(/[^a-z]/gi, '')); }

  function ordenados(D) {
    return ordenaPor(chaves(D.conceitos).map(function (k) { return Object.assign({ _codigo: k }, D.conceitos[k]); }), 'ordem');
  }
  function renderLista(dom) {
    var D = st.d[dom], lista = ordenados(D), html = '<nav class="tax-lista" aria-label="Conceitos da ' + esc(DOMINIOS[dom].titulo) + '">';
    function item(c, nivel) {
      var ativo = D.selecionado === c._codigo;
      return '<button type="button" class="tax-item tax-item--n' + nivel + (ativo ? ' tax-item--ativo' : '') + (c.ativo === false ? ' tax-item--inativo' : '') + '" data-tax="selecionar" data-codigo="' + esc(c._codigo) + '">' +
        '<span class="tax-item-nome">' + esc(c.nome) + '</span>' +
        '<span class="tax-item-selos">' + (c.camada ? selo(CAMADA_ROTULO[c.camada] || c.camada) : '') + seloSituacaoDef(c.situacaoDefinicao) + (c.ativo === false ? selo('desativado') : '') + '</span></button>';
    }
    if (dom === 'organizacional') {
      var filhos = {};
      lista.forEach(function (c) { var p = c.pai || ''; (filhos[p] = filhos[p] || []).push(c); });
      var visto = {};
      function desce(c, nivel) {
        visto[c._codigo] = true;
        html += item(c, nivel);
        (filhos[c._codigo] || []).forEach(function (f) { desce(f, Math.min(nivel + 1, 2)); });
      }
      lista.filter(function (c) { return c.camada === 'A' || (!c.pai && c.camada !== 'auxiliar'); }).forEach(function (c) { if (!visto[c._codigo]) desce(c, 0); });
      var aux = lista.filter(function (c) { return c.camada === 'auxiliar'; });
      if (aux.length) { html += '<p class="tax-lista-grupo">Conceito auxiliar</p>'; aux.forEach(function (c) { visto[c._codigo] = true; html += item(c, 0); }); }
      var resto = lista.filter(function (c) { return !visto[c._codigo]; });
      resto.forEach(function (c) { html += item(c, 1); });
    } else lista.forEach(function (c) { html += item(c, 0); });
    return html + '</nav>';
  }

  function caminhoDo(dom, codigo) {
    var D = st.d[dom], partes = [], c = D.conceitos[codigo], guarda = 0;
    while (c && guarda++ < 6) { partes.unshift(c.nome); c = c.pai ? D.conceitos[c.pai] : null; }
    return partes;
  }

  function renderDefinicao(dom, codigo, det) {
    var c = st.d[dom].conceitos[codigo], html = '<section class="tax-sec" id="taxSecDefinicao"><h4>Definição</h4>';
    html += '<p class="tax-situacao">' + seloSituacaoDef(c.situacaoDefinicao) + '</p>';
    var vig = c.definicaoVigenteFonteId;
    if (vig && det.fontes[vig]) {
      var f = det.fontes[vig];
      html += '<p class="tax-definicao-texto">' + esc(f.texto) + '</p><p class="tax-fonte-origem">Fonte: ' + esc(rotuloFonte(f, vig)) + '</p>';
    } else if (vig && det.carregando) html += '<p class="loading-msg">Carregando a definição…</p>';
    else if (vig) html += '<p class="tax-aviso-erro">A definição vigente aponta para uma fonte que não foi encontrada.</p>';
    else if (c.situacaoDefinicao === 'em revisão') html += '<p class="tax-ausencia">Há textos recebidos, mas nenhum foi aprovado como definição vigente.</p>';
    else html += '<p class="tax-ausencia">Definição ainda não registrada.</p>';
    return html + '</section>';
  }

  function campoSelect(id, valor, opcoes, rotulos, vazio) {
    return '<select id="' + id + '" data-campo="' + id.replace(/^taxF_/, '') + '">' + (vazio ? '<option value="">' + esc(vazio) + '</option>' : '') + opcoes.map(function (o) { return '<option value="' + esc(o) + '"' + (o === valor ? ' selected' : '') + '>' + esc((rotulos && rotulos[o]) || o) + '</option>'; }).join('') + '</select>';
  }
  function formFonte(dom, codigo, e) {
    var v = e.valores, nova = e.tipo === 'novaFonte', atual = nova ? null : fontesAtuais(dom)[e.chave];
    var vigente = !!(atual && atual.situacao === 'vigente');
    var html = '<div class="tax-form" id="taxFormFonte">';
    html += '<label for="taxF_rotulo">Rótulo (opcional)</label><input type="text" id="taxF_rotulo" data-campo="rotulo" value="' + esc(v.rotulo) + '" maxlength="120">';
    html += '<label for="taxF_texto">Texto da fonte *</label><textarea id="taxF_texto" data-campo="texto" rows="6">' + esc(v.texto) + '</textarea>';
    html += '<div class="tax-form-linha"><div><label for="taxF_contexto">Contexto</label>' + campoSelect('taxF_contexto', v.contexto, CONTEXTOS) + '</div>';
    html += '<div><label for="taxF_tipoRedacao">Tipo de redação</label>' + campoSelect('taxF_tipoRedacao', v.tipoRedacao, TIPOS_REDACAO) + '</div>';
    html += '<div><label for="taxF_situacao">Situação</label>' + (vigente ? '<p class="tax-ajuda">Vigente. Para mudar, use "Remover vigência" ou torne outro texto vigente.</p>' : campoSelect('taxF_situacao', v.situacao, SIT_FONTE_EDITAVEL)) + '</div></div>';
    if (e.erro) html += '<p class="tax-aviso-erro" role="alert">' + esc(e.erro) + '</p>';
    html += '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="salvar-edicao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'SALVAR') + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-edicao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
    return html;
  }
  function htmlPendencia(p) {
    var texto;
    if (p.estado === 'nao-consta') texto = 'Conferi no servidor: a alteração ainda <strong>NÃO consta no banco</strong>. Ela pode ser aplicada se a conexão voltar; por isso novas gravações ficam bloqueadas até haver confirmação. Para descartá-la, recarregue a página.';
    else if (p.estado === 'sem-leitura') texto = '<strong>Não consegui consultar o servidor agora</strong> (conexão). <strong>Não sei se a alteração foi aplicada.</strong> Novas gravações ficam bloqueadas; recarregue a página para ver o estado real.';
    else texto = 'O servidor não respondeu a tempo. Estou conferindo o que foi gravado de verdade.';
    return '<div class="tax-pendente" id="taxPendente" role="alert"><p><strong>Gravação sem confirmação do servidor.</strong></p><p>' + texto + '</p>' +
      '<p><strong>Não repita a operação</strong> antes de a tela confirmar o estado real.</p>' +
      '<button type="button" class="btn btn--sm" data-tax="verificar-pendente"' + (p.verificando ? ' disabled' : '') + '>' + (p.verificando ? 'VERIFICANDO…' : 'VERIFICAR NO SERVIDOR') + '</button></div>';
  }
  function renderFontes(dom, codigo, det) {
    var D = st.d[dom], c = D.conceitos[codigo], ed = podeEditar(), e = D.edicao;
    var html = '<section class="tax-sec" id="taxSecFontes"><h4>Textos-fonte</h4>';
    if (det.erros.fontes) html += '<p class="tax-aviso-erro">' + (det.erros.fontes === 'sem-acesso' ? 'Sem acesso aos textos-fonte.' : 'Não foi possível carregar os textos-fonte agora.') + '</p>';
    else if (det.carregando && !chaves(det.fontes).length) html += '<p class="loading-msg">Carregando textos-fonte…</p>';
    var v = validarVigencia(det.fontes, c.definicaoVigenteFonteId || null);
    if (!det.carregando && !det.erros.fontes && !v.ok) html += '<p class="tax-aviso-erro" role="alert" id="taxAvisoVigencia">Estado inconsistente: ' + esc(v.erro) + ' Salvar alterações das fontes fica bloqueado até corrigir.</p>';
    var todas = ordenaPor(chaves(det.fontes).map(function (k) { return Object.assign({ _id: k }, det.fontes[k]); }), 'criadoEm');
    var vigentes = todas.filter(function (f) { return f.situacao === 'vigente'; });
    var candidatas = todas.filter(function (f) { return f.situacao !== 'vigente'; });
    /* Texto idêntico = igualdade EXATA (só espaços das pontas ignorados). Nada é fundido nem escondido. */
    var chaveTexto = function (f) { return String(f.texto || '').trim(); };
    var porTexto = {};
    todas.forEach(function (f) { (porTexto[chaveTexto(f)] = porTexto[chaveTexto(f)] || []).push(f); });
    var nUnicos = chaves(porTexto).length;
    var conf = D.confirmacao;
    var nomeFonte = function (f) { return f.rotulo || f.tipoRedacao || f._id; };

    function cartao(f, vigente) {
      var editandoEste = e && e.tipo === 'fonte' && e.chave === f._id;
      var h = '<article class="tax-fonte' + (vigente ? ' tax-fonte--vigente' : ' tax-fonte--candidata') + '" data-fonte="' + esc(f._id) + '">';
      h += '<header>' + (vigente ? selo('DEFINIÇÃO VIGENTE', 'tax-selo--vigente') : selo('FONTE PARA CURADORIA', 'tax-selo--curadoria')) + ' ' +
        (f.rotulo ? '<strong>' + esc(f.rotulo) + '</strong> ' : '') + selo(f.contexto, 'tax-selo--ctx') + seloSituacaoFonte(f.situacao) + selo(f.tipoRedacao) + '</header>';
      if (editandoEste) return h + formFonte(dom, codigo, e) + '</article>';
      h += '<p class="tax-fonte-texto">' + esc(f.texto) + '</p>';
      var iguais = porTexto[chaveTexto(f)].filter(function (o) { return o._id !== f._id; });
      if (iguais.length) h += '<p class="tax-identico">Texto idêntico a: ' + iguais.map(function (o) { return esc(rotuloFonte(o, o._id)) + (o.situacao === 'vigente' ? ' (definição vigente)' : ''); }).join('; ') + '</p>';
      if (!vigente && SIT_FONTE_PROMOVIVEL.indexOf(f.situacao) === -1) h += '<p class="tax-ajuda">Não pode ser definição (' + esc(f.situacao) + ').</p>';
      if (ed) {
        h += '<div class="tax-acoes">';
        if (!vigente && SIT_FONTE_PROMOVIVEL.indexOf(f.situacao) !== -1) h += '<button type="button" class="btn btn--sm" data-tax="tornar-vigente" data-fonte="' + esc(f._id) + '">Analisar para curadoria</button>';
        if (vigente) h += '<button type="button" class="btn btn--sm" data-tax="remover-vigencia" data-fonte="' + esc(f._id) + '">Remover vigência</button>';
        h += '<button type="button" class="btn btn--sm" data-tax="editar-fonte" data-fonte="' + esc(f._id) + '">Editar</button></div>';
        if (conf && conf.fonte === f._id && conf.acao === 'remover' && vigente) h += painelRemocao(f);
        if (conf && conf.fonte === f._id && conf.acao === 'tornar' && !vigente) h += painelAnalise(f);
      }
      return h + '</article>';
    }
    function dados(f) {
      return '<dl class="tax-confirma-dados">' +
        '<dt>Conceito</dt><dd>' + esc(c.nome) + '</dd>' +
        '<dt>Texto-fonte</dt><dd>' + esc(nomeFonte(f)) + '</dd>' +
        '<dt>Contexto</dt><dd>' + esc(f.contexto) + '</dd>' +
        '<dt>Tipo de redação</dt><dd>' + esc(f.tipoRedacao) + '</dd>' +
        '<dt>Situação atual</dt><dd>' + esc(f.situacao) + '</dd></dl>';
    }
    function painelAnalise(f) {
      var atualV = c.definicaoVigenteFonteId && det.fontes[c.definicaoVigenteFonteId];
      return '<div class="tax-confirma" role="alertdialog" aria-label="Análise para curadoria">' +
        '<p><strong>Análise para curadoria</strong></p>' +
        '<p class="tax-confirma-aviso" role="note"><strong>Esta ação altera a definição oficial deste conceito.</strong>' +
        (atualV ? ' O texto vigente atual (' + esc(rotuloFonte(atualV, c.definicaoVigenteFonteId)) + ') passa a "histórico/contextual".' : '') +
        ' O texto-fonte em si não é alterado. A decisão fica registrada na auditoria.</p>' +
        dados(f) +
        '<p class="tax-confirma-rotulo">Texto integral</p><p class="tax-confirma-texto">' + esc(f.texto) + '</p>' +
        '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="confirmar-vigente" data-fonte="' + esc(f._id) + '"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'Tornar esta fonte vigente') + '</button>' +
        '<button type="button" class="btn btn--sm" data-tax="cancelar-confirmacao">Cancelar / manter em revisão</button></div></div>';
    }
    function painelRemocao(f) {
      return '<div class="tax-confirma" role="alertdialog" aria-label="Remover definição vigente">' +
        '<p><strong>Remover a definição vigente?</strong></p>' +
        '<p class="tax-confirma-aviso" role="note"><strong>Esta ação remove a definição oficial vigente deste conceito e o deixará novamente em revisão.</strong> O texto-fonte em si não é alterado e passa a "histórico/contextual". A decisão fica registrada na auditoria.</p>' +
        '<dl class="tax-confirma-dados"><dt>Conceito</dt><dd>' + esc(c.nome) + '</dd><dt>Fonte vigente atual</dt><dd>' + esc(rotuloFonte(f, f._id)) + '</dd></dl>' +
        '<div class="tax-acoes"><button type="button" class="btn btn--sm tax-btn-perigo" data-tax="confirmar-remocao" data-fonte="' + esc(f._id) + '"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'Remover a definição vigente') + '</button>' +
        '<button type="button" class="btn btn--sm" data-tax="cancelar-confirmacao">Cancelar / manter a definição vigente</button></div></div>';
    }

    var pronto = !det.carregando && !det.erros.fontes;
    html += '<div class="tax-sub" id="taxVigenteBloco"><h5>Definição vigente</h5>';
    if (vigentes.length) html += vigentes.map(function (f) { return cartao(f, true); }).join('');
    else if (pronto) html += '<p class="tax-ausencia tax-sem-vigente">Nenhuma definição vigente. Nenhum dos textos abaixo vale como definição enquanto não for aprovado.</p>';
    html += '</div>';
    html += '<div class="tax-sub" id="taxFontesCuradoria"><h5>Fontes para curadoria</h5>';
    if (todas.length) html += '<p class="tax-resumo-fontes" id="taxResumoFontes">' + todas.length + (todas.length === 1 ? ' fonte cadastrada' : ' fontes cadastradas') + ' · ' + nUnicos + (nUnicos === 1 ? ' texto único' : ' textos únicos') + '</p>';
    html += '<p class="tax-ajuda">Estes textos são redações recebidas, candidatas à curadoria. “Conceito”, “Significado v1”, “Significado v2” e “proposta” são tipos de redação, não graus de autoridade. Só um texto pode ser a definição vigente.</p>';
    if (!todas.length && pronto) html += '<p class="tax-ausencia">Nenhum texto-fonte registrado.</p>';
    else if (pronto && !candidatas.length) html += '<p class="tax-ausencia">Não há outros textos-fonte além da definição vigente.</p>';
    candidatas.forEach(function (f) { html += cartao(f, false); });
    html += '</div>';
    if (ed) {
      if (e && e.tipo === 'novaFonte') html += '<article class="tax-fonte">' + formFonte(dom, codigo, e) + '</article>';
      else html += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="nova-fonte">+ Adicionar texto-fonte</button></div>';
    }
    return html + '</section>';
  }

  function renderPergunta(dom, codigo) {
    var D = st.d[dom], c = D.conceitos[codigo], e = D.edicao, ed = podeEditar();
    var html = '<section class="tax-sec" id="taxSecPergunta"><h4>' + (dom === 'organizacional' ? 'Pergunta discriminadora, critérios e observações' : 'Critérios e observações') + '</h4>';
    if (e && e.tipo === 'conceito' && e.chave === codigo) {
      var v = e.valores;
      html += '<div class="tax-form" id="taxFormConceito"><label for="taxF_nome">Nome *</label><input type="text" id="taxF_nome" data-campo="nome" value="' + esc(v.nome) + '" maxlength="120">';
      if (dom === 'organizacional') {
        html += '<label for="taxF_perguntaDiscriminadora">Pergunta discriminadora</label><textarea id="taxF_perguntaDiscriminadora" data-campo="perguntaDiscriminadora" rows="3">' + esc(v.perguntaDiscriminadora) + '</textarea>';
        html += '<label for="taxF_notaDeAplicacao">Nota de aplicação</label><textarea id="taxF_notaDeAplicacao" data-campo="notaDeAplicacao" rows="4">' + esc(v.notaDeAplicacao) + '</textarea>';
      }
      html += '<label for="taxF_criterios">Critérios (um por linha)</label><textarea id="taxF_criterios" data-campo="criterios" rows="4">' + esc(v.criterios) + '</textarea>';
      html += '<label for="taxF_observacoes">Observações</label><textarea id="taxF_observacoes" data-campo="observacoes" rows="3">' + esc(v.observacoes) + '</textarea>';
      html += '<label class="tax-check"><input type="checkbox" id="taxF_ativo" data-campo="ativo"' + (v.ativo ? ' checked' : '') + '> Conceito ativo (desmarcar desativa; nada é apagado)</label>';
      if (e.erro) html += '<p class="tax-aviso-erro" role="alert">' + esc(e.erro) + '</p>';
      html += '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="salvar-edicao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'SALVAR') + '</button><button type="button" class="btn btn--sm" data-tax="cancelar-edicao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
      return html + '</section>';
    }
    if (dom === 'organizacional') {
      if (c.perguntaDiscriminadora) {
        html += '<p class="tax-pergunta-disc"><span class="tax-rotulo">Pergunta</span> ' + esc(c.perguntaDiscriminadora) + '</p>';
        if (c.notaDeAplicacao) html += '<p class="tax-nota-aplicacao" id="taxNotaAplicacao"><span class="tax-rotulo">Nota de aplicação</span> ' + esc(c.notaDeAplicacao) + '</p>';
      } else html += '<p class="tax-ausencia">Pergunta discriminadora ainda não definida.</p>';
    }
    var crit = listaCriterios(c);
    if (crit.length) html += '<p class="tax-rotulo">Critérios</p><ul class="tax-criterios">' + crit.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    if (c.observacoes) html += '<p><span class="tax-rotulo">Observações</span> ' + esc(c.observacoes) + '</p>';
    if (!crit.length && !c.observacoes && dom === 'arquitetural') html += '<p class="tax-ausencia">Sem critérios nem observações registrados.</p>';
    if (ed) html += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="editar-conceito">Editar dados do conceito</button></div>';
    return html + '</section>';
  }

  function renderAtributos(dom, codigo, det) {
    var D = st.d[dom], e = D.edicao, ed = podeEditar();
    var html = '<section class="tax-sec" id="taxSecAtributos"><h4>Atributos</h4>';
    html += '<p class="tax-ajuda">Descrevem e confirmam. Nenhum atributo, sozinho, define o tipo.</p>';
    html += '<div class="tax-legenda" id="taxLegenda"><p class="tax-ajuda"><strong>Papel</strong> — <strong>definidor</strong>: ' + PAPEL_SIGNIFICADO['definidor'] + ' · <strong>típico</strong>: ' + PAPEL_SIGNIFICADO['típico'] + ' · <strong>observado</strong>: ' + PAPEL_SIGNIFICADO['observado'] + '.</p>' +
      '<p class="tax-ajuda"><strong>Origem</strong> — <strong>fonte</strong>: está nos textos-fonte · <strong>inferência</strong>: leitura nossa, nunca dado de fonte nem decisão aprovada · <strong>decisão</strong>: escolha aprovada.</p></div>';
    var atrs = ordenaPor(chaves(D.atributos).map(function (k) { return Object.assign({ _cod: k }, D.atributos[k]); }), 'ordem');
    if (det.erros.perfis) html += '<p class="tax-aviso-erro">Não foi possível carregar os atributos agora.</p>';
    else if (!atrs.length) html += '<p class="tax-ausencia">O catálogo de atributos está vazio.</p>';
    atrs.forEach(function (a) {
      var p = det.perfis[a._cod], editandoEste = e && e.tipo === 'perfil' && e.chave === a._cod;
      html += '<div class="tax-atributo" data-atributo="' + esc(a._cod) + '"><div class="tax-atributo-nome">' + esc(a.nome) + ' ' + selo(GRUPO_ROTULO[a.grupo] || a.grupo) + '</div>';
      if (editandoEste) {
        var v = e.valores;
        html += '<div class="tax-form" id="taxFormPerfil"><label for="taxF_estado">Estado</label>' + campoSelect('taxF_estado', v.estado, ESTADOS);
        if (v.estado === 'registrado') {
          var perm = a.valoresPermitidos ? ordenaPor(chaves(a.valoresPermitidos).map(function (k) { return a.valoresPermitidos[k]; }), 'ordem').map(function (x) { return x.texto; }) : null;
          html += '<label for="taxF_valor">Valor *</label>';
          if (perm && perm.length) html += '<select id="taxF_valor" data-campo="valor"><option value="">— escolha —</option>' + perm.map(function (t) { return '<option value="' + esc(t) + '"' + (t === v.valor ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + (v.valor && perm.indexOf(v.valor) === -1 ? '<option value="' + esc(v.valor) + '" selected>' + esc(v.valor) + '</option>' : '') + '</select>';
          else html += '<input type="text" id="taxF_valor" data-campo="valor" value="' + esc(v.valor) + '" maxlength="1000">';
          html += '<div class="tax-form-linha"><div><label for="taxF_papel">Papel</label>' + campoSelect('taxF_papel', v.papel, PAPEIS, { observado: 'observado (neutro: sem julgamento classificatório)' }) + '</div><div><label for="taxF_origem">Origem</label>' + campoSelect('taxF_origem', v.origem, ORIGENS, null, '— escolha a origem —') + '</div></div>';
        } else html += '<p class="tax-ajuda">Neste estado não há valor, papel nem origem: a ausência é registrada pelo estado.</p>';
        if (e.erro) html += '<p class="tax-aviso-erro" role="alert">' + esc(e.erro) + '</p>';
        html += '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="salvar-edicao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'SALVAR') + '</button><button type="button" class="btn btn--sm" data-tax="cancelar-edicao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
      } else {
        if (!p) html += '<p class="tax-valor tax-valor--ausente">Ainda não definido <span class="tax-ajuda">(sem registro)</span></p>';
        else if (p.estado === 'registrado') {
          html += '<p class="tax-valor">' + esc(p.valor) + ' ' + selo('Papel: ' + p.papel, 'tax-selo--papel-' + String(p.papel).replace(/[^a-z]/gi, '')) +
            selo('Origem: ' + p.origem, 'tax-selo--origem tax-selo--origem-' + (ORIGEM_CLASSE[p.origem] || 'fonte')) + '</p>';
          if (p.origem === 'inferência') html += '<p class="tax-inferencia-aviso">Inferência — leitura nossa; não é dado de fonte nem decisão aprovada. Pode ser alterada sem mexer no texto-fonte.</p>';
        }
        else html += '<p class="tax-valor tax-valor--ausente">' + esc(p.estado.charAt(0).toUpperCase() + p.estado.slice(1)) + '</p>';
        if (ed) html += '<button type="button" class="btn btn--sm" data-tax="editar-perfil" data-atributo="' + esc(a._cod) + '">Editar</button>';
      }
      html += '</div>';
    });
    return html + '</section>';
  }

  function renderRelacoes(dom, codigo, det) {
    var D = st.d[dom], html = '<section class="tax-sec" id="taxSecRelacoes"><h4>Relações</h4>';
    var ids = chaves(det.relacoes);
    if (det.erros.relacoes) html += '<p class="tax-aviso-erro">Não foi possível carregar as relações agora.</p>';
    else if (!ids.length) html += '<p class="tax-ausencia">Nenhuma relação registrada.</p>';
    function nome(cod) { return (D.conceitos[cod] && D.conceitos[cod].nome) || cod; }
    html += '<ul class="tax-relacoes">' + ids.map(function (k) {
      var r = det.relacoes[k];
      return '<li>' + esc(nome(r.de)) + ' <em>' + esc(RELACAO_ROTULO[r.tipo] || r.tipo) + '</em> ' + esc(nome(r.para)) + (r.nota ? ' <span class="tax-ajuda">— ' + esc(r.nota) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
    return html + '</section>';
  }

  function renderHistorico(dom, codigo, det) {
    var html = '<section class="tax-sec" id="taxSecHistorico"><h4>Histórico</h4>';
    if (det.erros.auditoria) html += '<p class="tax-aviso-erro">Histórico indisponível agora.</p>';
    else if (det.carregando && !chaves(det.auditoria).length) html += '<p class="loading-msg">Carregando histórico…</p>';
    else {
      var ev = ordenaPor(chaves(det.auditoria).map(function (k) { return det.auditoria[k]; }), 'dataHora').reverse();
      if (!ev.length) html += '<p class="tax-ausencia">Nenhuma alteração registrada.</p>';
      html += ev.map(function (l) {
        return '<div class="tax-aud"><strong>' + esc(l.campo || l.tipo) + '</strong>: ' + esc(l.valorAnterior === null || l.valorAnterior === undefined ? '—' : l.valorAnterior) + ' → ' + esc(l.valorNovo === null || l.valorNovo === undefined ? '—' : l.valorNovo) +
          '<br><span class="tax-ajuda">por ' + esc((l.usuario && (l.usuario.nome || l.usuario.email)) || '—') + ' em ' + esc(fmtData(l.dataHora)) + '</span></div>';
      }).join('');
    }
    return html + '</section>';
  }

  function renderDetalhe(dom) {
    var D = st.d[dom], codigo = D.selecionado;
    var html = '<section class="tax-detalhe" aria-live="polite">';
    html += '<button type="button" class="btn btn--sm tax-voltar" data-tax="voltar-lista">← Voltar para a lista</button>';
    if (!codigo || !D.conceitos[codigo]) return html + '<p class="tax-ausencia">Escolha um conceito na lista.</p></section>';
    var c = D.conceitos[codigo], det = D.detalhe && D.detalhe.codigo === codigo ? D.detalhe : { carregando: true, fontes: {}, perfis: {}, relacoes: {}, auditoria: {}, erros: {} };
    html += '<h3 class="tax-titulo">' + esc(c.nome) + '</h3>';
    html += '<p class="tax-caminho">' + caminhoDo(dom, codigo).map(esc).join(' › ') + ' ' + (c.camada ? selo(CAMADA_ROTULO[c.camada] || c.camada) : '') + (c.ativo === false ? selo('desativado') : '') + '</p>';
    html += renderDefinicao(dom, codigo, det);
    html += renderPergunta(dom, codigo);
    html += renderFontes(dom, codigo, det);
    if (dom === 'organizacional') { html += renderAtributos(dom, codigo, det); html += renderRelacoes(dom, codigo, det); }
    html += renderHistorico(dom, codigo, det);
    return html + '</section>';
  }

  function renderImportador() {
    if (!ehAdmin() || !adminPronto() || st.opcoes.somenteLeitura) return '';
    if (st.meta.estado === 'carregando' || st.meta.estado === 'ocioso') return '';
    if (st.meta.estado === 'erro' || st.meta.estado === 'sem-acesso') return '';
    if (st.meta.cargaFeita) return '';
    var imp = st.importacao;
    var html = '<section class="tax-importador" id="taxImportador"><h4>Carga inicial</h4>';
    html += '<p class="tax-ajuda">A Taxonomia começa vazia. A carga inicial é feita UMA vez, importando um arquivo preparado (JSON). Nada é sobrescrito e tudo entra numa gravação só.</p>';
    html += '<label for="taxArquivo" class="btn btn--sm">Escolher arquivo…</label><input type="file" id="taxArquivo" accept=".json,application/json" class="tax-arquivo">';
    if (imp) {
      html += '<p class="tax-arquivo-nome">' + esc(imp.nome) + '</p>';
      if (imp.estado === 'lendo') html += '<p class="loading-msg">Lendo o arquivo…</p>';
      if (imp.erros && imp.erros.length) html += '<div class="tax-aviso-erro" role="alert" id="taxImportErros"><strong>' + (imp.estado === 'invalido' ? 'O arquivo tem problemas — nada foi gravado:' : 'Não foi possível importar:') + '</strong><ul>' + imp.erros.slice(0, 40).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' + (imp.erros.length > 40 ? '<p>… e mais ' + (imp.erros.length - 40) + '.</p>' : '') + '</div>';
      if (imp.estado === 'pronto') {
        var r = imp.resumo;
        html += '<div class="tax-previa" id="taxPrevia"><strong>Prévia — nada foi gravado ainda</strong><ul><li>' + r.conceitos + ' conceitos</li><li>' + r.fontes + ' textos-fonte (' + r.vigentes + ' com definição vigente)</li><li>' + r.atributos + ' atributos, ' + r.perfis + ' valores de perfil, ' + r.relacoes + ' relações</li></ul>' +
          '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="confirmar-importacao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'IMPORTANDO…' : 'IMPORTAR') + '</button><button type="button" class="btn btn--sm" data-tax="cancelar-importacao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
      }
    }
    return html + '</section>';
  }

  function render() {
    var el = raiz();
    if (!el) return;
    var dom = st.dominio, D = st.d[dom];
    var html = '<div class="tax-raiz"><h3 class="avp-panel-titulo">Taxonomia</h3>';
    html += '<p class="tax-aviso">A Taxonomia <strong>define</strong> os conceitos. A Avaliação <strong>aplica</strong> esses conceitos aos itens avaliados. Os dois domínios abaixo são independentes.</p>';
    if (st.pendente && st.pendente.semResposta) html += htmlPendencia(st.pendente);
    if (st.flash) html += '<p class="tax-flash' + (st.flash.erro ? ' tax-flash--erro' : '') + '" role="status" id="taxFlash">' + esc(st.flash.texto) + ' <button type="button" class="tax-flash-fechar" data-tax="fechar-flash" aria-label="Fechar">×</button></p>';
    if (!adminPronto()) { el.innerHTML = html + '<p class="loading-msg">Verificando o acesso…</p></div>'; return; }
    if (!ehAdmin()) { el.innerHTML = html + '<p class="tax-aviso-erro">Esta área é só para administradoras.</p></div>'; return; }
    html += renderImportador();
    html += '<div class="tax-dominios" role="tablist" aria-label="Domínio da Taxonomia">' + ORDEM_DOMINIOS.map(function (d) {
      return '<button type="button" role="tab" class="tax-dominio' + (d === dom ? ' tax-dominio--ativo' : '') + '" aria-selected="' + (d === dom) + '" data-tax="dominio" data-dominio="' + d + '">' + esc(DOMINIOS[d].rotulo) + '</button>';
    }).join('') + '</div>';
    html += '<p class="tax-pergunta" id="taxPergunta"><strong>' + esc(DOMINIOS[dom].titulo) + '</strong> · ' + esc(DOMINIOS[dom].pergunta) + '</p>';
    if (D.estado === 'carregando' || D.estado === 'ocioso') html += '<p class="loading-msg" id="taxCarregando">Carregando a Taxonomia…</p>';
    else if (D.estado === 'erro') html += '<div class="tax-aviso-erro" id="taxErro" role="alert"><p>Não foi possível carregar a Taxonomia agora. Confira a conexão.</p><button type="button" class="btn btn--sm" data-tax="recarregar">TENTAR NOVAMENTE</button></div>';
    else if (D.estado === 'sem-acesso') html += '<p class="tax-aviso-erro" id="taxSemAcesso" role="alert">Você não tem acesso a esta área.</p>';
    else if (!chaves(D.conceitos).length) {
      html += '<p class="tax-ausencia" id="taxVazio">' + (st.meta.estado === 'ok' && !st.meta.cargaFeita ? 'Nenhum conceito cadastrado: a carga inicial ainda não foi feita.' : 'Este domínio não tem conceitos cadastrados.') + '</p>';
    } else html += '<div class="tax-wrap" data-vista="' + st.vista + '">' + renderLista(dom) + renderDetalhe(dom) + '</div>';
    el.innerHTML = html + '</div>';
  }

  /* ---------- eventos (delegados) ---------- */
  function valoresDe(dom, tipo, chave) {
    var D = st.d[dom], c = D.conceitos[D.selecionado] || {}, det = D.detalhe || {};
    if (tipo === 'conceito') return { nome: c.nome || '', observacoes: c.observacoes || '', perguntaDiscriminadora: c.perguntaDiscriminadora || '', notaDeAplicacao: c.notaDeAplicacao || '', criterios: listaCriterios(c).join('\n'), ativo: c.ativo !== false };
    if (tipo === 'fonte') { var f = (det.fontes || {})[chave] || {}; return { rotulo: f.rotulo || '', texto: f.texto || '', contexto: f.contexto || 'PREVI', tipoRedacao: f.tipoRedacao || 'Conceito', situacao: f.situacao === 'vigente' ? 'vigente' : (f.situacao || 'histórica/contextual') }; }
    if (tipo === 'novaFonte') return { rotulo: '', texto: '', contexto: 'PREVI', tipoRedacao: 'Conceito', situacao: 'em validação' };
    var p = (det.perfis || {})[chave] || {};
    return { estado: p.estado || 'registrado', valor: p.valor || '', papel: p.papel || 'observado', origem: p.origem || '' };
  }
  function iniciaEdicao(tipo, chave) {
    var D = st.d[st.dominio];
    if (D.detalhe && D.detalhe.carregando && tipo !== 'conceito') { /* ainda carregando: espera */ }
    D.edicao = { tipo: tipo, chave: chave || D.selecionado, valores: valoresDe(st.dominio, tipo, chave), erro: null };
    D.confirmacao = null;
    render();
  }
  function aoClicar(ev) {
    var alvo = ev.target.closest('[data-tax]');
    if (!alvo || !raiz().contains(alvo)) return;
    var acao = alvo.getAttribute('data-tax'), dom = st.dominio, D = st.d[dom];
    if (acao === 'dominio') {
      var novo = alvo.getAttribute('data-dominio');
      if (novo === dom) return;
      st.dominio = novo; st.vista = 'lista'; st.flash = null;
      if (st.d[novo].estado === 'ocioso') carregarDominio(novo); else render();
    } else if (acao === 'recarregar') { carregarMeta(); carregarDominio(dom); }
    else if (acao === 'selecionar') {
      var cod = alvo.getAttribute('data-codigo');
      D.selecionado = cod; D.edicao = null; D.confirmacao = null; st.vista = 'detalhe'; st.flash = null;
      carregarDetalhe(dom, cod);
      var det = raiz().querySelector('.tax-detalhe'); if (det && det.scrollIntoView && window.innerWidth <= 720) det.scrollIntoView();
    } else if (acao === 'voltar-lista') { st.vista = 'lista'; render(); }
    else if (acao === 'fechar-flash') { st.flash = null; render(); }
    else if (acao === 'verificar-pendente') { var pp = st.pendente; if (pp && !pp.resolvido && !pp.verificando) { clearTimeout(pp.timerVerif); pp.tentativas = 0; verificarGravacao(pp); } }
    else if (!podeEditar() && acao !== 'cancelar-importacao') return;
    else if (acao === 'editar-conceito') iniciaEdicao('conceito', D.selecionado);
    else if (acao === 'nova-fonte') iniciaEdicao('novaFonte', null);
    else if (acao === 'editar-fonte') iniciaEdicao('fonte', alvo.getAttribute('data-fonte'));
    else if (acao === 'editar-perfil') iniciaEdicao('perfil', alvo.getAttribute('data-atributo'));
    else if (acao === 'cancelar-edicao') { D.edicao = null; render(); }
    else if (acao === 'salvar-edicao') {
      var e = D.edicao; if (!e || st.salvando) return;
      if (e.tipo === 'conceito') salvarConceito(dom, D.selecionado);
      else if (e.tipo === 'fonte' || e.tipo === 'novaFonte') salvarFonte(dom, D.selecionado);
      else salvarPerfil(dom, D.selecionado);
    } else if (acao === 'tornar-vigente') { D.confirmacao = { fonte: alvo.getAttribute('data-fonte'), acao: 'tornar' }; render(); }
    else if (acao === 'cancelar-confirmacao') { D.confirmacao = null; render(); }
    else if (acao === 'confirmar-vigente') { if (!st.salvando) tornarVigente(dom, D.selecionado, alvo.getAttribute('data-fonte')); }
    else if (acao === 'remover-vigencia') { D.confirmacao = { fonte: alvo.getAttribute('data-fonte'), acao: 'remover' }; render(); }
    else if (acao === 'confirmar-remocao') { if (!st.salvando) removerVigencia(dom, D.selecionado); }
    else if (acao === 'confirmar-importacao') confirmarImportacao();
    else if (acao === 'cancelar-importacao') { st.importacao = null; render(); }
  }
  function aoEditar(ev) {
    var el = ev.target;
    if (el.id === 'taxArquivo') { if (ev.type === 'change' && el.files && el.files[0]) escolherArquivo(el.files[0]); return; }
    var campo = el.getAttribute && el.getAttribute('data-campo');
    var D = st.d[st.dominio];
    if (!campo || !D.edicao) return;
    D.edicao.valores[campo] = el.type === 'checkbox' ? el.checked : el.value;
    D.edicao.erro = null;
    /* mudar o estado do perfil troca os campos do formulário */
    if (D.edicao.tipo === 'perfil' && campo === 'estado') render();
  }

  var ligado = false;
  function ligar() {
    var el = raiz();
    if (!el || ligado) return;
    ligado = true;
    el.addEventListener('click', aoClicar);
    el.addEventListener('input', aoEditar);
    el.addEventListener('change', aoEditar);
  }

  /* Abre a área (ao entrar na aba). Reavalia o acesso; troca de usuário reinicia o estado. */
  function abrir(opcoes) {
    if (opcoes) st.opcoes = Object.assign({ somenteLeitura: false }, opcoes);
    var el = raiz();
    if (!el) return;
    ligar();
    var s = sessao();
    var email = s ? s.email : null;
    if (st.email !== email) {
      st.email = email; st.meta = { estado: 'ocioso', cargaFeita: false }; st.importacao = null; st.flash = null; st.vista = 'lista';
      ORDEM_DOMINIOS.forEach(function (d) { st.d[d] = novoDominio(); });
    }
    if (!adminPronto()) {
      render();
      window.addEventListener('fa-admin-ready', function onAdm() { window.removeEventListener('fa-admin-ready', onAdm); abrir(); });
      return;
    }
    if (!ehAdmin()) { render(); return; }
    if (st.meta.estado === 'ocioso' || st.meta.estado === 'erro') carregarMeta();
    var D = st.d[st.dominio];
    if (D.estado === 'ocioso' || D.estado === 'erro') carregarDominio(st.dominio); else render();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
    if (btn) btn.addEventListener('click', function () { abrir(); });
  });

  window.faTaxonomia = {
    abrir: abrir,
    validarVigencia: validarVigencia,
    prepararImportacao: prepararImportacao,
    DOMINIOS: DOMINIOS,
    /* Só para teste: permite rodar as MESMAS operações da tela contra o emulador com as regras reais
       (teste-rules-taxonomia.js) e provar que o que a aplicação grava, o banco aceita. */
    _interno: {
      st: st, espera: ESPERA, carregarDominio: carregarDominio, carregarDetalhe: carregarDetalhe, tornarVigente: tornarVigente,
      removerVigencia: removerVigencia, salvarConceito: salvarConceito, salvarFonte: salvarFonte, salvarPerfil: salvarPerfil
    }
  };
})();
