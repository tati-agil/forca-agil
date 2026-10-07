/* Diagnóstico do motor de classificação arquitetural (P1–P16) — proposta de versão 6.
 *
 * SÓ LEITURA E SÓ SIMULAÇÃO. Nada aqui publica regra, grava no Firebase, altera
 * avaliação ou muda a versão vigente: o motor real (forca-agil/motor-arquitetura.js)
 * é carregado num vm com um Firebase falso que só conta tentativas de escrita, e
 * as variantes de V6 são CÓPIAS das regras da V5 montadas em memória.
 *
 * A V5 é montada pelo mesmo caminho de teste-a-validar-gestao.js:
 *   regrasVersao3Esperadas() → construirPropostaConflitoNaturezas() → P8 = SIM
 *   em PRODUTO_SERVICO_PRINCIPAL e UNIDADE_VALOR_ASSOCIADA.
 * (A versão publicada fica no Firebase; esta é a reconstrução que os testes
 * do repositório usam e que bate com a tela "Configuração dos Motores".)
 *
 * Uso:
 *   node .github/scripts/diagnostico-motor-v6.js [pasta-de-saída]
 * Sem pasta, só imprime o resumo. Com pasta, grava relatorio.md, resumo.json e
 * um CSV por variante com TODAS as combinações que mudam.
 *
 * Também é usado como biblioteca por teste-diagnostico-motor-v6.js. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');
const CAMPOS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'];
const TOTAL = 65536;
const copia = (x) => JSON.parse(JSON.stringify(x));

/* ---------------------------------------------------------------- motor real */
function carregarMotor() {
  const escritas = [];
  const ref = (p) => ({
    on() {}, once() { return Promise.resolve({ val: () => null }); }, off() {},
    set() { escritas.push(['set', p]); return Promise.resolve(); },
    update() { escritas.push(['update', p]); return Promise.resolve(); },
    remove() { escritas.push(['remove', p]); return Promise.resolve(); },
    transaction() { escritas.push(['transaction', p]); return Promise.resolve(); },
    push() { escritas.push(['push', p]); return { key: 'k' }; },
    child(c) { return ref(p + '/' + c); }
  });
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  ctx.window = ctx;
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref }) };
  ctx.navigator = {}; ctx.location = { hash: '' };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js']) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, 'forca-agil', f), 'utf8'), ctx, { filename: f });
  }
  return { M: ctx.window.faMotorArquitetura, escritas };
}

function regrasV5(M) {
  const v5 = copia(M.construirPropostaConflitoNaturezas(M.regrasVersao3Esperadas()));
  ['PRODUTO_SERVICO_PRINCIPAL', 'UNIDADE_VALOR_ASSOCIADA'].forEach((c) => v5.find((r) => r.codigo === c).condicoes.all.push({ campo: 'P8', valor: 'SIM' }));
  return v5;
}

/* ----------------------------------------------------- combinações e leitura */
function combinacao(n) {
  const r = {};
  for (let b = 0; b < 16; b++) r[CAMPOS[b]] = (n >> b) & 1 ? 'SIM' : 'NAO';
  return r;
}
const sim = (n, campo) => ((n >> (CAMPOS.indexOf(campo))) & 1) === 1;

/* Avaliador compilado, espelho do avaliarCondicao do motor — só para rodar
   rápido nas análises de redundância. A equivalência com o motor real é
   PROVADA em cada execução (provarEquivalencia), nunca presumida. */
function compilar(cond) {
  if (cond.all) { const f = cond.all.map(compilar); return (n) => f.every((g) => g(n)); }
  if (cond.any) { const f = cond.any.map(compilar); return (n) => f.some((g) => g(n)); }
  if (cond.of) { const f = cond.of.map(compilar), k = cond.atLeast; return (n) => f.filter((g) => g(n)).length >= k; }
  if (cond.not) { const f = compilar(cond.not); return (n) => !f(n); }
  const bit = CAMPOS.indexOf(cond.campo), quer = cond.valor === 'SIM' ? 1 : 0;
  return (n) => ((n >> bit) & 1) === quer;
}
function decisor(regras) {
  const ord = regras.slice().sort((a, b) => a.ordem - b.ordem);
  const comp = ord.map((r) => (r.tipo === 'FALLBACK' ? null : compilar(r.condicoes)));
  const fb = ord.find((r) => r.tipo === 'FALLBACK');
  return (n) => { for (let i = 0; i < ord.length; i++) if (comp[i] && comp[i](n)) return ord[i]; return fb; };
}
function provarEquivalencia(M, regras) {
  const d = decisor(regras);
  let dif = 0;
  for (let n = 0; n < TOTAL; n++) {
    const a = M.identificarCamada(combinacao(n), { regras: copia(regras) });
    const b = d(n);
    if (a.camada !== b.resultado || a.regraAplicada !== b.codigo) dif++;
  }
  return dif;
}

