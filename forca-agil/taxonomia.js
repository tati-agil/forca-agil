/* ============================================================
   Força Ágil — Taxonomia (window.faTaxonomia)

   Dicionário conceitual, em DOIS domínios fisicamente separados no banco e na tela, sem nenhuma
   relação automática entre eles:
     arquitetural   — "O que é o item?"                               (as camadas da Avaliação)
     organizacional — "Que tipo de estrutura organizacional é esta?"  (Linha, Área Especializada, CoE…;
                      Squad e Capítulo ficam na camada própria "Organização do trabalho")
   A Taxonomia DEFINE os conceitos; a Avaliação APLICA. Esta área não integra a Avaliação.

   Banco (database.rules.json, ramo `taxonomia`; só admin lê e escreve nesta 1ª versão):
     taxonomia/<dominio>/conceitos/<codigo>        nome, ordem, ativo, definicao (a ÚNICA vigente: texto, versao,
                                                    publicadaEm, publicadaPor), camada/pai (organizacional),
                                                    criterios, observacoes, perguntaDiscriminadora,
                                                    notaDeAplicacao, atualizadoEm/Por
     taxonomia/<dominio>/definicoes/<codigo>/v<n>  histórico imutável das publicações da definição
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
     posicionamento-classificacoes/<codigo>        a mesma ligação canônica para o motor de Posicionamento
                                                    Organizacional ↔ conceito ORGANIZACIONAL de mesmo código — só os
                                                    10 códigos do motor (faPosicionamentos.codigos()), só admin geral,
                                                    criada uma vez, nunca alterada nem apagada.
     posicionamento-classificacoes-auditoria/<codigo>/<id>   histórico dessa ligação (só acréscimo)

   GOVERNANÇA (Etapa 5) — tudo garantido pelas REGRAS do banco, não só pela tela:
     - conceito arquitetural com ligação em avaliacao-classificacoes NÃO pode ser inativado;
     - conceito organizacional com ligação em posicionamento-classificacoes NÃO pode ser inativado nem trocar
       A ⇄ trabalho (deixaria de ser um conceito de posicionamento com a ligação ativa);
     - inativar exige motivo (conceito.inativacao) e reativar fica registrado (conceito.reativacao); os dois
       apontam (auditoriaId) para a linha de auditoria NOVA gravada na mesma operação — sem histórico, o banco recusa;
     - relação (organizacional): criada com histórico nas DUAS pontas (mesma chave/operacaoId) e depois só pode
       ser ENCERRADA (motivo, data, autor) — nunca alterada nem apagada; "Alterar" = encerrar a antiga + criar a
       nova na mesma gravação; relação idêntica a uma encerrada não pode ser criada de novo (reabrir: backlog);
     - camada (organizacional): "Tipo organizacional" (A) e "Organização do trabalho" (trabalho) só trocam entre si,
       por "Alterar camada", com motivo (conceito.camadaAlteracao) apontando para a auditoria NOVA da mesma gravação
       (tipo alteracao_camada); conceito com pai ou com FILHOS ATIVOS não troca — os filhos ativos são provados pelo banco
       com o índice reverso organizacional/filhos/<pai>/<filho> (só filho ativo e coerente com conceito.pai; inativar
       tira a entrada e reativar recoloca, na mesma gravação) e a marca meta/indiceFilhos;
       sem a marca, a troca é recusada. Código, definição e relações não mudam.

   DEFINIÇÃO OFICIAL — modelo simplificado (aprovado em 2026-10-15), igual nos dois domínios: cada conceito tem UMA
   definição vigente (conceito.definicao), que evolui por versões. "Atualizar definição" publica a versão anterior + 1
   numa gravação só (definição + histórico definicoes/<c>/v<n> + auditoria), montada por taxonomia-definicao.js; as
   regras conferem a sequência (duas publicações concorrentes ou um clique repetido: só uma entra). Não há mais fontes,
   situação de fonte, rótulo, tipo de redação nem promoção manual: o modelo antigo foi arquivado pela migração
   (.github/scripts/migracao-taxonomia-definicoes.js) em taxonomia-arquivo-migracao, só para consulta do histórico.

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
  var CAMADA_ROTULO = { A: 'Tipo organizacional', B: 'Especialização', C: 'Subespecialização', trabalho: 'Organização do trabalho', auxiliar: 'Conceito auxiliar' };
  /* "Alterar camada" só troca entre estas duas: estruturas de posicionamento (A) × organização do trabalho. */
  var CAMADAS_TROCAVEIS = { A: 'trabalho', trabalho: 'A' };
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
  /* Motivos do arquivamento lógico (lista FECHADA — a mesma das regras do banco). */

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
  function novoDominio() { return { comparando: false, compararCom: null, adminAba: 'conteudo', estado: 'ocioso', conceitos: {}, atributos: {}, selecionado: null, detalhe: null, edicao: null, confirmacao: null, expandida: null, arquivando: null, arquivadasAbertas: false, dica: false, novaVersao: null, inativando: null, camadaMudando: null, relForm: null, encerrando: null }; }
  var st = {
    exp: null, /* exportação em andamento/resultado: { estado: lendo|gerando|ok|erro, formato, texto } */
    dominio: 'organizacional', espaco: 'catalogo', busca: '', email: null, raiz: null, opcoes: { somenteLeitura: false },
    meta: { estado: 'ocioso', cargaFeita: false }, indiceFilhos: { estado: 'ocioso', existe: false }, importacao: null, flash: null, salvando: false,
    vista: 'lista', aba: 'dominio', /* aba: 'dominio' (lista + detalhe) ou 'historico' (histórico global) */
    hg: novoHG(),
    /* ligações da Avaliação (avaliacao-classificacoes): 'ocioso'|'carregando'|'ok'|'erro'|'sem-acesso'.
       "Ainda não sei" NUNCA vira "não está ligado": sem 'ok', nada que dependa da ligação é gravado. */
    lig: { estado: 'ocioso', mapa: {} }, cargaLig: null,
    /* ligações do Posicionamento Organizacional (posicionamento-classificacoes): mesmos estados, domínio organizacional */
    ligPos: { estado: 'ocioso', mapa: {} }, cargaLigPos: null,
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
      if (D.selecionado && !D.conceitos[D.selecionado]) { D.selecionado = null; D.detalhe = null; st.vista = 'lista'; if (st.espaco === 'admin' && st.dominio === dom) st.espaco = 'catalogo'; }
      render();
    }
    lerNo(RAIZ + '/' + dom + '/conceitos', function (r) { if (!r.ok) falha = falha || r; else D.conceitos = r.valor || {}; fim(); });
    if (org) lerNo(RAIZ + '/' + dom + '/atributos', function (r) { if (!r.ok) falha = falha || r; else D.atributos = r.valor || {}; fim(); });
    render();
  }

  function carregarDetalhe(dom, codigo) {
    var D = st.d[dom];
    var det = D.detalhe = { codigo: codigo, carregando: true, versoes: {}, arquivo: {}, perfis: {}, relacoes: {}, auditoria: {}, erros: {} };
    var org = dom === 'organizacional';
    var pend = org ? 5 : 3;
    function recebe(campo, r, transforma) {
      if (D.detalhe !== det) return;
      if (!r.ok) det.erros[campo] = r.negado ? 'sem-acesso' : 'erro';
      else det[campo] = transforma ? transforma(r.valor) : (r.valor || {});
      if (--pend === 0) { det.carregando = false; }
      render();
    }
    lerNo(RAIZ + '/' + dom + '/definicoes/' + codigo, function (r) { recebe('versoes', r); });
    /* textos do modelo antigo (só existem depois da migração): sem eles, o histórico anterior mostra os rótulos da auditoria */
    lerNo('taxonomia-arquivo-migracao/' + dom + '/fontes/' + codigo, function (r) { recebe('arquivo', r.ok ? r : { ok: true, valor: {} }); });
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
    var k = chaves(caminhos).filter(function (c) { return /\/auditoria\/[^/]+\/[^/]+$/.test(c) || /^(avaliacao|posicionamento)-classificacoes-auditoria\/[^/]+\/[^/]+$/.test(c); })[0];
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
    D.edicao = null; D.atualizando = null; D.inativando = null; D.camadaMudando = null; D.relForm = null; D.encerrando = null; D.perfilLote = null;
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
  /* ATUALIZAR DEFINIÇÃO — publica a nova versão numa gravação só (definição + histórico + auditoria). A tela confere
     que a versão vigente não mudou desde que o fluxo foi aberto; o banco confere de novo (compare-and-set). */
  function publicarDefinicao(dom, codigo) {
    var D = st.d[dom], a = D.atualizando, c = conceitoAtual(dom, codigo), atual = c.definicao || null;
    if (!a || st.salvando) return;
    if ((atual ? atual.versao : 0) !== a.versaoBase) { a.etapa = 'editar'; a.erro = 'A definição foi alterada por outra pessoa enquanto você editava. Confira a definição atual antes de publicar.'; render(); return; }
    var r = window.faTaxonomiaDefinicao.payloadPublicacao({ dom: dom, codigo: codigo, atual: atual, novoTexto: a.texto, motivo: a.motivo, email: emailAutor(), agora: agora(), audKey: novaChave(caminhoAud(dom, codigo)) });
    if (!r.ok) { a.etapa = 'editar'; a.erro = r.erro; render(); return; }
    gravar(r.caminhos, function () { aposSalvar(dom, codigo, 'Nova definição publicada (versão ' + r.versao + '). A anterior ficou preservada no histórico.'); });
  }

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

  /* GERENCIAR PERFIL — salva de uma vez só os atributos alterados. Antes de gravar, relê o perfil no servidor: se outra
     pessoa mudou algum dos atributos alterados aqui, nada é gravado (concorrência). Um evento de auditoria por atributo
     alterado, tudo numa gravação. Clique repetido: o botão trava enquanto confere e grava. */
  function salvarPerfilLote(dom, codigo) {
    var D = st.d[dom], L = D.perfilLote;
    if (!L || L.codigo !== codigo || st.salvando || L.verificando) return;
    L.erro = null; L.erros = {};
    var mud = alteracoesPerfil(L);
    if (!mud.length) { L.erro = 'Nada foi alterado.'; render(); return; }
    mud.forEach(function (a) {
      var v = L.valores[a];
      if (ESTADOS.indexOf(v.estado) === -1) { L.erros[a] = 'Escolha o estado.'; return; }
      if (v.estado !== 'registrado') return;
      var valor = String(v.valor || '').trim();
      if (!valor) L.erros[a] = 'Estado "registrado" exige o valor.';
      else if (valor.length > 1000) L.erros[a] = 'O valor tem no máximo 1000 caracteres.';
      else if (PAPEIS.indexOf(v.papel) === -1 || ORIGENS.indexOf(v.origem) === -1) L.erros[a] = 'Estado "registrado" exige papel e origem.';
    });
    if (chaves(L.erros).length) { L.erro = 'Corrija ' + plural(chaves(L.erros).length, 'atributo indicado', 'atributos indicados') + '. Nada foi salvo.'; render(); return; }
    L.verificando = true; render();
    lerNo(RAIZ + '/' + dom + '/perfis/' + codigo, function (r) {
      if (D.perfilLote !== L) return;
      L.verificando = false;
      if (!r.ok) { L.erro = 'Não foi possível conferir o perfil no servidor agora. Nada foi salvo; tente de novo.'; render(); return; }
      var srv = r.valor || {};
      var conflito = mud.filter(function (a) { return JSON.stringify(srv[a] ? rotuloPerfilCompleto(srv[a]) : null) !== JSON.stringify(L.base[a]); });
      if (conflito.length) {
        L.erro = 'Outra pessoa alterou ' + conflito.map(function (a) { return (D.atributos[a] && D.atributos[a].nome) || a; }).join(', ') + ' enquanto você editava. Nada foi salvo: cancele, confira os valores atuais e edite de novo.';
        render(); return;
      }
      var caminhos = {}, base = RAIZ + '/' + dom, quando = agora();
      mud.forEach(function (a) {
        var f = perfilDoFormulario(L.valores[a]), dado = { estado: f.estado };
        if (f.estado === 'registrado') { dado.valor = f.valor; dado.papel = f.papel; dado.origem = f.origem; }
        dado.atualizadoEm = quando;
        caminhos[base + '/perfis/' + codigo + '/' + a] = dado;
        addAud(caminhos, dom, codigo, 'alteracao_perfil', (D.atributos[a] && D.atributos[a].nome) || a, L.base[a] ? textoPerfil(L.base[a]) : null, textoPerfil(dado));
      });
      marcaConceito(caminhos, dom, codigo);
      gravar(caminhos, function () { aposSalvar(dom, codigo, mud.length === 1 ? '1 atributo salvo.' : mud.length + ' atributos salvos.'); });
    });
  }
  /* ---------- GOVERNANÇA (Etapa 5): ligações da Avaliação, inativação, relações ----------
     Cada operação = UM update multipath com o dado + a(s) linha(s) de auditoria. As regras do banco exigem
     que o dado aponte (auditoriaId) para a auditoria NOVA da mesma operação: a tela não é a única barreira. */
  /* Ligação canônica por domínio: arquitetural ↔ motor da Avaliação (avaliacao-classificacoes, catálogo
     CAMADAS via faClassificacoes); organizacional ↔ motor de Posicionamento (posicionamento-classificacoes,
     catálogo do motor via faPosicionamentos). Nenhuma lista de códigos aqui: vem sempre do catálogo do motor. */
  var LIG_CFG = {
    arquitetural: { estado: 'lig', carga: 'cargaLig', no: 'avaliacao-classificacoes', aud: 'avaliacao-classificacoes-auditoria',
      catalogo: function () { var C = window.faClassificacoes; return C && C.codigos ? C.codigos() : []; } },
    organizacional: { estado: 'ligPos', carga: 'cargaLigPos', no: 'posicionamento-classificacoes', aud: 'posicionamento-classificacoes-auditoria',
      catalogo: function () { var P = window.faPosicionamentos; return P && P.codigos ? P.codigos() : []; } }
  };
  var NO_LIG = LIG_CFG.arquitetural.no, NO_LIG_AUD = LIG_CFG.arquitetural.aud;
  var MAX_MOTIVO = 500;
  function domLig(dom) { return dom === 'organizacional' ? 'organizacional' : 'arquitetural'; }
  function L_(dom) { return st[LIG_CFG[domLig(dom)].estado]; }
  function carregarLigacoes(dom) {
    var cfg = LIG_CFG[domLig(dom)];
    var marca = st[cfg.estado].leitura = {};
    st[cfg.estado].estado = 'carregando';
    lerNo(cfg.no, function (r) {
      if (st[cfg.estado].leitura !== marca) return;
      if (!r.ok) st[cfg.estado] = { estado: r.negado ? 'sem-acesso' : 'erro', mapa: {} };
      else st[cfg.estado] = { estado: 'ok', mapa: r.valor || {} };
      render();
    });
  }
  function codigosMotor(dom) { return LIG_CFG[domLig(dom)].catalogo(); }
  /* Código que pode ter ligação neste domínio (no organizacional, só os 10 do motor de Posicionamento). */
  function codigoLigavel(dom, codigo) { return dom === 'arquitetural' || codigosMotor(dom).indexOf(codigo) !== -1; }
  function estaLigado(codigo, dom) { var L = L_(dom); return !!(L.estado === 'ok' && L.mapa[codigo]); }
  function mensagemLigado(c, dom) {
    if (domLig(dom) === 'organizacional') return 'Este conceito está ligado ao posicionamento "' + ((c && c.nome) || '') + '" do motor de Posicionamento Organizacional e não pode ser inativado enquanto essa ligação estiver ativa.';
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
    } else if (codigoLigavel(dom, codigo)) {
      if (st.ligPos.estado !== 'ok') return recusa('Não foi possível confirmar se este conceito está ligado ao Posicionamento Organizacional. Nada foi gravado. Tente novamente.');
      if (estaLigado(codigo, dom)) return recusa(mensagemLigado(c, dom));
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
    /* filho inativo sai do índice de filhos (só filho ATIVO impede o pai de trocar de camada) — mesma gravação */
    if (dom === 'organizacional' && c.pai) caminhos[RAIZ + '/' + dom + '/filhos/' + c.pai + '/' + codigo] = null;
    marcaConceito(caminhos, dom, codigo);
    addAudEm(caminhos, dom, codigo, k, 'inativacao', 'ativo', true, false, {
      motivo: motivo,
      filhosAtivos: af.filhos.length ? af.filhos.join(', ') : null,
      relacoesAbertas: af.relacoes.length ? af.relacoes.map(function (rk) { return textoRelacao(dom, D.detalhe.relacoes[rk]); }).join(' | ') : null
    });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Conceito inativado. Nada foi apagado: definição, histórico e relações continuam registrados.'); });
  }
  function reativarConceito(dom, codigo) {
    var c = conceitoAtual(dom, codigo);
    if (c.ativo !== false) return;
    var base = RAIZ + '/' + dom + '/conceitos/' + codigo, caminhos = {};
    var k = novaChave(caminhoAud(dom, codigo));
    caminhos[base + '/ativo'] = true;
    caminhos[base + '/inativacao'] = null;
    caminhos[base + '/reativacao'] = { em: agora(), por: emailAutor(), auditoriaId: k };
    /* reativado, volta ao índice de filhos — mesma gravação */
    if (dom === 'organizacional' && c.pai) caminhos[RAIZ + '/' + dom + '/filhos/' + c.pai + '/' + codigo] = true;
    marcaConceito(caminhos, dom, codigo);
    addAudEm(caminhos, dom, codigo, k, 'reativacao', 'ativo', false, true, { motivoAnterior: (c.inativacao && c.inativacao.motivo) || null });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Conceito reativado.'); });
  }

  /* Camada: só "Tipo organizacional" (A) ⇄ "Organização do trabalho". Motivo obrigatório; o conceito guarda a
     ÚLTIMA troca (camadaAlteracao) e o histórico guarda todas. Código, definição e relações não mudam. */
  /* Filhos ATIVOS: é o que o índice reverso guarda e o que as regras do banco conferem (filho inativo não bloqueia) */
  function filhosDe(dom, codigo) {
    var cs = st.d[dom].conceitos;
    return chaves(cs).filter(function (k) { return cs[k] && cs[k].pai === codigo && cs[k].ativo !== false; }).sort();
  }
  /* Índice reverso taxonomia/organizacional/filhos/<pai>/<filho> + marca taxonomia/meta/indiceFilhos: o banco não sabe
     procurar "quem aponta para mim"; com o índice, as REGRAS provam que um conceito não tem filhos. A marca nasce com
     a carga inicial (banco novo) ou pela construção única do workflow "Taxonomia — índice de filhos" (produção) —
     nunca pela tela. Sem ela, a troca de camada fica recusada (falha fechada). */
  function carregarIndiceFilhos() {
    st.indiceFilhos = { estado: 'carregando', existe: false }; render();
    lerNo(RAIZ + '/meta/indiceFilhos', function (r) {
      st.indiceFilhos = r.ok ? { estado: 'ok', existe: !!r.valor } : { estado: 'erro', existe: false };
      render();
    });
  }
  function bloqueioCamada(dom, codigo) {
    var c = conceitoAtual(dom, codigo);
    if (dom !== 'organizacional' || !CAMADAS_TROCAVEIS[c.camada]) return 'Só conceitos da camada "' + CAMADA_ROTULO.A + '" ou "' + CAMADA_ROTULO.trabalho + '" trocam de camada.';
    if (c.pai) return 'Este conceito tem conceito pai (' + c.pai + ') e por isso não troca de camada.';
    if (codigoLigavel(dom, codigo) && estaLigado(codigo, dom)) return 'Este conceito está ligado ao motor de Posicionamento Organizacional e por isso não troca de camada: deixaria de ser um conceito de posicionamento com a ligação ativa.';
    var I = st.indiceFilhos;
    if (I.estado !== 'ok') return null;  /* o painel mostra "Conferindo…"/erro à parte; alterarCamada recusa */
    if (!I.existe) return 'O índice de conceitos filhos ainda não foi construído neste banco, e sem ele o banco não consegue provar que um conceito não tem filhos. A troca de camada fica bloqueada até essa etapa de implantação (workflow "Taxonomia — índice de filhos").';
    var filhos = filhosDe(dom, codigo);
    if (filhos.length) return 'Este conceito tem conceitos filhos ativos (' + filhos.join(', ') + ') e por isso não troca de camada.';
    return null;
  }
  function alterarCamada(dom, codigo) {
    var c = conceitoAtual(dom, codigo), f = st.d[dom].camadaMudando;
    if (!f || f.codigo !== codigo) return;
    function recusa(msg) { f.erro = msg; render(); }
    if (st.indiceFilhos.estado !== 'ok') return recusa('Não foi possível conferir o índice de conceitos filhos. Nada foi gravado. Tente novamente.');
    if (codigoLigavel(dom, codigo) && st.ligPos.estado !== 'ok') return recusa('Não foi possível confirmar se este conceito está ligado ao Posicionamento Organizacional. Nada foi gravado. Tente novamente.');
    var bloq = bloqueioCamada(dom, codigo);
    if (bloq) return recusa(bloq);
    var motivo = String(f.motivo || '').trim();
    if (!motivo) return recusa('Informe o motivo da troca de camada.');
    if (motivo.length > MAX_MOTIVO) return recusa('O motivo pode ter até ' + MAX_MOTIVO + ' caracteres.');
    var de = c.camada, para = CAMADAS_TROCAVEIS[de];
    var base = RAIZ + '/' + dom + '/conceitos/' + codigo, caminhos = {};
    var k = novaChave(caminhoAud(dom, codigo));
    caminhos[base + '/camada'] = para;
    caminhos[base + '/camadaAlteracao'] = { de: de, para: para, motivo: motivo, em: agora(), por: emailAutor(), auditoriaId: k };
    marcaConceito(caminhos, dom, codigo);
    addAudEm(caminhos, dom, codigo, k, 'alteracao_camada', 'camada', CAMADA_ROTULO[de], CAMADA_ROTULO[para], { motivo: motivo, camadaDe: de, camadaPara: para });
    gravar(caminhos, function () { aposSalvar(dom, codigo, 'Camada alterada para "' + CAMADA_ROTULO[para] + '". Código, definição e relações continuam como estavam.'); });
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
  /* Antes de gravar uma relação, confere no servidor o estado das relações envolvidas (concorrência: outra pessoa pode
     ter criado a mesma relação ou encerrado a atual enquanto o formulário estava aberto). As regras do banco recusam do
     mesmo jeito; aqui a pessoa recebe a explicação, e nada é gravado. cb(erro|null). */
  function conferirRelacoesNoServidor(conferir, cb) {
    var pend = conferir.length, erro = null;
    if (!pend) { cb(null); return; }
    conferir.forEach(function (c) {
      lerNo(RAIZ + '/organizacional/relacoes/' + c.chave, function (r) {
        if (!erro) {
          if (!r.ok) erro = 'Não foi possível conferir as relações no servidor agora. Nada foi gravado; tente de novo.';
          else if (c.deveExistirAtiva && (!r.valor || r.valor.encerrada)) erro = 'A relação atual foi encerrada por outra pessoa enquanto você editava. Nada foi gravado.';
          else if (c.naoPodeExistir && r.valor) erro = r.valor.encerrada ? 'Esta relação já existiu e foi encerrada (por outra pessoa, enquanto você editava): ela não pode ser recriada. Nada foi gravado.' : 'Outra pessoa já registrou esta relação enquanto você editava. Nada foi gravado.';
        }
        if (--pend === 0) cb(erro);
      });
    });
  }
  function salvarRelacao(codigo) {
    var D = st.d.organizacional, f = D.relForm;
    if (!f || f.conferindo || st.salvando) return;
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
      if (!motivo) return recusa('Informe o motivo da substituição (a relação atual é encerrada com ele).');
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
    var conferir = [{ chave: chave, naoPodeExistir: true }];
    if (antiga) conferir.push({ chave: f.base, deveExistirAtiva: true });
    f.conferindo = true; f.erro = null; render();
    conferirRelacoesNoServidor(conferir, function (erroSrv) {
      if (D.relForm !== f) return;
      f.conferindo = false;
      if (erroSrv) { f.erro = erroSrv; render(); return; }
      gravar(caminhos, function () { D.relForm = null; aposSalvar('organizacional', codigo, antiga ? 'Relação substituída: a anterior foi encerrada e a nova, criada.' : 'Relação criada.'); });
    });
  }
  function encerrarRelacao(codigo) {
    var D = st.d.organizacional, f = D.encerrando, det = D.detalhe;
    if (!f || f.conferindo || st.salvando) return;
    function recusa(msg) { f.erro = msg; render(); }
    var r = det && det.relacoes[f.chave];
    if (!r || r.encerrada) return recusa('Esta relação não está mais ativa.');
    var motivo = String(f.motivo || '').trim();
    if (!motivo) return recusa('Informe o motivo do encerramento.');
    if (motivo.length > MAX_MOTIVO) return recusa('O motivo pode ter até ' + MAX_MOTIVO + ' caracteres.');
    var caminhos = {}, k = novaChave(caminhoAud('organizacional', r.de));
    caminhos[RAIZ + '/organizacional/relacoes/' + f.chave + '/encerrada'] = { motivo: motivo, em: agora(), por: emailAutor(), auditoriaId: k };
    audRelacao(caminhos, k, k, 'relacao_encerrada', r, f.chave, { motivo: motivo });
    f.conferindo = true; f.erro = null; render();
    conferirRelacoesNoServidor([{ chave: f.chave, deveExistirAtiva: true }], function (erroSrv) {
      if (D.encerrando !== f) return;
      f.conferindo = false;
      if (erroSrv) { f.erro = erroSrv.replace('A relação atual foi encerrada', 'Esta relação foi encerrada'); render(); return; }
      gravar(caminhos, function () { D.encerrando = null; aposSalvar('organizacional', codigo, 'Relação encerrada. Ela continua registrada, como encerrada.'); });
    });
  }

  /* Ligações da Avaliação — carga inicial controlada e idempotente: a prévia lê o banco; só entra o que falta. */
  function previaLigacoes(dom) {
    var A = st.d[domLig(dom)], L = L_(dom), itens = codigosMotor(dom).map(function (cod) {
      var c = A.conceitos[cod];
      if (L.mapa[cod]) return { codigo: cod, situacao: 'ligado' };
      if (!c) return { codigo: cod, situacao: 'sem-conceito' };
      if (c.ativo === false) return { codigo: cod, situacao: 'inativo' };
      return { codigo: cod, situacao: 'ligar' };
    });
    return itens;
  }
  function registrarLigacoes(dom) {
    var d = domLig(dom), cfg = LIG_CFG[d], P = st[cfg.carga];
    if (!P) return;
    if (st[cfg.estado].estado !== 'ok' || st.d[d].estado !== 'ok') { P.erro = 'Não foi possível conferir o estado atual das ligações. Nada foi gravado.'; render(); return; }
    var aLigar = previaLigacoes(d).filter(function (i) { return i.situacao === 'ligar'; });
    if (!aLigar.length) { P.erro = 'Não há ligação a registrar: nada foi gravado.'; render(); return; }
    var caminhos = {}, email = emailAutor(), quando = agora();
    aLigar.forEach(function (i) {
      var k = novaChave(cfg.aud + '/' + i.codigo);
      caminhos[cfg.no + '/' + i.codigo] = { registradoEm: quando, registradoPor: email, auditoriaId: k };
      caminhos[cfg.aud + '/' + i.codigo + '/' + k] = { tipo: 'ligacao_registrada', codigo: i.codigo, conceitoNome: st.d[d].conceitos[i.codigo].nome, usuario: usuarioAtual(), dataHora: quando };
    });
    gravar(caminhos, function () {
      st[cfg.carga] = null;
      st.flash = { erro: false, texto: aLigar.length + (aLigar.length === 1 ? ' ligação registrada.' : ' ligações registradas.') };
      carregarLigacoes(d);
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
    var t = plural(r.conceitos || 0, 'conceito', 'conceitos') + ' (' + (r.vigentes || 0) + ' com definição vigente)';
    if (r.atributos) t += ', ' + plural(r.atributos, 'atributo', 'atributos');
    if (r.perfis) t += ', ' + plural(r.perfis, 'valor de perfil', 'valores de perfil');
    if (r.relacoes) t += ', ' + plural(r.relacoes, 'relação', 'relações');
    return t;
  }
  /* Valida o arquivo e monta o update atômico. Genérico: nenhum conteúdo conceitual vive aqui. */
  function prepararImportacao(arq, conceitosExistentes) {
    var erros = [], avisos = [], caminhos = {}, resumo = { conceitos: 0, atributos: 0, perfis: 0, relacoes: 0, vigentes: 0, naoImportados: 0 };
    /* contagem POR DOMÍNIO: cada linha de auditoria da carga registra a do próprio domínio (não o total geral) */
    var porDominio = {};
    function conta(dom, campo) { resumo[campo]++; porDominio[dom] = porDominio[dom] || { conceitos: 0, atributos: 0, perfis: 0, relacoes: 0, vigentes: 0 }; porDominio[dom][campo]++; }
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
        if (org && CAMADA_ROTULO[c.camada] === undefined) erros.push(onde + ': camada inválida (A, B, C, trabalho ou auxiliar).');
        if (!org && c.camada !== undefined) erros.push(onde + ': o domínio arquitetural não tem camada.');
        if (c.pai !== undefined && (!org || !cs[c.pai])) erros.push(onde + ': "pai" inexistente no arquivo.');
        var fontes = (bloco.fontes && bloco.fontes[cod]) || [];
        if (!Array.isArray(fontes)) { erros.push(onde + ': "fontes" deve ser uma lista.'); fontes = []; }
        /* a definição vigente: o texto "definicao" do conceito ou, no formato antigo do arquivo, a ÚNICA fonte "vigente";
           os demais textos não entram (não eram definição) — só são contados na prévia */
        var defTexto = typeof c.definicao === 'string' && c.definicao.trim() ? c.definicao.trim() : null;
        var vigentesArq = fontes.filter(function (fx) { return fx && fx.situacao === 'vigente'; });
        if (vigentesArq.length > 1) erros.push(onde + ': mais de uma fonte vigente — só uma pode ser a definição.');
        else if (!defTexto && vigentesArq.length === 1) {
          if (typeof vigentesArq[0].texto !== 'string' || !vigentesArq[0].texto.trim()) erros.push(onde + ': a fonte vigente não tem texto.');
          else defTexto = vigentesArq[0].texto.trim();
        }
        fontes.forEach(function (fx) { if (!fx || fx.situacao !== 'vigente') resumo.naoImportados++; });
        if (defTexto) conta(dom, 'vigentes');
        var dadoC = { nome: c.nome.trim(), ordem: typeof c.ordem === 'number' ? c.ordem : (chaves(cs).indexOf(cod) + 1), ativo: c.ativo !== false,
          atualizadoEm: agoraIso, atualizadoPor: email };
        if (defTexto) {
          dadoC.definicao = { texto: defTexto, versao: 1, publicadaEm: agoraIso, publicadaPor: email };
          caminhos[base + '/definicoes/' + cod + '/v1'] = { texto: defTexto, versao: 1, publicadaEm: agoraIso, publicadaPor: email, origem: 'carga-inicial' };
        }
        /* conceito ATIVO com pai entra também no índice reverso filhos/<pai>/<filho> (as regras exigem, na mesma gravação) */
        if (org) { dadoC.camada = c.camada; if (c.pai) { dadoC.pai = c.pai; if (dadoC.ativo) caminhos[base + '/filhos/' + c.pai + '/' + cod] = true; } }
        ['observacoes', 'perguntaDiscriminadora', 'notaDeAplicacao'].forEach(function (k) { if (typeof c[k] === 'string' && c[k].trim() && (org || k === 'observacoes')) dadoC[k] = c[k]; });
        if (typeof c.ordemDaPergunta === 'number' && org) dadoC.ordemDaPergunta = c.ordemDaPergunta;
        if (Array.isArray(c.criterios) && c.criterios.length) {
          dadoC.criterios = {};
          c.criterios.forEach(function (t, i) { dadoC.criterios['k' + (i + 1)] = { texto: String(t), ordem: i + 1 }; });
        }
        caminhos[base + '/conceitos/' + cod] = dadoC;
        conta(dom, 'conceitos');
      });
      chaves(bloco.fontes || {}).forEach(function (cod) { if (!cs[cod]) erros.push(dom + ' › ' + cod + ': há textos para um conceito que não está no arquivo.'); });
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
      /* a carga já nasce com o índice de filhos completo: marca que ele existe */
      if (arq.dominios.organizacional) caminhos[RAIZ + '/meta/indiceFilhos'] = { criadoEm: agoraIso, criadoPor: email };
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

  function ordenados(D) {
    return ordenaPor(chaves(D.conceitos).map(function (k) { return Object.assign({ _codigo: k }, D.conceitos[k]); }), 'ordem');
  }
  function renderLista(dom) {
    var D = st.d[dom], lista = ordenados(D), q = normBusca(st.busca).trim();
    var html = '<nav class="tax-lista" aria-label="Conceitos da ' + esc(DOMINIOS[dom].titulo) + '">' +
      '<div class="tax-busca"><label class="tax-rotulo-campo" for="taxBusca">Buscar conceito</label><input type="search" id="taxBusca" value="' + esc(st.busca) + '" placeholder="Nome ou código" autocomplete="off"></div>';
    function item(c, nivel, comCaminho) {
      var ativo = D.selecionado === c._codigo, anc = comCaminho ? ancestrais(dom, c._codigo) : [];
      var marcas = (c.definicao ? '' : selo('sem definição', 'tax-selo--sem-def')) + (c.ativo === false ? selo('desativado') : '');
      return '<button type="button" class="tax-item tax-item--n' + nivel + (ativo ? ' tax-item--ativo' : '') + (c.ativo === false ? ' tax-item--inativo' : '') + '" data-tax="selecionar" data-codigo="' + esc(c._codigo) + '"' + (ativo ? ' aria-current="true"' : '') + '>' +
        '<span class="tax-item-nome">' + esc(c.nome) + '</span>' +
        (anc.length ? '<span class="tax-item-ctx">em ' + esc(anc.map(function (a) { return a.nome; }).join(' › ')) + '</span>' : '') +
        (marcas ? '<span class="tax-item-selos">' + marcas + '</span>' : '') + '</button>';
    }
    if (q) {
      var achados = lista.filter(function (c) { return normBusca(c.nome).indexOf(q) !== -1 || normBusca(c._codigo).indexOf(q) !== -1; });
      html += '<p class="tax-busca-resultado" id="taxBuscaResultado" role="status">' + (achados.length ? plural(achados.length, 'conceito encontrado', 'conceitos encontrados') : 'Nenhum conceito com esse nome ou código.') + '</p>';
      achados.forEach(function (c) { html += item(c, 0, true); });
      return html + '</nav>';
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
      lista.filter(function (c) { return c.camada === 'A' || (!c.pai && c.camada !== 'auxiliar' && c.camada !== 'trabalho'); }).forEach(function (c) { if (!visto[c._codigo]) desce(c, 0); });
      var trab = lista.filter(function (c) { return c.camada === 'trabalho' && !visto[c._codigo]; });
      if (trab.length) { html += '<p class="tax-lista-grupo">' + esc(CAMADA_ROTULO.trabalho) + '</p>'; trab.forEach(function (c) { if (!visto[c._codigo]) desce(c, 0); }); }
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
  /* Textos da área de integração por domínio. */
  var BASE_TXT = {
    arquitetural: { id: '', titulo: 'Conexão com a Avaliação', alvo: 'da Avaliação', itens: ['classificação conectada', 'classificações conectadas'],
      ajuda: 'A Avaliação utiliza os nomes e as definições oficiais destes conceitos. Enquanto estiverem vinculados, não podem ser inativados.',
      impacto: 'Enquanto o vínculo não for registrado, o conceito pode ser inativado e a Avaliação pode passar a mostrar o rótulo de contingência no lugar do nome oficial.',
      ver: 'Ver classificações conectadas', semConceito: 'sem conceito nesta Taxonomia — a Avaliação usa o rótulo de contingência', orfas: 'Vínculos sem classificação correspondente no motor: ',
      botao: 'Registrar vínculos da Avaliação…' },
    organizacional: { id: 'Pos', titulo: 'Conexão com o Posicionamento', alvo: 'do Posicionamento', itens: ['conceito conectado', 'conceitos conectados'],
      ajuda: 'O Posicionamento Organizacional utiliza os nomes e as definições oficiais destes conceitos. Enquanto estiverem vinculados, não podem ser inativados nem mudar entre "' + CAMADA_ROTULO.A + '" e "' + CAMADA_ROTULO.trabalho + '".',
      impacto: 'Enquanto o vínculo não for registrado, o conceito pode ser inativado ou mudar de camada, e o Posicionamento pode passar a mostrar o rótulo de contingência no lugar do nome oficial.',
      ver: 'Ver conceitos conectados', semConceito: 'sem conceito nesta Taxonomia — o Posicionamento usa o rótulo de contingência', orfas: 'Vínculos sem código correspondente no motor de Posicionamento: ',
      botao: 'Registrar vínculos do Posicionamento…' }
  };
  /* INTEGRAÇÃO COM A AVALIAÇÃO / COM O POSICIONAMENTO — comunica o ESTADO da integração (não é lista de configurações):
     tudo certo → só o resumo "N de N … conectados"; qualquer falha real (vínculo ausente, conceito ausente ou inativo,
     vínculo sem código no motor, leitura indisponível) → aviso destacado com o impacto, nunca um resumo positivo. Os nomes
     ficam em "Ver …" (recolhido); códigos e datas, nos detalhes administrativos. Nada aqui muda vínculo nem conceito:
     registrar vínculos continua com prévia e confirmação, como antes. */
  /* Avaliação da integração de um domínio com o seu motor — a MESMA para o bloco de Integridade e para o atalho do topo:
     cada código do catálogo do motor precisa de conceito existente, ativo e vinculado; vínculo sem código no motor é
     problema; leitura recusada ou falha (vínculos ou conceitos) é 'erro'; leitura em curso é 'conferindo'. "ok" só com
     tudo lido e completo. */
  function avaliarIntegracao(dom) {
    var cods = codigosMotor(dom), T = BASE_TXT[dom], D = st.d[dom], L = L_(dom);
    var ok = L.estado === 'ok' && D.estado === 'ok';
    var falhaLeitura = L.estado === 'erro' || L.estado === 'sem-acesso' || D.estado === 'erro' || D.estado === 'sem-acesso';
    var itens = cods.map(function (cod) {
      var c = D.conceitos[cod], l = ok ? L.mapa[cod] : null;
      var problema = !ok ? null : !c ? T.semConceito : c.ativo === false ? (l ? 'vinculado, mas o conceito está inativo' : 'conceito inativo — não pode ser vinculado') : !l ? 'sem vínculo registrado' : null;
      return { cod: cod, c: c, l: l, problema: problema };
    });
    var orfas = ok ? chaves(L.mapa).filter(function (k) { return cods.indexOf(k) === -1; }) : [];
    var problemas = itens.filter(function (i) { return i.problema; });
    var estado = !cods.length || falhaLeitura ? 'erro' : !ok ? 'conferindo' : problemas.length || orfas.length ? 'problema' : 'ok';
    return { estado: estado, ok: ok, itens: itens, orfas: orfas, problemas: problemas, conectados: itens.filter(function (i) { return i.l && !i.problema; }).length, total: cods.length };
  }
  function renderConceitosBase(dom) {
    var cods = codigosMotor(dom);
    if (!LIG_CFG[dom] || !cods.length) return '';
    var T = BASE_TXT[dom], cfg = LIG_CFG[dom];
    var D = st.d[dom], L = L_(dom), P = st[cfg.carga];
    var A = avaliarIntegracao(dom), ok = A.ok, itens = A.itens, orfas = A.orfas, problemas = A.problemas, conectados = A.conectados;
    var h = '<section class="tax-base tax-integracao" id="taxConceitosBase' + T.id + '" data-dominio-base="' + dom + '" data-estado="' + A.estado + '"><h4 class="tax-integracao-titulo">' + T.titulo + '</h4>' +
      '<p class="tax-ajuda" id="taxIntegracaoAjuda' + T.id + '">' + T.ajuda + '</p>';
    if (A.estado === 'erro') h += '<p class="tax-aviso-erro" id="taxLigacoesErro' + T.id + '" role="alert"><strong>Não foi possível conferir a conexão.</strong> ' + (L.estado === 'sem-acesso' ? 'Sem acesso aos vínculos ' + T.alvo + '.' : 'Não foi possível ler os vínculos ' + T.alvo + ' agora.') + ' <button type="button" class="btn btn--sm" data-tax="ligacoes-recarregar" data-dominio="' + dom + '">Tentar novamente</button></p>';
    else if (!ok) h += '<p class="loading-msg" id="taxIntegracaoResumo' + T.id + '" data-estado="conferindo">Conferindo a conexão…</p>';
    else if (!problemas.length && !orfas.length) h += '<p class="tax-integracao-ok" id="taxIntegracaoResumo' + T.id + '" data-estado="ok"><span class="tax-integracao-marca" aria-hidden="true">✓</span> ' + conectados + ' de ' + cods.length + ' ' + T.itens[1] + '</p>';
    else {
      h += '<div class="tax-aviso-erro tax-integracao-alerta" id="taxIntegracaoResumo' + T.id + '" data-estado="problema" role="alert"><p><strong>Conexão incompleta: ' + conectados + ' de ' + cods.length + ' ' + T.itens[1] + '.</strong> ' + T.impacto + '</p>';
      if (problemas.length) h += '<ul class="tax-integracao-problemas">' + problemas.map(function (i) { return '<li data-problema="' + esc(i.cod) + '"><strong>' + esc(i.c ? i.c.nome : i.cod) + '</strong> — ' + esc(i.problema) + '</li>'; }).join('') + '</ul>';
      if (orfas.length) h += '<p id="taxLigacoesOrfas' + T.id + '">' + T.orfas + orfas.map(function (k) { return '<code>' + esc(k) + '</code>'; }).join(', ') + '.</p>';
      h += '</div>';
    }
    if (ok && podeEditar() && D.estado === 'ok') {
      var prev = previaLigacoes(dom), aLigar = prev.filter(function (i) { return i.situacao === 'ligar'; });
      if (P) {
        h += '<div class="tax-previa" id="taxPreviaLigacoes' + T.id + '"><strong>Prévia — nada foi gravado ainda</strong><ul>' + prev.map(function (i) {
          var rot = { ligado: 'já vinculado (não muda)', ligar: 'será vinculado', 'sem-conceito': 'não pode ser vinculado — conceito ausente', inativo: 'não pode ser vinculado — conceito inativo' }[i.situacao];
          var c = D.conceitos[i.codigo];
          return '<li data-previa="' + esc(i.codigo) + '" data-situacao="' + i.situacao + '">' + esc(c ? c.nome : i.codigo) + ' <code>' + esc(i.codigo) + '</code> — ' + rot + '</li>';
        }).join('') + '</ul>' + (P.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(P.erro) + '</p>' : '') +
          '<div class="tax-acoes">' + (aLigar.length ? '<button type="button" class="btn btn--primary btn--sm" data-tax="confirmar-ligacoes" data-dominio="' + dom + '" id="taxConfirmarLigacoes' + T.id + '"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : 'Registrar ' + plural(aLigar.length, 'vínculo', 'vínculos')) + '</button>' : '') +
          '<button type="button" class="btn btn--sm" data-tax="cancelar-ligacoes" data-dominio="' + dom + '"' + (st.salvando ? ' disabled' : '') + '>' + (aLigar.length ? 'Cancelar' : 'Fechar') + '</button></div></div>';
      } else if (aLigar.length) {
        h += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="previa-ligacoes" data-dominio="' + dom + '" id="taxRegistrarLigacoesBtn' + T.id + '">' + T.botao + '</button></div>';
      }
    }
    /* com problema: diz se há correção autorizada nesta tela (registrar os vínculos que faltam) ou não — conceito ausente,
       inativo ou vínculo sem código no motor pedem decisão de curadoria, não uma ação automática */
    if (A.estado === 'problema') {
      var ligaveis = ok && D.estado === 'ok' ? previaLigacoes(dom).filter(function (i) { return i.situacao === 'ligar'; }).length : 0;
      var outros = problemas.filter(function (i) { return i.problema !== 'sem vínculo registrado'; }).length + orfas.length;
      h += '<p class="tax-ajuda tax-correcao" id="taxCorrecao' + T.id + '">' +
        (ligaveis && podeEditar() ? '<strong>Correção disponível:</strong> registrar ' + plural(ligaveis, 'vínculo que falta', 'vínculos que faltam') + ' (com prévia, antes de gravar).' : ligaveis ? '<strong>Correção:</strong> registrar os vínculos que faltam — ação da administração geral.' : '') +
        (outros ? (ligaveis ? ' ' : '') + '<strong>Sem correção automática</strong> para ' + plural(outros, 'item', 'itens') + ' (conceito ausente ou inativo, ou vínculo sem código no motor): pedem revisão na Taxonomia.' : '') + '</p>';
    }
    var idB = 'base:' + dom, idA = 'baseadm:' + dom;
    h += '<details class="tax-recolhivel tax-integracao-lista" id="taxIntegracaoLista' + T.id + '" data-det="' + idB + '"' + detAberto(idB, false) + '><summary class="tax-recolhivel-cab">' + T.ver + '</summary><ul class="tax-base-lista">';
    itens.forEach(function (i) {
      var marca = !ok ? '<span class="tax-ajuda">conferindo…</span>' : i.problema ? '<span class="tax-base-falta">' + esc(i.problema) + '</span>' : '<span class="tax-integracao-item-ok">conectado</span>';
      if (i.c) h += '<li class="tax-base-item" data-base="' + esc(i.cod) + '" data-ligado="' + (i.l ? '1' : '0') + '"><button type="button" class="tax-base-abrir" data-tax="selecionar" data-dominio="' + dom + '" data-codigo="' + esc(i.cod) + '"><span class="tax-base-nome">' + esc(i.c.nome) + '</span></button> ' + marca + '</li>';
      else h += '<li class="tax-base-item tax-base-item--sem" data-base="' + esc(i.cod) + '" data-ligado="' + (i.l ? '1' : '0') + '"><code class="tax-base-codigo">' + esc(i.cod) + '</code> ' + marca + '</li>';
    });
    h += '</ul>';
    if (ok) h += '<details class="tax-hist-detalhe tax-integracao-adm" id="taxIntegracaoAdm' + T.id + '" data-det="' + idA + '"' + detAberto(idA, false) + '><summary>Detalhes administrativos (códigos e datas)</summary><dl class="tax-dl tax-integracao-dl">' +
      itens.map(function (i) { return '<dt><code>' + esc(i.cod) + '</code></dt><dd>' + (i.l ? 'vínculo registrado em ' + esc(fmtData(i.l.registradoEm)) + ' por ' + esc(i.l.registradoPor || '—') : 'sem vínculo') + '</dd>'; }).join('') + '</dl></details>';
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
    chaves(st.detAbertos).forEach(function (k) { if (/^(hist|histini|histleg|audd|outras|atr|perfpend|ajpo|relenc):/.test(k)) delete st.detAbertos[k]; });
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
  /* nomes técnicos dos campos do conceito, só para mostrar (a auditoria guarda o nome técnico, intacto) */
  var CAMPO_ROTULO = { nome: 'Nome', observacoes: 'Observações', criterios: 'Critérios', perguntaDiscriminadora: 'Pergunta discriminadora', notaDeAplicacao: 'Nota de aplicação' };
  function tipoHistorico(l) {
    if (l.tipo === 'definicao_publicada') return l.versao > 1 ? 'Definição atualizada (versão ' + l.versao + ')' : 'Definição registrada (versão 1)';
    return HG_TIPOS[l.tipo] || l.tipo || '—';
  }
  function linhaHistoricoConceito(l, idDetalhe, extraHtml) {
    var ant = valorAud(l.valorAnterior), nov = valorAud(l.valorNovo);
    var cortou = curto(ant) !== ant || curto(nov) !== nov;
    return '<li class="tax-aud tax-hist-item" data-chave="' + esc(l._chave) + '" data-datahora="' + esc(l.dataHora || '') + '">' +
      '<div class="tax-hist-meta"><span class="tax-hist-quando">' + esc(fmtData(l.dataHora)) + '</span><span class="tax-hist-autor">por ' + esc(autorAud(l.usuario)) + '</span>' +
      '<strong class="tax-hist-tipo">' + esc(tipoHistorico(l)) + '</strong></div>' +
      '<p class="tax-hist-resumo">' + (l.campo && l.tipo !== 'definicao_publicada' ? '<strong>' + esc(CAMPO_ROTULO[l.campo] || txt(l.campo)) + '</strong>: ' : '') + esc(curto(ant)) + ' → ' + esc(curto(nov)) + '</p>' +
      (l.motivo ? '<p class="tax-hist-motivo"><strong>Motivo:</strong> ' + esc(txt(l.motivo)) + '</p>' : '') + (extraHtml || '') +
      detalhesAud(l, idDetalhe, cortou) + '</li>';
  }

  /* ---------- blocos da ADMINISTRAÇÃO do conceito (abas) ----------
     Conteúdo: identificação · definição oficial ("Atualizar definição") · pergunta, critérios e observações ("Editar
     informações") — Perfil ("Gerenciar perfil") — Relações registradas — Histórico e governança (histórico único,
     inativar, camada). A ficha do CATÁLOGO é outra (renderFicha). Tudo indexado pelo CÓDIGO do conceito. */
  /* IDENTIFICAÇÃO — código, camada, hierarquia, situação e proteções, numa área só; o nome muda em "Editar informações". */
  function renderIdentificacao(dom, codigo) {
    var D = st.d[dom], c = D.conceitos[codigo], org = dom === 'organizacional';
    var html = '<section class="tax-sec tax-sec--ident tax-cabecalho" id="taxSecIdent" aria-label="Identificação do conceito"><h4>Identificação</h4><div class="tax-ident-meta">';
    html += '<span class="tax-ident-item" id="taxCodigo"><span class="tax-ident-k">Código:</span> <code>' + esc(codigo) + '</code></span>';
    if (org) html += '<span class="tax-ident-item" id="taxIdentCamada"><span class="tax-ident-k">Camada:</span> ' + (c.camada ? esc(CAMADA_ROTULO[c.camada] || c.camada) : '<span class="tax-ausencia">sem camada</span>') + '</span>';
    html += '<span class="tax-ident-item" id="taxIdentSituacao"><span class="tax-ident-k">Situação:</span> ' + (c.ativo === false ? selo('desativado') : 'ativo') + '</span></div>';
    if (c.pai) {
      var pai = D.conceitos[c.pai];
      html += '<p class="tax-ident-linha" id="taxIdentPai"><span class="tax-ident-k">Conceito pai:</span> ' + esc(pai ? pai.nome : c.pai) + ' <code>' + esc(c.pai) + '</code>' +
        (pai ? '' : ' <span class="tax-aviso-erro">(não encontrado)</span>') + '</p>';
      html += '<p class="tax-caminho" id="taxIdentHierarquia"><span class="tax-ident-k">Hierarquia:</span> ' + caminhoDo(dom, codigo).map(esc).join(' › ') + '</p>';
    }
    if (org && codigoLigavel(dom, codigo) && estaLigado(codigo, dom)) html += '<p class="tax-ident-linha tax-protecao" id="taxIdentLigadoPos">' + selo('ligado ao Posicionamento', 'tax-selo--ligado') + ' <span class="tax-ajuda">Protegido: é um tipo de estrutura do Posicionamento Organizacional, por isso não pode ser inativado nem mudar de camada.</span></p>';
    if (dom === 'arquitetural' && estaLigado(codigo)) html += '<p class="tax-ident-linha tax-protecao" id="taxIdentLigado">' + selo('ligado à Avaliação', 'tax-selo--ligado') + ' <span class="tax-ajuda">Protegido: é uma classificação da Avaliação de Produto/Serviço, por isso não pode ser inativado.</span></p>';
    if (org && c.camadaAlteracao) html += '<p class="tax-ident-linha" id="taxIdentCamadaAlteracao"><span class="tax-ident-k">Camada alterada:</span> de ' + esc(CAMADA_ROTULO[c.camadaAlteracao.de] || c.camadaAlteracao.de) + ' para ' + esc(CAMADA_ROTULO[c.camadaAlteracao.para] || c.camadaAlteracao.para) + ' em ' + esc(fmtData(c.camadaAlteracao.em)) + ' por ' + esc(c.camadaAlteracao.por || '—') + ' — motivo: ' + esc(c.camadaAlteracao.motivo || '—') + '</p>';
    if (c.ativo === false && c.inativacao) html += '<p class="tax-ident-linha" id="taxIdentInativacao"><span class="tax-ident-k">Inativado:</span> ' + esc(fmtData(c.inativacao.em)) + ' por ' + esc(c.inativacao.por || '—') + ' — motivo: ' + esc(c.inativacao.motivo || '—') + '</p>';
    return html + '</section>';
  }
  /* ADMINISTRAÇÃO do conceito (inativar/reativar, trocar de camada): discreta, no fim, sem competir com as tarefas
     principais. Só aparece para quem pode gravar. */
  function renderAcoesConceito(dom, codigo) {
    var D = st.d[dom], c = D.conceitos[codigo], ed = podeEditar(), org = dom === 'organizacional';
    if (!ed) return '';
    var html = '<section class="tax-sec tax-sec--governanca" id="taxSecIdentAcoes" aria-label="Situação do conceito"><h4>Situação do conceito</h4>';
    html += '<div class="tax-acoes tax-acoes--conceito" id="taxAcoesConceito">' +
      (c.ativo === false ? '<button type="button" class="btn btn--sm" data-tax="reativar" id="taxReativarBtn"' + (st.salvando ? ' disabled' : '') + '>Reativar conceito</button>'
        : '<button type="button" class="btn btn--sm tax-btn-perigo" data-tax="inativar" id="taxInativarBtn">Inativar conceito</button>') +
      (org && CAMADAS_TROCAVEIS[c.camada] ? '<button type="button" class="btn btn--sm" data-tax="alterar-camada" id="taxCamadaBtn">Alterar camada</button>' : '') + '</div>' +
      '<p class="tax-ajuda">Inativar ou trocar de camada fica no histórico, com o motivo. Nada é apagado.</p>';
    if (D.inativando && D.inativando.codigo === codigo && c.ativo !== false) html += painelInativar(dom, codigo, c);
    if (D.camadaMudando && D.camadaMudando.codigo === codigo) html += painelCamada(dom, codigo, c);
    return html + '</section>';
  }

  /* Alterar camada: prévia (de → para), o que NÃO muda, motivo obrigatório. Bloqueado (só a explicação) quando
     o conceito tem pai ou filhos ativos. */
  function painelCamada(dom, codigo, c) {
    var f = D_(dom).camadaMudando, bloq = bloqueioCamada(dom, codigo), para = CAMADAS_TROCAVEIS[c.camada], I = st.indiceFilhos;
    var h = '<div class="tax-confirma tax-camada" id="taxPainelCamada" role="group" aria-label="Alterar camada">';
    if (I.estado !== 'ok') return h + '<p class="' + (I.estado === 'erro' ? 'tax-aviso-erro' : 'loading-msg') + '" id="taxCamadaIndice">' +
      (I.estado === 'erro' ? 'Não foi possível conferir o índice de conceitos filhos. Nada pode ser trocado até essa conferência.' : 'Conferindo o índice de conceitos filhos…') + '</p>' +
      '<div class="tax-acoes">' + (I.estado === 'erro' ? '<button type="button" class="btn btn--sm" data-tax="indice-recarregar">Tentar novamente</button>' : '') + '<button type="button" class="btn btn--sm" data-tax="cancelar-camada">Fechar</button></div></div>';
    if (!bloq && codigoLigavel(dom, codigo) && st.ligPos.estado !== 'ok') return h + '<p class="' + (st.ligPos.estado === 'erro' || st.ligPos.estado === 'sem-acesso' ? 'tax-aviso-erro' : 'loading-msg') + '" id="taxCamadaLigacao">' +
      (st.ligPos.estado === 'erro' || st.ligPos.estado === 'sem-acesso' ? 'Não foi possível conferir se este conceito está ligado ao Posicionamento Organizacional. Nada pode ser trocado até essa conferência.' : 'Conferindo se este conceito está ligado ao Posicionamento Organizacional…') + '</p>' +
      '<div class="tax-acoes">' + (st.ligPos.estado === 'erro' ? '<button type="button" class="btn btn--sm" data-tax="ligacoes-recarregar">Tentar novamente</button>' : '') + '<button type="button" class="btn btn--sm" data-tax="cancelar-camada">Fechar</button></div></div>';
    if (bloq) return h + '<p class="tax-aviso-erro" role="alert" id="taxCamadaBloqueada">' + esc(bloq) + '</p>' +
      '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="cancelar-camada">Fechar</button></div></div>';
    h += '<p><strong>Mover de "' + esc(CAMADA_ROTULO[c.camada]) + '" para "' + esc(CAMADA_ROTULO[para]) + '"?</strong></p>' +
      '<p class="tax-ajuda" id="taxCamadaPrevia">Muda só a camada. O código <code>' + esc(codigo) + '</code>, o nome, a definição, as relações e o histórico continuam como estão. A troca fica no histórico com o motivo e pode ser desfeita do mesmo jeito.</p>' +
      '<label for="taxC_motivo">Motivo *</label><textarea id="taxC_motivo" data-cam="motivo" rows="3" maxlength="' + MAX_MOTIVO + '">' + esc(f.motivo || '') + '</textarea>' +
      (f.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(f.erro) + '</p>' : '') +
      '<div class="tax-acoes"><button type="button" class="btn btn--sm btn--primary" data-tax="confirmar-camada"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : 'Alterar camada') + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-camada"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
    return h;
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
    if (dom === 'organizacional' && codigoLigavel(dom, codigo)) {
      var LP = st.ligPos;
      if (LP.estado !== 'ok') return h + '<p class="' + (LP.estado === 'carregando' || LP.estado === 'ocioso' ? 'loading-msg' : 'tax-aviso-erro') + '" id="taxInativarLigacao">' +
        (LP.estado === 'carregando' || LP.estado === 'ocioso' ? 'Conferindo se este conceito está ligado ao Posicionamento Organizacional…' : 'Não foi possível conferir se este conceito está ligado ao Posicionamento Organizacional. Nada pode ser inativado até essa conferência.') + '</p>' +
        '<div class="tax-acoes">' + (LP.estado === 'erro' ? '<button type="button" class="btn btn--sm" data-tax="ligacoes-recarregar">Tentar novamente</button>' : '') + '<button type="button" class="btn btn--sm" data-tax="cancelar-inativar">Fechar</button></div></div>';
      if (estaLigado(codigo, dom)) return h + '<p class="tax-aviso-erro" role="alert" id="taxInativarBloqueado">' + esc(mensagemLigado(c, dom)) + '</p>' +
        '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="cancelar-inativar">Fechar</button></div></div>';
    }
    var af = afetadosPor(dom, codigo), D = D_(dom);
    h += '<p><strong>Inativar este conceito?</strong></p><p class="tax-ajuda">Nada é apagado: o conceito, a definição, o histórico e as relações continuam registrados. A inativação fica no histórico com o motivo.</p>';
    if (dom === 'organizacional') {
      h += '<div id="taxInativarAfetados"><p class="tax-rotulo">Filhos ativos (' + af.filhos.length + ')</p>' + (af.filhos.length ? '<ul>' + af.filhos.map(function (k) { return '<li>' + esc(D.conceitos[k].nome) + ' <code>' + esc(k) + '</code></li>'; }).join('') + '</ul>' : '<p class="tax-ausencia">Nenhum.</p>');
      if (!af.pronto) h += '<p class="' + (af.erroRelacoes ? 'tax-aviso-erro' : 'loading-msg') + '">' + (af.erroRelacoes ? 'Não foi possível carregar as relações afetadas.' : 'Carregando relações afetadas…') + '</p>';
      else h += '<p class="tax-rotulo">Relações ativas (' + af.relacoes.length + ')</p>' + (af.relacoes.length ? '<ul>' + af.relacoes.map(function (k) { return '<li>' + esc(textoRelacao(dom, D.detalhe.relacoes[k])) + '</li>'; }).join('') + '</ul>' : '<p class="tax-ausencia">Nenhuma.</p>');
      if (af.filhos.length || af.relacoes.length) h += '<p class="tax-ajuda">Os filhos e as relações não são alterados: continuam como estão, apontando para um conceito inativo.</p>';
      h += '</div>';
    }
    h += '<label for="taxI_motivo">Motivo *</label><textarea id="taxI_motivo" data-inat="motivo" rows="3" maxlength="' + MAX_MOTIVO + '">' + esc(f.motivo || '') + '</textarea>' +
      (f.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(f.erro) + '</p>' : '') +
      '<div class="tax-acoes"><button type="button" class="btn btn--sm tax-btn-perigo" data-tax="confirmar-inativar"' + (st.salvando || !af.pronto ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : 'Inativar conceito') + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-inativar"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
    return h;
  }
  function D_(dom) { return st.d[dom]; }

  /* b) DEFINIÇÃO OFICIAL VIGENTE — um texto, a última atualização e UMA ação: "Atualizar definição" (editar → conferir →
     publicar). Logo abaixo, o histórico das publicações, recolhido por padrão. Sem fontes, rótulos, tipos de redação nem
     identificadores técnicos. */
  function renderDefinicao(dom, codigo, det) {
    var D = st.d[dom], c = D.conceitos[codigo] || {}, def = c.definicao || null, ed = podeEditar(), a = D.atualizando;
    var h = '<section class="tax-sec tax-sec--definicao" id="taxSecDefinicao" aria-label="Definição oficial vigente"><h4>Definição oficial vigente</h4>';
    if (def) h += '<p class="tax-definicao-texto" id="taxDefinicaoTexto">' + esc(def.texto) + '</p>' +
      '<p class="tax-def-atualizacao" id="taxDefAtualizacao"><strong>Última atualização:</strong> ' + esc(fmtData(def.publicadaEm)) + (def.publicadaPor ? ' · ' + esc(def.publicadaPor) : '') + ' · versão ' + esc(def.versao) + '</p>';
    else h += '<p class="tax-ausencia" id="taxSemDefinicao">Este conceito ainda não tem definição oficial vigente.</p>';
    if (ed && !(a && a.codigo === codigo)) h += '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="atualizar-definicao" id="taxAtualizarDefinicaoBtn"' + (st.salvando ? ' disabled' : '') + '>' + (def ? 'Atualizar definição' : 'Registrar definição') + '</button></div>';
    if (ed && a && a.codigo === codigo) h += a.etapa === 'conferir' ? painelConferir(def, a) : painelEditarDefinicao(def, a);
    return h + '</section>';
  }
  function painelEditarDefinicao(def, a) {
    return '<div class="tax-form" id="taxFormDefinicao" role="group" aria-label="Atualizar definição">' +
      '<p class="tax-form-titulo"><strong>' + (def ? 'Atualizar definição' : 'Registrar definição') + '</strong> <span class="tax-ajuda">— passo 1 de 2: editar</span></p>' +
      '<label for="taxDefNovo">' + (def ? 'Nova redação' : 'Texto da definição') + ' *</label><textarea id="taxDefNovo" data-def="texto" rows="6" maxlength="8000">' + esc(a.texto) + '</textarea>' +
      '<label for="taxDefMotivo">Motivo da alteração (opcional)</label><textarea id="taxDefMotivo" data-def="motivo" rows="2" maxlength="500">' + esc(a.motivo) + '</textarea>' +
      (a.erro ? '<p class="tax-aviso-erro" role="alert" id="taxDefErro">' + esc(a.erro) + '</p>' : '') +
      '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="conferir-definicao" id="taxDefConferirBtn">Continuar</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-definicao" id="taxDefCancelarBtn">Cancelar</button></div></div>';
  }
  function painelConferir(def, a) {
    return '<div class="tax-confirma" id="taxConferirDefinicao" role="group" aria-label="Conferir antes de publicar">' +
      '<p><strong>Conferir antes de publicar</strong> <span class="tax-ajuda">— passo 2 de 2</span></p>' +
      '<p class="tax-confirma-rotulo">Definição atual</p><p class="tax-confirma-texto" id="taxDefAtualConferir">' + (def ? esc(def.texto) : '<em>(nenhuma)</em>') + '</p>' +
      '<p class="tax-confirma-rotulo">Nova definição proposta</p><p class="tax-confirma-texto" id="taxDefNovaConferir">' + esc(String(a.texto).trim()) + '</p>' +
      (String(a.motivo || '').trim() ? '<p class="tax-confirma-rotulo">Motivo</p><p class="tax-confirma-texto" id="taxDefMotivoConferir">' + esc(String(a.motivo).trim()) + '</p>' : '') +
      '<p class="tax-confirma-aviso" role="note">Ao publicar, a nova definição passa a ser a vigente' + (def ? ' e a atual fica preservada no histórico' : '') + '. Autoria e data são registradas automaticamente.</p>' +
      '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="publicar-definicao" id="taxDefPublicarBtn"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Publicando…' : 'Publicar nova definição') + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="voltar-definicao"' + (st.salvando ? ' disabled' : '') + '>Voltar e editar</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-definicao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
  }
  /* C) COMO RECONHECER ESTE CONCEITO? — pergunta discriminadora, critérios, nota de aplicação e observações, editados
     AQUI MESMO ("Editar informações", que também altera o nome). Definição, pergunta, critérios e observações têm funções
     distintas: nada é fundido nem apagado só porque os textos se parecem. */
  function renderPergunta(dom, codigo) {
    var D = st.d[dom], c = D.conceitos[codigo], org = dom === 'organizacional', e = D.edicao, ed = podeEditar();
    var html = '<section class="tax-sec tax-sec--reconhecer" id="taxSecPergunta"><h4>Pergunta, critérios e observações</h4>';
    if (ed && e && e.tipo === 'conceito' && e.chave === codigo) return html + formConceito(dom, e) + '</section>';
    var crit = listaCriterios(c), algo = false;
    if (org && c.perguntaDiscriminadora) { algo = true; html += '<p class="tax-pergunta-disc"><span class="tax-rotulo">Pergunta</span> ' + esc(c.perguntaDiscriminadora) + '</p>'; }
    if (crit.length) { algo = true; html += '<p class="tax-rotulo">Critérios</p><ul class="tax-criterios">' + crit.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; }
    if (org && c.notaDeAplicacao) { algo = true; html += '<p class="tax-nota-aplicacao" id="taxNotaAplicacao"><span class="tax-rotulo">Nota de aplicação</span> ' + esc(c.notaDeAplicacao) + '</p>'; }
    if (c.observacoes) { algo = true; html += '<p class="tax-observacoes"><span class="tax-rotulo">Observações</span> ' + esc(c.observacoes) + '</p>'; }
    if (!algo) html += '<p class="tax-ausencia" id="taxReconhecerVazio">' + (org ? 'Pergunta discriminadora, critérios e observações ainda não registrados.' : 'Critérios e observações ainda não registrados.') + '</p>';
    else if (org && !c.perguntaDiscriminadora) html += '<p class="tax-ausencia">Pergunta discriminadora ainda não definida.</p>';
    if (ed) html += '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="editar-conceito" id="taxEditarInfoBtn">Editar informações</button></div>' +
      '<p class="tax-ajuda">' + (org ? 'Nome, pergunta, critérios, nota de aplicação e observações.' : 'Nome, critérios e observações.') + ' A definição muda em “Atualizar definição”.</p>';
    return html + '</section>';
  }
  function formConceito(dom, e) {
    var v = e.valores, org = dom === 'organizacional';
    var html = '<div class="tax-form" id="taxFormConceito"><p class="tax-form-titulo"><strong>Editar informações</strong></p><label for="taxF_nome">Nome *</label><input type="text" id="taxF_nome" data-campo="nome" value="' + esc(v.nome) + '" maxlength="120">';
    if (org) html += '<label for="taxF_perguntaDiscriminadora">Pergunta discriminadora</label><textarea id="taxF_perguntaDiscriminadora" data-campo="perguntaDiscriminadora" rows="3">' + esc(v.perguntaDiscriminadora) + '</textarea>';
    html += '<label for="taxF_criterios">Critérios (um por linha)</label><textarea id="taxF_criterios" data-campo="criterios" rows="4">' + esc(v.criterios) + '</textarea>';
    if (org) html += '<label for="taxF_notaDeAplicacao">Nota de aplicação</label><textarea id="taxF_notaDeAplicacao" data-campo="notaDeAplicacao" rows="4">' + esc(v.notaDeAplicacao) + '</textarea>';
    html += '<label for="taxF_observacoes">Observações</label><textarea id="taxF_observacoes" data-campo="observacoes" rows="3">' + esc(v.observacoes) + '</textarea>';
    if (e.erro) html += '<p class="tax-aviso-erro" role="alert">' + esc(e.erro) + '</p>';
    return html + '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="salvar-edicao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Salvando…' : 'Salvar') + '</button><button type="button" class="btn btn--sm" data-tax="cancelar-edicao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
  }

  /* D) PERFIL DO CONCEITO — na consulta, só os atributos efetivamente definidos e "N de M atributos definidos"; os ainda
     sem registro ficam num recolhível. UMA ação, "Gerenciar perfil": todos os atributos num formulário só, salvos de uma
     vez (só os que mudaram; um evento de auditoria por atributo alterado; nenhum registro vazio criado). Papel e Origem
     explicados por ajuda contextual, não repetidos em cada linha. "Definido" = há registro com estado decidido (tudo
     que não é "ainda não definido"). */
  function atributosOrdenados(D) { return ordenaPor(chaves(D.atributos).map(function (k) { return Object.assign({ _cod: k }, D.atributos[k]); }), 'ordem'); }
  function perfilDefinido(p) { return !!(p && p.estado && p.estado !== 'ainda não definido'); }
  function rotuloEstado(estado) { return estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : ''; }
  function ajudaPapelOrigem(idDetalhe) {
    return '<details class="tax-ajuda-ctx" id="taxLegenda" data-det="' + esc(idDetalhe) + '"' + detAberto(idDetalhe, false) + '><summary>O que significam Estado, Papel e Origem?</summary>' +
      '<p class="tax-ajuda"><strong>Estado</strong> — "registrado" tem valor; os demais registram a ausência (não consta na fonte, não aplicável, ainda não definido, fonte não localizada): ausência é estado, nunca campo vazio.</p>' +
      '<p class="tax-ajuda"><strong>Papel</strong> — <strong>definidor</strong>: ' + PAPEL_SIGNIFICADO['definidor'] + ' · <strong>típico</strong>: ' + PAPEL_SIGNIFICADO['típico'] + ' · <strong>observado</strong>: ' + PAPEL_SIGNIFICADO['observado'] + '.</p>' +
      '<p class="tax-ajuda"><strong>Origem</strong> — <strong>fonte</strong>: está nos textos-fonte · <strong>inferência</strong>: leitura nossa, não é dado de fonte nem decisão aprovada · <strong>decisão</strong>: escolha aprovada.</p>' +
      '<p class="tax-ajuda">Nenhum atributo, sozinho, define o tipo: eles descrevem e confirmam.</p></details>';
  }
  function valorPerfilHtml(p) {
    if (!p) return '<span class="tax-valor tax-valor--ausente">Sem registro</span>';
    if (p.estado !== 'registrado') return '<span class="tax-valor tax-valor--ausente">' + esc(rotuloEstado(p.estado)) + '</span>';
    return '<span class="tax-valor">' + esc(p.valor) + '</span> ' + selo('Papel: ' + p.papel, 'tax-selo--papel-' + String(p.papel).replace(/[^a-z]/gi, '')) +
      selo('Origem: ' + p.origem, 'tax-selo--origem tax-selo--origem-' + (ORIGEM_CLASSE[p.origem] || 'fonte'));
  }
  function gruposDeAtributos(atrs) {
    var por = {}, ordem = [];
    atrs.forEach(function (a) { var g = a.grupo || 'outros'; if (!por[g]) { por[g] = []; ordem.push(g); } por[g].push(a); });
    ordem.sort(function (x, y) { var ix = GRUPOS.indexOf(x), iy = GRUPOS.indexOf(y); return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy); });
    return ordem.map(function (g) { return { grupo: g, rotulo: GRUPO_ROTULO[g] || g, itens: por[g] }; });
  }
  /* PERFIL (Administração): os 13 atributos agrupados numa tabela (Estado, Valor, Papel, Origem), sem cartões; os sem
     registro aparecem aqui, para preenchimento — nunca no Catálogo. Edição: "Gerenciar perfil" (formulário integrado). */
  function renderAtributos(dom, codigo, det) {
    var D = st.d[dom], ed = podeEditar(), L = D.perfilLote && D.perfilLote.codigo === codigo ? D.perfilLote : null;
    var atrs = atributosOrdenados(D);
    var html = '<section class="tax-sec tax-sec--atributos" id="taxSecAtributos"><h4>Perfil do conceito</h4>';
    if (det.erros.perfis) return html + '<p class="tax-aviso-erro" id="taxPerfilErro">Não foi possível carregar o perfil agora.</p></section>';
    if (det.carregando && !chaves(det.perfis).length) return html + '<p class="loading-msg" id="taxPerfilCarregando">Carregando o perfil…</p></section>';
    if (!atrs.length) return html + '<p class="tax-ausencia">O catálogo de atributos está vazio.</p></section>';
    if (ed && L) return html + formPerfilLote(dom, codigo, det, atrs, L) + '</section>';
    var defs = atrs.filter(function (a) { return perfilDefinido(det.perfis[a._cod]); }).length;
    html += '<p class="tax-perfil-contagem" id="taxPerfilContagem">' + defs + ' de ' + atrs.length + ' atributos definidos</p>' + ajudaPapelOrigem(idDet('ajpo', dom, codigo));
    html += '<div class="tax-perfil-tabela-wrap"><table class="tax-perfil-tabela" id="taxPerfilTabela"><thead><tr><th scope="col">Atributo</th><th scope="col">Estado</th><th scope="col">Valor</th><th scope="col">Papel</th><th scope="col">Origem</th></tr></thead>';
    gruposDeAtributos(atrs).forEach(function (g) {
      html += '<tbody><tr class="tax-perfil-grupo"><th colspan="5" scope="colgroup">' + esc(g.rotulo) + '</th></tr>' + g.itens.map(function (a) {
        var p = det.perfis[a._cod], reg = p && p.estado === 'registrado';
        return '<tr class="tax-atributo' + (p ? '' : ' tax-atributo--vazio') + '" data-atributo="' + esc(a._cod) + '"><th scope="row">' + esc(a.nome) + '</th>' +
          '<td data-rotulo="Estado">' + (p ? esc(p.estado) : '<span class="tax-valor--ausente">sem registro</span>') + '</td>' +
          '<td data-rotulo="Valor">' + (reg ? esc(p.valor) : '—') + '</td><td data-rotulo="Papel">' + (reg ? esc(p.papel) : '—') + '</td><td data-rotulo="Origem">' + (reg ? esc(p.origem) : '—') + '</td></tr>';
      }).join('') + '</tbody>';
    });
    html += '</table></div>';
    if (ed) html += '<div class="tax-acoes"><button type="button" class="btn btn--sm btn--primary" data-tax="gerenciar-perfil" id="taxGerenciarPerfilBtn"' + (det.carregando ? ' disabled' : '') + '>Gerenciar perfil</button></div>';
    return html + '</section>';
  }
  /* valores do formulário integrado: '' = sem registro (só para atributo que ainda não tem registro) */
  function novoPerfilLote(codigo, det, atrs) {
    var base = {}, valores = {};
    atrs.forEach(function (a) {
      var p = det.perfis[a._cod] || null;
      base[a._cod] = p ? rotuloPerfilCompleto(p) : null;
      valores[a._cod] = { estado: p ? p.estado : '', valor: (p && p.valor) || '', papel: (p && p.papel) || 'observado', origem: (p && p.origem) || '' };
    });
    return { codigo: codigo, base: base, valores: valores, erros: {}, erro: null, verificando: false, confirmandoCancelar: false };
  }
  /* o que o formulário gravaria para o atributo (null = nada: sem registro) */
  function perfilDoFormulario(v) {
    if (!v.estado) return null;
    if (v.estado !== 'registrado') return { estado: v.estado, valor: null, papel: null, origem: null };
    return { estado: 'registrado', valor: String(v.valor || '').trim() || null, papel: v.papel || null, origem: v.origem || null };
  }
  function perfilAlterado(L, atr) { return JSON.stringify(perfilDoFormulario(L.valores[atr])) !== JSON.stringify(L.base[atr]); }
  function alteracoesPerfil(L) { return chaves(L.valores).filter(function (a) { return perfilAlterado(L, a); }); }
  function formPerfilLote(dom, codigo, det, atrs, L) {
    var n = alteracoesPerfil(L).length, ocupado = st.salvando || L.verificando;
    var h = '<div class="tax-form tax-perfil-lote" id="taxFormPerfilLote" role="group" aria-label="Gerenciar perfil">' +
      '<p class="tax-form-titulo"><strong>Gerenciar perfil</strong> <span class="tax-ajuda">— altere os atributos que quiser e salve uma vez. Só o que mudar é gravado.</span></p>' + ajudaPapelOrigem(idDet('ajpo', dom, codigo));
    var grupoAtual = null;
    gruposDeAtributos(atrs).reduce(function (l, g) { return l.concat(g.itens); }, []).forEach(function (a) {
      if ((a.grupo || 'outros') !== grupoAtual) { grupoAtual = a.grupo || 'outros'; h += '<p class="tax-perfil-grupo-titulo">' + esc(GRUPO_ROTULO[grupoAtual] || grupoAtual) + '</p>'; }
      var v = L.valores[a._cod], id = 'taxPL_' + a._cod, alt = perfilAlterado(L, a._cod), erro = L.erros[a._cod];
      var perm = a.valoresPermitidos ? ordenaPor(chaves(a.valoresPermitidos).map(function (k) { return a.valoresPermitidos[k]; }), 'ordem').map(function (x) { return x.texto; }) : null;
      h += '<fieldset class="tax-perfil-linha' + (alt ? ' tax-perfil-linha--alterada' : '') + (erro ? ' tax-perfil-linha--erro' : '') + '" data-atributo="' + esc(a._cod) + '"><legend>' + esc(a.nome) + (alt ? ' <span class="tax-perfil-alterado">alterado</span>' : '') + '</legend>' +
        '<label for="' + id + '_estado">Estado</label><select id="' + id + '_estado" data-perfil="estado" data-atributo="' + esc(a._cod) + '"' + (ocupado ? ' disabled' : '') + '>' +
        (L.base[a._cod] ? '' : '<option value=""' + (v.estado ? '' : ' selected') + '>— sem registro —</option>') +
        ESTADOS.map(function (s) { return '<option value="' + esc(s) + '"' + (v.estado === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>';
      if (v.estado === 'registrado') {
        h += '<label for="' + id + '_valor">Valor *</label>';
        if (perm && perm.length) h += '<select id="' + id + '_valor" data-perfil="valor" data-atributo="' + esc(a._cod) + '"' + (ocupado ? ' disabled' : '') + '><option value="">— escolha —</option>' + perm.map(function (t) { return '<option value="' + esc(t) + '"' + (t === v.valor ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + (v.valor && perm.indexOf(v.valor) === -1 ? '<option value="' + esc(v.valor) + '" selected>' + esc(v.valor) + '</option>' : '') + '</select>';
        else h += '<input type="text" id="' + id + '_valor" data-perfil="valor" data-atributo="' + esc(a._cod) + '" value="' + esc(v.valor) + '" maxlength="1000"' + (ocupado ? ' disabled' : '') + '>';
        h += '<div class="tax-form-linha"><div><label for="' + id + '_papel">Papel</label><select id="' + id + '_papel" data-perfil="papel" data-atributo="' + esc(a._cod) + '"' + (ocupado ? ' disabled' : '') + '>' +
          PAPEIS.map(function (s) { return '<option value="' + esc(s) + '"' + (v.papel === s ? ' selected' : '') + '>' + esc(s === 'observado' ? 'observado (neutro)' : s) + '</option>'; }).join('') + '</select></div>' +
          '<div><label for="' + id + '_origem">Origem</label><select id="' + id + '_origem" data-perfil="origem" data-atributo="' + esc(a._cod) + '"' + (ocupado ? ' disabled' : '') + '><option value="">— escolha a origem —</option>' +
          ORIGENS.map(function (s) { return '<option value="' + esc(s) + '"' + (v.origem === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div></div>';
      }
      if (erro) h += '<p class="tax-aviso-erro tax-perfil-erro" role="alert">' + esc(erro) + '</p>';
      h += '</fieldset>';
    });
    if (L.erro) h += '<p class="tax-aviso-erro" role="alert" id="taxPerfilLoteErro">' + esc(L.erro) + '</p>';
    if (L.confirmandoCancelar) return h + '<div class="tax-confirma" id="taxPerfilDescartar" role="group" aria-label="Descartar alterações"><p><strong>Descartar ' + plural(n, 'alteração não salva', 'alterações não salvas') + '?</strong> Nada foi gravado.</p>' +
      '<div class="tax-acoes"><button type="button" class="btn btn--sm tax-btn-perigo" data-tax="descartar-perfil">Descartar</button><button type="button" class="btn btn--sm" data-tax="continuar-perfil">Continuar editando</button></div></div></div>';
    return h + '<p class="tax-ajuda" id="taxPerfilResumo">' + (n ? plural(n, 'atributo alterado', 'atributos alterados') + ', ainda não salvo' + (n === 1 ? '' : 's') + '.' : 'Nenhuma alteração ainda.') + '</p>' +
      '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="salvar-perfil" id="taxSalvarPerfilBtn"' + (ocupado ? ' disabled' : '') + '>' + (L.verificando ? 'Conferindo…' : st.salvando ? 'Salvando…' : 'Salvar perfil') + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-perfil" id="taxCancelarPerfilBtn"' + (ocupado ? ' disabled' : '') + '>Cancelar</button></div></div>';
  }

  /* RELAÇÕES (Administração): "Relações registradas entre conceitos" — vínculos CADASTRADOS entre conceitos, em frase
     (origem — tipo — destino, sem códigos). Não comprovam relação entre áreas concretas nem são, por si, regra universal;
     nenhuma natureza ou estado é atribuído (o modelo não os tem). Ações de sempre: nova, substituir, encerrar. Só o domínio
     organizacional tem relações. */
  function renderRelacoes(dom, codigo, det) {
    var D = st.d[dom], ed = podeEditar() && D.conceitos[codigo].ativo !== false;
    function nome(cod) { return (D.conceitos[cod] && D.conceitos[cod].nome) || cod; }
    function lado(cod) { return '<strong>' + esc(nome(cod)) + '</strong>' + (D.conceitos[cod] && D.conceitos[cod].ativo === false ? ' ' + selo('desativado') : ''); }
    function nota(r) { return r.nota ? '<span class="tax-rel-nota">Nota: ' + esc(r.nota) + '</span>' : ''; }
    function frase(r) { return lado(r.de) + ' <span class="tax-rel-sep">—</span> <em class="tax-rel-tipo">' + esc(RELACAO_ROTULO[r.tipo] || r.tipo) + '</em> <span class="tax-rel-sep">—</span> ' + lado(r.para); }
    var html = '<section class="tax-sec tax-sec--relacoes" id="taxSecRelacoes">';
    if (det.erros.relacoes) return html + '<h4>Relações registradas entre conceitos</h4><p class="tax-aviso-erro">Não foi possível carregar as relações agora.</p></section>';
    if (det.carregando && !chaves(det.relacoes).length) return html + '<h4>Relações registradas entre conceitos</h4><p class="loading-msg">Carregando relações…</p></section>';
    var ids = chaves(det.relacoes).sort();
    var abertas = ids.filter(function (k) { return !det.relacoes[k].encerrada; });
    var encerradas = ids.filter(function (k) { return !!det.relacoes[k].encerrada; });
    abertas.sort(function (a, b) { var sa = det.relacoes[a].de === codigo ? 0 : 1, sb = det.relacoes[b].de === codigo ? 0 : 1; return sa - sb || (a < b ? -1 : 1); });
    var ocupado = !!(D.relForm || D.encerrando);
    html += '<h4>Relações registradas entre conceitos (' + abertas.length + ')</h4>' +
      '<p class="tax-ajuda" id="taxRelNatureza">Vínculos cadastrados entre conceitos da Taxonomia. Não comprovam relações entre áreas concretas da PREVI e não são, por si, regras arquiteturais universais.</p>';
    function item(k) {
      var r = det.relacoes[k], h = '<li class="tax-rel-item" data-relacao="' + esc(k) + '" data-direcao="' + (r.de === codigo ? 'saida' : 'entrada') + '"><span class="tax-rel-frase">' + frase(r) + '</span>' + nota(r);
      if (ed && !ocupado) h += '<span class="tax-rel-acoes"><button type="button" class="btn btn--sm" data-tax="alterar-relacao" data-relacao="' + esc(k) + '">Substituir</button>' +
        '<button type="button" class="btn btn--sm tax-btn-perigo" data-tax="encerrar-relacao" data-relacao="' + esc(k) + '">Encerrar</button></span>';
      if (ed && D.encerrando && D.encerrando.chave === k) h += painelEncerrar(k);
      if (ed && D.relForm && D.relForm.modo === 'alterar' && D.relForm.base === k) h += formRelacao(dom, codigo);
      return h + '</li>';
    }
    if (!abertas.length) html += '<p class="tax-ausencia" id="taxRelVazio">Nenhuma relação registrada para este conceito.</p>';
    else html += '<ul class="tax-relacoes" id="taxRelLista">' + abertas.map(item).join('') + '</ul>';
    if (ed) {
      if (D.relForm && D.relForm.modo === 'nova') html += formRelacao(dom, codigo);
      else if (!ocupado) html += '<div class="tax-acoes"><button type="button" class="btn btn--sm btn--primary" data-tax="nova-relacao" id="taxNovaRelacaoBtn">Nova relação</button></div>';
    }
    if (encerradas.length) {
      var idE = idDet('relenc', dom, codigo);
      html += '<details class="tax-recolhivel" id="taxRelEncerradas" data-det="' + esc(idE) + '"' + detAberto(idE, false) + '><summary class="tax-recolhivel-cab">Relações encerradas (' + encerradas.length + ')</summary><ul class="tax-relacoes tax-relacoes--encerradas">' +
        encerradas.map(function (k) {
          var r = det.relacoes[k], e = r.encerrada;
          return '<li data-relacao="' + esc(k) + '"><span class="tax-rel-frase">' + frase(r) + '</span>' + nota(r) +
            '<span class="tax-ajuda">Encerrada em ' + esc(fmtData(e.em)) + ' por ' + esc(e.por || '—') + ' — motivo: ' + esc(e.motivo || '—') + '</span></li>';
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
      '<div class="tax-acoes"><button type="button" class="btn btn--sm tax-btn-perigo" data-tax="confirmar-encerrar"' + (st.salvando || f.conferindo ? ' disabled' : '') + '>' + (f.conferindo ? 'Conferindo…' : st.salvando ? 'Salvando…' : 'Encerrar relação') + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-relacao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
  }
  function formRelacao(dom, codigo) {
    var D = st.d[dom], f = D.relForm, alterar = f.modo === 'alterar';
    var outros = ordenaPor(chaves(D.conceitos).filter(function (k) { return k !== codigo && D.conceitos[k].ativo !== false; }).map(function (k) { return { k: k, nome: D.conceitos[k].nome || k }; }), 'nome');
    var h = '<div class="tax-form tax-form-relacao" id="taxFormRelacao" role="group" aria-label="' + (alterar ? 'Substituir relação' : 'Nova relação') + '">' +
      '<p class="tax-form-titulo"><strong>' + (alterar ? 'Substituir relação' : 'Nova relação') + '</strong></p>' +
      (alterar ? '<p class="tax-ajuda" id="taxSubstituirEfeito"><strong>O que acontece:</strong> a relação atual é encerrada, com o motivo, e a nova é criada — numa gravação só. A atual continua registrada como encerrada e uma relação idêntica a ela não poderá ser criada de novo.</p>' : '') +
      '<label for="taxR_direcao">Direção *</label><select id="taxR_direcao" data-rel="direcao"><option value="saida"' + (f.direcao !== 'entrada' ? ' selected' : '') + '>este conceito → outro</option><option value="entrada"' + (f.direcao === 'entrada' ? ' selected' : '') + '>outro → este conceito</option></select>' +
      '<label for="taxR_tipo">Tipo *</label><select id="taxR_tipo" data-rel="tipo"><option value="">— escolha —</option>' + TIPOS_RELACAO.map(function (t) { return '<option value="' + esc(t) + '"' + (f.tipo === t ? ' selected' : '') + '>' + esc(RELACAO_ROTULO[t]) + '</option>'; }).join('') + '</select>' +
      '<label for="taxR_outro">Outro conceito * <span class="tax-ajuda">(só conceitos ativos)</span></label><select id="taxR_outro" data-rel="outro"><option value="">— escolha —</option>' + outros.map(function (o) { return '<option value="' + esc(o.k) + '"' + (f.outro === o.k ? ' selected' : '') + '>' + esc(o.nome) + ' (' + esc(o.k) + ')</option>'; }).join('') + '</select>' +
      '<label for="taxR_nota">Nota</label><textarea id="taxR_nota" data-rel="nota" rows="2" maxlength="2000">' + esc(f.nota || '') + '</textarea>' +
      (alterar ? '<label for="taxR_motivo">Motivo da substituição *</label><textarea id="taxR_motivo" data-rel="motivo" rows="2" maxlength="' + MAX_MOTIVO + '">' + esc(f.motivo || '') + '</textarea>' : '') +
      (f.erro ? '<p class="tax-aviso-erro" role="alert">' + esc(f.erro) + '</p>' : '') +
      '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="salvar-relacao"' + (st.salvando || f.conferindo ? ' disabled' : '') + '>' + (f.conferindo ? 'Conferindo…' : st.salvando ? 'Salvando…' : (alterar ? 'Substituir relação' : 'Criar relação')) + '</button>' +
      '<button type="button" class="btn btn--sm" data-tax="cancelar-relacao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
    return h;
  }

  /* F) HISTÓRICO — uma entrada só, recolhida. Mostra o que mudou (anterior → novo), quem, quando e o motivo. A versão 1
     da definição vinda da migração (ou da carga) é o REGISTRO INICIAL, não uma edição. Os registros do modelo antigo
     (criação de fontes, troca de vigência, arquivamento) ficam em "Detalhes técnicos anteriores à simplificação". Nada
     é apagado nem reescrito no banco: é só a forma de mostrar. */
  var TIPOS_LEGADO = { alteracao_fonte: true, definicao_vigente: true, fonte_arquivada: true, fonte_restaurada: true };
  function renderHistorico(dom, codigo, det) {
    var html = '<section class="tax-sec tax-sec--historico" id="taxSecHistorico">';
    if (det.erros.auditoria) return html + '<p class="tax-recolhivel-cab tax-recolhivel-cab--fixo">Histórico</p><p class="tax-aviso-erro">Histórico indisponível agora.</p></section>';
    if (det.carregando && !chaves(det.auditoria).length) return html + '<p class="tax-recolhivel-cab tax-recolhivel-cab--fixo">Histórico</p><p class="loading-msg">Carregando histórico…</p></section>';
    var ev = ordenaPor(chaves(det.auditoria).map(function (k) { return Object.assign({ _chave: k }, det.auditoria[k]); }), 'dataHora').reverse();
    var principais = ev.filter(function (e) { return !TIPOS_LEGADO[e.tipo]; }), legado = ev.filter(function (e) { return TIPOS_LEGADO[e.tipo]; });
    var versoes = chaves(det.versoes || {}).map(function (k) { return det.versoes[k]; }).filter(function (x) { return x && typeof x.versao === 'number'; }).sort(function (a, b) { return a.versao - b.versao; });
    var comEvento = {}; principais.forEach(function (e) { if (e.tipo === 'definicao_publicada') comEvento[e.versao] = true; });
    /* publicação sem o evento de auditoria (não deveria existir): aparece a partir do histórico versionado */
    versoes.forEach(function (v, i) {
      if (v.origem !== 'publicacao' || comEvento[v.versao]) return;
      principais.push({ _chave: 'v' + v.versao, tipo: 'definicao_publicada', campo: 'definição', versao: v.versao, valorAnterior: i ? versoes[i - 1].texto : null, valorNovo: v.texto, motivo: v.motivo || null, usuario: { email: v.publicadaPor }, dataHora: v.publicadaEm });
    });
    principais = ordenaPor(principais, 'dataHora').reverse();
    var inicial = versoes.filter(function (v) { return v.versao === 1 && v.origem !== 'publicacao'; })[0] || null;
    var id = idDet('hist', dom, codigo);
    html += '<details class="tax-recolhivel tax-hist" id="taxHistoricoConceito" data-det="' + esc(id) + '"' + detAberto(id, false) + '><summary class="tax-recolhivel-cab">' + esc(tituloHistorico(principais.length)) + '</summary>';
    if (!principais.length && !inicial && !legado.length) return html + '<p class="tax-ausencia">Nenhuma alteração registrada.</p></details></section>';
    if (principais.length) html += '<ul class="tax-hist-lista">' + principais.map(function (l) { return linhaHistoricoConceito(l, 'audd:' + dom + ':' + codigo + ':' + l._chave); }).join('') + '</ul>';
    else html += '<p class="tax-ausencia">Nenhuma alteração depois do registro inicial.</p>';
    if (inicial) {
      var idI = idDet('histini', dom, codigo);
      html += '<div class="tax-hist-item tax-hist-inicial" id="taxHistInicial"><div class="tax-hist-meta"><span class="tax-hist-quando">' + esc(fmtData(inicial.publicadaEm)) + '</span><span class="tax-hist-autor">por ' + esc(inicial.publicadaPor || '—') + '</span>' +
        '<strong class="tax-hist-tipo">Registro inicial da definição (versão 1)</strong></div>' +
        '<p class="tax-ajuda">' + (inicial.origem === 'migracao' ? 'Definição oficial que estava vigente quando a Taxonomia foi simplificada.' : 'Definição registrada na carga inicial.') + ' Não é uma alteração.</p>' +
        '<details class="tax-hist-detalhe" data-det="' + esc(idI) + '"' + detAberto(idI, false) + '><summary>Ver texto</summary><p class="tax-fonte-texto">' + esc(inicial.texto) + '</p></details></div>';
    }
    if (legado.length) {
      var idL = idDet('histleg', dom, codigo), fontes = det.arquivo || {};
      var txtFonte = function (fid) { return fid && fontes[fid] && typeof fontes[fid].texto === 'string' ? fontes[fid].texto : null; };
      html += '<details class="tax-recolhivel tax-hist-legado" id="taxHistLegado" data-det="' + esc(idL) + '"' + detAberto(idL, false) + '><summary class="tax-recolhivel-cab">Detalhes técnicos anteriores à simplificação (' + legado.length + ')</summary>' +
        '<p class="tax-ajuda">Registros do modelo antigo (catálogo de fontes e troca de vigência), preservados como estavam. Não mudam a definição atual.</p><ul class="tax-hist-lista">' +
        legado.map(function (l) {
          var extra = l.tipo === 'definicao_vigente' && (txtFonte(l.fonteAnteriorId) || txtFonte(l.fonteNovaId))
            ? '<p class="tax-ajuda tax-hist-legado-textos">Texto que deixou de valer: ' + esc(txtFonte(l.fonteAnteriorId) || '(nenhum)') + '<br>Texto que passou a valer: ' + esc(txtFonte(l.fonteNovaId) || '(nenhum)') + '</p>' : '';
          return linhaHistoricoConceito(l, 'audd:' + dom + ':' + codigo + ':' + l._chave, extra);
        }).join('') + '</ul></details>';
    }
    return html + '</details></section>';
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
        html += '<div class="tax-previa" id="taxPrevia"><strong>Prévia — nada foi gravado ainda</strong><ul><li>' + r.conceitos + ' conceitos (' + r.vigentes + ' com definição vigente)</li>' + (r.naoImportados ? '<li id="taxPreviaNaoImportados">' + r.naoImportados + ' textos que não eram a definição vigente não serão importados</li>' : '') + '<li>' + r.atributos + ' atributos, ' + r.perfis + ' valores de perfil, ' + r.relacoes + ' relações</li></ul>' +
          '<div class="tax-acoes"><button type="button" class="btn btn--primary btn--sm" data-tax="confirmar-importacao"' + (st.salvando ? ' disabled' : '') + '>' + (st.salvando ? 'Importando…' : 'Importar') + '</button><button type="button" class="btn btn--sm" data-tax="cancelar-importacao"' + (st.salvando ? ' disabled' : '') + '>Cancelar</button></div></div>';
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
    alteracao_conceito: 'Alteração de conceito', alteracao_fonte: 'Alteração de fonte', definicao_vigente: 'Definição vigente (modelo antigo)', definicao_publicada: 'Definição publicada', migracao_definicoes: 'Simplificação da Taxonomia (migração)', migracao_revertida: 'Migração revertida', alteracao_perfil: 'Alteração de perfil', fonte_arquivada: 'Fonte arquivada', fonte_restaurada: 'Fonte restaurada',
    inativacao: 'Conceito inativado', reativacao: 'Conceito reativado', relacao_criada: 'Relação criada', relacao_encerrada: 'Relação encerrada', alteracao_camada: 'Camada alterada', indice_filhos: 'Índice de conceitos filhos' };
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
      var C = H.contagem[d] = { estado: 'carregando', conceitos: 0, fontes: 0 }, pend = 1, falhou = false;
      function fim() { if (--pend > 0) return; C.estado = falhou ? 'erro' : 'ok'; render(); }
      lerNo(RAIZ + '/' + d + '/conceitos', function (r) { if (!r.ok) falhou = true; else { var v = r.valor || {}; C.conceitos = chaves(v).length; C.fontes = chaves(v).filter(function (k) { return v[k] && v[k].definicao; }).length; } fim(); });
    });
  }
  function resumoCarga(e) {
    if (!ehCargaAntiga(e)) return textoContagem(e.resumoDominio);
    var C = st.hg.contagem[e._dom], hoje;
    if (!C || C.estado === 'carregando') hoje = 'Contando o que o domínio tem hoje…';
    else if (C.estado === 'erro') hoje = 'Não foi possível contar agora o que o domínio tem hoje.';
    else hoje = 'Hoje o domínio tem ' + plural(C.conceitos, 'conceito', 'conceitos') + ', ' + C.fontes + ' com definição vigente (contagem atual, não a da carga).';
    return 'Contagem deste domínio na carga: não registrada (linha anterior à separação por domínio). ' + hoje +
      (e.valorNovo ? ' Registro original, com o total dos dois domínios juntos: "' + e.valorNovo + '".' : '');
  }
  function htmlHistoricoGlobal() {
    var H = st.hg;
    var voltar = function (onde) { return '<div class="tax-voltar-hg tax-voltar-hg--' + onde + '"><button type="button" class="btn" data-tax="voltar-dominio">← Voltar às Verificações do sistema</button></div>'; };
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
  var EXPORT_FORMATO = 'forca-agil/taxonomia-exportacao', EXPORT_VERSAO = 2; /* 2 = modelo de definição única (definicao + definicoes); 1 tinha fontes */
  var RAMOS_EXPORT = [
    ['organizacional', 'conceitos'], ['organizacional', 'definicoes'], ['organizacional', 'atributos'], ['organizacional', 'perfis'], ['organizacional', 'relacoes'], ['organizacional', 'auditoria'],
    ['arquitetural', 'conceitos'], ['arquitetural', 'definicoes'], ['arquitetural', 'auditoria'],
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
    var L = { Conceitos: [], 'Definições': [], Atributos: [], Perfis: [], 'Relações': [], 'Histórico': [] };
    ORDEM_DOMINIOS.forEach(function (dom) {
      var B = bruto[dom] || {}, cs = B.conceitos || {}, dv = B.definicoes || {};
      var nome = function (cod) { return (cs[cod] && cs[cod].nome) || ''; };
      ordenaPor(chaves(cs).map(function (k) { return Object.assign({ _cod: k }, cs[k]); }), 'ordem').forEach(function (c) {
        var d0 = c.definicao || null, nv = chaves(dv[c._cod] || {}).length;
        var integ = d0 && !(dv[c._cod] || {})['v' + d0.versao] ? 'a versão vigente não está no histórico' : '';
        L.Conceitos.push([DOMINIOS[dom].rotulo, c._cod, c.nome || '', c.camada ? (CAMADA_ROTULO[c.camada] || c.camada) : '', c.pai || '', c.pai ? nome(c.pai) : '',
          c.ativo === false ? 'Não' : 'Sim', d0 ? d0.texto : '', d0 ? d0.versao : '', d0 ? d0.publicadaEm || '' : '', d0 ? d0.publicadaPor || '' : '', nv,
          txt(c.ordem), listaCriterios(c).join(' | '), c.observacoes || '', c.perguntaDiscriminadora || '', txt(c.ordemDaPergunta), c.notaDeAplicacao || '',
          c.criadoEm || '', c.criadoPor || '', c.atualizadoEm || '', c.atualizadoPor || '', integ]);
      });
      chaves(dv).sort().forEach(function (cod) {
        chaves(dv[cod] || {}).map(function (k) { return dv[cod][k] || {}; }).sort(function (a, b) { return (a.versao || 0) - (b.versao || 0); }).forEach(function (v) {
          L['Definições'].push([DOMINIOS[dom].rotulo, cod, nome(cod), v.versao || '', simNao(cs[cod] && cs[cod].definicao && cs[cod].definicao.versao === v.versao), v.texto || '', v.publicadaEm || '', v.publicadaPor || '', ({ publicacao: 'publicação', 'carga-inicial': 'carga inicial', migracao: 'migração' })[v.origem] || txt(v.origem), v.motivo || '']);
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
     os ATUAIS, só para leitura. "historicoDefinicao" = todas as versões publicadas da definição (v1, v2, …), a
     vigente incluída. Não lê nem grava nada. */
  function consolidarConceitos(bruto) {
    var lista = [];
    ORDEM_DOMINIOS.forEach(function (dom) {
      var B = bruto[dom] || {}, cs = B.conceitos || {}, dv = B.definicoes || {}, atrs = B.atributos || {}, perfis = B.perfis || {}, rel = B.relacoes || {}, aud = B.auditoria || {};
      var nome = function (cod) { return (cs[cod] && cs[cod].nome) || null; };
      ordenaPor(chaves(cs).map(function (k) { return Object.assign({ _cod: k }, cs[k]); }), 'ordem').forEach(function (c) {
        var cod = c._cod, d0 = c.definicao || null;
        var versoes = chaves(dv[cod] || {}).map(function (k) { return dv[cod][k] || {}; }).sort(function (a, b) { return (a.versao || 0) - (b.versao || 0); });
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
        var integ = d0 && !(dv[cod] || {})['v' + d0.versao] ? 'a versão vigente não está no histórico' : null;
        lista.push({
          dominio: dom, dominioRotulo: DOMINIOS[dom].rotulo, codigo: cod, nome: c.nome || null, ordem: typeof c.ordem === 'number' ? c.ordem : null,
          ativo: c.ativo !== false,
          camada: c.camada || null, camadaRotulo: c.camada ? (CAMADA_ROTULO[c.camada] || c.camada) : null,
          pai: c.pai ? { codigo: c.pai, nome: nome(c.pai) } : null,
          criterios: listaCriterios(c), perguntaDiscriminadora: c.perguntaDiscriminadora || null, ordemDaPergunta: typeof c.ordemDaPergunta === 'number' ? c.ordemDaPergunta : null,
          observacoes: c.observacoes || null, notaDeAplicacao: c.notaDeAplicacao || null,
          atualizadoEm: c.atualizadoEm || null, atualizadoPor: c.atualizadoPor || null,
          definicaoVigente: d0 ? { texto: d0.texto || null, versao: d0.versao || null, publicadaEm: d0.publicadaEm || null, publicadaPor: d0.publicadaPor || null } : null,
          historicoDefinicao: versoes,
          perfis: listaPerfis,
          relacoesSaida: saida, relacoesEntrada: entrada,
          auditoria: { total: evs.length, ultimaAlteracaoEm: ultima ? ultima.dataHora || null : null, ultimaAlteracaoPor: ultima && ultima.usuario ? (ultima.usuario.email || ultima.usuario.nome || null) : null, porTipo: porTipo },
          integridadeDefinicao: integ
        });
      });
    });
    return lista;
  }
  var ABA_CONSOLIDADA = 'Visão consolidada por conceito'; /* 30 caracteres: cabe no limite de 31 do Excel */
  var CAB_CONSOLIDADA = ['Domínio', 'Código', 'Nome', 'Ativo', 'Camada / especialização', 'Conceito pai', 'Definição vigente',
    'Versão da definição', 'Publicada em', 'Publicada por', 'Critérios', 'Pergunta discriminadora', 'Observações', 'Nota de aplicação',
    'Atributos / perfil', 'Relações de saída', 'Relações de entrada', 'Versões da definição (qtd.)', 'Alterações (qtd.)', 'Atualizado em', 'Atualizado por'];
  var LARG_CONSOLIDADA = [14, 16, 28, 8, 20, 28, 70, 10, 20, 28, 50, 44, 44, 44, 50, 44, 44, 12, 12, 20, 28];
  /* uma linha por conceito; vários valores na mesma célula vão um por linha (a aba tem quebra de linha) */
  /* relação encerrada nunca aparece como se estivesse ativa nas exportações */
  function encerradaTxt(r) { return r.encerrada ? ' [ENCERRADA em ' + String(r.encerrada.em || '').slice(0, 10) + ' — ' + (r.encerrada.motivo || '') + ']' : ''; }
  function linhasConsolidadas(lista) {
    return lista.map(function (k) {
      var dv = k.definicaoVigente;
      return [k.dominioRotulo, k.codigo, k.nome || '', k.ativo ? 'Sim' : 'Não', k.camadaRotulo || '',
        k.pai ? k.pai.codigo + (k.pai.nome ? ' — ' + k.pai.nome : '') : '', dv ? dv.texto || '' : '', dv ? dv.versao : '', dv ? dv.publicadaEm || '' : '', dv ? dv.publicadaPor || '' : '',
        k.criterios.join('\n'), k.perguntaDiscriminadora || '', k.observacoes || '', k.notaDeAplicacao || '',
        k.perfis.map(function (p) { return (p.atributoNome || p.atributo) + ': ' + (p.estado === 'registrado' ? p.valor + ' (' + p.papel + ' · origem: ' + p.origem + ')' : p.estado); }).join('\n'),
        k.relacoesSaida.map(function (r) { return (r.tipoRotulo || r.tipo) + ' → ' + r.para + (r.paraNome ? ' — ' + r.paraNome : '') + (r.nota ? ' (' + r.nota + ')' : '') + encerradaTxt(r); }).join('\n'),
        k.relacoesEntrada.map(function (r) { return r.de + (r.deNome ? ' — ' + r.deNome : '') + ' ' + (r.tipoRotulo || r.tipo) + ' → este conceito' + (r.nota ? ' (' + r.nota + ')' : '') + encerradaTxt(r); }).join('\n'),
        k.historicoDefinicao.length, k.auditoria.total, k.atualizadoEm || '', k.atualizadoPor || ''];
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
    Conceitos: ['Domínio', 'Código', 'Nome', 'Camada / especialização', 'Pai (código)', 'Pai (nome)', 'Ativo', 'Definição vigente (texto)', 'Versão da definição', 'Publicada em', 'Publicada por', 'Versões no histórico',
      'Ordem', 'Critérios', 'Observações', 'Pergunta discriminadora', 'Ordem da pergunta', 'Nota de aplicação', 'Criado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Integridade da definição'],
    'Definições': ['Domínio', 'Conceito (código)', 'Conceito (nome)', 'Versão', 'É a vigente', 'Texto', 'Publicada em', 'Publicada por', 'Origem', 'Motivo'],
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
    var h = '<section class="tax-exportar" id="taxExportar" aria-label="Exportar Taxonomia"><p class="tax-exportar-titulo"><strong>Exportar Taxonomia</strong></p><p class="tax-ajuda" id="taxExportarDescricao">Baixe os dados da Taxonomia Organizacional e Arquitetural.</p>' +
      '<div class="tax-acoes tax-exportar-acoes"><button type="button" class="btn btn--sm" data-tax="exportar-excel" id="taxExportarExcel"' + (ocupado ? ' disabled' : '') + '>Baixar Excel</button>' +
      '<button type="button" class="btn btn--sm" data-tax="exportar-json" id="taxExportarJson"' + (ocupado ? ' disabled' : '') + '>Baixar JSON</button></div>';
    if (x) {
      if (ocupado) h += '<p class="loading-msg" id="taxExportarStatus">' + (x.estado === 'lendo' ? 'Lendo a Taxonomia inteira…' : 'Gerando a planilha…') + '</p>';
      else h += '<p class="' + (x.estado === 'erro' ? 'tax-aviso-erro' : 'tax-ajuda') + '" id="taxExportarStatus" role="' + (x.estado === 'erro' ? 'alert' : 'status') + '">' + esc(x.texto) + '</p>';
    }
    return h + '</section>';
  }

  /* ================= TRÊS ESPAÇOS =================
     CATÁLOGO (entender: buscar, ler a definição oficial, navegar na hierarquia, comparar) · ADMINISTRAÇÃO (manter o
     conceito selecionado: conteúdo, perfil, relações, histórico e governança) · INTEGRIDADE E CONFIGURAÇÕES (conexão com
     os motores, exportação, histórico global, carga inicial). Uma navegação só, com localização e retorno claros. Nenhum
     formulário, ação ou leitura é duplicado: cada espaço chama as mesmas funções de gravação de antes. */
  function normBusca(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function ancestrais(dom, codigo) {
    var D = st.d[dom], out = [], c = D.conceitos[codigo], guarda = 0;
    while (c && c.pai && guarda++ < 6) { var p = D.conceitos[c.pai]; out.unshift({ codigo: c.pai, nome: p ? p.nome : c.pai, existe: !!p }); c = p; }
    return out;
  }
  /* estado da integração com os motores, para o atalho do topo — o mesmo avaliarIntegracao() dos dois blocos de
     Integridade: 'problema' (vínculo ausente, conceito ausente ou inativo, vínculo sem código no motor), 'erro' (não deu
     para conferir), 'conferindo' (ainda lendo) ou 'ok' — "ok" só quando os dois lados foram lidos e estão completos */
  function estadoIntegracao() {
    var e = ['arquitetural', 'organizacional'].map(function (d) { return avaliarIntegracao(d).estado; });
    return e.indexOf('problema') !== -1 ? 'problema' : e.indexOf('erro') !== -1 ? 'erro' : e.indexOf('conferindo') !== -1 ? 'conferindo' : 'ok';
  }
  /* origem registrada pelo ADMIN (atalho "Abrir a aba Taxonomia" em Avaliações e Mapa — admin.js): só com a marca */
  function origemTaxonomia() { return window.faAdminOrigemTaxonomia ? window.faAdminOrigemTaxonomia() : null; }
  /* alguma edição aberta e ainda não gravada, em qualquer domínio */
  function edicaoNaoSalva() {
    return ORDEM_DOMINIOS.some(function (d) { var D = st.d[d]; return !!(D.edicao || D.atualizando || D.perfilLote || D.relForm || D.encerrando || D.inativando || D.camadaMudando); });
  }
  function renderTopo() {
    var local = st.espaco === 'admin' ? 'Administração' : st.espaco === 'integridade' ? 'Verificações do sistema' : 'Catálogo de conceitos';
    var o = origemTaxonomia();
    if (!o) st.confirmandoVolta = false;
    var h = (o ? '<p class="tax-voltar-origem-linha"><button type="button" class="tax-lnk tax-voltar-origem" data-tax="voltar-origem" id="taxVoltarOrigem">← Voltar para ' + esc(o.rotulo || 'a área de origem') + '</button></p>' +
      (st.confirmandoVolta ? '<div class="tax-confirma" id="taxConfirmaVolta" role="group" aria-label="Edição não salva"><p><strong>Há uma edição não salva na Taxonomia.</strong> Se voltar agora, ela não é gravada; continua nesta aba enquanto a página estiver aberta.</p>' +
        '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="voltar-origem-confirmar" id="taxConfirmaVoltaSim">Voltar mesmo assim</button><button type="button" class="btn btn--sm" data-tax="voltar-origem-cancelar" id="taxConfirmaVoltaNao">Continuar editando</button></div></div>' : '') : '') +
      '<div class="tax-topo"><div class="tax-topo-titulo"><h3 class="tax-titulo-area" id="taxTituloArea">Taxonomia</h3><p class="tax-local" id="taxLocal">' + esc(local) + '</p></div>';
    return h + '</div>';
  }
  /* acesso secundário às Verificações do sistema, na Administração (só quem as vê); o estado é o mesmo das Verificações */
  function htmlAcessoVerificacoes() {
    if (!podeVerHG()) return '';
    var ei = estadoIntegracao();
    return '<div class="tax-admin-rodape"><button type="button" class="tax-lnk tax-integ-link" data-tax="integridade" id="taxVerificacoesLink" data-estado="' + ei + '"><span class="tax-ponto tax-ponto--' + (ei === 'ok' ? 'ok' : ei === 'conferindo' ? 'neutro' : 'atencao') + '" aria-hidden="true"></span>Verificações do sistema e dados' +
      (ei === 'problema' ? '<span class="tax-integ-atencao"> · requer atenção</span>' : ei === 'erro' ? '<span class="tax-integ-atencao"> · não foi possível conferir</span>' : '') + '</button></div>';
  }
  /* ---------- CATÁLOGO ---------- */
  function renderCatalogo(dom) {
    var D = st.d[dom];
    var h = '<div class="tax-dominios" role="tablist" aria-label="Domínio da Taxonomia">' + ORDEM_DOMINIOS.map(function (d) {
      var ativo = d === dom;
      return '<button type="button" role="tab" class="tax-dominio' + (ativo ? ' tax-dominio--ativo' : '') + '" aria-selected="' + ativo + '" data-tax="dominio" data-dominio="' + d + '">' + esc(DOMINIOS[d].rotulo) + '</button>';
    }).join('') + '</div>';
    h += '<p class="tax-pergunta" id="taxPergunta"><strong>' + esc(DOMINIOS[dom].titulo) + '</strong> · ' + esc(DOMINIOS[dom].pergunta) + '</p>';
    if (D.estado === 'carregando' || D.estado === 'ocioso') return h + '<p class="loading-msg" id="taxCarregando">Carregando a Taxonomia…</p>';
    if (D.estado === 'erro') return h + '<div class="tax-aviso-erro" id="taxErro" role="alert"><p>Não foi possível carregar a Taxonomia agora. Confira a conexão.</p><button type="button" class="btn btn--sm" data-tax="recarregar">Tentar novamente</button></div>';
    if (D.estado === 'sem-acesso') return h + '<p class="tax-aviso-erro" id="taxSemAcesso" role="alert">Você não tem acesso a esta área.</p>';
    if (!chaves(D.conceitos).length) {
      var semCarga = st.meta.estado === 'ok' && !st.meta.cargaFeita;
      return h + '<p class="tax-ausencia" id="taxVazio">' + (semCarga ? 'Nenhum conceito cadastrado: a carga inicial ainda não foi feita.' : 'Este domínio não tem conceitos cadastrados.') + '</p>' +
        (semCarga && podeVerHG() ? '<p class="tax-ajuda" id="taxVazioCarga">A carga inicial é feita em <button type="button" class="tax-lnk" data-tax="integridade">Verificações do sistema › Dados e histórico</button>.</p>' : '');
    }
    return h + '<div class="tax-wrap" data-vista="' + st.vista + '">' + renderLista(dom) + renderFicha(dom) + '</div>';
  }
  /* A FICHA de consulta mostra SOMENTE: nome e localização, "O que é?" (a definição oficial, integral, uma vez),
     hierarquia, comparar e — para quem pode — "Administrar conceito". Pergunta, critérios, observações, perfil,
     relações, histórico, códigos e integração ficam na Administração ou na Integridade. */
  function renderFicha(dom) {
    var D = st.d[dom], codigo = D.selecionado;
    var h = '<section class="tax-detalhe tax-ficha" aria-live="polite" aria-label="Conceito selecionado">' +
      '<button type="button" class="btn tax-voltar" data-tax="voltar-lista">← Voltar aos conceitos</button>';
    if (!codigo || !D.conceitos[codigo]) return h + '<p class="tax-ausencia" id="taxFichaVazia">Escolha um conceito na lista para ver o que ele significa.</p></section>';
    var c = D.conceitos[codigo], anc = ancestrais(dom, codigo);
    h += '<nav class="tax-trilha" id="taxTrilha" aria-label="Localização"><span>' + esc(DOMINIOS[dom].rotulo) + '</span>' + anc.map(function (a) {
      return '<span aria-hidden="true">›</span>' + (a.existe ? '<button type="button" class="tax-lnk" data-tax="selecionar" data-codigo="' + esc(a.codigo) + '">' + esc(a.nome) + '</button>' : '<span>' + esc(a.nome) + '</span>');
    }).join('') + '<span aria-hidden="true">›</span><span aria-current="page">' + esc(c.nome) + '</span></nav>';
    h += '<h3 class="tax-titulo">' + esc(c.nome) + '</h3>';
    if (c.ativo === false) h += '<p class="tax-ajuda" id="taxFichaInativo">Conceito inativo.</p>';
    h += '<section class="tax-sec tax-sec--definicao" id="taxSecDefinicao" aria-label="O que é?"><h4>O que é?</h4>' +
      (c.definicao ? '<p class="tax-definicao-texto" id="taxDefinicaoTexto">' + esc(c.definicao.texto) + '</p>' : '<p class="tax-ausencia" id="taxSemDefinicao">Não há definição oficial disponível para este conceito.</p>') + '</section>';
    var pai = c.pai ? D.conceitos[c.pai] : null;
    var filhos = ordenados(D).filter(function (x) { return x.pai === codigo; });
    if (c.pai || filhos.length) {
      h += '<section class="tax-sec tax-hierarquia" id="taxSecHierarquia" aria-label="Hierarquia"><h4>Hierarquia</h4>';
      if (c.pai) h += '<p class="tax-hier-linha" id="taxHierPai"><span class="tax-hier-k">Faz parte de</span> ' + (pai ? '<button type="button" class="tax-lnk" data-tax="selecionar" data-codigo="' + esc(c.pai) + '">' + esc(pai.nome) + '</button>' : esc(c.pai) + ' <span class="tax-ajuda">(não encontrado)</span>') + '</p>';
      if (filhos.length) h += '<div class="tax-hier-linha" id="taxHierFilhos"><span class="tax-hier-k">Especializações</span><ul class="tax-hier-filhos">' + filhos.map(function (f) {
        return '<li><button type="button" class="tax-lnk" data-tax="selecionar" data-codigo="' + esc(f._codigo) + '">' + esc(f.nome) + '</button>' + (f.ativo === false ? ' <span class="tax-ajuda">(inativo)</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
      h += '</section>';
    }
    h += renderComparar(dom, codigo);
    if (podeEditar()) h += '<div class="tax-ficha-rodape"><button type="button" class="btn btn--sm" data-tax="administrar" id="taxAdministrarBtn">Administrar conceito</button></div>';
    return h + '<div class="tax-voltar-rodape"><button type="button" class="btn" data-tax="voltar-lista">← Voltar aos conceitos</button></div></section>';
  }
  /* COMPARAR: duas definições oficiais do mesmo domínio, lado a lado (um após o outro no celular), com a hierarquia de
     cada uma. Não interpreta, não classifica, não grava. Sem definição de um dos lados, ou com textos idênticos, diz que
     as definições não bastam — nunca inventa diferença. */
  function renderComparar(dom, codigo) {
    var D = st.d[dom], h = '<section class="tax-sec tax-comparar" id="taxSecComparar" aria-label="Comparar conceitos">';
    if (!D.comparando) return h + '<button type="button" class="btn btn--sm" data-tax="comparar-abrir" id="taxCompararBtn">Comparar com outro conceito</button></section>';
    var outros = ordenados(D).filter(function (x) { return x._codigo !== codigo; });
    h += '<h4>Comparar conceitos</h4><label class="tax-rotulo-campo" for="taxCompararSel">Comparar “' + esc(D.conceitos[codigo].nome) + '” com</label>' +
      '<select id="taxCompararSel"><option value="">— escolha um conceito —</option>' + outros.map(function (o) {
        return '<option value="' + esc(o._codigo) + '"' + (D.compararCom === o._codigo ? ' selected' : '') + '>' + esc(o.nome) + '</option>';
      }).join('') + '</select>';
    var b = D.compararCom && D.conceitos[D.compararCom] ? D.conceitos[D.compararCom] : null;
    if (b) {
      var a = D.conceitos[codigo];
      var col = function (cod, x) {
        var anc = ancestrais(dom, cod).map(function (y) { return y.nome; });
        return '<article class="tax-comparar-col" data-codigo="' + esc(cod) + '"><p class="tax-comparar-nome">' + esc(x.nome) + '</p>' +
          (anc.length ? '<p class="tax-comparar-caminho">Faz parte de ' + esc(anc.join(' › ')) + '</p>' : '') +
          (x.definicao ? '<p class="tax-comparar-def">' + esc(x.definicao.texto) + '</p>' : '<p class="tax-ausencia">Não há definição oficial disponível.</p>') + '</article>';
      };
      h += '<div class="tax-comparar-grade" id="taxCompararGrade">' + col(codigo, a) + col(D.compararCom, b) + '</div>';
      var insuficiente = !a.definicao || !b.definicao || normBusca(a.definicao.texto).trim() === normBusca(b.definicao.texto).trim();
      if (insuficiente) h += '<p class="tax-aviso-neutro" id="taxCompararInsuficiente" role="note">As definições disponíveis não são suficientes para estabelecer uma distinção clara. Essa diferenciação depende de revisão arquitetural.</p>';
      h += '<p class="tax-ajuda">A comparação mostra as definições oficiais. Ela não classifica nenhum objeto e não grava nada.</p>';
    }
    return h + '<button type="button" class="tax-lnk" data-tax="comparar-fechar" id="taxCompararFechar">Fechar comparação</button></section>';
  }
  /* ---------- ADMINISTRAÇÃO do conceito selecionado ---------- */
  var ABAS_ADMIN = [['conteudo', 'Conteúdo'], ['perfil', 'Perfil'], ['relacoes', 'Relações'], ['historico', 'Histórico e governança']];
  function renderAdmin(dom) {
    var D = st.d[dom], codigo = D.selecionado, c = D.conceitos[codigo], org = dom === 'organizacional';
    var det = D.detalhe && D.detalhe.codigo === codigo ? D.detalhe : { carregando: true, versoes: {}, arquivo: {}, perfis: {}, relacoes: {}, auditoria: {}, erros: {} };
    var abas = ABAS_ADMIN.filter(function (a) { return org || (a[0] !== 'perfil' && a[0] !== 'relacoes'); });
    var aba = abas.some(function (a) { return a[0] === D.adminAba; }) ? D.adminAba : 'conteudo';
    var h = '<section class="tax-admin" id="taxAdmin" aria-label="Administração do conceito">' +
      '<button type="button" class="tax-lnk tax-voltar-catalogo" data-tax="voltar-catalogo" id="taxVoltarCatalogo">← Voltar ao catálogo</button>' +
      '<h3 class="tax-titulo" id="taxAdminTitulo">Administrar — ' + esc(c.nome) + '</h3>' +
      '<div class="tax-admin-abas" role="tablist" aria-label="Áreas da administração">' + abas.map(function (a) {
        var sel = a[0] === aba;
        return '<button type="button" role="tab" class="tax-admin-aba' + (sel ? ' tax-admin-aba--ativa' : '') + '" aria-selected="' + sel + '" data-tax="admin-aba" data-aba="' + a[0] + '" id="taxAba_' + a[0] + '">' + a[1] + '</button>';
      }).join('') + '</div><div class="tax-admin-corpo" role="tabpanel" id="taxAdminCorpo" aria-labelledby="taxAba_' + aba + '">';
    if (aba === 'conteudo') h += renderIdentificacao(dom, codigo) + renderDefinicao(dom, codigo, det) + renderPergunta(dom, codigo);
    else if (aba === 'perfil') h += renderAtributos(dom, codigo, det);
    else if (aba === 'relacoes') h += renderRelacoes(dom, codigo, det);
    else h += renderHistorico(dom, codigo, det) + renderAcoesConceito(dom, codigo);
    return h + '</div>' + htmlAcessoVerificacoes() + '</section>';
  }
  /* ---------- VERIFICAÇÕES DO SISTEMA (antes "Integridade e configurações") ----------
     Duas seções que não se misturam: Verificações (conexões com a Avaliação e o Posicionamento, pendências e correções)
     e Dados e histórico (exportar, histórico global, carga inicial). Sem pendência: uma frase curta e os detalhes técnicos
     recolhidos; com pendência, erro ou leitura em curso: os dois blocos abertos (qual conexão, o impacto, o conceito e a
     correção que já existia). Nunca verde antes de ler tudo — o estado é o mesmo avaliarIntegracao() dos blocos. */
  function renderIntegridade() {
    var h = '<section class="tax-integridade" id="taxIntegridade" aria-label="Verificações do sistema">' +
      '<button type="button" class="tax-lnk tax-voltar-catalogo" data-tax="voltar-catalogo" id="taxVoltarCatalogo">← Voltar ao catálogo</button>';
    if (st.aba === 'historico') return h + htmlHistoricoGlobal() + '</section>';
    h += '<h3 class="tax-titulo">Verificações do sistema</h3><p class="tax-ajuda tax-integ-sub" id="taxVerifIntro">Estas verificações confirmam se a Avaliação e o Posicionamento estão conectados aos conceitos oficiais da Taxonomia. Não mostram o andamento das avaliações nem a conclusão do Mapa da Floresta.</p>';
    var ea = avaliarIntegracao('arquitetural'), eo = avaliarIntegracao('organizacional'), eg = estadoIntegracao();
    var blocos = renderConceitosBase('arquitetural') + renderConceitosBase('organizacional');
    h += '<section class="tax-verificacoes" id="taxVerificacoes" data-estado="' + eg + '" aria-labelledby="taxVerifTitulo"><h4 class="tax-globais-titulo" id="taxVerifTitulo">Conexões com os motores</h4>';
    if (eg === 'ok') {
      h += '<div class="tax-verif-ok" id="taxVerifOk"><p class="tax-integracao-ok"><span class="tax-integracao-marca" aria-hidden="true">✓</span> <strong>Conexões funcionando corretamente.</strong></p><p>A Avaliação e o Posicionamento estão conectados aos conceitos oficiais. Nenhuma correção necessária.</p></div>' +
        '<details class="tax-recolhivel tax-verif-detalhes" id="taxVerifDetalhes" data-det="verif"' + detAberto('verif', false) + '><summary class="tax-recolhivel-cab">Ver detalhes técnicos</summary>' + blocos + '</details>';
    } else {
      var nomes = [[ea, 'Conexão com a Avaliação'], [eo, 'Conexão com o Posicionamento']];
      var comProblema = nomes.filter(function (x) { return x[0].estado === 'problema'; }).map(function (x) { return x[1]; });
      var comErro = nomes.filter(function (x) { return x[0].estado === 'erro'; }).map(function (x) { return x[1]; });
      h += '<p class="' + (eg === 'conferindo' ? 'loading-msg' : 'tax-verif-resumo') + '" id="taxVerifResumo" role="status">' +
        (eg === 'conferindo' ? 'Conferindo as conexões…' : eg === 'problema' ? '<strong>Conexão com problema:</strong> ' + esc(comProblema.join(' e ')) + '. Veja abaixo o conceito envolvido, o impacto e se há correção disponível.' :
          '<strong>Não foi possível conferir:</strong> ' + esc(comErro.join(' e ')) + '.') + '</p>' + blocos;
    }
    h += '</section>';
    /* E4: conceitos oficiais das naturezas individuais (relacoes-objetos.js monta aqui; só com a liberação presente) */
    h += '<div class="tax-naturezas-host" id="taxNaturezasHost"></div>';
    h += '<section class="tax-globais" id="taxAcoesGerais" aria-labelledby="taxDadosTitulo"><h4 class="tax-globais-titulo" id="taxDadosTitulo">Dados e histórico</h4>' + htmlExportar() +
      '<div class="tax-acoes"><button type="button" class="btn btn--sm" data-tax="aba-historico" id="taxHistoricoGlobalBtn">Ver o histórico global</button></div>' + renderImportador() + '</section>';
    return h + '</section>';
  }
  function render() {
    var el = raiz();
    if (!el) return;
    var dom = st.dominio, D = st.d[dom];
    var ativo = document.activeElement, foco = ativo && ativo.id === 'taxBusca' && el.contains(ativo) ? ativo.selectionStart : null;
    var html = '<div class="tax-raiz tax-ui">' + renderTopo();
    if (st.pendente && st.pendente.semResposta) html += htmlPendencia(st.pendente);
    if (st.flash) html += '<p class="tax-flash' + (st.flash.erro ? ' tax-flash--erro' : '') + '" role="status" id="taxFlash">' + esc(st.flash.texto) + ' <button type="button" class="tax-flash-fechar" data-tax="fechar-flash" aria-label="Fechar">×</button></p>';
    if (!adminPronto()) { el.innerHTML = html + '<p class="loading-msg">Verificando o acesso…</p></div>'; return; }
    if (!ehAdmin()) { el.innerHTML = html + '<p class="tax-aviso-erro">Esta área é só para administradoras.</p></div>'; return; }
    if (st.espaco === 'integridade' && podeVerHG()) html += renderIntegridade();
    else if (st.espaco === 'admin' && podeEditar() && D.selecionado && D.conceitos[D.selecionado]) html += renderAdmin(dom);
    /* releitura do domínio depois de uma gravação: a administração espera no lugar (nunca cai no catálogo por um instante) */
    else if (st.espaco === 'admin' && podeEditar() && D.selecionado && (D.estado === 'carregando' || D.estado === 'ocioso')) html += '<section class="tax-admin" id="taxAdmin" aria-label="Administração do conceito"><button type="button" class="tax-lnk tax-voltar-catalogo" data-tax="voltar-catalogo" id="taxVoltarCatalogo">← Voltar ao catálogo</button><p class="loading-msg">Carregando o conceito…</p></section>';
    else html += renderCatalogo(dom);
    el.innerHTML = html + '</div>';
    if (window.faRelacoesObjetos) window.faRelacoesObjetos.montarTaxonomia(document.getElementById('taxNaturezasHost'));
    if (foco !== null) { var b = document.getElementById('taxBusca'); if (b) { b.focus(); try { b.setSelectionRange(foco, foco); } catch (e) { /* tipo search sem seleção */ } } }
  }

  /* ---------- eventos (delegados) ---------- */
  function valoresDe(dom, tipo, chave) {
    var D = st.d[dom], c = D.conceitos[D.selecionado] || {}, det = D.detalhe || {};
    if (tipo === 'conceito') return { nome: c.nome || '', observacoes: c.observacoes || '', perguntaDiscriminadora: c.perguntaDiscriminadora || '', notaDeAplicacao: c.notaDeAplicacao || '', criterios: listaCriterios(c).join('\n') };
    var p = (det.perfis || {})[chave] || {};
    return { estado: p.estado || 'registrado', valor: p.valor || '', papel: p.papel || 'observado', origem: p.origem || '' };
  }
  function iniciaEdicao(tipo, chave) {
    var D = st.d[st.dominio];
    if (D.detalhe && D.detalhe.carregando && tipo !== 'conceito') { /* ainda carregando: espera */ }
    D.edicao = { tipo: tipo, chave: chave || D.selecionado, valores: valoresDe(st.dominio, tipo, chave), erro: null };
    D.atualizando = null;
    render();
  }
  /* depois de trocar de espaço: o topo da Taxonomia à vista (no celular, a troca começa no alto) */
  function topoDaArea() { var t = raiz() && raiz().querySelector('.tax-raiz'); if (t && t.getBoundingClientRect && t.getBoundingClientRect().top < 0 && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); }
  function aoClicar(ev) {
    var alvo = ev.target.closest('[data-tax]');
    if (!alvo || !raiz().contains(alvo)) return;
    var acao = alvo.getAttribute('data-tax'), dom = st.dominio, D = st.d[dom];
    if (acao === 'dominio') {
      var novo = alvo.getAttribute('data-dominio');
      if (novo === dom && st.aba === 'dominio') return;
      st.dominio = novo; st.aba = 'dominio'; st.espaco = 'catalogo'; st.busca = ''; st.vista = 'lista'; st.flash = null;
      if (st.d[novo].estado === 'ocioso') carregarDominio(novo); else render();
    } else if (acao === 'aba-historico') {
      if (!podeVerHG()) return;
      st.aba = 'historico'; st.flash = null;
      if (!st.hg.carregou) carregarHG(function () { return true; }); else render();
    } else if (acao === 'voltar-dominio') {
      /* volta do Histórico global para o domínio, com a lista e o conceito selecionado como estavam */
      st.aba = 'dominio'; st.flash = null; render();
      var topo = raiz().querySelector('.tax-raiz'); if (topo && topo.scrollIntoView) topo.scrollIntoView({ block: 'start' });
    } else if (acao === 'hg-mais') { carregarHG(function (x) { return x.estado === 'ok' && x.temMais; }); }
    else if (acao === 'hg-recarregar') { carregarHG(function (x) { return x.estado === 'erro'; }); }
    else if (acao === 'exportar-excel') exportar('excel');
    else if (acao === 'exportar-json') exportar('json');
    else if (acao === 'recarregar') { carregarMeta(); carregarDominio(dom); }
    else if (acao === 'selecionar') {
      var domSel = alvo.getAttribute('data-dominio');
      if (domSel && DOMINIOS[domSel] && domSel !== dom) { st.dominio = dom = domSel; D = st.d[dom]; st.busca = ''; }
      st.espaco = 'catalogo'; st.aba = 'dominio';
      var cod = alvo.getAttribute('data-codigo');
      if (window.innerWidth <= 720) st.rolagemLista = window.pageYOffset || document.documentElement.scrollTop || 0;
      zerarDetConceito(); /* abrir um conceito (mesmo o mesmo, de novo) começa com os históricos fechados */
      D.selecionado = cod; D.edicao = null; D.atualizando = null; D.confirmacao = null; D.arquivando = null; D.expandida = null; D.dica = false; D.arquivadasAbertas = false; D.novaVersao = null; D.inativando = null; D.camadaMudando = null; D.relForm = null; D.encerrando = null; D.perfilLote = null; D.gerenciandoRelacoes = null; D.comparando = false; D.compararCom = null; st.vista = 'detalhe'; st.flash = null;
      carregarDetalhe(dom, cod);
      var det = raiz().querySelector('.tax-detalhe'); if (det && det.scrollIntoView && window.innerWidth <= 720) det.scrollIntoView();
    } else if (acao === 'voltar-lista') {
      /* celular: volta à lista na MESMA posição, com o conceito escolhido marcado e à vista */
      st.vista = 'lista'; render();
      if (st.rolagemLista !== null && window.scrollTo) window.scrollTo(0, st.rolagemLista);
      var it = D.selecionado ? raiz().querySelector('.tax-item[data-codigo="' + String(D.selecionado).replace(/"/g, '') + '"]') : null;
      if (it && it.getBoundingClientRect && it.scrollIntoView) { var rr = it.getBoundingClientRect(); if (rr.top < 0 || rr.bottom > window.innerHeight) it.scrollIntoView({ block: 'center' }); }
    }
    else if (acao === 'voltar-origem') {
      if (edicaoNaoSalva() && !st.confirmandoVolta) { st.confirmandoVolta = true; render(); var cv = document.getElementById('taxConfirmaVoltaNao'); if (cv && cv.focus) cv.focus({ preventScroll: true }); return; }
      st.confirmandoVolta = false; if (window.faAdminVoltarDaTaxonomia) window.faAdminVoltarDaTaxonomia();
    }
    else if (acao === 'voltar-origem-confirmar') { st.confirmandoVolta = false; render(); if (window.faAdminVoltarDaTaxonomia) window.faAdminVoltarDaTaxonomia(); }
    else if (acao === 'voltar-origem-cancelar') { st.confirmandoVolta = false; render(); }
    else if (acao === 'voltar-catalogo') { st.espaco = 'catalogo'; st.aba = 'dominio'; st.flash = null; render(); topoDaArea(); }
    else if (acao === 'integridade') {
      if (!podeVerHG()) return;
      st.espaco = 'integridade'; st.aba = 'dominio'; st.flash = null;
      ORDEM_DOMINIOS.forEach(function (d) { if (st.d[d].estado === 'ocioso' || st.d[d].estado === 'erro') carregarDominio(d); });
      if (st.meta.estado === 'ocioso' || st.meta.estado === 'erro') carregarMeta();
      render(); topoDaArea();
    }
    else if (acao === 'comparar-abrir') { D.comparando = true; render(); var sc = document.getElementById('taxCompararSel'); if (sc && sc.focus) sc.focus({ preventScroll: true }); }
    else if (acao === 'comparar-fechar') { D.comparando = false; D.compararCom = null; render(); }
    else if (acao === 'fechar-flash') { st.flash = null; render(); }
    else if (acao === 'verificar-pendente') { var pp = st.pendente; if (pp && !pp.resolvido && !pp.verificando) { clearTimeout(pp.timerVerif); pp.tentativas = 0; verificarGravacao(pp); } }
    else if (!podeEditar() && acao !== 'cancelar-importacao') return;
    else if (acao === 'administrar') { if (!D.selecionado) return; st.espaco = 'admin'; D.adminAba = 'conteudo'; st.flash = null; render(); topoDaArea(); }
    else if (acao === 'admin-aba') { D.adminAba = alvo.getAttribute('data-aba') || 'conteudo'; render(); }
    else if (acao === 'atualizar-definicao') {
      var cd = D.conceitos[D.selecionado] || {};
      D.atualizando = { codigo: D.selecionado, etapa: 'editar', texto: cd.definicao ? cd.definicao.texto : '', motivo: '', erro: null, versaoBase: cd.definicao ? cd.definicao.versao : 0 };
      D.edicao = null; D.inativando = null; D.camadaMudando = null; render();
      var campoDef = document.getElementById('taxDefNovo'); if (campoDef && campoDef.focus) campoDef.focus({ preventScroll: true });
    }
    else if (acao === 'conferir-definicao') {
      var ad = D.atualizando; if (!ad) return;
      var ant = (D.conceitos[D.selecionado] || {}).definicao, tx = String(ad.texto || '').trim();
      if (!tx) { ad.erro = 'Escreva o texto da definição.'; render(); return; }
      if (ant && ant.texto.trim() === tx) { ad.erro = 'O texto proposto é igual à definição vigente: nada a publicar.'; render(); return; }
      ad.erro = null; ad.etapa = 'conferir'; render();
    }
    else if (acao === 'voltar-definicao') { if (D.atualizando && !st.salvando) { D.atualizando.etapa = 'editar'; render(); } }
    else if (acao === 'cancelar-definicao') { if (!st.salvando) { D.atualizando = null; render(); } }
    else if (acao === 'publicar-definicao') publicarDefinicao(dom, D.selecionado);
    else if (acao === 'editar-conceito') iniciaEdicao('conceito', D.selecionado);
    else if (acao === 'gerenciar-perfil') {
      var dp = D.detalhe; if (!dp || dp.codigo !== D.selecionado || dp.carregando || dp.erros.perfis) return;
      D.perfilLote = novoPerfilLote(D.selecionado, dp, atributosOrdenados(D)); render();
    }
    else if (acao === 'salvar-perfil') salvarPerfilLote(dom, D.selecionado);
    else if (acao === 'cancelar-perfil') { var Lc = D.perfilLote; if (!Lc || st.salvando || Lc.verificando) return; if (alteracoesPerfil(Lc).length) Lc.confirmandoCancelar = true; else D.perfilLote = null; render(); }
    else if (acao === 'descartar-perfil') { if (!st.salvando) { D.perfilLote = null; render(); } }
    else if (acao === 'continuar-perfil') { if (D.perfilLote) { D.perfilLote.confirmandoCancelar = false; render(); } }
    else if (acao === 'gerenciar-relacoes') { D.gerenciandoRelacoes = D.selecionado; D.relForm = null; D.encerrando = null; render(); }
    else if (acao === 'fechar-relacoes') { if (!st.salvando) { D.gerenciandoRelacoes = null; D.relForm = null; D.encerrando = null; render(); } }
    else if (acao === 'cancelar-edicao') { D.edicao = null; render(); }
    else if (acao === 'salvar-edicao') {
      var e = D.edicao; if (!e || st.salvando) return;
      if (e.tipo === 'conceito') salvarConceito(dom, D.selecionado);
    }
    else if (acao === 'inativar') { D.inativando = { codigo: D.selecionado, motivo: '', erro: null }; D.camadaMudando = null; D.edicao = null; D.confirmacao = null; D.arquivando = null; render(); }
    else if (acao === 'cancelar-inativar') { D.inativando = null; render(); }
    else if (acao === 'confirmar-inativar') { if (!st.salvando) inativarConceito(dom, D.selecionado); }
    else if (acao === 'reativar') { if (!st.salvando) reativarConceito(dom, D.selecionado); }
    else if (acao === 'alterar-camada') { D.camadaMudando = { codigo: D.selecionado, motivo: '', erro: null }; D.inativando = null; D.edicao = null; D.confirmacao = null; D.arquivando = null; if (st.indiceFilhos.estado !== 'ok') carregarIndiceFilhos(); else render(); }
    else if (acao === 'indice-recarregar') carregarIndiceFilhos();
    else if (acao === 'cancelar-camada') { D.camadaMudando = null; render(); }
    else if (acao === 'confirmar-camada') { if (!st.salvando) alterarCamada(dom, D.selecionado); }
    else if (acao === 'ligacoes-recarregar') {
      var dl = DOMINIOS[alvo.getAttribute('data-dominio')] ? alvo.getAttribute('data-dominio') : st.dominio;
      carregarLigacoes(dl);
      if (st.d[dl].estado === 'erro' || st.d[dl].estado === 'sem-acesso') carregarDominio(dl);
    }
    else if (acao === 'nova-relacao') { D.gerenciandoRelacoes = D.selecionado; D.relForm = { modo: 'nova', direcao: 'saida', tipo: '', outro: '', nota: '', erro: null }; D.encerrando = null; render(); }
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
    else if (acao === 'previa-ligacoes' || acao === 'cancelar-ligacoes' || acao === 'confirmar-ligacoes') {
      /* o domínio vem do BLOCO acionado (Integridade mostra Avaliação e Posicionamento juntos), nunca do domínio aberto
         no Catálogo; botão sem domínio válido não faz nada */
      var dlg = alvo.getAttribute('data-dominio');
      if (!LIG_CFG[dlg]) return;
      if (acao === 'previa-ligacoes') { st[LIG_CFG[dlg].carga] = { erro: null }; render(); }
      else if (acao === 'cancelar-ligacoes') { st[LIG_CFG[dlg].carga] = null; render(); }
      else if (!st.salvando) registrarLigacoes(dlg);
    }
    else if (acao === 'confirmar-importacao') confirmarImportacao();
    else if (acao === 'cancelar-importacao') { st.importacao = null; render(); }
  }
  function aoEditar(ev) {
    var el = ev.target;
    if (el.id === 'taxArquivo') { if (ev.type === 'change' && el.files && el.files[0]) escolherArquivo(el.files[0]); return; }
    if (el.id === 'taxBusca') { if (st.busca !== el.value) { st.busca = el.value; render(); } return; }
    if (el.id === 'taxCompararSel') { if (ev.type === 'change') { st.d[st.dominio].compararCom = el.value || null; render(); } return; }
    var campo = el.getAttribute && el.getAttribute('data-campo');
    var D = st.d[st.dominio];
    var campoDef = el.getAttribute && el.getAttribute('data-def');
    if (campoDef && D.atualizando) { D.atualizando[campoDef] = el.value; return; }
    var campoInat = el.getAttribute && el.getAttribute('data-inat');
    if (campoInat && D.inativando) { D.inativando[campoInat] = el.value; D.inativando.erro = null; return; }
    var campoCam = el.getAttribute && el.getAttribute('data-cam');
    if (campoCam && D.camadaMudando) { D.camadaMudando[campoCam] = el.value; D.camadaMudando.erro = null; return; }
    var campoEnc = el.getAttribute && el.getAttribute('data-enc');
    if (campoEnc && D.encerrando) { D.encerrando[campoEnc] = el.value; D.encerrando.erro = null; return; }
    var campoPerfil = el.getAttribute && el.getAttribute('data-perfil');
    if (campoPerfil && D.perfilLote) {
      var atrP = el.getAttribute('data-atributo'), vp = D.perfilLote.valores[atrP]; if (!vp) return;
      vp[campoPerfil] = el.value; delete D.perfilLote.erros[atrP]; D.perfilLote.erro = null;
      /* listas (estado, valor de lista, papel, origem) mudam o formulário: redesenha. Texto livre NÃO: o 'change' dele chega
         no blur, e redesenhar ali trocaria o botão que a pessoa está clicando (o clique se perderia) */
      if (el.tagName === 'SELECT' && ev.type === 'change') render();
      return;
    }
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
  var pedidoDominio = null;
  function abrir(opcoes) {
    /* domínio pedido pela origem (atalho do Início): aplicado uma vez por pedido — reabrir a aba não desfaz a escolha
       que a pessoa fez depois */
    if (opcoes && DOMINIOS[opcoes.dominio] && opcoes.pedido !== pedidoDominio) {
      pedidoDominio = opcoes.pedido;
      if (st.dominio !== opcoes.dominio) { st.dominio = opcoes.dominio; st.vista = 'lista'; st.flash = null; }
      st.aba = 'dominio';
    }
    if (opcoes) st.opcoes = Object.assign({ somenteLeitura: false }, { somenteLeitura: !!opcoes.somenteLeitura });
    if (st.opcoes.somenteLeitura) { st.aba = 'dominio'; st.espaco = 'catalogo'; }
    var el = raiz();
    if (!el) return;
    ligar();
    var s = sessao();
    var email = s ? s.email : null;
    if (st.email !== email) {
      st.email = email; st.espaco = 'catalogo'; st.busca = ''; st.meta = { estado: 'ocioso', cargaFeita: false }; st.indiceFilhos = { estado: 'ocioso', existe: false }; st.importacao = null; st.flash = null; st.vista = 'lista'; st.aba = 'dominio'; st.hg = novoHG(); st.exp = null; st.detAbertos = {}; st.rolagemLista = null; st.lig = { estado: 'ocioso', mapa: {} }; st.cargaLig = null; st.ligPos = { estado: 'ocioso', mapa: {} }; st.cargaLigPos = null;
      ORDEM_DOMINIOS.forEach(function (d) { st.d[d] = novoDominio(); });
    }
    if (!adminPronto()) {
      render();
      window.addEventListener('fa-admin-ready', function onAdm() { window.removeEventListener('fa-admin-ready', onAdm); abrir(); });
      return;
    }
    if (!ehAdmin()) { render(); return; }
    if (st.meta.estado === 'ocioso' || st.meta.estado === 'erro') carregarMeta();
    if (st.lig.estado === 'ocioso' || st.lig.estado === 'erro') carregarLigacoes('arquitetural');
    if (st.ligPos.estado === 'ocioso' || st.ligPos.estado === 'erro') carregarLigacoes('organizacional');
    /* o acesso "Verificações do sistema" (e o seu estado) confere os conceitos dos DOIS domínios: quem o vê lê os dois */
    if (podeVerHG()) ORDEM_DOMINIOS.forEach(function (d) { if (d !== st.dominio && st.d[d].estado === 'ocioso') carregarDominio(d); });
    var D = st.d[st.dominio];
    if (D.estado === 'ocioso' || D.estado === 'erro') carregarDominio(st.dominio); else render();
  }

  /* Quem abre a aba é o ativador de abas do ADMIN (admin.js, ativarAba): um caminho só para o clique, o atalho do Início,
     o link do Manual e o F5 — sem ouvinte de clique próprio aqui, para não inicializar duas vezes. */

  window.faTaxonomia = {
    abrir: abrir,
    prepararImportacao: prepararImportacao,
    DOMINIOS: DOMINIOS,
    /* Só para teste: permite rodar as MESMAS operações da tela contra o emulador com as regras reais
       (teste-rules-taxonomia.js) e provar que o que a aplicação grava, o banco aceita. */
    _interno: {
      st: st, espera: ESPERA, leitores: LEITORES, carregarHG: carregarHG, lerTudoParaExportar: lerTudoParaExportar, linhasExportacao: linhasExportacao, consolidarConceitos: consolidarConceitos, carregarDominio: carregarDominio, carregarDetalhe: carregarDetalhe,
      publicarDefinicao: publicarDefinicao, salvarConceito: salvarConceito, salvarPerfilLote: salvarPerfilLote, novoPerfilLote: novoPerfilLote, atributosOrdenados: atributosOrdenados,
      carregarLigacoes: carregarLigacoes, previaLigacoes: previaLigacoes, avaliarIntegracao: avaliarIntegracao, estadoIntegracao: estadoIntegracao, registrarLigacoes: registrarLigacoes, inativarConceito: inativarConceito, reativarConceito: reativarConceito, alterarCamada: alterarCamada, carregarIndiceFilhos: carregarIndiceFilhos,
      salvarRelacao: salvarRelacao, encerrarRelacao: encerrarRelacao
    }
  };
})();
