/* ============================================================
   Força Ágil — Painel do Programa: NÚCLEO PURO (cobertura, ocupação, capacidade, calendário e viabilidade)

   Sem Firebase, sem DOM, sem relógio: recebe os dados JÁ LIDOS (os mesmos nós do site) e a data de referência, e devolve
   UM resultado. A tela (painel-programa.js) só desenha esse resultado: nenhum número do painel é calculado em outro lugar.

   As regras de quem pode entrar numa turma NÃO são reescritas aqui: vêm das funções puras de turmas-util.js
   (foraDoPublicoAtual = cargo do evento e da turma, lista do evento e da turma, só diretores; conflitosDeParticipacao =
   participação anterior) e de publicos-nucleo.js, passadas em `U` e `P`.

   Regras do programa (aprovadas pela dona, nov/2026):
   - público = base oficial vigente, menos os facilitadores configurados; cada pessoa conta UMA vez;
   - situação (uma só): realizou > inscrita > interessada > cadastrada sem engajamento > sem cadastro;
   - realizou = inscrição confirmada numa turma ENCERRADA de evento do programa com frequência ≥ mínimo do evento (o mesmo
     critério da Minha Área e dos certificados), mesmo que a inscrição tenha sido removida DEPOIS do primeiro encontro;
   - check-in por pessoa: dia sem NENHUM registro na turma não vira falta — mínimo garantido ≥ mínimo → realizou;
     máximo possível < mínimo → ausência confirmada; entre os dois → realização não verificável (nem realizada nem ausente);
   - ausência pertence à turma, pendência à pessoa: o histórico nunca some e não soma às pendências;
   - ocupação operacional da turma = registros ativos (interesse + inscrição, de dentro ou de fora da base, inclusive a
     segunda inscrição da mesma pessoa) — nunca libera vaga ocupada no sistema; pessoas únicas contam uma vez;
   - máximo com as turmas planejadas = emparelhamento máximo pessoa × vaga respeitando as regras de entrada;
   - calendário: dias úteis (sem sábado, domingo e dias indisponíveis cadastrados), antecedência mínima, limite de turmas
     simultâneas por público (sobreposição de dia E horário), formato de turma nova configurado ou derivado da turma mais
     recente; o máximo de turmas que cabem é EXATO (programação dinâmica) quando o tamanho permite, senão "pelo menos".
   ============================================================ */
