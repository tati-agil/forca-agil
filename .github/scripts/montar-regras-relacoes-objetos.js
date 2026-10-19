/* Monta as regras da E4 — RELAÇÕES ENTRE OBJETOS ARQUITETURAIS — em database.rules.json, a partir da matriz do núcleo
 * (forca-agil/relacoes-objetos-nucleo.js; nada listado à mão aqui):
 *   relacoes-objetos-config     marcador gravacaoHabilitada (só leitura para os três perfis; nenhum cliente grava)
 *   relacoes-objetos            registros, ativa-por-chave, versao-compoe, eventos, operacoes
 *   objetos-natureza            a natureza individual registrada por objeto (camadas conjuntas)
 *   objetos-natureza-auditoria  histórico só de acréscimo do registro acima
 *   taxonomia/arquitetural      conceitos/<c>/naturezaDe (a camada do motor que contém a natureza individual) e o tipo de
 *                               auditoria 'conceito_criado' — o resto da Taxonomia não muda
 *
 * O que as regras garantem (provado no emulador por teste-rules-relacoes-objetos.js):
 *   - leitura: os três perfis da Avaliação; gravação: admin geral e avaliacao-arquitetura, só com o marcador = true;
 *   - relação: só os pares da matriz; cada ponta com a natureza que o banco consegue conferir — Porta 2 ativa
 *     (responsabilidade) ou avaliação P1–P16 concluída, não excluída, do mesmo item, com Motor atual, decisão final
 *     compatível e, nas camadas conjuntas, a natureza registrada em objetos-natureza (a "ponta da cadeia" é garantida
 *     pela tela, como no Posicionamento); sem autorrelação; sem duplicata ativa (índice); sem par recíproco do mesmo tipo;
 *     "compõe" incrementa versao-compoe na mesma gravação (duas criações concorrentes não passam juntas); horário do
 *     servidor; autoria do token; evento e operação na mesma gravação; encerrar exige motivo, é final e libera o índice;
 *   - natureza individual: só com o conceito oficial da Taxonomia ativo, com definição publicada e naturezaDe = a camada
 *     da avaliação que vale; revisão anterior + 1; auditoria nova na mesma gravação; nunca se apaga;
 *   - Taxonomia: um conceito de natureza individual nasce com naturezaDe e definição; naturezaDe não muda nem se apaga.
 *
 *   node .github/scripts/montar-regras-relacoes-objetos.js --gravar   (reescreve os nós)
 *   node .github/scripts/montar-regras-relacoes-objetos.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require(path.join(__dirname, '..', '..', 'forca-agil', 'relacoes-objetos-nucleo.js'));
const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const K = "auth.token.email.replace('@','_').replace('.','_')";
const ADM = "(auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br') || root.child('fa-admins').child(" + K + ').exists()';
const TIPO = "root.child('fa-avaliacao-autorizados').child(" + K + ").child('tipo').val()";
const LEIT = 'auth != null && ((' + ADM + ') || (' + TIPO + " === 'avaliacao' || " + TIPO + " === 'avaliacao-arquitetura'))";
const ESC = 'auth != null && ((' + ADM + ') || ' + TIPO + " === 'avaliacao-arquitetura')";
const MARC = "root.child('" + R.MARCADOR + "').val() === true";
const RAIZ = R.RAIZ, NAT = R.NAT, NAT_AUD = R.NAT_AUD;
const ID = '/^[A-Za-z0-9_-]{1,60}$/';
const and = (xs) => xs.join(' && ');
const or = (xs) => '(' + xs.join(' || ') + ')';
const c = (s) => "newData.child('" + s + "')";
const v = (s) => c(s) + '.val()';
const d = (s) => "data.child('" + s + "').val()";
const naoEmBranco = (x) => x + ".replace(' ', '').replace('\\t', '').replace('\\n', '').replace('\\r', '').length > 0";
const textoObrig = (n) => ({ '.validate': 'newData.isString() && newData.val().length <= ' + n + ' && ' + naoEmBranco('newData.val()') });
const str = { '.validate': 'newData.isString()' }, num = { '.validate': 'newData.isNumber()' }, idStr = { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' };
const pessoa = { '.validate': "newData.hasChildren(['id','email'])", id: str, email: str, $outro: { '.validate': false } };
const ehAutor = (p) => v(p + '/id') + ' === auth.uid && ' + v(p + '/email') + ' === auth.token.email';

/* ---------- natureza de uma ponta, como o banco consegue conferir ---------- */
const NATS_P1P16 = R.NATUREZAS_P1P16.filter((n) => n !== 'produto');
function pontaOk(lado) {
  const ponta = v(lado === 'O' ? 'origem' : 'destino'), nat = v(lado === 'O' ? 'naturezaOrigem' : 'naturezaDestino'), campoBase = lado === 'O' ? 'baseOrigem' : 'baseDestino', base = v(campoBase);
  const AV = "root.child('avaliacoes-produto/' + " + base + ')';
  const CAM = AV + ".child('camadaSugerida/id').val()";
  const DEC = '(' + AV + ".child('decisaoFinal').exists() ? " + AV + ".child('decisaoFinal').val() : " + AV + ".child('resultadoAutomatico').val())";
  const REG = (k) => "root.child('" + NAT + "/' + " + ponta + " + '/" + k + "').val()";
  const camadaCompat = or(NATS_P1P16.map((n) => {
    const x = R.NATUREZAS[n];
    return '(' + nat + " === '" + n + "' && " + CAM + " === '" + x.camada + "'" + (x.individual ? ' && ' + REG('natureza') + " === '" + n + "' && " + REG('camada') + ' === ' + CAM : '') + ')';
  }));
  const p1p16 = and([
    c(campoBase) + '.exists()',
    '(' + AV + ".child('itemId').val() === " + ponta + ' || (!' + AV + ".child('itemId').exists() && " + base + ' === ' + ponta + '))',
    AV + ".child('status').val() === 'concluido'", AV + ".child('excluido').val() !== true", AV + ".child('motorVersion').val() === '" + MOTOR_PRODUTO + "'",
    /* a base é a versão VIGENTE do item (o índice da ponta da cadeia) — avaliação antiga, superada, é recusada */
    "root.child('" + R.PONTA + "/' + " + ponta + ').val() === ' + base,
    '(' + nat + " === 'produto' ? " + DEC + " === 'produto' : (" + DEC + " === 'nao-produto' && " + camadaCompat + '))'
  ]);
  return '(' + nat + " === 'responsabilidade' ? (root.child('objetos-organizacionais/' + " + ponta + " + '/situacao').val() === 'ativo' && !" + c(campoBase) + '.exists()) : (' + p1p16 + '))';
}
const PARES = or(R.PARES.map((p) => '(' + v('tipo') + " === '" + p.tipo + "' && " + v('naturezaOrigem') + " === '" + p.de + "' && " + v('naturezaDestino') + " === '" + p.para + "')"));
const HIER = or(Object.keys(R.TIPOS).filter((t) => R.TIPOS[t].hierarquico).map((t) => v('tipo') + " === '" + t + "'"));

