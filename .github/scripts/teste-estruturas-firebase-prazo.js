/* Estruturas — adaptador Firebase com a conexão parada (defeito da homologação, 2026-10-13), sem navegador.
 *
 * Um banco falso que imita o que o SDK web faz sem conexão: uma leitura once() de caminho fora do cache local espera
 * para sempre, e uma gravação enviada aparece NA HORA no cache local (otimista) mas só se confirma quando o servidor
 * responde. Prova, pelo caso de uso de verdade (estruturas-casos-de-uso.js) e o adaptador de verdade:
 *   A. Leitura parada: a operação termina no prazo com SEM_RESPOSTA — nunca fica esperando (o botão saía de
 *      "Salvando…" nunca).
 *   B. Gravação pendente: o prazo vence → GRAVACAO_NAO_CONFIRMADA, mesmo com a operação já visível no cache local
 *      (a leitura desse cache não é confirmação); repetir enquanto ela continua pendente não envia de novo; quando o
 *      servidor confirma, repetir reconhece a operação ("repetida") — nada duplicado.
 *   C. Gravação que o servidor recusa depois do prazo: deixa de contar como pendente.
 * A jornada no navegador, contra o emulador e o SDK real, está em teste-confirmacao-gravacao.js. */
'use strict';
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const N = require(path.join(RAIZ, 'forca-agil', 'estruturas-nucleo.js'));
const U = require(path.join(RAIZ, 'forca-agil', 'estruturas-casos-de-uso.js'));
const FB = require(path.join(RAIZ, 'forca-agil', 'estruturas-firebase.js'));
const MOTOR = require(path.join(RAIZ, 'forca-agil', 'motor-posicionamento-nucleo.js'));
const FIRMES = MOTOR.CODIGOS_FIRMES;
const casos = U.criar({ nucleo: N, codigosFirmes: FIRMES });

let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + det : '')); if (!c) falhas++; }
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/* banco falso: "servidor" e cache local (servidor + gravações pendentes). offline = leituras fora do cache param;
   reter = as gravações ficam pendentes até liberar()/recusar() */
