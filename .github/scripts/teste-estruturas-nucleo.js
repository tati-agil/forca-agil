/* Núcleo de Avaliação, Taxonomia e Mapa da Floresta — ESTRUTURAS ORGANIZACIONAIS CONCRETAS (domínio puro).
 * Só Node: sem navegador, sem Firebase, sem NestJS, sem PostgreSQL. O estado e as referências oficiais vivem em
 * memória; as mudanças são aplicadas por aplicar() — o mesmo contrato que um adaptador de persistência cumprirá.
 * Os conceitos, estruturas e objetos daqui são ILUSTRATIVOS (nomes fictícios); só os códigos firmes vêm do motor real.
 *   0. independência: o arquivo não cita Firebase, banco, DOM, relógio nem sorteio; roda num contexto vazio;
 *      determinístico; não altera o estado recebido.
 *   A. estruturas (E1–E6): criar, tipos admitidos, conceito inativo, identificador nunca reaproveitado, alterar com
 *      histórico, tipo imutável, encerrar com motivo (sem reativação, sem cascata), revisão desatualizada.
 *   B. relações (R1–R7): os 5 tipos, compatibilidade com a Taxonomia (sem herança presumida; com herança só se
 *      oficial), autorrelação, duplicidade, ciclo em "compõe" (direto e indireto), "pertence à disciplina" não é
 *      composição, várias relações válidas da mesma estrutura, alterar = encerrar + criar, situação "a revisar".
 *   C. vínculo de responsável principal (V1–V8): único por objeto, decisão final × recomendação, A_VALIDAR sem
 *      decisão, ligação oficial, tipo incompatível, base preservada, substituir = encerrar + criar, papéis futuros.
 *   D. situação calculada e mudança de Posicionamento: válido / ausente / precisa de revisão / não aplicável;
 *      mesmo código em outra avaliação continua válido; nada muda sozinho.
 *   E. Squad e Capítulo (S1–S3) e separação da liberação para Squad (I2, calculada pelo núcleo do Posicionamento).
 *   F. histórico/auditoria e o contrato aplicar() (tudo ou nada, conflito de revisão).
 *   G. horário: milissegundos UTC (formato canônico) e ISO (compatibilidade com o que já existe) aceitos; inválidos
 *      recusados; o horário recebido é registrado tal como veio; historico() ordena pelo instante real com os dois
 *      formatos misturados; as operações dão o mesmo resultado de negócio nos dois formatos. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ARQ = path.join(__dirname, '..', '..', 'forca-agil', 'estruturas-nucleo.js');
const N = require(ARQ);
const MOTOR = require('../../forca-agil/motor-posicionamento-nucleo.js');

let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
const codigos = (r) => (r.erros || []).map((e) => e.codigo);
const temErro = (r, c) => r.ok === false && codigos(r).indexOf(c) !== -1;
function congelaFundo(o) { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(congelaFundo); } return o; }

/* ---------- referências oficiais (ilustrativas, exceto os códigos firmes do motor) ---------- */
const FIRMES = MOTOR.CODIGOS_FIRMES.slice();
const LIGACOES = {}; FIRMES.forEach((c) => { LIGACOES[c] = c; }); /* correspondência oficial código do motor ↔ conceito de MESMO código */
const conceitos = { LINHA: { ativo: true }, PLATAFORMA: { ativo: true, pai: 'LINHA' }, SQUAD: { ativo: true }, CAPITULO: { ativo: true }, DISCIPLINA: { ativo: true }, VELHO: { ativo: false } };
FIRMES.forEach((c) => { conceitos[c] = { ativo: true, pai: /^PLATAFORMA_/.test(c) ? 'PLATAFORMA' : (c === 'NEGOCIOS' || c === 'ESTRATEGIA_CLIENTES' ? 'LINHA' : undefined) }; });
const REL_CONC = [
  { de: 'SQUAD', tipo: 'compoe', para: 'LINHA', ativa: true },              /* (ilustrativo) Squad compõe Linha */
  { de: 'SQUAD', tipo: 'compoe', para: 'NEGOCIOS', ativa: true },
  { de: 'SQUAD', tipo: 'compoe', para: 'SQUAD', ativa: true },              /* permite testar ciclos entre Squads */
  { de: 'CAPITULO', tipo: 'aloca-em', para: 'SQUAD', ativa: true },
  { de: 'SQUAD', tipo: 'pertence-a-disciplina', para: 'CAPITULO', ativa: true },
  { de: 'CAPITULO', tipo: 'pertence-a-disciplina', para: 'SQUAD', ativa: true },
  { de: 'COE', tipo: 'atende', para: 'NEGOCIOS', ativa: true },
  { de: 'AREA_ESPECIALIZADA', tipo: 'atende', para: 'NEGOCIOS', ativa: false } /* encerrada na Taxonomia */
];
const REF = congelaFundo({ conceitos, relacoesConceituais: REL_CONC, ligacoes: LIGACOES, codigosFirmes: FIRMES, conceitosTrabalho: ['SQUAD', 'CAPITULO'] });
let seq = 0;
const ctx = (novoId, quando) => ({ operacaoId: 'op' + (++seq), novoId, usuario: { id: 'u-arq', email: 'arq@exemplo.org' }, agora: quando || ('2026-10-11T10:' + String(seq % 60).padStart(2, '0') + ':00.000Z') });
let estado = { estruturas: {}, relacoes: {}, vinculos: {} };
const eventos = [];
function exec(r, msg) {
  if (!r.ok) { afirma(false, msg, codigos(r)); return r; }
  const a = N.aplicar(estado, r.mudancas);
  if (!a.ok) { afirma(false, msg + ' (aplicar)', a); return r; }
  estado = a.estado; eventos.push(...r.eventos);
  afirma(true, msg);
  return r;
}

