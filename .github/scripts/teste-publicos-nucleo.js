/* ═════════════════════════════════════════════════════════════════
   Núcleo dos públicos (forca-agil/publicos-nucleo.js) — puro, sem navegador nem banco. Prova a tabela que o site, o ADMIN
   e as regras do banco usam:
   C. as sete categorias e os dois agrupados (Estagiários e menores aprendizes; Conselheiros = os três conselhos, SEM o
      COAUD), cada um só com a sua categoria;
   T. Técnicos: antes da ativação, "quem não é gerente" (como sempre foi); depois, fora de Gerentes, Diretores e das sete
      categorias; leitura que falta ou falhou NUNCA vira técnico (null);
   G. Gerentes e Diretores pelos cadastros de sempre; Diretores só restringe com a ativação;
   D. os descritivos (Empregados, Executivos, Cedidos, Quadro próprio) nunca restringem; nada de "Executivos" como público;
   R. o rótulo de cada público e o que ele faz antes/depois da ativação (o que o formulário do evento mostra).
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const P = require(path.join(__dirname, '..', '..', 'forca-agil', 'publicos-nucleo.js'));
let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const pf = (o) => Object.assign({ ativo: true, gerente: false, diretor: false, categorias: {} }, o || {});
const cats = (...l) => Object.fromEntries(l.map((c) => [c, true]));

console.log('\n== C. sete categorias e dois agrupados ==');
anota('C1 as sete categorias, na ordem do cadastro', JSON.stringify(P.CATEGORIAS) === JSON.stringify(['estagiario', 'menorAprendiz', 'coaud', 'conselhoDeliberativo', 'conselhoFiscal', 'conselhoConsultivo', 'assessor']));
const individuais = { estagiario: 'Estagiários', menorAprendiz: 'Menores aprendizes', coaud: 'Membros do COAUD', conselhoDeliberativo: 'Conselho Deliberativo',
  conselhoFiscal: 'Conselho Fiscal', conselhoConsultivo: 'Conselho Consultivo', assessor: 'Assessores' };
Object.keys(individuais).forEach((c) => {
  const def = P.publicoDoRotulo(individuais[c], true);
  const so = P.CATEGORIAS.filter((x) => P.atende(def.chave, pf({ categorias: cats(x) })));
  anota('C2 "' + individuais[c] + '" admite só quem tem ' + c, JSON.stringify(so) === JSON.stringify([c]), JSON.stringify(so));
});
const est = P.publicoDoRotulo('Estagiários e menores aprendizes', true);
anota('C3 "Estagiários e menores aprendizes" = união dos dois', JSON.stringify(P.CATEGORIAS.filter((x) => P.atende(est.chave, pf({ categorias: cats(x) })))) === JSON.stringify(['estagiario', 'menorAprendiz']));
const cons = P.publicoDoRotulo('Conselheiros', true);
anota('C4 "Conselheiros" = Deliberativo OU Fiscal OU Consultivo, sem o COAUD',
  JSON.stringify(P.CATEGORIAS.filter((x) => P.atende(cons.chave, pf({ categorias: cats(x) })))) === JSON.stringify(['conselhoDeliberativo', 'conselhoFiscal', 'conselhoConsultivo']));
anota('C5 categoria preservada: quem é dos dois conselhos atende aos dois individuais e ao agrupado',
  P.atende('conselhoFiscal', pf({ categorias: cats('conselhoFiscal', 'conselhoConsultivo') })) && P.atende('conselhoConsultivo', pf({ categorias: cats('conselhoFiscal', 'conselhoConsultivo') })) &&
  P.atende('conselheiros', pf({ categorias: cats('conselhoFiscal', 'conselhoConsultivo') })));
anota('C6 categorias não lidas (null): não verificado — nunca "não é" nem "é"', P.atende('assessor', pf({ categorias: null })) === null);

console.log('\n== T. Técnicos ==');
anota('T1 antes da ativação: técnico = não gerente (diretor e estagiário continuam técnicos, como sempre)',
  P.ehTecnico(pf({ ativo: false, diretor: true })) === true && P.ehTecnico(pf({ ativo: false, categorias: cats('estagiario') })) === true && P.ehTecnico(pf({ ativo: false, gerente: true })) === false);
anota('T2 antes da ativação, Diretores/Outros públicos que falharam não importam', P.ehTecnico({ ativo: false, gerente: false, diretor: null, categorias: null }) === true);
anota('T3 com a ativação: fora de Gerentes, Diretores e das sete categorias = técnico', P.ehTecnico(pf()) === true);
P.CATEGORIAS.forEach((c) => anota('T4 com a ativação, quem está em ' + c + ' NÃO é técnico', P.ehTecnico(pf({ categorias: cats(c) })) === false));
anota('T5 com a ativação, gerente e diretor não são técnicos', P.ehTecnico(pf({ gerente: true })) === false && P.ehTecnico(pf({ diretor: true })) === false);
anota('T6 leitura que falhou nunca vira técnico (gerente, diretor, categorias ou a própria ativação)',
  P.ehTecnico(pf({ gerente: null })) === null && P.ehTecnico(pf({ diretor: null })) === null && P.ehTecnico(pf({ categorias: null })) === null &&
  P.ehTecnico({ ativo: null, gerente: false, diretor: false, categorias: {} }) === null && P.ehTecnico({}) === null);
anota('T7 o que já se sabe vale mesmo com outra leitura falhando (gerente → não é técnico)', P.ehTecnico(pf({ gerente: true, diretor: null, categorias: null })) === false);
anota('T8 o motivo de não ser técnico (mensagem do ADMIN)', P.motivoNaoTecnico(pf({ gerente: true })) === 'gerentes' && P.motivoNaoTecnico(pf({ diretor: true })) === 'diretores' &&
  P.motivoNaoTecnico(pf({ categorias: cats('assessor') })) === 'outros' && P.motivoNaoTecnico(pf({ ativo: false, diretor: true })) === '');

console.log('\n== G. Gerentes e Diretores ==');
anota('G1 Gerentes = cadastro de Gerentes, com ou sem ativação', P.publicoDoRotulo('Gerentes', false).chave === 'gerentes' && P.atende('gerentes', pf({ gerente: true })) === true && P.atende('gerentes', pf()) === false);
anota('G2 um assessor NÃO vira gerente (entra num evento de Gerentes só como exceção do ADMIN)', P.atende('gerentes', pf({ categorias: cats('assessor') })) === false);
anota('G3 Diretores só restringe com a ativação (antes: descrição)', P.publicoDoRotulo('Diretores', false) === null && P.publicoDoRotulo('Diretores', true).chave === 'diretores' && P.dependeDaAtivacao('Diretores'));
anota('G4 Diretores pelo cadastro de Diretores; não lido = não verificado', P.atende('diretores', pf({ diretor: true })) === true && P.atende('diretores', pf()) === false && P.atende('diretores', pf({ diretor: null })) === null);

console.log('\n== D. só descrição ==');
['', 'Executivos', 'Cedidos', 'Quadro próprio'].forEach((r) => anota('D1 "' + (r || 'Empregados') + '" nunca restringe', P.ehDescritivo(r) && P.publicoDoRotulo(r, true) === null && P.publicoDoRotulo(r, false) === null));
anota('D2 "Executivos" continua só descrição (não é "Gerentes executivos") e não há cadastro de cargos', !P.PUBLICOS.some((p) => p.rotulo === 'Executivos' || p.chave === 'executivos') && P.ehDescritivo('Executivos') && P.DESCRITIVOS.indexOf('Executivos') !== -1);

console.log('\n== R. o que cada rótulo faz ==');
anota('R1 Gerentes e Técnicos restringem sempre (nada muda para os eventos de hoje)', P.restringeSempre('Gerentes') && P.restringeSempre('Técnicos') && P.publicoDoRotulo('Técnicos', false).chave === 'tecnicos');
anota('R2 os públicos da ativação: Diretores + 7 categorias + 2 agrupados = 10, nenhum vale sem a ativação',
  P.PUBLICOS.filter((p) => p.ativacao).length === 10 && P.PUBLICOS.filter((p) => p.ativacao).every((p) => P.publicoDoRotulo(p.rotulo, false) === null && P.publicoDoRotulo(p.rotulo, null) === null));
anota('R3 a ativação desconhecida (null) não é tratada como ligada', P.publicoDoRotulo('Assessores', null) === null);

console.log('\n== N. níveis de Gerentes ==');
const ger = (nivel) => pf({ gerente: true, gerenteNivel: nivel });
anota('N1 Gerentes executivos e Gerentes de núcleo restringem sempre (sem depender da ativação)',
  P.restringeSempre('Gerentes executivos') && P.restringeSempre('Gerentes de núcleo') && P.publicoDoRotulo('Gerentes executivos', false).chave === 'gerentesExecutivos' &&
  P.publicoDoRotulo('Gerentes de núcleo', null).chave === 'gerentesNucleo');
anota('N2 cada nível só admite o próprio nível; Não informado e não gerente não entram',
  P.atende('gerentesExecutivos', ger('executivo')) === true && P.atende('gerentesExecutivos', ger('nucleo')) === false && P.atende('gerentesExecutivos', ger('')) === false &&
  P.atende('gerentesNucleo', ger('nucleo')) === true && P.atende('gerentesNucleo', ger('executivo')) === false && P.atende('gerentesNucleo', pf()) === false);
anota('N3 "Gerentes" continua abrangendo os três níveis', ['executivo', 'nucleo', ''].every((n) => P.atende('gerentes', ger(n)) === true));
anota('N4 "Técnicos" não muda: gerente de qualquer nível não é técnico; quem não é gerente segue a regra de sempre',
  ['executivo', 'nucleo', ''].every((n) => P.ehTecnico(ger(n)) === false && P.ehTecnico(Object.assign(ger(n), { ativo: false })) === false) &&
  P.ehTecnico(pf()) === true && P.ehTecnico(pf({ ativo: false })) === true);
anota('N5 nível não lido nunca vira "atende" (null), e gerente não lido também não',
  P.atende('gerentesExecutivos', ger(null)) === null && P.atende('gerentesExecutivos', pf({ gerente: true })) === null && P.atende('gerentesNucleo', pf({ gerente: null })) === null);
anota('N6 o nível vem só do campo gravado (executivo | nucleo); qualquer outro valor = Não informado',
  P.nivelGerente({ nivel: 'executivo' }) === 'executivo' && P.nivelGerente({ nivel: 'nucleo' }) === 'nucleo' && P.nivelGerente({ nivel: 'Executivo' }) === '' &&
  P.nivelGerente({}) === '' && P.nivelGerente(null) === '' && P.rotuloNivel('') === 'Não informado' && P.rotuloNivel('executivo') === 'Gerente executivo' &&
  P.NIVEIS_GERENTE.map((n) => n.rotulo).join('|') === 'Gerente executivo|Gerente de núcleo|Não informado');
anota('N7 soma turma × evento: iguais ou um só → ele; Gerentes + nível → o nível; níveis diferentes ou nível × Técnicos → conflito',
  P.somarCargos('', '') === '' && P.somarCargos('gerentes', '') === 'gerentes' && P.somarCargos('', 'gerentesNucleo') === 'gerentesNucleo' &&
  P.somarCargos('gerentes', 'gerentesExecutivos') === 'gerentesExecutivos' && P.somarCargos('gerentesNucleo', 'gerentes') === 'gerentesNucleo' &&
  P.somarCargos('gerentesExecutivos', 'gerentesNucleo') === 'conflito' && P.somarCargos('tecnicos', 'gerentesExecutivos') === 'conflito' &&
  P.somarCargos('gerentes', 'tecnicos') === 'conflito' && P.somarCargos('tecnicos', 'tecnicos') === 'tecnicos');

console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
