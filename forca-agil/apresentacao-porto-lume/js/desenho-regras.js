/* AS REGRAS DA AVENTURA. PROVISÓRIAS: servem para experimentar, não foram aprovadas como definitivas.
   Puras: sem tela, sem áudio, sem relógio. A oficina, o ensaio, a comparação, os documentos e os testes usam este mesmo arquivo. */
(function (raiz) {
  var ESTRATEGIAS = {
    farol: { nome: 'O Farol', cor: '#f5c518', fragil: 'estacoes', missao: 'Leve suprimentos às regiões distantes.', estado: 'Núcleo reforçado. Regiões distantes sem energia.', dados: { alcanca: '4 de 10 regiões, com o núcleo blindado', preocupa: '6 regiões seguem no escuro', pede: 'Engenheira-chefe: “Sem núcleo, não sobra nada.”' } },
    rede: { nome: 'A Rede', cor: '#5aa0ee', fragil: 'nucleo', missao: 'Organize a manutenção dos postos locais.', estado: 'Muitos postos ligados. Fila de manutenção.', dados: { alcanca: '7 de 10 regiões, com postos locais', preocupa: '212 postos e poucos técnicos', pede: 'Prefeitos: “Deixem cada vizinhança cuidar de si.”' } },
    onda: { nome: 'A Onda', cor: '#18c2ba', fragil: 'abrigo', missao: 'Estabilize as instalações que estão oscilando.', estado: 'Quase todos com luz. Instalações oscilando.', dados: { alcanca: '9 de 10 regiões, em poucas horas', preocupa: '1 em cada 3 instalações oscila', pede: 'Moradores: “Qualquer luz, agora.”' } }
  };
  var ORDENS = {
    consulta: { nome: 'Consulta', ganho: 'A mesa decide depois da notícia e pode corrigir um lote. Nada sai sem revisão.', custo: 'Tudo espera resposta: uma ala do hospital se perde no atraso e, sem sinal, a ficha dourada apaga.' },
    lista: { nome: 'Lista', ganho: 'Entrega no prazo, com a regra que a mesa escreveu antes. A ficha dourada não sai do lugar.', custo: 'A regra foi escrita sem conhecer a notícia. A dourada não se move depois de colocada, e o que cair cai sem plano.' },
    intencao: { nome: 'Intenção', ganho: 'Reage sem esperar, dentro do limite que a mesa definiu. Sem sinal, cobre o lugar descoberto.', custo: 'Faz escolhas que ninguém revisou: tira um lote de onde quiser e, sem sinal, abandona o lugar que a dourada protegia.' }
  };
  var LUGARES = { abrigo: 'Abrigo', nucleo: 'Núcleo', estacoes: 'Estações' };
  var L = ['abrigo', 'nucleo', 'estacoes'];
  /* PORTO LUME (experimental): 5 lotes de 20 caixas. Cada lote compra uma coisa concreta. */
  var LOTES = 5, ALAS = 15, FAMILIAS = 500, POR_LOTE = 100, LUGARES_LOTE = { hospital: 'HOSPITAL', abrigo: 'ABRIGO', estacoes: 'ESTAÇÕES' };
  var HOSPITAL_TXT = { criticas: 'Alas críticas funcionando; outras regiões cobram', emergencia: 'Só a emergência aberta; gente no corredor', transborda: 'Transbordou: pacientes levados ao Abrigo' };
  var HOSPITAL_COR = { criticas: '#4fe0f5', emergencia: '#ffa63d', transborda: '#ff6b5e' };
  var PRESSAO_TXT = { sem_estoque: 'SEM ESTOQUE', superlotado: 'SUPERLOTADO', desligadas: 'DESLIGADAS' };
  /* Linha da ordem no formulário: Lista escolhe de onde sai o lote se surgir novo pedido; Intenção escolhe de onde nunca pode sair. */
  var CLAUSULAS = { lista: { hospital: 'Se surgir pedido, tire do hospital', estacoes: 'Se surgir pedido, tire das estações', nao: 'Não mexer' }, intencao: { hospital: 'Nunca tire do hospital', estacoes: 'Nunca tire das estações' } };
  var CORRECOES = { nao: 'Não mexer', hospital_abrigo: 'Hospital → Abrigo', hospital_estacoes: 'Hospital → Estações', abrigo_hospital: 'Abrigo → Hospital', abrigo_estacoes: 'Abrigo → Estações', estacoes_hospital: 'Estações → Hospital', estacoes_abrigo: 'Estações → Abrigo' };

  function ordemFinal(u) { return u.ordem2 || u.ordem1 || null; }
  function temLotes(u) { return u.lotesH !== null && u.lotesH !== undefined && u.lotesA !== null && u.lotesA !== undefined; }
  function lotesBase(u) { return temLotes(u) ? { hospital: u.lotesH, abrigo: u.lotesA, estacoes: LOTES - u.lotesH - u.lotesA } : null; }
  /* De onde o K-99 tira o lote quando chegam as 200 famílias. Retorna {de, para} ou null. */
  function movimento(u) {
    var b = lotesBase(u), o = ordemFinal(u); if (!b || !o) return null;
    if (o === 'consulta') { if (!u.corrige || u.corrige === 'nao') return null; var p = u.corrige.split('_'); return b[p[0]] > 0 ? { de: p[0], para: p[1] } : null; }
    if (o === 'lista') { var c = u.clausula; return (c === 'hospital' || c === 'estacoes') && b[c] > 0 ? { de: c, para: 'abrigo' } : null; }
    var fontes = ['estacoes', 'hospital'].filter(function (x) { return x !== u.clausula && b[x] > 0; });
    return fontes.length ? { de: fontes[0], para: 'abrigo' } : null;
  }
  function lotesFinais(u) { var b = lotesBase(u); if (!b) return null; var m = movimento(u); if (m) { b[m.de]--; b[m.para]++; } return b; }
  /* Alas que abrem de fato: em Consulta, o atraso custa uma */
  function alas(u) { var l = lotesFinais(u); return l ? Math.max(0, l.hospital - (ordemFinal(u) === 'consulta' ? 1 : 0)) : null; }
  function hospital(u) { var a = alas(u); return a === null ? null : a >= 4 ? 'criticas' : a >= 2 ? 'emergencia' : 'transborda'; }
  /* O que ficou sem atendimento e pesa na tempestade */
  function pressoes(u) { var l = lotesFinais(u), o = {}; if (!l) return o; if (hospital(u) === 'transborda') o.abrigo = 'superlotado'; else if (l.abrigo === 0) o.abrigo = 'sem_estoque'; if (l.estacoes === 0) o.estacoes = 'desligadas'; return o; }
  function dividas(u) { return Object.keys(pressoes(u)); }
  /* O que se vê no planeta: pessoas e instalações, não pontuação */
  function painelLotes(u) { var l = lotesFinais(u); if (!l) return []; return ['ALAS ABERTAS: ' + alas(u) + ' DE ' + ALAS, 'FAMÍLIAS ACOLHIDAS: ' + (l.abrigo * POR_LOTE) + ' DE ' + FAMILIAS, 'ESTAÇÕES LIGADAS: ' + l.estacoes + ' DE ' + LOTES]; }
  function fragil(u) { return u.estrategia ? ESTRATEGIAS[u.estrategia].fragil : null; }
  function terceiro(a, b) { return L.filter(function (x) { return x !== a && x !== b; })[0]; }

  /* O que a queda do sinal faz com o tabuleiro. Entrada: as posições registradas depois da notícia. */
  function aposSinal(u) {
    var o = ordemFinal(u), r = { azul: u.azul, dourada: u.dourada, descoberto: terceiro(u.azul, u.dourada), danificado: null, moveuDe: null, moveuPara: null, evento: null };
    if (o === 'consulta') { r.danificado = u.dourada; r.evento = 'dourada_apaga'; }
    if (o === 'lista') { r.evento = 'dourada_firme'; }
    if (o === 'intencao') { r.moveuDe = u.dourada; r.moveuPara = r.descoberto; r.dourada = r.descoberto; r.descoberto = u.dourada; r.evento = 'dourada_voa'; }
    return r;
  }

  /* O destino final de um universo */
  function resultado(u) {
    var s = aposSinal(u), o = ordemFinal(u), fr = fragil(u), dv = dividas(u);
    var cristal = u.cristal === 'sim', caiu = cristal ? null : s.descoberto;
    var sensivel = function (p) { return !!p && (p === fr || dv.indexOf(p) >= 0); };
    var grave = !!caiu && sensivel(caiu);
    var estados = {};
    L.forEach(function (p) {
      if (p === caiu) estados[p] = grave ? 'caiu_grave' : 'caiu';
      else if (p === s.danificado) estados[p] = 'danificado';
      else if (cristal && p === s.descoberto) estados[p] = 'cristal';
      else estados[p] = 'firme';
    });
    return {
      sinal: s, caiu: caiu, grave: grave, cristalApagado: cristal, estados: estados, ordem: o, fragil: fr, dividas: dv, pressoes: pressoes(u), lotes: lotesFinais(u), alas: alas(u),
      hospital: hospital(u), reparo: o === 'intencao' && !!caiu && !grave, semPlano: o === 'lista' && !!caiu,
      chave: [u.estrategia, o, caiu || 'cristal'].join('|')
    };
  }

  /* Quais falas contam o destino deste universo */
  function falasResultado(u) {
    var r = resultado(u), e = u.estrategia, ids = [];
    if (r.caiu) { ids.push('RE_' + e + '_' + r.caiu); if (r.grave) ids.push('RG_' + r.caiu); if (r.semPlano) ids.push('RS_lista'); }
    else ids.push('RC1');
    if (r.sinal.danificado) ids.push('RD');
    if (r.ordem === 'consulta') ids.push('RK1');
    if (r.ordem === 'lista') ids.push('RK2');
    if (r.ordem === 'intencao') ids.push(r.reparo || !r.caiu ? 'RK3a' : 'RK3b');
    if (!r.caiu) ids.push('RC2');
    return ids;
  }
  function falaReacao(u) { return { farol: 'KA', rede: 'KB', onda: 'KC' }[u.estrategia] + { consulta: '1', lista: '2', intencao: '3' }[u.ordem1]; }
  function falaHospital(u) { return { consulta: 'PL_C', lista: 'PL_L', intencao: 'PL_I' }[ordemFinal(u)]; }
  function falaFaixa(u) { return { criticas: 'HB_C', emergencia: 'HB_E', transborda: 'HB_T' }[hospital(u)]; }
  function falaDivida(u) { var p = pressoes(u), o = []; if (p.abrigo === 'sem_estoque') o.push('DV_abrigo'); if (p.estacoes) o.push('DV_estacoes'); if (!p.abrigo && !p.estacoes) o.push('DV_ok'); return o; }
  function falasConta(u) { return [falaHospital(u), falaFaixa(u)].concat(falaDivida(u)); }
  /* O que o K-99 faz ao saber das 200 famílias */
  function falaNoticia(u) {
    var o = ordemFinal(u), b = lotesBase(u), c = u.clausula; if (o === 'consulta') return 'NF_C';
    if (o === 'lista') { if (c === 'nao' || !c) return 'NF_L_nao'; return b[c] > 0 ? 'NF_L_' + c : 'NF_L_vazio'; }
    var m = movimento(u); return m ? 'NF_I_' + m.de : 'NF_I_nada';
  }
  function falaInquerito(u) { return { consulta: 'EX_C', lista: 'EX_L', intencao: 'EX_I' }[ordemFinal(u)]; }
  function precisaClausula(u) { var o = ordemFinal(u); return o === 'lista' || o === 'intencao'; }

  /* Agrupa universos que ouvem a mesma coisa: a fala toca uma vez e cita todos */
  function agrupar(universos, fn) {
    var m = [], idx = {};
    universos.forEach(function (u) { var v = fn(u), k = JSON.stringify(v); if (v === null) return; if (idx[k] === undefined) { idx[k] = m.length; m.push({ valor: v, universos: [u.n] }); } else m[idx[k]].universos.push(u.n); });
    return m;
  }

  /* Sugestão de mesas e de distribuição */
  function sugerirMesas(p) { p = Math.max(2, Math.round(Number(p) || 0)); return Math.max(2, Math.min(4, Math.round(p / 4.5))); }
  function distribuir(p, m) { p = Math.max(0, Math.round(Number(p) || 0)); var q = Math.floor(p / m), r = p % m, o = []; for (var i = 0; i < m; i++) o.push(q + (i < r ? 1 : 0)); return o; }

  var API = { ESTRATEGIAS: ESTRATEGIAS, ORDENS: ORDENS, LUGARES: LUGARES, L: L, LOTES: LOTES, ALAS: ALAS, LUGARES_LOTE: LUGARES_LOTE, HOSPITAL_TXT: HOSPITAL_TXT, HOSPITAL_COR: HOSPITAL_COR, PRESSAO_TXT: PRESSAO_TXT, CLAUSULAS: CLAUSULAS, CORRECOES: CORRECOES, temLotes: temLotes, lotesBase: lotesBase, lotesFinais: lotesFinais, movimento: movimento, alas: alas, hospital: hospital, pressoes: pressoes, dividas: dividas, painelLotes: painelLotes, falaFaixa: falaFaixa, falasConta: falasConta, falaNoticia: falaNoticia, falaInquerito: falaInquerito, precisaClausula: precisaClausula, ordemFinal: ordemFinal, fragil: fragil, terceiro: terceiro, aposSinal: aposSinal, resultado: resultado, falasResultado: falasResultado, falaReacao: falaReacao, falaDivida: falaDivida, falaHospital: falaHospital, agrupar: agrupar, sugerirMesas: sugerirMesas, distribuir: distribuir };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.REGRAS = API;
})(typeof window !== 'undefined' ? window : globalThis);