/* ---------- relacoes-objetos ---------- */
const NOVA = 'newData.parent().parent()';
const chave = (a, t, b) => v(a) + " + '__' + " + v(t) + " + '__' + " + v(b);
const criar = and([
  v('situacao') + " === 'ativa'", v('revisao') + ' === 1', v('criadaEm') + ' === now', ehAutor('criadaPor'), '!' + c('encerramento') + '.exists()',
  v('origem') + ' !== ' + v('destino'), PARES, v('versaoMatriz') + ' === ' + R.VERSAO_MATRIZ, pontaOk('O'), pontaOk('D'),
  NOVA + ".child('ativa-por-chave/' + " + chave('origem', 'tipo', 'destino') + ').val() === $id',
  "!root.child('" + RAIZ + "/ativa-por-chave/' + " + chave('destino', 'tipo', 'origem') + ').exists()',
  '!' + NOVA + ".child('ativa-por-chave/' + " + chave('destino', 'tipo', 'origem') + ').exists()',
  '(' + HIER + ' ? ' + NOVA + ".child('versao-compoe').val() === (root.child('" + RAIZ + "/versao-compoe').exists() ? root.child('" + RAIZ + "/versao-compoe').val() : 0) + 1 : true)"
]);
const FIXOS = ['origem', 'tipo', 'destino', 'naturezaOrigem', 'naturezaDestino', 'baseOrigem', 'baseDestino', 'versaoMatriz', 'observacao', 'criadaEm', 'criadaPor/id', 'criadaPor/email'];
const encerrar = and([
  d('situacao') + " === 'ativa'", v('situacao') + " === 'encerrada'"].concat(FIXOS.map((f) => v(f) + ' === ' + d(f))).concat([
  v('revisao') + ' === ' + d('revisao') + ' + 1', "newData.hasChildren(['encerramento'])", v('encerramento/em') + ' === now', ehAutor('encerramento/por'),
  NOVA + ".child('ativa-por-chave/' + " + chave('origem', 'tipo', 'destino') + ').val() !== $id'
]));
const OPN = (x) => NOVA + ".child('operacoes/' + " + x + ')';
const blocoRel = {
  '.read': LEIT,
  registros: {
    $id: {
      '.write': ESC + ' && newData.exists() && ' + MARC,
      '.validate': and([
        '$id.matches(' + ID + ')',
        "newData.hasChildren(['id','origem','tipo','destino','naturezaOrigem','naturezaDestino','versaoMatriz','situacao','revisao','criadaEm','criadaPor','ultimaOperacao','ultimoEvento'])",
        v('id') + ' === $id',
        "!root.child('" + RAIZ + "/operacoes/' + " + v('ultimaOperacao') + ').exists()', OPN(v('ultimaOperacao')) + '.exists()',
        v('ultimoEvento') + ' === ' + v('ultimaOperacao') + " + ':1'",
        NOVA + ".child('eventos/' + " + v('ultimoEvento') + " + '/entidadeId').val() === $id",
        '(!data.exists() ? (' + criar + ') : (' + encerrar + '))'
      ]),
      id: str, origem: idStr, destino: idStr, tipo: str, naturezaOrigem: str, naturezaDestino: str, baseOrigem: idStr, baseDestino: idStr,
      versaoMatriz: num, observacao: textoObrig(R.MAX.observacao),
      situacao: { '.validate': "newData.val() === 'ativa' || newData.val() === 'encerrada'" },
      revisao: { '.validate': 'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0' },
      criadaEm: num, criadaPor: pessoa, ultimaOperacao: idStr, ultimoEvento: str,
      encerramento: { '.validate': "newData.hasChildren(['motivo','em','por'])", motivo: textoObrig(R.MAX.motivo), em: num, por: pessoa, $outro: { '.validate': false } },
      $outro: { '.validate': false }
    }
  },
  'ativa-por-chave': {
    $chave: {
      '.write': ESC + ' && ' + MARC + " && (newData.exists() ? (" + and([
        NOVA + ".child('registros/' + newData.val() + '/situacao').val() === 'ativa'",
        NOVA + ".child('registros/' + newData.val() + '/origem').val() + '__' + " + NOVA + ".child('registros/' + newData.val() + '/tipo').val() + '__' + " + NOVA + ".child('registros/' + newData.val() + '/destino').val() === $chave",
        "!root.child('" + RAIZ + "/operacoes/' + " + NOVA + ".child('registros/' + newData.val() + '/ultimaOperacao').val()).exists()",
        '(!data.exists() || ' + NOVA + ".child('registros/' + data.val() + '/situacao').val() === 'encerrada')"
      ]) + ') : (data.exists() && ' + NOVA + ".child('registros/' + data.val() + '/situacao').val() === 'encerrada'))",
      '.validate': 'newData.isString()'
    }
  },
  'versao-compoe': {
    '.write': ESC + ' && ' + MARC,
    '.validate': 'newData.isNumber() && newData.val() === (data.exists() ? data.val() : 0) + 1'
  },
  eventos: {
    $ev: {
      '.write': ESC + ' && !data.exists() && newData.exists() && ' + MARC,
      '.validate': and([
        '$ev.matches(/^[A-Za-z0-9_-]{1,60}:1$/)', "newData.hasChildren(['id','operacaoId','tipo','entidadeId','usuario','em','depois'])",
        v('id') + ' === $ev', '$ev === ' + v('operacaoId') + " + ':1'", ehAutor('usuario'), v('em') + ' === now',
        "!root.child('" + RAIZ + "/operacoes/' + " + v('operacaoId') + ').exists()', OPN(v('operacaoId')) + '.exists()',
        NOVA + ".child('registros/' + " + v('entidadeId') + " + '/ultimoEvento').val() === $ev",
        '(' + v('tipo') + " === 'relacao.criada' ? " + NOVA + ".child('registros/' + " + v('entidadeId') + " + '/revisao').val() === 1 : (" + v('tipo') + " === 'relacao.encerrada' && " + NOVA + ".child('registros/' + " + v('entidadeId') + " + '/situacao').val() === 'encerrada'))"
      ].concat(['origem', 'tipo', 'destino', 'situacao', 'revisao', 'naturezaOrigem', 'naturezaDestino'].map((f) => v('depois/' + f) + ' === ' + NOVA + ".child('registros/' + " + v('entidadeId') + " + '/" + f + "').val()"))),
      id: str, operacaoId: idStr, tipo: str, entidadeId: idStr, usuario: pessoa, em: num, depois: { '.validate': 'newData.hasChildren()' }, $outro: { '.validate': false }
    }
  },
  operacoes: {
    $op: {
      '.write': ESC + ' && !data.exists() && newData.exists() && ' + MARC,
      '.validate': and([
        '$op.matches(' + ID + ')', "newData.hasChildren(['tipo','relacaoId','usuario','em'])", v('em') + ' === now', ehAutor('usuario'),
        "(" + v('tipo') + " === 'criarRelacao' || " + v('tipo') + " === 'encerrarRelacao')",
        NOVA + ".child('eventos/' + $op + ':1/operacaoId').val() === $op", NOVA + ".child('eventos/' + $op + ':1/entidadeId').val() === " + v('relacaoId')
      ]),
      tipo: str, relacaoId: idStr, usuario: pessoa, em: num, $outro: { '.validate': false }
    }
  }
};

