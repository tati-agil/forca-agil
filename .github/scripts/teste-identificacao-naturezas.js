/* Identificação ORIENTADA da natureza individual (identificacao-naturezas.js + núcleo da E4) — puro, sem navegador.
 * A. O conteúdo de cada pergunta bate com o modelo único (naturezas-arquiteturais.js): só as classificações técnicas que
 *    admitem mais de uma natureza; cada alternativa de natureza é uma natureza que a classificação ADMITE; Opção nunca vem
 *    de Regra/Opção (lá ela vira "reavaliação necessária"); recorte e evidência insuficiente em todas; orientação, quando
 *    marcar e versão; exemplos só os validados (nada de "perfil").
 * B. Núcleo: identificação exige fundamento (justificativa, pergunta, alternativa, versão) e guarda o snapshot das
 *    definições; pendência no MESMO registro, sem natureza, com diagnóstico e justificativa; reavaliação só em Regra/Opção;
 *    pendência nunca autoriza relação; mudança de versão → "a confirmar"; nada é deduzido.
 * C. Casos (claros, ambíguos e contraditórios) para as naturezas individuais: a escolha registrada é sempre a da pessoa,
 *    e o que a orientação manda tratar como pendência fica pendência.
 * D. Coerência do fundamento: alternativa incompatível com a natureza (ou com o motivo da pendência), versão da orientação
 *    diferente da vigente, snapshot sem a definição da natureza escolhida ou com naturezas que a pergunta não mostra.
 * E. Vínculo com a versão VIGENTE: identificação (natureza ou pendência) feita em outra versão fica "a confirmar", mesmo
 *    com a mesma classificação; reconfirmação explícita para a vigente; o registro antigo fica na auditoria. */
'use strict';
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const I = require(path.join(RAIZ, 'forca-agil', 'identificacao-naturezas.js'));
const NA = require(path.join(RAIZ, 'forca-agil', 'naturezas-arquiteturais.js'));
const R = require(path.join(RAIZ, 'forca-agil', 'relacoes-objetos-nucleo.js'));

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('A. Conteúdo da orientação × modelo');
const multi = NA.CLASSIFICACOES.filter((c) => c.tecnica && c.naturezas.length).map((c) => c.codigo).sort();
anota('perguntas exatamente para as classificações técnicas com natureza (inclui Regra/Opção)', igual(I.CLASSIFICACOES.slice().sort(), multi), I.CLASSIFICACOES.join());
anota('nenhuma pergunta para as classificações que já são natureza nem para "A validar"', ['produto-principal', 'componente', 'canal', 'capacidade-organizacional', 'unidade-valor-associada', 'a-validar'].every((c) => I.diferenciacao(c) === null));
I.CLASSIFICACOES.forEach((cl) => {
  const d = I.diferenciacao(cl), nats = d.alternativas.filter((a) => a.natureza).map((a) => a.natureza);
  anota(cl + ': cada natureza oferecida é uma natureza que a classificação admite, e todas as admitidas aparecem', igual(nats.slice().sort(), NA.naturezasDaClassificacao(cl).slice().sort()), nats.join());
  anota(cl + ': pergunta, orientação, exemplos e "quando marcar" em todas as alternativas', !!(d.pergunta && d.orientacao && d.exemplos) && d.alternativas.every((a) => a.quando && a.rotulo));
  anota(cl + ': recorte e evidência insuficiente sempre disponíveis', d.alternativas.some((a) => a.pendencia === 'recorte') && d.alternativas.some((a) => a.pendencia === 'evidencia-insuficiente'));
  anota(cl + ': a pergunta não é uma escolha entre nomes (não cita o nome das naturezas)', !nats.some((n) => new RegExp('\\b' + NA.natureza(n).rotulo + '\\b').test(d.pergunta)));
});
const rc = I.diferenciacao('regra-condicao');
anota('Regra/Opção: só Regra como natureza; a Opção vira "reavaliação P1–P16 necessária"', igual(rc.alternativas.filter((a) => a.natureza).map((a) => a.natureza), ['regra']) && rc.alternativas.some((a) => a.valor === 'opcao-reavaliar' && a.pendencia === 'reavaliacao-necessaria'));
const ms = I.diferenciacao('modalidade-subproduto');
anota('Modalidade/Subproduto/Opção: orientação aprovada (o que o objeto é; regras próprias não definem Modalidade; Subproduto não é componente; sem distinção → pendente)',
  /Não basta existir uma escolha/.test(ms.orientacao) && /não define Modalidade/.test(ms.orientacao) && /não é, por definição, um componente/.test(ms.orientacao) && /pendente/.test(ms.orientacao));
