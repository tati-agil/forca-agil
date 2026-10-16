/* Regras do MODELO SIMPLIFICADO da definição na Taxonomia (aprovado em 2026-10-15), aplicadas aos dois domínios de
 * database.rules.json (o resto das regras da Taxonomia não muda):
 *   - taxonomia/<dom>/conceitos/<c>/definicao = { texto, versao, publicadaEm, publicadaPor }: a ÚNICA definição oficial
 *     vigente. Nasce na versão 1; cada publicação é a versão anterior + 1 (compare-and-set: duas publicações concorrentes
 *     sobre a mesma versão → só uma entra; clique repetido → recusado), sempre com a entrada do histórico na MESMA
 *     gravação, com os mesmos dados. Não se apaga.
 *   - taxonomia/<dom>/definicoes/<c>/v<n>: o histórico de publicações, imutável (escrito uma vez).
 *   - taxonomia/<dom>/fontes (modelo antigo de múltiplas fontes): sai das regras — o site não lê nem grava mais; a
 *     migração (conta de serviço) arquiva o conteúdo em taxonomia-arquivo-migracao e remove o nó.
 *   - conceito: situacaoDefinicao e definicaoVigenteFonteId deixam de existir (gravação recusada por $outro).
 *   - auditoria: novo tipo 'definicao_publicada'.
 *   - taxonomia-arquivo-migracao: o que o modelo antigo tinha (fontes e ponteiros), só leitura do admin geral.
 * A leitura granular da definição pelos perfis da Avaliação é a MESMA que valia para o ponteiro antigo.
 *
 *   node .github/scripts/montar-regras-taxonomia-definicoes.js --gravar  (reescreve os nós)
 *   node .github/scripts/montar-regras-taxonomia-definicoes.js           (só confere)
 * Depois de --gravar: node .github/scripts/regras-compactas.js --gravar database.rules.min.json */
'use strict';
const fs = require('fs');
const path = require('path');
const ARQUIVO = path.join(__dirname, '..', '..', 'database.rules.json');
const K = "auth.token.email.replace('@','_').replace('.','_')";
const ADM = "(auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br') || root.child('fa-admins').child(" + K + ').exists()';
const LER_ADM = 'auth != null && (' + ADM + ')';
const GRAVAR_ADM = '(auth != null && (' + ADM + '))';
const and = (xs) => xs.join(' && ');
const DOMS = ['arquitetural', 'organizacional'];