/* ---------- objetos-natureza/$objetoId ---------- */
const CAMADA_DA_NAT = or(R.CODIGOS_INDIVIDUAIS.map((n) => '(' + v('natureza') + " === '" + n + "' && " + v('camada') + " === '" + R.NATUREZAS[n].camada + "')"));
const TAX = "root.child('taxonomia/arquitetural/conceitos/' + " + v('natureza') + ')';
const AVN = "root.child('avaliacoes-produto/' + " + v('avaliacaoId') + ')';
const DECN = '(' + AVN + ".child('decisaoFinal').exists() ? " + AVN + ".child('decisaoFinal').val() : " + AVN + ".child('resultadoAutomatico').val())";
const AUDN = "newData.parent().parent().child('" + NAT_AUD + "/' + $objetoId + '/' + " + v('auditoriaId') + ')';
/* identificação orientada (19/10/2026): o registro tem UM de dois estados exclusivos — natureza identificada (com o
   fundamento: pergunta, alternativa, justificativa, versão da orientação e definições da época) ou identificação PENDENTE
   (sem natureza: recorte, evidência insuficiente ou reavaliação P1–P16 necessária, com diagnóstico e justificativa). A
   pendência só existe nas classificações técnicas que admitem mais de uma natureza (ou Regra/Opção); a reavaliação só a
   partir de Regra/Opção. A auditoria da mesma gravação repete o fundamento ou a pendência (snapshot histórico). */