/* ------------------------------------------------------------- vocabulário */
const NOME_CLASSE = {
  'produto-principal': 'Produto/Serviço principal', 'funcionalidade-operacao': 'Funcionalidade/Operação', 'canal': 'Canal',
  'documento-informacao': 'Informação/Documento', 'unidade-valor-associada': 'Unidade de valor associada',
  'capacidade-organizacional': 'Capacidade organizacional', 'componente': 'Componente', 'modalidade-subproduto': 'Modalidade/Subproduto',
  'regra-condicao': 'Regra/Opção', 'processo-etapa': 'Processo/Etapa de processo', 'a-validar': 'A validar'
};
const DETALHE_REGRA = {
  INCOERENCIA: 'A validar — incoerência', CONFLITO_NATUREZAS: 'A validar — conflito de naturezas',
  CONFLITO_NATUREZAS_AMPLIADO: 'A validar — conflito de naturezas', FALLBACK_A_VALIDAR: 'A validar — sem classificação'
};
const rotuloRegra = (r) => DETALHE_REGRA[r.codigo] || NOME_CLASSE[r.resultado];
const TITULO = {
  P1: 'Necessidade do cliente', P2: 'Resultado próprio', P3: 'Solução identificável', P4: 'Fronteira coerente', P5: 'Autonomia estrutural',
  P6: 'Jornada própria', P7: 'Medição de resultado', P8: 'Gestão ponta a ponta', P9: 'Canal', P10: 'Informação/Documento',
  P11: 'Capacidade', P12: 'Processo/Etapa', P13: 'Modalidade/opção', P14: 'Regra/condição', P15: 'Componente', P16: 'Funcionalidade/Operação'
};
const NATUREZAS = ['P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'];

/* ------------------------------------------- matriz de compatibilidade P9–P16
   categoria:
     conflitante  — as duas naturezas não podem ser, ao mesmo tempo, o que o item
                    "é principalmente": SIM nas duas indica objeto mal delimitado;
     ambigua      — naturezas distintas que costumam ser confundidas no mesmo
                    objeto (verbo × substantivo, meio × conteúdo, regra × processo
                    que ela governa); a resposta depende do recorte, não é
                    contradição lógica;
     subordinada  — uma das duas é a forma mais específica da outra; a
                    precedência resolve de forma legítima;
     compativel   — as duas convivem naturalmente (em geral por causa da
                    redação de P15, que pergunta PARA QUE o item existe, não o
                    que ele é).
   v5Conflito: o par já está no grupo "pelo menos 2 entre P11–P15" da V5. */
