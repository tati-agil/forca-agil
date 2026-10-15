/* Monta as regras dos 9 nós da ANÁLISE ORGANIZACIONAL (Porta 2) em database.rules.json:
 *   analises-organizacionais, analises-organizacionais-auditoria, analises-propostas, analises-aprovacoes,
 *   analises-por-objeto, analises-organizacionais-config, analises-organizacionais-config-auditoria,
 *   analises-organizacionais-excluidas (registro mínimo de cada exclusão),
 *   analises-recortes-em-proposta (cada responsabilidade citada numa proposta registrada).
 *
 * O que as regras garantem (provado no emulador por teste-rules-analises-organizacionais.js):
 *   - MARCADOR DE HOMOLOGAÇÃO (analises-organizacionais-config/habilitacao; ausente = DESLIGADO) vale nas OPERAÇÕES DE
 *     DADOS, não só na tela: DESLIGADO → ninguém lê nem grava as análises; SOMENTE_ADMIN_GERAL → só o admin geral;
 *     LIBERADO_PARA_PERFIS_AUTORIZADOS → leem os três perfis da Avaliação, gravam admin geral e avaliacao-arquitetura;
 *     só o admin geral muda o marcador, com motivo e auditoria própria (só acréscimo);
 *   - análise: revisão 1 → revisão anterior + 1 (gravação velha é recusada); criação, escopo e objeto amplo fixos;
 *     horário do SERVIDOR; autoria do token; descartada é final; toda gravação traz o seu evento de auditoria novo;
 *   - recorte avaliado: a atuação ligada nunca muda e só existe com o índice de origem; uma atuação tem no máximo uma
 *     análise de origem (analises-por-objeto, criado uma vez, nunca alterado nem apagado);
 *   - proposta: imutável, versão = vigente anterior + 1 na MESMA gravação que atualiza a análise; só alternativas
 *     aprovadas (nenhuma reclassifica); pendente exige a pendência;
 *   - aprovação: só o admin geral, referência a ATO EXTERNO (natureza fixa), só da proposta vigente e não pendente,
 *     uma por versão, imutável, com evento de auditoria na mesma gravação.
 *   - EXCLUSÃO (contrato em dois níveis): a análise sai de verdade, numa gravação com o registro mínimo (nome, motivo,
 *     nível, quem, quando) e o evento 'analise.excluida'. Comum (quem grava análises): sem nenhuma responsabilidade e
 *     sem proposta. Excepcional (só admin geral): com responsabilidades ou propostas — as atuações cadastradas, o índice
 *     de origem, as propostas e a auditoria ficam (nada em cascata). Com aprovação registrada: recusada sempre (o ato
 *     externo continua apontando para a análise). O id excluído não renasce.
 *   - GRAVAÇÃO POR CAMPO: depois de criada, a análise só se grava campo a campo (cada responsabilidade no seu caminho);
 *     a análise inteira só se grava ao nascer ou ao sair com o registro mínimo. Assim o banco confere CADA responsabilidade
 *     que sai: com cadastro (objetoId) nunca sai, e o objetoId nunca muda nem some; citada numa proposta registrada
 *     (índice analises-recortes-em-proposta, completo por construção: cada posição da lista da proposta exige a entrada)
 *     nunca sai; numa análise com proposta anterior a este índice (sem `indexada` na v1), nenhuma responsabilidade sai.
 *     A revisão + 1 e o evento de auditoria continuam conferidos na análise a cada gravação (o .validate dela roda).
 * O nó das atuações (objetos-organizacionais) não muda: a atuação criada a partir de um recorte passa pelas regras dele.
 *
 *   node .github/scripts/montar-regras-analises-organizacionais.js --gravar   (reescreve os 9 nós)
 *   node .github/scripts/montar-regras-analises-organizacionais.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const K = "auth.token.email.replace('@','_').replace('.','_')";
const ADM = "(auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br') || root.child('fa-admins').child(" + K + ").exists()";
const TIPO = "root.child('fa-avaliacao-autorizados').child(" + K + ").child('tipo').val()";
const AN = 'analises-organizacionais', AUD = 'analises-organizacionais-auditoria', PROP = 'analises-propostas', APROV = 'analises-aprovacoes';
const IDX = 'analises-por-objeto', CFG = 'analises-organizacionais-config', CFG_AUD = 'analises-organizacionais-config-auditoria', EXC = 'analises-organizacionais-excluidas';
const CIT = 'analises-recortes-em-proposta';
const OBJ = 'objetos-organizacionais';
const HAB = "root.child('" + CFG + "').child('habilitacao').val()";
const SO_GERAL = HAB + " === 'SOMENTE_ADMIN_GERAL'", LIBERADO = HAB + " === 'LIBERADO_PARA_PERFIS_AUTORIZADOS'";
const PERFIS = "auth != null && ((" + ADM + ") || " + TIPO + " === 'avaliacao' || " + TIPO + " === 'avaliacao-arquitetura')";
const LER = "auth != null && ((" + SO_GERAL + " && (" + ADM + ")) || (" + LIBERADO + " && ((" + ADM + ") || " + TIPO + " === 'avaliacao' || " + TIPO + " === 'avaliacao-arquitetura')))";
const GRAVAR = "auth != null && ((" + SO_GERAL + " && (" + ADM + ")) || (" + LIBERADO + " && ((" + ADM + ") || " + TIPO + " === 'avaliacao-arquitetura')))";
const APROVAR = "auth != null && (" + ADM + ") && (" + SO_GERAL + " || " + LIBERADO + ")";
const ID = '/^[A-Za-z0-9_-]{1,60}$/';
const and = (xs) => xs.join(' && ');
const umDe = (x, lista) => '(' + lista.map((v) => x + " === '" + v + "'").join(' || ') + ')';
const naoEmBranco = (x) => x + ".replace(' ', '').replace('\\t', '').replace('\\n', '').replace('\\r', '').length > 0";
const texto = (n) => ({ '.validate': 'newData.isString() && newData.val().length <= ' + n + ' && ' + naoEmBranco('newData.val()') });
const ESCOPOS = ['responsabilidade', 'estrutura', 'grande-area', 'conjunto', 'capacidade', 'atuacao-informal'];
const ALTERNATIVAS = ['manter-consciente', 'rever-delimitacao', 'integrar-recortes', 'distribuir-existentes', 'propor-estrutura', 'pendente'];
const HABILITACOES = ['DESLIGADO', 'SOMENTE_ADMIN_GERAL', 'LIBERADO_PARA_PERFIS_AUTORIZADOS'];
const autoria = (campo) => ({ '.validate': "newData.child('uid').val() === auth.uid && newData.child('email').val() === auth.token.email" });
const autoriaId = { '.validate': "newData.child('id').val() === auth.uid" };
const PV = "newData.child('propostaVigente').val()", PV_ANT = "data.child('propostaVigente').val()";

/* depois de criada: só campo a campo, e só enquanto aberta (descartada é final) */
const CAMPO_W = GRAVAR + " && root.child('" + AN + "').child($id).child('situacao').val() === 'aberta'";
const comW = (regra) => Object.assign({ '.write': CAMPO_W }, regra || {});
/* raiz NOVA vista de analises-organizacionais/$id/recortes/$r */
const RAIZ_R = 'newData.parent().parent().parent().parent()';
/* uma responsabilidade só sai da análise sem cadastro, sem citação em proposta registrada e sem proposta antiga não indexada */
const SAI_RECORTE = and([
  "!data.child('objetoId').exists()",
  '!' + RAIZ_R + ".child('" + CIT + "').child($id).child($r).exists()",
  "(!root.child('" + PROP + "').child($id).exists() || root.child('" + PROP + "').child($id).child('v1').child('indexada').val() === true)"
]);
const blocoAnalise = {
  '.read': LER,
  $id: {
    /* a análise inteira: só nasce (gravação nova) ou sai com o registro mínimo; o resto é por campo */
    '.write': GRAVAR + " && (newData.exists() ? !data.exists() : (data.exists() && newData.parent().parent().child('" + EXC + "').child($id).exists() && !root.child('" + EXC + "').child($id).exists()))",
    '.validate': and([
      '$id.matches(' + ID + ')',
      "!root.child('" + EXC + "').child($id).exists()",
      "newData.hasChildren(['id','nome','tipoEscopo','situacao','revisao','criadaEm','criadaPor','atualizadoEm','atualizadoPor','auditoriaId'])",
      "newData.child('id').val() === $id",
      "newData.child('atualizadoEm').val() === now",
      /* o evento de auditoria desta gravação nasce junto, com chave nova */
      "newData.parent().parent().child('" + AUD + "').child($id).child(newData.child('auditoriaId').val()).exists()",
      "!root.child('" + AUD + "').child($id).child(newData.child('auditoriaId').val()).exists()",
      "(newData.child('situacao').val() === 'descartada') === newData.child('descarte').exists()",
      '(data.exists() ? (' + and([
        "newData.child('revisao').val() === data.child('revisao').val() + 1",
        "newData.child('criadaEm').val() === data.child('criadaEm').val()",
        "newData.child('criadaPor').child('id').val() === data.child('criadaPor').child('id').val()",
        "newData.child('tipoEscopo').val() === data.child('tipoEscopo').val()",
        "newData.child('objetoAmploId').val() === data.child('objetoAmploId').val()",
        /* a versão vigente da proposta só anda de 1 em 1, e só com a proposta nova na mesma gravação */
        "(" + PV + " === " + PV_ANT + " || (" + PV + " === (data.child('propostaVigente').exists() ? " + PV_ANT + " + 1 : 1) && newData.parent().parent().child('" + PROP + "').child($id).child('v' + " + PV + ").exists() && !root.child('" + PROP + "').child($id).child('v' + " + PV + ").exists()))"
      ]) + ') : (' + and([
        "newData.child('revisao').val() === 1",
        "newData.child('situacao').val() === 'aberta'",
        "newData.child('criadaEm').val() === now",
        "newData.child('criadaPor').child('id').val() === auth.uid",
        "!newData.child('propostaVigente').exists()"
      ]) + '))'
    ]),
    nome: comW(texto(200)),
    tipoEscopo: comW({ '.validate': umDe('newData.val()', ESCOPOS) }),
    situacao: comW({ '.validate': umDe('newData.val()', ['aberta', 'descartada']) }),
    revisao: comW({ '.validate': 'newData.isNumber()' }),
    propostaVigente: comW({ '.validate': 'newData.isNumber() && newData.val() >= 1' }),
    atualizadoPor: comW(autoria()),
    criadaPor: comW({ '.validate': "newData.hasChildren(['id'])" }),
    descarte: comW({ '.validate': "newData.hasChildren(['motivo']) && newData.child('motivo').isString() && newData.child('motivo').val().length <= 500" }),
    $campo: comW(),
    /* sem .write em recortes: a lista inteira nunca se regrava; cada responsabilidade no seu caminho */
    recortes: {
      $r: {
        '.write': CAMPO_W + ' && (newData.exists() || (' + SAI_RECORTE + '))',
        /* o cadastro ligado nunca muda nem some (regravar a responsabilidade sem ele é recusado) */
        '.validate': "!data.child('objetoId').exists() || newData.child('objetoId').val() === data.child('objetoId').val()",
        /* a atuação ligada a um recorte nunca muda e só existe com o índice de origem desta análise */
        objetoId: { '.validate': and([
          'newData.isString()',
          '(!data.exists() || newData.val() === data.val())',
          "newData.parent().parent().parent().parent().parent().child('" + IDX + "').child(newData.val()).child('analiseId').val() === $id",
          "newData.parent().parent().parent().parent().parent().child('" + IDX + "').child(newData.val()).child('recorteId').val() === $r"
        ]) }
      }
    }
  }
};