const CAMADAS_IDENT = or(Object.keys(R.INDIVIDUAIS_DA_CAMADA).map((k) => v('camada') + " === '" + k + "'"));
const MOTIVO_OK = or(R.MOTIVOS_PENDENCIA.map((m) => v('pendencia/motivo') + " === '" + m + "'"));
const IDENTIFICADA = and([
  '!' + c('pendencia') + '.exists()', c('fundamento') + '.exists()',
  CAMADA_DA_NAT,
  TAX + ".child('ativo').val() === true", TAX + ".child('definicao/texto').exists()", TAX + ".child('naturezaDe').val() === " + v('camada'),
  AUDN + ".child('fundamento/justificativa').val() === " + v('fundamento/justificativa'), AUDN + ".child('fundamento/alternativa').val() === " + v('fundamento/alternativa'),
  AUDN + ".child('fundamento/versao').val() === " + v('fundamento/versao')
]);
const PENDENTE = and([
  '!' + c('fundamento') + '.exists()', c('pendencia') + '.exists()', CAMADAS_IDENT, MOTIVO_OK,
  '(' + v('pendencia/motivo') + " !== 'reavaliacao-necessaria' || " + v('camada') + " === 'regra-condicao')",
  AUDN + ".child('pendencia/motivo').val() === " + v('pendencia/motivo'), AUDN + ".child('pendencia/justificativa').val() === " + v('pendencia/justificativa'),
  AUDN + ".child('pendencia/diagnostico').val() === " + v('pendencia/diagnostico'), AUDN + ".child('pendencia/versao').val() === " + v('pendencia/versao')
]);
const definicoesSnap = { $nat: { '.validate': "newData.hasChildren(['texto','versao'])", texto: textoObrig(8000), versao: num, $outro: { '.validate': false } } };
const fundamentoSchema = (comMotivo) => Object.assign({
  '.validate': "newData.hasChildren(['versao','pergunta','alternativa','rotulo','justificativa'" + (comMotivo ? ",'motivo','diagnostico'" : '') + '])',
  versao: { '.validate': 'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0' }, pergunta: textoObrig(2000), alternativa: textoObrig(60), rotulo: textoObrig(500),
  justificativa: textoObrig(2000), definicoes: definicoesSnap, $outro: { '.validate': false }
}, comMotivo ? { motivo: str, diagnostico: textoObrig(2000) } : {});
const blocoNat = {
  '.read': LEIT,
  $objetoId: {
    '.write': ESC + ' && newData.exists() && ' + MARC,
    '.validate': and([
      '$objetoId.matches(' + ID + ')',
      "newData.hasChildren(['camada','avaliacaoId','revisao','registradaEm','registradaPor','auditoriaId'])",
      '(' + c('natureza') + '.exists() ? (' + IDENTIFICADA + ') : (' + PENDENTE + '))',
      '(' + AVN + ".child('itemId').val() === $objetoId || (!" + AVN + ".child('itemId').exists() && " + v('avaliacaoId') + ' === $objetoId))',
      AVN + ".child('status').val() === 'concluido'", AVN + ".child('excluido').val() !== true", AVN + ".child('motorVersion').val() === '" + MOTOR_PRODUTO + "'",
      "root.child('" + R.PONTA + "/' + $objetoId).val() === " + v('avaliacaoId'), /* só a versão VIGENTE do item */
      AVN + ".child('camadaSugerida/id').val() === " + v('camada'), DECN + " === 'nao-produto'",
      v('registradaEm') + ' === now', ehAutor('registradaPor'),
      v('revisao') + ' === (data.exists() ? ' + d('revisao') + ' + 1 : 1)',
      "!root.child('" + NAT_AUD + "/' + $objetoId + '/' + " + v('auditoriaId') + ').exists()',
      AUDN + ".child('tipo').val() === (" + c('natureza') + ".exists() ? (data.exists() ? 'alteracao' : 'registro') : 'pendencia')",
      AUDN + ".child('natureza').val() === " + v('natureza'), AUDN + ".child('camada').val() === " + v('camada'),
      AUDN + ".child('avaliacaoId').val() === " + v('avaliacaoId'), AUDN + ".child('revisao').val() === " + v('revisao')
    ]),
    natureza: str, camada: str, avaliacaoId: idStr, revisao: { '.validate': 'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0' },
    registradaEm: num, registradaPor: pessoa, auditoriaId: idStr, fundamento: fundamentoSchema(false), pendencia: fundamentoSchema(true), $outro: { '.validate': false }
  }
};
const NATR = "root.child('" + NAT + "/' + $objetoId)";
const NATN = "newData.parent().parent().parent().child('" + NAT + "/' + $objetoId)";
const blocoNatAud = {
  '.read': LEIT,
  $objetoId: {
    $aud: {
      '.write': ESC + ' && !data.exists() && newData.exists() && ' + MARC,
      '.validate': and([
        '$aud.matches(' + ID + ')', "newData.hasChildren(['tipo','camada','avaliacaoId','revisao','em','por'])", v('em') + ' === now', ehAutor('por'),
        NATN + ".child('auditoriaId').val() === $aud", NATN + ".child('revisao').val() === " + v('revisao'),
        /* registro: não havia nada; alteração: havia; pendência: havia ou não. "anterior" = a natureza que havia (nunca inventada) */
        '(' + v('tipo') + " === 'registro' ? !" + NATR + '.exists() : (' + v('tipo') + " === 'alteracao' ? " + NATR + '.exists() : ' + v('tipo') + " === 'pendencia'))",
        '(' + NATR + ".child('natureza').exists() ? " + v('anterior') + ' === ' + NATR + ".child('natureza').val() : !" + c('anterior') + '.exists())',
        '(' + v('tipo') + " === 'pendencia' ? (" + c('pendencia') + '.exists() && !' + c('natureza') + '.exists()) : (' + c('natureza') + '.exists() && ' + c('fundamento') + '.exists()))'
      ]),
      tipo: str, natureza: str, camada: str, avaliacaoId: idStr, revisao: num, em: num, por: pessoa, anterior: str,
      fundamento: fundamentoSchema(false), pendencia: fundamentoSchema(true), $outro: { '.validate': false }
    }
  }
};
const blocoCfg = { '.read': LEIT, '.write': false };

