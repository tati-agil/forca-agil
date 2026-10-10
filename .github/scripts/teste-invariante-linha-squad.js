/* INVARIANTE LINHA × SQUAD — regra estrutural fixa do domínio (não é configuração, não varia por versão do motor).
 *
 *   Linhas são formadas por Squads; Áreas Especializadas e CoEs não são formadas por Squads. Portanto:
 *     AREA_ESPECIALIZADA → liberaSquad = false;  COE → liberaSquad = false;
 *     os 6 posicionamentos firmes do ramo Linha → liberaSquad = true.
 *
 * O esperado está ESCRITO aqui (LINHA_SQUAD), nunca lido do motor: se o motor, a tabela das regras ou as regras
 * do banco mudarem a regra, este teste falha. Prova, sem navegador e sem banco:
 *   A. motor: liberaSquadParaCodigoFirme = a tabela literal nos 8 códigos firmes; LINHA, PLATAFORMA e A_VALIDAR
 *      não são firmes (erro, nunca um padrão).
 *   B. motor: nos 531.441 estados de O1–O9 × diagnósticos, em TODA versão que o motor conhece, todo resultado
 *      firme sai com o liberaSquad da tabela literal.
 *   C. tabela das regras (regras-posicionamento-tabela.js): toda regra firme concluível descreve o liberaSquad
 *      literal.
 *   D. regras do banco publicadas (database.rules.json): a conclusão de um resultado firme só aceita o liberaSquad
 *      literal; a decisão só aceita liberaSquad = true para os 6 do ramo Linha — e nenhuma das duas lê o valor de
 *      um nó do banco (não há como configurá-lo).
 *   E. não configurável por versão: a regra vive numa lista só do motor (DE_LINHA), a função recebe só o código, e o
 *      registro de versões do motor não carrega liberaSquad nem a lista.
 * A prova no emulador (gravações de verdade) está na seção O de teste-rules-posicionamento-decisao.js.
 * FA_RAIZ / RULES_PATH / TABELA_PATH (opcionais) trocam os arquivos — é assim que os mutantes são rodados. */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = process.env.FA_RAIZ || path.join(__dirname, '..', '..', 'forca-agil');
const ARQ_MOTOR = path.join(RAIZ, 'motor-posicionamento.js');
const M = require(ARQ_MOTOR);
const T = require(process.env.TABELA_PATH || './regras-posicionamento-tabela.js');
const REGRAS_BANCO = JSON.parse(fs.readFileSync(process.env.RULES_PATH || path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules;

const LINHA_SQUAD = Object.freeze({
  AREA_ESPECIALIZADA: false, COE: false,
  ESTRATEGIA_CLIENTES: true, NEGOCIOS: true, PLATAFORMA_CANAIS: true,
  PLATAFORMA_HABILITADORA_NEGOCIOS: true, PLATAFORMA_HABILITADORA_TECNOLOGIA: true, PLATAFORMA_CORPORATIVA: true
});
const FIRMES = Object.keys(LINHA_SQUAD);
const RAMO_LINHA = FIRMES.filter((c) => LINHA_SQUAD[c]);

let total = 0, falhas = 0;
function anota(linha, ok, detalhe) {
  total++;
  if (ok) { console.log('  ok    ' + linha); return; }
  falhas++;
  console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : ''));
}

console.log('\n== A. motor: liberaSquadParaCodigoFirme = a tabela literal ==');
anota('os 8 firmes do motor são exatamente os da tabela literal', JSON.stringify(M.CODIGOS_FIRMES.slice().sort()) === JSON.stringify(FIRMES.slice().sort()));
FIRMES.forEach((c) => {
  let v; try { v = M.liberaSquadParaCodigoFirme(c); } catch (e) { v = 'erro'; }
  anota(c + ' → liberaSquad = ' + LINHA_SQUAD[c] + (LINHA_SQUAD[c] ? ' (ramo Linha: formado por Squads)' : ' (não é formado por Squads)'), v === LINHA_SQUAD[c], String(v));
});
['LINHA', 'PLATAFORMA', 'A_VALIDAR', 'SQUAD', ''].forEach((c) => {
  let erro = false; try { M.liberaSquadParaCodigoFirme(c); } catch (e) { erro = true; }
  anota('"' + c + '" não é firme: erro, nunca um valor padrão', erro);
});