console.log('0. independência de infraestrutura');
const src = fs.readFileSync(ARQ, 'utf8');
const codigoSemComentarios = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
['firebase', 'database()', 'ref(', 'document.', 'localStorage', 'fetch(', 'XMLHttpRequest', 'require(', 'Date.now', 'new Date', 'Math.random', 'postgres', 'SELECT ', 'INSERT ', '@Injectable', 'NestJS', 'setTimeout']
  .forEach((p) => afirma(codigoSemComentarios.indexOf(p) === -1, 'não usa "' + p + '"'));
afirma((codigoSemComentarios.match(/window\./g) || []).length === 1 && /typeof window !== 'undefined'\) window\.faEstruturasNucleo = api/.test(codigoSemComentarios), 'a única menção a window é a exportação opcional');
{ /* contexto VAZIO: sem window, sem module, sem nada além da linguagem */
  const c = vm.createContext({ JSON, Object, Array, String, Number, isNaN, Date: { parse: Date.parse } });
  let ok = true; try { vm.runInContext(src, c); } catch (e) { ok = false; }
  afirma(ok, 'carrega num contexto sem navegador, sem Node e sem banco');
}
{
  const e0 = congelaFundo({ estruturas: {}, relacoes: {}, vinculos: {} });
  const c1 = { operacaoId: 'x', novoId: 'e1', usuario: { id: 'u' }, agora: '2026-10-11T10:00:00.000Z' };
  const r1 = N.criarEstrutura(e0, { tipo: 'NEGOCIOS', nome: 'Linha Fictícia' }, c1, REF), r2 = N.criarEstrutura(e0, { tipo: 'NEGOCIOS', nome: 'Linha Fictícia' }, c1, REF);
  afirma(JSON.stringify(r1) === JSON.stringify(r2), 'determinístico: mesma entrada, mesmo resultado (identificador, autor e horário vêm de quem chama)');
  afirma(Object.keys(e0.estruturas).length === 0 && Object.isFrozen(r1) && Object.isFrozen(r1.mudancas[0].depois), 'não altera o estado recebido; o resultado é imutável');
  afirma(temErro(N.criarEstrutura(e0, { tipo: 'NEGOCIOS', nome: 'x' }, { operacaoId: 'x', usuario: { id: 'u' }, agora: '2026-10-11T10:00:00.000Z' }, REF), 'CONTEXTO_SEM_IDENTIFICADOR') &&
    temErro(N.criarEstrutura(e0, { tipo: 'NEGOCIOS', nome: 'x' }, { operacaoId: 'x', novoId: 'e', agora: '2026-10-11T10:00:00.000Z' }, REF), 'CONTEXTO_SEM_USUARIO') &&
    temErro(N.criarEstrutura(e0, { tipo: 'NEGOCIOS', nome: 'x' }, { operacaoId: 'x', novoId: 'e', usuario: { id: 'u' } }, REF), 'CONTEXTO_SEM_HORARIO'),
    'sem identificador, usuário ou horário fornecidos: recusa (o núcleo não inventa nenhum)');
}

console.log('A. estruturas (E1–E6)');
afirma(JSON.stringify(Object.keys(N.tiposAdmitidos(REF)).sort()) === JSON.stringify(FIRMES.concat(['SQUAD', 'CAPITULO']).sort()), 'tipos admitidos: os 8 firmes (pela ligação oficial) + Squad e Capítulo');
afirma(!N.tiposAdmitidos(Object.assign({}, REF, { ligacoes: {} })).NEGOCIOS, 'sem a ligação oficial, o tipo firme não é admitido (nada presumido)');
exec(N.criarEstrutura(estado, { tipo: 'NEGOCIOS', nome: '  Linha de Negócios Fictícia ', sigla: 'LNF', descricao: 'Exemplo ilustrativo' }, ctx('LNF1'), REF), 'cria estrutura do tipo Negócios (exemplo ilustrativo)');
afirma(estado.estruturas.LNF1.nome === 'Linha de Negócios Fictícia' && estado.estruturas.LNF1.situacao === 'ativa' && estado.estruturas.LNF1.revisao === 1 && estado.estruturas.LNF1.criadaPor.id === 'u-arq', 'nome normalizado, ativa, revisão 1, autoria registrada');
exec(N.criarEstrutura(estado, { tipo: 'AREA_ESPECIALIZADA', nome: 'Área Fictícia' }, ctx('AE1'), REF), 'cria Área Especializada');
exec(N.criarEstrutura(estado, { tipo: 'COE', nome: 'CoE Fictício' }, ctx('COE1'), REF), 'cria CoE');
exec(N.criarEstrutura(estado, { tipo: 'PLATAFORMA_CANAIS', nome: 'Plataforma Fictícia' }, ctx('PC1'), REF), 'cria Plataforma de Canais');
exec(N.criarEstrutura(estado, { tipo: 'SQUAD', nome: 'Squad Alfa' }, ctx('SQA'), REF), 'cria Squad (estrutura concreta)');
exec(N.criarEstrutura(estado, { tipo: 'SQUAD', nome: 'Squad Beta' }, ctx('SQB'), REF), 'cria outra Squad');
exec(N.criarEstrutura(estado, { tipo: 'SQUAD', nome: 'Squad Gama' }, ctx('SQG'), REF), 'cria terceira Squad');
exec(N.criarEstrutura(estado, { tipo: 'CAPITULO', nome: 'Capítulo Fictício' }, ctx('CAP1'), REF), 'cria Capítulo (estrutura concreta)');
afirma(temErro(N.criarEstrutura(estado, { tipo: 'LINHA', nome: 'Linha genérica' }, ctx('X1'), REF), 'TIPO_NAO_ADMITIDO'), 'Linha genérica (intermediário) não é tipo de estrutura');
afirma(temErro(N.criarEstrutura(estado, { tipo: 'DISCIPLINA', nome: 'x' }, ctx('X2'), REF), 'TIPO_NAO_ADMITIDO'), 'conceito auxiliar não é tipo de estrutura');
afirma(temErro(N.criarEstrutura(estado, { tipo: 'NEGOCIOS', nome: 'x' }, ctx('X3'), Object.assign({}, REF, { conceitos: Object.assign({}, conceitos, { NEGOCIOS: { ativo: false } }) })), 'CONCEITO_INATIVO_OU_INEXISTENTE'), 'conceito inativo na Taxonomia: recusa');
afirma(temErro(N.criarEstrutura(estado, { tipo: 'NEGOCIOS', nome: '   ' }, ctx('X4'), REF), 'CAMPO_OBRIGATORIO') && temErro(N.criarEstrutura(estado, { tipo: 'NEGOCIOS', nome: 'x'.repeat(201) }, ctx('X5'), REF), 'CAMPO_LONGO_DEMAIS'), 'nome obrigatório e com limite');
afirma(temErro(N.criarEstrutura(estado, { tipo: 'COE', nome: 'Outro' }, ctx('LNF1'), REF), 'IDENTIFICADOR_JA_USADO'), 'identificador nunca reaproveitado');
exec(N.criarEstrutura(estado, { tipo: 'NEGOCIOS', nome: 'Linha de Negócios Fictícia', sigla: 'LNF' }, ctx('LNF2'), REF), 'mesmo nome e sigla de outra estrutura ativa: aceito (unicidade é decisão em aberto)');
exec(N.alterarEstrutura(estado, 'LNF1', { nome: 'Linha de Negócios Fictícia (renomeada)', descricao: '' }, ctx(), { justificativa: 'ajuste de nome', revisaoEsperada: 1 }), 'altera nome e limpa descrição');
const evAlt = eventos[eventos.length - 1];
afirma(evAlt.tipo === 'estrutura.alterada' && evAlt.antes.nome === 'Linha de Negócios Fictícia' && evAlt.depois.nome === 'Linha de Negócios Fictícia (renomeada)' && evAlt.campos.join() === 'nome,descricao' && evAlt.justificativa === 'ajuste de nome' && estado.estruturas.LNF1.revisao === 2,
  'histórico da alteração: antes, depois, campos, justificativa, revisão 2');