const PARES = [
  ['P9', 'P10', 'conflitante', 'Canal é o meio pelo qual o cliente acessa; documento é o conteúdo entregue. Em "extrato no app", o objeto é o extrato (P10) ou o app (P9), não os dois como natureza principal.'],
  ['P9', 'P11', 'ambigua', 'Uma central de atendimento é canal para o cliente e capacidade para a organização (o próprio Mapa da Floresta fala em "capacidades de interação"). Depende do ponto de vista adotado, não é contradição.'],
  ['P9', 'P12', 'conflitante', 'Meio de acesso × sequência de atividades. "Atendimento" costuma juntar os dois; SIM nas duas mostra que não ficou decidido se o objeto é o canal ou o processo de atendimento.'],
  ['P9', 'P13', 'conflitante', 'Um canal de acesso não é opção ou configuração de outro produto. Escolher contratar pelo app é escolha de canal, não modalidade do produto.'],
  ['P9', 'P14', 'conflitante', 'Meio de acesso × norma. Não há leitura em que o mesmo objeto seja principalmente as duas coisas.'],
  ['P9', 'P15', 'compativel', 'P15 pergunta para que o item existe. Todo canal existe para que produtos cheguem ao cliente: SIM nas duas é coerente, e Canal, mais específico, decide.'],
  ['P9', 'P16', 'subordinada', 'Um canal oferece funcionalidades, e uma funcionalidade pode morar dentro de um canal (o chat dentro do app). Se o item avaliado é a funcionalidade, P16 descreve melhor — e a V5 já decide Funcionalidade quando P5 = NÃO.'],
  ['P10', 'P11', 'conflitante', 'Artefato informacional × capacidade da organização: naturezas que não se sobrepõem.'],
  ['P10', 'P12', 'ambigua', 'O documento é o resultado de um processo ("emissão do informe"). SIM nas duas costuma indicar que o nome do item mistura a saída e a atividade que a produz.'],
  ['P10', 'P13', 'conflitante', 'Modalidade é opção de outro produto; documento é saída informacional. Naturezas distintas.'],
  ['P10', 'P14', 'ambigua', 'Um regulamento é um documento cujo conteúdo é regra. Depende se o objeto é o texto entregue ou a regra que ele contém.'],
  ['P10', 'P15', 'compativel', 'Um termo de adesão existe para que a contratação de outro produto aconteça: é documento por natureza e "existe para outro produto" por propósito.'],
  ['P10', 'P16', 'ambigua', '"Emitir extrato" (operação) × "extrato" (documento): verbo e substantivo do mesmo objeto. A V5 decide Funcionalidade quando P5 = NÃO.'],
  ['P11', 'P12', 'conflitante', 'O que a organização é capaz de fazer × como ela faz. Já é conflito na V5.'],
  ['P11', 'P13', 'conflitante', 'Capacidade interna × opção oferecida dentro de um produto. Já é conflito na V5.'],
  ['P11', 'P14', 'conflitante', 'Capacidade × norma de um produto. Já é conflito na V5.'],
  ['P11', 'P15', 'ambigua', 'Capacidade serve à organização de forma transversal; P15 fala de servir a outro Produto/Serviço. Uma capacidade que hoje atende um único produto pode ter SIM nas duas. A V5 manda para conflito, o que é aceitável: decidir se é transversal ou de um produto é análise humana.'],
  ['P11', 'P16', 'conflitante', 'Capacidade organizacional × operação dentro de um produto. "Simulação" pode nomear as duas coisas, mas o objeto avaliado é uma ou outra.'],
  ['P12', 'P13', 'conflitante', 'Sequência de atividades × opção de produto. Já é conflito na V5.'],
  ['P12', 'P14', 'ambigua', 'A regra governa o processo ("regra de elegibilidade" × "análise de elegibilidade"). A V5 manda para conflito; não há motivo para mudar sem revisar os textos antes.'],
  ['P12', 'P15', 'compativel', 'Um processo de concessão existe para que o plano entregue o benefício: SIM em P15 é natural pela redação atual (propósito, não natureza). A V5 trata como conflito por causa dessa redação.'],
  ['P12', 'P16', 'ambigua', '"Solicitar resgate" é a operação do cliente; o processo de resgate roda por trás dela. A V5 decide Funcionalidade quando P5 = NÃO.'],
  ['P13', 'P14', 'ambigua', '"Carência de 6 meses" pode ser lida como regra ou como opção — o próprio nome da classificação é "Regra/Opção". A V5 manda para conflito.'],
  ['P13', 'P15', 'conflitante', 'Modalidade é variação visível ao cliente; componente é parte que habilita outro produto. Já é conflito na V5.'],
  ['P13', 'P16', 'ambigua', '"Escolher perfil de investimento" (operação) × "perfil conservador" (opção). A V5 decide Funcionalidade quando P5 = NÃO.'],
  ['P14', 'P15', 'compativel', 'Uma regra existe para que o produto funcione: SIM em P15 é natural pela redação atual. Mesmo caso de Processo × Componente; a V5 trata como conflito.'],
  ['P14', 'P16', 'conflitante', 'Norma × operação. A V5 decide Funcionalidade (P5 = NÃO) e esconde a contradição.'],
  ['P15', 'P16', 'subordinada', 'Toda funcionalidade existe dentro de outro produto, então P15 = SIM é esperado. Funcionalidade, mais específica, decide (V5, precedência 2).']
].map(([a, b, categoria, justificativa]) => {
  const grupoV5 = ['P11', 'P12', 'P13', 'P14', 'P15'];
  return { a, b, categoria, justificativa, v5Conflito: grupoV5.includes(a) && grupoV5.includes(b) };
});
const NOVOS_CONFLITOS = PARES.filter((p) => p.categoria === 'conflitante' && !p.v5Conflito);