const blocoAuditoria = {
  '.read': LER,
  $id: {
    $evento: {
      '.write': '(' + GRAVAR + ' || ' + APROVAR + ') && !data.exists() && newData.exists()',
      '.validate': and([
        '$evento.matches(' + ID + ')',
        "newData.hasChildren(['tipo','em','por'])",
        "newData.child('em').val() === now",
        "newData.child('por').child('uid').val() === auth.uid",
        "newData.child('por').child('email').val() === auth.token.email",
        /* o evento pertence a uma gravação da análise (que aponta para ele) ou ao registro de uma aprovação */
        "(newData.parent().parent().parent().child('" + AN + "').child($id).child('auditoriaId').val() === $evento || newData.child('tipo').val() === 'aprovacao.registrada' || (newData.child('tipo').val() === 'analise.excluida' && newData.parent().parent().parent().child('" + EXC + "').child($id).child('auditoriaId').val() === $evento && !newData.parent().parent().parent().child('" + AN + "').child($id).exists()))"
      ])
    }
  }
};

const blocoPropostas = {
  '.read': LER,
  $id: {
    $v: {
      '.write': GRAVAR + ' && !data.exists() && newData.exists()',
      '.validate': and([
        "$v === 'v' + newData.child('versao').val()",
        "newData.hasChildren(['id','analiseId','versao','alternativa','recortes','justificativa','situacao','registradaEm','registradaPor'])",
        "newData.child('analiseId').val() === $id",
        "newData.child('registradaEm').val() === now",
        "newData.parent().parent().parent().child('" + AN + "').child($id).child('propostaVigente').val() === newData.child('versao').val()",
        "(root.child('" + AN + "').child($id).child('propostaVigente').exists() ? root.child('" + AN + "').child($id).child('propostaVigente').val() + 1 === newData.child('versao').val() : newData.child('versao').val() === 1)",
        umDe("newData.child('alternativa').val()", ALTERNATIVAS),
        "(newData.child('alternativa').val() === 'pendente') === (newData.child('situacao').val() === 'pendente')",
        umDe("newData.child('situacao').val()", ['proposta', 'pendente']),
        "(newData.child('situacao').val() === 'pendente') === newData.child('pendencia').exists()",
        /* proposta registrada com o índice das responsabilidades citadas (as anteriores a ele não têm a marca) */
        "newData.child('indexada').val() === true"
      ]),
      indexada: { '.validate': 'newData.val() === true' },
      /* cada posição da lista: uma responsabilidade da análise, já no índice de citações (na mesma gravação ou antes) */
      recortes: { $i: { '.validate': "$i.matches(/^[0-9]{1,2}$/) && newData.isString() && newData.parent().parent().parent().parent().parent().child('" + CIT + "').child($id).child(newData.val()).val() === true && newData.parent().parent().parent().parent().parent().child('" + AN + "').child($id).child('recortes').child(newData.val()).exists()" } },
      versao: { '.validate': 'newData.isNumber() && newData.val() >= 1' },
      justificativa: texto(2000),
      registradaPor: autoriaId,
      pendencia: { '.validate': "newData.hasChildren(['falta','proximaAcao','quemDecide'])" }
    }
  }
};

