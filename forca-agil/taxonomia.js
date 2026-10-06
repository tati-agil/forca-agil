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
     avaliacao-classificacoes/<codigo>             ligação canônica "esta classificação do motor da Avaliação
                                                    usa o conceito arquitetural de MESMO código" — só governança
                                                    (registradoEm/Por, auditoriaId); nome e definição continuam
                                                    só aqui na Taxonomia, códigos do motor só em CAMADAS.
                                                    Criada uma vez, nunca alterada nem apagada (nesta etapa não há
                                                    "encerrar ligação"); só admin geral.
     avaliacao-classificacoes-auditoria/<codigo>/<id>   histórico da ligação (só acréscimo)

   GOVERNANÇA (Etapa 5) — tudo garantido pelas REGRAS do banco, não só pela tela:
     - conceito arquitetural com ligação em avaliacao-classificacoes NÃO pode ser inativado;
     - inativar exige motivo (conceito.inativacao) e reativar fica registrado (conceito.reativacao); os dois
       apontam (auditoriaId) para a linha de auditoria NOVA gravada na mesma operação — sem histórico, o banco recusa;
     - relação (organizacional): criada com histórico nas DUAS pontas (mesma chave/operacaoId) e depois só pode
       ser ENCERRADA (motivo, data, autor) — nunca alterada nem apagada; "Alterar" = encerrar a antiga + criar a
       nova na mesma gravação; relação idêntica a uma encerrada não pode ser criada de novo (reabrir: backlog).

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
  /* Motivos do arquivamento lógico (lista FECHADA — a mesma das regras do banco). */
  var MOTIVOS_ARQ = ['duplicidade', 'redação superada', 'não representa o conceito', 'fonte inadequada', 'criada por engano', 'outro'];

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
  function novoHGDom() { return { estado: 'ocioso', cursor: null, temMais: false, erro: null }; }
  function novoHG() { return { carregou: false, carregando: false, itens: [], doms: { organizacional: novoHGDom(), arquitetural: novoHGDom() }, contagem: {} }; }
  function novoDominio() { return { estado: 'ocioso', conceitos: {}, atributos: {}, selecionado: null, detalhe: null, edicao: null, confirmacao: null, expandida: null, arquivando: null, arquivadasAbertas: false, dica: false, novaVersao: null, inativando: null, relForm: null, encerrando: null }; }
  var st = {
    exp: null, /* exportação em andamento/resultado: { estado: lendo|gerando|ok|erro, formato, texto } */
    dominio: 'organizacional', email: null, raiz: null, opcoes: { somenteLeitura: false },
    meta: { estado: 'ocioso', cargaFeita: false }, importacao: null, flash: null, salvando: false,
    vista: 'lista', aba: 'dominio', /* aba: 'dominio' (lista + detalhe) ou 'historico' (histórico global) */
    hg: novoHG(),
    /* ligações da Avaliação (avaliacao-classificacoes): 'ocioso'|'carregando'|'ok'|'erro'|'sem-acesso'.
       "Ainda não sei" NUNCA vira "não está ligado": sem 'ok', nada que dependa da ligação é gravado. */
    lig: { estado: 'ocioso', mapa: {} }, cargaLig: null,
    /* recolhíveis (<details data-det>): aberto/fechado por id, para sobreviver aos re-renders da tela */
    detAbertos: {},
    rolagemLista: null, /* celular: posição da lista ao abrir um conceito, devolvida pelo "← VOLTAR PARA A LISTA" */
    d: { arquitetural: novoDominio(), organizacional: novoDominio() }
  };

  /* ---------- leitura (com limite de espera) ---------- */
  function lerNo(caminho, cb, montar) {
    var feito = false;
    var t = setTimeout(function () { fim({ ok: false, erro: 'tempo esgotado' }); }, ESPERA.leitura);
    function fim(r) { if (feito) return; feito = true; clearTimeout(t); cb(r); }
    try {
      var consulta = db().ref(caminho);
      if (montar) consulta = montar(consulta);
      var prom = consulta.once('value', function (snap) { fim({ ok: true, valor: snap.val() }); }, function (err) {
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
  function novaChave(caminho) { return db().ref(caminho).push().key; }
  function addAud(caminhos, dom, codigo, tipo, campo, anterior, novo, extra) {
    return addAudEm(caminhos, dom, codigo, novaChave(caminhoAud(dom, codigo)), tipo, campo, anterior, novo, extra);
  }
  function addAudEm(caminhos, dom, codigo, chave, tipo, campo, anterior, novo, extra) {
    caminhos[caminhoAud(dom, codigo) + '/' + chave] = Object.assign({
      tipo: tipo, conceito: codigo === '_catalogo' ? null : codigo, campo: campo || null,
      valorAnterior: anterior === undefined ? null : anterior, valorNovo: novo === undefined ? null : novo,
      usuario: usuarioAtual(), dataHora: agora()
    }, extra || {});
    return chave;
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
    var k = chaves(caminhos).filter(function (c) { return /\/auditoria\/[^/]+\/[^/]+$/.test(c) || /^avaliacao-classificacoes-auditoria\/[^/]+\/[^/]+$/.test(c); })[0];
    return k || null;
  }
  function lerServidorRest(caminho, cb) {
    /* Leitura REST direta ao servidor, com o token do próprio usuário (as regras valem do mesmo jeito).
       NÃO usa o SDK: o SDK (inclusive get()) pode responder com a própria gravação otimista ainda
       pendente — "conferi" e "foi aplicada" falsos. Sem como consultar, admite (nunca afirma). */
    var feito = false;
    var t = setTimeout(function () { fim({ ok: false, erro: 'tempo esgotado' }); }, ESPERA.leitura);
    function fim(r) { if (feito) return; feito = true; clearTimeout(t); cb(r); }
    try {
      var user = firebase.auth().currentUser;
      var base = firebase.app().options.databaseURL;
      if (!user || !base || typeof fetch !== 'function') { fim({ ok: false, erro: 'sem como consultar' }); return; }
      user.getIdToken().then(function (tok) {
        var url = new URL(base);
        url.pathname = '/' + caminho + '.json';
        url.searchParams.set('auth', tok);
        return fetch(url.toString(), { cache: 'no-store' });
      }).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      }).then(function (valor) { fim({ ok: true, valor: valor }); }, function (e) { fim({ ok: false, erro: e }); });
    } catch (e) { fim({ ok: false, erro: e }); }
  }
  /* o teste troca o leitor (o hermético lê o banco falso; o do emulador usa o REST de verdade) */
  var LEITORES = { servidor: lerServidorRest };
  function lerServidor(caminho, cb) { LEITORES.servidor(caminho, cb); }
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
    D.edicao = null; D.confirmacao = null; D.arquivando = null; D.expandida = null; D.dica = false; D.novaVersao = null; D.inativando = null; D.relForm = null; D.encerrando = null;
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
    var util = chaves(fontes).some(function (id) { return !fontes[id].arquivada && SIT_FONTE_PROMOVIVEL.indexOf(fontes[id].situacao) !== -1; });
    return util ? 'em revisão' : 'ainda não registrada';
  }
  function checaVigencia(fontesPos, ponteiro) {
    var v = validarVigencia(fontesPos, ponteiro);
    if (!v.ok) { st.flash = { erro: true, texto: 'Não foi salvo: ' + v.erro }; render(); return false; }
    return true;
  }

  function tornarVigente(dom, codigo, fonteId) {
    var c = conceitoAtual(dom, codigo), fontes = fontesAtuais(dom), fonte = fontes[fonteId];
    if (fonte && fonte.arquivada) {
      st.flash = { erro: true, texto: 'Esta fonte está arquivada. Restaure-a antes de usá-la como definição.' }; render(); return;
    }
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
  /* ---------- arquivamento lógico: nenhuma fonte é apagada; descarte é sempre arquivar (e dá para restaurar) ---------- */
  function arquivarFonte(dom, codigo, id) {
    var D = st.d[dom], a = D.arquivando, fontes = fontesAtuais(dom), f = fontes[id], c = conceitoAtual(dom, codigo);
    if (!a || a.fonte !== id) return;
    function recusa(msg) { a.erro = msg; render(); }
    if (!f) return recusa('Não encontrei esta fonte. Recarregue a página.');
    if (f.arquivada) return recusa('Esta fonte já está arquivada.');
    if (f.situacao === 'vigente' || c.definicaoVigenteFonteId === id) return recusa('A definição vigente não pode ser arquivada. Remova a vigência ou escolha outra definição antes.');
    if (MOTIVOS_ARQ.indexOf(a.motivo) === -1) return recusa('Escolha o motivo do arquivamento.');
    var just = String(a.justificativa || '').trim();
    if (a.motivo === 'outro' && !just) return recusa('Explique o motivo em "Justificativa": ela é obrigatória quando o motivo é "outro".');
    if (just.length > 500) return recusa('A justificativa tem no máximo 500 caracteres.');
    var base = RAIZ + '/' + dom, caminhos = {}, reg = { motivo: a.motivo, em: agora(), por: emailAutor() };
    if (just) reg.justificativa = just;
    caminhos[base + '/fontes/' + codigo + '/' + id + '/arquivada'] = true;
    caminhos[base + '/fontes/' + codigo + '/' + id + '/arquivamento'] = reg;
    /* sem vigente, arquivar a última fonte utilizável tira o conceito de "em revisão" */
    if (!c.definicaoVigenteFonteId && SIT_DEFINICAO.indexOf(c.situacaoDefinicao) !== -1) {
      var pos = JSON.parse(JSON.stringify(fontes)); pos[id].arquivada = true;
      var sit = situacaoSemVigente(pos);
      if (sit !== c.situacaoDefinicao) caminhos[base + '/conceitos/' + codigo + '/situacaoDefinicao'] = sit;
    }
    marcaConceito(caminhos, dom, codigo);
    addAud(caminhos, dom, codigo, 'fonte_arquivada', 'fonte', rotuloFonte(f, id), 'arquivada: ' + a.motivo, { fonteId: id, motivo: a.motivo, justificativa: just || null });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Texto-fonte arquivado. Ele continua consultável em "Fontes arquivadas".'); });
  }
  function restaurarFonte(dom, codigo, id) {
    var fontes = fontesAtuais(dom), f = fontes[id], c = conceitoAtual(dom, codigo);
    if (!f || !f.arquivada) return;
    var base = RAIZ + '/' + dom, caminhos = {};
    caminhos[base + '/fontes/' + codigo + '/' + id + '/arquivada'] = null;
    caminhos[base + '/fontes/' + codigo + '/' + id + '/arquivamento'] = null;
    if (!c.definicaoVigenteFonteId && SIT_DEFINICAO.indexOf(c.situacaoDefinicao) !== -1) {
      var pos = JSON.parse(JSON.stringify(fontes)); delete pos[id].arquivada;
      var sit = situacaoSemVigente(pos);
      if (sit !== c.situacaoDefinicao) caminhos[base + '/conceitos/' + codigo + '/situacaoDefinicao'] = sit;
    }
    marcaConceito(caminhos, dom, codigo);
    addAud(caminhos, dom, codigo, 'fonte_restaurada', 'fonte', 'arquivada: ' + ((f.arquivamento && f.arquivamento.motivo) || '—'), rotuloFonte(f, id), { fonteId: id });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Texto-fonte restaurado: voltou para "Fontes disponíveis".'); });
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
    if (!chaves(caminhos).length) { D.edicao.erro = 'Nada foi alterado.'; render(); return; }
    marcaConceito(caminhos, dom, codigo);
    chaves(depois).forEach(function (k) { addAud(caminhos, dom, codigo, 'alteracao_conceito', k, antes[k], depois[k]); });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Conceito salvo.'); });
  }

  var TEXTO_IMUTAVEL = 'O texto, o contexto e o tipo de redação de uma fonte já criada não podem ser alterados. Para corrigir o texto, crie um novo texto-fonte ("+ Adicionar texto-fonte" ou "Nova versão da definição") e arquive esta fonte com o motivo "redação superada".';
  function salvarFonte(dom, codigo) {
    var D = st.d[dom], e = D.edicao, v = e.valores, fontes = fontesAtuais(dom), c = conceitoAtual(dom, codigo);
    var nova = e.tipo === 'novaFonte';
    var id = nova ? null : e.chave;
    var atual = nova ? null : fontes[id];
    if (!nova && !atual) { e.erro = 'Não encontrei esta fonte. Recarregue a página.'; render(); return; }
    if (atual && atual.arquivada) { e.erro = 'Esta fonte está arquivada e não pode ser editada. Restaure-a primeiro.'; render(); return; }
    /* DEFESA EM PROFUNDIDADE (as regras do banco recusam o mesmo): fonte existente nunca muda de texto,
       contexto nem tipo de redação. Comparação EXATA com o que está gravado (sem aparar espaços). */
    if (atual && ['texto', 'contexto', 'tipoRedacao'].some(function (k) { return v[k] !== undefined && String(v[k]) !== String(atual[k]); })) {
      e.erro = TEXTO_IMUTAVEL; st.flash = { erro: true, texto: 'Não foi salvo: ' + TEXTO_IMUTAVEL }; render(); return;
    }
    var texto = atual ? atual.texto : String(v.texto || '').trim();
    if (!texto) { e.erro = 'O texto da fonte é obrigatório.'; render(); return; }
    if (nova) id = db().ref(RAIZ + '/' + dom + '/fontes/' + codigo).push().key;
    var ehVigente = !!(atual && atual.situacao === 'vigente');
    var situacao = ehVigente ? 'vigente' : v.situacao;
    if (!ehVigente && SIT_FONTE_EDITAVEL.indexOf(situacao) === -1) { e.erro = 'Escolha uma situação válida. Para tornar vigente use "Tornar vigente".'; render(); return; }
    var dado = atual ? { texto: atual.texto, contexto: atual.contexto, situacao: situacao, tipoRedacao: atual.tipoRedacao } : { texto: texto, contexto: v.contexto, situacao: situacao, tipoRedacao: v.tipoRedacao };
    var rotulo = String(v.rotulo || '').trim();
    if (rotulo) dado.rotulo = rotulo;
    var pos = JSON.parse(JSON.stringify(fontes));
    pos[id] = dado;
    if (!checaVigencia(pos, c.definicaoVigenteFonteId || null)) return;
    var base = RAIZ + '/' + dom, caminhos = {};
    if (nova) { dado.criadoEm = agora(); dado.criadoPor = emailAutor(); caminhos[base + '/fontes/' + codigo + '/' + id] = dado; }
    else {
      /* só o que pode mudar numa fonte existente: situação e rótulo (texto/contexto/tipo nunca são enviados) */
      if (atual.situacao !== dado.situacao) caminhos[base + '/fontes/' + codigo + '/' + id + '/situacao'] = dado.situacao;
      if ((atual.rotulo || null) !== (dado.rotulo || null)) caminhos[base + '/fontes/' + codigo + '/' + id + '/rotulo'] = dado.rotulo || null;
      if (!chaves(caminhos).length) { e.erro = 'Nada foi alterado.'; render(); return; }
    }
    /* uma fonte nova utilizável tira o conceito de "ainda não registrada" */
    if (!c.definicaoVigenteFonteId && SIT_DEFINICAO.indexOf(c.situacaoDefinicao) !== -1) {
      var sit = situacaoSemVigente(pos);
      if (sit !== c.situacaoDefinicao) caminhos[base + '/conceitos/' + codigo + '/situacaoDefinicao'] = sit;
    }
    marcaConceito(caminhos, dom, codigo);
    var baseVersao = nova && e.baseFonteId ? e.baseFonteId : null;
    addAud(caminhos, dom, codigo, 'alteracao_fonte', baseVersao ? 'nova versão da definição' : (nova ? 'nova fonte' : 'fonte'), nova ? null : rotuloFonte(atual, id), rotuloFonte(dado, id), baseVersao ? { fonteId: id, fonteBaseId: baseVersao } : { fonteId: id });
    gravar(caminhos, function () {
      aposSalvar(dom, codigo, baseVersao
        ? 'Nova versão salva como texto-fonte "em validação". A definição vigente NÃO mudou: para adotar a nova versão, use "Usar como vigente" nela.'
        : (nova ? 'Texto-fonte adicionado.' : 'Fonte salva.'));
      /* guia o próximo passo: o cartão da nova versão fica marcado, com o convite a "Usar como vigente" */
      if (baseVersao) { st.d[dom].novaVersao = id; render(); }
    });
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
  /* ---------- GOVERNANÇA (Etapa 5): ligações da Avaliação, inativação, relações ----------
     Cada operação = UM update multipath com o dado + a(s) linha(s) de auditoria. As regras do banco exigem
     que o dado aponte (auditoriaId) para a auditoria NOVA da mesma operação: a tela não é a única barreira. */
  var NO_LIG = 'avaliacao-classificacoes', NO_LIG_AUD = 'avaliacao-classificacoes-auditoria';
  var MAX_MOTIVO = 500;
  function carregarLigacoes() {
    var marca = st.lig.leitura = {};
    st.lig.estado = 'carregando';
    lerNo(NO_LIG, function (r) {
      if (st.lig.leitura !== marca) return;
      if (!r.ok) st.lig = { estado: r.negado ? 'sem-acesso' : 'erro', mapa: {} };
      else st.lig = { estado: 'ok', mapa: r.valor || {} };
      render();
    });
  }
  function codigosMotor() { var C = window.faClassificacoes; return C && C.codigos ? C.codigos() : []; }
  function estaLigado(codigo) { return !!(st.lig.estado === 'ok' && st.lig.mapa[codigo]); }
  function mensagemLigado(c) {
    return 'Este conceito está ligado à classificação "' + ((c && c.nome) || '') + '" da Avaliação e não pode ser inativado enquanto essa ligação estiver ativa.';
  }
  /* Filhos ativos (hierarquia "pai", só organizacional) e relações abertas que tocam o conceito. */
  function afetadosPor(dom, codigo) {
    var D = st.d[dom], det = D.detalhe && D.detalhe.codigo === codigo ? D.detalhe : null;
    var filhos = dom !== 'organizacional' ? [] : chaves(D.conceitos).filter(function (k) { var x = D.conceitos[k]; return x && x.pai === codigo && x.ativo !== false; }).sort();
    var rels = !det ? [] : chaves(det.relacoes).filter(function (k) { return det.relacoes[k] && !det.relacoes[k].encerrada; }).sort();
    return { filhos: filhos, relacoes: rels, pronto: dom !== 'organizacional' || !!(det && !det.carregando && !det.erros.relacoes), erroRelacoes: !!(det && det.erros.relacoes) };
  }
  function textoRelacao(dom, r) {
    var D = st.d[dom];
    function n(cod) { return ((D.conceitos[cod] && D.conceitos[cod].nome) || cod) + ' (' + cod + ')'; }
    return n(r.de) + ' ' + (RELACAO_ROTULO[r.tipo] || r.tipo) + ' ' + n(r.para);
  }
  function inativarConceito(dom, codigo) {
    var D = st.d[dom], c = conceitoAtual(dom, codigo), f = D.inativando;
    if (!f || f.codigo !== codigo) return;
    function recusa(msg) { f.erro = msg; render(); }
    if (c.ativo === false) return recusa('Este conceito já está inativo.');
    if (dom === 'arquitetural') {
      if (st.lig.estado !== 'ok') return recusa('Não foi possível confirmar se este conceito está ligado à Avaliação. Nada foi gravado. Tente novamente.');
      if (estaLigado(codigo)) return recusa(mensagemLigado(c));
    }
    var motivo = String(f.motivo || '').trim();
    if (!motivo) return recusa('Informe o motivo da inativação.');
    if (motivo.length > MAX_MOTIVO) return recusa('O motivo pode ter até ' + MAX_MOTIVO + ' caracteres.');
    var af = afetadosPor(dom, codigo);
    if (!af.pronto) return recusa(af.erroRelacoes ? 'Não foi possível conferir as relações afetadas. Nada foi gravado. Tente novamente.' : 'Aguarde: as relações deste conceito ainda estão carregando.');
    var base = RAIZ + '/' + dom + '/conceitos/' + codigo, caminhos = {};
    var k = novaChave(caminhoAud(dom, codigo));
    caminhos[base + '/ativo'] = false;
    caminhos[base + '/inativacao'] = { motivo: motivo, em: agora(), por: emailAutor(), auditoriaId: k };
    caminhos[base + '/reativacao'] = null;
    marcaConceito(caminhos, dom, codigo);
    addAudEm(caminhos, dom, codigo, k, 'inativacao', 'ativo', true, false, {
      motivo: motivo,
      filhosAtivos: af.filhos.length ? af.filhos.join(', ') : null,
      relacoesAbertas: af.relacoes.length ? af.relacoes.map(function (rk) { return textoRelacao(dom, D.detalhe.relacoes[rk]); }).join(' | ') : null
    });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Conceito inativado. Nada foi apagado: fontes, histórico e relações continuam registrados.'); });
  }
  function reativarConceito(dom, codigo) {
    var c = conceitoAtual(dom, codigo);
    if (c.ativo !== false) return;
    var base = RAIZ + '/' + dom + '/conceitos/' + codigo, caminhos = {};
    var k = novaChave(caminhoAud(dom, codigo));
    caminhos[base + '/ativo'] = true;
    caminhos[base + '/inativacao'] = null;
    caminhos[base + '/reativacao'] = { em: agora(), por: emailAutor(), auditoriaId: k };
    marcaConceito(caminhos, dom, codigo);
    addAudEm(caminhos, dom, codigo, k, 'reativacao', 'ativo', false, true, { motivoAnterior: (c.inativacao && c.inativacao.motivo) || null });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Conceito reativado.'); });
  }

  /* Relações: a chave é de__tipo__para. Uma vez criada, só pode ser ENCERRADA. */
  function chaveRelacao(de, tipo, para) { return de + '__' + tipo + '__' + para; }
  function relacoesConhecidas(dom) { var det = st.d[dom].detalhe; return (det && det.relacoes) || {}; }
  /* histórico nas DUAS pontas, mesma chave (a regra exige) e mesmo operacaoId (a mesma ação vista de cada lado) */
  function audRelacao(caminhos, chaveAud, operacaoId, tipo, r, chave, extra) {
    var texto = textoRelacao('organizacional', r);
    [['de', 'origem'], ['para', 'destino']].forEach(function (p) {
      addAudEm(caminhos, 'organizacional', r[p[0]], chaveAud, tipo, 'relação',
        tipo === 'relacao_criada' ? null : texto, tipo === 'relacao_criada' ? texto : 'encerrada',
        Object.assign({ relacao: chave, operacaoId: operacaoId, ponta: p[1] }, extra || {}));
    });
  }
  function validarNovaRelacao(r) {
    var D = st.d.organizacional, rels = relacoesConhecidas('organizacional');
    if (TIPOS_RELACAO.indexOf(r.tipo) === -1) return 'Escolha o tipo da relação.';
    if (!r.de || !r.para) return 'Escolha o outro conceito.';
    if (r.de === r.para) return 'Um conceito não pode se relacionar com ele mesmo.';
    if (!D.conceitos[r.de] || !D.conceitos[r.para]) return 'Conceito não encontrado.';
    if (D.conceitos[r.de].ativo === false || D.conceitos[r.para].ativo === false) return 'Só é possível relacionar conceitos ativos.';
    var ex = rels[chaveRelacao(r.de, r.tipo, r.para)];
    if (ex && ex.encerrada) return 'Esta relação já existiu e foi encerrada. Reabrir uma relação encerrada não está disponível.';
    if (ex) return 'Esta relação já existe.';
    return null;
  }
  function relacaoDoForm(codigo, f) {
    var outro = String(f.outro || '');
    var r = f.direcao === 'entrada' ? { de: outro, tipo: f.tipo, para: codigo } : { de: codigo, tipo: f.tipo, para: outro };
    var nota = String(f.nota || '').trim();
    if (nota) r.nota = nota;
    return r;
  }
  /* "+ Nova relação" e "Alterar" (= encerrar a antiga + criar a nova, numa gravação só) */
  function salvarRelacao(codigo) {
    var D = st.d.organizacional, f = D.relForm;
    if (!f) return;
    function recusa(msg) { f.erro = msg; render(); }
    var det = D.detalhe;
    if (!det || det.codigo !== codigo || det.carregando || det.erros.relacoes) return recusa('Aguarde: as relações deste conceito ainda não foram carregadas.');
    var r = relacaoDoForm(codigo, f);
    if (r.nota && r.nota.length > 2000) return recusa('A nota pode ter até 2000 caracteres.');
    var caminhos = {}, base = RAIZ + '/organizacional/relacoes/', antiga = null, motivo = '';
    if (f.modo === 'alterar') {
      antiga = det.relacoes[f.base];
      if (!antiga || antiga.encerrada) return recusa('A relação original não está mais ativa.');
      motivo = String(f.motivo || '').trim();
      if (!motivo) return recusa('Informe o motivo da alteração (a relação antiga é encerrada com ele).');
      if (motivo.length > MAX_MOTIVO) return recusa('O motivo pode ter até ' + MAX_MOTIVO + ' caracteres.');
      if (chaveRelacao(r.de, r.tipo, r.para) === f.base) return recusa(String(antiga.nota || '') === String(r.nota || '') ? 'Nada foi alterado.' : 'Só a nota mudou: a mesma relação não pode ser encerrada e criada de novo (reabrir não está disponível). Para corrigir só a nota, não há alteração possível nesta versão.');
    }
    var erro = validarNovaRelacao(r);
    if (erro) return recusa(erro);
    var chave = chaveRelacao(r.de, r.tipo, r.para);
    var kNova = novaChave(caminhoAud('organizacional', r.de)), operacao = kNova;
    if (antiga) {
      var kAnt = novaChave(caminhoAud('organizacional', antiga.de));
      operacao = kAnt;
      caminhos[base + f.base + '/encerrada'] = { motivo: motivo, em: agora(), por: emailAutor(), auditoriaId: kAnt };
      audRelacao(caminhos, kAnt, operacao, 'relacao_encerrada', antiga, f.base, { motivo: motivo, substituidaPor: chave });
    }
    caminhos[base + chave] = Object.assign({}, r, { criadaEm: agora(), criadaPor: emailAutor(), auditoriaId: kNova });
    audRelacao(caminhos, kNova, operacao, 'relacao_criada', r, chave, antiga ? { substitui: f.base, motivo: motivo } : null);
    gravar(caminhos, function () { D.relForm = null; aposSalvar('organizacional', codigo, antiga ? 'Relação alterada: a anterior foi encerrada e a nova, criada.' : 'Relação criada.'); });
  }
  function encerrarRelacao(codigo) {
    var D = st.d.organizacional, f = D.encerrando, det = D.detalhe;
    if (!f) return;
    function recusa(msg) { f.erro = msg; render(); }
    var r = det && det.relacoes[f.chave];
    if (!r || r.encerrada) return recusa('Esta relação não está mais ativa.');
    var motivo = String(f.motivo || '').trim();
    if (!motivo) return recusa('Informe o motivo do encerramento.');
    if (motivo.length > MAX_MOTIVO) return recusa('O motivo pode ter até ' + MAX_MOTIVO + ' caracteres.');
    var caminhos = {}, k = novaChave(caminhoAud('organizacional', r.de));
    caminhos[RAIZ + '/organizacional/relacoes/' + f.chave + '/encerrada'] = { motivo: motivo, em: agora(), por: emailAutor(), auditoriaId: k };
    audRelacao(caminhos, k, k, 'relacao_encerrada', r, f.chave, { motivo: motivo });
    gravar(caminhos, function () { D.encerrando = null; aposSalvar('organizacional', codigo, 'Relação encerrada. Ela continua registrada, como encerrada.'); });
  }

  /* Ligações da Avaliação — carga inicial controlada e idempotente: a prévia lê o banco; só entra o que falta. */
  function previaLigacoes() {
    var A = st.d.arquitetural, itens = codigosMotor().map(function (cod) {
      var c = A.conceitos[cod];
      if (st.lig.mapa[cod]) return { codigo: cod, situacao: 'ligado' };
      if (!c) return { codigo: cod, situacao: 'sem-conceito' };
      if (c.ativo === false) return { codigo: cod, situacao: 'inativo' };
      return { codigo: cod, situacao: 'ligar' };
    });
    return itens;
  }
  function registrarLigacoes() {
    var P = st.cargaLig;
    if (!P) return;
    if (st.lig.estado !== 'ok' || st.d.arquitetural.estado !== 'ok') { P.erro = 'Não foi possível conferir o estado atual das ligações. Nada foi gravado.'; render(); return; }
    var aLigar = previaLigacoes().filter(function (i) { return i.situacao === 'ligar'; });
    if (!aLigar.length) { P.erro = 'Não há ligação a registrar: nada foi gravado.'; render(); return; }
    var caminhos = {}, email = emailAutor(), quando = agora();
    aLigar.forEach(function (i) {
      var k = novaChave(NO_LIG_AUD + '/' + i.codigo);
      caminhos[NO_LIG + '/' + i.codigo] = { registradoEm: quando, registradoPor: email, auditoriaId: k };
      caminhos[NO_LIG_AUD + '/' + i.codigo + '/' + k] = { tipo: 'ligacao_registrada', codigo: i.codigo, conceitoNome: st.d.arquitetural.conceitos[i.codigo].nome, usuario: usuarioAtual(), dataHora: quando };
    });
    gravar(caminhos, function () {
      st.cargaLig = null;
      st.flash = { erro: false, texto: aLigar.length + (aLigar.length === 1 ? ' ligação registrada.' : ' ligações registradas.') };
      carregarLigacoes();
    });
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
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  /* "5 conceitos, 7 textos-fonte (1 com definição vigente), 4 atributos, 3 valores de perfil, 2 relações" —
     atributos/perfis/relações só aparecem quando existem (o domínio arquitetural não tem). */
  function textoContagem(r) {
    var t = plural(r.conceitos || 0, 'conceito', 'conceitos') + ', ' + plural(r.fontes || 0, 'texto-fonte', 'textos-fonte') + ' (' + (r.vigentes || 0) + ' com definição vigente)';
    if (r.atributos) t += ', ' + plural(r.atributos, 'atributo', 'atributos');
    if (r.perfis) t += ', ' + plural(r.perfis, 'valor de perfil', 'valores de perfil');
    if (r.relacoes) t += ', ' + plural(r.relacoes, 'relação', 'relações');
    return t;
  }
  /* Valida o arquivo e monta o update atômico. Genérico: nenhum conteúdo conceitual vive aqui. */
  function prepararImportacao(arq, conceitosExistentes) {
    var erros = [], avisos = [], caminhos = {}, resumo = { conceitos: 0, fontes: 0, atributos: 0, perfis: 0, relacoes: 0, vigentes: 0 };
    /* contagem POR DOMÍNIO: cada linha de auditoria da carga registra a do próprio domínio (não o total geral) */
    var porDominio = {};
    function conta(dom, campo) { resumo[campo]++; porDominio[dom] = porDominio[dom] || { conceitos: 0, fontes: 0, atributos: 0, perfis: 0, relacoes: 0, vigentes: 0 }; porDominio[dom][campo]++; }
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
          conta(dom, 'fontes');
        });
        /* A MESMA barreira da edição: no máximo uma vigente, e é a apontada */
        var v = validarVigencia(fontesPos, ponteiro);
        if (!v.ok) erros.push(onde + ': ' + v.erro);
        if (ponteiro) conta(dom, 'vigentes');
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
        conta(dom, 'conceitos');
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
        conta(dom, 'atributos');
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
          conta(dom, 'perfis');
        });
      });
      (bloco.relacoes || []).forEach(function (r, i) {
        var onde = 'organizacional › relação ' + (i + 1);
        if (!r || !cs[r.de] || !cs[r.para]) { erros.push(onde + ': conceito inexistente no arquivo.'); return; }
        if (TIPOS_RELACAO.indexOf(r.tipo) === -1) { erros.push(onde + ': tipo inválido.'); return; }
        var dado = { de: r.de, tipo: r.tipo, para: r.para };
        if (typeof r.nota === 'string' && r.nota.trim()) dado.nota = r.nota;
        caminhos[base + '/relacoes/' + r.de + '__' + r.tipo + '__' + r.para] = dado;
        conta(dom, 'relacoes');
      });
    });
    if (!resumo.conceitos && !erros.length) erros.push('O arquivo não traz nenhum conceito.');
    if (!erros.length) {
      caminhos[RAIZ + '/meta/cargaInicial'] = { feitaEm: agoraIso, feitaPor: email, resumo: resumo, resumoPorDominio: porDominio };
      DOM_IMPORT.forEach(function (dom) {
        if (!arq.dominios[dom] || !porDominio[dom]) return;
        var pd = porDominio[dom];
        addAud(caminhos, dom, '_catalogo', 'carga_inicial', 'carga inicial', null, 'Carga inicial — ' + DOMINIOS[dom].rotulo + ': ' + textoContagem(pd), { dominio: dom, resumoDominio: pd });
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

  /* CONCEITOS-BASE DA AVALIAÇÃO (só no domínio arquitetural): os códigos que o motor da Avaliação produz
     (window.faClassificacoes.codigos() — o catálogo do motor, sem lista nova nem campo novo no banco). A
     Avaliação mostra, para cada código, o NOME e a DEFINIÇÃO VIGENTE do conceito de MESMO código desta
     Taxonomia; código sem conceito aqui faz a Avaliação usar o rótulo de contingência. Clicar abre o conceito. */
  /* Conceitos-base da Avaliação: para cada código do catálogo do MOTOR (CAMADAS, via faClassificacoes),
     a situação da ligação canônica em avaliacao-classificacoes. Nenhuma lista própria aqui. */
  function resumoLigacoes() {
    var cods = codigosMotor();
    if (!cods.length || st.lig.estado !== 'ok') return null;
    var n = cods.filter(function (c) { return !!st.lig.mapa[c]; }).length;
    return { total: cods.length, ligadas: n };
  }
  function avisoProtecao() {
    var r = resumoLigacoes();
    if (!r || r.ligadas === r.total) return '';
    return '<p class="tax-aviso-erro" id="taxProtecaoIncompleta" role="status"><strong>Proteção da Avaliação incompleta:</strong> ' + r.ligadas + ' de ' + r.total + ' classificações ligadas. ' +
      'Enquanto a ligação não for registrada, o conceito correspondente pode ser inativado. Registre em Taxonomia › Arquitetural › “Conceitos-base da Avaliação”.</p>';
  }
  function renderConceitosBase(dom) {
    var cods = codigosMotor();
    if (dom !== 'arquitetural' || !cods.length) return '';
    var D = st.d[dom], L = st.lig, ok = L.estado === 'ok', r = resumoLigacoes();
    var idB = 'base:' + dom, P = st.cargaLig;
    var aberto = !!P || !r || r.ligadas < r.total;
    var h = '<section class="tax-base" id="taxConceitosBase" data-vista="' + esc(st.vista) + '"><details class="tax-recolhivel" data-det="' + idB + '"' + detAberto(idB, aberto) + '>' +
      '<summary class="tax-recolhivel-cab">Conceitos-base da Avaliação — ' + plural(cods.length, 'código', 'códigos') +
      (r ? ' · ' + r.ligadas + ' de ' + r.total + ' ligadas' : (L.estado === 'erro' || L.estado === 'sem-acesso' ? ' · ligações indisponíveis' : ' · conferindo ligações…')) + '</summary>' +
      '<p class="tax-ajuda">A Avaliação mostra, para cada classificação do motor, o nome e a definição vigente do conceito de mesmo código desta Taxonomia. ' +
      'A <strong>ligação</strong> (registrada uma vez, nunca apagada) protege o conceito: enquanto ela existir, ele não pode ser inativado.</p>';
    if (L.estado === 'erro' || L.estado === 'sem-acesso') h += '<p class="tax-aviso-erro" id="taxLigacoesErro">' + (L.estado === 'sem-acesso' ? 'Sem acesso às ligações da Avaliação.' : 'Não foi possível ler as ligações da Avaliação agora.') + ' <button type="button" class="btn btn--sm" data-tax="ligacoes-recarregar">Tentar novamente</button></p>';
    h += '<ul class="tax-base-lista">';
    cods.forEach(function (cod) {
      var c = D.conceitos[cod], l = ok ? L.mapa[cod] : null;
      var sit = !ok ? '<span class="tax-ajuda">conferindo…</span>' : l ? selo('ligado à Avaliação', 'tax-selo--ligado') + ' <span class="tax-ajuda">desde ' + esc(fmtData(l.registradoEm)) + '</span>'
        : !c ? '<span class="tax-base-falta">sem conceito — a Avaliação usa o rótulo de contingência; não pode ser ligado</span>'
        : c.ativo === false ? '<span class="tax-base-falta">conceito inativo — não pode ser ligado</span>'
        : '<span class="tax-base-falta">sem ligação</span>';
      if (c) h += '<li class="tax-base-item" data-base="' + esc(cod) + '" data-ligado="' + (l ? '1' : '0') + '"><button type="button" class="tax-base-abrir" data-tax="selecionar" data-codigo="' + esc(cod) + '">' +
        '<span class="tax-base-nome">' + esc(c.nome) + '</span> <code class="tax-base-codigo">' + esc(cod) + '</code>' + (c.ativo === false ? ' ' + selo('desativado') : '') + '</button> ' + sit + '</li>';
      else h += '<li class="tax-base-item tax-base-item--sem" data-base="' + esc(cod) + '" data-ligado="' + (l ? '1' : '0') + '"><code class="tax-base-codigo">' + esc(cod) + '</code> ' + sit + '</li>';
    });
    h += '</ul>';
    if (ok) {
      var orfas = chaves(L.mapa).filter(function (k) { return cods.indexOf(k) === -1; });
      if (orfas.length) h += '<p class="tax-aviso-erro" id="taxLigacoesOrfas">Ligações sem classificação correspondente no motor: ' + orfas.map(function (k) { return '<code>' + esc(k) + '</code>'; }).join(', ') + '.</p>';
    }
    if (ok && podeEditar() && D.estado === 'ok') {
      var prev = previaLigacoes(), aLigar = prev.filter(function (i) { return i.situacao === 'ligar'; });
      if (P) {
        h += '<div class="tax-previa" id="taxPreviaLigacoes"><strong>Prévia — nada foi gravado ainda</strong><ul>' + prev.map(function (i) {
          var rot = { ligado: 'já ligado (não muda)', ligar: 'será ligado', 'sem-conceito': 'não pode ser ligado — conceito ausente', inativo: 'não pode ser ligado — conceito inativo' }[i.situacao];
          return '<li data-previa="' + esc(i.codigo) + '" data-situacao="' + i.situacao + '"><code>' + esc(i.codigo) + '</code> — ' + rot + '</li>';
        }).join('') + '</ul>' + (P.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(P.erro) + '</p>' : '') +
          '<div class="tax-acoes">' + (aLigar.length ? '<button type="button" class="btn btn--primary btn--sm" data-tax="confirmar-ligacoes" id="taxConfirmarLigacoes"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'Registrar ' + plural(aLigar.length, 'ligação', 'ligações')) + '</button>' : '') +
          '<button type="button" class="btn btn--sm" data-tax="cancelar-ligacoes"' + (st.salvando ? ' disabled' : '') + '>' + (aLigar.length ? 'Cancelar' : 'Fechar') + '</button></div></div>';
      } else if (aLigar.length) {
        h += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="previa-ligacoes" id="taxRegistrarLigacoesBtn">Registrar ligações da Avaliação…</button></div>';
      }
    }
    return h + '</details></section>';
  }
  function caminhoDo(dom, codigo) {
    var D = st.d[dom], partes = [], c = D.conceitos[codigo], guarda = 0;
    while (c && guarda++ < 6) { partes.unshift(c.nome); c = c.pai ? D.conceitos[c.pai] : null; }
    return partes;
  }

  function campoSelect(id, valor, opcoes, rotulos, vazio) {
    return '<select id="' + id + '" data-campo="' + id.replace(/^taxF_/, '') + '">' + (vazio ? '<option value="">' + esc(vazio) + '</option>' : '') + opcoes.map(function (o) { return '<option value="' + esc(o) + '"' + (o === valor ? ' selected' : '') + '>' + esc((rotulos && rotulos[o]) || o) + '</option>'; }).join('') + '</select>';
  }
  /* Texto-fonte é IMUTÁVEL depois de criado (texto, contexto e tipo de redação — o banco também recusa):
     - fonte NOVA (inclusive "Nova versão da definição", que nasce pré-preenchida com a anterior): todos os campos;
     - fonte EXISTENTE: só rótulo e situação são editáveis; texto, contexto e tipo aparecem só para leitura.
     Corrigir um texto = criar uma fonte nova e arquivar a antiga com o motivo "redação superada". */
  function formFonte(dom, codigo, e) {
    var v = e.valores, nova = e.tipo === 'novaFonte', atual = nova ? null : fontesAtuais(dom)[e.chave];
    var vigente = !!(atual && atual.situacao === 'vigente');
    var html = '<div class="tax-form" id="taxFormFonte"' + (e.baseFonteId ? ' data-nova-versao="' + esc(e.baseFonteId) + '"' : '') + '>';
    if (nova && e.baseFonteId) {
      var base = fontesAtuais(dom)[e.baseFonteId];
      html += '<p class="tax-form-titulo" id="taxNovaVersaoTitulo"><strong>Nova versão da definição</strong></p>' +
        '<p class="tax-ajuda" id="taxNovaVersaoAjuda">Começa com o texto da definição vigente atual' + (base ? ' (' + esc(rotuloFonte(base, e.baseFonteId)) + ')' : '') +
        '. Salvar cria um NOVO texto-fonte "em validação"; o texto atual não muda e continua vigente até você usar "Usar como vigente" na nova versão.</p>';
    }
    html += '<label for="taxF_rotulo">Rótulo (opcional)</label><input type="text" id="taxF_rotulo" data-campo="rotulo" value="' + esc(v.rotulo) + '" maxlength="120">';
    if (nova) {
      html += '<label for="taxF_texto">Texto da fonte *</label><textarea id="taxF_texto" data-campo="texto" rows="6">' + esc(v.texto) + '</textarea>';
      html += '<div class="tax-form-linha"><div><label for="taxF_contexto">Contexto</label>' + campoSelect('taxF_contexto', v.contexto, CONTEXTOS) + '</div>';
      html += '<div><label for="taxF_tipoRedacao">Tipo de redação</label>' + campoSelect('taxF_tipoRedacao', v.tipoRedacao, TIPOS_REDACAO) + '</div>';
    } else {
      html += '<p class="tax-rotulo">Texto da fonte (não editável)</p><p class="tax-fonte-texto tax-somente-leitura" id="taxF_textoFixo">' + esc(atual ? atual.texto : v.texto) + '</p>';
      html += '<dl class="tax-confirma-dados tax-meta"><dt>Contexto</dt><dd>' + esc(atual ? atual.contexto : v.contexto) + '</dd><dt>Tipo de redação</dt><dd>' + esc(atual ? atual.tipoRedacao : v.tipoRedacao) + '</dd></dl>';
      html += '<p class="tax-ajuda" id="taxAjudaImutavel">O texto, o contexto e o tipo de redação de uma fonte não mudam depois de criada. Para corrigir o texto: use "+ Adicionar texto-fonte" com a redação certa e arquive esta fonte com o motivo "redação superada".</p>';
      html += '<div class="tax-form-linha">';
    }
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
  /* ---------- recolhíveis: <details data-det="…"> ----------
     O aberto/fechado de cada um fica em st.detAbertos (ligado pelo evento "toggle", em ligar()), então um
     re-render (gravação, leitura que chega) não fecha o que a pessoa abriu. `padrao` vale enquanto ela não mexe. */
  function detAberto(id, padrao) { var v = st.detAbertos[id]; return (v === undefined ? !!padrao : v) ? ' open' : ''; }
  function idDet(tipo, dom, codigo) { return tipo + ':' + dom + ':' + codigo; }
  /* trocar de conceito volta os históricos (e as fontes) ao padrão: históricos sempre começam fechados */
  function zerarDetConceito() {
    chaves(st.detAbertos).forEach(function (k) { if (/^(hist|audd|outras):/.test(k)) delete st.detAbertos[k]; });
  }

  /* ---------- histórico: o MESMO formato no conceito e no histórico global ----------
     Fechado por padrão, com o tamanho no cabeçalho ("Histórico — N alterações"). Aberto: uma linha por
     alteração com data, autor, tipo e "anterior → novo"; o conteúdo longo e os campos técnicos ficam atrás de
     "Ver detalhes", COMPLETOS. É só apresentação: nenhum dado da auditoria é cortado nem resumido de vez. */
  var LIMITE_RESUMO = 140;
  var CAMPOS_BASE_AUD = ['tipo', 'conceito', 'campo', 'valorAnterior', 'valorNovo', 'usuario', 'dataHora'];
  function curto(s) { s = String(s); return s.length > LIMITE_RESUMO ? s.slice(0, LIMITE_RESUMO - 1).replace(/\s+$/, '') + '…' : s; }
  function valorAud(v) { return v === null || v === undefined || v === '' ? '—' : String(txt(v)); }
  function autorAud(u) {
    if (!u) return '—';
    if (typeof u === 'string') return u;
    if (!u.nome) return u.email || '—';
    return u.nome + (u.email && u.email !== u.nome ? ' (' + u.email + ')' : '');
  }
  function tituloHistorico(n, extra) { return 'Histórico — ' + n + (n === 1 ? ' alteração' : ' alterações') + (extra || ''); }
  /* o "Ver detalhes" de uma linha: valores integrais + todo campo além dos básicos (fonteId, motivo…) */
  function detalhesAud(l, idDetalhe, cortou) {
    var extras = chaves(l).filter(function (k) { return CAMPOS_BASE_AUD.indexOf(k) === -1 && k.charAt(0) !== '_'; });
    if (!cortou && !extras.length) return '';
    var h = '<details class="tax-hist-detalhe" data-det="' + esc(idDetalhe) + '"' + detAberto(idDetalhe) + '><summary>Ver detalhes</summary><dl class="tax-dl tax-hist-valores">' +
      '<dt>Tipo (técnico)</dt><dd><code>' + esc(l.tipo || '—') + '</code></dd>' +
      (l.campo ? '<dt>Campo</dt><dd>' + esc(txt(l.campo)) + '</dd>' : '') +
      '<dt>Valor anterior</dt><dd class="tax-hist-integral">' + esc(valorAud(l.valorAnterior)) + '</dd>' +
      '<dt>Valor novo</dt><dd class="tax-hist-integral">' + esc(valorAud(l.valorNovo)) + '</dd>';
    extras.forEach(function (k) { h += '<dt>' + esc(k) + '</dt><dd class="tax-hist-integral">' + esc(valorAud(l[k])) + '</dd>'; });
    return h + '</dl></details>';
  }
  function linhaHistoricoConceito(l, idDetalhe) {
    var ant = valorAud(l.valorAnterior), nov = valorAud(l.valorNovo);
    var cortou = curto(ant) !== ant || curto(nov) !== nov;
    return '<li class="tax-aud tax-hist-item" data-chave="' + esc(l._chave) + '" data-datahora="' + esc(l.dataHora || '') + '">' +
      '<div class="tax-hist-meta"><span class="tax-hist-quando">' + esc(fmtData(l.dataHora)) + '</span><span class="tax-hist-autor">por ' + esc(autorAud(l.usuario)) + '</span>' +
      '<strong class="tax-hist-tipo">' + esc(HG_TIPOS[l.tipo] || l.tipo || '—') + '</strong></div>' +
      '<p class="tax-hist-resumo">' + (l.campo ? '<strong>' + esc(txt(l.campo)) + '</strong>: ' : '') + esc(curto(ant)) + ' → ' + esc(curto(nov)) + '</p>' +
      detalhesAud(l, idDetalhe, cortou) + '</li>';
  }

  /* ---------- detalhe do conceito, NESTA ordem ----------
     a) Identificação · b) Definição vigente (cartão em destaque, com "Nova versão da definição" à mão) e logo
     depois as outras fontes · c) Critérios e pergunta discriminadora · d) Atributos / perfil · e) Relações
     (saída e entrada) · f) Histórico (recolhido, por último). Tudo indexado pelo CÓDIGO do conceito. */
  function renderIdentificacao(dom, codigo) {
    var D = st.d[dom], c = D.conceitos[codigo], e = D.edicao, ed = podeEditar(), org = dom === 'organizacional';
    var html = '<section class="tax-sec tax-sec--ident" id="taxSecIdent"><h4>Identificação</h4><div class="tax-ident">';
    html += '<p class="tax-ident-linha" id="taxCodigo"><span class="tax-ident-k">Código:</span> <code>' + esc(codigo) + '</code></p>';
    html += '<p class="tax-ident-linha"><span class="tax-ident-k">Nome:</span> ' + esc(c.nome) + '</p>';
    html += '<p class="tax-ident-linha" id="taxIdentSituacao"><span class="tax-ident-k">Situação:</span> ' + (c.ativo === false ? selo('desativado') : selo('ativo', 'tax-selo--ativo')) + seloSituacaoDef(c.situacaoDefinicao) + '</p>';
    if (org) html += '<p class="tax-ident-linha"><span class="tax-ident-k">Camada:</span> ' + (c.camada ? esc(CAMADA_ROTULO[c.camada] || c.camada) : '<span class="tax-ausencia">sem camada</span>') + '</p>';
    if (c.pai) {
      var pai = D.conceitos[c.pai];
      html += '<p class="tax-ident-linha" id="taxIdentPai"><span class="tax-ident-k">Conceito pai:</span> ' + esc(pai ? pai.nome : c.pai) + ' <code>' + esc(c.pai) + '</code>' +
        (pai ? '' : ' <span class="tax-aviso-erro">(não encontrado)</span>') + '</p>';
      html += '<p class="tax-caminho">' + caminhoDo(dom, codigo).map(esc).join(' › ') + '</p>';
    }
    if (c.ativo === false && c.inativacao) html += '<p class="tax-ident-linha" id="taxIdentInativacao"><span class="tax-ident-k">Inativado:</span> ' + esc(fmtData(c.inativacao.em)) + ' por ' + esc(c.inativacao.por || '—') + ' — motivo: ' + esc(c.inativacao.motivo || '—') + '</p>';
    if (dom === 'arquitetural' && estaLigado(codigo)) html += '<p class="tax-ident-linha" id="taxIdentLigado"><span class="tax-ident-k">Avaliação:</span> ' + selo('ligado à Avaliação', 'tax-selo--ligado') + ' <span class="tax-ajuda">classificação de mesmo código do motor; não pode ser inativado.</span></p>';
    if (c.atualizadoEm || c.atualizadoPor) html += '<p class="tax-ident-linha tax-ident-atualizado"><span class="tax-ident-k">Última atualização:</span> ' + esc(fmtData(c.atualizadoEm)) + (c.atualizadoPor ? ' por ' + esc(c.atualizadoPor) : '') + '</p>';
    html += '</div>';
    if (e && e.tipo === 'conceito' && e.chave === codigo) {
      var v = e.valores;
      html += '<div class="tax-form" id="taxFormConceito"><p class="tax-form-titulo"><strong>Editar dados do conceito</strong></p><label for="taxF_nome">Nome *</label><input type="text" id="taxF_nome" data-campo="nome" value="' + esc(v.nome) + '" maxlength="120">';
      if (org) {
        html += '<label for="taxF_perguntaDiscriminadora">Pergunta discriminadora</label><textarea id="taxF_perguntaDiscriminadora" data-campo="perguntaDiscriminadora" rows="3">' + esc(v.perguntaDiscriminadora) + '</textarea>';
        html += '<label for="taxF_notaDeAplicacao">Nota de aplicação</label><textarea id="taxF_notaDeAplicacao" data-campo="notaDeAplicacao" rows="4">' + esc(v.notaDeAplicacao) + '</textarea>';
      }
      html += '<label for="taxF_criterios">Critérios (um por linha)</label><textarea id="taxF_criterios" data-campo="criterios" rows="4">' + esc(v.criterios) + '</textarea>';
      html += '<label for="taxF_observacoes">Observações</label><textarea id="taxF_observacoes" data-campo="observacoes" rows="3">' + esc(v.observacoes) + '</textarea>';
      if (e.erro) html += '<p class="tax-aviso-erro" role="alert">' + esc(e.erro) + '</p>';
      html += '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="salvar-edicao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'SALVAR') + '</button><button type="button" class="btn btn--sm" data-tax="cancelar-edicao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
    } else if (ed) {
      html += '<div class="tax-acoes tax-acoes--conceito" id="taxAcoesConceito"><button type="button" class="btn btn--sm" data-tax="editar-conceito">Editar dados do conceito</button>' +
        (c.ativo === false ? '<button type="button" class="btn btn--sm" data-tax="reativar" id="taxReativarBtn"' + (st.salvando ? ' disabled' : '') + '>Reativar conceito</button>'
          : '<button type="button" class="btn btn--sm tax-btn-perigo" data-tax="inativar" id="taxInativarBtn">Inativar conceito</button>') + '</div>' +
        '<p class="tax-ajuda">A definição muda pelo cartão “Definição vigente”, logo abaixo.</p>';
      if (D.inativando && D.inativando.codigo === codigo && c.ativo !== false) html += painelInativar(dom, codigo, c);
    }
    return html + '</section>';
  }

  /* Inativar: motivo obrigatório; mostra antes o que é afetado. Conceito ligado à Avaliação: só a explicação. */
  function painelInativar(dom, codigo, c) {
    var f = D_(dom).inativando;
    var h = '<div class="tax-confirma tax-inativar" id="taxPainelInativar" role="group" aria-label="Inativar conceito">';
    if (dom === 'arquitetural' && st.lig.estado !== 'ok') {
      return h + '<p class="' + (st.lig.estado === 'carregando' ? 'loading-msg' : 'tax-aviso-erro') + '" id="taxInativarLigacao">' +
        (st.lig.estado === 'carregando' || st.lig.estado === 'ocioso' ? 'Conferindo se este conceito está ligado à Avaliação…' : 'Não foi possível conferir se este conceito está ligado à Avaliação. Nada pode ser inativado até essa conferência.') + '</p>' +
        '<div class="tax-acoes">' + (st.lig.estado === 'erro' ? '<button type="button" class="btn btn--sm" data-tax="ligacoes-recarregar">Tentar novamente</button>' : '') + '<button type="button" class="btn btn--sm" data-tax="cancelar-inativar">Fechar</button></div></div>';
    }
    if (dom === 'arquitetural' && estaLigado(codigo)) {
      return h + '<p class="tax-aviso-erro" role="alert" id="taxInativarBloqueado">' + esc(mensagemLigado(c)) + '</p>' +
        '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="cancelar-inativar">Fechar</button></div></div>';
    }
    var af = afetadosPor(dom, codigo), D = D_(dom);
    h += '<p><strong>Inativar este conceito?</strong></p><p class="tax-ajuda">Nada é apagado: o conceito, as fontes, o histórico e as relações continuam registrados. A inativação fica no histórico com o motivo.</p>';
    if (dom === 'organizacional') {
      h += '<div id="taxInativarAfetados"><p class="tax-rotulo">Filhos ativos (' + af.filhos.length + ')</p>' + (af.filhos.length ? '<ul>' + af.filhos.map(function (k) { return '<li>' + esc(D.conceitos[k].nome) + ' <code>' + esc(k) + '</code></li>'; }).join('') + '</ul>' : '<p class="tax-ausencia">Nenhum.</p>');
      if (!af.pronto) h += '<p class="' + (af.erroRelacoes ? 'tax-aviso-erro' : 'loading-msg') + '">' + (af.erroRelacoes ? 'Não foi possível carregar as relações afetadas.' : 'Carregando relações afetadas…') + '</p>';
      else h += '<p class="tax-rotulo">Relações ativas (' + af.relacoes.length + ')</p>' + (af.relacoes.length ? '<ul>' + af.relacoes.map(function (k) { return '<li>' + esc(textoRelacao(dom, D.detalhe.relacoes[k])) + '</li>'; }).join('') + '</ul>' : '<p class="tax-ausencia">Nenhuma.</p>');
      if (af.filhos.length || af.relacoes.length) h += '<p class="tax-ajuda">Os filhos e as relações não são alterados: continuam como estão, apontando para um conceito inativo.</p>';
      h += '</div>';
    }
    h += '<label for="taxI_motivo">Motivo *</label><textarea id="taxI_motivo" data-inat="motivo" rows="3" maxlength="' + MAX_MOTIVO + '">' + esc(f.motivo || '') + '</textarea>' +
      (f.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(f.erro) + '</p>' : '') +
      '<div class="tax-acoes"><button type="button" class="btn btn--sm tax-btn-perigo" data-tax="confirmar-inativar"' + (st.salvando || !af.pronto ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'Inativar conceito') + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-inativar"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
    return h;
  }
  function D_(dom) { return st.d[dom]; }

  /* b) Definição vigente (cartão em destaque) + as outras fontes (em validação, históricas, arquivadas).
     Devolve { definicao, outras } — os dois blocos usam os mesmos cartões e painéis de confirmação. */
  function blocosFontes(dom, codigo, det) {
    var D = st.d[dom], c = D.conceitos[codigo], ed = podeEditar(), e = D.edicao;
    var todas = ordenaPor(chaves(det.fontes).map(function (k) { return Object.assign({ _id: k }, det.fontes[k]); }), 'criadoEm');
    var vigentes = todas.filter(function (f) { return f.situacao === 'vigente' && !f.arquivada; });
    var arquivadas = todas.filter(function (f) { return f.arquivada; });
    var disponiveis = todas.filter(function (f) { return f.situacao !== 'vigente' && !f.arquivada; });
    /* Texto idêntico = igualdade EXATA (só espaços das pontas ignorados), entre fontes NÃO arquivadas.
       Nada é fundido nem escondido; é só um sinal para a curadoria humana. */
    var chaveTexto = function (f) { return String(f.texto || '').trim(); };
    var porTexto = {};
    todas.filter(function (f) { return !f.arquivada; }).forEach(function (f) { (porTexto[chaveTexto(f)] = porTexto[chaveTexto(f)] || []).push(f); });
    var conf = D.confirmacao, arqForm = D.arquivando;
    var nomeFonte = function (f) { return f.rotulo || f.tipoRedacao || f._id; };
    var iguaisA = function (f) { return f.arquivada ? [] : (porTexto[chaveTexto(f)] || []).filter(function (o) { return o._id !== f._id; }); };

    function detalhes(f) {
      var vig = f.situacao === 'vigente' && !f.arquivada;
      var h = '<div class="tax-detalhes">';
      if (!vig) h += '<p class="tax-fonte-texto">' + esc(f.texto) + '</p>'; /* a vigente já mostra o texto integral no cartão */
      h += '<dl class="tax-confirma-dados tax-meta"><dt>Tipo de redação</dt><dd>' + esc(f.tipoRedacao) + '</dd>' +
        '<dt>Situação</dt><dd>' + esc(f.situacao) + '</dd>' +
        '<dt>Criada por</dt><dd>' + esc(f.criadoPor || '—') + (f.criadoEm ? ' em ' + esc(fmtData(f.criadoEm)) : '') + '</dd>' +
        '<dt>Identificador</dt><dd><code>' + esc(f._id) + '</code></dd>';
      if (f.arquivada && f.arquivamento) h += '<dt>Arquivada por</dt><dd>' + esc(f.arquivamento.por || '—') + ' em ' + esc(fmtData(f.arquivamento.em)) + '</dd>';
      h += '</dl>';
      var iguais = iguaisA(f);
      if (iguais.length) h += '<p class="tax-identico">Texto idêntico a: ' + iguais.map(function (o) { return esc(rotuloFonte(o, o._id)) + (o.situacao === 'vigente' ? ' (definição vigente)' : ''); }).join('; ') + '</p>';
      /* Texto-fonte é imutável: a vigente não tem "Editar" — a mudança de redação é a "Nova versão da definição"
         (botão no próprio cartão). As demais editam só rótulo e situação. */
      if (vig && ed) h += '<p class="tax-ajuda">O texto vigente não é editado: “Nova versão da definição” cria outro texto-fonte “em validação”, e a definição só muda quando você usar “Usar como vigente” nele.</p>';
      else if (ed && !f.arquivada) h += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="editar-fonte" data-fonte="' + esc(f._id) + '">Editar</button></div>' +
        '<p class="tax-ajuda tax-ajuda-corrigir">Editar muda só o rótulo e a situação. Texto errado? Adicione um novo texto-fonte com a redação certa e arquive este com o motivo "redação superada".</p>';
      return h + '</div>';
    }
    function cabecalho(f, vigente) {
      var h = '<header class="tax-fonte-cab">';
      if (vigente) h += selo('DEFINIÇÃO OFICIAL', 'tax-selo--vigente') + ' ';
      else if (f.arquivada) h += selo('ARQUIVADA', 'tax-selo--arquivada') + ' ';
      h += '<strong class="tax-fonte-nome">' + esc(nomeFonte(f)) + '</strong> ' + selo(f.contexto, 'tax-selo--ctx');
      if (!vigente) h += seloSituacaoFonte(f.situacao);
      return h + '</header>';
    }
    function cartao(f, tipo) { /* tipo: 'vigente' | 'disponivel' | 'arquivada' */
      var vigente = tipo === 'vigente', aberta = D.expandida === f._id;
      var editandoEste = e && e.tipo === 'fonte' && e.chave === f._id;
      var h = '<article class="tax-fonte tax-fonte--' + tipo + (aberta || editandoEste ? ' tax-fonte--aberta' : '') + '" data-fonte="' + esc(f._id) + '">';
      h += cabecalho(f, vigente);
      if (editandoEste) return h + formFonte(dom, codigo, e) + '</article>';
      if (vigente) {
        h += '<p class="tax-fonte-texto tax-definicao-texto">' + esc(f.texto) + '</p>' +
          '<dl class="tax-dl tax-vig-meta"' + (f._id === c.definicaoVigenteFonteId ? ' id="taxVigenteMeta"' : '') + '><dt>Rótulo da fonte</dt><dd>' + esc(f.rotulo || '—') + '</dd>' +
          '<dt>Contexto</dt><dd>' + esc(f.contexto || '—') + '</dd>' +
          '<dt>Tipo de redação</dt><dd>' + esc(f.tipoRedacao || '—') + '</dd>' +
          '<dt>Registrada por</dt><dd>' + esc(f.criadoPor || '—') + (f.criadoEm ? ' em ' + esc(fmtData(f.criadoEm)) : '') + '</dd>' +
          '<dt>Fonte (id)</dt><dd><code>' + esc(f._id) + '</code></dd></dl>';
      } else if (f.arquivada) {
        var a = f.arquivamento || {};
        h += '<p class="tax-arq-info">Motivo: <strong>' + esc(a.motivo || '—') + '</strong>' + (a.justificativa ? ' — ' + esc(a.justificativa) : '') + '<br><span class="tax-ajuda">Arquivada em ' + esc(fmtData(a.em)) + ' por ' + esc(a.por || '—') + '</span></p>';
      } else {
        if (D.novaVersao === f._id) h += '<p class="tax-dica" id="taxNovaVersaoCriada" role="note">Nova versão criada agora. A definição vigente ainda é a anterior: use “Usar como vigente” para adotar esta.</p>';
        if (iguaisA(f).length) h += '<p class="tax-identico tax-identico--resumo">Texto idêntico ao de outra fonte</p>';
        if (SIT_FONTE_PROMOVIVEL.indexOf(f.situacao) === -1) h += '<p class="tax-ajuda">Não pode ser definição (' + esc(f.situacao) + ').</p>';
      }
      if (aberta) h += detalhes(f);
      h += '<div class="tax-acoes tax-acoes--fonte">';
      if (vigente) {
        /* a ação de redação fica NO cartão da definição, em destaque (não escondida em "Ver detalhes") */
        if (ed) h += '<button type="button" class="btn btn--sm tax-btn-destaque" data-tax="nova-versao" data-fonte="' + esc(f._id) + '">Nova versão da definição</button>' +
          '<button type="button" class="btn btn--sm" data-tax="alterar-definicao">Alterar definição</button>' +
          '<button type="button" class="btn btn--sm" data-tax="remover-vigencia" data-fonte="' + esc(f._id) + '">Remover vigência</button>';
        h += '<button type="button" class="btn btn--sm" data-tax="ver" data-fonte="' + esc(f._id) + '" aria-expanded="' + (aberta ? 'true' : 'false') + '">' + (aberta ? 'Ocultar detalhes' : 'Ver detalhes') + '</button>';
      } else {
        h += '<button type="button" class="btn btn--sm" data-tax="ver" data-fonte="' + esc(f._id) + '" aria-expanded="' + (aberta ? 'true' : 'false') + '">' + (aberta ? 'Ocultar' : 'Ver') + '</button>';
        if (ed && f.arquivada) h += '<button type="button" class="btn btn--sm" data-tax="restaurar" data-fonte="' + esc(f._id) + '"' + (st.salvando ? ' disabled' : '') + '>Restaurar</button>';
        else if (ed) {
          if (SIT_FONTE_PROMOVIVEL.indexOf(f.situacao) !== -1) h += '<button type="button" class="btn btn--sm" data-tax="tornar-vigente" data-fonte="' + esc(f._id) + '">Usar como vigente</button>';
          h += '<button type="button" class="btn btn--sm" data-tax="arquivar" data-fonte="' + esc(f._id) + '">Arquivar</button>';
        }
      }
      h += '</div>';
      if (ed) {
        if (conf && conf.fonte === f._id && conf.acao === 'remover' && vigente) h += painelRemocao(f);
        if (conf && conf.fonte === f._id && conf.acao === 'tornar' && tipo === 'disponivel') h += painelAnalise(f);
        if (arqForm && arqForm.fonte === f._id && tipo === 'disponivel') h += painelArquivar(f);
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
        '<p><strong>Usar como definição vigente</strong></p>' +
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
    function painelArquivar(f) {
      return '<div class="tax-confirma tax-arquivar" id="taxFormArquivar" role="group" aria-label="Arquivar texto-fonte">' +
        '<p><strong>Arquivar este texto-fonte?</strong></p>' +
        '<p class="tax-ajuda">O texto não é apagado: sai da lista de fontes disponíveis, fica consultável em “Fontes arquivadas” e pode ser restaurado. A decisão fica registrada na auditoria.</p>' +
        '<label for="taxA_motivo">Motivo *</label><select id="taxA_motivo" data-arq="motivo"><option value="">— escolha —</option>' +
        MOTIVOS_ARQ.map(function (m) { return '<option value="' + esc(m) + '"' + (arqForm.motivo === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>' +
        '<label for="taxA_justificativa">Justificativa (obrigatória se o motivo for “outro”)</label><textarea id="taxA_justificativa" data-arq="justificativa" rows="3" maxlength="500">' + esc(arqForm.justificativa) + '</textarea>' +
        (arqForm.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(arqForm.erro) + '</p>' : '') +
        '<div class="tax-acoes"><button type="button" class="btn btn--sm tax-btn-perigo" data-tax="confirmar-arquivar" data-fonte="' + esc(f._id) + '"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'Arquivar texto-fonte') + '</button>' +
        '<button type="button" class="btn btn--sm" data-tax="cancelar-arquivar"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
    }

    var pronto = !det.carregando && !det.erros.fontes;
    var erroFontes = det.erros.fontes ? '<p class="tax-aviso-erro">' + (det.erros.fontes === 'sem-acesso' ? 'Sem acesso aos textos-fonte.' : 'Não foi possível carregar os textos-fonte agora.') + '</p>' : '';

    /* ----- b) Definição vigente ----- */
    var def = '<section class="tax-sec tax-sec--definicao" id="taxSecDefinicao" aria-label="Definição vigente"><h4>Definição vigente</h4>';
    def += '<p class="tax-situacao">' + seloSituacaoDef(c.situacaoDefinicao) + '</p>';
    var v = validarVigencia(det.fontes, c.definicaoVigenteFonteId || null);
    if (pronto && !v.ok) def += '<p class="tax-aviso-erro" role="alert" id="taxAvisoVigencia">Estado inconsistente: ' + esc(v.erro) + ' Salvar alterações das fontes fica bloqueado até corrigir.</p>';
    def += erroFontes;
    def += '<div class="tax-sub tax-bloco tax-bloco--vigente" id="taxVigenteBloco">';
    var vig = c.definicaoVigenteFonteId;
    if (vigentes.length) def += vigentes.map(function (f) { return cartao(f, 'vigente'); }).join('');
    else if (!pronto && !det.erros.fontes) def += '<p class="loading-msg">Carregando a definição…</p>';
    else if (!det.erros.fontes) {
      if (vig) def += '<p class="tax-aviso-erro">A definição vigente aponta para uma fonte que não foi encontrada.</p>';
      else if (c.situacaoDefinicao === 'em revisão') def += '<p class="tax-ausencia">Há textos recebidos, mas nenhum foi aprovado como definição vigente.</p>';
      else def += '<p class="tax-ausencia">Definição ainda não registrada.</p>';
      def += '<p class="tax-ausencia tax-sem-vigente">Nenhuma definição vigente. Nenhum dos textos abaixo vale como definição enquanto não for aprovado.</p>';
    }
    def += '</div>';
    /* o formulário da nova versão abre AQUI, junto da definição de que ela parte */
    if (ed && e && e.tipo === 'novaFonte' && e.baseFonteId) def += '<article class="tax-fonte tax-fonte--nova-versao">' + formFonte(dom, codigo, e) + '</article>';
    def += '</section>';

    /* ----- outras fontes (recolhível; aberta por padrão para a curadoria seguir à mão) ----- */
    var nOutras = disponiveis.length + arquivadas.length;
    var idOutras = idDet('outras', dom, codigo);
    var out = '<section class="tax-sec tax-sec--outras" id="taxSecFontes"><details class="tax-recolhivel" id="taxOutrasFontes" data-det="' + esc(idOutras) + '"' + detAberto(idOutras, true) + '>' +
      '<summary class="tax-recolhivel-cab">Outras fontes da definição — ' + (pronto ? nOutras : '…') + '</summary>';
    out += '<p class="tax-ajuda">Em validação, históricas/contextuais e arquivadas. Nenhuma vale como definição enquanto não for usada como vigente.</p>';
    if (det.erros.fontes) out += erroFontes;
    else if (det.carregando && !chaves(det.fontes).length) out += '<p class="loading-msg">Carregando textos-fonte…</p>';
    if (pronto && todas.length) out += '<p class="tax-resumo-fontes" id="taxResumoFontes">' + plural(disponiveis.length, 'fonte disponível', 'fontes disponíveis') + (arquivadas.length ? ' · ' + plural(arquivadas.length, 'fonte arquivada', 'fontes arquivadas') : '') + '</p>';
    out += '<div class="tax-sub tax-bloco tax-bloco--disponiveis" id="taxFontesDisponiveis" tabindex="-1"><h5>Fontes disponíveis' + (pronto ? ' (' + disponiveis.length + ')' : '') + '</h5>';
    if (D.dica && ed) out += '<p class="tax-dica" id="taxDicaAlterar" role="note">Escolha uma das fontes abaixo e use “Usar como vigente”. Nenhuma delas é recomendada: a escolha é sua.</p>';
    if (!todas.length && pronto) out += '<p class="tax-ausencia">Nenhum texto-fonte registrado.</p>';
    else if (pronto && !disponiveis.length) out += '<p class="tax-ausencia">Não há fontes disponíveis além da definição vigente.</p>';
    disponiveis.forEach(function (f) { out += cartao(f, 'disponivel'); });
    if (ed) {
      if (e && e.tipo === 'novaFonte' && !e.baseFonteId) out += '<article class="tax-fonte">' + formFonte(dom, codigo, e) + '</article>';
      else if (!(e && e.tipo === 'novaFonte')) out += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="nova-fonte">+ Adicionar texto-fonte</button></div>';
    }
    out += '</div>';
    if (pronto && arquivadas.length) {
      out += '<div class="tax-sub tax-bloco tax-bloco--arquivadas" id="taxFontesArquivadas"><h5><button type="button" class="tax-recolher" data-tax="alternar-arquivadas" aria-expanded="' + (D.arquivadasAbertas ? 'true' : 'false') + '">' +
        (D.arquivadasAbertas ? '▾' : '▸') + ' Fontes arquivadas (' + arquivadas.length + ')</button></h5>';
      if (D.arquivadasAbertas) arquivadas.forEach(function (f) { out += cartao(f, 'arquivada'); });
      out += '</div>';
    }
    out += '</details></section>';
    return { definicao: def, outras: out };
  }

  /* c) Critérios e pergunta discriminadora (só leitura aqui; a edição é "Editar dados do conceito", na Identificação) */
  function renderPergunta(dom, codigo) {
    var c = st.d[dom].conceitos[codigo], org = dom === 'organizacional';
    var html = '<section class="tax-sec" id="taxSecPergunta"><h4>' + (org ? 'Critérios e pergunta discriminadora' : 'Critérios e observações') + '</h4>';
    if (org) {
      if (c.perguntaDiscriminadora) {
        html += '<p class="tax-pergunta-disc"><span class="tax-rotulo">Pergunta</span> ' + esc(c.perguntaDiscriminadora) + '</p>';
        if (c.notaDeAplicacao) html += '<p class="tax-nota-aplicacao" id="taxNotaAplicacao"><span class="tax-rotulo">Nota de aplicação</span> ' + esc(c.notaDeAplicacao) + '</p>';
      } else html += '<p class="tax-ausencia">Pergunta discriminadora ainda não definida.</p>';
    }
    var crit = listaCriterios(c);
    if (crit.length) html += '<p class="tax-rotulo">Critérios</p><ul class="tax-criterios">' + crit.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    else if (org) html += '<p class="tax-ausencia">Sem critérios registrados.</p>';
    if (c.observacoes) html += '<p><span class="tax-rotulo">Observações</span> ' + esc(c.observacoes) + '</p>';
    if (!crit.length && !c.observacoes && !org) html += '<p class="tax-ausencia">Sem critérios nem observações registrados.</p>';
    return html + '</section>';
  }

  function renderAtributos(dom, codigo, det) {
    var D = st.d[dom], e = D.edicao, ed = podeEditar();
    var html = '<section class="tax-sec" id="taxSecAtributos"><h4>Atributos / perfil</h4>';
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

  /* e) Relações: SAÍDA (este conceito → outro) e ENTRADA (outro → este conceito), separadas e rotuladas.
     O outro conceito aparece pelo nome ATUAL e pelo código (a chave). */
  function renderRelacoes(dom, codigo, det) {
    var D = st.d[dom], ed = podeEditar(), html = '<section class="tax-sec" id="taxSecRelacoes"><h4>Relações</h4>';
    function nome(cod) { return (D.conceitos[cod] && D.conceitos[cod].nome) || cod; }
    function outro(cod) { return esc(nome(cod)) + ' <code>' + esc(cod) + '</code>' + (D.conceitos[cod] && D.conceitos[cod].ativo === false ? ' ' + selo('desativado') : ''); }
    function nota(r) { return r.nota ? ' <span class="tax-ajuda">— ' + esc(r.nota) + '</span>' : ''; }
    var este = '<strong>' + esc(nome(codigo)) + '</strong> <span class="tax-ajuda">(este conceito)</span>';
    if (det.erros.relacoes) return html + '<p class="tax-aviso-erro">Não foi possível carregar as relações agora.</p></section>';
    if (det.carregando && !chaves(det.relacoes).length) return html + '<p class="loading-msg">Carregando relações…</p></section>';
    var ids = chaves(det.relacoes).sort();
    var abertas = ids.filter(function (k) { return !det.relacoes[k].encerrada; });
    var encerradas = ids.filter(function (k) { return !!det.relacoes[k].encerrada; });
    var saida = abertas.filter(function (k) { return det.relacoes[k].de === codigo; });
    var entrada = abertas.filter(function (k) { return det.relacoes[k].para === codigo; });
    var ocupado = !!(D.relForm || D.encerrando);
    function acoes(k) {
      if (!ed || ocupado || D.conceitos[codigo].ativo === false) return '';
      return ' <span class="tax-rel-acoes"><button type="button" class="btn btn--sm" data-tax="alterar-relacao" data-relacao="' + esc(k) + '">Alterar</button>' +
        '<button type="button" class="btn btn--sm" data-tax="encerrar-relacao" data-relacao="' + esc(k) + '">Encerrar</button></span>';
    }
    function item(k, lado) {
      var r = det.relacoes[k];
      var txt = lado === 'saida' ? este + ' <em>' + esc(RELACAO_ROTULO[r.tipo] || r.tipo) + '</em> → ' + outro(r.para) : outro(r.de) + ' <em>' + esc(RELACAO_ROTULO[r.tipo] || r.tipo) + '</em> → ' + este;
      var h = '<li data-relacao="' + esc(k) + '">' + txt + nota(r) + acoes(k);
      if (D.encerrando && D.encerrando.chave === k) h += painelEncerrar(k);
      if (D.relForm && D.relForm.modo === 'alterar' && D.relForm.base === k) h += formRelacao(dom, codigo);
      return h + '</li>';
    }
    html += '<div class="tax-rel-grupo" id="taxRelSaida"><h5>Relações de saída (' + saida.length + ') <span class="tax-ajuda">este conceito → outro</span></h5>';
    if (!saida.length) html += '<p class="tax-ausencia">Nenhuma relação de saída.</p>';
    else html += '<ul class="tax-relacoes">' + saida.map(function (k) { return item(k, 'saida'); }).join('') + '</ul>';
    html += '</div><div class="tax-rel-grupo" id="taxRelEntrada"><h5>Relações de entrada (' + entrada.length + ') <span class="tax-ajuda">outro → este conceito</span></h5>';
    if (!entrada.length) html += '<p class="tax-ausencia">Nenhuma relação de entrada.</p>';
    else html += '<ul class="tax-relacoes">' + entrada.map(function (k) { return item(k, 'entrada'); }).join('') + '</ul>';
    html += '</div>';
    if (ed && D.conceitos[codigo].ativo !== false) {
      if (D.relForm && D.relForm.modo === 'nova') html += formRelacao(dom, codigo);
      else if (!ocupado) html += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="nova-relacao" id="taxNovaRelacaoBtn">+ Nova relação</button></div>';
    }
    if (encerradas.length) {
      var idE = idDet('relenc', dom, codigo);
      html += '<details class="tax-recolhivel" id="taxRelEncerradas" data-det="' + esc(idE) + '"' + detAberto(idE, false) + '><summary class="tax-recolhivel-cab">Relações encerradas (' + encerradas.length + ')</summary><ul class="tax-relacoes tax-relacoes--encerradas">' +
        encerradas.map(function (k) {
          var r = det.relacoes[k], e = r.encerrada;
          return '<li data-relacao="' + esc(k) + '">' + outro(r.de) + ' <em>' + esc(RELACAO_ROTULO[r.tipo] || r.tipo) + '</em> → ' + outro(r.para) + nota(r) +
            '<br><span class="tax-ajuda">Encerrada em ' + esc(fmtData(e.em)) + ' por ' + esc(e.por || '—') + ' — motivo: ' + esc(e.motivo || '—') + '</span></li>';
        }).join('') + '</ul></details>';
    }
    return html + '</section>';
  }
  function painelEncerrar(k) {
    var f = st.d.organizacional.encerrando;
    return '<div class="tax-confirma" id="taxPainelEncerrar" role="group" aria-label="Encerrar relação"><p><strong>Encerrar esta relação?</strong></p>' +
      '<p class="tax-ajuda">Ela não é apagada: continua registrada como encerrada, com o motivo. Uma relação idêntica não poderá ser criada de novo.</p>' +
      '<label for="taxE_motivo">Motivo *</label><textarea id="taxE_motivo" data-enc="motivo" rows="3" maxlength="' + MAX_MOTIVO + '">' + esc(f.motivo || '') + '</textarea>' +
      (f.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(f.erro) + '</p>' : '') +
      '<div class="tax-acoes"><button type="button" class="btn btn--sm tax-btn-perigo" data-tax="confirmar-encerrar"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : 'Encerrar relação') + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-relacao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
  }
  function formRelacao(dom, codigo) {
    var D = st.d[dom], f = D.relForm, alterar = f.modo === 'alterar';
    var outros = ordenaPor(chaves(D.conceitos).filter(function (k) { return k !== codigo && D.conceitos[k].ativo !== false; }).map(function (k) { return { k: k, nome: D.conceitos[k].nome || k }; }), 'nome');
    var h = '<div class="tax-form tax-form-relacao" id="taxFormRelacao" role="group" aria-label="' + (alterar ? 'Alterar relação' : 'Nova relação') + '">' +
      '<p class="tax-form-titulo"><strong>' + (alterar ? 'Alterar relação' : 'Nova relação') + '</strong></p>' +
      (alterar ? '<p class="tax-ajuda">Alterar = encerrar a relação atual (com o motivo) e criar a nova, numa gravação só. A atual continua registrada como encerrada.</p>' : '') +
      '<label for="taxR_direcao">Direção *</label><select id="taxR_direcao" data-rel="direcao"><option value="saida"' + (f.direcao !== 'entrada' ? ' selected' : '') + '>este conceito → outro</option><option value="entrada"' + (f.direcao === 'entrada' ? ' selected' : '') + '>outro → este conceito</option></select>' +
      '<label for="taxR_tipo">Tipo *</label><select id="taxR_tipo" data-rel="tipo"><option value="">— escolha —</option>' + TIPOS_RELACAO.map(function (t) { return '<option value="' + esc(t) + '"' + (f.tipo === t ? ' selected' : '') + '>' + esc(RELACAO_ROTULO[t]) + '</option>'; }).join('') + '</select>' +
      '<label for="taxR_outro">Outro conceito * <span class="tax-ajuda">(só conceitos ativos)</span></label><select id="taxR_outro" data-rel="outro"><option value="">— escolha —</option>' + outros.map(function (o) { return '<option value="' + esc(o.k) + '"' + (f.outro === o.k ? ' selected' : '') + '>' + esc(o.nome) + ' (' + esc(o.k) + ')</option>'; }).join('') + '</select>' +
      '<label for="taxR_nota">Nota</label><textarea id="taxR_nota" data-rel="nota" rows="2" maxlength="2000">' + esc(f.nota || '') + '</textarea>' +
      (alterar ? '<label for="taxR_motivo">Motivo da alteração *</label><textarea id="taxR_motivo" data-rel="motivo" rows="2" maxlength="' + MAX_MOTIVO + '">' + esc(f.motivo || '') + '</textarea>' : '') +
      (f.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(f.erro) + '</p>' : '') +
      '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="salvar-relacao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'SALVANDO…' : (alterar ? 'Encerrar a atual e criar a nova' : 'Criar relação')) + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-relacao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
    return h;
  }

  /* f) Histórico do conceito — recolhido por padrão, inclusive com 0 alterações */
  function renderHistorico(dom, codigo, det) {
    var html = '<section class="tax-sec tax-sec--historico" id="taxSecHistorico">';
    if (det.erros.auditoria) return html + '<p class="tax-recolhivel-cab tax-recolhivel-cab--fixo">Histórico</p><p class="tax-aviso-erro">Histórico indisponível agora.</p></section>';
    if (det.carregando && !chaves(det.auditoria).length) return html + '<p class="tax-recolhivel-cab tax-recolhivel-cab--fixo">Histórico</p><p class="loading-msg">Carregando histórico…</p></section>';
    var ev = ordenaPor(chaves(det.auditoria).map(function (k) { return Object.assign({ _chave: k }, det.auditoria[k]); }), 'dataHora').reverse();
    var id = idDet('hist', dom, codigo);
    html += '<details class="tax-recolhivel tax-hist" id="taxHistoricoConceito" data-det="' + esc(id) + '"' + detAberto(id, false) + '><summary class="tax-recolhivel-cab">' + esc(tituloHistorico(ev.length)) + '</summary>';
    if (!ev.length) html += '<p class="tax-ausencia">Nenhuma alteração registrada.</p>';
    else html += '<ul class="tax-hist-lista">' + ev.map(function (l) { return linhaHistoricoConceito(l, 'audd:' + dom + ':' + codigo + ':' + l._chave); }).join('') + '</ul>';
    return html + '</details></section>';
  }

  function renderDetalhe(dom) {
    var D = st.d[dom], codigo = D.selecionado;
    var html = '<section class="tax-detalhe" aria-live="polite" aria-label="Conceito selecionado">';
    html += '<button type="button" class="btn tax-voltar" data-tax="voltar-lista">← VOLTAR PARA A LISTA</button>';
    if (!codigo || !D.conceitos[codigo]) return html + '<p class="tax-ausencia">Escolha um conceito na lista.</p></section>';
    var c = D.conceitos[codigo], det = D.detalhe && D.detalhe.codigo === codigo ? D.detalhe : { carregando: true, fontes: {}, perfis: {}, relacoes: {}, auditoria: {}, erros: {} };
    html += '<p class="tax-area-rotulo">Conceito selecionado · ' + esc(DOMINIOS[dom].rotulo) + '</p>';
    html += '<h3 class="tax-titulo">' + esc(c.nome) + '</h3>';
    html += renderIdentificacao(dom, codigo);
    var bf = blocosFontes(dom, codigo, det);
    html += bf.definicao + bf.outras;
    html += renderPergunta(dom, codigo);
    if (dom === 'organizacional') { html += renderAtributos(dom, codigo, det); html += renderRelacoes(dom, codigo, det); }
    html += renderHistorico(dom, codigo, det);
    /* tela longa no celular: o mesmo "voltar" também no fim */
    html += '<div class="tax-voltar-rodape"><button type="button" class="btn" data-tax="voltar-lista">← VOLTAR PARA A LISTA</button></div>';
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

  /* ---------- histórico global (auditoria/_catalogo dos dois domínios) ----------
     Só leitura. As chaves de push crescem com o tempo, então orderByKey().limitToLast(n) pega os mais
     recentes sem índice nem mudança de regra. "Carregar mais" usa endAt(cursor): pede 1 a mais para saber se
     ainda existe página anterior, sem contador total. Nada é copiado para o histórico dos conceitos. */
  var HG_PAGINA = 25;
  var HG_TIPOS = { carga_inicial: 'Carga inicial', alteracao_atributo: 'Alteração de atributo', alteracao_relacao: 'Alteração de relação',
    alteracao_conceito: 'Alteração de conceito', alteracao_fonte: 'Alteração de fonte', definicao_vigente: 'Definição vigente', alteracao_perfil: 'Alteração de perfil', fonte_arquivada: 'Fonte arquivada', fonte_restaurada: 'Fonte restaurada',
    inativacao: 'Conceito inativado', reativacao: 'Conceito reativado', relacao_criada: 'Relação criada', relacao_encerrada: 'Relação encerrada' };
  function podeVerHG() { return ehAdmin() && adminPronto() && !st.opcoes.somenteLeitura; }
  function carregarHG(quais) {
    var H = st.hg;
    if (H.carregando || !podeVerHG()) return;
    var doms = ORDEM_DOMINIOS.filter(function (d) { return quais(H.doms[d]); });
    if (!doms.length) return;
    H.carregando = true; H.carregou = true;
    var faltam = doms.length;
    doms.forEach(function (d) {
      var x = H.doms[d], cursor = x.cursor, limite = HG_PAGINA + 1 + (cursor ? 1 : 0);
      x.estado = 'carregando'; x.erro = null;
      lerNo(RAIZ + '/' + d + '/auditoria/_catalogo', function (r) {
        if (!r.ok) { x.estado = 'erro'; x.erro = r.negado ? 'sem-acesso' : 'rede'; }
        else {
          var obj = r.valor || {};
          var ks = chaves(obj).sort();
          if (cursor) ks = ks.filter(function (k) { return k < cursor; });
          x.temMais = ks.length > HG_PAGINA;
          if (x.temMais) ks = ks.slice(ks.length - HG_PAGINA);
          if (ks.length) x.cursor = ks[0];
          x.estado = 'ok'; x.erro = null;
          var tem = {}; H.itens.forEach(function (i) { tem[i._dom + '/' + i._chave] = true; });
          ks.forEach(function (k) { if (!tem[d + '/' + k]) H.itens.push(Object.assign({ _dom: d, _chave: k }, obj[k])); });
          H.itens.sort(function (a, b) {
            var da = String(a.dataHora || ''), db_ = String(b.dataHora || '');
            return da === db_ ? (a._chave < b._chave ? 1 : -1) : (da < db_ ? 1 : -1);
          });
        }
        if (--faltam === 0) { H.carregando = false; contarCargasAntigas(); }
        render();
      }, function (ref) {
        var q = ref.orderByKey();
        if (cursor) q = q.endAt(cursor);
        return q.limitToLast(limite);
      });
    });
    render();
  }
  /* ---------- carga inicial: contagem POR DOMÍNIO ----------
     Linhas novas trazem `resumoDominio` (a contagem do próprio domínio, gravada na importação). As linhas
     ANTIGAS (antes desta correção) só têm o texto "Importação única: N conceitos, M fontes" com o TOTAL dos
     dois domínios — repetido igual nas duas linhas, o que fazia parecer que cada domínio recebeu tudo. A
     auditoria é só acréscimo (não se reescreve), e meta/cargaInicial.resumo dessas cargas também é só o total.
     Não existe, portanto, nenhum registro da contagem de cada domínio NO MOMENTO da carga. Opção honesta: não
     repetir o total como se fosse do domínio; mostrar a contagem ATUAL do domínio (lida agora, rotulada como
     "hoje") e deixar o texto original explicitamente marcado como total dos dois domínios juntos. */
  function ehCargaAntiga(e) { return e.tipo === 'carga_inicial' && !(e.resumoDominio && typeof e.resumoDominio === 'object'); }
  function contarCargasAntigas() {
    var H = st.hg;
    ORDEM_DOMINIOS.forEach(function (d) {
      if (H.contagem[d] && H.contagem[d].estado !== 'erro') return;
      if (!H.itens.some(function (i) { return i._dom === d && ehCargaAntiga(i); })) return;
      var C = H.contagem[d] = { estado: 'carregando', conceitos: 0, fontes: 0 }, pend = 2, falhou = false;
      function fim() { if (--pend > 0) return; C.estado = falhou ? 'erro' : 'ok'; render(); }
      lerNo(RAIZ + '/' + d + '/conceitos', function (r) { if (!r.ok) falhou = true; else C.conceitos = chaves(r.valor).length; fim(); });
      lerNo(RAIZ + '/' + d + '/fontes', function (r) {
        if (!r.ok) falhou = true;
        else { var v = r.valor || {}; C.fontes = chaves(v).reduce(function (n, cod) { return n + chaves(v[cod]).length; }, 0); }
        fim();
      });
    });
  }
  function resumoCarga(e) {
    if (!ehCargaAntiga(e)) return textoContagem(e.resumoDominio);
    var C = st.hg.contagem[e._dom], hoje;
    if (!C || C.estado === 'carregando') hoje = 'Contando o que o domínio tem hoje…';
    else if (C.estado === 'erro') hoje = 'Não foi possível contar agora o que o domínio tem hoje.';
    else hoje = 'Hoje o domínio tem ' + plural(C.conceitos, 'conceito', 'conceitos') + ' e ' + plural(C.fontes, 'texto-fonte', 'textos-fonte') + ' (contagem atual, não a da carga).';
    return 'Contagem deste domínio na carga: não registrada (linha anterior à separação por domínio). ' + hoje +
      (e.valorNovo ? ' Registro original, com o total dos dois domínios juntos: "' + e.valorNovo + '".' : '');
  }
  function htmlHistoricoGlobal() {
    var H = st.hg;
    var voltar = function (onde) { return '<div class="tax-voltar-hg tax-voltar-hg--' + onde + '"><button type="button" class="btn" data-tax="voltar-dominio">← VOLTAR PARA OS CONCEITOS (' + esc(DOMINIOS[st.dominio].rotulo.toUpperCase()) + ')</button></div>'; };
    var h = '<section class="tax-hg" id="taxHistoricoGlobal">' + voltar('topo') + '<h4>Histórico global</h4>' +
      '<p class="tax-ajuda">Eventos que valem para o domínio inteiro (por exemplo, a carga inicial), do mais recente para o mais antigo. O histórico de cada conceito fica no próprio conceito.</p>';
    ORDEM_DOMINIOS.forEach(function (d) {
      var x = H.doms[d];
      if (x.estado !== 'erro') return;
      h += '<div class="tax-aviso-erro tax-hg-erro" data-dominio="' + d + '" role="alert"><p>' +
        (x.erro === 'sem-acesso' ? 'Taxonomia ' + esc(DOMINIOS[d].rotulo) + ': sem acesso ao histórico global.' : 'Não foi possível ler o histórico global do domínio ' + esc(DOMINIOS[d].rotulo) + '. Confira a conexão.') +
        '</p><button type="button" class="btn btn--sm" data-tax="hg-recarregar">TENTAR NOVAMENTE</button></div>';
    });
    if (H.carregando) h += '<p class="loading-msg" id="taxHgCarregando">Carregando o histórico global…</p>';
    var todosOk = ORDEM_DOMINIOS.every(function (d) { return H.doms[d].estado === 'ok'; });
    var maisHa = ORDEM_DOMINIOS.some(function (d) { return H.doms[d].estado === 'ok' && H.doms[d].temMais; });
    /* recolhido por padrão, como todo histórico; o número é o do que já foi lido (as páginas antigas vêm em "Carregar mais") */
    var cab = (H.carregando && !H.itens.length) ? 'Histórico — carregando…' : tituloHistorico(H.itens.length, maisHa ? ' carregadas (há mais antigas)' : '');
    h += '<details class="tax-recolhivel tax-hist" id="taxHgDetalhes" data-det="hg"' + detAberto('hg', false) + '><summary class="tax-recolhivel-cab">' + esc(cab) + '</summary>';
    if (!H.itens.length) {
      if (todosOk && !H.carregando) h += '<p class="tax-ausencia" id="taxHgVazio">Nenhum evento global registrado.</p>';
      return h + '</details>' + '</section>';
    }
    h += '<ul class="tax-hg-lista">' + H.itens.map(function (e) {
      var rotDom = DOMINIOS[e._dom] ? DOMINIOS[e._dom].rotulo : e._dom;
      var tipo = HG_TIPOS[e.tipo] || e.tipo || '—';
      if (e.tipo === 'carga_inicial') tipo += ' — ' + rotDom;
      var carga = e.tipo === 'carga_inicial', cortou = false, resumo;
      if (carga) resumo = resumoCarga(e);
      else {
        var ant = e.valorAnterior === null || e.valorAnterior === undefined || e.valorAnterior === '' ? null : valorAud(e.valorAnterior), nov = valorAud(e.valorNovo);
        cortou = (ant !== null && curto(ant) !== ant) || curto(nov) !== nov;
        resumo = (e.campo ? txt(e.campo) : '') + (ant !== null ? ': ' + curto(ant) + ' → ' + curto(nov) : (e.valorNovo ? ': ' + curto(nov) : ''));
      }
      return '<li class="tax-hg-item" data-dominio="' + esc(e._dom) + '" data-chave="' + esc(e._chave) + '" data-datahora="' + esc(e.dataHora || '') + '">' +
        '<div class="tax-hg-topo"><span class="tax-hg-quando">' + esc(fmtData(e.dataHora)) + '</span> ' + selo(rotDom) + ' <strong class="tax-hg-tipo">' + esc(tipo) + '</strong></div>' +
        '<div class="tax-hg-resumo">' + esc(resumo || '—') + '</div>' +
        '<div class="tax-hg-meta">por ' + esc(autorAud(e.usuario)) + ' · escopo: ' + (e.conceito ? 'conceito ' + esc(e.conceito) : 'domínio ' + esc(rotDom) + ' (inteiro)') + '</div>' +
        detalhesAud(e, 'hgd:' + e._dom + ':' + e._chave, cortou) + '</li>';
    }).join('') + '</ul>';
    if (maisHa) h += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="hg-mais"' + (H.carregando ? ' disabled' : '') + '>CARREGAR MAIS</button></div>';
    return h + '</details>' + voltar('rodape') + '</section>';
  }

  /* ---------- EXPORTAÇÃO para revisão (Excel) e diagnóstico (JSON) ----------
     SÓ LEITURA: nenhuma gravação no banco (nem auditoria). A raiz `taxonomia` não é legível em bloco (as
     regras liberam leitura por ramo), então a exportação lê cada ramo que existe nas regras, com o mesmo
     limite de espera do resto da tela; se QUALQUER ramo falhar ou não responder, nada é baixado e a tela diz
     qual ramo falhou — nunca um arquivo incompleto que pareça completo. O Excel usa a mesma biblioteca
     vendorizada (forca-agil/xlsx.mini.min.js, SheetJS) das exportações da Avaliação, carregada sob demanda. */
  var EXPORT_FORMATO = 'forca-agil/taxonomia-exportacao', EXPORT_VERSAO = 1;
  var RAMOS_EXPORT = [
    ['organizacional', 'conceitos'], ['organizacional', 'fontes'], ['organizacional', 'atributos'], ['organizacional', 'perfis'], ['organizacional', 'relacoes'], ['organizacional', 'auditoria'],
    ['arquitetural', 'conceitos'], ['arquitetural', 'fontes'], ['arquitetural', 'auditoria'],
    ['meta']
  ];
  function lerTudoParaExportar(cb) {
    var bruto = {}, falhas = [], pend = RAMOS_EXPORT.length;
    RAMOS_EXPORT.forEach(function (ramo) {
      lerNo(RAIZ + '/' + ramo.join('/'), function (r) {
        if (!r.ok) falhas.push(ramo.join('/') + ' (' + (r.negado ? 'sem acesso' : (r.erro === 'tempo esgotado' ? 'não respondeu em ' + Math.round(ESPERA.leitura / 1000) + ' s' : 'erro de leitura')) + ')');
        else if (r.valor !== null && r.valor !== undefined) {
          if (ramo.length === 1) bruto[ramo[0]] = r.valor;
          else { bruto[ramo[0]] = bruto[ramo[0]] || {}; bruto[ramo[0]][ramo[1]] = r.valor; }
        }
        if (--pend === 0) cb(falhas.length ? { ok: false, falhas: falhas } : { ok: true, bruto: bruto });
      });
    });
  }
  function dataArquivo() {
    var d = new Date(); function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function baixarBlob(blob, nome) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nome; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
  }
  function carregarXlsx(cb) {
    if (window.XLSX) { cb(); return; }
    var src = 'forca-agil/xlsx.mini.min.js';
    var ex = document.querySelector('script[data-avp-lib="' + src + '"]');
    if (ex) { ex.addEventListener('load', function () { cb(window.XLSX ? null : new Error('biblioteca indisponível')); }); ex.addEventListener('error', function () { cb(new Error('Falha ao carregar ' + src)); }); return; }
    var s = document.createElement('script');
    s.src = src; s.setAttribute('data-avp-lib', src);
    s.onload = function () { cb(window.XLSX ? null : new Error('biblioteca indisponível')); };
    s.onerror = function () { cb(new Error('Falha ao carregar ' + src)); };
    document.head.appendChild(s);
  }
  function txt(v) {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(txt).join(' | ');
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  }
  function simNao(b) { return b ? 'Sim' : 'Não'; }
  /* Linhas das abas (cabeçalhos em português). Pura: recebe o bruto lido, não lê nem grava nada. */
  function linhasExportacao(bruto) {
    var L = { Conceitos: [], Fontes: [], Atributos: [], Perfis: [], 'Relações': [], 'Histórico': [] };
    ORDEM_DOMINIOS.forEach(function (dom) {
      var B = bruto[dom] || {}, cs = B.conceitos || {}, fs = B.fontes || {};
      var nome = function (cod) { return (cs[cod] && cs[cod].nome) || ''; };
      ordenaPor(chaves(cs).map(function (k) { return Object.assign({ _cod: k }, cs[k]); }), 'ordem').forEach(function (c) {
        var vig = c.definicaoVigenteFonteId || '', fv = vig && fs[c._cod] ? fs[c._cod][vig] : null;
        var integ = '';
        if (vig && !fv) integ = 'ponteiro aponta para fonte inexistente';
        else if (fv && fv.situacao !== 'vigente') integ = 'fonte apontada não está vigente';
        else { var vv = validarVigencia(fs[c._cod] || {}, vig || null); if (!vv.ok) integ = vv.erro; }
        L.Conceitos.push([DOMINIOS[dom].rotulo, c._cod, c.nome || '', c.camada ? (CAMADA_ROTULO[c.camada] || c.camada) : '', c.pai || '', c.pai ? nome(c.pai) : '',
          c.ativo === false ? 'Não' : 'Sim', SIT_DEFINICAO_ROTULO[c.situacaoDefinicao] || txt(c.situacaoDefinicao), fv ? fv.texto : '', vig, fv ? (fv.rotulo || '') : '', fv ? fv.contexto : '', fv ? fv.tipoRedacao : '',
          txt(c.ordem), listaCriterios(c).join(' | '), c.observacoes || '', c.perguntaDiscriminadora || '', txt(c.ordemDaPergunta), c.notaDeAplicacao || '',
          c.criadoEm || '', c.criadoPor || '', c.atualizadoEm || '', c.atualizadoPor || '', integ]);
      });
      chaves(fs).sort().forEach(function (cod) {
        ordenaPor(chaves(fs[cod] || {}).map(function (k) { return Object.assign({ _id: k }, fs[cod][k]); }), 'criadoEm').forEach(function (f) {
          var a = f.arquivamento || {};
          L.Fontes.push([DOMINIOS[dom].rotulo, cod, nome(cod), f._id, f.situacao || '', simNao(cs[cod] && cs[cod].definicaoVigenteFonteId === f._id), simNao(!!f.arquivada), f.rotulo || '', f.contexto || '', f.tipoRedacao || '', f.texto || '',
            f.criadoEm || '', f.criadoPor || '', a.motivo || '', a.justificativa || '', a.em || '', a.por || '']);
        });
      });
      if (dom === 'organizacional') {
        var atrs = B.atributos || {};
        ordenaPor(chaves(atrs).map(function (k) { return Object.assign({ _cod: k }, atrs[k]); }), 'ordem').forEach(function (a) {
          var perm = a.valoresPermitidos ? ordenaPor(chaves(a.valoresPermitidos).map(function (k) { return a.valoresPermitidos[k]; }), 'ordem').map(function (x) { return x.texto; }) : [];
          L.Atributos.push([DOMINIOS[dom].rotulo, a._cod, a.nome || '', GRUPO_ROTULO[a.grupo] || txt(a.grupo), txt(a.tipoValor), perm.join(' | '), txt(a.ordem), a.ativo === false ? 'Não' : 'Sim']);
        });
        var perfis = B.perfis || {};
        chaves(perfis).sort().forEach(function (cod) {
          chaves(perfis[cod] || {}).sort().forEach(function (atr) {
            var p = perfis[cod][atr] || {};
            L.Perfis.push([DOMINIOS[dom].rotulo, cod, nome(cod), atr, (atrs[atr] && atrs[atr].nome) || '', p.estado || '', p.valor || '', p.papel || '', p.origem || '', p.atualizadoEm || '']);
          });
        });
        var rel = B.relacoes || {};
        chaves(rel).sort().forEach(function (k) {
          var r = rel[k] || {};
          var en = r.encerrada || null;
          L['Relações'].push([DOMINIOS[dom].rotulo, k, r.de || '', nome(r.de), r.tipo || '', RELACAO_ROTULO[r.tipo] || '', r.para || '', nome(r.para), r.nota || '',
            en ? 'encerrada' : 'ativa', en ? en.em || '' : '', en ? en.por || '' : '', en ? en.motivo || '' : '']);
        });
      }
      var aud = B.auditoria || {}, evs = [];
      chaves(aud).forEach(function (esc_) {
        chaves(aud[esc_] || {}).forEach(function (k) { evs.push(Object.assign({ _escopo: esc_, _chave: k }, aud[esc_][k])); });
      });
      evs.sort(function (a, b) { var x = String(a.dataHora || ''), y = String(b.dataHora || ''); return x === y ? (a._chave < b._chave ? -1 : 1) : (x < y ? -1 : 1); });
      evs.forEach(function (e) {
        var extra = {};
        chaves(e).forEach(function (k) { if (['_escopo', '_chave', 'tipo', 'conceito', 'campo', 'valorAnterior', 'valorNovo', 'usuario', 'dataHora'].indexOf(k) === -1) extra[k] = e[k]; });
        L['Histórico'].push([DOMINIOS[dom].rotulo, e._escopo === '_catalogo' ? '(domínio inteiro)' : e._escopo, e._escopo === '_catalogo' ? '' : nome(e._escopo), e.dataHora || '',
          (e.usuario && e.usuario.nome) || '', (e.usuario && e.usuario.email) || '', e.tipo || '', HG_TIPOS[e.tipo] || '', txt(e.campo), txt(e.valorAnterior), txt(e.valorNovo), chaves(extra).length ? JSON.stringify(extra) : '', e._chave]);
      });
    });
    return L;
  }
  /* ---------- VISÃO CONSOLIDADA POR CONCEITO (Excel: 1ª aba; JSON: conceitosConsolidados) ----------
     Pura: recebe o bruto lido e devolve UMA entrada por conceito — lista plana, com o campo `dominio`, na ordem
     dos domínios da tela e, dentro de cada um, pela `ordem` do conceito. Tudo indexado pelo CÓDIGO; os nomes são
     os ATUAIS, só para leitura. "Fontes históricas" = todas as fontes do conceito que NÃO são a vigente apontada
     (em validação, histórica/contextual, placeholder, não localizado e arquivadas). Não lê nem grava nada. */
  function consolidarConceitos(bruto) {
    var lista = [];
    ORDEM_DOMINIOS.forEach(function (dom) {
      var B = bruto[dom] || {}, cs = B.conceitos || {}, fs = B.fontes || {}, atrs = B.atributos || {}, perfis = B.perfis || {}, rel = B.relacoes || {}, aud = B.auditoria || {};
      var nome = function (cod) { return (cs[cod] && cs[cod].nome) || null; };
      ordenaPor(chaves(cs).map(function (k) { return Object.assign({ _cod: k }, cs[k]); }), 'ordem').forEach(function (c) {
        var cod = c._cod, fontes = fs[cod] || {}, vigId = c.definicaoVigenteFonteId || null, fv = vigId && fontes[vigId] ? fontes[vigId] : null;
        var todas = ordenaPor(chaves(fontes).map(function (k) { return Object.assign({ id: k }, fontes[k]); }), 'criadoEm');
        var pf = perfis[cod] || {};
        var listaPerfis = ordenaPor(chaves(pf).map(function (a) {
          return Object.assign({ atributo: a, atributoNome: (atrs[a] && atrs[a].nome) || null, _ordem: atrs[a] && typeof atrs[a].ordem === 'number' ? atrs[a].ordem : 9999 }, pf[a]);
        }), '_ordem').map(function (p) { var q = Object.assign({}, p); delete q._ordem; return q; });
        var saida = [], entrada = [];
        chaves(rel).sort().forEach(function (k) {
          var r = rel[k] || {};
          if (r.de === cod) saida.push({ id: k, tipo: r.tipo || null, tipoRotulo: RELACAO_ROTULO[r.tipo] || null, para: r.para || null, paraNome: nome(r.para), nota: r.nota || null, encerrada: r.encerrada || null });
          if (r.para === cod) entrada.push({ id: k, de: r.de || null, deNome: nome(r.de), tipo: r.tipo || null, tipoRotulo: RELACAO_ROTULO[r.tipo] || null, nota: r.nota || null, encerrada: r.encerrada || null });
        });
        var evs = chaves(aud[cod] || {}).map(function (k) { return aud[cod][k] || {}; });
        var porTipo = {}, ultima = null;
        evs.forEach(function (e) {
          var t = e.tipo || '(sem tipo)';
          porTipo[t] = (porTipo[t] || 0) + 1;
          if (!ultima || String(e.dataHora || '') > String(ultima.dataHora || '')) ultima = e;
        });
        var integ = null;
        if (vigId && !fontes[vigId]) integ = 'ponteiro aponta para fonte inexistente';
        else { var vv = validarVigencia(fontes, vigId); if (!vv.ok) integ = vv.erro; }
        lista.push({
          dominio: dom, dominioRotulo: DOMINIOS[dom].rotulo, codigo: cod, nome: c.nome || null, ordem: typeof c.ordem === 'number' ? c.ordem : null,
          ativo: c.ativo !== false, situacaoDefinicao: c.situacaoDefinicao || null,
          camada: c.camada || null, camadaRotulo: c.camada ? (CAMADA_ROTULO[c.camada] || c.camada) : null,
          pai: c.pai ? { codigo: c.pai, nome: nome(c.pai) } : null,
          criterios: listaCriterios(c), perguntaDiscriminadora: c.perguntaDiscriminadora || null, ordemDaPergunta: typeof c.ordemDaPergunta === 'number' ? c.ordemDaPergunta : null,
          observacoes: c.observacoes || null, notaDeAplicacao: c.notaDeAplicacao || null,
          atualizadoEm: c.atualizadoEm || null, atualizadoPor: c.atualizadoPor || null,
          definicaoVigente: fv ? { texto: fv.texto || null, fonteId: vigId } : null,
          fonteVigente: fv ? Object.assign({ id: vigId }, fv) : null,
          fontesHistoricas: todas.filter(function (f) { return f.id !== vigId; }),
          perfis: listaPerfis,
          relacoesSaida: saida, relacoesEntrada: entrada,
          auditoria: { total: evs.length, ultimaAlteracaoEm: ultima ? ultima.dataHora || null : null, ultimaAlteracaoPor: ultima && ultima.usuario ? (ultima.usuario.email || ultima.usuario.nome || null) : null, porTipo: porTipo },
          integridadeVigencia: integ
        });
      });
    });
    return lista;
  }
  var ABA_CONSOLIDADA = 'Visão consolidada por conceito'; /* 30 caracteres: cabe no limite de 31 do Excel */
  var CAB_CONSOLIDADA = ['Domínio', 'Código', 'Nome', 'Ativo', 'Situação da definição', 'Camada / especialização', 'Conceito pai', 'Definição vigente',
    'ID da fonte vigente', 'Rótulo da fonte', 'Contexto', 'Tipo de redação', 'Critérios', 'Pergunta discriminadora', 'Observações', 'Nota de aplicação',
    'Atributos / perfil', 'Relações de saída', 'Relações de entrada', 'Fontes históricas (qtd.)', 'Alterações (qtd.)', 'Atualizado em', 'Atualizado por'];
  var LARG_CONSOLIDADA = [14, 16, 28, 8, 22, 20, 28, 70, 16, 22, 11, 16, 50, 44, 44, 44, 50, 44, 44, 12, 12, 20, 28];
  /* uma linha por conceito; vários valores na mesma célula vão um por linha (a aba tem quebra de linha) */
  /* relação encerrada nunca aparece como se estivesse ativa nas exportações */
  function encerradaTxt(r) { return r.encerrada ? ' [ENCERRADA em ' + String(r.encerrada.em || '').slice(0, 10) + ' — ' + (r.encerrada.motivo || '') + ']' : ''; }
  function linhasConsolidadas(lista) {
    return lista.map(function (k) {
      var fv = k.fonteVigente;
      return [k.dominioRotulo, k.codigo, k.nome || '', k.ativo ? 'Sim' : 'Não', SIT_DEFINICAO_ROTULO[k.situacaoDefinicao] || txt(k.situacaoDefinicao), k.camadaRotulo || '',
        k.pai ? k.pai.codigo + (k.pai.nome ? ' — ' + k.pai.nome : '') : '', fv ? fv.texto || '' : '', fv ? fv.id : '', fv ? fv.rotulo || '' : '', fv ? fv.contexto || '' : '', fv ? fv.tipoRedacao || '' : '',
        k.criterios.join('\n'), k.perguntaDiscriminadora || '', k.observacoes || '', k.notaDeAplicacao || '',
        k.perfis.map(function (p) { return (p.atributoNome || p.atributo) + ': ' + (p.estado === 'registrado' ? p.valor + ' (' + p.papel + ' · origem: ' + p.origem + ')' : p.estado); }).join('\n'),
        k.relacoesSaida.map(function (r) { return (r.tipoRotulo || r.tipo) + ' → ' + r.para + (r.paraNome ? ' — ' + r.paraNome : '') + (r.nota ? ' (' + r.nota + ')' : '') + encerradaTxt(r); }).join('\n'),
        k.relacoesEntrada.map(function (r) { return r.de + (r.deNome ? ' — ' + r.deNome : '') + ' ' + (r.tipoRotulo || r.tipo) + ' → este conceito' + (r.nota ? ' (' + r.nota + ')' : '') + encerradaTxt(r); }).join('\n'),
        k.fontesHistoricas.length, k.auditoria.total, k.atualizadoEm || '', k.atualizadoPor || ''];
    });
  }
  /* A SheetJS vendorizada (0.18.5, edição comunitária) grava larguras ('!cols') e autofiltro ('!autofilter'),
     mas NÃO grava painel congelado ('!freeze' é ignorado) nem estilo de célula (quebra de linha, negrito).
     Por isso o arquivo que ela gera é ajustado AQUI, com o leitor/gravador de ZIP da própria biblioteca
     (XLSX.CFB): toda aba ganha o cabeçalho congelado (painel "frozen"), em negrito e com quebra de linha, e as
     abas pedidas ganham colunas fixas e quebra de linha em todas as células. Nenhum valor de célula é tocado —
     só a vista e o estilo. Arquivo fora do formato esperado: LANÇA (quem chama baixa o arquivo sem o ajuste e
     diz isso na tela). abas: [{ colunasFixas, quebrar }], na ordem das abas. */
  function ajustarXlsx(X, dados, abas) {
    var z = X.CFB.read(dados, { type: 'array' });
    var dec = new TextDecoder('utf-8'), enc = new TextEncoder();
    function ler(caminho) {
      var f = X.CFB.find(z, caminho);
      if (!f || !f.content) throw new Error('não encontrei ' + caminho + ' no arquivo gerado');
      return { f: f, xml: dec.decode(f.content instanceof Uint8Array ? f.content : new Uint8Array(f.content)) };
    }
    function gravarXml(r, xml) { r.f.content = enc.encode(xml); r.f.size = r.f.content.length; }
    var est = ler('/xl/styles.xml'), sx = est.xml;
    var mf = /<fonts count="(\d+)">([\s\S]*?)<\/fonts>/.exec(sx), mx = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(sx);
    if (!mf || !mx) throw new Error('styles.xml fora do formato esperado');
    var fonteNegrito = +mf[1], xfCorpo = +mx[1], xfCab = xfCorpo + 1;
    sx = sx.replace(mf[0], '<fonts count="' + (fonteNegrito + 1) + '">' + mf[2] + '<font><b/><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>');
    sx = sx.replace(mx[0], '<cellXfs count="' + (xfCorpo + 2) + '">' + mx[2] +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="' + fonteNegrito + '" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>');
    gravarXml(est, sx);
    abas.forEach(function (o, i) {
      var r = ler('/xl/worksheets/sheet' + (i + 1) + '.xml'), x = r.xml;
      var col = o.colunasFixas || 0, canto = String.fromCharCode(65 + col) + '2', painel = col ? 'bottomRight' : 'bottomLeft';
      if (x.indexOf('<sheetView workbookViewId="0"/>') === -1) throw new Error('sheetView fora do formato esperado (aba ' + (i + 1) + ')');
      x = x.replace('<sheetView workbookViewId="0"/>', '<sheetView workbookViewId="0"><pane ' + (col ? 'xSplit="' + col + '" ' : '') + 'ySplit="1" topLeftCell="' + canto + '" activePane="' + painel + '" state="frozen"/>' +
        '<selection pane="' + painel + '" activeCell="' + canto + '" sqref="' + canto + '"/></sheetView>');
      x = x.replace(/<c r="([A-Z]+)(\d+)"(?![^>]*\ss=")/g, function (m, c, linha) {
        if (linha === '1') return m + ' s="' + xfCab + '"';
        return o.quebrar ? m + ' s="' + xfCorpo + '"' : m;
      });
      gravarXml(r, x);
    });
    return X.CFB.write(z, { fileType: 'zip', type: 'array' });
  }
  var CABECALHOS_EXPORT = {
    Conceitos: ['Domínio', 'Código', 'Nome', 'Camada / especialização', 'Pai (código)', 'Pai (nome)', 'Ativo', 'Situação da definição', 'Definição vigente (texto)', 'Fonte vigente (id)', 'Fonte vigente (rótulo)', 'Fonte vigente (contexto)', 'Fonte vigente (tipo de redação)',
      'Ordem', 'Critérios', 'Observações', 'Pergunta discriminadora', 'Ordem da pergunta', 'Nota de aplicação', 'Criado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Integridade da vigência'],
    Fontes: ['Domínio', 'Conceito (código)', 'Conceito (nome)', 'Fonte (id)', 'Situação', 'É a definição vigente', 'Arquivada', 'Rótulo', 'Contexto', 'Tipo de redação', 'Texto', 'Criada em', 'Criada por', 'Motivo do arquivamento', 'Justificativa do arquivamento', 'Arquivada em', 'Arquivada por'],
    Atributos: ['Domínio', 'Código', 'Nome', 'Grupo', 'Tipo de valor', 'Valores permitidos', 'Ordem', 'Ativo'],
    Perfis: ['Domínio', 'Conceito (código)', 'Conceito (nome)', 'Atributo (código)', 'Atributo (nome)', 'Estado', 'Valor', 'Papel', 'Origem', 'Atualizado em'],
    'Relações': ['Domínio', 'Relação (id)', 'De (código)', 'De (nome)', 'Tipo', 'Tipo (por extenso)', 'Para (código)', 'Para (nome)', 'Nota', 'Situação', 'Encerrada em', 'Encerrada por', 'Motivo do encerramento'],
    'Histórico': ['Domínio', 'Escopo (conceito)', 'Conceito (nome)', 'Data/hora', 'Autor (nome)', 'Autor (e-mail)', 'Tipo', 'Tipo (por extenso)', 'Campo', 'Valor anterior', 'Valor novo', 'Detalhes', 'Chave do evento']
  };
  function cabecalhoExport() {
    var u = usuarioAtual();
    return { formato: EXPORT_FORMATO, versaoFormato: EXPORT_VERSAO, exportadoEm: agora(), exportadoPor: { nome: u.nome, email: u.email } };
  }
  function exportar(formato) {
    if (!podeVerHG() || st.exp && (st.exp.estado === 'lendo' || st.exp.estado === 'gerando')) return;
    var exp = st.exp = { estado: 'lendo', formato: formato };
    render();
    lerTudoParaExportar(function (r) {
      if (st.exp !== exp) return;
      if (!r.ok) { exp.estado = 'erro'; exp.texto = 'Não foi possível ler a Taxonomia para exportar. Nada foi baixado. Ramo(s) com problema: ' + r.falhas.join('; ') + '. Confira a conexão e tente novamente.'; render(); return; }
      var cab = cabecalhoExport(), nome = 'Taxonomia_exportacao_' + dataArquivo();
      if (formato === 'json') {
        try {
          var doc = Object.assign({}, cab, {
            observacao: 'Nó "taxonomia" como foi lido (ramo a ramo, com as regras de leitura de admin), intacto em "taxonomia". "conceitosConsolidados" é uma VISÃO derivada dele: lista plana, um item por conceito, com o campo "dominio" (organizacional/arquitetural), indexada pelo código. Nada foi gravado durante a exportação.',
            conceitosConsolidados: consolidarConceitos(r.bruto),
            taxonomia: r.bruto
          });
          baixarBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), nome + '.json');
          exp.estado = 'ok'; exp.texto = 'JSON baixado (' + nome + '.json).';
        } catch (e) { console.error('[taxonomia] exportação JSON:', e); exp.estado = 'erro'; exp.texto = 'Não foi possível gerar o JSON. Nada foi baixado.'; }
        render(); return;
      }
      exp.estado = 'gerando'; render();
      /* a biblioteca vem do próprio site; se não carregar no prazo de leitura, avisa (nunca fica "Gerando…" calado) */
      var limiteXlsx = setTimeout(function () { if (st.exp !== exp || exp.estado !== 'gerando') return; exp.estado = 'erro'; exp.texto = 'O gerador de planilha não carregou em ' + Math.round(ESPERA.leitura / 1000) + ' s. Nada foi baixado. Confira a conexão e tente novamente.'; render(); }, ESPERA.leitura);
      carregarXlsx(function (erroCarga) {
        clearTimeout(limiteXlsx);
        if (st.exp !== exp || exp.estado !== 'gerando') return;
        if (erroCarga) { console.error('[taxonomia] exportação Excel:', erroCarga); exp.estado = 'erro'; exp.texto = 'Não foi possível carregar o gerador de planilha. Nada foi baixado. Confira a conexão e tente novamente.'; render(); return; }
        try {
          var X = window.XLSX, wb = X.utils.book_new(), L = linhasExportacao(r.bruto), consol = consolidarConceitos(r.bruto);
          var carga = (r.bruto.meta && r.bruto.meta.cargaInicial) || null;
          var abasAjuste = [];
          /* 1ª aba: uma linha por conceito, com o essencial para a revisão */
          var linhasC = linhasConsolidadas(consol), wsC = X.utils.aoa_to_sheet([CAB_CONSOLIDADA].concat(linhasC));
          wsC['!cols'] = LARG_CONSOLIDADA.map(function (w) { return { wch: w }; });
          wsC['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhasC.length, c: CAB_CONSOLIDADA.length - 1 } }) };
          X.utils.book_append_sheet(wb, wsC, ABA_CONSOLIDADA);
          abasAjuste.push({ colunasFixas: 3, quebrar: true });
          var sobre = [['Campo', 'Valor'], ['Formato', cab.formato], ['Versão do formato', cab.versaoFormato], ['Exportado em', cab.exportadoEm], ['Exportado por', cab.exportadoPor.nome + ' (' + cab.exportadoPor.email + ')'],
            ['Carga inicial feita em', carga ? txt(carga.feitaEm) : '(sem carga)'], ['Carga inicial feita por', carga ? txt(carga.feitaPor) : ''], ['Carga inicial — resumo registrado', carga ? txt(carga.resumo) : ''],
            ['Carga inicial — resumo por domínio', carga && carga.resumoPorDominio ? txt(carga.resumoPorDominio) : '(não registrado nesta carga)']];
          var wsS = X.utils.aoa_to_sheet(sobre); wsS['!cols'] = [{ wch: 34 }, { wch: 90 }];
          X.utils.book_append_sheet(wb, wsS, 'Exportação');
          abasAjuste.push({ colunasFixas: 0, quebrar: false });
          chaves(CABECALHOS_EXPORT).forEach(function (aba) {
            var cabA = CABECALHOS_EXPORT[aba], ws = X.utils.aoa_to_sheet([cabA].concat(L[aba]));
            ws['!cols'] = cabA.map(function (h) { return { wch: /Texto|Definição vigente \(texto\)|Valor|Nota|Critérios|Observações|Pergunta|Detalhes/.test(h) ? 60 : 22 }; });
            ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: L[aba].length, c: cabA.length - 1 } }) };
            X.utils.book_append_sheet(wb, ws, aba);
            abasAjuste.push({ colunasFixas: 0, quebrar: false });
          });
          var gerado = new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx' })), ajustado = null, semAjuste = '';
          try { ajustado = ajustarXlsx(X, gerado, abasAjuste); } catch (eAj) {
            /* o ajuste é só de vista/estilo: sem ele, os dados continuam completos — baixa assim e DIZ na tela */
            console.error('[taxonomia] ajuste do Excel (cabeçalho congelado / quebra de linha):', eAj);
            semAjuste = ' Atenção: a planilha saiu sem cabeçalho congelado e sem quebra de linha (o ajuste falhou); os dados estão completos.';
          }
          baixarBlob(new Blob([ajustado || gerado], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nome + '.xlsx');
          exp.estado = 'ok'; exp.texto = 'Excel baixado (' + nome + '.xlsx).' + semAjuste;
        } catch (e) { console.error('[taxonomia] exportação Excel:', e); exp.estado = 'erro'; exp.texto = 'Não foi possível gerar a planilha. Nada foi baixado.'; }
        render();
      });
    });
  }
  function htmlExportar() {
    if (!podeVerHG()) return '';
    var x = st.exp, ocupado = !!(x && (x.estado === 'lendo' || x.estado === 'gerando'));
    var h = '<section class="tax-exportar" id="taxExportar" aria-label="Exportar a Taxonomia"><p class="tax-exportar-titulo"><strong>Exportar a Taxonomia inteira</strong> <span class="tax-ajuda">(só leitura: nada é gravado). O Excel abre na aba “Visão consolidada por conceito”.</span></p>' +
      '<div class="tax-acoes tax-exportar-acoes"><button type="button" class="btn btn--sm" data-tax="exportar-excel" id="taxExportarExcel"' + (ocupado ? ' disabled' : '') + '>Baixar Excel (revisão)</button>' +
      '<button type="button" class="btn btn--sm" data-tax="exportar-json" id="taxExportarJson"' + (ocupado ? ' disabled' : '') + '>Baixar JSON (diagnóstico)</button></div>';
    if (x) {
      if (ocupado) h += '<p class="loading-msg" id="taxExportarStatus">' + (x.estado === 'lendo' ? 'Lendo a Taxonomia inteira…' : 'Gerando a planilha…') + '</p>';
      else h += '<p class="' + (x.estado === 'erro' ? 'tax-aviso-erro' : 'tax-ajuda') + '" id="taxExportarStatus" role="' + (x.estado === 'erro' ? 'alert' : 'status') + '">' + esc(x.texto) + '</p>';
    }
    return h + '</section>';
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
    /* AÇÕES GERAIS (a Taxonomia inteira: carga inicial, exportação, histórico global) ficam numa área própria,
       separada das ações do conceito selecionado (que ficam dentro do detalhe, em "Identificação" e nos cartões) */
    html += avisoProtecao();
    var globais = renderImportador() + htmlExportar();
    if (globais) html += '<section class="tax-globais" id="taxAcoesGerais" aria-label="Ações gerais da Taxonomia"><h4 class="tax-globais-titulo">Ações gerais da Taxonomia</h4>' +
      '<p class="tax-ajuda">Valem para a Taxonomia inteira (os dois domínios), não para um conceito.' + (podeVerHG() ? ' O histórico global fica na aba “Histórico global”, ao lado dos domínios.' : '') + '</p>' + globais + '</section>';
    html += '<div class="tax-dominios" role="tablist" aria-label="Domínio da Taxonomia">' + ORDEM_DOMINIOS.map(function (d) {
      var ativo = d === dom && st.aba === 'dominio';
      return '<button type="button" role="tab" class="tax-dominio' + (ativo ? ' tax-dominio--ativo' : '') + '" aria-selected="' + ativo + '" data-tax="dominio" data-dominio="' + d + '">' + esc(DOMINIOS[d].rotulo) + '</button>';
    }).join('') + (podeVerHG() ? '<button type="button" role="tab" class="tax-dominio' + (st.aba === 'historico' ? ' tax-dominio--ativo' : '') + '" aria-selected="' + (st.aba === 'historico') + '" data-tax="aba-historico">Histórico global</button>' : '') + '</div>';
    if (st.aba === 'historico' && podeVerHG()) { el.innerHTML = html + htmlHistoricoGlobal() + '</div>'; return; }
    html += '<p class="tax-pergunta" id="taxPergunta"><strong>' + esc(DOMINIOS[dom].titulo) + '</strong> · ' + esc(DOMINIOS[dom].pergunta) + '</p>';
    if (D.estado === 'carregando' || D.estado === 'ocioso') html += '<p class="loading-msg" id="taxCarregando">Carregando a Taxonomia…</p>';
    else if (D.estado === 'erro') html += '<div class="tax-aviso-erro" id="taxErro" role="alert"><p>Não foi possível carregar a Taxonomia agora. Confira a conexão.</p><button type="button" class="btn btn--sm" data-tax="recarregar">TENTAR NOVAMENTE</button></div>';
    else if (D.estado === 'sem-acesso') html += '<p class="tax-aviso-erro" id="taxSemAcesso" role="alert">Você não tem acesso a esta área.</p>';
    else if (!chaves(D.conceitos).length) {
      html += '<p class="tax-ausencia" id="taxVazio">' + (st.meta.estado === 'ok' && !st.meta.cargaFeita ? 'Nenhum conceito cadastrado: a carga inicial ainda não foi feita.' : 'Este domínio não tem conceitos cadastrados.') + '</p>';
    } else html += renderConceitosBase(dom) + '<div class="tax-wrap" data-vista="' + st.vista + '">' + renderLista(dom) + renderDetalhe(dom) + '</div>';
    el.innerHTML = html + '</div>';
  }

  /* ---------- eventos (delegados) ---------- */
  function valoresDe(dom, tipo, chave) {
    var D = st.d[dom], c = D.conceitos[D.selecionado] || {}, det = D.detalhe || {};
    if (tipo === 'conceito') return { nome: c.nome || '', observacoes: c.observacoes || '', perguntaDiscriminadora: c.perguntaDiscriminadora || '', notaDeAplicacao: c.notaDeAplicacao || '', criterios: listaCriterios(c).join('\n') };
    if (tipo === 'fonte') { var f = (det.fontes || {})[chave] || {}; return { rotulo: f.rotulo || '', texto: f.texto || '', contexto: f.contexto || 'PREVI', tipoRedacao: f.tipoRedacao || 'Conceito', situacao: f.situacao === 'vigente' ? 'vigente' : (f.situacao || 'histórica/contextual') }; }
    if (tipo === 'novaFonte') return { rotulo: '', texto: '', contexto: 'PREVI', tipoRedacao: 'Conceito', situacao: 'em validação' };
    var p = (det.perfis || {})[chave] || {};
    return { estado: p.estado || 'registrado', valor: p.valor || '', papel: p.papel || 'observado', origem: p.origem || '' };
  }
  function iniciaEdicao(tipo, chave) {
    var D = st.d[st.dominio];
    if (D.detalhe && D.detalhe.carregando && tipo !== 'conceito') { /* ainda carregando: espera */ }
    D.edicao = { tipo: tipo, chave: chave || D.selecionado, valores: valoresDe(st.dominio, tipo, chave), erro: null };
    D.confirmacao = null; D.arquivando = null; D.novaVersao = null; if (tipo === 'fonte') D.expandida = chave;
    render();
  }
  /* "Nova versão da definição": abre o MESMO formulário de "+ Adicionar texto-fonte", pré-preenchido com o
     texto, contexto, tipo de redação e rótulo da vigente. Salvar cria uma fonte NOVA (salvarFonte, caminho
     de sempre); a anterior não é tocada. A troca da definição é o "Usar como vigente" (tornarVigente). */
  function iniciaNovaVersao(fonteId) {
    var D = st.d[st.dominio], f = fontesAtuais(st.dominio)[fonteId];
    if (!f || f.situacao !== 'vigente' || f.arquivada) return;
    D.edicao = { tipo: 'novaFonte', chave: D.selecionado, baseFonteId: fonteId, erro: null,
      valores: { rotulo: f.rotulo || '', texto: f.texto || '', contexto: f.contexto || 'PREVI', tipoRedacao: f.tipoRedacao || 'Conceito', situacao: 'em validação' } };
    D.confirmacao = null; D.arquivando = null; D.novaVersao = null; D.expandida = null;
    render();
    var form = document.getElementById('taxFormFonte');
    if (form && form.scrollIntoView) form.scrollIntoView({ block: 'start' });
    var campo = document.getElementById('taxF_texto');
    if (campo && campo.focus) campo.focus({ preventScroll: true });
  }
  function aoClicar(ev) {
    var alvo = ev.target.closest('[data-tax]');
    if (!alvo || !raiz().contains(alvo)) return;
    var acao = alvo.getAttribute('data-tax'), dom = st.dominio, D = st.d[dom];
    if (acao === 'dominio') {
      var novo = alvo.getAttribute('data-dominio');
      if (novo === dom && st.aba === 'dominio') return;
      st.dominio = novo; st.aba = 'dominio'; st.vista = 'lista'; st.flash = null;
      if (st.d[novo].estado === 'ocioso') carregarDominio(novo); else render();
    } else if (acao === 'aba-historico') {
      if (!podeVerHG()) return;
      st.aba = 'historico'; st.flash = null;
      if (!st.hg.carregou) carregarHG(function () { return true; }); else render();
    } else if (acao === 'voltar-dominio') {
      /* volta do Histórico global para o domínio, com a lista e o conceito selecionado como estavam */
      st.aba = 'dominio'; st.flash = null;
      if (D.estado === 'ocioso') carregarDominio(dom); else render();
      var topo = raiz().querySelector('.tax-dominios'); if (topo && topo.scrollIntoView) topo.scrollIntoView({ block: 'start' });
    } else if (acao === 'hg-mais') { carregarHG(function (x) { return x.estado === 'ok' && x.temMais; }); }
    else if (acao === 'hg-recarregar') { carregarHG(function (x) { return x.estado === 'erro'; }); }
    else if (acao === 'exportar-excel') exportar('excel');
    else if (acao === 'exportar-json') exportar('json');
    else if (acao === 'recarregar') { carregarMeta(); carregarDominio(dom); }
    else if (acao === 'selecionar') {
      var cod = alvo.getAttribute('data-codigo');
      if (window.innerWidth <= 720) st.rolagemLista = window.pageYOffset || document.documentElement.scrollTop || 0;
      zerarDetConceito(); /* abrir um conceito (mesmo o mesmo, de novo) começa com os históricos fechados */
      D.selecionado = cod; D.edicao = null; D.confirmacao = null; D.arquivando = null; D.expandida = null; D.dica = false; D.arquivadasAbertas = false; D.novaVersao = null; D.inativando = null; D.relForm = null; D.encerrando = null; st.vista = 'detalhe'; st.flash = null;
      carregarDetalhe(dom, cod);
      var det = raiz().querySelector('.tax-detalhe'); if (det && det.scrollIntoView && window.innerWidth <= 720) det.scrollIntoView();
    } else if (acao === 'voltar-lista') {
      /* celular: volta à lista na MESMA posição, com o conceito escolhido marcado e à vista */
      st.vista = 'lista'; render();
      if (st.rolagemLista !== null && window.scrollTo) window.scrollTo(0, st.rolagemLista);
      var it = D.selecionado ? raiz().querySelector('.tax-item[data-codigo="' + String(D.selecionado).replace(/"/g, '') + '"]') : null;
      if (it && it.getBoundingClientRect && it.scrollIntoView) { var rr = it.getBoundingClientRect(); if (rr.top < 0 || rr.bottom > window.innerHeight) it.scrollIntoView({ block: 'center' }); }
    }
    else if (acao === 'fechar-flash') { st.flash = null; render(); }
    else if (acao === 'verificar-pendente') { var pp = st.pendente; if (pp && !pp.resolvido && !pp.verificando) { clearTimeout(pp.timerVerif); pp.tentativas = 0; verificarGravacao(pp); } }
    else if (acao === 'ver') { var idv = alvo.getAttribute('data-fonte'); D.expandida = D.expandida === idv ? null : idv; render(); }
    else if (acao === 'alternar-arquivadas') { D.arquivadasAbertas = !D.arquivadasAbertas; render(); }
    else if (!podeEditar() && acao !== 'cancelar-importacao') return;
    else if (acao === 'alterar-definicao') {
      /* Só leva o olhar até as fontes disponíveis. Não ordena, não sugere, não escolhe nada. */
      D.dica = true; st.detAbertos[idDet('outras', dom, D.selecionado)] = true; render();
      var disp = document.getElementById('taxFontesDisponiveis');
      if (disp) { if (disp.scrollIntoView) disp.scrollIntoView({ block: 'start' }); if (disp.focus) disp.focus({ preventScroll: true }); }
    }
    else if (acao === 'arquivar') { D.arquivando = { fonte: alvo.getAttribute('data-fonte'), motivo: '', justificativa: '', erro: null }; D.confirmacao = null; D.edicao = null; render(); }
    else if (acao === 'cancelar-arquivar') { D.arquivando = null; render(); }
    else if (acao === 'confirmar-arquivar') { if (!st.salvando) arquivarFonte(dom, D.selecionado, alvo.getAttribute('data-fonte')); }
    else if (acao === 'restaurar') { if (!st.salvando) restaurarFonte(dom, D.selecionado, alvo.getAttribute('data-fonte')); }
    else if (acao === 'editar-conceito') iniciaEdicao('conceito', D.selecionado);
    else if (acao === 'nova-fonte') iniciaEdicao('novaFonte', null);
    else if (acao === 'nova-versao') iniciaNovaVersao(alvo.getAttribute('data-fonte'));
    else if (acao === 'editar-fonte') iniciaEdicao('fonte', alvo.getAttribute('data-fonte'));
    else if (acao === 'editar-perfil') iniciaEdicao('perfil', alvo.getAttribute('data-atributo'));
    else if (acao === 'cancelar-edicao') { D.edicao = null; render(); }
    else if (acao === 'salvar-edicao') {
      var e = D.edicao; if (!e || st.salvando) return;
      if (e.tipo === 'conceito') salvarConceito(dom, D.selecionado);
      else if (e.tipo === 'fonte' || e.tipo === 'novaFonte') salvarFonte(dom, D.selecionado);
      else salvarPerfil(dom, D.selecionado);
    } else if (acao === 'tornar-vigente') { D.confirmacao = { fonte: alvo.getAttribute('data-fonte'), acao: 'tornar' }; D.arquivando = null; render(); }
    else if (acao === 'cancelar-confirmacao') { D.confirmacao = null; render(); }
    else if (acao === 'confirmar-vigente') { if (!st.salvando) tornarVigente(dom, D.selecionado, alvo.getAttribute('data-fonte')); }
    else if (acao === 'remover-vigencia') { D.confirmacao = { fonte: alvo.getAttribute('data-fonte'), acao: 'remover' }; render(); }
    else if (acao === 'confirmar-remocao') { if (!st.salvando) removerVigencia(dom, D.selecionado); }
    else if (acao === 'inativar') { D.inativando = { codigo: D.selecionado, motivo: '', erro: null }; D.edicao = null; D.confirmacao = null; D.arquivando = null; render(); }
    else if (acao === 'cancelar-inativar') { D.inativando = null; render(); }
    else if (acao === 'confirmar-inativar') { if (!st.salvando) inativarConceito(dom, D.selecionado); }
    else if (acao === 'reativar') { if (!st.salvando) reativarConceito(dom, D.selecionado); }
    else if (acao === 'ligacoes-recarregar') carregarLigacoes();
    else if (acao === 'nova-relacao') { D.relForm = { modo: 'nova', direcao: 'saida', tipo: '', outro: '', nota: '', erro: null }; D.encerrando = null; render(); }
    else if (acao === 'alterar-relacao') {
      var kr = alvo.getAttribute('data-relacao'), rr = D.detalhe && D.detalhe.relacoes[kr];
      if (!rr) return;
      var saidaR = rr.de === D.selecionado;
      D.relForm = { modo: 'alterar', base: kr, direcao: saidaR ? 'saida' : 'entrada', tipo: rr.tipo, outro: saidaR ? rr.para : rr.de, nota: rr.nota || '', motivo: '', erro: null }; D.encerrando = null; render();
    }
    else if (acao === 'encerrar-relacao') { D.encerrando = { chave: alvo.getAttribute('data-relacao'), motivo: '', erro: null }; D.relForm = null; render(); }
    else if (acao === 'cancelar-relacao') { D.relForm = null; D.encerrando = null; render(); }
    else if (acao === 'salvar-relacao') { if (!st.salvando) salvarRelacao(D.selecionado); }
    else if (acao === 'confirmar-encerrar') { if (!st.salvando) encerrarRelacao(D.selecionado); }
    else if (acao === 'previa-ligacoes') { st.cargaLig = { erro: null }; render(); }
    else if (acao === 'cancelar-ligacoes') { st.cargaLig = null; render(); }
    else if (acao === 'confirmar-ligacoes') { if (!st.salvando) registrarLigacoes(); }
    else if (acao === 'confirmar-importacao') confirmarImportacao();
    else if (acao === 'cancelar-importacao') { st.importacao = null; render(); }
  }
  function aoEditar(ev) {
    var el = ev.target;
    if (el.id === 'taxArquivo') { if (ev.type === 'change' && el.files && el.files[0]) escolherArquivo(el.files[0]); return; }
    var campo = el.getAttribute && el.getAttribute('data-campo');
    var D = st.d[st.dominio];
    var campoArq = el.getAttribute && el.getAttribute('data-arq');
    if (campoArq && D.arquivando) { D.arquivando[campoArq] = el.value; D.arquivando.erro = null; return; }
    var campoInat = el.getAttribute && el.getAttribute('data-inat');
    if (campoInat && D.inativando) { D.inativando[campoInat] = el.value; D.inativando.erro = null; return; }
    var campoEnc = el.getAttribute && el.getAttribute('data-enc');
    if (campoEnc && D.encerrando) { D.encerrando[campoEnc] = el.value; D.encerrando.erro = null; return; }
    var campoRel = el.getAttribute && el.getAttribute('data-rel');
    if (campoRel && D.relForm) { D.relForm[campoRel] = el.value; D.relForm.erro = null; return; }
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
    /* "toggle" não borbulha: captura, para guardar o aberto/fechado de cada recolhível (data-det) */
    el.addEventListener('toggle', function (ev) {
      var d = ev.target;
      if (d && d.getAttribute && d.getAttribute('data-det')) st.detAbertos[d.getAttribute('data-det')] = !!d.open;
    }, true);
  }

  /* Abre a área (ao entrar na aba). Reavalia o acesso; troca de usuário reinicia o estado. */
  function abrir(opcoes) {
    if (opcoes) st.opcoes = Object.assign({ somenteLeitura: false }, opcoes);
    if (st.opcoes.somenteLeitura) st.aba = 'dominio';
    var el = raiz();
    if (!el) return;
    ligar();
    var s = sessao();
    var email = s ? s.email : null;
    if (st.email !== email) {
      st.email = email; st.meta = { estado: 'ocioso', cargaFeita: false }; st.importacao = null; st.flash = null; st.vista = 'lista'; st.aba = 'dominio'; st.hg = novoHG(); st.exp = null; st.detAbertos = {}; st.rolagemLista = null; st.lig = { estado: 'ocioso', mapa: {} }; st.cargaLig = null;
      ORDEM_DOMINIOS.forEach(function (d) { st.d[d] = novoDominio(); });
    }
    if (!adminPronto()) {
      render();
      window.addEventListener('fa-admin-ready', function onAdm() { window.removeEventListener('fa-admin-ready', onAdm); abrir(); });
      return;
    }
    if (!ehAdmin()) { render(); return; }
    if (st.meta.estado === 'ocioso' || st.meta.estado === 'erro') carregarMeta();
    if (st.lig.estado === 'ocioso' || st.lig.estado === 'erro') carregarLigacoes();
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
      st: st, espera: ESPERA, leitores: LEITORES, carregarHG: carregarHG, lerTudoParaExportar: lerTudoParaExportar, linhasExportacao: linhasExportacao, consolidarConceitos: consolidarConceitos, carregarDominio: carregarDominio, carregarDetalhe: carregarDetalhe, tornarVigente: tornarVigente, arquivarFonte: arquivarFonte, restaurarFonte: restaurarFonte,
      removerVigencia: removerVigencia, salvarConceito: salvarConceito, salvarFonte: salvarFonte, salvarPerfil: salvarPerfil,
      carregarLigacoes: carregarLigacoes, previaLigacoes: previaLigacoes, registrarLigacoes: registrarLigacoes, inativarConceito: inativarConceito, reativarConceito: reativarConceito,
      salvarRelacao: salvarRelacao, encerrarRelacao: encerrarRelacao
    }
  };
})();