/* ---------- Taxonomia arquitetural: naturezaDe e o tipo de auditoria 'conceito_criado' (aplicado sobre o que existe) ---------- */
const COD_INDIV = or(R.CODIGOS_INDIVIDUAIS.map((n) => "$codigo === '" + n + "'"));
const NATDE_OK = or(R.CODIGOS_INDIVIDUAIS.map((n) => "($codigo === '" + n + "' && newData.val() === '" + R.NATUREZAS[n].camada + "')"));
const EXIGE_CONCEITO = " && (!data.exists() && " + COD_INDIV + " ? (newData.child('naturezaDe').exists() && newData.child('definicao').exists()) : true) && (!data.child('naturezaDe').exists() || newData.child('naturezaDe').val() === data.child('naturezaDe').val())";
const AUD_TIPO = "newData.child('tipo').val() === 'conceito_criado'";
function taxonomiaComE4(tax) {
  const t = JSON.parse(JSON.stringify(tax));
  const C = t.arquitetural.conceitos.$codigo;
  if (C['.validate'].indexOf(EXIGE_CONCEITO) === -1) C['.validate'] += EXIGE_CONCEITO;
  const outro = C.$outro; delete C.$outro;
  C.naturezaDe = { '.read': C.nome['.read'], '.validate': 'newData.isString() && ' + NATDE_OK + ' && (!data.exists() || newData.val() === data.val())' };
  C.$outro = outro;
  const A = t.arquitetural.auditoria.$codigo.$pushKey;
  if (A['.validate'].indexOf(AUD_TIPO) === -1) A['.validate'] = A['.validate'].replace("newData.child('tipo').val() === 'alteracao_conceito' || ", "newData.child('tipo').val() === 'alteracao_conceito' || " + AUD_TIPO + ' || ');
  return t;
}

