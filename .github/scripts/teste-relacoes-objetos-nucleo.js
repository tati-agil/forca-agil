/* E4 — núcleo das RELAÇÕES ENTRE OBJETOS (forca-agil/relacoes-objetos-nucleo.js), puro, sem banco nem tela. Prova:
 *   A. Matriz: exatamente os 8 tipos + "atua sobre" e os 21 pares aprovados (A3/A4) + "atua sobre" da Porta 2 para cada
 *      natureza P1–P16; nada de Modalidade/Subproduto; nenhum par herdado entre naturezas; sem caminho cíclico em "compõe".
 *   B. Naturezas: só Produto/Serviço é conjunta; as camadas conjuntas pedem natureza registrada; a natureza que autoriza
 *      vem da avaliação que vale + decisão final + registro (A4/D4); Porta 2 pela própria identidade; nunca um palpite.
 *   C. Conceito oficial: só ativo, com definição publicada e naturezaDe = a camada.
 *   D. Integridade: autorrelação, par fora da matriz, duplicidade, par recíproco; ciclo em "compõe" pelo GRAFO (inclusive
 *      numa matriz sintética que permitiria caminho cíclico); contador de versão do grafo em toda criação de "compõe".
 *   E. Encerrar, registrar natureza, criar conceito: gravações completas (registro + índice + evento + operação + auditoria).
 *   F. Situação calculada: ativa / a revisar / não conferida / encerrada — nada encerrado sozinho.
 *   G. As regras publicadas (database.rules.json) são exatamente as montadas desta matriz. */
'use strict';
const path = require('path');
const fs = require('fs');
const R = require(path.join(__dirname, '..', '..', 'forca-agil', 'relacoes-objetos-nucleo.js'));
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }
const codigos = (r) => (r.erros || []).map((e) => e.codigo);

console.log('A. Matriz');
afirma(JSON.stringify(Object.keys(R.TIPOS)) === JSON.stringify(['compoe', 'usa', 'governa', 'expressa', 'dispara', 'produz', 'exerce-por-meio-de', 'da-acesso', 'atua-sobre']), 'os 8 tipos aprovados + "atua sobre" (Porta 2)', Object.keys(R.TIPOS));
const aprovados = [['compoe', 'componente', 'produto'], ['usa', 'operacao', 'componente'], ['usa', 'operacao', 'capacidade'], ['governa', 'regra', 'operacao'], ['governa', 'regra', 'componente'],
  ['governa', 'regra', 'processo'], ['expressa', 'documento', 'regra'], ['dispara', 'operacao', 'processo'], ['produz', 'processo', 'documento'], ['produz', 'operacao', 'documento'],
  ['exerce-por-meio-de', 'capacidade', 'processo'], ['exerce-por-meio-de', 'capacidade', 'canal'], ['da-acesso', 'canal', 'funcionalidade'], ['da-acesso', 'canal', 'processo'], ['da-acesso', 'canal', 'documento'],
  ['compoe', 'etapa', 'processo'], ['usa', 'funcionalidade', 'operacao'], ['compoe', 'funcionalidade', 'produto'], ['da-acesso', 'canal', 'produto'], ['governa', 'regra', 'produto'], ['governa', 'regra', 'opcao']];
const naoPorta2 = R.PARES.filter((p) => p.tipo !== 'atua-sobre').map((p) => [p.tipo, p.de, p.para]);
afirma(naoPorta2.length === 21 && JSON.stringify(naoPorta2) === JSON.stringify(aprovados), 'exatamente os 21 pares aprovados (1–21), nenhum a mais', naoPorta2.length);
const porta2 = R.PARES.filter((p) => p.tipo === 'atua-sobre');
afirma(porta2.length === R.NATUREZAS_P1P16.length && porta2.every((p) => p.de === 'responsabilidade' && p.para !== 'responsabilidade'), '"atua sobre": só da Porta 2 para objetos P1–P16 (nunca Porta 2 → Porta 2; "abrange" fora)');
afirma(R.NATUREZAS.modalidade && R.NATUREZAS.modalidade.individual && R.NATUREZAS.subproduto && R.NATUREZAS.subproduto.individual && !R.PARES.some((p) => /informacao|unidade-valor/.test(p.de + p.para) && p.tipo !== 'atua-sobre'), 'E5: Modalidade e Subproduto são naturezas individuais; Informação e Unidade de valor sem pares além de "atua sobre"');
afirma(!R.parAdmitido('usa', 'funcionalidade', 'componente') && !R.parAdmitido('dispara', 'funcionalidade', 'processo') && !R.parAdmitido('compoe', 'processo', 'produto'),
  'nada é herdado entre naturezas (o que vale para Operação não vale para Funcionalidade; Processo não herda de Etapa)');
