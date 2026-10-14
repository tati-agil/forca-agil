/* Porta 2 · ANÁLISE ORGANIZACIONAL — núcleo puro (forca-agil/analises-organizacionais-nucleo.js). Só Node: sem navegador,
 * sem Firebase, sem PostgreSQL. Nenhuma tela usa o núcleo ainda (PR 1 da especificação aprovada).
 *   0. independência: sem Firebase, DOM, relógio, sorteio nem import; roda num contexto vazio; API congelada;
 *      não cita nenhum código nem nome de posicionamento (classificar é só do O1–O9).
 *   A. matriz F1–F17: perguntas e respostas sem tipo organizacional; caminho da "responsabilidade única" (F2a).
 *   B. criação e validações de entrada; capacidade como referência estável (sem fonte oficial presumida).
 *   C. agrupamento: semelhança só SUGERE comparar; nunca funde; sete critérios; conclusão contra os indícios exige
 *      justificativa; regressão políticas de SI × diretrizes contratuais.
 *   D. portão do O1–O9 (N5): delimitação suficiente; responsável formal conhecido, provável ou não definido; origem
 *      única da atuação; referência N:N sem trocar a origem.
 *   E. N3: nenhuma alternativa reclassifica; situação formal nos sete casos; nada além de análise/proposta/aprovação.
 *   F. N1: aprovação como referência a ato externo; proposta pendente não se aprova; uma aprovação por versão.
 *   G. N2/N4: fatos descritivos com caráter, fonte e data; "exerce, segundo a análise" separado do vínculo.
 *   H. casos de estresse da TI (cenarios/analises-organizacionais-ti.v1.json), em sequência sobre o mesmo estado.
 *   I. aplicar(): tudo ou nada, conflito de revisão; revisão esperada; estado recebido nunca alterado. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ARQ = path.join(__dirname, '..', '..', 'forca-agil', 'analises-organizacionais-nucleo.js');
const N = require(ARQ);
const MOTOR = require('../../forca-agil/motor-posicionamento-nucleo.js');
const CENARIOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'cenarios', 'analises-organizacionais-ti.v1.json'), 'utf8'));

let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
const codigo = (r) => (r && r.erros ? r.erros.map((e) => e.codigo) : []);
const temErro = (r, c) => r && r.ok === false && codigo(r).indexOf(c) !== -1;
function congelaFundo(o) { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(congelaFundo); } return o; }

/* estado em memória + aplicação das mudanças (o que um adaptador de persistência fará) */
let seq = 0, relogio = 1791990000000;
const USUARIO = { id: 'u-arq', email: 'arquitetura@exemplo.test' };
const ctx = (novoId, usuario) => ({ operacaoId: 'op-' + (++seq), novoId, usuario: usuario || USUARIO, agora: (relogio += 1000) });
let estado = {}, eventos = [];
function aplicar(r, rotulo) {
  if (!r || !r.ok) { afirma(false, rotulo + ': operação aceita', codigo(r)); return false; }
  const a = N.aplicar(estado, r.mudancas);
  if (!a.ok) { afirma(false, rotulo + ': aplicar', a); return false; }
  estado = a.estado; eventos = eventos.concat(r.eventos);
  return true;
}
const analise = (id) => estado.analises[id];

