# Auditoria: documentação × implementação

Registro de qual afirmação da documentação já foi conferida contra o código.
Existe porque uma auditoria sem registro não é retomável: sem isto, quem
voltar ao assunto — inclusive eu, numa sessão nova, sem memória da anterior —
recomeça do zero ou confia numa contagem de cabeça. A primeira contagem desta
auditoria foi feita de cabeça e saiu inflada: "36 regras", quando o rastreável
era 27. Daí este arquivo.

Legenda: `[x]` rastreado até a linha do código · `[~]` parcial, só parte das
afirmações · `[ ]` não conferido.

## Situação

| camada | total | conferido |
|---|---|---|
| regras do Manual (`manual.js`) | 227 | **69** + 8 parciais |
| features do Mapa (`mapa.js`) | 227 | 0 |
| itens técnicos do Mapa | 120 | 0 |
| testes manuais (`testes.js`) | 195 | 0 |

**Já 100% coberto, e travado no CI** (`teste-consistencia-docs.js`): contagens,
listas de abas, rotas, nós do banco, arquivos. **100% conferido uma vez:** os 212
identificadores citados na prosa, os limiares numéricos, e os 556 rótulos entre
aspas (`teste-rotulos-doc.js`, que ainda não é portão — ver o cabeçalho dele).

## Regras do Manual, por seção

### `admin` — 98 regras (69 conferidas)

