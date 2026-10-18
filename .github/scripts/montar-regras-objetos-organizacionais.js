/* Monta as regras dos 4 nós dos OBJETOS ORGANIZACIONAIS (Porta 2 do Posicionamento) em database.rules.json:
 *   objetos-organizacionais, objetos-organizacionais-auditoria, objetos-organizacionais-por-referencia,
 *   objetos-organizacionais-excluidos (registro mínimo de cada exclusão).
 *
 * EXCLUSÃO (contrato em dois níveis, aprovado em 2026-10-15): o cadastro sai de verdade, numa gravação atômica com o
 * registro mínimo (nome, descrição, motivo, nível, quem, quando) e o evento de auditoria 'exclusao'. Avaliações,
 * decisões, índices de vigência e auditorias continuam intactos (o registro mínimo explica a que cadastro pertenciam).
 *   - comum (admin geral e avaliacao-arquitetura): sem Posicionamento concluído (vigente);
 *   - excepcional (só admin geral): já avaliado (a origem numa análise não pesa: o índice dela fica, explicado pelo registro);
 *   - nos dois: nenhum rascunho aberto e nenhuma estrutura responsável ativa — antes e depois da gravação (conferido
 *     no banco, então uma verificação desatualizada na tela não passa); o id excluído não renasce.
 *
 * O que as regras garantem (provado no emulador por teste-rules-objetos-organizacionais.js):
 *   - leitura: os três perfis da Avaliação (admin geral, avaliacao, avaliacao-arquitetura); gravação: admin geral e
 *     avaliacao-arquitetura — os mesmos do Posicionamento;
 *   - ciclo de vida: criado ativo (revisão 1) → alterado (revisão anterior + 1; criação e referência fixas) →
 *     encerrado (motivo, final); nada se apaga; horários = horário do SERVIDOR (now); autoria = o token;
 *   - toda gravação do objeto traz, na MESMA gravação, a sua auditoria nova (criacao / alteracao / encerramento),
 *     só de acréscimo, com antes → depois conferidos contra o objeto;
 *   - encerrar exige: nenhum rascunho de Posicionamento aberto para o objeto e nenhuma estrutura responsável ativa;
 *   - referência informativa a um item P1–P16 (opcional, fixa): no máximo um objeto ativo por item (índice), e só
 *     se o item não tiver Posicionamento vigente nem rascunho aberto; encerrar libera o índice na mesma gravação.
 * O índice também é lido pelas regras do Posicionamento (montar-regras-posicionamento.js): com ele, a Porta 1 não
 * inicia um novo Posicionamento do item referenciado.
 *
 *   node .github/scripts/montar-regras-objetos-organizacionais.js --gravar   (reescreve os 3 nós)
 *   node .github/scripts/montar-regras-objetos-organizacionais.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const K = "auth.token.email.replace('@','_').replace('.','_')";
const ADM = "(auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br') || root.child('fa-admins').child(" + K + ").exists()";
const TIPO = "root.child('fa-avaliacao-autorizados').child(" + K + ").child('tipo').val()";
const LEIT = "auth != null && ((" + ADM + ") || (" + TIPO + " === 'avaliacao' || " + TIPO + " === 'avaliacao-arquitetura'))";
const ESC = "auth != null && ((" + ADM + ") || " + TIPO + " === 'avaliacao-arquitetura')";
const NODE = 'objetos-organizacionais', AUD = 'objetos-organizacionais-auditoria', IDX = 'objetos-organizacionais-por-referencia', EXC = 'objetos-organizacionais-excluidos';

const RES = 'posicionamento-rascunho-por-item', VIG = 'posicionamento-vigente-por-item', VINC_ATIVO = 'estruturas-vinculos/ativo-por-objeto';
/* E3: colaboradoras ativas também impedem encerrar e excluir (nenhuma estrutura fica respondendo por um cadastro que saiu) */
const VINC_COLAB = 'estruturas-vinculos/colaboradoras-ativas';
const ID = '/^[A-Za-z0-9_-]{1,60}$/';
const CAMPOS = ['nome', 'descricao', 'finalidade', 'contexto'];
const and = (xs) => xs.join(' && ');
const c = (s) => "newData.child('" + s + "')";
const v = (s) => c(s) + '.val()';
const d = (s) => "data.child('" + s + "').val()";
/* texto não pode ser só espaço em branco (mesmo recurso de montar-regras-posicionamento.js) */
const naoEmBranco = (x) => x + ".replace(' ', '').replace('\\t', '').replace('\\n', '').replace('\\r', '').length > 0";
const textoObrig = (n) => ({ '.validate': 'newData.isString() && newData.val().length <= ' + n + ' && ' + naoEmBranco('newData.val()') });
const pessoa = {
  '.validate': "newData.hasChildren(['uid','email'])",
  uid: { '.validate': 'newData.isString()' }, email: { '.validate': 'newData.isString()' },
  name: { '.validate': 'newData.isString() && newData.val().length <= 200' }, $outro: { '.validate': false }
};
const ehAutor = (p) => v(p + '/uid') + ' === auth.uid && ' + v(p + '/email') + ' === auth.token.email';