anota('exemplos só validados: nada de "perfil" nem de exemplo institucional novo', I.CLASSIFICACOES.every((c) => !/perfil/i.test(I.diferenciacao(c).exemplos)) && /opção tributária/.test(ms.exemplos));
anota('Funcionalidade × Operação: "consultar saldo" pode ser recurso ou ação', /consultar saldo/.test(I.diferenciacao('funcionalidade-operacao').orientacao));
anota('Processo × Etapa: não exige a cadeia de valor inteira', /não precisa cobrir toda a cadeia de valor/.test(I.diferenciacao('processo-etapa').orientacao));
anota('Informação × Documento: conteúdo dentro de documento continua Informação quando o objeto é o conteúdo', /continua sendo Informação/.test(I.diferenciacao('documento-informacao').orientacao));
anota('a orientação é versionada (v1)', I.VERSAO === 1 && I.CLASSIFICACOES.every((c) => I.diferenciacao(c).versao === 1));

console.log('B. Núcleo: fundamento e pendência');
const U = { id: 'u1', email: 'arq@previ.com.br' };
const g = (camada, dec, chave) => ({ situacao: 'atual', libera: true, chave: chave || 'it1', avaliacao: { decisaoFinal: dec || 'nao-produto', camadaSugerida: { id: camada } } });
const conc = (n) => ({ ativo: true, temDefinicao: true, naturezaDe: R.NATUREZAS[n].camada });
/* o snapshot leva a definição oficial da natureza escolhida (como a tela grava) */
const fund = (alt, just, extra) => Object.assign({ versao: 1, pergunta: 'P', alternativa: alt, rotulo: 'R', justificativa: just }, R.NATUREZAS[alt] ? { definicoes: { [alt]: { texto: 'Def ' + alt, versao: 1 } } } : {}, extra || {});
const codigos = (r) => (r.erros || []).map((e) => e.codigo);
anota('identificação sem fundamento é recusada', codigos(R.registrarNatureza('it1', 'processo', g('processo-etapa'), null, conc('processo'), { auditoriaId: 'a', usuario: U, agora: 1 })).indexOf('FUNDAMENTO_OBRIGATORIO') !== -1);
anota('identificação com justificativa em branco é recusada', codigos(R.registrarNatureza('it1', 'processo', g('processo-etapa'), null, conc('processo'), { auditoriaId: 'a', usuario: U, agora: 1 }, fund('processo', '   '))).indexOf('JUSTIFICATIVA_OBRIGATORIA') !== -1);
const ok1 = R.registrarNatureza('it1', 'processo', g('processo-etapa'), null, conc('processo'), { auditoriaId: 'a1', usuario: U, agora: 1 }, fund('processo', 'Produz o resultado', { definicoes: { processo: { texto: 'Def P', versao: 2 }, etapa: { texto: 'Def E', versao: 1 } } }));
anota('identificação com fundamento: registro e auditoria levam o mesmo snapshot (pergunta, alternativa, justificativa, definições da época)',
  ok1.ok && ok1.registro.fundamento.justificativa === 'Produz o resultado' && ok1.registro.fundamento.definicoes.processo.versao === 2 && ok1.registro.fundamento.definicoes.etapa.texto === 'Def E' && ok1.caminhos[R.NAT_AUD + '/it1/a1'].fundamento.justificativa === 'Produz o resultado');
