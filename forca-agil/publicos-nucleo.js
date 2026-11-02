/* ============================================================
   PÚBLICOS DE PARTICIPAÇÃO — núcleo PURO (sem DOM, sem banco, sem relógio).
   window.faPublicosNucleo / module.exports. Usado pelas regras de entrada e de visibilidade (turmas-util.js, que lê os
   cadastros e entrega o perfil pronto), pelo ADMIN (formulário de evento, selo "Fora do público atual") e pelas regras
   do banco (montar-regras-inscricoes.js gera a conferência DESTA tabela) — a mesma tabela nos três lugares.

   "Quem participa" do evento (eventos/<ev>/publicoDesc) é um rótulo. Cada rótulo é de um destes tipos:
     - RESTRINGE SEMPRE: Gerentes (= aba Gerentes, fa-gerentes) e Técnicos;
     - RESTRINGE DEPOIS DA ATIVAÇÃO (publicos-config/ativo = true, só os super-admins ligam): Diretores (= aba Diretores,
       fa-diretores), as sete categorias de ADMIN › Outros públicos (fa-outros-publicos) e os dois agrupados. Antes da
       ativação, continuam só descrição — exatamente como eram;
     - SÓ DESCRIÇÃO (não há fonte confiável de quem é quem): Empregados (o vazio), Executivos, Cedidos, Quadro próprio.
   TÉCNICOS: antes da ativação, como sempre foi — quem não está em Gerentes. Depois: quem não está em Gerentes, nem em
   Diretores, nem em nenhuma das sete categorias. Classificação operacional, não comprova vínculo.
   NUNCA se conclui por falta de dado: perfil com leitura pendente ou que falhou (null) responde null ("não verificado"),
   e quem chama trata null como "não deixa entrar / não mostra", nunca como "é técnico".
   Uma pessoa não muda de categoria porque participou de uma turma: a classificação vem só dos cadastros.
   perfil = { ativo: true | false | null, gerente: bool | null, diretor: bool | null, categorias: { <cat>: true } | null }
   (categorias = {} quando a pessoa não está em Outros públicos; null = não lido). */
(function (raiz) {
  'use strict';
  var CATEGORIAS = ['estagiario', 'menorAprendiz', 'coaud', 'conselhoDeliberativo', 'conselhoFiscal', 'conselhoConsultivo', 'assessor'];
  /* rotulo = o valor gravado em publicoDesc (e o que a vitrine mostra); nome = como a frase "destinado a ___" diz */
  var PUBLICOS = [
    { rotulo: 'Gerentes', chave: 'gerentes', nome: 'gerentes', ativacao: false, fonte: 'cargo' },
    { rotulo: 'Técnicos', chave: 'tecnicos', nome: 'técnicos', ativacao: false, fonte: 'cargo' },
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
  var DESCRITIVOS = ['', 'Executivos', 'Cedidos', 'Quadro próprio'];
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
    return temCategoria(perfil, p.categorias);
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
    ehDescritivo: ehDescritivo, ehTecnico: ehTecnico, atende: atende, motivoNaoTecnico: motivoNaoTecnico
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faPublicosNucleo = api;
})(typeof window !== 'undefined' ? window : null);
