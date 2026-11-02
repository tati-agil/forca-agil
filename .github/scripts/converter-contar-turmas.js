/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   CONVERSÃO "Contar turmas de outros eventos" → "Impedir nova participação" (eventos/<ev>).

   Por que existe: o formulário do evento passou a ter só dois mecanismos — "Só uma turma por pessoa neste evento" e
   "Impedir nova participação" (bloqueiaParticipantesDe). O terceiro, umaTurmaComEventos ("Contar turmas de outros
   eventos"), bloqueia EXATAMENTE as mesmas pessoas que listar aqueles eventos em bloqueiaParticipantesDe: os dois
   contam o mesmo registro (interesse ou inscrição não removidos, em qualquer turma do evento, realizada ou não) e valem
   para a pessoa, a lista de espera e as portas do ADMIN (faTurmasUtil.regrasDeEntrada). Só a mensagem muda (de "uma
   turma por vez" para "participação anterior"). Até esta conversão, o campo antigo continua valendo.

   O que faz, evento por evento (só os que têm umaTurmaComEventos com alguma chave):
     - com "Só uma turma por pessoa" LIGADA: acrescenta cada evento de umaTurmaComEventos (menos o próprio) em
       bloqueiaParticipantesDe — o que já estava lá fica; nada é retirado;
     - em todos: guarda o valor antigo em umaTurmaComEventosHistorico = { eventos, umaTurmaPorPessoa, convertidoEm,
       convertidoPor } e apaga umaTurmaComEventos (com "uma turma" desligada ele não valia nada, e não volta a valer
       escondido se alguém ligar a caixa depois).
   Idempotente: evento sem umaTurmaComEventos não é tocado; rodar de novo não faz nada. Nenhum outro campo e nenhum
   outro evento é tocado.

   1. SIMULAÇÃO (padrão): lê eventos, mostra o plano e a ASSINATURA (sha256 do plano). Nada é gravado.
   2. GRAVAÇÃO (só com CONVERTER_CONFIRMAR=sim e CONVERTER_ASSINATURA=<a da simulação>): relê, refaz o plano e
      INTERROMPE sem gravar se a assinatura não bater; grava tudo numa única atualização (atômica) só nos caminhos do
      plano; relê e VALIDA: os bloqueios efetivos de cada evento (eventos que bloqueiam por participação + os que contam
      no "uma turma") são os mesmos de antes, umaTurmaComEventos sumiu dos convertidos, e todo o resto de eventos está
      idêntico.
   Acesso: FA_TOKEN (Bearer de quem tem acesso ao banco) e FA_DB_HOST (padrão kyber-agil-default-rtdb.firebaseio.com).
   Teste: teste-converter-contar-turmas.js (plano puro + as decisões de regrasDeEntrada antes/depois, dados sintéticos).
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const crypto = require('crypto');

const marcadas = (o, eu) => Object.keys(o || {}).filter((k) => k !== eu && o[k]).sort();

/* o que bloqueia de fato, no código de decisão (regrasDeEntrada): os eventos de "participação anterior" e — só com
   "uma turma" ligada — os outros eventos do grupo. Um conjunto só, porque bloqueiam as mesmas pessoas. */
function bloqueiosEfetivos(ev, eu) {
  const s = new Set(marcadas(ev && ev.bloqueiaParticipantesDe, eu));
  if (ev && ev.umaTurmaPorPessoa) marcadas(ev.umaTurmaComEventos, eu).forEach((k) => s.add(k));
  return Array.from(s).sort();
}

/* Pura: dado eventos (o nó inteiro), o plano. */
function planejar(eventos, quando, quem) {
  const plano = [];
  Object.keys(eventos || {}).sort().forEach((k) => {
    const ev = eventos[k];
    if (!ev || typeof ev !== 'object' || !ev.umaTurmaComEventos || typeof ev.umaTurmaComEventos !== 'object') return;
    const antigos = marcadas(ev.umaTurmaComEventos, k);
    const acrescentar = ev.umaTurmaPorPessoa ? antigos.filter((x) => !(ev.bloqueiaParticipantesDe || {})[x]) : [];
    plano.push({ evento: k, nome: ev.nome || '', umaTurmaPorPessoa: !!ev.umaTurmaPorPessoa, antigos, acrescentar,
      historico: { eventos: ev.umaTurmaComEventos, umaTurmaPorPessoa: !!ev.umaTurmaPorPessoa, convertidoEm: quando, convertidoPor: quem } });
  });
  return plano;
}
function gravacoes(plano) {
  const up = {};
  plano.forEach((p) => {
    p.acrescentar.forEach((x) => { up['eventos/' + p.evento + '/bloqueiaParticipantesDe/' + x] = true; });
    up['eventos/' + p.evento + '/umaTurmaComEventosHistorico'] = p.historico;
    up['eventos/' + p.evento + '/umaTurmaComEventos'] = null;
  });
  return up;
}
function aplicar(eventos, plano) {
  const out = JSON.parse(JSON.stringify(eventos || {}));
  plano.forEach((p) => {
    const ev = out[p.evento];
    if (p.acrescentar.length) { ev.bloqueiaParticipantesDe = ev.bloqueiaParticipantesDe || {}; p.acrescentar.forEach((x) => { ev.bloqueiaParticipantesDe[x] = true; }); }
    ev.umaTurmaComEventosHistorico = p.historico;
    delete ev.umaTurmaComEventos;
  });
  return out;
}
/* a assinatura não depende de quando/quem: só do que muda */
function assinatura(plano) {
  return crypto.createHash('sha256').update(JSON.stringify(plano.map((p) => [p.evento, p.umaTurmaPorPessoa, p.antigos, p.acrescentar]))).digest('hex').slice(0, 16);
}
/* validação: bloqueios efetivos iguais em todos os eventos, e nada fora do plano mudou */
function validar(antes, depois, plano) {
  const problemas = [];
  const tocados = new Set(plano.map((p) => p.evento));
  Object.keys(antes || {}).forEach((k) => {
    const a = bloqueiosEfetivos(antes[k], k), d = bloqueiosEfetivos((depois || {})[k], k);
    if (JSON.stringify(a) !== JSON.stringify(d)) problemas.push(k + ': bloqueios efetivos mudaram (' + a.join(',') + ' → ' + d.join(',') + ')');
    const semCampos = (e) => { const c = Object.assign({}, e || {}); delete c.bloqueiaParticipantesDe; delete c.umaTurmaComEventos; delete c.umaTurmaComEventosHistorico; return JSON.stringify(c); };
    if (!tocados.has(k) && JSON.stringify(antes[k]) !== JSON.stringify((depois || {})[k])) problemas.push(k + ': evento fora do plano mudou');
    if (tocados.has(k) && semCampos(antes[k]) !== semCampos((depois || {})[k])) problemas.push(k + ': outro campo do evento mudou');
    if (tocados.has(k) && depois[k] && depois[k].umaTurmaComEventos) problemas.push(k + ': umaTurmaComEventos continua lá');
  });
  Object.keys(depois || {}).forEach((k) => { if (!(antes || {})[k]) problemas.push(k + ': evento novo apareceu'); });
  return problemas;
}

module.exports = { planejar, gravacoes, aplicar, assinatura, validar, bloqueiosEfetivos };

if (require.main === module) {
  const https = require('https');
  const HOST = process.env.FA_DB_HOST || 'kyber-agil-default-rtdb.firebaseio.com', TOKEN = process.env.FA_TOKEN;
  if (!TOKEN) { console.error('FA_TOKEN ausente.'); process.exit(2); }
  const pedir = (metodo, caminho, corpo) => new Promise((res, rej) => {
    const r = https.request({ host: HOST, path: caminho, method: metodo, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } }, (s) => {
      let d = ''; s.on('data', (c) => d += c); s.on('end', () => { if (s.statusCode >= 300) rej(new Error(metodo + ' ' + caminho + ': ' + s.statusCode + ' ' + d.slice(0, 200))); else res(JSON.parse(d || 'null')); });
    }); r.on('error', rej); if (corpo) r.write(JSON.stringify(corpo)); r.end();
  });
  (async () => {
    const antes = (await pedir('GET', '/eventos.json')) || {};
    const quando = new Date().toISOString(), quem = process.env.CONVERTER_POR || 'conversao-contar-turmas';
    const plano = planejar(antes, quando, quem), sig = assinatura(plano);
    console.log('Eventos: ' + Object.keys(antes).length + ' · a converter: ' + plano.length);
    plano.forEach((p) => console.log('  ' + p.evento + ' (' + p.nome + ') — uma turma: ' + (p.umaTurmaPorPessoa ? 'sim' : 'não') +
      ' · campo antigo: ' + (p.antigos.join(', ') || '—') + ' · acrescentar em "Impedir nova participação": ' + (p.acrescentar.join(', ') || 'nada')));
    const simulado = validar(antes, aplicar(antes, plano), plano);
    console.log('Validação simulada: ' + (simulado.length ? 'PROBLEMAS:\n  ' + simulado.join('\n  ') : 'bloqueios efetivos iguais, nada fora do plano'));
    console.log('Assinatura do plano: ' + sig);
    if (!plano.length) { console.log('Nada a converter (idempotente).'); return; }
    if (process.env.CONVERTER_CONFIRMAR !== 'sim') { console.log('SIMULAÇÃO — nada foi gravado.'); return; }
    if (process.env.CONVERTER_ASSINATURA !== sig) { console.error('Assinatura diferente da validada — nada foi gravado.'); process.exit(1); }
    if (simulado.length) { console.error('A validação simulada falhou — nada foi gravado.'); process.exit(1); }
    await pedir('PATCH', '/.json', gravacoes(plano));
    const depois = (await pedir('GET', '/eventos.json')) || {};
    const problemas = validar(antes, depois, plano);
    console.log('GRAVADO. Validação depois: ' + (problemas.length ? 'PROBLEMAS:\n  ' + problemas.join('\n  ') : 'bloqueios efetivos iguais, nada fora do plano, campo antigo convertido'));
    process.exit(problemas.length ? 1 : 0);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
