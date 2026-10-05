/* Caminho de arquivo temporário ÚNICO entre processos, para os testes que salvam um download
 * (Excel/PDF) em /tmp antes de ler.
 *
 * Por que existe: o nome era só prefixo + Date.now(), e quatro testes usavam o mesmo prefixo
 * ('avp-coerencia-') e outros dois o mesmo 'avp-trilha-'. Rodando em paralelo (rodar-suite.js),
 * dois testes no mesmo milissegundo gravariam no MESMO arquivo e um leria o download do outro.
 * pid + instante + 12 hex aleatórios tornam a colisão impossível na prática, entre processos
 * e dentro do mesmo processo. Prefixo e extensão continuam os mesmos de antes.
 *
 * Provado em teste-arquivos-temporarios.js (processos simultâneos, sem repetição). */
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function arquivoTemporario(prefixo, extensao) {
  return path.join(os.tmpdir(), prefixo + process.pid + '-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + extensao);
}

module.exports = { arquivoTemporario };
