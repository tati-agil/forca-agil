/* ═════════════════════════════════════════════════════════════════
   Modelo ÚNICO das naturezas arquiteturais (forca-agil/naturezas-arquiteturais.js) — unificação da Taxonomia, 18/10/2026.
   Sem navegador, sem banco, sem rede. Prova:
   A. Unicidade: 15 naturezas, códigos e identidades (conceito) distintos; Produto/Serviço a ÚNICA conjunta; nenhuma
      classificação técnica do motor é natureza (nem tem o código de uma); cada natureza numa classificação só.
   B. Compatibilidade: os 11 códigos do modelo = CAMADAS de avaliacao-produto.js = CAMADAS_VALIDAS de motor-arquitetura.js
      (o motor não muda); as identidades reaproveitadas são os códigos que já existiam.
   C. Correspondência aprovada: Opção SÓ em modalidade-subproduto; Regra/Opção (regra-condicao) → só Regra, com a
      orientação de reavaliação; Modalidade e Subproduto distintas e pendentes (E5), fora da E4 e das regras.
   D. A E4 deriva do modelo (núcleo e regras do banco): naturezas, classificações, códigos individuais — sem lista própria.
   E. Diagnóstico (só leitura): cenário de produção, conceitos a cadastrar, divergências, duplicidade, fora do modelo;
      determinístico, não altera a entrada (rodar de novo dá o mesmo resultado); o script de produção não grava nada.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..', '..');
const NA = require(path.join(RAIZ, 'forca-agil', 'naturezas-arquiteturais.js'));
const R = require(path.join(RAIZ, 'forca-agil', 'relacoes-objetos-nucleo.js'));
const DIAG = require('./diagnosticar-taxonomia-arquitetural.js');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cods = NA.NATUREZAS.map((n) => n.codigo), conceitos = NA.NATUREZAS.map((n) => n.conceito);
const TECNICAS = ['funcionalidade-operacao', 'processo-etapa', 'regra-condicao', 'modalidade-subproduto', 'documento-informacao', 'a-validar'];

console.log('A. Unicidade');
anota('15 naturezas', NA.NATUREZAS.length === 15, NA.NATUREZAS.length);
anota('as 15 aprovadas, nenhuma a mais', igual(cods.slice().sort(), ['canal', 'capacidade', 'componente', 'documento', 'etapa', 'funcionalidade', 'informacao', 'modalidade', 'opcao', 'operacao', 'processo', 'produto', 'regra', 'subproduto', 'unidade-valor']));
anota('códigos de natureza distintos', new Set(cods).size === 15);
anota('identidades (conceito da Taxonomia) distintas', new Set(conceitos).size === 15);
anota('Produto/Serviço é a única conjunta', igual(NA.NATUREZAS.filter((n) => n.conjunta).map((n) => n.codigo), ['produto']));
anota('as 6 classificações técnicas são exatamente os agrupamentos históricos', igual(NA.CLASSIFICACOES.filter((c) => c.tecnica).map((c) => c.codigo).sort(), TECNICAS.slice().sort()));
anota('nenhuma classificação técnica é identidade de natureza', TECNICAS.every((t) => conceitos.indexOf(t) === -1 && cods.indexOf(t) === -1));
anota('nenhuma classificação técnica aparece como natureza no papel do conceito', TECNICAS.every((t) => NA.papelDoConceito(t).papel === 'classificacao-tecnica'));
anota('cada natureza está em exatamente uma classificação do motor', NA.NATUREZAS.every((n) => NA.CLASSIFICACOES.filter((c) => c.naturezas.indexOf(n.codigo) !== -1).length === 1));
anota('o modelo é imutável (congelado)', Object.isFrozen(NA) && Object.isFrozen(NA.NATUREZAS[0]) && Object.isFrozen(NA.CLASSIFICACOES[0].naturezas));

console.log('B. Compatibilidade com o motor P1–P16 (sem mudar o motor)');
const fonteProd = fs.readFileSync(path.join(RAIZ, 'forca-agil', 'avaliacao-produto.js'), 'utf8');
const camadas = vm.runInNewContext('(' + fonteProd.slice(fonteProd.indexOf('var CAMADAS = [') + 'var CAMADAS = '.length, fonteProd.indexOf('];', fonteProd.indexOf('var CAMADAS = [')) + 1) + ')').map((c) => c.id);
const fonteMotor = fs.readFileSync(path.join(RAIZ, 'forca-agil', 'motor-arquitetura.js'), 'utf8');
const validas = vm.runInNewContext('(' + fonteMotor.slice(fonteMotor.indexOf('var CAMADAS_VALIDAS = [') + 'var CAMADAS_VALIDAS = '.length, fonteMotor.indexOf('];', fonteMotor.indexOf('var CAMADAS_VALIDAS = [')) + 1) + ')');
const doModelo = NA.CLASSIFICACOES.map((c) => c.codigo);
anota('os 11 códigos do modelo = CAMADAS de avaliacao-produto.js (mesma ordem)', igual(doModelo, camadas), camadas.join(','));
anota('os 11 códigos do modelo = CAMADAS_VALIDAS do motor', igual(doModelo.slice().sort(), validas.slice().sort()));
anota('identidades reaproveitadas = códigos que já existiam (5 diretas)', igual(NA.NATUREZAS.filter((n) => n.modelo === 'direta').map((n) => n.conceito).sort(), ['canal', 'capacidade-organizacional', 'componente', 'produto-principal', 'unidade-valor-associada']));
anota('cada natureza direta é a própria classificação do motor (mesma identidade)', NA.NATUREZAS.filter((n) => n.modelo === 'direta').every((n) => n.conceito === n.classificacao));
anota('toda classificação não técnica corresponde a exatamente uma natureza', NA.CLASSIFICACOES.filter((c) => !c.tecnica).every((c) => c.naturezas.length === 1));
anota('a-validar não corresponde a nenhuma natureza', NA.naturezasDaClassificacao('a-validar').length === 0);

console.log('C. Correspondência aprovada');
anota('Opção corresponde SÓ a modalidade-subproduto', igual(NA.CLASSIFICACOES.filter((c) => c.naturezas.indexOf('opcao') !== -1).map((c) => c.codigo), ['modalidade-subproduto']));
anota('Regra/Opção (regra-condicao) admite só Regra', igual(NA.naturezasDaClassificacao('regra-condicao'), ['regra']) && !NA.admite('regra-condicao', 'opcao'));
const ori = NA.orientacao('regra-condicao');
anota('Regra/Opção tem orientação: Opção exige reavaliação explícita, histórico preservado, nada muda sozinho', !!ori && ori.natureza === 'opcao' && /reavalie P1–P16/.test(ori.texto) && /histórico/.test(ori.texto) && /nada muda sozinho/.test(ori.texto));
anota('Modalidade e Subproduto: distintas, na mesma classificação, pendentes (E5)', NA.natureza('modalidade').modelo === 'pendente' && NA.natureza('subproduto').modelo === 'pendente' && NA.natureza('modalidade').conceito !== NA.natureza('subproduto').conceito && NA.admite('modalidade-subproduto', 'modalidade') && NA.admite('modalidade-subproduto', 'subproduto'));
anota('pendentes não são registráveis', igual(NA.naturezasDaClassificacao('modalidade-subproduto', { registraveis: true }), ['opcao']));
anota('as 8 individuais aprovadas', igual(NA.NATUREZAS.filter((n) => n.modelo === 'individual').map((n) => n.codigo).sort(), ['documento', 'etapa', 'funcionalidade', 'informacao', 'opcao', 'operacao', 'processo', 'regra']));

console.log('D. A E4 deriva do modelo');
anota('naturezas P1–P16 da E4 = as não pendentes do modelo', igual(R.NATUREZAS_P1P16.slice().sort(), NA.NATUREZAS.filter((n) => n.modelo !== 'pendente').map((n) => n.codigo).sort()));
anota('cada natureza da E4 está na classificação do modelo e com a mesma identidade', R.NATUREZAS_P1P16.every((c) => R.NATUREZAS[c].camada === NA.natureza(c).classificacao && R.NATUREZAS[c].conceito === NA.natureza(c).conceito));
anota('códigos individuais da E4 = individuais do modelo', igual(R.CODIGOS_INDIVIDUAIS.slice().sort(), NA.NATUREZAS.filter((n) => n.modelo === 'individual').map((n) => n.codigo).sort()));
anota('classificações por natureza direta (E4) = diretas do modelo, menos Produto (decisão final)', igual(Object.keys(R.NATUREZA_DA_CAMADA).sort(), ['canal', 'capacidade-organizacional', 'componente', 'unidade-valor-associada']));
anota('Opção na E4 só a partir de modalidade-subproduto', igual(Object.keys(R.INDIVIDUAIS_DA_CAMADA).filter((k) => R.INDIVIDUAIS_DA_CAMADA[k].indexOf('opcao') !== -1), ['modalidade-subproduto']));
const regras = fs.readFileSync(path.join(RAIZ, 'database.rules.json'), 'utf8');
const naRegra = (c) => regras.indexOf("$codigo === '" + c + "'") !== -1;
anota('as regras do banco aceitam conceito individual só das 8 aprovadas', NA.NATUREZAS.filter((n) => n.modelo === 'individual').every((n) => naRegra(n.codigo)) && !naRegra('modalidade') && !naRegra('subproduto'));
anota('as regras nunca deixam Opção vir de regra-condicao', regras.indexOf("child('naturezaOrigem').val() === 'opcao' && root.child('avaliacoes-produto/' + newData.child('baseOrigem').val()).child('camadaSugerida/id').val() === 'modalidade-subproduto'") !== -1 &&
  regras.indexOf("'opcao' && root.child('avaliacoes-produto/' + newData.child('baseOrigem').val()).child('camadaSugerida/id').val() === 'regra-condicao'") === -1);
const gate = (camada) => ({ situacao: 'atual', libera: true, chave: 'k', avaliacao: { decisaoFinal: 'nao-produto', camadaSugerida: { id: camada } } });
const rc = R.naturezaDoObjeto({ gate: gate('regra-condicao') });
anota('objeto em Regra/Opção: só Regra possível, com a orientação do modelo', rc.motivo === 'NATUREZA_NAO_REGISTRADA' && igual(rc.possiveis, ['regra']) && rc.orientacao === ori);
const op = R.naturezaDoObjeto({ gate: gate('regra-condicao'), registro: { natureza: 'opcao', camada: 'regra-condicao' } });
anota('Opção registrada sobre Regra/Opção não vale (a confirmar), nunca vira natureza sozinha', op.natureza === null && op.motivo === 'NATUREZA_A_CONFIRMAR');
anota('objeto em Modalidade/Subproduto: só Opção registrável', igual(R.naturezaDoObjeto({ gate: gate('modalidade-subproduto') }).possiveis, ['opcao']));

console.log('E. Diagnóstico (só leitura)');
const def = { texto: 'Definição (teste)', versao: 1 };
/* "produção" como o desenho conhece: os 11 códigos do motor como conceitos, ligados à Avaliação, nenhum individual ainda */
const prod = {};
doModelo.forEach((c, i) => { prod[c] = { nome: 'Nome ' + c, ordem: i + 1, ativo: true, definicaoVigenteFonteId: 'f' + i }; });
const lig = {}; doModelo.forEach((c) => { lig[c] = { registradoEm: 1, registradoPor: 'x', auditoriaId: 'a' }; });
const copia = JSON.parse(JSON.stringify(prod));
const d1 = NA.diagnosticar(prod, lig), d2 = NA.diagnosticar(prod, lig);
const sit = (d, c) => d.naturezas.filter((x) => x.natureza === c)[0].situacao;
anota('cenário produção: 5 diretas cadastradas, 8 a cadastrar, 2 pendentes, nenhuma ausente', d1.naturezas.filter((x) => x.situacao === 'cadastrada').length === 5 && d1.naturezas.filter((x) => x.situacao === 'a-cadastrar').length === 8 && d1.naturezas.filter((x) => x.situacao === 'pendente').length === 2);
anota('cenário produção: 6 classificações técnicas preservadas e ligadas', d1.classificacoesTecnicas.length === 6 && d1.classificacoesTecnicas.every((x) => x.existe && x.ligada === true));
anota('cenário produção: coerente (nada fora do modelo, sem duplicidade)', d1.ok && !d1.foraDoModelo.length && !d1.duplicados.length, JSON.stringify(d1.duplicados));
anota('determinístico: rodar de novo dá exatamente o mesmo resultado', igual(d1, d2));
anota('não altera a entrada', igual(prod, copia));
anota('ligações não lidas → "ligada" desconhecida (nunca "não ligada")', NA.diagnosticar(prod).classificacoesTecnicas.every((x) => x.ligada === null));
const comInd = Object.assign({}, prod, { operacao: { nome: 'Operação', ordem: 101, ativo: true, naturezaDe: 'funcionalidade-operacao', definicao: def } });
anota('individual cadastrada corretamente → cadastrada, coerente', sit(NA.diagnosticar(comInd, lig), 'operacao') === 'cadastrada' && NA.diagnosticar(comInd, lig).ok);
const errada = Object.assign({}, prod, { opcao: { nome: 'Opção', ordem: 106, ativo: true, naturezaDe: 'regra-condicao', definicao: def } });
anota('Opção ligada a Regra/Opção → requer revisão (naturezaDe divergente)', sit(NA.diagnosticar(errada, lig), 'opcao') === 'inconsistente' && !NA.diagnosticar(errada, lig).ok);
const pend = Object.assign({}, prod, { modalidade: { nome: 'Modalidade', ordem: 120, ativo: true, definicao: def } });
anota('Modalidade cadastrada antes da E5 → requer revisão', sit(NA.diagnosticar(pend, lig), 'modalidade') === 'inconsistente');
const semComp = Object.assign({}, prod); delete semComp.componente;
anota('natureza direta sem conceito → conceito ausente', sit(NA.diagnosticar(semComp, lig), 'componente') === 'ausente' && !NA.diagnosticar(semComp, lig).ok);
const inat = Object.assign({}, prod, { canal: Object.assign({}, prod.canal, { ativo: false }) });
anota('natureza inativa → requer revisão', sit(NA.diagnosticar(inat, lig), 'canal') === 'inconsistente');
const dup = Object.assign({}, comInd, { 'operacao-2': { nome: 'Operação', ordem: 130, ativo: true, naturezaDe: 'funcionalidade-operacao', definicao: def } });
const dd = NA.diagnosticar(dup, lig);
anota('segunda "Operação" com outro código → duplicidade e fora do modelo', dd.duplicados.some((x) => x.motivo === 'mesmo-nome' && igual(x.codigos, ['operacao', 'operacao-2'])) && dd.duplicados.some((x) => x.motivo === 'natureza-fora-do-modelo') && dd.foraDoModelo.some((x) => x.codigo === 'operacao-2'));
anota('nome igual com acento/caixa diferentes também é duplicidade', NA.diagnosticar(Object.assign({}, comInd, { x: { nome: 'OPERACAO', ativo: true } })).duplicados.some((x) => x.codigos.indexOf('x') !== -1));
const tecMarcada = Object.assign({}, prod, { 'regra-condicao': Object.assign({}, prod['regra-condicao'], { naturezaDe: 'regra-condicao' }) });
anota('classificação técnica marcada como natureza → problema', NA.diagnosticar(tecMarcada, lig).classificacoesTecnicas.some((x) => x.codigo === 'regra-condicao' && x.problemas.length));
anota('banco vazio: nada quebra; diretas ausentes, técnicas sem conceito', (() => { const v = NA.diagnosticar(null, null); return v.naturezas.filter((x) => x.situacao === 'ausente').length === 5 && v.classificacoesTecnicas.every((x) => !x.existe); })());
const rel = DIAG.relatorio(d1);
anota('relatório do diagnóstico de produção resume naturezas e classificações técnicas', /Naturezas previstas: 15/.test(rel) && /regra-condicao: preservada/.test(rel) && /a cadastrar/.test(rel));
const fonteDiag = fs.readFileSync(path.join(__dirname, 'diagnosticar-taxonomia-arquitetural.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
anota('o script de produção não tem nenhuma gravação (só leitura)', !/\.(set|update|remove|transaction|setWithPriority)\s*\(/.test(fonteDiag) && !/ref\([^)]*\)\s*\.push\s*\(/.test(fonteDiag) && /once\('value'\)/.test(fonteDiag));
const wf = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'taxonomia-diagnostico-naturezas.yml'), 'utf8');
anota('o workflow do diagnóstico é só manual e só leitura', /workflow_dispatch/.test(wf) && !/\bpush:|pull_request|schedule/.test(wf) && /contents: read/.test(wf));

console.log('\n' + (falhas ? 'FALHAS: ' + falhas + ' de ' + total : 'TUDO OK — ' + total + ' verificações'));
process.exit(falhas ? 1 : 0);