/* ---------------- 0. independência ---------------- */
console.log('0. Independência e fronteira com o motor');
const fonte = fs.readFileSync(ARQ, 'utf8');
const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
afirma(!/firebase|document\.|location\.|localStorage|fetch\(|XMLHttpRequest/i.test(semComentarios), 'não cita Firebase, DOM, endereço, armazenamento nem rede');
afirma(!/Date\.now|new Date|Math\.random|performance\.now/.test(semComentarios), 'sem relógio nem sorteio (horário e identificadores vêm de quem chama)');
afirma(!/require\(/.test(semComentarios), 'não importa nada (nem o motor O1–O9)');
const proibidos = MOTOR.CODIGOS_FIRMES.concat(['LINHA', 'PLATAFORMA', 'A_VALIDAR', 'Área Especializada', 'Centro de Excelência', 'Habilitadora', 'Estratégia de Clientes', 'Gestão Corporativa']);
afirma(proibidos.every((p) => fonte.indexOf(p) === -1), 'o núcleo não cita nenhum código nem nome de posicionamento', proibidos.filter((p) => fonte.indexOf(p) !== -1));
const caixa = { module: { exports: {} } }; vm.createContext(caixa); vm.runInContext(fonte, caixa);
afirma(typeof caixa.module.exports.criarAnalise === 'function', 'roda num contexto vazio');
afirma(Object.isFrozen(N) && Object.isFrozen(N.MATRIZ) && Object.isFrozen(N.MATRIZ[0]), 'API e matriz congeladas');
afirma(!Object.keys(N).some((k) => /pessoa|aloca|estrutura(?!s?Pela)|vincul|classific|posicion/i.test(k) && !/exercidasPelaEstrutura/.test(k)), 'nenhuma operação cria estrutura, vínculo, classificação ou pessoa', Object.keys(N));

/* ---------------- A. matriz ---------------- */
console.log('A. Matriz progressiva F1–F17');
afirma(N.MATRIZ.map((q) => q.id).join(',') === 'F1,F2a,F2b,F2c,F3,F4,F5,F6,F7,F8,F9,F10,F11,F12,F13,F14,F15,F16,F17', 'as 19 linhas da matriz, na ordem da especificação');
const textoMatriz = JSON.stringify(N.MATRIZ);
afirma(proibidos.every((p) => textoMatriz.indexOf(p) === -1), 'nenhuma pergunta ou resposta é um tipo organizacional');
afirma(N.MATRIZ.every((q) => typeof q.porque === 'string' && q.porque.length > 0), 'toda linha diz por que existe (motivo do aprofundamento)');
aplicar(N.criarAnalise(estado, { nome: 'Pareceres jurídicos', tipoEscopo: 'responsabilidade' }, ctx('an-unica')), 'criar análise de responsabilidade');
afirma(N.proximasPerguntas(analise('an-unica')).map((p) => p.pergunta).join() === 'F2a', 'responsabilidade: primeiro confirma se o resultado é único (F2a)');
afirma(temErro(N.responder(estado, 'an-unica', { pergunta: 'F2b', valor: { valor: 'informal' } }, ctx()), 'PERGUNTA_FORA_DO_CAMINHO'), 'pergunta fora do caminho do escopo é recusada');
aplicar(N.responder(estado, 'an-unica', { pergunta: 'F2a', valor: 'sim' }, ctx()), 'F2a sim');
afirma(N.proximasPerguntas(analise('an-unica')).length === 0, 'resultado único: segue direto para o O1–O9, sem perguntas a mais (fluxo atual)');
aplicar(N.criarAnalise(estado, { nome: 'Área ampla', tipoEscopo: 'conjunto' }, ctx('an-vazia')), 'criar conjunto');
afirma(N.proximasPerguntas(analise('an-vazia')).map((p) => p.pergunta).join() === 'F3', 'conjunto sem entregas: pergunta as entregas (F3)');
aplicar(N.responder(estado, 'an-vazia', { pergunta: 'F3', valor: 'nenhuma' }, ctx()), 'F3 nenhuma');
afirma(N.proximasPerguntas(analise('an-vazia')).length === 0 && N.lacunas(analise('an-vazia')).map((l) => l.tipo).join() === 'sem-entrega-identificada', '"nenhuma entrega" não trava: vira lacuna listada');

/* ---------------- B. criação e capacidades ---------------- */
console.log('B. Criação, validações e capacidade como referência');
afirma(temErro(N.criarAnalise(estado, { nome: 'x', tipoEscopo: 'estrutura' }, { usuario: USUARIO, agora: 1 }), 'CTX_OPERACAO_AUSENTE'), 'sem operação: recusado');
afirma(temErro(N.criarAnalise(estado, { nome: 'x', tipoEscopo: 'estrutura' }, ctx()), 'CTX_ID_AUSENTE'), 'sem identificador fornecido: recusado (o núcleo não gera ids)');
afirma(temErro(N.criarAnalise(estado, { nome: 'x', tipoEscopo: 'estrutura' }, Object.assign(ctx('id-h'), { agora: 'ontem' })), 'CTX_HORARIO_INVALIDO'), 'horário inválido: recusado');
afirma(temErro(N.criarAnalise(estado, { nome: ' ', tipoEscopo: 'estrutura' }, ctx('id-n')), 'NOME_OBRIGATORIO'), 'nome obrigatório');
afirma(temErro(N.criarAnalise(estado, { nome: 'x', tipoEscopo: 'linha' }, ctx('id-t')), 'TIPO_ESCOPO_INVALIDO'), 'escopo fora da lista: recusado');
afirma(temErro(N.criarAnalise(estado, { nome: 'x', tipoEscopo: 'capacidade', capacidades: [{ tipo: 'fonte-oficial', fonte: 'mapa-capacidades', chave: 'c1', rotulo: 'C1' }] }, ctx('id-c')), 'CAPACIDADE_FONTE_OFICIAL_INEXISTENTE'), 'D2: não presume fonte oficial de capacidades');
const comFonte = N.criarAnalise(estado, { nome: 'x', tipoEscopo: 'capacidade', capacidades: [{ tipo: 'fonte-oficial', fonte: 'mapa-capacidades', chave: 'c1', rotulo: 'C1' }] }, ctx('id-c2'), { fontesCapacidade: ['mapa-capacidades'] });
afirma(comFonte.ok, 'D2: a mesma referência passa quando quem chama informa a fonte oficial (preparado para o futuro)');
afirma(temErro(N.criarAnalise(estado, { nome: 'x', tipoEscopo: 'capacidade', capacidades: [{ tipo: 'texto', chave: 'a', rotulo: 'A' }, { tipo: 'texto', chave: 'a', rotulo: 'A2' }] }, ctx('id-c3')), 'CAPACIDADE_REPETIDA'), 'capacidade repetida na mesma lista: recusada');
afirma(temErro(N.criarAnalise(estado, { nome: 'x', tipoEscopo: 'conjunto' }, ctx('an-unica')), 'ID_JA_USADO'), 'identificador já usado: recusado');

/* ---------------- C. agrupamento ---------------- */
console.log('C. Agrupamento: sugerir, comparar, nunca fundir');
const AN = 'an-agrup';
aplicar(N.criarAnalise(estado, { nome: 'Núcleo X', tipoEscopo: 'estrutura' }, ctx(AN)), 'criar');
aplicar(N.responder(estado, AN, { pergunta: 'F2b', valor: { valor: 'informal' } }, ctx()), 'F2b');
['p1', 'p2', 'p3'].forEach((id) => aplicar(N.adicionarEntrega(estado, AN, { descricao: 'Entrega ' + id }, ctx(id)), 'entrega ' + id));
const resp = (e, q, v) => aplicar(N.responder(estado, AN, { pergunta: q, entregaId: e, valor: v }, ctx()), q + ' ' + e);
resp('p1', 'F4', 'politica-norma'); resp('p1', 'F5', 'cliente-interno'); resp('p1', 'F6', { valor: 'esta-estrutura', certeza: 'conhecido' }); resp('p1', 'F8', { valor: 'sem-evidencia' });
resp('p2', 'F4', 'politica-norma'); resp('p2', 'F5', 'cliente-interno'); resp('p2', 'F6', { valor: 'esta-estrutura', certeza: 'conhecido' }); resp('p2', 'F8', { valor: 'sem-evidencia' });
resp('p3', 'F4', 'decisao-estrategica'); resp('p3', 'F5', 'toda-organizacao'); resp('p3', 'F6', { valor: 'esta-estrutura', certeza: 'conhecido' }); resp('p3', 'F8', { valor: 'sem-evidencia' });
const sug = N.sugestoesDeComparacao(analise(AN));
afirma(sug.length === 1 && sug[0].a === 'p1' && sug[0].b === 'p2', 'mesma forma e destinatário: sugere comparar p1 × p2', sug);
afirma(!sug.some((s) => s.b === 'p3' || s.a === 'p3'), 'o mesmo responsável sozinho não sugere comparação (só reforça)');
afirma(N.proximasPerguntas(analise(AN)).some((p) => p.pergunta === 'F10' && p.motivo === 'semelhanca-de-superficie'), 'a sugestão aparece como pergunta F10, com o motivo');
afirma(temErro(N.definirRecorte(estado, AN, { nome: 'Junto', resultado: 'R', justificativa: 'J', entregas: ['p1', 'p2'] }, ctx('rx')), 'AGRUPAMENTO_SEM_COMPARACAO'), 'sem comparação, duas entregas parecidas NÃO podem ser juntadas');
afirma(temErro(N.compararEntregas(estado, AN, { a: 'p1', b: 'p2', criterios: { finalidade: 'igual' }, conclusao: 'mesma' }, ctx()), 'CRITERIO_SEM_RESPOSTA'), 'comparação exige os sete critérios');
const crit = (s) => { const o = {}; N.CRITERIOS_IDENTIDADE.forEach((k, i) => { o[k] = { I: 'igual', D: 'diferente', N: 'nao-sei' }[s[i]]; }); return o; };
afirma(N.interpretarComparacao(crit('IIIIIII')).indicacao === 'indicios-de-identidade', 'todos iguais: indícios de identidade');
afirma(N.interpretarComparacao(crit('IIIIDII')).indicacao === 'indicios-parciais', 'só riscos diferentes: indícios parciais');
afirma(N.interpretarComparacao(crit('IIDIIII')).indicacao === 'indicios-de-distincao', 'objeto diferente: indícios de distinção');
afirma(N.interpretarComparacao(crit('IINIIII')).indicacao === 'inconclusivo', '"não sei" sem diferença nuclear: inconclusivo');
afirma(temErro(N.compararEntregas(estado, AN, { a: 'p1', b: 'p2', criterios: crit('DDDIDDD'), conclusao: 'mesma' }, ctx()), 'CONCLUSAO_CONTRA_OS_INDICIOS_SEM_JUSTIFICATIVA'), 'concluir "mesma" contra os indícios exige justificativa');
aplicar(N.compararEntregas(estado, AN, { a: 'p2', b: 'p1', criterios: crit('DDDIDDD'), conclusao: 'distintas' }, ctx()), 'comparar distintas');
afirma(analise(AN).comparacoes['p1|p2'].conclusao === 'distintas' && analise(AN).comparacoes['p1|p2'].indicacao === 'indicios-de-distincao', 'comparação registrada com a ordem normalizada, conclusão e indícios');
afirma(temErro(N.definirRecorte(estado, AN, { nome: 'Junto', resultado: 'R', justificativa: 'J', entregas: ['p1', 'p2'] }, ctx('rx2')), 'AGRUPAMENTO_SEM_COMPARACAO'), 'concluídas como distintas: continuam sem poder ser juntadas');
afirma(N.sugestoesDeComparacao(analise(AN)).length === 0, 'depois da comparação, a sugestão some (não é repetida)');
aplicar(N.compararEntregas(estado, AN, { a: 'p1', b: 'p2', criterios: crit('IIIIIII'), conclusao: 'mesma' }, ctx()), 'rever comparação');
afirma(eventos.filter((e) => e.tipo === 'comparacao.registrada' && e.analiseId === AN).length === 2 && eventos.slice(-1)[0].detalhe.antes.conclusao === 'distintas', 'rever a comparação fica no histórico, com a conclusão anterior');
afirma(N.definirRecorte(estado, AN, { nome: 'Junto', resultado: 'R', justificativa: 'J', entregas: ['p1', 'p2'] }, ctx('rx3')).ok, 'só depois de concluir "mesma", juntar é aceito');

/* ---------------- D. portão (N5), origem e referência ---------------- */
console.log('D. Portão do O1–O9 (N5), origem única e referência');
aplicar(N.definirRecorte(estado, AN, { nome: 'Recorte 3', resultado: 'Decisões', justificativa: 'Resultado próprio', entregas: ['p3'] }, ctx('r3')), 'recorte r3');
const pr = N.prontaParaO1O9(analise(AN), 'r3');
afirma(pr.pronta && pr.hipotese, 'pronta para o O1–O9 sem responsável formal registrado, marcada como hipótese (sem evidência)');
aplicar(N.registrarFatos(estado, AN, 'r3', { execucao: [], responsavelFormal: { certeza: 'nao-definido', carater: 'declarado', fonte: 'Coordenação' } }, ctx()), 'fatos: não definido');
afirma(N.prontaParaO1O9(analise(AN), 'r3').pronta, 'responsável "ainda não definido" não bloqueia (N5)');
aplicar(N.adicionarEntrega(estado, AN, { descricao: 'Sem forma' }, ctx('p4')), 'entrega p4');
aplicar(N.definirRecorte(estado, AN, { nome: 'Recorte 4', resultado: 'X', justificativa: 'J', entregas: ['p4'] }, ctx('r4')), 'recorte r4');
const nao = N.prontaParaO1O9(analise(AN), 'r4');
afirma(!nao.pronta && nao.faltas.join() === 'FORMA:p4,DESTINATARIO:p4,EVIDENCIA_OU_HIPOTESE:p4', 'delimitação insuficiente: diz exatamente o que falta', nao.faltas);
afirma(temErro(N.associarAtuacao(estado, AN, 'r4', 'obj-r4', ctx()), 'RECORTE_NAO_PRONTO'), 'associar a atuação (O1–O9) a um recorte não pronto: recusado');
aplicar(N.associarAtuacao(estado, AN, 'r3', 'obj-r3', ctx()), 'associar r3');
afirma(temErro(N.associarAtuacao(estado, AN, 'r3', 'obj-outro', ctx()), 'RECORTE_JA_TEM_ATUACAO'), 'a atuação do recorte é imutável');
aplicar(N.criarAnalise(estado, { nome: 'Outra', tipoEscopo: 'conjunto' }, ctx('an-outra')), 'outra análise');
aplicar(N.adicionarEntrega(estado, 'an-outra', { descricao: 'E' }, ctx('q1')), 'q1');
['F4', 'F5', 'F8'].forEach((q) => aplicar(N.responder(estado, 'an-outra', { pergunta: q, entregaId: 'q1', valor: q === 'F4' ? 'outra' : (q === 'F5' ? 'outro' : { valor: 'sem-evidencia' }) }, ctx()), q));
aplicar(N.definirRecorte(estado, 'an-outra', { nome: 'R', resultado: 'R', justificativa: 'J', entregas: ['q1'] }, ctx('rq')), 'rq');
afirma(temErro(N.associarAtuacao(estado, 'an-outra', 'rq', 'obj-r3', ctx()), 'ATUACAO_JA_TEM_ORIGEM'), 'uma atuação tem no máximo uma análise de origem (em toda a base)');
aplicar(N.referenciarResponsabilidade(estado, 'an-outra', 'obj-r3', ctx()), 'referenciar');
afirma(analise('an-outra').referencias['obj-r3'].origem.analiseId === AN && N.origemDoObjeto(estado, 'obj-r3').analiseId === AN, 'referência N:N: outra análise cita a responsabilidade sem trocar a origem');
afirma(temErro(N.referenciarResponsabilidade(estado, AN, 'obj-r3', ctx()), 'REFERENCIA_A_PROPRIA_ORIGEM'), 'a análise de origem não referencia a si mesma');
afirma(temErro(N.ajustarRecorte(estado, AN, 'r3', { nome: 'Novo', motivo: 'm' }, ctx()), 'RECORTE_JA_AVALIADO_DEFINA_OUTRO'), 'recorte já avaliado não muda por baixo da classificação: define-se outro');
aplicar(N.ajustarRecorte(estado, AN, 'r4', { nome: 'Recorte 4 revisto', motivo: 'Evidência nova' }, ctx()), 'ajustar r4');
const ajuste = eventos.slice(-1)[0];
afirma(ajuste.tipo === 'recorte.ajustado' && ajuste.detalhe.antes.nome === 'Recorte 4' && ajuste.detalhe.depois.nome === 'Recorte 4 revisto' && ajuste.detalhe.depois.versao === 2, 'rever a delimitação: nova versão do recorte, antes e depois no histórico');
afirma(temErro(N.ajustarRecorte(estado, AN, 'r4', { nome: 'x' }, ctx()), 'MOTIVO_OBRIGATORIO'), 'ajustar exige motivo');

/* ---------------- E. N3 e situação formal ---------------- */
console.log('E. N3: nenhuma alternativa reclassifica; situação formal');
const LIG = {}; MOTOR.CODIGOS_FIRMES.forEach((c) => { LIG[c] = c; });
const REF = { ligacoes: LIG };
const AE = MOTOR.CODIGOS_FIRMES.find((c) => /ESPECIALIZADA/.test(c)), CE = MOTOR.CODIGOS_FIRMES.find((c) => /^CO/.test(c));
const EST = { ae1: { tipo: AE, situacao: 'ativa' }, ce1: { tipo: CE, situacao: 'ativa' }, enc: { tipo: CE, situacao: 'encerrada' } };
const sf = (e) => N.situacaoFormal(Object.assign({ ref: REF, estruturas: EST }, e));
afirma(sf({}) === 'sem-classificacao' && sf({ aValidar: true }) === 'classificacao-a-validar', 'sem código efetivo: sem classificação ou "a validar"');
afirma(sf({ codigoEfetivo: AE, vinculoPrincipal: { estruturaId: 'ae1', situacao: 'ativo' } }) === 'compativel', 'vínculo principal de tipo compatível: compatível');
afirma(sf({ codigoEfetivo: CE, vinculoPrincipal: { estruturaId: 'ae1', situacao: 'ativo' } }) === 'vinculo-a-revisar', 'vínculo de tipo diferente: a revisar (nunca aceito como compatível)');
afirma(sf({ codigoEfetivo: CE, fatos: { execucao: [{ estruturaId: 'ae1' }] } }) === 'exercida-sem-responsavel-formal-compativel', 'executada por estrutura de outro tipo: exercida sem responsável formal compatível');
afirma(sf({ codigoEfetivo: CE, fatos: { execucao: [{ estruturaId: 'ce1' }] } }) === 'executada-sem-vinculo-formal', 'executada por estrutura do tipo, sem vínculo: falta só registrar o vínculo');
afirma(sf({ codigoEfetivo: CE, fatos: { execucao: [{ estruturaId: 'enc' }] } }) === 'sem-estrutura', 'estrutura encerrada não conta');
afirma(N.SITUACAO_FORMAL.every((s) => N.alternativasPara(s).every((a) => N.ALTERNATIVAS.indexOf(a.alternativa) !== -1)), 'alternativas só da lista aprovada, com consequência');
afirma(N.SITUACAO_FORMAL.every((s) => N.alternativasPara(s).every((a) => N.ALTERNATIVAS_RECUSADAS.indexOf(a.alternativa) === -1)), 'nenhuma situação oferece reclassificar ou forçar vínculo');
afirma(N.alternativasPara('exercida-sem-responsavel-formal-compativel').map((a) => a.alternativa).indexOf('rever-delimitacao') !== -1, 'responsabilidade exercida por estrutura de outro tipo: oferece rever a delimitação (com evidência)');
N.ALTERNATIVAS_RECUSADAS.forEach((alt) => afirma(temErro(N.registrarProposta(estado, AN, { alternativa: alt, recortes: ['r3'], justificativa: 'j' }, ctx()), 'ALTERNATIVA_RECUSADA_NAO_RECLASSIFICA'), 'proposta "' + alt + '" recusada'));

/* ---------------- F. N1 ---------------- */
console.log('F. N1: aprovação institucional como referência a ato externo');
afirma(temErro(N.registrarProposta(estado, AN, { alternativa: 'pendente', recortes: ['r3'], justificativa: 'j', pendencia: { falta: 'x' } }, ctx()), 'PENDENCIA_INCOMPLETA'), 'pendência exige o que falta, a próxima ação e quem decide');
aplicar(N.registrarProposta(estado, AN, { alternativa: 'manter-consciente', recortes: ['r3'], justificativa: 'Sem ganho em separar' }, ctx()), 'proposta v1');
afirma(temErro(N.registrarProposta(estado, AN, { alternativa: 'pendente', recortes: ['r3'], justificativa: 'j', pendencia: { falta: 'a', proximaAcao: 'b', quemDecide: 'c' }, versaoAnteriorEsperada: 0 }, ctx()), 'PROPOSTA_DESATUALIZADA'), 'proposta sobre versão velha: recusada (concorrência)');
const ADM = { id: 'u-adm', email: 'admin@exemplo.test' };
const ato = { autoridade: 'Diretoria Executiva', referencia: 'Ata 12/2026, item 3', dataDoAto: 1791900000000, objetoAprovado: 'Proposta v1 da análise' };
['autoridade', 'referencia', 'objetoAprovado'].forEach((k) => afirma(temErro(N.registrarAprovacao(estado, AN, 1, Object.assign({}, ato, { [k]: '' }), ctx(null, ADM)), { autoridade: 'AUTORIDADE_OBRIGATORIA', referencia: 'REFERENCIA_DO_ATO_OBRIGATORIA', objetoAprovado: 'OBJETO_APROVADO_OBRIGATORIO' }[k]), 'aprovação sem ' + k + ': recusada'));
afirma(temErro(N.registrarAprovacao(estado, AN, 1, Object.assign({}, ato, { dataDoAto: 'ontem' }), ctx(null, ADM)), 'DATA_DO_ATO_INVALIDA'), 'data do ato inválida: recusada');
afirma(temErro(N.registrarAprovacao(estado, AN, 2, ato, ctx(null, ADM)), 'PROPOSTA_NAO_VIGENTE'), 'aprovar versão que não é a vigente: recusado');
aplicar(N.registrarAprovacao(estado, AN, 1, ato, ctx(null, ADM)), 'aprovação');
const ap = estado.aprovacoes[AN + '~1'];
afirma(ap.natureza === 'referencia-a-ato-externo' && ap.autoridade === 'Diretoria Executiva' && ap.registradoPor.id === 'u-adm', 'registra o ato externo: a autoridade é a instância; a autoria é só do registro');
afirma(temErro(N.registrarAprovacao(estado, AN, 1, ato, ctx(null, ADM)), 'PROPOSTA_JA_TEM_APROVACAO'), 'uma aprovação por versão de proposta');
afirma(N.situacaoDaAnalise(estado, AN, { posicionamentos: { 'obj-r3': { codigoEfetivo: AE } } }) === 'em-descoberta', 'a entrega p4 ainda sem respostas: a análise continua em descoberta, mesmo com proposta aprovada de outro recorte');

/* ---------------- G. N2/N4 ---------------- */
console.log('G. N2/N4: fatos descritivos com fonte, caráter e data');
afirma(temErro(N.registrarFatos(estado, AN, 'r4', { execucao: [{ estruturaId: 'ae1', carater: 'certeza', fonte: 'x' }], responsavelFormal: { certeza: 'nao-definido', carater: 'declarado', fonte: 'x' } }, ctx()), 'EXECUCAO_INVALIDA'), 'caráter fora da lista: recusado');
afirma(temErro(N.registrarFatos(estado, AN, 'r4', { execucao: [{ estruturaId: 'ae1', carater: 'declarado' }], responsavelFormal: { certeza: 'nao-definido', carater: 'declarado', fonte: 'x' } }, ctx()), 'EXECUCAO_INVALIDA'), 'fato sem fonte: recusado');
afirma(temErro(N.registrarFatos(estado, AN, 'r4', { execucao: [], responsavelFormal: { certeza: 'nao-definido', estruturaId: 'ae1', carater: 'declarado', fonte: 'x' } }, ctx()), 'RESPONSAVEL_NAO_DEFINIDO_COM_ESTRUTURA'), '"não definido" com estrutura: recusado');
afirma(temErro(N.registrarFatos(estado, AN, 'r4', { execucao: [], responsavelFormal: { certeza: 'provavel', carater: 'hipotese', fonte: 'x' } }, ctx()), 'RESPONSAVEL_FORMAL_INVALIDO'), '"provável" sem dizer qual: recusado');
aplicar(N.registrarFatos(estado, AN, 'r4', { execucao: [{ estruturaId: 'ae1', carater: 'hipotese', fonte: 'Percepção' }], responsavelFormal: { certeza: 'provavel', estruturaId: 'ae1', carater: 'hipotese', fonte: 'Percepção' } }, ctx()), 'fatos r4');
const ex = N.exercidasPelaEstrutura(estado, 'ae1');
afirma(ex.length === 1 && ex[0].carater === 'hipotese' && ex[0].fonte === 'Percepção' && typeof ex[0].informadoEm === 'number' && ex[0].analiseId === AN, '"exerce, segundo a análise": com caráter (hipótese não vira fato), fonte e data');

/* ---------------- H. casos de estresse da TI ---------------- */
console.log('H. Casos de estresse da TI (' + CENARIOS.casos.length + ' casos, conjunto v' + CENARIOS.versao + ')');
const posicionamentos = {}, situacoesPorCenario = {};
for (const caso of CENARIOS.casos) {
  const id = caso.id, T = (m) => '[' + id + '] ' + m;
  const antesEstruturas = JSON.stringify(CENARIOS.estruturas);
  aplicar(N.criarAnalise(estado, caso.analise, ctx(id)), T('criar'));
  (caso.respostas || []).forEach((r) => aplicar(N.responder(estado, id, { pergunta: r.pergunta, valor: r.valor }, ctx()), T(r.pergunta)));
  (caso.referencias || []).forEach((o) => aplicar(N.referenciarResponsabilidade(estado, id, o, ctx()), T('referência ' + o)));
  for (const e of caso.entregas) {
    aplicar(N.adicionarEntrega(estado, id, { descricao: e.descricao }, ctx(e.id)), T('entrega ' + e.id));
    for (const q of ['F4', 'F5', 'F6', 'F13', 'F7', 'F12', 'F8']) if (e[q] !== undefined) aplicar(N.responder(estado, id, { pergunta: q, entregaId: e.id, valor: e[q] }, ctx()), T(q + ' ' + e.id));
  }
  (caso.respostasDepois || []).forEach((r) => aplicar(N.responder(estado, id, { pergunta: r.pergunta, valor: r.valor }, ctx()), T(r.pergunta)));
  if (caso.esperado) {
    const sugs = N.sugestoesDeComparacao(analise(id));
    afirma(sugs.map((s) => s.a + '|' + s.b).join(',') === caso.esperado.sugestoes.join(','), T('sugestões de comparação (nunca fusão)'), sugs);
    if (caso.esperado.sinaisRegressao) {
      const s = sugs.find((x) => x.a + '|' + x.b === caso.esperado.sinaisRegressao.par);
      afirma(s && s.sinais.join() === caso.esperado.sinaisRegressao.sinais.join(), T('regressão: mesma forma, mesmos gestores e mesmo núcleo só SUGEREM comparar'), s);
    }
  }
  for (const c of caso.comparacoes || []) {
    const dados = { a: c.a, b: c.b, criterios: crit(c.criterios), conclusao: c.conclusao };
    if (c.semJustificativaErro) afirma(temErro(N.compararEntregas(estado, id, dados, ctx()), c.semJustificativaErro), T('conclusão "' + c.conclusao + '" contra os indícios sem justificativa: recusada'));
    if (c.justificativa) dados.justificativa = c.justificativa;
    aplicar(N.compararEntregas(estado, id, dados, ctx()), T('comparar ' + c.a + '|' + c.b));
    afirma(analise(id).comparacoes[c.a < c.b ? c.a + '|' + c.b : c.b + '|' + c.a].indicacao === c.indicacaoEsperada, T('indícios ' + c.a + '|' + c.b + ' = ' + c.indicacaoEsperada));
  }
  for (const rr of caso.recortesRecusados || []) afirma(temErro(N.definirRecorte(estado, id, { nome: 'Tentativa', resultado: 'R', justificativa: 'J', entregas: rr.entregas }, ctx('tentativa-' + (++seq))), rr.erro), T('recorte ' + rr.entregas.join('+') + ' recusado: ' + rr.erro));
  const situacoes = [];
  for (const r of caso.recortes) {
    aplicar(N.definirRecorte(estado, id, { nome: r.nome, resultado: r.resultado, justificativa: 'Delimitado na descoberta', entregas: r.entregas }, ctx(r.id)), T('recorte ' + r.id));
    if (r.fatos) aplicar(N.registrarFatos(estado, id, r.id, r.fatos, ctx()), T('fatos ' + r.id));
    const pronta = N.prontaParaO1O9(analise(id), r.id);
    afirma(pronta.pronta && (r.prontaComHipotese ? pronta.hipotese : true), T('recorte ' + r.id + ' pronto para o O1–O9' + (r.prontaComHipotese ? ' (como hipótese)' : '')), pronta);
    aplicar(N.associarAtuacao(estado, id, r.id, r.objetoId, ctx()), T('atuação ' + r.objetoId));
    posicionamentos[r.objetoId] = r.posicionamento;
    const s = N.situacaoFormal({ codigoEfetivo: r.posicionamento.codigoEfetivo, aValidar: r.posicionamento.aValidar, vinculoPrincipal: r.vinculoPrincipal || null, fatos: analise(id).recortes[r.id].fatos, estruturas: CENARIOS.estruturas, ref: REF });
    afirma(s === r.situacaoEsperada, T('situação formal de ' + r.id + ' = ' + r.situacaoEsperada), s);
    situacoes.push(s);
    if (r.ajusteDepoisDeAvaliado) afirma(temErro(N.ajustarRecorte(estado, id, r.id, { nome: 'outro', motivo: 'm' }, ctx()), r.ajusteDepoisDeAvaliado), T('recorte avaliado não é reescrito por baixo da classificação'));
  }
  const f = caso.finais || {};
  if (f.perguntasPendentes) {
    const pend = N.proximasPerguntas(analise(id)).map((p) => p.pergunta + (p.entregaId ? ':' + p.entregaId : '') + (p.par ? ':' + p.par.join('|') : ''));
    afirma(pend.join(',') === f.perguntasPendentes.join(','), T('perguntas pendentes'), pend);
  }
  if (f.lacunas) {
    const lac = N.lacunas(analise(id)).map((l) => l.tipo + (l.entregaId ? ':' + l.entregaId : '') + (l.par ? ':' + l.par : ''));
    afirma(lac.join(',') === f.lacunas.join(','), T('lacunas listadas (não bloqueiam)'), lac);
  }
  if (f.categoria) {
    const cat = N.categoriaDoCaso(situacoes, { funcionalidadeFutura: caso.funcionalidadeFutura });
    afirma(cat === f.categoria, T('categoria = ' + f.categoria), cat);
    situacoesPorCenario[caso.cenario] = cat;
  }
  if (caso.propostaRecusada) afirma(temErro(N.registrarProposta(estado, id, { alternativa: caso.propostaRecusada.alternativa, recortes: caso.recortes.map((r) => r.id), justificativa: 'j' }, ctx()), caso.propostaRecusada.erro), T('proposta "' + caso.propostaRecusada.alternativa + '" recusada (N3)'));
  if (caso.proposta) aplicar(N.registrarProposta(estado, id, caso.proposta, ctx()), T('proposta'));
  if (caso.aprovacaoRecusada) afirma(temErro(N.registrarAprovacao(estado, id, 1, ato, ctx(null, ADM)), caso.aprovacaoRecusada), T('proposta pendente não se aprova'));
  if (caso.exercidas) {
    const ex2 = N.exercidasPelaEstrutura(estado, caso.exercidas.estruturaId).filter((x) => x.analiseId === id).map((x) => x.recorteId + ':' + x.carater);
    afirma(ex2.join(',') === caso.exercidas.esperado.join(','), T('ficha da estrutura: "exerce, segundo a análise" com o caráter de cada informação'), ex2);
  }
  if (caso.objetoAmplo) {
    const oa = N.objetoAmploDelimitado(estado, caso.objetoAmplo.objetoId);
    afirma(oa.delimitado && oa.responsabilidades === caso.objetoAmplo.responsabilidades, T('objeto amplo vira agrupador "delimitado em ' + caso.objetoAmplo.responsabilidades + '"'), oa);
  }
  if (caso.situacaoAnaliseEsperada) {
    const sa = N.situacaoDaAnalise(estado, id, { posicionamentos });
    afirma(sa === caso.situacaoAnaliseEsperada, T('situação da análise = ' + caso.situacaoAnaliseEsperada), sa);
  }
  afirma(JSON.stringify(CENARIOS.estruturas) === antesEstruturas, T('nenhuma estrutura criada ou alterada'));
}
const esperadoCat = { 1: 'completa', 2: 'completa', 3: 'completa', 4: 'completa', 5: 'diagnostico-concluido-pendente', 6: 'diagnostico-concluido-pendente', 7: 'diagnostico-concluido-pendente', 8: 'completa', 9: 'completa', 10: 'diagnostico-concluido-pendente', 11: 'funcionalidade-futura', 12: 'diagnostico-concluido-pendente' };
afirma(Object.keys(esperadoCat).every((k) => situacoesPorCenario[k] === esperadoCat[k]), 'os 12 cenários na categoria da especificação (6 completos, 5 com pendência, 1 futuro)', situacoesPorCenario);
afirma(Object.keys(estado).sort().join() === 'analises,aprovacoes,propostas', 'o estado só tem análises, propostas e aprovações: nenhuma estrutura, vínculo, Taxonomia, Mapa ou classificação');
afirma(eventos.every((e) => typeof e.em === 'number' && e.por && e.operacaoId), 'todo evento tem horário, autor e operação');
const cont = N.contagens(estado);
afirma(cont.agrupadores === 1, 'contagens: o objeto amplo conta como agrupador, não como pendência', cont);
const antes = cont.responsabilidades;
aplicar(N.referenciarResponsabilidade(estado, 'cenario-3', 'ao-a1', ctx()), 'referência extra');
afirma(N.contagens(estado).responsabilidades === antes, 'uma responsabilidade referenciada por outra análise não é contada duas vezes');
afirma(N.historico(eventos, 'jornada-A').every((e, i, l) => i === 0 || e.em >= l[i - 1].em) && N.historico(eventos, 'jornada-A').length > 10, 'histórico da análise em ordem cronológica');

/* ---------------- J. marcador, evidência qualitativa e proposta sob concorrência (PR A) ---------------- */
console.log('J. Marcador de homologação, evidência qualitativa (D7) e proposta sob concorrência');
const acesso = (h, p) => { const a = N.acessoPelaHabilitacao(h, p); return [a.ler, a.gravar, a.registrarAprovacao].map(Number).join(''); };
const G = { adminGeral: true }, AQ = { arquitetura: true }, AV = { avaliacao: true }, NADA = {};
afirma([G, AQ, AV, NADA].every((p) => acesso(undefined, p) === '000' && acesso('DESLIGADO', p) === '000' && acesso('qualquer', p) === '000'), 'ausente, DESLIGADO ou valor desconhecido: ninguém lê nem grava');
afirma(acesso('SOMENTE_ADMIN_GERAL', G) === '111' && [AQ, AV, NADA].every((p) => acesso('SOMENTE_ADMIN_GERAL', p) === '000'), 'SOMENTE_ADMIN_GERAL: só o admin geral');
afirma(acesso('LIBERADO_PARA_PERFIS_AUTORIZADOS', G) === '111' && acesso('LIBERADO_PARA_PERFIS_AUTORIZADOS', AQ) === '110' && acesso('LIBERADO_PARA_PERFIS_AUTORIZADOS', AV) === '100' && acesso('LIBERADO_PARA_PERFIS_AUTORIZADOS', NADA) === '000', 'LIBERADO: perfis leem; Arquitetura grava; aprovação só do admin geral');
afirma(temErro(N.registrarEvidenciaQualitativa(estado, 'jornada-A', 'r4', { texto: ' ' }, ctx()), 'EVIDENCIA_SEM_TEXTO'), 'evidência qualitativa exige texto');
const antesR4 = JSON.stringify(analise('jornada-A').recortes.r4.objetoId);
aplicar(N.registrarEvidenciaQualitativa(estado, 'jornada-A', 'r4', { texto: 'O papel de parecer aparece nas exceções à política; o de padrão, na revisão anual', exemplo: 'Exceção 7/2026' }, ctx()), 'evidência qualitativa');
const ev = analise('jornada-A').recortes.r4.evidenciasQualitativas;
afirma(ev.length === 1 && ev[0].exemplo === 'Exceção 7/2026' && JSON.stringify(analise('jornada-A').recortes.r4.objetoId) === antesR4 && !('codigo' in ev[0]), 'D7: predominância registrada como texto e exemplo, sem código e sem mexer na atuação avaliada');
const pv = analise('jornada-A').propostaVigente;
afirma(pv === 1, 'a análise aponta a proposta vigente', pv);
const p1 = N.registrarProposta(estado, 'jornada-A', { alternativa: 'pendente', recortes: ['r4'], justificativa: 'j', pendencia: { falta: 'a', proximaAcao: 'b', quemDecide: 'c' } }, ctx());
const p2 = N.registrarProposta(estado, 'jornada-A', { alternativa: 'manter-consciente', recortes: ['r4'], justificativa: 'j2' }, ctx());
const ap1 = N.aplicar(estado, p1.mudancas);
afirma(p1.ok && p2.ok && ap1.ok && N.aplicar(ap1.estado, p2.mudancas).erro === 'CONFLITO_DE_REVISAO', 'duas propostas sobre a mesma revisão da análise: só uma entra');

/* ---------------- I. aplicar e imutabilidade ---------------- */
console.log('I. aplicar(), revisão e imutabilidade');
const congelado = congelaFundo(JSON.parse(JSON.stringify(estado)));
const r1 = N.adicionarEntrega(congelado, 'jornada-B', { descricao: 'Nova' }, ctx('nova-e'));
afirma(r1.ok, 'operações funcionam sobre um estado congelado (nunca alteram o que recebem)');
const r2 = N.adicionarEntrega(congelado, 'jornada-B', { descricao: 'Concorrente' }, ctx('conc-e'));
const a1 = N.aplicar(congelado, r1.mudancas);
afirma(a1.ok && N.aplicar(a1.estado, r2.mudancas).erro === 'CONFLITO_DE_REVISAO', 'duas gravações sobre a mesma revisão: a segunda é recusada (tudo ou nada)');
afirma(temErro(N.adicionarEntrega(congelado, 'jornada-B', { descricao: 'x', revisaoEsperada: 1 }, ctx('rev-e')), 'REVISAO_DESATUALIZADA'), 'revisão esperada desatualizada: recusada');
afirma(N.aplicar(congelado, [{ entidade: 'estrutura', id: 'x', antes: null, depois: {}, revisaoAnterior: null }]).erro === 'ENTIDADE_DESCONHECIDA', 'aplicar recusa qualquer entidade fora de análise, proposta e aprovação');
aplicar(N.descartarAnalise(estado, 'an-vazia', { motivo: 'Aberta por engano' }, ctx()), 'descartar');
afirma(temErro(N.adicionarEntrega(estado, 'an-vazia', { descricao: 'x' }, ctx('pos-desc')), 'ANALISE_DESCARTADA') && N.situacaoDaAnalise(estado, 'an-vazia') === 'descartada', 'análise descartada não aceita mais nada (nada é apagado)');
/* ---------------- K. usabilidade: F2b coerente e entregas editáveis ---------------- */
console.log('K. F2b coerente com a estrutura; editar e descartar entrega');
aplicar(N.criarAnalise(estado, { nome: 'TESTE — Núcleo de Governança de TI', tipoEscopo: 'estrutura' }, ctx('an-gov')), 'criar gov');
afirma(temErro(N.responder(estado, 'an-gov', { pergunta: 'F2b', valor: { valor: 'nao-cadastrada', estruturaId: 'ae1' } }, ctx()), 'ESTRUTURA_INCOMPATIVEL_COM_RESPOSTA'), '"Existe, mas não está cadastrada" com estrutura escolhida: recusado');
afirma(temErro(N.responder(estado, 'an-gov', { pergunta: 'F2b', valor: { valor: 'informal', estruturaId: 'ae1' } }, ctx()), 'ESTRUTURA_INCOMPATIVEL_COM_RESPOSTA'), '"É informal" com estrutura escolhida: recusado');
afirma(temErro(N.responder(estado, 'an-gov', { pergunta: 'F2b', valor: { valor: 'cadastrada' } }, ctx()), 'ESTRUTURA_NAO_INFORMADA'), '"Está cadastrada" sem estrutura: recusado');
aplicar(N.responder(estado, 'an-gov', { pergunta: 'F2b', valor: { valor: 'cadastrada', estruturaId: 'ae1' } }, ctx()), 'F2b cadastrada');
afirma(analise('an-gov').estruturaReferidaId === 'ae1' && N.cadastroReferido(analise('an-gov')) === 'ae1', '"Está cadastrada": a estrutura fica referida');
aplicar(N.responder(estado, 'an-gov', { pergunta: 'F2b', valor: { valor: 'nao-cadastrada' } }, ctx()), 'F2b troca');
afirma(analise('an-gov').estruturaReferidaId === null && !('estruturaId' in analise('an-gov').respostas.F2b) && N.cadastroReferido(analise('an-gov')) === null, 'trocar para outra resposta limpa a estrutura (resposta e análise)');
const ultimo = eventos.slice(-1)[0];
afirma(ultimo.detalhe.antes.estruturaId === 'ae1' && !ultimo.detalhe.depois.estruturaId, 'o histórico guarda a estrutura de antes e a resposta nova sem ela');
/* legado incoerente: resposta "informal" com estrutura gravada (antes desta correção) */
const legado = JSON.parse(JSON.stringify(analise('an-gov'))); legado.id = 'an-leg'; legado.respostas.F2b = { valor: 'informal', estruturaId: 'ae1', em: 1, por: USUARIO }; legado.estruturaReferidaId = 'ae1';
estado.analises['an-leg'] = legado;
afirma(N.cadastroReferido(legado) === null, 'legado incoerente: a leitura não mostra a estrutura');
afirma(estado.analises['an-leg'].estruturaReferidaId === 'ae1', 'legado incoerente: a leitura não apaga nada');
aplicar(N.adicionarEntrega(estado, 'an-leg', { descricao: 'x' }, ctx('e-leg')), 'gravação no legado');
afirma(analise('an-leg').estruturaReferidaId === null && !('estruturaId' in analise('an-leg').respostas.F2b), 'legado incoerente: corrigido só na próxima gravação da própria análise');
afirma(N.responder(estado, 'an-gov', { pergunta: 'F2b', valor: { valor: 'informal' } }, ctx()).ok, 'resposta coerente sem estrutura: aceita');
/* entregas */
aplicar(N.adicionarEntrega(estado, 'an-gov', { descricao: 'Diagnósticos de governança', exemplo: 'Relatório hipotético' }, ctx('eg1')), 'e1');
aplicar(N.editarEntrega(estado, 'an-gov', 'eg1', { descricao: 'Diagnósticos de aderência com recomendações', exemplo: '' }, ctx()), 'editar');
const eg = analise('an-gov').entregas.eg1, evEd = eventos.slice(-1)[0];
afirma(eg.descricao === 'Diagnósticos de aderência com recomendações' && eg.exemplo === null && evEd.tipo === 'entrega.editada' && evEd.detalhe.antes.descricao === 'Diagnósticos de governança', 'editar entrega: texto novo, histórico com antes e depois');
afirma(temErro(N.editarEntrega(estado, 'an-gov', 'eg1', { descricao: ' ' }, ctx()), 'ENTREGA_SEM_DESCRICAO') && temErro(N.editarEntrega(estado, 'an-gov', 'nao-ha', { descricao: 'x' }, ctx()), 'ENTREGA_INEXISTENTE'), 'editar: descrição obrigatória; entrega inexistente recusada');
aplicar(N.adicionarEntrega(estado, 'an-gov', { descricao: 'Lançada por engano' }, ctx('eg2')), 'e2');
aplicar(N.descartarEntrega(estado, 'an-gov', 'eg2', { motivo: 'Duplicada' }, ctx()), 'descartar e2');
afirma(analise('an-gov').entregas.eg2.situacao === 'descartada' && analise('an-gov').entregas.eg2.descarte.motivo === 'Duplicada' && eventos.slice(-1)[0].tipo === 'entrega.descartada', 'descartar entrega: fica no histórico, não é apagada');
afirma(!N.proximasPerguntas(analise('an-gov')).some((q) => q.entregaId === 'eg2') && temErro(N.editarEntrega(estado, 'an-gov', 'eg2', { descricao: 'x' }, ctx()), 'ENTREGA_DESCARTADA'), 'entrega descartada sai das perguntas e não é mais editada');
['F4', 'F5', 'F6', 'F8'].forEach((q) => aplicar(N.responder(estado, 'an-gov', { pergunta: q, entregaId: 'eg1', valor: q === 'F4' ? 'julgamento-tecnico' : q === 'F5' ? 'diversas-linhas' : q === 'F6' ? { valor: 'esta-estrutura', certeza: 'conhecido' } : { valor: 'sem-evidencia' } }, ctx()), q));
aplicar(N.definirRecorte(estado, 'an-gov', { nome: 'Avaliar aderência', resultado: 'Diagnóstico', justificativa: 'j', entregas: ['eg1'] }, ctx('rg1')), 'recorte');
afirma(temErro(N.descartarEntrega(estado, 'an-gov', 'eg1', {}, ctx()), 'ENTREGA_EM_RESPONSABILIDADE'), 'entrega dentro de uma responsabilidade delimitada não é descartada');
afirma(N.editarEntrega(estado, 'an-gov', 'eg1', { descricao: 'Ajuste de redação' }, ctx()).ok, 'responsabilidade ainda não avaliada: a entrega pode ter o texto ajustado');
aplicar(N.associarAtuacao(estado, 'an-gov', 'rg1', 'obj-gov-1', ctx()), 'atuação');
afirma(temErro(N.editarEntrega(estado, 'an-gov', 'eg1', { descricao: 'Outra coisa' }, ctx()), 'ENTREGA_EM_RESPONSABILIDADE_AVALIADA'), 'responsabilidade já com atuação: a entrega não muda (o O1–O9 foi feito sobre ela)');

console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