/* a alternativa da pendência é a da orientação (Regra/Opção: "opcao-reavaliar" → reavaliação necessária) */
const pend = (motivo, extra) => Object.assign({ motivo, diagnostico: 'O que falta', justificativa: 'Por quê', versao: 1, pergunta: 'P', alternativa: motivo === 'reavaliacao-necessaria' ? 'opcao-reavaliar' : motivo, rotulo: 'R' }, extra || {});
anota('pendência sem diagnóstico é recusada', codigos(R.registrarPendencia('it1', g('processo-etapa'), null, pend('recorte', { diagnostico: '' }), { auditoriaId: 'p', usuario: U, agora: 1 })).indexOf('DIAGNOSTICO_OBRIGATORIO') !== -1);
anota('pendência sem justificativa é recusada', codigos(R.registrarPendencia('it1', g('processo-etapa'), null, pend('recorte', { justificativa: ' ' }), { auditoriaId: 'p', usuario: U, agora: 1 })).indexOf('JUSTIFICATIVA_OBRIGATORIA') !== -1);
anota('motivo de pendência fora dos três aprovados é recusado', codigos(R.registrarPendencia('it1', g('processo-etapa'), null, pend('outro'), { auditoriaId: 'p', usuario: U, agora: 1 })).indexOf('MOTIVO_PENDENCIA_INVALIDO') !== -1);
anota('"reavaliação necessária" só a partir de Regra/Opção', codigos(R.registrarPendencia('it1', g('processo-etapa'), null, pend('reavaliacao-necessaria'), { auditoriaId: 'p', usuario: U, agora: 1 })).indexOf('REAVALIACAO_SO_EM_REGRA') !== -1);
anota('pendência em classificação que já é natureza (Componente) é recusada', codigos(R.registrarPendencia('it1', g('componente'), null, pend('recorte'), { auditoriaId: 'p', usuario: U, agora: 1 })).indexOf('CLASSIFICACAO_SEM_IDENTIFICACAO') !== -1);
const p1 = R.registrarPendencia('it1', g('processo-etapa'), null, pend('evidencia-insuficiente'), { auditoriaId: 'p1', usuario: U, agora: 1 });
anota('pendência: o mesmo registro, sem natureza, com motivo, diagnóstico, justificativa e a versão da avaliação; auditoria "pendencia"',
  p1.ok && !('natureza' in p1.registro) && p1.registro.pendencia.motivo === 'evidencia-insuficiente' && p1.registro.avaliacaoId === 'it1' && p1.caminhos[R.NAT_AUD + '/it1/p1'].tipo === 'pendencia');
const nd = R.naturezaDoObjeto({ gate: g('processo-etapa'), registro: p1.registro });
anota('pendência não dá natureza ao objeto (não autoriza relação)', nd.natureza === null && nd.motivo === 'IDENTIFICACAO_PENDENTE' && nd.pendencia.motivo === 'evidencia-insuficiente');
anota('a mesma pendência de novo: "nada mudou"', codigos(R.registrarPendencia('it1', g('processo-etapa'), p1.registro, pend('evidencia-insuficiente'), { auditoriaId: 'p2', usuario: U, agora: 2 })).indexOf('NADA_MUDOU') !== -1);
const ok2 = R.registrarNatureza('it1', 'etapa', g('processo-etapa'), p1.registro, conc('etapa'), { auditoriaId: 'a2', usuario: U, agora: 3 }, fund('etapa', 'Parte do processo'));
anota('da pendência para a natureza: revisão + 1, sem "anterior" (não havia natureza)', ok2.ok && ok2.registro.revisao === 2 && !ok2.caminhos[R.NAT_AUD + '/it1/a2'].anterior && !ok2.registro.pendencia);
const p3 = R.registrarPendencia('it1', g('processo-etapa'), ok2.registro, pend('recorte'), { auditoriaId: 'p3', usuario: U, agora: 4 });
anota('da natureza para a pendência: "anterior" guarda a natureza que havia (nunca inventada)', p3.ok && p3.caminhos[R.NAT_AUD + '/it1/p3'].anterior === 'etapa' && !p3.registro.natureza);
anota('reavaliação mudou a classificação: a pendência fica "a confirmar"', R.naturezaDoObjeto({ gate: g('funcionalidade-operacao'), registro: p3.registro }).motivo === 'NATUREZA_A_CONFIRMAR');
anota('Opção nunca é registrada em Regra/Opção', codigos(R.registrarNatureza('it1', 'opcao', g('regra-condicao'), null, conc('opcao'), { auditoriaId: 'a', usuario: U, agora: 1 }, fund('opcao', 'x'))).indexOf('NATUREZA_FORA_DA_CAMADA') !== -1);
anota('sem registro: nada é deduzido', R.naturezaDoObjeto({ gate: g('documento-informacao') }).motivo === 'NATUREZA_NAO_REGISTRADA');