afirma(R.validarMatriz().length === 0, 'a matriz v1 é coerente e "compõe" não forma caminho cíclico entre naturezas', R.validarMatriz());
afirma(R.validarMatriz([{ tipo: 'compoe', de: 'componente', para: 'produto' }, { tipo: 'compoe', de: 'produto', para: 'componente' }]).some((x) => /cíclico/.test(x)), 'uma matriz que permitisse ciclo em "compõe" seria recusada pela validação');

console.log('B. Naturezas');
afirma(Object.keys(R.NATUREZAS).filter((n) => !R.NATUREZAS[n].individual && !R.NATUREZAS[n].porta2).sort().join() === 'canal,capacidade,componente,produto,unidade-valor', 'naturezas sem registro: Produto/Serviço (única conjunta) e as camadas já individuais');
afirma(JSON.stringify(R.INDIVIDUAIS_DA_CAMADA) === JSON.stringify({ 'funcionalidade-operacao': ['funcionalidade', 'operacao'], 'processo-etapa': ['processo', 'etapa'], 'regra-condicao': ['regra'], 'modalidade-subproduto': ['opcao', 'modalidade', 'subproduto'], 'documento-informacao': ['documento', 'informacao'] }),
  'classificações técnicas → naturezas individuais (Opção, Modalidade e Subproduto em modalidade-subproduto: A2 + E5)', R.INDIVIDUAIS_DA_CAMADA);
const g = (camada, decisao, extra) => ({ situacao: 'atual', libera: true, chave: 'av1', avaliacao: Object.assign({ status: 'concluido', decisaoFinal: decisao, camadaSugerida: { id: camada } }, extra || {}) });
const nat = (gate, registro) => R.naturezaDoObjeto({ gate, registro });
afirma(nat(g('componente', 'produto')).natureza === 'produto', 'decisão final "produto" → Produto/Serviço, mesmo com outra camada automática');
afirma(nat(g('canal', 'nao-produto')).natureza === 'canal' && nat(g('capacidade-organizacional', 'nao-produto')).natureza === 'capacidade', '"não produto" com camada individual → a natureza dela');
afirma(nat(g('funcionalidade-operacao', 'nao-produto')).motivo === 'NATUREZA_NAO_REGISTRADA', 'camada conjunta sem registro → sem natureza (nunca deduzida)');
afirma(nat(g('funcionalidade-operacao', 'nao-produto'), { natureza: 'operacao', camada: 'funcionalidade-operacao', avaliacaoId: 'av1' }).natureza === 'operacao', 'camada conjunta com registro da versão vigente → a natureza registrada');
afirma(nat(g('funcionalidade-operacao', 'nao-produto'), { natureza: 'operacao', camada: 'funcionalidade-operacao', avaliacaoId: 'av0' }).motivo === 'NATUREZA_A_CONFIRMAR', 'registro de OUTRA versão, mesma classificação → "a confirmar" (não autoriza)');
afirma(nat(g('componente', 'nao-produto'), { natureza: 'operacao', camada: 'funcionalidade-operacao' }).natureza === 'componente', 'camada individual: um registro antigo não muda nada');
afirma(nat(g('processo-etapa', 'nao-produto'), { natureza: 'operacao', camada: 'funcionalidade-operacao' }).motivo === 'NATUREZA_A_CONFIRMAR', 'reavaliação mudou a camada conjunta → natureza "a confirmar"');
afirma(nat(g('a-validar', 'a-validar')).motivo === 'A_VALIDAR' && nat(g('produto-principal', 'nao-produto')).motivo === 'DECISAO_INCOERENTE', '"a validar" e "não produto" com camada Produto/Serviço → nenhuma natureza');
afirma(nat(g('modalidade-subproduto', 'nao-produto'), { natureza: 'opcao', camada: 'modalidade-subproduto', avaliacaoId: 'av1' }).natureza === 'opcao', 'Opção registrada num item de Modalidade/Subproduto');
afirma(nat({ situacao: 'verificando' }).indisponivel === true && nat({ situacao: 'excluida', libera: false }).motivo === 'SEM_AVALIACAO_VALIDA', 'motor ainda verificando → indisponível; sem avaliação que vale → sem natureza');
afirma(R.naturezaDoObjeto({ porta2: { situacao: 'ativo' } }).natureza === 'responsabilidade' && R.naturezaDoObjeto({ porta2: { situacao: 'encerrado' } }).motivo === 'OBJETO_ENCERRADO', 'Porta 2: pela própria identidade, sem P1–P16');

