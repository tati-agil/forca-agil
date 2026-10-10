/* EXPORTAÇÕES DO POSICIONAMENTO ORGANIZACIONAL — o núcleo puro (forca-agil/exportacoes-posicionamento.js), PR G1.
 * Sem navegador, sem rede, sem banco. Prova:
 *   1. pureza: o módulo não usa banco, página, autenticação, motor, rede nem armazenamento — e funciona com o motor
 *      ARMADILHADO (qualquer acesso a faMotorPosicionamento derruba o teste);
 *   2. NÃO RECALCULA: um registro cujo resultado gravado difere de propósito do que o motor atual daria sai com o
 *      valor GRAVADO (recomendação, regra, versão do motor, liberaSquad automático e da decisão);
 *   3. vínculo EXATO com Produto/Serviço: um Posicionamento ligado à v1 exporta a v1 mesmo com v2 e v3 do item;
 *      referência ausente → o ID + "Dados da avaliação vinculada indisponíveis", sem inferir nada;
 *   4. "não saber ≠ não ter": sem decisoesConhecidas o módulo RECUSA montar (nunca escreve "Sem decisão registrada");
 *   5. PDF só de concluída (vigente ou histórica); rascunho, reavaliação em andamento e descartada recusados;
 *   6. casos: PR E sem decisão, CONFIRMACAO, DIVERGENCIA (nome registrado ≠ atual), RESOLUCAO_A_VALIDAR,
 *      A validar sem decisão, vigente × histórica, reavaliação com anterior e motivo;
 *   7. trilha: lida → eventos legíveis em ordem; indisponível → "Trilha indisponível" no PDF e uma linha por versão
 *      no Excel, e o resto do arquivo igual;
 *   8. textos da época preservados (o questionário atual diferente não muda nada); sem cópia, o da versão registrada;
 *   9. Excel: abas Resumo / Respostas O1–O9 / Histórico / Trilha; "Situação na exportação"; Histórico com as versões
 *      dos itens do escopo mesmo fora do filtro; datas como datas;
 *  10. acentuação pt-BR intacta (ç, ã, õ, é, ê, ô, —, aspas). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ARQ = path.join(__dirname, '..', '..', 'forca-agil', 'exportacoes-posicionamento.js');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
const texto = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const recusa = (fn, padrao) => { try { fn(); return false; } catch (e) { return !padrao || padrao.test(e.message); } };

console.log('\n== 1. Pureza ==');
const fonte = fs.readFileSync(ARQ, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
[['firebase', /firebase/i], ['.ref(', /\.ref\(/], ['document', /\bdocument\b/], ['faAuth', /faAuth/], ['motor', /faMotor/], ['localStorage/sessionStorage', /(local|session)Storage/],
  ['location/history', /\b(location|history)\./], ['rede (fetch/XMLHttpRequest)', /\bfetch\(|XMLHttpRequest/], ['innerHTML/querySelector', /innerHTML|querySelector/], ['setTimeout', /setTimeout/]]
  .forEach(([rot, re]) => afirma(!re.test(fonte), 'o módulo não usa ' + rot));
/* carrega num contexto com o motor ARMADILHADO: qualquer acesso derruba */
const acessos = [];
const ctxVm = { console, Object, Array, String, Number, Date, RegExp, Error, JSON, Math, Intl };
ctxVm.window = ctxVm;
Object.defineProperty(ctxVm, 'faMotorPosicionamento', { get() { acessos.push('faMotorPosicionamento'); throw new Error('o exportador acessou o motor'); } });
vm.createContext(ctxVm);
vm.runInContext(fs.readFileSync(ARQ, 'utf8'), ctxVm, { filename: 'exportacoes-posicionamento.js' });
const E = ctxVm.faExportacoesPosicionamento;
afirma(!!E && Object.isFrozen(E), 'window.faExportacoesPosicionamento existe e é congelado');