- [~] Lista de espera — data e hora de cada registro
- [x] Sair da turma — um caminho só, sempre com motivo
- [x] Colocar na lista de espera é decisão sua
- [x] Substituída — por quem entrou no lugar
- [x] Filtros da turma — cada pessoa em um grupo só
- [x] Acesso — só quem está na lista de admins
- [x] Admin tem acesso total ao site, mesmo sem turma própria
- [ ] Navegação por abas — desktop e mobile
- [x] Aba: Dashboard — ler o que cada pessoa respondeu
- [x] Aba: Dashboard — como cada número é calculado
- [x] Aba: Dashboard
- [x] Aba: Dashboard — destaques e temas
- [x] Aba: Eventos — visão geral
- [x] Aba: Eventos — filtro e expand/collapse
- [x] Aba: Eventos — Eventos (entidade pai das turmas)
- [x] Aba: Eventos — criar turma
- [x] Aba: Eventos — editar turma (nome, datas, link do CMFlex e resultado esperado)
- [x] Aba: Eventos — excluir turma
- [x] Aba: Eventos — exportar CSV Estado Atual
- [x] Aba: Eventos — exportar CSV Histórico
- [x] Aba: Eventos — exportar CSV individual por turma
- [~] Aba: Eventos — lista de presença para impressão/PDF
- [x] Aba: Eventos — encerrar interesse
- [x] Aba: Eventos — encerrar turma (marcar como realizada)
- [x] Aplicar migração no Roteiro-base não tem desfazer
- [x] Modais que carregam dados não piscam mais de tamanho
- [ ] Aba: Eventos — o selo "Confirmação incompleta" e por que ele existe
- [~] Aba: Eventos — confirmar inscrição (CMFlex)
- [~] Aba: Eventos — desconfirmar inscrição
- [x] Aba: Eventos — check-in do dia
- [ ] Aba: Sorteios — consulta de quem foi sorteado
- [x] Aba: Eventos — sorteio da turma
- [~] Aba: Eventos — a tela não se recolhe a cada ação
- [x] Aba: Eventos — QR Code
- [x] Aba: Eventos — QR de acesso ao site
- [~] Aba: Eventos — layout responsivo das ações
- [x] Aba: Eventos — tabela de presença
- [x] Aba: Eventos — desfazer check-in
- [x] Aba: Eventos — adicionar participante (busca em cadastros)
- [~] Aba: Eventos — quem está aguardando decisão
- [x] Aba: Eventos — remover participante
- [~] Aba: Eventos — pessoa removida pode ser readicionada
- [ ] Aba: Eventos — seção "Removidos"
- [ ] Pop-ups do admin — modais visuais (não nativos)
- [ ] Aba: Treinamentos — a quais eventos cada treinamento pertence
- [x] Aba: Certificados — Gerador v1.0
- [x] Aba: Certificados — estados: Prévia Administrativa vs. Emissão
- [x] Aba: Certificados — frequência mínima para certificado
- [x] Aba: Certificados — o que pertence ao template (não alterar)
- [x] Aba: Certificados — campos dinâmicos e coordenadas aprovadas
- [ ] Aba: Eventos — reabrir turma
- [x] Aba: Repositório — listar todos os conteúdos
- [x] Aba: Repositório — ocultar conteúdo
- [x] Aba: Repositório — restaurar conteúdo
- [x] Aba: Repositório — deletar permanentemente
- [x] Aba: Cadastrados — listar
- [x] Aba: Cadastrados — criar conta pelo admin
- [x] Aba: Cadastrados — resetar progresso
- [x] Aba: Cadastrados — redefinir senha
- [x] Aba: Administradores — consultar lista
- [x] Aba: Administradores — super-admins fixos
- [x] Aba: Administradores — admins adicionais
- [ ] Painel Admin — carregamento ao abrir #admin direto
- [x] Aba: Administradores — tratamento de erro na leitura
- [ ] Aba: Diretores
- [ ] Aba: Tipos de atividade
- [ ] Aba: Facilitadores — cadastro global
- [ ] Aba: Eventos — Equipe de facilitação de uma turma
- [ ] Aba: Eventos — Roteiro de Facilitação do evento (roteiro-base)
- [ ] Aba: Eventos — Roteiro da turma (personalização)
- [x] Roteiro — Tipo de atividade (lista administrável)
- [x] Roteiro — campo de texto não força mais maiúsculas ao digitar
- [x] Roteiro — resumo do dia (janela, programado, facilitação, pausas, lacunas reais)
- [x] Roteiro — diferença entre Intervalo (pausa) e Lacuna (buraco)
- [x] Roteiro — Sessões/janelas (ex: Manhã e Tarde) num mesmo dia
- [ ] Roteiro — resumo agregado "Sessões" no topo do dia
- [x] Roteiro — aviso de sobreposição de horário
- [x] Roteiro — seções com sub-etapas (etapas filhas)
- [x] Roteiro-base — "+ Etapa" atrás do menu "⋯" em atividade simples
- [x] Roteiro-base — aviso de atividades fora da ordem cronológica
- [x] Roteiro-base — recalcular horários seguintes ao mudar a duração
- [x] Roteiro — exportar (Agenda resumida / Agenda + Objetivos / Roteiro completo / Passo a passo)
- [x] Roteiro — hierarquia visual atividade/sub-etapa nas exportações em tabela ("Agenda resumida" e "Agenda + Objetivos")
- [x] Roteiro — campos "Resultado esperado" e "Prompt para IA"
- [x] Roteiro — identidade visual no PDF exportado (Agenda resumida e Roteiro completo)
- [x] Roteiro — paginação sem grandes áreas vazias no PDF exportado ("Roteiro completo" e "Passo a passo")
- [x] Roteiro — Markdown de campos de texto renderizado no PDF exportado ("Agenda + Objetivos", "Roteiro completo" e "Passo a passo")
- [x] Roteiro — rodapé próprio de página no PDF exportado
- [ ] Aba: Manual
- [ ] Aba: Manual — filtrar por seção e persona
- [ ] Aba: Manual — expandir/recolher tudo
- [ ] Aba: Mapa
- [ ] Aba: Mapa — estrutura dos dados em mapa.js
- [ ] Aba: Testes
- [x] Aba: Pedidos
- [x] Aba: Pedidos — responder um pedido
- [x] Aba: Pedidos — marcar como respondido e prazo em dias úteis
- [x] Aba: Pedidos — excluir com justificativa

### `turmas` — 24 regras (0 conferidas)

- [ ] Lista de espera — entrar
- [ ] Lista de espera — sair
- [ ] Lista de espera — quem saiu da fila
- [ ] Lista de espera — conferência da fila
- [ ] Lista de espera — uma linha por turma de origem
- [ ] Lista de espera — mover para turma
- [ ] Lista de espera — remover sem mover
- [ ] Lista de espera — migrar da turma
- [ ] Acesso geral — mesma página para todos os perfis
- [ ] Turma com interesse encerrado — inscrições encerradas (antes da turma iniciar)
- [ ] Turma em andamento — card automático a partir do primeiro dia
- [ ] Turma realizada — card automático após o último dia ou ação do admin
- [ ] Bloco "A Missão" e "Como funciona" — por evento, opcional
- [ ] Itinerário dia a dia — por evento, itens estáticos
- [ ] Se a sessão expirar com a página aberta
- [ ] Registrar interesse → botão vira "Remover interesse" + mensagem sobre CMFlex
- [ ] Remover interesse → botão volta a "Tenho interesse"
- [ ] Quem já é Inscrita não pode se autorremover — botão fica travado
- [ ] Corrida: turma encerra interesse entre carregar a página e clicar em "Tenho interesse"
- [ ] Corrida rara: turma encerra interesse com a página já aberta
- [ ] Falha ao gravar no Firebase
- [ ] Se a verificação inicial falhar, a pessoa não vê nenhum aviso
- [ ] Botão "Tenho interesse"/"Remover interesse" não duplica ações ao sair e voltar da página
- [ ] Botão "Tenho interesse"/"Remover interesse" fica desabilitado durante a gravação no Firebase

