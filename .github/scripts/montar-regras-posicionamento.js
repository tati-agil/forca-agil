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
 * liberaSquad da decisão é o de faMotorPosicionamento.liberaSquadParaCodigoFirme (lido do motor, não copiado).
 *
 * PORTA 2 (objetos organizacionais): origem 'objeto-organizacional' = o itemId é um objeto de objetos-organizacionais
 * (sem Avaliação de Produto/Serviço); o gate P1–P16 é trocado por "objeto ativo", na criação, na reavaliação e na
 * conclusão. Sem origem = Porta 1, exatamente como antes — e a Porta 1 não inicia um Posicionamento de item que um
 * objeto ativo referencia (objetos-organizacionais-por-referencia). hipoteseInicial (um dos 8 firmes ou NAO_SEI):
 * obrigatória nas duas portas em todo registro novo (só 'Atualizar com motor atual' segue sem ela, levando a da anterior); fixa no registro; nunca entra no resultado (o
 * resultado continua conferido pela tabela do motor, só a partir das respostas). Origem passa da anterior para a
 * reavaliação. */
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
/* H3-b — a FRONTEIRA CONFIÁVEL grava com a identidade restrita 'fronteira-confiavel' (Admin SDK com
   databaseAuthVariableOverride: só existe com a credencial de servidor) e PASSA PELAS REGRAS. Aqui ela só pode concluir
   avaliação de motor ≥ 2 (a v1 continua concluída pela tela, conferida pela tabela). Sempre avaliada primeiro: a
   identidade restrita não tem auth.token. */
const FRONTEIRA = "(auth != null && auth.uid === 'fronteira-confiavel')";
const ESCF = '(' + FRONTEIRA + ' || (' + ESC + '))';
const VIGM = "root.child('posicionamento-motor-vigencia').child('versaoEmVigor')";
const EMVIGOR = '(' + VIGM + '.exists() ? ' + VIGM + '.val() : 1)';
const OBJ = 'objetos-organizacionais', IDXREF = 'objetos-organizacionais-por-referencia', ORIGEM2 = 'objeto-organizacional';
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
/* H0 — GATE P1–P16 → O1–O9: a base precisa estar com MOTOR ATUAL (a mesma "atual" de diagnosticoMotor em
   avaliacao-produto.js): a lógica em código da época = MOTOR_VERSION de hoje (lida do próprio arquivo — mudou lá,
   este arquivo diverge e teste-regras-posicionamento-tabela.js obriga a remontar) e a versão das regras = a publicada
   (ausente = 1, como versaoAtual()). "Equivalente" não passa. Que a base seja a PONTA da cadeia (sem reavaliação de
   P1–P16 em andamento) as regras não conseguem ver — sem índice reverso; isso fica com a tela e com a fronteira
   confiável do H2. */
const MOTOR_PRODUTO = (fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'avaliacao-produto.js'), 'utf8').match(/\n  var MOTOR_VERSION = '([^']+)';/) || [])[1];
if (!MOTOR_PRODUTO) throw new Error('MOTOR_VERSION não encontrado em avaliacao-produto.js');
const PUB = "root.child('motor-arquitetura-config/versaoPublicada')";
const ID = '/^[A-Za-z0-9_-]{1,60}$/';
const HIPOTESES = M.CODIGOS_FIRMES.concat(['NAO_SEI']);
const eqUmH = (x) => '(' + HIPOTESES.map((k) => x + " === '" + k + "'").join(' || ') + ')';
const semCampos = (xs) => and(xs.map((x) => '!' + c(x) + '.exists()'));
const CONCL = ['resultadoAutomatico', 'nomesNaConclusao', 'concluidoPor', 'concluidoEm', 'auditoriaConclusaoId'];
const DESC = ['motivoDescarte', 'descartadoPor', 'descartadoEm', 'auditoriaDescarteId'];
/* texto não pode ser só espaço em branco (espaço, tabulação, quebra de linha, retorno). O regex das regras não
   conhece \s nem \S e não aceita esses caracteres na classe; replace troca TODAS as ocorrências (provado no
   emulador, seção H de teste-rules-posicionamento.js). */
const naoEmBranco = (x) => x + ".replace(' ', '').replace('\\t', '').replace('\\n', '').replace('\\r', '').length > 0";
const ANTID = v('avaliacaoAnteriorId');
const ANT = "root.child('" + AV + "').child(" + ANTID + ")";
/* versão do motor do registro (ausente = 1) e da anterior */
const VERS = '(' + c('versaoMotor') + '.exists() ? ' + v('versaoMotor') + ' : 1)';
const VERSANT = '(' + ANT + ".child('versaoMotor').exists() ? " + ANT + ".child('versaoMotor').val() : 1)";
const VIGRAIZ = "root.child('" + VIG + "').child(" + v('itemId') + ')';
/* PORTA 2: o objeto organizacional (estado depois da gravação) */
const PORTA2 = v('origem') + " === '" + ORIGEM2 + "'";
const OBJN = NOVO(OBJ) + '.child(' + v('itemId') + ')';
const objetoAtivo = OBJN + ".child('situacao').val() === 'ativo'";