/* ------------------------------------------------------- variantes da V6 */
function renumerar(regras) {
  return regras.slice().sort((a, b) => a.ordem - b.ordem).map((r, i) => Object.assign(r, { ordem: i }));
}
function regraConflitoAmpliado(ordem) {
  return {
    codigo: 'CONFLITO_NATUREZAS_AMPLIADO', ordem, resultado: 'a-validar', incoerencia: false, conflito: null,
    motivos: Array.from(new Set(NOVOS_CONFLITOS.flatMap((p) => [p.a, p.b]))),
    condicoes: { any: NOVOS_CONFLITOS.map((p) => ({ all: [{ campo: p.a, valor: 'SIM' }, { campo: p.b, valor: 'SIM' }] })) }
  };
}
const ORDEM_APOS_PRODUTO = 1.5; /* entre PRODUTO_SERVICO_PRINCIPAL (1) e FUNCIONALIDADE_OPERACAO (2) */
const VARIANTES = {
  'conf-a': {
    titulo: 'Conflito A — só os pares claramente conflitantes que a V5 não trata',
    descricao: 'Nova regra CONFLITO_NATUREZAS_AMPLIADO logo depois de Produto/Serviço principal (antes de Funcionalidade, Canal e Documento): A validar se qualquer um dos ' + NOVOS_CONFLITOS.length + ' pares ' + NOVOS_CONFLITOS.map((p) => p.a + '×' + p.b).join(', ') + ' tiver as duas respostas SIM. CONFLITO_NATUREZAS (P11–P15) fica onde está.',
    montar(v5) { const r = copia(v5); r.push(regraConflitoAmpliado(ORDEM_APOS_PRODUTO)); return renumerar(r); }
  },
  'conf-b': {
    titulo: 'Conflito B — A + antecipar o conflito P11–P15 da V5',
    descricao: 'Igual à A, e CONFLITO_NATUREZAS (pelo menos 2 entre P11–P15) também passa para antes de Funcionalidade, Canal e Documento.',
    montar(v5) {
      const r = copia(v5); r.push(regraConflitoAmpliado(ORDEM_APOS_PRODUTO));
      r.find((x) => x.codigo === 'CONFLITO_NATUREZAS').ordem = ORDEM_APOS_PRODUTO + 0.1;
      return renumerar(r);
    }
  },
  'conf-c': {
    titulo: 'Conflito C (exploratória) — A + tirar do conflito os pares "compatíveis" com P15',
    descricao: 'Igual à A, e o conflito P11–P15 da V5 deixa de valer para Processo×Componente e Regra×Componente (pares que a matriz julga compatíveis pela redação atual de P15). Mostra o efeito; não é recomendada sem revisar antes o texto de P15.',
    montar(v5) {
      const r = copia(v5); r.push(regraConflitoAmpliado(ORDEM_APOS_PRODUTO));
      const c = r.find((x) => x.codigo === 'CONFLITO_NATUREZAS');
      const manter = PARES.filter((p) => p.v5Conflito && p.categoria !== 'compativel');
      c.conflitoDinamico = false;
      c.condicoes = { any: manter.map((p) => ({ all: [{ campo: p.a, valor: 'SIM' }, { campo: p.b, valor: 'SIM' }] })) };
      return renumerar(r);
    }
  },
  'cap-a': {
    titulo: 'Capacidade A — sem P1 = NÃO',
    descricao: 'CAPACIDADE_ORGANIZACIONAL passa a ser P11 = SIM e P15 = NÃO (sai P1 = NÃO). Precedências e demais regras iguais à V5.',
    montar(v5) {
      const r = copia(v5); const c = r.find((x) => x.codigo === 'CAPACIDADE_ORGANIZACIONAL');
      c.condicoes.all = c.condicoes.all.filter((x) => x.campo !== 'P1'); c.motivos = (c.motivos || []).filter((m) => m !== 'P1');
      return renumerar(r);
    }
  },
  'cap-b': {
    titulo: 'Capacidade B — sem P1 = NÃO e sem nenhuma outra natureza',
    descricao: 'CAPACIDADE_ORGANIZACIONAL passa a ser P11 = SIM, P15 = NÃO e P9, P10, P12, P13, P14, P16 = NÃO.',
    montar(v5) {
      const r = copia(v5); const c = r.find((x) => x.codigo === 'CAPACIDADE_ORGANIZACIONAL');
      c.condicoes.all = c.condicoes.all.filter((x) => x.campo !== 'P1').concat(['P9', 'P10', 'P12', 'P13', 'P14', 'P16'].map((campo) => ({ campo, valor: 'NAO' })));
      c.motivos = (c.motivos || []).filter((m) => m !== 'P1');
      return renumerar(r);
    }
  },
  'p15-relacao': {
    titulo: 'P15 como relação (ilustrativa) — Componente deixa de ser natureza exclusiva',
    descricao: 'Só para medir a alternativa B do diagnóstico de P15, sem as variantes de conflito/capacidade: o conflito da V5 passa a contar só P11–P14; Componente vira o caso residual (P15 = SIM e nenhuma outra natureza de P11–P14); Capacidade, Modalidade e Unidade de valor deixam de exigir P15 = NÃO. Produto/Serviço principal continua exigindo P15 = NÃO (P5 = SIM e "é componente de outro" se contradizem).',
    montar(v5) {
      const r = copia(v5);
      const c = r.find((x) => x.codigo === 'CONFLITO_NATUREZAS');
      c.condicoes = { all: [{ atLeast: 2, of: ['P11', 'P12', 'P13', 'P14'].map((campo) => ({ campo, valor: 'SIM' })) }] };
      c.motivos = ['P11', 'P12', 'P13', 'P14'];
      r.find((x) => x.codigo === 'COMPONENTE').condicoes.all.push({ campo: 'P11', valor: 'NAO' }, { campo: 'P13', valor: 'NAO' });
      ['CAPACIDADE_ORGANIZACIONAL', 'MODALIDADE_SUBPRODUTO', 'UNIDADE_VALOR_ASSOCIADA'].forEach((cod) => {
        const x = r.find((y) => y.codigo === cod); x.condicoes.all = x.condicoes.all.filter((f) => f.campo !== 'P15');
      });
      return renumerar(r);
    }
  },
  'cap-g': {
    titulo: 'Capacidade G — A com proteção do núcleo de Produto/Serviço',
    descricao: 'Como a A, mas o item que também cumpre TODO o núcleo de Produto/Serviço principal (P1, P2, P3, P4, P5 e P8 = SIM) continua em A validar: declarar "principalmente capacidade" e, ao mesmo tempo, atender tudo o que caracteriza um Produto/Serviço é contradição para análise humana.',
    montar(v5) {
      const r = VARIANTES['cap-a'].montar(v5); const c = r.find((x) => x.codigo === 'CAPACIDADE_ORGANIZACIONAL');
      c.condicoes.all.push({ not: { all: ['P1', 'P2', 'P3', 'P4', 'P5', 'P8'].map((campo) => ({ campo, valor: 'SIM' })) } });
      return r;
    }
  },
  'v6': {
    titulo: 'V6 proposta — Conflito A + Capacidade G',
    descricao: 'A combinação recomendada para decisão: os pares claramente conflitantes passam a ir para conflito antes de qualquer classificação de natureza, e P1 deixa de impedir Capacidade organizacional (com a proteção do núcleo de Produto/Serviço).',
    montar(v5) { return VARIANTES['cap-g'].montar(VARIANTES['conf-a'].montar(v5)); }
  }
};