/* ---------- versão VIGENTE de cada item P1–P16 (alternativa B, aprovada em 18/10/2026) ----------
   avaliacoes-produto-ponta/<itemId> = a chave da PONTA da cadeia de reavaliações (mesmo em andamento ou excluída).
   - nasce na MESMA gravação que cria a primeira versão do item, e avança um passo na MESMA gravação que cria uma
     reavaliação (versaoAnteriorKey = a ponta atual): duas reavaliações da mesma ponta ao mesmo tempo → só uma entra;
   - nunca volta, não pula, não aponta para registro de outro item, não se apaga;
   - item antigo ainda sem índice (anterior a esta regra): a primeira gravação do índice é a da reconciliação
     (reconciliar-versao-vigente.js, conta de serviço) ou a da próxima reavaliação; até lá, a E4 recusa o item;
   - nenhuma versão de avaliação se apaga (histórico preservado), então o índice nunca aponta para o vazio. */
const PONTA = R.PONTA, PROD = 'avaliacoes-produto';
const REC = "newData.parent().parent().child('" + PROD + "/' + newData.val())";
function blocoPonta(regras) {
  const P = produtoComPonta(regras[PROD]); /* a mesma escrita das avaliações (já sem apagar) — idempotente */
  return {
    '.read': P['.read'],
    $itemId: {
      '.write': P.$key['.write'],
      '.validate': and([
        '$itemId.matches(/^[A-Za-z0-9_-]{1,60}$/)', 'newData.isString()', REC + '.exists()',
        '(' + REC + ".child('itemId').val() === $itemId || (!" + REC + ".child('itemId').exists() && newData.val() === $itemId))",
        '(!data.exists() || newData.val() === data.val() || ' + REC + ".child('versaoAnteriorKey').val() === data.val())"
      ])
    }
  };
}
const ITEM_P = "(newData.child('itemId').exists() ? newData.child('itemId').val() : $key)";
const PONTA_RAIZ = "root.child('" + PONTA + "/' + " + ITEM_P + ')';
const PONTA_NOVA = "newData.parent().parent().child('" + PONTA + "/' + " + ITEM_P + ')';
const CRIA_COM_PONTA = " && (data.exists() || (" + PONTA_NOVA + ".val() === $key && (newData.child('versaoAnteriorKey').exists() ? (!" + PONTA_RAIZ + '.exists() || ' + PONTA_RAIZ + ".val() === newData.child('versaoAnteriorKey').val()) : !" + PONTA_RAIZ + '.exists())))';
const NAO_APAGA = ' && newData.exists()';
function produtoComPonta(prod) {
  const p = JSON.parse(JSON.stringify(prod));
  const K = p.$key;
  if (K['.write'].slice(-NAO_APAGA.length) !== NAO_APAGA) K['.write'] += NAO_APAGA;
  if (K['.validate'].indexOf(CRIA_COM_PONTA) === -1) K['.validate'] += CRIA_COM_PONTA;
  return p;
}

