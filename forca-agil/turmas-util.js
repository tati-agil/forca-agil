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

  function parseISO(iso) {
    var p = (iso || '').split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  /* dias: array de strings "YYYY-MM-DD" -> { mes: "Agosto", dates: "11, 12, 18, 19 e 20" } */
  function formatDias(dias) {
    var list = (dias || []).filter(Boolean).slice().sort();
    if (!list.length) return { mes: '', dates: '' };
    var parsed = list.map(parseISO);
    var meses = [];
    parsed.forEach(function (p) {
      var nome = cap(MESES[p.m - 1] || '');
      if (nome && meses.indexOf(nome) === -1) meses.push(nome);
    });
    var dayNums = parsed.map(function (p) { return p.d; });
    var dates = dayNums.length === 1
      ? String(dayNums[0])
      : dayNums.slice(0, -1).join(', ') + ' e ' + dayNums[dayNums.length - 1];
    return { mes: meses.join('/'), dates: dates };
  }

  /* "2026-08-11" -> "11/08/2026" (uso em selects/tabelas do admin) */
  function formatISOBr(iso) {
    var p = parseISO(iso);
    if (!p.y) return iso || '';
    return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y;
  }

  window.faTurmasUtil = { formatDias: formatDias, formatISOBr: formatISOBr, MESES: MESES };
})();