/* ------------------------------------------------------------ análises */
function distribuicao(d) {
  const c = {};
  for (let n = 0; n < TOTAL; n++) { const k = rotuloRegra(d(n)); c[k] = (c[k] || 0) + 1; }
  return c;
}
function porRegra(d) {
  const c = {};
  for (let n = 0; n < TOTAL; n++) { const r = d(n); c[r.codigo] = (c[r.codigo] || 0) + 1; }
  return c;
}
/* Por que mudou: a condição nova responsável. */
function causa(n, antes, depois) {
  if (depois.codigo === 'CONFLITO_NATUREZAS_AMPLIADO') {
    const pares = NOVOS_CONFLITOS.filter((p) => sim(n, p.a) && sim(n, p.b));
    return pares.length === 1 ? 'par conflitante ' + pares[0].a + ' ' + TITULO[pares[0].a] + ' × ' + pares[0].b + ' ' + TITULO[pares[0].b] : 'dois ou mais pares conflitantes novos';
  }
  if (depois.codigo === 'CONFLITO_NATUREZAS' && antes.codigo !== 'CONFLITO_NATUREZAS') return 'conflito P11–P15 que a V5 deixava ' + antes.codigo + ' decidir antes';
  if (antes.codigo === 'CONFLITO_NATUREZAS' && depois.codigo !== 'CONFLITO_NATUREZAS') return 'par ' + ['P11', 'P12', 'P13', 'P14', 'P15'].filter((c) => sim(n, c)).join('+') + ' deixou de ser conflito';
  if (depois.codigo === 'CAPACIDADE_ORGANIZACIONAL') return 'P1 = SIM deixou de impedir Capacidade organizacional';
  if (antes.codigo === 'CAPACIDADE_ORGANIZACIONAL') return 'Capacidade organizacional passou a exigir outra condição';
  return 'precedência de ' + depois.codigo;
}
function simsDe(n) { return CAMPOS.filter((c) => sim(n, c)); }
function leitura(n) {
  const s = simsDe(n);
  return s.length ? 'SIM: ' + s.map((c) => c + ' (' + TITULO[c] + ')').join(', ') + '; todas as outras NÃO' : 'todas NÃO';
}
function popcount(n) { let k = 0; while (n) { k += n & 1; n >>= 1; } return k; }