/* ---------- dados ---------- */
const QUANDO = (h) => '2026-10-0' + h + 'T1' + h + ':00:00.000Z';
const ana = { name: 'Ana Conceição', email: 'ana@previ.com.br' }, joao = { name: 'João Gonçalves', email: 'joao@previ.com.br' };
function resp(q, v, extra) {
  return Object.assign({ resposta: v, codigoPergunta: q, tituloNaEpoca: 'Título ' + q + ' da época', textoPerguntaNaEpoca: 'Pergunta ' + q + ' na redação da época — ação?',
    interpretacaoNaEpoca: 'Interpretação de ' + v + ' em ' + q, questionnaireContentVersion: 1, dataResposta: QUANDO(1) }, extra || {});
}
function conc(itemId, itemNome, versao, respostas, ra, extra) {
  const r = { itemId, itemNome, avaliacaoArquiteturalId: 'pp-' + itemId, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao,
    status: 'concluido', revisao: 2, respostas: {}, resultadoAutomatico: ra, criadoPor: ana, criadoEm: QUANDO(1), atualizadoPor: ana, atualizadoEm: QUANDO(2),
    concluidoPor: ana, concluidoEm: QUANDO(2), auditoriaCriacaoId: 'c', auditoriaConclusaoId: 'z' };
  Object.keys(respostas).forEach((q) => { r.respostas[q] = resp(q, respostas[q]); });
  return Object.assign(r, extra || {});
}
const AE = { O1: 'NAO', O2: 'SIM', O3: 'NAO' };
const raAE = { codigoResultado: 'AREA_ESPECIALIZADA', motivo: 'PAPEL_UNICO', papeisDetectados: ['AREA_ESPECIALIZADA'], regra: 'N1_AREA_ESPECIALIZADA', versaoMotor: 1, liberaSquad: false, niveisAlcancados: ['N1'] };
const NOME = 'Gestão de Crédito — Ação "Ônibus" São João';
const registros = {
  /* PR E: concluída, sem anterior, sem decisão */
  gE: conc('pE', 'Item do PR E', 1, { O1: 'NAO', O2: 'NAO', O3: 'SIM' }, { codigoResultado: 'COE', motivo: 'PAPEL_UNICO', papeisDetectados: ['COE'], regra: 'N1_COE', versaoMotor: 1, liberaSquad: false, niveisAlcancados: ['N1'] },
    { nomesNaConclusao: { COE: { nome: 'Centro de Excelência (nome na conclusão)', contingencia: false } } }),
  gC: conc('pC', NOME, 1, AE, raAE, { nomesNaConclusao: { AREA_ESPECIALIZADA: { nome: 'Área Especializada', contingencia: true } } }),
  /* NÃO RECALCULAR: as respostas dão AREA_ESPECIALIZADA no motor atual e, pela regra v1, NEGOCIOS liberaria; o GRAVADO diz NEGOCIOS e NÃO libera
     (como um motor futuro poderia ter gravado) — a exportação tem de mostrar o gravado */
  gD: conc('pD', 'Item divergente', 1, AE, { codigoResultado: 'NEGOCIOS', motivo: 'MOTIVO_GRAVADO', papeisDetectados: ['NEGOCIOS'], regra: 'REGRA_GRAVADA_V1', versaoMotor: 1, liberaSquad: false, nivelConfirmado: 'LINHA', niveisAlcancados: ['N1', 'N2'] },
    { nomesNaConclusao: { NEGOCIOS: { nome: 'Negócios', contingencia: false }, LINHA: { nome: 'Linha', contingencia: false } } }),
  gR: conc('pR', 'Item A validar resolvido', 1, { O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { codigoResultado: 'A_VALIDAR', tipoAValidar: 'CONFLITO', motivo: 'CONFLITO', papeisDetectados: ['AREA_ESPECIALIZADA', 'COE'], regra: 'N1_CONFLITO', versaoMotor: 1, liberaSquad: false, niveisAlcancados: ['N1'] },
    { diagnosticos: { N1: { resposta: 'mesma', papeis: ['AREA_ESPECIALIZADA', 'COE'], tituloNaEpoca: 'Conflito ou recorte', textoPerguntaNaEpoca: 'Os dois papéis são a mesma responsabilidade?', rotuloNaEpoca: 'Mesma responsabilidade', interpretacaoNaEpoca: 'Conflito de posicionamento', observacao: 'Observação do diagnóstico — ação', questionnaireContentVersion: 1, dataResposta: QUANDO(1) } } }),
  gAV: conc('pAV', 'Item A validar aberto', 1, { O1: 'SIM', O2: 'SIM', O3: 'SIM' }, { codigoResultado: 'A_VALIDAR', tipoAValidar: 'RECORTE', motivo: 'RECORTE', papeisDetectados: ['LINHA', 'AREA_ESPECIALIZADA', 'COE'], regra: 'N1_RECORTE', versaoMotor: 1, liberaSquad: false, niveisAlcancados: ['N1'] }),
  /* cadeia: h1 (v1, histórica, decidida) → h2 (v2, vigente) → h3 (v3, reavaliação em andamento) */
  h1: conc('pH', 'Item com versões', 1, AE, raAE),
  h2: conc('pH', 'Item com versões', 2, AE, raAE, { avaliacaoAnteriorId: 'h1', motivoReavaliacao: 'Mudança na estrutura de atendimento' }),
  h3: { itemId: 'pH', itemNome: 'Item com versões', avaliacaoArquiteturalId: 'pp-pH', questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 3, status: 'rascunho', revisao: 1,
    avaliacaoAnteriorId: 'h2', motivoReavaliacao: 'Terceira revisão', respostas: { O1: resp('O1', 'NAO') }, criadoPor: joao, criadoEm: QUANDO(3), atualizadoPor: joao, atualizadoEm: QUANDO(3) },
  x1: { itemId: 'pX', itemNome: 'Item descartado', avaliacaoArquiteturalId: 'pp-pX', questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'descartado', revisao: 2,
    motivoDescarte: 'Iniciada por engano — duplicação', descartadoPor: joao, descartadoEm: QUANDO(4), criadoPor: joao, criadoEm: QUANDO(3), atualizadoPor: joao, atualizadoEm: QUANDO(4) },
  /* vínculo exato: ligada à v1 do Produto/Serviço do item pV, que já tem v2 e v3 */
  gV: conc('pV', 'Item com Produto v3', 1, AE, raAE, { avaliacaoArquiteturalId: 'pv1' }),
  gF: conc('pF', 'Item sem Produto', 1, AE, raAE, { avaliacaoArquiteturalId: 'p-inexistente' }),
  /* sem cópia do texto na resposta: usa a versão registrada do questionário */
  gS: conc('pS', 'Item sem snapshot', 1, AE, raAE)
};
Object.keys(registros.gS.respostas).forEach((q) => { delete registros.gS.respostas[q].textoPerguntaNaEpoca; delete registros.gS.respostas[q].tituloNaEpoca; });
const decisoes = {
  gC: { itemId: 'pC', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'AREA_ESPECIALIZADA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO',
    nomeNaDecisao: { nome: 'Área Especializada', contingencia: false }, liberaSquad: false, decididoPor: joao, decididoEm: QUANDO(5), auditoriaId: 'd' },
  /* NÃO RECALCULAR: o motor diria que COE não libera; o GRAVADO na decisão diz true */
  gD: { itemId: 'pD', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'NEGOCIOS', codigoFinal: 'COE', tipoDecisao: 'DIVERGENCIA', justificativa: 'A área já atua como referência técnica — decisão da diretoria',
    nomeNaDecisao: { nome: 'CoE (nome na decisão)', contingencia: false }, liberaSquad: true, decididoPor: joao, decididoEm: QUANDO(5), auditoriaId: 'd' },
  gR: { itemId: 'pR', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'A_VALIDAR', tipoAValidarAutomatico: 'CONFLITO', codigoFinal: 'PLATAFORMA_CANAIS', tipoDecisao: 'RESOLUCAO_A_VALIDAR',
    justificativa: 'Resolvido em reunião com a área', nomeNaDecisao: { nome: 'Plataforma de Canais', contingencia: false }, liberaSquad: true, decididoPor: joao, decididoEm: QUANDO(5), auditoriaId: 'd' },
  h1: { itemId: 'pH', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'AREA_ESPECIALIZADA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO',
    nomeNaDecisao: { nome: 'Área Especializada', contingencia: false }, liberaSquad: false, decididoPor: joao, decididoEm: QUANDO(2), auditoriaId: 'd' }
};
const produtos = {
  pv1: { itemId: 'pV', nome: 'Produto do item pV', versao: 1, status: 'concluido', camadaSugerida: { id: 'produto-principal', label: 'Classificação da v1' } },
  pv2: { itemId: 'pV', nome: 'Produto do item pV', versao: 2, status: 'concluido', camadaSugerida: { id: 'componente', label: 'Classificação da v2' } },
  pv3: { itemId: 'pV', nome: 'Produto do item pV', versao: 3, status: 'concluido', camadaSugerida: { id: 'componente', label: 'Classificação da v3' } }
};
const vigentes = { pE: 'gE', pC: 'gC', pD: 'gD', pR: 'gR', pAV: 'gAV', pH: 'h2', pV: 'gV', pF: 'gF', pS: 'gS' };
const nomesAtuais = {};
M.CODIGOS_INTERMEDIARIOS.concat(M.CODIGOS_FIRMES).forEach((c) => { nomesAtuais[c] = { nome: 'Nome atual de ' + c, contingencia: false }; });
const trilhaOk = { ok: true, porAvaliacao: {
  h2: { a: { tipo: 'criacao', itemId: 'pH', avaliacaoAnteriorId: 'h1', motivo: 'Mudança na estrutura de atendimento', usuario: ana, dataHora: QUANDO(1) },
        b: { tipo: 'conclusao', itemId: 'pH', codigoResultado: 'AREA_ESPECIALIZADA', regra: 'N1_AREA_ESPECIALIZADA', versaoMotor: 1, liberaSquad: false, vigenteAnterior: 'h1', usuario: ana, dataHora: QUANDO(2) } },
  gD: { a: { tipo: 'criacao', itemId: 'pD', usuario: ana, dataHora: QUANDO(1) },
        c: { tipo: 'decisao', itemId: 'pD', codigoAutomatico: 'NEGOCIOS', codigoFinal: 'COE', tipoDecisao: 'DIVERGENCIA', versaoAvaliacao: 1, justificativa: 'A área já atua como referência técnica — decisão da diretoria', liberaSquad: true, usuario: joao, dataHora: QUANDO(5) },
        b: { tipo: 'conclusao', itemId: 'pD', codigoResultado: 'NEGOCIOS', regra: 'REGRA_GRAVADA_V1', versaoMotor: 1, liberaSquad: false, usuario: ana, dataHora: QUANDO(2) } },
  x1: { a: { tipo: 'criacao', itemId: 'pX', usuario: joao, dataHora: QUANDO(3) }, b: { tipo: 'descarte', itemId: 'pX', motivo: 'Iniciada por engano — duplicação', usuario: joao, dataHora: QUANDO(4) } }
} };
/* o questionário "atual" tem outra redação: a exportação NÃO pode usá-la quando há texto da época */
const textoQuestionario = (codigo, versao) => ({ titulo: 'Título da v' + versao, texto: 'Redação da versão ' + versao + ' de ' + codigo });
const ctx = (extra) => Object.assign({ registros, decisoes, decisoesConhecidas: true, vigentes, produtos, nomesAtuais, trilha: trilhaOk, textoQuestionario, geradoEm: '2026-10-10T12:00:00.000Z' }, extra || {});
const pdf = (id, extra) => texto(E.atomosPdf(id, ctx(extra)).join(''));
const abas = (ids, extra) => { const r = {}; E.abasExcel(ids, ctx(extra)).forEach((a) => { r[a.nome] = a; }); return r; };
const col = (a, nome) => a.cabecalho.indexOf(nome);
const linhaDe = (a, colNome, valor) => a.linhas.find((l) => l[col(a, colNome)] === valor);

console.log('\n== 2. Não recalcula (motor armadilhado) ==');
const motorDiria = M.avaliar(AE, {});
afirma(motorDiria.codigoResultado === 'AREA_ESPECIALIZADA' && M.liberaSquadParaCodigoFirme('NEGOCIOS') === true && M.liberaSquadParaCodigoFirme('COE') === false,
  'premissa: o motor atual daria AREA_ESPECIALIZADA; pela regra atual NEGOCIOS libera e COE não');
const tD = pdf('gD');
afirma(/recomendado: Negócios/.test(tD) && /Regra REGRA_GRAVADA_V1 · motivo MOTIVO_GRAVADO · motor v1/.test(tD), 'PDF: recomendação, regra e motivo GRAVADOS (Negócios, REGRA_GRAVADA_V1), não os do motor atual');
afirma(/Pela recomendação automática, este resultado não libera/.test(tD), 'PDF: liberaSquad automático GRAVADO (false), não o da regra atual para NEGOCIOS (true)');
afirma(/Pela decisão final, a Adequação à Squad \(S1–S8\) pode ser realizada/.test(tD), 'PDF: liberaSquad da decisão GRAVADO (true), não liberaSquadParaCodigoFirme(COE) = false');
const xD = abas(['gD']).Resumo, lD = xD.linhas[0];
afirma(lD[col(xD, 'Recomendação automática (código)')] === 'NEGOCIOS' && lD[col(xD, 'Regra')] === 'REGRA_GRAVADA_V1' && lD[col(xD, 'Libera S1–S8 (recomendação automática)')] === 'Não' && lD[col(xD, 'Libera S1–S8 (decisão final)')] === 'Sim',
  'Excel: os mesmos valores gravados', JSON.stringify(lD));
afirma(acessos.length === 0, 'o motor nunca foi acessado (' + acessos.length + ' acessos)');

console.log('\n== 3. Vínculo exato com Produto/Serviço ==');
const tV = pdf('gV');
afirma(/Produto do item pV · v1 · Classificação da v1 · ID pv1/.test(tV) && !/v2|v3|Classificação da v[23]/.test(tV.split('Avaliação de Produto/Serviço usada')[1].slice(0, 80)), 'ligada à v1: exporta a v1, mesmo existindo v2 e v3 do item');
const rV = linhaDe(abas(['gV']).Resumo, 'ID da avaliação', 'gV');
afirma(rV[col(abas(['gV']).Resumo, 'ID da Avaliação de Produto/Serviço usada')] === 'pv1' && /· v1 ·/.test(rV[col(abas(['gV']).Resumo, 'Avaliação de Produto/Serviço usada')]), 'Excel: ID pv1 e v1');
const tF = pdf('gF');
afirma(/p-inexistente — Dados da avaliação vinculada indisponíveis/.test(tF), 'referência ausente: o ID + "Dados da avaliação vinculada indisponíveis" (nada inferido)');

console.log('\n== 4. Não saber ≠ não ter ==');
afirma(recusa(() => E.atomosPdf('gE', ctx({ decisoesConhecidas: false })), /decisoes-desconhecidas/), 'PDF recusado sem as decisões lidas');
afirma(recusa(() => E.abasExcel(['gE'], ctx({ decisoesConhecidas: undefined })), /decisoes-desconhecidas/), 'Excel recusado sem as decisões lidas');

console.log('\n== 5. PDF só de concluída ==');
['h3', 'x1'].forEach((id) => afirma(recusa(() => E.atomosPdf(id, ctx()), /pdf-so-de-concluida/), id + ' (' + registros[id].status + '): sem PDF'));
afirma(/Situação na exportação Histórica/.test(pdf('h1')) && /Situação na exportação Vigente/.test(pdf('h2')), 'histórica e vigente têm PDF, com "Situação na exportação"');

console.log('\n== 6. Casos ==');
const tE = pdf('gE');
afirma(/Decisão final Sem decisão registrada\./.test(tE) && /Primeira versão do Posicionamento deste item/.test(tE), 'PR E: "Sem decisão registrada." e primeira versão');
afirma(/recomendado: Centro de Excelência \(nome na conclusão\)/.test(tE) && /nome atual na Taxonomia: Nome atual de COE/.test(tE), 'nome registrado na conclusão em primeiro; o atual só como informação');
const tC = pdf('gC');
afirma(/Tipo da decisão Confirmação da recomendação automática/.test(tC) && /Justificativa —/.test(tC) && /rótulo de contingência/.test(tC), 'CONFIRMACAO: tipo, sem justificativa (—), contingência da conclusão');
afirma(/Posicionamento final CoE \(nome na decisão\)/.test(tD) && /Nome atual na Taxonomia Nome atual de COE/.test(tD) && /Divergência da recomendação automática/.test(tD) &&
  /Justificativa A área já atua como referência técnica — decisão da diretoria/.test(tD) && /Decidido por \/ em João Gonçalves ·/.test(tD), 'DIVERGENCIA: nome da decisão (≠ atual), tipo, justificativa, quem e quando');
const tR = pdf('gR');
afirma(/recomendado: A validar — conflito de posicionamento/.test(tR) && /Resolução do "A validar"/.test(tR) && /Posicionamento final Plataforma de Canais/.test(tR), 'RESOLUCAO_A_VALIDAR');
afirma(/Diagnóstico do Nível 1/.test(tR) && /Mesma responsabilidade/.test(tR) && /Papéis: Nome atual de AREA_ESPECIALIZADA e Nome atual de COE/.test(tR) && /Observação do diagnóstico — ação/.test(tR), 'diagnóstico com rótulo, papéis e observação da época');
const tAV = pdf('gAV');
afirma(/A validar — recorte do objeto/.test(tAV) && /Sem decisão registrada\./.test(tAV), 'A validar sem decisão');
const tH2 = pdf('h2');
afirma(/Reavaliação da v1 \(ID h1\) — motivo: Mudança na estrutura de atendimento/.test(tH2), 'reavaliação: anterior e motivo');
afirma(/v1 Histórica .* Área Especializada .* v2 \(esta\) Vigente .* Sem decisão registrada .* v3 Reavaliação em andamento/.test(tH2), 'histórico de versões: v1 histórica decidida, v2 (esta) sem decisão, v3 em andamento', tH2.slice(tH2.indexOf('Histórico de versões'), tH2.indexOf('Histórico de versões') + 400));

console.log('\n== 7. Trilha ==');
afirma(/Iniciada como reavaliação da v1 — motivo: Mudança na estrutura de atendimento · Ana Conceição/.test(tH2) && /Concluída — recomendação automática: Nome atual de AREA_ESPECIALIZADA \(passou a vigente no lugar da v1\)/.test(tH2), 'trilha legível: criação com anterior/motivo e conclusão com vigente anterior');
const ordem = ['Iniciada', 'Concluída', 'Decisão registrada'].map((t) => tD.indexOf(t));
afirma(ordem.every((x, i) => x > 0 && (i === 0 || x > ordem[i - 1])), 'eventos em ordem de data (criação → conclusão → decisão)');
const tSemTrilha = pdf('gD', { trilha: { ok: false } });
afirma(/Trilha indisponível/.test(tSemTrilha) && !/Nenhum evento registrado/.test(tSemTrilha), 'trilha indisponível: "Trilha indisponível", nunca "nenhum evento"');
afirma(tSemTrilha.replace(/Trilha .*?(?=Respostas O1–O9)/, '') === tD.replace(/Trilha .*?(?=Respostas O1–O9)/, ''), '…e o resto do PDF é idêntico');
afirma(/Nenhum evento registrado para esta avaliação/.test(pdf('gE')), 'trilha lida e vazia: "Nenhum evento registrado" (só quando de fato lida)');
const trSem = abas(['h2'], { trilha: { ok: false } }).Trilha;
afirma(trSem.linhas.length === 3 && trSem.linhas.every((l) => l[col(trSem, 'Evento')] === 'Trilha indisponível'), 'Excel: uma linha "Trilha indisponível" por versão do item (3)');

console.log('\n== 8. Textos da época ==');
afirma(/Pergunta O2 na redação da época — ação\? — SIM/.test(tC) && !/Redação da versão/.test(tC), 'PDF usa o texto da época, não o do questionário');
const tS = pdf('gS');
afirma(/Redação da versão 1 de O2/.test(tS) && /Origem do texto: Versão 1 do questionário/.test(tS), 'sem cópia: texto da versão registrada, com a origem');

console.log('\n== 9. Excel ==');
const todas = abas(Object.keys(registros));
afirma(JSON.stringify(Object.keys(todas)) === JSON.stringify(['Resumo', 'Respostas O1–O9', 'Histórico', 'Trilha']), 'abas Resumo / Respostas O1–O9 / Histórico / Trilha');
afirma(todas.Resumo.cabecalho.indexOf('Situação na exportação') !== -1 && todas.Histórico.cabecalho.indexOf('Situação na exportação') !== -1, '"Situação na exportação" nas abas');
afirma(todas.Resumo.linhas.length === Object.keys(registros).length, 'Resumo: uma linha por avaliação, inclusive rascunho e descartada');
const sitDe = (id) => linhaDe(todas.Resumo, 'ID da avaliação', id)[col(todas.Resumo, 'Situação na exportação')];
afirma(sitDe('h1') === 'Histórica' && sitDe('h2') === 'Vigente' && sitDe('h3') === 'Reavaliação em andamento' && sitDe('x1') === 'Descartada', 'situações');
afirma(linhaDe(todas.Resumo, 'ID da avaliação', 'gE')[col(todas.Resumo, 'Decisão final')] === 'Sem decisão registrada' && linhaDe(todas.Resumo, 'ID da avaliação', 'h3')[col(todas.Resumo, 'Decisão final')] === '',
  'Resumo: concluída sem decisão → "Sem decisão registrada"; rascunho → vazio');
afirma(linhaDe(todas.Resumo, 'ID da avaliação', 'gE')[col(todas.Resumo, 'Recomendação automática')] === 'Centro de Excelência (nome na conclusão)' &&
  linhaDe(todas.Histórico, 'ID da avaliação', 'gE')[col(todas.Histórico, 'Recomendação automática')] === 'Centro de Excelência (nome na conclusão)', 'Excel: recomendação com o nome registrado na conclusão (Resumo e Histórico), não o atual');
afirma(linhaDe(todas.Resumo, 'ID da avaliação', 'x1')[col(todas.Resumo, 'Motivo do descarte')] === 'Iniciada por engano — duplicação', 'descartada com motivo');
afirma(linhaDe(todas.Resumo, 'ID da avaliação', 'gD')[col(todas.Resumo, 'Decidido em')] instanceof Date, 'datas como datas');
const soH2 = abas(['h2']);
afirma(soH2.Resumo.linhas.length === 1 && soH2.Histórico.linhas.map((l) => l[col(soH2.Histórico, 'ID da avaliação')]).join() === 'h1,h2,h3', 'Histórico: as versões do item no escopo, mesmo fora do filtro (h1, h2, h3)');
const abaResp = todas['Respostas O1–O9'];
const dg = abaResp.linhas.find((l) => l[col(abaResp, 'Código')] === 'Diagnóstico N1');
afirma(dg && dg[col(abaResp, 'Resposta')] === 'Mesma responsabilidade' && /e/.test(dg[col(abaResp, 'Papéis (diagnóstico)')]), 'Respostas: linha do diagnóstico com rótulo e papéis');
afirma(abaResp.linhas.filter((l) => l[col(abaResp, 'ID da avaliação')] === 'gS').every((l) => l[col(abaResp, 'Origem do texto')] === 'Versão 1 do questionário'), 'Respostas: origem do texto');
const tr = abas(['gD']).Trilha;
afirma(tr.linhas.map((l) => l[col(tr, 'Evento')]).join() === 'Criação,Conclusão,Decisão' && tr.linhas[2][col(tr, 'Libera S1–S8')] === 'Sim' && /referência técnica/.test(tr.linhas[2][col(tr, 'Justificativa / motivo')]), 'Trilha: eventos em ordem, com liberaSquad e justificativa da decisão');

console.log('\n== 10. Acentuação pt-BR ==');
afirma(tC.indexOf(NOME) !== -1, 'nome com ç, ã, õ, ô, — e aspas intacto no PDF');
afirma(linhaDe(todas.Resumo, 'ID da avaliação', 'gC')[col(todas.Resumo, 'Item')] === NOME, '…e no Excel');
afirma(/Posicionamento_Organizacional_Gestao_de_Credito_Acao_Onibus_Sao_Joao_v1_2026-10-10\.pdf/.test(E.nomeArquivoPdf('gC', ctx(), '2026-10-10')), 'nome do arquivo sem acento e com a versão', E.nomeArquivoPdf('gC', ctx(), '2026-10-10'));
afirma(E.documentoPdf('x', true, '2026-10-10T12:00:00.000Z').indexOf('Posicionamento Organizacional') !== -1 && /momento da exportação/.test(E.documentoPdf('x', true, '2026-10-10T12:00:00.000Z')), 'cabeçalho do PDF avisa que a situação é a do momento da exportação');

console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