function montar(regras) {
  return {
    'relacoes-objetos-config': blocoCfg, [RAIZ]: blocoRel, [NAT]: blocoNat, [NAT_AUD]: blocoNatAud,
    taxonomia: taxonomiaComE4(regras.taxonomia),
    [PROD]: produtoComPonta(regras[PROD]), [PONTA]: blocoPonta(regras)
  };
}
module.exports = { montar, taxonomiaComE4, produtoComPonta, NOS: ['relacoes-objetos-config', RAIZ, NAT, NAT_AUD, 'taxonomia', PROD, PONTA] };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const BLOCOS = montar(regras);
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGEM de database.rules.json: ' + divergentes.join(', ') : 'os nós da E4 publicados são os montados');
    process.exit(divergentes.length ? 1 : 0);
  }
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(BLOCOS).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    if (ini === -1) { const fim = s.lastIndexOf('\n  }'); s = s.slice(0, fim) + ',\n    "' + n + '": ' + ind(BLOCOS[n]) + s.slice(fim); return; }
    const abre = s.indexOf('{', ini);
    let prof = 0, i = abre, emTexto = false;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (emTexto) { if (ch === '\\') i++; else if (ch === '"') emTexto = false; continue; }
      if (ch === '"') emTexto = true; else if (ch === '{') prof++; else if (ch === '}' && --prof === 0) break;
    }
    s = s.slice(0, abre) + ind(BLOCOS[n]) + s.slice(i + 1);
  });
  JSON.parse(s);
  fs.writeFileSync(ARQUIVO, s);
  console.log('gravado: ' + s.length + ' bytes');
}
