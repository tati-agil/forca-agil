/* Monta as regras dos 5 nós da ESTRUTURA ORGANIZACIONAL ATUAL em database.rules.json:
 *   estrutura-atual-unidades, estrutura-atual-filhos, estrutura-atual-auditoria, estrutura-atual-config,
 *   estrutura-atual-config-auditoria.
 *
 * O que as regras garantem (provado no emulador por teste-rules-estrutura-atual.js):
 *   - MARCADOR PRÓPRIO (estrutura-atual-config/habilitacao; ausente = DESLIGADO): DESLIGADO → ninguém grava; LIBERADO →
 *     gravam admin geral e avaliacao-arquitetura. Independe do marcador da Análise Organizacional. Só o admin geral
 *     muda o marcador, com motivo e auditoria própria (só acréscimo). Leem os três perfis da Avaliação;
 *   - unidade: revisão 1 → anterior + 1 (gravação velha recusada); horário do SERVIDOR; autoria do token; criação fixa;
 *     encerrada é final, com motivo; nada se apaga; toda gravação traz o seu evento de histórico novo;
 *   - HIERARQUIA SEM CICLO, conferida pelo servidor no estado DEPOIS da gravação (newData, que já inclui o que outras
 *     pessoas gravaram antes): a regra sobe a cadeia de superiores a partir da nova superior, até PROFUNDIDADE_MAX
 *     níveis, e recusa se encontrar a própria unidade ou se a cadeia não terminar. Duas mudanças simultâneas que
 *     juntas formariam um ciclo: a primeira entra; a segunda é avaliada já com a primeira gravada e é recusada.
 *     A gravação é uma só (multipath atômica): unidade + índice + histórico;
 *   - superior existente e ATIVA; encerrar exige nenhuma subordinada ativa — pelo índice estrutura-atual-filhos, que
 *     a regra mantém coerente com cada unidade (entrada existe ⇔ unidade ativa com aquela superior).
 *
 *   node .github/scripts/montar-regras-estrutura-atual.js --gravar   (reescreve os 5 nós)
 *   node .github/scripts/montar-regras-estrutura-atual.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const NUC = require(path.join(__dirname, '..', '..', 'forca-agil', 'estrutura-atual-nucleo.js'));
const K = "auth.token.email.replace('@','_').replace('.','_')";
const ADM = "(auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br') || root.child('fa-admins').child(" + K + ").exists()";
const TIPO = "root.child('fa-avaliacao-autorizados').child(" + K + ").child('tipo').val()";
const UN = NUC.NOS.unidades, FIL = NUC.NOS.filhos, AUD = NUC.NOS.auditoria, CFG = NUC.NOS.config, CFG_AUD = NUC.NOS.configAuditoria;
const PERFIS = "auth != null && ((" + ADM + ") || " + TIPO + " === 'avaliacao' || " + TIPO + " === 'avaliacao-arquitetura')";
const EDITA = "auth != null && ((" + ADM + ") || " + TIPO + " === 'avaliacao-arquitetura') && root.child('" + CFG + "').child('habilitacao').val() === 'LIBERADO'";
const ID = '/^[A-Za-z0-9_-]{1,60}$/';
const and = (xs) => xs.join(' && ');
const umDe = (x, lista) => '(' + lista.map((v) => x + " === '" + v + "'").join(' || ') + ')';
const naoEmBranco = (x) => x + ".replace(' ', '').replace('\\t', '').replace('\\n', '').replace('\\r', '').length > 0";
const texto = (n) => ({ '.validate': 'newData.isString() && newData.val().length <= ' + n + ' && ' + naoEmBranco('newData.val()') });
const autoria = () => ({ '.validate': "newData.child('uid').val() === auth.uid && newData.child('email').val() === auth.token.email" });
const pessoa = { '.validate': "newData.child('uid').isString() && newData.child('email').isString()" };
const NIVEIS = Object.keys(NUC.NIVEIS);

/* a cadeia de superiores a partir da NOVA superior, no estado depois da gravação: nenhum elo é a própria unidade e
   a cadeia termina em até PROFUNDIDADE_MAX níveis (mesmo limite do núcleo). Cada nível só é lido depois de conferir
   que o anterior tem superior (child(null) nunca é avaliado) */
