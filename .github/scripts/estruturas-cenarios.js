/* Executor COMPARTILHADO dos cenários de negócio das Estruturas Organizacionais Concretas.
 *
 * Lê o conjunto versionado (cenarios/estruturas-concretas.v<N>.json), executa cada cenário pelo MESMO caso de uso
 * (forca-agil/estruturas-casos-de-uso.js) contra uma implementação das portas de persistência e compara com o
 * 'esperado' do conjunto. Quem chama fornece só a fábrica das portas:
 *   - referência em memória (teste-estruturas-cenarios-referencia.js, suíte hermética);
 *   - Firebase Realtime Database Emulator (Etapa 2);
 *   - PostgreSQL de teste (Etapa 3).
 * Se os três batem com o mesmo 'esperado', os três dão o mesmo resultado de negócio.
 *
 * Uso: const R = require('./estruturas-cenarios'); await R.executar({ criarPortas, normalizarHorario, rotulo }).
 *   criarPortas(referencias, estadoInicial) → portas novas para UM cenário (lerReferencias, lerEstado, gravar,
 *                              conferirOperacao, lerEventos), já com o estadoInicial do cenário (formato 2: ex.
 *                              Linhas cadastradas antes dos subagrupadores), ou vazias;
 *   normalizarHorario        → opcional: num banco que grava o horário do SERVIDOR, recebe (valorGravado,
 *                              valorDoCenario) e devolve o valor a comparar — só depois de conferir que veio do
 *                              servidor. Sem ele, o horário gravado tem de ser exatamente o do cenário.
 * Relatório: identifica o conjunto, a versão e o sha256 do arquivo executado. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..', '..');
const N = require(path.join(RAIZ, 'forca-agil', 'estruturas-nucleo.js'));
const U = require(path.join(RAIZ, 'forca-agil', 'estruturas-casos-de-uso.js'));
const MOTOR = require(path.join(RAIZ, 'forca-agil', 'motor-posicionamento-nucleo.js'));
const ARQUIVO = path.join(__dirname, 'cenarios', 'estruturas-concretas.v1.json');
const ARQUIVO_SUBAGRUPADORES = path.join(__dirname, 'cenarios', 'mapa-subagrupadores.v1.json');
const ARQUIVO_VINCULOS = path.join(__dirname, 'cenarios', 'vinculos-responsavel.v1.json');
/* campos de horário por coleção (formato 2 do conjunto: estadoFinal por coleção) */
const HORARIOS = { estruturas: ['criadaEm', 'alteradaEm', 'encerramento.em'], subagrupadores: ['criadoEm', 'alteradoEm', 'encerramento.em'], associacoesSubagrupador: ['criadaEm', 'encerramento.em'], vinculos: ['criadoEm', 'encerramento.em'] };
const ler = (o, c) => c.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), o);
const por = (o, c, v) => { const p = c.split('.'); let a = o; for (let i = 0; i < p.length - 1; i++) a = a[p[i]]; a[p[p.length - 1]] = v; };

function carregar(arquivo) {
  const bruto = fs.readFileSync(arquivo || ARQUIVO, 'utf8').replace(/\r\n/g, '\n');
  const conj = JSON.parse(bruto);
  return { conj, sha256: crypto.createHash('sha256').update(bruto, 'utf8').digest('hex') };
}
/* "arq" → { id, email } (usuários do conjunto); null continua null */
function resolverUsuarios(v, usuarios) {
  if (Array.isArray(v)) return v.map((x) => resolverUsuarios(x, usuarios));
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[k] = ['usuario', 'criadaPor', 'alteradaPor', 'criadoPor', 'alteradoPor', 'por'].indexOf(k) !== -1 && typeof v[k] === 'string' ? usuarios[v[k]] : resolverUsuarios(v[k], usuarios); }); return o; }
  return v;
}
function entradaDe(passo) {
  const e = JSON.parse(JSON.stringify(passo.entrada || {}));
  if (e.nomeRepetido) { e.nome = e.nomeRepetido.caractere.repeat(e.nomeRepetido.vezes); delete e.nomeRepetido; }
  return e;
}
const ordenado = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x));

/* falhas de persistência injetadas pelo cenário (iguais em qualquer adaptador: envolvem as portas) */
function comFalha(portas, falha) {
  if (!falha) return portas;
  const p = Object.assign({}, portas);
  if (falha === 'sem-resposta-depois-de-gravar') p.gravar = (op) => portas.gravar(op).then(() => Promise.reject({ codigo: 'SEM_RESPOSTA' }));
  if (falha === 'sem-resposta-sem-gravar') p.gravar = () => Promise.reject({ codigo: 'SEM_RESPOSTA' });
  return p;
}