afirma(temErro(N.alterarEstrutura(estado, 'LNF1', { tipo: 'COE' }, ctx()), 'TIPO_IMUTAVEL'), 'tipo imutável');
afirma(temErro(N.alterarEstrutura(estado, 'LNF1', { nome: 'x' }, ctx(), { revisaoEsperada: 1 }), 'REVISAO_DESATUALIZADA'), 'revisão desatualizada: recusa');
afirma(temErro(N.alterarEstrutura(estado, 'LNF1', { nome: 'Linha de Negócios Fictícia (renomeada)' }, ctx()), 'NADA_A_ALTERAR'), 'sem mudança real: recusa');
afirma(temErro(N.alterarEstrutura(estado, 'LNF1', { situacao: 'encerrada' }, ctx()), 'CAMPO_NAO_ALTERAVEL'), 'situação não muda por alteração (só por encerramento)');
afirma(temErro(N.encerrarEstrutura(estado, 'COE1', '  ', ctx()), 'MOTIVO_OBRIGATORIO'), 'encerrar exige motivo');
exec(N.encerrarEstrutura(estado, 'COE1', 'Estrutura extinta (ilustrativo)', ctx()), 'encerra estrutura com motivo');
afirma(estado.estruturas.COE1 && estado.estruturas.COE1.situacao === 'encerrada' && estado.estruturas.COE1.encerramento.motivo === 'Estrutura extinta (ilustrativo)', 'encerrada, não apagada, com motivo e autoria');
afirma(temErro(N.encerrarEstrutura(estado, 'COE1', 'de novo', ctx()), 'ESTRUTURA_ENCERRADA') && temErro(N.alterarEstrutura(estado, 'COE1', { nome: 'x' }, ctx()), 'ESTRUTURA_ENCERRADA'), 'estrutura encerrada não é alterada nem reencerrada');
afirma(!('reativarEstrutura' in N) && !('excluirEstrutura' in N) && !('apagar' in N), 'não há operação de reativação nem de exclusão');
afirma(!Object.keys(N).some((k) => /avaliac|deAvaliacao|automatic/i.test(k) && /criar|gerar/i.test(k)), 'E6: nenhuma operação cria estrutura a partir de avaliação');