function comparar(dA, dB) {
  const grupos = {};
  const mudancas = [];
  for (let n = 0; n < TOTAL; n++) {
    const a = dA(n), b = dB(n);
    if (a.codigo === b.codigo) continue;
    const c = causa(n, a, b);
    const chave = rotuloRegra(a) + ' → ' + rotuloRegra(b) + ' | ' + c;
    const g = grupos[chave] || (grupos[chave] = { de: rotuloRegra(a), regraDe: a.codigo, ordemDe: a.ordem, para: rotuloRegra(b), regraPara: b.codigo, ordemPara: b.ordem, causa: c, quantidade: 0, exemplos: [] });
    g.quantidade++; g.exemplos.push(n);
    mudancas.push({ n, a, b, c });
  }
  Object.values(grupos).forEach((g) => { g.exemplos = g.exemplos.sort((x, y) => popcount(x) - popcount(y) || x - y).slice(0, 3); });
  const migracao = {};
  mudancas.forEach((m) => { const k = rotuloRegra(m.a) + ' → ' + rotuloRegra(m.b); migracao[k] = (migracao[k] || 0) + 1; });
  const porNaturezas = {};
  for (let n = 0; n < TOTAL; n++) {
    const k = Math.min(naturezasSim(n).length, 3);
    const g = porNaturezas[k] || (porNaturezas[k] = { combinacoes: 0, mudam: 0 });
    g.combinacoes++;
  }
  mudancas.forEach((m) => { porNaturezas[Math.min(naturezasSim(m.n).length, 3)].mudam++; });
  return { total: mudancas.length, porNaturezas, grupos: Object.values(grupos).sort((x, y) => y.quantidade - x.quantidade), migracao, mudancas };
}

/* Q1: conflitos que a V5 deixa a precedência resolver. Para cada par P9–P16
   com as duas SIM: em quantas combinações a V5 entrega uma classificação de
   natureza (não incoerência nem conflito). */
const naturezasSim = (n) => NATUREZAS.filter((c) => sim(n, c));
function mascaramentoV5(d) {
  return PARES.map((p) => {
    const desfecho = {};
    let total = 0, mascarado = 0;
    for (let n = 0; n < TOTAL; n++) {
      const nat = naturezasSim(n);
      if (nat.length !== 2 || !(sim(n, p.a) && sim(n, p.b))) continue;
      total++;
      const r = d(n);
      desfecho[rotuloRegra(r)] = (desfecho[rotuloRegra(r)] || 0) + 1;
      if (r.resultado !== 'a-validar') mascarado++;
    }
    return Object.assign({}, p, { total, mascarado, desfecho });
  });
}

/* Condições redundantes: tirar a folha não muda NENHUMA das 65.536 decisões. */
function redundancias(regras) {
  const base = decisor(regras);
  const ref = new Array(TOTAL); for (let n = 0; n < TOTAL; n++) ref[n] = base(n).codigo;
  const out = [];
  regras.forEach((r, ir) => {
    if (r.tipo === 'FALLBACK' || !r.condicoes.all) return;
    r.condicoes.all.forEach((folha, i) => {
      if (!folha.campo) return;
      const alt = copia(regras); alt[ir].condicoes.all.splice(i, 1);
      const d = decisor(alt);
      let muda = 0; for (let n = 0; n < TOTAL; n++) if (d(n).codigo !== ref[n]) muda++;
      if (!muda) out.push({ regra: r.codigo, ordem: r.ordem, condicao: folha.campo + ' = ' + folha.valor });
    });
  });
  return out;
}
/* P6/P7 nunca decidem: trocar só P6 (ou só P7) não muda nada em nenhuma combinação. */
function invariancia(d, campo) {
  const bit = 1 << CAMPOS.indexOf(campo);
  let muda = 0; for (let n = 0; n < TOTAL; n++) if (d(n).codigo !== d(n ^ bit).codigo) muda++;
  return muda;
}
/* P8 exigido: em quantas combinações trocar SÓ P8 de SIM para NÃO tira a regra X. */
function dependenciaP8(d, codigo) {
  const bit = 1 << CAMPOS.indexOf('P8');
  let k = 0; for (let n = 0; n < TOTAL; n++) if ((n & bit) && d(n).codigo === codigo && d(n ^ bit).codigo !== codigo) k++;
  return k;
}
/* Precedência 0: alcançável, mesmo total, e quanto dela coincide com os conflitos novos. */
function precedenciaZero(regras, d) {
  const conflito = compilar(regraConflitoAmpliado(0).condicoes);
  let decide = 0, sobreposta = 0;
  for (let n = 0; n < TOTAL; n++) if (d(n).codigo === 'INCOERENCIA') { decide++; if (conflito(n)) sobreposta++; }
  return { decide, sobreposta, primeira: regras.slice().sort((a, b) => a.ordem - b.ordem)[0].codigo };
}

