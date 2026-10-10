/* Monta as regras dos 5 nós do POSICIONAMENTO ORGANIZACIONAL em database.rules.json (PR E; decisão e reavaliação: PR F):
 *   avaliacoes-posicionamento, posicionamento-rascunho-por-item, posicionamento-vigente-por-item, posicionamento-auditoria,
 *   posicionamento-decisoes.
 *
 * O caminho e o resultado vêm de regras-posicionamento-tabela.js (as 25 regras do motor v1), que NÃO é um segundo
 * motor: teste-regras-posicionamento-tabela.js prova, nos 531.441 estados, que a tabela é o motor, e que os 5 nós
 * publicados são EXATAMENTE os que este arquivo monta. Mudou o motor, a tabela ou uma regra destes nós:
 *   node .github/scripts/montar-regras-posicionamento.js --gravar     (reescreve os 5 nós, no fim do arquivo)
 *   node .github/scripts/montar-regras-posicionamento.js              (só confere; sai com erro se divergir)
 * e rode teste-rules-posicionamento.js e teste-rules-posicionamento-decisao.js no emulador.
 *
 * PR F — REAVALIAÇÃO: uma avaliação com avaliacaoAnteriorId é a versão seguinte (versao = anterior + 1) da VIGENTE do
 * item, com motivo; a conclusão troca o vigente por compare-and-set (só se ainda aponta para a anterior) — nunca
 * apaga, nunca pula versão. DECISÃO: posicionamento-decisoes/<avaliacaoId>, uma por versão, só da vigente, imutável,
 * recusada enquanto houver reavaliação em andamento (o contrário — reavaliar depois de decidir — é permitido). O
 * liberaSquad da decisão é o de faMotorPosicionamento.liberaSquadParaCodigoFirme (lido do motor, não copiado). */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const T = require('./regras-posicionamento-tabela.js');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
const K = "auth.token.email.replace('@','_').replace('.','_')";
const ADM = "(auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br') || root.child('fa-admins').child(" + K + ").exists()";
const TIPO = "root.child('fa-avaliacao-autorizados').child(" + K + ").child('tipo').val()";
const LEIT = "auth != null && ((" + ADM + ") || (" + TIPO + " === 'avaliacao' || " + TIPO + " === 'avaliacao-arquitetura'))";
const ESC = "auth != null && ((" + ADM + ") || " + TIPO + " === 'avaliacao-arquitetura')";
const AV = 'avaliacoes-posicionamento', RES = 'posicionamento-rascunho-por-item', VIG = 'posicionamento-vigente-por-item', AUD = 'posicionamento-auditoria';
const DEC = 'posicionamento-decisoes';
const CODS = ['LINHA','ESTRATEGIA_CLIENTES','NEGOCIOS','PLATAFORMA','PLATAFORMA_CANAIS','PLATAFORMA_HABILITADORA_NEGOCIOS','PLATAFORMA_HABILITADORA_TECNOLOGIA','PLATAFORMA_CORPORATIVA','AREA_ESPECIALIZADA','COE'];
const c = (s) => "newData.child('" + s + "')";
const v = (s) => c(s) + '.val()';
const d = (s) => "data.child('" + s + "').val()";
const NOVO = (no) => "newData.parent().parent().child('" + no + "')";
const AUDNOVA = (campo) => NOVO(AUD) + ".child($avaliacaoId).child(" + v(campo) + ")";
const AUDANT = (campo) => "root.child('" + AUD + "').child($avaliacaoId).child(" + v(campo) + ")";
const P = "root.child('avaliacoes-produto').child(" + v('avaliacaoArquiteturalId') + ")";
const and = (xs) => xs.join(' && ');
const ID = '/^[A-Za-z0-9_-]{1,60}$/';
const semCampos = (xs) => and(xs.map((x) => '!' + c(x) + '.exists()'));
const CONCL = ['resultadoAutomatico', 'nomesNaConclusao', 'concluidoPor', 'concluidoEm', 'auditoriaConclusaoId'];
const DESC = ['motivoDescarte', 'descartadoPor', 'descartadoEm', 'auditoriaDescarteId'];
/* texto não pode ser só espaço em branco (espaço, tabulação, quebra de linha, retorno). O regex das regras não
   conhece \s nem \S e não aceita esses caracteres na classe; replace troca TODAS as ocorrências (provado no
   emulador, seção H de teste-rules-posicionamento.js). */