console.log('B. relações entre estruturas (R1–R7)');
exec(N.criarRelacao(estado, { origem: 'SQA', tipo: 'compoe', destino: 'LNF1', justificativa: 'ilustrativo' }, ctx('R1'), REF), 'Squad Alfa compõe a Linha de Negócios (Taxonomia admite Squad compõe Negócios)');
exec(N.criarRelacao(estado, { origem: 'SQB', tipo: 'compoe', destino: 'LNF1' }, ctx('R2'), REF), 'outra Squad compõe a mesma Linha');
afirma(temErro(N.criarRelacao(estado, { origem: 'SQA', tipo: 'compoe', destino: 'PC1' }, ctx('X'), REF), 'RELACAO_NAO_ADMITIDA_PELA_TAXONOMIA'), 'Squad compõe Plataforma de Canais: a Taxonomia não admite diretamente — sem herança presumida');
afirma(N.criarRelacao(estado, { origem: 'SQG', tipo: 'compoe', destino: 'PC1' }, ctx('X'), Object.assign({}, REF, { herancaPeloPai: true })).ok, '…com herança OFICIAL pelo pai (Plataforma → Linha), passa a ser admitida');
/* C3 (decisão aprovada na M6/M7): uma Squad compõe no máximo UMA Linha ativa */
afirma(temErro(N.criarRelacao(estado, { origem: 'SQA', tipo: 'compoe', destino: 'LNF2' }, ctx('X'), REF), 'COMPOSICAO_ATIVA_JA_EXISTE'), 'C3: a mesma Squad NÃO compõe uma segunda Linha (no máximo uma Linha ativa)');
exec(N.criarRelacao(estado, { origem: 'SQG', tipo: 'compoe', destino: 'LNF2' }, ctx('R3'), REF), 'outra Squad compõe a segunda Linha');
afirma(temErro(N.criarRelacao(estado, { origem: 'SQA', tipo: 'compoe', destino: 'LNF1' }, ctx('X'), REF), 'RELACAO_DUPLICADA'), 'duplicidade ativa: recusa');
afirma(temErro(N.criarRelacao(estado, { origem: 'SQA', tipo: 'compoe', destino: 'SQA' }, ctx('X'), REF), 'AUTORRELACAO'), 'autorrelação: recusa');
afirma(temErro(N.criarRelacao(estado, { origem: 'SQA', tipo: 'gerencia', destino: 'LNF1' }, ctx('X'), REF), 'TIPO_RELACAO_INVALIDO'), 'só os 5 tipos da Taxonomia');
afirma(temErro(N.criarRelacao(estado, { origem: 'AE1', tipo: 'atende', destino: 'LNF1' }, ctx('X'), REF), 'RELACAO_NAO_ADMITIDA_PELA_TAXONOMIA'), 'relação conceitual encerrada na Taxonomia não admite relação nova');
afirma(temErro(N.criarRelacao(estado, { origem: 'COE1', tipo: 'atende', destino: 'LNF1' }, ctx('X'), REF), 'ESTRUTURA_ENCERRADA'), 'estrutura encerrada não recebe relação nova');
exec(N.criarRelacao(estado, { origem: 'SQA', tipo: 'compoe', destino: 'SQB' }, ctx('R4'), REF), 'Squad Alfa compõe Squad Beta (ilustrativo)');
exec(N.criarRelacao(estado, { origem: 'SQB', tipo: 'compoe', destino: 'SQG' }, ctx('R5'), REF), 'Squad Beta compõe Squad Gama');
afirma(temErro(N.criarRelacao(estado, { origem: 'SQB', tipo: 'compoe', destino: 'SQA' }, ctx('X'), REF), 'CICLO_NA_COMPOSICAO'), 'ciclo direto em "compõe": recusa');
afirma(temErro(N.criarRelacao(estado, { origem: 'SQG', tipo: 'compoe', destino: 'SQA' }, ctx('X'), REF), 'CICLO_NA_COMPOSICAO'), 'ciclo indireto (Gama → Alfa → Beta → Gama): recusa');
exec(N.criarRelacao(estado, { origem: 'SQA', tipo: 'pertence-a-disciplina', destino: 'CAP1' }, ctx('R6'), REF), 'Squad pertence à disciplina do Capítulo');
afirma(N.criarRelacao(estado, { origem: 'CAP1', tipo: 'pertence-a-disciplina', destino: 'SQA' }, ctx('X'), REF).ok, '"pertence à disciplina" no sentido contrário não é tratado como ciclo de composição');
exec(N.criarRelacao(estado, { origem: 'CAP1', tipo: 'aloca-em', destino: 'SQA' }, ctx('R7'), REF), 'Capítulo aloca em Squad');
const rel = N.relacoesDaEstrutura(estado, 'SQA');
afirma(rel.saida.length === 3 && rel.entrada.length === 1, 'a mesma estrutura participa de várias relações válidas (3 de saída, 1 de entrada)', rel);
afirma(N.relacoesPossiveis(estado, 'SQA', REF).every((p) => !(p.tipo === 'compoe' && p.destino === 'LNF2')), 'C3: relações possíveis não oferecem uma segunda Linha à Squad que já compõe uma');
afirma(N.relacoesPossiveis(estado, 'SQG', REF).every((p) => !(p.tipo === 'compoe' && p.destino === 'SQA')), 'relações possíveis: não oferece a que formaria ciclo');
exec(N.alterarRelacao(estado, 'R3', { destino: 'LNF1' }, 'Troca de Linha', ctx('R3b'), REF), 'alterar = encerrar a antiga e criar a nova, juntas (C3: trocar de Linha é substituir, com motivo)');
afirma(estado.relacoes.R3.situacao === 'encerrada' && estado.relacoes.R3.encerramento.substituidaPor === 'R3b' && estado.relacoes.R3b.substitui === 'R3' && estado.relacoes.R3b.origem === 'SQG', 'a antiga fica encerrada apontando para a nova; nada apagado');
afirma(temErro(N.alterarRelacao(estado, 'R3b', {}, 'x', ctx('R3c'), REF), 'NADA_A_ALTERAR') && temErro(N.alterarRelacao(estado, 'R3b', { destino: 'PC1' }, '', ctx('R3c'), REF), 'MOTIVO_OBRIGATORIO'), 'alterar exige mudança e motivo');
afirma(temErro(N.encerrarRelacao(estado, 'R1', '', ctx()), 'MOTIVO_OBRIGATORIO'), 'encerrar relação exige motivo');
exec(N.encerrarRelacao(estado, 'R5', 'Fim da composição (ilustrativo)', ctx()), 'encerra relação');
afirma(N.criarRelacao(estado, { origem: 'SQG', tipo: 'compoe', destino: 'SQA' }, ctx('X'), REF).ok, 'com a composição encerrada, o caminho que formava ciclo deixa de contar');
afirma(N.situacaoRelacao(estado, 'R1', REF).situacao === 'valida', 'relação ativa e admitida: válida');
{ /* C3 depois de encerrar e sob concorrência (referência em memória: violacoesDeUnicidade com as referências) */
  const e2 = N.aplicar(estado, N.encerrarRelacao(estado, 'R3b', 'Squad saiu da Linha', ctx()).mudancas).estado;
  afirma(N.criarRelacao(e2, { origem: 'SQG', tipo: 'compoe', destino: 'LNF2' }, ctx('X'), REF).ok, 'C3: com a composição encerrada, a Squad pode compor outra Linha');
  const a1 = N.criarRelacao(e2, { origem: 'SQG', tipo: 'compoe', destino: 'LNF2' }, ctx('C1'), REF), a2 = N.criarRelacao(e2, { origem: 'SQG', tipo: 'compoe', destino: 'LNF1' }, ctx('C2'), REF);
  const juntas = N.aplicar(N.aplicar(e2, a1.mudancas).estado, a2.mudancas).estado;
  afirma(a1.ok && a2.ok && N.violacoesDeUnicidade(juntas, REF).some((v) => v.codigo === 'COMPOSICAO_ATIVA_JA_EXISTE') && !N.violacoesDeUnicidade(N.aplicar(e2, a1.mudancas).estado, REF).length,
    'C3 sob concorrência: duas composições da mesma Squad decididas no mesmo estado → a persistência acusa a violação');
  const d1 = N.criarRelacao(e2, { origem: 'CAP1', tipo: 'aloca-em', destino: 'SQB' }, ctx('D1'), REF), d2 = N.criarRelacao(e2, { origem: 'CAP1', tipo: 'aloca-em', destino: 'SQB' }, ctx('D2'), REF);
  afirma(N.violacoesDeUnicidade(N.aplicar(N.aplicar(e2, d1.mudancas).estado, d2.mudancas).estado).some((v) => v.codigo === 'RELACAO_DUPLICADA'), 'relação ativa duplicada sob concorrência → a persistência acusa a violação');
}
const refSemSquadNeg = Object.assign({}, REF, { relacoesConceituais: REL_CONC.map((r) => (r.de === 'SQUAD' && r.para === 'NEGOCIOS' ? Object.assign({}, r, { ativa: false }) : r)) });
const sr = N.situacaoRelacao(estado, 'R1', refSemSquadNeg);
afirma(sr.situacao === 'a-revisar' && sr.motivos.join() === 'TAXONOMIA_NAO_ADMITE_MAIS' && estado.relacoes.R1.situacao === 'ativa', 'R7: Taxonomia deixou de admitir → "a revisar", sem encerrar sozinha');