### `cadastrar` — 14 regras (0 conferidas)

- [ ] Botão olhinho nos campos de senha
- [ ] Cadastro — e-mail obrigatório @previ.com.br
- [ ] Cadastro — senha
- [ ] Cadastro — área/setor
- [ ] Cadastro — checkbox de termos (obrigatório)
- [ ] Cadastro — checkbox de opt-in (opcional)
- [ ] Cadastro — e-mail já existente
- [ ] Cadastro — formatação automática
- [ ] Cadastro — botão durante envio
- [ ] Cadastro — verificação de e-mail obrigatória
- [ ] Cadastro pelo admin — conta direta sem verificação de e-mail
- [ ] Cadastrados — confirmar cadastro manualmente
- [ ] Cadastrados — bloquear/desbloquear acesso
- [ ] Cadastrados — filtro por status

### `menu` — 12 regras (0 conferidas)

- [ ] O que o visitante vê — só o modal de login
- [ ] Menu para usuário logado
- [ ] Link Admin no menu
- [ ] Link Facilitador no menu
- [ ] Perfis de acesso — quais existem e o que muda entre eles
- [ ] O acesso do Inscrito não pode cair enquanto o site ainda está carregando
- [ ] Por que "interessado" não é um perfil de acesso
- [ ] Como ler as etiquetas de persona nas regras
- [ ] Clicar no avatar/nome no menu
- [ ] Clicar no avatar/nome no menu — sem turma confirmada
- [ ] Sair
- [ ] Menu mobile (≤ 600px) — hamburguer sempre visível

### `inicio` — 12 regras (0 conferidas)

- [ ] Acesso geral
- [ ] Botão final da página — "Ver turmas"
- [ ] Botão "Conhecer a iniciativa"
- [ ] Crawl de abertura — animação
- [ ] Crawl — botão "⏸ Pausar"
- [ ] Crawl — botão "≡ Ler texto"
- [ ] Crawl — botão "↻ Repetir abertura"
- [ ] Card "Como funciona" → Conteúdos
- [ ] Card "Como funciona" → Repositório
- [ ] Card "Como funciona" → Treinamento Jedi
- [ ] Link no rodapé para previ.com.br
- [ ] Botão do hero — "Ver turmas"

### `entrar` — 11 regras (0 conferidas)

- [ ] Sessão que não pode ser renovada — o site se recupera sozinho
- [ ] Quando o servidor demora: o site não fica preto
- [ ] Botão "Testar conexão" — descobrir o que está travando
- [ ] Modal não fecha ao clicar fora
- [ ] Botão olhinho no campo de senha
- [ ] Login — e-mail obrigatório @previ.com.br
- [ ] Segurança — cinco camadas de proteção
- [ ] Login — erro de credenciais
- [ ] Login — botão durante autenticação
- [ ] Login — e-mail não verificado
- [ ] Login — esqueci minha senha

### `repositorio` — 11 regras (0 conferidas)

- [ ] Acesso — logado e inscrito
- [ ] Adicionar conteúdo
- [ ] Remover conteúdo próprio
- [ ] Moderação (Admin)
- [ ] Identificação dos conteúdos
- [ ] Descrição dos cards — ver mais / ver menos
- [ ] Filtrar por tipo
- [ ] Formulário "Adicionar Conteúdo" — campos
- [ ] Formulário "Adicionar Conteúdo" — URL
- [ ] Formulário "Adicionar Conteúdo" — conteúdo duplicado
- [ ] Formulário "Adicionar Conteúdo" — cancelar

