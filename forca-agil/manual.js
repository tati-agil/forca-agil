/* Força Ágil — Manual (ADMIN › Manual)
 *
 * Documentação para PESSOAS: o que cada área faz, quem pode usar, por que as principais regras
 * existem, onde está a fonte oficial e qual teste prova o comportamento quando existe um.
 *
 * Este arquivo NÃO é fonte de regra nenhuma: nada aqui é lido por outro módulo, nem decide
 * acesso ou comportamento. Quem decide é o código (auth.js, router.js…), as regras do banco
 * (database.rules.json) e, para conceitos, ADMIN › Taxonomia. Quando o Manual e essas fontes
 * divergirem, as fontes estão certas e o Manual precisa ser corrigido.
 *
 * Carregado sob demanda por admin.js na primeira vez que a aba Manual é aberta (quem nunca abre
 * a aba não baixa este arquivo). Referência técnica (banco, módulos, deploy) fica fora do site,
 * em docs/referencia-tecnica.md. */
(function () {
  'use strict';

  /* As quatro dimensões de acesso. Não formam uma escada: cada pessoa tem um valor em cada uma. */
  var DIMENSOES = [
    { id: 'autenticacao', nome: 'Autenticação', valores: 'sem sessão · com sessão',
      texto: 'Todo o site exige entrar com e-mail @previ.com.br. Sem sessão a pessoa só vê a tela de entrar, cadastrar e recuperar senha.' },
    { id: 'participacao', nome: 'Participação no programa', valores: 'cadastrada · inscrita confirmada',
      texto: 'Com sessão, a pessoa é só cadastrada até o admin confirmar a inscrição dela numa turma. Manifestar interesse não muda o acesso; a confirmação é que libera Conteúdos, Treinamento e "Avaliar oficina". Admin conta como inscrita.' },
    { id: 'perfil', nome: 'Perfil funcional', valores: 'Facilitador · Diretor · Avaliação · Avaliação + Arquitetura · equipe de turma',
      texto: 'Listas próprias, independentes da participação e entre si. Cada uma libera só a sua área: Facilitador abre "Minhas Facilitações"; Diretor vê eventos reservados a diretores; Avaliação e Avaliação + Arquitetura abrem a Avaliação de Produto/Serviço; a equipe de uma turma (responsável ou facilitador) conduz aquela turma.' },
    { id: 'admin', nome: 'Privilégio administrativo', valores: 'Admin · super-admin',
      texto: 'Admin entra no painel ADMIN completo. Super-admin é admin que também gerencia a lista de administradores.' },
  ];

  /* Estados de uma pessoa numa turma e as ações que mudam o estado (conferido em app.js e admin.js). */
  var ESTADOS = [
    { id: 'sem', nome: 'Sem registro', texto: 'Ainda não se manifestou nesta turma.' },
    { id: 'interessada', nome: 'Interessada', texto: 'Clicou em "Tenho interesse" ou foi adicionada assim pelo admin. Não muda o acesso.' },
    { id: 'inscrita', nome: 'Inscrita', texto: 'Confirmada pelo admin. É o que libera Conteúdos, Treinamento e "Avaliar oficina". Só pode estar inscrita em uma turma por vez.' },
    { id: 'removida', nome: 'Removida', texto: 'Saiu da turma. O registro fica, com motivo, data e destino (lista de espera, outra turma, substituída ou saiu).' },
  ];
  var TRANSICOES = [
    { de: 'Sem registro', para: 'Interessada', acao: '"Tenho interesse" (a pessoa) ou "＋ Participante" (admin)' },
    { de: 'Sem registro', para: 'Inscrita', acao: '"＋ Participante" como Inscrita (admin)' },
    { de: 'Interessada', para: 'Inscrita', acao: '"Confirmar" (admin)' },
    { de: 'Inscrita', para: 'Interessada', acao: '"Desconfirmar" (admin)' },
    { de: 'Interessada', para: 'Removida', acao: '"Remover interesse" (a pessoa) ou "Remover" (admin)' },
    { de: 'Inscrita', para: 'Removida', acao: '"Remover" (admin), ou automático ao ser confirmada em outra turma' },
    { de: 'Removida', para: 'Interessada ou Inscrita', acao: 'Readicionada pela pessoa (turma aberta) ou pelo admin' },
  ];

  /* Cada área responde: o que é, quem usa, o que importa saber, onde está a fonte, que teste prova. */
  var AREAS = [
    { id: 'acesso', titulo: 'Entrar, sessão e acesso',
      oque: 'Cadastro, login, recuperação de senha e a decisão de quem vê cada página.',
      quem: 'Todo mundo (autenticação).',
      importante: [
        'Cadastro só com e-mail @previ.com.br. Quem se cadastra recebe um e-mail de verificação e só entra depois de confirmar; conta criada pelo admin já entra liberada.',
        '"Ainda não sei" não é "não tem acesso": enquanto a inscrição, a lista de admins ou o acesso à Avaliação ainda estão chegando (rede lenta da sala), o site espera em vez de expulsar a pessoa.',
        'O site nunca fica com a tela preta: enquanto espera mostra "Carregando…", e se a sessão travar recarrega uma vez e pede para entrar de novo.',
      ],
      fonte: ['auth.js e router.js (quem acessa cada página)', 'database.rules.json (quem lê e grava cada dado)'],
      prova: ['teste-tela-preta.js', 'teste-rolagem-decisao-tardia.js', 'teste-checagens-interface.js'] },

    { id: 'turmas', titulo: 'Turmas, interesse e lista de espera',
      oque: 'A vitrine de eventos e turmas, o interesse da pessoa, a lista de espera e a inscrição confirmada.',
      quem: 'Quem tem sessão vê a vitrine e manifesta interesse; o admin confirma e remove.',
      importante: [
        'Interesse não tem limite e não dá acesso a nada; só a confirmação do admin torna a pessoa inscrita.',
        'Inscrita não consegue se remover pelo site: o botão fica travado em "✓ Inscrita". Só o admin desconfirma, porque é ele quem sabe se ela continua inscrita no CMFlex.',
        'Confirmar alguém que já é inscrita em outra turma remove a outra inscrição, com aviso antes.',
        'Lista de espera é por evento. Evento ou turma podem ser restritos: a diretores, ou a um público listado pelo admin.',
        'Quem sai de uma turma fica registrado com motivo e destino; nada é apagado sem querer.',
      ],
      estados: true,
      fonte: ['app.js (vitrine e interesse) e admin.js (confirmar, remover)', 'Nós turmas-interesse, fa-espera, turmas-publico e eventos-publico (database.rules.json)'],
      prova: ['teste-ordem-vitrine.js', 'teste-publico-restrito-evento.js', 'teste-admin-abrir-lista-restrita.js', 'teste-minha-area-fila.js'] },

    { id: 'conteudos', titulo: 'Conteúdos e Treinamento',
      oque: 'Conteúdos de agilidade e o Treinamento (autodiagnóstico com patente).',
      quem: 'Inscrita confirmada numa turma, e admin.',
      importante: [
        'O Treinamento pertence a eventos: a pessoa vê os treinamentos dos eventos em que está confirmada.',
        'Refazer o autodiagnóstico não apaga o resultado anterior: cada patente revelada fica no histórico.',
        'Quando a turma tem a Construção da Aposta liberada, o convite para a dinâmica aparece dentro do Treinamento.',
      ],
      fonte: ['game.js e ADMIN › Treinamentos', 'router.js (acesso a Conteúdos e Treinamento)'],
      prova: ['teste-treinamento-conteudo.js', 'teste-treinamento-cartao.js', 'teste-autodiagnostico-refazer.js', 'teste-aposta.js'] },

    { id: 'avaliar-oficina', titulo: 'Avaliar oficina',
      oque: 'O formulário de avaliação da oficina, respondido por turma (menu "Avaliar oficina", endereço #avaliacao). Não confundir com a Avaliação de Produto/Serviço.',
      quem: 'Inscrita confirmada numa turma em que o admin liberou a avaliação; o admin revisa o formulário de qualquer turma.',
      importante: [
        'O admin libera e encerra a avaliação de cada turma ("Liberar avaliação" / "Encerrar avaliação").',
        'Uma resposta por pessoa e por turma, com rascunho guardado e identificação opcional (anônima por padrão).',
        'As respostas alimentam o ADMIN › Dashboard.',
      ],
      fonte: ['avaliacao.js', 'Nó avaliacoes (database.rules.json: cada pessoa lê e grava só a própria resposta)'],
      prova: ['teste-dashboard-escopo.js', 'Smoke com o Firebase real (smoke-site-real.js)'] },

    { id: 'avaliacao-produto', titulo: 'Avaliação de Produto/Serviço',
      oque: 'Avaliação arquitetural de produtos e serviços e a Adequação à Squad (menu "Avaliação", endereço #avaliacoes).',
      quem: 'Admin geral e quem está em "Usuários autorizados" (perfil funcional): "Avaliação" avalia; "Avaliação + Arquitetura" também faz a curadoria e a decisão arquitetural final.',
      importante: [
        'O acesso vem só da lista de Usuários autorizados (ADMIN › Arquitetura, gerida pelo admin geral) e vale na hora, sem recarregar.',
        'O nome e a definição de cada classificação vêm da Taxonomia Arquitetural; o Manual não repete esses conceitos.',
        'As regras do banco aplicam o perfil: esconder botão não é a barreira.',
        'Texto novo de questionário não reescreve o passado: cada avaliação mostra a pergunta que foi respondida. Ao reavaliar, a pergunta cujo texto mudou pede SIM ou NÃO de novo.',
        'Posicionamento Organizacional (O1–O9), no botão de mesmo nome da lista: para um item com Avaliação de Produto/Serviço concluída, recomenda que TIPO de estrutura deve sustentar a responsabilidade associada a ele — nunca diz que o objeto "é" uma Linha e não escolhe estrutura concreta. Os três perfis consultam; só "Avaliação + Arquitetura" e o admin geral iniciam, respondem, concluem ou descartam. Um rascunho aberto e um Posicionamento vigente por item; concluído e descartado são finais.',
        'Para iniciar ou reavaliar um Posicionamento, a Avaliação de Produto/Serviço do item precisa ser a versão que vale (a mais recente da cadeia, concluída e fora da Lixeira) e estar com "Motor atual". Se o motor estiver desatualizado, atualize P1–P16 em Produto/Serviço; se a versão for equivalente, reconcilie-a lá; se houver uma reavaliação de P1–P16 em andamento, conclua ou resolva essa versão antes. Enquanto o motor ainda está sendo verificado, a tela espera — não libera nem bloqueia por engano. Um Posicionamento já iniciado ou concluído continua podendo ser aberto. Se a Avaliação de Produto/Serviço mudar depois que o rascunho foi aberto, ele continua salvo, mas só pode ser concluído quando aquela mesma avaliação voltar a estar válida e com "Motor atual"; se a versão que vale passou a ser outra, descarte o rascunho e inicie um novo.',
        'Na ficha do Posicionamento, a Recomendação automática (do motor, nunca alterada) fica separada da Decisão final: "Avaliação + Arquitetura" e o admin geral registram uma decisão por versão, só entre os 8 posicionamentos firmes (confirmação, divergência ou resolução do "A validar" — fora da confirmação, a justificativa é obrigatória). A decisão não muda nem se apaga: para corrigir, Reavaliar (com motivo) cria a versão seguinte, com as respostas pré-preenchidas; a anterior continua vigente até a nova ser concluída. Enquanto houver reavaliação em andamento, a versão vigente não recebe decisão. Avaliações sem decisão mostram "Sem decisão registrada".',
        'Baixar o Posicionamento em PDF ou Excel (os três perfis): "📄 GERAR PDF" na ficha de uma avaliação concluída, vigente ou histórica, e o menu de exportação da lista, com o Excel da lista atual (respeita o filtro) ou de todas as avaliações (abas Resumo, Respostas O1–O9, Histórico e Trilha). O arquivo mostra o que foi gravado na época — recomendação, decisão e efeito sobre a Squad não são recalculados — e a situação Vigente/Histórica é a do momento da exportação. Enquanto as decisões ainda estão carregando, a exportação fica desabilitada.',
        'Liberar a Adequação à Squad, no resultado do Posicionamento, só quer dizer que as perguntas S1–S8 podem ser respondidas para o item: não cria nem associa Squad. É uma regra fixa, que não se configura: Linhas são formadas por Squads, Áreas Especializadas e CoEs não — por isso só os posicionamentos do ramo Linha liberam a Adequação à Squad.',
      ],
      links: [{ texto: 'Abrir a Avaliação de Produto/Serviço', href: '#avaliacoes' }, { texto: 'Ver os conceitos em ADMIN › Taxonomia', aba: 'adminPanelTaxonomia' }],
      fonte: ['auth.js (getAvaliacaoTipo) e nó fa-avaliacao-autorizados', 'database.rules.json', 'Conceitos: ADMIN › Taxonomia'],
      prova: ['teste-rules-perfis-avaliacao.js', 'teste-avaliacoes-acessos.js', 'teste-classificacoes-fonte-unica.js', 'teste-squad-endereco.js', 'teste-avaliacao-posicionamento.js', 'teste-rules-posicionamento.js', 'teste-regras-posicionamento-tabela.js', 'teste-posicionamento-decisao.js', 'teste-rules-posicionamento-decisao.js', 'teste-posicionamento-exportacoes.js', 'teste-posicionamento-exportacao-nucleo.js'] },

    { id: 'arquitetura', titulo: 'Arquitetura',
      oque: 'Configuração da Avaliação de Produto/Serviço: questionários, motores, naturezas, Motor de Squad, Documentação e mapas de Arquitetura (com o Mapa da Floresta) e Usuários autorizados.',
      quem: 'Admin geral e "Avaliação + Arquitetura" (que no ADMIN vê só esta aba). Usuários autorizados é só do admin geral.',
      importante: [
        'Mudança de regra do motor só vale depois de simulada e publicada; cada publicação cria uma versão nova.',
        'O Mapa da Floresta e os documentos são mantidos na própria tela de Documentação e mapas; o Manual não copia o conteúdo.',
        'Tudo o que muda fica no histórico de auditoria; nada é apagado (documentos são arquivados).',
        'Correção editorial de questionário vinda do código só vale quando alguém clica em Aplicar: cria uma versão nova e nunca sobrescreve um texto editado à mão (aparece como divergente, para conferir caso a caso).',
        'Questionários e versões tem três questionários: Classificação arquitetural (P1–P16), Adequação à Squad (S1–S8) e Posicionamento Organizacional (O1–O9 e o diagnóstico conflito × recorte). O texto do Posicionamento é mantido aqui; ele é respondido na área Avaliação (botão "Posicionamento Organizacional").',
        'Código, tipo da pergunta (SIM/NÃO ou "mesma"/"distintas") e os códigos das respostas são estrutura, não texto: não aparecem para edição e nenhuma publicação os muda.',
      ],
      links: [{ texto: 'Abrir ADMIN › Arquitetura', aba: 'adminPanelArquitetura' }],
      fonte: ['ADMIN › Arquitetura (a própria tela)', 'database.rules.json'],
      prova: ['teste-mapa-floresta.js', 'teste-arquitetura-documentacao.js', 'teste-motor-adicionar-condicao.js', 'teste-rules-perfis-avaliacao.js', 'teste-correcao-editorial-29-textos.js', 'teste-questionario-posicionamento.js'] },

    { id: 'taxonomia', titulo: 'Taxonomia',
      oque: 'O dicionário de conceitos em dois domínios: arquitetural ("o que é o item?") e organizacional ("que tipo de estrutura é esta?").',
      quem: 'Só admin geral. A Avaliação de Produto/Serviço lê dali apenas o nome e a definição vigente das classificações e, no organizacional, só dos 10 posicionamentos do motor de Posicionamento.',
      importante: [
        'A Taxonomia define, a Avaliação aplica: é a fonte única dos conceitos.',
        'Uma definição publicada não é editada: corrigir é criar uma nova versão. Só o rótulo da fonte vigente pode ser corrigido no lugar ("Editar rótulo"), sem mudar o texto nem a vigência.',
        'Nada se apaga: conceito é inativado com motivo, relação é encerrada, e conceito ligado a uma classificação da Avaliação não pode ser inativado.',
        'No organizacional, "Conceitos-base do Posicionamento Organizacional" lista os 10 códigos do motor de Posicionamento. Registrar a ligação (prévia, depois confirmação; uma vez só) protege o conceito: ligado, ele não pode ser inativado nem trocar entre "Tipo organizacional" e "Organização do trabalho". Enquanto faltar ligação aparece "Proteção do Posicionamento incompleta".',
        'No domínio organizacional, Linha, Área Especializada e CoE são as estruturas de posicionamento; Squad e Capítulo ficam em "Organização do trabalho", e Disciplina é conceito auxiliar. Trocar entre "Tipo organizacional" e "Organização do trabalho" pede motivo, fica no histórico e só vale para conceito sem pai e sem filho ativo (o banco confere por um índice de filhos ativos, construído uma única vez); filho inativo não impede.',
      ],
      links: [{ texto: 'Abrir ADMIN › Taxonomia', aba: 'adminPanelTaxonomia' }],
      fonte: ['ADMIN › Taxonomia (a própria tela)', 'database.rules.json'],
      prova: ['teste-rules-taxonomia.js', 'teste-rules-taxonomia-governanca.js', 'teste-taxonomia.js', 'teste-taxonomia-governanca.js', 'teste-taxonomia-camada-trabalho.js', 'teste-taxonomia-rotulo-vigente.js', 'teste-taxonomia-posicionamento-ligacoes.js', 'teste-posicionamentos-fonte-unica.js'] },

    { id: 'papeis', titulo: 'Facilitação, diretores e Minha Área',
      oque: '"Minhas Facilitações" (#facilitador), eventos reservados a diretores e a Minha Área de cada pessoa.',
      quem: 'Facilitador e Diretor são perfis funcionais dados pelo admin; Minha Área é de todo mundo com sessão.',
      importante: [
        'Estar na lista de Facilitadores só abre a página; quem conduz uma turma é a equipe daquela turma (um responsável e facilitadores), definida no ADMIN.',
        'Diretor vê eventos marcados como reservados a diretores e administradores; não ganha acesso ao ADMIN.',
        'A Minha Área sempre mostra um estado (inscrita, em análise, na lista de espera ou nenhuma turma) e nunca mostra QR de check-in.',
      ],
      fonte: ['facilitador.js, roteiro.js e aluno.js', 'Nós fa-facilitadores, fa-diretores e turmas-equipe (database.rules.json)'],
      prova: ['teste-minha-area-fila.js', 'teste-minha-area-dia-rotulo.js', 'teste-ver-como-turmas.js'] },

    { id: 'admin', titulo: 'Administração',
      oque: 'O painel ADMIN: eventos e turmas, participantes, check-in, certificados, sorteios, roteiro de facilitação, cadastros, administradores, diretores, facilitadores, tipos de atividade, treinamentos, repositório, pedidos e dashboard.',
      quem: 'Admin. Só super-admin muda a lista de administradores.',
      importante: [
        'Ações que mudam a situação de alguém pedem confirmação e ficam registradas (quem fez e quando).',
        'Check-in é aberto pelo admin para um dia; a presença registrada alimenta a frequência e o certificado.',
        'Se a tela deixa editar, ela também salva: uma gravação recusada aparece como erro, nunca em silêncio.',
        'O que só uma pessoa consegue conferir depois de publicar está no checklist pós-deploy do repositório (docs/checklist-pos-deploy.md).',
      ],
      fonte: ['admin.js e os módulos de cada aba', 'database.rules.json'],
      prova: ['teste-checagens-interface.js', 'teste-acoes-cadastrado.js', 'teste-editar-cadastro.js', 'teste-roteiro-texto-rico.js'] },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function lista(itens, cls) {
    return '<ul class="' + cls + '">' + itens.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
  }

  function htmlEstados() {
    var h = '<div class="man-estados" id="manualEstadosTurma">';
    h += '<p class="man-rotulo">Estados de uma pessoa numa turma</p>';
    h += '<ol class="man-estados-lista">' + ESTADOS.map(function (e) {
      return '<li class="man-estado man-estado--' + e.id + '"><strong>' + esc(e.nome) + '</strong><span>' + esc(e.texto) + '</span></li>';
    }).join('') + '</ol>';
    h += '<p class="man-rotulo">O que muda o estado</p>';
    h += '<ul class="man-transicoes">' + TRANSICOES.map(function (t) {
      return '<li><span class="man-trans-de">' + esc(t.de) + '</span><span class="man-trans-seta" aria-hidden="true">→</span><span class="man-trans-para">' + esc(t.para) + '</span><span class="man-trans-acao">' + esc(t.acao) + '</span></li>';
    }).join('') + '</ul></div>';
    return h;
  }

  function htmlArea(a) {
    var h = '<details class="man-area" id="manual-' + a.id + '" data-area="' + a.id + '">';
    h += '<summary class="man-area-cab"><span class="man-area-titulo">' + esc(a.titulo) + '</span></summary>';
    h += '<div class="man-area-corpo">';
    h += '<p class="man-oque">' + esc(a.oque) + '</p>';
    h += '<p class="man-quem"><span class="man-rotulo-inline">Quem usa</span> ' + esc(a.quem) + '</p>';
    h += '<p class="man-rotulo">O que é importante saber</p>' + lista(a.importante, 'man-importante');
    if (a.estados) h += htmlEstados();
    if (a.links && a.links.length) {
      h += '<p class="man-links">' + a.links.map(function (l) {
        return l.aba
          ? '<button type="button" class="btn btn--sm btn--ghost man-ir-aba" data-aba="' + esc(l.aba) + '">' + esc(l.texto) + ' →</button>'
          : '<a class="btn btn--sm btn--ghost man-link" href="' + esc(l.href) + '">' + esc(l.texto) + ' →</a>';
      }).join('') + '</p>';
    }
    h += '<div class="man-ref"><div><p class="man-rotulo">Fonte oficial</p>' + lista(a.fonte, 'man-fonte') + '</div>';
    h += '<div><p class="man-rotulo">Prova automatizada</p>' + lista(a.prova, 'man-prova') + '</div></div>';
    h += '</div></details>';
    return h;
  }

  function render() {
    var container = document.getElementById('adminManual');
    if (!container) return;
    var h = '<div class="man-wrap">';
    h += '<h3 class="man-titulo">Manual da Força Ágil</h3>';
    h += '<p class="man-intro">O que cada área faz, quem pode usar e por que as principais regras existem. O Manual explica e aponta a fonte oficial; ele não decide nada: quem decide é o sistema (código e regras do banco) e, para conceitos, a Taxonomia.</p>';

    h += '<section class="man-dimensoes" id="manualDimensoes" aria-labelledby="manualDimensoesTitulo">';
    h += '<h4 class="man-subtitulo" id="manualDimensoesTitulo">Como entender os acessos</h4>';
    h += '<p class="man-intro">O acesso não é uma escada. Cada pessoa tem um valor em cada uma destas quatro dimensões, e elas se combinam.</p>';
    h += '<div class="man-dim-grade">' + DIMENSOES.map(function (d) {
      return '<div class="man-dim" data-dimensao="' + d.id + '"><p class="man-dim-nome">' + esc(d.nome) + '</p><p class="man-dim-valores">' + esc(d.valores) + '</p><p class="man-dim-texto">' + esc(d.texto) + '</p></div>';
    }).join('') + '</div></section>';

    h += '<nav class="man-indice" id="manualIndice" aria-label="Áreas do Manual">';
    h += AREAS.map(function (a) { return '<button type="button" class="man-indice-item" data-alvo="' + a.id + '">' + esc(a.titulo) + '</button>'; }).join('');
    h += '</nav>';

    h += '<div class="man-areas" id="manualAreas">' + AREAS.map(htmlArea).join('') + '</div>';
    h += '<p class="man-rodape">Referência técnica (banco, módulos, deploy), checklist pós-deploy e backlog de testes ficam no repositório, na pasta docs/.</p>';
    h += '</div>';
    container.innerHTML = h;

    container.querySelectorAll('.man-indice-item').forEach(function (b) {
      b.addEventListener('click', function () {
        var alvo = document.getElementById('manual-' + b.dataset.alvo);
        if (!alvo) return;
        alvo.open = true;
        alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    container.querySelectorAll('.man-ir-aba').forEach(function (b) {
      b.addEventListener('click', function () {
        /* Mesmo caminho do clique na aba (inclui o endereço próprio da Arquitetura). */
        var aba = document.querySelector('.admin-tab-btn[data-panel="' + b.dataset.aba + '"]');
        if (aba && !aba.hidden) aba.click();
        else if (window.faAdminAbrirAba) window.faAdminAbrirAba(b.dataset.aba);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  window.faInitManual = render;
})();