console.log('C. vínculo de responsável principal (V1–V8)');
const posRec = (cod, av) => ({ avaliacaoId: av || 'gA1', recomendacao: { codigoResultado: cod } });
const posDec = (rec, fin, av) => ({ avaliacaoId: av || 'gA1', recomendacao: { codigoResultado: rec }, decisao: { codigoFinal: fin } });
afirma(JSON.stringify(N.posicionamentoEfetivo(posDec('NEGOCIOS', 'AREA_ESPECIALIZADA'), REF)) === JSON.stringify({ codigo: 'AREA_ESPECIALIZADA', origem: 'decisao', avaliacaoId: 'gA1' }), 'efetivo: a decisão final prevalece sobre a recomendação');
afirma(N.posicionamentoEfetivo(posRec('NEGOCIOS'), REF).origem === 'recomendacao', 'sem decisão: a recomendação firme');
afirma(N.posicionamentoEfetivo(posRec('A_VALIDAR'), REF).codigo === null && N.posicionamentoEfetivo(posRec('LINHA'), REF).codigo === null && N.posicionamentoEfetivo(null, REF).motivo === 'SEM_POSICIONAMENTO_VIGENTE', 'A_VALIDAR sem decisão, código não firme ou sem Posicionamento: sem efetivo');
afirma(temErro(N.vincularResponsavel(estado, { objetoId: 'item1', estruturaId: 'LNF1' }, posRec('A_VALIDAR'), ctx('V0'), REF), 'SEM_POSICIONAMENTO_EFETIVO'), 'A_VALIDAR sem decisão final: não vincula');
afirma(temErro(N.vincularResponsavel(estado, { objetoId: 'item1', estruturaId: 'AE1' }, posRec('NEGOCIOS'), ctx('V0'), REF), 'TIPO_INCOMPATIVEL'), 'efetivo Negócios × estrutura Área Especializada: tipo incompatível');
afirma(temErro(N.vincularResponsavel(estado, { objetoId: 'item1', estruturaId: 'LNF1' }, posRec('NEGOCIOS'), ctx('V0'), Object.assign({}, REF, { ligacoes: {} })), 'LIGACAO_OFICIAL_AUSENTE'), 'sem a correspondência oficial código ↔ conceito: não vincula');
afirma(temErro(N.vincularResponsavel(estado, { objetoId: 'item1', estruturaId: 'SQA' }, posRec('NEGOCIOS'), ctx('V0'), REF), 'TIPO_INCOMPATIVEL'), 'Squad não é responsável principal (o tipo nunca corresponde a um posicionamento)');
afirma(temErro(N.vincularResponsavel(estado, { objetoId: 'item1', estruturaId: 'LNF1', papel: 'atuacao-squad' }, posRec('NEGOCIOS'), ctx('V0'), REF), 'PAPEL_NAO_SUPORTADO'), 'outros papéis ainda não suportados (modelo preparado: campo papel)');
exec(N.vincularResponsavel(estado, { objetoId: 'item1', estruturaId: 'LNF1', justificativa: 'A Linha responsável (ilustrativo)' }, posRec('NEGOCIOS', 'gA1'), ctx('V1'), REF), 'vincula pela recomendação firme');
afirma(JSON.stringify(estado.vinculos.V1.base) === JSON.stringify({ avaliacaoId: 'gA1', codigo: 'NEGOCIOS', origem: 'recomendacao' }) && estado.vinculos.V1.papel === 'responsavel-principal', 'base registrada: avaliação, código e origem');
afirma(temErro(N.vincularResponsavel(estado, { objetoId: 'item1', estruturaId: 'LNF2' }, posRec('NEGOCIOS'), ctx('V9'), REF), 'RESPONSAVEL_PRINCIPAL_JA_EXISTE'), 'um responsável principal ativo por objeto');
exec(N.vincularResponsavel(estado, { objetoId: 'item2', estruturaId: 'AE1' }, posDec('NEGOCIOS', 'AREA_ESPECIALIZADA', 'gB1'), ctx('V2'), REF), 'vincula pela decisão final (divergente da recomendação)');
afirma(estado.vinculos.V2.base.origem === 'decisao' && estado.vinculos.V2.base.codigo === 'AREA_ESPECIALIZADA', 'base: decisão final');
afirma(temErro(N.vincularResponsavel(estado, { objetoId: 'item3', estruturaId: 'COE1' }, posRec('COE', 'gC1'), ctx('V0'), REF), 'ESTRUTURA_ENCERRADA'), 'estrutura encerrada não recebe vínculo novo');
afirma(temErro(N.substituirResponsavel(estado, 'V1', { estruturaId: 'LNF2' }, '', posRec('NEGOCIOS'), ctx('V1b'), REF), 'MOTIVO_OBRIGATORIO'), 'substituir exige motivo');
exec(N.substituirResponsavel(estado, 'V1', { estruturaId: 'LNF2' }, 'Mudança de Linha responsável (ilustrativo)', posRec('NEGOCIOS', 'gA1'), ctx('V1b'), REF), 'substituir = encerrar o vínculo e criar o novo, juntos');
afirma(estado.vinculos.V1.situacao === 'encerrada' && estado.vinculos.V1.encerramento.substituidoPor === 'V1b' && estado.vinculos.V1b.substitui === 'V1' && N.responsavelAtivo(estado, 'item1').id === 'V1b', 'o anterior fica encerrado apontando para o novo; um só ativo');
afirma(temErro(N.substituirResponsavel(estado, 'V1b', { estruturaId: 'AE1' }, 'x', posRec('NEGOCIOS'), ctx('V1c'), REF), 'TIPO_INCOMPATIVEL'), 'a substituição passa pelas mesmas regras');
afirma(N.objetosDaEstrutura(estado, 'LNF2').map((o) => o.objetoId).join() === 'item1' && !N.objetosDaEstrutura(estado, 'LNF1').length, 'consulta: objetos de cada estrutura (só vínculos ativos)');

