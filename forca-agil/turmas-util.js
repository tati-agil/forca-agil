/* ============================================================
   Força Ágil — Utilidades de Turma
   Deriva textos de exibição (mês, datas) a partir do array de
   datas ISO de cada turma, para não duplicar strings hardcoded
   em app.js / admin.js / checkin.js.
   ============================================================ */
(function () {
  'use strict';

  var MESES = ['janeiro','fevereiro','março','abril','maio','junho',
                'julho','agosto','setembro','outubro','novembro','dezembro'];
  var MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  function parseISO(iso) {
    var p = (iso || '').split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  function joinDias(dayNums) {
    return dayNums.length === 1
      ? String(dayNums[0])
      : dayNums.slice(0, -1).join(', ') + ' e ' + dayNums[dayNums.length - 1];
  }

  /* dias: array de strings "YYYY-MM-DD" -> { mes, dates }
     Mesmo mês:  { mes: "Agosto", dates: "11, 12, 18, 19 e 20" }
     Cruza mês:  { mes: "Nov–Dez", dates: "28 e 29 nov · 1 e 2 dez" } — agrupado por
     mês pra não ficar ambíguo qual dia pertence a qual mês */
  function formatDias(dias) {
    var list = (dias || []).filter(Boolean).slice().sort();
    if (!list.length) return { mes: '', dates: '' };
    var parsed = list.map(parseISO);

    var mesesUnicos = [];
    parsed.forEach(function (p) {
      if (mesesUnicos.indexOf(p.m) === -1) mesesUnicos.push(p.m);
    });

    if (mesesUnicos.length === 1) {
      var dayNums = parsed.map(function (p) { return p.d; });
      return { mes: cap(MESES[mesesUnicos[0] - 1] || ''), dates: joinDias(dayNums) };
    }

    var grupos = mesesUnicos.map(function (m) {
      var diasDoMes = parsed.filter(function (p) { return p.m === m; }).map(function (p) { return p.d; });
      return joinDias(diasDoMes) + ' ' + (MESES_ABREV[m - 1] || '');
    });

    var mesTitulo = mesesUnicos.length === 2
      ? cap(MESES_ABREV[mesesUnicos[0] - 1]) + '–' + cap(MESES_ABREV[mesesUnicos[1] - 1])
      : mesesUnicos.map(function (m) { return cap(MESES_ABREV[m - 1]); }).join('/');

    return { mes: mesTitulo, dates: grupos.join(' · ') };
  }

  /* "2026-08-11" -> "11/08/2026" (uso em selects/tabelas do admin) */
  function formatISOBr(iso) {
    var p = parseISO(iso);
    if (!p.y) return iso || '';
    return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y;
  }

  /* ── Lista de espera ──────────────────────────────────────────────────
     fa-espera guarda uma entrada por pessoa E por ORIGEM:

         fa-espera/<chave do e-mail>/<origem>

     onde origem é a chave da turma de onde a pessoa saiu, ou "lista" para
     quem entrou direto pelo card do site. Quem passou por duas turmas ocupa
     duas entradas — é o que responde "há quanto tempo essa pessoa vem
     tentando", e o que a estrutura antiga perdia: ela guardava uma entrada
     por pessoa, então a segunda migração escrevia por cima da primeira e
     levava junto a data do interesse original, que é o que ordena a fila.

     Os leitores abaixo aceitam também o formato antigo (campos direto
     embaixo da chave de e-mail) para que nenhuma tela quebre entre o deploy
     e a migração dos registros existentes. */
  var ORIGEM_DIRETA = 'lista';

  function esperaEntradas(noDaPessoa) {
    if (!noDaPessoa || typeof noDaPessoa !== 'object') return [];
    if (noDaPessoa.email) {   /* formato antigo: uma pessoa, um registro */
      var e = Object.assign({ _origem: noDaPessoa.migratedFrom || ORIGEM_DIRETA }, noDaPessoa);
      return [e];
    }
    return Object.keys(noDaPessoa).map(function (o) {
      return Object.assign({ _origem: o }, noDaPessoa[o]);
    }).filter(function (e) { return e && e.email; });
  }

  function esperaAtivas(noDaPessoa) {
    return esperaEntradas(noDaPessoa).filter(function (e) { return !e.removed; });
  }

  /* A pessoa está na fila se qualquer uma das origens dela estiver ativa. */
  function esperaNaFila(noDaPessoa) {
    return esperaAtivas(noDaPessoa).length > 0;
  }

  window.faTurmasUtil = {
    formatDias: formatDias, formatISOBr: formatISOBr, MESES: MESES,
    ORIGEM_DIRETA: ORIGEM_DIRETA,
    esperaEntradas: esperaEntradas, esperaAtivas: esperaAtivas, esperaNaFila: esperaNaFila
  };
})();