/* ---------- objetos-organizacionais/$id ---------- */
const RAIZ_NOVA = 'newData.parent().parent()';
const AUD_NOVA = RAIZ_NOVA + ".child('" + AUD + "').child($id).child(" + v('auditoriaId') + ')';
const REF = v('referenciaItemId');
const criar = and([
  "!root.child('" + EXC + "').child($id).exists()",
  v('situacao') + " === 'ativo'", v('revisao') + ' === 1', ehAutor('criadoPor'), v('criadoEm') + ' === now',
  '!' + c('encerramento') + '.exists()', AUD_NOVA + ".child('tipo').val() === 'criacao'",
  '(' + c('referenciaItemId') + '.exists() ? (' + and([
    RAIZ_NOVA + ".child('" + IDX + "').child(" + REF + ').val() === $id',
    "!root.child('" + IDX + "').child(" + REF + ').exists()',
    "!root.child('" + RES + "').child(" + REF + ').exists()', "!root.child('" + VIG + "').child(" + REF + ').exists()',
    '!' + RAIZ_NOVA + ".child('" + RES + "').child(" + REF + ').exists()', '!' + RAIZ_NOVA + ".child('" + VIG + "').child(" + REF + ').exists()'
  ]) + ') : true)'
]);
const fixos = ['criadoPor/uid', 'criadoPor/email', 'criadoPor/name', 'criadoEm', 'referenciaItemId'];
const continua = and(fixos.map((f) => v(f) + ' === ' + d(f)).concat([v('revisao') + ' === ' + d('revisao') + ' + 1']));
const alterar = and([v('situacao') + " === 'ativo'", '!' + c('encerramento') + '.exists()', AUD_NOVA + ".child('tipo').val() === 'alteracao'"]);
const encerrar = and([
  v('situacao') + " === 'encerrado'"].concat(CAMPOS.map((f) => v(f) + ' === ' + d(f))).concat([
  "newData.hasChildren(['encerramento'])", v('encerramento/em') + ' === now', ehAutor('encerramento/por'),
  AUD_NOVA + ".child('tipo').val() === 'encerramento'", AUD_NOVA + ".child('motivo').val() === " + v('encerramento/motivo'),
  /* sem rascunho de Posicionamento aberto e sem estrutura responsável ativa — antes e depois da gravação */
  "!root.child('" + RES + "').child($id).exists()", '!' + RAIZ_NOVA + ".child('" + RES + "').child($id).exists()",
  "!root.child('" + VINC_ATIVO + "').child($id).exists()", '!' + RAIZ_NOVA + ".child('" + VINC_ATIVO + "').child($id).exists()",
  "!root.child('" + VINC_COLAB + "').child($id).exists()", '!' + RAIZ_NOVA + ".child('" + VINC_COLAB + "').child($id).exists()",
  '(' + c('referenciaItemId') + '.exists() ? !' + RAIZ_NOVA + ".child('" + IDX + "').child(" + REF + ').exists() : true)'
]));
const blocoObj = {
  '.read': LEIT,
  $id: {
    '.write': ESC + " && (newData.exists() ? (!data.exists() || data.child('situacao').val() === 'ativo') : (data.exists() && " + RAIZ_NOVA + ".child('" + EXC + "').child($id).exists() && !root.child('" + EXC + "').child($id).exists()))",
    '.validate': and([
      '$id.matches(' + ID + ')',
      "newData.hasChildren(['nome','descricao','finalidade','situacao','revisao','criadoPor','criadoEm','atualizadoPor','atualizadoEm','auditoriaId'])",
      ehAutor('atualizadoPor'), v('atualizadoEm') + ' === now',
      AUD_NOVA + ".child('revisao').val() === " + v('revisao'), "!root.child('" + AUD + "').child($id).child(" + v('auditoriaId') + ').exists()',
      '(data.exists() ? (' + continua + ' && (' + v('situacao') + " === 'ativo' ? (" + alterar + ') : (' + encerrar + '))) : (' + criar + '))'
    ]),
    nome: textoObrig(200), descricao: textoObrig(2000), finalidade: textoObrig(2000), contexto: textoObrig(2000),
    referenciaItemId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    situacao: { '.validate': "newData.val() === 'ativo' || newData.val() === 'encerrado'" },
    revisao: { '.validate': 'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0' },
    criadoPor: pessoa, atualizadoPor: pessoa,
    criadoEm: { '.validate': 'newData.isNumber()' }, atualizadoEm: { '.validate': 'newData.isNumber()' },
    auditoriaId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    encerramento: {
      '.validate': "newData.hasChildren(['motivo','em','por'])",
      motivo: textoObrig(500), em: { '.validate': 'newData.isNumber()' }, por: pessoa, $outro: { '.validate': false }
    },
    $outro: { '.validate': false }
  }
};