async function executar(opcoes) {
  const { conj, sha256 } = carregar(opcoes.arquivo);
  const casos = U.criar({ nucleo: N, codigosFirmes: MOTOR.CODIGOS_FIRMES });
  const usuarios = conj.usuarios, norm = opcoes.normalizarHorario || ((gravado) => gravado);
  const log = opcoes.log || console.log;
  let total = 0, falhas = 0;
  const afirma = (c, msg, det) => { total++; log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + det : '')); if (!c) falhas++; };
  log('conjunto ' + conj.conjunto + ' v' + conj.versao + ' sha256:' + sha256 + (opcoes.rotulo ? ' — executor: ' + opcoes.rotulo : ''));

  for (const cen of conj.cenarios) {
    log(cen.id + ' ' + cen.titulo);
    /* estadoInicial pode ser o nome de um estado comum do conjunto (conj.estados) */
    const ini = typeof cen.estadoInicial === 'string' ? conj.estados[cen.estadoInicial] : cen.estadoInicial;
    const inicial = ini ? resolverUsuarios(JSON.parse(JSON.stringify(ini)), usuarios) : undefined;
    const portas = await opcoes.criarPortas(JSON.parse(JSON.stringify(conj.referencias[cen.referencias])), inicial);
    const conferirResultado = (passo, r, rot) => {
      const esp = passo.esperado;
      const obtido = r.ok ? { ok: true, situacao: r.situacao } : { ok: false, erros: (r.erros || []).map((e) => e.codigo).sort() };
      const esperado = esp.ok ? { ok: true, situacao: esp.situacao } : { ok: false, erros: esp.erros.slice().sort() };
      afirma(ordenado(obtido) === ordenado(esperado), rot, 'esperado ' + JSON.stringify(esperado) + ', obtido ' + JSON.stringify(obtido));
    };
    for (let i = 0; i < cen.passos.length; i++) {
      const passo = cen.passos[i];
      if (passo.concorrentes) {
        /* concorrência: todas leem o MESMO estado antes de qualquer uma gravar */
        const instantaneo = await portas.lerEstado();
        const resultados = [];
        for (const pc of passo.concorrentes) {
          const p = Object.assign({}, portas, { lerEstado: () => Promise.resolve(JSON.parse(JSON.stringify(instantaneo))) });
          resultados.push(await casos.executar(pc.operacao, entradaDe(pc), resolverUsuarios(pc.ctx, usuarios), p));
        }
        passo.concorrentes.forEach((pc, k) => conferirResultado(pc, resultados[k], '  passo ' + (i + 1) + '.' + (k + 1) + ' (concorrente) ' + pc.operacao));
        continue;
      }
      const r = await casos.executar(passo.operacao, entradaDe(passo), resolverUsuarios(passo.ctx, usuarios), comFalha(portas, passo.falhaPersistencia));
      conferirResultado(passo, r, '  passo ' + (i + 1) + ' ' + passo.operacao + (passo.falhaPersistencia ? ' (' + passo.falhaPersistencia + ')' : ''));
    }
    /* estado e histórico gravados */
    const estado = await portas.lerEstado(), eventos = await portas.lerEventos();
    const estruturas = estado.estruturas || {};
    if (cen.estadoFinal && conj.formato === 2) {
      /* formato 2: uma comparação por coleção listada (as demais, como as Linhas do estado inicial, não entram) */
      Object.keys(cen.estadoFinal).forEach((col) => {
        const esperado = resolverUsuarios(cen.estadoFinal[col], usuarios), lidos = estado[col] || {}, obtido = {};
        Object.keys(lidos).forEach((id) => {
          const e = JSON.parse(JSON.stringify(lidos[id])), x = esperado[id] || {};
          (HORARIOS[col] || []).forEach((c) => { const v = ler(e, c); if (v !== undefined) por(e, c, norm(v, ler(x, c))); });
          obtido[id] = e;
        });
        afirma(ordenado(obtido) === ordenado(esperado), '  estado final gravado: ' + col, 'esperado ' + ordenado(esperado) + '\n        obtido ' + ordenado(obtido));
      });
    } else if (cen.estadoFinal) {
      const esperado = resolverUsuarios(cen.estadoFinal, usuarios);
      const obtido = {};
      Object.keys(estruturas).forEach((id) => {
        const e = JSON.parse(JSON.stringify(estruturas[id])), x = esperado[id] || {};
        if ('criadaEm' in e) e.criadaEm = norm(e.criadaEm, x.criadaEm);
        if ('alteradaEm' in e) e.alteradaEm = norm(e.alteradaEm, x.alteradaEm);
        if (e.encerramento) e.encerramento.em = norm(e.encerramento.em, x.encerramento && x.encerramento.em);
        obtido[id] = e;
      });
      afirma(ordenado(obtido) === ordenado(esperado), '  estado final gravado (estruturas, revisões, autoria, horários)', 'esperado ' + ordenado(esperado) + '\n        obtido ' + ordenado(obtido));
    }
    if (cen.contagemFinal !== undefined) afirma(Object.keys(estruturas).length === cen.contagemFinal, '  ' + cen.contagemFinal + ' estruturas gravadas', String(Object.keys(estruturas).length));
    if (cen.eventos) {
      const esperado = resolverUsuarios(cen.eventos, usuarios);
      const obtido = eventos.map((ev, k) => {
        const x = esperado[k] || {}, o = { id: ev.id, tipo: ev.tipo, entidadeId: ev.entidadeId, usuario: ev.usuario, em: norm(ev.em, x.em) };
        ['campos', 'justificativa', 'motivo', 'entidade'].forEach((c) => { if (c in x) o[c] = ev[c]; });
        return o;
      });
      afirma(ordenado(obtido) === ordenado(esperado), '  eventos de auditoria gravados (só os das operações aceitas, uma vez cada)', 'esperado ' + ordenado(esperado) + '\n        obtido ' + ordenado(obtido));
      /* cada evento traz as cópias antes/depois coerentes com o estado gravado */
      const coerente = eventos.every((ev) => !ev.depois || !estruturas[ev.entidadeId] || ev.depois.id === ev.entidadeId);
      afirma(coerente, '  cada evento aponta para a estrutura que mudou');
    }
  }
  log('\n' + conj.conjunto + ' v' + conj.versao + ' (sha256:' + sha256.slice(0, 12) + '…): ' + (total - falhas) + '/' + total + ' verificações' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ' — tudo certo.'));
  return { total, falhas, conjunto: conj.conjunto, versao: conj.versao, sha256 };
}

module.exports = { executar, carregar, ARQUIVO, ARQUIVO_SUBAGRUPADORES, ARQUIVO_VINCULOS };
