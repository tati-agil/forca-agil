/* ============================================================
   PÚBLICOS DE PARTICIPAÇÃO — núcleo PURO (sem DOM, sem banco, sem relógio).
   window.faPublicosNucleo / module.exports. Usado pelas regras de entrada e de visibilidade (turmas-util.js, que lê os
   cadastros e entrega o perfil pronto), pelo ADMIN (formulário de evento, selo "Fora do público atual") e pelas regras
   do banco (montar-regras-inscricoes.js gera a conferência DESTA tabela) — a mesma tabela nos três lugares.

   "Quem participa" do evento (eventos/<ev>/publicoDesc) é um rótulo. Cada rótulo é de um destes tipos:
     - RESTRINGE SEMPRE: Gerentes (= aba Gerentes, fa-gerentes, qualquer nível), Gerentes executivos e Gerentes de núcleo
       (o NÍVEL do registro em fa-gerentes — fa-gerentes/<chave>/nivel = 'executivo' | 'nucleo'; ausente = "Não informado",
       que continua sendo gerente, mas não entra em público de um nível) e Técnicos;
     - RESTRINGE DEPOIS DA ATIVAÇÃO (publicos-config/ativo = true, só os super-admins ligam): Diretores (= aba Diretores,
       fa-diretores), as sete categorias de ADMIN › Outros públicos (fa-outros-publicos) e os dois agrupados. Antes da
       ativação, continuam só descrição — exatamente como eram;
     - SÓ DESCRIÇÃO (não há fonte confiável de quem é quem): Empregados (o vazio), Executivos, Cedidos, Quadro próprio, Interno, Externo.
   TÉCNICOS: antes da ativação, como sempre foi — quem não está em Gerentes. Depois: quem não está em Gerentes, nem em
   Diretores, nem em nenhuma das sete categorias. Classificação operacional, não comprova vínculo.
   NUNCA se conclui por falta de dado: perfil com leitura pendente ou que falhou (null) responde null ("não verificado"),
   e quem chama trata null como "não deixa entrar / não mostra", nunca como "é técnico".
   Uma pessoa não muda de categoria porque participou de uma turma: a classificação vem só dos cadastros.
   perfil = { ativo: true | false | null, gerente: bool | null, gerenteNivel: 'executivo' | 'nucleo' | '' | null,
              diretor: bool | null, categorias: { <cat>: true } | null }
   (categorias = {} quando a pessoa não está em Outros públicos; null = não lido. gerenteNivel '' = não é gerente ou é
   gerente "Não informado"; null/ausente = não lido — público de um nível responde null, nunca "atende").
   O NÍVEL nunca é deduzido (área, nome, cargo): só o que a admin gravou na aba Gerentes. "Executivos" do "Quem participa"
   continua só descrição — não é o mesmo que "Gerentes executivos". */
