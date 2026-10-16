/* Semente FICTÍCIA da ficha da Taxonomia, com a MESMA ESTRUTURA do caso de referência (Linhas de Estratégia de
 * Clientes, código ESTRATEGIA_CLIENTES): 13 atributos no catálogo, 3 definidos; histórico com registros do modelo
 * antigo (criação de fonte, troca de vigência) e alterações reais; versão 1 da definição vinda da migração; relações
 * conceituais (inclusive "Plataforma Habilitadora de Tecnologia atende Área Especializada"). Nenhum texto conceitual
 * real: definições, critérios, valores e notas são inventados. Os 10 códigos do Posicionamento e as 11 classificações
 * da Avaliação existem e estão vinculados (integração completa); `semente({ integracao: 'incompleta' })` tira vínculos. */
const EMAIL = 'adm@previ.com.br';
const CUR = 'curadoria@previ.com.br';
const usr = (email) => ({ nome: email === EMAIL ? 'Admin Fictício' : 'Curadoria Fictícia', email });
const T0 = '2026-10-01T09:00:00.000Z';

const ATRIBUTOS = {
  CONSUMIDOR_DIRETO: ['Consumidor direto principal', 'quem-recebe', 'lista', 1, ['participantes', 'áreas internas', 'Linhas e times']],
  NATUREZA_PUBLICO: ['Natureza do público', 'quem-recebe', 'lista', 2, ['externo', 'interno', 'misto']],
  BENEFICIARIO_INDIRETO: ['Beneficiário indireto', 'quem-recebe', 'texto', 3],
  ALCANCE_ATUACAO: ['Alcance de atuação', 'alcance', 'lista', 4, ['específica', 'atende algumas estruturas', 'transversal']],
  OBJETO_PREDOMINANTE: ['Objeto predominante', 'entrega', 'texto', 5],
  PROPOSITO_PREDOMINANTE: ['Propósito predominante', 'entrega', 'texto', 6],
  FORMA_ENTREGA_CONSUMO: ['Forma de entrega/consumo', 'entrega', 'lista', 7, ['serviço', 'produto', 'orientação']],
  LIDERANCA: ['Liderança', 'governanca', 'texto', 8],
  VINCULACAO: ['Vinculação', 'governanca', 'texto', 9],
  SLA: ['SLA', 'outros', 'texto', 10],
  COMPOSICAO_TIPICA: ['Composição típica', 'outros', 'texto', 11],
  AREA_VINCULACAO: ['Área de vinculação', 'outros', 'texto', 12],
  CLIENTE_FINAL_IMPACTADO: ['Cliente final impactado', 'outros', 'texto', 13]
};
const ORG = { // código: [nome, camada, pai]
  LINHA: ['Linhas (fictício)', 'A', null], NEGOCIOS: ['Linhas de Negócios (fictício)', 'B', 'LINHA'],
  ESTRATEGIA_CLIENTES: ['Linhas de Estratégia de Clientes', 'B', 'LINHA'], PLATAFORMA: ['Linhas de Plataforma (fictício)', 'B', 'LINHA'],
  PLATAFORMA_CANAIS: ['Plataforma de Canais (fictício)', 'C', 'PLATAFORMA'], PLATAFORMA_HABILITADORA_NEGOCIOS: ['Plataforma Habilitadora de Negócios (fictício)', 'C', 'PLATAFORMA'],
  PLATAFORMA_HABILITADORA_TECNOLOGIA: ['Linhas de Plataforma Habilitadora de Tecnologia', 'C', 'PLATAFORMA'], PLATAFORMA_CORPORATIVA: ['Plataforma de Gestão Corporativa (fictício)', 'C', 'PLATAFORMA'],
  AREA_ESPECIALIZADA: ['Área Especializada', 'A', null], COE: ['Centro de Excelência (fictício)', 'A', null],
  SQUAD: ['Squad (fictício)', 'trabalho', null], CAPITULO: ['Capítulo (fictício)', 'trabalho', null], DISCIPLINA: ['Disciplina (fictício)', 'auxiliar', null]
};
const ARQ = ['produto-principal', 'unidade-valor-associada', 'modalidade-subproduto', 'funcionalidade-operacao', 'componente', 'regra-condicao', 'processo-etapa', 'capacidade-organizacional', 'canal', 'documento-informacao', 'a-validar'];
const POS = ['LINHA', 'PLATAFORMA', 'AREA_ESPECIALIZADA', 'COE', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];
const DEF_EC = 'Definição fictícia: estruturas que compreendem públicos fictícios e orientam decisões a partir dessa compreensão.';
const DEF_PHT = 'Definição fictícia: estruturas que fornecem capacidades tecnológicas compartilhadas a diferentes Linhas e times.';