console.log('C. Casos por natureza (a escolha é sempre explícita; a dúvida vira pendência)');
/* [classificação, alternativa escolhida pela pessoa, esperado] — claros, ambíguos e contraditórios */
const CASOS = [
  ['funcionalidade-operacao', 'funcionalidade', { natureza: 'funcionalidade' }], ['funcionalidade-operacao', 'operacao', { natureza: 'operacao' }],
  ['funcionalidade-operacao', 'recorte', { pendencia: 'recorte' }],
  ['processo-etapa', 'processo', { natureza: 'processo' }], ['processo-etapa', 'etapa', { natureza: 'etapa' }], ['processo-etapa', 'evidencia-insuficiente', { pendencia: 'evidencia-insuficiente' }],
  ['documento-informacao', 'informacao', { natureza: 'informacao' }], ['documento-informacao', 'documento', { natureza: 'documento' }], ['documento-informacao', 'recorte', { pendencia: 'recorte' }],
  ['modalidade-subproduto', 'modalidade', { natureza: 'modalidade' }], ['modalidade-subproduto', 'subproduto', { natureza: 'subproduto' }], ['modalidade-subproduto', 'opcao', { natureza: 'opcao' }],
  ['modalidade-subproduto', 'evidencia-insuficiente', { pendencia: 'evidencia-insuficiente' }],
  ['regra-condicao', 'regra', { natureza: 'regra' }], ['regra-condicao', 'opcao-reavaliar', { pendencia: 'reavaliacao-necessaria' }], ['regra-condicao', 'recorte', { pendencia: 'recorte' }]
];
CASOS.forEach(([cl, valor, esp]) => {
  const a = I.alternativa(cl, valor);
  let res;
  if (a.natureza) { const x = R.registrarNatureza('o', a.natureza, g(cl), null, conc(a.natureza), { auditoriaId: 'c', usuario: U, agora: 1 }, fund(a.valor, 'j')); res = x.ok ? { natureza: x.registro.natureza } : { erro: codigos(x).join() }; }
  else { const x = R.registrarPendencia('o', g(cl), null, pend(a.pendencia), { auditoriaId: 'c', usuario: U, agora: 1 }); res = x.ok ? { pendencia: x.registro.pendencia.motivo } : { erro: codigos(x).join() }; }
  anota(cl + ' · ' + valor + ' → ' + JSON.stringify(esp), igual(res, esp), JSON.stringify(res));
});
anota('naturezas diretas (Produto/Serviço, Componente, Canal, Capacidade, Unidade de Valor) não pedem identificação', ['produto', 'componente', 'canal', 'capacidade', 'unidade-valor'].every((n) => !I.diferenciacao(NA.natureza(n).classificacao)));
anota('as 15 naturezas são alcançáveis: 5 diretas + 10 pela identificação orientada', new Set(CASOS.filter((c) => c[2].natureza).map((c) => c[2].natureza)).size === 10);

