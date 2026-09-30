/* ============================================================
   Força Ágil — Catálogo de Naturezas Complementares (window.faNaturezas)

   "Natureza complementar" é uma descrição MANUAL e OPCIONAL de que tipo de
   item é uma avaliação de Produto/Serviço (ex.: "Programa transversal",
   "Plataforma/estrutura de benefícios e parcerias"). Não é uma camada, não
   entra no motor, não muda respostas nem classificação — este módulo só
   guarda a LISTA de opções que a tela oferece, para que ela possa ser
   ajustada por configuração, sem editar código, sem PR, sem deploy.

   Node no Firebase:
   naturezas-complementares-config/<codigoEstavel> = {
     codigoEstavel, nome, descricao, ativo (bool), ordem (número),
     atualizadoEm, atualizadoPor
   }
   naturezas-complementares-auditoria/<avaliacaoId>/<pushKey> = {
     tipo: 'alteracao_natureza_complementar', avaliacaoId, avaliacaoNome,
     valorAnterior: {codigo, nome} | null, valorNovo: {codigo, nome} | null,
     usuario, dataHora
   }
   naturezas-complementares-auditoria/catalogo/<pushKey> = {
     tipo: 'alteracao_catalogo_natureza', codigo, campo, valorAnterior,
     valorNovo, usuario, dataHora
   }
   ('catalogo' nunca colide com um avaliacaoId: chaves de avaliação são
   chaves push do Firebase, que começam por '-'.)

   codigoEstavel é o identificador IMUTÁVEL de uma opção — nome e descrição
   podem ser ajustados a qualquer momento; a avaliação guarda o código E o
   nome/descrição DA ÉPOCA, então renomear ou desativar uma opção nunca
   reescreve o que já foi registrado.

   Quando o node ainda não existe (instalação nova, ou nenhuma edição feita),
   a lista é a de FÁBRICA (PADRAO abaixo), os dois casos reais que originaram
   a funcionalidade. O que existir no Firebase SOBREPÕE a fábrica por
   código: desativar uma opção de fábrica é gravar ativo:false nela. Nenhuma
   gravação acontece sozinha — a fábrica só é copiada para o banco quando um
   admin edita uma opção. */