/* a base P1–P16 (a avaliacaoArquiteturalId gravada) tem de estar concluída, fora da Lixeira e com Motor atual — na
   criação, na reavaliação e de novo na CONCLUSÃO (a base pode ter mudado depois que o rascunho foi aberto) */
const baseValida = [
  P + ".child('status').val() === 'concluido'", P + ".child('excluido').val() !== true",
  P + ".child('motorVersion').val() === '" + MOTOR_PRODUTO + "'",
  P + ".child('motorVersionArquitetura').val() === (" + PUB + '.exists() ? ' + PUB + '.val() : 1)'
];
const criar = and([
  v('status') + " === 'rascunho'", v('revisao') + ' === 1', v('criadoPor/email') + ' === auth.token.email',
  /* Porta 2: objeto ativo, sem base P1–P16, com o nome do objeto e com hipótese. Porta 1: o gate H0 de sempre, e o
     item não pode estar referenciado por um objeto ativo */
  '(' + PORTA2 + ' ? (' + and([objetoAtivo, '!' + c('avaliacaoArquiteturalId') + '.exists()', v('itemNome') + ' === ' + OBJN + ".child('nome').val()",
    c('hipoteseInicial') + '.exists()']) + ') : (' + and([c('avaliacaoArquiteturalId') + '.exists()'].concat(baseValida).concat([
    '(' + P + ".child('itemId').val() === " + v('itemId') + ' || (!' + P + ".child('itemId').exists() && " + v('avaliacaoArquiteturalId') + ' === ' + v('itemId') + '))',
    '!' + NOVO(IDXREF) + '.child(' + v('itemId') + ').exists()',
    /* hipótese inicial obrigatória nos registros NOVOS (a atualização para o motor atual leva a da anterior, se houver) */
    '(' + c('hipoteseInicial') + '.exists() || ' + v('origemReavaliacao') + " === 'motor')"])) + '))',
  /* primeira versão: o item não tem vigente. Reavaliação: versão seguinte da VIGENTE, com motivo. */
  '(' + c('avaliacaoAnteriorId') + '.exists() ? (' + and([
    ANT + ".child('status').val() === 'concluido'", ANT + ".child('itemId').val() === " + v('itemId'), ANT + ".child('origem').val() === " + v('origem'),
    VIGRAIZ + '.val() === ' + ANTID, v('versao') + ' === ' + ANT + ".child('versao').val() + 1",
    c('motivoReavaliacao') + '.isString()', naoEmBranco(v('motivoReavaliacao')),
    /* H3-b: reavaliar mantém o motor da anterior; "Atualizar com motor atual" (origem 'motor') vai para o motor EM VIGOR, mais novo */
    '((!' + c('origemReavaliacao') + '.exists() && ' + VERS + ' === ' + VERSANT + ') || (' + v('origemReavaliacao') + " === 'motor' && " + VERS + ' === ' + EMVIGOR + ' && ' + VERS + ' > ' + VERSANT + '))'
  ]) + ') : (' + and(['!' + VIGRAIZ + '.exists()', v('versao') + ' === 1', '!' + c('motivoReavaliacao') + '.exists()', '!' + c('origemReavaliacao') + '.exists()',
    /* H3-b: a primeira versão nasce no motor EM VIGOR (lido do banco; sem registro = 1) */
    VERS + ' === ' + EMVIGOR]) + '))',
  AUDNOVA('auditoriaCriacaoId') + ".child('tipo').val() === 'criacao'", '!' + AUDANT('auditoriaCriacaoId') + '.exists()'
]);
const fixos = ['itemId', 'itemNome', 'avaliacaoArquiteturalId', 'origem', 'hipoteseInicial', 'questionnaireContentVersion', 'versao', 'avaliacaoAnteriorId', 'motivoReavaliacao', 'versaoMotor', 'origemReavaliacao', 'criadoPor/email', 'criadoPor/name', 'criadoEm', 'auditoriaCriacaoId'];
const alterar = and(fixos.map((f) => v(f) + ' === ' + d(f)).concat([v('revisao') + ' === ' + d('revisao') + ' + 1']));
const rascunho = and([NOVO(RES) + '.child(' + v('itemId') + ').val() === $avaliacaoId', semCampos(CONCL), semCampos(DESC)]);
const concluidoComum = [
  "newData.hasChildren(['" + CONCL.filter((x) => x !== 'nomesNaConclusao').join("','") + "'])", semCampos(DESC),
  '!' + NOVO(RES) + '.child(' + v('itemId') + ').exists()',
  /* vigente: nasce na primeira versão; numa reavaliação, troca por compare-and-set (só se ainda é a anterior) */
  NOVO(VIG) + '.child(' + v('itemId') + ').val() === $avaliacaoId',
  '(' + c('avaliacaoAnteriorId') + '.exists() ? ' + VIGRAIZ + '.val() === ' + ANTID + ' : !' + VIGRAIZ + '.exists())',
  AUDNOVA('auditoriaConclusaoId') + ".child('tipo').val() === 'conclusao'", '!' + AUDANT('auditoriaConclusaoId') + '.exists()',
  '(' + PORTA2 + ' ? (' + objetoAtivo + ') : (' + and(baseValida) + '))'
];
/* a TELA conclui só a v1, com o resultado conferido pela tabela; a v ≥ 2 é concluída só pela fronteira confiável */
const concluido = and([v('concluidoPor/email') + ' === auth.token.email', '!' + c('versaoMotor') + '.exists()'].concat(concluidoComum).concat([T.trechoResultado()]));
const concluidoPelaFronteira = and([c('versaoMotor') + '.exists()', v('resultadoAutomatico/versaoMotor') + ' === ' + v('versaoMotor')].concat(concluidoComum));
const descartado = and([
  "newData.hasChildren(['" + DESC.join("','") + "'])", v('descartadoPor/email') + ' === auth.token.email', semCampos(CONCL),
  naoEmBranco(v('motivoDescarte')),
  '!' + NOVO(RES) + '.child(' + v('itemId') + ').exists()',
  AUDNOVA('auditoriaDescarteId') + ".child('tipo').val() === 'descarte'", '!' + AUDANT('auditoriaDescarteId') + '.exists()'
]);
const pelaTela = and([
  v('atualizadoPor/email') + ' === auth.token.email',
  '(data.exists() ? (' + alterar + ') : (' + criar + '))',
  '(' + v('status') + " === 'rascunho' ? (" + rascunho + ') : ' + v('status') + " === 'concluido' ? (" + concluido + ') : (' + descartado + '))',
  /* o caminho é o do motor v1 (tabela); o de v ≥ 2 a fronteira recalcula na conclusão */
  '(!' + c('versaoMotor') + '.exists() ? (' + T.trechoCaminho() + ') : true)'
]);
/* fronteira: só rascunho → concluído de um registro de motor ≥ 2, sem mexer no que é fixo */
const pelaFronteira = and(['data.exists()', "data.child('status').val() === 'rascunho'", alterar, v('status') + " === 'concluido'", concluidoPelaFronteira]);
const validar = and([
  '$avaliacaoId.matches(' + ID + ')',
  "newData.hasChildren(['itemId','itemNome','questionarioCodigo','questionnaireContentVersion','versao','status','revisao','criadoPor','criadoEm','atualizadoPor','atualizadoEm','auditoriaCriacaoId'])",
  '(' + FRONTEIRA + ' ? (' + pelaFronteira + ') : (' + pelaTela + '))'
]);
const pessoa = { '.validate': "newData.hasChildren(['email'])", name: { '.validate': 'newData.isString() && newData.val().length <= 200' }, email: { '.validate': 'newData.isString()' }, $outro: { '.validate': false } };
const texto = (n) => ({ '.validate': 'newData.isString() && newData.val().length <= ' + n });
const codigosEq = (x) => '(' + CODS.map((k) => x + " === '" + k + "'").join(' || ') + ')';
const blocoAv = {
  '.read': LEIT,
  $avaliacaoId: {
    '.write': ESCF + " && newData.exists() && (!data.exists() || data.child('status').val() === 'rascunho')",
    '.validate': validar,
    itemId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    itemNome: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 200' },
    avaliacaoArquiteturalId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    origem: { '.validate': "newData.val() === '" + ORIGEM2 + "'" },
    hipoteseInicial: { '.validate': eqUmH('newData.val()') },
    questionarioCodigo: { '.validate': "newData.val() === 'POSICIONAMENTO_ORGANIZACIONAL'" },
    questionnaireContentVersion: { '.validate': 'newData.isNumber() && newData.val() >= 1' },
    versao: { '.validate': 'newData.isNumber() && newData.val() >= 1' },
    avaliacaoAnteriorId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    motivoReavaliacao: { '.validate': 'newData.isString() && newData.val().length <= 500' },
    /* H3-b: motor do registro (ausente = 1; só se grava de 2 a 99) e a origem "motor" da atualização para o motor atual */
    versaoMotor: { '.validate': 'newData.isNumber() && newData.val() >= 2 && newData.val() <= 99 && newData.val() % 1 === 0' },
    origemReavaliacao: { '.validate': "newData.val() === 'motor' && newData.parent().child('avaliacaoAnteriorId').exists()" },
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
    /* D2 de predominância: só em registro de motor ≥ 2 */
    predominancias: {
      '.validate': "newData.parent().child('versaoMotor').exists()",
      $nivel: {
        '.validate': "$nivel.matches(/^N[1-3]$/) && newData.hasChildren(['resposta','papeis','questionnaireContentVersion','dataResposta'])",
        resposta: { '.validate': 'newData.isString() && newData.val().matches(/^[A-Z_]{1,40}$/)' },
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
    '.write': ESCF + " && ((!data.exists() && newData.exists()) || (data.exists() && !newData.exists() && newData.parent().parent().child('" + AV + "').child(data.val()).exists() && newData.parent().parent().child('" + AV + "').child(data.val()).child('status').val() !== 'rascunho'))",
    '.validate': "newData.isString() && newData.parent().parent().child('" + AV + "').child(newData.val()).child('status').val() === 'rascunho' && newData.parent().parent().child('" + AV + "').child(newData.val()).child('itemId').val() === $itemId"
  }
};
const blocoVig = {
  '.read': LEIT,
  $itemId: {
    /* nasce, ou troca para a versão seguinte cuja anterior é a atual (compare-and-set); nunca é apagado */
    '.write': ESCF + " && newData.exists() && (!data.exists() || data.val() === newData.parent().parent().child('" + AV + "').child(newData.val()).child('avaliacaoAnteriorId').val())",
    '.validate': "newData.isString() && newData.parent().parent().child('" + AV + "').child(newData.val()).child('status').val() === 'concluido' && newData.parent().parent().child('" + AV + "').child(newData.val()).child('itemId').val() === $itemId && root.child('" + AV + "').child(newData.val()).child('status').val() === 'rascunho'"
  }
};
const DECNOVA = "newData.parent().parent().parent().child('" + DEC + "').child($avaliacaoId)";
const igual = (campos, base) => and(campos.map((f) => v(f) + ' === ' + base + ".child('" + f + "').val()"));
const blocoAud = {
  '.read': LEIT,
  $avaliacaoId: {
    $auditoriaId: {
      '.write': ESCF + ' && !data.exists() && newData.exists()',
      '.validate': and([
        "newData.hasChildren(['tipo','itemId','usuario','dataHora'])", '(' + FRONTEIRA + ' || ' + v('usuario/email') + ' === auth.token.email)', v('itemId') + ' === ' + AVNOVA + ".child('itemId').val()",
        '((' + v('tipo') + " === 'criacao' && " + AVNOVA + ".child('auditoriaCriacaoId').val() === $auditoriaId && " +
        v('avaliacaoAnteriorId') + ' === ' + AVNOVA + ".child('avaliacaoAnteriorId').val() && " + v('motivo') + ' === ' + AVNOVA + ".child('motivoReavaliacao').val() && " +
        v('origem') + ' === ' + AVNOVA + ".child('origem').val() && " + v('hipoteseInicial') + ' === ' + AVNOVA + ".child('hipoteseInicial').val()) || (" +
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
      origemReavaliacao: { '.validate': "newData.val() === 'motor'" }, versaoMotorAnterior: { '.validate': 'newData.isNumber()' },
      codigoAutomatico: { '.validate': 'newData.isString()' }, codigoFinal: { '.validate': 'newData.isString()' }, tipoDecisao: { '.validate': 'newData.isString()' },
      versaoAvaliacao: { '.validate': 'newData.isNumber()' }, justificativa: texto(2000),
      origem: { '.validate': "newData.val() === '" + ORIGEM2 + "'" }, hipoteseInicial: { '.validate': eqUmH('newData.val()') },
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
module.exports = { BLOCOS, NOS: [AV, RES, VIG, AUD, DEC], MOTOR_PRODUTO };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGEM de database.rules.json: ' + divergentes.join(', ') : 'os 5 nós publicados são os montados');
    process.exit(divergentes.length ? 1 : 0);
  }
  /* H3-b: substitui CADA nó no lugar (antes, cortava o arquivo a partir do primeiro e apagava os nós que vinham depois) */
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(BLOCOS).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    if (ini === -1) throw new Error('nó ausente em database.rules.json: ' + n);
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