### `avaliacao` — 11 regras (0 conferidas)

- [ ] Uma resposta por pessoa, por turma — e quem pode ler
- [ ] Quando o formulário avança sozinho de seção
- [ ] Quem vê a aba Avaliação
- [ ] Admin navega por qualquer evento/turma na Avaliação
- [ ] Admin libera e encerra a avaliação por turma
- [ ] Seções obrigatórias e opcionais
- [ ] Accordion — seções colapsadas por padrão
- [ ] Auto-avançar após nota
- [ ] Rascunho automático — não perde o que já respondeu
- [ ] Identificação opcional
- [ ] Envio único por turma

### `minha-area` — 10 regras (0 conferidas)

- [ ] Admin: ver a tela como o participante vê
- [ ] Quem acessa a Minha Área
- [ ] Os quatro estados da Minha Área
- [ ] As três fases de uma turma
- [ ] Turma programada não mostra frequência nem certificado
- [ ] Minhas turmas e frequência
- [ ] Baixar o próprio certificado
- [ ] Situação da avaliação por turma
- [ ] Meus pedidos
- [ ] Por que a Minha Área NÃO mostra o QR Code de check-in

### `quiz` — 9 regras (0 conferidas)

- [ ] Acesso — pelos eventos das turmas em que a pessoa está inscrita
- [ ] Progresso é separado por treinamento
- [ ] Acesso completo
- [ ] Autodiagnóstico
- [ ] Painel de patente
- [ ] Revelar patente — pré-requisito
- [ ] Revelar patente — bloqueado enquanto autodiagnóstico pendente
- [ ] Revelar patente — o que acontece
- [ ] Reset de progresso (Admin)

### `checkin` — 7 regras (0 conferidas)

- [ ] Como funciona e quem acessa
- [ ] Sem login
- [ ] Turma ainda não finalizada
- [ ] Check-in do dia não aberto
- [ ] Pessoa não inscrita nessa turma
- [ ] Já fez check-in no dia
- [ ] Sucesso

### `conteudos` — 3 regras (0 conferidas)

- [ ] Acesso
- [ ] Navegação lateral por pontos
- [ ] Links externos "Ler na íntegra"

### `facilitador` — 3 regras (0 conferidas)

- [ ] "Minhas Facilitações" — só as turmas da própria pessoa
- [ ] "Minhas Facilitações" — cada card mostra o papel
- [ ] "Abrir roteiro" — leitura para todos, edição só para a responsável

### `ajuda` — 2 regras (0 conferidas)

- [ ] Acesso
- [ ] Acordeão de perguntas

## Ordem sugerida para continuar

1. ~~As 21 regras do Roteiro de Facilitação~~ — FEITO, e a previsão estava
   errada. Eu esperava o maior rendimento por ser a feature mais nova; deu 3
   divergências em 21 (14%), MENOS que a aba Eventos (7 em 21, 33%). As regras
   de PDF, as mais detalhadas do Manual inteiro, passaram inteiras.

   A correlação não é "código recente". É **"código que mudou depois de o texto
   ser escrito"**. O Roteiro foi documentado junto com a implementação e não foi
   mexido desde então; a aba Eventos descreve código reescrito várias vezes por
   cima. Ao escolher o próximo lote, procure onde houve RETRABALHO — não onde é
   novo.
2. As 8 abas menores de `admin` (Certificados, Dashboard, Repositório,
   Cadastrados, Administradores, Pedidos, Tipos de atividade, Sorteios).
3. `turmas` (24) e `cadastrar` (14) — fluxo público, muita mudança em agosto.
4. A triagem dos ~85 candidatos restantes do `teste-rotulos-doc.js`, até zerar,
   para ele virar portão de CI.
5. As features do Mapa e os testes manuais, que ninguém tocou ainda.

## Método (o que deu errado antes)

- **Para afirmar que falta algo, leia o corpo INTEIRO da regra.** Quatro
  quase-achados falsos nesta auditoria vieram de afirmar falta olhando texto
  cortado — os 11 motivos de remoção "faltando" estavam todos lá.
- **Cuidado com janela de busca que atravessa duas estruturas.** Achei que
  faltava uma coluna na seção Removidos; era o `grep` pegando duas tabelas.
- **Registre o que PASSOU no exame, não só o que falhou.** `dataConclusao`
  parecia ter o bug de fuso do #109 e não tinha; isso vale ser escrito.
