/* Fallback do motor arquitetural x persistência REAL do Firebase
 * (T1-T7 do pedido "CORRIGIR FALLBACK DO MOTOR ARQUITETURAL").
 *
 * POR QUE ESTE TESTE EXISTE
 * A regra FALLBACK_A_VALIDAR era `condicoes: { all: [] }` (vacuamente
 * verdadeira). O Firebase de verdade não grava lista/objeto vazio: toda
 * versão publicada voltava do banco SEM `condicoes`. Consequências reais:
 *   - diffRegras acusava mudança lógica falsa no fallback;
 *   - validarRegras rejeitava a própria versão vigente ("falta fallback"),
 *     travando o editor de regras depois da primeira publicação.
 * Os testes anteriores não pegaram porque o firebase-falso.js devolvia
 * `{ all: [] }` intacto. Aqui toda configuração passa por
 * comoFirebaseReal() (persistencia-firebase-real.js) — memória →
 * gravação como o Firebase real → leitura — e precisa sair com A MESMA
 * semântica: valida igual, diff vazio, e o retorno COMPLETO do motor
 * (camada, regra aplicada, motivos, conflito, incoerência) idêntico nas
 * 65.536 combinações de P1-P16.
 *
 * Hermético: só Node (vm), sem navegador, sem rede, sem segredo. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { comoFirebaseReal } = require('./persistencia-firebase-real.js');

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const ctx = { window: {}, console: console, JSON: JSON, Object: Object, Array: Array, String: String, Math: Math, Number: Number };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'motor-arquitetura.js'), 'utf8'), ctx);
const M = ctx.window.faMotorArquitetura;
const copia = (v) => JSON.parse(JSON.stringify(v));

const EXPLICITO = copia(M.PADRAO_REGRAS.regras);
/* Fábrica ANTERIOR a esta correção, exatamente como o código a guardava em
   memória (fallback = {all:[]}, sem tipo) — é o que a "versão 1" era. */
const LEGADO_MEMORIA = EXPLICITO.map((r) => {
  if (r.codigo !== 'FALLBACK_A_VALIDAR') return copia(r);
  const c = copia(r); delete c.tipo; c.condicoes = { all: [] }; return c;
});
/* O mesmo legado depois de gravado e lido do Firebase real (é o que
   versoes/<n> guarda em produção para as versões publicadas até hoje). */
const LEGADO_GRAVADO = comoFirebaseReal(LEGADO_MEMORIA);
const fbDe = (regras) => regras.find((r) => r.codigo === 'FALLBACK_A_VALIDAR');
const semNenhumErro = (regras) => M.validarRegras({ regras: regras });
function ctxDe(pares) { const c = {}; for (let i = 1; i <= 16; i++) c['P' + i] = 'NAO'; Object.assign(c, pares); return c; }
const silencioso = (fn) => { const e = console.error; console.error = () => {}; try { return fn(); } finally { console.error = e; } };

console.log('\n== Pré-condição: o helper reproduz o defeito do Firebase real ==');
afirma(!('condicoes' in fbDe(LEGADO_GRAVADO)), 'fallback legado {all:[]} volta do "banco" SEM condicoes (exatamente o que acontecia em produção)');
afirma(!('motivos' in fbDe(LEGADO_GRAVADO)) && !('conflito' in fbDe(LEGADO_GRAVADO)), 'motivos [] e conflito null também somem (lista vazia / null não são gravados)');
afirma(fbDe(LEGADO_GRAVADO).incoerencia === false && fbDe(LEGADO_GRAVADO).ordem === 12, 'false e números são preservados');
afirma(JSON.stringify(comoFirebaseReal({ a: [1, null, 3] })) === '{"a":[1,null,3]}', 'lista com buraco volta com null na posição (não reindexa)');

