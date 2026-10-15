/* Estrutura Organizacional Atual — núcleo puro (estrutura-atual-nucleo.js): validações, hierarquia sem ciclo,
   revisão, encerramento com motivo e sem subordinadas ativas, payload multipath (unidade + índice + histórico) e o
   marcador próprio. Sem Firebase, sem navegador. As regras do banco são provadas em teste-rules-estrutura-atual.js */
'use strict';
const path = require('path');
const N = require(path.join(__dirname, '..', '..', 'forca-agil', 'estrutura-atual-nucleo.js'));
let total = 0, falhas = 0;
function afirma(ok, rotulo, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det !== undefined ? ' → ' + JSON.stringify(det) : '')); } }
const U = { uid: 'u1', email: 'pessoa@previ.com.br' };
let n = 0;
const ctx = (novoId) => ({ novoId, auditoriaId: 'aud' + (++n), usuario: U, agora: 1000 + n });
const estado = { unidades: {} };
function aplica(r, rot) { if (!r.ok) { afirma(false, rot, r.erro); return r; } estado.unidades[r.unidade.id] = r.unidade; return r; }
const cod = (r) => (r.ok ? 'OK' : r.erro.codigo);

console.log('A. Validação e criação');
afirma(cod(N.criarUnidade(estado, { nome: ' ', nivel: 'gerencia' }, ctx('x'))) === 'NOME_OBRIGATORIO', 'nome obrigatório');
afirma(cod(N.criarUnidade(estado, { nome: 'X', nivel: 'linha' }, ctx('x'))) === 'NIVEL_INVALIDO', 'nível só da lista do domínio (nunca tipo arquitetural)');
afirma(cod(N.criarUnidade(estado, { nome: 'X', nivel: 'outro' }, ctx('x'))) === 'NIVEL_OUTRO_OBRIGATORIO', '"Outro" exige o texto');
afirma(cod(N.criarUnidade(estado, { nome: 'X', nivel: 'nucleo', vigenciaInicio: '01/01/2026' }, ctx('x'))) === 'VIGENCIA_INVALIDA', 'vigência em data (AAAA-MM-DD)');
afirma(cod(N.criarUnidade(estado, { nome: 'X', nivel: 'nucleo' }, { usuario: U, agora: 1, auditoriaId: 'a' })) === 'CTX_ID_AUSENTE', 'o núcleo não gera identificadores');
const rG = aplica(N.criarUnidade(estado, { nome: ' Gerência de Contabilidade e Controladoria ', sigla: 'GECON', nivel: 'gerencia', fonte: 'Regimento', vigenciaInicio: '2026-01-01' }, ctx('gecon')), 'GECON');
afirma(rG.unidade.nome === 'Gerência de Contabilidade e Controladoria' && rG.unidade.revisao === 1 && rG.unidade.situacao === 'ativa' && rG.unidade.superiorId === null && rG.evento.tipo === 'criacao', 'criada: texto aparado, revisão 1, ativa, evento de criação');
['nutes', 'conta', 'nutri', 'nucot'].forEach((k) => aplica(N.criarUnidade(estado, { nome: 'Núcleo ' + k, sigla: k.toUpperCase(), nivel: 'nucleo', superiorId: 'gecon' }, ctx(k)), k));
afirma(N.subordinadasAtivas(estado, 'gecon').length === 4, 'quatro núcleos subordinados à GECON');
afirma(cod(N.criarUnidade(estado, { nome: 'X', nivel: 'nucleo', superiorId: 'nao' }, ctx('x'))) === 'SUPERIOR_INEXISTENTE', 'superior inexistente: recusada');
afirma(cod(N.criarUnidade(estado, { nome: 'Y', nivel: 'nucleo' }, ctx('gecon'))) === 'ID_JA_USADO', 'id repetido: recusado');

console.log('B. Payload: unidade + índice + histórico numa gravação');
const w = N.payload(rG, 'TS');
afirma(Object.keys(w).sort().join() === [N.NOS.auditoria + '/gecon/' + rG.auditoriaId, N.NOS.unidades + '/gecon'].sort().join(), 'criação de raiz: unidade + evento');
afirma(w[N.NOS.unidades + '/gecon'].criadaEm === 'TS' && w[N.NOS.unidades + '/gecon'].atualizadaEm === 'TS' && !('superiorId' in w[N.NOS.unidades + '/gecon']), 'horário do servidor; campos vazios não são gravados');
const wC = N.payload(N.criarUnidade({ unidades: Object.assign({}, estado.unidades) }, { nome: 'Novo', nivel: 'nucleo', superiorId: 'gecon' }, ctx('novo')), 'TS');
afirma(wC[N.NOS.filhos + '/gecon/novo'] === true, 'subordinada nova entra no índice da superior');

