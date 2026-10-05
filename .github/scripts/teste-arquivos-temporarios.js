/* ARQUIVOS TEMPORÁRIOS ÚNICOS ENTRE PROCESSOS — pré-requisito da suíte em paralelo.
 *
 * rodar-suite.js roda vários testes ao mesmo tempo. Seis deles salvam o download (Excel) em
 * /tmp antes de ler, e o nome era só prefixo + Date.now() — com o MESMO prefixo em mais de um
 * teste ('avp-coerencia-' em quatro, 'avp-trilha-' em dois). Dois testes no mesmo milissegundo
 * gravariam no mesmo arquivo e um leria o download do outro.
 *
 * O que prova (sem navegador, sem rede):
 *   1. arquivoTemporario() (arquivo-temporario.js) não repete nome entre processos SIMULTÂNEOS
 *      nem dentro de um processo, e preserva pasta, prefixo e extensão;
 *   2. controle: o esquema antigo (prefixo + Date.now()), no mesmo cenário, COLIDE — então este
 *      teste é capaz de enxergar o problema que diz resolver;
 *   3. guarda estática: nenhum prefixo de arquivo em os.tmpdir() é usado por mais de um teste
 *      sem nome único (arquivoTemporario ou process.pid). */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const PROCESSOS = 4;
const POR_PROCESSO = 3000;

/* Cada filho espera o mesmo instante de largada (espera ativa) e gera os nomes de uma vez. */
function gerar(esquema, largada) {
  const codigo = `
    const { arquivoTemporario } = require(${JSON.stringify(path.join(__dirname, 'arquivo-temporario.js'))});
    const path = require('path'), os = require('os');
    while (Date.now() < ${largada}) {}
    const nomes = [];
    for (let i = 0; i < ${POR_PROCESSO}; i++) {
      nomes.push(${esquema === 'novo'
        ? "arquivoTemporario('avp-coerencia-', '.xlsx')"
        : "path.join(os.tmpdir(), 'avp-coerencia-' + Date.now() + '.xlsx')"});
    }
    process.stdout.write(JSON.stringify(nomes));`;
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['-e', codigo]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve(JSON.parse(out)) : reject(new Error('filho saiu com ' + c))));
  });
}
async function rodada(esquema) {
  const largada = Date.now() + 1500;
  const listas = await Promise.all(Array.from({ length: PROCESSOS }, () => gerar(esquema, largada)));
  return listas.flat();
}

(async () => {
  console.log('\n== 1. Nomes únicos entre ' + PROCESSOS + ' processos simultâneos (' + PROCESSOS * POR_PROCESSO + ' nomes) ==');
  const novos = await rodada('novo');
  afirma(novos.length === PROCESSOS * POR_PROCESSO, 'todos os processos geraram seus nomes (' + novos.length + ')');
  afirma(new Set(novos).size === novos.length, 'nenhum nome repetido (' + (novos.length - new Set(novos).size) + ' repetidos)');
  afirma(novos.every((n) => path.dirname(n) === os.tmpdir()), 'todos na pasta temporária do sistema');
  afirma(novos.every((n) => path.basename(n).startsWith('avp-coerencia-') && n.endsWith('.xlsx')), 'prefixo e extensão preservados');

  console.log('\n== 2. Controle: o esquema antigo colide no mesmo cenário ==');
  const antigos = await rodada('antigo');
  const repetidos = antigos.length - new Set(antigos).size;
  afirma(repetidos > 0, 'prefixo + Date.now() repete nome entre processos simultâneos (' + repetidos + ' repetidos) — o teste enxerga a colisão');

  console.log('\n== 3. Guarda: nenhum prefixo de /tmp compartilhado entre testes sem nome único ==');
  const usos = {};
  fs.readdirSync(__dirname).filter((f) => /^teste-.*\.js$/.test(f) && f !== path.basename(__filename)).forEach((f) => {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    for (const m of src.matchAll(/tmpdir\(\)\s*,\s*'([^']+)'([^;\n]*)/g)) {
      const unico = /process\.pid|randomBytes|random\(/.test(m[2]);
      (usos[m[1]] = usos[m[1]] || []).push({ f, unico });
    }
    for (const m of src.matchAll(/arquivoTemporario\(\s*'([^']+)'/g)) (usos[m[1]] = usos[m[1]] || []).push({ f, unico: true });
  });
  const compartilhados = Object.entries(usos).filter(([, l]) => new Set(l.map((x) => x.f)).size > 1);
  const arriscados = compartilhados.filter(([, l]) => l.some((x) => !x.unico));
  afirma(Object.keys(usos).length > 0, 'a varredura encontrou os arquivos temporários dos testes (' + Object.keys(usos).length + ' prefixos)');
  afirma(arriscados.length === 0, 'prefixo compartilhado só com nome único' + (arriscados.length ? ' — em risco: ' + arriscados.map(([p, l]) => p + ' (' + l.filter((x) => !x.unico).map((x) => x.f).join(', ') + ')').join('; ') : ' (' + compartilhados.map(([p, l]) => p + ' ×' + l.length).join(', ') + ')'));

  if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
  console.log('\nOK — arquivos temporários únicos entre processos; o esquema antigo colidiria; nenhum prefixo compartilhado sem nome único.');
})().catch((e) => { console.error(e); process.exit(1); });