const blocoAprovacoes = {
  '.read': LER,
  $id: {
    $v: {
      '.write': APROVAR + ' && !data.exists() && newData.exists()',
      '.validate': and([
        "$v === 'v' + newData.child('versaoProposta').val()",
        "newData.hasChildren(['analiseId','versaoProposta','natureza','autoridade','referencia','dataDoAto','objetoAprovado','registradoEm','registradoPor','auditoriaId'])",
        "newData.child('natureza').val() === 'referencia-a-ato-externo'",
        "newData.child('analiseId').val() === $id",
        "newData.child('registradoEm').val() === now",
        "root.child('" + AN + "').child($id).child('situacao').val() === 'aberta'",
        "root.child('" + AN + "').child($id).child('propostaVigente').val() === newData.child('versaoProposta').val()",
        "root.child('" + PROP + "').child($id).child($v).child('situacao').val() === 'proposta'",
        "newData.parent().parent().parent().child('" + AUD + "').child($id).child(newData.child('auditoriaId').val()).child('tipo').val() === 'aprovacao.registrada'",
        "!root.child('" + AUD + "').child($id).child(newData.child('auditoriaId').val()).exists()"
      ]),
      autoridade: texto(200),
      referencia: texto(2000),
      objetoAprovado: texto(2000),
      registradoPor: autoriaId
    }
  }
};