/* ---------- objetos-organizacionais-auditoria/$objetoId/$auditoriaId (só acréscimo) ---------- */
const OBJN = "newData.parent().parent().parent().child('" + NODE + "').child($objetoId)";
const EXCN = "newData.parent().parent().parent().child('" + EXC + "').child($objetoId)";
const OBJR = "root.child('" + NODE + "').child($objetoId)";
const camposIguais = (lado, base, lista) => and(lista.map((f) => v(lado + '/' + f) + ' === ' + base + ".child('" + f + "').val()"));
const textoAud = (n) => ({ '.validate': 'newData.isString() && newData.val().length <= ' + n });
const blocoAud = {
  '.read': LEIT,
  $objetoId: {
    $auditoriaId: {
      '.write': ESC + ' && !data.exists() && newData.exists()',
      '.validate': and([
        '$auditoriaId.matches(' + ID + ')', "newData.hasChildren(['tipo','revisao','por','em'])", ehAutor('por'), v('em') + ' === now',
        '(' + v('tipo') + " === 'exclusao' ? (" + and([
          '!' + OBJN + '.exists()', OBJR + '.exists()', EXCN + ".child('auditoriaId').val() === $auditoriaId",
          v('revisao') + ' === ' + OBJR + ".child('revisao').val() + 1", v('motivo') + ' === ' + EXCN + ".child('motivo').val()", '!' + c('antes') + '.exists()', '!' + c('depois') + '.exists()'
        ]) + ') : (' + and([OBJN + ".child('auditoriaId').val() === $auditoriaId", v('revisao') + ' === ' + OBJN + ".child('revisao').val()"]) + '))',
        '(' + v('tipo') + " === 'exclusao' || (" + v('tipo') + " === 'criacao' && " + and([v('revisao') + ' === 1', '!' + c('antes') + '.exists()', '!' + c('motivo') + '.exists()',
          camposIguais('depois', OBJN, CAMPOS.concat(['referenciaItemId']))]) + ') || (' +
        v('tipo') + " === 'alteracao' && " + and([OBJN + ".child('situacao').val() === 'ativo'", '!' + c('motivo') + '.exists()',
          camposIguais('depois', OBJN, CAMPOS), camposIguais('antes', OBJR, CAMPOS)]) + ') || (' +
        v('tipo') + " === 'encerramento' && " + and([OBJN + ".child('situacao').val() === 'encerrado'", '!' + c('antes') + '.exists()', '!' + c('depois') + '.exists()',
          v('motivo') + ' === ' + OBJN + ".child('encerramento/motivo').val()"]) + '))'
      ]),
      tipo: { '.validate': "newData.val() === 'criacao' || newData.val() === 'alteracao' || newData.val() === 'encerramento' || newData.val() === 'exclusao'" },
      revisao: { '.validate': 'newData.isNumber()' }, por: pessoa, em: { '.validate': 'newData.isNumber()' }, motivo: textoAud(500),
      antes: { nome: textoAud(200), descricao: textoAud(2000), finalidade: textoAud(2000), contexto: textoAud(2000), $outro: { '.validate': false } },
      depois: { nome: textoAud(200), descricao: textoAud(2000), finalidade: textoAud(2000), contexto: textoAud(2000),
        referenciaItemId: { '.validate': 'newData.isString()' }, $outro: { '.validate': false } },
      $outro: { '.validate': false }
    }
  }
};