console.log('D. situação calculada e mudança de Posicionamento');
const antes = JSON.stringify(estado);
afirma(N.situacaoResponsavel(estado, 'item1', posRec('NEGOCIOS', 'gA1'), REF).situacao === 'valido', 'válido');
const mesmo = N.situacaoResponsavel(estado, 'item1', posRec('NEGOCIOS', 'gA2'), REF);
afirma(mesmo.situacao === 'valido' && mesmo.baseEmOutraAvaliacao === true && mesmo.vinculo.base.avaliacaoId === 'gA1', 'reavaliação com o MESMO código efetivo: continua válido; a base original fica preservada');
const mudou = N.situacaoResponsavel(estado, 'item1', posRec('ESTRATEGIA_CLIENTES', 'gA2'), REF);
afirma(mudou.situacao === 'precisa-revisao' && mudou.motivos.indexOf('CODIGO_EFETIVO_MUDOU') !== -1, 'código efetivo mudou: precisa de revisão');
afirma(N.situacaoResponsavel(estado, 'item1', posDec('NEGOCIOS', 'COE', 'gA1'), REF).situacao === 'precisa-revisao', 'decisão final registrada depois, com outro código: precisa de revisão');
afirma(N.situacaoResponsavel(estado, 'item1', posRec('A_VALIDAR', 'gA3'), REF).motivos.join() === 'POSICIONAMENTO_SEM_CODIGO_FIRME', 'nova avaliação A_VALIDAR sem decisão: precisa de revisão');
afirma(N.situacaoResponsavel(estado, 'item1', null, REF).motivos.join() === 'POSICIONAMENTO_DEIXOU_DE_VALER', 'sem Posicionamento vigente: precisa de revisão');
afirma(N.situacaoResponsavel(estado, 'item9', posRec('COE', 'gZ'), REF).situacao === 'ausente', 'posicionamento firme sem vínculo: ausente');
afirma(N.situacaoResponsavel(estado, 'item9', posRec('A_VALIDAR', 'gZ'), REF).situacao === 'nao-aplicavel' && N.situacaoResponsavel(estado, 'item9', null, REF).situacao === 'nao-aplicavel', 'sem posicionamento efetivo e sem vínculo: não aplicável');
afirma(JSON.stringify(estado) === antes, 'calcular situações não altera nada (nenhum vínculo muda sozinho)');
exec(N.encerrarEstrutura(estado, 'AE1', 'Reorganização (ilustrativo)', ctx()), 'encerra a estrutura responsável do item2');
const encS = N.situacaoResponsavel(estado, 'item2', posDec('NEGOCIOS', 'AREA_ESPECIALIZADA', 'gB1'), REF);
afirma(encS.situacao === 'precisa-revisao' && encS.motivos.join() === 'ESTRUTURA_ENCERRADA' && estado.vinculos.V2.situacao === 'ativa', 'estrutura encerrada: o vínculo continua registrado e passa a "precisa de revisão" (sem cascata)');

