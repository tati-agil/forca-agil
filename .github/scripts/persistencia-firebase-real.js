/* Persistência REALISTA do Firebase Realtime Database, para testes.
 *
 * O firebase-falso.js guardava exatamente o objeto gravado — e o banco de
 * verdade NÃO faz isso. Foi essa diferença que escondeu o defeito do
 * fallback do motor arquitetural: a regra FALLBACK_A_VALIDAR tinha
 * `condicoes: { all: [] }`, o Firebase real descarta lista/objeto vazio, e
 * toda versão publicada voltava do banco SEM `condicoes` — o diff acusava
 * mudança lógica falsa e a validação rejeitava a própria versão vigente.
 * Nenhum teste pegou, porque o falso devolvia `{ all: [] }` intacto.
 *
 * comoFirebaseReal(valor) devolve o que uma leitura devolveria depois de
 * gravar `valor`, seguindo o comportamento documentado do RTDB:
 *   - null/undefined não são gravados (a chave some);
 *   - objeto vazio e lista vazia não são gravados (a chave some), e isso
 *     se propaga para cima (um pai que ficou vazio também some);
 *   - lista é gravada como objeto de índices; na leitura volta como lista
 *     se as chaves forem inteiros e mais da metade das posições até o
 *     maior índice existir — os buracos voltam como null (a posição NÃO é
 *     reaproveitada); senão volta como objeto com chaves em texto;
 *   - números, textos e booleanos (inclusive false e 0) são preservados.
 *
 * Uso em Node: const { comoFirebaseReal } = require('./persistencia-firebase-real.js')
 * Uso no navegador (firebase-falso.js com __CFG.persistenciaReal = true):
 *   servir o conteúdo DESTE arquivo antes do firebase-falso.js, no mesmo
 *   corpo da rota interceptada — ele se registra em window.__comoFirebaseReal. */
(function (raiz) {
  function gravar(valor) {
    if (valor === null || valor === undefined) return undefined;
    if (Array.isArray(valor)) {
      var comoObjeto = {};
      valor.forEach(function (v, i) {
        var g = gravar(v);
        if (g !== undefined) comoObjeto[String(i)] = g;
      });
      return Object.keys(comoObjeto).length ? comoObjeto : undefined;
    }
    if (typeof valor === 'object') {
      var out = {};
      Object.keys(valor).forEach(function (k) {
        var g = gravar(valor[k]);
        if (g !== undefined) out[k] = g;
      });
      return Object.keys(out).length ? out : undefined;
    }
    return valor;
  }
  function ler(gravado) {
    if (gravado === undefined) return null;
    if (gravado === null || typeof gravado !== 'object') return gravado;
    var chaves = Object.keys(gravado);
    var todasInteiras = chaves.length > 0 && chaves.every(function (k) { return /^(0|[1-9]\d*)$/.test(k); });
    if (todasInteiras) {
      var maior = Math.max.apply(null, chaves.map(Number));
      if (chaves.length * 2 > maior + 1) {
        var lista = [];
        for (var i = 0; i <= maior; i++) lista.push(Object.prototype.hasOwnProperty.call(gravado, String(i)) ? ler(gravado[String(i)]) : null);
        return lista;
      }
    }
    var out = {};
    chaves.forEach(function (k) { out[k] = ler(gravado[k]); });
    return out;
  }
  function comoFirebaseReal(valor) { return ler(gravar(valor)); }

  if (typeof module !== 'undefined' && module.exports) module.exports = { comoFirebaseReal: comoFirebaseReal };
  else raiz.__comoFirebaseReal = comoFirebaseReal;
})(typeof window !== 'undefined' ? window : this);
