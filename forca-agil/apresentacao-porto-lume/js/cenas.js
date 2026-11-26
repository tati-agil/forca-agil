/* AS 13 TELAS. Sem regras, sem registro, sem número de mesas: as três possibilidades aparecem juntas, e cada mesa identifica a sua. */
(function (r) {
  var ORDEM_CAFE = 'Sirva café a todas as pessoas da sala, sem derramar nenhuma gota.';
  var PLANOS = [
    { nome: 'PLANO A', cor: '#eaf1ff', h: 60, a: 20, e: 20 },
    { nome: 'PLANO B', cor: '#eaf1ff', h: 20, a: 60, e: 20 },
    { nome: 'PLANO C', cor: '#eaf1ff', h: 20, a: 20, e: 60 }
  ];
  var RESULTADOS = ['60 caixas no Hospital. 20 no Abrigo. 20 nas Estações.', '20 caixas no Hospital. 60 no Abrigo. 20 nas Estações.', '20 caixas no Hospital. 20 no Abrigo. 60 nas Estações.'];
  var CONSEQUENCIAS = ['O Hospital recebeu a maior parte dos recursos, mas o Abrigo recebeu apenas 20 caixas.', 'O Abrigo recebeu a maior parte, mas o Hospital recebeu apenas 20 das 300 caixas solicitadas.', 'As Estações receberam a maior parte, mas Hospital e Abrigo ficaram com apenas 20 caixas cada.'];
  /* REGRA DO REMANEJAMENTO: com autonomia, o K-99 leva 20 caixas ao Abrigo, tirando do destino com mais caixas, nunca do Abrigo, e nunca deixando um destino com menos de 20. Se ninguém tiver sobra, não mexe. */
  function remaneja(p) { var op = [['Hospital', p.h], ['Estações', p.e]].sort(function (a, b) { return b[1] - a[1]; })[0]; if (op[1] - 20 < 20) return { de: null, h: p.h, a: p.a, e: p.e }; return { de: op[0], h: p.h - (op[0] === 'Hospital' ? 20 : 0), a: p.a + 20, e: p.e - (op[0] === 'Estações' ? 20 : 0) }; }
  var COM_AUTONOMIA = PLANOS.map(function (p) { var r = remaneja(p); var ant = r.de === 'Hospital' ? p.h : p.e, dep = r.de === 'Hospital' ? r.h : r.e; return r.de ? r.de + ': ' + ant + ' → ' + dep + '. Abrigo: ' + p.a + ' → ' + r.a : 'Abrigo continua com ' + p.a + '. Ninguém tem sobra.'; });
  var SEM_AUTONOMIA = 'QUEM EXIGIU AUTORIZAÇÃO: nada muda, e as famílias esperam.';
  var DOMINO = ['Mais pacientes atendidos. Mas, com poucas caixas nas Estações, as entregas atrasam.', 'Mais famílias acolhidas. Mas, com poucas caixas nas Estações, as entregas atrasam, e o Hospital tem pouco.', 'As entregas chegam. Mas sobra menos para entregar ao Hospital e ao Abrigo.'];
  var C = [
    { id: 'titulo', momento: 1, tempo: '1 min', nome: 'Título', tela: 'titulo', a: 'GUARDIÕES DA FORÇA', b: 'Missão Porto Lume' },
    { id: 'emergencia', momento: 1, tempo: '2 min', nome: 'Nova Aurora em crise', tela: 'crise', a: 'NOVA AURORA', sfx: 'interferencia', falas: ['F01', 'F02'] },
    { id: 'k99', momento: 1, tempo: '2 min', nome: 'K-99 aparece', tela: 'k99', sfx: 'k99_comico', painel: [['EFICIÊNCIA DECLARADA', '100%', 'F16'], ['ENTREGAS REALIZADAS', '0', 'F17']], falas: ['P_APRESENTA', 'F15', 'F16', 'F17'] },
    { id: 'ironias', momento: 2, tempo: '1 min', nome: 'As ironias do K-99', tela: 'k99', painel: [['ATRASOS', '0', 'F21'], ['ERROS', '0', 'F24'], ['ATIVIDADES', '0', 'F25']], falas: ['F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24', 'F25'] },
    { id: 'cafe', momento: 2, tempo: '5 min', nome: 'A ordem do café', tela: 'cafe', etapas: 3 },
    { id: 'cafe_fim', momento: 2, tempo: '2 min', nome: 'K-99 cumpriu', tela: 'k99', sfx: 'confirma', painel: [['CUMPRIMENTO DA ORDEM SEGUNDO O K-99', '100%', 'P_CAFE1'], ['PESSOAS QUE CONSEGUIRAM TOMAR CAFÉ', '0', 'P_CAFE3']], falas: ['P_CAFE1', 'P_CAFE2', 'P_CAFE3', 'P_CAFE4', 'P_CAFE5'] },
    { id: 'crise', momento: 3, tempo: '1 min', nome: 'Emergência em Porto Lume', tela: 'porto', sfx: 'alerta', falas: ['P_CRISE'] },
    { id: 'planos', momento: 3, tempo: '14 min', nome: 'Os três planos', tela: 'planos' },
    { id: 'execucao', momento: 3, tempo: '3 min', nome: 'K-99 executa', tela: 'cartoes', titulo: 'DISTRIBUIÇÃO EXECUTADA', itens: RESULTADOS, falas: ['P_EXEC'], k99: 1 },
    { id: 'pedido', momento: 3, tempo: '2 min', nome: 'O pedido do K-99', tela: 'pedido', sfx: 'confirma', falas: ['P_PEDIDO'] },
    { id: 'noticia', momento: 3, tempo: '7 min', nome: 'Mais 200 famílias', tela: 'cartoes', titulo: 'MAIS 200 FAMÍLIAS NO ABRIGO', itens: CONSEQUENCIAS, sfx: 'alerta', pausas: 1, falas: ['P_NOTICIA', 'P_R_AUT', 'P_R_B', 'P_R_SEM'], aviso: 'TRÊS SITUAÇÕES ALTERNATIVAS. CADA MESA IDENTIFICA SÓ A SUA.', etiquetas: { P_R_AUT: '1 DE 3 · PLANO A OU C, COM AUTONOMIA', P_R_B: '2 DE 3 · PLANO B, COM AUTONOMIA', P_R_SEM: '3 DE 3 · QUALQUER PLANO, EXIGINDO AUTORIZAÇÃO' }, urgente: 1 },
    { id: 'domino', momento: 3, tempo: '1 min', nome: 'As entregas dependem das Estações', tela: 'domino', falas: ['P_NEUTRA', 'P_DOMINO'] },
    { id: 'balanco', momento: 4, tempo: '2 min', nome: 'Balanço do Conselho e K-99', tela: 'k99', falas: ['P_BALANCO', 'N42'], painel: [['PEDIDOS NÃO ATENDIDOS', 'REGISTRADOS'], ['EFICIÊNCIA', 'IMPECÁVEL', undefined, 'ok']] },
    { id: 'mestre', momento: 4, tempo: '2 min', nome: 'O Mestre', tela: 'mestre', falas: ['N40', 'N41'] },
    { id: 'fim', momento: 4, tempo: '1 min, e fica na roda', nome: 'Tela da conversa', tela: 'silencio', sfx: 'encerramento' }
  ];
  var API = { CENAS: C, ORDEM_CAFE: ORDEM_CAFE, PLANOS: PLANOS, RESULTADOS: RESULTADOS, CONSEQUENCIAS: CONSEQUENCIAS, remaneja: remaneja, COM_AUTONOMIA: COM_AUTONOMIA, SEM_AUTONOMIA: SEM_AUTONOMIA, DOMINO: DOMINO };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else r.MISSAO = API;
})(typeof window !== 'undefined' ? window : globalThis);