(function (raiz) {
  'use strict';
  var CATEGORIAS = ['estagiario', 'menorAprendiz', 'coaud', 'conselhoDeliberativo', 'conselhoFiscal', 'conselhoConsultivo', 'assessor'];
  /* rotulo = o valor gravado em publicoDesc (e o que a vitrine mostra); nome = como a frase "destinado a ___" diz */
  var PUBLICOS = [
    { rotulo: 'Gerentes', chave: 'gerentes', nome: 'gerentes', ativacao: false, fonte: 'cargo' },
    { rotulo: 'Técnicos', chave: 'tecnicos', nome: 'técnicos', ativacao: false, fonte: 'cargo' },
    /* um nível de Gerentes: restringe sempre, como Gerentes (não depende da ativação) */
    { rotulo: 'Gerentes executivos', chave: 'gerentesExecutivos', nome: 'gerentes executivos', ativacao: false, fonte: 'cargo', nivel: 'executivo' },
    { rotulo: 'Gerentes de núcleo', chave: 'gerentesNucleo', nome: 'gerentes de núcleo', ativacao: false, fonte: 'cargo', nivel: 'nucleo' },
    { rotulo: 'Diretores', chave: 'diretores', nome: 'diretores', ativacao: true, fonte: 'diretores' },
    { rotulo: 'Estagiários', chave: 'estagiario', nome: 'estagiários', ativacao: true, categorias: ['estagiario'] },
    { rotulo: 'Menores aprendizes', chave: 'menorAprendiz', nome: 'menores aprendizes', ativacao: true, categorias: ['menorAprendiz'] },
    { rotulo: 'Estagiários e menores aprendizes', chave: 'estagiariosEAprendizes', nome: 'estagiários e menores aprendizes', ativacao: true, categorias: ['estagiario', 'menorAprendiz'] },
    { rotulo: 'Membros do COAUD', chave: 'coaud', nome: 'membros do COAUD', ativacao: true, categorias: ['coaud'] },
    { rotulo: 'Conselho Deliberativo', chave: 'conselhoDeliberativo', nome: 'membros do Conselho Deliberativo', ativacao: true, categorias: ['conselhoDeliberativo'] },
    { rotulo: 'Conselho Fiscal', chave: 'conselhoFiscal', nome: 'membros do Conselho Fiscal', ativacao: true, categorias: ['conselhoFiscal'] },
    { rotulo: 'Conselho Consultivo', chave: 'conselhoConsultivo', nome: 'membros do Conselho Consultivo', ativacao: true, categorias: ['conselhoConsultivo'] },
    /* Conselheiros = os três conselhos, SEM o COAUD (decisão de 01/11/2026) */
    { rotulo: 'Conselheiros', chave: 'conselheiros', nome: 'conselheiros (Deliberativo, Fiscal e Consultivo)', ativacao: true, categorias: ['conselhoDeliberativo', 'conselhoFiscal', 'conselhoConsultivo'] },
    { rotulo: 'Assessores', chave: 'assessor', nome: 'assessores', ativacao: true, categorias: ['assessor'] }
  ];
  /* só descrição: '' = Empregados (o padrão do formulário) */
  var DESCRITIVOS = ['', 'Executivos', 'Cedidos', 'Quadro próprio', 'Interno', 'Externo'];
  /* NÍVEIS de Gerentes (o campo nivel em fa-gerentes). '' = Não informado (o campo ausente). Um nível por pessoa: é um
     campo só no registro dela. */
  var NIVEIS_GERENTE = [
    { valor: 'executivo', rotulo: 'Gerente executivo' },
    { valor: 'nucleo', rotulo: 'Gerente de núcleo' },
    { valor: '', rotulo: 'Não informado' }
  ];
  function nivelGerente(registro) {
    var n = registro && registro.nivel;
    return n === 'executivo' || n === 'nucleo' ? n : '';
  }
  function rotuloNivel(nivel) {
    for (var i = 0; i < NIVEIS_GERENTE.length; i++) if (NIVEIS_GERENTE[i].valor === (nivel || '')) return NIVEIS_GERENTE[i].rotulo;
    return 'Não informado';
  }
  var porRotulo = {}, porChave = {};
  PUBLICOS.forEach(function (p) { porRotulo[p.rotulo] = p; porChave[p.chave] = p; });

  function definicao(chave) { return porChave[chave] || null; }
  /* o público que o rótulo impõe HOJE: a definição, ou null (só descrição — inclusive os da ativação, desligada).
     ativo = null (ainda não sei se a ativação está ligada) → null também; quem precisa saber usa dependeDaAtivacao. */
  function publicoDoRotulo(rotulo, ativo) {
    var p = porRotulo[rotulo || ''];
    if (!p) return null;
    if (p.ativacao && ativo !== true) return null;
    return p;
  }
  function dependeDaAtivacao(rotulo) { var p = porRotulo[rotulo || '']; return !!(p && p.ativacao); }
  function restringeSempre(rotulo) { var p = porRotulo[rotulo || '']; return !!(p && !p.ativacao); }
  function ehDescritivo(rotulo) { return !porRotulo[rotulo || '']; }
  function temCategoria(perfil, lista) {
    if (!perfil || !perfil.categorias) return null;
    for (var i = 0; i < lista.length; i++) if (perfil.categorias[lista[i]] === true) return true;
    return false;
  }
  /* TÉCNICO: true | false | null (não verificado — nunca vira técnico por falta de dado) */
  function ehTecnico(perfil) {
    perfil = perfil || {};
    if (perfil.gerente === true) return false;
    if (perfil.ativo === false) return perfil.gerente === false ? true : null;
    if (perfil.ativo !== true) return null;
    if (perfil.diretor === true) return false;
    var cat = temCategoria(perfil, CATEGORIAS);
    if (cat === true) return false;
    if (perfil.gerente === false && perfil.diretor === false && cat === false) return true;
    return null;
  }
  /* a pessoa atende ao público (chave)? true | false | null */
  function atende(chave, perfil) {
    var p = porChave[chave];
    if (!p) return null;
    perfil = perfil || {};
    if (chave === 'gerentes') return typeof perfil.gerente === 'boolean' ? perfil.gerente : null;
    if (chave === 'tecnicos') return ehTecnico(perfil);
    if (chave === 'diretores') return typeof perfil.diretor === 'boolean' ? perfil.diretor : null;
    if (p.nivel) {
      if (perfil.gerente === false) return false;
      if (perfil.gerente !== true) return null;
      return typeof perfil.gerenteNivel === 'string' ? perfil.gerenteNivel === p.nivel : null;
    }
    return temCategoria(perfil, p.categorias);
  }
  /* SOMA de dois públicos de cargo (o da turma e o do evento): iguais ou só um → ele; Gerentes com um nível de Gerentes →
     o nível (o mais restrito: ele já está dentro de Gerentes); qualquer outra combinação → 'conflito' (ninguém entra). */
  function somarCargos(a, b) {
    if (!a || !b || a === b) return a || b || '';
    var pa = porChave[a], pb = porChave[b];
    if (a === 'gerentes' && pb && pb.nivel) return b;
    if (b === 'gerentes' && pa && pa.nivel) return a;
    return 'conflito';
  }
  /* por que não é técnico (para a mensagem do ADMIN): 'gerentes' | 'diretores' | 'outros' | '' */
  function motivoNaoTecnico(perfil) {
    perfil = perfil || {};
    if (perfil.gerente === true) return 'gerentes';
    if (perfil.ativo === true && perfil.diretor === true) return 'diretores';
    if (perfil.ativo === true && temCategoria(perfil, CATEGORIAS) === true) return 'outros';
    return '';
  }

  var api = Object.freeze({
    CATEGORIAS: CATEGORIAS.slice(), PUBLICOS: PUBLICOS.map(function (p) { return Object.freeze(Object.assign({}, p)); }), DESCRITIVOS: DESCRITIVOS.slice(),
    definicao: definicao, publicoDoRotulo: publicoDoRotulo, dependeDaAtivacao: dependeDaAtivacao, restringeSempre: restringeSempre,
    ehDescritivo: ehDescritivo, ehTecnico: ehTecnico, atende: atende, motivoNaoTecnico: motivoNaoTecnico,
    NIVEIS_GERENTE: NIVEIS_GERENTE.map(function (n) { return Object.freeze(Object.assign({}, n)); }), nivelGerente: nivelGerente, rotuloNivel: rotuloNivel,
    somarCargos: somarCargos
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faPublicosNucleo = api;
})(typeof window !== 'undefined' ? window : null);