console.log('\n== B. motor: os 531.441 estados, em toda versão conhecida ==');
const VAL = ['SIM', 'NAO', null], DG = ['mesma', 'distintas', null], QS = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9'];
const versoes = M.versoes();
anota('o motor conhece ao menos uma versão (' + versoes.join(', ') + ')', versoes.length >= 1);
let estados = 0, firmes = 0, certos = 0;
const vistos = {};
for (const ver of versoes) {
  for (let i = 0; i < 19683; i++) {
    const r = {}; let x = i;
    QS.forEach((q) => { const v = VAL[x % 3]; x = Math.floor(x / 3); if (v) r[q] = v; });
    for (let j = 0; j < 27; j++) {
      const d = {}; let y = j;
      ['N1', 'N2', 'N3'].forEach((n) => { const v = DG[y % 3]; y = Math.floor(y / 3); if (v) d[n] = v; });
      const o = M.avaliar(r, d, { versao: ver });
      estados++;
      if (Object.prototype.hasOwnProperty.call(LINHA_SQUAD, o.codigoResultado)) {
        firmes++; vistos[o.codigoResultado] = true;
        if (o.liberaSquad === LINHA_SQUAD[o.codigoResultado]) certos++;
      }
    }
  }
}
anota(estados + ' estados avaliados; nos ' + firmes + ' resultados firmes, liberaSquad = tabela literal (' + certos + ')', firmes > 0 && certos === firmes);
anota('os 8 códigos firmes aparecem como resultado (a prova cobre todos)', FIRMES.every((c) => vistos[c]), FIRMES.filter((c) => !vistos[c]).join(', '));

console.log('\n== C. tabela das regras: as regras firmes concluíveis ==');
let regrasFirmes = 0, regrasCertas = 0;
T.estadosConcluiveis().forEach((x) => {
  const s = x.saida || T.saida(x.regra, x.est);
  if (!Object.prototype.hasOwnProperty.call(LINHA_SQUAD, s.codigoResultado)) return;
  regrasFirmes++;
  if (s.liberaSquad === LINHA_SQUAD[s.codigoResultado]) regrasCertas++;
});
anota('nos ' + regrasFirmes + ' estados concluíveis com resultado firme, a tabela descreve o liberaSquad literal (' + regrasCertas + ')', regrasFirmes > 0 && regrasCertas === regrasFirmes);