console.log('C. Conceito oficial');
afirma(R.conceitoValido('operacao', { ativo: true, temDefinicao: true, naturezaDe: 'funcionalidade-operacao' }), 'conceito ativo, com definição e naturezaDe certo → válido');
afirma(!R.conceitoValido('operacao', { ativo: false, temDefinicao: true, naturezaDe: 'funcionalidade-operacao' }) && !R.conceitoValido('operacao', { ativo: true, temDefinicao: false, naturezaDe: 'funcionalidade-operacao' }) &&
  !R.conceitoValido('operacao', { ativo: true, temDefinicao: true, naturezaDe: 'processo-etapa' }) && !R.conceitoValido('operacao', null), 'inativo, sem definição, camada errada ou ausente → inválido');

console.log('D. Integridade');
const U = { id: 'u1', email: 'u@previ.com.br' };
const ctx = (n) => ({ relacaoId: 'r' + n, operacaoId: 'op' + n, usuario: U, agora: 123, versaoCompoe: 4 });
const N = (n, b) => ({ natureza: n, base: b === undefined ? 'b-' + n : b });
let r = R.criarRelacao({ registros: {} }, { origem: 'c1', tipo: 'compoe', destino: 'p1' }, { origem: N('componente'), destino: N('produto') }, ctx(1));
afirma(r.ok && r.caminhos['relacoes-objetos/versao-compoe'] === 5 && r.caminhos['relacoes-objetos/ativa-por-chave/c1__compoe__p1'] === 'r1' && r.caminhos['relacoes-objetos/eventos/op1:1'].depois.id === 'r1' && r.caminhos['relacoes-objetos/operacoes/op1'].relacaoId === 'r1',
  'criar "compõe": registro + índice + evento + operação + contador do grafo (versão + 1)', r.erros);
const reg1 = { r1: r.relacao };
afirma(!R.criarRelacao({ registros: {} }, { origem: 'f1', tipo: 'usa', destino: 'o1' }, { origem: N('funcionalidade'), destino: N('operacao') }, ctx(2)).caminhos['relacoes-objetos/versao-compoe'], 'outros tipos não mexem no contador do grafo');
afirma(codigos(R.criarRelacao({ registros: {} }, { origem: 'x', tipo: 'compoe', destino: 'x' }, { origem: N('componente'), destino: N('produto') }, ctx(3))).indexOf('AUTORRELACAO') !== -1, 'autorrelação é recusada');
afirma(codigos(R.criarRelacao({ registros: {} }, { origem: 'p1', tipo: 'compoe', destino: 'c1' }, { origem: N('produto'), destino: N('componente') }, ctx(4))).indexOf('PAR_NAO_ADMITIDO') !== -1, 'par fora da matriz é recusado');
afirma(codigos(R.criarRelacao({ registros: reg1 }, { origem: 'c1', tipo: 'compoe', destino: 'p1' }, { origem: N('componente'), destino: N('produto') }, ctx(5))).indexOf('RELACAO_DUPLICADA') !== -1, 'a mesma relação ativa não entra duas vezes');
afirma(codigos(R.criarRelacao({ registros: {} }, { origem: 'f1', tipo: 'usa', destino: 'o1' }, { origem: { natureza: null, motivo: 'NATUREZA_NAO_REGISTRADA' }, destino: N('operacao') }, ctx(6))).indexOf('NATUREZA_ORIGEM_INDISPONIVEL') !== -1, 'sem natureza conhecida numa ponta, não cria');
const recip = { a: { origem: 'o1', tipo: 'usa', destino: 'f1', situacao: 'ativa' } };
afirma(codigos(R.criarRelacao({ registros: recip }, { origem: 'f1', tipo: 'usa', destino: 'o1' }, { origem: N('funcionalidade'), destino: N('operacao') }, ctx(7))).indexOf('RELACAO_RECIPROCA') !== -1, 'par recíproco do mesmo tipo é recusado');
/* ciclo pelo GRAFO: A compõe B, B compõe C → C compõe A fecharia um ciclo, quaisquer que sejam as naturezas */
const grafo = { x1: { origem: 'A', tipo: 'compoe', destino: 'B', situacao: 'ativa' }, x2: { origem: 'B', tipo: 'compoe', destino: 'C', situacao: 'ativa' }, x3: { origem: 'C', tipo: 'compoe', destino: 'D', situacao: 'encerrada' } };
afirma(R.alcanca(grafo, 'compoe', 'A', 'C') && !R.alcanca(grafo, 'compoe', 'C', 'A') && !R.alcanca(grafo, 'compoe', 'A', 'D'), 'caminho no grafo de "compõe" só pelas relações ativas');
afirma(codigos(R.criarRelacao({ registros: grafo }, { origem: 'C', tipo: 'compoe', destino: 'A' }, { origem: N('componente'), destino: N('produto') }, ctx(8))).indexOf('CICLO_NA_COMPOSICAO') !== -1, 'ciclo em "compõe" em qualquer extensão é recusado pelo grafo (não pelas naturezas)');
afirma(R.criarRelacao({ registros: grafo }, { origem: 'D', tipo: 'compoe', destino: 'A' }, { origem: N('componente'), destino: N('produto') }, ctx(9)).ok, 'relação encerrada não conta no grafo');
afirma(codigos(R.criarRelacao({ registros: {} }, { origem: 'c1', tipo: 'compoe', destino: 'p1', observacao: 'x'.repeat(501) }, { origem: N('componente'), destino: N('produto') }, ctx(10))).indexOf('OBSERVACAO_LONGA') !== -1, 'observação até 500 caracteres');
afirma(R.temCiclo({ a: ['b'], b: ['a'] }) && !R.temCiclo({ a: ['b'], b: ['c'] }), 'detector de ciclo');