/* ---------- objetos-organizacionais-por-referencia/$itemId → objetoId ---------- */
const OBJ_DO_INDICE = (x) => "newData.parent().parent().child('" + NODE + "').child(" + x + ')';
const blocoIdx = {
  '.read': LEIT,
  $itemId: {
    /* nasce com o objeto (na mesma gravação); só sai quando o objeto é encerrado (na mesma gravação); nunca é trocado */
    '.write': ESC + ' && ((!data.exists() && newData.exists()) || (data.exists() && !newData.exists() && (' + OBJ_DO_INDICE('data.val()') + ".child('situacao').val() === 'encerrado' || (!" + OBJ_DO_INDICE('data.val()') + ".exists() && newData.parent().parent().child('" + EXC + "').child(data.val()).exists()))))",
    '.validate': and([
      '$itemId.matches(' + ID + ')', 'newData.isString()',
      OBJ_DO_INDICE('newData.val()') + ".child('referenciaItemId').val() === $itemId",
      OBJ_DO_INDICE('newData.val()') + ".child('situacao').val() === 'ativo'",
      "!root.child('" + NODE + "').child(newData.val()).exists()"
    ])
  }
};

/* ---------- objetos-organizacionais-excluidos/$id: o registro mínimo de cada exclusão (escrito uma vez, imutável) ---------- */
const OBJ_ANTES = "root.child('" + NODE + "').child($id)", RAIZ_EXC = 'newData.parent().parent()';
const semDep = (no) => "!root.child('" + no + "').child($id).exists() && !" + RAIZ_EXC + ".child('" + no + "').child($id).exists()";
const blocoExc = {
  '.read': LEIT,
  $id: {
    '.write': ESC + ' && !data.exists() && newData.exists()',
    '.validate': and([
      '$id.matches(' + ID + ')', "newData.hasChildren(['nome','motivo','nivel','excluidoEm','excluidoPor','auditoriaId'])",
      OBJ_ANTES + '.exists()', '!' + RAIZ_EXC + ".child('" + NODE + "').child($id).exists()",
      v('nome') + ' === ' + OBJ_ANTES + ".child('nome').val()", v('excluidoEm') + ' === now', ehAutor('excluidoPor'),
      RAIZ_EXC + ".child('" + AUD + "').child($id).child(" + v('auditoriaId') + ").child('tipo').val() === 'exclusao'",
      /* nos dois níveis: nenhum rascunho aberto e nenhuma estrutura responsável ativa (antes e depois da gravação) */
      semDep(RES), semDep(VINC_ATIVO), semDep(VINC_COLAB),
      /* a referência informativa sai do índice na mesma gravação (se ainda apontava para este objeto) */
      '(' + OBJ_ANTES + ".child('referenciaItemId').exists() ? " + RAIZ_EXC + ".child('" + IDX + "').child(" + OBJ_ANTES + ".child('referenciaItemId').val()).val() !== $id : true)",
      /* comum: sem Posicionamento concluído (vigente); excepcional (já avaliado): só o admin geral */
      '(' + v('nivel') + " === 'comum' ? (" + semDep(VIG) + ') : (' + ADM + '))'
    ]),
    nome: textoObrig(200), descricao: { '.validate': 'newData.isString() && newData.val().length <= 2000' },
    motivo: textoObrig(500), nivel: { '.validate': "newData.val() === 'comum' || newData.val() === 'excepcional'" },
    situacaoAnterior: { '.validate': "newData.val() === 'ativo' || newData.val() === 'encerrado'" },
    referenciaItemId: { '.validate': 'newData.isString()' },
    dependencias: { '.validate': 'newData.hasChildren()', $dep: { '.validate': 'newData.isString() || newData.isBoolean()' } },
    excluidoEm: { '.validate': 'newData.isNumber()' }, excluidoPor: pessoa,
    auditoriaId: { '.validate': 'newData.isString() && newData.val().matches(' + ID + ')' },
    $outro: { '.validate': false }
  }
};

const BLOCOS = { [NODE]: blocoObj, [AUD]: blocoAud, [IDX]: blocoIdx, [EXC]: blocoExc };
module.exports = { BLOCOS, NOS: [NODE, AUD, IDX, EXC] };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const divergentes = Object.keys(BLOCOS).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(BLOCOS[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGEM de database.rules.json: ' + divergentes.join(', ') : 'os 4 nós publicados são os montados');
    process.exit(divergentes.length ? 1 : 0);
  }
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(BLOCOS).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    if (ini === -1) {
      /* nó novo: entra antes do fecho de "rules" */
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