console.log('\n== D. regras do banco publicadas ==');
const AV = REGRAS_BANCO['avaliacoes-posicionamento'] && REGRAS_BANCO['avaliacoes-posicionamento'].$avaliacaoId['.validate'];
anota('a regra de avaliacoes-posicionamento existe', typeof AV === 'string');
const RA = (c) => "newData.child('resultadoAutomatico/" + c + "').val()";
FIRMES.forEach((c) => {
  const marca = RA('codigoResultado') + " === '" + c + "'";
  const partes = AV.split(marca).slice(1);
  /* cada bloco do resultado começa por "regra === ..."; o trecho até o próximo bloco é o deste código */
  const blocos = partes.map((p) => p.split(RA('regra') + ' === ')[0]);
  const ok = blocos.length > 0 && blocos.every((b) => b.indexOf(RA('liberaSquad') + ' === ' + LINHA_SQUAD[c]) !== -1 && b.indexOf(RA('liberaSquad') + ' === ' + !LINHA_SQUAD[c]) === -1);
  anota('conclusão ' + c + ': só aceita liberaSquad = ' + LINHA_SQUAD[c] + ' (' + blocos.length + ' bloco(s))', ok);
});
const DEC = REGRAS_BANCO['posicionamento-decisoes'] && REGRAS_BANCO['posicionamento-decisoes'].$avaliacaoId['.validate'];
anota('a regra de posicionamento-decisoes existe', typeof DEC === 'string');
const pre = "newData.child('liberaSquad').val() === (";
const i = DEC ? DEC.indexOf(pre) : -1;
let expr = '';
if (i !== -1) { let prof = 0, j = i + pre.length - 1; for (; j < DEC.length; j++) { if (DEC[j] === '(') prof++; else if (DEC[j] === ')' && --prof === 0) break; } expr = DEC.slice(i + pre.length, j); }
const liberados = (expr.match(/=== '([A-Z_]+)'/g) || []).map((s) => s.slice(5, -1)).sort();
anota('decisão: liberaSquad = true exatamente para os 6 do ramo Linha', JSON.stringify(liberados) === JSON.stringify(RAMO_LINHA.slice().sort()), liberados.join(', '));
anota('decisão: AREA_ESPECIALIZADA e COE nunca liberam Squad', liberados.indexOf('AREA_ESPECIALIZADA') === -1 && liberados.indexOf('COE') === -1);
anota('decisão: a regra do liberaSquad não lê nada do banco (não é configurável)', !!expr && !/root\.|data\.|parent\(\)/.test(expr), expr.slice(0, 120));
anota('nenhum nó do banco guarda liberaSquad, a lista do ramo Linha ou a configuração do motor de posicionamento',
  !Object.keys(REGRAS_BANCO).some((k) => /motor-posicionamento|linha-squad|libera/i.test(k)));

console.log('\n== E. não configurável por versão ==');
const fonte = fs.readFileSync(ARQ_MOTOR, 'utf8');
const declaracoes = fonte.match(/var DE_LINHA = \[[^\]]*\]/g) || [];
anota('a lista do ramo Linha é declarada UMA vez, como lista fixa', declaracoes.length === 1 && (fonte.match(/DE_LINHA\s*=/g) || []).length === 1);
const lista = declaracoes.length ? (declaracoes[0].match(/'([A-Z_]+)'/g) || []).map((s) => s.slice(1, -1)).sort() : [];
anota('…e é exatamente o ramo Linha (sem Área Especializada nem CoE)', JSON.stringify(lista) === JSON.stringify(RAMO_LINHA.slice().sort()), lista.join(', '));
const corpo = (fonte.match(/function liberaSquadParaCodigoFirme\(([^)]*)\) \{([\s\S]*?)\n  \}/) || []);
anota('liberaSquadParaCodigoFirme recebe só o código', corpo[1] === 'codigo', corpo[1]);
anota('…e só consulta CODIGOS_FIRMES e DE_LINHA (nada de versão, configuração ou banco)', !!corpo[2] && !/VERSOES|versao|opcoes|firebase|window|root/i.test(corpo[2]) &&
  (corpo[2].match(/\b[A-Z][A-Z_]{3,}\b/g) || []).every((n) => n === 'CODIGOS_FIRMES' || n === 'DE_LINHA'), corpo[2] && corpo[2].trim());
const calc = (fonte.match(/function calcularLiberaSquad\(r\) \{([\s\S]*?)\n  \}/) || [])[1] || '';
anota('o resultado firme usa a MESMA função (calcularLiberaSquad → liberaSquadParaCodigoFirme)', /return liberaSquadParaCodigoFirme\(r\.codigoResultado\);/.test(calc) && !/VERSOES|versao/i.test(calc));
const versoesDecl = (fonte.match(/var VERSOES = \{([\s\S]*?)\};/) || [])[1] || '';
anota('o registro de versões do motor não carrega liberaSquad nem a lista do ramo Linha', !!versoesDecl && !/libera|DE_LINHA|Squad/i.test(versoesDecl), versoesDecl.trim());

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