function transformar(regrasTax, leituraDefinicao) {
  const t = JSON.parse(JSON.stringify(regrasTax));
  DOMS.forEach((d) => {
    const D = t[d], C = D.conceitos.$codigo;
    /* leitura granular (perfis da Avaliação) que valia para o ponteiro antigo: a mesma vale para a definição */
    const leitura = leituraDefinicao[d];
    /* conceito: sem situacaoDefinicao obrigatória; sem a amarração ponteiro ↔ fontes; a definição não se apaga */
    let v = C['.validate'];
    v = v.replace("'ativo','situacaoDefinicao'", "'ativo'");
    const ini = v.indexOf("(!data.child('definicaoVigenteFonteId').exists()");
    if (ini !== -1) { const fim = v.indexOf("!== 'vigente') && ", ini); v = v.slice(0, ini) + v.slice(fim + "!== 'vigente') && ".length); }
    if (v.indexOf("(!data.child('definicao').exists() || newData.child('definicao').exists())") === -1) v += " && (!data.child('definicao').exists() || newData.child('definicao').exists())";
    C['.validate'] = v;
    delete C.situacaoDefinicao; delete C.definicaoVigenteFonteId;
    const H = "newData.parent().parent().parent().child('definicoes').child($codigo).child('v' + newData.child('versao').val())";
    const outro = C.$outro; delete C.$outro;
    C.definicao = {
      '.read': leitura,
      '.validate': and([
        "newData.hasChildren(['texto','versao','publicadaEm','publicadaPor'])",
        "(data.exists() && newData.child('versao').val() === data.child('versao').val() ? (" + and([
          "newData.child('texto').val() === data.child('texto').val()",
          "newData.child('publicadaEm').val() === data.child('publicadaEm').val()",
          "newData.child('publicadaPor').val() === data.child('publicadaPor').val()"
        ]) + ') : (' + and([
          "newData.child('versao').val() === (data.exists() ? data.child('versao').val() + 1 : 1)",
          "newData.child('publicadaPor').val() === auth.token.email",
          H + '.exists()', "!root.child('taxonomia').child('" + d + "').child('definicoes').child($codigo).child('v' + newData.child('versao').val()).exists()",
          H + ".child('texto').val() === newData.child('texto').val()",
          H + ".child('publicadaEm').val() === newData.child('publicadaEm').val()",
          H + ".child('publicadaPor').val() === newData.child('publicadaPor').val()"
        ]) + '))'
      ]),
      texto: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 8000' },
      versao: { '.validate': 'newData.isNumber() && newData.val() >= 1' },
      publicadaEm: { '.validate': 'newData.isString()' },
      publicadaPor: { '.validate': 'newData.isString()' },
      $outro: { '.validate': false }
    };
    C.$outro = outro;
    /* histórico imutável das publicações */
    D.definicoes = {
      '.read': LER_ADM,
      $codigo: {
        '.validate': '$codigo.matches(/^[A-Za-z][A-Za-z0-9_-]{1,59}$/)',
        $v: {
          '.write': GRAVAR_ADM + ' && !data.exists() && newData.exists()',
          '.validate': and([
            "newData.hasChildren(['texto','versao','publicadaEm','publicadaPor','origem'])",
            "$v === 'v' + newData.child('versao').val()",
            "newData.parent().parent().parent().child('conceitos').child($codigo).child('definicao').child('versao').val() === newData.child('versao').val()"
          ]),
          texto: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 8000' },
          versao: { '.validate': 'newData.isNumber() && newData.val() >= 1' },
          publicadaEm: { '.validate': 'newData.isString()' },
          publicadaPor: { '.validate': 'newData.isString() && newData.val() === auth.token.email' },
          motivo: { '.validate': 'newData.isString() && newData.val().length <= 500' },
          origem: { '.validate': "newData.val() === 'publicacao' || newData.val() === 'carga-inicial'" },
          $outro: { '.validate': false }
        }
      }
    };
    /* o modelo antigo de fontes sai das regras: o site não lê nem grava mais (a migração usa a conta de serviço) */
    delete D.fontes;
    /* auditoria: o tipo da publicação */
    const A = D.auditoria.$codigo.$pushKey;
    if (A['.validate'].indexOf("'definicao_publicada'") === -1) A['.validate'] = A['.validate'].replace("newData.child('tipo').val() === 'definicao_vigente' || ", "newData.child('tipo').val() === 'definicao_vigente' || newData.child('tipo').val() === 'definicao_publicada' || ");
  });
  return t;
}
const ARQ_MIGRACAO = { '.read': LER_ADM };

function montar(rules, base) {
  /* a leitura granular vem da regra ANTIGA do ponteiro (antes da transformação) ou da definição já transformada */
  const leitura = {};
  DOMS.forEach((d) => {
    const C = base.taxonomia[d].conceitos.$codigo;
    leitura[d] = (C.definicaoVigenteFonteId || C.definicao)['.read'];
  });
  return { taxonomia: transformar(base.taxonomia, leitura), 'taxonomia-arquivo-migracao': ARQ_MIGRACAO };
}
module.exports = { montar, transformar };

if (require.main === module) {
  let s = fs.readFileSync(ARQUIVO, 'utf8');
  const regras = JSON.parse(s).rules;
  const novos = montar(regras, regras);
  const divergentes = Object.keys(novos).filter((n) => JSON.stringify(regras[n]) !== JSON.stringify(novos[n]));
  if (process.argv.indexOf('--gravar') === -1) {
    console.log(divergentes.length ? 'DIVERGEM de database.rules.json: ' + divergentes.join(', ') : 'os nós da definição simplificada publicados são os montados');
    process.exit(divergentes.length ? 1 : 0);
  }
  const ind = (o) => JSON.stringify(o, null, 2).split('\n').map((l, k) => (k === 0 ? l : '    ' + l)).join('\n');
  Object.keys(novos).forEach((n) => {
    const ini = s.indexOf('\n    "' + n + '": {');
    if (ini === -1) { const fim = s.lastIndexOf('\n  }'); s = s.slice(0, fim) + ',\n    "' + n + '": ' + ind(novos[n]) + s.slice(fim); return; }
    const abre = s.indexOf('{', ini);
    let prof = 0, i = abre, emTexto = false;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (emTexto) { if (ch === '\\') i++; else if (ch === '"') emTexto = false; continue; }
      if (ch === '"') emTexto = true; else if (ch === '{') prof++; else if (ch === '}' && --prof === 0) break;
    }
    s = s.slice(0, abre) + ind(novos[n]) + s.slice(i + 1);
  });
  JSON.parse(s);
  fs.writeFileSync(ARQUIVO, s);
  console.log('gravado: ' + s.length + ' bytes');
}