console.log('D. Coerência do fundamento (núcleo; o banco confere o mesmo em teste-rules-relacoes-objetos.js, seção J)');
const ctxD = { auditoriaId: 'd', usuario: U, agora: 1 };
const errN = (nat, cl, f) => codigos(R.registrarNatureza('o', nat, g(cl), null, conc(nat), ctxD, f));
anota('natureza Funcionalidade com a alternativa "operacao" é recusada', errN('funcionalidade', 'funcionalidade-operacao', fund('operacao', 'j', { definicoes: { funcionalidade: { texto: 'D', versao: 1 } } })).indexOf('ALTERNATIVA_INCOMPATIVEL') !== -1);
anota('natureza com alternativa de pendência ("recorte") é recusada', errN('etapa', 'processo-etapa', fund('recorte', 'j', { definicoes: { etapa: { texto: 'D', versao: 1 } } })).indexOf('ALTERNATIVA_INCOMPATIVEL') !== -1);
anota('alternativa que não existe é recusada', errN('regra', 'regra-condicao', fund('xpto', 'j', { definicoes: { regra: { texto: 'D', versao: 1 } } })).indexOf('ALTERNATIVA_INCOMPATIVEL') !== -1);
anota('versão da orientação diferente da vigente é recusada', errN('processo', 'processo-etapa', fund('processo', 'j', { versao: 2 })).indexOf('VERSAO_ORIENTACAO_DIFERENTE') !== -1);
anota('identificação sem o snapshot da definição oficial da natureza escolhida é recusada', errN('processo', 'processo-etapa', fund('processo', 'j', { definicoes: undefined })).indexOf('DEFINICAO_OFICIAL_AUSENTE') !== -1 &&
  errN('processo', 'processo-etapa', fund('processo', 'j', { definicoes: { etapa: { texto: 'D', versao: 1 } } })).indexOf('DEFINICAO_OFICIAL_AUSENTE') !== -1);
anota('snapshot com natureza que a pergunta não mostra é recusado', errN('processo', 'processo-etapa', fund('processo', 'j', { definicoes: { processo: { texto: 'D', versao: 1 }, regra: { texto: 'R', versao: 1 } } })).indexOf('DEFINICOES_FORA_DA_PERGUNTA') !== -1);
const errP = (cl, p) => codigos(R.registrarPendencia('o', g(cl), null, p, ctxD));
anota('pendência "recorte" com a alternativa de evidência insuficiente é recusada', errP('processo-etapa', pend('recorte', { alternativa: 'evidencia-insuficiente' })).indexOf('ALTERNATIVA_INCOMPATIVEL') !== -1);
anota('pendência com a alternativa de uma natureza é recusada', errP('processo-etapa', pend('evidencia-insuficiente', { alternativa: 'processo' })).indexOf('ALTERNATIVA_INCOMPATIVEL') !== -1);
anota('"reavaliação necessária" sem a alternativa "opcao-reavaliar" é recusada', errP('regra-condicao', pend('reavaliacao-necessaria', { alternativa: 'recorte' })).indexOf('ALTERNATIVA_INCOMPATIVEL') !== -1);
anota('pendência com versão da orientação diferente é recusada', errP('processo-etapa', pend('recorte', { versao: 3 })).indexOf('VERSAO_ORIENTACAO_DIFERENTE') !== -1);
anota('pendência pode guardar as definições mostradas (sem exigir a de natureza nenhuma)', R.registrarPendencia('o', g('processo-etapa'), null, pend('recorte', { definicoes: { processo: { texto: 'D', versao: 1 } } }), ctxD).ok && R.registrarPendencia('o', g('processo-etapa'), null, pend('recorte'), ctxD).ok);