function rodar() {
  const { M, escritas } = carregarMotor();
  const v5 = regrasV5(M);
  const dV5 = decisor(v5);
  const res = {
    v5: { regras: v5, equivalenciaMotorReal: provarEquivalencia(M, v5), distribuicao: distribuicao(dV5), porRegra: porRegra(dV5),
      mascaramento: mascaramentoV5(dV5), redundancias: redundancias(v5), p6: invariancia(dV5, 'P6'), p7: invariancia(dV5, 'P7'),
      p8: { produto: dependenciaP8(dV5, 'PRODUTO_SERVICO_PRINCIPAL'), uva: dependenciaP8(dV5, 'UNIDADE_VALOR_ASSOCIADA') }, zero: precedenciaZero(v5, dV5) },
    variantes: {}, escritas
  };
  for (const [id, v] of Object.entries(VARIANTES)) {
    const regras = v.montar(v5);
    const d = decisor(regras);
    res.variantes[id] = {
      id, titulo: v.titulo, descricao: v.descricao, regras,
      errosValidacao: Array.from(M.validarRegras({ regras: copia(regras) })),
      equivalenciaMotorReal: provarEquivalencia(M, regras),
      distribuicao: distribuicao(d), porRegra: porRegra(d), comparacao: comparar(dV5, d),
      p6: invariancia(d, 'P6'), p7: invariancia(d, 'P7'),
      p8: { produto: dependenciaP8(d, 'PRODUTO_SERVICO_PRINCIPAL'), uva: dependenciaP8(d, 'UNIDADE_VALOR_ASSOCIADA') },
      zero: precedenciaZero(regras, d), redundancias: redundancias(regras)
    };
  }
  return res;
}