const blocoPorObjeto = {
  '.read': LER,
  $objetoId: {
    '.write': GRAVAR + ' && !data.exists() && newData.exists()',
    '.validate': and([
      '$objetoId.matches(' + ID + ')',
      "newData.hasChildren(['analiseId','recorteId'])",
      "newData.parent().parent().child('" + AN + "').child(newData.child('analiseId').val()).child('recortes').child(newData.child('recorteId').val()).child('objetoId').val() === $objetoId",
      "newData.parent().parent().child('" + OBJ + "').child($objetoId).exists()"
    ])
  }
};

const blocoConfig = {
  '.read': PERFIS,
  '.write': 'auth != null && (' + ADM + ') && newData.exists()',
  '.validate': and([
    "newData.hasChildren(['habilitacao','alteradoEm','alteradoPor','motivo','auditoriaId'])",
    "newData.parent().child('" + CFG_AUD + "').child(newData.child('auditoriaId').val()).exists()",
    "!root.child('" + CFG_AUD + "').child(newData.child('auditoriaId').val()).exists()"
  ]),
  habilitacao: { '.validate': umDe('newData.val()', HABILITACOES) },
  alteradoEm: { '.validate': 'newData.val() === now' },
  alteradoPor: autoria(),
  motivo: texto(500),
  auditoriaId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
  $outro: { '.validate': false }
};