console.log('E. Squad e Capítulo; separação da liberação para Squad (I2)');
afirma(estado.estruturas.SQA.tipo === 'SQUAD' && estado.estruturas.CAP1.tipo === 'CAPITULO', 'S1: Squad e Capítulo são estruturas concretas');
afirma(!Object.values(estado.vinculos).some((v) => estado.estruturas[v.estruturaId].tipo === 'SQUAD'), 'S3: nenhum vínculo objeto × Squad nesta entrega');
{ /* a liberação vem do núcleo do Posicionamento (I2), carregado à parte; o núcleo de estruturas não a lê nem a altera */
  const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
  const c = { console: { log() {}, warn() {}, error() {} }, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {} };
  c.window = c; c.addEventListener = () => {};
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  c.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  c.navigator = {}; c.location = { hash: '' }; c.localStorage = { getItem() { return null; }, setItem() {} };
  c.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); }, child() { return this; }, push() { return { key: 'k' }; } }) }), auth: () => ({ currentUser: null, onAuthStateChanged() {} }) };
  vm.createContext(c);
  ['motor-posicionamento-nucleo.js', 'governanca-posicionamento.js', 'questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'motor-posicionamento.js', 'avaliacao-posicionamento.js']
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), c, { filename: f }));
  const T = c.faAvaliacaoPosicionamentoNucleo;
  const regs = { gB1: { status: 'concluido', resultadoAutomatico: { codigoResultado: 'NEGOCIOS', liberaSquad: true } }, gA1: { status: 'concluido', resultadoAutomatico: { codigoResultado: 'NEGOCIOS', liberaSquad: true } } };
  const decs = { gB1: { codigoFinal: 'AREA_ESPECIALIZADA', liberaSquad: false } };
  const lib2 = T.liberacaoSquad('item2', { vigentes: { item2: 'gB1' }, registros: regs, decisoes: decs });
  const lib9 = T.liberacaoSquad('item9', { vigentes: { item9: 'gA1' }, registros: regs, decisoes: {} });
  afirma(lib2.situacao === 'nao-liberado' && N.responsavelAtivo(estado, 'item2') !== null, 'item com responsável principal (Área Especializada) e Squad NÃO liberada: as duas informações coexistem');
  afirma(lib9.situacao === 'liberado' && N.situacaoResponsavel(estado, 'item9', posRec('NEGOCIOS', 'gA1'), REF).situacao === 'ausente', 'item com Squad liberada e sem responsável principal: "ausente" — a liberação não cria vínculo');
  afirma(!/liberaSquad|liberacao/i.test(codigoSemComentarios), 'o núcleo de estruturas não lê nem calcula a liberação para Squad');
}

console.log('F. histórico, auditoria e o contrato aplicar()');
const hV1 = N.historico(eventos, 'vinculo', 'V1');
afirma(hV1.map((e) => e.tipo).join() === 'vinculo.criado,vinculo.encerrado' && hV1[1].motivo === 'Mudança de Linha responsável (ilustrativo)' && hV1[1].antes.situacao === 'ativa' && hV1[1].depois.situacao === 'encerrada', 'histórico do vínculo: criado e encerrado, com motivo, antes e depois');
const hLNF1 = N.historico(eventos, 'estrutura', 'LNF1');
afirma(hLNF1.map((e) => e.tipo).join() === 'estrutura.criada,estrutura.alterada' && hLNF1.every((e) => e.usuario.id === 'u-arq' && typeof e.em === 'string' && e.operacaoId), 'histórico da estrutura com autor, horário e operação');
const ops = eventos.filter((e) => e.operacaoId === hV1[1].operacaoId);
afirma(ops.length === 2 && ops.map((e) => e.tipo).join() === 'vinculo.encerrado,vinculo.criado', 'a substituição gera os dois eventos na mesma operação');
afirma(new Set(eventos.map((e) => e.id)).size === eventos.length, 'cada evento tem identificador próprio (derivado da operação fornecida por quem chama)');
{
  const r = N.criarEstrutura(estado, { tipo: 'COE', nome: 'Concorrente' }, ctx('CC1'), REF);
  const ok1 = N.aplicar(estado, r.mudancas), ok2 = N.aplicar(ok1.estado, r.mudancas);
  afirma(ok1.ok && !ok2.ok && ok2.erro === 'CONFLITO_DE_REVISAO', 'aplicar: a mesma criação duas vezes → conflito (identificador já existe)');
  const a1 = N.alterarEstrutura(estado, 'LNF1', { sigla: 'A' }, ctx()), a2 = N.alterarEstrutura(estado, 'LNF1', { sigla: 'B' }, ctx());
  const p1 = N.aplicar(estado, a1.mudancas), p2 = N.aplicar(p1.estado, a2.mudancas);
  afirma(p1.ok && !p2.ok && p2.erro === 'CONFLITO_DE_REVISAO', 'aplicar: duas alterações concorrentes da mesma revisão → só a primeira entra');
  const s = N.substituirResponsavel(estado, 'V1b', { estruturaId: 'LNF1' }, 'volta (ilustrativo)', posRec('NEGOCIOS', 'gA1'), ctx('V1c'), REF);
  const quebrado = s.mudancas.map((m, i) => (i === 1 ? Object.assign({}, m, { revisaoAnterior: 7, antes: { revisao: 7 } }) : m));
  const pr = N.aplicar(estado, quebrado);
  afirma(!pr.ok && JSON.stringify(estado.vinculos.V1b) === JSON.stringify(N.aplicar(estado, []).estado.vinculos.V1b), 'aplicar é tudo ou nada: se uma mudança conflita, nenhuma entra');
}