/* ------------------------------------------------------------- relatório */
function textoCondicao(c) {
  if (c.campo) return c.campo + ' = ' + (c.valor === 'SIM' ? 'SIM' : 'NÃO');
  if (c.all) return c.all.map(textoCondicao).join(' E ');
  if (c.any) return '(' + c.any.map(textoCondicao).join(' OU ') + ')';
  if (c.of) return 'pelo menos ' + c.atLeast + ' de [' + c.of.map((x) => x.campo).join(', ') + '] = SIM';
  if (c.not) return 'NENHUMA de ' + textoCondicao(c.not);
  return JSON.stringify(c);
}
function tabelaRegras(regras) {
  return '| Ordem | Regra | Classifica como | Condições |\n|---|---|---|---|\n' +
    regras.slice().sort((a, b) => a.ordem - b.ordem).map((r) => '| ' + r.ordem + ' | `' + r.codigo + '` | ' + rotuloRegra(r) + ' | ' + (r.tipo === 'FALLBACK' ? 'nenhuma regra anterior bateu' : textoCondicao(r.condicoes)) + ' |').join('\n');
}
const fmt = (k) => k.toLocaleString('pt-BR');
const pct = (k) => (100 * k / TOTAL).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
function tabelaDist(dA, dB) {
  const chaves = Array.from(new Set(Object.keys(dA).concat(Object.keys(dB || {})))).sort((x, y) => (dA[y] || 0) - (dA[x] || 0));
  return '| Classificação | V5 |' + (dB ? ' Proposta | Diferença |' : '') + '\n|---|---:|' + (dB ? '---:|---:|' : '') + '\n' +
    chaves.map((k) => '| ' + k + ' | ' + fmt(dA[k] || 0) + ' |' + (dB ? ' ' + fmt(dB[k] || 0) + ' | ' + ((dB[k] || 0) - (dA[k] || 0) > 0 ? '+' : '') + fmt((dB[k] || 0) - (dA[k] || 0)) + ' |' : '')).join('\n');
}
function relatorio(res) {
  const L = [];
  L.push('# Diagnóstico do motor P1–P16 — simulação da versão 6', '');
  L.push('Gerado por `.github/scripts/diagnostico-motor-v6.js`. Só leitura: nenhuma regra publicada, nenhuma gravação no Firebase (tentativas de escrita: ' + res.escritas.length + ').', '');
  L.push('Equivalência com o motor real (`identificarCamada`) nas 65.536 combinações: V5 ' + res.v5.equivalenciaMotorReal + ' diferenças; ' +
    Object.values(res.variantes).map((v) => v.id + ' ' + v.equivalenciaMotorReal).join(', ') + '.', '');
  L.push('## V5 — distribuição', '', tabelaDist(res.v5.distribuicao), '');
  L.push('## V5 — conflitos que a precedência resolve sozinha', '', 'Par isolado: só essas duas entre P9–P16 são SIM; P1–P8 variam livremente (256 combinações por par).', '', '| Par | Categoria | Combinações | Saem com uma classificação de natureza | Desfecho na V5 |', '|---|---|---:|---:|---|');
  res.v5.mascaramento.forEach((p) => L.push('| ' + p.a + ' ' + TITULO[p.a] + ' × ' + p.b + ' ' + TITULO[p.b] + ' | ' + p.categoria + (p.v5Conflito ? ' (já conflito na V5)' : '') + ' | ' + fmt(p.total) + ' | ' + fmt(p.mascarado) + ' | ' +
    Object.entries(p.desfecho).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + fmt(v)).join('; ') + ' |'));
  L.push('', '## V5 — condições que não mudam nenhuma decisão', '');
  res.v5.redundancias.forEach((r) => L.push('- `' + r.regra + '` (precedência ' + r.ordem + '): ' + r.condicao));
  L.push('', '## Matriz P9–P16', '', '| Par | Categoria | Justificativa |', '|---|---|---|');
  PARES.forEach((p) => L.push('| ' + p.a + ' × ' + p.b + ' | ' + p.categoria + (p.v5Conflito ? ' · já conflito na V5' : '') + ' | ' + p.justificativa + ' |'));
  for (const v of Object.values(res.variantes)) {
    const c = v.comparacao;
    L.push('', '## ' + v.titulo, '', v.descricao, '');
    L.push('Validação do editor (`validarRegras`): ' + (v.errosValidacao.length ? v.errosValidacao.join(' / ') : 'aceita, nenhuma regra inalcançável') + '.', '');
    L.push('**Mudam ' + fmt(c.total) + ' de 65.536 combinações (' + pct(c.total) + ').** P6 e P7 mudam ' + v.p6 + ' e ' + v.p7 + ' decisões. Precedência 0 decide ' + fmt(v.zero.decide) + ' (' + fmt(v.zero.sobreposta) + ' delas também têm um par conflitante novo).', '');
    L.push('### Impacto por quantidade de naturezas SIM (P9–P16)', '', '| Naturezas SIM | Combinações | Mudam |', '|---|---:|---:|');
    [0, 1, 2, 3].forEach((k) => { const g = c.porNaturezas[k]; L.push('| ' + (k === 3 ? '3 ou mais' : k) + ' | ' + fmt(g.combinacoes) + ' | ' + fmt(g.mudam) + ' (' + (100 * g.mudam / g.combinacoes).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%) |'); });
    L.push('', '### Regras', '', tabelaRegras(v.regras), '');
    L.push('### Distribuição', '', tabelaDist(res.v5.distribuicao, v.distribuicao), '');
    L.push('### Migração', '', '| Resultado V5 | Resultado proposto | Quantidade |', '|---|---|---:|');
    Object.entries(c.migracao).sort((x, y) => y[1] - x[1]).forEach(([k, q]) => { const [de, para] = k.split(' → '); L.push('| ' + de + ' | ' + para + ' | ' + fmt(q) + ' |'); });
    L.push('', '### Mudanças por condição responsável', '');
    c.grupos.forEach((g) => {
      L.push('- **' + g.de + ' → ' + g.para + '** — ' + g.causa + ' — ' + fmt(g.quantidade));
      g.exemplos.forEach((n) => L.push('  - ' + leitura(n) + '. V5: `' + g.regraDe + '` (precedência ' + g.ordemDe + ' da V5); proposta: `' + g.regraPara + '` (precedência ' + g.ordemPara + ' da proposta).'));
    });
  }
  return L.join('\n') + '\n';
}
function csv(v) {
  const linhas = ['combinacao;respostas_sim;v5_resultado;v5_regra;proposta_resultado;proposta_regra;causa'];
  v.comparacao.mudancas.forEach((m) => linhas.push([m.n, simsDe(m.n).join(' '), rotuloRegra(m.a), m.a.codigo, rotuloRegra(m.b), m.b.codigo, m.c].join(';')));
  return linhas.join('\n') + '\n';
}

module.exports = { carregarMotor, regrasV5, decisor, combinacao, provarEquivalencia, comparar, invariancia, dependenciaP8, precedenciaZero, naturezasSim,
  CAMPOS, TOTAL, PARES, NOVOS_CONFLITOS, VARIANTES, rodar, relatorio, rotuloRegra, leitura, sim };

if (require.main === module) {
  const res = rodar();
  const saida = process.argv[2];
  console.log('V5 × motor real: ' + res.v5.equivalenciaMotorReal + ' diferenças · escritas no banco: ' + res.escritas.length);
  for (const v of Object.values(res.variantes)) console.log(v.id.padEnd(7) + ' muda ' + String(v.comparacao.total).padStart(6) + ' (' + pct(v.comparacao.total) + ') · validação: ' + (v.errosValidacao.length ? v.errosValidacao.join(' / ') : 'ok'));
  if (saida) {
    fs.mkdirSync(saida, { recursive: true });
    fs.writeFileSync(path.join(saida, 'relatorio.md'), relatorio(res));
    const enxuto = JSON.parse(JSON.stringify(res, (k, val) => (k === 'mudancas' ? undefined : val)));
    fs.writeFileSync(path.join(saida, 'resumo.json'), JSON.stringify(enxuto, null, 2));
    for (const v of Object.values(res.variantes)) fs.writeFileSync(path.join(saida, 'mudancas-' + v.id + '.csv'), csv(v));
    console.log('Relatório em ' + saida);
  }
}
