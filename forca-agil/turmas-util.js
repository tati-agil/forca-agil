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

  /* Período como ele tem de aparecer NO CERTIFICADO: uma data que se
     explica sozinha. No site o texto sai sem mês porque o mês está no
     rótulo ao lado ("Encontros: 16"); no certificado ele fica sozinho
     numa linha comprida, ao lado de um ícone de calendário, e um número
     solto não lê como data de curso — visto num certificado de turma de
     um dia só. Vale de 1 a 5 dias, no mesmo mês ou não. */
  function periodoCertificado(dias) {
    var list = (dias || []).filter(Boolean).slice().sort();
    if (!list.length) return '';
    var grupos = [];
    list.map(parseISO).forEach(function (p) {
      var ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.m === p.m && ultimo.y === p.y) { ultimo.d.push(p.d); return; }
      grupos.push({ m: p.m, y: p.y, d: [p.d] });
    });
    /* O ano aparece uma vez só, no fim — a não ser que a turma atravesse
       a virada do ano, quando cada trecho precisa do seu. */
    var variosAnos = grupos.some(function (g) { return g.y !== grupos[0].y; });
    var textos = grupos.map(function (g, i) {
      var base = joinDias(g.d) + ' de ' + (MESES[g.m - 1] || '');
      return (variosAnos || i === grupos.length - 1) ? base + ' de ' + g.y : base;
    });
    if (textos.length === 1) return textos[0];
    return textos.slice(0, -1).join(', ') + ' e ' + textos[textos.length - 1];
  }

  /* "2026-08-11" -> "11/08/2026" (uso em selects/tabelas do admin) */
  function formatISOBr(iso) {
    var p = parseISO(iso);
    if (!p.y) return iso || '';
    return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y;
  }

  /* "09:00" -> "9h", "13:30" -> "13h30". Turma sem horário salvo (criada
     antes deste campo existir) usa 09:00–13:00 — o valor que sempre esteve
     fixo no card antes, então nenhuma turma antiga muda de aparência sem
     o admin editar. */
  function formatHora(hhmm) {
    var p = String(hhmm || '').split(':');
    var h = parseInt(p[0], 10);
    if (isNaN(h)) return '';
    var m = parseInt(p[1], 10) || 0;
    return h + 'h' + (m ? String(m).padStart(2, '0') : '');
  }
  function formatHorario(inicio, fim) {
    var hi = formatHora(inicio || '09:00');
    var hf = formatHora(fim || '13:00');
    if (!hi || !hf) return '';
    return hi + ' – ' + hf;
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

  /* Entrada direta pelo card do site agora carrega o evento: a chave vira
     "lista:<eventoKey>" (uma por evento em que a pessoa clicou "Entrar na
     lista de espera" — o card passou a ser um por evento). Registro de
     antes dessa mudança, sem evento, continua com a chave "lista" pura —
     por isso o cheque aceita as duas formas em vez de igualdade exata. */
  function ehOrigemDireta(origem) {
    return origem === ORIGEM_DIRETA ||
      (typeof origem === 'string' && origem.indexOf(ORIGEM_DIRETA + ':') === 0);
  }

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

  /* ── "Ver esta tela como" ─────────────────────────────────────────────
     Lista, para o seletor que a Minha Área e a página Turmas mostram ao
     admin, todo mundo que aparece em turmas-interesse — cada pessoa com o
     rótulo da situação mais relevante (confirmada > inscrita sem
     confirmação > interesse > removida) — para o admin poder conferir a
     tela como aquela pessoa específica veria. Era montada só dentro de
     aluno.js; extraída aqui para a página Turmas reusar a mesma consulta
     em vez de duplicá-la — as duas telas têm o mesmo motivo pra existir:
     regra de visibilidade por pessoa (público restrito, restrito a
     diretores) já foi esquecida mais de uma vez por faltar como conferir
     na prática o que cada pessoa vê. */
  function listarPessoasVerComo(cb) {
    firebase.database().ref('turmas-interesse').once('value', function (snap) {
      var dados = snap.val() || {};
      firebase.database().ref('turmas').once('value', function (snapT) {
        var turmas = snapT.val() || {};
        var pessoas = {};
        Object.keys(dados).forEach(function (tk) {
          var rotuloTurma = (turmas[tk] || {}).label || tk;
          Object.keys(dados[tk] || {}).forEach(function (uk) {
            var r = dados[tk][uk] || {};
            if (!r.email) return;
            var situacao = r.removed ? 'removida de ' + rotuloTurma
              : (r.status === 'inscrito' && r.confirmedByAdmin) ? 'confirmada em ' + rotuloTurma
              : r.status === 'inscrito' ? 'inscrita sem confirmação em ' + rotuloTurma
              : 'interesse em ' + rotuloTurma;
            if (!pessoas[uk]) pessoas[uk] = { uk: uk, nome: r.name || r.email, email: r.email, situacoes: [] };
            /* Confirmada é a situação mais relevante: vai para a frente */
            if (situacao.indexOf('confirmada') === 0) pessoas[uk].situacoes.unshift(situacao);
            else pessoas[uk].situacoes.push(situacao);
          });
        });
        cb(Object.keys(pessoas)
          .map(function (uk) { return pessoas[uk]; })
          .sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || '', 'pt'); }));
      });
    });
  }

  /* REGRAS DE ENTRADA NUMA TURMA — o critério ÚNICO, usado pela pessoa ("Tenho interesse", fila de espera, app.js; prévia
     "Turmas abertas no momento", aluno.js) e pelas portas do painel que põem alguém numa turma (＋ Participante, Confirmar,
     Mover da fila — admin.js; o Sorteio tem regras próprias). Quatro regras, conferidas NESTA ordem (a primeira que barra é
     a que aparece — da mais definitiva para a mais passageira):
       1. público da turma — turmas/<t>/publicoCargo = 'gerentes' | 'tecnicos': 'gerentes' só admite quem está em
          fa-gerentes/<emailKey>; 'tecnicos' só quem NÃO está (técnico = quem não é gerente). Lista por e-mail: vale mesmo
          para quem ainda não tem cadastro;
       2. participação anterior — eventos/<ev>/bloqueiaParticipantesDe = { <outroEvento>: true }: quem tem interesse ou
          inscrição numa turma de um desses eventos não entra;
       3. uma turma por pessoa — eventos/<ev>/umaTurmaPorPessoa = true, com umaTurmaComEventos = { <outroEvento>: true }
          (o grupo = este evento + os marcados): quem já tem interesse ou inscrição em OUTRA turma do grupo não entra;
          para trocar, a pessoa remove o próprio interesse (ou o admin a retira) primeiro;
       4. vagas — turmas/<t>/vagas = N (> 0; ausente = sem limite): interesse + inscrição não removidos da turma (sem contar
          a própria pessoa) chegaram a N → lotada. É a única que o admin pode ultrapassar, com motivo (admin.js).
     As regras 1 e 4 só valem com turmaKey (a fila de espera é do evento, não de uma turma). Quem JÁ está na turma não é
     barrado por ela no card (app.js mostra o registro dela antes de perguntar aqui).
     "Ter" = registro em turmas-interesse/<turma>/<emailKey> não removido. Tudo lido do banco NA HORA. Leitura que falha →
     'erro' (quem chama não deixa gravar).
     arg = { eventoKey, eKey, turmaKey (opcional: a turma pretendida, que não conta contra ela mesma) }.
     cb({ estado: 'livre' | 'bloqueado' | 'erro', regra: 'cargo' | 'participacao' | 'umaTurma' | 'lotada', cargo, evento,
     turma: { key, label, dias, evento, inscrita }, vagas, ocupadas }). */
  function vagasDaTurma(t) { var n = Math.floor(Number(t && t.vagas)); return n > 0 ? n : 0; }
  function cargoDaTurma(t) { var c = t && t.publicoCargo; return c === 'gerentes' || c === 'tecnicos' ? c : ''; }
  function regraValida(v) { return !!(v && !v.removed && v.status !== 'removido'); }
  function regrasDeEntrada(arg, cb) {
    var eventoKey = (arg && arg.eventoKey) || '', eKey = arg && arg.eKey, turmaKey = (arg && arg.turmaKey) || '';
    if (!eKey) { cb({ estado: 'livre' }); return; }
    var db = firebase.database(), falha = function () { cb({ estado: 'erro' }); };
    db.ref('eventos').once('value', function (eSnap) {
      var eventos = eSnap.val() || {}, ev = eventoKey ? (eventos[eventoKey] || {}) : {};
      var marcadas = function (o) { return Object.keys(o || {}).filter(function (k) { return k !== eventoKey && o[k]; }); };
      var anteriores = marcadas(ev.bloqueiaParticipantesDe);
      var grupo = ev.umaTurmaPorPessoa ? [eventoKey].concat(marcadas(ev.umaTurmaComEventos)) : [];
      db.ref('turmas').once('value', function (tSnap) {
        var turmas = tSnap.val() || {}, alvoT = turmaKey ? (turmas[turmaKey] || {}) : {};
        var cargo = cargoDaTurma(alvoT), vagas = vagasDaTurma(alvoT);
        conferirCargo(function () { conferirEventos(function () { conferirVagas(function () { cb({ estado: 'livre' }); }); }); });

        function conferirCargo(seguir) {
          if (!cargo) { seguir(); return; }
          db.ref('fa-gerentes/' + eKey).once('value', function (s) {
            var gerente = !!s.val();
            if ((cargo === 'gerentes') !== gerente) { cb({ estado: 'bloqueado', regra: 'cargo', cargo: cargo }); return; }
            seguir();
          }, falha);
        }
        function conferirEventos(seguir) {
          var alvo = Object.keys(turmas).filter(function (k) {
            var e = (turmas[k] || {}).eventoKey;
            return anteriores.indexOf(e) !== -1 || (grupo.indexOf(e) !== -1 && k !== turmaKey);
          });
          if (!alvo.length) { seguir(); return; }
          var pend = alvo.length, falhou = false, achados = {};
          alvo.forEach(function (tk) {
            db.ref('turmas-interesse/' + tk + '/' + eKey).once('value', function (s) {
              if (regraValida(s.val())) achados[tk] = s.val();
              if (--pend === 0) fim();
            }, function () { falhou = true; if (--pend === 0) fim(); });
          });
          function fim() {
            var tks = Object.keys(achados);
            var anterior = tks.filter(function (tk) { return anteriores.indexOf(turmas[tk].eventoKey) !== -1; })[0];
            if (anterior) { cb({ estado: 'bloqueado', regra: 'participacao', evento: (eventos[turmas[anterior].eventoKey] || {}).nome || '' }); return; }
            var outra = tks.filter(function (tk) { return grupo.indexOf(turmas[tk].eventoKey) !== -1; })[0];
            if (outra) {
              var t = turmas[outra];
              cb({ estado: 'bloqueado', regra: 'umaTurma', turma: { key: outra, label: t.label || outra, dias: (t.dias || []).slice().sort(),
                evento: (eventos[t.eventoKey] || {}).nome || '', inscrita: achados[outra].status === 'inscrito' } });
              return;
            }
            if (falhou) { cb({ estado: 'erro' }); return; }
            seguir();
          }
        }
        function conferirVagas(seguir) {
          if (!vagas) { seguir(); return; }
          db.ref('turmas-interesse/' + turmaKey).once('value', function (s) {
            var lista = s.val() || {};
            var ocupadas = Object.keys(lista).filter(function (k) { return k !== eKey && regraValida(lista[k]); }).length;
            if (ocupadas >= vagas) { cb({ estado: 'bloqueado', regra: 'lotada', vagas: vagas, ocupadas: ocupadas }); return; }
            seguir();
          }, falha);
        }
      }, falha);
    }, falha);
  }
  function descreverTurmaRegra(t) {
    var dia = t.dias && t.dias[0] ? formatISOBr(t.dias[0]).slice(0, 5) : '';
    return t.label + (t.evento ? ' — ' + t.evento : '') + (dia ? ' (dia ' + dia + ')' : '');
  }
  /* o que a PESSOA lê no card (sem HTML) */
  function mensagemRegraPessoa(r) {
    if (!r || r.estado === 'erro') return 'Não foi possível verificar suas outras turmas agora. Recarregue a página e tente de novo.';
    if (r.regra === 'cargo') return r.cargo === 'gerentes' ? 'Esta turma é só para gerentes.' : 'Esta turma não é para gerentes — procure a turma de gerentes deste evento.';
    if (r.regra === 'participacao') return 'Estas turmas são para quem ainda não participou de ' + (r.evento || 'um evento anterior') + '. Você já tem interesse ou inscrição registrada lá.';
    if (r.regra === 'lotada') return 'Turma lotada — as ' + r.vagas + ' vagas já foram preenchidas. Se alguém sair, ela reabre.';
    return 'Você já ' + (r.turma.inscrita ? 'está inscrita' : 'tem interesse') + ' na ' + descreverTurmaRegra(r.turma) + '. Só é possível participar de uma turma por vez. ' +
      (r.turma.inscrita ? 'Para trocar, peça ao admin para retirá-la daquela turma.' : 'Para trocar, remova seu interesse naquela turma.');
  }
  /* o que o ADMIN lê no painel ao tentar incluir alguém (sem HTML). 'lotada' não é recusa: o painel pede o motivo. */
  function mensagemRegraAdmin(r, nome) {
    var quem = nome || 'Essa pessoa';
    if (!r || r.estado === 'erro') return 'Não consegui verificar as regras da turma para ' + quem + ' agora. Recarregue a página e tente de novo. Nada foi gravado.';
    if (r.regra === 'cargo') return r.cargo === 'gerentes'
      ? quem + ' não está na lista de Gerentes, e esta turma é só para gerentes. Se for gerente, inclua o e-mail na aba Gerentes primeiro. Nada foi gravado.'
      : quem + ' está na lista de Gerentes, e esta turma não é para gerentes. Nada foi gravado.';
    if (r.regra === 'participacao') return quem + ' já tem interesse ou inscrição em ' + (r.evento || 'um evento anterior') + ', e este evento não aceita quem já participou dele. Nada foi gravado.';
    if (r.regra === 'lotada') return 'A turma está lotada (' + r.ocupadas + ' de ' + r.vagas + ' vagas). Para incluir ' + quem + ' mesmo assim, escreva o motivo.';
    return quem + ' já ' + (r.turma.inscrita ? 'está inscrita' : 'tem interesse') + ' na ' + descreverTurmaRegra(r.turma) + '. Este evento admite uma turma por pessoa: retire-a daquela turma primeiro. Nada foi gravado.';
  }

  window.faTurmasUtil = {
    formatDias: formatDias, periodoCertificado: periodoCertificado, formatISOBr: formatISOBr, formatHorario: formatHorario, MESES: MESES,
    ORIGEM_DIRETA: ORIGEM_DIRETA, ehOrigemDireta: ehOrigemDireta,
    esperaEntradas: esperaEntradas, esperaAtivas: esperaAtivas, esperaNaFila: esperaNaFila,
    listarPessoasVerComo: listarPessoasVerComo,
    vagasDaTurma: vagasDaTurma, cargoDaTurma: cargoDaTurma,
    regrasDeEntrada: regrasDeEntrada, mensagemRegraPessoa: mensagemRegraPessoa, mensagemRegraAdmin: mensagemRegraAdmin
  };
})();