console.log('E. Encerrar, natureza, conceito');
let e = R.encerrarRelacao({ registros: reg1 }, 'r1', '  ', { operacaoId: 'op20', usuario: U, agora: 9 });
afirma(codigos(e).indexOf('MOTIVO_OBRIGATORIO') !== -1, 'encerrar sem motivo é recusado');
e = R.encerrarRelacao({ registros: reg1 }, 'r1', 'Componente substituído (teste)', { operacaoId: 'op21', usuario: U, agora: 9 });
afirma(e.ok && e.relacao.situacao === 'encerrada' && e.relacao.revisao === 2 && e.relacao.encerramento.motivo === 'Componente substituído (teste)' && e.caminhos['relacoes-objetos/ativa-por-chave/c1__compoe__p1'] === null && e.relacao.origem === 'c1',
  'encerrar: final, revisão + 1, motivo, índice liberado, a relação continua registrada');
afirma(codigos(R.encerrarRelacao({ registros: { r1: e.relacao } }, 'r1', 'de novo', { operacaoId: 'op22', usuario: U, agora: 9 })).indexOf('RELACAO_JA_ENCERRADA') !== -1, 'relação encerrada não se encerra de novo');
const conc = { ativo: true, temDefinicao: true, naturezaDe: 'funcionalidade-operacao' };
/* fundamento coerente com a orientação: a alternativa da natureza e o snapshot da definição oficial dela */
const FUND = (n) => ({ versao: 1, pergunta: 'Pergunta de teste', alternativa: n, rotulo: 'Alternativa de teste', justificativa: 'Justificativa de teste', definicoes: { [n]: { texto: 'Definição de teste', versao: 1 } } });
let n = R.registrarNatureza('it1', 'operacao', g('funcionalidade-operacao', 'nao-produto'), null, conc, { auditoriaId: 'a1', usuario: U, agora: 5 }, FUND('operacao'));
afirma(n.ok && n.registro.revisao === 1 && n.caminhos['objetos-natureza-auditoria/it1/a1'].tipo === 'registro', 'registrar natureza: registro (revisão 1) + auditoria nova na mesma gravação');
afirma(codigos(R.registrarNatureza('it1', 'operacao', g('funcionalidade-operacao', 'nao-produto'), null, null, { auditoriaId: 'a2', usuario: U, agora: 5 }, FUND('operacao'))).indexOf('CONCEITO_SEM_DEFINICAO_OFICIAL') !== -1, 'sem conceito oficial, não registra');
afirma(codigos(R.registrarNatureza('it1', 'processo', g('funcionalidade-operacao', 'nao-produto'), null, { ativo: true, temDefinicao: true, naturezaDe: 'processo-etapa' }, { auditoriaId: 'a3', usuario: U, agora: 5 }, FUND('processo'))).indexOf('NATUREZA_FORA_DA_CAMADA') !== -1, 'natureza fora da camada da avaliação que vale, não registra');
afirma(codigos(R.registrarNatureza('it1', 'operacao', g('funcionalidade-operacao', 'produto'), null, conc, { auditoriaId: 'a4', usuario: U, agora: 5 }, FUND('operacao'))).indexOf('DECISAO_NAO_PERMITE') !== -1, 'decisão final "produto" não recebe natureza individual');
const n2 = R.registrarNatureza('it1', 'funcionalidade', g('funcionalidade-operacao', 'nao-produto'), n.registro, conc, { auditoriaId: 'a5', usuario: U, agora: 6 }, FUND('funcionalidade'));
afirma(n2.ok && n2.registro.revisao === 2 && n2.caminhos['objetos-natureza-auditoria/it1/a5'].anterior === 'operacao' && n2.caminhos['objetos-natureza-auditoria/it1/a5'].tipo === 'alteracao', 'corrigir a natureza: revisão + 1, auditoria "alteracao" com o valor anterior');
const cc = R.criarConceitoNatureza('etapa', 'Etapa', 'Definição aprovada (teste).', { email: 'adm@previ.com.br', agoraIso: '2026-10-18T00:00:00Z', auditoriaKey: 'k1', ordem: 7 });
const cb = cc.caminhos['taxonomia/arquitetural/conceitos/etapa'];
afirma(cc.ok && cb.naturezaDe === 'processo-etapa' && cb.ativo === true && cb.definicao.versao === 1 && cc.caminhos['taxonomia/arquitetural/definicoes/etapa/v1'].origem === 'publicacao' && cc.caminhos['taxonomia/arquitetural/auditoria/etapa/k1'].tipo === 'conceito_criado',
  'criar conceito de natureza individual: conceito + definição v1 + histórico + auditoria, com naturezaDe da camada');