const blocoConfigAuditoria = {
  '.read': PERFIS,
  $auditoriaId: {
    '.write': 'auth != null && (' + ADM + ') && !data.exists() && newData.exists()',
    '.validate': and([
      "newData.hasChildren(['habilitacao','anterior','motivo','usuario','dataHora'])",
      "newData.parent().parent().child('" + CFG + "').child('auditoriaId').val() === $auditoriaId",
      "newData.child('habilitacao').val() === newData.parent().parent().child('" + CFG + "').child('habilitacao').val()",
      "newData.child('motivo').val() === newData.parent().parent().child('" + CFG + "').child('motivo').val()",
      "newData.child('anterior').val() === (root.child('" + CFG + "').child('habilitacao').exists() ? root.child('" + CFG + "').child('habilitacao').val() : 'DESLIGADO')",
      "newData.child('dataHora').val() === now"
    ]),
    habilitacao: { '.validate': umDe('newData.val()', HABILITACOES) },
    anterior: { '.validate': umDe('newData.val()', HABILITACOES) },
    usuario: autoria(),
    motivo: texto(500),
    dataHora: { '.validate': 'newData.val() === now' },
    $outro: { '.validate': false }
  }
};

/* analises-recortes-em-proposta/$id/$r = true: a responsabilidade foi citada numa proposta registrada. Nasce só com uma
   proposta nova na mesma gravação; nunca muda nem sai (regravar true é inócuo) */