console.log('E. Vínculo com a versão vigente');
const vNat = R.registrarNatureza('it9', 'funcionalidade', g('funcionalidade-operacao', 'nao-produto', 'v1'), null, conc('funcionalidade'), { auditoriaId: 'e1', usuario: U, agora: 1 }, fund('funcionalidade', 'Recurso'));
const mesma = R.naturezaDoObjeto({ gate: g('funcionalidade-operacao', 'nao-produto', 'v2'), registro: vNat.registro });
anota('reavaliação com a MESMA classificação: a natureza da versão anterior fica "a confirmar" (não autoriza)', mesma.natureza === null && mesma.motivo === 'NATUREZA_A_CONFIRMAR' && mesma.confirmar === 'OUTRA_VERSAO' && mesma.avaliacaoRegistro === 'v1' && mesma.registrada === 'funcionalidade');
const outraCl = R.naturezaDoObjeto({ gate: g('processo-etapa', 'nao-produto', 'v2'), registro: vNat.registro });
anota('reavaliação com classificação DIFERENTE: "a confirmar"', outraCl.natureza === null && outraCl.motivo === 'NATUREZA_A_CONFIRMAR');
anota('na própria versão em que foi identificada, vale', R.naturezaDoObjeto({ gate: g('funcionalidade-operacao', 'nao-produto', 'v1'), registro: vNat.registro }).natureza === 'funcionalidade');
const vPend = R.registrarPendencia('it9', g('processo-etapa', 'nao-produto', 'v1'), null, pend('recorte'), { auditoriaId: 'e2', usuario: U, agora: 1 });
const pMesma = R.naturezaDoObjeto({ gate: g('processo-etapa', 'nao-produto', 'v2'), registro: vPend.registro });
anota('pendência de outra versão (mesma classificação) também fica "a confirmar", com a pendência anterior à vista', pMesma.motivo === 'NATUREZA_A_CONFIRMAR' && pMesma.confirmar === 'OUTRA_VERSAO' && pMesma.pendencia.motivo === 'recorte');
const sit = R.situacaoRelacao({ situacao: 'ativa', tipo: 'compoe', naturezaOrigem: 'funcionalidade', naturezaDestino: 'produto' }, { origem: mesma, destino: { natureza: 'produto' } });
anota('relação existente com ponta de outra versão: "a revisar" (nada é encerrado sozinho)', sit.situacao === 'a-revisar');
const rec = R.registrarNatureza('it9', 'funcionalidade', g('funcionalidade-operacao', 'nao-produto', 'v2'), vNat.registro, conc('funcionalidade'), { auditoriaId: 'e3', usuario: U, agora: 2 }, fund('funcionalidade', 'Reconfirmado na v2'));
anota('reconfirmação explícita para a versão vigente: aceita (não é "nada mudou"), revisão + 1, auditoria "alteracao" com a natureza anterior',
  rec.ok && rec.registro.avaliacaoId === 'v2' && rec.registro.revisao === 2 && rec.caminhos[R.NAT_AUD + '/it9/e3'].tipo === 'alteracao' && rec.caminhos[R.NAT_AUD + '/it9/e3'].anterior === 'funcionalidade');
anota('depois da reconfirmação, vale na versão vigente', R.naturezaDoObjeto({ gate: g('funcionalidade-operacao', 'nao-produto', 'v2'), registro: rec.registro }).natureza === 'funcionalidade');
anota('reconfirmar na mesma versão, sem mudar nada: "nada mudou"', codigos(R.registrarNatureza('it9', 'funcionalidade', g('funcionalidade-operacao', 'nao-produto', 'v2'), rec.registro, conc('funcionalidade'), { auditoriaId: 'e4', usuario: U, agora: 3 }, fund('funcionalidade', 'x'))).indexOf('NADA_MUDOU') !== -1);
anota('histórico: a auditoria da 1ª identificação (v1) continua com o fundamento da época', vNat.caminhos[R.NAT_AUD + '/it9/e1'].avaliacaoId === 'v1' && vNat.caminhos[R.NAT_AUD + '/it9/e1'].fundamento.justificativa === 'Recurso');

console.log('\n' + (falhas ? 'FALHAS: ' + falhas + ' de ' + total : 'TUDO OK — ' + total + ' verificações'));
process.exit(falhas ? 1 : 0);
