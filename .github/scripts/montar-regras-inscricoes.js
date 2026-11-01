/* Monta as regras das INSCRIÇÕES EM TURMAS em database.rules.json: turmas, turmas-config, turmas-equipe,
 * turmas-interesse e turmas-interesse-log (Etapa B — segurança das inscrições).
 *
 * Antes, qualquer conta @previ.com.br gravava qualquer coisa nesses nós, então as restrições de público (lista da
 * turma e do evento, gerentes/técnicos, diretores, inscrições encerradas) só existiam na TELA: pela API dava para se
 * autoinscrever como confirmada, mexer no registro de outra pessoa, ignorar o público ou desligar a restrição da
 * própria turma. Agora o banco impõe as mesmas regras.
 *
 * Reaproveita o que já existe — sem sistema paralelo: ADM (lista fixa + fa-admins, a mesma expressão de fa-users) e
 * PROPRIA_CHAVE (a chave da própria pessoa, derivada do e-mail do token exatamente como a emailKey do site —
 * montar-regras-fa-users.js, provada com hífen, +, apóstrofo, aspas, barra invertida, # e $, e com 64 e mais de 64
 * caracteres).
 *
 * O que as regras garantem (provado no emulador por teste-rules-inscricoes.js):
 *   - turmas, turmas-config, turmas-equipe: grava SÓ o admin (as únicas portas que gravam ali são do painel);
 *   - turmas-interesse: o admin grava tudo, como antes. A pessoa (não admin) grava SÓ na própria chave e só duas coisas:
 *       a) REGISTRAR interesse ("Tenho interesse", app.js registerInterest — um set do registro inteiro): o registro
 *          resultante é { name, email (o do token), area, date, removed: false, status: 'interessado' }, sem nenhum campo de
 *          confirmação; não sobrescreve uma inscrição (status 'inscrito' ativa); e a pessoa precisa caber, AO MESMO
 *          TEMPO, em todas as restrições do evento e da turma — lista da turma (publicoRestrito), lista do evento
 *          (publicoRestrito), só diretores (restritoADiretores + fa-diretores), público do evento ("Quem participa"
 *          Gerentes/Técnicos) e da turma (publicoCargo) pela lista fa-gerentes, inscrições abertas (turmas-config
 *          finalizada/encerrada). Lista vazia ou ausente numa turma restrita = ninguém entra;
 *       b) REMOVER o próprio registro ("Remover interesse", app.js removeInterest — update de removed, removedDate e
 *          status): o resultado tem removed: true e status 'removido', e nenhum campo administrativo muda. Vale para
 *          qualquer registro próprio, inclusive o de quem ficou fora de um público que mudou depois;
 *     a pessoa nunca grava status 'inscrito', campos de confirmação ou de decisão do admin, nem apaga o registro;
 *   - turmas-interesse-log: o admin grava tudo, como antes; a pessoa só ACRESCENTA itens no próprio histórico, com
 *     action 'registrado' ou 'removido' e o próprio e-mail — nunca muda nem apaga um item, nem escreve no de outra.
 * Vagas, "uma turma por pessoa" e "já participou" dependem de contar registros e continuam conferidas na tela.
 *
 *   node .github/scripts/montar-regras-inscricoes.js --gravar   (reescreve os 5 nós)
 *   node .github/scripts/montar-regras-inscricoes.js            (só confere; sai com erro se divergir)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const { ADM, PROPRIA_CHAVE } = require('./montar-regras-fa-users.js');

const and = (xs) => xs.join(' && ');
const or = (xs) => '(' + xs.join(' || ') + ')';
const LER = "auth != null && auth.token.email.matches(/.*@previ\\.com\\.br/)";
const SO_ADMIN = 'auth != null && ' + ADM;

/* campos que só o admin grava num registro de turmas-interesse: os que admin.js põe além dos da pessoa, conferidos
   também nos registros reais (leitura agregada de 01/11/2026). Na remoção feita pela pessoa nenhum deles pode mudar
   nem sumir; um campo administrativo NOVO precisa entrar aqui (fora da lista, a pessoa ainda não o grava — $outro —,
   mas uma remoção por set do registro inteiro poderia apagá-lo). */
const ADMINISTRATIVOS = ['confirmedByAdmin', 'confirmedByAdminName', 'confirmedDate',
  'addedBy', 'addedByName', 'addedByAdmin', 'addedByAdminName', 'acimaDasVagas', 'fromEspera',
  'removedByAdmin', 'removedByAdminName', 'removedByName', 'removedReason', 'removedMotivo',
  'removedParaTurma', 'removedParaTurmaLabel', 'movedToEspera', 'movedToTurma',
  'substituida', 'substituidaPor', 'substituidaPorNome', 'substituidaEm', 'substituidaPorAdmin',
  'motivoNaoConfirmado', 'motivoRegistradoEm', 'motivoRegistradoPor', 'motivoCompletadoEm', 'motivoCompletadoPor',
  'motivoEntrada', 'motivoEntradaDetalhe', 'motivoSaida', 'motivoSaidaDetalhe',
  'jaParticipouTurma', 'jaParticipouTurmaLabel'];
/* o que a pessoa grava (app.js): registrar = os 6 primeiros; remover = removed, removedDate, status */
const DA_PESSOA = ['name', 'email', 'area', 'date', 'removed', 'status', 'removedDate'];

/* ── a partir de turmas-interesse/$turmaKey/$userKey ── */
const T = "root.child('turmas').child($turmaKey)";
const EVK = T + ".child('eventoKey').val()";
const TEM_EVENTO = T + ".child('eventoKey').isString() && " + EVK + " !== ''";
const E = "root.child('eventos').child(" + EVK + ')';
const GERENTE = "root.child('fa-gerentes').child($userKey).exists()";
const CFG = "root.child('turmas-config').child($turmaKey)";