function definicao(texto, origem) { const d = { texto, versao: 1, publicadaEm: T0, publicadaPor: CUR }; return { d, v1: Object.assign({ origem }, d, origem === 'migracao' ? { legado: { fonteId: 'f1', contexto: 'PREVI', tipoRedacao: 'Conceito' } } : {}) }; }

function semente(opcoes) {
  const o = Object.assign({ integracao: 'completa' }, opcoes || {});
  const conceitos = {}, definicoes = {}, filhos = {};
  Object.keys(ORG).forEach((c, i) => {
    const [nome, camada, pai] = ORG[c];
    const k = { nome, camada, ordem: i + 1, ativo: true, atualizadoEm: T0, atualizadoPor: CUR };
    if (pai) { k.pai = pai; (filhos[pai] = filhos[pai] || {})[c] = true; }
    const texto = c === 'ESTRATEGIA_CLIENTES' ? DEF_EC : c === 'PLATAFORMA_HABILITADORA_TECNOLOGIA' ? DEF_PHT : 'Definição fictícia de ' + nome + '.';
    const def = definicao(texto, 'migracao'); k.definicao = def.d; definicoes[c] = { v1: def.v1 };
    conceitos[c] = k;
  });
  Object.assign(conceitos.ESTRATEGIA_CLIENTES, {
    perguntaDiscriminadora: 'Pergunta fictícia: a estrutura organiza o conhecimento sobre públicos para orientar decisões?',
    criterios: { k1: { texto: 'Critério fictício 1: compreende públicos.', ordem: 1 }, k2: { texto: 'Critério fictício 2: organiza segmentos.', ordem: 2 }, k3: { texto: 'Critério fictício 3: orienta decisões.', ordem: 3 } },
    observacoes: 'Observação fictícia sobre o uso do conceito.', ordemDaPergunta: 3, atualizadoEm: '2026-10-04T15:20:00.000Z', atualizadoPor: EMAIL
  });
  const atributos = {};
  Object.keys(ATRIBUTOS).forEach((k) => {
    const [nome, grupo, tipoValor, ordem, vals] = ATRIBUTOS[k];
    atributos[k] = { nome, grupo, tipoValor, ordem, ativo: true };
    if (vals) { atributos[k].valoresPermitidos = {}; vals.forEach((t, i) => { atributos[k].valoresPermitidos['v' + (i + 1)] = { texto: t, ordem: i + 1 }; }); }
  });
  const perfis = { ESTRATEGIA_CLIENTES: {
    LIDERANCA: { estado: 'registrado', valor: 'única (fictício)', papel: 'observado', origem: 'fonte' },
    OBJETO_PREDOMINANTE: { estado: 'registrado', valor: 'públicos e segmentos (fictício)', papel: 'definidor', origem: 'decisão', atualizadoEm: '2026-10-04T15:18:29.303Z' },
    PROPOSITO_PREDOMINANTE: { estado: 'registrado', valor: 'orientar decisões (fictício)', papel: 'definidor', origem: 'decisão', atualizadoEm: '2026-10-04T15:18:46.063Z' }
  } };
  const relacoes = {
    PLATAFORMA_HABILITADORA_TECNOLOGIA__atende__AREA_ESPECIALIZADA: { de: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', tipo: 'atende', para: 'AREA_ESPECIALIZADA' },
    PLATAFORMA_HABILITADORA_TECNOLOGIA__atende__COE: { de: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', tipo: 'atende', para: 'COE' },
    PLATAFORMA__atende__LINHA: { de: 'PLATAFORMA', tipo: 'atende', para: 'LINHA' },
    SQUAD__compoe__LINHA: { de: 'SQUAD', tipo: 'compoe', para: 'LINHA', nota: 'Nota fictícia da relação.' }
  };
  const a = (tipo, campo, ant, nov, quando, email, extra) => Object.assign({ tipo, conceito: 'ESTRATEGIA_CLIENTES', campo, valorAnterior: ant, valorNovo: nov, usuario: usr(email || CUR), dataHora: quando }, extra || {});
  const auditoria = {
    ESTRATEGIA_CLIENTES: {
      '-A01': a('alteracao_fonte', 'nova fonte', null, 'Conceito (PREVI)', '2026-10-02T10:00:00.000Z', CUR, { fonteId: 'f1' }),
      '-A02': a('definicao_vigente', 'definição vigente', null, 'Conceito (PREVI)', '2026-10-02T10:01:00.000Z', CUR, { fonteAnteriorId: null, fonteNovaId: 'f1' }),
      '-A03': a('alteracao_conceito', 'perguntaDiscriminadora', null, 'Pergunta fictícia: a estrutura organiza o conhecimento sobre públicos para orientar decisões?', '2026-10-03T11:00:00.000Z', EMAIL),
      '-A04': a('alteracao_perfil', 'Objeto predominante', null, 'públicos e segmentos (fictício) (definidor · origem: decisão)', '2026-10-04T15:18:29.303Z', EMAIL),
      '-A05': a('alteracao_perfil', 'Propósito predominante', null, 'orientar decisões (fictício) (definidor · origem: decisão)', '2026-10-04T15:18:46.063Z', EMAIL),
      '-A06': a('alteracao_conceito', 'observacoes', null, 'Observação fictícia sobre o uso do conceito.', '2026-10-04T15:19:00.000Z', EMAIL),
      '-A07': a('alteracao_conceito', 'criterios', null, ['Critério fictício 1: compreende públicos.', 'Critério fictício 2: organiza segmentos.', 'Critério fictício 3: orienta decisões.'], '2026-10-04T15:19:30.000Z', EMAIL),
      '-A08': a('alteracao_conceito', 'nome', 'Estratégia de Clientes', 'Linhas de Estratégia de Clientes', '2026-10-04T15:20:00.000Z', EMAIL),
      '-A09': a('alteracao_fonte', 'nova fonte', null, 'Significado v2 (BB)', '2026-10-05T09:00:00.000Z', CUR, { fonteId: 'f2' })
    },
    _catalogo: { '-A00': { tipo: 'carga_inicial', campo: 'carga inicial', valorNovo: 'Carga inicial (fictícia)', usuario: usr(CUR), dataHora: T0 } }
  };
  const arqConceitos = {}, arqDefinicoes = {};
  ARQ.forEach((c, i) => { const d = definicao('Definição fictícia da classificação ' + c + '.', 'migracao'); arqConceitos[c] = { nome: 'Classificação fictícia ' + (i + 1), ordem: i + 1, ativo: true, definicao: d.d, criterios: { k1: { texto: 'Critério arquitetural fictício.', ordem: 1 } } }; arqDefinicoes[c] = { v1: d.v1 }; });
  const arqAud = { componente: {
    '-B01': { tipo: 'alteracao_fonte', conceito: 'componente', campo: 'nova fonte', valorAnterior: null, valorNovo: 'Conceito (PREVI)', usuario: usr(CUR), dataHora: '2026-10-02T10:00:00.000Z', fonteId: 'c1' },
    '-B02': { tipo: 'definicao_vigente', conceito: 'componente', campo: 'definição vigente', valorAnterior: null, valorNovo: 'Conceito (PREVI)', usuario: usr(CUR), dataHora: '2026-10-02T10:01:00.000Z', fonteAnteriorId: null, fonteNovaId: 'c1' },
    '-B03': { tipo: 'alteracao_conceito', conceito: 'componente', campo: 'observacoes', valorAnterior: null, valorNovo: 'Observação arquitetural fictícia.', usuario: usr(EMAIL), dataHora: '2026-10-03T10:00:00.000Z' }
  } };
  const lig = (codigos) => { const m = {}; codigos.forEach((c) => { m[c] = { registradoEm: '2026-10-06T12:00:00.000Z', registradoPor: EMAIL, auditoriaId: '-L' + c.replace(/[^A-Za-z]/g, '').slice(0, 12) }; }); return m; };
  const incompleta = o.integracao === 'incompleta';
  return {
    taxonomia: {
      meta: { cargaInicial: { feitaEm: T0, feitaPor: CUR, resumo: {} }, indiceFilhos: { criadoEm: T0, criadoPor: CUR }, migracaoDefinicoes: { feitaEm: '2026-10-16T00:59:00.000Z', feitaPor: 'migracao@conta-de-servico', resumo: {} } },
      organizacional: { conceitos, definicoes, atributos, perfis, relacoes, auditoria, filhos },
      arquitetural: { conceitos: arqConceitos, definicoes: arqDefinicoes, auditoria: arqAud }
    },
    'taxonomia-arquivo-migracao': {
      organizacional: { fontes: { ESTRATEGIA_CLIENTES: { f1: { texto: DEF_EC, situacao: 'vigente', contexto: 'PREVI', tipoRedacao: 'Conceito', rotulo: 'Conceito' }, f2: { texto: 'Redação antiga fictícia, nunca vigente.', situacao: 'histórica/contextual', contexto: 'BB', tipoRedacao: 'Significado v2' } } } },
      arquitetural: { fontes: { componente: { c1: { texto: 'Definição fictícia da classificação componente.', situacao: 'vigente', contexto: 'PREVI', tipoRedacao: 'Conceito' } } } }
    },
    'avaliacao-classificacoes': lig(incompleta ? ARQ.filter((c) => c !== 'canal') : ARQ),
    'posicionamento-classificacoes': lig(incompleta ? POS.filter((c) => c !== 'COE') : POS)
  };
}
module.exports = { semente, EMAIL, ARQ, POS, ATRIBUTOS, DEF_EC, DEF_PHT };