console.log('G. horário: milissegundos UTC e ISO');
{
  const refG = { conceitos: { NEGOCIOS: { ativo: true } }, relacoesConceituais: [], ligacoes: { NEGOCIOS: 'NEGOCIOS' }, codigosFirmes: FIRMES, conceitosTrabalho: [] };
  const usu = { id: 'u1', email: 'u1@exemplo' };
  const MS = 1791763200000, ISO = new Date(MS).toISOString();
  const rMs = N.criarEstrutura({}, { tipo: 'NEGOCIOS', nome: 'Linha G' }, { operacaoId: 'g1', novoId: 'G1', usuario: usu, agora: MS }, refG);
  const rIso = N.criarEstrutura({}, { tipo: 'NEGOCIOS', nome: 'Linha G' }, { operacaoId: 'g1', novoId: 'G1', usuario: usu, agora: ISO }, refG);
  afirma(rMs.ok && rMs.mudancas[0].depois.criadaEm === MS && rMs.eventos[0].em === MS, 'milissegundos aceitos e registrados tal como vieram (estrutura e evento)');
  afirma(rIso.ok && rIso.mudancas[0].depois.criadaEm === ISO, 'ISO continua aceito (registros e backend existentes)');
  const semHora = (v) => temErro(N.criarEstrutura({}, { tipo: 'NEGOCIOS', nome: 'X' }, { operacaoId: 'g', novoId: 'GX', usuario: usu, agora: v }, refG), 'CONTEXTO_SEM_HORARIO');
  afirma([0, -1, 1.5, NaN, Infinity, '', 'ontem', null, undefined, {}].every(semHora), 'horário inválido recusado: 0, negativo, fracionário, NaN, Infinity, vazio, texto sem data, nulo, objeto');
  const neutro = (r) => JSON.stringify(r, (k, v) => (['criadaEm', 'em', 'alteradaEm'].indexOf(k) !== -1 ? '#' : v));
  afirma(neutro(rMs) === neutro(rIso), 'mesmo resultado de negócio nos dois formatos (só o horário difere)');
  const estG = N.aplicar({}, rMs.mudancas).estado;
  const alt = N.alterarEstrutura(estG, 'G1', { nome: 'Linha G2' }, { operacaoId: 'g2', usuario: usu, agora: ISO.replace('T', 'T').replace(/\d\d\.\d{3}Z$/, '59.000Z') }, {});
  const enc = N.encerrarEstrutura(N.aplicar(estG, alt.mudancas).estado, 'G1', 'motivo', { operacaoId: 'g3', usuario: usu, agora: MS + 120000 });
  const evs = [enc.eventos[0], rMs.eventos[0], alt.eventos[0]];
  afirma(alt.ok && enc.ok && JSON.stringify(N.historico(evs, 'estrutura', 'G1').map((e) => e.tipo)) === '["estrutura.criada","estrutura.alterada","estrutura.encerrada"]',
    'historico() ordena pelo instante real com milissegundos e ISO misturados');
  afirma(N.instante(MS) === MS && N.instante(ISO) === MS && N.instante('x') === null, 'instante() converte os dois formatos para o mesmo instante');
}

console.log('\n== H. Subagrupadores das Linhas de Negócios (Etapa 5): situações CALCULADAS ==');
{
  const u = { id: 'u1', email: 'a@b.c' };
  const est = (id, tipo, situacao) => ({ id, tipo, nome: id, situacao: situacao || 'ativa', criadaEm: 1, criadaPor: u, revisao: 1 });
  const sg = (id, nome, ordem, situacao) => ({ id, bloco: 'NEGOCIOS', nome, ordem, situacao: situacao || 'ativo', criadoEm: 1, criadoPor: u, revisao: 1 });
  const as = (id, estruturaId, subagrupadorId, situacao) => ({ id, estruturaId, subagrupadorId, situacao: situacao || 'ativa', criadaEm: 1, criadaPor: u, revisao: 1 });
  const E = congelaFundo({
    estruturas: { L1: est('L1', 'NEGOCIOS'), L2: est('L2', 'NEGOCIOS'), L3: est('L3', 'NEGOCIOS'), L4: est('L4', 'NEGOCIOS'), LX: est('LX', 'NEGOCIOS', 'encerrada'), AE: est('AE', 'AREA_ESPECIALIZADA') },
    subagrupadores: { P: sg('P', 'Previdência', 20), C: sg('C', 'Crédito', 10), B: sg('B', 'Benefícios', 20), Z: sg('Z', 'Extinto', 5, 'encerrado') },
    associacoesSubagrupador: { a1: as('a1', 'L1', 'P'), a0: as('a0', 'L2', 'C', 'encerrada'), a2: as('a2', 'L3', 'Z'), a3: as('a3', 'LX', 'P') }
  });
  afirma(N.subagrupadoresAtivos(E).map((s) => s.id).join() === 'C,B,P', 'ativos na ordem; empate de ordem desfeito pelo nome; encerrado fora', N.subagrupadoresAtivos(E).map((s) => s.id));
  const sit = (id) => N.subagrupadorDaLinha(E, id).situacao;
  afirma(sit('L1') === 'associada' && N.subagrupadorDaLinha(E, 'L1').subagrupador.id === 'P', 'Linha com associação ativa a subagrupador ativo: "associada"');
  afirma(sit('L2') === 'sem-subagrupador', 'Linha cuja associação foi encerrada: "sem-subagrupador" (o histórico continua lá)');
  afirma(sit('L3') === 'subagrupador-encerrado', 'Linha associada a subagrupador encerrado: aparece como sem subagrupador, sem nada em cascata');
  afirma(sit('L4') === 'sem-subagrupador' && sit('AE') === 'nao-se-aplica', 'Linha nunca associada: "sem-subagrupador"; Área Especializada: "nao-se-aplica"');
  afirma(N.linhasDoSubagrupador(E, 'P').map((s) => s.id).join() === 'L1', 'Linhas dentro de um subagrupador: só as ATIVAS associadas a ele (a encerrada some do Mapa)');
  afirma(N.linhasDoSubagrupador(E, 'Z').length === 0, 'subagrupador encerrado não tem Linhas no Mapa');
  afirma(N.violacoesDeUnicidade(E).length === 0, 'estado consistente: nenhuma Linha com duas associações ativas');
  const duplo = JSON.parse(JSON.stringify(E)); duplo.associacoesSubagrupador.a9 = as('a9', 'L1', 'C');
  afirma(N.violacoesDeUnicidade(duplo).length === 1 && N.violacoesDeUnicidade(duplo)[0].codigo === 'LINHA_JA_ASSOCIADA', 'duas associações ativas da mesma Linha: violação que a persistência recusa');
  const r = N.associarLinha(E, { estruturaId: 'L4', subagrupadorId: 'C' }, { operacaoId: 'op', novoId: 'n1', usuario: u, agora: 5 });
  const ap = r.ok && N.aplicar(E, r.mudancas);
  afirma(ap && ap.ok && N.subagrupadorDaLinha(ap.estado, 'L4').situacao === 'associada' && E.associacoesSubagrupador.n1 === undefined, 'aplicar() grava a associação sem tocar no estado recebido');
}

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