/* cada restrição: ou não está ligada, ou a pessoa cabe nela */
const DO_EVENTO = and([
  or([E + ".child('publicoRestrito').val() !== true", "root.child('eventos-publico').child(" + EVK + ').child($userKey).exists()']),
  or([E + ".child('restritoADiretores').val() !== true", "root.child('fa-diretores').child($userKey).exists()"]),
  or([E + ".child('publicoDesc').val() !== 'Técnicos'", '!' + GERENTE]),
  or([E + ".child('publicoDesc').val() !== 'Gerentes'", GERENTE])
]);
const ELEGIVEL = and([
  T + '.exists()',
  or([T + ".child('publicoRestrito').val() !== true", "root.child('turmas-publico').child($turmaKey).child($userKey).exists()"]),
  or([T + ".child('publicoCargo').val() !== 'tecnicos'", '!' + GERENTE]),
  or([T + ".child('publicoCargo').val() !== 'gerentes'", GERENTE]),
  CFG + ".child('finalizada').val() !== true",
  CFG + ".child('encerrada').val() !== true",
  /* turma sem evento ('' ou ausente) não tem restrição de evento; com evento, todas as dele valem */
  or(['!(' + TEM_EVENTO + ')', '(' + DO_EVENTO + ')'])
]);

const REGISTRAR = and([
  newOk("status", "=== 'interessado'"),
  newOk("removed", '=== false'),
  /* o registro diz o e-mail de quem grava (a sessão do site usa o do próprio token) */
  "newData.child('email').isString() && newData.child('email').val().toLowerCase() === auth.token.email.toLowerCase()",
  /* não sobrescreve uma inscrição ativa — sair dela é "Remover interesse" (ou o admin) */
  or(['!data.exists()', "data.child('removed').val() === true", "data.child('status').val() !== 'inscrito'"]),
  /* o registro resultante não carrega nada do admin (um update que tentasse reativar mantendo a confirmação cai aqui) */
  and(ADMINISTRATIVOS.map((c) => "!newData.child('" + c + "').exists()")),
  ELEGIVEL
]);
const REMOVER = and([
  'data.exists()',
  newOk('removed', '=== true'),
  newOk('status', "=== 'removido'"),
  /* nada do admin muda (nem some, num set que regravasse o registro inteiro) */
  and(ADMINISTRATIVOS.map((c) => "newData.child('" + c + "').val() === data.child('" + c + "').val()"))
]);
function newOk(c, cond) { return "newData.child('" + c + "').val() " + cond; }

const PESSOA = and(['auth != null', PROPRIA_CHAVE, 'newData.exists()', or([REGISTRAR, REMOVER])]);

const campoDaPessoa = (validacao) => ({ '.validate': or([ADM, validacao]) });
const blocoInteresse = {
  '.read': LER,
  $turmaKey: {
    /* a turma inteira (excluir turma, corrigir e-mail em lote): só o admin */
    '.write': SO_ADMIN,
    $userKey: {
      '.write': or([SO_ADMIN, PESSOA]),
      name: campoDaPessoa('newData.isString() && newData.val().length <= 200'),
      email: campoDaPessoa('newData.isString() && newData.val().length <= 200'),
      area: campoDaPessoa('newData.isString() && newData.val().length <= 200'),
      date: campoDaPessoa('newData.isString() && newData.val().length <= 40'),
      removedDate: campoDaPessoa('newData.isString() && newData.val().length <= 40'),
      removed: campoDaPessoa('newData.isBoolean()'),
      status: campoDaPessoa("newData.val() === 'interessado' || newData.val() === 'removido'"),
      /* qualquer outro campo (os de confirmação e decisão, ou um inventado): só o admin */
      $outro: { '.validate': ADM }
    }
  }
};

/* ── a partir de turmas-interesse-log/$turmaKey/$userKey/$item ── */
const LOG_PESSOA = and(['auth != null', PROPRIA_CHAVE, '!data.exists()', 'newData.exists()',
  "newData.hasChildren(['action', 'email', 'date'])",
  "(newData.child('action').val() === 'registrado' || newData.child('action').val() === 'removido')",
  "newData.child('email').isString() && newData.child('email').val().toLowerCase() === auth.token.email.toLowerCase()"]);
const campoDoLog = (validacao) => ({ '.validate': or([ADM, validacao]) });
const blocoLog = {
  '.read': LER,
  $turmaKey: {
    '.write': SO_ADMIN,
    $userKey: {
      '.write': SO_ADMIN,
      $item: {
        /* a pessoa só acrescenta no próprio histórico; um item nunca é mudado nem apagado por ela */
        '.write': or([SO_ADMIN, LOG_PESSOA]),
        name: campoDoLog('newData.isString() && newData.val().length <= 200'),
        email: campoDoLog('newData.isString() && newData.val().length <= 200'),
        area: campoDoLog('newData.isString() && newData.val().length <= 200'),
        action: campoDoLog('newData.isString()'),
        date: campoDoLog('newData.isString() && newData.val().length <= 40'),
        $outro: { '.validate': ADM }
      }
    }
  }
};

const soAdmin = () => ({ '.read': LER, $turmaKey: { '.write': SO_ADMIN } });
const BLOCOS = {
  turmas: soAdmin(),
  'turmas-config': soAdmin(),
  'turmas-equipe': soAdmin(),
  'turmas-interesse': blocoInteresse,
  'turmas-interesse-log': blocoLog
};

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
    if (ini === -1) throw new Error('nó ' + n + ' não encontrado em database.rules.json');
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
module.exports = { BLOCOS, ADMINISTRATIVOS, DA_PESSOA };