(function () {
  var NODE_CONFIG = 'naturezas-complementares-config';
  var NODE_AUDITORIA = 'naturezas-complementares-auditoria';

  function db() { return firebase.database(); }

  var PADRAO = {
    PROGRAMA_TRANSVERSAL: {
      codigoEstavel: 'PROGRAMA_TRANSVERSAL', nome: 'Programa transversal', ativo: true, ordem: 1,
      descricao: 'Programa com identidade, propósito, resultados e governança próprios, mas que reúne diferentes iniciativas e não tem fronteira, jornada ou autonomia estrutural únicas.'
    },
    PLATAFORMA_BENEFICIOS_PARCERIAS: {
      codigoEstavel: 'PLATAFORMA_BENEFICIOS_PARCERIAS', nome: 'Plataforma/estrutura de benefícios e parcerias', ativo: true, ordem: 2,
      descricao: 'Plataforma ou estrutura que reúne benefícios e parcerias oferecidos por meio de um canal, sem ser, ela própria, um Produto/Serviço principal.'
    }
  };

  var cache = null;      /* o que veio do Firebase (objeto) — null enquanto não chegou */
  var estado = 'carregando'; /* 'carregando' | 'ok' | 'erro' */
  var iniciado = false;
  var ouvintes = [];

  function notificar() { ouvintes.slice().forEach(function (cb) { try { cb(); } catch (e) { console.error('[naturezas]', e); } }); }

  /* Liga uma única leitura ao vivo do catálogo. Idempotente. Enquanto a
     primeira leitura não chega, estado() devolve 'carregando' — quem mostra
     o seletor NÃO pode tratar "ainda não sei" como "lista de fábrica" (uma
     opção desativada ou renomeada no banco poderia ser escolhida por engano). */
  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    try {
      db().ref(NODE_CONFIG).on('value', function (snap) {
        cache = snap.val() || {};
        estado = 'ok';
        notificar();
      }, function (err) {
        console.error('[naturezas] não foi possível ler o catálogo:', err);
        estado = 'erro';
        notificar();
      });
    } catch (e) {
      console.error('[naturezas] erro ao iniciar a leitura do catálogo:', e);
      estado = 'erro';
    }
  }
  function aoMudar(cb) { iniciar(); ouvintes.push(cb); }

  function normalizar(o, codigo) {
    return {
      codigoEstavel: codigo,
      nome: String(o.nome || '').trim(),
      descricao: String(o.descricao || '').trim(),
      ativo: o.ativo !== false,
      ordem: Number(o.ordem) || 0
    };
  }

  /* Catálogo completo: fábrica + o que o Firebase sobrepõe, por código. */
  function todas() {
    var mapa = {};
    Object.keys(PADRAO).forEach(function (c) { mapa[c] = normalizar(PADRAO[c], c); });
    var remoto = cache || {};
    Object.keys(remoto).forEach(function (c) {
      var o = remoto[c];
      if (!o || typeof o !== 'object') return;
      mapa[c] = normalizar(Object.assign({}, mapa[c] || {}, o), c);
    });
    return Object.keys(mapa).map(function (c) { return mapa[c]; })
      .filter(function (o) { return o.nome; })
      .sort(function (a, b) { return a.ordem - b.ordem || a.nome.localeCompare(b.nome); });
  }
  /* O que a tela de edição de UMA avaliação oferece: só as ativas — mais a
     que já está registrada nela (mesmo desativada depois), para o seletor
     nunca parecer "vazio" numa avaliação que tem natureza. */
  function opcoesParaSelecao(codigoJaRegistrado) {
    return todas().filter(function (o) { return o.ativo || o.codigoEstavel === codigoJaRegistrado; });
  }
  function porCodigo(codigo) {
    var r = todas().filter(function (o) { return o.codigoEstavel === codigo; });
    return r[0] || null;
  }

  /* Código a partir do nome: MAIÚSCULAS, sem acento, _ no lugar de espaço e
     pontuação. Gerado UMA vez, na criação — depois é imutável. */
  function codigoDeNome(nome) {
    var c = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return c.slice(0, 60);
  }
  function codigoValido(codigo) { return /^[A-Z][A-Z0-9_]{0,59}$/.test(String(codigo || '')); }

  /* Grava UMA opção (criação ou edição) e, na mesma gravação atômica, uma
     linha de auditoria por campo alterado. Nunca apaga opção — desativar é
     ativo:false. cb(err). */
  function salvarOpcao(opcao, usuario, cb) {
    var codigo = opcao.codigoEstavel;
    if (!codigoValido(codigo)) { cb(new Error('Código inválido.')); return; }
    var nome = String(opcao.nome || '').trim();
    if (!nome) { cb(new Error('Informe o nome da opção.')); return; }
    var anterior = porCodigo(codigo);
    var nova = {
      codigoEstavel: codigo, nome: nome, descricao: String(opcao.descricao || '').trim(),
      ativo: opcao.ativo !== false, ordem: Number(opcao.ordem) || 0
    };
    var agora = new Date().toISOString();
    var updates = {};
    updates[NODE_CONFIG + '/' + codigo] = Object.assign({}, nova, { atualizadoEm: agora, atualizadoPor: usuario || null });
    ['nome', 'descricao', 'ativo', 'ordem'].forEach(function (campo) {
      var antes = anterior ? anterior[campo] : null;
      if (anterior && antes === nova[campo]) return;
      updates[NODE_AUDITORIA + '/catalogo/' + db().ref(NODE_AUDITORIA + '/catalogo').push().key] = {
        tipo: 'alteracao_catalogo_natureza', codigo: codigo, campo: campo,
        valorAnterior: anterior ? antes : null, valorNovo: nova[campo],
        usuario: usuario || null, dataHora: agora
      };
    });
    try {
      db().ref().update(updates, function (err) { cb(err || null); });
    } catch (e) { cb(e); }
  }

  window.faNaturezas = {
    NODE_CONFIG: NODE_CONFIG, NODE_AUDITORIA: NODE_AUDITORIA, PADRAO: PADRAO,
    iniciar: iniciar, aoMudar: aoMudar, estado: function () { return estado; },
    todas: todas, opcoesParaSelecao: opcoesParaSelecao, porCodigo: porCodigo,
    codigoDeNome: codigoDeNome, codigoValido: codigoValido, salvarOpcao: salvarOpcao
  };
})();
