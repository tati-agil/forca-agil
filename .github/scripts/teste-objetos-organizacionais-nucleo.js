/* Objetos organizacionais (Porta 2 do Posicionamento) — o núcleo puro e o contrato da hipótese inicial, sem navegador
 * e sem banco. As regras do banco são provadas no emulador por teste-rules-objetos-organizacionais.js.
 *   A. Catálogo: hipóteses = os 8 posicionamentos firmes do motor + NAO_SEI; módulo congelado.
 *   B. Validação: nome, descrição e finalidade obrigatórios (texto em branco não conta), limites, contexto opcional.
 *   C. Gravações montadas: criação (ativo, revisão 1, auditoria, índice só com referência), alteração (revisão + 1,
 *      antes → depois, sem mudança não grava), encerramento (motivo, final, libera o índice).
 *   D. Comparação da hipótese com a recomendação automática (as cinco situações).
 *   E. CONTRATO DE INDEPENDÊNCIA (direcionado, sem multiplicar a enumeração do motor por hipótese): o motor não tem
 *      parâmetro para a hipótese; a conclusão que a tela monta, para um estado de cada uma das regras concluíveis do
 *      motor, é a MESMA com qualquer das 9 hipóteses, com hipótese nenhuma e pelas duas portas. A equivalência
 *      tabela ⇔ motor nos 531.441 estados continua provada por teste-regras-posicionamento-tabela.js.
 *   F. Porta 1 intacta: sem origem nem hipótese, a gravação de criação é a de antes (com a base P1–P16).
 *   G. As regras publicadas dos 3 nós são exatamente as montadas por montar-regras-objetos-organizacionais.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..');
const O = require(path.join(RAIZ, 'forca-agil', 'objetos-organizacionais-nucleo.js'));
const NU = require(path.join(RAIZ, 'forca-agil', 'motor-posicionamento-nucleo.js'));
const T = require('./regras-posicionamento-tabela.js');
let total = 0, falhas = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + det : '')); if (!c) falhas++; }
const js = (v) => JSON.parse(JSON.stringify(v));
const TS = { '.sv': 'timestamp' };
const U = { uid: 'u1', email: 'arq@previ.com.br', name: 'Arquiteta' };
const DADOS = { nome: '  Assessoramento jurídico ', descricao: 'Preventivo e consultivo.', finalidade: 'Segurança jurídica.', contexto: '' };
const erros = (f) => { try { f(); return null; } catch (e) { return e.erros || e.message; } };

console.log('A. Catálogo');
afirma(JSON.stringify(O.CODIGOS_HIPOTESE) === JSON.stringify(NU.CODIGOS_FIRMES.concat(['NAO_SEI'])), 'hipóteses = os 8 firmes do motor + NAO_SEI (sem LINHA, PLATAFORMA nem A_VALIDAR)');
afirma(Object.isFrozen(O) && Object.isFrozen(O.CODIGOS_HIPOTESE) && O.ORIGEM === 'objeto-organizacional', 'módulo congelado; origem da Porta 2');
afirma(!O.hipoteseValida('LINHA') && !O.hipoteseValida('A_VALIDAR') && O.hipoteseValida('NAO_SEI') && O.hipoteseValida('COE'), 'hipoteseValida só aceita os 9');

console.log('B. Validação');
afirma(O.validarDados(DADOS).length === 0, 'dados completos: válido (contexto vazio é opcional)');
afirma(JSON.stringify(O.validarDados({ nome: '   ', descricao: 'x' }).map((e) => e.campo + ':' + e.codigo)) === '["nome:OBRIGATORIO","finalidade:OBRIGATORIO"]', 'texto só com espaços não conta como preenchido');
afirma(O.validarDados(Object.assign({}, DADOS, { nome: 'n'.repeat(201) }))[0].codigo === 'TAMANHO', 'limite do nome (200)');
afirma(JSON.stringify(O.normalizar(DADOS)) === JSON.stringify({ nome: 'Assessoramento jurídico', descricao: 'Preventivo e consultivo.', finalidade: 'Segurança jurídica.' }), 'normalizar apara e não grava contexto vazio');

console.log('C. Gravações montadas');
const pc = O.payloadCriacao({ id: 'o1', audId: 'a1', dados: DADOS, usuario: U, agora: TS });
const r1 = pc['objetos-organizacionais/o1'];
afirma(r1.situacao === 'ativo' && r1.revisao === 1 && r1.auditoriaId === 'a1' && r1.criadoEm === TS && r1.criadoPor.uid === 'u1' && !('contexto' in r1) && !('referenciaItemId' in r1), 'criação: ativo, revisão 1, horário do servidor, autoria, sem campos vazios');
afirma(pc['objetos-organizacionais-auditoria/o1/a1'].tipo === 'criacao' && pc['objetos-organizacionais-auditoria/o1/a1'].depois.nome === 'Assessoramento jurídico' && Object.keys(pc).length === 2, 'criação: auditoria com o depois; sem referência, sem índice');
const pr = O.payloadCriacao({ id: 'o2', audId: 'a2', dados: DADOS, referenciaItemId: 'item-p1', usuario: U, agora: TS });
afirma(pr['objetos-organizacionais-por-referencia/item-p1'] === 'o2' && pr['objetos-organizacionais/o2'].referenciaItemId === 'item-p1', 'com referência: índice na mesma gravação');
afirma(Array.isArray(erros(() => O.payloadCriacao({ id: 'o3', audId: 'a3', dados: DADOS, referenciaItemId: 'com espaço', usuario: U, agora: TS }))), 'referência inválida: recusada pelo núcleo');
afirma(/usuário/.test(String(erros(() => O.payloadCriacao({ id: 'o3', audId: 'a3', dados: DADOS, usuario: { email: 'x@y' }, agora: TS })))), 'sem uid: o núcleo não monta');
const atual = js(r1); atual.criadoEm = 1; atual.atualizadoEm = 1;
const pa = O.payloadAlteracao({ id: 'o1', atual, audId: 'a4', dados: Object.assign({}, DADOS, { contexto: 'Novo contexto' }), usuario: U, agora: TS });
const ra = pa['objetos-organizacionais/o1'], aa = pa['objetos-organizacionais-auditoria/o1/a4'];
afirma(ra.revisao === 2 && ra.criadoEm === 1 && ra.contexto === 'Novo contexto' && aa.tipo === 'alteracao' && !('contexto' in aa.antes) && aa.depois.contexto === 'Novo contexto', 'alteração: revisão + 1, criação intacta, antes → depois');
afirma(erros(() => O.payloadAlteracao({ id: 'o1', atual, audId: 'a5', dados: DADOS, usuario: U, agora: TS }))[0].codigo === 'SEM_ALTERACAO', 'alteração sem mudança: não monta');
const atualR = js(pr['objetos-organizacionais/o2']); atualR.criadoEm = 1;
const pe = O.payloadEncerramento({ id: 'o2', atual: atualR, audId: 'a6', motivo: '  Incorporada  ', usuario: U, agora: TS });
afirma(pe['objetos-organizacionais/o2'].situacao === 'encerrado' && pe['objetos-organizacionais/o2'].encerramento.motivo === 'Incorporada' && pe['objetos-organizacionais/o2'].revisao === 2 &&
  pe['objetos-organizacionais-por-referencia/item-p1'] === null && pe['objetos-organizacionais-auditoria/o2/a6'].motivo === 'Incorporada', 'encerramento: motivo, revisão + 1, libera o índice');
afirma(erros(() => O.payloadEncerramento({ id: 'o2', atual: atualR, audId: 'a7', motivo: '   ', usuario: U, agora: TS }))[0].codigo === 'OBRIGATORIO', 'encerrar sem motivo: não monta');
const enc = js(pe['objetos-organizacionais/o2']);
afirma(erros(() => O.payloadAlteracao({ id: 'o2', atual: enc, audId: 'a8', dados: DADOS, usuario: U, agora: TS }))[0].codigo === 'OBJETO_ENCERRADO' && !O.podeReceberAvaliacao(enc) && O.podeReceberAvaliacao(atual),
  'encerrado: não se altera nem recebe avaliação');

console.log('D. Comparação da hipótese com a recomendação automática');
afirma(O.compararHipotese(undefined, 'COE') === 'nao-registrada' && O.compararHipotese('NAO_SEI', 'COE') === 'sem-hipotese' && O.compararHipotese('COE', 'A_VALIDAR') === 'a-validar' &&
  O.compararHipotese('COE', 'COE') === 'confirmada' && O.compararHipotese('COE', 'AREA_ESPECIALIZADA') === 'nao-confirmada', 'nao-registrada · sem-hipotese · a-validar · confirmada · nao-confirmada');
afirma(O.compararHipotese('NAO_SEI', 'A_VALIDAR') === 'sem-hipotese', 'Não sei nunca vira comparação, nem com A validar');

console.log('E. Contrato de independência da hipótese');
afirma(NU.avaliar.length === 4 && /function avaliar\(def, respostas, diagnosticos, predominancias\)/.test(fs.readFileSync(path.join(RAIZ, 'forca-agil', 'motor-posicionamento-nucleo.js'), 'utf8')),
  'o motor recebe só definição, respostas, diagnósticos e predominâncias — não há por onde a hipótese entrar');
function nucleoTela() {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout };
  ctx.window = ctx;
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-posicionamento.js', 'motor-posicionamento-nucleo.js', 'avaliacao-posicionamento.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, 'forca-agil', f), 'utf8'), ctx, { filename: f });
  ctx.faPosicionamentos = { nome: (c) => 'Nome de ' + c, usandoContingencia: () => false };
  return ctx.faAvaliacaoPosicionamentoNucleo;
}
const N = nucleoTela();
const porRegra = {};
T.estadosConcluiveis().forEach((x) => { if (!porRegra[x.regra.id]) porRegra[x.regra.id] = x; });
const quem = { name: 'P', email: 'p@previ.com.br' }, QUANDO = '2026-10-13T12:00:00.000Z';
let divergentes = [], comparados = 0;
Object.keys(porRegra).forEach((rid) => {
  const x = porRegra[rid];
  const base = (extra) => {
    const reg = js(N.payloadCriacao(Object.assign({ id: 'e1', audId: 'k1', itemId: 'it', itemNome: 'Item', versao: 1, usuario: quem, agora: QUANDO }, extra))['avaliacoes-posicionamento/e1']);
    reg.respostas = {};
    Object.keys(x.est.respostas).forEach((q) => { reg.respostas[q] = js(N.snapshotResposta(q, x.est.respostas[q], 1, null, QUANDO)); });
    Object.keys(x.est.diagnosticos).forEach((n) => { reg.diagnosticos = reg.diagnosticos || {}; reg.diagnosticos[n] = js(N.snapshotDiagnostico(x.est.diagnosticos[n], N.papeisDoPar(reg, n), 1, null, QUANDO)); });
    return js(N.payloadConclusao('e1', reg, quem, QUANDO, 2, 'kz').payload['avaliacoes-posicionamento/e1'].resultadoAutomatico);
  };
  const ref = base({ avaliacaoArquiteturalId: 'it' });
  const variantes = [{ avaliacaoArquiteturalId: 'it', hipoteseInicial: 'NAO_SEI' }].concat(O.CODIGOS_HIPOTESE.map((h) => ({ origem: O.ORIGEM, hipoteseInicial: h })));
  variantes.forEach((vv) => { comparados++; if (JSON.stringify(base(vv)) !== JSON.stringify(ref)) divergentes.push(rid + '/' + vv.hipoteseInicial); });
});
const cobertos = new Set(Object.keys(porRegra).map((rid) => NU.avaliar(NU.definicao(1), porRegra[rid].est.respostas, porRegra[rid].est.diagnosticos).codigoResultado));
afirma(NU.CODIGOS_FIRMES.concat(['A_VALIDAR']).every((c) => cobertos.has(c)),
  'um estado de cada regra concluível do motor (' + Object.keys(porRegra).length + ' regras), cobrindo os 8 firmes e A validar');
afirma(divergentes.length === 0, 'a recomendação gravada é a mesma com as 9 hipóteses, sem hipótese e pelas duas portas (' + comparados + ' comparações)', divergentes.slice(0, 5).join(' '));

console.log('F. Porta 1 intacta');
const p1 = N.payloadCriacao({ id: 'x1', audId: 'y1', itemId: 'it', itemNome: 'Item', avaliacaoArquiteturalId: 'it', versao: 1, usuario: quem, agora: QUANDO });
afirma(p1['avaliacoes-posicionamento/x1'].avaliacaoArquiteturalId === 'it' && !('origem' in p1['avaliacoes-posicionamento/x1']) && !('hipoteseInicial' in p1['avaliacoes-posicionamento/x1']) &&
  JSON.stringify(Object.keys(p1['posicionamento-auditoria/x1/y1']).sort()) === JSON.stringify(['avaliacaoArquiteturalId', 'dataHora', 'itemId', 'tipo', 'usuario']), 'Porta 1 sem os campos novos: registro e auditoria como antes');
const p2 = N.payloadCriacao({ id: 'x2', audId: 'y2', itemId: 'o1', itemNome: 'Obj', origem: O.ORIGEM, hipoteseInicial: 'COE', versao: 1, usuario: quem, agora: QUANDO });
afirma(!('avaliacaoArquiteturalId' in p2['avaliacoes-posicionamento/x2']) && p2['avaliacoes-posicionamento/x2'].origem === O.ORIGEM && p2['posicionamento-auditoria/x2/y2'].hipoteseInicial === 'COE',
  'Porta 2: sem base P1–P16 (nem undefined), com origem e hipótese no registro e na auditoria');

console.log('G. Regras publicadas = montadas');
const MR = require('./montar-regras-objetos-organizacionais.js');
const publicadas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'database.rules.json'), 'utf8')).rules;
afirma(MR.NOS.every((n) => JSON.stringify(publicadas[n]) === JSON.stringify(MR.BLOCOS[n])), 'os 3 nós de database.rules.json são os montados (' + MR.NOS.join(', ') + ')');

console.log('Cadastro simplificado (uma descrição, nada inferido)');
const s1 = O.dadosSimplificados({ texto: 'Gerir o planejamento e execução orçamentária.' });
afirma(s1.nome === 'Gerir o planejamento e execução orçamentária.' && s1.descricao === s1.nome && s1.finalidade === s1.nome && O.validarDados(s1).length === 0, 'o texto literal preenche nome, descrição e finalidade — e passa na validação do cadastro');
afirma(/o nome e a finalidade repetem a descrição informada pela pessoa; nada foi inferido/.test(s1.contexto), 'o contexto declara quais campos repetem a descrição', s1.contexto);
const longo = 'x'.repeat(250);
const s2 = O.dadosSimplificados({ texto: longo });
afirma(s2.nome === '' && O.validarDados(s2).some((e) => e.campo === 'nome'), 'descrição acima do limite do nome: sem nome curto, o cadastro recusa (nada é cortado em silêncio)');
const s3 = O.dadosSimplificados({ texto: longo, nomeCurto: 'Gerir o orçamento', finalidade: 'Orçamento executado conforme o planejado', contexto: 'Da análise X.' });
afirma(s3.nome === 'Gerir o orçamento' && s3.finalidade === 'Orçamento executado conforme o planejado' && s3.contexto === 'Da análise X.' && O.validarDados(s3).length === 0, 'nome curto e finalidade declarados pela pessoa: nenhuma nota de repetição');
afirma(Object.isFrozen(O) && typeof O.dadosSimplificados === 'function', 'API congelada, com dadosSimplificados');

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