function bancoFalso(semente) {
  const servidor = clone(semente) || {}, pendentes = [];
  let local = clone(servidor);
  const cache = new Set();
  const modo = { offline: false, reter: false, updates: 0 };
  const partes = (c) => String(c || '').split('/').filter(Boolean);
  function ler(arvore, c) { let n = arvore; for (const p of partes(c)) { if (!n || typeof n !== 'object') return null; n = n[p]; } return n === undefined ? null : clone(n); }
  function gravar(arvore, c, v) { const ps = partes(c); let n = arvore; ps.slice(0, -1).forEach((p) => { if (!n[p] || typeof n[p] !== 'object') n[p] = {}; n = n[p]; }); if (v === null) delete n[ps[ps.length - 1]]; else n[ps[ps.length - 1]] = clone(v); }
  function emCache(c) { const ps = partes(c); for (let i = ps.length; i >= 0; i--) if (cache.has(ps.slice(0, i).join('/'))) return true; return false; }
  function recalcularLocal() { local = clone(servidor); pendentes.forEach((g) => Object.keys(g.multi).forEach((k) => gravar(local, k, g.multi[k]))); }
  const db = {
    ref: (c) => ({
      once: () => {
        if (modo.offline && !emCache(c)) return new Promise(() => {}); /* fora do cache e sem conexão: o SDK espera */
        cache.add(partes(c).join('/'));
        return Promise.resolve({ val: () => ler(local, c) });
      },
      update: (multi) => {
        modo.updates++;
        const g = { multi: clone(multi) };
        Object.keys(multi).forEach((k) => { gravar(local, k, multi[k]); cache.add(partes(k).join('/')); }); /* otimista, na hora */
        if (!modo.reter && !modo.offline) { Object.keys(multi).forEach((k) => gravar(servidor, k, multi[k])); return Promise.resolve(); }
        pendentes.push(g);
        return new Promise((ok, erro) => { g.ok = ok; g.erro = erro; });
      }
    })
  };
  return {
    db, modo, servidor: (c) => ler(servidor, c), local: (c) => ler(local, c),
    liberar() { pendentes.splice(0).forEach((g) => { Object.keys(g.multi).forEach((k) => gravar(servidor, k, g.multi[k])); g.ok(); }); recalcularLocal(); },
    recusar() { pendentes.splice(0).forEach((g) => g.erro(Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' }))); recalcularLocal(); }
  };
}
function semente() {
  const conceitos = {}, ligacoes = {};
  FIRMES.forEach((c) => { conceitos[c] = { ativo: true }; ligacoes[c] = { registradoEm: '2026-10-01T00:00:00.000Z' }; });
  return { taxonomia: { organizacional: { conceitos } }, 'posicionamento-classificacoes': ligacoes };
}
const PRAZO = 60;
const usuario = { id: 'u1', email: 'teste@previ.com.br' };
const ctxDe = (op, id) => ({ operacaoId: op, usuario, agora: 1791713600000, novoId: id });
const entrada = { tipo: 'NEGOCIOS', nome: 'Linha de Teste' };
/* nunca deixa o teste preso: se a operação não terminar em 3 s, isso é a falha que o teste existe para pegar */
const noPrazo = (p) => Promise.race([p, new Promise((ok) => setTimeout(() => ok('PRESO'), 3000))]);
const codigos = (r) => (r && r.erros ? r.erros.map((e) => e.codigo).join(',') : '');

(async () => {
  console.log('A. leitura parada');
  {
    const b = bancoFalso(semente());
    b.modo.offline = true;
    const t0 = Date.now();
    const r = await noPrazo(casos.executar('criarEstrutura', entrada, ctxDe('op-a', 'E-A'), FB.criarPortas({ db: b.db, codigosFirmes: FIRMES, prazoMs: PRAZO })));
    afirma(r !== 'PRESO' && r.ok === false && codigos(r) === 'SEM_RESPOSTA' && Date.now() - t0 < 1500, 'sem conexão e fora do cache: a operação termina no prazo com SEM_RESPOSTA (nunca fica esperando)', r === 'PRESO' ? 'presa' : JSON.stringify(r));
    afirma(b.modo.updates === 0 && b.servidor('estruturas-concretas') === null, 'nada enviado, nada no servidor');
    const e = await noPrazo(FB.criarPortas({ db: b.db, codigosFirmes: FIRMES, prazoMs: PRAZO }).lerEstado().then(() => 'leu', (x) => x && x.codigo));
    afirma(e === 'SEM_RESPOSTA', 'lerEstado parada → SEM_RESPOSTA no prazo', e);
    const rel = await noPrazo(FB.lerRelacoesConceituais(b.db, ['NEGOCIOS'], PRAZO));
    afirma(rel === null, 'relações conceituais da Taxonomia paradas → null ("não sei"), no prazo', rel === 'PRESO' ? 'presa' : JSON.stringify(rel));
  }

  console.log('B. gravação pendente (o cache local já mostra a operação)');
  {
    const b = bancoFalso(semente());
    const portas = () => FB.criarPortas({ db: b.db, codigosFirmes: FIRMES, prazoMs: PRAZO });
    b.modo.reter = true;
    const r = await noPrazo(casos.executar('criarEstrutura', entrada, ctxDe('op-b', 'E-B'), portas()));
    afirma(b.local('estruturas-concretas/operacoes/op-b') !== null && b.servidor('estruturas-concretas/operacoes/op-b') === null, 'cenário: a operação está no cache local e não no servidor');
    afirma(r !== 'PRESO' && r.ok === false && codigos(r) === 'GRAVACAO_NAO_CONFIRMADA', 'prazo vencido: GRAVACAO_NAO_CONFIRMADA — o cache local não conta como confirmação', JSON.stringify(r));
    const r2 = await noPrazo(casos.executar('criarEstrutura', entrada, ctxDe('op-b', 'E-B'), portas()));
    afirma(r2 !== 'PRESO' && r2.ok === false && codigos(r2) === 'SEM_RESPOSTA' && b.modo.updates === 1, 'repetir enquanto continua pendente: não confirma e NÃO envia de novo (1 envio)', JSON.stringify(r2) + ' · envios ' + b.modo.updates);
    b.liberar(); await new Promise((ok) => setTimeout(ok, 10));
    const r3 = await noPrazo(casos.executar('criarEstrutura', entrada, ctxDe('op-b', 'E-B'), portas()));
    afirma(r3 && r3.ok === true && r3.situacao === 'repetida' && b.modo.updates === 1, 'o servidor confirmou: repetir reconhece a operação ("repetida"), sem novo envio', JSON.stringify(r3));
    afirma(Object.keys(b.servidor('estruturas-concretas/registros') || {}).length === 1, 'uma estrutura no servidor');
  }

  console.log('C. o servidor recusa depois do prazo');
  {
    const b = bancoFalso(semente());
    const portas = () => FB.criarPortas({ db: b.db, codigosFirmes: FIRMES, prazoMs: PRAZO });
    b.modo.reter = true;
    const r = await noPrazo(casos.executar('criarEstrutura', entrada, ctxDe('op-c', 'E-C'), portas()));
    afirma(r && codigos(r) === 'GRAVACAO_NAO_CONFIRMADA', 'prazo vencido → GRAVACAO_NAO_CONFIRMADA');
    b.recusar(); await new Promise((ok) => setTimeout(ok, 10));
    b.modo.reter = false;
    const c = await noPrazo(portas().conferirOperacao('op-c'));
    afirma(c && c.aplicada === false, 'recusada pelo servidor: a operação não conta como aplicada nem como pendente', JSON.stringify(c));
    const r2 = await noPrazo(casos.executar('criarEstrutura', entrada, ctxDe('op-c', 'E-C'), portas()));
    afirma(r2 && r2.ok === true && b.modo.updates === 2 && Object.keys(b.servidor('estruturas-concretas/registros') || {}).length === 1, 'salvar de novo envia uma vez e grava uma estrutura', JSON.stringify(r2));
  }

  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})();