console.log('\n== T1 — fallback explícito (tipo FALLBACK) valida e executa ==');
afirma(fbDe(EXPLICITO).tipo === 'FALLBACK' && !('condicoes' in fbDe(EXPLICITO)), 'fábrica nova: FALLBACK_A_VALIDAR tem tipo FALLBACK e nenhuma condição');
afirma(semNenhumErro(EXPLICITO).length === 0, 'validarRegras(fábrica explícita) sem erros: ' + JSON.stringify(semNenhumErro(EXPLICITO)));
let r = M.identificarCamada(ctxDe({}), { regras: EXPLICITO });
afirma(r.camada === 'a-validar' && r.regraAplicada === 'FALLBACK_A_VALIDAR', 'tudo NÃO → fallback aplicado (a-validar, regra FALLBACK_A_VALIDAR)');
r = M.identificarCamada(ctxDe({ P9: 'SIM' }), { regras: EXPLICITO });
afirma(r.camada === 'canal' && r.regraAplicada === 'CANAL', 'P9=SIM → CANAL (fallback nunca atropela regra comum que bate)');
const fbPrimeiro = copia(EXPLICITO); fbDe(fbPrimeiro).ordem = -1;
r = M.identificarCamada(ctxDe({ P9: 'SIM' }), { regras: fbPrimeiro });
afirma(r.regraAplicada === 'CANAL', 'mesmo com precedência errada, o executor só aplica o fallback quando nenhuma comum bate');

console.log('\n== T2 — fallback legado continua legível ==');
afirma(M.ehFallback(fbDe(LEGADO_MEMORIA)) && M.ehFallback(fbDe(LEGADO_GRAVADO)), 'ehFallback reconhece as duas formas legadas ({all:[]} e sem condicoes)');
afirma(semNenhumErro(LEGADO_GRAVADO).length === 0, 'versão legada como está no banco valida sem erros (antes: "Condição vazia… / falta um fallback")');
r = M.identificarCamada(ctxDe({}), { regras: LEGADO_GRAVADO });
afirma(r.regraAplicada === 'FALLBACK_A_VALIDAR' && r.camada === 'a-validar', 'legado gravado executa o fallback (antes: "nenhuma regra aplicável")');
const migradas = M.migrarFallbackLegado(LEGADO_GRAVADO);
afirma(fbDe(migradas).tipo === 'FALLBACK' && !('condicoes' in fbDe(migradas)), 'migrarFallbackLegado converte para a forma explícita');
afirma(!('tipo' in fbDe(LEGADO_GRAVADO)), 'migrarFallbackLegado não altera o objeto recebido');

console.log('\n== T3 — regra comum sem condição continua inválida ==');
function comErro(regras, trecho, msg) {
  const erros = semNenhumErro(regras);
  afirma(erros.some((e) => e.indexOf(trecho) !== -1), msg + ' → ' + JSON.stringify(erros));
}
let cfg = copia(EXPLICITO); delete cfg.find((x) => x.codigo === 'CANAL').condicoes;
comErro(cfg, 'Regra CANAL sem condições', 'CANAL sem condicoes é rejeitada (nunca vira "sempre verdadeira")');
comErro(comoFirebaseReal(cfg), 'Regra CANAL sem condições', 'idem depois de passar pelo banco');
cfg = copia(EXPLICITO); cfg.find((x) => x.codigo === 'CANAL').condicoes = { all: [] };
comErro(cfg, 'vazio', 'regra comum com {all:[]} é rejeitada (verdade implícita não é mais aceita)');
cfg = copia(EXPLICITO); cfg.find((x) => x.codigo === 'CANAL').condicoes = { any: [] };
comErro(cfg, 'vazio', 'regra comum com {any:[]} é rejeitada');
cfg = copia(EXPLICITO).filter((x) => x.codigo !== 'FALLBACK_A_VALIDAR');
comErro(cfg, 'Nenhuma regra de fallback', 'sem fallback → bloqueado');
cfg = copia(EXPLICITO); cfg.push({ codigo: 'OUTRO_FALLBACK', tipo: 'FALLBACK', ordem: 13, resultado: 'a-validar' });
comErro(cfg, 'Mais de uma regra de fallback', 'dois fallbacks → bloqueado');
cfg = copia(EXPLICITO); fbDe(cfg).ordem = 5; cfg.find((x) => x.codigo === 'UNIDADE_VALOR_ASSOCIADA').ordem = 50;
comErro(cfg, 'precisa ter a maior precedência', 'fallback que não é o último → bloqueado');
cfg = copia(EXPLICITO); fbDe(cfg).condicoes = { all: [{ campo: 'P1', valor: 'SIM' }] };
comErro(cfg, 'não pode ter condições', 'fallback explícito com condições → bloqueado');
cfg = copia(EXPLICITO); cfg.find((x) => x.codigo === 'CANAL').tipo = 'SEMPRE';
comErro(cfg, 'tipo desconhecido', 'tipo desconhecido → bloqueado');
const comCondicaoReal = { codigo: 'FALLBACK_A_VALIDAR', ordem: 12, resultado: 'a-validar', condicoes: { all: [{ campo: 'P1', valor: 'SIM' }] } };
afirma(!M.ehFallback(comCondicaoReal), 'o código FALLBACK_A_VALIDAR COM condições reais é regra comum (a exceção legada vale só sem condição)');
afirma(!M.ehFallback({ codigo: 'CANAL', ordem: 3, resultado: 'canal' }), 'outra regra sem condicoes NUNCA é tratada como fallback');

