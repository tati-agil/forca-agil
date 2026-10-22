/* P8 NA EXPLICAÇÃO (PR #420): desde a versão 5 das regras, P8 = SIM é condição de Produto/Serviço principal e de Unidade
 * de valor associada, mas os "motivos" cadastrados nessas regras não o citam. A explicação da avaliação passou a acrescentar
 * o P8 — nos motivos da camada e na justificativa automática — quando a condição da regra aplicada o exige. O retorno do
 * motor (camada, regra, motivos, conflito, incoerência) não muda; justificativas já gravadas não são recalculadas.
 *
 * As impressões digitais das 65.536 combinações fixadas ANTES disso continuam as mesmas: comparamos com o estado da ÉPOCA,
 * tirando SÓ o P8 acrescentado e SÓ nessas duas classificações — em qualquer outra, o objeto e o texto passam intactos,
 * então uma mudança em outra classificação continua derrubando a digital. */
const MOTIVO_P8 = 'Pode ser gerido de ponta a ponta como solução própria: SIM';
const FRASE_UVA = ' Também é condição desta classificação: ' + MOTIVO_P8 + '.';
const PRODUTO = 'produto-principal', UVA = 'unidade-valor-associada';
const CAMADAS = [PRODUTO, UVA];
const ESCAPADO = MOTIVO_P8.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/* tira o P8 só quando ele é o ÚLTIMO motivo (é onde a explicação o acrescenta) */
function semP8(motivos) { return motivos.length && motivos[motivos.length - 1] === MOTIVO_P8 ? motivos.slice(0, -1) : motivos; }
/* Cópia sem o P8 acrescentado: aceita o retorno de computeResultado ({ camadaSugerida }), o de identificarCamada
   ({ camada, motivos }) ou a própria camada ({ id, motivos }). Outras camadas voltam iguais. */
function estadoSemP8(x) {
  if (!x || typeof x !== 'object') return x;
  const c = JSON.parse(JSON.stringify(x));
  if (c.camadaSugerida && CAMADAS.indexOf(c.camadaSugerida.id) !== -1 && Array.isArray(c.camadaSugerida.motivos)) c.camadaSugerida.motivos = semP8(c.camadaSugerida.motivos);
  if (CAMADAS.indexOf(c.camada) !== -1 && Array.isArray(c.motivos)) c.motivos = semP8(c.motivos);
  if (CAMADAS.indexOf(c.id) !== -1 && Array.isArray(c.motivos)) c.motivos = semP8(c.motivos);
  return c;
}
/* Só nas duas classificações: Produto/Serviço "…, E e <P8>, sem nenhum sinal" volta a "… e E, sem nenhum sinal";
   Unidade de valor perde a frase acrescentada. Qualquer outra camada: o texto volta intacto. */
function justificativaSemP8(j, camadaId) {
  if (typeof j !== 'string') return j;
  if (camadaId === PRODUTO) return j.replace(new RegExp(', ([^,]*?) e ' + ESCAPADO + ', sem nenhum sinal'), ' e $1, sem nenhum sinal');
  if (camadaId === UVA) return j.split(FRASE_UVA).join('');
  return j;
}

module.exports = { MOTIVO_P8, FRASE_UVA, estadoSemP8, justificativaSemP8 };
