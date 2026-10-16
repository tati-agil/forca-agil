/* ═════════════════════════════════════════════════════════════════
   Regras do banco + MIGRAÇÃO — modelo simplificado da definição da Taxonomia (dois domínios). Roda no EMULADOR real do
   Realtime Database (teste-rules.yml) com o database.rules.json de produção. Dados 100% sintéticos. Prova:
   A. Plano da migração: a definição vigente é exatamente a fonte apontada; conceito sem ponteiro fica sem definição;
      fontes que nunca foram vigentes não viram versões; estados inconsistentes (duas vigentes, ponteiro órfão, vigente
      sem ponteiro) recusam a migração inteira.
   B. Execução (conta de serviço = regras desligadas): definição v1 = texto vigente, histórico v1 com a origem e a
      referência ao texto-fonte; o modelo antigo arquivado inteiro e removido da árvore operacional; auditoria antiga e
      ligações com a Avaliação intactas; verificação limpa; plano de novo = já migrado (idempotente).
   C. Publicação pelas regras: admin publica v2; duas publicações sobre a mesma versão → só uma entra; clique repetido →
      recusado; pular versão, histórico divergente, autoria de outra pessoa, apagar a definição, reescrever o histórico,
      gravar fontes ou os campos antigos → recusados; perfis da Avaliação e sem perfil não publicam.
   D. Leitura: os perfis da Avaliação leem a definição (arquitetural: todos; organizacional: só os 10 códigos do
      Posicionamento), nunca o histórico nem o arquivo; admin lê tudo.
   E. Governança intacta: conceito arquitetural ligado à Avaliação não é inativado; editar o nome continua possível.
   F. Reversão: recusada se há versão publicada depois da migração; numa base recém-migrada, volta exatamente ao
      modelo antigo (fontes e ponteiros).
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const TD = require(path.join(RAIZ, 'forca-agil', 'taxonomia-definicao.js'));
const MIG = require('./migracao-taxonomia-definicoes.js');

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_');
const ADMIN = 'admin.geral@previ.com.br', ADMIN2 = 'outra.admin@previ.com.br', ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br', SEM = 'sem.acesso@previ.com.br';
const js = (v) => JSON.parse(JSON.stringify(v));
const T0 = '2026-08-01T10:00:00.000Z';
let seq = 0;
const k = (p) => p + (++seq);

/* o modelo ANTIGO, sintético, nos dois domínios */
function legado() {
  const f = (texto, situacao, extra) => Object.assign({ texto, contexto: 'PREVI', situacao, tipoRedacao: 'Conceito', criadoEm: T0, criadoPor: 'curadoria@previ.com.br' }, extra || {});
  return {
    meta: { cargaInicial: { feitaEm: T0, feitaPor: ADMIN }, indiceFilhos: { criadoEm: T0, criadoPor: ADMIN } },
    arquitetural: {
      conceitos: {
        'produto-principal': { nome: 'Produto principal', ordem: 1, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'a1' },
        componente: { nome: 'Componente', ordem: 2, ativo: true, situacaoDefinicao: 'em revisão' }
      },
      fontes: {
        'produto-principal': { a1: f('Definição vigente sintética A.', 'vigente', { rotulo: 'Oficial' }), a2: f('Proposta sintética que nunca foi vigente.', 'em validação', { tipoRedacao: 'proposta' }) },
        componente: { c1: f('Texto em revisão sintético.', 'histórica/contextual') }
      },
      auditoria: { 'produto-principal': { e1: { tipo: 'definicao_vigente', conceito: 'produto-principal', usuario: { email: 'antiga@previ.com.br' }, dataHora: T0, fonteAnteriorId: null, fonteNovaId: 'a1' } } }
    },
    organizacional: {
      conceitos: {
        PLATAFORMA_HABILITADORA_NEGOCIOS: { nome: 'Linhas de Plataforma Habilitadora de Negócios', ordem: 1, ativo: true, camada: 'A', situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'p2' },
        SQUAD: { nome: 'Squad', ordem: 2, ativo: true, camada: 'trabalho', situacaoDefinicao: 'ainda não registrada' }
      },
      fontes: { PLATAFORMA_HABILITADORA_NEGOCIOS: {
        p1: f('Texto antigo sintético rebaixado.', 'histórica/contextual'),
        p2: f('Definição vigente sintética organizacional.', 'vigente'),
        p3: f('Placeholder sintético.', 'placeholder'),
        p4: f('Arquivado sintético.', 'histórica/contextual', { arquivada: true, arquivamento: { motivo: 'duplicidade', em: T0, por: ADMIN } })
      } },
      auditoria: {}, atributos: {}, perfis: {}, relacoes: {}, filhos: {}
    }
  };
}
const ctxMig = { agora: '2026-10-15T12:00:00.000Z', por: 'migracao@conta-de-servico', audKey: () => k('mig') };

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-tax-def', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext(emailKey(e), { email: e }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  const up = (e, w) => db(e).ref().update(js(w));
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }
  const perfis = async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
    await a.ref('fa-admins/' + emailKey(ADMIN2)).set({ email: ADMIN2 });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    await a.ref('avaliacao-classificacoes/produto-principal').set({ registradoEm: T0, registradoPor: ADMIN, auditoriaId: 'l1' });
  };

  console.log('\n== A. Plano da migração ==');
  const L = legado(), plano = MIG.planejar(L);
  const it = (d, c) => plano.dominios[d].find((x) => x.codigo === c);
  anota('sem inconsistências no legado sintético', plano.erros.length === 0, plano.erros.join('; '));
  anota('arquitetural: a vigente é exatamente a fonte apontada (a1)', it('arquitetural', 'produto-principal').acao === 'migrar' && it('arquitetural', 'produto-principal').fonteId === 'a1');
  anota('organizacional: a vigente é exatamente a fonte apontada (p2)', it('organizacional', 'PLATAFORMA_HABILITADORA_NEGOCIOS').fonteId === 'p2');
  anota('conceito sem ponteiro (em revisão / ainda não registrada) fica sem definição', it('arquitetural', 'componente').acao === 'sem-definicao' && it('organizacional', 'SQUAD').acao === 'sem-definicao');
  anota('fontes que nunca foram vigentes contadas para o arquivo, não para versões', plano.resumo.naoVigentes === 5 && plano.resumo.migrar === 2);
  const ruim = legado(); ruim.organizacional.fontes.PLATAFORMA_HABILITADORA_NEGOCIOS.p1.situacao = 'vigente';
  anota('duas vigentes no mesmo conceito: migração recusada', MIG.planejar(ruim).erros.some((x) => /mais de uma fonte vigente/.test(x)));
  const orfao = legado(); orfao.arquitetural.conceitos['produto-principal'].definicaoVigenteFonteId = 'naoExiste';
  anota('ponteiro para fonte inexistente: recusada', MIG.planejar(orfao).erros.some((x) => /ponteiro/.test(x)));
  const semPtr = legado(); delete semPtr.arquitetural.conceitos['produto-principal'].definicaoVigenteFonteId;
  anota('fonte vigente sem o ponteiro: recusada', MIG.planejar(semPtr).erros.some((x) => /sem o ponteiro/.test(x)));
  let lancou = false; try { MIG.payloadExecucao(ruim, MIG.planejar(ruim), ctxMig); } catch (e) { lancou = true; }
  anota('com inconsistência, nem se monta a gravação', lancou);

  console.log('\n== B. Execução (conta de serviço) e verificação ==');
  await env.clearDatabase();
  await semear(async (a) => { await perfis(a); await a.ref('taxonomia').set(L); });
  await semear((a) => a.ref().update(js(MIG.payloadExecucao(L, plano, ctxMig))));
  const T = await ler('taxonomia'), ARQV = await ler(MIG.ARQ);
  const pp = T.arquitetural.conceitos['produto-principal'], phn = T.organizacional.conceitos.PLATAFORMA_HABILITADORA_NEGOCIOS;
  anota('arquitetural: definição v1 = texto vigente, com data e autoria do texto-fonte', pp.definicao.texto === 'Definição vigente sintética A.' && pp.definicao.versao === 1 && pp.definicao.publicadaEm === T0 && pp.definicao.publicadaPor === 'curadoria@previ.com.br');
  anota('organizacional: definição v1 = texto vigente', phn.definicao.texto === 'Definição vigente sintética organizacional.' && phn.definicao.versao === 1);
  anota('histórico v1 com origem "migracao" e a referência ao texto-fonte (rótulo, tipo, contexto)', T.arquitetural.definicoes['produto-principal'].v1.origem === 'migracao' && T.arquitetural.definicoes['produto-principal'].v1.legado.fonteId === 'a1' && T.arquitetural.definicoes['produto-principal'].v1.legado.rotulo === 'Oficial');
  anota('nenhuma fonte que não era vigente virou versão (só v1 em cada conceito migrado)', Object.keys(T.organizacional.definicoes.PLATAFORMA_HABILITADORA_NEGOCIOS).join() === 'v1' && !(T.arquitetural.definicoes || {}).componente && !(T.organizacional.definicoes || {}).SQUAD);
  anota('modelo antigo removido da árvore operacional (fontes e campos do ponteiro)', !T.arquitetural.fontes && !T.organizacional.fontes && pp.definicaoVigenteFonteId === undefined && pp.situacaoDefinicao === undefined && T.organizacional.conceitos.SQUAD.situacaoDefinicao === undefined);
  anota('arquivo com TODAS as fontes (inclusive arquivada e placeholder) e os ponteiros antigos', Object.keys(ARQV.organizacional.fontes.PLATAFORMA_HABILITADORA_NEGOCIOS).sort().join() === 'p1,p2,p3,p4' && ARQV.arquitetural.fontes.componente.c1.texto === 'Texto em revisão sintético.' &&
    ARQV.arquitetural.ponteiros['produto-principal'].definicaoVigenteFonteId === 'a1' && ARQV.arquitetural.ponteiros.componente.situacaoDefinicao === 'em revisão');
  anota('auditoria antiga intacta + linha da migração no catálogo de cada domínio', T.arquitetural.auditoria['produto-principal'].e1.tipo === 'definicao_vigente' && Object.values(T.arquitetural.auditoria._catalogo).some((e) => e.tipo === 'migracao_definicoes') && Object.values(T.organizacional.auditoria._catalogo).some((e) => e.tipo === 'migracao_definicoes'));
  anota('ligação com a Avaliação intacta; marca da migração gravada', !!(await ler('avaliacao-classificacoes/produto-principal')) && !!T.meta.migracaoDefinicoes);
  anota('verificação: sem problemas', MIG.verificar(T, ARQV).length === 0, MIG.verificar(T, ARQV).join('; '));
  const p2 = MIG.planejar(T);
  anota('plano de novo: idempotente (já migrado / sem definição; nenhuma fonte)', p2.erros.length === 0 && p2.resumo.migrar === 0 && p2.resumo.jaMigrado === 2);

  console.log('\n== C. Publicação pelas regras ==');
  const pub = (e, dom, cod, atual, txt, motivo) => TD.payloadPublicacao({ dom, codigo: cod, atual, novoTexto: txt, motivo, email: e, agora: new Date().toISOString(), audKey: k('aud') }).caminhos;
  const ORG = ['organizacional', 'PLATAFORMA_HABILITADORA_NEGOCIOS'];
  const v1 = phn.definicao;
  await nega('perfil Avaliação não publica', up(AVAL, pub(AVAL, ...ORG, v1, 'Tentativa da Avaliação.')));
  await nega('Avaliação + Configuração não publica (Taxonomia é do admin geral)', up(ARQ, pub(ARQ, ...ORG, v1, 'Tentativa da Arquitetura.')));
  await nega('sem perfil não publica', up(SEM, pub(SEM, ...ORG, v1, 'Tentativa sem perfil.')));
  const concA = pub(ADMIN, ...ORG, v1, 'Versão 2 da admin A.', 'Motivo A'), concB = pub(ADMIN2, ...ORG, v1, 'Versão 2 da admin B.', 'Motivo B');
  await pode('admin geral publica a versão 2 (definição + histórico + auditoria numa gravação)', up(ADMIN, concA));
  await nega('outra admin, publicando sobre a MESMA versão 1 ao mesmo tempo: recusada', up(ADMIN2, concB));
  await nega('clique repetido (a mesma gravação de novo): recusado', up(ADMIN, concA));
  const v2 = await ler('taxonomia/organizacional/conceitos/PLATAFORMA_HABILITADORA_NEGOCIOS/definicao');
  anota('vale a primeira: versão 2, texto e autoria da admin A; o histórico tem v1 e v2', v2.versao === 2 && v2.texto === 'Versão 2 da admin A.' && Object.keys(await ler('taxonomia/organizacional/definicoes/PLATAFORMA_HABILITADORA_NEGOCIOS')).sort().join() === 'v1,v2');
  const pula = pub(ADMIN, ...ORG, v2, 'Pulando versão.'); const kk = Object.keys(pula);
  kk.forEach((c) => { if (/\/definicao$/.test(c)) pula[c].versao = 4; if (/\/v3$/.test(c)) { pula[c.replace(/v3$/, 'v4')] = Object.assign({}, pula[c], { versao: 4 }); delete pula[c]; } });
  await nega('pular versão (v2 → v4): recusado', up(ADMIN, pula));
  await nega('histórico com texto diferente da definição: recusado', up(ADMIN, ((w) => { Object.keys(w).forEach((c) => { if (/\/v3$/.test(c)) w[c].texto = 'Outro texto'; }); return w; })(pub(ADMIN, ...ORG, v2, 'Versão 3.'))));
  await nega('sem a entrada do histórico: recusado', up(ADMIN, ((w) => { Object.keys(w).forEach((c) => { if (/\/v3$/.test(c)) delete w[c]; }); return w; })(pub(ADMIN, ...ORG, v2, 'Versão 3.'))));
  await nega('autoria de outra pessoa: recusada', up(ADMIN, pub(ADMIN2, ...ORG, v2, 'Versão 3 assinada por outra.')));
  await nega('apagar a definição vigente: recusado', db(ADMIN).ref('taxonomia/organizacional/conceitos/PLATAFORMA_HABILITADORA_NEGOCIOS/definicao').remove());
  await nega('reescrever uma versão do histórico: recusado', db(ADMIN).ref('taxonomia/organizacional/definicoes/PLATAFORMA_HABILITADORA_NEGOCIOS/v1/texto').set('Reescrito'));
  await nega('trocar o texto da definição sem nova versão: recusado', db(ADMIN).ref('taxonomia/organizacional/conceitos/PLATAFORMA_HABILITADORA_NEGOCIOS/definicao/texto').set('Trocado por fora'));
  await nega('gravar fontes (modelo antigo): recusado', db(ADMIN).ref('taxonomia/organizacional/fontes/PLATAFORMA_HABILITADORA_NEGOCIOS/x1').set({ texto: 'x', contexto: 'PREVI', situacao: 'em validação', tipoRedacao: 'Conceito' }));
  await nega('gravar o ponteiro antigo: recusado', db(ADMIN).ref('taxonomia/organizacional/conceitos/PLATAFORMA_HABILITADORA_NEGOCIOS/definicaoVigenteFonteId').set('p2'));
  await nega('gravar situacaoDefinicao: recusado', db(ADMIN).ref('taxonomia/arquitetural/conceitos/componente/situacaoDefinicao').set('registrada'));
  await pode('conceito sem definição recebe a versão 1 (arquitetural)', up(ADMIN, pub(ADMIN, 'arquitetural', 'componente', null, 'Primeira definição de Componente.')));
  await pode('arquitetural: versão 2 sobre a da migração', up(ADMIN, pub(ADMIN, 'arquitetural', 'produto-principal', pp.definicao, 'Nova definição de Produto principal.')));
  await nega('escrever no arquivo da migração: recusado', db(ADMIN).ref(MIG.ARQ + '/arquitetural/fontes/x').set({ texto: 'x' }));

  console.log('\n== D. Leitura ==');
  await pode('Avaliação lê a definição arquitetural', db(AVAL).ref('taxonomia/arquitetural/conceitos/produto-principal/definicao').once('value'));
  await pode('Avaliação lê a definição de um código do Posicionamento', db(AVAL).ref('taxonomia/organizacional/conceitos/PLATAFORMA_HABILITADORA_NEGOCIOS/definicao/texto').once('value'));
  await nega('Avaliação NÃO lê a definição de conceito fora dos 10 do Posicionamento', db(AVAL).ref('taxonomia/organizacional/conceitos/SQUAD/definicao').once('value'));
  await nega('Avaliação NÃO lê o histórico das definições', db(AVAL).ref('taxonomia/arquitetural/definicoes').once('value'));
  await nega('Avaliação NÃO lê o arquivo da migração', db(AVAL).ref(MIG.ARQ).once('value'));
  await nega('sem perfil NÃO lê a definição', db(SEM).ref('taxonomia/arquitetural/conceitos/produto-principal/definicao').once('value'));
  await pode('admin lê o histórico e o arquivo', Promise.all([db(ADMIN).ref('taxonomia/organizacional/definicoes').once('value'), db(ADMIN).ref(MIG.ARQ).once('value')]));

  console.log('\n== E. Governança intacta ==');
  const aud = k('inat');
  await nega('conceito arquitetural ligado à Avaliação não é inativado', up(ADMIN, {
    'taxonomia/arquitetural/conceitos/produto-principal/ativo': false,
    'taxonomia/arquitetural/conceitos/produto-principal/inativacao': { motivo: 'teste', em: T0, por: ADMIN, auditoriaId: aud },
    ['taxonomia/arquitetural/auditoria/produto-principal/' + aud]: { tipo: 'inativacao', usuario: { email: ADMIN }, dataHora: T0 }
  }));
  const aud2 = k('nome');
  await pode('editar o nome (identificação) continua possível', up(ADMIN, {
    'taxonomia/arquitetural/conceitos/produto-principal/nome': 'Produto principal (renomeado)',
    ['taxonomia/arquitetural/auditoria/produto-principal/' + aud2]: { tipo: 'alteracao_conceito', campo: 'nome', usuario: { email: ADMIN }, dataHora: T0 }
  }));

  console.log('\n== F. Reversão ==');
  const T2 = await ler('taxonomia'), A2 = await ler(MIG.ARQ);
  const r1 = MIG.payloadReversao(T2, A2, ctxMig);
  anota('com versões publicadas depois da migração: reversão recusada (não perde publicações)', !r1.ok && r1.recusas.length >= 2, JSON.stringify(r1.recusas));
  await env.clearDatabase();
  await semear(async (a) => { await perfis(a); await a.ref('taxonomia').set(legado()); });
  const L2 = await ler('taxonomia');
  await semear((a) => a.ref().update(js(MIG.payloadExecucao(L2, MIG.planejar(L2), ctxMig))));
  const r2 = MIG.payloadReversao(await ler('taxonomia'), await ler(MIG.ARQ), ctxMig);
  await semear((a) => a.ref().update(js(r2.caminhos)));
  const T3 = await ler('taxonomia'), orig = legado();
  const estavel = (v) => (v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((x) => JSON.stringify(x) + ':' + estavel(v[x])).join(',') + '}' : JSON.stringify(v));
  const mesmo = ['arquitetural', 'organizacional'].every((d) => estavel(T3[d].fontes) === estavel(js(orig[d].fontes)) &&
    Object.keys(orig[d].conceitos).every((c) => (T3[d].conceitos[c].definicaoVigenteFonteId || null) === (orig[d].conceitos[c].definicaoVigenteFonteId || null) && T3[d].conceitos[c].situacaoDefinicao === orig[d].conceitos[c].situacaoDefinicao && !T3[d].conceitos[c].definicao) && !T3[d].definicoes);
  anota('numa base recém-migrada, a reversão volta exatamente ao modelo antigo', r2.ok && mesmo && !T3.meta.migracaoDefinicoes, JSON.stringify({ ok: r2.ok, mesmo, meta: T3.meta && T3.meta.migracaoDefinicoes, org: T3.organizacional.conceitos.SQUAD }));

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