afirma(codigos(R.criarConceitoNatureza('etapa', 'Etapa', '', { email: 'a', agoraIso: 'x', auditoriaKey: 'k' })).indexOf('DEFINICAO_OBRIGATORIA') !== -1 && codigos(R.criarConceitoNatureza('produto', 'P', 'D', { email: 'a', agoraIso: 'x', auditoriaKey: 'k' })).indexOf('NATUREZA_INVALIDA') !== -1,
  'conceito sem definição, ou de natureza que não é individual, não é criado');

console.log('F. Situação calculada');
const rel = { tipo: 'usa', naturezaOrigem: 'funcionalidade', naturezaDestino: 'operacao', situacao: 'ativa' };
afirma(R.situacaoRelacao(rel, { origem: N('funcionalidade'), destino: N('operacao') }).situacao === 'ativa', 'naturezas iguais às da criação e par admitido → ativa');
const s1 = R.situacaoRelacao(rel, { origem: N('funcionalidade'), destino: { natureza: null, motivo: 'NATUREZA_A_CONFIRMAR' } });
afirma(s1.situacao === 'a-revisar' && s1.motivos.join() === 'NATUREZA_INDISPONIVEL_DESTINO', 'natureza a confirmar → a revisar (não encerra)');
afirma(R.situacaoRelacao(rel, { origem: N('funcionalidade'), destino: N('componente') }).motivos.join() === 'NATUREZA_MUDOU_DESTINO', 'reclassificação → a revisar');
afirma(R.situacaoRelacao(rel, { origem: { natureza: null, motivo: 'OBJETO_ENCERRADO' }, destino: N('operacao') }).motivos.join() === 'PONTA_ENCERRADA', 'ponta encerrada → a revisar');
afirma(R.situacaoRelacao(rel, { origem: { indisponivel: true }, destino: N('operacao') }).situacao === 'nao-conferida', 'referência indisponível → não conferida');
afirma(R.situacaoRelacao(Object.assign({}, rel, { situacao: 'encerrada' }), {}).situacao === 'encerrada', 'encerrada continua encerrada');

console.log('G. Regras publicadas = montadas');
const MR = require('./montar-regras-relacoes-objetos.js');
const regras = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules;
const montados = MR.montar(regras);
const div = Object.keys(montados).filter((k) => JSON.stringify(regras[k]) !== JSON.stringify(montados[k]));
afirma(!div.length, 'database.rules.json tem exatamente os nós montados da matriz (relacoes-objetos, objetos-natureza, auditoria, marcador, Taxonomia)', div);
afirma(regras['relacoes-objetos-config']['.write'] === false, 'nenhum cliente grava o marcador de liberação');

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