(function (raiz) {
  'use strict';

  /* ---------- utilitários (datas sempre 'AAAA-MM-DD' locais) ---------- */
  function emailKey(e) { return String(e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64); }
  function dataDe(iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function somaDias(iso, n) { var d = dataDe(iso); d.setDate(d.getDate() + n); return isoDe(d); }
  function minutos(h) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(h || '')); return m ? +m[1] * 60 + +m[2] : null; }
  function ehData(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
  function ordenados(dias) { return (Array.isArray(dias) ? dias : Object.keys(dias || {}).map(function (k) { return dias[k]; })).filter(ehData).slice().sort(); }
  function registroAtivo(r) { return !!(r && !r.removed && r.status !== 'removido'); }
  function confirmada(r) { return !!(r && r.status === 'inscrito' && r.confirmedByAdmin); }
  function pct1(a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; }
  function mediana(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; }
  var GRUPOS = ['tecnicos', 'gestores'];   /* públicos com turma própria: formato, calendário e turmas extras */
  var PUBLICOS = ['tecnicos', 'gestores', 'diretores', 'assessores'];   /* públicos da base (coluna nível da planilha) */
  /* nível da base oficial → público do painel ('' = não informado: usa a lista de Gerentes do site) */
  function publicoDoNivel(n) {
    var x = String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (/^tecnic/.test(x)) return 'tecnicos';
    if (/^(gerente|gestor)/.test(x)) return 'gestores';
    if (/^diretor/.test(x)) return 'diretores';
    if (/^assessor/.test(x)) return 'assessores';
    return '';
  }

  /* público de cargo de uma turma → grupo do programa ('tecnicos' | 'gestores' | null = aberta | 'conflito') */
  function grupoDoCargo(c) {
    if (!c) return null;
    if (c === 'conflito') return 'conflito';
    if (c === 'tecnicos') return 'tecnicos';
    if (/^gerentes/.test(c)) return 'gestores';
    return null;
  }

  /* ---------- 1. calendário útil ---------- */
  function diaUtil(iso, indisp) { var w = dataDe(iso).getDay(); return w !== 0 && w !== 6 && !indisp[iso]; }
  function proximoUtil(iso, indisp) { var x = somaDias(iso, 1); while (!diaUtil(x, indisp)) x = somaDias(x, 1); return x; }
  function diasUteis(de, ate, indisp) { var out = []; for (var x = de; x <= ate; x = somaDias(x, 1)) if (diaUtil(x, indisp)) out.push(x); return out; }

  /* Máximo de turmas de `n` encontros em dias úteis seguidos (janelas de n posições em `cap`), com cap[j] turmas novas
     possíveis no dia j. EXATO: programação dinâmica sobre as posições, guardando quantas turmas começaram em cada uma das
     n-1 posições anteriores. Devolve { total, inicios: [índices], exato }. Grande demais → guloso (início mais cedo
     primeiro), marcado exato:false ("pelo menos"). */
  function maximoDeJanelas(cap, n, lim) {
    var L = cap.length, S = L - n + 1;
    if (!(n >= 1) || !(lim >= 1) || S < 1) return { total: 0, inicios: [], exato: true };
    if (Math.pow(lim + 1, n - 1) * S > 400000) return gulosoJanelas(cap, n, lim);
    var memo = new Map();
    /* hist = quantas turmas começaram em cada uma das n-1 posições anteriores a `pos` (zeros antes do início).
       Ao escolher x turmas começando em `pos`, o dia `pos` fica com hist + x turmas (todas as que o cobrem); na última
       posição, os dias do fim (pos+1 .. L-1) também já estão decididos e são conferidos. */
    function cabe(pos, hx) {
      var s = 0; for (var k = 0; k < hx.length; k++) s += hx[k];
      if (s > cap[pos]) return false;
      if (pos === S - 1) for (var d = pos + 1; d < L; d++) { var t = 0; for (var k2 = d - pos; k2 < n; k2++) t += hx[k2]; if (t > cap[d]) return false; }
      return true;
    }
    function melhor(pos, hist) {
      if (pos >= S) return 0;
      var chave = pos + '|' + hist.join(',');
      var m = memo.get(chave); if (m) return m.v;
      var best = -Infinity, bx = 0;   /* nenhum x cabe = caminho impossível (nunca "0 turmas") */
      for (var x = 0; x <= lim; x++) {
        var hx = hist.concat([x]);
        if (!cabe(pos, hx)) break;   /* mais turmas no mesmo início só pioram */
        var v = x + melhor(pos + 1, hx.slice(1));
        if (v > best) { best = v; bx = x; }
      }
      memo.set(chave, { v: best, x: bx });
      return best;
    }
    var vazio = []; for (var i0 = 0; i0 < n - 1; i0++) vazio.push(0);
    var total = melhor(0, vazio), inicios = [], hist = vazio;
    for (var pos = 0; pos < S; pos++) {
      var mm = memo.get(pos + '|' + hist.join(',')), x = mm ? mm.x : 0;
      for (var i = 0; i < x; i++) inicios.push(pos);
      hist = hist.concat([x]).slice(1);
    }
    return { total: total, inicios: inicios, exato: true };
  }
  function gulosoJanelas(cap, n, lim) {
    var uso = cap.map(function () { return 0; }), inicios = [];
    for (var pos = 0; pos + n - 1 < cap.length; pos++) {
      for (var x = 0; x < lim; x++) {
        var ok = true; for (var d = pos; d < pos + n; d++) if (uso[d] + 1 > cap[d]) { ok = false; break; }
        if (!ok) break;
        for (var d2 = pos; d2 < pos + n; d2++) uso[d2]++;
        inicios.push(pos);
      }
    }
    return { total: inicios.length, inicios: inicios, exato: false };
  }

  /* ---------- 2. o cálculo ---------- */
  function calcular(E, U, P) {
    var hoje = E.hoje, cfgP = E.programa || {}, prazo = cfgP.prazo;
    var eventos = E.eventos || {}, turmasDb = E.turmas || {}, config = E.config || {}, interesse = E.interesse || {}, checkin = E.checkin || {};
    var users = E.users || {}, gerentes = E.gerentes || {}, diretores = E.diretores || {}, evPub = E.eventosPublico || {}, tPub = E.turmasPublico || {};
    var ativo = E.publicosAtivo === undefined ? false : E.publicosAtivo;
    var indisp = {}; Object.keys(E.calendario || {}).forEach(function (k) { if (ehData(k)) indisp[k] = (E.calendario[k] || {}).motivo || 'indisponível'; });
    var eventosPrograma = cfgP.eventos || {}, facil = cfgP.facilitadores || {};
    var pendencias = [];   /* configuração que falta (não é erro de dado) */
    var alertas = [];      /* qualidade e conflitos (não bloqueiam) */
    var inconsistencias = []; /* conferências que bloqueiam a apresentação dos números */
    if (!ehData(prazo)) pendencias.push('prazo');
    if (!Object.keys(eventosPrograma).some(function (k) { return eventosPrograma[k]; })) pendencias.push('eventos');
    var base = E.base && E.base.pessoas ? E.base.pessoas : null;
    if (!base || !Object.keys(base).length) pendencias.push('base');

    /* turmas do programa */
    var T = {};
    Object.keys(turmasDb).forEach(function (k) {
      var t = turmasDb[k] || {}; if (!eventosPrograma[t.eventoKey]) return;
      var ev = eventos[t.eventoKey] || {}, cfg = config[k] || {}, dias = ordenados(t.dias);
      if (!dias.length) { alertas.push({ tipo: 'turma-sem-datas', turma: t.label || k }); return; }
      var cargo = P.somarCargos(U.cargoDaTurma(t), U.cargoDoEvento(ev, ativo)), grupo = grupoDoCargo(cargo);  /* = cargoEfetivo de turmas-util.js */
      var pctMin = Number(ev.percentualMinimo); if (!(pctMin > 0)) pctMin = 75;  /* o mesmo padrão de aluno.js/admin.js */
      var ck = checkin[k] || {};
      var diasComRegistro = dias.filter(function (dd) { return ck[dd] && Object.keys(ck[dd]).length; });
      var x = {
        key: k, label: t.label || k, eventoKey: t.eventoKey, evento: ev.nome || '', dias: dias, ini: minutos(t.horarioInicio), fim: minutos(t.horarioFim),
        horario: t.horarioInicio && t.horarioFim ? t.horarioInicio + '–' + t.horarioFim : '', vagas: U.vagasEfetivas(t, ev) || 0, pctMin: pctMin,
        cargo: cargo, grupo: grupo, cancelada: U.turmaCancelada(cfg), encerrada: !!cfg.encerrada && !U.turmaCancelada(cfg),
        primeiro: dias[0], ultimo: dias[dias.length - 1], conclusao: cfg.dataConclusao || dias[dias.length - 1],
        diasSemRegistro: dias.filter(function (dd) { return diasComRegistro.indexOf(dd) === -1; }),
        ocupacao: 0, registrosForaDaBase: 0
      };
      x.terminaAtePrazo = ehData(prazo) && x.ultimo <= prazo;
      x.passadaAberta = !x.cancelada && !x.encerrada && x.ultimo < hoje;
      x.comecou = x.primeiro <= hoje;
      if (x.ini == null || x.fim == null || x.fim <= x.ini) { x.ini = null; x.fim = null; }
      var reg = interesse[k] || {};
      x.ocupacao = Object.keys(reg).filter(function (e) { return registroAtivo(reg[e]); }).length;
      x.inscritosAtivos = Object.keys(reg).filter(function (e) { return registroAtivo(reg[e]) && confirmada(reg[e]); }).length;
      x.qualidade = !x.encerrada ? null : !Object.keys(reg).some(function (e) { return confirmada(reg[e]); }) ? null
        : diasComRegistro.length === 0 ? 'sem-registro' : diasComRegistro.length < dias.length ? 'parcial' : 'completo';
      T[k] = x;
    });
    var listaT = Object.keys(T).map(function (k) { return T[k]; }).sort(function (a, b) { return a.primeiro < b.primeiro ? -1 : a.primeiro > b.primeiro ? 1 : (a.label < b.label ? -1 : 1); });
    listaT.forEach(function (t) {
      if (t.passadaAberta) alertas.push({ tipo: 'turma-passada-aberta', turma: t.label });
      if (t.cargo === 'conflito') alertas.push({ tipo: 'turma-publico-conflito', turma: t.label });
      if (!t.cancelada && !t.encerrada && !t.vagas) alertas.push({ tipo: 'turma-sem-vagas', turma: t.label });
      if (!t.cancelada && !t.encerrada && t.vagas && t.ocupacao > t.vagas) alertas.push({ tipo: 'turma-acima-da-lotacao', turma: t.label, vagas: t.vagas, ocupacao: t.ocupacao });
      if (t.qualidade === 'sem-registro') alertas.push({ tipo: 'turma-sem-checkin', turma: t.label });
      if (t.qualidade === 'parcial') alertas.push({ tipo: 'turma-checkin-parcial', turma: t.label, dias: t.diasSemRegistro.slice() });
    });

    /* perfil de público de uma pessoa, do jeito que foraDoPublicoAtual espera (Outros públicos: não consultado — premissa) */
    function perfil(k, t) {
      var g = gerentes[k], d = !!diretores[k];
      return { ativo: ativo, gerente: !!g, gerenteNivel: P.nivelGerente(g), diretor: d, diretorCadastro: d, categorias: {},
        naListaEvento: !!(evPub[t.eventoKey] || {})[k], naListaTurma: !!(tPub[t.key] || {})[k] };
    }
    function podeEntrar(p, t) {
      var k = p.k;
      if (t.cargo === 'conflito') return false;
      /* diretor e assessor (nível da base): só turma sem público de cargo — nunca a de técnicos ou de gestores */
      if ((p.grupo === 'diretores' || p.grupo === 'assessores') && t.grupo) return false;
      var f = U.foraDoPublicoAtual(turmasDb[t.key], eventos[t.eventoKey], perfil(k, t));
      if (f.estado === 'incompativel') return false;
      var c = U.conflitosDeParticipacao({ eventos: eventos, turmas: turmasDb, interesses: interesse, config: config }, t.eventoKey, k, t.key);
      return !c.participacao.length;
    }

    /* ---------- pessoas ---------- */
    var excluidosFacil = 0, pessoas = [];
    Object.keys(base || {}).forEach(function (k) {
      var b = base[k] || {};
      if (facil[k]) { excluidosFacil++; return; }
      pessoas.push({ k: k, email: b.email || '', diretoria: b.diretoria || '—', gerencia: b.gerencia || '—', grupo: publicoDoNivel(b.nivel) || (gerentes[k] ? 'gestores' : 'tecnicos'),
        cadastro: !!users[k], realizou: null, ausencias: [], naoVerificavel: [], incerto: [], inscricoes: [], interesses: [], realizouComRemocao: false });
    });
    var N = pessoas.length;
    pessoas.forEach(function (p) {
      listaT.forEach(function (t) {
        var r = (interesse[t.key] || {})[p.k]; if (!r || t.cancelada) return;
        if (t.encerrada) {
          if (!confirmada(r)) return;
          if (!registroAtivo(r)) {   /* removida: só vale para o histórico se saiu DEPOIS do primeiro encontro */
            var quando = String(r.removedDate || '').slice(0, 10);
            if (!ehData(quando)) { p.incerto.push(t.key); return; }
            if (quando < t.primeiro) return;
          }
          var ck = checkin[t.key] || {};
          var pres = t.dias.filter(function (dd) { return ck[dd] && ck[dd][p.k]; }).length, sem = t.diasSemRegistro.filter(function (dd) { return !(ck[dd] && ck[dd][p.k]); }).length;
          var minimo = Math.round(pres / t.dias.length * 1000) / 10, maximo = Math.round((pres + sem) / t.dias.length * 1000) / 10;
          if (minimo >= t.pctMin) { if (!p.realizou || t.conclusao < p.realizou.data) p.realizou = { turma: t.key, data: t.conclusao }; if (!registroAtivo(r)) p.realizouComRemocao = true; }
          else if (maximo < t.pctMin) p.ausencias.push({ turma: t.key, tipo: pres === 0 ? 'nao-compareceu' : 'frequencia-insuficiente' });
          else p.naoVerificavel.push(t.key);
          return;
        }
        if (!registroAtivo(r)) return;
        if (confirmada(r)) p.inscricoes.push(t.key); else p.interesses.push(t.key);
      });
      p.situacao = p.realizou ? 'realizou' : p.inscricoes.length ? 'inscrita' : p.interesses.length ? 'interessada' : p.cadastro ? 'sem-engajamento' : 'sem-cadastro';
    });
    var porSit = { realizou: 0, inscrita: 0, interessada: 0, 'sem-engajamento': 0, 'sem-cadastro': 0 };
    pessoas.forEach(function (p) { porSit[p.situacao]++; });
    var pend = pessoas.filter(function (p) { return p.situacao !== 'realizou'; });
    var porGrupo = {}; PUBLICOS.forEach(function (g) { var a = pessoas.filter(function (p) { return p.grupo === g; }); porGrupo[g] = { total: a.length, realizou: a.filter(function (p) { return p.situacao === 'realizou'; }).length }; porGrupo[g].pendentes = porGrupo[g].total - porGrupo[g].realizou; });

    /* ---------- capacidade planejada (turmas válidas até o prazo) ---------- */
    var validas = listaT.filter(function (t) { return !t.cancelada && !t.encerrada && !t.passadaAberta && t.terminaAtePrazo && t.cargo !== 'conflito'; });
    var livres = {}; validas.forEach(function (t) { livres[t.key] = !t.comecou && t.vagas ? Math.max(0, t.vagas - t.ocupacao) : 0; });
    var vagasPresas = 0;
    function alcancavel(p, t) {   /* inscrita numa turma em andamento: ainda dá para chegar ao mínimo? */
      if (!t.comecou) return true;
      var ck = checkin[t.key] || {};
      var possiveis = t.dias.filter(function (dd) { return dd >= hoje || (ck[dd] && ck[dd][p.k]) || t.diasSemRegistro.indexOf(dd) !== -1; }).length;
      return Math.round(possiveis / t.dias.length * 1000) / 10 >= t.pctMin;
    }
    pend.forEach(function (p) {
      var proprias = validas.filter(function (t) { var r = (interesse[t.key] || {})[p.k]; return registroAtivo(r) && (confirmada(r) ? alcancavel(p, t) : !t.comecou); });
      if (proprias.length) {
        p.vaga = proprias[0].key; p.vagaConfirmada = confirmada((interesse[p.vaga] || {})[p.k]);
        vagasPresas += proprias.length - 1;
      }
    });
    /* emparelhamento máximo (caminhos aumentantes) para quem ainda não tem vaga, nas vagas livres das turmas que ainda
       não começaram, só onde as regras de entrada deixam */
    var semVaga = pend.filter(function (p) { return !p.vaga; });
    var abertas = validas.filter(function (t) { return livres[t.key] > 0; });
    var alocadoEm = {}; abertas.forEach(function (t) { alocadoEm[t.key] = []; });
    var adj = semVaga.map(function (p) { return abertas.filter(function (t) { return podeEntrar(p, t); }); });
    var donoDe = {};
    function tentar(i, visit) {
      var cands = adj[i];
      for (var j = 0; j < cands.length; j++) {
        var t = cands[j]; if (visit[t.key]) continue; visit[t.key] = true;
        if (alocadoEm[t.key].length < livres[t.key]) { alocadoEm[t.key].push(i); donoDe[i] = t.key; return true; }
        for (var q = 0; q < alocadoEm[t.key].length; q++) {
          var outro = alocadoEm[t.key][q];
          if (tentar(outro, visit)) { alocadoEm[t.key][q] = i; donoDe[i] = t.key; return true; }
        }
      }
      return false;
    }
    semVaga.forEach(function (p, i) { tentar(i, {}); });
    semVaga.forEach(function (p, i) { if (donoDe[i]) p.alocavel = donoDe[i]; });

    var cap = {};
    PUBLICOS.forEach(function (g) {
      var pg = pend.filter(function (p) { return p.grupo === g; });
      var comInscricao = pg.filter(function (p) { return p.vaga && p.vagaConfirmada; }).length;
      var comVaga = pg.filter(function (p) { return p.vaga; }).length;
      var alocaveis = pg.filter(function (p) { return !p.vaga && p.alocavel; }).length;
      var vl = validas.filter(function (t) { return t.grupo === g || t.grupo === null; });   /* diretores e assessores: só turmas sem público de cargo */
      cap[g] = { pendentes: pg.length, comInscricao: comInscricao, comVaga: comVaga, alocaveis: alocaveis, maximo: comVaga + alocaveis,
        deficitVagas: pg.length - comVaga - alocaveis, turmasPlanejadas: vl.length,
        vagasNominais: vl.reduce(function (s, t) { return s + t.vagas; }, 0), vagasLivres: vl.reduce(function (s, t) { return s + livres[t.key]; }, 0) };
    });
    var somaCap = function (campo) { return PUBLICOS.reduce(function (s, g) { return s + (cap[g][campo] || 0); }, 0); };
    var potencial = somaCap('comInscricao'), comVaga = somaCap('comVaga'), maxPlanejado = somaCap('maximo');
    var deficitVagas = somaCap('deficitVagas');
    var vagasLivresTotal = validas.reduce(function (s, t) { return s + livres[t.key]; }, 0);

    /* ---------- formato de turma nova e calendário ---------- */
    var lim = cfgP.limiteParalelo || {};
    var formatos = {};
    GRUPOS.forEach(function (g) {
      var f = (cfgP.formatos || {})[g];
      if (f && f.encontros > 0 && minutos(f.horarioInicio) != null && minutos(f.horarioFim) > minutos(f.horarioInicio) && f.vagas > 0) {
        formatos[g] = { encontros: Math.floor(f.encontros), ini: minutos(f.horarioInicio), fim: minutos(f.horarioFim), horario: f.horarioInicio + '–' + f.horarioFim, vagas: Math.floor(f.vagas), origem: 'configurado' };
        return;
      }
      var ref = listaT.filter(function (t) { return t.grupo === g && !t.cancelada && t.ini != null && t.vagas; }).sort(function (a, b) { return a.primeiro < b.primeiro ? 1 : -1; })[0];
      var vs = listaT.filter(function (t) { return t.grupo === g && !t.cancelada && t.vagas; }).map(function (t) { return t.vagas; });
      formatos[g] = ref ? { encontros: ref.dias.length, ini: ref.ini, fim: ref.fim, horario: ref.horario, vagas: mediana(vs), origem: 'derivado', ref: ref.label } : null;
    });
    var antecedencia = Math.max(0, Math.floor(Number(cfgP.antecedenciaDiasUteis) || 0));
    var primeiraData = hoje; for (var a = 0; a < antecedencia; a++) primeiraData = proximoUtil(primeiraData, indisp);
    if (antecedencia === 0) primeiraData = proximoUtil(hoje, indisp);
    var uteis = ehData(prazo) ? diasUteis(primeiraData, prazo, indisp) : [];
    /* compromissos: encontros das turmas não canceladas e não encerradas (as que terminam depois do prazo também ocupam) */
    var compromissos = [];
    listaT.forEach(function (t) {
      if (t.cancelada || t.encerrada) return;
      if (t.ini == null) alertas.push({ tipo: 'turma-sem-horario', turma: t.label });
      t.dias.forEach(function (dd) {
        if (!diaUtil(dd, indisp)) alertas.push({ tipo: 'encontro-em-dia-indisponivel', turma: t.label, dia: dd });
        compromissos.push({ dia: dd, ini: t.ini == null ? 0 : t.ini, fim: t.fim == null ? 1440 : t.fim, grupo: t.grupo, turma: t.label });
      });
    });
    function conta(g, dia, ini, fim) { return compromissos.filter(function (c) { return c.dia === dia && (c.grupo === g || c.grupo === null) && c.ini < fim && ini < c.fim; }).length; }
    GRUPOS.forEach(function (g) {
      var l = lim[g]; if (!(l > 0)) return; var vistos = {};
      compromissos.forEach(function (c) { if (c.grupo !== g && c.grupo !== null) return; var n = conta(g, c.dia, c.ini, c.fim); if (n > l && !vistos[c.dia]) { vistos[c.dia] = 1; alertas.push({ tipo: 'paralelismo-excedido', grupo: g, dia: c.dia, simultaneas: n, limite: l }); } });
    });
    var encaixe = {};
    GRUPOS.forEach(function (g) {
      var f = formatos[g], l = Math.floor(Number(lim[g]));
      if (!f || !(l > 0) || !uteis.length) { encaixe[g] = { cabem: f && l > 0 ? 0 : null, exato: true, novas: [], motivo: !f ? 'sem-formato' : !(l > 0) ? 'sem-limite' : 'sem-dias' }; return; }
      var capDia = uteis.map(function (dd) { return Math.max(0, l - conta(g, dd, f.ini, f.fim)); });
      var r = maximoDeJanelas(capDia, f.encontros, l);
      encaixe[g] = { cabem: r.total, exato: r.exato, novas: r.inicios.map(function (i) { return uteis.slice(i, i + f.encontros); }) };
    });
    /* MARGEM (dentro do público): quantas pessoas do público podem não realizar sem comprometer a meta. Meta = público −
       margem. Ela reduz o déficit que as turmas extras precisam cobrir — primeiro no público com o maior déficit (premissa
       dita na tela de Capacidade). */
    var margem = Math.min(N, Math.max(0, Math.floor(Number(cfgP.margem) || 0))), meta = N - margem, sobraMargem = margem;
    PUBLICOS.slice().sort(function (a, b) { return cap[b].deficitVagas - cap[a].deficitVagas; }).forEach(function (g) {
      var usa = Math.min(sobraMargem, cap[g].deficitVagas); cap[g].margemUsada = usa; cap[g].deficitMeta = cap[g].deficitVagas - usa; sobraMargem -= usa;
    });
    GRUPOS.forEach(function (g) {
      var c = cap[g], f = formatos[g], e = encaixe[g];
      c.necessarias = c.deficitMeta > 0 ? (f && f.vagas ? Math.ceil(c.deficitMeta / f.vagas) : null) : 0;
      c.cabem = e.cabem; c.cabemExato = e.exato;
      c.abrir = c.necessarias === 0 ? 0 : c.necessarias == null || e.cabem == null ? null : Math.min(c.necessarias, e.cabem);
      c.deficitCalendario = c.necessarias == null || c.abrir == null ? null : c.necessarias - c.abrir;
      c.expansao = c.maximo + (c.abrir ? Math.min(c.deficitVagas, c.abrir * f.vagas) : 0);
      c.turmasAbrir = c.abrir ? e.novas.slice(0, c.abrir) : [];
    });
    /* diretores e assessores: sem formato de turma própria — o que faltar fica como "sem turma prevista", nunca vira turma de técnicos */
    ['diretores', 'assessores'].forEach(function (g) {
      var c = cap[g]; c.necessarias = 0; c.cabem = null; c.cabemExato = true; c.abrir = 0; c.deficitCalendario = 0; c.expansao = c.maximo; c.turmasAbrir = []; c.semTurmaPrevista = c.deficitMeta;
    });
    var maxExpansao = somaCap('expansao');
    /* CENÁRIO REALISTA (opcional): ocupação esperada p% — de quem tem lugar nas turmas planejadas, só p% realiza (a mesma
       proporção das turmas já feitas, realizados ÷ vagas). Turma extra rende p% das vagas do formato. Não muda nenhum outro
       número: é um segundo cenário ao lado do máximo (todas lotam e todos comparecem). */
    var ocup = Math.floor(Number(cfgP.ocupacaoEsperada) || 0), realista = null;
    if (ocup >= 1 && ocup <= 100) {
      var pr = ocup / 100; realista = { ocupacao: ocup, esperado: 0, falta: 0, porGrupo: {} };
      PUBLICOS.forEach(function (g) {
        var c = cap[g], f = formatos[g], esperado = Math.round(c.maximo * pr), falta = Math.max(0, c.pendentes - (c.margemUsada || 0) - esperado);
        var porTurma = GRUPOS.indexOf(g) !== -1 && f && f.vagas ? Math.max(1, Math.round(f.vagas * pr)) : null;
        var turmas = falta === 0 ? 0 : porTurma ? Math.ceil(falta / porTurma) : null;
        realista.porGrupo[g] = { esperado: esperado, falta: falta, porTurmaNova: porTurma, turmasExtras: turmas, cabem: GRUPOS.indexOf(g) !== -1 ? c.cabem : null };
        realista.esperado += esperado; realista.falta += falta;
      });
      realista.pctEsperado = pct1(porSit.realizou + realista.esperado, N);
      realista.turmasExtras = GRUPOS.some(function (g) { return realista.porGrupo[g].turmasExtras == null; }) ? null : GRUPOS.reduce(function (s, g) { return s + realista.porGrupo[g].turmasExtras; }, 0);
    }
    var real = porSit.realizou;

    /* ---------- diagnóstico ---------- */
    var indeterminado = GRUPOS.some(function (g) { return cap[g].deficitMeta > 0 && (cap[g].necessarias == null || cap[g].abrir == null); });
    /* COMPOSIÇÃO DO TOTAL (conferência): total de pessoas = situação não ativa + cargo não compatível + público da base.
       Só confere quando o total está configurado; não muda nenhum outro número. */
    var comp = cfgP.composicao || {}, composicao = null;
    if (comp.total > 0) {
      var ina = Math.max(0, Math.floor(Number(comp.situacaoInativa) || 0)), car = Math.max(0, Math.floor(Number(comp.cargoIncompativel) || 0));
      var somaComp = ina + car + N;
      composicao = { total: Math.floor(comp.total), situacaoInativa: ina, cargoIncompativel: car, publico: N, soma: somaComp, fecha: somaComp === Math.floor(comp.total), diferenca: Math.floor(comp.total) - somaComp };
      if (!composicao.fecha) alertas.push({ tipo: 'composicao-nao-fecha', total: composicao.total, soma: somaComp, diferenca: composicao.diferenca });
    }
    var fatores = {
      capacidade: real + maxPlanejado < meta,
      mobilizacao: vagasLivresTotal > 0 && pend.some(function (p) { return !p.vaga; }),
      calendario: GRUPOS.some(function (g) { return cap[g].deficitCalendario > 0; })
    };
    var principal = fatores.calendario ? 'calendario' : fatores.capacidade ? 'capacidade' : fatores.mobilizacao ? 'mobilizacao' : null;
    var nFat = ['capacidade', 'mobilizacao', 'calendario'].filter(function (k) { return fatores[k]; }).length;

    /* ---------- diretorias e gerências (gerência com menos de 5 pessoas fica agrupada) ---------- */
    var CONTAS = ['total', 'realizou', 'inscrita', 'interessada', 'sem-engajamento', 'sem-cadastro', 'inscritosValidos', 'interessadosValidos'];
    var novoCont = function (nome) { var o = { nome: nome }; CONTAS.forEach(function (c) { o[c] = 0; }); return o; };
    var conta = function (o, p) {
      o.total++; o[p.situacao]++;
      /* inscrição ou interesse com vaga numa turma que ainda dá para realizar até o prazo (a mesma vaga da capacidade do programa):
         nos dois casos a pessoa ainda precisa comparecer */
      if (p.situacao !== 'realizou' && p.vaga) { if (p.vagaConfirmada) o.inscritosValidos++; else o.interessadosValidos++; }
    };
    var fecha = function (o) {
      o.pendentes = o.total - o.realizou; o.cobertura = pct1(o.realizou, o.total); o.semMobilizacao = o['sem-engajamento'] + o['sem-cadastro'];
      /* PROJEÇÃO: realizados + inscritos e interessados com vaga até o prazo, se comparecerem; GAP = quem fica sem isso */
      o.projetados = o.realizou + o.inscritosValidos + o.interessadosValidos; o.coberturaProjetada = pct1(o.projetados, o.total); o.gap = o.total - o.projetados;
      return o;
    };
    var dirs = {};
    pessoas.forEach(function (p) {
      var o = dirs[p.diretoria] = dirs[p.diretoria] || Object.assign(novoCont(p.diretoria), { ger: {} });
      conta(o, p); conta(o.ger[p.gerencia] = o.ger[p.gerencia] || novoCont(p.gerencia), p);
    });
    var diretorias = Object.keys(dirs).map(function (k) {
      var o = fecha(dirs[k]);
      var gs = Object.keys(o.ger).map(function (x) { return o.ger[x]; }), grandes = gs.filter(function (x) { return x.total >= 5; }), peq = gs.filter(function (x) { return x.total < 5; });
      o.gerencias = grandes.sort(function (a, b) { return a.nome < b.nome ? -1 : 1; }).map(fecha);
      if (peq.length) { var outras = novoCont('Outras (gerências com menos de 5 pessoas)'); peq.forEach(function (x) { CONTAS.forEach(function (c) { outras[c] += x[c]; }); }); outras.agrupada = true; o.gerencias.push(fecha(outras)); }
      delete o.ger; return o;
    }).sort(function (a, b) { return a.cobertura - b.cobertura || b.pendentes - a.pendentes || (a.nome < b.nome ? -1 : 1); });

    /* ---------- ausências e qualidade ---------- */
    var aus = { ocorrencias: 0, naoCompareceu: 0, frequenciaInsuficiente: 0, pessoas: 0, recuperadas: 0, pendentes: 0, pendentesComNovaInscricao: 0 };
    pessoas.forEach(function (p) {
      if (!p.ausencias.length) return;
      aus.pessoas++; aus.ocorrencias += p.ausencias.length;
      p.ausencias.forEach(function (x) { if (x.tipo === 'nao-compareceu') aus.naoCompareceu++; else aus.frequenciaInsuficiente++; });
      if (p.situacao === 'realizou') aus.recuperadas++; else { aus.pendentes++; if (p.inscricoes.length) aus.pendentesComNovaInscricao++; }
    });
    var ausPorTurma = listaT.filter(function (t) { return t.encerrada; }).map(function (t) {
      var n = pessoas.filter(function (p) { return p.ausencias.some(function (x) { return x.turma === t.key; }); }).length;
      return { turma: t.label, ausencias: n, qualidade: t.qualidade };
    }).filter(function (x) { return x.ausencias || x.qualidade === 'sem-registro' || x.qualidade === 'parcial'; });
    var naoVerif = pend.filter(function (p) { return p.naoVerificavel.length; }).length;
    var qualidade = {
      naoVerificaveisPendentes: naoVerif, historicoIncerto: pessoas.filter(function (p) { return p.incerto.length; }).length,
      realizacoesComInscricaoRemovida: pessoas.filter(function (p) { return p.realizouComRemocao; }).length,
      turmasSemRegistro: listaT.filter(function (t) { return t.qualidade === 'sem-registro'; }).map(function (t) { return t.label; }),
      turmasParciais: listaT.filter(function (t) { return t.qualidade === 'parcial'; }).map(function (t) { return t.label; }),
      turmasPassadasAbertas: listaT.filter(function (t) { return t.passadaAberta; }).map(function (t) { return t.label; }),
      alertaExecutivo: N > 0 && naoVerif / N * 100 >= 1
    };

    /* ---------- evolução (realizado acumulado pela data de conclusão) ---------- */
    var marcos = {}; pessoas.forEach(function (p) { if (p.realizou) marcos[p.realizou.data] = (marcos[p.realizou.data] || 0) + 1; });
    var acum = 0, evolucao = Object.keys(marcos).sort().map(function (d) { acum += marcos[d]; return { data: d, acumulado: acum }; });

    /* ---------- conferências (se falhar, a tela não mostra números) ---------- */
    var soma = Object.keys(porSit).reduce(function (s, k) { return s + porSit[k]; }, 0);
    if (soma !== N) inconsistencias.push('soma-das-situacoes');
    if (PUBLICOS.reduce(function (s, g) { return s + porGrupo[g].total; }, 0) !== N) inconsistencias.push('soma-dos-publicos');
    if (real + maxPlanejado > N || real + maxExpansao > N || real + potencial > N) inconsistencias.push('projecao-acima-do-publico');
    if (potencial > maxPlanejado || maxPlanejado > maxExpansao) inconsistencias.push('ordem-das-projecoes');
    if (diretorias.reduce(function (s, d) { return s + d.total; }, 0) !== N) inconsistencias.push('soma-das-diretorias');

    /* ---------- decisões (no máximo três, nesta prioridade) ---------- */
    var R = function (v) { return (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); };
    var nomeG = { tecnicos: 'técnicos', gestores: 'gestores' }, dec = [];
    var abrirTot = GRUPOS.reduce(function (s, g) { return s + (cap[g].abrir || 0); }, 0), necTot = GRUPOS.reduce(function (s, g) { return s + (cap[g].necessarias || 0); }, 0);
    if (abrirTot > 0) dec.push({ tipo: 'abrir-turmas', tag: 'CAPACIDADE', titulo: 'Abrir ' + GRUPOS.filter(function (g) { return cap[g].abrir; }).map(function (g) { return cap[g].abrir + ' turma' + (cap[g].abrir > 1 ? 's' : '') + ' de ' + nomeG[g]; }).join(' e ') + ' até o prazo',
      texto: 'São as que cabem no calendário, respeitando o limite de turmas simultâneas. Elas levam o máximo possível de ' + R(pct1(real + maxPlanejado, N)) + '% para ' + R(pct1(real + maxExpansao, N)) + '%. É um cenário, não capacidade autorizada.' });
    if (fatores.calendario) dec.push({ tipo: 'prazo', tag: 'PRAZO', titulo: 'Decidir sobre o prazo ou o formato das turmas',
      texto: 'Seriam necessárias ' + necTot + ' turmas extras e só ' + abrirTot + ' cabem até o prazo. Mesmo abrindo todas, faltariam ' + Math.max(0, meta - real - maxExpansao) + ' pessoas para a meta' + (margem ? ' (já descontada a margem de ' + margem + ')' : '') + '.' });
    var semPrev = ['diretores', 'assessores'].filter(function (g) { return cap[g].semTurmaPrevista > 0; });
    if (semPrev.length) dec.push({ tipo: 'turma-outros-publicos', tag: 'CAPACIDADE', titulo: 'Prever turma para ' + semPrev.map(function (g) { return cap[g].semTurmaPrevista + ' ' + g; }).join(' e '),
      texto: 'Não há vaga em turma aberta a esse público até o prazo' + (margem ? ', já descontada a margem' : '') + '. Turmas de técnicos e de gestores não os recebem.' });
    if (qualidade.alertaExecutivo) dec.push({ tipo: 'conferir-presenca', tag: 'QUALIDADE DO REGISTRO', titulo: 'Conferir a presença das turmas sem check-in completo',
      texto: naoVerif + ' pessoas (' + R(naoVerif / N * 100) + '% do público) têm a realização não verificável: ' + qualidade.turmasSemRegistro.concat(qualidade.turmasParciais).join(', ') + '.' });
    if (qualidade.turmasPassadasAbertas.length) dec.push({ tipo: 'encerrar-turmas', tag: 'QUALIDADE DO REGISTRO', titulo: 'Encerrar as turmas que já aconteceram',
      texto: qualidade.turmasPassadasAbertas.join(', ') + ' já passaram e não foram encerradas: quem fez não aparece como realizado.' });
    var mob = porSit['sem-cadastro'] + porSit['sem-engajamento'];
    if (mob > 0) {
      var top = diretorias.slice().sort(function (a, b) { return b.semMobilizacao - a.semMobilizacao || (a.nome < b.nome ? -1 : 1); }).slice(0, 2).filter(function (d) { return d.semMobilizacao > 0; });
      var topN = top.reduce(function (s, d) { return s + d.semMobilizacao; }, 0);
      dec.push({ tipo: 'mobilizar', tag: 'MOBILIZAÇÃO', titulo: 'Mobilizar quem não se cadastrou ou nunca se engajou',
        texto: mob + ' pessoas (' + porSit['sem-cadastro'] + ' sem cadastro e ' + porSit['sem-engajamento'] + ' sem interesse nem inscrição)' + (top.length ? '; ' + topN + ' delas (' + R(topN / mob * 100) + '%) em ' + top.map(function (d) { return d.nome; }).join(' e ') + '.' : '.') });
    }
    if (porSit.interessada > 0 && vagasLivresTotal > 0) dec.push({ tipo: 'converter', tag: 'CONVERSÃO', titulo: 'Confirmar a inscrição de ' + porSit.interessada + ' interessados',
      texto: 'Há ' + vagasLivresTotal + ' vagas livres até o prazo; interesse só conta quando a inscrição é confirmada.' });
    if (aus.pendentes - aus.pendentesComNovaInscricao > 0 && vagasLivresTotal > 0) dec.push({ tipo: 'reconvocar', tag: 'AUSÊNCIAS', titulo: 'Reconvocar quem faltou',
      texto: (aus.pendentes - aus.pendentesComNovaInscricao) + ' pessoas faltaram e ainda não têm nova inscrição.' });
    if (vagasPresas > 0) dec.push({ tipo: 'duplicadas', tag: 'VAGAS', titulo: 'Liberar vagas presas por inscrição duplicada', texto: vagasPresas + ' vagas estão ocupadas por pessoas que já têm outra vaga até o prazo.' });

    /* ---------- lista por pessoa (para a exportação; quem pode ver nomes é decisão da tela) ---------- */
    var rotT = {}; listaT.forEach(function (t) { rotT[t.key] = t.label; });
    var nomesT = function (ks) { return ks.map(function (x) { return rotT[x] || x; }).join('; '); };
    var lista = pessoas.map(function (p) {
      return { nome: (base[p.k] || {}).nome || '', email: p.email, diretoria: p.diretoria, gerencia: p.gerencia, publico: p.grupo, situacao: p.situacao, cadastro: p.cadastro,
        realizouEm: p.realizou ? (rotT[p.realizou.turma] || p.realizou.turma) : '', realizouData: p.realizou ? p.realizou.data || '' : '',
        inscricoes: nomesT(p.inscricoes), interesses: nomesT(p.interesses),
        vagaAtePrazo: p.vaga ? (rotT[p.vaga] || p.vaga) + (p.vagaConfirmada ? ' (inscrição)' : ' (interesse)') : '',
        cabeEmVagaLivre: !p.vaga && p.alocavel ? (rotT[p.alocavel] || p.alocavel) : '',
        ausencias: p.ausencias.map(function (a) { return (rotT[a.turma] || a.turma) + (a.tipo === 'nao-compareceu' ? ' (não compareceu)' : ' (frequência insuficiente)'); }).join('; '),
        faltouPendente: p.ausencias.length > 0 && p.situacao !== 'realizou' };
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR') || (a.email < b.email ? -1 : 1); });

    return {
      realista: realista,
      lista: lista,
      hoje: hoje, prazo: prazo, N: N, margem: margem, meta: meta, faltamParaMeta: Math.max(0, meta - porSit.realizou), metaAtingida: porSit.realizou >= meta && N > 0,
      pctMeta: N ? Math.round(meta / N * 1000) / 10 : 0, composicao: composicao, excluidosFacilitadores: excluidosFacil, pendencias: pendencias, alertas: alertas, inconsistencias: inconsistencias,
      porSit: porSit, porGrupo: porGrupo, realizou: real, pendentes: pend.length,
      pct: { realizado: pct1(real, N), potencial: pct1(real + potencial, N), comVaga: pct1(real + comVaga, N), maxPlanejado: pct1(real + maxPlanejado, N), maxExpansao: pct1(real + maxExpansao, N) },
      potencial: potencial, comVaga: comVaga, gapProjetado: N - porSit.realizou - comVaga, maxPlanejado: maxPlanejado, maxExpansao: maxExpansao, deficitVagas: deficitVagas, vagasLivres: vagasLivresTotal, vagasPresas: vagasPresas,
      cap: cap, formatos: formatos, encaixe: encaixe, uteis: uteis, primeiraData: primeiraData, indisponiveis: indisp, limites: { tecnicos: lim.tecnicos, gestores: lim.gestores }, antecedencia: antecedencia,
      fatores: fatores, principal: principal, combinado: nFat >= 2, indeterminado: indeterminado,
      diretorias: diretorias, ausencias: aus, ausenciasPorTurma: ausPorTurma, qualidade: qualidade, evolucao: evolucao, decisoes: dec.slice(0, 3),
      turmas: listaT.map(function (t) { return { key: t.key, label: t.label, evento: t.evento, grupo: t.grupo, dias: t.dias, horario: t.horario, vagas: t.vagas, ocupacao: t.ocupacao, inscritos: t.inscritosAtivos,
        livres: livres[t.key] || 0, valida: validas.indexOf(t) !== -1, cancelada: t.cancelada, encerrada: t.encerrada, passadaAberta: t.passadaAberta, terminaAtePrazo: t.terminaAtePrazo, comecou: t.comecou, qualidade: t.qualidade }; })
    };
  }

  /* ---------- 3. prévia da importação da base oficial (só lê; nada é corrigido nem excluído) ---------- */
  /* linhas = [{ nome, email, gerencia, diretoria }] (já lidas da planilha); ctx = { users, gerentes, outrosPublicos (ou null =
     não consultado), facilitadores: { eKey: email }, vigente: { pessoas } | null } */
  function previaBase(linhas, ctx) {
    ctx = ctx || {};
    var out = { total: linhas.length, validas: 0, pessoas: {}, problemas: { semEmail: [], emailInvalido: [], emailRepetido: [], foraDoDominio: [], nomeRepetido: [], semDiretoria: [], semGerencia: [] },
      cadastrados: 0, semCadastro: 0, gestores: 0, tecnicos: 0, porPublico: { tecnicos: 0, gestores: 0, diretores: 0, assessores: 0 }, comNivel: 0, nivelDesconhecido: [], gerenteForaDaLista: [], naListaNaoGerente: [], outrosPublicos: [], facilitadoresNaBase: [], diretorias: {}, gerencias: {}, diferenca: null };
    var vistos = {}, nomes = {};
    linhas.forEach(function (l, i) {
      var linha = i + 2, email = String(l.email || '').trim().toLowerCase(), nome = String(l.nome || '').trim(), ger = String(l.gerencia || '').trim().toUpperCase(), dir = String(l.diretoria || '').trim().toUpperCase();
      if (!email) { out.problemas.semEmail.push(linha); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { out.problemas.emailInvalido.push({ linha: linha, email: email }); return; }
      var k = emailKey(email);
      if (vistos[k]) { out.problemas.emailRepetido.push({ linha: linha, email: email, primeira: vistos[k] }); return; }
      vistos[k] = linha;
      if (!/@previ\.com\.br$/.test(email)) out.problemas.foraDoDominio.push({ linha: linha, email: email });
      if (!dir) out.problemas.semDiretoria.push(linha);
      if (!ger) out.problemas.semGerencia.push(linha);
      var nn = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ');
      if (nn) (nomes[nn] = nomes[nn] || []).push(linha);
      var nivelBruto = String(l.nivel || '').trim(), pub = publicoDoNivel(nivelBruto);
      if (nivelBruto && !pub) out.problemas.nivelDesconhecido = (out.problemas.nivelDesconhecido || []).concat([{ linha: linha, nivel: nivelBruto }]);
      out.pessoas[k] = { email: email, nome: nome, gerencia: ger, diretoria: dir };
      if (pub) { out.pessoas[k].nivel = { tecnicos: 'tecnico', gestores: 'gestor', diretores: 'diretor', assessores: 'assessor' }[pub]; out.comNivel++; }
      var publico = pub || ((ctx.gerentes || {})[k] ? 'gestores' : 'tecnicos'); out.porPublico[publico]++;
      if (pub === 'gestores' && !(ctx.gerentes || {})[k]) out.gerenteForaDaLista.push(email);
      if (pub && pub !== 'gestores' && (ctx.gerentes || {})[k]) out.naListaNaoGerente.push(email + ' (' + nivelBruto + ')');
      out.validas++;
      if ((ctx.users || {})[k]) out.cadastrados++; else out.semCadastro++;
      if (publico === 'gestores') out.gestores++; else if (publico === 'tecnicos') out.tecnicos++;
      if (ctx.outrosPublicos && ctx.outrosPublicos[k]) out.outrosPublicos.push(email);
      if ((ctx.facilitadores || {})[k]) out.facilitadoresNaBase.push(email);
      out.diretorias[dir || '—'] = (out.diretorias[dir || '—'] || 0) + 1;
      out.gerencias[ger || '—'] = (out.gerencias[ger || '—'] || 0) + 1;
    });
    Object.keys(nomes).forEach(function (n) { if (nomes[n].length > 1) out.problemas.nomeRepetido.push({ nome: n, linhas: nomes[n] }); });
    if (ctx.vigente && ctx.vigente.pessoas) {
      var antes = ctx.vigente.pessoas, d = { entram: [], saem: [], mudam: [] };
      Object.keys(out.pessoas).forEach(function (k) { var a = antes[k], b = out.pessoas[k]; if (!a) d.entram.push(b.email); else if (a.diretoria !== b.diretoria || a.gerencia !== b.gerencia || a.nome !== b.nome || (a.nivel || '') !== (b.nivel || '')) d.mudam.push(b.email); });
      Object.keys(antes).forEach(function (k) { if (!out.pessoas[k]) d.saem.push(antes[k].email); });
      out.diferenca = d;
    }
    out.publicoEfetivo = out.validas - out.facilitadoresNaBase.length;
    return out;
  }

  var api = { PUBLICOS: PUBLICOS, publicoDoNivel: publicoDoNivel, calcular: calcular, previaBase: previaBase, maximoDeJanelas: maximoDeJanelas, gulosoJanelas: gulosoJanelas, diasUteis: diasUteis, emailKey: emailKey, grupoDoCargo: grupoDoCargo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faProgramaCobertura = api;
})(typeof window !== 'undefined' ? window : null);