console.log('\n== T4 — round-trip Firebase: memória → gravação real → leitura ==');
[['fábrica explícita', EXPLICITO], ['fábrica legada (memória)', LEGADO_MEMORIA]].forEach(([nome, original]) => {
  const lido = comoFirebaseReal(original);
  afirma(semNenhumErro(lido).length === 0, nome + ': valida depois da persistência');
  afirma(M.diffRegras(original, lido).length === 0, nome + ': diffRegras(antes, depois) vazio');
  const prova = M.compararRegrasExaustivamente(original, lido);
  afirma(prova.combinacoesAnalisadas === 65536 && prova.diferencas === 0, nome + ': retorno completo idêntico nas 65.536 combinações (' + prova.diferencas + ' diferenças)');
  afirma(JSON.stringify(comoFirebaseReal(lido)) === JSON.stringify(lido), nome + ': segunda ida e volta não muda mais nada (estável)');
});

console.log('\n== T5 — diff: fallback legado x explícito = sem mudança lógica ==');
afirma(M.diffRegras(LEGADO_MEMORIA, EXPLICITO).length === 0, 'legado {all:[]} x explícito: 0 regras alteradas');
afirma(M.diffRegras(LEGADO_GRAVADO, EXPLICITO).length === 0, 'legado sem condicoes (banco) x explícito: 0 regras alteradas');
afirma(M.diffRegras(LEGADO_MEMORIA, LEGADO_GRAVADO).length === 0, 'legado memória x legado banco: 0 (era exatamente o falso positivo)');
cfg = copia(EXPLICITO); fbDe(cfg).resultado = 'componente';
afirma(M.diffRegras(LEGADO_GRAVADO, cfg).map((a) => a.codigo).join() === 'FALLBACK_A_VALIDAR', 'mudança REAL no fallback (resultado) continua detectada');
cfg = copia(EXPLICITO); fbDe(cfg).ordem = 99;
afirma(M.diffRegras(LEGADO_GRAVADO, cfg).length === 1, 'mudança de precedência do fallback continua detectada');

console.log('\n== T6 — validação pós-persistência não acusa "falta fallback" ==');
[EXPLICITO, LEGADO_MEMORIA, M.migrarFallbackLegado(LEGADO_GRAVADO)].forEach((regras, i) => {
  const erros = semNenhumErro(comoFirebaseReal(regras));
  afirma(!erros.some((e) => /fallback/i.test(e)), 'config ' + (i + 1) + ' depois do banco: nenhum erro de fallback ' + JSON.stringify(erros));
});