const RAIZ_CIT = 'newData.parent().parent().parent()';
const VIG_NOVA = RAIZ_CIT + ".child('" + AN + "').child($id).child('propostaVigente').val()";
const blocoCitacoes = {
  '.read': LER,
  $id: {
    $r: {
      '.write': GRAVAR + ' && newData.val() === true',
      '.validate': and(['newData.val() === true', RAIZ_CIT + ".child('" + PROP + "').child($id).child('v' + " + VIG_NOVA + ').exists()', "!root.child('" + PROP + "').child($id).child('v' + " + VIG_NOVA + ').exists()'])
    }
  }
};

/* registro mínimo de cada exclusão: escrito uma vez, imutável; a análise sai na MESMA gravação */
const AN_ANTES = "root.child('" + AN + "').child($id)", RAIZ_EXC = 'newData.parent().parent()';
const blocoExcluidas = {
  '.read': LER,
  $id: {
    '.write': GRAVAR + ' && !data.exists() && newData.exists()',
    '.validate': and([
      '$id.matches(' + ID + ')',
      "newData.hasChildren(['nome','motivo','nivel','revisao','excluidaEm','excluidaPor','auditoriaId'])",
      /* a exclusão vale para a revisão que a pessoa viu e confirmou: qualquer gravação no meio a recusa */
      "newData.child('revisao').val() === " + AN_ANTES + ".child('revisao').val()",
      AN_ANTES + '.exists()', '!' + RAIZ_EXC + ".child('" + AN + "').child($id).exists()",
      "newData.child('nome').val() === " + AN_ANTES + ".child('nome').val()",
      "newData.child('excluidaEm').val() === now",
      RAIZ_EXC + ".child('" + AUD + "').child($id).child(newData.child('auditoriaId').val()).child('tipo').val() === 'analise.excluida'",
      "!root.child('" + AUD + "').child($id).child(newData.child('auditoriaId').val()).exists()",
      /* aprovação registrada (ato externo) aponta para a análise: nunca se exclui */
      "!root.child('" + APROV + "').child($id).exists() && !" + RAIZ_EXC + ".child('" + APROV + "').child($id).exists()",
      /* comum: análise vazia (sem responsabilidades e sem proposta); excepcional: só o admin geral */
      "(newData.child('nivel').val() === 'comum' ? (!" + AN_ANTES + ".child('recortes').exists() && !" + AN_ANTES + ".child('propostaVigente').exists() && !" + AN_ANTES + ".child('referencias').exists()) : (" + ADM + '))'
    ]),
    nome: texto(200), motivo: texto(500), revisao: { '.validate': 'newData.isNumber()' },
    nivel: { '.validate': umDe('newData.val()', ['comum', 'excepcional']) },
    situacaoAnterior: { '.validate': umDe('newData.val()', ['aberta', 'descartada']) },
    contagens: { '.validate': 'newData.hasChildren()', $c: { '.validate': 'newData.isNumber() && newData.val() >= 0' } },
    excluidaEm: { '.validate': 'newData.isNumber()' }, excluidaPor: autoria(),
    auditoriaId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    $outro: { '.validate': false }
  }
};

const BLOCOS = { [AN]: blocoAnalise, [AUD]: blocoAuditoria, [PROP]: blocoPropostas, [APROV]: blocoAprovacoes, [IDX]: blocoPorObjeto, [CFG]: blocoConfig, [CFG_AUD]: blocoConfigAuditoria, [EXC]: blocoExcluidas, [CIT]: blocoCitacoes };
module.exports = { BLOCOS, NOS: Object.keys(BLOCOS) };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGEM de database.rules.json: ' + divergentes.join(', ') : 'os 9 nós publicados são os montados');
    process.exit(divergentes.length ? 1 : 0);
  }
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(BLOCOS).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    if (ini === -1) {
      const fim = s.lastIndexOf('\n  }');
      s = s.slice(0, fim) + ',\n    "' + n + '": ' + ind(BLOCOS[n]) + s.slice(fim);
      return;
    }
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