const naoEmBranco = (x) => x + ".replace(' ', '').replace('\\t', '').replace('\\n', '').replace('\\r', '').length > 0";
const ANTID = v('avaliacaoAnteriorId');
const ANT = "root.child('" + AV + "').child(" + ANTID + ")";
const VIGRAIZ = "root.child('" + VIG + "').child(" + v('itemId') + ')';

const criar = and([
  v('status') + " === 'rascunho'", v('revisao') + ' === 1', v('criadoPor/email') + ' === auth.token.email',
  P + ".child('status').val() === 'concluido'", P + ".child('excluido').val() !== true",
  '(' + P + ".child('itemId').val() === " + v('itemId') + ' || (!' + P + ".child('itemId').exists() && " + v('avaliacaoArquiteturalId') + ' === ' + v('itemId') + '))',
  /* primeira versão: o item não tem vigente. Reavaliação: versão seguinte da VIGENTE, com motivo. */
  '(' + c('avaliacaoAnteriorId') + '.exists() ? (' + and([
    ANT + ".child('status').val() === 'concluido'", ANT + ".child('itemId').val() === " + v('itemId'),
    VIGRAIZ + '.val() === ' + ANTID, v('versao') + ' === ' + ANT + ".child('versao').val() + 1",
    c('motivoReavaliacao') + '.isString()', naoEmBranco(v('motivoReavaliacao'))
  ]) + ') : (' + and(['!' + VIGRAIZ + '.exists()', v('versao') + ' === 1', '!' + c('motivoReavaliacao') + '.exists()']) + '))',
  AUDNOVA('auditoriaCriacaoId') + ".child('tipo').val() === 'criacao'", '!' + AUDANT('auditoriaCriacaoId') + '.exists()'
]);
const fixos = ['itemId', 'itemNome', 'avaliacaoArquiteturalId', 'questionnaireContentVersion', 'versao', 'avaliacaoAnteriorId', 'motivoReavaliacao', 'criadoPor/email', 'criadoPor/name', 'criadoEm', 'auditoriaCriacaoId'];
const alterar = and(fixos.map((f) => v(f) + ' === ' + d(f)).concat([v('revisao') + ' === ' + d('revisao') + ' + 1']));
const rascunho = and([NOVO(RES) + '.child(' + v('itemId') + ').val() === $avaliacaoId', semCampos(CONCL), semCampos(DESC)]);
const concluido = and([
  "newData.hasChildren(['" + CONCL.filter((x) => x !== 'nomesNaConclusao').join("','") + "'])", v('concluidoPor/email') + ' === auth.token.email', semCampos(DESC),
  '!' + NOVO(RES) + '.child(' + v('itemId') + ').exists()',
  /* vigente: nasce na primeira versão; numa reavaliação, troca por compare-and-set (só se ainda é a anterior) */
  NOVO(VIG) + '.child(' + v('itemId') + ').val() === $avaliacaoId',
  '(' + c('avaliacaoAnteriorId') + '.exists() ? ' + VIGRAIZ + '.val() === ' + ANTID + ' : !' + VIGRAIZ + '.exists())',
  AUDNOVA('auditoriaConclusaoId') + ".child('tipo').val() === 'conclusao'", '!' + AUDANT('auditoriaConclusaoId') + '.exists()',
  T.trechoResultado()
]);
const descartado = and([
  "newData.hasChildren(['" + DESC.join("','") + "'])", v('descartadoPor/email') + ' === auth.token.email', semCampos(CONCL),
  naoEmBranco(v('motivoDescarte')),
  '!' + NOVO(RES) + '.child(' + v('itemId') + ').exists()',
  AUDNOVA('auditoriaDescarteId') + ".child('tipo').val() === 'descarte'", '!' + AUDANT('auditoriaDescarteId') + '.exists()'
]);
const validar = and([
  '$avaliacaoId.matches(' + ID + ')',
  "newData.hasChildren(['itemId','itemNome','avaliacaoArquiteturalId','questionarioCodigo','questionnaireContentVersion','versao','status','revisao','criadoPor','criadoEm','atualizadoPor','atualizadoEm','auditoriaCriacaoId'])",
  v('atualizadoPor/email') + ' === auth.token.email',
  '(data.exists() ? (' + alterar + ') : (' + criar + '))',
  '(' + v('status') + " === 'rascunho' ? (" + rascunho + ') : ' + v('status') + " === 'concluido' ? (" + concluido + ') : (' + descartado + '))',
  T.trechoCaminho()
]);
const pessoa = { '.validate': "newData.hasChildren(['email'])", name: { '.validate': 'newData.isString() && newData.val().length <= 200' }, email: { '.validate': 'newData.isString()' }, $outro: { '.validate': false } };
const texto = (n) => ({ '.validate': 'newData.isString() && newData.val().length <= ' + n });
const codigosEq = (x) => '(' + CODS.map((k) => x + " === '" + k + "'").join(' || ') + ')';
const blocoAv = {
  '.read': LEIT,
  $avaliacaoId: {
    '.write': ESC + " && newData.exists() && (!data.exists() || data.child('status').val() === 'rascunho')",
    '.validate': validar,
    itemId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    itemNome: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 200' },
    avaliacaoArquiteturalId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    questionarioCodigo: { '.validate': "newData.val() === 'POSICIONAMENTO_ORGANIZACIONAL'" },
    questionnaireContentVersion: { '.validate': 'newData.isNumber() && newData.val() >= 1' },
    versao: { '.validate': 'newData.isNumber() && newData.val() >= 1' },
    avaliacaoAnteriorId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    motivoReavaliacao: { '.validate': 'newData.isString() && newData.val().length <= 500' },
    status: { '.validate': "newData.val() === 'rascunho' || newData.val() === 'concluido' || newData.val() === 'descartado'" },
    revisao: { '.validate': 'newData.isNumber() && newData.val() >= 1' },
    criadoPor: pessoa, atualizadoPor: pessoa, concluidoPor: pessoa, descartadoPor: pessoa,
    criadoEm: texto(40), atualizadoEm: texto(40), concluidoEm: texto(40), descartadoEm: texto(40),
    auditoriaCriacaoId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    auditoriaConclusaoId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    auditoriaDescarteId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    motivoDescarte: { '.validate': 'newData.isString() && newData.val().length <= 500' },
    respostas: {
      $pergunta: {
        '.validate': "$pergunta.matches(/^O[1-9]$/) && newData.hasChildren(['resposta','codigoPergunta','questionnaireContentVersion','dataResposta'])",
        resposta: { '.validate': "newData.val() === 'SIM' || newData.val() === 'NAO'" },
        codigoPergunta: { '.validate': 'newData.val() === $pergunta' },
        tituloNaEpoca: texto(400), textoPerguntaNaEpoca: texto(4000), interpretacaoNaEpoca: texto(4000),
        observacao: texto(2000),
        questionnaireContentVersion: { '.validate': 'newData.isNumber()' },
        dataResposta: texto(40),
        $outro: { '.validate': false }
      }
    },
    diagnosticos: {
      $nivel: {
        '.validate': "$nivel.matches(/^N[1-3]$/) && newData.hasChildren(['resposta','papeis','questionnaireContentVersion','dataResposta'])",
        resposta: { '.validate': "newData.val() === 'mesma' || newData.val() === 'distintas'" },
        papeis: { $i: { '.validate': 'newData.isString()' } },
        tituloNaEpoca: texto(400), textoPerguntaNaEpoca: texto(4000), rotuloNaEpoca: texto(400), interpretacaoNaEpoca: texto(4000),
        observacao: texto(2000),
        questionnaireContentVersion: { '.validate': 'newData.isNumber()' },
        dataResposta: texto(40),
        $outro: { '.validate': false }
      }
    },
    resultadoAutomatico: {
      codigoResultado: { '.validate': 'newData.isString()' }, tipoAValidar: { '.validate': 'newData.isString()' }, motivo: { '.validate': 'newData.isString()' },
      nivelConfirmado: { '.validate': 'newData.isString()' }, regra: { '.validate': 'newData.isString()' },
      versaoMotor: { '.validate': 'newData.isNumber()' }, liberaSquad: { '.validate': 'newData.isBoolean()' },
      papeisDetectados: { $i: { '.validate': 'newData.isString()' } }, niveisAlcancados: { $i: { '.validate': 'newData.isString()' } },
      perguntasForaDoCaminho: { $i: { '.validate': 'newData.isString()' } },
      $outro: { '.validate': false }
    },
    nomesNaConclusao: {
      $codigo: {
        '.validate': codigosEq('$codigo') + " && newData.hasChildren(['nome','contingencia'])",
        nome: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 120' },
        contingencia: { '.validate': 'newData.isBoolean()' },
        $outro: { '.validate': false }
      }
    },
    $outro: { '.validate': false }
  }
};
const AVNOVA = "newData.parent().parent().parent().child('" + AV + "').child($avaliacaoId)";
const blocoRes = {
  '.read': LEIT,
  $itemId: {
    '.write': ESC + " && ((!data.exists() && newData.exists()) || (data.exists() && !newData.exists() && newData.parent().parent().child('" + AV + "').child(data.val()).exists() && newData.parent().parent().child('" + AV + "').child(data.val()).child('status').val() !== 'rascunho'))",
    '.validate': "newData.isString() && newData.parent().parent().child('" + AV + "').child(newData.val()).child('status').val() === 'rascunho' && newData.parent().parent().child('" + AV + "').child(newData.val()).child('itemId').val() === $itemId"
  }
};
const blocoVig = {
  '.read': LEIT,
  $itemId: {
    /* nasce, ou troca para a versão seguinte cuja anterior é a atual (compare-and-set); nunca é apagado */
    '.write': ESC + " && newData.exists() && (!data.exists() || data.val() === newData.parent().parent().child('" + AV + "').child(newData.val()).child('avaliacaoAnteriorId').val())",
    '.validate': "newData.isString() && newData.parent().parent().child('" + AV + "').child(newData.val()).child('status').val() === 'concluido' && newData.parent().parent().child('" + AV + "').child(newData.val()).child('itemId').val() === $itemId && root.child('" + AV + "').child(newData.val()).child('status').val() === 'rascunho'"
  }
};
const DECNOVA = "newData.parent().parent().parent().child('" + DEC + "').child($avaliacaoId)";
const igual = (campos, base) => and(campos.map((f) => v(f) + ' === ' + base + ".child('" + f + "').val()"));
const blocoAud = {
  '.read': LEIT,
  $avaliacaoId: {
    $auditoriaId: {
      '.write': ESC + ' && !data.exists() && newData.exists()',
      '.validate': and([
        "newData.hasChildren(['tipo','itemId','usuario','dataHora'])", v('usuario/email') + ' === auth.token.email', v('itemId') + ' === ' + AVNOVA + ".child('itemId').val()",
        '((' + v('tipo') + " === 'criacao' && " + AVNOVA + ".child('auditoriaCriacaoId').val() === $auditoriaId && " +
        v('avaliacaoAnteriorId') + ' === ' + AVNOVA + ".child('avaliacaoAnteriorId').val() && " + v('motivo') + ' === ' + AVNOVA + ".child('motivoReavaliacao').val()) || (" +
        v('tipo') + " === 'conclusao' && " + AVNOVA + ".child('auditoriaConclusaoId').val() === $auditoriaId && " +
        and(['codigoResultado', 'regra', 'versaoMotor', 'liberaSquad'].map((f) => v(f) + ' === ' + AVNOVA + ".child('resultadoAutomatico/" + f + "').val()")) + ' && ' +
        v('vigenteAnterior') + ' === ' + AVNOVA + ".child('avaliacaoAnteriorId').val()) || (" +
        v('tipo') + " === 'descarte' && " + AVNOVA + ".child('auditoriaDescarteId').val() === $auditoriaId && " + v('motivo') + ' === ' + AVNOVA + ".child('motivoDescarte').val()) || (" +
        v('tipo') + " === 'decisao' && " + DECNOVA + ".child('auditoriaId').val() === $auditoriaId && " + igual(['codigoAutomatico', 'codigoFinal', 'tipoDecisao', 'versaoAvaliacao', 'justificativa', 'liberaSquad'], DECNOVA) + '))'
      ]),
      tipo: { '.validate': 'newData.isString()' }, itemId: { '.validate': 'newData.isString()' }, avaliacaoArquiteturalId: { '.validate': 'newData.isString()' },
      usuario: pessoa, dataHora: texto(40), codigoResultado: { '.validate': 'newData.isString()' }, regra: { '.validate': 'newData.isString()' },
      versaoMotor: { '.validate': 'newData.isNumber()' }, liberaSquad: { '.validate': 'newData.isBoolean()' }, motivo: texto(500),
      avaliacaoAnteriorId: { '.validate': 'newData.isString()' }, vigenteAnterior: { '.validate': 'newData.isString()' },
      codigoAutomatico: { '.validate': 'newData.isString()' }, codigoFinal: { '.validate': 'newData.isString()' }, tipoDecisao: { '.validate': 'newData.isString()' },
      versaoAvaliacao: { '.validate': 'newData.isNumber()' }, justificativa: texto(2000),
      $outro: { '.validate': false }
    }
  }
};
/* DECISÃO HUMANA (PR F): uma por versão, só da vigente, imutável; recusada com reavaliação em andamento. */
const REG = "root.child('" + AV + "').child($avaliacaoId)";
const RA = REG + ".child('resultadoAutomatico')";
const FIRMES = M.CODIGOS_FIRMES;
const LIBERA = FIRMES.filter((k) => M.liberaSquadParaCodigoFirme(k));
const eqUm = (x, lista) => '(' + lista.map((k) => x + " === '" + k + "'").join(' || ') + ')';
const NOVODEC = (no) => "newData.parent().parent().child('" + no + "')";
const blocoDec = {
  '.read': LEIT,
  $avaliacaoId: {
    '.write': ESC + ' && !data.exists() && newData.exists()',
    '.validate': and([
      '$avaliacaoId.matches(' + ID + ')',
      "newData.hasChildren(['itemId','versaoAvaliacao','versaoMotor','codigoAutomatico','codigoFinal','tipoDecisao','nomeNaDecisao','liberaSquad','decididoPor','decididoEm','auditoriaId'])",
      v('decididoPor/email') + ' === auth.token.email',
      REG + ".child('status').val() === 'concluido'", REG + ".child('itemId').val() === " + v('itemId'),
      /* vigente e sem reavaliação ANTES e DEPOIS da gravação: uma multipath não pode decidir a versão que, na mesma
         gravação, deixa de ser vigente (conclusão da reavaliação) nem esconder uma reavaliação (início ou descarte) */
      "root.child('" + VIG + "').child(" + v('itemId') + ').val() === $avaliacaoId',
      NOVODEC(VIG) + '.child(' + v('itemId') + ').val() === $avaliacaoId',
      "!root.child('" + RES + "').child(" + v('itemId') + ').exists()',
      '!' + NOVODEC(RES) + '.child(' + v('itemId') + ').exists()',
      v('versaoAvaliacao') + ' === ' + REG + ".child('versao').val()",
      v('codigoAutomatico') + ' === ' + RA + ".child('codigoResultado').val()",
      v('versaoMotor') + ' === ' + RA + ".child('versaoMotor').val()",
      v('tipoAValidarAutomatico') + ' === ' + RA + ".child('tipoAValidar').val()",
      eqUm(v('codigoFinal'), FIRMES),
      '(' + v('codigoAutomatico') + " === 'A_VALIDAR' ? " + v('tipoDecisao') + " === 'RESOLUCAO_A_VALIDAR' : " +
        v('codigoAutomatico') + ' === ' + v('codigoFinal') + ' ? ' + v('tipoDecisao') + " === 'CONFIRMACAO' : " + v('tipoDecisao') + " === 'DIVERGENCIA')",
      '(' + v('tipoDecisao') + " === 'CONFIRMACAO' || (" + c('justificativa') + '.isString() && ' + naoEmBranco(v('justificativa')) + '))',
      v('liberaSquad') + ' === ' + eqUm(v('codigoFinal'), LIBERA),
      NOVODEC(AUD) + '.child($avaliacaoId).child(' + v('auditoriaId') + ").child('tipo').val() === 'decisao'",
      "!root.child('" + AUD + "').child($avaliacaoId).child(" + v('auditoriaId') + ').exists()'
    ]),
    itemId: { '.validate': 'newData.isString()' },
    versaoAvaliacao: { '.validate': 'newData.isNumber()' }, versaoMotor: { '.validate': 'newData.isNumber()' },
    codigoAutomatico: { '.validate': 'newData.isString()' }, tipoAValidarAutomatico: { '.validate': 'newData.isString()' },
    codigoFinal: { '.validate': 'newData.isString()' },
    tipoDecisao: { '.validate': "newData.val() === 'CONFIRMACAO' || newData.val() === 'DIVERGENCIA' || newData.val() === 'RESOLUCAO_A_VALIDAR'" },
    justificativa: texto(2000),
    nomeNaDecisao: {
      '.validate': "newData.hasChildren(['nome','contingencia'])",
      nome: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 120' },
      contingencia: { '.validate': 'newData.isBoolean()' },
      $outro: { '.validate': false }
    },
    liberaSquad: { '.validate': 'newData.isBoolean()' },
    decididoPor: pessoa, decididoEm: texto(40),
    auditoriaId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    $outro: { '.validate': false }
  }
};

const BLOCOS = { [AV]: blocoAv, [RES]: blocoRes, [VIG]: blocoVig, [AUD]: blocoAud, [DEC]: blocoDec };
module.exports = { BLOCOS, NOS: [AV, RES, VIG, AUD, DEC] };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGEM de database.rules.json: ' + divergentes.join(', ') : 'os 5 nós publicados são os montados');
    process.exit(divergentes.length ? 1 : 0);
  }
  /* os 5 nós ficam no fim do arquivo: tira os antigos (se houver) e acrescenta os montados */
  const i = s.indexOf(',\n    "' + AV + '": ');
  if (i !== -1) s = s.slice(0, i) + '\n  }\n}\n';
  const fechamento = '    }\n  }\n}\n';
  if (!s.endsWith(fechamento)) throw new Error('fim inesperado em database.rules.json');
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  s = s.slice(0, s.length - fechamento.length) + '    },\n' + Object.keys(BLOCOS).map((n) => '    "' + n + '": ' + ind(BLOCOS[n])).join(',\n') + '\n  }\n}\n';
  JSON.parse(s);
  fs.writeFileSync(ARQUIVO, s);
  console.log('gravado: ' + s.length + ' bytes');
}