console.log('\n== T7 — equivalência exaustiva pelo retorno COMPLETO do motor ==');
r = M.identificarCamada(ctxDe({}), { regras: EXPLICITO });
afirma(['camada', 'regraAplicada', 'motivosCodigos', 'conflito', 'incoerencia'].every((k) => k in r), 'o retorno comparado tem camada, regraAplicada, motivosCodigos, conflito e incoerencia');
const provaV1V2 = M.compararRegrasExaustivamente(LEGADO_MEMORIA, LEGADO_GRAVADO);
console.log('        reconstrução do caso real — v1 (fábrica em memória) × v2 (mesmas regras gravadas no banco): ' +
  provaV1V2.combinacoesAnalisadas + ' combinações analisadas, ' + provaV1V2.diferencas + ' diferenças');
afirma(provaV1V2.equivalentes, 'v1 × v2 reconstruídas: semanticamente equivalentes');
/* Sensibilidade: a prova NÃO olha só a camada final. */
cfg = copia(EXPLICITO); cfg.find((x) => x.codigo === 'CANAL').motivos = ['P9', 'P1'];
let p = M.compararRegrasExaustivamente(EXPLICITO, cfg);
afirma(p.diferencas > 0 && p.exemplos[0].antes.camada === p.exemplos[0].depois.camada, 'mudar só os MOTIVOS (mesma camada) aparece como diferença: ' + p.diferencas);
cfg = copia(EXPLICITO); cfg.find((x) => x.codigo === 'CONFLITO_PROCESSO_CAPACIDADE').conflito = ['capacidade-organizacional', 'processo-etapa'];
p = M.compararRegrasExaustivamente(EXPLICITO, cfg);
afirma(p.diferencas > 0, 'mudar só o CONFLITO aparece como diferença: ' + p.diferencas);
cfg = copia(EXPLICITO); cfg.find((x) => x.codigo === 'INCOERENCIA').incoerencia = false;
p = M.compararRegrasExaustivamente(EXPLICITO, cfg);
afirma(p.diferencas > 0, 'mudar só a INCOERÊNCIA aparece como diferença: ' + p.diferencas);
cfg = copia(EXPLICITO); cfg.find((x) => x.codigo === 'CANAL').codigo = 'CANAL_RENOMEADO';
p = M.compararRegrasExaustivamente(EXPLICITO, cfg);
afirma(p.diferencas > 0, 'mesma lógica mas outra REGRA APLICADA aparece como diferença: ' + p.diferencas);

console.log('\n== Prova otimizada = executor real (sem atalho que mude o resultado) ==');
function bruta(A, B) {
  let d = 0;
  silencioso(() => {
    for (let n = 0; n < 65536; n++) {
      const c = {}; for (let b = 0; b < 16; b++) c['P' + (b + 1)] = (n & (1 << b)) ? 'SIM' : 'NAO';
      if (JSON.stringify(M.identificarCamada(c, { regras: A })) !== JSON.stringify(M.identificarCamada(c, { regras: B }))) d++;
    }
  });
  return d;
}
const mutada = copia(EXPLICITO);
mutada.find((x) => x.codigo === 'CANAL').condicoes = { all: [{ campo: 'P9', valor: 'sim' }, { not: { equals: { pergunta: 'P3', resposta: 'SIM' } } }] };
mutada.find((x) => x.codigo === 'COMPONENTE').ordem = 2.5;
[['fábrica × legado banco', EXPLICITO, LEGADO_GRAVADO], ['fábrica × mutada (not/equals/pergunta/resposta, minúsculas, precedência)', EXPLICITO, mutada],
 ['fábrica × sem fallback', EXPLICITO, EXPLICITO.filter((x) => x.codigo !== 'FALLBACK_A_VALIDAR')]].forEach(([nome, A, B]) => {
  const rapida = M.compararRegrasExaustivamente(A, B).diferencas;
  afirma(rapida === bruta(A, B), nome + ': prova otimizada (' + rapida + ') = comparação direta por identificarCamada');
});

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'Tudo ok.'));
process.exit(falhas ? 1 : 0);