console.log('C. Hierarquia sem ciclo');
afirma(cod(N.mudarSuperior(estado, 'gecon', 'gecon', {}, ctx())) === 'SUPERIOR_E_ELA_MESMA', 'ela mesma: recusada');
afirma(cod(N.mudarSuperior(estado, 'gecon', 'conta', {}, ctx())) === 'CICLO_NA_HIERARQUIA', 'subordinada dela: recusada (ciclo)');
aplica(N.criarUnidade(estado, { nome: 'Diretoria', nivel: 'diretoria' }, ctx('dir')), 'dir');
const rM = aplica(N.mudarSuperior(estado, 'gecon', 'dir', { motivo: 'Organograma 2026' }, ctx()), 'mover');
const wM = N.payload(rM, 'TS');
afirma(rM.unidade.revisao === 2 && rM.evento.tipo === 'superior' && rM.evento.antes.superiorId === null && rM.evento.depois.superiorId === 'dir' && rM.evento.motivo === 'Organograma 2026' && wM[N.NOS.filhos + '/dir/gecon'] === true, 'mudar superior: revisão + 1, antes/depois e motivo no histórico, índice novo');
afirma(N.ancestrais(estado, 'conta').join() === 'gecon,dir', 'cadeia de superiores');
afirma(cod(N.mudarSuperior(estado, 'dir', 'conta', {}, ctx())) === 'CICLO_NA_HIERARQUIA', 'ciclo de três níveis: recusado');
const rS = N.mudarSuperior(estado, 'nucot', 'dir', {}, ctx());
const wS = N.payload(rS, 'TS');
afirma(wS[N.NOS.filhos + '/gecon/nucot'] === null && wS[N.NOS.filhos + '/dir/nucot'] === true, 'mudar de superior: sai do índice antigo e entra no novo');
const prof = { unidades: {} }; let ant = null;
for (let i = 0; i <= N.PROFUNDIDADE_MAX; i++) { prof.unidades['p' + i] = { id: 'p' + i, nome: 'p' + i, nivel: 'outro', situacao: 'ativa', superiorId: ant }; ant = 'p' + i; }
afirma(cod(N.criarUnidade(prof, { nome: 'fundo', nivel: 'nucleo', superiorId: ant }, ctx('fundo'))) === 'HIERARQUIA_PROFUNDA_DEMAIS', 'profundidade limitada (o mesmo limite das regras)');

console.log('D. Edição e encerramento');
afirma(cod(N.alterarUnidade(estado, 'conta', { nome: 'Núcleo conta', sigla: 'CONTA', nivel: 'nucleo' }, ctx())) === 'SEM_ALTERACAO', 'edição sem mudança: recusada');
const rA = aplica(N.alterarUnidade(estado, 'conta', { nome: 'Núcleo de Contabilidade', sigla: 'CONTA', nivel: 'nucleo' }, ctx()), 'editar');
afirma(rA.unidade.revisao === 2 && rA.evento.antes.nome === 'Núcleo conta' && rA.evento.depois.nome === 'Núcleo de Contabilidade' && rA.unidade.superiorId === 'gecon', 'edição: revisão + 1, antes e depois; superior intacta');
afirma(cod(N.encerrarUnidade(estado, 'gecon', { motivo: 'x' }, ctx())) === 'TEM_SUBORDINADAS_ATIVAS', 'com subordinadas ativas: encerrar recusado');
afirma(cod(N.encerrarUnidade(estado, 'nutri', {}, ctx())) === 'MOTIVO_OBRIGATORIO', 'encerrar exige motivo');
const rE = aplica(N.encerrarUnidade(estado, 'nutri', { motivo: 'Fusão com a CONTA' }, ctx()), 'encerrar');
const wE = N.payload(rE, 'TS');
afirma(rE.unidade.situacao === 'encerrada' && rE.unidade.encerramento.motivo === 'Fusão com a CONTA' && wE[N.NOS.filhos + '/gecon/nutri'] === null && wE[N.NOS.unidades + '/nutri'].encerramento.em === 'TS', 'encerrada: com motivo, sai do índice, horário do servidor');
afirma(cod(N.alterarUnidade(estado, 'nutri', { nome: 'X', nivel: 'nucleo' }, ctx())) === 'UNIDADE_ENCERRADA' && cod(N.criarUnidade(estado, { nome: 'X', nivel: 'nucleo', superiorId: 'nutri' }, ctx('xx'))) === 'SUPERIOR_ENCERRADA', 'encerrada é final e não recebe subordinada');
afirma(N.arvore(estado).map((x) => x.id).join() === 'dir,gecon,conta,nucot,nutes', 'árvore: superior antes das subordinadas, irmãs por nome, sem as encerradas', N.arvore(estado).map((x) => x.id));
afirma(N.arvore(estado, true).some((x) => x.id === 'nutri'), 'árvore com as encerradas, quando pedido');

console.log('E. Marcador próprio');
afirma(cod(N.payloadHabilitacao('DESLIGADO', 'SOMENTE_ADMIN_GERAL', 'x', ctx(), 'TS')) === 'HABILITACAO_INVALIDA', 'só DESLIGADO e LIBERADO');
afirma(cod(N.payloadHabilitacao('DESLIGADO', 'LIBERADO', ' ', ctx(), 'TS')) === 'MOTIVO_OBRIGATORIO', 'mudar o marcador exige motivo');
const h = N.payloadHabilitacao(null, 'LIBERADO', 'Homologação', ctx(), 'TS');
afirma(h.ok && h.payload[N.NOS.config].habilitacao === 'LIBERADO' && Object.keys(h.payload).some((k) => k.indexOf(N.NOS.configAuditoria + '/') === 0 && h.payload[k].anterior === 'DESLIGADO'), 'marcador + auditoria (anterior ausente = DESLIGADO)');

console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
