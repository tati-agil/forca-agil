/* ═════════════════════════════════════════════════════════════════
   Regras do banco — EXCLUSÃO de cadastros (contrato em dois níveis, 2026-10-15): atuações/responsabilidades da Porta 2
   (objetos-organizacionais) e Análises Organizacionais. Roda contra o EMULADOR real do Realtime Database
   (teste-rules.yml) com o database.rules.json de produção; as gravações são as que o código real monta
   (objetos-organizacionais-nucleo.js, analises-organizacionais-nucleo.js + analises-organizacionais-firebase.js).
   Dados 100% sintéticos. Prova, pelo BANCO:
   A. Exclusão comum de uma atuação sem Posicionamento: Avaliação + Configuração e admin geral excluem; Avaliação, sem
      perfil e sem login, não. O cadastro sai; ficam o registro mínimo (nome, motivo, nível, quem, quando — horário do
      servidor, autoria do token) e o evento 'exclusao' na auditoria; a referência informativa sai do índice na mesma
      gravação; o id não renasce; registro mínimo e evento são imutáveis.
   B. Gravações incompletas recusadas: apagar sem registro mínimo, registro sem apagar, sem evento, nome trocado,
      horário do cliente, autoria de outra pessoa, índice da referência esquecido.
   C. Bloqueios nos dois níveis: rascunho de Posicionamento aberto ou estrutura responsável ativa — inclusive quando
      surgem DEPOIS da verificação da tela (a gravação montada antes é recusada pelo banco).
   D. Exclusão excepcional (já avaliado): só o admin geral; Avaliação + Configuração recusada; "comum" com Posicionamento
      vigente recusado (inclusive se ele surgir depois da verificação). Avaliações, decisões, índice de vigência e
      auditorias continuam intactos depois.
   E. Atuação vinda de uma análise: exclusão comum (sem Posicionamento); o índice de origem e o recorte ficam.
   F. Análise vazia: exclusão comum; com responsabilidades/proposta: "comum" recusado, Avaliação + Configuração recusada,
      admin geral exclui (excepcional) sem cascata — atuação, índice de origem, propostas e auditoria ficam; com
      aprovação registrada: recusada até para o admin geral; id não renasce; marcador DESLIGADO: ninguém exclui.
   G. Responsabilidade só de texto sai da análise (evento 'recorte.excluido'); o núcleo recusa a que tem atuação
      cadastrada ou está numa proposta.
   H. ADVERSARIAL — gravações diretas contra as regras, sem o núcleo: remover responsabilidade com cadastro (ou só o
      objetoId), remover a citada em proposta, regravar a análise inteira ou a lista inteira, apagar índice de origem ou
      citação, proposta fora do índice: tudo recusado. Exclusões legítimas continuam; revisão, auditoria e índices
      consistentes. Análise com proposta anterior ao índice: nenhuma responsabilidade sai.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const O = require(path.join(RAIZ, 'forca-agil', 'objetos-organizacionais-nucleo.js'));
const N = require(path.join(RAIZ, 'forca-agil', 'analises-organizacionais-nucleo.js'));
const F = require(path.join(RAIZ, 'forca-agil', 'analises-organizacionais-firebase.js'));

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_');
const SUPER = 'tatianefdirene@previ.com.br', ADMIN = 'admin.geral@previ.com.br', ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br', SEM = 'sem.acesso@previ.com.br';
const OBJ = O.NODE, AUD = O.AUD, IDX = O.IDX_REF, EXC = O.EXC, NOS = F.NOS;
const RES = 'posicionamento-rascunho-por-item', VIG = 'posicionamento-vigente-por-item', VINC = 'estruturas-vinculos/ativo-por-objeto';
const TS = { '.sv': 'timestamp' };
const js = (v) => JSON.parse(JSON.stringify(v));
const usuario = (e) => ({ uid: emailKey(e), email: e, name: 'Pessoa ' + e.split('@')[0] });
const DADOS = { nome: 'Sintético — atuação de teste', descricao: 'Registro sintético para o teste de exclusão.', finalidade: 'Provar as regras.' };
let seq = 0;
const chave = (p) => p + (++seq);
const ctxDe = (e, novoId) => ({ operacaoId: chave('op'), novoId, usuario: { id: emailKey(e), email: e }, agora: Date.now() });

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-exclusao', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext(emailKey(e), { email: e }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  const up = (e, w) => db(e).ref().update(js(w));
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 200)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }

  await env.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    await a.ref('avaliacoes-produto/pRefX').set({ itemId: 'pRefX', nome: 'Item sintético', status: 'concluido', excluido: false });
  });
  const criar = async (e, extra) => {
    extra = extra || {};
    const id = extra.id || chave('o');
    await up(e, O.payloadCriacao({ id, audId: chave('a'), dados: DADOS, referenciaItemId: extra.ref, usuario: usuario(e), agora: TS }));
    return id;
  };
  const excluir = async (id, e, dep, mexer, motivo) => {
    const atual = await ler(OBJ + '/' + id);
    const w = O.payloadExclusao({ id, atual, audId: chave('a'), motivo: motivo === undefined ? 'Cadastrado por engano (teste)' : motivo, dep: dep || {}, usuario: usuario(e), agora: TS });
    if (mexer) mexer(w, id);
    return w;
  };
  const audDe = (w) => Object.keys(w).find((k) => k.indexOf(AUD + '/') === 0);

  console.log('\n== A. Exclusão comum de uma atuação sem Posicionamento ==');
  const o1 = await criar(ARQ, { ref: 'pRefX' });
  anota('(preparo) objeto com referência informativa e índice', (await ler(IDX + '/pRefX')) === o1);
  await nega('Avaliação NÃO exclui', up(AVAL, await excluir(o1, AVAL)));
  await nega('sem perfil NÃO exclui', up(SEM, await excluir(o1, SEM)));
  await nega('sem login NÃO exclui', db(null).ref().update(js(await excluir(o1, ARQ))));
  await pode('Avaliação + Configuração exclui (comum), numa gravação só', up(ARQ, await excluir(o1, ARQ)));
  const t1 = await ler(EXC + '/' + o1);
  anota('o cadastro saiu de verdade (não foi encerrado)', (await ler(OBJ + '/' + o1)) === null);
  anota('registro mínimo: nome, motivo, nível comum, situação anterior, horário do servidor, autoria do token', !!t1 && t1.nome === DADOS.nome && t1.motivo === 'Cadastrado por engano (teste)' && t1.nivel === 'comum' &&
    t1.situacaoAnterior === 'ativo' && typeof t1.excluidoEm === 'number' && t1.excluidoPor.uid === emailKey(ARQ) && t1.referenciaItemId === 'pRefX');
  const ev1 = await ler(AUD + '/' + o1 + '/' + t1.auditoriaId);
  anota('auditoria: evento "exclusao" com o motivo; a criação continua lá', ev1 && ev1.tipo === 'exclusao' && ev1.motivo === t1.motivo && ev1.revisao === 2 && Object.keys(await ler(AUD + '/' + o1)).length === 2);
  anota('a referência informativa saiu do índice na mesma gravação', (await ler(IDX + '/pRefX')) === null);
  for (const e of [SUPER, ARQ, AVAL]) await pode(e.split('@')[0] + ' lê os registros de exclusão', db(e).ref(EXC).once('value'));
  await nega('sem perfil NÃO lê os registros de exclusão', db(SEM).ref(EXC).once('value'));
  await nega('o id excluído não renasce', up(ARQ, O.payloadCriacao({ id: o1, audId: chave('a'), dados: DADOS, usuario: usuario(ARQ), agora: TS })));
  await nega('registro mínimo é imutável (trocar o motivo)', db(SUPER).ref(EXC + '/' + o1 + '/motivo').set('Outro'));
  await nega('registro mínimo não se apaga', db(SUPER).ref(EXC + '/' + o1).remove());
  await nega('evento de exclusão é imutável', db(SUPER).ref(AUD + '/' + o1 + '/' + t1.auditoriaId + '/motivo').set('Outro'));

  console.log('\n== B. Gravações incompletas recusadas ==');
  const o2 = await criar(ARQ, { ref: 'pRefX' });
  await nega('apagar sem registro mínimo', up(ARQ, await excluir(o2, ARQ, {}, (w, id) => { delete w[EXC + '/' + id]; })));
  await nega('registro mínimo sem apagar o cadastro', up(ARQ, await excluir(o2, ARQ, {}, (w, id) => { delete w[OBJ + '/' + id]; })));
  await nega('sem o evento de auditoria', up(ARQ, await excluir(o2, ARQ, {}, (w) => { delete w[audDe(w)]; })));
  await nega('nome trocado no registro mínimo', up(ARQ, await excluir(o2, ARQ, {}, (w, id) => { w[EXC + '/' + id].nome = 'Outro nome'; })));
  await nega('horário do cliente', up(ARQ, await excluir(o2, ARQ, {}, (w, id) => { w[EXC + '/' + id].excluidoEm = 1791713600000; })));
  await nega('autoria de outra pessoa', up(ARQ, await excluir(o2, SUPER)));
  await nega('motivo do evento diferente do registro', up(ARQ, await excluir(o2, ARQ, {}, (w) => { w[audDe(w)].motivo = 'Outro'; })));
  await nega('índice da referência esquecido', up(ARQ, await excluir(o2, ARQ, {}, () => {}, undefined).then((w) => { delete w[IDX + '/pRefX']; return w; })));
  await nega('motivo em branco', up(ARQ, await excluir(o2, ARQ, {}, (w, id) => { w[EXC + '/' + id].motivo = '   '; w[audDe(w)].motivo = '   '; })));
  await nega('campo fora do previsto no registro mínimo', up(ARQ, await excluir(o2, ARQ, {}, (w, id) => { w[EXC + '/' + id].finalidade = 'x'; })));
  let semMotivo = null; try { O.payloadExclusao({ id: o2, atual: await ler(OBJ + '/' + o2), audId: 'aa1', motivo: ' ', usuario: usuario(ARQ), agora: TS }); } catch (e) { semMotivo = e.erros && e.erros[0].campo; }
  anota('o núcleo explica que o motivo é obrigatório', semMotivo === 'motivo');
  anota('nada mudou com as tentativas recusadas', (await ler(OBJ + '/' + o2 + '/situacao')) === 'ativo' && (await ler(EXC + '/' + o2)) === null && (await ler(IDX + '/pRefX')) === o2);

  console.log('\n== C. Bloqueios nos dois níveis (inclusive verificação desatualizada) ==');
  const wDesatualizada = await excluir(o2, ARQ, {});
  await semear((a) => a.ref(RES + '/' + o2).set('posAberto'));
  await nega('rascunho aberto surgiu depois da verificação: a gravação montada antes é recusada', up(ARQ, wDesatualizada));
  await nega('com rascunho aberto: nem o admin geral exclui (excepcional)', up(SUPER, await excluir(o2, SUPER, {}, (w, id) => { w[EXC + '/' + id].nivel = 'excepcional'; })));
  let bloq = null; try { O.payloadExclusao({ id: o2, atual: await ler(OBJ + '/' + o2), audId: 'aa2', motivo: 'x', dep: { rascunho: true }, usuario: usuario(ARQ), agora: TS }); } catch (e) { bloq = e.erros && e.erros[0].codigo; }
  anota('o núcleo diz por quê (RASCUNHO_ABERTO)', bloq === 'RASCUNHO_ABERTO');
  await semear((a) => a.ref(RES + '/' + o2).remove());
  const wDesat2 = await excluir(o2, SUPER, {});
  await semear((a) => a.ref(VINC + '/' + o2).set('vinc1'));
  await nega('estrutura responsável ativa surgiu depois da verificação: recusada', up(SUPER, wDesat2));
  await nega('com estrutura responsável ativa: nem o admin geral exclui (excepcional)', up(SUPER, await excluir(o2, SUPER, {}, (w, id) => { w[EXC + '/' + id].nivel = 'excepcional'; })));
  anota('nivelExclusao: vínculo ativo bloqueia', O.nivelExclusao({ vinculoAtivo: true, vigente: true }).nivel === 'bloqueada');
  await semear((a) => a.ref(VINC + '/' + o2).remove());
  await nega('criar o rascunho e excluir na mesma gravação: recusado', up(ARQ, await excluir(o2, ARQ, {}, (w, id) => { w[RES + '/' + id] = 'posNovo'; })));

  console.log('\n== D. Exclusão excepcional (já avaliado): só o admin geral ==');
  const o3 = await criar(ARQ);
  /* um Posicionamento concluído do objeto (sintético, semeado sem regras: o que importa aqui é que ele fica) */
  await semear(async (a) => {
    await a.ref('avaliacoes-posicionamento/posO3').set({ itemId: o3, status: 'concluido', revisao: 3, origem: 'objeto-organizacional' });
    await a.ref('posicionamento-decisoes/posO3').set({ codigoFinal: 'COE', tipoDecisao: 'CONFIRMACAO' });
    await a.ref('posicionamento-auditoria/posO3/ev1').set({ tipo: 'conclusao' });
  });
  const wComum = await excluir(o3, ARQ, {});
  await semear((a) => a.ref(VIG + '/' + o3).set('posO3'));
  await nega('"comum" montada antes do Posicionamento vigente: recusada (verificação desatualizada)', up(ARQ, wComum));
  await nega('Avaliação + Configuração NÃO faz a exclusão excepcional', up(ARQ, await excluir(o3, ARQ, { vigente: true })));
  await nega('admin geral declarando "comum" com Posicionamento vigente: recusado', up(SUPER, await excluir(o3, SUPER, { vigente: true }, (w, id) => { w[EXC + '/' + id].nivel = 'comum'; })));
  await nega('apagar o índice de vigência junto: recusado', up(SUPER, await excluir(o3, SUPER, { vigente: true }, (w, id) => { w[VIG + '/' + id] = null; })));
  await pode('admin geral (fa-admins) faz a exclusão excepcional', up(ADMIN, await excluir(o3, ADMIN, { vigente: true }, null, 'Atuação duplicada, já avaliada (teste)')));
  const t3 = await ler(EXC + '/' + o3);
  anota('registro mínimo excepcional, com a dependência registrada', t3 && t3.nivel === 'excepcional' && t3.dependencias && t3.dependencias.vigente === true && t3.excluidoPor.uid === emailKey(ADMIN));
  anota('avaliação, decisão, índice de vigência e auditoria do Posicionamento continuam intactos', (await ler('avaliacoes-posicionamento/posO3/itemId')) === o3 && (await ler('posicionamento-decisoes/posO3/codigoFinal')) === 'COE' &&
    (await ler(VIG + '/' + o3)) === 'posO3' && (await ler('posicionamento-auditoria/posO3/ev1/tipo')) === 'conclusao');
  anota('nivelExclusao: Posicionamento vigente = excepcional', O.nivelExclusao({ vigente: true }).nivel === 'excepcional' && O.nivelExclusao({}).nivel === 'comum');
  const o4 = await criar(ARQ);
  const atual4 = await ler(OBJ + '/' + o4);
  await up(ARQ, O.payloadEncerramento({ id: o4, atual: atual4, audId: chave('a'), motivo: 'Encerrada', usuario: usuario(ARQ), agora: TS }));
  await pode('uma atuação encerrada também pode ser excluída (comum)', up(ARQ, await excluir(o4, ARQ)));
  anota('situação anterior registrada: encerrado', (await ler(EXC + '/' + o4 + '/situacaoAnterior')) === 'encerrado');

  console.log('\n== E/F. Análises (marcador LIBERADO) ==');
  await semear(async (a) => { await a.ref(NOS.config).set({ habilitacao: 'LIBERADO_PARA_PERFIS_AUTORIZADOS', alteradoEm: 1, alteradoPor: { uid: 'x', email: SUPER }, motivo: 'teste', auditoriaId: 'cfg1' }); });
  async function estado() { return F.estadoDoBanco({ analises: await ler(NOS.analises), propostas: await ler(NOS.propostas), aprovacoes: await ler(NOS.aprovacoes) }); }
  async function op(e, fn, mexer) {
    const r = fn(await estado(), ctxDe(e, chave('n')));
    if (!r.ok) throw new Error('núcleo recusou: ' + JSON.stringify(r.erros));
    const w = F.payloadOperacao(r, { audId: chave('ev'), usuario: usuario(e), agora: TS });
    if (mexer) mexer(w);
    return w;
  }
  const criarAnalise = (e, id) => op(e, (est, c) => N.criarAnalise(est, { nome: 'Análise sintética ' + id, tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: id })));
  const excluirAnalise = (e, id, mexer, motivo) => op(e, (est, c) => N.excluirAnalise(est, id, { motivo: motivo || 'Aberta por engano (teste)' }, c), mexer);

  await up(ARQ, await criarAnalise(ARQ, 'anVazia'));
  anota('núcleo: análise vazia = exclusão comum', N.nivelExclusaoAnalise(await estado(), 'anVazia').nivel === 'comum');
  await nega('Avaliação NÃO exclui análise', up(AVAL, await excluirAnalise(AVAL, 'anVazia')));
  await nega('sem o registro mínimo: recusado', up(ARQ, await excluirAnalise(ARQ, 'anVazia', (w) => { delete w[NOS.excluidas + '/anVazia']; })));
  await nega('apagar a análise diretamente: recusado', db(ARQ).ref(NOS.analises + '/anVazia').remove());
  await pode('Avaliação + Configuração exclui a análise vazia (comum)', up(ARQ, await excluirAnalise(ARQ, 'anVazia')));
  const tA = await ler(NOS.excluidas + '/anVazia');
  anota('a análise saiu; registro mínimo com nome, motivo, nível, autoria e evento "analise.excluida"', (await ler(NOS.analises + '/anVazia')) === null && tA && tA.nome === 'Análise sintética anVazia' && tA.nivel === 'comum' &&
    typeof tA.excluidaEm === 'number' && tA.excluidaPor.uid === emailKey(ARQ) && (await ler(NOS.auditoria + '/anVazia/' + tA.auditoriaId + '/tipo')) === 'analise.excluida');
  anota('a auditoria anterior (criação) continua', Object.values(await ler(NOS.auditoria + '/anVazia')).some((x) => x.tipo === 'analise.criada'));
  await nega('o id da análise excluída não renasce', up(ARQ, await criarAnalise(ARQ, 'anVazia').catch(() => ({}))));

  /* análise com conteúdo: responsabilidade só de texto + responsabilidade com atuação cadastrada + proposta */
  await up(ARQ, await criarAnalise(ARQ, 'anCheia'));
  await up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anCheia', { descricao: 'Responsabilidade sintética A', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rA' }))));
  await up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anCheia', { descricao: 'Responsabilidade sintética B', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rB' }))));
  await up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anCheia', { descricao: 'Responsabilidade sintética C (engano)', separacao: { valor: 'nao-sei' } }, Object.assign(c, { novoId: 'rC' }))));
  const assoc = N.associarAtuacao(await estado(), 'anCheia', 'rA', 'objA', ctxDe(ARQ));
  const objetoPayload = O.payloadCriacao({ id: 'objA', audId: chave('oa'), dados: DADOS, usuario: usuario(ARQ), agora: TS });
  await pode('(preparo) atuação cadastrada a partir da responsabilidade A', up(ARQ, F.payloadCriarAtuacao({ objetoPayload, associacao: assoc, analiseId: 'anCheia', recorteId: 'rA', objetoId: 'objA', audId: chave('ev'), usuario: usuario(ARQ), agora: TS })));
  await pode('(preparo) proposta v1 citando a responsabilidade B', up(ARQ, await op(ARQ, (est, c) => N.registrarProposta(est, 'anCheia', { alternativa: 'manter-consciente', recortes: ['rB'], justificativa: 'Sintética' }, c))));

  console.log('\n== G. Responsabilidade dentro da análise ==');
  const est0 = await estado();
  anota('núcleo recusa excluir a responsabilidade com atuação cadastrada (o cadastro é excluído pela ficha dele)', N.excluirRecorte(est0, 'anCheia', 'rA', { motivo: 'x' }, ctxDe(ARQ)).erros[0].codigo === 'RECORTE_COM_CADASTRO');
  anota('núcleo recusa excluir a responsabilidade citada numa proposta registrada', N.excluirRecorte(est0, 'anCheia', 'rB', { motivo: 'x' }, ctxDe(ARQ)).erros[0].codigo === 'RECORTE_EM_PROPOSTA');
  await nega('Avaliação NÃO exclui responsabilidade', up(AVAL, await op(AVAL, (est, c) => N.excluirRecorte(est, 'anCheia', 'rC', { motivo: 'Engano' }, c))));
  await pode('Avaliação + Configuração exclui a responsabilidade só de texto (comum)', up(ARQ, await op(ARQ, (est, c) => N.excluirRecorte(est, 'anCheia', 'rC', { motivo: 'Cadastrada por engano' }, c))));
  const anCheia = await ler(NOS.analises + '/anCheia');
  const evRC = await ler(NOS.auditoria + '/anCheia/' + anCheia.auditoriaId);
  anota('saiu da análise (não ficou como descartada); o evento guarda a descrição e o motivo', !anCheia.recortes.rC && evRC.tipo === 'recorte.excluido' && evRC.detalhe.motivo === 'Cadastrada por engano' &&
    evRC.detalhe.excluidas.length === 1 && evRC.detalhe.excluidas[0].id === 'rC' && evRC.detalhe.excluidas[0].descricao === 'Responsabilidade sintética C (engano)');

  console.log('\n== F. Análise com conteúdo: só o admin geral (excepcional), sem cascata ==');
  anota('núcleo: análise com responsabilidades e proposta = excepcional', N.nivelExclusaoAnalise(await estado(), 'anCheia').nivel === 'excepcional');
  await nega('Avaliação + Configuração NÃO exclui a análise com conteúdo', up(ARQ, await excluirAnalise(ARQ, 'anCheia')));
  await nega('admin geral declarando "comum" numa análise com conteúdo: recusado', up(SUPER, await excluirAnalise(SUPER, 'anCheia', (w) => { w[NOS.excluidas + '/anCheia'].nivel = 'comum'; })));
  const wAnDesat = await excluirAnalise(SUPER, 'anCheia');
  await up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anCheia', { descricao: 'Responsabilidade D', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rD' }))));
  await nega('exclusão confirmada antes de outra gravação na análise: recusada (o que a pessoa viu mudou)', up(SUPER, wAnDesat));
  await nega('revisão trocada no registro mínimo: recusada', up(SUPER, await excluirAnalise(SUPER, 'anCheia', (w) => { w[NOS.excluidas + '/anCheia'].revisao = 1; })));
  await pode('admin geral exclui a análise com conteúdo (excepcional)', up(SUPER, await excluirAnalise(SUPER, 'anCheia', null, 'Análise duplicada (teste)')));
  const tC = await ler(NOS.excluidas + '/anCheia');
  anota('registro mínimo excepcional, com as contagens', tC && tC.nivel === 'excepcional' && tC.contagens.comCadastro === 1 && tC.contagens.propostas === 1);
  anota('sem cascata: a atuação, o índice de origem, a proposta e a auditoria continuam', (await ler('objetos-organizacionais/objA/situacao')) === 'ativo' && (await ler(NOS.porObjeto + '/objA/analiseId')) === 'anCheia' &&
    !!(await ler(NOS.propostas + '/anCheia/v1')) && Object.keys(await ler(NOS.auditoria + '/anCheia')).length >= 5);

  await up(ARQ, await criarAnalise(ARQ, 'anAprovada'));
  await up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anAprovada', { descricao: 'Responsabilidade E', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rE' }))));
  await up(ARQ, await op(ARQ, (est, c) => N.registrarProposta(est, 'anAprovada', { alternativa: 'manter-consciente', recortes: ['rE'], justificativa: 'Sintética' }, c)));
  await up(SUPER, await op(SUPER, (est, c) => N.registrarAprovacao(est, 'anAprovada', 1, { autoridade: 'Instância sintética', referencia: 'Ato sintético', dataDoAto: 1791900000000, objetoAprovado: 'Proposta v1' }, c)));
  anota('núcleo: análise com aprovação registrada = bloqueada', N.nivelExclusaoAnalise(await estado(), 'anAprovada').nivel === 'bloqueada');
  const forcadaAprov = F.payloadOperacao({ ok: true, mudancas: [{ entidade: 'exclusao-analise', id: 'anAprovada', depois: { nome: 'Análise sintética anAprovada', motivo: 'Forçada', nivel: 'excepcional', situacaoAnterior: 'aberta' } }], eventos: [{ tipo: 'analise.excluida', operacaoId: 'op', detalhe: {} }] }, { audId: chave('ev'), usuario: usuario(SUPER), agora: TS });
  await nega('análise com aprovação registrada: nem o admin geral exclui (gravação forçada)', up(SUPER, forcadaAprov));

  await up(ARQ, await criarAnalise(ARQ, 'anDesl'));
  const wDesl = await excluirAnalise(ARQ, 'anDesl');
  await semear((a) => a.ref(NOS.config + '/habilitacao').set('DESLIGADO'));
  await nega('marcador DESLIGADO: ninguém exclui análise', up(SUPER, wDesl));

  console.log('\n== H. Integridade das responsabilidades contra gravação DIRETA (sem o núcleo da aplicação) ==');
  await semear((a) => a.ref(NOS.config + '/habilitacao').set('LIBERADO_PARA_PERFIS_AUTORIZADOS'));
  await up(ARQ, await criarAnalise(ARQ, 'anAdv'));
  for (const [rid, d] of [['rX', 'Sintética X — com cadastro'], ['rY', 'Sintética Y — citada na proposta'], ['rZ', 'Sintética Z — só texto'], ['rW', 'Sintética W — só texto']]) {
    await up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anAdv', { descricao: d, separacao: { valor: 'nao' } }, Object.assign(c, { novoId: rid }))));
  }
  const assocX = N.associarAtuacao(await estado(), 'anAdv', 'rX', 'objX', ctxDe(ARQ));
  await up(ARQ, F.payloadCriarAtuacao({ objetoPayload: O.payloadCriacao({ id: 'objX', audId: chave('oa'), dados: DADOS, usuario: usuario(ARQ), agora: TS }), associacao: assocX, analiseId: 'anAdv', recorteId: 'rX', objetoId: 'objX', audId: chave('ev'), usuario: usuario(ARQ), agora: TS }));
  await pode('(preparo) proposta v1 citando Y', up(ARQ, await op(ARQ, (est, c) => N.registrarProposta(est, 'anAdv', { alternativa: 'manter-consciente', recortes: ['rY'], justificativa: 'Sintética' }, c))));
  anota('(preparo) a proposta grava o índice da citação e a marca "indexada"', (await ler(F.NOS.citacoes + '/anAdv/rY')) === true && (await ler(NOS.propostas + '/anAdv/v1/indexada')) === true);
  /* uma gravação legítima (nova entrega: revisão + 1 e evento de auditoria corretos), à qual o ataque acrescenta algo */
  const legitima = async (e) => op(e || ARQ, (est, c) => N.adicionarEntrega(est, 'anAdv', { descricao: 'Entrega sintética' }, Object.assign(c, { novoId: chave('e') })));
  const AA = NOS.analises + '/anAdv';
  await pode('controle: a gravação legítima, sozinha, é aceita (as recusas abaixo são pelo ataque, não pela base)', up(ARQ, await legitima()));
  await nega('remover a responsabilidade COM cadastro (gravação direta, revisão e auditoria corretas): recusado', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes/rX']: null })));
  await nega('remover só o objetoId da responsabilidade com cadastro: recusado', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes/rX/objetoId']: null })));
  await nega('regravar a responsabilidade com cadastro sem o objetoId: recusado', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes/rX']: { id: 'rX', descricao: 'x', nome: 'x', situacao: 'ativo', versao: 2 } })));
  await nega('remover a responsabilidade citada em proposta registrada: recusado', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes/rY']: null })));
  await nega('admin geral também não remove a citada em proposta: recusado', up(SUPER, Object.assign(await legitima(SUPER), { [AA + '/recortes/rY']: null })));
  /* contornar regravando a análise inteira (sem X e sem Y), com revisão + 1 e evento de auditoria */
  const inteira = async (semRecortes) => {
    const atual = await ler(AA), ev = chave('ev'), nova = js(atual);
    semRecortes.forEach((r) => { delete nova.recortes[r]; });
    nova.revisao = atual.revisao + 1; nova.atualizadoEm = TS; nova.auditoriaId = ev; nova.atualizadoPor = { uid: emailKey(ARQ), email: ARQ };
    return { [AA]: nova, [NOS.auditoria + '/anAdv/' + ev]: { tipo: 'analise.ajustada', operacaoId: 'op', em: TS, por: { uid: emailKey(ARQ), email: ARQ }, detalhe: {} } };
  };
  await nega('contornar regravando a ANÁLISE INTEIRA sem a responsabilidade com cadastro: recusado', up(ARQ, await inteira(['rX'])));
  await nega('contornar regravando a análise inteira sem a citada em proposta: recusado', up(ARQ, await inteira(['rY'])));
  await nega('regravar a análise inteira mesmo sem tirar nada: recusado (depois de criada, só por campo)', up(ARQ, await inteira([])));
  const recs = js(await ler(AA + '/recortes')); delete recs.rX;
  await nega('contornar regravando a LISTA inteira de responsabilidades: recusado', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes']: recs })));
  await nega('apagar o índice de origem junto: recusado', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes/rX']: null, [NOS.porObjeto + '/objX']: null })));
  await nega('apagar a citação no índice: recusado', db(SUPER).ref(F.NOS.citacoes + '/anAdv/rY').remove());
  await nega('apagar a citação e a responsabilidade na mesma gravação: recusado', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes/rY']: null, [F.NOS.citacoes + '/anAdv/rY']: null })));
  await nega('criar citação solta (sem proposta nova): recusado', db(ARQ).ref(F.NOS.citacoes + '/anAdv/rZ').set(true));
  const propor2 = async (dados, mexer) => op(ARQ, (est, c) => N.registrarProposta(est, 'anAdv', Object.assign({ alternativa: 'manter-consciente', recortes: ['rY', 'rZ'], justificativa: 'Sintética v2' }, dados || {}), c), mexer);
  await nega('proposta citando responsabilidade FORA do índice: recusada', up(ARQ, await propor2({}, (w) => { delete w[F.NOS.citacoes + '/anAdv/rZ']; })));
  await nega('proposta sem a marca "indexada": recusada', up(ARQ, await propor2({}, (w) => { delete w[NOS.propostas + '/anAdv/v2'].indexada; })));
  await nega('proposta citando responsabilidade inexistente: recusada', up(ARQ, await propor2({}, (w) => { w[NOS.propostas + '/anAdv/v2'].recortes = ['rY', 'naoExiste']; w[F.NOS.citacoes + '/anAdv/naoExiste'] = true; })));
  await nega('proposta com posição fora do formato de lista: recusada', up(ARQ, await propor2({}, (w) => { w[NOS.propostas + '/anAdv/v2'].recortes = { a: 'rY' }; })));
  await nega('citar e remover a mesma responsabilidade na mesma gravação: recusado', up(ARQ, await propor2({}, (w) => { w[AA + '/recortes/rZ'] = null; })));
  let doNucleo = N.excluirRecorte(await estado(), 'anAdv', 'rY', { motivo: 'x' }, ctxDe(ARQ));
  anota('o núcleo recusa do mesmo jeito (citada)', doNucleo.erros[0].codigo === 'RECORTE_EM_PROPOSTA');
  doNucleo = N.excluirRecorte(await estado(), 'anAdv', 'rX', { motivo: 'x' }, ctxDe(ARQ));
  anota('o núcleo recusa do mesmo jeito (com cadastro)', doNucleo.erros[0].codigo === 'RECORTE_COM_CADASTRO');

  console.log('\n== H2. Exclusões legítimas continuam funcionando, e o histórico fica consistente ==');
  const antesH = { rev: await ler(AA + '/revisao'), aud: Object.keys(await ler(NOS.auditoria + '/anAdv')).length };
  await nega('perfil Avaliação não exclui a responsabilidade só de texto', up(AVAL, await op(AVAL, (est, c) => N.excluirRecorte(est, 'anAdv', 'rZ', { motivo: 'Engano' }, c))));
  await pode('Avaliação + Configuração exclui a responsabilidade só de texto (pelo núcleo, gravação por campo)', up(ARQ, await op(ARQ, (est, c) => N.excluirRecorte(est, 'anAdv', 'rZ', { motivo: 'Registrada por engano' }, c))));
  const depoisH = await ler(AA);
  anota('revisão + 1 e um evento novo na auditoria (nada reescrito)', depoisH.revisao === antesH.rev + 1 && Object.keys(await ler(NOS.auditoria + '/anAdv')).length === antesH.aud + 1 &&
    (await ler(NOS.auditoria + '/anAdv/' + depoisH.auditoriaId + '/tipo')) === 'recorte.excluido');
  anota('a responsabilidade saiu; X (com cadastro) e Y (citada) continuam', !depoisH.recortes.rZ && depoisH.recortes.rX.objetoId === 'objX' && !!depoisH.recortes.rY);
  anota('índice de origem, cadastro, proposta e citação intactos', (await ler(NOS.porObjeto + '/objX/recorteId')) === 'rX' && (await ler('objetos-organizacionais/objX/situacao')) === 'ativo' &&
    !!(await ler(NOS.propostas + '/anAdv/v1')) && (await ler(F.NOS.citacoes + '/anAdv/rY')) === true);
  await pode('proposta v2 legítima (cita Y de novo e W) com o índice', up(ARQ, await propor2({ recortes: ['rY', 'rW'] })));
  anota('citações de Y e W no índice', (await ler(F.NOS.citacoes + '/anAdv/rW')) === true && (await ler(F.NOS.citacoes + '/anAdv/rY')) === true);
  await nega('W, agora citada, não sai', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes/rW']: null })));
  await pode('o cadastro de X sai pelo procedimento próprio (exclusão comum, sem Posicionamento)', up(ARQ, await excluir('objX', ARQ)));
  anota('a origem continua imutável: recorte X ainda aponta objX e o índice de origem ficou', (await ler(AA + '/recortes/rX/objetoId')) === 'objX' && (await ler(NOS.porObjeto + '/objX/recorteId')) === 'rX' && !!(await ler(EXC + '/objX')));
  await nega('mesmo com o cadastro excluído, X não sai da análise', up(ARQ, Object.assign(await legitima(), { [AA + '/recortes/rX']: null })));

  console.log('\n== H3. Análise com proposta ANTERIOR ao índice (sem "indexada"): nenhuma responsabilidade sai ==');
  await up(ARQ, await criarAnalise(ARQ, 'anLeg'));
  await up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anLeg', { descricao: 'Sintética L — só texto', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rL' }))));
  await up(ARQ, await op(ARQ, (est, c) => N.definirRecorte(est, 'anLeg', { descricao: 'Sintética M — só texto', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rM' }))));
  /* proposta antiga semeada como estava gravada antes do índice (sem "indexada" e sem citações) */
  await semear(async (a) => {
    await a.ref(NOS.propostas + '/anLeg/v1').set({ id: 'anLeg~1', analiseId: 'anLeg', versao: 1, alternativa: 'manter-consciente', recortes: ['rM'], justificativa: 'Antiga', situacao: 'proposta', registradaEm: 1, registradaPor: { id: 'x' } });
    await a.ref(NOS.analises + '/anLeg/propostaVigente').set(1);
  });
  anota('o núcleo explica (proposta anterior ao controle de citações)', N.excluirRecorte(await estado(), 'anLeg', 'rL', { motivo: 'x' }, ctxDe(ARQ)).erros.some((x) => x.codigo === 'ANALISE_COM_PROPOSTA_ANTERIOR'));
  const legL = await op(ARQ, (est, c) => N.adicionarEntrega(est, 'anLeg', { descricao: 'x' }, Object.assign(c, { novoId: chave('e') })));
  await nega('tirar uma responsabilidade não citada de análise com proposta antiga: recusado (o banco não consegue provar)', up(ARQ, Object.assign(legL, { [NOS.analises + '/anLeg/recortes/rL']: null })));

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