const NOVO = 'newData.parent()';
const sup = (k) => (k === 1 ? "newData.child('superiorId').val()" : no(k - 1) + ".child('superiorId').val()");
const no = (k) => NOVO + '.child(' + sup(k) + ')';
function cadeia(k) {
  if (k >= NUC.PROFUNDIDADE_MAX) return '!' + no(k) + ".child('superiorId').exists()";
  return '(!' + no(k) + ".child('superiorId').exists() || (" + sup(k + 1) + ' !== $id && ' + cadeia(k + 1) + '))';
}
const SEM_CICLO = "(!newData.child('superiorId').exists() || (" + and([
  sup(1) + ' !== $id',
  no(1) + '.exists()',
  no(1) + ".child('situacao').val() === 'ativa'",
  cadeia(1)
]) + '))';
const NOVA_RAIZ = 'newData.parent().parent()';

const blocoUnidades = {
  '.read': PERFIS,
  $id: {
    '.write': EDITA + " && newData.exists() && (!data.exists() || data.child('situacao').val() === 'ativa')",
    '.validate': and([
      '$id.matches(' + ID + ')',
      "newData.hasChildren(['id','nome','nivel','situacao','revisao','criadaEm','criadaPor','atualizadaEm','atualizadaPor','auditoriaId'])",
      "newData.child('id').val() === $id",
      "newData.child('atualizadaEm').val() === now",
      "(newData.child('nivel').val() === 'outro') === newData.child('nivelOutro').exists()",
      "(newData.child('situacao').val() === 'encerrada') === newData.child('encerramento').exists()",
      /* o evento de histórico desta gravação nasce junto, com chave nova */
      NOVA_RAIZ + ".child('" + AUD + "').child($id).child(newData.child('auditoriaId').val()).exists()",
      "!root.child('" + AUD + "').child($id).child(newData.child('auditoriaId').val()).exists()",
      '(data.exists() ? (' + and([
        "newData.child('revisao').val() === data.child('revisao').val() + 1",
        "newData.child('criadaEm').val() === data.child('criadaEm').val()",
        "newData.child('criadaPor').child('uid').val() === data.child('criadaPor').child('uid').val()",
        "(newData.child('situacao').val() === 'ativa' || newData.child('encerramento').child('em').val() === now)"
      ]) + ') : (' + and([
        "newData.child('revisao').val() === 1",
        "newData.child('situacao').val() === 'ativa'",
        "newData.child('criadaEm').val() === now",
        "newData.child('criadaPor').child('uid').val() === auth.uid"
      ]) + '))',
      SEM_CICLO,
      /* índice de subordinadas ativas coerente com a unidade, na mesma gravação */
      "(newData.child('situacao').val() !== 'ativa' || !newData.child('superiorId').exists() || " + NOVA_RAIZ + ".child('" + FIL + "').child(newData.child('superiorId').val()).child($id).val() === true)",
      "(!data.child('superiorId').exists() || (data.child('superiorId').val() === newData.child('superiorId').val() && newData.child('situacao').val() === 'ativa') || !" + NOVA_RAIZ + ".child('" + FIL + "').child(data.child('superiorId').val()).child($id).exists())",
      /* encerrar: nenhuma subordinada ativa (no estado depois da gravação) */
      "(newData.child('situacao').val() === 'ativa' || !" + NOVA_RAIZ + ".child('" + FIL + "').child($id).exists())"
    ]),
    id: { '.validate': 'newData.isString()' },
    nome: texto(NUC.MAX.nome),
    sigla: texto(NUC.MAX.sigla),
    nivel: { '.validate': umDe('newData.val()', NIVEIS) },
    nivelOutro: texto(NUC.MAX.nivelOutro),
    superiorId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    situacao: { '.validate': umDe('newData.val()', ['ativa', 'encerrada']) },
    fonte: texto(NUC.MAX.fonte),
    vigenciaInicio: { '.validate': 'newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)' },
    revisao: { '.validate': 'newData.isNumber()' },
    criadaEm: { '.validate': 'newData.isNumber()' },
    criadaPor: pessoa,
    atualizadaEm: { '.validate': 'newData.isNumber()' },
    atualizadaPor: autoria(),
    auditoriaId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    encerramento: {
      '.validate': "newData.hasChildren(['motivo','em','por'])",
      motivo: texto(NUC.MAX.motivo),
      em: { '.validate': 'newData.isNumber()' },
      por: pessoa,
      $outro: { '.validate': false }
    },
    $outro: { '.validate': false }
  }
};
const UNIDADE_DO_INDICE = 'newData.parent().parent().parent().child(\'' + UN + '\').child($filho)';
const blocoFilhos = {
  '.read': PERFIS,
  $sup: {
    $filho: {
      /* a entrada só sai quando a unidade deixa de estar ativa com essa superior (no estado depois da gravação) */
      '.write': EDITA + " && (newData.exists() || " + UNIDADE_DO_INDICE + ".child('superiorId').val() !== $sup || " + UNIDADE_DO_INDICE + ".child('situacao').val() !== 'ativa')",
      '.validate': "newData.val() === true && " + UNIDADE_DO_INDICE + ".child('superiorId').val() === $sup && " + UNIDADE_DO_INDICE + ".child('situacao').val() === 'ativa'"
    }
  }
};
const blocoAuditoria = {
  '.read': PERFIS,
  $unidade: {
    $auditoriaId: {
      '.write': EDITA + ' && !data.exists() && newData.exists()',
      '.validate': and([
        "newData.hasChildren(['tipo','unidadeId','em','por'])",
        "newData.child('unidadeId').val() === $unidade",
        "newData.parent().parent().parent().child('" + UN + "').child($unidade).child('auditoriaId').val() === $auditoriaId"
      ]),
      tipo: { '.validate': umDe('newData.val()', ['criacao', 'alteracao', 'superior', 'encerramento']) },
      unidadeId: { '.validate': 'newData.isString()' },
      em: { '.validate': 'newData.val() === now' },
      por: autoria(),
      motivo: texto(NUC.MAX.motivo),
      antes: {},
      depois: {},
      $outro: { '.validate': false }
    }
  }
};
const blocoConfig = {
  '.read': 'auth != null',
  '.write': 'auth != null && (' + ADM + ') && newData.exists()',
  '.validate': and([
    "newData.hasChildren(['habilitacao','alteradoEm','alteradoPor','motivo','auditoriaId'])",
    "newData.parent().child('" + CFG_AUD + "').child(newData.child('auditoriaId').val()).exists()",
    "!root.child('" + CFG_AUD + "').child(newData.child('auditoriaId').val()).exists()"
  ]),
  habilitacao: { '.validate': umDe('newData.val()', NUC.HABILITACOES) },
  alteradoEm: { '.validate': 'newData.val() === now' },
  alteradoPor: autoria(),
  motivo: texto(NUC.MAX.motivo),
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
    habilitacao: { '.validate': umDe('newData.val()', NUC.HABILITACOES) },
    anterior: { '.validate': umDe('newData.val()', NUC.HABILITACOES) },
    usuario: autoria(),
    motivo: texto(NUC.MAX.motivo),
    dataHora: { '.validate': 'newData.val() === now' },
    $outro: { '.validate': false }
  }
};
const BLOCOS = {};
BLOCOS[UN] = blocoUnidades; BLOCOS[FIL] = blocoFilhos; BLOCOS[AUD] = blocoAuditoria; BLOCOS[CFG] = blocoConfig; BLOCOS[CFG_AUD] = blocoConfigAuditoria;

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGEM de database.rules.json: ' + divergentes.join(', ') : 'os 5 nós publicados são os montados');
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
module.exports = { BLOCOS };
